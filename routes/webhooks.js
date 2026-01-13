const express = require('express');
const router = express.Router();
const { mollieClient } = require('../lib/mollie');
const { supabaseAdmin } = require('../config/supabase');
const { handleAuthEvent } = require('../middleware/authSync');
const crypto = require('crypto');
const ActivityService = require('../services/activityService');

// Map Mollie statuses to valid database statuses
const mapMollieStatus = (mollieStatus) => {
  switch (mollieStatus) {
    case 'open':
    case 'pending': return 'pending';
    case 'paid': return 'paid';
    case 'failed': return 'failed';
    case 'canceled': return 'cancelled';
    case 'expired': return 'expired';
    default: return 'pending';
  }
};

// POST /api/webhooks/mollie
router.post('/mollie', async (req, res) => {
  try {
    const paymentId = req.body.id;
    if (!paymentId) {
      return res.status(400).json({ error: 'Geen payment ID ontvangen' });
    }

    // Haal payment op bij Mollie
    const payment = await mollieClient.payments.get(paymentId);

    // Check if this is a payment method verification (€0.01)
    if (payment.amount.value === '0.01' && payment.description.includes('verificatie')) {
      await handlePaymentMethodVerification(payment);
      return res.status(200).send('OK');
    }

    // Haal payment op uit database (zoek op mollie_payment_id)
    const { data: dbPayment, error: dbError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .contains('payment_details', { mollie_payment_id: paymentId })
      .single();

    if (dbError || !dbPayment) {
      console.error('Payment niet gevonden in database:', paymentId);
      return res.status(404).json({ error: 'Payment niet gevonden' });
    }

    // Update payment status in database (idempotent)
    const mappedStatus = mapMollieStatus(payment.status);
    
    // Only update if status has changed or payment hasn't been processed yet
    if (mappedStatus !== dbPayment.status || !dbPayment.processed_at) {
      const { error: updateError } = await supabaseAdmin
        .from('payments')
        .update({
          status: mappedStatus,
          payment_details: {
            ...dbPayment.payment_details,
            mollie_payment_data: payment,
            status_updated_at: new Date().toISOString()
          },
          processed_at: mappedStatus === 'paid' ? new Date().toISOString() : dbPayment.processed_at
        })
        .eq('id', dbPayment.id);
        
      if (updateError) {
        console.error('❌ Error updating payment:', updateError);
        console.error('❌ Update data:', {
          status: mappedStatus,
          payment_details: dbPayment.payment_details,
          mollie_payment_data: payment
        });
        throw new Error(`Kon payment status niet updaten: ${updateError.message}`);
      }
      
      console.log(`Payment ${paymentId} status updated: ${dbPayment.status} -> ${mappedStatus}`);
    } else {
      console.log(`Payment ${paymentId} status unchanged: ${mappedStatus} (already processed)`);
    }

    // Als payment succesvol is, update user balance
    if (mappedStatus === 'paid' && dbPayment.status !== 'paid') {
      // Check if this is a topup payment or automatic billing payment
      const isTopup = dbPayment.payment_details?.payment_type === 'topup';
      const isAutomaticBilling = dbPayment.payment_details?.billing_type === 'automatic_monthly_accepted_leads';
      
      if (isAutomaticBilling) {
        // Automatic billing payments: SUBTRACT from balance (user is paying for leads)
        console.log(`Processing automatic billing payment ${paymentId} for user ${dbPayment.user_id}, amount: ${dbPayment.amount}`);
        
        const { data: userProfile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('balance')
          .eq('id', dbPayment.user_id)
          .single();

        if (profileError) {
          console.error('Error fetching user profile for balance update:', profileError);
          throw new Error('Kon gebruikersprofiel niet ophalen voor saldo update');
        }

        const newBalance = Math.max(0, (userProfile.balance || 0) - dbPayment.amount); // Don't go below 0
        
        const { error: balanceError } = await supabaseAdmin
          .from('profiles')
          .update({ balance: newBalance })
          .eq('id', dbPayment.user_id);

        if (balanceError) {
          console.error('Error updating user balance:', balanceError);
          throw new Error('Kon saldo niet updaten');
        }

        console.log(`Successfully updated balance for user ${dbPayment.user_id}: ${userProfile.balance} -> ${newBalance} (automatic billing)`);
        
        // Mark leads as paid
        try {
          const AutomaticBillingService = require('../services/automaticBillingService');
          const billingService = new AutomaticBillingService();
          
          // Get the leads that were billed
          const { data: leads, error: leadsError } = await supabaseAdmin
            .from('leads')
            .select('id')
            .eq('user_id', dbPayment.user_id)
            .eq('status', 'accepted')
            .gte('created_at', dbPayment.payment_details?.billing_date || new Date().toISOString().split('T')[0]);
            
          if (!leadsError && leads && leads.length > 0) {
            await billingService.markLeadsAsPaid(dbPayment.user_id, leads);
            console.log(`Marked ${leads.length} leads as paid for user ${dbPayment.user_id}`);
          }
        } catch (leadsError) {
          console.error('Error marking leads as paid:', leadsError);
          // Don't throw error here as payment was successful
        }
        
        // Log activity for successful automatic billing
        try {
          const ActivityService = require('../services/activityService');
          await ActivityService.logActivity({
            userId: dbPayment.user_id,
            type: 'payment_completed',
            severity: 'medium',
            title: 'Automatische incasso voltooid',
            description: `Automatische incasso van €${dbPayment.amount} succesvol verwerkt`,
            metadata: {
              payment_id: paymentId,
              amount: dbPayment.amount,
              payment_method: dbPayment.payment_method,
              old_balance: userProfile.balance,
              new_balance: newBalance,
              payment_type: 'automatic_billing',
              billing_type: dbPayment.payment_details?.billing_type
            }
          });
          console.log(`Activity logged for automatic billing payment ${paymentId}`);
        } catch (activityError) {
          console.error('Error logging automatic billing activity:', activityError);
          // Don't throw error here as payment was successful
        }
        
      } else if (isTopup) {
        // Topup payments: ADD to balance (user is adding money to their account)
        console.log(`Processing topup payment ${paymentId} for user ${dbPayment.user_id}, amount: ${dbPayment.amount}`);
        
        const { data: userProfile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('balance')
          .eq('id', dbPayment.user_id)
          .single();

        if (profileError) {
          console.error('Error fetching user profile for balance update:', profileError);
          throw new Error('Kon gebruikersprofiel niet ophalen voor saldo update');
        }

        const newBalance = (userProfile.balance || 0) + dbPayment.amount;
        
        const { error: balanceError } = await supabaseAdmin
          .from('profiles')
          .update({ balance: newBalance })
          .eq('id', dbPayment.user_id);

        if (balanceError) {
          console.error('Error updating user balance:', balanceError);
          throw new Error('Kon saldo niet updaten');
        }

        console.log(`Successfully updated balance for user ${dbPayment.user_id}: ${userProfile.balance} -> ${newBalance} (topup)`);
        
        // Log activity for successful topup
        try {
          const ActivityService = require('../services/activityService');
          await ActivityService.logActivity({
            userId: dbPayment.user_id,
            type: 'payment_completed',
            severity: 'medium',
            title: 'Saldo opgewaardeerd',
            description: `Saldo succesvol opgewaardeerd met €${dbPayment.amount}`,
            metadata: {
              payment_id: paymentId,
              amount: dbPayment.amount,
              payment_method: dbPayment.payment_method,
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
        
      } else {
        // For other payment types, use the existing RPC function
        console.log(`Processing other payment type ${paymentId} for user ${dbPayment.user_id}, amount: ${dbPayment.amount}`);
        
        const { error: balanceError } = await supabase.rpc('add_to_balance', {
          p_user_id: dbPayment.user_id,
          p_amount: dbPayment.amount,
          p_payment_id: paymentId
        });

        if (balanceError) {
          console.error('Error updating balance via RPC:', balanceError);
          throw new Error('Kon saldo niet updaten via RPC');
        }

        console.log(`Successfully updated balance for user ${dbPayment.user_id} via RPC`);
      }
    }

    // Stuur 200 OK terug naar Mollie
    res.status(200).send('OK');

  } catch (error) {
    console.error('Error in Mollie webhook:', error);
    // Stuur nog steeds 200 OK terug naar Mollie
    // Dit voorkomt dat Mollie de webhook blijft retryen
    res.status(200).send('OK');
  }
});

// Verify Supabase webhook signature
function verifyWebhookSignature(req, res, next) {
  const signature = req.headers['x-supabase-signature'];
  const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return res.status(401).json({ error: 'Missing signature or webhook secret' });
  }

  const payload = JSON.stringify(req.body);
  const hmac = crypto.createHmac('sha256', webhookSecret);
  const digest = hmac.update(payload).digest('hex');

  if (signature !== digest) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
}

// Auth webhook endpoint
router.post('/auth', verifyWebhookSignature, handleAuthEvent);

// Handle payment method verification
async function handlePaymentMethodVerification(payment) {
  try {
    console.log('Processing payment method verification:', payment.id, 'Status:', payment.status);

    // Find the payment method by verification ID
    const { data: paymentMethod, error: findError } = await supabaseAdmin
      .from('payment_methods')
      .select('*')
      .eq('provider_payment_method_id', payment.id)
      .single();

    if (findError || !paymentMethod) {
      console.error('Payment method not found for verification:', payment.id);
      return;
    }

    // Update payment method status based on verification result
    let newStatus = 'pending';
    if (payment.status === 'paid') {
      newStatus = 'active';
    } else if (payment.status === 'failed' || payment.status === 'expired') {
      newStatus = 'failed';
    }

    // Update payment method in database
    const { error: updateError } = await supabaseAdmin
      .from('payment_methods')
      .update({
        status: newStatus,
        details: {
          ...paymentMethod.details,
          verification_status: payment.status,
          verification_completed_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentMethod.id);

    if (updateError) {
      console.error('Error updating payment method:', updateError);
      throw new Error('Kon betaalmethode status niet updaten');
    }

    console.log('Payment method verification updated:', paymentMethod.id, 'Status:', newStatus);

    // Log activity for admin tracking
    try {
      await ActivityService.logActivity({
        userId: paymentMethod.user_id,
        type: newStatus === 'active' ? 'payment_method_added' : 'payment_method_updated',
        severity: newStatus === 'active' ? 'medium' : 'high',
        title: newStatus === 'active' ? 'Creditcard verificatie voltooid' : 'Creditcard verificatie mislukt',
        description: `Betaalmethode verificatie ${newStatus === 'active' ? 'succesvol voltooid' : 'mislukt'}. Mollie payment ID: ${payment.id}`,
        metadata: {
          payment_method_id: paymentMethod.id,
          mollie_payment_id: payment.id,
          verification_status: payment.status,
          payment_method_type: paymentMethod.type,
          mollie_customer_id: payment.customerId
        }
      });
    } catch (activityError) {
      console.error('Error logging payment method verification activity:', activityError);
      // Don't throw error here, verification was processed successfully
    }

  } catch (error) {
    console.error('Error handling payment method verification:', error);
    throw error;
  }
}

// Handle Mollie subscription webhooks
router.post('/mollie/subscription', async (req, res) => {
  try {
    const { id, status, customerId } = req.body;
    
    console.log('Mollie subscription webhook received:', { id, status, customerId });
    
    const SubscriptionBillingService = require('../services/subscriptionBillingService');
    
    if (status === 'active') {
      // Subscription is active
      await SubscriptionBillingService.updateSubscriptionStatus(id, 'active');
      
    } else if (status === 'cancelled') {
      // Subscription was cancelled
      await SubscriptionBillingService.updateSubscriptionStatus(id, 'cancelled');
      
    } else if (status === 'suspended') {
      // Subscription was suspended
      await SubscriptionBillingService.updateSubscriptionStatus(id, 'suspended');
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Subscription webhook error:', error);
    res.status(500).send('Error');
  }
});

// POST /api/webhooks/twilio - Handle incoming Twilio WhatsApp messages
router.post('/twilio', async (req, res) => {
  try {
    const { From, To, Body, MessageSid, MessageStatus } = req.body;
    
    console.log('📱 [TWILIO WEBHOOK] Incoming message:', { From, To, Body: Body?.substring(0, 50) });
    
    if (!From || !Body) {
      console.log('⚠️ [TWILIO WEBHOOK] Missing From or Body, ignoring');
      return res.status(200).send('OK'); // Always return 200 to Twilio
    }
    
    // Normalize phone number (remove whatsapp: prefix if present)
    const normalizedFrom = From.replace(/^whatsapp:/, '').replace(/^\+/, '');
    
    // Find lead by phone number
    const { data: leads, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('id, name, phone, user_id, assigned_to')
      .or(`phone.ilike.%${normalizedFrom}%,phone.ilike.%+${normalizedFrom}%`)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (leadError) {
      console.error('❌ [TWILIO WEBHOOK] Error finding lead:', leadError);
      return res.status(200).send('OK'); // Always return 200 to Twilio
    }
    
    if (!leads || leads.length === 0) {
      console.log('⚠️ [TWILIO WEBHOOK] No lead found for phone:', normalizedFrom);
      return res.status(200).send('OK'); // Always return 200 to Twilio
    }
    
    const lead = leads[0];
    console.log('✅ [TWILIO WEBHOOK] Found lead:', lead.id, lead.name);
    
    // Store message as whatsapp activity
    // Incoming messages are from customer (not partner)
    const activityData = {
      lead_id: lead.id,
      type: 'whatsapp',
      description: Body.trim(),
      created_by: lead.assigned_to || lead.user_id, // Use assigned partner or lead owner
      created_at: new Date().toISOString(),
      metadata: {
        channel: 'whatsapp',
        direction: 'inbound',
        from: From,
        to: To,
        message_sid: MessageSid,
        message_status: MessageStatus,
        phone: normalizedFrom
      }
    };
    
    const { data: activity, error: activityError } = await supabaseAdmin
      .from('lead_activities')
      .insert([activityData])
      .select()
      .single();
    
    if (activityError) {
      console.error('❌ [TWILIO WEBHOOK] Error saving activity:', activityError);
      return res.status(200).send('OK'); // Always return 200 to Twilio
    }
    
    console.log('✅ [TWILIO WEBHOOK] Message saved as activity:', activity.id);
    
    // Always return 200 OK to Twilio
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('❌ [TWILIO WEBHOOK] Error processing webhook:', error);
    // Always return 200 OK to Twilio, even on error
    res.status(200).send('OK');
  }
});

module.exports = router; 