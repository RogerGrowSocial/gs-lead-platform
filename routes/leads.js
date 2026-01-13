const express = require("express")
const router = express.Router()
const { supabase, supabaseAdmin } = require('../config/supabase')

const { requireAuth } = require('../middleware/auth');

// Get all leads
router.get("/", async (req, res) => {
  try {
    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Manually fetch user data for each lead that has a user_id
    const transformedLeads = await Promise.all(leads.map(async (lead) => {
      let assignedUser = null
      if (lead.user_id) {
        const { data: user, error: userError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, company_name')
          .eq('id', lead.user_id)
          .single()
        
        if (!userError && user) {
          assignedUser = user
        }
      }

      return {
        ...lead,
        assigned_user: assignedUser,
        assigned_to: assignedUser ? 
          `${assignedUser.first_name} ${assignedUser.last_name}` : 
          null
      }
    }));

    res.json(transformedLeads)
  } catch (err) {
    console.error("Error fetching leads:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het ophalen van de leads" })
  }
})

// Get lead by ID
router.get("/:id", async (req, res) => {
  try {
    const { data: lead, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (error) throw error
    if (!lead) return res.status(404).json({ error: "Lead niet gevonden" })

    // Manually fetch user data if user_id exists
    let assignedUser = null
    if (lead.user_id) {
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, company_name')
        .eq('id', lead.user_id)
        .single()
      
      if (!userError && user) {
        assignedUser = user
      }
    }

    // Transform the data to include the assigned user's name
    const transformedLead = {
      ...lead,
      assigned_user: assignedUser,
      assigned_to: assignedUser ? 
        `${assignedUser.first_name} ${assignedUser.last_name}` : 
        null
    };

    res.json(transformedLead)
  } catch (err) {
    console.error("Error fetching lead:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het ophalen van de lead" })
  }
})

// Create new lead
router.post("/", async (req, res) => {
  try {
    const { name, email, phone, message, user_id, industry_id, status, deadline, priority } = req.body;

    // Debug logging
    console.log('Received lead data:', {
      name,
      email,
      phone,
      message,
      user_id,
      industry_id,
      status,
      deadline,
      priority
    });

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ 
        success: false, 
        error: "Naam en e-mail zijn verplicht" 
      });
    }

    // Prepare data with correct types
    const insertData = {
      name,
      email,
      phone: phone || null,
      message: message || null,
      user_id: user_id || null,
      industry_id: industry_id ? parseInt(industry_id) : null,
      status: status || 'new',
      deadline: deadline || null,
      priority: priority || 'medium',
      created_at: new Date().toISOString()
    };

    // Debug logging for insert data
    console.log('Inserting lead with data:', insertData);

    // Validate industry_id if provided
    if (insertData.industry_id) {
      const { data: industry, error: industryError } = await supabase
        .from('industries')
        .select('id')
        .eq('id', insertData.industry_id)
        .single();

      if (industryError || !industry) {
        return res.status(400).json({ 
          success: false, 
          error: "Ongeldige branche" 
        });
      }
    }

    // Validate user_id if provided
    if (insertData.user_id) {
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', insertData.user_id)
        .single();

      if (userError || !user) {
        return res.status(400).json({ 
          success: false, 
          error: "Ongeldige gebruiker" 
        });
      }
    }

    const { data: lead, error } = await supabase
      .from('leads')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      throw new Error("Database error: " + error.message);
    }

    console.log('Created lead:', lead);

    // Log lead creation in system logs
    try {
      const SystemLogService = require('../services/systemLogService');
      
      // Get industry name if available
      let industryName = 'Onbekend';
      if (insertData.industry_id) {
        const { data: industry } = await supabase
          .from('industries')
          .select('name')
          .eq('id', insertData.industry_id)
          .single();
        if (industry) {
          industryName = industry.name;
        }
      }

      // Get assigned user name if available
      let assignedUserName = 'Niet toegewezen';
      if (insertData.user_id) {
        const { data: user } = await supabase
          .from('profiles')
          .select('first_name, last_name, company_name')
          .eq('id', insertData.user_id)
          .single();
        if (user) {
          assignedUserName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.company_name || 'Onbekende gebruiker';
        }
      }

      await SystemLogService.log({
        type: 'success',
        category: 'admin',
        title: 'Nieuwe Lead Aangemaakt',
        message: `Nieuwe lead aangemaakt: ${name} (${email})`,
        details: `Lead ID: ${lead.id}, Branche: ${industryName}, Toegewezen aan: ${assignedUserName}, Prioriteit: ${insertData.priority}`,
        source: 'Leads API',
        userId: insertData.user_id,
        adminId: req.user?.id,
        metadata: {
          lead_id: lead.id,
          lead_name: name,
          lead_email: email,
          industry_id: insertData.industry_id,
          industry_name: industryName,
          assigned_user_id: insertData.user_id,
          assigned_user_name: assignedUserName,
          priority: insertData.priority,
          status: insertData.status,
          deadline: insertData.deadline
        },
        severity: 'medium'
      });
    } catch (logError) {
      console.error("Error logging lead creation:", logError);
      // Don't throw error here, as the lead was created successfully
    }

    res.status(201).json({ 
      success: true, 
      data: lead 
    });
  } catch (err) {
    console.error("Error creating lead:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Er is een fout opgetreden bij het aanmaken van de lead" 
    });
  }
});

// Update lead
router.put("/:id", async (req, res) => {
  try {
    const { name, email, phone, message, user_id, status } = req.body

    const { data: lead, error } = await supabase
      .from('leads')
      .update({
        name,
        email,
        phone,
        message,
        user_id,
        status
      })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    if (!lead) return res.status(404).json({ error: "Lead niet gevonden" })

    res.json(lead)
  } catch (err) {
    console.error("Error updating lead:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het bijwerken van de lead" })
  }
})

// Delete lead
router.delete("/:id", async (req, res) => {
  try {
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error

    res.json({ message: "Lead succesvol verwijderd" })
  } catch (err) {
    console.error("Error deleting lead:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het verwijderen van de lead" })
  }
})

// Lead accepteren
router.post('/:id/accept', requireAuth, async (req, res) => {
  const leadId = req.params.id;
  const userId = req.user.id;

  try {
    const { data: lead, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('assigned_to', userId)
      .single()

    if (error) throw error
    if (!lead) return res.status(404).json({ error: "Lead niet gevonden" })

    // Controleer of gebruiker een betaalmethode heeft
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('payment_method, balance')
      .eq('id', userId)
      .single()

    if (userError) throw userError
    if (!user.payment_method) return res.status(400).json({ error: "Je moet eerst een betaalmethode instellen" })

    // Get lead price for billing
    let leadPrice = lead.price_at_purchase || 10.00; // Default price
    if (!lead.price_at_purchase && lead.industry_id) {
      const { data: industry, error: industryError } = await supabaseAdmin
        .from('industries')
        .select('price_per_lead')
        .eq('id', lead.industry_id)
        .single();
        
      if (!industryError && industry) {
        leadPrice = industry.price_per_lead;
      }
    }

    // Check user's balance and payment methods
    const currentBalance = user.balance || 0;
    
    // Check if user has SEPA mandate
    const { data: paymentMethods, error: paymentMethodError } = await supabaseAdmin
      .from('payment_methods')
      .select('type, provider_payment_method_id')
      .eq('user_id', userId)
      .eq('type', 'sepa')
      .eq('provider', 'mollie')
      .single();

    const hasSEPAMandate = !paymentMethodError && paymentMethods;

    // Determine billing strategy
    let billingStrategy = 'balance_only';
    let amountToCharge = 0;
    let amountFromBalance = 0;

    if (currentBalance >= leadPrice) {
      // Sufficient balance - use balance only
      billingStrategy = 'balance_only';
      amountFromBalance = leadPrice;
      amountToCharge = 0;
    } else if (currentBalance > 0 && hasSEPAMandate) {
      // Partial balance + SEPA - use balance first, then SEPA
      billingStrategy = 'balance_then_sepa';
      amountFromBalance = currentBalance;
      amountToCharge = leadPrice - currentBalance;
    } else if (hasSEPAMandate) {
      // No balance but has SEPA - use SEPA only
      billingStrategy = 'sepa_only';
      amountFromBalance = 0;
      amountToCharge = leadPrice;
    } else {
      // No balance and no SEPA - error
      return res.status(400).json({ 
        error: "Onvoldoende saldo en geen SEPA incasso beschikbaar. Voeg eerst saldo toe of stel SEPA in." 
      });
    }

    console.log(`💰 Billing strategy: ${billingStrategy}, Balance: €${currentBalance}, Lead: €${leadPrice}`);
    console.log(`💰 From balance: €${amountFromBalance}, To charge: €${amountToCharge}`);

    // Update user balance (deduct available balance)
    if (amountFromBalance > 0) {
      const newBalance = Math.max(0, currentBalance - amountFromBalance);
      
      const { error: balanceError } = await supabaseAdmin
        .from('profiles')
        .update({ balance: newBalance })
        .eq('id', userId)

      if (balanceError) throw balanceError

      console.log(`💰 Deducted €${amountFromBalance} from user ${userId} balance: ${currentBalance} -> ${newBalance}`);
    }

    // Update lead status
    const { data: updatedLead, error: updateError } = await supabase
      .from('leads')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        price_at_purchase: leadPrice
      })
      .eq('id', leadId)

    if (updateError) throw updateError

    // Maak betaling aan
    const paymentStatus = amountToCharge > 0 ? 'pending' : 'paid';
    const paymentDescription = amountToCharge > 0 
      ? `Betaling voor lead #${leadId} - €${amountFromBalance} van saldo, €${amountToCharge} via SEPA`
      : `Betaling voor lead #${leadId} - €${amountFromBalance} van saldo`;

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert([
        {
          user_id: userId,
          amount: leadPrice,
          description: paymentDescription,
          status: paymentStatus,
          payment_details: {
            payment_type: billingStrategy,
            lead_id: leadId,
            previous_balance: currentBalance,
            amount_from_balance: amountFromBalance,
            amount_to_charge: amountToCharge,
            billing_strategy: billingStrategy,
            has_sepa_mandate: hasSEPAMandate
          },
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single()

    if (paymentError) throw paymentError

    // If we need to charge via SEPA, create Mollie payment
    if (amountToCharge > 0 && hasSEPAMandate) {
      try {
        const { mollieClient } = require('../lib/mollie');
        
        // Get user's Mollie customer ID
        const { data: userProfile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('mollie_customer_id')
          .eq('id', userId)
          .single();

        if (profileError || !userProfile.mollie_customer_id) {
          throw new Error('Geen Mollie klant ID gevonden');
        }

        // Create Mollie payment for remaining amount
        const molliePayment = await mollieClient.payments.create({
          amount: {
            currency: 'EUR',
            value: amountToCharge.toFixed(2)
          },
          description: `Lead #${leadId} - Restantbetaling`,
          customerId: userProfile.mollie_customer_id,
          mandateId: paymentMethods.provider_payment_method_id,
          metadata: {
            lead_id: leadId,
            user_id: userId,
            payment_type: 'sepa_remaining'
          }
        });

        console.log(`💰 Created Mollie payment for remaining €${amountToCharge}: ${molliePayment.id}`);

        // Update payment record with Mollie payment ID
        await supabase
          .from('payments')
          .update({
            payment_details: {
              ...payment.payment_details,
              mollie_payment_id: molliePayment.id,
              mollie_payment_status: molliePayment.status
            }
          })
          .eq('id', payment.id);

      } catch (mollieError) {
        console.error('Error creating Mollie payment:', mollieError);
        // Don't fail the lead acceptance, just log the error
      }
    }

    res.status(200).json({ 
      message: "Lead geaccepteerd",
      billing: {
        lead_price: leadPrice,
        previous_balance: currentBalance,
        amount_from_balance: amountFromBalance,
        amount_to_charge: amountToCharge,
        billing_strategy: billingStrategy,
        payment_status: paymentStatus
      }
    })
  } catch (err) {
    console.error("Error accepting lead:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het accepteren van de lead" })
  }
})

// Lead weigeren
router.post('/:id/reject', requireAuth, async (req, res) => {
  const leadId = req.params.id;
  const userId = req.user.id;

  try {
    const { data: lead, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('assigned_to', userId)
      .single()

    if (error) throw error
    if (!lead) return res.status(404).json({ error: "Lead niet gevonden" })

    // Update lead status
    const { data: updatedLead, error: updateError } = await supabase
      .from('leads')
      .update({
        status: 'rejected',
        assigned_to: null
      })
      .eq('id', leadId)

    if (updateError) throw updateError

    res.status(200).json({ message: "Lead geweigerd" })
  } catch (err) {
    console.error("Error rejecting lead:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het weigeren van de lead" })
  }
})

module.exports = router
