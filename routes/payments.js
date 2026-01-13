const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { mollieClient } = require('../lib/mollie');
const { requireAuth, isAdmin } = require('../middleware/auth');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { generateInvoiceNumber, createInvoicePDF } = require('../services/invoiceService');
const invoiceService = require('../services/invoiceService');
const prisma = require('../config/prisma');
const balanceService = require('../services/balanceService');
const { mapMollieMethodToDb } = require('../helpers/method-map');
const ActivityService = require('../services/activityService');

// Helper functions for Mollie recurring payments
async function getActiveCardMandate(mollieClient, mollieCustomerId) {
  try {
    const mandates = await mollieClient.customers_mandates.page({ customerId: mollieCustomerId });
    
    const list = mandates?._embedded?.mandates || [];
    // Log voor debug
    console.log('[Mollie] mandates found:', list.map(m => ({
      id: m.id, 
      status: m.status, 
      method: m.method, 
      createdAt: m.createdAt, 
      cardNumber: m.details?.cardNumber
    })));

    // Pak de recentste geldige CREDITCARD mandate
    const active = list
      .filter(m => m.method === 'creditcard' && m.status === 'valid')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

    console.log('[Mollie] active creditcard mandate:', active ? {
      id: active.id,
      status: active.status,
      method: active.method,
      cardNumber: active.details?.cardNumber
    } : 'none found');

    return active || null;
  } catch (error) {
    console.error('Error fetching mandates:', error);
    return null;
  }
}

async function findOpenFirstPayment(mollieClient, customerId) {
  try {
    // Zoek laatste payments van deze klant en pak een open/authorized 'first'
    const list = await mollieClient.payments.page({ profileId: undefined, customerId });
    const openFirst = list?._embedded?.payments?.find(p =>
      p.sequenceType === 'first' && (p.status === 'open' || p.status === 'pending')
    );
    console.log('[Mollie] open first payment found:', openFirst ? {
      id: openFirst.id,
      status: openFirst.status,
      sequenceType: openFirst.sequenceType,
      checkoutUrl: openFirst._links?.checkout?.href
    } : 'none found');
    return openFirst || null;
  } catch (error) {
    console.error('Error finding open first payment:', error);
    return null;
  }
}

async function ensureFirstPaymentForVerification({ mollieClient, customerId, amount = '0.00', redirectUrl, webhookUrl }) {
  try {
    // 1) Bestaat er al een open first? Gebruik die
    const existing = await findOpenFirstPayment(mollieClient, customerId);
    if (existing?.['_links']?.checkout?.href) {
      console.log('[Mollie] Using existing first payment:', existing.id);
      return existing;
    }

    // 2) Zo niet: maak een nieuwe first (consent)
    console.log('[Mollie] Creating new first payment for verification');
    const first = await mollieClient.payments.create({
      amount: { currency: 'EUR', value: amount },
      customerId,
      sequenceType: 'first',
      description: 'Creditcard verifiëren (consent)',
      redirectUrl,
      webhookUrl
    });
    
    console.log('[Mollie] Created first payment:', {
      id: first.id,
      status: first.status,
      checkoutUrl: first._links?.checkout?.href
    });
    
    return first;
  } catch (error) {
    console.error('Error ensuring first payment:', error);
    throw error;
  }
}

function formatAmount(value) {
  // Ensure string with 2 decimals
  return Number(value).toFixed(2);
}

// Map Mollie statuses to valid database statuses
const mapMollieStatus = (mollieStatus) => {
  switch (mollieStatus) {
    case 'open': return 'pending';
    case 'paid': return 'paid';
    case 'failed': return 'failed';
    case 'canceled': return 'cancelled';
    case 'expired': return 'expired';
    default: return 'pending';
  }
};

// Function to update user balance after successful payment
const updateUserBalance = async (userId, amount, paymentId) => {
  try {
    console.log(`Updating balance for user ${userId}, amount: €${amount}`);
    
    // Get current balance
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('balance')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching user profile for balance update:', profileError);
      throw new Error('Kon gebruikersprofiel niet ophalen voor saldo update');
    }

    const newBalance = (userProfile.balance || 0) + amount;
    
    const { error: balanceError } = await supabaseAdmin
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', userId);

    if (balanceError) {
      console.error('Error updating user balance:', balanceError);
      throw new Error('Kon saldo niet updaten');
    }

    console.log(`Successfully updated balance for user ${userId}: ${userProfile.balance} -> ${newBalance}`);
    
    // Log activity for successful topup
    try {
      await ActivityService.logActivity({
        userId: userId,
        type: 'payment_completed',
        severity: 'medium',
        title: 'Saldo opgewaardeerd',
        description: `Saldo succesvol opgewaardeerd met €${amount}`,
        metadata: {
          payment_id: paymentId,
          amount: amount,
          old_balance: userProfile.balance,
          new_balance: newBalance,
          payment_type: 'topup'
        }
      });
      console.log(`Activity logged for topup payment ${paymentId}`);
    } catch (activityError) {
      console.error('Error logging topup activity:', activityError);
      // Don't throw error here as payment was successful
    }

    return { success: true, newBalance };
  } catch (error) {
    console.error('Error in updateUserBalance:', error);
    throw error;
  }
};

// Validatie middleware voor topup requests
const validateTopup = [
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Bedrag moet groter zijn dan 0'),
  body('method')
    .isIn(['ideal', 'creditcard'])
    .withMessage('Betaalmethode moet ideal of creditcard zijn'),
];

// Validatie middleware voor bank account
const validateBankAccount = [
  body('accountName')
    .notEmpty()
    .withMessage('Naam rekeninghouder is verplicht'),
  body('iban')
    .matches(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/)
    .withMessage('Ongeldig IBAN nummer'),
  body('bank')
    .notEmpty()
    .withMessage('Bank is verplicht')
];

// GET /api/payments/topups/prepare - Prepare topup with card info for confirmation
router.get('/topups/prepare', requireAuth, async (req, res) => {
  try {
    const { amount } = req.query;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'unauthorized' 
      });
    }
    
    if (!amount) {
      return res.status(400).json({ 
        success: false, 
        error: 'amount_required' 
      });
    }

    console.log(`[Prepare] User ID: ${userId}, amount: €${amount}`);

    // Get user profile with Mollie customer ID
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('mollie_customer_id, email, first_name, last_name')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('[Prepare] Error fetching profile:', profileError);
      return res.status(500).json({
        success: false,
        error: 'Kon gebruikersprofiel niet ophalen'
      });
    }

    if (!profile || !profile.mollie_customer_id) {
      console.log('[Prepare] No Mollie customer ID found for user:', userId);
      return res.json({ 
        success: true, 
        state: 'no_customer',
        message: 'Geen Mollie klant ID gevonden. Voeg eerst een betaalmethode toe.'
      });
    }

    console.log('[Prepare] Mollie customer ID:', profile.mollie_customer_id);

    // 1) Live mandates check
    const mandates = await mollieClient.customers_mandates.page({ customerId: profile.mollie_customer_id });
    console.log('[prepare] customerId', profile.mollie_customer_id);
    console.log('[prepare] mandates', (mandates?._embedded?.mandates || []).map(m => ({
      id: m.id, 
      method: m.method, 
      status: m.status, 
      createdAt: m.createdAt,
      last4: m.details?.cardNumber, 
      label: m.details?.cardLabel
    })));
    
    const validCard = mandates?._embedded?.mandates?.find(m => m.method === 'creditcard' && m.status === 'valid');

    if (validCard) {
      console.log('[Prepare] Valid mandate found:', validCard.id);
      // OK → bevestigingsscherm tonen
      return res.json({
        success: true,
        state: 'ready',
        confirm: {
          amount: formatAmount(amount),
          card: {
            brand: validCard?.details?.cardLabel || 'Creditcard',
            last4: validCard?.details?.cardNumber || '••••',
            expires: validCard?.details?.cardExpiryDate || null
          },
          mandateId: validCard.id
        }
      });
    }

    // 2) Geen geldige mandate → check for existing pending verification first
    console.log('[Prepare] No valid mandate found, checking for existing pending verification');
    
    // Check if user has a pending credit card verification in database
    const { data: pendingPaymentMethod, error: pendingError } = await supabaseAdmin
      .from('payment_methods')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'credit_card')
      .eq('status', 'pending')
      .maybeSingle();

    if (!pendingError && pendingPaymentMethod && pendingPaymentMethod.details?.checkout_url) {
      console.log('[Prepare] Found existing pending verification:', pendingPaymentMethod.details.checkout_url);
      return res.json({
        success: true,
        state: 'verify_required',
        checkoutUrl: pendingPaymentMethod.details.checkout_url
      });
    }

    // 3) No existing verification → create new one
    console.log('[Prepare] No existing verification found, creating new first payment');
    const redirectUrl = `${process.env.APP_URL}/dashboard/payments/consent-complete`;
    const webhookUrl = `${process.env.APP_URL}/api/webhooks/mollie`;
    
    const first = await ensureFirstPaymentForVerification({
      mollieClient,
      customerId: profile.mollie_customer_id,
      amount: '0.00', // cards: 0,00 mag
      redirectUrl,
      webhookUrl
    });

    const checkoutUrl = first?._links?.checkout?.href;
    if (checkoutUrl) {
      console.log('[Prepare] Verification required, checkout URL:', checkoutUrl);
      return res.json({
        success: true,
        state: 'verify_required',
        checkoutUrl
      });
    }

    // 4) Geen URL (rare edge) → forceer UI fallback
    console.log('[Prepare] No checkout URL available');
    return res.json({ 
      success: true, 
      state: 'verify_required', 
      checkoutUrl: null,
      message: 'Verificatie vereist, maar er is geen link beschikbaar.'
    });

  } catch (error) {
    console.error('[Prepare] Error in prepare topup:', error);
    return res.status(500).json({
      success: false,
      error: 'Er is een fout opgetreden bij het voorbereiden van de opwaardering'
    });
  }
});

// POST /api/payments/topups/charge - Execute recurring payment (no checkout)
router.post('/topups/charge', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, mandateId } = req.body;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'unauthorized' 
      });
    }

    if (!amount) {
      return res.status(400).json({ 
        success: false, 
        error: 'amount_required' 
      });
    }

    console.log(`[Charge] User ID: ${userId}, amount: €${amount}, mandateId: ${mandateId}`);

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('mollie_customer_id, email, first_name, last_name')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('[Charge] Error fetching profile:', profileError);
      return res.status(500).json({
        success: false,
        error: 'Kon gebruikersprofiel niet ophalen'
      });
    }

    if (!profile || !profile.mollie_customer_id) {
      return res.status(400).json({
        success: false,
        error: 'Geen Mollie klant ID gevonden',
        code: 'NO_MOLLIE_CUSTOMER'
      });
    }

    // Sanity: validate mandate still valid
    const mandates = await mollieClient.customers_mandates.page({ customerId: profile.mollie_customer_id });
    const isValid = mandates?._embedded?.mandates?.some(m => m.id === mandateId && m.status === 'valid' && m.method === 'creditcard');
    
    if (!isValid) {
      console.log('[Charge] No valid mandate found for mandateId:', mandateId);
      return res.json({ 
        success: false, 
        error: 'no_valid_mandate', 
        requiresConsent: true 
      });
    }

    console.log('[Charge] Creating recurring payment with mandate:', mandateId);

    // Create recurring payment (no checkout)
    const payment = await mollieClient.customers_payments.create({
      customerId: profile.mollie_customer_id,
      amount: { currency: 'EUR', value: formatAmount(amount) },
      description: `Saldo opwaarderen (€${formatAmount(amount)})`,
      sequenceType: 'recurring',
      mandateId,
      webhookUrl: `${process.env.APP_URL}/api/webhooks/mollie`,
      metadata: { userId, type: 'topup_recurring' }
    });

    console.log('[Charge] Payment created:', {
      id: payment.id,
      status: payment.status,
      amount: payment.amount.value
    });

    // Save payment in database
    const { error: dbError } = await supabaseAdmin
      .from('payments')
      .insert({
        user_id: userId,
        amount: parseFloat(amount),
        status: mapMollieStatus(payment.status),
        payment_method: null,
        payment_details: {
          mollie_payment_id: payment.id,
          payment_type: 'topup',
          method: 'credit_card',
          description: `Saldo opwaarderen (€${amount})`,
          requires_checkout: false,
          mandate_id: mandateId
        }
      });

    if (dbError) {
      console.error('[Charge] Database error bij opslaan payment:', dbError);
      throw new Error('Kon payment niet opslaan in database');
    }

    // Log activity for recurring payment
    try {
      await ActivityService.logActivity({
        userId: userId,
        type: 'payment_created',
        severity: 'low',
        title: 'Saldo opwaardering verwerkt',
        description: `Saldo opwaardering van €${amount} verwerkt via opgeslagen creditcard`,
        metadata: {
          payment_id: payment.id,
          amount: parseFloat(amount),
          payment_method: 'credit_card',
          mollie_payment_id: payment.id,
          payment_type: 'topup_recurring',
          mandate_id: mandateId
        },
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent']
      });
    } catch (activityError) {
      console.error('[Charge] Error logging recurring payment activity:', activityError);
    }

    return res.json({ 
      success: true, 
      paymentId: payment.id, 
      status: payment.status,
      message: 'Betaling wordt verwerkt... Je saldo wordt bijgewerkt zodra de betaling is bevestigd.'
    });

  } catch (error) {
    console.error('[Charge] Error in charge topup:', error);
    
    // Handle SCA/3DS step-up or issuer decline - fallback to consent/checkout
    if (error.message && error.message.includes('insufficient_funds')) {
      return res.status(400).json({
        success: false,
        error: 'charge_failed',
        message: 'Onvoldoende saldo op de creditcard',
        requiresConsent: true
      });
    }
    
    return res.status(400).json({
      success: false,
      error: 'charge_failed',
      message: 'Kon niet automatisch afschrijven. Probeer opnieuw of voeg een nieuwe creditcard toe.',
      requiresConsent: true
    });
  }
});

// POST /api/payments/topup
router.post('/topup', requireAuth, async (req, res) => {
  try {
    const { amount, method } = req.body;
    const userId = req.user.id;
    
    console.log(`Topup request from user ID: ${userId}, email: ${req.user.email}, method: ${method}`);

    // 1. Validatie
    if (!amount || amount < 1) {
      return res.status(400).json({
        success: false,
        error: 'Bedrag moet minimaal €1 zijn'
      });
    }

    // Validate payment method - only creditcard allowed for topups
    if (!method || method !== 'creditcard') {
      return res.status(400).json({
        success: false,
        error: 'Alleen creditcard is toegestaan voor saldo opwaarderen'
      });
    }

    // 2. Check if user has payment methods (both active and pending are valid)
    const { data: paymentMethods, error: methodsError } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'pending']);

    if (methodsError) {
      console.error('Error fetching payment methods:', methodsError);
      return res.status(500).json({
        success: false,
        error: 'Kon betaalmethoden niet ophalen'
      });
    }

    if (!paymentMethods || paymentMethods.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Je moet eerst een betaalmethode toevoegen voordat je je saldo kunt opwaarderen',
        code: 'NO_PAYMENT_METHOD'
      });
    }

    // 3. Get user's Mollie customer ID
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('mollie_customer_id, email, first_name, last_name')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return res.status(500).json({
        success: false,
        error: 'Kon gebruikersprofiel niet ophalen'
      });
    }

    if (!profile) {
      console.error(`Profile not found for user ID: ${userId}`);
      return res.status(404).json({
        success: false,
        error: 'Gebruikersprofiel niet gevonden'
      });
    }

    if (!profile.mollie_customer_id) {
      return res.status(400).json({
        success: false,
        error: 'Mollie klant ID niet gevonden. Voeg eerst een betaalmethode toe.',
        code: 'NO_MOLLIE_CUSTOMER'
      });
    }

    // 4. Find creditcard payment method
    const creditCardMethod = paymentMethods.find(pm => pm.type === 'credit_card');

    if (!creditCardMethod) {
      return res.status(400).json({
        success: false,
        error: 'Geen creditcard betaalmethode gevonden. Voeg eerst een creditcard toe.',
        code: 'NO_CREDITCARD_METHOD'
      });
    }
    
    // Charge stored card for topup (no checkout if mandate exists)
    const amountStr = amount.toFixed(2);
    
    try {
      // 1) Look for valid creditcard mandate
      const mandates = await mollieClient.customers_mandates.page({
        customerId: profile.mollie_customer_id,
      });

      const activeCardMandate = mandates?._embedded?.mandates?.find(m => 
        m.status === 'valid' && m.method === 'creditcard'
      );

      let molliePayment;
      let requiresCheckout = false;
      let checkoutUrl = null;

      // 2) If no valid mandate → create payment with saved payment method for verification
      if (!activeCardMandate) {
        console.log('No valid creditcard mandate found, using saved payment method for verification');
        
        // Use saved payment method for verification - specify method to go directly to card verification
        molliePayment = await mollieClient.customers_payments.create({
          customerId: profile.mollie_customer_id,
          amount: { currency: 'EUR', value: amountStr },
          description: `GrowSocial saldo opwaarderen (€${amountStr})`,
          method: 'creditcard', // This should go directly to card verification
          redirectUrl: `${process.env.APP_URL}/dashboard/payments?topup_success=true`,
          ...(process.env.NODE_ENV === 'production' && { webhookUrl: `${process.env.APP_URL}/api/webhooks/mollie` }),
          metadata: { userId, type: 'topup_verification' },
        });
        
        // Check if payment requires additional verification
        if (molliePayment.status === 'open' && molliePayment._links?.checkout?.href) {
          requiresCheckout = true;
          checkoutUrl = molliePayment._links.checkout.href;
        } else {
          requiresCheckout = false;
        }
      } else {
        console.log('Valid creditcard mandate found, creating recurring payment');
        
        // 3) Recurring payment (off-session) — NO redirectUrl and NO method
        molliePayment = await mollieClient.customers_payments.create({
          customerId: profile.mollie_customer_id,
          amount: { currency: 'EUR', value: amountStr },
          description: `GrowSocial saldo opwaarderen (€${amountStr})`,
          sequenceType: 'recurring',
          mandateId: activeCardMandate.id, // target specific card
          ...(process.env.NODE_ENV === 'production' && { webhookUrl: `${process.env.APP_URL}/api/webhooks/mollie` }),
          metadata: { userId, type: 'topup_recurring' },
        });
        
        requiresCheckout = false;
      }

      // Store the payment result for later use
      const paymentResult = {
        molliePayment,
        requiresCheckout,
        checkoutUrl
      };

      // 5. Save payment in database
      const { error: dbError } = await supabaseAdmin
        .from('payments')
        .insert({
          user_id: userId,
          amount: amount,
          status: mapMollieStatus(paymentResult.molliePayment.status),
          payment_method: null, // Use null instead of enum value
          payment_details: {
            mollie_payment_id: paymentResult.molliePayment.id,
            payment_type: 'topup',
            method: 'credit_card',
            description: `Saldo opwaarderen (€${amount})`,
            requires_checkout: paymentResult.requiresCheckout
          }
        });

    if (dbError) {
      console.error('Database error bij opslaan payment:', dbError);
      throw new Error('Kon payment niet opslaan in database');
    }

    // 5.5. Balance will be updated via webhook when payment is confirmed

      // 6. Log activity for topup initiation
      try {
        await ActivityService.logActivity({
          userId: userId,
          type: 'payment_created',
          severity: 'low',
          title: 'Saldo opwaardering gestart',
          description: `Saldo opwaardering van €${amount} gestart via creditcard`,
          metadata: {
            payment_id: paymentResult.molliePayment.id,
            amount: amount,
            payment_method: 'credit_card',
            mollie_payment_id: paymentResult.molliePayment.id,
            payment_type: 'topup',
            requires_checkout: paymentResult.requiresCheckout
          },
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent']
        });
      } catch (activityError) {
        console.error('Error logging topup initiation activity:', activityError);
        // Don't fail the request if activity logging fails
      }

      // 7. Return response
      res.json({
        success: true,
        paymentId: paymentResult.molliePayment.id,
        paymentMethod: 'Creditcard',
        status: paymentResult.molliePayment.status,
        amount: amount,
        requiresCheckout: paymentResult.requiresCheckout,
        checkoutUrl: paymentResult.checkoutUrl,
        message: paymentResult.requiresCheckout 
          ? 'Creditcard betaling is gestart. Voltooi de betaling om je saldo bij te werken.'
          : 'Betaling wordt verwerkt... Je saldo wordt bijgewerkt zodra de betaling is bevestigd.'
      });

    } catch (mollieError) {
      console.error('Mollie API error:', mollieError);
      return res.status(500).json({
        success: false,
        error: 'Er is een fout opgetreden bij het verwerken van je betaling. Probeer het opnieuw.'
      });
    }

  } catch (error) {
    console.error('Error in /payments/topup:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het verwerken van je betaling'
    });
  }
});

// POST /api/payments/confirm/:paymentId - Manual balance update for successful payments
router.post('/confirm/:paymentId', requireAuth, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.id;

    console.log(`🔍 Confirming payment ${paymentId} for user ${userId}`);

    // Get payment from database (search by mollie_payment_id)
    const { data: payment, error: dbError } = await supabase
      .from('payments')
      .select('*')
      .contains('payment_details', { mollie_payment_id: paymentId })
      .eq('user_id', userId)
      .single();

    if (dbError) {
      console.error('❌ Database error fetching payment:', dbError);
      return res.status(500).json({
        success: false,
        error: 'Database fout bij ophalen payment'
      });
    }

    if (!payment) {
      console.error('❌ Payment not found:', paymentId);
      return res.status(404).json({
        success: false,
        error: 'Payment niet gevonden'
      });
    }

    console.log('📋 Payment found:', payment.id, 'Status:', payment.status);

    // Check if payment is already confirmed
    if (payment.status === 'paid') {
      console.log('✅ Payment already confirmed');
      return res.json({
        success: true,
        message: 'Payment is al bevestigd',
        balance: payment.payment_details?.new_balance || 'N/A'
      });
    }

    console.log('🔄 Checking payment status with Mollie...');
    
    // Check payment status with Mollie
    const molliePaymentId = payment.payment_details?.mollie_payment_id || paymentId;
    const molliePayment = await mollieClient.payments.get(molliePaymentId);
    const mappedStatus = mapMollieStatus(molliePayment.status);
    
    console.log('📊 Mollie status:', molliePayment.status, '-> Mapped:', mappedStatus);

    // Update payment status in database
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: mappedStatus,
        payment_details: {
          ...payment.payment_details,
          mollie_payment_data: molliePayment,
          status_updated_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    if (updateError) {
      console.error('❌ Error updating payment status:', updateError);
      console.error('❌ Update data:', {
        status: mappedStatus,
        payment_details: payment.payment_details,
        mollie_payment_data: molliePayment
      });
      throw new Error(`Kon payment status niet updaten: ${updateError.message}`);
    }

    // If payment is successful, update balance
    if (mappedStatus === 'paid') {
      console.log('💰 Payment successful, updating balance...');
      const balanceResult = await updateUserBalance(userId, payment.amount, payment.id);
      
      console.log('✅ Balance updated successfully');
      res.json({
        success: true,
        message: 'Payment bevestigd en saldo bijgewerkt',
        status: mappedStatus,
        newBalance: balanceResult.newBalance,
        amount: payment.amount
      });
    } else {
      console.log('⏳ Payment not yet successful, status:', mappedStatus);
      res.json({
        success: false,
        message: `Payment status: ${mappedStatus}`,
        status: mappedStatus
      });
    }

  } catch (error) {
    console.error('❌ Error in /payments/confirm:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het bevestigen van de payment'
    });
  }
});

// GET /api/payments/status/:paymentId
router.get('/status/:paymentId', requireAuth, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.id;

    // Haal payment op uit database (search by mollie_payment_id)
    const { data: payment, error: dbError } = await supabase
      .from('payments')
      .select('*')
      .contains('payment_details', { mollie_payment_id: paymentId })
      .eq('user_id', userId)
      .single();

    if (dbError || !payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment niet gevonden'
      });
    }

    // Check status bij Mollie
    const molliePaymentId = payment.payment_details?.mollie_payment_id || paymentId;
    const molliePayment = await mollieClient.payments.get(molliePaymentId);

    // Update status in database als deze is veranderd
    const mappedStatus = mapMollieStatus(molliePayment.status);
    if (mappedStatus !== payment.status) {
      const { error: updateError } = await supabase
        .from('payments')
        .update({
          status: mappedStatus,
          payment_details: {
            ...payment.payment_details,
            mollie_payment_data: molliePayment,
            status_updated_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.id);

      if (updateError) {
        console.error('❌ Error updating payment status:', updateError);
        console.error('❌ Update data:', {
          status: mappedStatus,
          payment_details: payment.payment_details,
          mollie_payment_data: molliePayment
        });
        // Don't throw error here, just log it
      } else {
        console.log(`✅ Payment ${paymentId} status updated: ${payment.status} -> ${mappedStatus}`);
      }
    }

    res.json({
      success: true,
      status: mappedStatus,
      payment: {
        ...payment,
        status: mappedStatus
      }
    });

  } catch (error) {
    console.error('Error in /payments/status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het ophalen van de payment status'
    });
  }
});

// Handmatig factuur aanmaken
router.post('/manual', async (req, res) => {
  try {
    const {
      user_id,
      subscription_id,
      amount,
      vat_amount,
      due_date,
      description
    } = req.body;

    // Validate required fields
    if (!user_id || !amount || !vat_amount || !due_date || !description) {
      return res.status(400).json({
        error: 'Alle verplichte velden moeten worden ingevuld'
      });
    }

    // Get user details from Supabase
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        company_name,
        first_name,
        last_name,
        address,
        postal_code,
        city,
        country,
        vat_number,
        kvk_number
      `)
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        error: 'Gebruiker niet gevonden'
      });
    }

    // Get subscription details if provided
    let subscription = null;
    if (subscription_id) {
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select('id, name, price')
        .eq('id', subscription_id)
        .single();

      if (subError || !subData) {
        return res.status(404).json({
          error: 'Abonnement niet gevonden'
        });
      }
      subscription = subData;
    }

    // Create invoice using the invoice service
    const invoice = await invoiceService.createInvoice({
      user,
      subscription,
      amount: parseFloat(amount),
      vatAmount: parseFloat(vat_amount),
      dueDate: new Date(due_date),
      description,
      status: 'PENDING'
    });

    res.json({
      message: 'Factuur succesvol aangemaakt',
      invoice
    });
  } catch (error) {
    console.error('Error creating manual invoice:', error);
    res.status(500).json({
      error: 'Er is een fout opgetreden bij het aanmaken van de factuur'
    });
  }
});

// Factuur downloaden
router.get('/:id/invoice', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const invoiceId = req.params.id;
    
    // Haal factuur op
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (invError || !invoice) {
      return res.status(404).json({ 
        error: 'Factuur niet gevonden' 
      });
    }

    // Check of gebruiker toegang heeft tot deze factuur
    if (invoice.user_id !== userId && !req.user.isAdmin) {
      return res.status(403).json({ 
        error: 'Geen toegang tot deze factuur' 
      });
    }

    // Als er een PDF URL is, stuur die door
    if (invoice.pdf_url) {
      res.redirect(invoice.pdf_url);
    } else {
      res.status(404).json({ 
        error: 'PDF niet beschikbaar' 
      });
    }

  } catch (error) {
    console.error('Error downloading invoice:', error);
    res.status(500).json({ 
      error: 'Er is een fout opgetreden bij het downloaden van de factuur' 
    });
  }
});

// POST /api/payments/pay-with-balance
router.post('/pay-with-balance', requireAuth, async (req, res) => {
  try {
    const { invoice_id } = req.body;
    const userId = req.user.id;

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoice_id)
      .eq('user_id', userId)
      .single();

    if (invoiceError || !invoice) {
      return res.status(404).json({
        error: 'Factuur niet gevonden'
      });
    }

    // Check if invoice is already paid
    if (invoice.status === 'PAID') {
      return res.status(400).json({
        error: 'Deze factuur is al betaald'
      });
    }

    // Check if user has sufficient balance
    const hasBalance = await balanceService.hasSufficientBalance(userId, invoice.total_amount);
    if (!hasBalance) {
      return res.status(400).json({
        error: 'Onvoldoende saldo',
        required: invoice.total_amount,
        current: await balanceService.getUserBalance(userId)
      });
    }

    // Process payment
    const transaction = await balanceService.payWithBalance(
      userId,
      invoice_id,
      invoice.total_amount
    );

    res.json({
      success: true,
      message: 'Betaling succesvol verwerkt',
      transaction
    });

  } catch (error) {
    logger.error('Error in pay-with-balance:', error);
    res.status(500).json({
      error: error.message || 'Er is een fout opgetreden bij het verwerken van de betaling'
    });
  }
});

// POST /api/payments/methods/bank
router.post('/methods/bank', requireAuth, validateBankAccount, async (req, res) => {
  try {
    // 1. Validatie errors checken
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { accountName, iban, bank } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;

    // 2. Get or create Mollie customer first
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('mollie_customer_id, email')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return res.status(500).json({
        success: false,
        error: 'Kon gebruikersprofiel niet ophalen'
      });
    }

    if (!profile) {
      console.error(`Profile not found for user ID: ${userId}`);
      return res.status(404).json({
        success: false,
        error: 'Gebruikersprofiel niet gevonden'
      });
    }

    // Get or create Mollie customer
    let mollieCustomerId = profile.mollie_customer_id;

    if (!mollieCustomerId) {
      console.log('Creating new Mollie customer for user:', userId);
      const customer = await mollieClient.customers.create({
        name: profile.email,
        email: profile.email,
        metadata: {
          userId: userId
        }
      });
      
      mollieCustomerId = customer.id;
      console.log('Created new Mollie customer:', mollieCustomerId);

      // Store the Mollie customer ID in the profile
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ mollie_customer_id: mollieCustomerId })
        .eq('id', userId);

      if (updateError) {
        console.error('Error storing Mollie customer ID:', updateError);
        throw new Error('Kon Mollie klant ID niet opslaan');
      }
    } else {
      console.log('Using existing Mollie customer:', mollieCustomerId);
    }

    // 3. IBAN verifiëren via Mollie
    try {
      const mandate = await mollieClient.customers_mandates.create({
        customerId: mollieCustomerId,
        method: 'directdebit',
        consumerName: accountName,
        consumerAccount: iban,
        consumerBic: bank, // Bank BIC code
        signatureDate: new Date().toISOString(),
        mandateReference: `MANDATE_${userId}_${Date.now()}`
      });

      // 3. Payment method opslaan in database
      // First check if user already has a default payment method
      const { data: existingMethods, error: checkError } = await supabaseAdmin
        .from('payment_methods')
        .select('id, is_default')
        .eq('user_id', userId)
        .eq('is_default', true)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing payment methods:', checkError);
        throw new Error('Kon bestaande betaalmethoden niet ophalen');
      }

      // Map bank account to sepa enum
      const mollieMethod = 'directdebit'; // Bank account maps to directdebit
      const dbMethod = mapMollieMethodToDb(mollieMethod);

      if (!dbMethod) {
        return res.status(400).json({
          error: 'unsupported_payment_method',
          provider_method: mollieMethod
        });
      }

      const { error: dbError } = await supabaseAdmin
        .from('payment_methods')
        .insert({
          user_id: userId,
          type: dbMethod,                    // enum: sepa
          provider: 'mollie',
          provider_method: mollieMethod,     // raw provider string: "directdebit"
          provider_payment_method_id: mandate.id,
          status: 'active',
          is_default: !existingMethods,
          details: {
            account_name: accountName,
            iban: iban,
            bank: bank,
            mandate_id: mandate.id,
            mandate_status: mandate.status
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (dbError) {
        console.error('Database error bij opslaan payment method:', dbError);
        throw new Error('Kon betaalmethode niet opslaan in database');
      }

      // 4. Stuur succes response terug
      res.json({
        success: true,
        message: 'Bankrekening succesvol toegevoegd',
        mandate: {
          id: mandate.id,
          status: mandate.status
        }
      });

    } catch (mollieError) {
      console.error('Mollie error:', mollieError);
      throw new Error('Kon bankrekening niet verifiëren bij Mollie');
    }

  } catch (error) {
    console.error('Error in /payments/methods/bank:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het toevoegen van je bankrekening'
    });
  }
});

// POST /api/payments/methods/creditcard
router.post('/methods/creditcard', requireAuth, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;

    // 1. Verify user is authenticated
    if (!req.user?.id) {
      return res.status(401).json({ 
        success: false, 
        error: 'Je sessie is verlopen of ongeldig. Log opnieuw in om door te gaan.' 
      });
    }

    // 2. Ensure profile exists (should always exist due to trigger)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, mollie_customer_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Profile not found:', profileError);
      return res.status(500).json({ 
        success: false, 
        error: 'Er is een fout opgetreden. Probeer het later opnieuw of neem contact op met support.' 
      });
    }

    // 3. Verify token
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token is verplicht'
      });
    }

    // 4. Proceed with Mollie verification
    try {
      // Ensure we have a valid base URL
      const baseUrl = process.env.APP_URL || 'http://localhost:3000';
      const redirectUrl = `${baseUrl}/dashboard/payments/consent-complete`;
      
      // Get or create Mollie customer
      let mollieCustomerId = profile.mollie_customer_id;

      // If no Mollie customer ID exists, create a new customer
      if (!mollieCustomerId) {
        console.log('Creating new Mollie customer for user:', userId);
        const customer = await mollieClient.customers.create({
          name: userEmail,
          email: userEmail,
          metadata: {
            userId: userId
          }
        });
        
        mollieCustomerId = customer.id;
        console.log('Created new Mollie customer:', mollieCustomerId);

        // Store the Mollie customer ID in the profile
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ mollie_customer_id: mollieCustomerId })
          .eq('id', userId);

        if (updateError) {
          console.error('Error storing Mollie customer ID:', updateError);
          throw new Error('Kon Mollie klant ID niet opslaan');
        }
      } else {
        console.log('Using existing Mollie customer:', mollieCustomerId);
      }

      // 3. Proceed with credit card verification using the customer ID
      console.log('Starting credit card verification for customer:', mollieCustomerId);
      const verification = await mollieClient.customers_payments.create({
        customerId: mollieCustomerId,
        amount: { currency: 'EUR', value: '0.01' },
        method: 'creditcard',
        cardToken: token,
        sequenceType: 'first',
        redirectUrl: redirectUrl,
        locale: 'nl_NL',
        description: 'Creditcard verificatie voor GrowSocial'
      });
      console.log('Credit card verification created:', verification.id, 'Status:', verification.status);

      // Save payment method in database
      // First check if user already has a default payment method
      const { data: existingMethods, error: checkError } = await supabaseAdmin
        .from('payment_methods')
        .select('id, is_default')
        .eq('user_id', userId)
        .eq('is_default', true)
        .maybeSingle();

      if (checkError) {
        throw new Error('Kon bestaande betaalmethoden niet ophalen');
      }

      // Map credit card to enum
      const mollieMethod = 'creditcard';
      const dbMethod = mapMollieMethodToDb(mollieMethod);

      if (!dbMethod) {
        return res.status(400).json({
          error: 'unsupported_payment_method',
          provider_method: mollieMethod
        });
      }

      // Insert new payment method
      const { data: paymentMethod, error: dbError } = await supabaseAdmin
        .from('payment_methods')
        .insert({
          user_id: userId,
          type: dbMethod,                    // enum: credit_card
          provider: 'mollie',
          provider_method: mollieMethod,     // raw provider string: "creditcard"
          provider_payment_method_id: verification.id,
          is_default: !existingMethods,
          metadata: {
            card_type: verification.details?.cardType || 'Unknown',
            card_last4: verification.details?.cardNumber?.slice(-4) || '****',
            expiry_date: `${verification.details?.cardExpiryMonth}/${verification.details?.cardExpiryYear}`,
            sequence_type: 'first',
            verification_status: verification.status,
            verification_id: verification.id
          },
          last_used_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (dbError) {
        throw new Error('Kon betaalmethode niet opslaan in database');
      }

      // Return success response with checkout URL for 3D Secure verification
      res.json({
        success: true,
        message: 'Creditcard verificatie gestart',
        payment_method: {
          id: paymentMethod.id,
          type: paymentMethod.type,
          is_default: paymentMethod.is_default,
          card_last4: paymentMethod.metadata.card_last4,
          card_type: paymentMethod.metadata.card_type
        },
        verification: {
          id: verification.id,
          status: verification.status,
          checkoutUrl: verification.getCheckoutUrl()
        }
      });

    } catch (mollieError) {
      // Enhanced error logging
      console.error('Mollie API Error:', {
        code: mollieError.code,
        message: mollieError.message,
        field: mollieError.field,
        details: mollieError.details,
        status: mollieError.status
      });

      // More specific error messages based on Mollie error codes
      let errorMessage = 'Kon creditcard niet verifiëren bij Mollie';
      let errorCode = 'VERIFICATION_FAILED';

      if (mollieError.code === 'invalid_token') {
        errorMessage = 'Ongeldige creditcard gegevens';
        errorCode = 'INVALID_TOKEN';
      } else if (mollieError.code === 'invalid_card_number') {
        errorMessage = 'Ongeldig kaartnummer';
        errorCode = 'INVALID_CARD_NUMBER';
      } else if (mollieError.code === 'invalid_expiry_date') {
        errorMessage = 'Ongeldige vervaldatum';
        errorCode = 'INVALID_EXPIRY';
      } else if (mollieError.code === 'invalid_cvv') {
        errorMessage = 'Ongeldige CVV code';
        errorCode = 'INVALID_CVV';
      } else if (mollieError.code === 'card_declined') {
        errorMessage = 'Kaart geweigerd door de bank';
        errorCode = 'CARD_DECLINED';
      } else if (mollieError.code === 'insufficient_funds') {
        errorMessage = 'Onvoldoende saldo op de kaart';
        errorCode = 'INSUFFICIENT_FUNDS';
      } else if (mollieError.code === 'card_expired') {
        errorMessage = 'Deze kaart is verlopen';
        errorCode = 'CARD_EXPIRED';
      } else if (mollieError.code === 'card_blocked') {
        errorMessage = 'Deze kaart is geblokkeerd';
        errorCode = 'CARD_BLOCKED';
      } else if (mollieError.code === 'card_not_active') {
        errorMessage = 'Deze kaart is niet actief';
        errorCode = 'CARD_NOT_ACTIVE';
      }
      
      throw {
        message: errorMessage,
        code: errorCode,
        originalError: mollieError
      };
    }

  } catch (error) {
    console.error('Credit card verification error:', {
      message: error.message,
      code: error.code,
      originalError: error.originalError
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het toevoegen van je creditcard',
      code: error.code || 'UNKNOWN_ERROR',
      details: error.originalError ? {
        mollieCode: error.originalError.code,
        mollieStatus: error.originalError.status
      } : undefined
    });
  }
});

module.exports = router;
