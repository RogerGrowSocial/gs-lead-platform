const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
// Only load dotenv locally (Vercel uses environment variables directly)
if (!process.env.VERCEL && !process.env.VERCEL_ENV) {
  require('dotenv').config();
}
const { body, validationResult } = require("express-validator");
const supabase = require('../config/supabase');
const { requireAuth } = require("../middleware/auth");

// Gebruik de bestaande supabase client voor normale operaties
// Use the shared supabaseAdmin from config/supabase.js instead of creating a new one
// This prevents duplicate clients and ensures env vars are validated
const { supabaseAdmin } = require('../config/supabase');

// Validatie middleware
const validateSubscription = [
  body('branch_id').isUUID().withMessage('branch_id moet een geldige UUID zijn'),
  body('leads_per_month').isInt({ min: 1 }).withMessage('leads_per_month >= 1'),
  body('payment_method')
    .isIn(['ideal', 'creditcard', 'sepa', 'balance'])
    .withMessage('ongeldige payment_method'),
];

// GET /subscriptions
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.user_metadata?.is_admin === true;

    // Als admin, haal alle subscriptions op
    // Anders alleen voor de ingelogde gebruiker
    const query = supabase
      .from('subscriptions')
      .select(`
        *,
        branch:branch_id (
          id,
          name,
          address,
          city
        ),
        user:user_id (
          id,
          first_name,
          last_name,
          company_name
        )
      `)
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      query.eq('user_id', userId);
    }

    const { data: subscriptions, error } = await query;

    if (error) throw error;

    res.json(subscriptions || []);
  } catch (err) {
    console.error("Error fetching subscriptions:", err);
    res.status(500).json({ error: "Er is een fout opgetreden bij het ophalen van de subscriptions" });
  }
});

// POST /api/subscriptions
router.post('/', requireAuth, validateSubscription, async (req, res) => {
  try {
    // 1) Validatie afhandelen
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // 2) Invoer uit body
    const { branch_id, leads_per_month, payment_method } = req.body;
    const userId = req.user.id;

    // 3) Check of branch bestaat
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .select('id')
      .eq('id', branch_id)
      .single();

    if (branchError) throw branchError;
    if (!branch) {
      return res.status(404).json({ error: "Branch niet gevonden" });
    }

    // 4) Check of er al een actieve subscription is voor deze user+branch
    const { data: existing, error: existErr } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('branch_id', branch_id)
      .eq('status', 'active')
      .single();

    if (existErr && existErr.code !== 'PGRST116') {
      // anders dan "no rows": iets anders mis
      throw existErr;
    }

    let result;
    if (existing) {
      // 5a) Updaten bestaande subscription
      const { data, error: updErr } = await supabase
        .from('subscriptions')
        .update({ 
          leads_per_month, 
          payment_method, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updErr) throw updErr;
      result = data;
    } else {
      // 5b) Nieuwe subscription aanmaken
      const { data, error: insErr } = await supabase
        .from('subscriptions')
        .insert([{
          user_id: userId,
          branch_id,
          leads_per_month,
          payment_method,
          status: 'active',
          start_date: new Date().toISOString().slice(0, 10)
        }])
        .select()
        .single();

      if (insErr) throw insErr;
      result = data;
    }

    // 6) Response
    res.status(200).json({ subscription: result });
  } catch (err) {
    console.error("Error in POST /subscriptions:", err);
    res.status(500).json({ error: err.message || "Interne server error" });
  }
});

module.exports = router; 