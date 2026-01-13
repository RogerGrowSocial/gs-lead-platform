const express = require("express")
const router = express.Router()
const { supabase } = require('../config/supabase')
const bcrypt = require('bcrypt')
const SystemLogService = require('../services/systemLogService')

// Get all profiles
router.get("/", async (req, res) => {
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, company_name, email, is_admin, created_at')
      .order('first_name')

    if (error) throw error

    // Log user list access
    await SystemLogService.logSystem(
      'info',
      'Gebruikerslijst Opgehaald',
      'Alle gebruikers opgehaald via API',
      `${profiles.length} gebruikers opgehaald`,
      {
        total_users: profiles.length,
        endpoint: '/users'
      },
      req.user?.id
    );

    res.json(profiles)
  } catch (err) {
    console.error("Error fetching profiles:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het ophalen van de gebruikers" })
  }
})

// Get user by ID
router.get("/:id", async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (error) throw error
    if (!user) return res.status(404).json({ error: "Gebruiker niet gevonden" })

    res.json(user)
  } catch (err) {
    console.error("Error fetching user:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het ophalen van de gebruiker" })
  }
})

// Create new user
router.post("/", async (req, res) => {
  try {
    const { company_name, email, password, is_admin } = req.body

    // Controleer of email al bestaat
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single()

    if (existingUser) {
      return res.status(400).json({ error: "Email is al in gebruik" })
    }

    // Wachtwoord hashen
    const hashedPassword = await bcrypt.hash(password, 10)

    // Gebruiker aanmaken
    const { data: user, error } = await supabase
      .from('profiles')
      .insert([
        {
          company_name,
          email,
          password: hashedPassword,
          is_admin: is_admin || 0,
          created_at: new Date().toISOString(),
        }
      ])
      .select()
      .single()

    if (error) throw error

    // Log user creation
    await SystemLogService.logSystem(
      'success',
      'Nieuwe Gebruiker Aangemaakt',
      `Nieuwe gebruiker aangemaakt: ${email}`,
      `Bedrijf: ${company_name}, Admin: ${is_admin ? 'Ja' : 'Nee'}`,
      {
        user_id: user.id,
        email: email,
        company_name: company_name,
        is_admin: is_admin
      },
      req.user?.id
    );

    res.status(201).json(user)
  } catch (err) {
    console.error("Error creating user:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het aanmaken van de gebruiker" })
  }
})

// Update user
router.put("/:id", async (req, res) => {
  try {
    const { company_name, email, password, is_admin } = req.body

    // Controleer of gebruiker bestaat
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (userError) throw userError
    if (!user) return res.status(404).json({ error: "Gebruiker niet gevonden" })

    // Update gebruiker
    const updateData = {
      company_name,
      email,
      is_admin,
    }

    if (password) {
      updateData.password = await bcrypt.hash(password, 10)
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single()

    if (updateError) throw updateError

    res.json(updatedUser)
  } catch (err) {
    console.error("Error updating user:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het bijwerken van de gebruiker" })
  }
})

// Delete user
router.delete("/:id", async (req, res) => {
  try {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error

    res.json({ message: "Gebruiker succesvol verwijderd" })
  } catch (err) {
    console.error("Error deleting user:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het verwijderen van de gebruiker" })
  }
})

module.exports = router

