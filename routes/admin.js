const express = require("express")
const router = express.Router()
const { supabase, supabaseAdmin } = require('../config/supabase')
const { requireAuth, isAdmin, isEmployeeOrAdmin, isManagerOrAdmin } = require("../middleware/auth")

/** For GET requests to stream pages: render 403 page instead of JSON when user is not manager/admin */
async function requireManagerOrAdminPage(req, res, next) {
  if (req.method !== 'GET') return isManagerOrAdmin(req, res, next)
  const render403 = (message, error) => res.status(403).render('errors/403', { message: message || 'Geen toegang', error: error || 'Manager of admin toegang vereist', user: req.user })
  if (!req.user) return render403('Geen toegang tot deze pagina', 'Authenticatie vereist')
  if (req.user.user_metadata?.is_admin === true) return next()
  try {
    const { createBaseClient } = require('../lib/supabase')
    const supabase = createBaseClient()
    const { data: profile, error } = await supabase.from('profiles').select('is_admin, role_id').eq('id', req.user.id).single()
    if (error) return render403('Geen toegang', 'Kon gebruikersgegevens niet ophalen')
    if (profile?.is_admin === true) return next()
    if (profile?.role_id) {
      const { data: role, error: roleError } = await supabaseAdmin.from('roles').select('name').eq('id', profile.role_id).maybeSingle()
      if (!roleError && role && (role.name || '').toLowerCase().includes('manager')) return next()
    }
    return render403('Geen toegang tot deze pagina', 'Alleen managers en beheerders hebben toegang tot Kansenstromen.')
  } catch (err) {
    return render403('Geen toegang', 'Fout bij het controleren van toegang')
  }
}
const userRepository = require("../database/userRepository")
const moment = require('moment')
const logger = require('../utils/logger')
const UserRiskAssessmentService = require('../services/userRiskAssessmentService')
const aiCustomerSummaryService = require('../services/aiCustomerSummaryService')
const opportunityAssignmentService = require('../services/opportunityAssignmentService')
const opportunityAssignmentFollowUpService = require('../services/opportunityAssignmentFollowUpService')
const chatService = require('../services/chatService')
const adminNotificationsService = require('../services/adminNotificationsService')
const bankingRoutes = require('./banking')
const crypto = require('crypto')
const RabobankApiService = require('../services/rabobankApiService')

/**
 * Ensure a Supabase Storage bucket exists, create it if it doesn't
 * @param {string} bucketName - Name of the bucket
 * @param {boolean} publicBucket - Whether the bucket should be public (default: true)
 * @returns {Promise<boolean>} - True if bucket exists or was created successfully
 */
async function ensureStorageBucket(bucketName, publicBucket = true) {
  try {
    // Check if bucket exists by trying to list it
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()
    
    if (listError) {
      console.error('Error listing buckets:', listError)
      return false
    }
    
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName)
    
    if (bucketExists) {
      return true
    }
    
    // Bucket doesn't exist, create it via REST API
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials for bucket creation')
      return false
    }
    
    const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({
        name: bucketName,
        public: publicBucket,
        file_size_limit: 52428800, // 50MB
        allowed_mime_types: null // Allow all types
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Failed to create bucket ${bucketName}:`, errorText)
      // If bucket already exists (409), that's fine
      if (response.status === 409) {
        return true
      }
      return false
    }
    
    console.log(`✅ Created storage bucket: ${bucketName}`)
    return true
  } catch (error) {
    console.error(`Error ensuring bucket ${bucketName}:`, error)
    return false
  }
}

// Admin middleware - controleer of gebruiker admin of werknemer is (niet klant)
router.use(requireAuth, isEmployeeOrAdmin)

// ==== Notes API (must be before param routes like /api/mail/:id) ====
router.get('/api/notes', requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { data: notes, error } = await supabaseAdmin
      .from('admin_notes')
      .select('id, title, content, created_at, updated_at, created_by')
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json({ success: true, notes: notes || [] })
  } catch (err) {
    console.error('Error listing notes:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/api/notes', requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { title, content } = req.body

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Titel is verplicht' })
    }

    const { data: note, error } = await supabaseAdmin
      .from('admin_notes')
      .insert({
        title: title.trim(),
        content: (content || '').trim(),
        created_by: req.user.id
      })
      .select()
      .single()

    if (error) throw error
    res.json({ success: true, note })
  } catch (err) {
    console.error('Error creating note:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.put('/api/notes/:id', requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { title, content } = req.body

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Titel is verplicht' })
    }

    const { data: note, error } = await supabaseAdmin
      .from('admin_notes')
      .update({
        title: title.trim(),
        content: (content || '').trim()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!note) return res.status(404).json({ success: false, error: 'Notitie niet gevonden' })
    res.json({ success: true, note })
  } catch (err) {
    console.error('Error updating note:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.delete('/api/notes/:id', requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { error } = await supabaseAdmin
      .from('admin_notes')
      .delete()
      .eq('id', id)

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    console.error('Error deleting note:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ========== Admin Chat / Messages API ==========
router.get('/api/messages/conversations', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const unread = req.query.unread === 'true'
    const search = req.query.search || ''
    const { conversations } = await chatService.getConversationsForUser(userId, { unread, search: search || undefined })
    res.json({ success: true, conversations })
  } catch (err) {
    console.error('Error listing conversations:', err)
    res.status(500).json({ success: false, error: err.message || 'Kon conversaties niet laden' })
  }
})

router.get('/api/messages/conversations/:id', requireAuth, async (req, res) => {
  try {
    const conv = await chatService.getConversation(req.params.id, req.user.id)
    if (!conv) return res.status(404).json({ success: false, error: 'Conversatie niet gevonden' })
    res.json({ success: true, conversation: conv })
  } catch (err) {
    console.error('Error fetching conversation:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/api/messages/conversations/:id/messages', requireAuth, async (req, res) => {
  try {
    const cursor = req.query.cursor || null
    const limit = Math.min(Number(req.query.limit) || 30, 50)
    const { messages, nextCursor } = await chatService.getMessages(req.params.id, req.user.id, cursor, limit)
    res.json({ success: true, messages, nextCursor })
  } catch (err) {
    console.error('Error fetching messages:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/api/messages/conversations/:id/messages', requireAuth, async (req, res) => {
  try {
    const body = req.body.body || req.body.message || ''
    const mentionUserIds = req.body.mention_user_ids || []
    const message = await chatService.sendMessage(req.params.id, body, req.user.id, mentionUserIds)
    res.json({ success: true, message })
  } catch (err) {
    console.error('Error sending message:', err)
    res.status(400).json({ success: false, error: err.message || 'Kon bericht niet verzenden' })
  }
})

router.post('/api/messages/conversations/:id/read', requireAuth, async (req, res) => {
  try {
    await chatService.markConversationRead(req.params.id, req.user.id)
    res.json({ success: true })
  } catch (err) {
    console.error('Error marking read:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/api/messages/dm', requireAuth, async (req, res) => {
  try {
    const otherUserId = req.body.other_user_id
    if (!otherUserId) return res.status(400).json({ success: false, error: 'other_user_id is verplicht' })
    const conv = await chatService.getOrCreateDM(req.user.id, otherUserId)
    res.json({ success: true, conversation: conv })
  } catch (err) {
    console.error('Error creating DM:', err)
    res.status(400).json({ success: false, error: err.message })
  }
})

router.get('/api/messages/users', requireAuth, async (req, res) => {
  try {
    const currentUserId = req.user?.id
    if (!currentUserId) return res.status(401).json({ success: false, error: 'Niet geauthenticeerd' })
    const search = (req.query.search || '').trim().slice(0, 100)
    if (!search || search.length < 2) {
      return res.json({ success: true, users: [] })
    }
    const term = '%' + search + '%'
    // Select only columns that exist on profiles (no avatar_url/profile_picture to avoid schema errors)
    const selectCols = 'id, first_name, last_name, email, role_id'
    const r1 = await supabaseAdmin.from('profiles').select(selectCols).neq('id', currentUserId).ilike('first_name', term).limit(15)
    const r2 = await supabaseAdmin.from('profiles').select(selectCols).neq('id', currentUserId).ilike('last_name', term).limit(15)
    const r3 = await supabaseAdmin.from('profiles').select(selectCols).neq('id', currentUserId).ilike('email', term).limit(15)
    if (r1.error) throw r1.error
    if (r2.error) throw r2.error
    if (r3.error) throw r3.error
    const seen = new Set()
    const profiles = []
    for (const p of [...(r1.data || []), ...(r2.data || []), ...(r3.data || [])]) {
      if (seen.has(p.id)) continue
      seen.add(p.id)
      profiles.push(p)
      if (profiles.length >= 20) break
    }
    const roleIds = [...new Set((profiles || []).map((p) => p.role_id).filter(Boolean))]
    let roles = {}
    if (roleIds.length > 0) {
      const { data: roleRows, error: roleErr } = await supabaseAdmin.from('roles').select('id, name').in('id', roleIds)
      if (!roleErr && roleRows) for (const r of roleRows) roles[r.id] = r.name
    }
    const users = (profiles || []).map((p) => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      avatar_url: p.profile_picture || null,
      role_name: roles[p.role_id] || null
    }))
    res.json({ success: true, users })
  } catch (err) {
    logger.error('Error searching users for messages:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/api/messages/group', requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { title, participant_ids } = req.body
    if (!participant_ids || !Array.isArray(participant_ids)) return res.status(400).json({ success: false, error: 'participant_ids array is verplicht' })
    const conv = await chatService.createGroup(title, req.user.id, participant_ids)
    res.json({ success: true, conversation: conv })
  } catch (err) {
    console.error('Error creating group:', err)
    res.status(400).json({ success: false, error: err.message })
  }
})

router.post('/api/messages/conversations/:id/participants', requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const userIds = req.body.user_ids || []
    await chatService.addParticipants(req.params.id, userIds, req.user.id)
    res.json({ success: true })
  } catch (err) {
    console.error('Error adding participants:', err)
    res.status(400).json({ success: false, error: err.message })
  }
})

// ========== Admin Bell Notifications API ==========
router.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const type = req.query.type || null
    const limit = Number(req.query.limit) || 20
    const list = await adminNotificationsService.getNotifications(req.user.id, { limit, type: type || undefined })
    const unreadCount = await adminNotificationsService.getUnreadCount(req.user.id)
    res.json({ success: true, notifications: list, unreadCount })
  } catch (err) {
    console.error('Error fetching notifications:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/api/notifications/unread-count', requireAuth, async (req, res) => {
  try {
    const count = await adminNotificationsService.getUnreadCount(req.user.id)
    res.json({ success: true, count })
  } catch (err) {
    console.error('Error fetching unread count:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/api/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    await adminNotificationsService.markRead(req.params.id, req.user.id)
    res.json({ success: true })
  } catch (err) {
    console.error('Error marking notification read:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/api/notifications/read-all', requireAuth, async (req, res) => {
  try {
    await adminNotificationsService.markAllRead(req.user.id)
    res.json({ success: true })
  } catch (err) {
    console.error('Error marking all read:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST route for creating new users
router.post("/api/users", requireAuth, isAdmin, async (req, res) => {
  try {
    const { 
      company_name, 
      first_name, 
      last_name, 
      email, 
      phone, 
      role_id,
      is_admin, // Keep for backward compatibility
      send_welcome_email,
      send_password_reset 
    } = req.body;

    // If role_id is provided, fetch the role to determine is_admin
    let isAdminValue = is_admin || false;
    if (role_id) {
      const { data: role, error: roleError } = await supabaseAdmin
        .from('roles')
        .select('id, name')
        .eq('id', role_id)
        .maybeSingle();

      if (roleError) {
        console.error("Error fetching role:", roleError);
      } else if (role) {
        // Set is_admin based on role name (admin, administrator, etc.)
        isAdminValue = role.name.toLowerCase().includes('admin');
      }
    }

    console.log("Creating new user with data:", { 
      company_name, 
      first_name, 
      last_name, 
      email, 
      phone, 
      role_id,
      is_admin: isAdminValue
    });

    // Validate required fields
    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: "E-mailadres is verplicht" 
      });
    }

    // Check if email already exists in profiles
    const { data: existingProfile, error: checkError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .single();

    if (existingProfile) {
      return res.status(400).json({ 
        success: false,
        message: "Dit e-mailadres is al in gebruik" 
      });
    }

    // Generate a temporary password for Supabase Auth
    const tempPassword = generateTemporaryPassword();

    // Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        first_name: first_name || '',
        last_name: last_name || '',
        phone: phone || '',
        is_admin: isAdminValue
      }
    });

    if (authError) {
      console.error("Error creating auth user:", authError);
      return res.status(400).json({ 
        success: false,
        message: "Fout bij aanmaken van gebruikersaccount: " + authError.message
      });
    }

    // Wait a moment for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update the profile record that was created by the trigger
    const profileUpdate = {
      first_name: first_name || '',
      last_name: last_name || '',
      email,
      phone: phone || '',
      is_admin: isAdminValue,
      status: 'active',
      updated_at: new Date().toISOString()
    };

    // Add role_id if provided, otherwise find and assign default employee role
    if (role_id) {
      profileUpdate.role_id = role_id;
      console.log(`✅ Using provided role_id: ${role_id} for user: ${email}`);
    } else {
      // If no role_id provided, find and assign default employee role
      console.log(`🔍 No role_id provided, searching for employee role...`);
      const { data: employeeRole, error: roleError } = await supabaseAdmin
        .from('roles')
        .select('id, name')
        .eq('name', 'employee')
        .maybeSingle();
      
      if (roleError) {
        console.error(`❌ Error fetching employee role:`, roleError);
      }
      
      if (employeeRole) {
        profileUpdate.role_id = employeeRole.id;
        console.log(`✅ Assigned default employee role (${employeeRole.id}) to new user: ${email}`);
      } else {
        console.warn(`⚠️ No employee role found in database, user created without role_id`);
        console.warn(`   This user may not appear in the employees list after refresh!`);
      }
    }

    console.log(`📝 Updating profile with data:`, {
      id: authUser.user.id,
      email: email,
      role_id: profileUpdate.role_id,
      is_admin: profileUpdate.is_admin
    });

    const { data: newProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdate)
      .eq('id', authUser.user.id)
      .select()
      .single();

    if (profileError) {
      console.error("❌ Error updating profile:", profileError);
      // If profile update fails, we should clean up the auth user
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      throw profileError;
    }

    // Verify the profile was actually updated with the role_id
    const { data: verifyProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role_id, is_admin')
      .eq('id', authUser.user.id)
      .single();
    
    console.log(`✅ Profile updated successfully:`, {
      id: newProfile.id,
      email: newProfile.email,
      role_id: newProfile.role_id,
      role_id_type: typeof newProfile.role_id,
      is_admin: newProfile.is_admin
    });
    
    if (verifyProfile) {
      console.log(`🔍 Verification - Profile in DB:`, {
        email: verifyProfile.email,
        role_id: verifyProfile.role_id,
        role_id_type: typeof verifyProfile.role_id,
        role_id_string: String(verifyProfile.role_id),
        is_admin: verifyProfile.is_admin
      });
      
      // Compare as strings to avoid type mismatch issues
      if (String(verifyProfile.role_id) !== String(profileUpdate.role_id)) {
        console.error(`❌ WARNING: role_id mismatch! Expected: ${profileUpdate.role_id}, Got: ${verifyProfile.role_id}`);
      } else {
        console.log(`✅ role_id verified correctly: ${verifyProfile.role_id}`);
      }
    } else {
      console.error(`❌ WARNING: Could not verify profile after update!`);
    }

    // Evaluate user risk asynchronously (don't block user creation)
    // Only evaluate if we have some user data
    if (newProfile && email) {
      UserRiskAssessmentService.evaluateAndSaveRisk(supabaseAdmin, newProfile)
        .then(result => {
          if (result.success) {
            console.log(`✅ Risk assessment completed for new user ${newProfile.id}: score=${result.score}, requires_review=${result.requires_manual_review}`);
          } else {
            console.warn(`⚠️ Risk assessment failed for user ${newProfile.id}:`, result.error);
          }
        })
        .catch(err => {
          console.error(`❌ Error in async risk assessment for user ${newProfile.id}:`, err);
          // Don't throw - user creation should succeed even if risk assessment fails
        });
    }

    // Log the user creation
    const SystemLogService = require('../services/systemLogService');
    await SystemLogService.logSystem(
      'success',
      'Nieuwe Gebruiker Aangemaakt',
      `Nieuwe gebruiker aangemaakt: ${email}`,
      `Naam: ${first_name || ''} ${last_name || ''}, Admin: ${isAdminValue ? 'Ja' : 'Nee'}`,
      {
        user_id: newProfile.id,
        email: email,
        first_name: first_name || '',
        last_name: last_name || '',
        role_id: role_id || null,
        is_admin: isAdminValue
      },
      req.user?.id
    );

    // Send password reset email if send_welcome_email is checked
    let emailSent = false;
    let emailError = null;
    
    if (send_welcome_email || send_password_reset) {
      try {
        console.log(`📧 Attempting to send welcome email to: ${email}`);
        
        const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: email,
          options: {
            redirectTo: `${process.env.SITE_URL || process.env.APP_URL || process.env.BASE_URL || 'http://localhost:3000'}/auth/reset-password`
          }
        });
        
        if (resetError) {
          console.error("❌ Error generating password reset link:", resetError);
          emailError = `Kon geen wachtwoord reset link genereren: ${resetError.message}`;
        } else if (!resetData || !resetData.properties?.action_link) {
          console.error("❌ No reset link generated");
          emailError = "Kon geen wachtwoord reset link genereren";
        } else {
          console.log("✅ Password reset link generated for:", email);
          console.log("   Reset link:", resetData.properties?.action_link);
          
          // Send beautiful welcome email with password setup instructions
          const EmailService = require('../services/emailService');
          const emailService = new EmailService();
          
          emailSent = await emailService.sendWelcomeEmail({
            email,
            first_name: first_name || '',
            last_name: last_name || ''
          }, resetData.properties?.action_link);
          
          if (emailSent) {
            console.log("✅ Welcome email sent successfully to:", email);
          } else {
            console.error("❌ Failed to send welcome email to:", email);
            emailError = "Email service kon de email niet versturen. Check server logs voor details.";
          }
        }
      } catch (emailErr) {
        console.error("❌ Exception while sending password reset email:", emailErr);
        emailError = `Fout bij versturen email: ${emailErr.message}`;
      }
    }

    // Build success message based on email sending result
    let successMessage;
    if (send_welcome_email || send_password_reset) {
      if (emailSent) {
        successMessage = "Gebruiker succesvol aangemaakt. Er is een e-mail verstuurd om een wachtwoord in te stellen.";
      } else if (emailError) {
        successMessage = `Gebruiker succesvol aangemaakt, maar er was een probleem met het versturen van de welkomstemail: ${emailError}`;
      } else {
        successMessage = "Gebruiker succesvol aangemaakt. De welkomstemail kon niet worden verstuurd.";
      }
    } else {
      successMessage = "Gebruiker succesvol aangemaakt. De gebruiker kan inloggen met het e-mailadres en een wachtwoord reset aanvragen.";
    }

    // Helper function to format role names
    const formatRoleNameForResponse = (name) => {
      if (!name) return 'Werknemer';
      return name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    };
    
    // Get role display name for response
    let roleDisplayName = 'Werknemer';
    if (newProfile.role_id) {
      const { data: roleData } = await supabaseAdmin
        .from('roles')
        .select('name, display_name')
        .eq('id', newProfile.role_id)
        .maybeSingle();
      
      if (roleData) {
        roleDisplayName = roleData.display_name || formatRoleNameForResponse(roleData.name) || 'Werknemer';
      }
    }
    
    res.status(201).json({
      success: true,
      message: successMessage,
      email_sent: emailSent,
      email_error: emailError || null,
      user: {
        id: newProfile.id,
        first_name: newProfile.first_name,
        last_name: newProfile.last_name,
        email: newProfile.email,
        phone: newProfile.phone,
        is_admin: newProfile.is_admin,
        status: newProfile.status,
        role_id: newProfile.role_id,
        role_display_name: roleDisplayName,
        created_at: newProfile.created_at
      }
    });

  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({ 
      success: false,
      message: "Er is een fout opgetreden bij het aanmaken van de gebruiker" 
    });
  }
});

// Helper function to generate temporary password
function generateTemporaryPassword() {
  const length = 12;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_-+=<>?";
  let password = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }

  return password;
}

// Helper functie om een standaard admin gebruiker op te halen als req.user undefined is
async function ensureUser(req) {
  if (!req.user) {
    try {
      // Haal de admin gebruiker op uit de database
      const adminUser = await supabase
        .from('profiles')
        .select('*')
        .eq('is_admin', true)
        .limit(1)

      if (adminUser.length > 0) {
        req.user = adminUser[0]
      } else {
        // Fallback als er geen admin gebruiker is
        req.user = {
          company_name: "Administrator",
          first_name: "Admin",
          last_name: "User",
          email: "admin@example.com",
        }
      }
    } catch (error) {
      console.error("Fout bij ophalen admin gebruiker:", error)
      // Fallback als er een fout optreedt
      req.user = {
        company_name: "Administrator",
        first_name: "Admin",
        last_name: "User",
        email: "admin@example.com",
      }
    }
  }
  return req.user
}

// API endpoint for dashboard chart data (leads and revenue)
router.get("/api/admin/dashboard-charts", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    // Prevent 304 responses for fetch() JSON calls (avoid empty body on .json())
    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('ETag', String(Date.now()));

    const period = req.query.period || '12m'; // 7d, 30d, 6m, 12m, ytd, yearYYYY, lifetime
    const compare = String(req.query.compare || 'none'); // none | previous_period | previous_year
    const now = new Date();
    let startDate = null;
    let endDate = null;
    let labels = [];
    let groupBy = '';
    let keys = [];
    
    const monthNames = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

    function dayKeyLocal(d) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    function monthKeyLocal(d) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    }

    function yearKeyLocal(d) {
      return String(d.getFullYear());
    }

    function parseMoney(value) {
      if (value === null || value === undefined) return 0;
      if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
      let t = String(value).trim();
      if (!t) return 0;
      t = t.replace(/[€\s\u00A0]/g, '');
      // Handle European formats like "355.982,22"
      if (t.includes(',') && t.includes('.')) {
        t = t.replace(/\./g, '').replace(',', '.');
      } else if (t.includes(',')) {
        t = t.replace(',', '.');
      }
      const n = parseFloat(t);
      return Number.isFinite(n) ? n : 0;
    }

    function parseDateOnlyToLocal(dateOnly) {
      // Expect "YYYY-MM-DD"
      if (!dateOnly || typeof dateOnly !== 'string') return null;
      const parts = dateOnly.split('-').map((p) => parseInt(p, 10));
      if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
      const [y, m, d] = parts;
      return new Date(y, m - 1, d);
    }

    function addDays(date, days) {
      const d = new Date(date);
      d.setDate(d.getDate() + days);
      return d;
    }

    function addMonths(date, months) {
      const d = new Date(date);
      d.setMonth(d.getMonth() + months);
      return d;
    }

    // Normalize period: we accept old values too
    let normalized = String(period);
    if (normalized === 'year') normalized = '12m';
    if (normalized === 'quarter') normalized = '12m';
    if (normalized === 'month') normalized = '30d';
    // lifetime handled below as yearly buckets

    // Parse range + build buckets (labels + stable keys)
    let yearMode = null; // number | null
    let daysCount = null;
    let monthsCount = null;

    const ym = /^year(\d{4})$/.exec(normalized);
    if (ym) yearMode = parseInt(ym[1], 10);

    if (normalized === 'lifetime') {
      groupBy = 'year';
    } else if (normalized === '7d') {
      groupBy = 'day';
      daysCount = 7;
    } else if (normalized === '30d') {
      groupBy = 'day';
      daysCount = 30;
    } else {
      groupBy = 'month';
      if (normalized === '6m') monthsCount = 6;
      else if (normalized === '12m') monthsCount = 12;
      else if (normalized === 'ytd') monthsCount = now.getMonth() + 1;
      else if (yearMode) monthsCount = 12;
      else monthsCount = 12;
    }

    if (groupBy === 'day') {
      // Start at the beginning of the first day; end at the beginning of tomorrow (exclusive)
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      startDate = addDays(todayStart, -(daysCount - 1));
      endDate = addDays(todayStart, 1);

      for (let i = 0; i < daysCount; i++) {
        const d = addDays(startDate, i);
        keys.push(dayKeyLocal(d));
        labels.push(d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit' }));
      }
    } else if (groupBy === 'year') {
      const fromYear = 2020;
      const toYear = now.getFullYear();
      startDate = new Date(fromYear, 0, 1);
      endDate = new Date(toYear + 1, 0, 1); // include current year (YTD)

      for (let y = fromYear; y <= toYear; y++) {
        keys.push(String(y));
        labels.push(String(y));
      }
    } else {
      if (yearMode) {
        const currentYear = now.getFullYear();
        const safeYear = Math.min(Math.max(yearMode, 1970), currentYear);
        startDate = new Date(safeYear, 0, 1);
        endDate = new Date(safeYear + 1, 0, 1);

        for (let i = 0; i < 12; i++) {
          const d = new Date(safeYear, i, 1);
          keys.push(monthKeyLocal(d));
          labels.push(monthNames[i]);
        }
      } else if (normalized === 'ytd') {
        const y = now.getFullYear();
        startDate = new Date(y, 0, 1);
        endDate = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 1); // include today in current month

        for (let i = 0; i < monthsCount; i++) {
          const d = new Date(y, i, 1);
          keys.push(monthKeyLocal(d));
          labels.push(monthNames[i]);
        }
      } else {
        // Rolling last N months incl. current month
        const startMonth = new Date(now.getFullYear(), now.getMonth() - (monthsCount - 1), 1);
        startDate = startMonth;
        endDate = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 1); // include today

        for (let i = 0; i < monthsCount; i++) {
          const d = addMonths(startMonth, i);
          keys.push(monthKeyLocal(d));
          labels.push(monthNames[d.getMonth()]);
        }
      }
    }

    const keyToIndex = new Map();
    keys.forEach((k, i) => keyToIndex.set(k, i));

    // For compare we align dates into the current bucket keys
    const durationMs = (startDate && endDate) ? (endDate.getTime() - startDate.getTime()) : 0;
    function shiftDateForCompare(d) {
      if (compare === 'previous_year') {
        const dd = new Date(d);
        dd.setFullYear(dd.getFullYear() + 1);
        return dd;
      }
      if (compare === 'previous_period') {
        return new Date(d.getTime() + durationMs);
      }
      return d;
    }
    
    // Fetch leads data
    let leadsData = new Array(labels.length).fill(0);
    if (startDate) {
      let q = supabaseAdmin
        .from('leads')
        .select('created_at')
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });
      const { data: leads, error: leadsError } = await q;
      
      if (!leadsError && leads) {
        // Group leads by period
        leads.forEach(lead => {
          const leadDate = new Date(lead.created_at);
          const key =
            groupBy === 'day' ? dayKeyLocal(leadDate) :
            groupBy === 'year' ? yearKeyLocal(leadDate) :
            monthKeyLocal(leadDate);
          const index = keyToIndex.get(key);
          
          if (index !== undefined && index >= 0 && index < leadsData.length) {
            leadsData[index]++;
          }
        });
      }
    }

    // Compare leads series (aligned to current buckets)
    let leadsCompareData = null;
    if (startDate && (compare === 'previous_year' || compare === 'previous_period') && groupBy !== 'year') {
      const compareEnd = new Date(startDate);
      const compareStart = compare === 'previous_year'
        ? new Date(startDate.getFullYear() - 1, startDate.getMonth(), startDate.getDate())
        : new Date(startDate.getTime() - durationMs);

      let cq = supabaseAdmin
        .from('leads')
        .select('created_at')
        .gte('created_at', compareStart.toISOString())
        .lt('created_at', compareEnd.toISOString())
        .order('created_at', { ascending: true });

      const { data: cLeads, error: cLeadsError } = await cq;
      if (!cLeadsError && cLeads) {
        leadsCompareData = new Array(labels.length).fill(0);
        cLeads.forEach((lead) => {
          const original = new Date(lead.created_at);
          const shifted = shiftDateForCompare(original);
          const key =
            groupBy === 'day' ? dayKeyLocal(shifted) :
            monthKeyLocal(shifted);
          const idx = keyToIndex.get(key);
          if (idx !== undefined) leadsCompareData[idx] += 1;
        });
      }
    }
    
    // Fetch revenue data (from payments + paid invoices)
    let revenueData = new Array(labels.length).fill(0);
    if (startDate) {
      let q = supabaseAdmin
        .from('payments')
        .select('amount, created_at')
        .eq('status', 'paid')
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });
      const { data: payments, error: paymentsError } = await q;
      
      if (!paymentsError && payments) {
        // Group payments by period
        payments.forEach(payment => {
          const paymentDate = new Date(payment.created_at);
          const key =
            groupBy === 'day' ? dayKeyLocal(paymentDate) :
            groupBy === 'year' ? yearKeyLocal(paymentDate) :
            monthKeyLocal(paymentDate);
          const index = keyToIndex.get(key);
          
          if (index !== undefined && index >= 0 && index < revenueData.length) {
            revenueData[index] += parseMoney(payment.amount);
          }
        });
      }

      // Add paid invoices too (invoice_date is DATE-only)
      const startDateOnly = startDate.toISOString().split('T')[0];
      const endDateOnly = endDate.toISOString().split('T')[0]; // exclusive
      let iq = supabaseAdmin
        .from('customer_invoices')
        .select('amount, invoice_date')
        .eq('status', 'paid')
        .gte('invoice_date', startDateOnly)
        .lt('invoice_date', endDateOnly)
        .order('invoice_date', { ascending: true });
      const { data: invoices, error: invoicesError } = await iq;

      if (!invoicesError && invoices) {
        invoices.forEach((inv) => {
          const invDate = parseDateOnlyToLocal(inv.invoice_date);
          if (!invDate) return;
          const key =
            groupBy === 'day' ? dayKeyLocal(invDate) :
            groupBy === 'year' ? yearKeyLocal(invDate) :
            monthKeyLocal(invDate);
          const index = keyToIndex.get(key);
          if (index !== undefined && index >= 0 && index < revenueData.length) {
            revenueData[index] += parseMoney(inv.amount);
          }
        });
      }
    }

    // Compare revenue series (aligned to current buckets)
    let revenueCompareData = null;
    if (startDate && (compare === 'previous_year' || compare === 'previous_period') && groupBy !== 'year') {
      const compareEnd = new Date(startDate);
      const compareStart = compare === 'previous_year'
        ? new Date(startDate.getFullYear() - 1, startDate.getMonth(), startDate.getDate())
        : new Date(startDate.getTime() - durationMs);

      revenueCompareData = new Array(labels.length).fill(0);

      // Payments
      const { data: cPayments, error: cPaymentsError } = await supabaseAdmin
        .from('payments')
        .select('amount, created_at')
        .eq('status', 'paid')
        .gte('created_at', compareStart.toISOString())
        .lt('created_at', compareEnd.toISOString())
        .order('created_at', { ascending: true });

      if (!cPaymentsError && cPayments) {
        cPayments.forEach((p) => {
          const original = new Date(p.created_at);
          const shifted = shiftDateForCompare(original);
          const key = groupBy === 'day' ? dayKeyLocal(shifted) : monthKeyLocal(shifted);
          const idx = keyToIndex.get(key);
          if (idx !== undefined) revenueCompareData[idx] += parseMoney(p.amount);
        });
      }

      // Paid invoices (DATE-only)
      const compareStartDateOnly = compareStart.toISOString().split('T')[0];
      const compareEndDateOnly = compareEnd.toISOString().split('T')[0];
      const { data: cInvoices, error: cInvoicesError } = await supabaseAdmin
        .from('customer_invoices')
        .select('amount, invoice_date')
        .eq('status', 'paid')
        .gte('invoice_date', compareStartDateOnly)
        .lt('invoice_date', compareEndDateOnly)
        .order('invoice_date', { ascending: true });

      if (!cInvoicesError && cInvoices) {
        cInvoices.forEach((inv) => {
          const original = parseDateOnlyToLocal(inv.invoice_date);
          if (!original) return;
          const shifted = shiftDateForCompare(original);
          const key = groupBy === 'day' ? dayKeyLocal(shifted) : monthKeyLocal(shifted);
          const idx = keyToIndex.get(key);
          if (idx !== undefined) revenueCompareData[idx] += parseMoney(inv.amount);
        });
      }
    }
    
    res.json({
      success: true,
      period: normalized,
      compare: groupBy === 'year' ? 'none' : compare,
      leads: {
        labels,
        data: leadsData,
        compareData: leadsCompareData
      },
      revenue: {
        labels,
        data: revenueData,
        compareData: revenueCompareData
      }
    });
  } catch (err) {
    console.error('Error fetching dashboard chart data:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      leads: { labels: [], data: [] },
      revenue: { labels: [], data: [] }
    });
  }
});

// API endpoint for dashboard notifications
router.get("/api/admin/dashboard-notifications", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    // Prevent 304 responses for fetch() JSON calls (avoid empty body on .json())
    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('ETag', String(Date.now()));

    const notifications = [];
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Helper function to format relative time
    function formatRelativeTime(dateString) {
      if (!dateString) return '';
      const date = new Date(dateString);
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffMins < 1) return 'Net';
      if (diffMins < 60) return `${diffMins} minuten geleden`;
      if (diffHours < 24) return `${diffHours} uur geleden`;
      if (diffDays === 1) return '1 dag geleden';
      if (diffDays < 7) return `${diffDays} dagen geleden`;
      return new Date(dateString).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    // 1. Check for new leads waiting for assignment (status = 'new')
    const { count: newLeadsCount } = await supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new');

    if (newLeadsCount > 0) {
      notifications.push({
        type: 'warning',
        message: `${newLeadsCount} nieuwe aanvragen wachten op toewijzing`,
        time: formatRelativeTime(oneDayAgo.toISOString()),
        created_at: oneDayAgo.toISOString()
      });
    }

    // 2. Check for recent payments
    const { data: recentPayments } = await supabaseAdmin
      .from('payments')
      .select('amount, created_at, user_id')
      .eq('status', 'paid')
      .gte('created_at', oneDayAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(3);

    if (recentPayments && recentPayments.length > 0) {
      // Get user names
      const userIds = recentPayments.filter(p => p.user_id).map(p => p.user_id);
      
      let usersMap = {};
      
      if (userIds.length > 0) {
        const { data: users } = await supabaseAdmin
          .from('profiles')
          .select('id, company_name, first_name, last_name')
          .in('id', userIds);
        
        if (users) {
          usersMap = users.reduce((acc, u) => {
            acc[u.id] = u.company_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Klant';
            return acc;
          }, {});
        }
      }
      
      // Add notification for most recent payment
      const payment = recentPayments[0];
      const customerName = payment.user_id ? (usersMap[payment.user_id] || 'Klant') : 'Klant';
      const amount = parseFloat(payment.amount) || 0;
      
      notifications.push({
        type: 'success',
        message: `Betaling van €${amount.toFixed(2)} ontvangen van ${customerName}`,
        time: formatRelativeTime(payment.created_at),
        created_at: payment.created_at
      });
    }

    // 3. Check for users who removed payment method (recently)
    // This would require tracking payment method changes, for now we'll skip this
    // or check for users without payment method who had one before

    // 4. System notifications (could be from a notifications table, but for now we'll use static)
    // In the future, this could come from a system_notifications table

    // Sort by created_at (most recent first)
    notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Limit to 5 most recent
    const limitedNotifications = notifications.slice(0, 5);

    res.json({
      success: true,
      notifications: limitedNotifications
    });
  } catch (err) {
    console.error('Error fetching dashboard notifications:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      notifications: []
    });
  }
});

// API endpoint for recent users and leads
router.get("/api/admin/dashboard-activity", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    // Prevent 304 responses for fetch() JSON calls (avoid empty body on .json())
    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('ETag', String(Date.now()));

    let recentUsers = [];
    let recentLeads = [];
    
    // Recent users (profiles) - with error handling
    try {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, company_name, email, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) {
        console.error('Error fetching recent users:', error);
      } else {
        recentUsers = data || [];
      }
    } catch (err) {
      console.error('Exception fetching recent users:', err);
    }

    // Recent leads - use user_id (leads table doesn't have customer_id)
    try {
      const { data, error } = await supabaseAdmin
        .from('leads')
        .select('id, name, created_at, status, user_id')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) {
        console.error('Error fetching recent leads:', error);
      } else {
        recentLeads = data || [];
      }
    } catch (err) {
      console.error('Exception fetching recent leads:', err);
    }

    // Get user/partner names for leads that have user_id
    const userIds = (recentLeads || [])
      .filter(lead => lead && lead.user_id)
      .map(lead => lead.user_id);
    
    let usersMap = {};
    if (userIds.length > 0) {
      try {
        const { data: users, error: usersError } = await supabaseAdmin
          .from('profiles')
          .select('id, company_name, first_name, last_name')
          .in('id', userIds);
        
        if (!usersError && users) {
          usersMap = users.reduce((acc, user) => {
            if (user && user.id) {
              acc[user.id] = user.company_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || '-';
            }
            return acc;
          }, {});
        }
      } catch (err) {
        console.error('Exception fetching user names:', err);
      }
    }

    // Format the data
    const formattedUsers = (recentUsers || []).map(user => {
      if (!user) return null;
      return {
        id: user.id,
        company_name: user.company_name || '-',
        email: user.email || '-',
        created_at: user.created_at,
        has_payment_method: false // Default to false, can be enhanced later if payment_method tracking is added
      };
    }).filter(Boolean);

    const formattedLeads = (recentLeads || []).map(lead => {
      if (!lead) return null;
      let assignedTo = null;
      if (lead.user_id && usersMap[lead.user_id]) {
        assignedTo = usersMap[lead.user_id];
      }
      
      return {
        id: lead.id,
        name: lead.name || '-',
        created_at: lead.created_at,
        status: lead.status || 'new',
        assigned_to: assignedTo
      };
    }).filter(Boolean);

    res.json({
      success: true,
      users: formattedUsers,
      leads: formattedLeads
    });
  } catch (err) {
    console.error('Error fetching dashboard activity:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Unknown error',
      users: [],
      leads: []
    });
  }
});

// API endpoint for dashboard KPI data with period filter
router.get("/api/admin/dashboard-kpis", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    // Prevent 304 responses for fetch() JSON calls (avoid empty body on .json())
    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('ETag', String(Date.now()));

    const period = req.query.period || 'lifetime'; // 7d, 30d, 6m, 12m, ytd, yearYYYY, lifetime
    const now = new Date();
    let startDate = null;
    let endDate = null;
    
    // Calculate start date based on period
    switch (period) {
      case '7d':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '6m':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case '12m':
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1); // January 1st of current year
        break;
      default: {
        // Support "year2020", "year2021", ... (full calendar year)
        const ym = /^year(\d{4})$/.exec(String(period));
        if (ym) {
          const year = parseInt(ym[1], 10);
          const currentYear = now.getFullYear();
          const safeYear = Math.min(Math.max(year, 1970), currentYear);
          startDate = new Date(safeYear, 0, 1);
          endDate = new Date(safeYear + 1, 0, 1); // exclusive end
          break;
        }

        // Backward compatibility: "since2020" (from Jan 1st of that year until now)
        const sm = /^since(\d{4})$/.exec(String(period));
        if (sm) {
          const year = parseInt(sm[1], 10);
          const currentYear = now.getFullYear();
          // Guardrails: prevent weird ranges
          const safeYear = Math.min(Math.max(year, 1970), currentYear);
          startDate = new Date(safeYear, 0, 1);
          break;
        }
        // Fall through to lifetime/no filter
        startDate = null;
        break;
      }
      case 'lifetime':
        startDate = null; // No filter, get all data
        break;
    }
    
    // Build query filters
    const dateFilter = !!startDate;
    const startIso = startDate ? startDate.toISOString() : null;
    const endIso = endDate ? endDate.toISOString() : null;
    const startDateOnly = startDate ? startDate.toISOString().split('T')[0] : null;
    const endDateOnly = endDate ? endDate.toISOString().split('T')[0] : null;
    
    // 1. Total Users (profiles created in period)
    let totalUsers = 0;
    if (dateFilter) {
      let q = supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startIso);
      if (endIso) q = q.lt('created_at', endIso);
      const { count, error } = await q;
      if (!error) totalUsers = count || 0;
    } else {
      const { count, error } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      if (!error) totalUsers = count || 0;
    }
    
    // 2. Total Leads (leads created in period)
    let totalLeads = 0;
    if (dateFilter) {
      let q = supabaseAdmin
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startIso);
      if (endIso) q = q.lt('created_at', endIso);
      const { count, error } = await q;
      if (!error) totalLeads = count || 0;
    } else {
      const { count, error } = await supabaseAdmin
        .from('leads')
        .select('*', { count: 'exact', head: true });
      if (!error) totalLeads = count || 0;
    }
    
    // 3. Total Revenue (from paid invoices + completed payments in period)
    let totalRevenue = 0;
    try {
      // First, try to get revenue from paid invoices
      if (dateFilter) {
        let invoiceQuery = supabaseAdmin
          .from('customer_invoices')
          .select('amount')
          .eq('status', 'paid')
          .gte('invoice_date', startDateOnly);
        if (endDateOnly) invoiceQuery = invoiceQuery.lt('invoice_date', endDateOnly);
        const { data: invoices, error: invoiceError } = await invoiceQuery;
        
        if (invoiceError) {
          console.error('Error fetching revenue from invoices (with date filter):', invoiceError);
        } else if (invoices && invoices.length > 0) {
          const invoiceRevenue = invoices.reduce((sum, inv) => {
            const amount = parseFloat(inv.amount) || 0;
            return sum + amount;
          }, 0);
          totalRevenue += invoiceRevenue;
          console.log(`Invoice revenue for period ${period}: ${invoiceRevenue} from ${invoices.length} invoices`);
        }
        
        // Also check payments table for paid payments
        let paymentQuery = supabaseAdmin
          .from('payments')
          .select('amount')
          .eq('status', 'paid')
          .gte('created_at', startIso);
        if (endIso) paymentQuery = paymentQuery.lt('created_at', endIso);
        const { data: payments, error: paymentError } = await paymentQuery;
        
        if (paymentError) {
          console.error('Error fetching revenue from payments (with date filter):', paymentError);
        } else if (payments && payments.length > 0) {
          const paymentRevenue = payments.reduce((sum, p) => {
            const amount = parseFloat(p.amount) || 0;
            return sum + amount;
          }, 0);
          totalRevenue += paymentRevenue;
          console.log(`Payment revenue for period ${period}: ${paymentRevenue} from ${payments.length} payments`);
        }
      } else {
        // Lifetime: get all paid invoices
        const { data: invoices, error: invoiceError } = await supabaseAdmin
          .from('customer_invoices')
          .select('amount')
          .eq('status', 'paid');
        
        if (invoiceError) {
          console.error('Error fetching revenue from invoices (lifetime):', invoiceError);
        } else if (invoices && invoices.length > 0) {
          const invoiceRevenue = invoices.reduce((sum, inv) => {
            const amount = parseFloat(inv.amount) || 0;
            return sum + amount;
          }, 0);
          totalRevenue += invoiceRevenue;
          console.log(`Lifetime invoice revenue: ${invoiceRevenue} from ${invoices.length} invoices`);
        } else {
          console.log('No paid invoices found for lifetime revenue');
        }
        
        // Also check payments table for paid payments (lifetime)
        const { data: payments, error: paymentError } = await supabaseAdmin
          .from('payments')
          .select('amount')
          .eq('status', 'paid');
        
        if (paymentError) {
          console.error('Error fetching revenue from payments (lifetime):', paymentError);
        } else if (payments && payments.length > 0) {
          const paymentRevenue = payments.reduce((sum, p) => {
            const amount = parseFloat(p.amount) || 0;
            return sum + amount;
          }, 0);
          totalRevenue += paymentRevenue;
          console.log(`Lifetime payment revenue: ${paymentRevenue} from ${payments.length} payments`);
        } else {
          console.log('No completed payments found for lifetime revenue');
        }
      }
      
      console.log(`Total revenue calculated: ${totalRevenue}`);
    } catch (err) {
      console.error('Exception calculating revenue:', err);
    }
    
    // 4. Pending Leads (leads with status 'new' in period)
    let pendingLeads = 0;
    if (dateFilter) {
      let q = supabaseAdmin
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new')
        .gte('created_at', startIso);
      if (endIso) q = q.lt('created_at', endIso);
      const { count, error } = await q;
      if (!error) pendingLeads = count || 0;
    } else {
      const { count, error } = await supabaseAdmin
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new');
      if (!error) pendingLeads = count || 0;
    }
    
    // Calculate growth percentages (compare with previous period)
    let previousStartDate = null;
    if (startDate) {
      const periodEnd = endDate || now;
      const periodDuration = periodEnd - startDate;
      previousStartDate = new Date(startDate.getTime() - periodDuration);
    }
    
    let previousStats = {
      totalUsers: 0,
      totalLeads: 0,
      totalRevenue: 0,
      pendingLeads: 0
    };
    
    if (previousStartDate && startDate) {
      // Previous period users
      const { count } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', previousStartDate.toISOString())
        .lt('created_at', startDate.toISOString());
      if (count !== null) previousStats.totalUsers = count || 0;
      
      // Previous period leads
      const { count: leadsCount } = await supabaseAdmin
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', previousStartDate.toISOString())
        .lt('created_at', startDate.toISOString());
      if (leadsCount !== null) previousStats.totalLeads = leadsCount || 0;
      
      // Previous period revenue
      const { data: prevInvoices } = await supabaseAdmin
        .from('customer_invoices')
        .select('amount')
        .eq('status', 'paid')
        .gte('invoice_date', previousStartDate.toISOString().split('T')[0])
        .lt('invoice_date', startDate.toISOString().split('T')[0]);
      if (prevInvoices) {
        previousStats.totalRevenue = prevInvoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
      }
      
      // Previous period pending leads
      const { count: pendingCount } = await supabaseAdmin
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new')
        .gte('created_at', previousStartDate.toISOString())
        .lt('created_at', startDate.toISOString());
      if (pendingCount !== null) previousStats.pendingLeads = pendingCount || 0;
    }
    
    // Calculate growth percentages
    const calculateGrowth = (current, previous) => {
      if (!previous || previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };
    
    const usersGrowth = calculateGrowth(totalUsers, previousStats.totalUsers);
    const leadsGrowth = calculateGrowth(totalLeads, previousStats.totalLeads);
    const revenueGrowth = calculateGrowth(totalRevenue, previousStats.totalRevenue);
    const pendingGrowth = calculateGrowth(pendingLeads, previousStats.pendingLeads);
    
    res.json({
      success: true,
      period,
      stats: {
        totalUsers,
        totalLeads,
        totalRevenue,
        pendingLeads,
        usersGrowth,
        leadsGrowth,
        revenueGrowth,
        pendingGrowth
      }
    });
  } catch (err) {
    console.error('Error fetching dashboard KPIs:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      stats: {
        totalUsers: 0,
        totalLeads: 0,
        totalRevenue: 0,
        pendingLeads: 0
      }
    });
  }
});

// Test page for KPI simulation
router.get("/money", requireAuth, isAdmin, async (req, res) => {
  try {
    res.render("admin/money-test", {
      title: "KPI Simulator",
      user: req.user,
      activeMenu: 'dashboard',
      stylesheets: ['/css/admin/dashboard.css']
    });
  } catch (err) {
    console.error('Error rendering money test page:', err);
    res.status(500).send('Error loading page');
  }
});

// Admin dashboard - adaptive: company view (admin) or employee view (role + optional ?for=employeeId)
router.get("/", async (req, res) => {
  try {
    // Get user role and admin status first
    let userRole = null;
    let isUserAdmin = req.user?.user_metadata?.is_admin === true;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, is_admin, role_id, first_name, last_name, company_name, email')
      .eq('id', req.user.id)
      .single();

    if (profile?.is_admin) isUserAdmin = true;
    if (profile?.role_id) {
      const { data: role } = await supabaseAdmin
        .from('roles')
        .select('id, name')
        .eq('id', profile.role_id)
        .maybeSingle();
      if (role) userRole = role.name?.toLowerCase() || null;
    }

    // Dashboard mode: 'company' (bedrijfsdashboard) or 'employee' (werkdashboard voor één werknemer)
    let dashboardMode = 'company';
    let viewingEmployeeId = null;
    let viewingEmployee = null; // { id, first_name, last_name, email }
    let employees = []; // only for admin: list of werknemers for selector

    if (isUserAdmin) {
      // Admin: optional ?for=uuid to view as that employee
      const { getRoleMap } = require('../utils/roleCache');
      const { roleMap, roleDisplayMap } = await getRoleMap();

      const { data: allProfiles } = await supabaseAdmin
        .from('profiles')
        .select('id, email, first_name, last_name, company_name, role_id, is_admin')
        .order('first_name');

      const employeeProfiles = (allProfiles || []).filter(p => {
        if (p.is_admin === true) return true;
        if (p.role_id) {
          const r = (roleMap && roleMap[String(p.role_id)]) ? String(roleMap[String(p.role_id)]).toLowerCase() : '';
          if (r === 'customer' || r === 'consumer' || r === 'klant') return false;
        }
        return true;
      });

      employees = employeeProfiles.map(p => {
        const displayName = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.company_name || p.email || p.id;
        const roleDisplayName = (roleDisplayMap && p.role_id && roleDisplayMap[String(p.role_id)]) ? roleDisplayMap[String(p.role_id)].trim() : null;
        return {
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          email: p.email,
          displayName,
          roleDisplayName: roleDisplayName || null
        };
      });

      const forId = (req.query.for || '').trim();
      if (forId && employees.some(e => e.id === forId)) {
        dashboardMode = 'employee';
        viewingEmployeeId = forId;
        viewingEmployee = employees.find(e => e.id === forId) || { id: forId, first_name: 'Werknemer', last_name: '', displayName: 'Werknemer' };
      }
    } else {
      // Non-admin: always employee view (own dashboard)
      dashboardMode = 'employee';
      viewingEmployeeId = req.user.id;
      viewingEmployee = {
        id: profile?.id || req.user.id,
        first_name: profile?.first_name,
        last_name: profile?.last_name,
        email: profile?.email,
        displayName: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.company_name || profile?.email || 'Mij'
      };
    }

    // Company stats (only needed when showing company dashboard, but harmless to always fetch)
    const stats = {
      totalUsers: 0,
      totalLeads: 0,
      totalRevenue: 0,
      pendingLeads: 0,
    };

    const { data: profiles } = await supabase.from('profiles').select('id', { count: 'exact' });
    stats.totalUsers = profiles?.length ?? 0;

    const { data: leads } = await supabase.from('leads').select('id', { count: 'exact' });
    stats.totalLeads = leads?.length ?? 0;

    const { data: payments } = await supabase.from('payments').select('amount').eq('status', 'paid');
    stats.totalRevenue = (payments || []).reduce((sum, p) => sum + p.amount, 0);

    const { data: pendingLeads } = await supabase.from('leads').select('id', { count: 'exact' }).eq('status', 'new');
    stats.pendingLeads = pendingLeads?.length ?? 0;

    const { data: recentUsers } = await supabase
      .from('profiles')
      .select('id, company_name, email, created_at, has_payment_method')
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: recentLeads } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    res.render("admin/index", {
      stats,
      recentUsers: recentUsers || [],
      recentLeads: recentLeads || [],
      error: null,
      activeSubmenu: null,
      userRole,
      isUserAdmin,
      activeMenu: 'dashboard',
      dashboardMode,
      viewingEmployeeId,
      viewingEmployee,
      employees,
    });
  } catch (err) {
    console.error("Admin dashboard error:", err);
    const isUserAdmin = req.user?.user_metadata?.is_admin === true;
    res.render("admin/index", {
      stats: { totalUsers: 0, totalLeads: 0, totalRevenue: 0, pendingLeads: 0 },
      recentUsers: [],
      recentLeads: [],
      error: "Er is een fout opgetreden bij het laden van het dashboard",
      activeSubmenu: null,
      userRole: null,
      isUserAdmin,
      activeMenu: 'dashboard',
      dashboardMode: isUserAdmin ? 'company' : 'employee',
      viewingEmployeeId: isUserAdmin ? null : req.user?.id,
      viewingEmployee: isUserAdmin ? null : { displayName: 'Mij' },
      employees: [],
    });
  }
});

// Admin dashboard alias
router.get("/dashboard", async (req, res) => {
  // Redirect to main admin dashboard
  res.redirect('/admin');
})

// Gebruikers beheren
router.get("/profiles", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
    const offset = (page - 1) * itemsPerPage;

    // Get total count of profiles
    const { count, error: countError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error("Error getting user count:", countError);
      throw countError;
    }

    // Get paginated profiles
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + itemsPerPage - 1);

    if (error) {
      console.error("Error getting profiles:", error);
      throw error;
    }

    const hasMore = offset + itemsPerPage < count;

    // If it's an AJAX request, return JSON
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.json({
        profiles: profiles || [],
        hasMore,
        totalItems: count
      });
    }

    // Regular request, render the page
    res.render("admin/profiles", {
      profiles: profiles || [],
      hasMore,
      totalItems: count,
      error: null,
      activeSubmenu: null
    });
  } catch (err) {
    console.error("Admin profiles error:", err);
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.status(500).json({ error: "Er is een fout opgetreden bij het laden van de gebruikers" });
    }
    res.render("admin/profiles", {
      profiles: [],
      hasMore: false,
      totalItems: 0,
      error: "Er is een fout opgetreden bij het laden van de gebruikers",
      activeSubmenu: null
    });
  }
});

// Users beheren (alias voor profiles)
router.get("/users", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    console.log("🔍 Admin users route called");
    
    const page = parseInt(req.query.page) || 1;
    const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
    const offset = (page - 1) * itemsPerPage;

    console.log(`📊 Fetching users - page: ${page}, itemsPerPage: ${itemsPerPage}, offset: ${offset}`);

    // Get auth users from Supabase Auth (not profiles table)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();

    if (authError) {
      console.error("❌ Error getting auth users:", authError);
      throw authError;
    }

    const authUsers = authData?.users || [];
    const uniqueCount = authUsers.length;

    console.log(`📈 Total auth users count: ${uniqueCount}`);

    // Convert auth users to profile-like format and enrich with profile data
    const enrichedUsers = await Promise.all(authUsers.map(async (authUser) => {
      // Try to get additional profile data from profiles table
      const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('*')
        .eq('id', authUser.id)
        .single();
      
      return {
        id: authUser.id,
        email: authUser.email || '',
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at,
        email_confirmed_at: authUser.email_confirmed_at,
        // Merge with profile data if available
        ...(profileData || {}),
        // Override with auth data (these are the source of truth)
        last_login: authUser.last_sign_in_at,
        // Get admin status from user_metadata or profile
        is_admin: authUser.user_metadata?.is_admin || profileData?.is_admin || false,
        status: profileData?.status || 'active',
        has_payment_method: profileData?.has_payment_method || false,
        payment_method: profileData?.payment_method || null,
        company_name: profileData?.company_name || authUser.user_metadata?.company_name || null,
      };
    }));

    // Sort by created_at descending
    enrichedUsers.sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB - dateA;
    });

    // Apply pagination
    const paginatedUsers = enrichedUsers.slice(offset, offset + itemsPerPage);
    const profiles = paginatedUsers;
    
    console.log(`📊 Pagination: showing ${offset + 1}-${Math.min(offset + itemsPerPage, uniqueCount)} of ${uniqueCount} auth users`);

    console.log(`👥 Profiles fetched: ${profiles ? profiles.length : 0}`);
    if (profiles && profiles.length > 0) {
      console.log("📋 First profile:", JSON.stringify(profiles[0], null, 2));
      console.log("📋 All profile IDs:", profiles.map(p => p.id));
      console.log("📋 All profile emails:", profiles.map(p => p.email));
      console.log("📋 Unique IDs count:", new Set(profiles.map(p => p.id)).size);
      console.log("📋 Unique emails count:", new Set(profiles.map(p => p.email)).size);
      
      // Check for duplicates
      const ids = profiles.map(p => p.id);
      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
      if (duplicates.length > 0) {
        console.log("⚠️ WARNING: Duplicate IDs found:", duplicates);
      }
    } else {
      console.log("⚠️ No profiles returned from query");
    }

    // Get outstanding payments for all users
    const userIds = profiles ? profiles.map(p => p.id) : [];
    let outstandingPayments = {};
    let pendingMandates = {};

    if (userIds.length > 0) {
      // Get outstanding payments
      const { data: payments, error: paymentsError } = await supabaseAdmin
        .from('payments')
        .select('user_id, amount, status')
        .in('user_id', userIds)
        .eq('status', 'pending');

      if (paymentsError) {
        console.error("❌ Error getting outstanding payments:", paymentsError);
      } else {
        // Group payments by user
        payments?.forEach(payment => {
          if (!outstandingPayments[payment.user_id]) {
            outstandingPayments[payment.user_id] = { count: 0, total: 0 };
          }
          outstandingPayments[payment.user_id].count++;
          outstandingPayments[payment.user_id].total += parseFloat(payment.amount || 0);
        });
      }

      // Get pending SEPA mandates
      const { data: mandates, error: mandatesError } = await supabaseAdmin
        .from('pending_mandates')
        .select('user_id, status')
        .in('user_id', userIds)
        .eq('status', 'pending_verification');

      if (mandatesError) {
        console.error("❌ Error getting pending mandates:", mandatesError);
      } else {
        // Group mandates by user
        mandates?.forEach(mandate => {
          if (!pendingMandates[mandate.user_id]) {
            pendingMandates[mandate.user_id] = 0;
          }
          pendingMandates[mandate.user_id]++;
        });
      }
    }

    // Add payment information to profiles
    const profilesWithPayments = profiles ? profiles.map(profile => ({
      ...profile,
      outstandingPayments: outstandingPayments[profile.id] || { count: 0, total: 0 },
      pendingMandates: pendingMandates[profile.id] || 0
    })) : [];

    const hasMore = offset + itemsPerPage < uniqueCount;

    // If it's an AJAX request, return JSON
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      console.log("📤 Returning JSON response");
      return res.json({
        profiles: profilesWithPayments || [],
        hasMore,
        totalItems: uniqueCount
      });
    }

    // Calculate KPIs
    const activeUsers = profilesWithPayments.filter(p => p.status === 'active' || !p.status).length;
    const adminCount = profilesWithPayments.filter(p => p.is_admin).length;
    const usersWithPayment = profilesWithPayments.filter(p => p.has_payment_method || (p.payment_method && p.payment_method !== '')).length;
    const totalOutstanding = Object.values(outstandingPayments).reduce((sum, p) => sum + (p.total || 0), 0);

    // Regular request, render the page
    console.log("🎨 Rendering admin/users template with users:", profilesWithPayments ? profilesWithPayments.length : 0);
    console.log("📊 Pagination info - page:", page, "itemsPerPage:", itemsPerPage, "totalItems:", uniqueCount, "hasMore:", hasMore);
    console.log("📋 Users being passed to template:", profilesWithPayments.map(u => ({ id: u.id, email: u.email })));
    // Get current user's admin status for sidebar navigation
    let isUserAdmin = req.user?.user_metadata?.is_admin === true;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, role_id')
        .eq('id', req.user.id)
        .single();
      
      if (profile?.is_admin) {
        isUserAdmin = true;
      }
    } catch (roleErr) {
      console.log('Error fetching user admin status:', roleErr);
    }

    res.render("admin/users", {
      title: 'Gebruikersbeheer',
      activeMenu: 'users',
      user: req.user,
      isUserAdmin: isUserAdmin,
      users: profilesWithPayments || [],
      hasMore,
      totalItems: uniqueCount,
      page: page,
      itemsPerPage: itemsPerPage,
      totalPages: Math.ceil(uniqueCount / itemsPerPage),
      error: null,
      activeSubmenu: null,
      kpis: {
        totalUsers: uniqueCount || 0,
        activeUsers,
        adminCount,
        usersWithPayment,
        totalOutstanding
      },
      scripts: ['/js/admin/users.js', '/js/admin/addUser.js', '/js/admin/editUser.js'],
      stylesheets: ['/css/opportunities.css']
    });
  } catch (err) {
    console.error("❌ Admin users error:", err);
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.status(500).json({ error: "Er is een fout opgetreden bij het laden van de gebruikers" });
    }
    console.log("🎨 Rendering admin/users template with error");
    res.render("admin/users", {
      users: [],
      hasMore: false,
      totalItems: 0,
      error: "Er is een fout opgetreden bij het laden van de gebruikers",
      activeSubmenu: null
    });
  }
});

// Single user page
router.get("/users/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Admin single user route called for ID: ${id}`);

    // Get auth user from Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(id);
    
    if (authError || !authData?.user) {
      console.error("❌ Error getting auth user:", authError);
      return res.status(404).render('error', { 
        message: 'Gebruiker niet gevonden', 
        error: {}, 
        user: req.user 
      });
    }

    const authUser = authData.user;

    // Get additional profile data from profiles table
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    
    // Combine auth and profile data
    const user = {
      id: authUser.id,
      email: authUser.email || '',
      created_at: authUser.created_at,
      last_sign_in_at: authUser.last_sign_in_at,
      email_confirmed_at: authUser.email_confirmed_at,
      // Merge with profile data if available
      ...(profileData || {}),
      // Override with auth data (these are the source of truth)
      last_login: authUser.last_sign_in_at,
      // Get admin status from user_metadata or profile
      is_admin: authUser.user_metadata?.is_admin || profileData?.is_admin || false,
      status: profileData?.status || 'active',
      has_payment_method: profileData?.has_payment_method || false,
      payment_method: profileData?.payment_method || null,
      company_name: profileData?.company_name || authUser.user_metadata?.company_name || null,
    };

    // Get outstanding payments
    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('user_id', id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    const outstandingPayments = {
      count: payments?.length || 0,
      total: payments?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0,
      items: payments || []
    };

    // Get pending mandates
    const { data: mandates } = await supabaseAdmin
      .from('pending_mandates')
      .select('*')
      .eq('user_id', id)
      .eq('status', 'pending_verification');

    // Get user statistics
    // Total spent (from completed/paid payments)
    const { data: completedPayments } = await supabaseAdmin
      .from('payments')
      .select('amount')
      .eq('user_id', id)
      .eq('status', 'paid');

    const totalSpent = completedPayments?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;

    // Leads bought (accepted leads)
    const { data: leads } = await supabaseAdmin
      .from('leads')
      .select('id')
      .eq('user_id', id)
      .eq('status', 'accepted');

    const leadsBought = leads?.length || 0;

    // Total orders (invoices)
    const { data: invoices } = await supabaseAdmin
      .from('invoices')
      .select('id')
      .eq('user_id', id);

    const totalOrders = invoices?.length || 0;

    const stats = {
      total_spent: totalSpent,
      leads_bought: leadsBought,
      total_orders: totalOrders
    };

    // Get recent activities for this user (max 5)
    // Combine activities from multiple sources:
    // 1. System logs (system_logs table)
    // 2. Login history (login_history table)
    // 3. Activities (activities table via ActivityService)
    
    const [systemLogsResult, loginHistoryResult, activitiesResult] = await Promise.all([
      // System logs
      supabaseAdmin
        .from('system_logs')
        .select('id, title, message, created_at, log_type, category')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(10),
      
      // Login history (convert to activity format)
      supabaseAdmin
        .from('login_history')
        .select('id, created_at, status, login_method, device, location')
        .eq('user_id', id)
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(10),
      
      // Activities table (if exists) - wrapped in try/catch
      (async () => {
        try {
          const result = await supabaseAdmin
            .from('activities')
            .select('id, title, description, created_at, activity_type, severity')
            .eq('user_id', id)
            .order('created_at', { ascending: false })
            .limit(10);
          return result;
        } catch (err) {
          return { data: null, error: null }; // Ignore if table doesn't exist
        }
      })()
    ]);
    
    // Combine and format all activities
    const allActivities = [];
    
    // Add system logs
    if (systemLogsResult.data) {
      systemLogsResult.data.forEach(log => {
        allActivities.push({
          id: log.id,
          title: log.title || log.message || 'Systeem activiteit',
          message: log.message,
          created_at: log.created_at,
          type: log.log_type,
          category: log.category
        });
      });
    }
    
    // Add login history
    if (loginHistoryResult.data) {
      loginHistoryResult.data.forEach(login => {
        allActivities.push({
          id: `login_${login.id}`,
          title: 'Ingelogd op platform',
          message: `Ingelogd via ${login.login_method || 'wachtwoord'}${login.device ? ` vanaf ${login.device}` : ''}${login.location ? ` in ${login.location}` : ''}`,
          created_at: login.created_at,
          type: 'success',
          category: 'authentication'
        });
      });
    }
    
    // Add activities
    if (activitiesResult.data) {
      activitiesResult.data.forEach(activity => {
        allActivities.push({
          id: `activity_${activity.id}`,
          title: activity.title || 'Activiteit',
          message: activity.description,
          created_at: activity.created_at,
          type: activity.activity_type || 'info',
          category: activity.severity || 'system'
        });
      });
    }
    
    // Sort by created_at and take top 5
    const activities = allActivities
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);

    // Get user name for display
    const userName = user.first_name && user.last_name 
      ? `${user.first_name} ${user.last_name}`
      : user.email?.split('@')[0] || 'Gebruiker';

    // Get current user's admin status for sidebar navigation
    let isUserAdmin = req.user?.user_metadata?.is_admin === true;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, role_id')
        .eq('id', req.user.id)
        .single();
      
      if (profile?.is_admin) {
        isUserAdmin = true;
      }
    } catch (roleErr) {
      console.log('Error fetching user admin status:', roleErr);
    }

    res.render("admin/user", {
      title: `${userName} - Users | GrowSocial Admin`,
      activeMenu: 'users',
      user: req.user,
      isUserAdmin: isUserAdmin,
      userData: {
        ...user,
        name: userName,
        outstandingPayments,
        pendingMandates: mandates || [],
        stats,
        activities: activities || []
      },
      scripts: ['/js/admin/users.js'],
      stylesheets: ['/css/admin/users.css']
    });
  } catch (err) {
    console.error("❌ Admin single user error:", err);
    res.status(500).render('error', { 
      message: 'Er is een fout opgetreden bij het laden van de gebruiker', 
      error: {}, 
      user: req.user 
    });
  }
});

// API endpoints voor gebruikersacties
// Get user by ID
router.get("/api/users/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Fetching user with ID: ${id}`);

    const { data: user, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error("❌ Error fetching user:", error);
      return res.status(404).json({ error: "Gebruiker niet gevonden" });
    }

    console.log("✅ User fetched successfully:", user.email);
    res.json({ user });
  } catch (err) {
    console.error("❌ Error in get user API:", err);
    res.status(500).json({ error: "Er is een fout opgetreden bij het ophalen van de gebruiker" });
  }
});

// Update user
router.post("/api/users/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Ensure can_read_company_mailboxes is boolean
    if (updateData.can_read_company_mailboxes !== undefined) {
      updateData.can_read_company_mailboxes = updateData.can_read_company_mailboxes === true || updateData.can_read_company_mailboxes === 'true';
    }
    
    console.log(`📝 Updating user ${id} with data:`, updateData);

    const { data: user, error } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error("❌ Error updating user:", error);
      return res.status(400).json({ error: "Kon gebruiker niet bijwerken" });
    }

    console.log("✅ User updated successfully:", user.email);
    res.json({ success: true, message: "Gebruiker succesvol bijgewerkt", user });
  } catch (err) {
    console.error("❌ Error in update user API:", err);
    res.status(500).json({ error: "Er is een fout opgetreden bij het bijwerken van de gebruiker" });
  }
});

// Approve user (clear manual review flag)
router.post("/api/users/:id/approve", requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const reviewerId = req.user.id;
    
    console.log(`✅ Approving user ${id} by reviewer ${reviewerId}`);

    const { data: user, error } = await supabaseAdmin
      .from('profiles')
      .update({
        requires_manual_review: false,
        manually_reviewed: true,
        manually_reviewed_by: reviewerId,
        manually_reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error("❌ Error approving user:", error);
      return res.status(400).json({ error: "Kon gebruiker niet goedkeuren" });
    }

    console.log("✅ User approved successfully:", user.email);
    res.json({ success: true, message: "Gebruiker succesvol goedgekeurd", user });
  } catch (err) {
    console.error("❌ Error in approve user API:", err);
    res.status(500).json({ error: "Er is een fout opgetreden bij het goedkeuren van de gebruiker" });
  }
});

// Manually trigger risk assessment for a user
router.post("/api/users/:id/assess-risk", requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔄 Manually triggering risk assessment for user ${id}`);

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (profileError || !profile) {
      console.error("❌ Error fetching profile:", profileError);
      return res.status(404).json({ error: "Gebruiker niet gevonden" });
    }

    // Check if we have enough data to assess
    if (!profile.company_name && !profile.email) {
      return res.status(400).json({ 
        error: "Onvoldoende gegevens voor risk assessment. Bedrijfsnaam of email is vereist." 
      });
    }

    // Execute risk assessment
    const result = await UserRiskAssessmentService.evaluateAndSaveRisk(supabaseAdmin, profile);

    if (result.success) {
      console.log(`✅ Risk assessment completed for user ${id}: score=${result.score}, requires_review=${result.requires_manual_review}`);
      res.json({ 
        success: true, 
        message: "Risk assessment succesvol uitgevoerd",
        score: result.score,
        risk_level: result.risk_level,
        requires_manual_review: result.requires_manual_review
      });
    } else {
      console.error(`❌ Risk assessment failed for user ${id}:`, result.error);
      const errorMessage = result.error || 'Onbekende fout opgetreden'
      res.status(500).json({ 
        success: false,
        error: errorMessage,
        details: result.error 
      });
    }
  } catch (err) {
    console.error("❌ Error in manual risk assessment API:", err);
    const errorMessage = err.message || 'Er is een fout opgetreden bij het uitvoeren van de risk assessment'
    res.status(500).json({ 
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Block/suspend user
router.post("/api/users/:id/block", requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const blockerId = req.user.id;
    
    console.log(`🚫 Blocking user ${id} by ${blockerId}, reason: ${reason || 'none'}`);

    const { data: user, error } = await supabaseAdmin
      .from('profiles')
      .update({
        is_suspended: true,
        suspended_at: new Date().toISOString(),
        suspended_by: blockerId,
        suspension_reason: reason || null,
        status: 'inactive',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error("❌ Error blocking user:", error);
      return res.status(400).json({ error: "Kon gebruiker niet blokkeren" });
    }

    console.log("✅ User blocked successfully:", user.email);
    res.json({ success: true, message: "Gebruiker succesvol geblokkeerd", user });
  } catch (err) {
    console.error("❌ Error in block user API:", err);
    res.status(500).json({ error: "Er is een fout opgetreden bij het blokkeren van de gebruiker" });
  }
});

// Bulk actions - MUST come before individual user routes to avoid routing conflicts
router.post("/api/users/bulk/status", requireAuth, isAdmin, async (req, res) => {
  try {
    const { ids, status } = req.body;
    
    console.log(`🔄 Bulk updating ${ids.length} users status to: ${status}`);

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Geen gebruikers geselecteerd" });
    }

    if (!['active', 'inactive', 'pending'].includes(status)) {
      return res.status(400).json({ error: "Ongeldige status" });
    }

    // ✅ Use centralized should_block_user_for_status_change function
    // Call function for each user individually since it expects single user_id
    const blockResults = [];
    for (const userId of ids) {
      const { data: result, error: blockError } = await supabaseAdmin
        .rpc('should_block_user_for_status_change', { p_user_id: userId });
      
      if (blockError) {
        console.error("❌ Error checking user block status:", blockError);
        return res.status(500).json({ error: "Kon gebruiker blokkeringsstatus niet controleren" });
      }
      
      if (result && result.length > 0) {
        blockResults.push({ user_id: userId, ...result[0] });
      }
    }

    // Filter blocked users
    const blocked = blockResults?.filter(r => r.block) || [];

    if (blocked.length > 0) {
      const reasons = [...new Set(blocked.map(b => b.reason).filter(Boolean))].join(', ');
      console.log(`❌ Cannot perform bulk status update: ${blocked.length} users blocked (${reasons || 'blocked by policy'})`);
      return res.status(400).json({ 
        error: `Kan bulk status update niet uitvoeren - ${blocked.length} gebruiker(s) geblokkeerd`,
        blockedUsers: blocked.map(user => ({
          userId: user.user_id,
          reason: user.reason,
          outstandingPayments: user.reason?.includes('Openstaande betalingen') ? 1 : 0,
          pendingMandates: user.reason?.includes('SEPA-mandaten') ? 1 : 0,
          totalAmount: user.reason?.match(/€([0-9.]+)/)?.[1] || '0.00'
        }))
      });
    }

    const { data: users, error } = await supabaseAdmin
      .from('profiles')
      .update({ status })
      .in('id', ids)
      .select();

    if (error) {
      console.error("❌ Error bulk updating status:", error);
      return res.status(400).json({ error: "Kon status niet bijwerken" });
    }

    console.log(`✅ Bulk status update successful: ${users.length} users updated`);
    res.json({ success: true, message: `${users.length} gebruikers succesvol bijgewerkt`, users });
  } catch (err) {
    console.error("❌ Error in bulk status update API:", err);
    res.status(500).json({ error: "Er is een fout opgetreden bij het bijwerken van de status" });
  }
});

// Update user status (activate/deactivate)
router.post("/api/users/:id/status", requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    console.log(`🔄 Updating user ${id} status to: ${status}`);

    // ✅ Use centralized should_block_user_for_status_change function
    const { data: blockResults, error: blockError } = await supabaseAdmin
      .rpc('should_block_user_for_status_change', { p_user_id: id });

    if (blockError) {
      console.error("❌ Error checking user block status:", blockError);
      return res.status(500).json({ error: "Kon gebruiker blokkeringsstatus niet controleren" });
    }

    // Check if user is blocked
    const blockResult = blockResults?.[0];
    if (blockResult?.block) {
      console.log(`❌ Cannot change status: User ${id} is blocked (${blockResult.reason || 'blocked by policy'})`);
      return res.status(400).json({ 
        error: `Kan account niet ${status === 'active' ? 'activeren' : 'deactiveren'} - ${blockResult.reason || 'geblokkeerd door beleid'}`,
        reason: blockResult.reason,
        outstandingPayments: blockResult.reason?.includes('Openstaande betalingen') ? 1 : 0,
        pendingMandates: blockResult.reason?.includes('SEPA-mandaten') ? 1 : 0,
        totalAmount: blockResult.reason?.match(/€([0-9.]+)/)?.[1] || '0.00'
      });
    }

    const { data: user, error } = await supabaseAdmin
      .from('profiles')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error("❌ Error updating user status:", error);
      return res.status(400).json({ error: "Kon status niet bijwerken" });
    }

    console.log("✅ User status updated successfully:", user.email, "to", status);
    res.json({ success: true, message: `Gebruiker succesvol ${status === 'active' ? 'geactiveerd' : 'gedeactiveerd'}`, user });
  } catch (err) {
    console.error("❌ Error in update status API:", err);
    res.status(500).json({ error: "Er is een fout opgetreden bij het bijwerken van de status" });
  }
});

// Reset user password
router.post("/api/users/:id/reset-password", requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔑 Resetting password for user: ${id}`);

    // Use Supabase Admin API to reset password
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: req.body.email || 'user@example.com' // We need the email for password reset
    });

    if (error) {
      console.error("❌ Error resetting password:", error);
      return res.status(400).json({ error: "Kon wachtwoord niet resetten" });
    }

    console.log("✅ Password reset link generated successfully");
    res.json({ 
      success: true, 
      message: "Wachtwoord reset link gegenereerd", 
      resetLink: data.properties.action_link 
    });
  } catch (err) {
    console.error("❌ Error in reset password API:", err);
    res.status(500).json({ error: "Er is een fout opgetreden bij het resetten van het wachtwoord" });
  }
});

// Delete user
router.delete("/api/users/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🗑️ Deleting user: ${id}`);

    // Check if user exists
    const { data: user, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('id', id)
      .single();

    if (userError) {
      console.error("❌ Error finding user:", userError);
      return res.status(404).json({ error: "Gebruiker niet gevonden" });
    }

    // Check for outstanding payments before deletion
    const { data: outstandingPayments, error: paymentsError } = await supabaseAdmin
      .from('payments')
      .select('id, amount, status')
      .eq('user_id', id)
      .eq('status', 'pending');

    if (paymentsError) {
      console.error("❌ Error checking outstanding payments:", paymentsError);
    }

    if (outstandingPayments && outstandingPayments.length > 0) {
      const totalOutstanding = outstandingPayments.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
      console.log(`❌ Cannot delete user: User ${id} has ${outstandingPayments.length} outstanding payments (€${totalOutstanding.toFixed(2)})`);
      return res.status(400).json({ 
        error: `Kan gebruiker niet verwijderen - er zijn openstaande betalingen (€${totalOutstanding.toFixed(2)})`,
        outstandingPayments: outstandingPayments.length,
        totalAmount: totalOutstanding
      });
    }

    // Check for pending SEPA mandates
    const { data: pendingMandates, error: mandatesError } = await supabaseAdmin
      .from('pending_mandates')
      .select('id, status')
      .eq('user_id', id)
      .eq('status', 'pending_verification');

    if (mandatesError) {
      console.error("❌ Error checking pending mandates:", mandatesError);
    }

    if (pendingMandates && pendingMandates.length > 0) {
      console.log(`❌ Cannot delete user: User ${id} has ${pendingMandates.length} pending SEPA mandates`);
      return res.status(400).json({ 
        error: `Kan gebruiker niet verwijderen - er zijn openstaande SEPA mandaten in behandeling`,
        pendingMandates: pendingMandates.length
      });
    }

    // Delete related records first to avoid foreign key constraints
    const tablesToClean = [
      { table: 'user_industry_preferences', column: 'user_id' },
      { table: 'lead_activities', column: 'user_id' },
      { table: 'payments', column: 'user_id' },
      { table: 'leads', column: 'user_id' },
      { table: 'invoices', column: 'user_id' },
      { table: 'payment_methods', column: 'user_id' },
      { table: 'settings', column: 'user_id' },
      { table: 'pdfs', column: 'user_id' }
    ];

    // Handle profile_completion_status - MUST be deleted before profiles due to NO ACTION constraint
    try {
      console.log(`🧹 Deleting from profile_completion_status for user: ${id}`);
      
      const { error: completionError } = await supabaseAdmin
        .from('profile_completion_status')
        .delete()
        .eq('id', id);
      
      if (completionError) {
        console.error(`❌ Error deleting from profile_completion_status:`, completionError);
        // If this fails, we can't proceed with profile deletion
        return res.status(400).json({ 
          error: "Kon profile completion status niet verwijderen", 
          details: completionError.message 
        });
      } else {
        console.log(`✅ Successfully deleted from profile_completion_status`);
      }
    } catch (err) {
      console.error(`❌ Exception deleting from profile_completion_status:`, err);
      return res.status(400).json({ 
        error: "Kon profile completion status niet verwijderen", 
        details: err.message 
      });
    }

    // Clean up other tables
    for (const { table, column } of tablesToClean) {
      try {
        const { error: deleteError } = await supabaseAdmin
          .from(table)
          .delete()
          .eq(column, id);
        
        if (deleteError && !deleteError.message.includes('does not exist')) {
          console.warn(`⚠️ Warning deleting from ${table}:`, deleteError.message);
        }
      } catch (err) {
        console.warn(`⚠️ Warning deleting from ${table}:`, err.message);
      }
    }

    // Delete from profiles table (now that profile_completion_status is cleaned up)
    console.log(`🗑️ Deleting from profiles table for user: ${id}`);
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', id);

    if (profileError) {
      console.error("❌ Error deleting profile:", profileError);
      return res.status(400).json({ 
        error: "Kon gebruiker niet verwijderen", 
        details: profileError.message 
      });
    }

    // Finally delete from auth.users
    console.log(`🗑️ Deleting from auth.users for user: ${id}`);
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (authError) {
      console.error("❌ Error deleting auth user:", authError);
      return res.status(400).json({ error: "Kon gebruiker niet verwijderen uit authenticatie systeem" });
    }

    console.log("✅ User deleted successfully:", user.email);
    res.json({ success: true, message: `Gebruiker ${user.email} succesvol verwijderd` });
  } catch (err) {
    console.error("❌ Error in delete user API:", err);
    res.status(500).json({ error: "Er is een fout opgetreden bij het verwijderen van de gebruiker" });
  }
});


// Leads beheren
router.get("/leads", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    // Use supabaseAdmin to bypass RLS and get ALL leads from the platform
    const { data: leads, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching leads:', error)
      throw error
    }

    console.log('Admin leads fetched:', leads ? leads.length : 0, 'leads')

    // Fetch industries for industry name mapping
    const { data: industries, error: industriesError } = await supabaseAdmin
      .from('industries')
      .select('id, name')
      .eq('is_active', true)

    if (industriesError) {
      console.error('Error fetching industries:', industriesError)
    }

    // Create industry lookup map
    const industryMap = {}
    if (industries) {
      industries.forEach(industry => {
        industryMap[industry.id] = industry.name
      })
    }

    // Efficiently fetch user data for all leads in one query (not N+1)
    const userIds = [...new Set((leads || []).filter(l => l.user_id).map(l => l.user_id))]
    const userMap = new Map()
    
    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, company_name')
        .in('id', userIds)
      
      if (!usersError && users) {
        users.forEach(user => {
          userMap.set(user.id, user)
        })
      }
    }

    // Transform leads with user data
    const transformedLeads = (leads || []).map((lead) => {
      const assignedUser = lead.user_id ? userMap.get(lead.user_id) : null

      return {
        ...lead,
        assigned_user: assignedUser,
        assigned_to: assignedUser ? 
          `${assignedUser.first_name} ${assignedUser.last_name}` : 
          (lead.assigned_to || null),
        industry_name: lead.industry_id ? industryMap[lead.industry_id] : null
      }
    })

    res.render("admin/leads", {
      leads: transformedLeads || [],
      industries: industries || [],
      user: req.user,
      error: null,
      activeSubmenu: null
    })
  } catch (err) {
    console.error("Admin leads error:", err)
    res.render("admin/leads", {
      leads: [],
      industries: [],
      user: req.user,
      error: "Er is een fout opgetreden bij het laden van de leads",
      activeSubmenu: null
    })
  }
})

// Customer Lead Single Page
router.get("/customer-leads/:id", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const leadId = req.params.id;
    
    // Fetch lead with all details
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();
    
    if (leadError || !lead) {
      return res.status(404).render('error', {
        message: 'Lead niet gevonden',
        error: {},
        user: req.user
      });
    }
    
    // Fetch industry name
    let industryName = null;
    if (lead.industry_id) {
      const { data: industry } = await supabaseAdmin
        .from('industries')
        .select('name')
        .eq('id', lead.industry_id)
        .single();
      industryName = industry?.name || null;
    }
    
    // Fetch assigned user if exists
    let assignedUser = null;
    if (lead.user_id) {
      const { data: user } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, company_name')
        .eq('id', lead.user_id)
        .single();
      assignedUser = user;
    }
    
    // Fetch activities for this lead
    const { data: activities } = await supabaseAdmin
      .from('lead_activities')
      .select(`
        *,
        profiles:created_by (
          id,
          first_name,
          last_name,
          company_name
        )
      `)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    
    // Format activities with user info
    const formattedActivities = (activities || []).map(activity => ({
      ...activity,
      created_by_info: activity.profiles ? {
        name: activity.profiles.company_name || 
              `${activity.profiles.first_name || ''} ${activity.profiles.last_name || ''}`.trim() ||
              'Onbekend'
      } : null
    }));
    
    // Get current user's admin status for sidebar navigation
    let isUserAdmin = req.user?.user_metadata?.is_admin === true;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, role_id')
        .eq('id', req.user.id)
        .single();
      
      if (profile?.is_admin) {
        isUserAdmin = true;
      }
    } catch (roleErr) {
      console.log('Error fetching user admin status:', roleErr);
    }

    res.render('admin/customer-lead-single', {
      title: `${lead.name || 'Lead'} - Klantaanvraag`,
      activeMenu: 'leads',
      user: req.user,
      isUserAdmin: isUserAdmin,
      lead: {
        ...lead,
        industry_name: industryName,
        assigned_user: assignedUser
      },
      activities: formattedActivities || []
    });
  } catch (err) {
    console.error('Admin customer lead single page error:', err);
    res.status(500).render('error', {
      message: 'Er is een fout opgetreden bij het laden van de lead',
      error: {},
      user: req.user
    });
  }
});

// Betalingen beheren
router.get("/payments", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    // Ensure user object is available
    await ensureUser(req);

    // First get all invoices using service role client
    const { data: invoices, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });

    if (invoiceError) {
      logger.error('Error fetching invoices:', invoiceError);
      throw new Error('Kon facturen niet ophalen');
    }

    // Then get user details for each invoice using service role client
    const userIds = [...new Set(invoices.map(inv => inv.user_id))];
    
    // Get all user details from profiles table
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, company_name, role_id, email')
      .in('id', userIds);

    if (profileError) {
      logger.error('Error fetching profiles:', profileError);
      throw new Error('Kon profielen niet ophalen');
    }

    // Get all profiles from auth layer using admin API
    const { data: authData, error: profilesError } = await supabaseAdmin.auth.admin.listUsers();
    if (profilesError) {
      logger.error('Error fetching profiles:', profilesError);
      throw new Error('Kon gebruikers niet ophalen');
    }

    // Create a map of user details with emails
    const userMap = profiles.reduce((acc, profile) => {
      acc[profile.id] = {
        id: profile.id,
        company_name: profile.company_name,
        email: profile.email || '—',
        role: profile.role_id
      };
      return acc;
    }, {});

    // Get subscription details for invoices that have subscription_id
    const subscriptionIds = [...new Set(invoices.filter(inv => inv.subscription_id).map(inv => inv.subscription_id))];
    let subscriptionMap = {};
    
    if (subscriptionIds.length > 0) {
      const { data: subscriptions, error: subError } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .in('id', subscriptionIds);
      
      if (!subError && subscriptions) {
        subscriptionMap = subscriptions.reduce((acc, sub) => {
          acc[sub.id] = sub;
          return acc;
        }, {});
      }
    }

    // Combine the data
    const invoicesWithDetails = invoices.map(invoice => ({
      ...invoice,
      user: userMap[invoice.user_id] || null,
      subscription: invoice.subscription_id && subscriptionMap[invoice.subscription_id] ? {
        ...subscriptionMap[invoice.subscription_id],
        name: `Subscription ${subscriptionMap[invoice.subscription_id].leads_per_month} leads/maand`,
        price: subscriptionMap[invoice.subscription_id].leads_per_month * 25 // Assuming 25 per lead
      } : null
    }));

    // Render the payments page with the combined data and user object
    res.render('admin/payments', {
      user: req.user, // Pass the user object to the template
      payments: invoicesWithDetails,
      profiles: profiles,
      subscriptions: [], // This will be populated if needed
      activePage: 'payments', // Add active page for navigation highlighting
      title: 'Betalingenbeheer', // Add title for the page
      activeSubmenu: null
    });
  } catch (error) {
    logger.error('Error in /admin/payments:', error);
    res.status(500).render('error', {
      message: 'Er is een fout opgetreden bij het ophalen van de betalingen',
      error: process.env.NODE_ENV === 'development' ? error : {},
      user: req.user // Pass user object even in error case
    });
  }
});

// Admin invoice viewing route - handles both invoice IDs and payment IDs
router.get("/payments/invoice/:id", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    logger.info(`Admin invoice route called for ID: ${id}`);
    
    let invoice = null;
    let invoiceError = null;
    
    // First try to find by invoice ID
    const { data: invoiceData, error: invError } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single();

    if (!invError && invoiceData) {
      // Found by invoice ID
      invoice = invoiceData;
      logger.info(`Found invoice by ID:`, invoice);
    } else {
      // Try to find by payment ID (mollie_payment_id)
      logger.info(`Invoice not found by ID, trying payment ID:`, invError);
      
      const { data: invoiceByPayment, error: paymentError } = await supabaseAdmin
        .from('invoices')
        .select('*')
        .eq('mollie_payment_id', id)
        .single();

      if (!paymentError && invoiceByPayment) {
        invoice = invoiceByPayment;
        logger.info(`Found invoice by payment ID:`, invoice);
      } else {
        // Try to find by payment ID in payments table
        logger.info(`Invoice not found by payment ID, trying payments table:`, paymentError);
        
        const { data: paymentData, error: paymentTableError } = await supabaseAdmin
          .from('payments')
          .select('*')
          .eq('id', id)
          .single();

        if (!paymentTableError && paymentData) {
          // Found payment, now look for invoice with this payment's mollie_payment_id
          if (paymentData.mollie_payment_id) {
            const { data: invoiceByMollieId, error: mollieError } = await supabaseAdmin
              .from('invoices')
              .select('*')
              .eq('mollie_payment_id', paymentData.mollie_payment_id)
              .single();

            if (!mollieError && invoiceByMollieId) {
              invoice = invoiceByMollieId;
              logger.info(`Found invoice by mollie_payment_id:`, invoice);
            } else {
              logger.error(`No invoice found for payment:`, { paymentData, mollieError });
            }
          } else {
            logger.error(`Payment has no mollie_payment_id:`, paymentData);
          }
        } else {
          logger.error(`Payment not found:`, { paymentTableError });
        }
      }
    }

    if (!invoice) {
      logger.error('No invoice found for ID:', id);
      return res.status(404).render('error', {
        message: 'Factuur niet gevonden',
        error: process.env.NODE_ENV === 'development' ? 'No invoice found for the provided ID' : {},
        user: req.user
      });
    }

    // Get user profile details separately
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, company_name, email, first_name, last_name')
      .eq('id', invoice.user_id)
      .single();

    logger.info(`Profile query result:`, { profile, error: profileError });

    if (profileError) {
      logger.error('Error fetching profile:', profileError);
      // Continue without profile data rather than failing completely
    }

    // Get payment details if available
    let payment = null;
    if (invoice.mollie_payment_id) {
      const { data: paymentData, error: paymentError } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('mollie_payment_id', invoice.mollie_payment_id)
        .single();
      
      if (!paymentError && paymentData) {
        payment = paymentData;
      }
    }

    // Combine invoice with profile data
    const invoiceWithProfile = {
      ...invoice,
      profiles: profile || {
        id: invoice.user_id,
        company_name: 'Onbekend',
        email: 'Onbekend',
        first_name: '',
        last_name: ''
      }
    };

    logger.info(`Rendering invoice with data:`, { invoiceWithProfile, payment });

    // Render invoice view
    res.render('admin/invoice', {
      user: req.user,
      invoice: invoiceWithProfile,
      payment: payment,
      title: `Factuur ${invoice.invoice_number || invoice.id}`,
      activeMenu: 'payments'
    });

  } catch (error) {
    logger.error('Error in admin invoice route:', error);
    res.status(500).render('error', {
      message: 'Er is een fout opgetreden bij het ophalen van de factuur',
      error: process.env.NODE_ENV === 'development' ? error : {},
      user: req.user
    });
  }
});

// Instellingen
router.get("/settings", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    // Zorg ervoor dat req.user is ingesteld
    await ensureUser(req)

    // Check if user is manager or admin
    let isManagerOrAdmin = false;
    if (req.user?.user_metadata?.is_admin === true || req.user?.is_admin === true) {
      isManagerOrAdmin = true;
    } else if (req.user?.role_id) {
      const { data: role } = await supabaseAdmin
        .from('roles')
        .select('name')
        .eq('id', req.user.role_id)
        .maybeSingle();
      
      if (role?.name?.toLowerCase().includes('manager')) {
        isManagerOrAdmin = true;
      }
    }

    // Haal systeemlogs op
    let logs = [];
    try {
      const SystemLogService = require('../services/systemLogService');
      const logsResult = await SystemLogService.getLogs({ limit: 50 });
      logs = logsResult.logs || [];
    } catch (logError) {
      console.error('Error fetching system logs:', logError);
      // Continue without logs if there's an error
    }

    res.render("admin/settings", {
      user: req.user,
      activePage: "settings",
      body: "Dit is de inhoud van de pagina", // Voeg body toe voor express-ejs-layouts
      logs: logs, // Pass logs to the template
      activeSubmenu: null,
      isManagerOrAdmin: isManagerOrAdmin
    })
  } catch (err) {
    console.error("Fout bij laden instellingen:", err)
    res.status(500).send("Er is een fout opgetreden bij het laden van de instellingen")
  }
})

// =====================================================
// SOP / Handleidingen routes
// =====================================================

// GET /admin/sops - Overzicht (tegels)
router.get("/sops", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const { data: categories, error: catError } = await supabaseAdmin
      .from('sop_categories')
      .select('*')
      .order('sort_order', { ascending: true });
    if (catError) throw catError;
    const { data: sopsList, error: sopsError } = await supabaseAdmin
      .from('sops')
      .select('*')
      .eq('published', true)
      .order('sort_order', { ascending: true });
    if (sopsError) throw sopsError;
    const categoriesWithSops = (categories || []).map(c => ({
      ...c,
      sops: (sopsList || []).filter(s => s.category_id === c.id)
    }));
    const isAdmin = req.user?.user_metadata?.is_admin === true || req.user?.is_admin === true;
    let isManager = false;
    if (req.user?.role_id) {
      const { data: role } = await supabaseAdmin.from('roles').select('name').eq('id', req.user.role_id).maybeSingle();
      if (role?.name?.toLowerCase().includes('manager')) isManager = true;
    }
    const canEditSops = isAdmin || isManager;
    res.render("admin/sops/index", {
      title: "Handleidingen",
      activeMenu: "sops",
      activeSubmenu: null,
      user: req.user,
      categories: categoriesWithSops,
      isUserAdmin: canEditSops
    });
  } catch (err) {
    console.error("SOP overview error:", err);
    res.render("admin/sops/index", {
      title: "Handleidingen",
      activeMenu: "sops",
      activeSubmenu: null,
      user: req.user,
      categories: [],
      error: "Kon handleidingen niet laden.",
      isUserAdmin: false
    });
  }
});

// GET /admin/sops/beheer - Editor/beheer (admin) – vaste path zodat :id geen "editor" vangt
router.get("/sops/beheer", requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { data: categories, error: catError } = await supabaseAdmin
      .from('sop_categories')
      .select('*')
      .order('sort_order', { ascending: true });
    if (catError) throw catError;
    const { data: sopsList, error: sopsError } = await supabaseAdmin
      .from('sops')
      .select('*')
      .order('sort_order', { ascending: true });
    if (sopsError) throw sopsError;
    res.render("admin/sops/editor", {
      title: "Handleidingen bewerken",
      activeMenu: "sops",
      activeSubmenu: "editor",
      user: req.user,
      categories: categories || [],
      sops: sopsList || []
    });
  } catch (err) {
    console.error("SOP editor error:", err);
    res.redirect("/admin/sops?error=beheer");
  }
});

// GET /admin/sops/beheer/nieuw - Notion-achtige editor voor nieuwe handleiding
router.get("/sops/beheer/nieuw", requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { data: categories, error } = await supabaseAdmin
      .from('sop_categories')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    res.render("admin/sops/editor-doc", {
      title: "Nieuwe handleiding",
      activeMenu: "sops",
      activeSubmenu: "editor",
      user: req.user,
      categories: categories || [],
      sop: null
    });
  } catch (err) {
    console.error("SOP doc editor (new) error:", err);
    res.redirect("/admin/sops/beheer?error=nieuw");
  }
});

// GET /admin/sops/beheer/bewerken/:id - Notion-achtige editor voor bestaande handleiding
router.get("/sops/beheer/bewerken/:id", requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { data: sop, error: sopError } = await supabaseAdmin
      .from('sops')
      .select('*')
      .eq("id", req.params.id)
      .single();
    if (sopError || !sop) return res.redirect("/admin/sops/beheer");
    const { data: categories, error: catError } = await supabaseAdmin
      .from('sop_categories')
      .select('*')
      .order('sort_order', { ascending: true });
    if (catError) throw catError;
    res.render("admin/sops/editor-doc", {
      title: sop.title + " – Bewerken",
      activeMenu: "sops",
      activeSubmenu: "editor",
      user: req.user,
      categories: categories || [],
      sop
    });
  } catch (err) {
    console.error("SOP doc editor (edit) error:", err);
    res.redirect("/admin/sops/beheer?error=bewerken");
  }
});

// GET /admin/sops/:id - SOP detail (reader)
router.get("/sops/:id", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const { data: sop, error } = await supabaseAdmin
      .from('sops')
      .select('*, sop_categories(title, slug)')
      .eq('id', id)
      .eq('published', true)
      .single();
    if (error || !sop) return res.status(404).render('errors/404', { user: req.user });
    const { data: questions } = await supabaseAdmin
      .from('sop_quiz_questions')
      .select('id')
      .eq('sop_id', id);
    const hasQuiz = (questions || []).length > 0;
    res.render("admin/sops/detail", {
      title: sop.title,
      activeMenu: "sops",
      activeSubmenu: null,
      user: req.user,
      sop,
      hasQuiz
    });
  } catch (err) {
    console.error("SOP detail error:", err);
    res.status(500).send("Kon handleiding niet laden.");
  }
});

// GET /admin/sops/:id/quiz - Quiz pagina
router.get("/sops/:id/quiz", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const { data: sop, error: sopError } = await supabaseAdmin
      .from('sops')
      .select('id, title')
      .eq('id', id)
      .eq('published', true)
      .single();
    if (sopError || !sop) return res.status(404).render('errors/404', { user: req.user });
    const { data: questions, error: qError } = await supabaseAdmin
      .from('sop_quiz_questions')
      .select('*')
      .eq('sop_id', id)
      .order('sort_order', { ascending: true });
    if (qError) throw qError;
    res.render("admin/sops/quiz", {
      title: `Quiz: ${sop.title}`,
      activeMenu: "sops",
      activeSubmenu: null,
      user: req.user,
      sop,
      questions: questions || []
    });
  } catch (err) {
    console.error("SOP quiz error:", err);
    res.status(500).send("Kon quiz niet laden.");
  }
});

// POST /admin/sops/:id/quiz - Quiz indienen
router.post("/sops/:id/quiz", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const sopId = req.params.id;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Niet ingelogd" });
    let answers = req.body.answers || {};
    if (typeof answers === 'object' && Object.keys(answers).length === 0) {
      answers = {};
      Object.keys(req.body).forEach(k => {
        if (k.startsWith('q_')) answers[k.slice(2)] = req.body[k];
      });
    }
    const { data: questions } = await supabaseAdmin
      .from('sop_quiz_questions')
      .select('id, options')
      .eq('sop_id', sopId)
      .order('sort_order', { ascending: true });
    if (!questions || questions.length === 0) {
      return res.status(400).json({ success: false, error: "Geen vragen" });
    }
    let correct = 0;
    questions.forEach(q => {
      const opt = Array.isArray(q.options) ? q.options : [];
      const correctOpt = opt.find(o => o.correct);
      const userVal = answers[q.id];
      if (correctOpt && (userVal === correctOpt.id || userVal === correctOpt.value)) correct++;
    });
    const scorePercent = Math.round((correct / questions.length) * 100);
    const passed = scorePercent >= 80;
    await supabaseAdmin.from('sop_quiz_attempts').insert({
      sop_id: sopId,
      user_id: userId,
      score_percent: scorePercent,
      passed,
      answers
    });
    await supabaseAdmin.from('sop_progress').upsert({
      sop_id: sopId,
      user_id: userId,
      quiz_passed_at: passed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'sop_id,user_id' });
    res.json({ success: true, score_percent: scorePercent, passed });
  } catch (err) {
    console.error("SOP quiz submit error:", err);
    res.status(500).json({ success: false, error: "Kon quiz niet opslaan." });
  }
});

// API: CRUD categories (admin)
router.get("/api/sops/categories", requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('sop_categories').select('*').order('sort_order');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.post("/api/sops/categories", requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { title, slug, description, icon, image_url, sort_order } = req.body;
    const slugVal = slug || (title || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const { data, error } = await supabaseAdmin.from('sop_categories').insert({ title: title || 'Nieuwe categorie', slug: slugVal, description: description || null, icon: icon || null, image_url: image_url || null, sort_order: sort_order != null ? parseInt(sort_order, 10) : 0 }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.put("/api/sops/categories/:id", requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { title, slug, description, icon, image_url, sort_order } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (slug !== undefined) updates.slug = slug;
    if (description !== undefined) updates.description = description;
    if (icon !== undefined) updates.icon = icon;
    if (image_url !== undefined) updates.image_url = image_url;
    if (sort_order != null) updates.sort_order = parseInt(sort_order, 10);
    const { data, error } = await supabaseAdmin.from('sop_categories').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.delete("/api/sops/categories/:id", requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('sop_categories').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: CRUD sops (admin)
router.get("/api/sops/list", requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('sops').select('*, sop_categories(title)').order('sort_order');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.post("/api/sops", requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { category_id, title, slug, content, excerpt, illustration_url, sort_order, published } = req.body;
    const slugVal = slug || (title || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const { data, error } = await supabaseAdmin.from('sops').insert({
      category_id,
      title: title || 'Nieuwe handleiding',
      slug: slugVal,
      content: content || '',
      excerpt: excerpt || null,
      illustration_url: illustration_url || null,
      sort_order: sort_order != null ? parseInt(sort_order, 10) : 0,
      published: published !== false,
      created_by: req.user?.id || null
    }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.put("/api/sops/:id", requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { category_id, title, slug, content, excerpt, illustration_url, sort_order, published } = req.body;
    const updates = {};
    if (category_id !== undefined) updates.category_id = category_id;
    if (title !== undefined) updates.title = title;
    if (slug !== undefined) updates.slug = slug;
    if (content !== undefined) updates.content = content;
    if (excerpt !== undefined) updates.excerpt = excerpt;
    if (illustration_url !== undefined) updates.illustration_url = illustration_url;
    if (sort_order != null) updates.sort_order = parseInt(sort_order, 10);
    if (published !== undefined) updates.published = published;
    const { data, error } = await supabaseAdmin.from('sops').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.delete("/api/sops/:id", requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('sops').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Quiz questions (admin)
router.get("/api/sops/:sopId/questions", requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('sop_quiz_questions').select('*').eq('sop_id', req.params.sopId).order('sort_order');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.post("/api/sops/:sopId/questions", requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { question_text, type, options, sort_order } = req.body;
    const { data, error } = await supabaseAdmin.from('sop_quiz_questions').insert({
      sop_id: req.params.sopId,
      question_text: question_text || '',
      type: type || 'multiple_choice',
      options: options || [],
      sort_order: sort_order != null ? parseInt(sort_order, 10) : 0
    }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.put("/api/sops/questions/:id", requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { question_text, type, options, sort_order } = req.body;
    const { data, error } = await supabaseAdmin.from('sop_quiz_questions').update({ question_text, type, options, sort_order }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.delete("/api/sops/questions/:id", requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('sop_quiz_questions').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Billing Settings API
router.get("/api/billing-settings", requireAuth, isAdmin, async (req, res) => {
  try {
    const { data: settings, error } = await supabaseAdmin
      .from('billing_settings')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({
      success: true,
      data: settings || {
        billing_date: '2025-01-31',
        billing_time: '09:00:00',
        timezone: 'Europe/Amsterdam',
        is_active: true
      }
    });
  } catch (error) {
    console.error('Error fetching billing settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch billing settings'
    });
  }
});

// Company Settings API
router.get("/api/company-settings", requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { data: settings, error } = await supabaseAdmin
      .from('company_settings')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({
      success: true,
      data: settings || {
        company_name: 'GrowSocial',
        address: 'Monseigneur Bekkersplein 2',
        postal_code: '5076 AV',
        city: 'Haaren Noord-Brabant',
        country: 'Netherlands',
        phone: '0132340434',
        email: 'info@growsocialmedia.nl',
        website: 'growsocialmedia.nl',
        kvk_number: '76478793',
        vat_number: 'NL860638285B01',
        iban: 'NL42RABO0357384644',
        logo_url: null
      }
    });
  } catch (error) {
    console.error('Error fetching company settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch company settings'
    });
  }
});

router.post("/api/company-settings", requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { 
      companyName,
      email,
      phone,
      website,
      address,
      postalCode,
      city,
      country,
      kvkNumber,
      vatNumber,
      iban,
      logoUrl
    } = req.body;

    // Validate required fields
    if (!companyName || !email) {
      return res.status(400).json({
        success: false,
        error: 'Bedrijfsnaam en e-mailadres zijn verplicht'
      });
    }

    // Fetch existing settings to preserve fields that aren't being updated
    const { data: existingSettings } = await supabaseAdmin
      .from('company_settings')
      .select('*')
      .eq('id', 1)
      .single();

    // Build update object, only including fields that are provided
    const updateData = {
      id: 1,
      company_name: companyName,
      email: email,
      updated_at: new Date().toISOString()
    };

    // Only update fields that are explicitly provided (not undefined)
    if (phone !== undefined) updateData.phone = phone || null;
    if (website !== undefined) updateData.website = website || null;
    if (address !== undefined) updateData.address = address || null;
    if (postalCode !== undefined) updateData.postal_code = postalCode || null;
    if (city !== undefined) updateData.city = city || null;
    if (country !== undefined) updateData.country = country || 'Netherlands';
    if (kvkNumber !== undefined) updateData.kvk_number = kvkNumber || null;
    if (vatNumber !== undefined) updateData.vat_number = vatNumber || null;
    if (iban !== undefined) updateData.iban = iban || null;
    if (logoUrl !== undefined) updateData.logo_url = logoUrl || null;

    // If existing settings exist, preserve fields that aren't being updated
    if (existingSettings) {
      if (phone === undefined) updateData.phone = existingSettings.phone;
      if (website === undefined) updateData.website = existingSettings.website;
      if (address === undefined) updateData.address = existingSettings.address;
      if (postalCode === undefined) updateData.postal_code = existingSettings.postal_code;
      if (city === undefined) updateData.city = existingSettings.city;
      if (country === undefined) updateData.country = existingSettings.country || 'Netherlands';
      if (kvkNumber === undefined) updateData.kvk_number = existingSettings.kvk_number;
      if (vatNumber === undefined) updateData.vat_number = existingSettings.vat_number;
      if (iban === undefined) updateData.iban = existingSettings.iban;
      if (logoUrl === undefined) updateData.logo_url = existingSettings.logo_url;
    }

    // Update or insert company settings
    const { data, error } = await supabaseAdmin
      .from('company_settings')
      .upsert(updateData, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Bedrijfsinstellingen succesvol opgeslagen',
      data: data
    });
  } catch (error) {
    console.error('Error saving company settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save company settings',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.post("/api/billing-settings", requireAuth, isAdmin, async (req, res) => {
  try {
    const { billing_date, billing_time, timezone, is_active } = req.body;
    const adminId = req.user.id;

    // Validate input
    if (!billing_date || !billing_time || !timezone) {
      return res.status(400).json({
        success: false,
        error: 'Billing date, time, and timezone are required'
      });
    }

    // Get current settings for logging
    const { data: currentSettings } = await supabaseAdmin
      .from('billing_settings')
      .select('*')
      .single();

    // Update or insert billing settings
    const { data, error } = await supabaseAdmin
      .from('billing_settings')
      .upsert({
        id: 1,
        billing_date,
        billing_time,
        timezone,
        is_active: is_active !== false,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Log the change with detailed information
    const SystemLogService = require('../services/systemLogService');
    const BillingCronJob = require('../services/billingCronJob');
    
    // Determine what changed
    const changes = {
      billing_date: currentSettings?.billing_date !== billing_date,
      billing_time: currentSettings?.billing_time !== billing_time,
      timezone: currentSettings?.timezone !== timezone,
      is_active: currentSettings?.is_active !== (is_active !== false)
    };

    const changeDescription = Object.entries(changes)
      .filter(([_, changed]) => changed)
      .map(([key, _]) => {
        switch(key) {
          case 'billing_date': return `Incasso datum: ${currentSettings?.billing_date || 'niet ingesteld'} → ${billing_date}`;
          case 'billing_time': return `Incasso tijd: ${currentSettings?.billing_time || 'niet ingesteld'} → ${billing_time}`;
          case 'timezone': return `Tijdzone: ${currentSettings?.timezone || 'niet ingesteld'} → ${timezone}`;
          case 'is_active': return `Actief: ${currentSettings?.is_active || false} → ${is_active !== false}`;
          default: return `${key} gewijzigd`;
        }
      })
      .join(', ');

    await SystemLogService.logBilling(
      'info',
      'Betalingsinstellingen Gewijzigd',
      `Admin heeft betalingsinstellingen gewijzigd: ${changeDescription}`,
      `Admin ID: ${adminId}, Wijzigingen: ${changeDescription}`,
      null,
      adminId,
      {
        old_settings: currentSettings,
        new_settings: data,
        changes: changes,
        change_description: changeDescription,
        admin_id: adminId
      }
    );

    // Restart cron job if settings changed
    if (Object.values(changes).some(changed => changed)) {
      try {
        const billingCron = new BillingCronJob();
        await billingCron.stop(); // Stop existing job
        await billingCron.start(); // Start with new settings
        
        await SystemLogService.logBilling(
          'info',
          'Cron Job Herstart',
          'Automatische incasso cron job herstart met nieuwe instellingen',
          `Nieuwe cron expressie voor ${billing_date} ${billing_time}`,
          null,
          adminId,
          {
            cron_restarted: true,
            new_date: billing_date,
            new_time: billing_time,
            new_timezone: timezone,
            admin_id: adminId
          }
        );
      } catch (cronError) {
        await SystemLogService.logBilling(
          'error',
          'Cron Job Herstart Gefaald',
          'Kon automatische incasso cron job niet herstarten',
          `Fout: ${cronError.message}`,
          null,
          adminId,
          {
            cron_error: cronError.message,
            admin_id: adminId
          }
        );
      }
    }

    res.json({
      success: true,
      data,
      message: 'Billing settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating billing settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update billing settings'
    });
  }
});

// System Logs API
router.get("/api/system-logs", requireAuth, isAdmin, async (req, res) => {
  try {
    const SystemLogService = require('../services/systemLogService');
    const {
      limit = 50,
      offset = 0,
      type,
      category,
      severity,
      userId,
      startDate,
      endDate
    } = req.query;

    const logs = await SystemLogService.getLogs({
      limit: parseInt(limit),
      offset: parseInt(offset),
      type,
      category,
      severity,
      userId,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null
    });

    res.json({
      success: true,
      ...logs
    });
  } catch (error) {
    console.error('Error fetching system logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system logs'
    });
  }
});

// ===== NIEUWE API ROUTES VOOR GEBRUIKERSBEHEER =====

// Bulk actions API endpoints
router.post("/api/profiles/bulk/status", requireAuth, isAdmin, async (req, res) => {
  try {
    const { status, ids } = req.body

    if (!status || !ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Status en gebruiker IDs zijn verplicht" })
    }

    // Valideer status
    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ error: "Ongeldige status" })
    }

    // Update alle gebruikers
    const result = await userRepository.updateMultipleUserStatus(ids, status)

    res.json({
      success: true,
      message: `${ids.length} gebruiker(s) succesvol ${status === "active" ? "geactiveerd" : "gedeactiveerd"}`,
      changes: result.changes,
    })
  } catch (err) {
    console.error("Fout bij bulk status update:", err.stack)
    res.status(500).json({ error: "Er is een fout opgetreden bij het bijwerken van de status" })
  }
})

router.post("/api/profiles/bulk/delete", requireAuth, isAdmin, async (req, res) => {
  try {
    const { ids } = req.body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Gebruiker IDs zijn verplicht" })
    }

    // Verwijder alle gebruikers
    const result = await userRepository.deleteMultipleUsers(ids)

    res.json({
      success: true,
      message: `${ids.length} gebruiker(s) succesvol verwijderd`,
      changes: result.changes,
    })
  } catch (err) {
    console.error("Fout bij bulk delete:", err.stack)
    res.status(500).json({ error: "Er is een fout opgetreden bij het verwijderen van de gebruikers" })
  }
})

// Individual user API endpoints
router.get("/api/profiles/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const userId = req.params.id
    const user = await userRepository.getUserById(userId)

    if (!user) {
      return res.status(404).json({ error: "Gebruiker niet gevonden" })
    }

    res.json(user)
  } catch (err) {
    console.error("Fout bij ophalen gebruiker:", err.stack)
    res.status(500).json({ error: "Er is een fout opgetreden" })
  }
})

router.delete("/api/profiles/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const userId = req.params.id
    const result = await userRepository.deleteUser(userId)

    res.json(result)
  } catch (err) {
    console.error("Error deleting user:", err.stack)
    res.status(500).json({ error: "Er is een fout opgetreden bij het verwijderen" })
  }
})

// API route om een gebruiker op te halen
// router.get("/api/profiles/:id", async (req, res) => {
//   try {
//     const userId = req.params.id

//     // Zorg ervoor dat req.user is ingesteld
//     await ensureUser(req)

//     // Haal gebruiker op
//     const user = await userRepository.getUserById(userId)

//     if (!user) {
//       return res.status(404).json({ success: false, message: "Gebruiker niet gevonden" })
//     }

//     res.json({ success: true, user })
//   } catch (error) {
//     console.error("Fout bij ophalen gebruiker:", error)
//     res.status(500).json({ success: false, message: "Er is een fout opgetreden" })
//   }
// })

// API route om een nieuwe gebruiker aan te maken
router.post("/api/profiles", async (req, res) => {
  try {
    // Zorg ervoor dat req.user is ingesteld
    await ensureUser(req)

    const userData = req.body
    const result = await userRepository.createUser(userData)
    res.json(result)
  } catch (error) {
    console.error("Fout bij aanmaken gebruiker:", error)
    res.status(500).json({ success: false, message: "Er is een fout opgetreden" })
  }
})

// API route om een gebruiker bij te werken
router.post("/api/profiles/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const userData = {
      email: req.body.email,
      company_name: req.body.company_name,
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      phone: req.body.phone,
      is_admin: req.body.is_admin,
      status: req.body.status
    };

    const result = await userRepository.updateUser(userId, userData);
    res.json({
      success: true,
      message: "Gebruiker succesvol bijgewerkt",
      data: result
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Er is een fout opgetreden bij het bijwerken van de gebruiker'
    });
  }
})

// API route om een gebruiker te verwijderen
// router.delete("/api/profiles/:id", async (req, res) => {
//   try {
//     // Zorg ervoor dat req.user is ingesteld
//     await ensureUser(req)

//     const userId = req.params.id

//     const result = await userRepository.deleteUser(userId)
//     res.json(result)
//   } catch (error) {
//     console.error("Fout bij verwijderen gebruiker:", error)
//     res.status(500).json({ success: false, message: "Er is een fout opgetreden" })
//   }
// })

// API route om gebruikersstatus bij te werken
router.post("/api/profiles/:id/status", async (req, res) => {
  try {
    const userId = req.params.id;
    const { status } = req.body;

    if (!userId || !status) {
      return res.status(400).json({
        success: false,
        message: "Gebruikers-ID en status zijn vereist"
      });
    }

    const user = await userRepository.getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Gebruiker niet gevonden"
      });
    }

    user.status = status;
    await userRepository.updateUserStatus(userId, status);

    const statusMessage = status === "active" ? "geactiveerd" : "gedeactiveerd";
    res.json({
      success: true,
      message: `Gebruiker succesvol ${statusMessage}!`
    });
  } catch (error) {
    console.error("Error updating user status:", error);
    res.status(500).json({
      success: false,
      message: "Er is een fout opgetreden bij het bijwerken van de gebruikersstatus"
    });
  }
});

// API route om gebruikersrol bij te werken
router.post("/api/profiles/:id/role", async (req, res) => {
  try {
    const userId = req.params.id;
    const { is_admin } = req.body;

    if (typeof is_admin !== 'boolean') {
      throw new Error('Admin status moet een boolean zijn');
    }

    const result = await userRepository.updateUserRole(userId, is_admin);
    res.json({
      success: true,
      message: "Gebruikersrol succesvol bijgewerkt",
      data: result
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Er is een fout opgetreden bij het bijwerken van de gebruikersrol'
    });
  }
});

// API route voor bulk status update
// router.post("/api/profiles/bulk/status", async (req, res) => {
//   try {
//     // Zorg ervoor dat req.user is ingesteld
//     await ensureUser(req)

//     const { status, ids } = req.body

//     if (!ids || !Array.isArray(ids) || ids.length === 0) {
//       return res.status(400).json({ success: false, message: "Geen geldige gebruikers-IDs opgegeven" })
//     }

//     // Begin een transactie
//     await db.runAsync("BEGIN TRANSACTION")

//     // Update status voor elke gebruiker
//     for (const userId of ids) {
//       await db.runAsync("UPDATE profiles SET status = ? WHERE id = ?", [status, userId])
//     }

//     // Commit de transactie
//     await db.runAsync("COMMIT")

//     res.json({
//       success: true,
//       message: `Status van ${ids.length} gebruiker(s) bijgewerkt naar "${status}"`,
//     })
//   } catch (error) {
//     // Rollback bij een fout
//     await db.runAsync("ROLLBACK")
//     console.error("Fout bij bulk status update:", error)
//     res.status(500).json({ success: false, message: "Er is een fout opgetreden" })
//   }
// })

// API route voor bulk delete
// router.post("/api/profiles/bulk/delete", async (req, res) => {
//   try {
//     // Zorg ervoor dat req.user is ingesteld
//     await ensureUser(req)

//     const { ids } = req.body

//     if (!ids || !Array.isArray(ids) || ids.length === 0) {
//       return res.status(400).json({ success: false, message: "Geen geldige gebruikers-IDs opgegeven" })
//     }

//     // Begin een transactie
//     await db.runAsync("BEGIN TRANSACTION")

//     // Verwijder gebruikers
//     for (const userId of ids) {
//       await db.runAsync("DELETE FROM profiles WHERE id = ?", [userId])
//     }

//     // Commit de transactie
//     await db.runAsync("COMMIT")

//     res.json({
//       success: true,
//       message: `${ids.length} gebruiker(s) verwijderd`,
//     })
//   } catch (error) {
//     // Rollback bij een fout
//     await db.runAsync("ROLLBACK")
//     console.error("Fout bij bulk delete:", error)
//     res.status(500).json({ success: false, message: "Er is een fout opgetreden" })
//   }
// })

// API route voor wachtwoord reset
router.post("/api/profiles/:id/reset-password", async (req, res) => {
  try {
    // Zorg ervoor dat req.user is ingesteld
    await ensureUser(req)

    const userId = req.params.id

    // Hier zou je normaal gesproken een wachtwoord reset token genereren
    // en een e-mail sturen naar de gebruiker

    // Voor nu simuleren we dit proces
    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)

    await supabase
      .from('profiles')
      .update({
        reset_token: resetToken,
        reset_token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .eq('id', userId)

    res.json({
      success: true,
      message: "Wachtwoord reset link verstuurd naar de gebruiker",
    })
  } catch (error) {
    console.error("Fout bij wachtwoord reset:", error)
    res.status(500).json({ success: false, message: "Er is een fout opgetreden" })
  }
})

// Admin users API endpoints (voor JavaScript compatibiliteit)
router.get("/api/users/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (error) throw error

    res.json({ user: profile })
  } catch (err) {
    console.error("Error fetching user:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het ophalen van de gebruiker" })
  }
})

router.post("/api/users/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const userId = req.params.id
    const { company_name, first_name, last_name, email, phone, is_admin, status, can_read_company_mailboxes } = req.body

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({
        company_name,
        first_name,
        last_name,
        email,
        phone,
        is_admin: is_admin === 1 || is_admin === true,
        status: status || 'active',
        can_read_company_mailboxes: can_read_company_mailboxes === true || can_read_company_mailboxes === 'true',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error

    res.json({
      success: true,
      message: "Gebruiker succesvol bijgewerkt",
      data: profile
    })
  } catch (err) {
    console.error("Error updating user:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het bijwerken van de gebruiker" })
  }
})

// Duplicate route removed - using the first /api/users/:id/status route above

router.post("/api/users/:id/role", requireAuth, isAdmin, async (req, res) => {
  try {
    const userId = req.params.id
    const { is_admin } = req.body

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({
        is_admin: is_admin === 1 || is_admin === true,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error

    res.json({
      success: true,
      message: `Gebruiker succesvol ${is_admin ? 'gepromoveerd naar admin' : 'gedegradeerd naar gebruiker'}`,
      data: profile
    })
  } catch (err) {
    console.error("Error updating user role:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het bijwerken van de rol" })
  }
})

router.post("/api/users/:id/reset-password", requireAuth, isAdmin, async (req, res) => {
  try {
    const userId = req.params.id

    // Get user email from profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single()

    if (profileError) throw profileError

    // Send password reset email using Supabase Auth
    const { error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: profile.email
    })

    if (error) throw error

    res.json({
      success: true,
      message: "Wachtwoord reset link verstuurd naar gebruiker"
    })
  } catch (err) {
    console.error("Error resetting password:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het resetten van het wachtwoord" })
  }
})

// Duplicate bulk status route removed - using the first /api/users/bulk/status route above


// ✅ API endpoint for billing data
router.get('/api/billing/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log('Getting billing data for user:', userId);

    // Try to get billing snapshot using the database function
    try {
      const { data: snapshot, error: snapshotError } = await supabaseAdmin
        .rpc('get_billing_snapshot', { p_user: userId });

      if (snapshotError) {
        console.error('Error getting billing snapshot:', snapshotError);
        throw snapshotError;
      }

      if (snapshot && snapshot.length > 0) {
        const billingData = snapshot[0];
        console.log('Billing snapshot data:', billingData);
        
        return res.json({
          success: true,
          data: {
            period_month: billingData.period_month,
            approved_count: billingData.approved_count || 0,
            monthly_quota: billingData.monthly_quota || 0,
            approved_amount: billingData.approved_amount || 0,
            balance: billingData.balance || 0,
            payment_method: billingData.payment_method || 'unknown'
          }
        });
      }
    } catch (rpcError) {
      console.log('RPC failed, trying manual data collection:', rpcError.message);
    }

    // Fallback: Manual data collection
    console.log('Using manual billing data collection...');

    // Get user's subscription
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('leads_per_month, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (subError && subError.code !== 'PGRST116') {
      console.error('Error getting subscription:', subError);
      throw subError;
    }

    // Get approved leads count for current month from lead_usage table
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7) + '-01';
    const { data: usage, error: usageError } = await supabaseAdmin
      .from('lead_usage')
      .select('leads_count, total_amount')
      .eq('user_id', userId)
      .eq('period_month', currentMonth)
      .single();

    if (usageError && usageError.code !== 'PGRST116') {
      console.error('Error getting lead usage:', usageError);
      throw usageError;
    }

    // Get user balance
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('balance')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error getting profile:', profileError);
      throw profileError;
    }

    // Calculate totals from usage data
    const approvedCount = usage ? usage.leads_count : 0;
    const approvedAmount = usage ? usage.total_amount : 0;
    const monthlyQuota = subscription ? subscription.leads_per_month : 0;
    const balance = profile ? profile.balance : 0;

    const billingData = {
      period_month: currentMonth,
      approved_count: approvedCount,
      monthly_quota: monthlyQuota,
      approved_amount: approvedAmount,
      balance: balance,
      payment_method: 'sepa' // Default, could be fetched from subscription
    };

    console.log('Manual billing data created:', billingData);

    res.json({
      success: true,
      data: billingData
    });

  } catch (error) {
    console.error('Error in billing API:', error);
    res.status(500).json({ 
      error: 'Failed to get billing data',
      details: error.message 
    });
  }
});

// KPI Data endpoint for admin dashboard with date range support
router.get("/api/admin/kpi-data", requireAuth, isAdmin, async (req, res) => {
  try {
    // Get date range from query params (default to '30d' for last 30 days)
    const dateRange = req.query.range || '30d';
    console.log('[KPI] Fetching KPI data for range:', dateRange);
    
    // Calculate date ranges based on the selected period
    const now = new Date();
    let currentStart, currentEnd, previousStart, previousEnd;
    
    switch (dateRange) {
      case '7d':
        // Last 7 days vs previous 7 days
        currentEnd = now;
        currentStart = new Date(now);
        currentStart.setDate(currentStart.getDate() - 7);
        
        previousEnd = new Date(currentStart);
        previousStart = new Date(currentStart);
        previousStart.setDate(previousStart.getDate() - 7);
        break;
        
      case '30d':
        // Last 30 days vs previous 30 days
        currentEnd = now;
        currentStart = new Date(now);
        currentStart.setDate(currentStart.getDate() - 30);
        
        previousEnd = new Date(currentStart);
        previousStart = new Date(currentStart);
        previousStart.setDate(previousStart.getDate() - 30);
        break;
        
      case '90d':
        // Last 90 days vs previous 90 days
        currentEnd = now;
        currentStart = new Date(now);
        currentStart.setDate(currentStart.getDate() - 90);
        
        previousEnd = new Date(currentStart);
        previousStart = new Date(currentStart);
        previousStart.setDate(previousStart.getDate() - 90);
        break;
        
      case '1y':
        // Last year vs previous year
        currentEnd = now;
        currentStart = new Date(now);
        currentStart.setFullYear(currentStart.getFullYear() - 1);
        
        previousEnd = new Date(currentStart);
        previousStart = new Date(currentStart);
        previousStart.setFullYear(previousStart.getFullYear() - 1);
        break;
        
      default:
        // Default to 30 days
        currentEnd = now;
        currentStart = new Date(now);
        currentStart.setDate(currentStart.getDate() - 30);
        
        previousEnd = new Date(currentStart);
        previousStart = new Date(currentStart);
        previousStart.setDate(previousStart.getDate() - 30);
    }
    
    console.log('[KPI] Date ranges:', {
      current: { start: currentStart, end: currentEnd },
      previous: { start: previousStart, end: previousEnd }
    });
    
    // Fetch comparison data from the function
    console.log('[KPI] Calling get_admin_revenue_comparison with params:', {
      current_start: currentStart.toISOString(),
      current_end: currentEnd.toISOString(),
      previous_start: previousStart.toISOString(),
      previous_end: previousEnd.toISOString()
    });
    
    const { data: comparison, error: comparisonError } = await supabaseAdmin
      .rpc('get_admin_revenue_comparison', {
        current_start: currentStart.toISOString(),
        current_end: currentEnd.toISOString(),
        previous_start: previousStart.toISOString(),
        previous_end: previousEnd.toISOString()
      })
      .single();
    
    if (comparisonError) {
      console.error('[KPI] Comparison error:', comparisonError);
      throw new Error(`Failed to fetch comparison: ${comparisonError.message}`);
    }
    
    console.log('[KPI] Comparison data received:', comparison);
    
    // Fetch active account holders count (not date-dependent)
    const { data: accountHolders, error: accountError } = await supabaseAdmin
      .from('admin_active_account_holders')
      .select('count')
      .single();
    
    if (accountError) {
      console.error('[KPI] Account holders error:', accountError);
      throw new Error(`Failed to fetch account holders: ${accountError.message}`);
    }
    
    console.log('[KPI] Account holders received:', accountHolders);
    
    // Calculate percentage changes
    const calculatePercentageChange = (current, previous) => {
      if (previous === 0) {
        return current > 0 ? 100 : 0;
      }
      return ((current - previous) / previous) * 100;
    };
    
    const revenueChange = calculatePercentageChange(
      parseFloat(comparison.current_revenue),
      parseFloat(comparison.previous_revenue)
    );
    
    const paymentsChange = calculatePercentageChange(
      comparison.current_payments,
      comparison.previous_payments
    );
    
    // Success rate is already a percentage, so we calculate absolute change
    const successRateChange = parseFloat(comparison.current_success_rate) - parseFloat(comparison.previous_success_rate);
    
    const failedChange = calculatePercentageChange(
      comparison.current_failed,
      comparison.previous_failed
    );
    
    console.log('[KPI] Calculated changes:', {
      revenueChange,
      paymentsChange,
      successRateChange,
      failedChange
    });
    
    // Calculate pending payments change
    const pendingChange = calculatePercentageChange(
      comparison.current_pending,
      comparison.previous_pending
    );
    
    console.log('[KPI] Calculated pending change:', pendingChange);
    
    // Build final KPI data object with comparison
    const kpiData = {
      totalRevenue: Math.round(parseFloat(comparison.current_revenue) * 100), // Convert to cents
      successRate: parseFloat(comparison.current_success_rate),
      activeAccountHolders: accountHolders.count || 0,
      failedPayments: comparison.current_pending || 0, // Show pending payments instead of failed
      comparison: {
        revenueChange,
        paymentsChange,
        successRateChange,
        failedChange: pendingChange // Use pending change instead of failed change
      }
    };
    
    console.log('[KPI] Built KPI data object:', kpiData);
    
    console.log('[KPI] Final KPI data:', kpiData);
    
    res.json(kpiData);
    
  } catch (error) {
    console.error('[KPI] KPI fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch KPI data',
      message: error.message 
    });
  }
});

// GET /api/admin/revenue - Revenue chart data
router.get('/api/admin/revenue', async (req, res) => {
  try {
    const { period, year } = req.query;
    const yearParam = parseInt(year) || new Date().getFullYear();
    
    console.log('[Revenue Chart] Fetching data for period:', period, 'year:', yearParam);
    
    // Fetch real data from database
    const { data: chartData, error } = await supabaseAdmin
      .rpc('get_revenue_chart_data', {
        period_type: period || 'dag',
        year_param: yearParam
      });
    
    if (error) {
      console.error('[Revenue Chart] Database error:', error);
      throw new Error(`Failed to fetch revenue data: ${error.message}`);
    }
    
    console.log('[Revenue Chart] Raw data received:', chartData);
    
    // Check if we have data
    if (!chartData || chartData.length === 0) {
      console.log('[Revenue Chart] No data found, returning empty chart');
      return res.json({
        labels: [],
        values: []
      });
    }
    
    // Transform data for chart
    const labels = chartData.map(item => item.label);
    const values = chartData.map(item => parseFloat(item.revenue) || 0);
    
    const data = {
      labels,
      values
    };
    
    console.log('[Revenue Chart] Processed data:', data);
    
    res.json(data);
    
  } catch (error) {
    console.error('[Revenue Chart] Error fetching revenue data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/monthly-growth - Monthly growth data
router.get('/api/admin/monthly-growth', async (req, res) => {
  try {
    console.log('[Monthly Growth] Fetching growth data...');
    
    // Fetch real data from database
    const { data: growthData, error } = await supabaseAdmin
      .rpc('get_monthly_growth_data');
    
    if (error) {
      console.error('[Monthly Growth] Database error:', error);
      throw new Error(`Failed to fetch growth data: ${error.message}`);
    }
    
    console.log('[Monthly Growth] Raw data received:', growthData);
    
    if (!growthData || growthData.length === 0) {
      throw new Error('No growth data available');
    }
    
    const data = growthData[0];
    
    // Calculate percentage changes
    const calculatePercentageChange = (current, previous) => {
      if (previous === 0) {
        return current > 0 ? 100 : 0;
      }
      return ((current - previous) / previous) * 100;
    };
    
    const revenueChange = calculatePercentageChange(
      parseFloat(data.current_revenue),
      parseFloat(data.previous_revenue)
    );
    
    const paymentsChange = calculatePercentageChange(
      parseInt(data.current_payments),
      parseInt(data.previous_payments)
    );
    
    const response = {
      revenue: {
        current: Math.round(parseFloat(data.current_revenue) * 100), // Convert to cents
        previous: Math.round(parseFloat(data.previous_revenue) * 100), // Convert to cents
        change: revenueChange
      },
      payments: {
        current: parseInt(data.current_payments),
        previous: parseInt(data.previous_payments),
        change: paymentsChange
      }
    };
    
    console.log('[Monthly Growth] Processed data:', response);
    
    res.json(response);
    
  } catch (error) {
    console.error('[Monthly Growth] Error fetching growth data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// PAYMENTS TABLE API
// ============================================
router.get('/api/admin/payments', async (req, res) => {
  try {
    console.log('[Payments Table] Fetching payments data...');
    
    // Fetch payments with related user data
    const { data: payments, error } = await supabaseAdmin
      .from('payments')
      .select(`
        id,
        amount,
        status,
        payment_method,
        created_at,
        updated_at,
        user_id,
        profiles!inner(
          id,
          email,
          first_name,
          last_name,
          company_name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error('[Payments Table] Database error:', error);
      throw new Error(`Failed to fetch payments: ${error.message}`);
    }
    
    console.log('[Payments Table] Raw payments data:', payments?.length || 0, 'records');
    
    // Transform data to match frontend expectations
    const transformedPayments = (payments || []).map(payment => {
      const grossAmount = parseFloat(payment.amount) || 0;
      const profile = payment.profiles;
      
      // Get customer name from profile
      let customerName = 'Onbekende klant';
      if (profile) {
        if (profile.company_name) {
          customerName = profile.company_name;
        } else if (profile.first_name || profile.last_name) {
          customerName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
        } else if (profile.email) {
          customerName = profile.email;
        }
      }
      
      // Extract lead information from payment_details if available
      let leadTitle = 'Lead verwerking';
      let leadId = `lead_${payment.id.substring(0, 8)}`;
      
      if (payment.payment_details) {
        try {
          const details = typeof payment.payment_details === 'string' 
            ? JSON.parse(payment.payment_details) 
            : payment.payment_details;
          
          if (details.description) {
            leadTitle = details.description;
          }
          if (details.leads_count) {
            leadTitle = `${details.leads_count} geaccepteerde lead${details.leads_count > 1 ? 's' : ''}`;
          }
        } catch (e) {
          console.log('[Payments Table] Could not parse payment_details:', e.message);
        }
      }
      
      return {
        payment_id: payment.id,
        created_at: payment.created_at,
        amount_gross: Math.round(grossAmount * 100), // Convert to cents
        status: payment.status,
        lead_id: leadId,
        lead_title: leadTitle,
        customer_id: profile?.id || `cust_${Math.random().toString(36).substr(2, 6)}`,
        customer_name: customerName
      };
    });
    
    console.log('[Payments Table] Transformed payments:', transformedPayments.length, 'records');
    
    res.json({ payments: transformedPayments });
    
  } catch (error) {
    console.error('[Payments Table] Error fetching payments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// New submenu routes

// Users submenu routes
router.get("/users/subscriptions", requireAuth, isAdmin, async (req, res) => {
  res.render("admin/users/subscriptions", {
    title: "Abonnementen",
    activeMenu: "users",
    activeSubmenu: "subscriptions",
    user: req.user
  })
})

router.get("/users/roles", requireAuth, isAdmin, async (req, res) => {
  res.render("admin/users/roles", {
    title: "Rollen & Rechten",
    activeMenu: "users",
    activeSubmenu: "roles",
    user: req.user
  })
})

// Leads submenu routes
router.get("/leads/industries", requireAuth, isManagerOrAdmin, async (req, res) => {
  res.render("admin/leads/industries", {
    title: "Branches",
    activeMenu: "leads",
    activeSubmenu: "industries",
    user: req.user
  })
})

router.get("/leads/activities", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  res.render("admin/leads/activities", {
    title: "Activiteiten",
    activeMenu: "leads",
    activeSubmenu: "activities",
    user: req.user
  })
})

// Sub-routes for tabs (for better performance) - MUST come before /leads/engine
router.get("/leads/engine/overview", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  res.render("admin/leads/engine", {
    title: "Leadstroom - Overzicht",
    activeMenu: "leadstroom",
    user: req.user,
    bodyPartial: "admin/leads/engine-content",
    activeTab: "overview"
  })
})

router.get("/leads/engine/segments", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  res.render("admin/leads/engine", {
    title: "Leadstroom - Segmenten",
    activeMenu: "leadstroom",
    user: req.user,
    bodyPartial: "admin/leads/engine-content",
    activeTab: "segments"
  })
})

router.get("/leads/engine/ai-actions", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  res.render("admin/leads/engine", {
    title: "Leadstroom - AI Acties",
    activeMenu: "leadstroom",
    user: req.user,
    bodyPartial: "admin/leads/engine-content",
    activeTab: "ai-actions"
  })
})

router.get("/leads/engine/content", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  res.render("admin/leads/engine", {
    title: "Leadstroom - Content",
    activeMenu: "leadstroom",
    user: req.user,
    bodyPartial: "admin/leads/engine-content",
    activeTab: "content"
  })
})

router.get("/leads/engine/campagnes", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  res.render("admin/leads/engine", {
    title: "Leadstroom - Campagnes",
    activeMenu: "leadstroom",
    user: req.user,
    bodyPartial: "admin/leads/engine-content",
    activeTab: "campagnes"
  })
})

router.get("/leads/engine", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  res.render("admin/leads/engine", {
    title: "Leadstroom",
    activeMenu: "leadstroom",
    user: req.user,
    bodyPartial: "admin/leads/engine-content",
    activeTab: "overview"
  })
})

// =====================================================
// FORM BUILDER ROUTES (Phase 3)
// =====================================================

// GET /admin/settings/industries/:industryId/form
// Form builder page for a specific industry
router.get("/settings/industries/:industryId/form", requireAuth, isAdmin, async (req, res) => {
  try {
    const industryId = parseInt(req.params.industryId);
    
    if (isNaN(industryId)) {
      return res.status(400).render('errors/404', {
        message: 'Ongeldig branche ID'
      });
    }

    // Fetch industry
    const { data: industry, error: industryError } = await supabaseAdmin
      .from('industries')
      .select('*')
      .eq('id', industryId)
      .eq('is_active', true)
      .single();

    if (industryError || !industry) {
      return res.status(404).render('errors/404', {
        message: 'Branche niet gevonden'
      });
    }

    // Fetch existing active template
    const { data: existingTemplate, error: templateError } = await supabaseAdmin
      .from('lead_form_templates')
      .select('*')
      .eq('industry_id', industryId)
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    // Skeleton steps (MANDATORY - Trustoo-style)
    const skeletonSteps = [
      {
        id: "step-2",
        title: "Locatie / Adresgegevens",
        description: null,
        order: 1,
        isFixed: true,
        fields: [
          { id: "postcode", type: "text", label: "Postcode", required: false, placeholder: "1234AB", width: "half", helpText: "" },
          { id: "city", type: "text", label: "Plaats", required: false, placeholder: "Amsterdam", width: "half", helpText: "" },
          { id: "province", type: "text", label: "Provincie", required: false, placeholder: "Noord-Holland", width: "full", helpText: "" }
        ]
      },
      {
        id: "step-3",
        title: "Werksoort / Type Opdracht",
        description: null,
        order: 2,
        isFixed: true,
        fields: [
          { id: "job_category", type: "select", label: "Type werk", required: true, placeholder: "", width: "full", helpText: "", options: ["Binnenshuis", "Buitenshuis", "Beide"] },
          { id: "job_type", type: "select", label: "Soort opdracht", required: true, placeholder: "", width: "full", helpText: "", options: ["Nieuwbouw", "Renovatie", "Onderhoud", "Overig"] },
          { id: "description", type: "textarea", label: "Beschrijving van de opdracht", required: false, placeholder: "Beschrijf uw opdracht in detail...", width: "full", helpText: "Optioneel maar aanbevolen" }
        ]
      },
      {
        id: "step-urgency",
        title: "Wanneer wil je starten?",
        description: "Dit helpt ons om beschikbare vakmensen voor je te vinden.",
        order: 998,
        isFixed: true,
        fields: [
          { id: "urgency", type: "select", label: "Wanneer wil je starten?", required: true, placeholder: "", width: "full", helpText: "Dit helpt ons om beschikbare vakmensen voor je te vinden.", options: ["Met spoed / zo snel mogelijk", "Binnen enkele dagen / weken", "Binnen 3 maanden", "Binnen 6 maanden", "In overleg / nader te bepalen"] }
        ]
      },
      {
        id: "step-budget",
        title: "Budget",
        description: "Een indicatie is voldoende. Dit helpt om passende offertes te krijgen.",
        order: 999,
        isFixed: true,
        fields: [
          { id: "budget", type: "select", label: "Wat is je budget voor deze klus?", required: true, placeholder: "", width: "full", helpText: "Een indicatie is voldoende. Dit helpt om passende offertes te krijgen.", options: ["Tot €500", "€500 – €1.500", "€1.500 – €3.000", "€3.000 – €7.500", "Meer dan €7.500", "Ik weet het nog niet precies"] }
        ]
      },
      {
        id: "step-1",
        title: "Hoe kunnen we je bereiken voor de offertes?",
        description: null,
        order: 1000,
        isFixed: true,
        fields: [
          { id: "first_name", type: "text", label: "Voornaam", required: true, placeholder: "Vul uw voornaam in", width: "full", helpText: "" },
          { id: "last_name", type: "text", label: "Achternaam", required: true, placeholder: "Vul uw achternaam in", width: "full", helpText: "" },
          { id: "email", type: "email", label: "E-mailadres", required: true, placeholder: "voorbeeld@email.nl", width: "full", helpText: "" },
          { id: "phone", type: "tel", label: "Telefoonnummer", required: true, placeholder: "06 12345678", width: "full", helpText: "" },
          { id: "contact_preference", type: "select", label: "Voorkeurscontact", required: false, placeholder: "", width: "full", helpText: "", options: ["Telefoon", "E-mail"] }
        ]
      }
    ];

    // Default config with skeleton steps
    const defaultConfig = {
      version: 1,
      industryId: industryId,
      slug: industry.slug || null,
      title: `Aanvraagformulier ${industry.name}`,
      description: null,
      steps: [...skeletonSteps], // Start with only skeleton steps
      settings: {
        primaryColor: "#ea5d0d",
        showProgressBar: true,
        requireContactStep: true,
        submitButtonText: "Verstuur aanvraag",
        successMessage: "Bedankt! We nemen zo snel mogelijk contact met u op."
      }
    };

    // Get form config (from existing template or use default)
    let formConfig = existingTemplate && existingTemplate.config_json 
      ? existingTemplate.config_json 
      : defaultConfig;

    // Ensure skeleton steps exist and are marked as fixed
    formConfig = ensureSkeletonSteps(formConfig, skeletonSteps);

    // Ensure formConfig has required structure
    if (!formConfig.steps || !Array.isArray(formConfig.steps)) {
      formConfig.steps = [...skeletonSteps];
    }
    if (!formConfig.settings) {
      formConfig.settings = defaultConfig.settings;
    }

    // Helper function to ensure skeleton steps exist
    function ensureSkeletonSteps(config, skeleton) {
      const steps = config.steps || [];
      const skeletonIds = ['step-1', 'step-2', 'step-3', 'step-urgency', 'step-budget'];
      
      // Check if skeleton steps exist
      const existingSkeletonIds = steps.filter(s => skeletonIds.includes(s.id)).map(s => s.id);
      
      // Add missing skeleton steps
      skeleton.forEach(skeletonStep => {
        if (!existingSkeletonIds.includes(skeletonStep.id)) {
          steps.push({ ...skeletonStep });
        } else {
          // Ensure existing skeleton step is marked as fixed
          const existingStep = steps.find(s => s.id === skeletonStep.id);
          if (existingStep) {
            existingStep.isFixed = true;
            existingStep.order = skeletonStep.order;
            existingStep.title = skeletonStep.title; // Enforce title
            
            // Ensure required fields exist
            if (skeletonStep.id === 'step-1') {
              ensureRequiredFields(existingStep, ['first_name', 'last_name', 'email', 'phone'], skeletonStep.fields);
            } else if (skeletonStep.id === 'step-2') {
              ensureRequiredFields(existingStep, ['postcode', 'city', 'province'], skeletonStep.fields);
            } else if (skeletonStep.id === 'step-3') {
              ensureRequiredFields(existingStep, ['job_category', 'job_type'], skeletonStep.fields);
            } else if (skeletonStep.id === 'step-urgency') {
              ensureRequiredFields(existingStep, ['urgency'], skeletonStep.fields);
            } else if (skeletonStep.id === 'step-budget') {
              ensureRequiredFields(existingStep, ['budget'], skeletonStep.fields);
            }
          }
        }
      });
      
      // Separate fixed and variable steps
      const fixedSteps = steps.filter(s => s.isFixed).sort((a, b) => a.order - b.order);
      const variableSteps = steps.filter(s => !s.isFixed).sort((a, b) => a.order - b.order);
      
      // Reorder variable steps to start at order 4
      variableSteps.forEach((step, index) => {
        step.order = 4 + index;
      });
      
      // Combine: fixed steps first, then variable steps
      config.steps = [...fixedSteps, ...variableSteps];
      
      return config;
    }

    function ensureRequiredFields(step, requiredFieldIds, defaultFields) {
      requiredFieldIds.forEach(fieldId => {
        const fieldExists = step.fields.some(f => f.id === fieldId);
        if (!fieldExists) {
          const defaultField = defaultFields.find(f => f.id === fieldId);
          if (defaultField) {
            step.fields.push({ ...defaultField });
          }
        } else {
          // Ensure required field properties
          const field = step.fields.find(f => f.id === fieldId);
          const defaultField = defaultFields.find(f => f.id === fieldId);
          if (field && defaultField) {
            // Preserve user edits but ensure required properties
            if (fieldId === 'name' || fieldId === 'email' || fieldId === 'phone') {
              field.required = true;
            }
            if (!field.type) field.type = defaultField.type;
            if (!field.label) field.label = defaultField.label;
          }
        }
      });
    }

    const saved = req.query.saved === '1';
    const error = req.query.error;

    res.render("admin/industries/form-builder", {
      title: `Aanvraagformulier ${industry.name}`,
      activeMenu: "settings",
      activeSubmenu: "branches",
      user: req.user,
      industry: industry,
      existingTemplate: existingTemplate,
      formConfig: formConfig,
      saved: saved,
      error: error,
      showBackButton: true,
      backButtonUrl: '/admin/settings',
      backButtonText: 'Terug naar instellingen'
    });
  } catch (err) {
    console.error("Error loading form builder:", err);
    res.status(500).render('errors/500', {
      message: 'Er is een fout opgetreden bij het laden van de formulier builder'
    });
  }
});

// POST /admin/settings/industries/:industryId/form
// Save form template configuration
router.post("/settings/industries/:industryId/form", requireAuth, isAdmin, async (req, res) => {
  try {
    const industryId = parseInt(req.params.industryId);
    
    if (isNaN(industryId)) {
      return res.status(400).redirect(`/admin/settings/industries/${req.params.industryId}/form?error=invalid_id`);
    }

    // Accept both old format (config_json string) and new format (config object)
    let parsedConfig;
    
    if (req.body.config_json && typeof req.body.config_json === 'string') {
      // Old format: JSON string
      try {
        parsedConfig = JSON.parse(req.body.config_json);
      } catch (parseError) {
        return res.status(400).redirect(`/admin/settings/industries/${industryId}/form?error=invalid_json`);
      }
    } else if (req.body.config && typeof req.body.config === 'object') {
      // New format: already parsed object (from visual builder)
      parsedConfig = req.body.config;
    } else {
      return res.status(400).redirect(`/admin/settings/industries/${industryId}/form?error=missing_config`);
    }

    // Basic validation
    if (!parsedConfig.steps || !Array.isArray(parsedConfig.steps) || parsedConfig.steps.length === 0) {
      return res.status(400).redirect(`/admin/settings/industries/${industryId}/form?error=no_steps`);
    }

    // Validate skeleton steps exist
    const skeletonIds = ['step-1', 'step-2', 'step-3', 'step-urgency', 'step-budget'];
    const existingSkeletonIds = parsedConfig.steps.filter(s => skeletonIds.includes(s.id)).map(s => s.id);
    
    if (!existingSkeletonIds.includes('step-2') || !existingSkeletonIds.includes('step-3') || 
        !existingSkeletonIds.includes('step-urgency') || !existingSkeletonIds.includes('step-budget') || 
        !existingSkeletonIds.includes('step-1')) {
      return res.status(400).redirect(`/admin/settings/industries/${industryId}/form?error=missing_skeleton_steps`);
    }

    // Validate skeleton step structure
    const step1 = parsedConfig.steps.find(s => s.id === 'step-1');
    const step3 = parsedConfig.steps.find(s => s.id === 'step-3');
    
    // Validate required fields in step 1 (contact step - last step)
    if (step1) {
      const step1Fields = step1.fields || [];
      const hasFirstName = step1Fields.some(f => f.id === 'first_name' && f.type === 'text' && f.required === true);
      const hasLastName = step1Fields.some(f => f.id === 'last_name' && f.type === 'text' && f.required === true);
      const hasEmail = step1Fields.some(f => f.id === 'email' && f.type === 'email' && f.required === true);
      const hasPhone = step1Fields.some(f => f.id === 'phone' && f.type === 'tel' && f.required === true);
      
      if (!hasFirstName || !hasLastName || !hasEmail || !hasPhone) {
        return res.status(400).redirect(`/admin/settings/industries/${industryId}/form?error=missing_required_fields`);
      }
    } else {
      return res.status(400).redirect(`/admin/settings/industries/${industryId}/form?error=missing_contact_step`);
    }

    // Validate step 3 required fields (standardized Trustoo-style)
    if (step3) {
      const step3Fields = step3.fields || [];
      const hasJobCategory = step3Fields.some(f => f.id === 'job_category' && f.type === 'select' && f.required === true);
      const hasJobType = step3Fields.some(f => f.id === 'job_type' && (f.type === 'select' || f.type === 'yesno') && f.required === true);
      
      if (!hasJobCategory) {
        return res.status(400).redirect(`/admin/settings/industries/${industryId}/form?error=missing_step3_fields&field=job_category`);
      }
      if (!hasJobType) {
        return res.status(400).redirect(`/admin/settings/industries/${industryId}/form?error=missing_step3_fields&field=job_type`);
      }
    } else {
      return res.status(400).redirect(`/admin/settings/industries/${industryId}/form?error=missing_step3`);
    }

    // Validate urgency step
    const urgencyStep = parsedConfig.steps.find(s => s.id === 'step-urgency');
    if (urgencyStep) {
      const urgencyFields = urgencyStep.fields || [];
      const hasUrgency = urgencyFields.some(f => f.id === 'urgency' && f.type === 'select' && f.required === true);
      if (!hasUrgency) {
        return res.status(400).redirect(`/admin/settings/industries/${industryId}/form?error=missing_urgency_step`);
      }
    } else {
      return res.status(400).redirect(`/admin/settings/industries/${industryId}/form?error=missing_urgency_step`);
    }

    // Validate budget step
    const budgetStep = parsedConfig.steps.find(s => s.id === 'step-budget');
    if (budgetStep) {
      const budgetFields = budgetStep.fields || [];
      const hasBudget = budgetFields.some(f => f.id === 'budget' && f.type === 'select' && f.required === true);
      if (!hasBudget) {
        return res.status(400).redirect(`/admin/settings/industries/${industryId}/form?error=missing_budget_step`);
      }
    } else {
      return res.status(400).redirect(`/admin/settings/industries/${industryId}/form?error=missing_budget_step`);
    }

    // Ensure skeleton steps are marked as fixed
    parsedConfig.steps.forEach(step => {
      if (skeletonIds.includes(step.id)) {
        step.isFixed = true;
        // Enforce skeleton step titles
        if (step.id === 'step-1') step.title = 'Hoe kunnen we je bereiken voor de offertes?';
        if (step.id === 'step-2') step.title = 'Locatie / Adresgegevens';
        if (step.id === 'step-3') step.title = 'Werksoort / Type Opdracht';
        if (step.id === 'step-urgency') step.title = 'Wanneer wil je starten?';
        if (step.id === 'step-budget') step.title = 'Budget';
      }
    });

    // Validate each step
    for (const step of parsedConfig.steps) {
      if (!step.id || !step.title) {
        return res.status(400).redirect(`/admin/settings/industries/${industryId}/form?error=invalid_step`);
      }
      if (!step.fields || !Array.isArray(step.fields)) {
        return res.status(400).redirect(`/admin/settings/industries/${industryId}/form?error=invalid_fields`);
      }
      for (const field of step.fields) {
        if (!field.id || !field.type) {
          return res.status(400).redirect(`/admin/settings/industries/${industryId}/form?error=invalid_field`);
        }
      }
    }

    // Ensure proper ordering: fixed steps first (1-3), then variable steps (4+)
    const fixedSteps = parsedConfig.steps.filter(s => s.isFixed).sort((a, b) => a.order - b.order);
    const variableSteps = parsedConfig.steps.filter(s => !s.isFixed).sort((a, b) => a.order - b.order);
    
    // Reorder variable steps
    variableSteps.forEach((step, index) => {
      step.order = 4 + index;
    });
    
    // Combine in correct order
    parsedConfig.steps = [...fixedSteps, ...variableSteps];

    // Get max version for this industry
    const { data: existingTemplates, error: versionError } = await supabaseAdmin
      .from('lead_form_templates')
      .select('version')
      .eq('industry_id', industryId)
      .order('version', { ascending: false })
      .limit(1);

    const newVersion = existingTemplates && existingTemplates.length > 0
      ? (existingTemplates[0].version || 0) + 1
      : 1;

    // Deactivate all existing templates for this industry
    await supabaseAdmin
      .from('lead_form_templates')
      .update({ is_active: false })
      .eq('industry_id', industryId)
      .eq('is_active', true);

    // Insert new active template
    const { data: newTemplate, error: insertError } = await supabaseAdmin
      .from('lead_form_templates')
      .insert({
        industry_id: industryId,
        config_json: parsedConfig,
        is_active: true,
        version: newVersion,
        created_by: req.user.id
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting form template:", insertError);
      return res.status(500).redirect(`/admin/settings/industries/${industryId}/form?error=save_failed`);
    }

    // Success - redirect with saved flag
    res.redirect(`/admin/settings/industries/${industryId}/form?saved=1`);
  } catch (err) {
    console.error("Error saving form template:", err);
    res.status(500).redirect(`/admin/settings/industries/${req.params.industryId}/form?error=server_error`);
  }
});

// Payments submenu routes
router.get("/payments/invoices", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  res.render("admin/payments/invoices", {
    title: "Facturen",
    activeMenu: "payments",
    activeSubmenu: "invoices",
    user: req.user
  })
})

router.get("/payments/mandates", requireAuth, isManagerOrAdmin, async (req, res) => {
  res.render("admin/payments/mandates", {
    title: "Mandaten",
    activeMenu: "payments",
    activeSubmenu: "mandates",
    user: req.user
  })
})

// Banking (AI Bankier) - manager/admin only
router.use("/api/banking", requireAuth, isManagerOrAdmin, bankingRoutes)

router.get("/payments/banking", requireAuth, requireManagerOrAdminPage, async (req, res) => {
  try {
    res.render("admin/payments/banking", {
      title: "Bankieren",
      activeMenu: "payments",
      activeSubmenu: "banking",
      user: req.user,
      stylesheets: ['/css/admin/adminPayments.css', '/css/admin/banking.css'],
      scripts: ['/js/admin/banking.js']
    })
  } catch (e) {
    logger.error('Error rendering banking page:', e)
    res.status(500).render('error', { message: 'Pagina kon niet worden geladen', error: e?.message, user: req.user })
  }
})

// Admin Rabobank connect (Bankieren): start OAuth, redirect to admin callback
router.get("/payments/banking/rabobank/connect", requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    if (!RabobankApiService.isAvailable()) {
      return res.redirect('/admin/payments/banking?error=Rabobank API is niet geconfigureerd')
    }
    const state = crypto.randomBytes(32).toString('hex')
    if (!req.session) req.session = {}
    req.session.rabobank_oauth_admin_state = state
    req.session.rabobank_oauth_admin_user_id = req.user?.id
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`
    const redirectUri = `${baseUrl}/admin/payments/banking/rabobank/callback`
    const authUrl = RabobankApiService.getAuthorizationUrl(redirectUri, state, ['aisp'])
    res.redirect(authUrl)
  } catch (e) {
    logger.error('Rabobank admin connect error:', e)
    res.redirect('/admin/payments/banking?error=' + encodeURIComponent(e.message || 'OAuth start mislukt'))
  }
})

// Admin Rabobank callback: create org_bank_connection + bank_accounts, redirect to Bankieren
router.get("/payments/banking/rabobank/callback", requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query
    if (error) {
      return res.redirect('/admin/payments/banking?error=' + encodeURIComponent(error_description || error))
    }
    if (!req.session?.rabobank_oauth_admin_state || state !== req.session.rabobank_oauth_admin_state) {
      return res.redirect('/admin/payments/banking?error=Ongeldige sessie. Probeer opnieuw.')
    }
    if (!code) return res.redirect('/admin/payments/banking?error=Geen autorisatiecode ontvangen')
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`
    const redirectUri = `${baseUrl}/admin/payments/banking/rabobank/callback`
    const tokenData = await RabobankApiService.exchangeCodeForToken(code, redirectUri)
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 3600))
    const accountInfo = await RabobankApiService.getAccountInformation(tokenData.access_token)
    const accountsList = accountInfo?.accounts || (accountInfo?.iban ? [accountInfo] : [])
    const organizationId = null
    const { data: conn, error: connErr } = await supabaseAdmin
      .from('org_bank_connections')
      .insert({
        organization_id: organizationId,
        provider: 'rabobank',
        status: 'connected',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        expires_at: expiresAt.toISOString(),
        last_synced_at: null,
      })
      .select('id')
      .single()
    if (connErr || !conn) throw new Error(connErr?.message || 'Kon koppeling niet opslaan')
    const bankingImportService = require('../services/bankingImportService')
    for (const acc of accountsList) {
      const iban = acc.iban || acc.accountId || acc.resourceId
      const name = acc.name || acc.accountName || acc.product || 'Rabobank Rekening'
      const providerAccountId = acc.resourceId || acc.accountId || acc.iban || iban
      if (!iban) continue
      await bankingImportService.ensureBankAccount({
        name,
        iban: iban.replace(/\s/g, ''),
        currency: (acc.currency || 'EUR').toUpperCase(),
        organization_id: organizationId,
        provider: 'rabobank',
        provider_account_id: providerAccountId,
        connection_id: conn.id,
        is_active: true,
      })
    }
    if (req.session) {
      delete req.session.rabobank_oauth_admin_state
      delete req.session.rabobank_oauth_admin_user_id
    }
    res.redirect('/admin/payments/banking?success=Rabobank gekoppeld. We halen nu transacties op.')
  } catch (e) {
    logger.error('Rabobank admin callback error:', e)
    if (req.session) {
      delete req.session.rabobank_oauth_admin_state
      delete req.session.rabobank_oauth_admin_user_id
    }
    res.redirect('/admin/payments/banking?error=' + encodeURIComponent(e.message || 'Koppelen mislukt'))
  }
})

// Beheer koppelingen pagina
router.get("/payments/banking/connections", requireAuth, requireManagerOrAdminPage, async (req, res) => {
  try {
    res.render("admin/payments/banking-connections", {
      title: "Beheer bankkoppelingen",
      activeMenu: "payments",
      activeSubmenu: "banking",
      user: req.user,
      stylesheets: ['/css/admin/adminPayments.css', '/css/admin/banking.css'],
      scripts: ['/js/admin/banking-connections.js']
    })
  } catch (e) {
    logger.error('Error rendering banking connections:', e)
    res.status(500).render('error', { message: 'Pagina kon niet worden geladen', error: e?.message, user: req.user })
  }
})

// Settings submenu routes
router.get("/settings/billing", requireAuth, isAdmin, async (req, res) => {
  res.render("admin/settings/billing", {
    title: "Facturering",
    activeMenu: "settings",
    activeSubmenu: "billing",
    user: req.user
  })
})

router.get("/settings/activities", requireAuth, isAdmin, async (req, res) => {
  res.render("admin/settings/activities", {
    title: "Activiteit",
    activeMenu: "settings",
    activeSubmenu: "activities",
    user: req.user
  })
})

// Helper function to get accessible mailboxes for a user
async function getAccessibleMailboxes(userId, userEmail) {
  try {
    // Get user profile to check permissions
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('is_admin, role_id, can_read_company_mailboxes')
      .eq('id', userId)
      .maybeSingle()
    
    if (profileError) {
      console.error('Error fetching user profile:', profileError)
      return []
    }
    
    // Check if user is admin
    const isAdmin = profile?.is_admin === true
    
    // Check if user is manager
    let isManager = false
    if (profile?.role_id) {
      const { data: role } = await supabaseAdmin
        .from('roles')
        .select('name')
        .eq('id', profile.role_id)
        .maybeSingle()
      
      if (role?.name?.toLowerCase().includes('manager')) {
        isManager = true
      }
    }
    
    // Managers and admins see all mailboxes
    if (isAdmin || isManager) {
      const { data: allMailboxes } = await supabaseAdmin
        .from('mailboxes')
        .select('*')
        .order('email', { ascending: true })
      return allMailboxes || []
    }
    
    // Regular users: only their own mailbox + company mailboxes if permission granted
    const accessibleMailboxes = []
    
    // Always add their own mailbox (if it exists)
    if (userEmail) {
      const { data: ownMailbox } = await supabaseAdmin
        .from('mailboxes')
        .select('*')
        .eq('email', userEmail)
        .maybeSingle()
      
      if (ownMailbox) {
        accessibleMailboxes.push(ownMailbox)
      }
    }
    
    // If user has permission to read company mailboxes, add those
    if (profile?.can_read_company_mailboxes === true) {
      // Get company mailboxes (not matching user's email)
      const { data: companyMailboxes } = await supabaseAdmin
        .from('mailboxes')
        .select('*')
        .neq('email', userEmail || '')
        .order('email', { ascending: true })
      
      if (companyMailboxes) {
        accessibleMailboxes.push(...companyMailboxes)
      }
    }
    
    return accessibleMailboxes
  } catch (error) {
    console.error('Error getting accessible mailboxes:', error)
    return []
  }
}

// Admin Messages (Chat) - main and conversation view
router.get("/messages", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    res.render('admin/messages/index', {
      title: 'Chat',
      activeMenu: 'mail',
      activeSubmenu: 'messages',
      user: req.user,
      userRole: req.user.role,
      openConversationId: req.query.open || null,
      scrollToMessageId: req.query.message || null,
      stylesheets: ['/css/admin/messages.css'],
      scripts: ['/js/admin/messages.js']
    })
  } catch (err) {
    console.error('Admin messages route error:', err)
    res.status(500).render('error', { message: 'Kon pagina niet laden', error: {}, user: req.user })
  }
})

router.get("/messages/:conversationId", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    res.render('admin/messages/index', {
      title: 'Chat',
      activeMenu: 'mail',
      activeSubmenu: 'messages',
      user: req.user,
      userRole: req.user.role,
      openConversationId: req.params.conversationId,
      scrollToMessageId: req.query.message || null,
      stylesheets: ['/css/admin/messages.css'],
      scripts: ['/js/admin/messages.js']
    })
  } catch (err) {
    console.error('Admin messages conversation route error:', err)
    res.status(500).render('error', { message: 'Kon pagina niet laden', error: {}, user: req.user })
  }
})

// Mail - Admin Inbox
router.get("/mail", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const currentUserId = req.user?.id
    const currentUserEmail = req.user?.email
    
    // Get accessible mailboxes based on user permissions
    const mailboxes = await getAccessibleMailboxes(currentUserId, currentUserEmail)

    if (mailboxes.length === 0) {
      console.log('⚠️ No accessible mailboxes found for user')
    } else {
      console.log(`📬 Found ${mailboxes.length} accessible mailboxes for user ${currentUserEmail}`)
      console.log(`📬 Mailbox IDs: ${mailboxes.map(mb => `${mb.email} (${mb.id})`).join(', ')}`)
    }

    // Determine default mailbox: use query param, or primary mailbox, or first mailbox, or 'all'
    let currentMailboxId = req.query.mailbox
    if (!currentMailboxId || currentMailboxId === 'all') {
      // Find primary mailbox
      const primaryMailbox = (mailboxes || []).find(mb => mb.is_primary === true)
      if (primaryMailbox) {
        currentMailboxId = primaryMailbox.id
        console.log(`📬 Using primary mailbox: ${primaryMailbox.email} (${primaryMailbox.id})`)
      } else if (mailboxes && mailboxes.length > 0) {
        // Fallback to first mailbox if no primary set
        currentMailboxId = mailboxes[0].id
        console.log(`📬 Using first mailbox: ${mailboxes[0].email} (${mailboxes[0].id})`)
      } else {
        currentMailboxId = 'all'
        console.log(`📬 No mailboxes found, showing all`)
      }
    } else {
      console.log(`📬 Using mailbox from query param: ${currentMailboxId}`)
    }

           // Build BASE queries for mails (separate builders for count vs data to avoid select() leakage)
           let dataQuery = supabaseAdmin
             .from('mail_inbox')
             .select(`
               *,
               customers!mail_inbox_customer_id_fkey(id, name, email, domain, logo_url, company_name)
             `)
           let countQuery = supabaseAdmin
             .from('mail_inbox')
             .select('id', { count: 'exact', head: true })

   // Parse additional filters
   const urlLabel = (req.query.label || 'all').toString()
   const searchTerm = (req.query.search || '').toString().trim()
   const filterVal = (req.query.filter || 'all').toString()

   // Filter by mailbox if specified, but ensure user has access to that mailbox
   if (currentMailboxId && currentMailboxId !== 'all') {
     const mailboxIdStr = String(currentMailboxId)
     // Verify user has access to this mailbox
     const hasAccess = mailboxes.some(mb => String(mb.id) === mailboxIdStr)
     if (hasAccess) {
       dataQuery = dataQuery.eq('mailbox_id', mailboxIdStr)
       countQuery = countQuery.eq('mailbox_id', mailboxIdStr)
       console.log(`🔍 Filtering mails by mailbox_id: ${mailboxIdStr}`)
     } else {
       // User doesn't have access, reset to first accessible mailbox
       if (mailboxes.length > 0) {
         currentMailboxId = mailboxes[0].id
         dataQuery = dataQuery.eq('mailbox_id', currentMailboxId)
         countQuery = countQuery.eq('mailbox_id', currentMailboxId)
         console.log(`⚠️ User doesn't have access to requested mailbox, using first accessible: ${mailboxes[0].email}`)
       } else {
         // No accessible mailboxes, filter to empty result
         dataQuery = dataQuery.eq('mailbox_id', '00000000-0000-0000-0000-000000000000') // Non-existent ID
         countQuery = countQuery.eq('mailbox_id', '00000000-0000-0000-0000-000000000000')
         console.log(`⚠️ No accessible mailboxes, showing empty result`)
       }
     }
   } else {
     // Show mails from all accessible mailboxes
     if (mailboxes.length > 0) {
       const accessibleMailboxIds = mailboxes.map(mb => mb.id)
       dataQuery = dataQuery.in('mailbox_id', accessibleMailboxIds)
       countQuery = countQuery.in('mailbox_id', accessibleMailboxIds)
       console.log(`🔍 Fetching mails from ${accessibleMailboxIds.length} accessible mailboxes`)
     } else {
       // No accessible mailboxes, filter to empty result
       dataQuery = dataQuery.eq('mailbox_id', '00000000-0000-0000-0000-000000000000')
       countQuery = countQuery.eq('mailbox_id', '00000000-0000-0000-0000-000000000000')
       console.log(`⚠️ No accessible mailboxes, showing empty result`)
     }
   }

   // Unread / attachments filter
   if (filterVal === 'unread') {
     dataQuery = dataQuery.is('read_at', null)
     countQuery = countQuery.is('read_at', null)
   } else if (filterVal === 'attachments') {
     // assumes has_attachments boolean column exists
     dataQuery = dataQuery.eq('has_attachments', true)
     countQuery = countQuery.eq('has_attachments', true)
   }

   // Search across key fields
   if (searchTerm) {
     const like = `%${searchTerm}%`
     const orExpr = `subject.ilike.${like},from_email.ilike.${like},from_name.ilike.${like},body_text.ilike.${like}`
     dataQuery = dataQuery.or(orExpr)
     countQuery = countQuery.or(orExpr)
   }

    // Pagination setup
   const page = parseInt(req.query.page) || 1
   const requestedPerPage = parseInt(req.query.perPage) || 10
    const perPage = Math.max(1, Math.min(50, requestedPerPage))
    const offset = (page - 1) * perPage
    
   // Get total count for pagination (use separate builder so select() doesn't affect dataQuery)
   const { count: totalMails } = await countQuery
    
    const totalPages = Math.ceil((totalMails || 0) / perPage)
    
   // Fetch latest mails with pagination (full columns)
   let { data: mails, error: mailError } = await dataQuery
      .order('received_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    if (mailError) {
      console.error('❌ Mail query error:', mailError)
      throw mailError
    }

    console.log(`📧 Found ${(mails || []).length} mails in database`)
    if (mails && mails.length > 0) {
      console.log(`📧 Sample mail mailbox_id: ${mails[0].mailbox_id}, currentMailboxId: ${currentMailboxId}`)
      console.log(`📧 Sample mail data: from_email="${mails[0].from_email}", from_name="${mails[0].from_name}", subject="${mails[0].subject}"`)
    } else {
      // If no mails found with filter, try fetching ALL mails (including NULL mailbox_id) as fallback
      console.log(`⚠️ No mails found with current filter, trying fallback: all mails including NULL mailbox_id...`)
      const fallbackQuery = supabaseAdmin
        .from('mail_inbox')
        .select(`
          *,
          customers!mail_inbox_customer_id_fkey(id, name, email, domain, logo_url, company_name)
        `)
        .order('received_at', { ascending: false })
        .range(offset, offset + perPage - 1)
      
      const { data: allMails, error: allMailsError } = await fallbackQuery
      
      if (allMailsError) {
        console.error('❌ Error fetching all mails:', allMailsError)
      } else if (allMails && allMails.length > 0) {
        console.log(`📧 Found ${allMails.length} total mails (some may have NULL mailbox_id)`)
        const sampleIds = allMails.slice(0, 3).map(m => m.mailbox_id || 'NULL').join(', ')
        console.log(`📧 Sample mail mailbox_ids: ${sampleIds}`)
        console.log(`📧 Using fallback: showing ALL mails regardless of mailbox_id`)
        
        // Use the fallback results
        const mailIds = allMails.map(m => m.id)
        let labelsByMailFallback = {}
        if (mailIds.length > 0) {
          const { data: labels } = await supabaseAdmin
            .from('mail_labels')
            .select('mail_id,label,confidence')
            .in('mail_id', mailIds)
          labelsByMailFallback = (labels || []).reduce((acc, l) => {
            if (!acc[l.mail_id]) acc[l.mail_id] = []
            acc[l.mail_id].push({ label: l.label, confidence: l.confidence })
            return acc
          }, {})
        }
        const enrichedMailsFallback = allMails.map(m => {
          const cleanFromEmail = m.from_email || ''
          const cleanFromName = (m.from_name && String(m.from_name).trim() !== '')
            ? String(m.from_name).trim()
            : (cleanFromEmail ? cleanFromEmail.split('@')[0] : 'Onbekende afzender')
          const cleanSubject = (m.subject && String(m.subject).trim() !== '')
            ? String(m.subject).trim()
            : '(geen onderwerp)'
          return {
            ...m,
            from_email: cleanFromEmail,
            display_from_name: cleanFromName,
            display_subject: cleanSubject,
            labels: labelsByMailFallback[m.id] || []
          }
        })
        
        // Replace mails with fallback
        mails = enrichedMailsFallback
      } else {
        console.log(`📧 No mails found in database at all`)
      }
    }

    // Basic KPIs (filtered by mailbox if needed)
    // Build unread count query
    let unreadQuery = supabaseAdmin
      .from('mail_inbox')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null)
    
    if (currentMailboxId && currentMailboxId !== 'all') {
      unreadQuery = unreadQuery.eq('mailbox_id', currentMailboxId)
    }
    
    const { count: unreadCount } = await unreadQuery

    const { data: urgentCountData } = await supabaseAdmin
      .from('mail_labels')
      .select('mail_id', { count: 'exact', head: true })
      .eq('label', 'urgent')

    const { data: requestsCountData } = await supabaseAdmin
      .from('mail_labels')
      .select('mail_id', { count: 'exact', head: true })
      .eq('label', 'customer_request')

    // Build today count query
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    let todayQuery = supabaseAdmin
      .from('mail_inbox')
      .select('id', { count: 'exact', head: true })
      .gte('received_at', todayStart.toISOString())
    
    if (currentMailboxId && currentMailboxId !== 'all') {
      todayQuery = todayQuery.eq('mailbox_id', currentMailboxId)
    }
    
    const { count: todayCount } = await todayQuery

    // Fetch labels for these mails
    const mailIds = (mails || []).map(m => m.id)
    let labelsByMail = {}
    if (mailIds.length > 0) {
      const { data: labels } = await supabaseAdmin
        .from('mail_labels')
        .select('mail_id,label,confidence')
        .in('mail_id', mailIds)
      labelsByMail = (labels || []).reduce((acc, l) => {
        if (!acc[l.mail_id]) acc[l.mail_id] = []
        acc[l.mail_id].push({ label: l.label, confidence: l.confidence })
        return acc
      }, {})
    }

    // Ensure all mail fields have proper defaults before rendering
    const enrichedMails = (mails || []).map(m => {
      const cleanFromEmail = m.from_email || ''
      // Prefer raw fields; only use display_* if raw is empty. Treat sentinel fallbacks as empty.
      const rawFromName = (m.from_name && String(m.from_name).trim()) || ''
      const rawDisplayFromName = (m.display_from_name && String(m.display_from_name).trim()) || ''
      let chosenFromName = rawFromName || rawDisplayFromName
      if (!chosenFromName || /^(onbekende\s+afzender)$/i.test(chosenFromName)) {
        chosenFromName = cleanFromEmail ? cleanFromEmail.split('@')[0] : ''
      }

      const rawSubject = (m.subject && String(m.subject).trim()) || ''
      const rawDisplaySubject = (m.display_subject && String(m.display_subject).trim()) || ''
      let chosenSubject = rawSubject || rawDisplaySubject
      if (!chosenSubject || /^\(geen\s+onderwerp\)$/i.test(chosenSubject)) {
        chosenSubject = ''
      }

      return {
        ...m,
        from_email: cleanFromEmail,
        display_from_name: chosenFromName,
        display_subject: chosenSubject,
        labels: labelsByMail[m.id] || []
      }
    })

    // Optional post-filter by label (if label comes from labels table)
    let finalMails = enrichedMails
    if (urlLabel && urlLabel !== 'all') {
      finalMails = enrichedMails.filter(m => (m.labels || []).some(l => l.label === urlLabel))
    }

    // Prevent any intermediate caching of server-rendered mail list
    res.set('Cache-Control', 'no-store')
    res.render('admin/mail', {
      title: 'Mail',
      activeMenu: 'mail',
      user: req.user,
      kpis: {
        unread: unreadCount || 0,
        urgent: urgentCountData?.length || 0,
        customer_requests: requestsCountData?.length || 0,
        today: todayCount || 0
      },
      mails: finalMails,
      mailboxes: mailboxes || [],
      currentMailboxId: currentMailboxId,
      currentLabel: urlLabel,
      pagination: {
        page: page,
        perPage: perPage,
        total: totalMails || 0,
        totalPages: totalPages
      },
      scripts: [`/js/admin/mail.js?v=${encodeURIComponent(res.locals.ssrRenderedAt || Date.now())}`],
      stylesheets: [
        '/css/admin/adminSettings.css',
        '/css/admin/adminPayments.css',
        '/css/admin/mail.css',
        `/css/admin/mail-listing.css?v=${encodeURIComponent(res.locals.ssrRenderedAt || Date.now())}`
      ]
    })
  } catch (err) {
    console.error('Admin mail route error:', err)
    res.status(500).render('error', { message: 'Kon mail niet laden', error: {}, user: req.user })
  }
})

router.get("/mail/settings/new-mailbox", requireAuth, isAdmin, async (req, res) => {
  try {
    res.render('admin/mail/new-mailbox', {
      title: 'Nieuwe mailbox toevoegen',
      activeMenu: 'mail',
      activeSubmenu: 'mail-settings',
      user: req.user,
      editing: false,
      mailbox: null
    })
  } catch (err) {
    console.error('Admin new mailbox route error:', err)
    res.status(500).render('error', { message: 'Kon pagina niet laden', error: {}, user: req.user })
  }
})

router.get("/mail/settings/edit/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    
    const { data: mailbox, error } = await supabaseAdmin
      .from('mailboxes')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error || !mailbox) {
      return res.status(404).render('error', { 
        message: 'Mailbox niet gevonden', 
        error: {}, 
        user: req.user 
      })
    }
    
    res.render('admin/mail/new-mailbox', {
      title: 'Mailbox bewerken',
      activeMenu: 'mail',
      activeSubmenu: 'mail-settings',
      user: req.user,
      editing: true,
      mailbox: mailbox,
      mailboxId: id
    })
  } catch (err) {
    console.error('Admin edit mailbox route error:', err)
    res.status(500).render('error', { message: 'Kon mailbox niet laden', error: {}, user: req.user })
  }
})

router.get("/mail/settings", requireAuth, isAdmin, async (req, res) => {
  try {
    // Fetch all mailboxes, order by primary first, then email
    const { data: mailboxes, error: mailboxError } = await supabaseAdmin
      .from('mailboxes')
      .select('*')
      .order('is_primary', { ascending: false, nullsFirst: false })
      .order('email', { ascending: true })

    // Fetch writing style for this user
    let writingStyle = { tone: 'professional', language: 'nl', formality: 'formal', length: 'medium', custom_instructions: '' }
    try {
      const { data: styleData } = await supabaseAdmin
        .from('mail_writing_styles')
        .select('*')
        .eq('user_id', req.user.id)
        .eq('style_name', 'default')
        .maybeSingle()
      if (styleData) {
        writingStyle = {
          tone: styleData.tone || 'professional',
          language: styleData.language || 'nl',
          formality: styleData.formality || 'formal',
          length: styleData.length || 'medium',
          custom_instructions: styleData.custom_instructions || ''
        }
      }
    } catch (styleError) {
      console.log('Writing styles not found, using defaults')
    }

    // Fetch user signature
    let signature = null
    try {
      const { data: sigData, error: sigError } = await supabaseAdmin
        .from('mail_signatures')
        .select('*')
        .eq('user_id', req.user.id)
        .maybeSingle()
      
      if (sigError && sigError.code !== 'PGRST116') { // PGRST116 = no rows found, that's ok
        console.error('Error fetching signature:', sigError)
      }
      
      signature = sigData || null
      
      // Debug logging
      if (signature) {
        console.log('Signature found for user:', {
          user_id: req.user.id,
          display_name: signature.display_name,
          email: signature.email
        })
      } else {
        console.log('No signature found for user:', req.user.id)
      }
    } catch (sigError) {
      console.error('Signature fetch error:', sigError)
      signature = null
    }

    // Get user profile for defaults
    let profileData = null
    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('first_name, last_name, email, phone, profile_picture')
        .eq('id', req.user.id)
        .maybeSingle()
      profileData = profile
    } catch (profileError) {
      console.log('Profile not found')
    }

    res.render('admin/mail/settings', {
      title: 'Mail Instellingen',
      activeMenu: 'mail',
      activeSubmenu: 'mail-settings',
      user: req.user,
      mailboxes: mailboxes || [],
      writingStyle: writingStyle,
      signature: signature,
      profile: profileData
    })
  } catch (err) {
    console.error('Admin mail settings route error:', err)
    res.status(500).render('error', { message: 'Kon mail instellingen niet laden', error: {}, user: req.user })
  }
})

// Mail list API endpoint (for polling/refresh)
router.get('/api/mail/list', requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const currentUserId = req.user?.id
    const currentUserEmail = req.user?.email
    
    // Get accessible mailboxes based on user permissions
    const accessibleMailboxes = await getAccessibleMailboxes(currentUserId, currentUserEmail)
    const accessibleMailboxIds = accessibleMailboxes.map(mb => mb.id)
    
    const mailboxId = req.query.mailbox || 'all'
    const label = req.query.label || 'all'
    const search = req.query.search || ''
    const requestedPerPage = parseInt(req.query.perPage) || 10
    const perPage = Math.max(1, Math.min(50, requestedPerPage))
    
    // Build query
    let mailQuery = supabaseAdmin
      .from('mail_inbox')
      .select('id, subject, from_email, from_name, received_at, status, mailbox_id')
    
    // Filter by accessible mailboxes only
    if (accessibleMailboxIds.length > 0) {
      if (mailboxId !== 'all') {
        // Verify user has access to requested mailbox
        if (accessibleMailboxIds.includes(mailboxId)) {
          mailQuery = mailQuery.eq('mailbox_id', mailboxId)
        } else {
          // User doesn't have access, return empty result
          return res.json({ 
            mails: [],
            count: 0,
            newCount: 0,
            perPage
          })
        }
      } else {
        // Show mails from all accessible mailboxes
        mailQuery = mailQuery.in('mailbox_id', accessibleMailboxIds)
      }
    } else {
      // No accessible mailboxes, return empty result
      return res.json({ 
        mails: [],
        count: 0,
        newCount: 0,
        perPage
      })
    }
    
    // Count mails from last 5 minutes (new mails)
    const fiveMinutesAgo = new Date()
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5)
    
    const { data: mails, error } = await mailQuery
      .order('received_at', { ascending: false })
      .limit(perPage)
    
    if (error) {
      return res.status(500).json({ error: 'Fout bij ophalen mails' })
    }
    
    // Count new mails (received in last 5 minutes)
    const newCount = (mails || []).filter(m => 
      new Date(m.received_at) > fiveMinutesAgo
    ).length
    
    res.json({ 
      mails: mails || [],
      count: (mails || []).length,
      newCount: newCount,
      perPage
    })
  } catch (e) {
    console.error('Mail list API error:', e)
    res.status(500).json({ error: 'Fout bij ophalen mails' })
  }
})

// Mailbox API endpoints
router.get('/api/mailboxes', requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const currentUserId = req.user?.id
    const currentUserEmail = req.user?.email
    
    // Get accessible mailboxes based on user permissions
    const mailboxes = await getAccessibleMailboxes(currentUserId, currentUserEmail)
    
    res.json({ mailboxes: mailboxes || [] })
  } catch (e) {
    console.error('Error fetching mailboxes:', e)
    res.status(500).json({ error: 'Fout bij ophalen mailboxes' })
  }
})

router.post('/api/mailboxes', requireAuth, isAdmin, async (req, res) => {
  try {
    const { email, imap_host, imap_port, imap_secure, imap_username, imap_password, smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password } = req.body
    
    // Backward compatibility: if old fields exist, use them
    const finalImapUsername = imap_username || req.body.username || email;
    const finalSmtpUsername = smtp_username || req.body.username || email;
    const finalImapPassword = imap_password || req.body.password;
    const finalSmtpPassword = smtp_password || req.body.password;
    
    const { data, error } = await supabaseAdmin
      .from('mailboxes')
      .insert({
        email,
        imap_host,
        imap_port: parseInt(imap_port) || 993,
        imap_secure: imap_secure !== false,
        imap_username: finalImapUsername,
        imap_password_hash: finalImapPassword, // TODO: encrypt this
        smtp_host,
        smtp_port: parseInt(smtp_port) || 465,
        smtp_secure: smtp_secure !== false,
        smtp_username: finalSmtpUsername,
        smtp_password_hash: finalSmtpPassword, // TODO: encrypt this
        // Legacy fields for backward compatibility
        username: finalImapUsername,
        password_hash: finalImapPassword,
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    if (error) throw error
    
    // Automatically trigger sync after adding mailbox
    // Do this in background so response is fast
    setImmediate(async () => {
      try {
        const ImapSyncService = require('../services/imapSyncService')
        console.log(`🚀 Auto-sync nieuwe mailbox: ${data.email}`)
        
        // Sync from last 7 days for new mailbox
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        
        await ImapSyncService.syncMailboxById(data.id, {
          limit: 100,
          since: weekAgo
        })
        
        console.log(`✅ Auto-sync voltooid voor: ${data.email}`)
      } catch (syncError) {
        console.error(`❌ Auto-sync error voor ${data.email}:`, syncError.message)
        // Update error but don't fail the request
        await supabaseAdmin
          .from('mailboxes')
          .update({ last_error: syncError.message })
          .eq('id', data.id)
          .catch(() => {}) // Ignore update errors
      }
    })
    
    res.json({ success: true, mailbox: data })
  } catch (e) {
    res.status(500).json({ error: 'Fout bij aanmaken mailbox: ' + (e.message || 'Unknown error') })
  }
})

router.get('/api/mailboxes/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { data, error } = await supabaseAdmin
      .from('mailboxes')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error || !data) {
      return res.status(404).json({ error: 'Mailbox niet gevonden' })
    }
    
    res.json({ success: true, mailbox: data })
  } catch (e) {
    res.status(500).json({ error: 'Fout bij ophalen mailbox: ' + (e.message || 'Unknown error') })
  }
})

router.put('/api/mailboxes/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { email, imap_host, imap_port, imap_secure, imap_username, imap_password, smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password } = req.body
    
    const updateData = {
      email,
      imap_host,
      imap_port: parseInt(imap_port) || 993,
      imap_secure: imap_secure !== false,
      smtp_host,
      smtp_port: parseInt(smtp_port) || 465,
      smtp_secure: smtp_secure !== false,
      updated_at: new Date().toISOString()
    }
    
    // Update IMAP credentials if provided
    if (imap_username) {
      updateData.imap_username = imap_username
      updateData.username = imap_username // Legacy field
    }
    
    if (imap_password && imap_password.trim()) {
      updateData.imap_password_hash = imap_password // TODO: encrypt this
      updateData.password_hash = imap_password // Legacy field
    }
    
    // Update SMTP credentials if provided
    if (smtp_username) {
      updateData.smtp_username = smtp_username
    }
    
    if (smtp_password && smtp_password.trim()) {
      updateData.smtp_password_hash = smtp_password // TODO: encrypt this
    }
    
    const { data, error } = await supabaseAdmin
      .from('mailboxes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    res.json({ success: true, mailbox: data })
  } catch (e) {
    res.status(500).json({ error: 'Fout bij bijwerken mailbox: ' + (e.message || 'Unknown error') })
  }
})

router.delete('/api/mailboxes/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    await supabaseAdmin.from('mailboxes').delete().eq('id', id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: 'Fout bij verwijderen mailbox' })
  }
})

router.post('/api/mailboxes/:id/set-primary', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    
    // First, unset all other primary mailboxes
    await supabaseAdmin
      .from('mailboxes')
      .update({ is_primary: false })
      .neq('id', id)
    
    // Set this mailbox as primary
    const { data, error } = await supabaseAdmin
      .from('mailboxes')
      .update({ is_primary: true })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    res.json({ success: true, mailbox: data })
  } catch (e) {
    res.status(500).json({ error: 'Fout bij instellen primaire mailbox: ' + (e.message || 'Unknown error') })
  }
})

// Writing style API
router.post('/api/mail/writing-style', requireAuth, isAdmin, async (req, res) => {
  try {
    const { tone, language, formality, length, custom_instructions } = req.body
    
    // Check if style exists for this user (with style_name 'default')
    const { data: existing } = await supabaseAdmin
      .from('mail_writing_styles')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('style_name', 'default')
      .maybeSingle()
    
    if (existing) {
      // Update existing style for this user
      const { data, error } = await supabaseAdmin
        .from('mail_writing_styles')
        .update({
          tone: tone || 'professional',
          language: language || 'nl',
          formality: formality || 'formal',
          length: length || 'medium',
          custom_instructions: custom_instructions || '',
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single()
      
      if (error) throw error
      res.json({ success: true, style: data })
    } else {
      // Insert - user_id and style_name are required (NOT NULL, no defaults)
      const insertData = {
        user_id: req.user.id, // Required column
        style_name: 'default', // Required column
        tone: tone || 'professional',
        language: language || 'nl',
        formality: formality || 'formal',
        length: length || 'medium',
        custom_instructions: custom_instructions || ''
      }
      
      const { data, error } = await supabaseAdmin
        .from('mail_writing_styles')
        .insert(insertData)
        .select()
        .single()
      
      if (error) throw error
      res.json({ success: true, style: data })
    }
  } catch (e) {
    res.status(500).json({ error: 'Fout bij opslaan schrijfstijl: ' + (e.message || 'Unknown error') })
  }
})

// Signature API
router.post('/api/mail/signature', requireAuth, isAdmin, async (req, res) => {
  try {
    const { display_name, email, phone, photo_url } = req.body
    
    // Validate required fields
    if (!display_name || !email) {
      return res.status(400).json({ error: 'Display naam en email zijn verplicht' })
    }
    
    if (!req.user || !req.user.id) {
      console.error('User not found in request:', req.user)
      return res.status(401).json({ error: 'Gebruiker niet geauthenticeerd' })
    }
    
    // Check if signature exists
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('mail_signatures')
      .select('id')
      .eq('user_id', req.user.id)
      .maybeSingle()
    
    if (existingError) {
      console.error('Error checking existing signature:', existingError)
      // If table doesn't exist, suggest running migration
      if (existingError.code === '42P01') {
        return res.status(500).json({ 
          error: 'Tabel mail_signatures bestaat niet. Voer eerst de migratie uit: migrations/create_mail_signatures.sql',
          code: 'TABLE_NOT_FOUND'
        })
      }
      throw existingError
    }
    
    if (existing) {
      // Update
      const { data, error } = await supabaseAdmin
        .from('mail_signatures')
        .update({
          display_name,
          email,
          phone: phone || null,
          photo_url: photo_url || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single()
      
      if (error) {
        console.error('Error updating signature:', error)
        throw error
      }
      
      res.json({ success: true, signature: data })
    } else {
      // Insert
      const { data, error } = await supabaseAdmin
        .from('mail_signatures')
        .insert({
          user_id: req.user.id,
          display_name,
          email,
          phone: phone || null,
          photo_url: photo_url || null
        })
        .select()
        .single()
      
      if (error) {
        console.error('Error inserting signature:', error)
        console.error('Error details:', JSON.stringify(error, null, 2))
        throw error
      }
      
      res.json({ success: true, signature: data })
    }
  } catch (e) {
    console.error('Signature save error:', e)
    console.error('Error stack:', e.stack)
    res.status(500).json({ 
      error: 'Fout bij opslaan handtekening: ' + (e.message || e.details || 'Unknown error'),
      details: process.env.NODE_ENV === 'development' ? e.stack : undefined
    })
  }
})

router.get('/api/mail/signature', requireAuth, isAdmin, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Gebruiker niet geauthenticeerd' })
    }
    
    const { data, error } = await supabaseAdmin
      .from('mail_signatures')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle()
    
    if (error) {
      console.error('Error fetching signature:', error)
      // If table doesn't exist, return null instead of error
      if (error.code === '42P01') {
        return res.json({ signature: null })
      }
      throw error
    }
    
    res.json({ signature: data })
  } catch (e) {
    console.error('Get signature error:', e)
    res.status(500).json({ error: 'Fout bij ophalen handtekening: ' + (e.message || 'Unknown error') })
  }
})

// Signature photo upload endpoint
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const _isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV

const signatureStorage = _isVercel ? multer.memoryStorage() : multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'signatures')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    cb(null, 'signature-' + req.user.id + '-' + uniqueSuffix + ext)
  }
})

const uploadSignature = multer({ storage: signatureStorage })

router.post('/api/upload-signature-photo', requireAuth, isAdmin, uploadSignature.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Geen foto geüpload' })
    }
    let imageUrl
    if (_isVercel && req.file.buffer) {
      const bucketOk = await ensureStorageBucket('uploads', true)
      if (!bucketOk) return res.status(500).json({ success: false, message: 'Storage niet beschikbaar' })
      const ext = path.extname(req.file.originalname) || '.png'
      const fileName = `signatures/signature-${req.user.id}-${Date.now()}${ext}`
      const { error: uploadErr } = await supabaseAdmin.storage.from('uploads').upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: true })
      if (uploadErr) return res.status(500).json({ success: false, message: 'Fout bij uploaden: ' + uploadErr.message })
      const { data: { publicUrl } } = supabaseAdmin.storage.from('uploads').getPublicUrl(fileName)
      imageUrl = publicUrl
    } else {
      imageUrl = '/uploads/signatures/' + req.file.filename
    }
    res.json({ success: true, url: imageUrl, message: 'Foto succesvol geüpload' })
  } catch (error) {
    console.error('Upload error:', error)
    if (!_isVercel && req.file?.path) fs.unlinkSync(req.file.path)
    res.status(500).json({ success: false, message: 'Er is een fout opgetreden bij het uploaden' })
  }
})

router.post('/api/mailboxes/:id/sync', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    
    console.log(`🔄 Sync request voor mailbox ID: ${id}`);
    
    // Get mailbox details
    const { data: mailbox, error: mailboxError } = await supabaseAdmin
      .from('mailboxes')
      .select('*')
      .eq('id', id)
      .single()
    
    if (mailboxError || !mailbox) {
      console.error(`❌ Mailbox niet gevonden: ${mailboxError?.message || 'Unknown'}`);
      return res.status(404).json({ error: 'Mailbox niet gevonden' })
    }
    
    console.log(`📬 Sync mailbox: ${mailbox.email}`);
    
    // Start actual IMAP sync - wait for it to complete
    const ImapSyncService = require('../services/imapSyncService')
    
    // For manual sync, check last_sync_at and sync from that point (or last hour if never synced)
    let sinceDate = null;
    if (mailbox.last_sync_at) {
      // Sync from last sync time (with 5 minute buffer)
      const lastSync = new Date(mailbox.last_sync_at);
      lastSync.setMinutes(lastSync.getMinutes() - 5);
      sinceDate = lastSync;
    } else {
      // If never synced, sync from last 30 days to catch recent history
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      sinceDate = monthAgo;
    }
    
    // Run sync and wait for completion (with timeout)
    const syncPromise = ImapSyncService.syncMailboxById(id, { 
      limit: 100,
      since: sinceDate 
    });
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Sync timeout na 60 seconden')), 60000)
    );
    
    // Return immediately but also process sync
    res.json({ 
      success: true, 
      message: `Synchronisatie gestart voor ${mailbox.email}. E-mails worden opgehaald...`,
      last_sync_at: new Date().toISOString()
    });
    
    // Process sync in background
    Promise.race([syncPromise, timeoutPromise])
      .then(async (result) => {
        console.log(`✅ Sync voltooid voor ${mailbox.email}:`, {
          synced: result.synced,
          errors: result.errors,
          found: result.found
        });
        
        // Update mailbox status after sync
        await supabaseAdmin
          .from('mailboxes')
          .update({ 
            last_sync_at: new Date().toISOString(),
            last_error: null,
            is_active: true,
            total_mails_synced: (mailbox.total_mails_synced || 0) + result.synced
          })
          .eq('id', id)
        
        if (result.errorMessages && result.errorMessages.length > 0) {
          console.error(`⚠️ Sync errors voor ${mailbox.email}:`, result.errorMessages);
        }
      })
      .catch(async (syncError) => {
        console.error(`❌ Sync error voor ${mailbox.email}:`, syncError.message);
        console.error('Stack:', syncError.stack);
        
        // Update error status
        await supabaseAdmin
          .from('mailboxes')
          .update({ 
            last_error: syncError.message || 'Onbekende fout',
            last_sync_at: new Date().toISOString()
          })
          .eq('id', id)
      });
      
  } catch (e) {
    console.error('❌ Sync route error:', e);
    console.error('Stack:', e.stack);
    
    // Try to update error status
    try {
      await supabaseAdmin
        .from('mailboxes')
        .update({ last_error: e.message || 'Onbekende fout' })
        .eq('id', req.params.id)
    } catch (updateErr) {
      console.error('Could not update mailbox error status:', updateErr);
    }
    
    res.status(500).json({ error: 'Fout bij synchroniseren: ' + (e.message || 'Onbekende fout') })
  }
})

// ===== Mail API =====
router.get('/api/mail/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const id = (req.params.id || '').trim()
    const { data: mail, error } = await supabaseAdmin
      .from('mail_inbox')
      .select(`
        *,
        customers:customer_id(id, name, email, domain),
        auto_linked_customer:auto_linked_customer_id(id, name, email, domain),
        ticket:ticket_id(id, ticket_number, subject, status, priority)
      `)
      .eq('id', id)
      .single()
    if (error || !mail) return res.status(404).json({ error: 'Niet gevonden' })
    res.json({ mail })
  } catch (e) {
    res.status(500).json({ error: 'Fout bij ophalen mail' })
  }
})

// Mail labels API
router.get('/api/mail/:id/labels', requireAuth, isAdmin, async (req, res) => {
  try {
    const id = req.params.id
    const { data: rows, error } = await supabaseAdmin
      .from('mail_labels')
      .select('label, confidence')
      .eq('mail_id', id)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ labels: rows || [] })
  } catch (e) {
    res.status(500).json({ error: 'Fout bij ophalen labels: ' + e.message })
  }
})

router.post('/api/mail/:id/labels', requireAuth, isAdmin, async (req, res) => {
  try {
    const id = req.params.id
    const { label } = req.body || {}
    if (!label) return res.status(400).json({ error: 'label vereist' })
    // Replace labels with the provided one (simple UX to correct AI)
    const { error: delErr } = await supabaseAdmin
      .from('mail_labels')
      .delete()
      .eq('mail_id', id)
    if (delErr && delErr.code !== 'PGRST116') return res.status(500).json({ error: delErr.message })

    const { error: insErr } = await supabaseAdmin
      .from('mail_labels')
      .insert({ mail_id: id, label, confidence: 1.0 })
    if (insErr) return res.status(500).json({ error: insErr.message })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: 'Fout bij updaten label: ' + e.message })
  }
})

router.post('/api/mail/:id/draft', requireAuth, isAdmin, async (req, res) => {
  try {
    const id = req.params.id
    const { draft } = req.body
    
    if (!id) {
      return res.status(400).json({ error: 'Mail ID ontbreekt' })
    }
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Ongeldig mail ID formaat' })
    }
    
    // Insert or update draft
    const { data: existingResponse, error: existingError } = await supabaseAdmin
      .from('mail_responses')
      .select('id')
      .eq('mail_id', id)
      .maybeSingle()
    
    if (existingError && existingError.code !== 'PGRST116') {
      console.error('Error checking existing draft:', existingError)
      return res.status(500).json({ error: 'Fout bij checken draft: ' + existingError.message })
    }
    
    if (existingResponse) {
      const { error: updateError } = await supabaseAdmin
        .from('mail_responses')
        .update({ 
          draft_text: draft || '', 
          updated_at: new Date().toISOString()
        })
        .eq('id', existingResponse.id)
      
      if (updateError) {
        console.error('Error updating draft:', updateError)
        return res.status(500).json({ error: 'Fout bij updaten draft: ' + updateError.message })
      }
    } else {
      const { error: insertError } = await supabaseAdmin
        .from('mail_responses')
        .insert({ 
          mail_id: id, 
          draft_text: draft || '', 
          status: 'draft',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      
      if (insertError) {
        console.error('Error inserting draft:', insertError)
        return res.status(500).json({ error: 'Fout bij opslaan draft: ' + insertError.message })
      }
    }
    
    res.json({ success: true })
  } catch (e) {
    console.error('Draft save error:', e)
    console.error('Error stack:', e.stack)
    res.status(500).json({ error: 'Fout bij opslaan draft: ' + (e.message || 'Unknown error') })
  }
})

router.get('/api/mail/:id/draft', requireAuth, isAdmin, async (req, res) => {
  try {
    const id = req.params.id
    
    if (!id) {
      return res.status(400).json({ error: 'Mail ID ontbreekt' })
    }
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Ongeldig mail ID formaat' })
    }
    
    const { data: response, error } = await supabaseAdmin
      .from('mail_responses')
      .select('draft_text, draft_html, status, feedback')
      .eq('mail_id', id)
      .maybeSingle()
    
    if (error) {
      // PGRST116 = no rows found, that's ok - return empty draft
      if (error.code === 'PGRST116' || error.message?.includes('No rows') || error.message?.includes('not found')) {
        return res.json({ draft: null, feedback: null })
      }
      // If table doesn't exist, return empty draft
      if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation') && error.message?.includes('does not exist')) {
        console.warn('mail_responses table not found, returning empty draft')
        return res.json({ draft: null, feedback: null })
      }
      console.error('Error fetching draft:', error)
      console.error('Error code:', error.code, 'Error message:', error.message)
      // Still return empty draft instead of error to prevent UI blocking
      return res.json({ draft: null, feedback: null })
    }
    
    if (response && response.draft_text) {
      res.json({ 
        draft: response.draft_text, 
        draftHtml: response.draft_html || null,
        signature: null,
        feedback: response.feedback 
      })
    } else {
      res.json({ draft: null, feedback: null })
    }
  } catch (e) {
    console.error('Draft fetch error:', e)
    console.error('Error stack:', e.stack)
    res.status(500).json({ error: 'Fout bij ophalen draft: ' + (e.message || 'Unknown error') })
  }
})

router.get('/api/mail/:id/feedback', requireAuth, isAdmin, async (req, res) => {
  try {
    const id = req.params.id
    
    if (!id) {
      return res.status(400).json({ error: 'Mail ID ontbreekt' })
    }
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Ongeldig mail ID formaat' })
    }
    
    const { data: response, error } = await supabaseAdmin
      .from('mail_responses')
      .select('feedback')
      .eq('mail_id', id)
      .maybeSingle()
    
    if (error) {
      // PGRST116 = no rows found, that's ok
      if (error.code === 'PGRST116' || error.message?.includes('No rows') || error.message?.includes('not found')) {
        return res.json({ feedback: null })
      }
      // If table doesn't exist, return null feedback
      if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation') && error.message?.includes('does not exist')) {
        console.warn('mail_responses table not found, returning null feedback')
        return res.json({ feedback: null })
      }
      console.error('Error fetching feedback:', error)
      console.error('Error code:', error.code, 'Error message:', error.message)
      // Still return null feedback instead of error to prevent UI blocking
      return res.json({ feedback: null })
    }
    
    res.json({ feedback: response?.feedback || null })
  } catch (e) {
    console.error('Feedback fetch error:', e)
    // Return null instead of error to prevent UI blocking
    res.json({ feedback: null })
  }
})

router.post('/api/mail/:id/feedback', requireAuth, isAdmin, async (req, res) => {
  try {
    const id = req.params.id
    const { feedback } = req.body // 'positive' or 'negative'
    
    // Update or insert feedback
    const { data: existing } = await supabaseAdmin
      .from('mail_responses')
      .select('id')
      .eq('mail_id', id)
      .maybeSingle()
    
    if (existing) {
      await supabaseAdmin
        .from('mail_responses')
        .update({ feedback, feedback_at: new Date().toISOString() })
        .eq('id', existing.id)
    } else {
      // Create response record with feedback
      const { data: mail } = await supabaseAdmin
        .from('mail_inbox')
        .select('id')
        .eq('id', id)
        .single()
      
      if (mail) {
        await supabaseAdmin
          .from('mail_responses')
          .insert({
            mail_id: id,
            feedback,
            feedback_at: new Date().toISOString(),
            status: 'draft'
          })
      }
    }
    
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: 'Fout bij opslaan feedback' })
  }
})

router.post('/api/mail/:id/ai-reply', requireAuth, isAdmin, async (req, res) => {
  try {
    const id = req.params.id
    
    if (!id) {
      return res.status(400).json({ error: 'Mail ID ontbreekt' })
    }
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Ongeldig mail ID formaat' })
    }
    
    // Use Promise.all to fetch everything in parallel for faster response
    let mailResult, styleResult, signatureResult, profileResult
    try {
      [mailResult, styleResult, signatureResult, profileResult] = await Promise.all([
        supabaseAdmin.from('mail_inbox').select('*').eq('id', id).single(),
        supabaseAdmin.from('mail_writing_styles').select('*').eq('user_id', req.user.id).eq('style_name', 'default').maybeSingle(),
        supabaseAdmin.from('mail_signatures').select('*').eq('user_id', req.user.id).maybeSingle(),
        supabaseAdmin.from('profiles').select('first_name, last_name, email, phone, profile_picture').eq('id', req.user.id).maybeSingle()
      ])
    } catch (fetchError) {
      console.error('Error fetching data for AI reply:', fetchError)
      return res.status(500).json({ error: 'Fout bij ophalen gegevens: ' + (fetchError.message || 'Unknown error') })
    }
    
    const { data: mail, error: mailError } = mailResult
    if (mailError || !mail) {
      console.error('Mail not found:', mailError)
      return res.status(404).json({ error: 'Mail niet gevonden' })
    }
    
    // Get writing style
    let writingStyle = { tone: 'professional', language: 'nl', formality: 'formal', length: 'medium', custom_instructions: '' }
    const { data: styleData, error: styleError } = styleResult
    if (styleError) {
      console.warn('Error fetching writing style, using defaults:', styleError.message)
    } else if (styleData) {
      writingStyle = {
        tone: styleData.tone || 'professional',
        language: styleData.language || 'nl',
        formality: styleData.formality || 'formal',
        length: styleData.length || 'medium',
        custom_instructions: styleData.custom_instructions || ''
      }
    }
    
    // Get user signature
    let signature = null
    const { data: sigData, error: sigError } = signatureResult
    if (sigError && sigError.code !== 'PGRST116') {
      console.warn('Error fetching signature:', sigError.message)
    } else {
      signature = sigData
    }
    
    // Fallback to profile data if no signature
    if (!signature) {
      const { data: profile, error: profileError } = profileResult
      if (profileError && profileError.code !== 'PGRST116') {
        console.warn('Error fetching profile for signature fallback:', profileError.message)
      } else if (profile) {
        signature = {
          display_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email?.split('@')[0] || 'GrowSocial',
          email: profile.email || '',
          phone: profile.phone || null,
          photo_url: profile.profile_picture || null
        }
      }
    }
    
    const AiMailService = require('../services/aiMailService')
    
    let draft
    try {
      draft = await AiMailService.generateReplyDraft(mail, writingStyle, signature)
    } catch (draftError) {
      console.error('Error generating draft:', draftError)
      return res.status(500).json({ error: 'Fout bij genereren AI-antwoord: ' + (draftError.message || 'Unknown error') })
    }
    
    // Draft can be an object (new format) or string (old format for backwards compatibility)
    let draftText = ''
    let draftHtml = ''
    let signatureHtml = ''
    
    if (typeof draft === 'object' && draft.textBody) {
      // New format with separate text and HTML
      draftText = draft.textBody || ''
      draftHtml = draft.htmlBody || draft.textBody || ''
      signatureHtml = draft.signature || ''
    } else if (typeof draft === 'string') {
      // Old format - just text
      draftText = draft
      draftHtml = draft.replace(/\n/g, '<br>')
    }
    
    if (!draftText || draftText.trim() === '') {
      return res.status(500).json({ error: 'Leeg AI-antwoord gegenereerd' })
    }
    
    // Insert or update mail response
    const { data: existingResponse, error: existingError } = await supabaseAdmin
      .from('mail_responses')
      .select('id')
      .eq('mail_id', id)
      .maybeSingle()
    
    if (existingError) {
      console.error('Error checking existing response:', existingError)
      // Continue anyway, try to insert
    }
    
    try {
      if (existingResponse) {
        const updateData = { 
          draft_text: draftText, 
          status: 'draft',
          updated_at: new Date().toISOString()
        }
        
        // Add HTML fields if they exist in the table (gracefully handle if columns don't exist)
        if (draftHtml) updateData.draft_html = draftHtml
        
        const { error: updateError } = await supabaseAdmin
          .from('mail_responses')
          .update(updateData)
          .eq('id', existingResponse.id)
        
        if (updateError) {
          console.error('Error updating response:', updateError)
          // Continue even if update fails due to missing columns
          if (!updateError.message.includes('column') && !updateError.message.includes('does not exist')) {
            throw updateError
          }
        }
      } else {
        const insertData = { 
          mail_id: id, 
          draft_text: draftText, 
          status: 'draft',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        // Add HTML fields if they exist in the table
        if (draftHtml) insertData.draft_html = draftHtml
        
        const { error: insertError } = await supabaseAdmin
          .from('mail_responses')
          .insert(insertData)
        
        if (insertError) {
          console.error('Error inserting response:', insertError)
          // Continue even if insert fails due to missing columns
          if (!insertError.message.includes('column') && !insertError.message.includes('does not exist')) {
            return res.status(500).json({ error: 'Fout bij opslaan draft: ' + insertError.message })
          }
        }
      }
    } catch (dbError) {
      console.error('Database error in ai-reply:', dbError)
      // Still return the draft even if DB save fails
      return res.json({ 
        draft: draftText,
        draftHtml: draftHtml,
        signature: signatureHtml,
        style: writingStyle, 
        warning: 'Draft gegenereerd maar niet opgeslagen in database' 
      })
    }
    
    res.json({ 
      draft: draftText,
      draftHtml: draftHtml,
      signature: signatureHtml,
      style: writingStyle 
    })
  } catch (e) {
    console.error('AI reply error:', e)
    console.error('Stack:', e.stack)
    res.status(500).json({ error: 'Fout bij genereren AI-antwoord: ' + (e.message || 'Unknown error') })
  }
})

// Batch AI reply generation for preloading
router.post('/api/mail/batch-ai-reply', requireAuth, isAdmin, async (req, res) => {
  try {
    const { mailIds } = req.body
    
    if (!mailIds || !Array.isArray(mailIds) || mailIds.length === 0) {
      return res.status(400).json({ error: 'Mail IDs vereist' })
    }
    
    // Limit batch size to prevent overload
    const limitedIds = mailIds.slice(0, 20)
    
    // Fetch user's writing style and signature once
    const [styleResult, signatureResult] = await Promise.all([
      supabaseAdmin.from('mail_writing_styles').select('*').eq('user_id', req.user.id).eq('style_name', 'default').maybeSingle(),
      supabaseAdmin.from('mail_signatures').select('*').eq('user_id', req.user.id).maybeSingle()
    ])
    
    const writingStyle = styleResult.data ? {
      tone: styleResult.data.tone || 'professional',
      language: styleResult.data.language || 'nl',
      formality: styleResult.data.formality || 'formal',
      length: styleResult.data.length || 'medium',
      custom_instructions: styleResult.data.custom_instructions || ''
    } : null
    
    const signature = signatureResult.data || null
    
    // Fetch all mails in parallel
    const mailPromises = limitedIds.map(id => 
      supabaseAdmin.from('mail_inbox').select('*').eq('id', id).maybeSingle()
    )
    const mailResults = await Promise.all(mailPromises)
    
    // Process each mail and generate AI reply in parallel
    const AiMailService = require('../services/aiMailService')
    const replies = {}
    
    const replyPromises = mailResults.map(async (result, index) => {
      const mail = result.data
      const mailId = limitedIds[index]
      
      if (!mail || !mail.subject || !mail.body_text) {
        return { mailId, error: 'Mail niet gevonden of onvolledig' }
      }
      
      try {
        // Check if reply already exists in database
        const { data: existingReply } = await supabaseAdmin
          .from('mail_responses')
          .select('draft_text, draft_html')
          .eq('mail_id', mailId)
          .maybeSingle()
        
        if (existingReply) {
          // Use existing reply
          return {
            mailId,
            draft: existingReply.draft_text,
            draftHtml: existingReply.draft_html,
            signature: null
          }
        }
        
        // Generate new AI reply
        if (!writingStyle) {
          return { mailId, error: 'Geen writing style geconfigureerd' }
        }
        
        const replyResult = await AiMailService.generateReplyDraft(
          mail,
          writingStyle,
          signature
        )
        
        // Save to database (non-blocking)
        supabaseAdmin
          .from('mail_responses')
          .upsert({
            mail_id: mailId,
            user_id: req.user.id,
            draft_text: replyResult.textBody,
            draft_html: replyResult.htmlBody,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .then(() => {})
          .catch(err => console.error(`Error saving reply for ${mailId}:`, err))
        
        return {
          mailId,
          draft: replyResult.textBody,
          draftHtml: replyResult.htmlBody,
          signature: replyResult.signature
        }
      } catch (error) {
        console.error(`Error generating reply for ${mailId}:`, error)
        return { mailId, error: error.message || 'Fout bij genereren' }
      }
    })
    
    const replyResults = await Promise.all(replyPromises)
    
    // Build response object keyed by mail ID
    replyResults.forEach(result => {
      if (result.mailId) {
        replies[result.mailId] = result.error 
          ? { error: result.error }
          : {
              draft: result.draft,
              draftHtml: result.draftHtml,
              signature: result.signature
            }
      }
    })
    
    res.json({ replies })
  } catch (e) {
    console.error('Batch AI reply error:', e)
    res.status(500).json({ error: 'Fout bij batch genereren AI-antwoorden: ' + (e.message || 'Unknown error') })
  }
})

router.post('/api/mail/:id/send-reply', requireAuth, isAdmin, async (req, res) => {
  try {
    const id = req.params.id
    const { text, html } = req.body || {}
    
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Antwoord mag niet leeg zijn' })
    }
    
    // Use provided HTML or generate from text
    const emailHtml = html || text.replace(/\n/g, '<br>')
    
    // Get mail details with SMTP credentials
    // 1) Fetch mail by id (without join to avoid RLS/nullable join issues)
    let { data: mail, error: mailError } = await supabaseAdmin
      .from('mail_inbox')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    // 2) Fallback: try message_id
    if (!mail || mailError) {
      const { data: fbMail } = await supabaseAdmin
        .from('mail_inbox')
        .select('*')
        .eq('message_id', id)
        .maybeSingle()
      mail = fbMail || null
    }
    
    if (!mail) {
      console.warn('send-reply: mail not found for id/message_id:', id)
      return res.status(404).json({ error: 'Mail niet gevonden' })
    }

    // 3) Fetch mailbox separately (some joins can fail under RLS)
    let mailbox = null
    if (mail.mailbox_id) {
      const { data: mb } = await supabaseAdmin
        .from('mailboxes')
        .select('email, smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password, smtp_password_hash, username, password_hash')
        .eq('id', mail.mailbox_id)
        .maybeSingle()
      mailbox = mb || null
    }

    // Fallbacks als er nog geen mailbox is
    if (!mailbox) {
      // 1) expliciete default via env
      const envDefaultEmail = process.env.DEFAULT_MAILBOX_EMAIL;
      const envDefaultId = process.env.DEFAULT_MAILBOX_ID;
      if (envDefaultId || envDefaultEmail) {
        const { data: envMb } = await supabaseAdmin
          .from('mailboxes')
          .select('email, smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password, smtp_password_hash, username, password_hash')
          .or(
            [
              envDefaultId ? `id.eq.${envDefaultId}` : null,
              envDefaultEmail ? `email.eq.${envDefaultEmail}` : null
            ].filter(Boolean).join(',')
          )
          .maybeSingle()
        if (envMb) {
          console.warn('⚠️ Geen mailbox gekoppeld; gebruik DEFAULT mailbox:', envMb.email)
          mailbox = envMb
        }
      }
    }
    if (!mailbox) {
      // 2) primaire mailbox
      const { data: primaryMb } = await supabaseAdmin
        .from('mailboxes')
        .select('email, smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password, smtp_password_hash, username, password_hash')
        .eq('is_primary', true)
        .maybeSingle()
      if (primaryMb) {
        console.warn('⚠️ Geen mailbox gekoppeld; gebruik primaire mailbox:', primaryMb.email)
        mailbox = primaryMb
      }
    }
    if (!mailbox) {
      // 3) hard fallback op bekende default email (project-specifiek)
      const { data: gsMb } = await supabaseAdmin
        .from('mailboxes')
        .select('email, smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password, smtp_password_hash, username, password_hash')
        .eq('email', 'info@growsocialmedia.nl')
        .maybeSingle()
      if (gsMb) {
        console.warn('⚠️ Geen mailbox gekoppeld; gebruik info@growsocialmedia.nl')
        mailbox = gsMb
      }
    }
    if (!mailbox) {
      // 4) eerste geconfigureerde mailbox
      const { data: anyMb } = await supabaseAdmin
        .from('mailboxes')
        .select('email, smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password, smtp_password_hash, username, password_hash')
        .not('smtp_host', 'is', null)
        .limit(1)
        .maybeSingle()
      if (anyMb) {
        console.warn('⚠️ Geen mailbox gekoppeld; gebruik eerste geconfigureerde mailbox:', anyMb.email)
        mailbox = anyMb
      }
    }
    if (!mailbox) {
      // 5) Synthetische mailbox uit env als laatste redmiddel
      const envHost = process.env.MAILGUN_SMTP_HOST || process.env.SMTP_HOST || 'smtp.eu.mailgun.org'
      const envUser = process.env.MAILGUN_SMTP_USER || process.env.SMTP_USER || process.env.DEFAULT_MAILBOX_EMAIL || 'info@growsocialmedia.nl'
      const envPass = process.env.MAILGUN_SMTP_PASS || process.env.SMTP_PASS || null
      mailbox = {
        email: process.env.DEFAULT_MAILBOX_EMAIL || 'info@growsocialmedia.nl',
        smtp_host: envHost,
        smtp_port: parseInt(process.env.MAILGUN_SMTP_PORT || process.env.SMTP_PORT || '587'),
        smtp_secure: false,
        smtp_username: envUser,
        smtp_password: envPass,
        username: envUser,
        password_hash: envPass
      }
      console.warn('⚠️ Geen mailbox records gevonden; gebruik synthetische SMTP config uit ENV:', mailbox.email)
    }
    
    // Get mailbox for sending (from separate fetch above)
    
    // Actually send the email via SMTP
    if (mailbox) {
      try {
        const nodemailer = require('nodemailer');
        
        // If domain is growsocialmedia.nl (or MAILGUN_DOMAIN matches), force Mailgun host and sane username
        const fromDomain = (mailbox.email || '').split('@')[1] || '';
        const envMgDomain = process.env.MAILGUN_DOMAIN || '';
        const useMailgun = fromDomain.toLowerCase() === 'growsocialmedia.nl' || (envMgDomain && envMgDomain.toLowerCase() === fromDomain.toLowerCase());
        if (useMailgun) {
          // Force Mailgun EU if available, else default Mailgun
          mailbox.smtp_host = process.env.MAILGUN_SMTP_SERVER || process.env.MAILGUN_SMTP_HOST || 'smtp.eu.mailgun.org';
          mailbox.smtp_port = parseInt(process.env.MAILGUN_SMTP_PORT || '587');
          mailbox.smtp_secure = mailbox.smtp_port === 465;
          // Prefer postmaster@domain as username
          const mgDomain = envMgDomain || fromDomain;
          const pmUser = `postmaster@${mgDomain}`;
          // Prefer explicit env user; else prefer the mailbox email if it matches the domain; else fallback to postmaster
          const preferredMailboxEmail = (mailbox.email && mailbox.email.endsWith(`@${mgDomain}`)) ? mailbox.email : null;
          mailbox.smtp_username = process.env.MAILGUN_SMTP_USER || mailbox.smtp_username || preferredMailboxEmail || pmUser;
          // Use MAILGUN SMTP password if present
          mailbox.smtp_password = mailbox.smtp_password || process.env.MAILGUN_SMTP_PASS || mailbox.smtp_password_hash || mailbox.password_hash;
          // Keep mailbox.username aligned with SMTP auth for SPF/DMARC correctness
          mailbox.username = mailbox.smtp_username;
        }
        
        // Helper utils for SMTP hygiene
        const isAsterisks = (v) => typeof v === 'string' && /^\*+$/.test(v);
        const normalizePass = (v) => (typeof v === 'string' ? v.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1').trim() : v);
        const pickMailgunHost = (region) => region === 'us' ? 'smtp.mailgun.org' : 'smtp.eu.mailgun.org';

        // Try to send with current configuration first
        const trySendEmail = async (port, secure, useStartTLS = false) => {
          // Resolve SMTP credentials with sane fallbacks
          let smtpUser = mailbox.smtp_username || mailbox.username || process.env.MAILGUN_SMTP_USER || process.env.SMTP_USER;
          let smtpPass = mailbox.smtp_password || mailbox.smtp_password_hash || mailbox.password_hash || process.env.MAILGUN_SMTP_PASS || process.env.SMTP_PASS;

          // Detect unusable hashed values and prefer env secrets if present
          const looksHashed = (v) => typeof v === 'string' && (v.startsWith('$2a$') || v.startsWith('$2b$') || v.startsWith('$2y$') || v.startsWith('$argon2') || v.length > 60);
          if (looksHashed(smtpPass) && (process.env.MAILGUN_SMTP_PASS || process.env.SMTP_PASS)) {
            smtpPass = process.env.MAILGUN_SMTP_PASS || process.env.SMTP_PASS;
          }
          if (!smtpUser && (process.env.MAILGUN_SMTP_USER || process.env.SMTP_USER)) {
            smtpUser = process.env.MAILGUN_SMTP_USER || process.env.SMTP_USER;
          }

          // Mailgun-specific: do NOT override a provided username. Only fill when missing.
          const isMailgun = (mailbox.smtp_host || '').includes('mailgun.org');
          if (isMailgun && !smtpUser) {
            const domainFromEnv = process.env.MAILGUN_DOMAIN;
            const domainFromEmail = (mailbox.email || '').split('@')[1];
            const mgDomain = domainFromEnv || domainFromEmail;
            if (mgDomain) {
              const preferredMailboxEmail = (mailbox.email && mailbox.email.endsWith(`@${mgDomain}`)) ? mailbox.email : null;
              const userCandidate = process.env.MAILGUN_SMTP_USER || preferredMailboxEmail || `postmaster@${mgDomain}`;
              smtpUser = userCandidate;
              if (!smtpPass) {
                smtpPass = process.env.MAILGUN_SMTP_PASS || smtpPass;
              }
            }
          }

          // For Mailgun, if env creds are set, force using them to avoid stale DB values
          const forcingEnvUser = isMailgun && !!process.env.MAILGUN_SMTP_USER;
          const forcingEnvPass = isMailgun && !!process.env.MAILGUN_SMTP_PASS;
          if (forcingEnvUser) smtpUser = process.env.MAILGUN_SMTP_USER;
          if (forcingEnvPass) smtpPass = process.env.MAILGUN_SMTP_PASS;

          // Region guard for Mailgun host
          const region = (process.env.MAILGUN_REGION || 'eu').toLowerCase();
          if (isMailgun) {
            mailbox.smtp_host = pickMailgunHost(region);
          }

          // Normalize and fail-fast on obviously wrong inputs
          smtpPass = normalizePass(smtpPass);
          if (isAsterisks(smtpPass)) {
            throw new Error('SMTP password looks masked (********). Paste the real SMTP credential from Mailgun → Domain → SMTP credentials.');
          }
          if (!smtpUser || !smtpPass) {
            throw new Error(`SMTP credentials incomplete: user=${!!smtpUser}, pass=${!!smtpPass}`);
          }
          if ((smtpUser || '').toLowerCase().endsWith('@growsocialmedia.nl') && (smtpPass || '').length < 14) {
            throw new Error(`SMTP password too short for Mailgun. Reset the SMTP password for ${smtpUser} and update env.`);
          }
          
          console.log(`🔐 SMTP Auth Details:`);
          console.log(`   Host: ${mailbox.smtp_host}`);
          console.log(`   Port: ${port}`);
          console.log(`   Secure: ${secure}`);
          console.log(`   Username: ${smtpUser ? smtpUser.substring(0, 10) + '...' : 'NOT SET'}`);
          console.log(`   Password: ${smtpPass ? 'SET (' + (smtpPass?.length || 0) + ' chars)' : 'NOT SET'}`);
          console.log(`   Source: user=${forcingEnvUser ? 'env.MAILGUN_SMTP_USER' : 'db/env-fallback'}, pass=${forcingEnvPass ? 'env.MAILGUN_SMTP_PASS' : 'db/env-fallback'}`);
          
          const transportOpts = {
            host: mailbox.smtp_host,
            port: port,
            secure: secure, // true for 465 (SSL), false for 587 (STARTTLS)
            auth: {
              user: smtpUser,
              pass: smtpPass
            },
            tls: {
              rejectUnauthorized: (process.env.MAIL_SMTP_INSECURE === 'true') ? false : true
            },
            requireTLS: useStartTLS, // For port 587
            connectionTimeout: 60000,
            greetingTimeout: 30000,
            socketTimeout: 60000,
            encoding: 'UTF-8',
            logger: true,
            debug: true,
            pool: false
          };
          if (process.env.SMTP_AUTH_METHOD) {
            transportOpts.authMethod = process.env.SMTP_AUTH_METHOD; // e.g., 'LOGIN'
          }
          const transporter = nodemailer.createTransport(transportOpts);
          
          return transporter;
        };
        
        // Get the configured port and security
        const configuredPort = mailbox.smtp_port || 587;
        const configuredSecure = mailbox.smtp_port === 465;
        
        // Create transporter with configured settings
        let transporter = await trySendEmail(configuredPort, configuredSecure, configuredPort === 587);
        
        // SPF fix: The "from" address MUST exactly match the SMTP authenticated username
        // SPF policy checks if the sending server is authorized for the "from" domain
        // Most SMTP servers require from=authenticated user to pass SPF
        
        // Get the authenticated SMTP username
        let fromEmail = mailbox.username || mailbox.email
        
        // Ensure fromEmail is a valid email (contains @)
        if (!fromEmail || !fromEmail.includes('@')) {
          // If username is not an email, use mailbox.email
          fromEmail = mailbox.email
        }
        
        // Critical: The "from" email MUST match the authenticated SMTP username
        // If they don't match, SPF will fail with "554 5.7.1 SPF Incorrect"
        // Use the exact authenticated username as the from address
        if (mailbox.username && mailbox.username.includes('@')) {
          fromEmail = mailbox.username // Use authenticated username if it's an email
        } else {
          fromEmail = mailbox.email // Fallback to mailbox email
        }
        
        // For SPF to work, both the SMTP auth user AND the from address must be the same
        // Some servers allow envelope-sender (Return-Path) to differ, but from must match auth
        
        // Get signature for display name
        let fromName = 'GrowSocial'
        try {
          const { data: signature } = await supabaseAdmin
            .from('mail_signatures')
            .select('display_name')
            .eq('user_id', req.user.id)
            .maybeSingle()
          if (signature && signature.display_name) {
            fromName = signature.display_name
          }
        } catch (sigErr) {
          // Use default
        }
        
        // Use the actual transporter auth user to avoid mismatches with mailbox fields
        const smtpAuthUser = (transporter?.options?.auth && transporter.options.auth.user) || mailbox.smtp_username || mailbox.username || mailbox.email;
        
        // CRITICAL: For SPF to work, the "from" address MUST exactly match the SMTP authenticated username
        // For Mailgun: username is usually the full email address (e.g., postmaster@growsocialmedia.nl)
        // Use the authenticated SMTP username as the from address
        if (smtpAuthUser && smtpAuthUser.includes('@')) {
          fromEmail = smtpAuthUser;
        } else {
          // If username is not an email, use mailbox email
          fromEmail = mailbox.email;
        }
        
        console.log(`📧 Verzenden email via SMTP:`)
        console.log(`   Host: ${mailbox.smtp_host}:${mailbox.smtp_port || 465}`)
        console.log(`   SMTP Auth User: ${smtpAuthUser}`)
        console.log(`   From Address: ${fromEmail}`)
        console.log(`   From Domain: ${fromEmail.split('@')[1] || 'N/A'}`)
        console.log(`   To: ${mail.from_email}`)
        console.log(`   Display Name: ${fromName}`)
        console.log(`   Mailbox Email: ${mailbox.email}`)
        console.log(`   ⚠️ Mailgun Check:`)
        console.log(`      - From: ${fromEmail} (moet exact overeenkomen met verified domain)`)
        console.log(`      - SMTP User: ${smtpAuthUser} (moet email zijn van verified domain)`)
        console.log(`      - Domain: ${fromEmail.split('@')[1]} (moet "Active" zijn in Mailgun, niet alleen "Verified")`)
        
        // Verify SMTP connection first
        try {
          await transporter.verify();
          console.log(`✅ SMTP connection verified`);
        } catch (verifyError) {
          console.error(`❌ SMTP verification failed:`, verifyError);
          throw new Error(`SMTP verbinding gefaald: ${verifyError.message}`);
        }
        
        // Prepare email with strict SPF compliance
        const mailOptions = {
          // CRITICAL: from MUST match SMTP auth user exactly
          from: `"${fromName}" <${fromEmail}>`,
          to: mail.from_email,
          // Reply-to should match sender
          replyTo: fromEmail,
          subject: mail.subject && mail.subject.startsWith('Re:') ? mail.subject : `Re: ${mail.subject || '(geen onderwerp)'}`,
          text: text,
          html: emailHtml,
          // Email threading
          inReplyTo: mail.message_id || undefined,
          references: mail.message_id || undefined,
          // Headers
          headers: {
            'X-Mailer': 'GrowSocial Mail System',
            'Message-ID': `<${Date.now()}-${Math.random().toString(36)}@${fromEmail.split('@')[1] || 'growsocialmedia.nl'}>`,
            'X-Sender': fromEmail,
            'X-Authenticated-User': fromEmail,
          },
          // ENVELOPE: Critical for SPF - MUST match SMTP auth user
          envelope: {
            from: fromEmail, // Exact match required - must match SMTP auth user
            to: mail.from_email
          }
        };
        
        console.log(`📧 Mail options prepared:`)
        console.log(`   From: "${fromName}" <${fromEmail}>`)
        console.log(`   Envelope From: ${fromEmail}`)
        console.log(`   To: ${mail.from_email}`)
        console.log(`   Subject: ${mailOptions.subject}`)
        
        // Try sending with current configuration
        let lastError = null;
        let sendSuccess = false;
        
        const sendAttempts = [
          { port: configuredPort, secure: configuredSecure, desc: `configured (${configuredPort})` },
          // Fallback: try alternative port if configured is 465
          ...(configuredPort === 465 ? [{ port: 587, secure: false, desc: '587 with STARTTLS' }] : []),
          // Fallback: try alternative port if configured is 587
          ...(configuredPort === 587 ? [{ port: 465, secure: true, desc: '465 with SSL' }] : [])
        ];
        
        for (const attempt of sendAttempts) {
          try {
            // Create new transporter for this attempt
            transporter = await trySendEmail(attempt.port, attempt.secure, attempt.port === 587);
            
            // Verify connection first
            await transporter.verify();
            console.log(`✅ SMTP connection verified on port ${attempt.port}`);
            
            // Try sending
            await transporter.sendMail(mailOptions);
            console.log(`✅ Email verzonden naar ${mail.from_email} via ${attempt.desc}`);

            // Persist success: mark response as sent and mail as replied
            await supabaseAdmin
              .from('mail_responses')
              .update({
                status: 'sent',
                approved_by: req.user?.id || null,
                approved_at: new Date().toISOString(),
                sent_at: new Date().toISOString(),
                draft_text: text
              })
              .eq('mail_id', id)

            await supabaseAdmin
              .from('mail_inbox')
              .update({
                status: 'replied',
                replied_at: new Date().toISOString()
              })
              .eq('id', id)
            sendSuccess = true;
            break; // Success, exit loop
          } catch (attemptError) {
            lastError = attemptError;
            console.warn(`⚠️ Send attempt failed on ${attempt.desc}:`, attemptError.message);
            
            // If it's not an SPF error, don't try alternatives
            const isSpfError = attemptError.message && (
              attemptError.message.includes('SPF') || 
              attemptError.message.includes('554 5.7.1') ||
              attemptError.message.includes('End-of-data rejected')
            );
            
            if (!isSpfError) {
              // Not an SPF error, so this is likely a real connection/auth error
              // Don't try alternatives
              throw attemptError;
            }
            
            // Continue to next attempt if it was an SPF error
            continue;
          }
        }
        
        if (!sendSuccess) {
          throw lastError || new Error('Failed to send email after multiple attempts');
        }
      } catch (emailError) {
        console.error('❌ Fout bij verzenden email:', emailError);
        
        let errorMessage = emailError.message || 'Onbekende fout bij verzenden email';

        // Persist failure state for the response
        try {
          await supabaseAdmin
            .from('mail_responses')
            .update({ status: 'failed', draft_text: text })
            .eq('mail_id', id)
        } catch (_) {
          // ignore persistence failures here
        }
        
        // Check for Mailgun domain activation errors (421 response)
        // This happens when domain is not fully activated for sending, even if verified
        const isMailgunActivationError = (
          (errorMessage.includes('421') && errorMessage.includes('Domain')) ||
          (errorMessage.includes('Domain') && errorMessage.includes('is not allowed to send')) || 
          (errorMessage.includes('Please activate') && errorMessage.includes('Mailgun'))
        );
        
        // Check for Mailgun authentication errors (wrong credentials)
        const isMailgunAuthError = (
          errorMessage.includes('Invalid login') || 
          errorMessage.includes('535') || 
          errorMessage.includes('Authentication failed') ||
          errorMessage.includes('Invalid credentials')
        ) && !isMailgunActivationError;
        
        if (isMailgunActivationError || isMailgunAuthError) {
          let solutionText = '';
          
          if (isMailgunAuthError && !isMailgunActivationError) {
            solutionText = `⚠️ Mailgun Authenticatie Fout

De SMTP credentials zijn onjuist voor je Mailgun account.

✅ OPLOSSING:
1. Log in bij Mailgun: https://app.mailgun.com/
2. Ga naar Sending → Domain Settings → growsocialmedia.nl
3. Ga naar "SMTP credentials" sectie
4. Controleer:
   - SMTP Username: Dit is meestal "postmaster@growsocialmedia.nl" of je volledige email
   - SMTP Password: Dit is een speciale SMTP password (NIET je Mailgun login password!)
   
5. Kopieer deze credentials exact naar je mailbox instellingen in dit platform
6. Zorg dat je de juiste SMTP host gebruikt: smtp.eu.mailgun.org (voor EU) of smtp.mailgun.org
7. Gebruik poort 587 (STARTTLS) of 465 (SSL)

⚠️ LET OP: Mailgun heeft een apart SMTP password, niet je account login password!`;
          } else if (isMailgunActivationError) {
            solutionText = `⚠️ Mailgun Domein Niet Volledig Geactiveerd

Mailgun authenticatie werkt, maar het domein is niet geactiveerd voor verzenden.

✅ DETAILED OPLOSSING:
1. Log in bij Mailgun: https://app.mailgun.com/
2. Ga naar Sending → Domain Settings → growsocialmedia.nl
3. Check de EXACTE status:
   - Status moet "Active" of "Sending Domain" zijn (NIET alleen "Verified")
   - Als het zegt "Unverified" → Verifieer DNS records
   - Als het zegt "Verified" maar niet "Active" → Er is nog een stap nodig

4. Als status "Verified" maar niet "Active":
   - Check of je alle DNS records hebt geconfigureerd (SPF, DKIM, MX)
   - Wacht 15-30 minuten na DNS updates
   - Probeer "Resend verification email" als optie beschikbaar
   - Sommige Mailgun accounts vereisen manual approval voor nieuwe domeinen

5. Check de "from" email in gebruik:
   - Je verzendt vanaf: info@growsocialmedia.nl ✅
   - Check in Mailgun → Domain Settings → growsocialmedia.nl
   - Ga naar "Authorized Recipients" of "Authorized Senders" sectie
   - Zorg dat info@growsocialmedia.nl is geauthoriseerd om te verzenden
   - Sommige Mailgun accounts vereisen expliciete authorisatie per email adres
   
6. Test alternatief email adres:
   - Probeer eerst: postmaster@growsocialmedia.nl (vaak de default)
   - Update je mailbox instellingen met postmaster@growsocialmedia.nl als SMTP username
   - Als dat werkt, is info@growsocialmedia.nl mogelijk niet geauthoriseerd

7. Als alles correct lijkt:
   - Neem contact op met Mailgun Support
   - Vraag: "Domein growsocialmedia.nl is verified maar geeft 421 'not allowed to send' error. Wat is er nodig om het actief te maken?"
   - Vermeld dat SMTP authenticatie werkt maar DATA command faalt

7. ALTERNATIEF - Gebruik Mailgun API i.p.v. SMTP:
   - Mailgun API kan betrouwbaarder zijn dan SMTP voor nieuwe accounts
   - Check Mailgun dashboard → Settings → API Keys

🔍 DEBUG INFO:
- SMTP Auth werkt (connectie geverifieerd)
- Fout komt tijdens DATA command
- Dit wijst op domain policy, niet credentials

Technische fout: ${errorMessage}`;
          }
          
          errorMessage = solutionText;
        }
        
        // Check if it's an SPF error
        const isSpfError = !isMailgunActivationError && errorMessage && (
          errorMessage.includes('SPF') || 
          errorMessage.includes('554 5.7.1') ||
          errorMessage.includes('End-of-data rejected')
        );
        
        if (!isMailgunActivationError && !isSpfError) {
          errorMessage = 'Fout bij verzenden email: ' + errorMessage;
        }
        
        if (isSpfError) {
          // Detect server IP for better instructions
          const serverIp = process.env.SERVER_IP || 'ONBEKEND';
          
          errorMessage = `SPF Fout: Het SPF record blokkeert het verzenden van emails.

⚠️ HET PROBLEEM:
Je verzendt via Mijndomein SMTP (mail.mijndomein.nl), maar de ontvangende server checkt of jouw server IP (${serverIp}) is toegestaan in het SPF record van growsocialmedia.nl.

✅ OPLOSSING 1 - Update SPF Record in Mijndomein DNS (Aanbevolen):
1. Log in bij Mijndomein
2. Ga naar DNS Beheer voor growsocialmedia.nl
3. Zoek de TXT record met "v=spf1"
4. Update naar:
   v=spf1 include:spf.mijndomeinhosting.nl include:_spf.wpcloud.com ~all

   (Gebruik ~all in plaats van -all - dit geeft soft fail i.p.v. hard block)

✅ OPLOSSING 2 - Vraag Mijndomein Support:
Stel deze vraag aan Mijndomein:
"Welk SMTP host/poort moet ik gebruiken om emails te verzenden zonder SPF errors? Moet ik een specifieke relay gebruiken?"

✅ OPLOSSING 3 - Alternatieve SMTP Service:
Overweeg SendGrid, Mailgun of AWS SES als alternatief voor betrouwbare email delivery.

Technisch: ${emailError.message}`;
        }
        
        // Still mark as sent in our system, but log the error
        await supabaseAdmin
          .from('mail_responses')
          .update({ 
            last_error: errorMessage,
            status: 'error'
          })
          .eq('mail_id', id)
        
        return res.status(500).json({ 
          error: errorMessage,
          isSpfError: isSpfError,
          isMailgunActivationError: isMailgunActivationError // Frontend can use this to show better UI
        })
      }
    } else {
      console.log('⚠️ Geen mailbox configuratie gevonden, email niet verzonden via SMTP');
    }
    
    res.json({ success: true, message: 'Antwoord verzonden' })
  } catch (e) {
    console.error('Send reply error:', e);
    res.status(500).json({ error: 'Fout bij verzenden: ' + e.message })
  }
})

// ===== TICKETS ROUTES =====
router.get("/tickets", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const { status, priority, assigned_to, search } = req.query
    
    // Build query (customers: name, email only to avoid missing-column errors)
    let ticketQuery = supabaseAdmin
      .from('tickets')
      .select(`
        *,
        customers:customer_id(name, email),
        assignee:profiles!tickets_assignee_id_fkey(id, first_name, last_name, email)
      `)
      .order('created_at', { ascending: false })
    
    // Apply filters
    if (status && status !== 'all') {
      ticketQuery = ticketQuery.eq('status', status)
    }
    if (priority && priority !== 'all') {
      ticketQuery = ticketQuery.eq('priority', priority)
    }
    if (assigned_to && assigned_to !== 'all') {
      if (assigned_to === 'unassigned') {
        ticketQuery = ticketQuery.is('assignee_id', null)
      } else {
        ticketQuery = ticketQuery.eq('assignee_id', assigned_to)
      }
    }
    if (search && search.trim()) {
      ticketQuery = ticketQuery.or(`subject.ilike.%${search}%,ticket_number.ilike.%${search}%,description.ilike.%${search}%`)
    }
    
    const { data: tickets, error: ticketsError } = await ticketQuery
    
    // Fetch creator data separately if tickets exist
    if (tickets && tickets.length > 0 && !ticketsError) {
      const creatorIds = [...new Set(tickets.map(t => t.created_by).filter(Boolean))]
      if (creatorIds.length > 0) {
        const { data: creators } = await supabaseAdmin
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', creatorIds)
        
        const creatorMap = {}
        creators?.forEach(c => { creatorMap[c.id] = c })
        
        tickets.forEach(ticket => {
          if (ticket.created_by && creatorMap[ticket.created_by]) {
            ticket.creator = creatorMap[ticket.created_by]
          }
        })
      }
    }
    
    if (ticketsError) throw ticketsError
    
    // Get KPI stats
    const { count: totalTickets } = await supabaseAdmin
      .from('tickets')
      .select('id', { count: 'exact', head: true })
    
    const { count: openTickets } = await supabaseAdmin
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')
    
    const { count: inProgressTickets } = await supabaseAdmin
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'in_progress')
    
    const { count: urgentTickets } = await supabaseAdmin
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('priority', 'urgent')
    
    // Get all admins for assignment dropdown
    const { data: admins } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email')
      .eq('is_admin', true)
    
    res.render('admin/tickets', {
      title: 'Tickets',
      activeMenu: 'tickets',
      user: req.user,
      tickets: tickets || [],
      kpis: {
        total: totalTickets || 0,
        open: openTickets || 0,
        in_progress: inProgressTickets || 0,
        urgent: urgentTickets || 0
      },
      admins: admins || [],
      filters: {
        status: status || 'all',
        priority: priority || 'all',
        assigned_to: assigned_to || 'all',
        search: search || ''
      },
      scripts: ['/js/admin/tickets.js'],
      stylesheets: ['/css/admin/adminPayments.css', '/css/admin/payments-table.css', '/css/admin/tickets.css']
    })
  } catch (err) {
    console.error('Admin tickets route error:', err)
    res.status(500).render('error', { message: 'Kon tickets niet laden', error: {}, user: req.user })
  }
})

// Single ticket detail page
router.get("/tickets/:id", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const { id } = req.params
    if (!id || id === 'undefined') {
      return res.status(404).render('error', {
        message: 'Ticket niet gevonden',
        error: {},
        user: req.user
      })
    }

    // Get ticket with relations (customers: id, name, email only to avoid missing-column errors)
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .select(`
        *,
        customers:customer_id(id, name, email),
        assignee:assignee_id(id, first_name, last_name, email),
        creator:created_by(id, first_name, last_name, email)
      `)
      .eq('id', id)
      .single()

    if (ticketError) {
      console.error('Admin ticket detail Supabase error:', ticketError.message, { id })
    }
    if (ticketError || !ticket) {
      return res.status(404).render('error', {
        message: 'Ticket niet gevonden',
        error: {},
        user: req.user
      })
    }
    
    // Check permissions
    const isUserAdmin = req.user?.user_metadata?.is_admin === true || req.user?.is_admin === true
    if (!isUserAdmin && ticket.assignee_id !== req.user?.id) {
      // Check if user has support role
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('roles(name)')
        .eq('id', req.user.id)
        .single()
      
      if (!profile?.roles?.name?.toLowerCase().includes('support')) {
        return res.status(403).render('error', {
          message: 'Geen toegang tot dit ticket',
          error: {},
          user: req.user
        })
      }
    }
    
    // Get employees for assignment dropdown
    const { data: employees } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email, is_admin')
      .or('is_admin.eq.true,roles.name.ilike.%support%')
      .order('first_name', { ascending: true })
    
    res.render('admin/ticket-detail', {
      title: ticket.subject + ' - Tickets | GrowSocial Admin',
      activeMenu: 'tickets',
      user: req.user,
      isUserAdmin,
      ticket,
      employees: employees || [],
      showBackButton: true,
      backButtonUrl: '/admin/tickets',
      backButtonText: 'Terug naar tickets',
      stylesheets: ['/css/admin/users.css', '/css/admin/employee-detail.css', '/css/admin/tickets.css'],
      scripts: ['/js/admin/ticket-detail.js']
    })
  } catch (err) {
    console.error('Admin ticket detail route error:', err)
    res.status(500).render('error', { 
      message: 'Kon ticket niet laden', 
      error: {}, 
      user: req.user 
    })
  }
})

// ===== EMPLOYEES ROUTES =====
router.get("/employees", requireAuth, isManagerOrAdmin, async (req, res) => {
  console.log('🚀 EMPLOYEES ROUTE CALLED - Starting...');
  try {
    const { search, status, role } = req.query
    console.log('🚀 EMPLOYEES ROUTE - Query params:', { 
      search: search || '(none)', 
      status: status || '(none)', 
      role: role || '(none)' 
    });
    
    // Fetch all profiles first
    const { data: allProfiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, first_name, last_name, company_name, role_id, is_admin, status, created_at, last_login')
      .order('created_at', { ascending: false })
    
    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError);
      // Don't return empty array on error, log it but continue
    }
    
    console.log(`📊 Fetched ${allProfiles?.length || 0} total profiles from database`);
    
    // Fetch roles to filter out customers/consumers (using cache)
    const { getRoleMap } = require('../utils/roleCache');
    const { roleMap: roleMapRaw, roleDisplayMap, roles: allRoles } = await getRoleMap();
    
    // Normalize role map to lowercase for matching
    const roleMap = {};
    Object.entries(roleMapRaw).forEach(([roleId, roleName]) => {
      roleMap[String(roleId).toLowerCase()] = roleName?.toLowerCase() || '';
    });
    
    console.log(`📋 Loaded ${allRoles?.length || 0} roles from cache`);
    
    console.log(`📋 Role map created with ${Object.keys(roleMap).length} roles`);
    if (Object.keys(roleMap).length > 0) {
      console.log(`   Sample role mappings:`, Object.entries(roleMap).slice(0, 5).map(([id, name]) => {
        const displayName = roleDisplayMap[id] || 'NULL';
        return `${id.substring(0, 8)}...=${name} (display: ${displayName})`;
      }).join(', '));
    }
    
    // Debug: Log all profiles with their role_id before filtering
    console.log(`🔍 All profiles before filtering (first 10):`);
    (allProfiles || []).slice(0, 10).forEach(profile => {
      const roleName = profile.role_id ? (roleMap[String(profile.role_id)] || 'NOT FOUND IN MAP') : 'NO ROLE_ID';
      console.log(`   - ${profile.email}: role_id=${profile.role_id || 'NULL'}, roleName="${roleName}", is_admin=${profile.is_admin}`);
    });
    
    // Filter to only show employees (not customers/consumers)
    // Employees are: admins OR profiles with employee roles OR profiles without customer/consumer roles
    const employees = (allProfiles || []).filter(profile => {
      // Admins are always shown
      if (profile.is_admin === true) {
        return true;
      }
      
      // If profile has a role_id, check if it's not a customer/consumer role
      if (profile.role_id) {
        const roleName = roleMap[String(profile.role_id)] || '';
        
        // If role not found in map, it might be a new role - include it (safer)
        if (!roleName) {
          console.log(`⚠️ Profile ${profile.email}: role_id=${profile.role_id} not found in roleMap, including anyway`);
          return true;
        }
        
        // Exclude customer, consumer, klant roles
        if (roleName === 'customer' || roleName === 'consumer' || roleName === 'klant') {
          return false;
        }
        // Include all other roles (employee, admin, manager, etc.)
        return true;
      }
      
      // If no role_id and not admin, include it (backward compatibility)
      // This ensures newly created employees without a role_id still show up
      return true;
    });
    
    console.log(`📊 Filter result: ${allProfiles?.length || 0} total profiles → ${employees.length} employees`);
    
    // Helper function to format role names (snake_case to Title Case)
    const formatRoleName = (name) => {
      if (!name) return 'Onbekend';
      // Format the name: replace underscores with spaces and capitalize words
      return name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    };
    
    // Add role name to each employee for display
    const employeesWithRoles = employees.map(employee => {
      let roleName = null;
      let roleDisplayName = null;
      
      // Debug: Log employee role_id before processing
      console.log(`🔍 Processing employee ${employee.email}: role_id=${employee.role_id} (type: ${typeof employee.role_id})`);
      
      if (employee.role_id) {
        // Normalize role_id to lowercase string for comparison
        const employeeRoleId = String(employee.role_id).toLowerCase();
        const roleNameLower = roleMap[employeeRoleId] || '';
        roleName = roleNameLower;
        
        console.log(`   Role map lookup: role_id="${employeeRoleId}" -> roleName="${roleNameLower}"`);
        
        // Try to get display_name from roleDisplayMap first (faster)
        const displayNameFromMap = roleDisplayMap[employeeRoleId];
        if (displayNameFromMap && displayNameFromMap.trim().length > 0) {
          roleDisplayName = displayNameFromMap.trim();
          console.log(`   ✅ Found display_name in map: "${roleDisplayName}"`);
        } else {
          // Fallback: Find the full role object to get display_name
          const roleObj = allRoles?.find(r => {
            const roleIdStr = String(r.id).toLowerCase();
            return roleIdStr === employeeRoleId;
          });
          
          if (roleObj) {
            console.log(`   ✅ Found role object: id=${roleObj.id}, name=${roleObj.name}, display_name=${roleObj.display_name || 'NULL'}`);
            
            // Use display_name if available and not empty, otherwise format the name
            if (roleObj.display_name && roleObj.display_name.trim().length > 0) {
              roleDisplayName = roleObj.display_name.trim();
              console.log(`   ✅ Using display_name from object: "${roleDisplayName}"`);
            } else {
              roleDisplayName = formatRoleName(roleObj.name);
              console.log(`   ⚠️ display_name is empty/null, using formatted name: "${roleDisplayName}"`);
            }
          } else {
            console.log(`   ❌ Role object NOT FOUND in allRoles array`);
            console.log(`   Employee role_id (lowercase): "${employeeRoleId}"`);
            console.log(`   Available role IDs in allRoles (first 5):`, allRoles?.slice(0, 5).map(r => String(r.id).toLowerCase()));
            
            if (roleNameLower) {
              roleDisplayName = formatRoleName(roleNameLower);
              console.log(`   ⚠️ Using formatted name from roleMap: "${roleDisplayName}"`);
            } else {
              console.log(`   ❌ No role name found in roleMap either`);
            }
          }
        }
      } else {
        console.log(`   ⚠️ No role_id for ${employee.email}`);
      }
      
      const result = {
        ...employee,
        role_name: roleName,
        role_display_name: roleDisplayName || 'Werknemer'
      };
      
      console.log(`   📤 Final result for ${employee.email}: role_display_name="${result.role_display_name}"`);
      
      return result;
    });
    
    // Debug: Log all employees with their role_display_name
    console.log('🔍 All employees with roles:');
    employeesWithRoles.forEach((emp, idx) => {
      console.log(`   ${idx + 1}. ${emp.email}: role_id=${emp.role_id}, role_display_name="${emp.role_display_name}"`);
    });
    
    console.log(`✅ Fetched ${allProfiles?.length || 0} total profiles, filtered to ${employees.length} employees`);
    
    // Calculate useful KPIs
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const totalEmployees = employees.length;
    
    // Get leads/opportunities data for performance metrics
    const employeeIds = employees.map(e => e.id);
    let leadsByEmployee = {};
    let bestPerformer = null;
    
    if (employeeIds.length > 0) {
      // Get leads assigned to employees
      const { data: leads } = await supabaseAdmin
        .from('leads')
        .select('user_id, status, price_at_purchase, created_at')
        .in('user_id', employeeIds)
        .gte('created_at', startOfMonth.toISOString());
      
      // Count leads and calculate revenue per employee
      leadsByEmployee = {};
      if (leads) {
        leads.forEach(lead => {
          if (!leadsByEmployee[lead.user_id]) {
            leadsByEmployee[lead.user_id] = {
              leadsCount: 0,
              revenue: 0,
              wonCount: 0
            };
          }
          leadsByEmployee[lead.user_id].leadsCount++;
          if (lead.price_at_purchase) {
            leadsByEmployee[lead.user_id].revenue += parseFloat(lead.price_at_purchase) || 0;
          }
          if (lead.status === 'won' || lead.status === 'completed') {
            leadsByEmployee[lead.user_id].wonCount++;
          }
        });
      }
      
      // Find best performer (highest revenue this month)
      let maxRevenue = 0;
      employees.forEach(emp => {
        const stats = leadsByEmployee[emp.id] || { revenue: 0, leadsCount: 0, wonCount: 0 };
        if (stats.revenue > maxRevenue) {
          maxRevenue = stats.revenue;
          bestPerformer = {
            name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email || 'Onbekend',
            revenue: stats.revenue,
            leads: stats.leadsCount,
            won: stats.wonCount
          };
        }
      });
    }
    
    // Recently active (logged in within last 7 days)
    const recentlyActive = employees.filter(e => {
      if (!e.last_login) return false;
      const lastLogin = new Date(e.last_login);
      return lastLogin >= sevenDaysAgo;
    }).length;
    
    // Needs attention (inactive, or no recent activity)
    // Note: email_confirmed_at doesn't exist in profiles table, so we skip email verification check
    const needsAttention = employees.filter(e => {
      const isInactive = e.status === 'inactive';
      const noRecentActivity = !e.last_login || new Date(e.last_login) < sevenDaysAgo;
      return isInactive || noRecentActivity;
    }).length;
    
    console.log('📊 KPIs calculated:', {
      total: totalEmployees,
      bestPerformer: bestPerformer?.name || 'Geen',
      recentlyActive: recentlyActive,
      needsAttention: needsAttention
    });
    
    // Filter employees based on search and status (employeesWithRoles is already created above)
    let employeesToRender = employeesWithRoles;
    
    console.log(`📊 Before filtering: ${employeesToRender.length} employees`);
    
    // Debug: Log status distribution
    const statusCounts = {};
    employeesToRender.forEach(e => {
      const s = e.status || 'active';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });
    console.log(`📊 Status distribution:`, statusCounts);
    
    if (search) {
      const searchLower = search.toLowerCase();
      const beforeCount = employeesToRender.length;
      employeesToRender = employeesToRender.filter(e => 
        (e.email && e.email.toLowerCase().includes(searchLower)) ||
        (e.first_name && e.first_name.toLowerCase().includes(searchLower)) ||
        (e.last_name && e.last_name.toLowerCase().includes(searchLower)) ||
        (e.company_name && e.company_name.toLowerCase().includes(searchLower))
      );
      console.log(`🔍 Search filter "${search}": ${beforeCount} → ${employeesToRender.length} employees`);
    }
    
    if (status && status !== 'all') {
      console.log(`🔍 Filtering by status: "${status}"`);
      const beforeCount = employeesToRender.length;
      
      if (status === 'active') {
        employeesToRender = employeesToRender.filter(e => {
          const empStatus = e.status || 'active'; // Default to 'active' if null
          return empStatus === 'active';
        });
      } else if (status === 'inactive') {
        employeesToRender = employeesToRender.filter(e => {
          const empStatus = e.status || 'active'; // Default to 'active' if null
          const isInactive = empStatus === 'inactive';
          if (isInactive) {
            console.log(`   ✅ Included ${e.email}: status="${empStatus}"`);
          }
          return isInactive;
        });
      }
      
      const afterCount = employeesToRender.length;
      console.log(`📊 Status filter "${status}": ${beforeCount} → ${afterCount} employees`);
    }
    
    // Filter by role
    if (role && role !== 'all') {
      const beforeCount = employeesToRender.length;
      employeesToRender = employeesToRender.filter(e => {
        return e.role_id && String(e.role_id) === String(role);
      });
      console.log(`🔍 Role filter "${role}": ${beforeCount} → ${employeesToRender.length} employees`);
    }
    
    console.log(`📊 Final result: ${employeesToRender.length} employees to render`);
    
    // Debug: Verify that role_display_name is still present after filtering
    if (employeesToRender.length > 0) {
      console.log('🔍 First employee in employeesToRender:', {
        email: employeesToRender[0].email,
        role_id: employeesToRender[0].role_id,
        role_display_name: employeesToRender[0].role_display_name,
        has_role_display_name: !!employeesToRender[0].role_display_name,
        all_keys: Object.keys(employeesToRender[0])
      });
    }
    
    // Use allRoles that was already fetched earlier in the route
    const roles = allRoles || [];
    
    console.log('🔍 Using allRoles for template:', roles.length, 'roles');
    
    const rolesToPass = roles || []
    console.log('📤 Passing roles to template:', rolesToPass.length, 'roles')
    if (rolesToPass.length > 0) {
      console.log('📤 First role example:', JSON.stringify(rolesToPass[0]))
    } else {
      console.log('⚠️ WARNING: No roles to pass to template!')
      console.log('⚠️ allRoles variable:', allRoles)
    }
    
    // Build roles options HTML in the route to avoid template scope issues
    // Filter out system roles that shouldn't be assigned to employees (like 'consumer', 'customer')
    const employeeRoles = rolesToPass.filter(role => {
      const name = role.name?.toLowerCase() || '';
      // Exclude consumer/customer roles - these are for end users, not employees
      return name !== 'consumer' && name !== 'customer';
    });
    
    let rolesOptionsHtml = '';
    if (employeeRoles && employeeRoles.length > 0) {
      employeeRoles.forEach((role) => {
        const isSelected = role.name === 'employee' ? ' selected' : '';
        // Use display_name from database if available, otherwise format the name
        const displayName = role.display_name && role.display_name.trim().length > 0
          ? role.display_name.trim()
          : formatRoleName(role.name);
        rolesOptionsHtml += `<option value="${role.id}"${isSelected}>${displayName}</option>`;
      });
      console.log('✅ Built roles HTML with', employeeRoles.length, 'options (filtered from', rolesToPass.length, 'total)');
      console.log('📝 Sample display names:', employeeRoles.slice(0, 3).map(r => `${r.name} -> ${r.display_name || formatRoleName(r.name)}`).join(', '));
    } else {
      rolesOptionsHtml = '<option value="">Geen rollen beschikbaar</option>';
      console.log('⚠️ No roles to build HTML from');
    }
    
    console.log('🎯 About to render with rolesOptionsHtml length:', rolesOptionsHtml.length);
    
    // Get user admin status for navigation
    let isUserAdmin = req.user?.user_metadata?.is_admin === true;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', req.user.id)
        .single();
      
      if (profile?.is_admin) {
        isUserAdmin = true;
      }
    } catch (roleErr) {
      console.log('Error fetching user admin status:', roleErr);
    }
    
    res.render('admin/employees', {
      title: 'Werknemers',
      activeMenu: 'employees',
      user: req.user,
      isUserAdmin: isUserAdmin,
      employees: employeesToRender,
      roles: rolesToPass,
      rolesList: rolesToPass,
      rolesOptionsHtml: rolesOptionsHtml, // Pre-built HTML
      kpis: {
        total: totalEmployees || 0,
        bestPerformer: bestPerformer,
        recentlyActive: recentlyActive || 0,
        needsAttention: needsAttention || 0
      },
      filters: {
        status: status || 'all',
        role: role || 'all',
        search: search || ''
      },
      stylesheets: ['/css/opportunities.css', '/css/admin/users.css', '/css/admin/employees-drawer.css'],
      scripts: ['/js/admin/employeesDrawer.js', '/js/admin/employees.js']
    })
  } catch (err) {
    console.error('Admin employees route error:', err)
    res.status(500).render('error', { message: 'Kon werknemers niet laden', error: {}, user: req.user })
  }
})

// Single task page - MUST be before /tasks route to avoid conflicts
router.get('/tasks/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user?.user_metadata?.is_admin || false;
    const currentUserId = req.user?.id;

    // Get task with relations
    const { data: task, error } = await supabaseAdmin
      .from('employee_tasks')
      .select(`
        *,
        employee:profiles!employee_tasks_employee_id_fkey(id, first_name, last_name, email),
        customer:profiles!employee_tasks_customer_id_fkey(id, first_name, last_name, company_name, email, domain)
      `)
      .eq('id', id)
      .single();

    if (error || !task) {
      return res.status(404).render('error', {
        message: 'Taak niet gevonden',
        error: {},
        user: req.user
      });
    }

    // Check permissions
    if (!isAdmin && task.employee_id !== currentUserId) {
      // Check if user is manager of the employee
      const { data: employee } = await supabaseAdmin
        .from('profiles')
        .select('manager_id')
        .eq('id', task.employee_id)
        .single();
      
      if (employee?.manager_id !== currentUserId) {
        return res.status(403).render('error', {
          message: 'Geen toegang',
          error: {},
          user: req.user
        });
      }
    }

    // Get time entries for this task
    const { data: timeEntries } = await supabaseAdmin
      .from('time_entries')
      .select(`
        *,
        employee:profiles!time_entries_employee_id_fkey(id, first_name, last_name, email)
      `)
      .eq('task_id', id)
      .order('start_at', { ascending: false });

    // Calculate total time
    const totalMinutes = timeEntries?.reduce((sum, e) => sum + (e.duration_minutes || 0), 0) || 0;
    const totalHours = Math.floor(totalMinutes / 60);
    const totalMins = totalMinutes % 60;

    res.render('admin/task', {
      title: `${task.title} - Taken | GrowSocial Admin`,
      activeMenu: 'tasks',
      user: req.user,
      task: {
        ...task,
        timeEntries: timeEntries || [],
        totalMinutes,
        totalHours,
        totalMins
      }
    });
  } catch (err) {
    console.error('Error loading task:', err);
    res.status(500).render('error', {
      message: 'Er is een fout opgetreden bij het laden van de taak',
      error: {},
      user: req.user
    });
  }
});

// Shared helper: get employees + customers for task drawer (used by tasks page and by drawer when opened from other pages)
async function getTaskDrawerData(req) {
  const isAdmin = req.user?.user_metadata?.is_admin || false;
  const currentUserId = req.user?.id;
  let isManager = false;
  if (req.user?.role_id) {
    const { data: role } = await supabaseAdmin
      .from('roles')
      .select('name')
      .eq('id', req.user.role_id)
      .maybeSingle();
    if (role?.name?.toLowerCase().includes('manager')) {
      isManager = true;
    }
  }
  const canViewAll = isAdmin || isManager;

  let employees = [];
  if (canViewAll) {
    const [profilesResult, rolesResult] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, email, role_id, employee_status, is_admin')
        .order('first_name'),
      Promise.resolve().then(async () => {
        const { getRoleMap } = require('../utils/roleCache');
        return await getRoleMap();
      })
    ]);
    const { data: allProfiles, error: profilesError } = profilesResult;
    const { roleMap: roleMapRaw } = rolesResult || {};
    if (profilesError) console.error('Error fetching profiles:', profilesError);
    const roleMap = {};
    Object.entries(roleMapRaw || {}).forEach(([roleId, roleName]) => {
      roleMap[String(roleId)] = (roleName || '').toLowerCase();
    });
    const customerRoleId = '873fe734-197d-41a0-828b-31ced55e6695';
    const consumerRoleId = '58e20673-a6c1-4f48-9633-2462f4a124db';
    const filtered = (allProfiles || []).filter(profile => {
      if (profile.role_id) {
        const rid = String(profile.role_id);
        if (rid === customerRoleId || rid === consumerRoleId) return false;
        const rn = roleMap[rid] || '';
        if (['customer', 'consumer', 'klant'].includes(rn)) return false;
      }
      if (profile.is_admin === true) return true;
      if (profile.employee_status === 'active' || profile.employee_status === 'paused') return true;
      if (profile.role_id && roleMap[String(profile.role_id)]) return true;
      return false;
    });
    employees = filtered.map(emp => ({ id: emp.id, first_name: emp.first_name, last_name: emp.last_name, email: emp.email }));
  } else {
    const { data: empData } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email')
      .eq('id', currentUserId);
    employees = empData || [];
  }

  const { data: customers } = await supabaseAdmin
    .from('customers')
    .select('id, name, company_name, email')
    .order('company_name', { ascending: true })
    .order('name', { ascending: true });

  return { canViewAll, currentUserId, employees: employees || [], customers: customers || [] };
}

// API: task drawer data (for opening drawer from time-tracker etc. without full page load)
router.get('/api/tasks/drawer-data', requireAuth, async (req, res) => {
  try {
    const data = await getTaskDrawerData(req);
    res.json({ ok: true, ...data });
  } catch (err) {
    console.error('Error fetching task drawer data:', err);
    res.status(500).json({ ok: false, error: 'Kon gegevens niet laden' });
  }
});

// Tasks overview page - MUST be before /employees/:id to avoid route conflicts
router.get('/tasks', requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user?.user_metadata?.is_admin || false;
    const currentUserId = req.user?.id;
    
    // Determine if user is a manager
    let isManager = false;
    if (req.user?.role_id) {
      const { data: role } = await supabaseAdmin
        .from('roles')
        .select('name')
        .eq('id', req.user.role_id)
        .maybeSingle();
      if (role?.name?.toLowerCase().includes('manager')) {
        isManager = true;
      }
    }

    const canViewAll = isAdmin || isManager;
    const { status, employee_id, priority, view } = req.query;
    
    // Build query based on permissions
    let query = supabaseAdmin
      .from('employee_tasks')
      .select('*, employee:profiles!employee_tasks_employee_id_fkey(id, first_name, last_name, email, manager_id), customer:profiles!employee_tasks_customer_id_fkey(id, first_name, last_name, company_name)')
      .order('created_at', { ascending: false });

    // Employees can only see: own tasks, team tasks (where they are manager), and project tasks
    if (!canViewAll) {
      // Get employees that report to this user (if they are a manager)
      const { data: teamMembers } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('manager_id', currentUserId);
      
      const teamMemberIds = teamMembers?.map(m => m.id) || [];
      
      // Filter: own tasks OR team member tasks OR tasks assigned to projects they're on
      query = query.or(`employee_id.eq.${currentUserId},employee_id.in.(${teamMemberIds.join(',')})`);
    }

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (employee_id && canViewAll) {
      query = query.eq('employee_id', employee_id);
    }
    if (priority) {
      query = query.eq('priority', priority);
    }

    const { data: tasks, error } = await query;

    if (error) throw error;

    const drawerData = await getTaskDrawerData(req);
    const employees = drawerData.employees;
    const customers = drawerData.customers;

    // Get contacts for task creation
    const { data: contacts } = await supabaseAdmin
      .from('contacts')
      .select('id, name, first_name, last_name, email, customer_id')
      .order('name', { ascending: true })
      .limit(500);
    
    // Get user's customer if they belong to one
    let userCustomer = null;
    if (req.user?.id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('customer_id')
        .eq('id', req.user.id)
        .maybeSingle();
      
      if (profile?.customer_id) {
        const { data: customer } = await supabaseAdmin
          .from('customers')
          .select('id, name, company_name')
          .eq('id', profile.customer_id)
          .maybeSingle();
        userCustomer = customer;
      }
    }

    // Get KPI data (only for managers+)
    // Calculate KPI based on the SAME filtered tasks that are shown in the views
    let kpiData = null;
    if (canViewAll) {
      // Use the same filtered tasks that are displayed
      const now = new Date();
      const totalTasks = tasks?.length || 0;
      const inProgress = tasks?.filter(t => t.status === 'in_progress').length || 0;
      const completed = tasks?.filter(t => t.status === 'done').length || 0;
      const overdue = tasks?.filter(t => 
        t.due_at && 
        new Date(t.due_at) < now && 
        !['done', 'rejected'].includes(t.status)
      ).length || 0;

      kpiData = {
        total: totalTasks,
        inProgress,
        completed,
        overdue
      };
    }


    res.render('admin/tasks', {
      title: 'Taken',
      activeMenu: 'tasks',
      user: req.user,
      isUserAdmin: isAdmin,
      isManager: isManager,
      canViewAll: canViewAll,
      tasks: tasks || [],
      employees: employees || [],
      customers: customers || [],
      contacts: contacts || [],
      userCustomer: userCustomer,
      filters: { status, employee_id, priority },
      view: view || 'board',
      kpiData: kpiData
    });
  } catch (err) {
    console.error('Error loading tasks:', err);
    res.status(500).render('error', {
      message: 'Kon taken niet laden',
      error: {},
      user: req.user
    });
  }
});

// Time entries overview page - MUST be before /employees/:id to avoid route conflicts
// Supports both admin view and employee's own view
router.get('/time-entries', requireAuth, async (req, res) => {
  try {
    const { employee_id } = req.query;
    const isAdmin = req.user?.user_metadata?.is_admin || false;
    const currentUserId = req.user?.id;
    
    // Determine which employee to view
    const viewingEmployeeId = employee_id || currentUserId;
    const isOwnPage = viewingEmployeeId === currentUserId;
    
    // Permission check: employees can only view their own page unless admin
    if (!isOwnPage && !isAdmin) {
      return res.status(403).render('error', {
        message: 'Geen toegang',
        error: {},
        user: req.user
      });
    }

    // Get customers (for dropdowns)
    const { data: customers } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email, company_name')
      .or('role_id.is.null,role_id.not.is.null') // Get all profiles that could be customers
      .order('company_name, first_name');

    // Get contacts (for dropdowns)
    const { data: contacts } = await supabaseAdmin
      .from('contacts')
      .select('id, first_name, last_name, email, customer_id')
      .order('first_name, last_name');

    // Get tasks for this employee with customer and contact info
    const { data: tasks } = await supabaseAdmin
      .from('employee_tasks')
      .select(`
        id, 
        title, 
        status,
        customer_id,
        contact_id,
        customer:profiles!employee_tasks_customer_id_fkey(id, company_name, first_name, last_name, email),
        contact:contacts!employee_tasks_contact_id_fkey(id, first_name, last_name, email, customer_id)
      `)
      .eq('employee_id', viewingEmployeeId)
      .in('status', ['open', 'in_progress', 'in_review'])
      .order('title');

    // Get all employees for admin filter
    let employees = [];
    if (isAdmin) {
      const { data: empData } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('is_admin', false)
        .order('first_name');
      employees = empData || [];
    }

    // Check if user is manager or admin
    let isManager = false;
    if (!isAdmin && req.user?.role_id) {
      const { data: role } = await supabaseAdmin
        .from('roles')
        .select('name')
        .eq('id', req.user.role_id)
        .maybeSingle();
      
      if (role?.name) {
        const roleName = role.name.toLowerCase();
        isManager = roleName.includes('manager');
      }
    }
    const canViewAll = isAdmin || isManager;

    res.render('admin/time-tracking', {
      title: 'Tijdregistratie',
      activeMenu: 'time-entries',
      user: req.user,
      isUserAdmin: isAdmin,
      isManager: isManager,
      canViewAll: canViewAll,
      employee_id: viewingEmployeeId,
      customers: customers || [],
      contacts: contacts || [],
      tasks: tasks || [],
      employees: employees
    });
  } catch (err) {
    console.error('Error loading time tracking page:', err);
    res.status(500).render('error', {
      message: 'Kon tijdregistratie pagina niet laden',
      error: {},
      user: req.user
    });
  }
});

// Payroll overview page
router.get('/payroll', requireAuth, isAdmin, async (req, res) => {
  try {
    const { status, employee_id } = req.query;
    
    let query = supabaseAdmin
      .from('payout_batches')
      .select(`
        *,
        created_by_profile:profiles!payout_batches_created_by_fkey(id, first_name, last_name, email),
        approved_by_profile:profiles!payout_batches_approved_by_fkey(id, first_name, last_name, email),
        items:payout_items(
          *,
          employee:profiles!payout_items_employee_id_fkey(id, first_name, last_name, email)
        )
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: batches, error } = await query;

    if (error) throw error;

    // Filter by employee if specified
    let filteredBatches = batches || [];
    if (employee_id && batches) {
      filteredBatches = batches.filter(batch => 
        batch.items?.some(item => item.employee_id === employee_id)
      );
    }

    // Get payroll scales
    const { data: scales } = await supabaseAdmin
      .from('payroll_scales')
      .select('*')
      .order('hourly_rate_cents', { ascending: false });

    // Get all employees for filter
    const { data: employees } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email')
      .eq('is_admin', false)
      .order('first_name');

    res.locals.activeSubmenu = 'payroll';
    res.render('admin/employees-payroll', {
      title: 'Payroll',
      activeMenu: 'employees',
      activeSubmenu: 'payroll',
      user: req.user,
      isUserAdmin: true,
      batches: filteredBatches || [],
      employees: employees || [],
      scales: scales || [],
      filters: { status, employee_id }
    });
  } catch (err) {
    console.error('Error loading payroll:', err);
    res.status(500).render('error', {
      message: 'Kon payroll niet laden',
      error: {},
      user: req.user
    });
  }
});

// Single employee page - must be after /employees route
router.get('/employees/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    console.log(`🔍 Admin single employee route called for ID: ${id}`)

    // Get employee from profiles table
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, first_name, last_name, role_id, manager_id, hourly_rate_cents, employee_status, is_admin, status, phone, company_name, created_at, last_login, contract_document_url, contract_document_name, payroll_scale_id, profile_picture')
      .eq('id', id)
      .single()

    if (profileError || !profileData) {
      console.error('❌ Error getting employee profile:', profileError)
      return res.status(404).render('error', {
        message: 'Werknemer niet gevonden',
        error: {},
        user: req.user
      })
    }

    // Get auth user data for additional info
    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(id)
    const authUser = authData?.user

    // Get role display name
    let roleDisplayName = 'Werknemer';
    let roleName = 'employee';
    if (profileData.role_id) {
      const { data: roleData } = await supabaseAdmin
        .from('roles')
        .select('name, display_name')
        .eq('id', profileData.role_id)
        .maybeSingle();
      
      if (roleData) {
        roleDisplayName = roleData.display_name || roleData.name || 'Werknemer';
        roleName = roleData.name || 'employee';
      }
    }

    // Get manager info if exists
    let manager = null;
    if (profileData.manager_id) {
      const { data: mgr } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('id', profileData.manager_id)
        .maybeSingle();
      
      if (mgr) {
        manager = {
          id: mgr.id,
          name: `${mgr.first_name || ''} ${mgr.last_name || ''}`.trim() || mgr.email
        };
      }
    }

    // Get payroll scale info if exists
    let payrollScale = null;
    if (profileData.payroll_scale_id) {
      const { data: scale } = await supabaseAdmin
        .from('payroll_scales')
        .select('id, name, hourly_rate_cents, description')
        .eq('id', profileData.payroll_scale_id)
        .maybeSingle();
      
      if (scale) {
        payrollScale = scale;
      }
    }

    // Build minimal employee object - frontend loads data via API
    const firstName = profileData.first_name || ''
    const lastName = profileData.last_name || ''
    const fullName = `${firstName} ${lastName}`.trim() || profileData.email || 'Onbekend'
    
    const employee = {
      id: profileData.id,
      name: fullName,
      first_name: firstName,
      last_name: lastName,
      email: profileData.email || '',
      phone: profileData.phone || '',
      role: roleDisplayName,
      role_name: roleName,
      role_id: profileData.role_id,
      manager_id: profileData.manager_id,
      manager: manager,
      hourly_rate_cents: profileData.hourly_rate_cents || 0,
      employee_status: profileData.employee_status || 'active',
      status: profileData.status || 'active',
      is_admin: profileData.is_admin || false,
      company_name: profileData.company_name || '',
      created_at: profileData.created_at,
      last_login: profileData.last_login,
      contract_document_url: profileData.contract_document_url || null,
      contract_document_name: profileData.contract_document_name || null,
      payroll_scale_id: profileData.payroll_scale_id || null,
      payroll_scale: payrollScale,
      profile_picture: profileData.profile_picture || null
    }

    // Get user admin status for navigation
    let isUserAdmin = req.user?.user_metadata?.is_admin === true;
    let isUserManager = false;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, role_id')
        .eq('id', req.user.id)
        .single();
      
      if (profile?.is_admin) {
        isUserAdmin = true;
      }
      
      // Check if user is manager
      if (profile?.role_id) {
        const { data: role } = await supabaseAdmin
          .from('roles')
          .select('name')
          .eq('id', profile.role_id)
          .maybeSingle();
        if (role?.name?.toLowerCase().includes('manager')) {
          isUserManager = true;
        }
      }
    } catch (roleErr) {
      console.log('Error fetching user admin status:', roleErr);
    }
    
    const canEditSalary = isUserAdmin || isUserManager;
    const canEditEmployee = isUserAdmin || isUserManager;
    
    res.render('admin/employee-detail-new', {
      title: (employee.first_name && employee.last_name) 
        ? (employee.first_name + ' ' + employee.last_name) 
        : employee.name || employee.email || 'Werknemer',
      activeMenu: 'employees',
      employee,
      user: req.user,
      isUserAdmin: isUserAdmin,
      isUserManager: isUserManager,
      canEditSalary: canEditSalary,
      canEditEmployee: canEditEmployee,
      stylesheets: ['/css/admin/users.css', '/css/admin/employee-detail.css'],
      scripts: ['/js/admin/employee-detail.js']
    })
  } catch (err) {
    console.error('❌ Admin employee detail route error:', err)
    res.status(500).render('error', {
      message: 'Kon werknemer niet laden',
      error: {},
      user: req.user
    })
  }
})

// Update employee skills
router.post('/api/employees/:id/skills', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { skills } = req.body;

    if (!Array.isArray(skills)) {
      return res.status(400).json({
        success: false,
        error: 'Skills moet een array zijn'
      });
    }

    // Update skills in profiles table
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ skills: skills })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating employee skills:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Fout bij bijwerken van vaardigheden'
      });
    }

    res.json({
      success: true,
      message: 'Vaardigheden succesvol bijgewerkt'
    });
  } catch (err) {
    console.error('Error in update employee skills route:', err);
    res.status(500).json({
      success: false,
      error: 'Er is een fout opgetreden'
    });
  }
});

// ===== CUSTOMERS ROUTES =====
// Simple in-memory cache for KPI stats (5 minute TTL)
const kpiCache = {
  data: null,
  timestamp: 0,
  ttl: 5 * 60 * 1000 // 5 minutes
};

function getCachedKPIs() {
  const now = Date.now();
  if (kpiCache.data && (now - kpiCache.timestamp) < kpiCache.ttl) {
    console.error(`  📦 Using cached KPI data (age: ${Math.round((now - kpiCache.timestamp) / 1000)}s)`);
    return kpiCache.data;
  }
  return null;
}

function setCachedKPIs(data) {
  kpiCache.data = data;
  kpiCache.timestamp = Date.now();
}

router.get("/customers", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  const startTime = Date.now();
  const timings = {};
  
  // Debug logging - use console.error to ensure visibility (not buffered)
  console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('🚀 [CUSTOMERS] Starting customers page load...');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    const { status, priority, search, page = 1, limit = 15, sortBy = 'name', sortOrder = 'asc' } = req.query
    const pageNum = parseInt(page) || 1
    const limitNum = parseInt(limit) || 15
    const offset = (pageNum - 1) * limitNum
    const ascending = sortOrder === 'asc' || sortOrder === 'ascending'
    
    // Build query - use customers table directly for accurate counts
    // Note: customer_stats view may have caching issues, so we query customers directly
    // Join with customer_branches to get branch name
    let customerQuery = supabaseAdmin
      .from('customers')
      .select(`
        *,
        customer_branch:customer_branches!customers_customer_branch_id_fkey(id, name)
      `, { count: 'exact' })
    
    // Apply filters
    if (status && status !== 'all') {
      customerQuery = customerQuery.eq('status', status)
    }
    if (priority && priority !== 'all') {
      customerQuery = customerQuery.eq('priority', priority)
    }
    if (search && search.trim()) {
      customerQuery = customerQuery.or(`name.ilike.%${search}%,email.ilike.%${search}%,domain.ilike.%${search}%,company_name.ilike.%${search}%`)
    }
    
    // Apply sorting
    const validSortColumns = ['name', 'email', 'phone', 'branch', 'status', 'priority', 'updated_at', 'created_at', 'last_ticket_activity', 'last_email_activity']
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'name'
    
    // Handle special sorting cases
    if (sortColumn === 'name') {
      customerQuery = customerQuery.order('name', { ascending })
    } else if (sortColumn === 'email') {
      customerQuery = customerQuery.order('email', { ascending })
    } else if (sortColumn === 'phone') {
      customerQuery = customerQuery.order('phone', { ascending })
    } else if (sortColumn === 'branch') {
      // Sort by customer_branch_id (will be sorted by branch name in client-side if needed)
      customerQuery = customerQuery.order('customer_branch_id', { ascending, nullsFirst: false })
    } else if (sortColumn === 'status') {
      customerQuery = customerQuery.order('status', { ascending })
    } else if (sortColumn === 'priority') {
      // Priority sorting will be done client-side to maintain hierarchy: VIP → HOOG → NORMAAL → LAAG
      // Order by name first as temporary sort, will be re-sorted client-side
      customerQuery = customerQuery.order('name', { ascending: true })
    } else if (sortColumn === 'created_at') {
      customerQuery = customerQuery.order('created_at', { ascending })
    } else if (sortColumn === 'updated_at' || sortColumn === 'last_ticket_activity' || sortColumn === 'last_email_activity') {
      // For activity sorting, use updated_at as fallback
      customerQuery = customerQuery.order('updated_at', { ascending })
    }
    
    // Secondary sort by name for consistent ordering (except for priority which will be fully client-side sorted)
    if (sortColumn !== 'name' && sortColumn !== 'priority') {
      customerQuery = customerQuery.order('name', { ascending: true })
    }
    
    // Execute all queries in parallel for maximum performance
    const parallelStart = Date.now();
    console.error('⏱️  [CUSTOMERS] Starting parallel queries batch...');
    
    const [
      customersResult,
      kpiStatsResult,
      customerBranchesResult,
      totalRevenueResult
    ] = await Promise.all([
      // Get customers with stats - with pagination
      // Note: We'll sort after merging with customers table data since sort_order is there
      (async () => {
        const qStart = Date.now();
        const result = await customerQuery
          .order('name', { ascending: true })
          .order('updated_at', { ascending: false })
          .range(offset, offset + limitNum - 1);
        timings['customer_stats_query'] = Date.now() - qStart;
        console.error(`  ✅ customer_stats query: ${timings['customer_stats_query']}ms`);
        return result;
      })(),
      
      // Get KPI stats - always fetch fresh data (cache disabled for accuracy)
      (async () => {
        const qStart = Date.now();
        // Cache disabled - always fetch fresh to ensure accuracy
        // const cached = getCachedKPIs();
        // if (cached) {
        //   timings['kpi_stats_total'] = Date.now() - qStart;
        //   timings['kpi_total_customers'] = 0;
        //   timings['kpi_active_customers'] = 0;
        //   console.error(`  ✅ KPI stats (cached): ${timings['kpi_stats_total']}ms`);
        //   return cached;
        // }
        
        console.error(`  ⚠️  KPI stats - fetching fresh data (cache disabled)...`);
        // Fetch fresh data
        const result = await Promise.all([
          (async () => {
            const s = Date.now();
            try {
              // Use count query without head to ensure accurate count
              const r = await supabaseAdmin
                .from('customers')
                .select('*', { count: 'exact', head: true });
              timings['kpi_total_customers'] = Date.now() - s;
              if (r.error) {
                console.error(`  ❌ KPI total customers error: ${r.error.message}`);
                return { count: 0, error: r.error };
              }
              const count = r.count !== null && r.count !== undefined ? r.count : 0;
              console.error(`  ✅ KPI total customers: ${timings['kpi_total_customers']}ms, count: ${count}`);
              return { count, error: null };
            } catch (err) {
              console.error(`  ❌ KPI total customers exception: ${err.message}`);
              return { count: 0, error: err };
            }
          })(),
          (async () => {
            const s = Date.now();
            try {
              // Use count query without head to ensure accurate count
              const r = await supabaseAdmin
                .from('customers')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'active');
              timings['kpi_active_customers'] = Date.now() - s;
              if (r.error) {
                console.error(`  ❌ KPI active customers error: ${r.error.message}`);
                return { count: 0, error: r.error };
              }
              const count = r.count !== null && r.count !== undefined ? r.count : 0;
              console.error(`  ✅ KPI active customers: ${timings['kpi_active_customers']}ms, count: ${count}`);
              return { count, error: null };
            } catch (err) {
              console.error(`  ❌ KPI active customers exception: ${err.message}`);
              return { count: 0, error: err };
            }
          })()
        ]);
        timings['kpi_stats_total'] = Date.now() - qStart;
        // Cache disabled - don't cache to ensure fresh data
        // setCachedKPIs(result);
        console.error(`  ✅ KPI stats fetched (not cached for accuracy)`);
        return result;
      })(),
      
      // Skip customer branches - only needed when creating customer (can be loaded via AJAX)
      // This speeds up initial page load
      (async () => {
        // Return empty - not needed for listing page
        return { data: [] };
      })(),
      
      // Get total revenue - optimized with aggregation
      (async () => {
        const qStart = Date.now();
        try {
          // Use RPC for fast aggregation if available, otherwise use limited query
          const result = await supabaseAdmin
            .from('customer_invoices')
            .select('amount')
            .eq('status', 'paid')
            .limit(5000) // Limit for performance, but enough for accurate total
            .order('invoice_date', { ascending: false });
          timings['revenue_total_query'] = Date.now() - qStart;
          console.error(`  ✅ Total revenue query: ${timings['revenue_total_query']}ms`);
          return result;
        } catch (err) {
          console.error(`  ⚠️  Revenue query failed: ${err.message}`);
          return { data: [] };
        }
      })()
    ]);
    
    timings['parallel_batch'] = Date.now() - parallelStart;
    console.error(`⏱️  [CUSTOMERS] Parallel batch completed in ${timings['parallel_batch']}ms`);
    
    const { data: customers, error: customersError, count: totalFilteredCustomers } = customersResult;
    const [totalCustomersResult, activeCustomersResult] = kpiStatsResult || [{}, {}];
    const customerBranchesResultData = customerBranchesResult || { data: [] };
    const { data: customerBranches = [] } = customerBranchesResultData;
    const revenueResult = totalRevenueResult || { data: [] };
    
    // Extract counts with proper error handling
    const totalCustomers = (totalCustomersResult && totalCustomersResult.count !== undefined && totalCustomersResult.count !== null) 
      ? totalCustomersResult.count 
      : 0;
    const activeCustomers = (activeCustomersResult && activeCustomersResult.count !== undefined && activeCustomersResult.count !== null) 
      ? activeCustomersResult.count 
      : 0;
    const { data: revenueInvoices = [] } = revenueResult;
    
    // Debug logging with full details
    console.error(`  📊 KPI Stats extracted:`, {
      totalCustomers,
      activeCustomers,
      totalCustomersResult: totalCustomersResult ? { 
        count: totalCustomersResult.count, 
        hasCount: 'count' in totalCustomersResult, 
        error: totalCustomersResult.error,
        type: typeof totalCustomersResult.count
      } : 'null',
      activeCustomersResult: activeCustomersResult ? { 
        count: activeCustomersResult.count,
        hasCount: 'count' in activeCustomersResult, 
        error: activeCustomersResult.error,
        type: typeof activeCustomersResult.count
      } : 'null',
      totalFilteredCustomers: totalFilteredCustomers
    });
    
    if (customersError) throw customersError
    
    // Process customers data - only for current page
    if (customers && customers.length > 0) {
      const customerIds = customers.map(c => c.id);
      console.error(`⏱️  [CUSTOMERS] Processing ${customerIds.length} customers for current page...`);
      
      // Get logo_urls, sort_order, and revenue in ONE parallel batch (faster!)
      const pageDataStart = Date.now();
      const [
        customersWithExtrasResult,
        pageInvoicesResult
      ] = await Promise.all([
        // Get logo_urls and sort_order (only for current page customers)
        (async () => {
          const qStart = Date.now();
          const result = await supabaseAdmin
            .from('customers')
            .select('id, logo_url, sort_order')
            .in('id', customerIds);
          timings['customers_extras'] = Date.now() - qStart;
          console.error(`  ✅ customers extras (logo_url, sort_order): ${timings['customers_extras']}ms`);
          return result;
        })(),
        
        // Get revenue ONLY for current page customers (much faster!)
        (async () => {
          const qStart = Date.now();
          const result = await supabaseAdmin
            .from('customer_invoices')
            .select('customer_id, amount')
            .eq('status', 'paid')
            .in('customer_id', customerIds);
          timings['page_invoices'] = Date.now() - qStart;
          console.error(`  ✅ page invoices (for ${customerIds.length} customers): ${timings['page_invoices']}ms`);
          return result;
        })()
      ]);
      
      timings['page_data_batch'] = Date.now() - pageDataStart;
      console.error(`⏱️  [CUSTOMERS] Page data batch completed in ${timings['page_data_batch']}ms`);
      
      const { data: customersWithExtras } = customersWithExtrasResult;
      const { data: pageInvoices } = pageInvoicesResult;
      
      // Create maps
      const logoMap = {};
      const sortOrderMap = {};
      if (customersWithExtras) {
        customersWithExtras.forEach(c => {
          if (c.logo_url) {
            logoMap[c.id] = c.logo_url;
          }
          sortOrderMap[c.id] = c.sort_order || 0;
        });
      }
      
      // Calculate revenue per customer (only for current page customers)
      const revenueMap = {};
      if (pageInvoices && pageInvoices.length > 0) {
        pageInvoices.forEach(inv => {
          if (inv.customer_id) {
            if (!revenueMap[inv.customer_id]) {
              revenueMap[inv.customer_id] = 0;
            }
            revenueMap[inv.customer_id] += parseFloat(inv.amount) || 0;
          }
        });
      }
      
      // Merge data (no sorting - already sorted by database)
      customers.forEach(customer => {
        customer.logo_url = logoMap[customer.id] || null;
        customer.sort_order = sortOrderMap[customer.id] || 0;
        customer.total_revenue = revenueMap[customer.id] || 0;
        // Extract branch name from joined relation
        if (customer.customer_branch && customer.customer_branch.name) {
          customer.branch_name = customer.customer_branch.name;
        } else {
          customer.branch_name = null;
        }
      });
      
      // Client-side sorting for branch and priority
      if (customers.length > 0 && (sortColumn === 'branch' || sortColumn === 'priority')) {
        const sortStart = Date.now();
        customers.sort((a, b) => {
          if (sortColumn === 'branch') {
            // Sort by branch name (alphabetical)
            const aBranch = (a.branch_name || '').toLowerCase();
            const bBranch = (b.branch_name || '').toLowerCase();
            if (aBranch === bBranch) {
              return (a.name || '').localeCompare(b.name || '');
            }
            if (!aBranch) return 1; // nulls last
            if (!bBranch) return -1; // nulls last
            const comparison = aBranch.localeCompare(bBranch);
            return ascending ? comparison : -comparison;
          } else if (sortColumn === 'priority') {
            // Priority hierarchy: VIP (4) → HOOG (3) → NORMAAL (2) → LAAG (1)
            const priorityOrder = { 'vip': 4, 'high': 3, 'normal': 2, 'low': 1 };
            const aPriority = priorityOrder[a.priority] || 0;
            const bPriority = priorityOrder[b.priority] || 0;
            
            if (aPriority === bPriority) {
              // Secondary sort by name
              return (a.name || '').localeCompare(b.name || '');
            }
            
            // Always sort VIP → HOOG → NORMAAL → LAAG (descending order)
            // If ascending is false, reverse the order
            return ascending ? (bPriority - aPriority) : (aPriority - bPriority);
          }
          return 0;
        });
        timings['client_sort'] = Date.now() - sortStart;
        if (timings['client_sort'] > 0) {
          console.error(`  ✅ client-side ${sortColumn} sort: ${timings['client_sort']}ms`);
        }
      }
    }
    
    // Calculate total revenue from invoices
    let totalRevenue = 0;
    try {
      if (revenueInvoices && revenueInvoices.length > 0) {
        totalRevenue = revenueInvoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
      }
      // Note: This is based on recent 5000 invoices for performance
      // For exact total, could implement caching or background calculation
    } catch (err) {
      console.error('Exception calculating revenue:', err);
      totalRevenue = 0;
    }
    
    // Calculate pagination info
    const totalPages = Math.ceil((totalFilteredCustomers || 0) / limitNum)
    const currentPage = pageNum
    const totalItems = totalFilteredCustomers || 0
    
    const totalTime = Date.now() - startTime;
    timings['total'] = totalTime;
    
    // Output performance summary to terminal (use console.error for visibility)
    console.error('\n📊 [CUSTOMERS] Performance Summary:');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Object.entries(timings).sort((a, b) => b[1] - a[1]).forEach(([key, value]) => {
      const percentage = ((value / totalTime) * 100).toFixed(1);
      console.error(`  ${key.padEnd(30)} ${String(value).padStart(6)}ms (${percentage}%)`);
    });
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`  ${'TOTAL (before render)'.padEnd(30)} ${String(totalTime).padStart(6)}ms`);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Render template and measure time
    const renderStart = Date.now();
    
    // Final KPI values - ensure they are numbers
    const finalTotalCustomers = Number(totalCustomers) || 0;
    const finalActiveCustomers = Number(activeCustomers) || 0;
    const finalTotalRevenue = Number(totalRevenue) || 0;
    
    console.error(`  🎯 Final KPI values being sent to template:`, {
      total: finalTotalCustomers,
      active: finalActiveCustomers,
      revenue: finalTotalRevenue
    });
    
    res.render('admin/customers', {
      title: 'Klanten',
      activeMenu: 'customers',
      user: req.user,
      customers: customers || [],
      industries: customerBranches || [], // Use customer_branches for customer form (backwards compatible with template)
      kpis: {
        total: finalTotalCustomers,
        active: finalActiveCustomers,
        revenue: finalTotalRevenue
      },
      filters: {
        status: status || 'all',
        priority: priority || 'all',
        search: search || ''
      },
      sorting: {
        sortBy: sortColumn,
        sortOrder: ascending ? 'asc' : 'desc'
      },
      pagination: {
        page: currentPage,
        limit: limitNum,
        totalItems: totalItems,
        totalPages: totalPages,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1
      },
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
      scripts: ['/js/admin/customers.js'],
      stylesheets: ['/css/admin/adminPayments.css', '/css/admin/payments-table.css', '/css/admin/customers.css']
    }, (err, html) => {
      // Measure render time after template is rendered
      const renderTime = Date.now() - renderStart;
      const totalTimeWithRender = Date.now() - startTime;
      
      if (err) {
        console.error(`❌ [CUSTOMERS] Template render error after ${renderTime}ms:`, err);
        return res.status(500).render('error', { message: 'Kon klanten niet laden', error: {}, user: req.user });
      }
      
      console.error(`  ✅ Template render: ${renderTime}ms`);
      console.error(`  ✅ TOTAL (with render): ${totalTimeWithRender}ms\n`);
      res.send(html);
    });
  } catch (err) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [CUSTOMERS] Error after ${totalTime}ms: ${err.message}`);
    console.error(`Stack: ${err.stack}`);
    console.error('Admin customers route error:', err)
    res.status(500).render('error', { message: 'Kon klanten niet laden', error: {}, user: req.user })
  }
})

// ===== CALENDAR ROUTE =====
router.get("/calendar", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const currentUserId = req.user?.id;
    const isAdminUser = req.user?.user_metadata?.is_admin || false;
    
    // Determine if user is a manager
    let isManager = false;
    if (req.user?.role_id) {
      const { data: role } = await supabaseAdmin
        .from('roles')
        .select('name')
        .eq('id', req.user.role_id)
        .maybeSingle();
      if (role?.name?.toLowerCase().includes('manager')) {
        isManager = true;
      }
    }
    
    const canViewAll = isAdminUser || isManager;
    
    // Get all employees for agenda selector (managers+ can see all)
    let allEmployees = [];
    if (canViewAll) {
      const { data: empData } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, email, role_id, employee_status, is_admin')
        .or('employee_status.eq.active,employee_status.eq.paused,is_admin.eq.true')
        .order('first_name')
        .limit(200);
      
      allEmployees = empData || [];
    } else {
      // Regular employees can only see themselves
      const { data: empData } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, email, role_id, employee_status, is_admin')
        .eq('id', currentUserId)
        .maybeSingle();
      
      if (empData) {
        allEmployees = [empData];
      }
    }
    
    // Get employees for reminder dropdown (managers+ only)
    let employees = [];
    if (canViewAll && allEmployees.length > 0) {
      const { data: roles } = await supabaseAdmin
        .from('roles')
        .select('id, name');
      
      const roleMap = {};
      if (roles) {
        roles.forEach(function(r) {
          roleMap[r.id] = r.name;
        });
      }
      
      employees = allEmployees.filter(function(emp) {
        if (emp.is_admin) return true;
        if (emp.role_id && roleMap[emp.role_id]) {
          const roleName = roleMap[emp.role_id].toLowerCase();
          return roleName.includes('manager');
        }
        return false;
      });
    }
    
    // Get user's customer if they belong to one
    let userCustomer = null;
    if (req.user?.id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('customer_id')
        .eq('id', req.user.id)
        .maybeSingle();
      
      if (profile?.customer_id) {
        const { data: customer } = await supabaseAdmin
          .from('customers')
          .select('id, name, company_name')
          .eq('id', profile.customer_id)
          .maybeSingle();
        userCustomer = customer;
      }
    }
    
    res.render('admin/calendar', {
      title: 'Agenda',
      activeMenu: 'calendar',
      user: req.user,
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
      employees: employees || [],
      allEmployees: allEmployees || [],
      userCustomer: userCustomer,
      canViewAll: canViewAll,
      currentUserId: currentUserId
    });
  } catch (err) {
    console.error("❌ Admin calendar error:", err);
    res.status(500).render('error', { 
      message: 'Er is een fout opgetreden bij het laden van de agenda', 
      error: {}, 
      user: req.user 
    });
  }
});

// ===== CONTACTS ROUTES =====
// Simple in-memory cache for Contacts KPI stats (5 minute TTL)
const contactsKpiCache = {
  data: null,
  timestamp: 0,
  ttl: 5 * 60 * 1000 // 5 minutes
};

function getCachedContactsKPIs() {
  const now = Date.now();
  if (contactsKpiCache.data && (now - contactsKpiCache.timestamp) < contactsKpiCache.ttl) {
    return contactsKpiCache.data;
  }
  return null;
}

function setCachedContactsKPIs(data) {
  contactsKpiCache.data = data;
  contactsKpiCache.timestamp = Date.now();
}

router.get("/contacts", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  const startTime = Date.now();
  const timings = {};
  
  try {
    const { status, priority, search, page = 1, limit = 15 } = req.query
    const pageNum = parseInt(page) || 1
    const limitNum = parseInt(limit) || 15
    const offset = (pageNum - 1) * limitNum
    
    // Build query with stats - get count first for pagination
    let contactQuery = supabaseAdmin
      .from('contact_stats')
      .select('*', { count: 'exact' })
    
    // Apply filters
    if (status && status !== 'all') {
      contactQuery = contactQuery.eq('status', status)
    }
    if (priority && priority !== 'all') {
      contactQuery = contactQuery.eq('priority', priority)
    }
    if (search && search.trim()) {
      contactQuery = contactQuery.or(`name.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%,job_title.ilike.%${search}%`)
    }
    
    // Execute all queries in parallel for maximum performance
    const parallelStart = Date.now();
    
    const [
      contactsResult,
      kpiStatsResult,
      customerBranchesResult,
      customersResult
    ] = await Promise.all([
      // Get contacts with stats - with pagination
      (async () => {
        const qStart = Date.now();
        const result = await contactQuery
          .order('name', { ascending: true })
          .order('updated_at', { ascending: false })
          .range(offset, offset + limitNum - 1);
        timings['contact_stats_query'] = Date.now() - qStart;
        return result;
      })(),
      
      // Get KPI stats - use cache if available
      (async () => {
        const qStart = Date.now();
        const cached = getCachedContactsKPIs();
        if (cached) {
          timings['kpi_stats_total'] = Date.now() - qStart;
          return cached;
        }
        
        // Fetch fresh data
        const result = await Promise.all([
          (async () => {
            const r = await supabaseAdmin
              .from('contacts')
              .select('id', { count: 'exact', head: true });
            return r;
          })(),
          (async () => {
            const r = await supabaseAdmin
              .from('contacts')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'active');
            return r;
          })()
        ]);
        timings['kpi_stats_total'] = Date.now() - qStart;
        // Cache the result
        setCachedContactsKPIs(result);
        return result;
      })(),
      
      // Skip customer branches - only needed when creating contact (can be loaded via AJAX)
      Promise.resolve({ data: [] }),
      
      // Get customers for company selection dropdown
      (async () => {
        const qStart = Date.now();
        const result = await supabaseAdmin
          .from('customers')
          .select('id, name, company_name, email')
          .order('company_name', { ascending: true })
          .order('name', { ascending: true })
          .limit(500); // Limit to 500 customers for dropdown
        timings['customers_query'] = Date.now() - qStart;
        return result;
      })()
    ]);
    
    timings['parallel_batch'] = Date.now() - parallelStart;
    
    const { data: contacts, error: contactsError, count: totalFilteredContacts } = contactsResult;
    const [totalContactsResult, activeContactsResult] = kpiStatsResult;
    const customerBranchesResultData = customerBranchesResult || { data: [] };
    const { data: customerBranches = [] } = customerBranchesResultData;
    const { data: customers = [], error: customersError } = customersResult || {};
    
    const { count: totalContacts } = totalContactsResult;
    const { count: activeContacts } = activeContactsResult;
    
    if (contactsError) throw contactsError
    
    // Process contacts data - only for current page
    if (contacts && contacts.length > 0) {
      const contactIds = contacts.map(c => c.id);
      
      // Get sort_order for current page contacts
      const pageDataStart = Date.now();
      const contactsWithExtrasResult = await supabaseAdmin
        .from('contacts')
        .select('id, sort_order')
        .in('id', contactIds);
      
      timings['contacts_extras'] = Date.now() - pageDataStart;
      
      const { data: contactsWithExtras } = contactsWithExtrasResult;
      
      // Create sort order map
      const sortOrderMap = {};
      if (contactsWithExtras) {
        contactsWithExtras.forEach(c => {
          sortOrderMap[c.id] = c.sort_order || 0;
        });
      }
      
      // Merge data
      contacts.forEach(contact => {
        contact.sort_order = sortOrderMap[contact.id] || 0;
      });
      
      // Re-sort by sort_order if needed
      if (contacts.length > 0) {
        contacts.sort((a, b) => {
          if (a.sort_order !== b.sort_order) {
            return (a.sort_order || 0) - (b.sort_order || 0);
          }
          return 0;
        });
      }
    }
    
    // Calculate pagination info
    const totalPages = Math.ceil((totalFilteredContacts || 0) / limitNum)
    const currentPage = pageNum
    const totalItems = totalFilteredContacts || 0
    
    res.render('admin/contacts', {
      title: 'Contactpersonen',
      activeMenu: 'contacts',
      user: req.user,
      contacts: contacts || [],
      customers: customers || [], // Pass customers for company selection
      industries: customerBranches || [],
      kpis: {
        total: totalContacts || 0,
        active: activeContacts || 0
      },
      filters: {
        status: status || 'all',
        priority: priority || 'all',
        search: search || ''
      },
      pagination: {
        page: currentPage,
        limit: limitNum,
        totalItems: totalItems,
        totalPages: totalPages,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1
      },
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
      scripts: ['/js/admin/contacts.js'],
      stylesheets: ['/css/admin/adminPayments.css', '/css/admin/payments-table.css', '/css/admin/customers.css']
    });
  } catch (err) {
    console.error('Admin contacts route error:', err)
    res.status(500).render('error', { message: 'Kon contactpersonen niet laden', error: {}, user: req.user })
  }
})

// ===== CUSTOMER API ENDPOINTS =====
// Get company profile from KVK API
router.get('/customers/kvk-profile/:kvkNumber', requireAuth, isAdmin, async (req, res) => {
  try {
    const { kvkNumber } = req.params;
    
    if (!kvkNumber) {
      return res.status(400).json({ 
        success: false, 
        error: 'KVK nummer is verplicht' 
      });
    }

    const KvkApiService = require('../services/kvkApiService');
    
    if (!KvkApiService.isAvailable()) {
      return res.status(503).json({ 
        success: false, 
        error: 'KVK API is niet geconfigureerd' 
      });
    }

    const profile = await KvkApiService.getCompanyProfile(kvkNumber);

    if (!profile) {
      return res.status(404).json({ 
        success: false, 
        error: 'Bedrijf niet gevonden' 
      });
    }

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('KVK profile error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Fout bij ophalen bedrijfsgegevens' 
    });
  }
});

// Get customers table data (for AJAX sorting/filtering)
router.get('/api/customers/table', requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const { status, priority, search, page = 1, limit = 15, sortBy = 'name', sortOrder = 'asc' } = req.query
    const pageNum = parseInt(page) || 1
    const limitNum = parseInt(limit) || 15
    const offset = (pageNum - 1) * limitNum
    const ascending = sortOrder === 'asc' || sortOrder === 'ascending'
    
    // Build query - same as main customers route
    let customerQuery = supabaseAdmin
      .from('customers')
      .select(`
        *,
        customer_branch:customer_branches!customers_customer_branch_id_fkey(id, name)
      `, { count: 'exact' })
    
    // Apply filters
    if (status && status !== 'all') {
      customerQuery = customerQuery.eq('status', status)
    }
    if (priority && priority !== 'all') {
      customerQuery = customerQuery.eq('priority', priority)
    }
    if (search && search.trim()) {
      customerQuery = customerQuery.or(`name.ilike.%${search}%,email.ilike.%${search}%,domain.ilike.%${search}%,company_name.ilike.%${search}%`)
    }
    
    // Apply sorting
    const validSortColumns = ['name', 'email', 'phone', 'branch', 'status', 'priority', 'updated_at', 'created_at', 'last_ticket_activity', 'last_email_activity']
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'name'
    
    // Handle special sorting cases
    if (sortColumn === 'name') {
      customerQuery = customerQuery.order('name', { ascending })
    } else if (sortColumn === 'email') {
      customerQuery = customerQuery.order('email', { ascending })
    } else if (sortColumn === 'phone') {
      customerQuery = customerQuery.order('phone', { ascending })
    } else if (sortColumn === 'branch') {
      customerQuery = customerQuery.order('customer_branch_id', { ascending, nullsFirst: false })
    } else if (sortColumn === 'status') {
      customerQuery = customerQuery.order('status', { ascending })
    } else if (sortColumn === 'priority') {
      // Priority sorting will be done client-side to maintain hierarchy: VIP → HOOG → NORMAAL → LAAG
      // Order by name first as temporary sort, will be re-sorted client-side
      customerQuery = customerQuery.order('name', { ascending: true })
    } else if (sortColumn === 'created_at') {
      customerQuery = customerQuery.order('created_at', { ascending })
    } else if (sortColumn === 'updated_at' || sortColumn === 'last_ticket_activity' || sortColumn === 'last_email_activity') {
      customerQuery = customerQuery.order('updated_at', { ascending })
    }
    
    // Secondary sort by name for consistent ordering (except for priority which will be fully client-side sorted)
    if (sortColumn !== 'name' && sortColumn !== 'priority') {
      customerQuery = customerQuery.order('name', { ascending: true })
    }
    
    // Execute query
    const { data: customers, error, count } = await customerQuery
      .range(offset, offset + limitNum - 1)
    
    if (error) throw error
    
    // Process customers data
    if (customers && customers.length > 0) {
      const customerIds = customers.map(c => c.id)
      
      // Get logo_urls and sort_order
      const { data: customersWithExtras } = await supabaseAdmin
        .from('customers')
        .select('id, logo_url, sort_order')
        .in('id', customerIds)
      
      const logoMap = {}
      const sortOrderMap = {}
      if (customersWithExtras) {
        customersWithExtras.forEach(c => {
          if (c.logo_url) logoMap[c.id] = c.logo_url
          sortOrderMap[c.id] = c.sort_order || 0
        })
      }
      
      // Merge data
      customers.forEach(customer => {
        customer.logo_url = logoMap[customer.id] || null
        customer.sort_order = sortOrderMap[customer.id] || 0
        // Extract branch name from joined relation
        if (customer.customer_branch && customer.customer_branch.name) {
          customer.branch_name = customer.customer_branch.name
        } else {
          customer.branch_name = null
        }
      })
      
      // Client-side sorting for branch and priority
      if (sortColumn === 'branch' || sortColumn === 'priority') {
        customers.sort((a, b) => {
          if (sortColumn === 'branch') {
            // Sort by branch name (alphabetical)
            const aBranch = (a.branch_name || '').toLowerCase()
            const bBranch = (b.branch_name || '').toLowerCase()
            if (aBranch === bBranch) {
              return (a.name || '').localeCompare(b.name || '')
            }
            if (!aBranch) return 1
            if (!bBranch) return -1
            const comparison = aBranch.localeCompare(bBranch)
            return ascending ? comparison : -comparison
          } else if (sortColumn === 'priority') {
            // Priority hierarchy: VIP (4) → HOOG (3) → NORMAAL (2) → LAAG (1)
            const priorityOrder = { 'vip': 4, 'high': 3, 'normal': 2, 'low': 1 }
            const aPriority = priorityOrder[a.priority] || 0
            const bPriority = priorityOrder[b.priority] || 0
            
            if (aPriority === bPriority) {
              // Secondary sort by name
              return (a.name || '').localeCompare(b.name || '')
            }
            
            // Always sort VIP → HOOG → NORMAAL → LAAG (descending order)
            // If ascending is false, reverse the order
            return ascending ? (bPriority - aPriority) : (aPriority - bPriority)
          }
          return 0
        })
      }
    }
    
    const totalPages = Math.ceil((count || 0) / limitNum)
    
    res.json({
      success: true,
      customers: customers || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems: count || 0,
        totalPages: totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    })
  } catch (err) {
    console.error('Error fetching customers table:', err)
    res.status(500).json({
      success: false,
      error: err.message || 'Fout bij ophalen klanten'
    })
  }
})

// Search customers for autocomplete
router.get('/api/customers/search', requireAuth, isAdmin, async (req, res) => {
  try {
    const { q } = req.query;
    
    const searchQuery = q ? q.trim() : '';
    const searchPattern = searchQuery ? `%${searchQuery}%` : '%';
    
    let query = supabaseAdmin
      .from('customers')
      .select('id, name, company_name, email, logo_url')
      .order('company_name', { ascending: true })
      .order('name', { ascending: true });

    if (searchQuery && searchQuery.length >= 2) {
      query = query.or(`name.ilike.${searchPattern},company_name.ilike.${searchPattern},email.ilike.${searchPattern}`);
      query = query.limit(50);
    } else {
      query = query.limit(200);
    }

    const { data: customers, error } = await query;

    if (error) throw error;

    const list = (customers || []).map((c) => ({
      id: c.id,
      name: c.name,
      company_name: c.company_name,
      email: c.email,
      avatar_url: c.logo_url || null
    }));

    res.json({
      success: true,
      customers: list
    });
  } catch (err) {
    console.error('Customer search error:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message || 'Fout bij zoeken klanten' 
    });
  }
});

// Search contacts for autocomplete
router.get('/api/contacts/search', requireAuth, isAdmin, async (req, res) => {
  try {
    const { q } = req.query;
    
    const searchQuery = q ? q.trim() : '';
    const searchPattern = searchQuery ? `%${searchQuery}%` : '%';
    
    let query = supabaseAdmin
      .from('contacts')
      .select('id, name, first_name, last_name, email, customer_id, customers:customer_id(id, name, company_name)')
      .order('name', { ascending: true });
    
    if (searchQuery && searchQuery.length >= 2) {
      query = query.or(`name.ilike.${searchPattern},first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},email.ilike.${searchPattern}`);
      query = query.limit(50);
    } else {
      // If no query, return all (for multi-select initial load)
      query = query.limit(200);
    }
    
    const { data: contacts, error } = await query;
    
    if (error) throw error;
    
    // Add company_name to each contact if linked
    const processedContacts = (contacts || []).map(function(contact) {
      return {
        ...contact,
        company_name: contact.customers ? (contact.customers.company_name || contact.customers.name) : null
      };
    });
    
    res.json({ 
      success: true, 
      contacts: processedContacts || [] 
    });
  } catch (err) {
    console.error('Contact search error:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message || 'Fout bij zoeken contactpersonen' 
    });
  }
});

// GET /admin/api/customers/:id/contacts - Get contacts for a customer
router.get('/api/customers/:id/contacts', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: contacts, error } = await supabaseAdmin
      .from('contacts')
      .select('id, name, first_name, last_name, email, customer_id, photo_url')
      .eq('customer_id', id)
      .order('first_name', { ascending: true })
      .order('last_name', { ascending: true });
    
    if (error) throw error;

    const list = (contacts || []).map((c) => ({
      ...c,
      avatar_url: c.photo_url || null
    }));

    res.json({
      success: true,
      contacts: list
    });
  } catch (err) {
    console.error('Error fetching customer contacts:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message || 'Fout bij ophalen contactpersonen' 
    });
  }
});

// Search companies via KVK API
// CRITICAL: This route MUST come BEFORE /customers/:id to prevent Express from matching "search-kvk" as an ID
router.get('/customers/search-kvk', requireAuth, isAdmin, async (req, res) => {
  console.log('🔍 KVK search route hit!');
  console.log('🔍 Query params:', req.query);
  console.log('🔍 Full URL:', req.originalUrl);
  try {
    const { q, city, limit } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Zoekterm is verplicht' 
      });
    }

    const KvkApiService = require('../services/kvkApiService');
    
    if (!KvkApiService.isAvailable()) {
      return res.status(503).json({ 
        success: false, 
        error: 'KVK API is niet geconfigureerd' 
      });
    }

    const results = await KvkApiService.searchCompanies(
      q.trim(), 
      city || null, 
      limit ? parseInt(limit) : 10
    );

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('KVK search error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Fout bij zoeken in KVK database' 
    });
  }
});

// ==== GET: New invoice page (MUST BE BEFORE /customers/:id) ====
router.get('/customers/:customerId/invoices/new', requireAuth, isAdmin, async (req, res) => {
  try {
    const { customerId } = req.params;
    
    // Get customer data
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();
    
    if (customerError || !customer) {
      return res.status(404).render('error', {
        message: 'Klant niet gevonden',
        error: {},
        user: req.user
      });
    }
    
    // Get user permissions
    let isUserAdmin = req.user?.user_metadata?.is_admin === true;
    let isUserManager = false;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, role_id')
        .eq('id', req.user.id)
        .single();
      
      if (profile?.is_admin) {
        isUserAdmin = true;
      }
      
      if (profile?.role_id) {
        const { data: role } = await supabaseAdmin
          .from('roles')
          .select('name')
          .eq('id', profile.role_id)
          .maybeSingle();
        if (role?.name?.toLowerCase().includes('manager')) {
          isUserManager = true;
        }
      }
    } catch (roleErr) {
      console.log('Error fetching user admin/manager status:', roleErr);
    }
    
    const canEditInvoice = isUserAdmin || isUserManager;
    
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    const dueDateStr = dueDate.toISOString().split('T')[0];
    
    res.render('admin/invoice-new', {
      title: `Nieuwe Factuur - ${customer.name || customer.company_name || 'Klant'}`,
      activeMenu: 'customers',
      user: req.user,
      isUserAdmin,
      isUserManager,
      canEditInvoice,
      customer,
      defaultDates: {
        invoice_date: today,
        due_date: dueDateStr
      },
      scripts: ['/js/admin/invoice-new.js'],
      stylesheets: ['/css/admin/users.css', '/css/admin/customers.css', '/css/admin/employees-drawer.css']
    });
  } catch (err) {
    console.error('Error loading new invoice page:', err);
    res.status(500).render('error', {
      message: 'Er is een fout opgetreden bij het laden van de pagina',
      error: {},
      user: req.user
    });
  }
});

// ==== GET: Single invoice page (MUST BE BEFORE /customers/:id) ====
router.get('/customers/:customerId/invoices/:invoiceId', requireAuth, isAdmin, async (req, res) => {
  try {
    const { customerId, invoiceId } = req.params;
    
    // Get invoice with customer info
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('customer_invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('customer_id', customerId)
      .single();
    
    if (invoiceError || !invoice) {
      return res.status(404).render('error', {
        message: 'Factuur niet gevonden',
        error: {},
        user: req.user
      });
    }
    
    // Normalize: if status is "paid", outstanding_amount should be 0
    if (invoice.status === 'paid' && invoice.outstanding_amount > 0) {
      // Auto-correct in database
      await supabaseAdmin
        .from('customer_invoices')
        .update({ outstanding_amount: 0, updated_at: new Date().toISOString() })
        .eq('id', invoiceId);
      
      invoice.outstanding_amount = 0;
    }
    
    // Get customer data
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();
    
    if (customerError || !customer) {
      return res.status(404).render('error', {
        message: 'Klant niet gevonden',
        error: {},
        user: req.user
      });
    }
    
    // Get creator info if exists
    let creator = null;
    if (invoice.created_by) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, email, company_name')
        .eq('id', invoice.created_by)
        .maybeSingle();
      if (profile) {
        creator = profile;
      }
    }
    
    // Parse line items if exists
    let lineItems = [];
    if (invoice.line_items && Array.isArray(invoice.line_items)) {
      lineItems = invoice.line_items;
    }
    
    // Calculate totals from line items if available
    let subtotal = 0;
    let vatTotal = 0;
    let total = invoice.amount;
    
    if (lineItems.length > 0) {
      // Calculate subtotal (sum of all line item subtotals)
      subtotal = lineItems.reduce((sum, item) => {
        const itemSubtotal = item.subtotal || ((item.quantity || 1) * (item.unit_price || 0));
        return sum + itemSubtotal;
      }, 0);
      
      // Calculate VAT total (sum of all line item VAT amounts)
      // If vat_amount is not stored, calculate it based on has_vat flag
      vatTotal = lineItems.reduce((sum, item) => {
        if (item.vat_amount !== undefined && item.vat_amount !== null) {
          // Use stored vat_amount if available
          return sum + item.vat_amount;
        } else {
          // Calculate VAT if not stored: 21% of subtotal if has_vat is true
          const hasVat = item.has_vat !== false; // Default to true if not specified
          const itemSubtotal = item.subtotal || ((item.quantity || 1) * (item.unit_price || 0));
          const itemVat = hasVat ? itemSubtotal * 0.21 : 0;
          return sum + itemVat;
        }
      }, 0);
      
      total = subtotal + vatTotal;
    }
    
    // Get user permissions
    let isUserAdmin = req.user?.user_metadata?.is_admin === true;
    let isUserManager = false;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, role_id')
        .eq('id', req.user.id)
        .single();
      
      if (profile?.is_admin) {
        isUserAdmin = true;
      }
      
      if (profile?.role_id) {
        const { data: role } = await supabaseAdmin
          .from('roles')
          .select('name')
          .eq('id', profile.role_id)
          .maybeSingle();
        if (role?.name?.toLowerCase().includes('manager')) {
          isUserManager = true;
        }
      }
    } catch (roleErr) {
      console.log('Error fetching user admin/manager status:', roleErr);
    }
    
    const canEditInvoice = isUserAdmin || isUserManager;
    
    res.render('admin/invoice-detail', {
      title: `Factuur ${invoice.invoice_number} - ${customer.name || customer.company_name || 'Klant'}`,
      activeMenu: 'customers',
      user: req.user,
      isUserAdmin,
      isUserManager,
      canEditInvoice,
      invoice: {
        ...invoice,
        line_items: lineItems,
        subtotal,
        vat_total: vatTotal,
        total
      },
      customer,
      creator,
      scripts: ['/js/admin/invoice-detail.js'],
      stylesheets: ['/css/admin/users.css', '/css/admin/customers.css', '/css/admin/payments-table.css', '/css/admin/employees-drawer.css']
    });
  } catch (err) {
    console.error('Error loading invoice detail:', err);
    res.status(500).render('error', {
      message: 'Er is een fout opgetreden bij het laden van de factuur',
      error: {},
      user: req.user
    });
  }
});

// Single customer page (MUST BE AFTER invoice routes)
router.get("/customers/:id", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Admin single customer route called for ID: ${id}`);

    // Execute ALL queries in a single parallel batch for maximum performance
    const [
      customerStatsResult,
      customerResult,
      customerEnrichedResult,
      customerAiSummaryResult,
      customerEmailsResult,
      ticketsResult,
      emailsResult,
      activitiesResult,
      tasksResult,
      timeEntriesResult,
      invoicesResult,
      meetingsResult,
      userAccountResult,
      responsibleEmployeesResult,
      allProfilesResult,
      allRolesResult,
      userProfileResult
    ] = await Promise.all([
      // Get customer stats
      supabaseAdmin
        .from('customer_stats')
        .select('*')
        .eq('id', id)
        .single(),
      
      // Get full customer data
      supabaseAdmin
        .from('customers')
        .select('*')
        .eq('id', id)
        .single(),

      // Get computed/enriched fields (non-fatal if view isn't deployed yet)
      supabaseAdmin
        .from('customer_enriched')
        .select(`
          company_display_name,
          normalized_domain,
          normalized_website_url,
          normalized_phone,
          dedupe_key_primary,
          dedupe_key_secondary,
          days_since_last_interaction,
          has_overdue_next_activity,
          activity_bucket,
          contact_pressure,
          is_contactable,
          data_quality_score,
          full_address,
          is_duplicate_candidate
        `)
        .eq('id', id)
        .maybeSingle(),

      // Latest cached AI summary (non-fatal if table isn't deployed yet)
      supabaseAdmin
        .from('customer_ai_summaries')
        .select('id, summary, model, prompt_version, updated_at, created_at, created_by')
        .eq('customer_id', id)
        .maybeSingle(),
      
      // Get customer emails
      supabaseAdmin
        .from('customer_emails')
        .select('*')
        .eq('customer_id', id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20),
      
      // Get tickets (limited)
      supabaseAdmin
        .from('tickets')
        .select('id, title, status, priority, created_at, updated_at')
        .eq('customer_id', id)
        .order('created_at', { ascending: false })
        .limit(10),
      
      // Get recent emails (limited)
      supabaseAdmin
        .from('mail_inbox')
        .select('id, subject, from_email, created_at, read_at')
        .eq('customer_id', id)
        .order('created_at', { ascending: false })
        .limit(10),
      
      // Get activities (limited) - skip this slow query, load via AJAX if needed
      Promise.resolve({ data: [], error: null }),
      
      // Get tasks (limited)
      supabaseAdmin
        .from('employee_tasks')
        .select(`
          id, title, status, value_cents, created_at, customer_id,
          employee:profiles!employee_tasks_employee_id_fkey(id, first_name, last_name, email)
        `)
        .eq('customer_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
      
      // Get time entries (limited to recent)
      supabaseAdmin
        .from('time_entries')
        .select(`
          id, duration_minutes, start_at, customer_id,
          employee:profiles!time_entries_employee_id_fkey(id, first_name, last_name, email),
          task:employee_tasks!time_entries_task_id_fkey(id, title)
        `)
        .eq('customer_id', id)
        .order('start_at', { ascending: false })
        .limit(20),
      
      // Get invoices (limited to recent)
      supabaseAdmin
        .from('customer_invoices')
        .select('id, invoice_number, amount, outstanding_amount, status, invoice_date')
        .eq('customer_id', id)
        .order('invoice_date', { ascending: false })
        .limit(50),
      
      // Get meetings (with notes)
      supabaseAdmin
        .from('customer_meetings')
        .select('id, meeting_date, title, notes, created_at, updated_at, created_by')
        .eq('customer_id', id)
        .order('meeting_date', { ascending: false })
        .limit(50),
      
      // Get user admin/manager status (needed early)
      supabase
        .from('profiles')
        .select('is_admin, role_id')
        .eq('id', req.user.id)
        .single(),
      
      // Get responsible employees
      supabaseAdmin
        .from('customer_responsible_employees')
        .select(`
          id, customer_id, employee_id, assigned_at,
          employee:profiles!customer_responsible_employees_employee_id_fkey(id, first_name, last_name, email, employee_status, profile_picture, role_id),
          assigned_by_user:profiles!customer_responsible_employees_assigned_by_fkey(id, first_name, last_name, email)
        `)
        .eq('customer_id', id)
        .order('assigned_at', { ascending: false })
        .limit(20),
      
      // Get all profiles for employee dropdown (limited to active employees only)
      supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, email, role_id, employee_status, is_admin')
        .or('employee_status.eq.active,employee_status.eq.paused,is_admin.eq.true')
        .order('first_name')
        .limit(200),
      
      // Get roles (using cache)
      Promise.resolve().then(async () => {
        const { getAllRoles } = require('../utils/roleCache');
        const roles = await getAllRoles();
        return { data: roles.slice(0, 50), error: null };
      }),
      
      // Get user profile (duplicate of userAccountResult for consistency)
      supabase
        .from('profiles')
        .select('is_admin, role_id')
        .eq('id', req.user.id)
        .single()
    ]);

    const { data: customerStats, error: statsError } = customerStatsResult;
    const { data: customer, error: customerError } = customerResult;
    const { data: customerEnriched, error: customerEnrichedError } = customerEnrichedResult;
    const { data: customerAiSummary, error: customerAiSummaryError } = customerAiSummaryResult;
    const { data: customerEmails } = customerEmailsResult;
    const { data: tickets } = ticketsResult;
    const { data: emails } = emailsResult;
    const { data: activities } = activitiesResult;
    const { data: tasks } = tasksResult;
    const { data: timeEntries } = timeEntriesResult;
    const { data: invoices } = invoicesResult;
    const { data: meetings } = meetingsResult;
    const { data: userProfile } = userProfileResult || userAccountResult; // Use userProfileResult if available, fallback to userAccountResult
    const { data: responsibleEmployees } = responsibleEmployeesResult;
    const { data: allProfiles, error: profilesError } = allProfilesResult;
    const { data: allRoles, error: rolesError } = allRolesResult;
    
    if (statsError || !customerStats || customerError || !customer) {
      console.error("❌ Error getting customer:", statsError || customerError);
      return res.status(404).render('error', { 
        message: 'Klant niet gevonden', 
        error: {}, 
        user: req.user 
      });
    }

    // Combine customer and stats data
    const customerData = {
      ...customer,
      ...customerStats,
      // Override with customer table data (source of truth)
      name: customer.name || customerStats.name,
      email: customer.email || customerStats.email,
      phone: customer.phone || customerStats.phone,
      domain: customer.domain || customerStats.domain,
      company_name: customer.company_name || customerStats.company_name,
    };

    // Attach computed fields if available (ignore "relation does not exist" etc.)
    if (!customerEnrichedError && customerEnriched) {
      Object.assign(customerData, customerEnriched);
    }
    if (!customerAiSummaryError && customerAiSummary) {
      customerData.aiSummary = customerAiSummary;
    }

    // Fetch user account if email exists (only if we have email)
    let finalUserAccount = null;
    if (customerData.email) {
      const { data: userAccountData } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('email', customerData.email)
        .maybeSingle();
      finalUserAccount = userAccountData;
    }

    // Calculate revenue and profit metrics
    let totalRevenue = 0;
    let totalOutstanding = 0;
    let paidInvoices = 0;
    let overdueInvoices = 0;
    let totalInvoices = 0;
    
    if (invoices && invoices.length > 0) {
      totalInvoices = invoices.length;
      invoices.forEach(inv => {
        const amount = parseFloat(inv.amount) || 0;
        // If status is "paid", outstanding should be 0
        const outstanding = inv.status === 'paid' ? 0 : (parseFloat(inv.outstanding_amount) || 0);
        
        totalRevenue += amount;
        totalOutstanding += outstanding;
        
        if (inv.status === 'paid') {
          paidInvoices++;
        } else if (inv.status === 'overdue') {
          overdueInvoices++;
        }
      });
    }

    // Calculate time totals per employee
    const timeTotalsByEmployee = {};
    if (timeEntries) {
      timeEntries.forEach(entry => {
        if (entry.employee && entry.duration_minutes) {
          const empId = entry.employee.id;
          if (!timeTotalsByEmployee[empId]) {
            timeTotalsByEmployee[empId] = {
              employee: entry.employee,
              total_minutes: 0,
              entries_count: 0
            };
          }
          timeTotalsByEmployee[empId].total_minutes += entry.duration_minutes || 0;
          timeTotalsByEmployee[empId].entries_count += 1;
        }
      });
    }
    
    if (profilesError) {
      console.error('Error fetching profiles for employee dropdown:', profilesError);
    }
    
    if (rolesError) {
      console.error('Error fetching roles for employee dropdown:', rolesError);
    }
    
    // Fetch role names for responsible employees
    if (responsibleEmployees && responsibleEmployees.length > 0) {
      const roleIds = [...new Set(responsibleEmployees.map(re => re.employee?.role_id).filter(Boolean))];
      if (roleIds.length > 0 && allRoles) {
        const rolesMap = {};
        allRoles.forEach(role => {
          rolesMap[role.id] = role.display_name || role.name || 'Werknemer';
        });
        
        // Add role name to each employee
        responsibleEmployees.forEach(re => {
          if (re.employee && re.employee.role_id && rolesMap[re.employee.role_id]) {
            re.employee.role_name = rolesMap[re.employee.role_id];
          } else {
            re.employee.role_name = 'Werknemer';
          }
        });
      }
    }
    
    // Create role map for filtering (normalize IDs to lowercase for consistent comparison)
    const roleMap = {};
    if (allRoles) {
      allRoles.forEach(role => {
        const roleIdKey = String(role.id).toLowerCase();
        roleMap[roleIdKey] = role.name?.toLowerCase() || '';
        roleMap[String(role.id)] = role.name?.toLowerCase() || '';
      });
    }
    
    // Filter to only employees (exclude customer/consumer roles)
    // Since we already filtered by employee_status in the query, we mainly need to exclude customer/consumer roles
    const customerRoleId = '873fe734-197d-41a0-828b-31ced55e6695'; // Customer role ID
    const consumerRoleId = '58e20673-a6c1-4f48-9633-2462f4a124db'; // Consumer role ID
    
    const filteredEmployees = (allProfiles || []).filter(profile => {
      // Exclude customer and consumer roles by ID
      if (profile.role_id) {
        const roleIdStr = String(profile.role_id).toLowerCase();
        if (roleIdStr === customerRoleId.toLowerCase() || roleIdStr === consumerRoleId.toLowerCase()) {
          return false;
        }
        
        // Also check by role name (backup)
        const roleName = roleMap[roleIdStr] || roleMap[String(profile.role_id)] || '';
        if (roleName) {
          const lowerRoleName = roleName.toLowerCase();
          if (lowerRoleName === 'customer' || lowerRoleName === 'consumer' || lowerRoleName === 'klant') {
            return false;
          }
        }
      }
      
      // All profiles returned from query are already employees (filtered by employee_status or is_admin)
      return true;
    });
    
    // Map to final format
    const allEmployees = filteredEmployees.map(emp => ({
      id: emp.id,
      first_name: emp.first_name,
      last_name: emp.last_name,
      email: emp.email
    }));

    // Calculate comprehensive stats for customer management
    const allTasks = tasks || [];
    const allTimeEntries = timeEntries || [];
    const allTickets = tickets || [];
    const allEmails = emails || [];
    
    // Task statistics
    const doneTasks = allTasks.filter(t => t.status === 'done').length;
    const inProgressTasks = allTasks.filter(t => t.status === 'in_progress').length;
    const taskValueTotal = allTasks.reduce((sum, t) => sum + (t.value_cents || 0), 0);
    
    // Time entry statistics
    const totalTimeEntries = allTimeEntries.length;
    const totalHours = Math.floor((allTimeEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0)) / 60);
    const totalMinutes = allTimeEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0) % 60;
    
    // Employee statistics
    const responsibleEmployeesCount = responsibleEmployees?.length || 0;
    
    // Ticket statistics
    const closedTickets = allTickets.filter(t => t.status === 'closed').length;
    const highPriorityTickets = allTickets.filter(t => t.priority === 'high' || t.priority === 'urgent').length;
    
    // Email statistics
    const readEmails = allEmails.filter(e => e.read_at).length;
    
    // Calculate stats
    const stats = {
      // Tickets
      total_tickets: customerStats.total_tickets || 0,
      open_tickets: customerStats.open_tickets || 0,
      closed_tickets: closedTickets,
      high_priority_tickets: highPriorityTickets,
      
      // Emails
      total_emails: customerStats.total_emails || 0,
      unread_emails: customerStats.unread_emails || 0,
      read_emails: readEmails,
      
      // Tasks
      total_tasks: allTasks.length,
      open_tasks: allTasks.filter(t => t.status !== 'done' && t.status !== 'rejected').length,
      done_tasks: doneTasks,
      in_progress_tasks: inProgressTasks,
      task_value_total: taskValueTotal,
      
      // Time tracking
      total_time_minutes: allTimeEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0),
      total_time_entries: totalTimeEntries,
      total_hours: totalHours,
      total_minutes: totalMinutes,
      
      // Employees
      responsible_employees: responsibleEmployeesCount,
      
      // Invoices & Revenue
      total_invoices: totalInvoices,
      paid_invoices: paidInvoices,
      overdue_invoices: overdueInvoices,
      total_revenue: totalRevenue,
      total_outstanding: totalOutstanding,
      total_paid: totalRevenue - totalOutstanding,
      
      // Customer info
      status: customerData.status || 'active',
      priority: customerData.priority || 'normal',
    };

    // Get user admin/manager status (already fetched in parallel above)
    let isUserAdmin = req.user?.user_metadata?.is_admin === true;
    let isUserManager = false;
    
    if (userProfile?.is_admin) {
      isUserAdmin = true;
    }
    
    // Check if user is manager (use allRoles already fetched)
    if (userProfile?.role_id && allRoles) {
      const userRole = allRoles.find(r => r.id === userProfile.role_id);
      if (userRole?.name?.toLowerCase().includes('manager')) {
        isUserManager = true;
      }
    }
    
    const canEditCustomer = isUserAdmin || isUserManager;

    res.render("admin/customer", {
      title: `${customerData.name || 'Klant'} - Klanten | GrowSocial Admin`,
      activeMenu: 'customers',
      user: req.user,
      isUserAdmin,
      isUserManager,
      canEditCustomer,
      customerData: {
        ...customerData,
        customerEmails: customerEmails || [],
        tickets: tickets || [],
        emails: emails || [],
        userAccount: finalUserAccount,
        activities: activities || [],
        tasks: tasks || [],
        timeEntries: timeEntries || [],
        timeTotalsByEmployee: timeTotalsByEmployee,
        responsibleEmployees: responsibleEmployees || [],
        allEmployees: allEmployees || [],
        invoices: invoices || [],
        meetings: meetings || [],
        stats
      },
      scripts: ['/js/admin/customer.js'],
      stylesheets: ['/css/admin/users.css', '/css/admin/customers.css']
    });
  } catch (err) {
    console.error("❌ Admin single customer error:", err);
    res.status(500).render('error', { 
      message: 'Er is een fout opgetreden bij het laden van de klant', 
      error: {}, 
      user: req.user 
    });
  }
});

// =====================================================
// AI: Customer summary (generate/refresh)
// =====================================================
router.post('/api/customers/:id/ai-summary', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // First check if we already have a cached summary
    const { data: existingSummary } = await supabaseAdmin
      .from('customer_ai_summaries')
      .select('id, summary, model, prompt_version, updated_at, created_at, created_by')
      .eq('customer_id', id)
      .maybeSingle();

    // If summary exists and is recent (less than 1 hour old), return it
    // Reduced cache time to ensure fresh data when new items are added
    if (existingSummary && existingSummary.summary) {
      const summaryAge = new Date() - new Date(existingSummary.updated_at || existingSummary.created_at);
      const hoursOld = summaryAge / (1000 * 60 * 60);
      
      if (hoursOld < 1) {
        return res.json({
          success: true,
          summary: existingSummary.summary,
          model: existingSummary.model,
          cached: true,
          aiSummary: existingSummary
        });
      }
    }

    // Fetch ALL data (no limits) for complete AI context
    const [
      customerResult,
      enrichedResult,
      statsResult,
      invoicesResult,
      ticketsResult,
      tasksResult,
      emailsResult,
      responsibleEmployeesResult,
      timeEntriesResult
    ] = await Promise.all([
      supabaseAdmin.from('customers').select('*').eq('id', id).single(),
      supabaseAdmin.from('customer_enriched').select('*').eq('id', id).maybeSingle(),
      supabaseAdmin.from('customer_stats').select('*').eq('id', id).maybeSingle(),
      // Get ALL invoices (no limit)
      supabaseAdmin
        .from('customer_invoices')
        .select('invoice_number, amount, outstanding_amount, status, invoice_date, due_date, external_system')
        .eq('customer_id', id)
        .order('invoice_date', { ascending: false }),
      // Get ALL tickets (no limit)
      supabaseAdmin
        .from('tickets')
        .select('id, title, status, priority, created_at, updated_at, description')
        .eq('customer_id', id)
        .order('created_at', { ascending: false }),
      // Get ALL tasks (no limit)
      supabaseAdmin
        .from('employee_tasks')
        .select('id, title, status, value_cents, created_at, description, priority')
        .eq('customer_id', id)
        .order('created_at', { ascending: false }),
      // Get recent emails (limit to 50 for summary)
      supabaseAdmin
        .from('mail_inbox')
        .select('id, subject, from_email, created_at, read_at')
        .eq('customer_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
      // Get ALL responsible employees (no limit)
      supabaseAdmin
        .from('customer_responsible_employees')
        .select(`
          id, customer_id, employee_id, assigned_at,
          employee:profiles!customer_responsible_employees_employee_id_fkey(id, first_name, last_name, email, role_id),
          assigned_by_user:profiles!customer_responsible_employees_assigned_by_fkey(id, first_name, last_name, email)
        `)
        .eq('customer_id', id)
        .order('assigned_at', { ascending: false }),
      // Get recent time entries for context
      supabaseAdmin
        .from('time_entries')
        .select('duration_minutes, start_at, employee:profiles!time_entries_employee_id_fkey(id, first_name, last_name), task:employee_tasks!time_entries_task_id_fkey(id, title)')
        .eq('customer_id', id)
        .order('start_at', { ascending: false })
        .limit(50)
    ]);

    if (customerResult.error || !customerResult.data) {
      return res.status(404).json({ success: false, error: 'Klant niet gevonden' });
    }

    const customer = customerResult.data;
    const enriched = enrichedResult?.data || null;

    // Reuse stats-style revenue calc for prompt context
    const invoices = invoicesResult?.data || [];
    let totalRevenue = 0;
    let totalOutstanding = 0;
    let paidInvoices = 0;
    let overdueInvoices = 0;
    invoices.forEach(inv => {
      const amount = parseFloat(inv.amount) || 0;
      const outstanding = inv.status === 'paid' ? 0 : (parseFloat(inv.outstanding_amount) || 0);
      totalRevenue += amount;
      totalOutstanding += outstanding;
      if (inv.status === 'paid') paidInvoices++;
      if (inv.status === 'overdue') overdueInvoices++;
    });

    const stats = {
      total_invoices: invoices.length,
      paid_invoices: paidInvoices,
      overdue_invoices: overdueInvoices,
      total_revenue: totalRevenue,
      total_outstanding: totalOutstanding,
      total_paid: totalRevenue - totalOutstanding
    };

    // Generate summary (this will use fallback if OpenAI is not available)
    const { summary, model } = await aiCustomerSummaryService.generateCustomerSummary({
      customer,
      computed: enriched,
      stats,
      invoices: invoices || [],
      tickets: ticketsResult?.data || [],
      tasks: tasksResult?.data || [],
      emails: emailsResult?.data || [],
      responsibleEmployees: responsibleEmployeesResult?.data || []
    });
    
    // Ensure we always have a summary (fallback is built into the service)
    if (!summary || summary.trim().length === 0) {
      // This should never happen, but just in case
      return res.status(500).json({ 
        success: false, 
        error: 'Kon geen samenvatting genereren' 
      });
    }

    const sourceSnapshot = {
      customer_id: id,
      has_openai: aiCustomerSummaryService.isAvailable(),
      generated_at: new Date().toISOString(),
      stats,
      counts: {
        invoices: invoices.length,
        tickets: (ticketsResult?.data || []).length,
        tasks: (tasksResult?.data || []).length,
        emails: (emailsResult?.data || []).length
      }
    };

    // Upsert cache (if table exists). If it doesn't exist yet, still return summary.
    let upserted = null;
    try {
      const { data: upsertData, error: upsertError } = await supabaseAdmin
        .from('customer_ai_summaries')
        .upsert({
          customer_id: id,
          summary,
          model,
          prompt_version: 'v1',
          source_snapshot: sourceSnapshot,
          created_by: req.user?.id || null
        }, { onConflict: 'customer_id' })
        .select('id, summary, model, prompt_version, updated_at, created_at, created_by')
        .maybeSingle();

      if (!upsertError) upserted = upsertData;
    } catch (e) {
      // ignore caching failures
    }

    return res.json({
      success: true,
      summary,
      model,
      cached: !!upserted,
      aiSummary: upserted || null
    });
  } catch (err) {
    console.error('Error generating customer AI summary:', err);
    return res.status(500).json({ success: false, error: 'Fout bij genereren AI samenvatting' });
  }
});

// GET /admin/api/customers/:id/ai-chat - Get chat history
router.get('/api/customers/:id/ai-chat', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: messages, error } = await supabaseAdmin
      .from('customer_ai_chat_messages')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching chat messages:', error);
      return res.status(500).json({ success: false, error: 'Fout bij ophalen chat geschiedenis' });
    }

    return res.json({
      success: true,
      messages: messages || []
    });
  } catch (err) {
    console.error('Error in AI chat history:', err);
    return res.status(500).json({ success: false, error: 'Fout bij ophalen chat geschiedenis' });
  }
});

// POST /admin/api/customers/:id/ai-chat - Chat with AI about customer
router.post('/api/customers/:id/ai-chat', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const userId = req.user.id;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Bericht is verplicht' });
    }

    // Save user message to database
    const { error: userMessageError } = await supabaseAdmin
      .from('customer_ai_chat_messages')
      .insert({
        customer_id: id,
        user_id: userId,
        role: 'user',
        message: message.trim()
      });

    if (userMessageError) {
      console.error('Error saving user message:', userMessageError);
      // Continue anyway, don't fail the request
    }

    // Get chat history for context
    const { data: chatHistory } = await supabaseAdmin
      .from('customer_ai_chat_messages')
      .select('role, message')
      .eq('customer_id', id)
      .order('created_at', { ascending: true })
      .limit(20); // Last 20 messages for context

    // Get ALL customer data (no limits) for complete AI context
    const [
      customerResult,
      enrichedResult,
      statsResult,
      invoicesResult,
      ticketsResult,
      tasksResult,
      emailsResult,
      responsibleEmployeesResult,
      timeEntriesResult
    ] = await Promise.all([
      supabaseAdmin.from('customers').select('*').eq('id', id).single(),
      supabaseAdmin.from('customer_enriched').select('*').eq('id', id).maybeSingle(),
      supabaseAdmin.from('customer_stats').select('*').eq('id', id).maybeSingle(),
      // Get ALL invoices (no limit)
      supabaseAdmin.from('customer_invoices').select('*').eq('customer_id', id).order('invoice_date', { ascending: false }),
      // Get ALL tickets (no limit)
      supabaseAdmin.from('tickets').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
      // Get ALL tasks (no limit)
      supabaseAdmin.from('employee_tasks').select('*, employee:profiles!employee_tasks_employee_id_fkey(id, first_name, last_name, email)').eq('customer_id', id).order('created_at', { ascending: false }),
      // Get ALL emails (no limit)
      supabaseAdmin.from('customer_emails').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
      supabaseAdmin.from('customer_responsible_employees').select('*, employee:profiles!customer_responsible_employees_employee_id_fkey(id, first_name, last_name, email)').eq('customer_id', id),
      // Get recent time entries for context
      supabaseAdmin.from('time_entries').select('*, employee:profiles!time_entries_employee_id_fkey(id, first_name, last_name, email), task:employee_tasks!time_entries_task_id_fkey(id, title)').eq('customer_id', id).order('start_at', { ascending: false }).limit(50)
    ]);

    if (customerResult.error || !customerResult.data) {
      return res.status(404).json({ success: false, error: 'Klant niet gevonden' });
    }

    const customer = customerResult.data;
    const enriched = enrichedResult?.data || {};
    const stats = statsResult?.data || {};
    const invoices = invoicesResult?.data || [];
    const tickets = ticketsResult?.data || [];
    const tasks = tasksResult?.data || [];
    const emails = emailsResult?.data || [];
    const responsibleEmployees = responsibleEmployeesResult?.data || [];
    const timeEntries = timeEntriesResult?.data || [];

    // Build comprehensive context for AI with ALL data
    const context = {
      customer: {
        name: customer.company_name || customer.name,
        email: customer.email,
        phone: customer.phone,
        city: customer.city,
        status: customer.status,
        priority: customer.priority,
        website: customer.website,
        domain: customer.domain,
        address: customer.address,
        postal_code: customer.postal_code,
        industry: customer.hubspot_industry || customer.industry
      },
      stats: {
        total_invoices: invoices.length,
        total_tickets: tickets.length,
        total_tasks: tasks.length,
        total_emails: emails.length,
        total_revenue: stats.total_revenue || 0,
        total_outstanding: stats.total_outstanding || 0,
        open_tickets: tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length,
        open_tasks: tasks.filter(t => t.status === 'open' || t.status === 'in_progress').length,
        overdue_invoices: invoices.filter(i => i.status === 'overdue').length
      },
      // ALL invoices (not just recent)
      all_invoices: invoices.map(i => ({
        invoice_number: i.invoice_number,
        amount: i.amount,
        outstanding_amount: i.outstanding_amount,
        status: i.status,
        invoice_date: i.invoice_date,
        due_date: i.due_date
      })),
      // ALL tickets (not just recent)
      all_tickets: tickets.map(t => ({
        id: t.id,
        title: t.title || t.subject,
        status: t.status,
        priority: t.priority,
        created_at: t.created_at,
        updated_at: t.updated_at,
        description: t.description
      })),
      // ALL tasks (not just recent)
      all_tasks: tasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        value_cents: t.value_cents,
        created_at: t.created_at,
        employee: t.employee ? `${t.employee.first_name} ${t.employee.last_name}` : null,
        description: t.description
      })),
      // Recent emails
      recent_emails: emails.slice(0, 20).map(e => ({
        subject: e.subject,
        from_email: e.from_email,
        created_at: e.created_at,
        read_at: e.read_at
      })),
      // Time entries
      time_entries: timeEntries.map(te => ({
        duration_minutes: te.duration_minutes,
        start_at: te.start_at,
        employee: te.employee ? `${te.employee.first_name} ${te.employee.last_name}` : null,
        task_title: te.task?.title || null
      })),
      responsible_employees: responsibleEmployees.map(re => ({
        name: re.employee ? `${re.employee.first_name} ${re.employee.last_name}` : null,
        email: re.employee?.email || null,
        assigned_at: re.assigned_at
      }))
    };

    // Generate AI response
    const openai = aiCustomerSummaryService.getClient();
    if (!openai) {
      return res.status(503).json({ success: false, error: 'AI service niet beschikbaar' });
    }

    const systemPrompt = `Je bent een CRM assistent die helpt met vragen over klanten. Je hebt toegang tot ALLE klantgegevens inclusief alle facturen, tickets, taken, e-mails en tijdregistraties. Gebruik deze volledige informatie om accurate en actuele antwoorden te geven. Antwoord beknopt, professioneel en actiegericht.`;

    // Build conversation history for AI
    const conversationMessages = [
      { role: 'system', content: systemPrompt }
    ];

    // Build comprehensive context message with ALL data
    const safeJson = (obj) => {
      try { return JSON.stringify(obj, null, 2); } catch { return '{}'; }
    };

    const contextMessage = `KLANTGEGEVENS:
Naam: ${context.customer.name}
Status: ${context.customer.status}
Prioriteit: ${context.customer.priority}
E-mail: ${context.customer.email || 'Onbekend'}
Telefoon: ${context.customer.phone || 'Onbekend'}
Website: ${context.customer.website || context.customer.domain || 'Onbekend'}
Locatie: ${[context.customer.address, context.customer.postal_code, context.customer.city].filter(Boolean).join(', ') || 'Onbekend'}
Branche: ${context.customer.industry || 'Onbekend'}

STATISTIEKEN:
Totaal facturen: ${context.stats.total_invoices}
Totaal tickets: ${context.stats.total_tickets}
Totaal taken: ${context.stats.total_tasks}
Totaal e-mails: ${context.stats.total_emails}
Openstaande tickets: ${context.stats.open_tickets}
Openstaande taken: ${context.stats.open_tasks}
Achterstallige facturen: ${context.stats.overdue_invoices}
Totale omzet: €${context.stats.total_revenue.toFixed(2)}
Openstaand bedrag: €${context.stats.total_outstanding.toFixed(2)}

ALLE FACTUREN (${context.all_invoices.length}):
${safeJson(context.all_invoices)}

ALLE TICKETS (${context.all_tickets.length}):
${safeJson(context.all_tickets)}

ALLE TAKEN (${context.all_tasks.length}):
${safeJson(context.all_tasks)}

RECENTE E-MAILS (${context.recent_emails.length}):
${safeJson(context.recent_emails)}

TIJDREGISTRATIES (${context.time_entries.length}):
${safeJson(context.time_entries)}

VERANTWOORDELIJKE MEDEWERKERS:
${safeJson(context.responsible_employees)}`;

    conversationMessages.push({
      role: 'user',
      content: contextMessage
    });

    // Add chat history (last 10 messages for context)
    if (chatHistory && chatHistory.length > 0) {
      const recentHistory = chatHistory.slice(-10);
      recentHistory.forEach(msg => {
        if (msg.role === 'user' || msg.role === 'assistant') {
          conversationMessages.push({
            role: msg.role,
            content: msg.message
          });
        }
      });
    }

    // Add current user message
    conversationMessages.push({
      role: 'user',
      content: message.trim()
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: conversationMessages,
      temperature: 0.7,
      max_tokens: 1000 // Increased for more detailed responses
    });

    const response = completion.choices?.[0]?.message?.content?.trim() || 'Geen antwoord ontvangen van AI.';

    // Save AI response to database
    const { error: aiMessageError } = await supabaseAdmin
      .from('customer_ai_chat_messages')
      .insert({
        customer_id: id,
        user_id: userId,
        role: 'assistant',
        message: response
      });

    if (aiMessageError) {
      console.error('Error saving AI message:', aiMessageError);
      // Continue anyway, don't fail the request
    }

    return res.json({
      success: true,
      response
    });
  } catch (err) {
    console.error('Error in AI chat:', err);
    return res.status(500).json({ success: false, error: 'Fout bij verzenden bericht' });
  }
});

// ===== CONTACT SINGLE PAGE =====
router.get("/contacts/:id", requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Admin single contact route called for ID: ${id}`);

    // Execute ALL queries in a single parallel batch for maximum performance
    const [
      contactStatsResult,
      contactResult,
      ticketsResult,
      emailsResult,
      tasksResult,
      userProfileResult,
      allProfilesResult,
      allRolesResult,
      customerResult
    ] = await Promise.all([
      // Get contact stats
      supabaseAdmin
        .from('contact_stats')
        .select('*')
        .eq('id', id)
        .single(),
      
      // Get full contact data
      supabaseAdmin
        .from('contacts')
        .select('*')
        .eq('id', id)
        .single(),
      
      // Get tickets (limited) - via customer_id if contact is linked to customer
      supabaseAdmin
        .from('tickets')
        .select('id, title, status, priority, created_at, updated_at, customer_id')
        .order('created_at', { ascending: false })
        .limit(10),
      
      // Get recent emails (limited) - via customer_id if contact is linked to customer
      supabaseAdmin
        .from('mail_inbox')
        .select('id, subject, from_email, created_at, read_at, customer_id')
        .order('created_at', { ascending: false })
        .limit(10),
      
      // Get tasks (limited) - via customer_id if contact is linked to customer
      supabaseAdmin
        .from('employee_tasks')
        .select(`
          id, title, status, value_cents, created_at, customer_id,
          employee:profiles!employee_tasks_employee_id_fkey(id, first_name, last_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(20),
      
      // Get user admin/manager status
      supabase
        .from('profiles')
        .select('is_admin, role_id')
        .eq('id', req.user.id)
        .single(),
      
      // Get all profiles for employee dropdown
      supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, email, role_id, employee_status, is_admin')
        .or('employee_status.eq.active,employee_status.eq.paused,is_admin.eq.true')
        .order('first_name')
        .limit(200),
      
      // Get roles (using cache)
      Promise.resolve().then(async () => {
        const { getAllRoles } = require('../utils/roleCache');
        const roles = await getAllRoles();
        return { data: roles.slice(0, 50), error: null };
      }),
      
      // Get customer if contact is linked to one (will be filtered after)
      Promise.resolve({ data: null, error: null })
    ]);

    const { data: contactStats, error: statsError } = contactStatsResult;
    const { data: contact, error: contactError } = contactResult;
    const { data: tickets } = ticketsResult;
    const { data: emails } = emailsResult;
    const { data: tasks } = tasksResult;
    const { data: userProfile } = userProfileResult;
    const { data: allProfiles } = allProfilesResult;
    const { data: allRoles } = allRolesResult;
    
    // Get customer if contact is linked to one
    let customer = null;
    if (contact?.customer_id) {
      const { data: customerData } = await supabaseAdmin
        .from('customers')
        .select('id, name, company_name, email')
        .eq('id', contact.customer_id)
        .maybeSingle();
      customer = customerData;
    }
    
    if (statsError || !contactStats || contactError || !contact) {
      console.error("❌ Error getting contact:", statsError || contactError);
      return res.status(404).render('error', { 
        message: 'Contactpersoon niet gevonden', 
        error: {}, 
        user: req.user 
      });
    }

    // Combine contact and stats data
    const contactData = {
      ...contact,
      ...contactStats,
      name: contact.name || contactStats.name,
      email: contact.email || contactStats.email,
      phone: contact.phone || contactStats.phone,
      company_name: contact.company_name || contactStats.company_name,
    };

    // Filter tickets, emails, tasks by customer_id if contact is linked to customer
    let contactTickets = [];
    let contactEmails = [];
    let contactTasks = [];
    
    if (contactData.customer_id) {
      contactTickets = (tickets || []).filter(t => t.customer_id === contactData.customer_id);
      contactEmails = (emails || []).filter(e => e.customer_id === contactData.customer_id);
      contactTasks = (tasks || []).filter(t => t.customer_id === contactData.customer_id);
    }

    // Check if user is admin or manager
    let isUserAdmin = req.user?.user_metadata?.is_admin === true;
    let isUserManager = false;
    
    if (userProfile?.is_admin) {
      isUserAdmin = true;
    }
    
    if (userProfile?.role_id) {
      const { data: role } = await supabaseAdmin
        .from('roles')
        .select('name')
        .eq('id', userProfile.role_id)
        .maybeSingle();
      if (role?.name?.toLowerCase().includes('manager')) {
        isUserManager = true;
      }
    }
    
    const canEditContact = isUserAdmin || isUserManager;

    // Calculate stats
    const stats = {
      total_tickets: contactTickets.length,
      open_tickets: contactTickets.filter(t => t.status !== 'closed').length,
      total_emails: contactEmails.length,
      unread_emails: contactEmails.filter(e => !e.read_at).length,
      total_tasks: contactTasks.length,
      open_tasks: contactTasks.filter(t => t.status !== 'done' && t.status !== 'rejected').length,
    };

    res.render("admin/contact", {
      title: `${contactData.name || 'Contactpersoon'} - Contactpersonen | GrowSocial Admin`,
      activeMenu: 'contacts',
      user: req.user,
      isUserAdmin,
      isUserManager,
      canEditContact,
      contactData: {
        ...contactData,
        customer: customer || null,
        tickets: contactTickets || [],
        emails: contactEmails || [],
        tasks: contactTasks || [],
        stats
      },
      allEmployees: (allProfiles || []).map(emp => ({
        id: emp.id,
        first_name: emp.first_name,
        last_name: emp.last_name,
        email: emp.email
      })),
      scripts: ['/js/admin/contact.js'],
      stylesheets: ['/css/admin/users.css', '/css/admin/customers.css']
    });
  } catch (err) {
    console.error("❌ Admin single contact error:", err);
    res.status(500).render('error', { 
      message: 'Er is een fout opgetreden bij het laden van de contactpersoon', 
      error: {}, 
      user: req.user 
    });
  }
});

// ===== CONTACT API ENDPOINTS =====
// Create contact
router.post('/api/contacts', requireAuth, isAdmin, async (req, res) => {
  try {
    const { 
      first_name,
      last_name,
      name,
      email, 
      phone, 
      company_name,
      job_title,
      department,
      address, 
      city, 
      postal_code, 
      country,
      customer_id,
      branch,
      status, 
      priority,
      notes,
      website,
      linkedin_url
    } = req.body
    
    // Build name from first_name + last_name if not provided
    const contactName = name || (first_name && last_name ? `${first_name} ${last_name}`.trim() : (first_name || last_name || 'Onbekend'));
    
    if (!contactName || contactName === 'Onbekend') {
      return res.status(400).json({ success: false, error: 'Naam is verplicht' })
    }

    // Prepare contact data
    const contactData = {
      first_name: first_name || null,
      last_name: last_name || null,
      name: contactName,
      email: email || null,
      phone: phone || null,
      company_name: company_name || null,
      job_title: job_title || null,
      department: department || null,
      address: address || null,
      city: city || null,
      postal_code: postal_code || null,
      country: country || 'NL',
      customer_id: customer_id || null,
      status: status || 'active',
      priority: priority || 'normal',
      notes: notes || null,
      website: website || null,
      linkedin_url: linkedin_url || null,
      created_by: req.user.id
    };

    // Add customer_branch_id if provided
    if (branch) {
      const branchId = branch.split(',')[0]?.trim();
      if (branchId) {
        contactData.customer_branch_id = parseInt(branchId) || null;
      }
    }

    const { data: contact, error } = await supabaseAdmin
      .from('contacts')
      .insert(contactData)
      .select()
      .single()
    
    if (error) throw error
    
    res.json({ success: true, contact })
  } catch (err) {
    console.error('Create contact error:', err)
    res.status(500).json({ success: false, error: err.message || 'Fout bij aanmaken contactpersoon' })
  }
})

// Convert contact to opportunity
router.post('/api/contacts/:id/convert-to-opportunity', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { value, notes } = req.body || {}
    
    // Get contact data
    const { data: contact, error: contactError } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('id', id)
      .single()
    
    if (contactError || !contact) {
      return res.status(404).json({ success: false, error: 'Contactpersoon niet gevonden' })
    }
    
    // Check if already converted
    if (contact.converted_to_opportunity_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Contactpersoon is al omgezet naar een kans',
        opportunity_id: contact.converted_to_opportunity_id
      })
    }
    
    // Create opportunity from contact
    const opportunityTitle = contact.company_name 
      ? `${contact.name} - ${contact.company_name}`.slice(0, 140)
      : contact.name.slice(0, 140)
    
    const { data: opportunity, error: oppError } = await supabaseAdmin
      .from('opportunities')
      .insert({
        title: opportunityTitle,
        contact_name: contact.name,
        email: contact.email || null,
        phone: contact.phone || null,
        company_name: contact.company_name || null,
        address: contact.address || null,
        city: contact.city || null,
        postcode: contact.postal_code || null,
        status: 'open',
        stage: 'nieuw',
        owner_id: req.user.id,
        value: value || null,
        notes: notes || contact.notes || `Omgezet van contactpersoon: ${contact.name}`
      })
      .select()
      .single()
    
    if (oppError) {
      return res.status(500).json({ success: false, error: oppError.message })
    }
    
    // Update contact to mark as converted
    await supabaseAdmin
      .from('contacts')
      .update({
        converted_to_opportunity_id: opportunity.id,
        converted_at: new Date().toISOString()
      })
      .eq('id', id)
    
    res.json({ 
      success: true, 
      opportunity,
      opportunity_id: opportunity.id
    })
  } catch (err) {
    console.error('Convert contact to opportunity error:', err)
    res.status(500).json({ success: false, error: err.message || 'Fout bij omzetten naar kans' })
  }
})

// Contact photo upload endpoint
const contactPhotoStorage = _isVercel ? multer.memoryStorage() : multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'contact-photos')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const { id } = req.params
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    cb(null, `contact-photo-${id}-${uniqueSuffix}${ext}`)
  }
})

const uploadContactPhoto = multer({ 
  storage: contactPhotoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Ongeldig bestandstype. Alleen afbeeldingen toegestaan (JPEG, PNG, GIF, WEBP).'))
    }
  }
})

router.post('/api/contacts/:id/photo', requireAuth, isAdmin, uploadContactPhoto.single('photo'), async (req, res) => {
  try {
    const { id } = req.params
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Geen bestand geüpload' })
    }
    let photoUrl
    if (_isVercel && req.file.buffer) {
      const bucketOk = await ensureStorageBucket('uploads', true)
      if (!bucketOk) return res.status(500).json({ success: false, error: 'Storage niet beschikbaar' })
      const ext = path.extname(req.file.originalname) || '.png'
      const fileName = `contact-photos/contact-photo-${id}-${Date.now()}${ext}`
      const { error: uploadErr } = await supabaseAdmin.storage.from('uploads').upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: true })
      if (uploadErr) return res.status(500).json({ success: false, error: 'Fout bij uploaden: ' + uploadErr.message })
      const { data: { publicUrl } } = supabaseAdmin.storage.from('uploads').getPublicUrl(fileName)
      photoUrl = publicUrl
    } else {
      photoUrl = '/uploads/contact-photos/' + req.file.filename
    }
    const { data: contact, error: updateError } = await supabaseAdmin
      .from('contacts')
      .update({
        photo_url: photoUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (updateError) {
      if (!_isVercel && req.file?.path) fs.unlinkSync(req.file.path)
      return res.status(500).json({ success: false, error: 'Fout bij bijwerken contactpersoon: ' + updateError.message })
    }
    res.json({ success: true, photo_url: photoUrl, contact })
  } catch (error) {
    console.error('Contact photo upload error:', error)
    if (!_isVercel && req.file?.path) fs.unlinkSync(req.file.path)
    res.status(500).json({ success: false, error: error.message || 'Fout bij uploaden foto' })
  }
})

// ===== CALENDAR API ENDPOINTS =====
// Get calendar events
router.get('/api/calendar/events', requireAuth, isAdmin, async (req, res) => {
  try {
    const { start, end, category, agenda, created_by } = req.query;
    const currentUserId = req.user?.id;
    const isAdminUser = req.user?.user_metadata?.is_admin || false;
    
    // Determine if user is a manager
    let isManager = false;
    if (req.user?.role_id) {
      const { data: role } = await supabaseAdmin
        .from('roles')
        .select('name')
        .eq('id', req.user.role_id)
        .maybeSingle();
      if (role?.name?.toLowerCase().includes('manager')) {
        isManager = true;
      }
    }
    
    const canViewAll = isAdminUser || isManager;
    
    let query = supabaseAdmin
      .from('calendar_events')
      .select('*, creator:profiles!calendar_events_created_by_fkey(id, first_name, last_name, email)')
      .is('deleted_at', null)
      .order('start_time', { ascending: true });
    
    // Filter by date range
    if (start) {
      query = query.gte('start_time', start);
    }
    if (end) {
      query = query.lte('end_time', end);
    }
    
    // Filter by category
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }
    
    // Filter by agenda
    if (agenda === 'main') {
      // Main agenda: events without created_by (system events) or specific flag
      // For now, we'll show all events but mark which are "main"
      // In future, we can add a flag to calendar_events table
    } else if (created_by) {
      // Specific employee agenda
      if (!canViewAll && created_by !== currentUserId) {
        return res.status(403).json({ 
          success: false, 
          error: 'Geen toegang tot deze agenda' 
        });
      }
      query = query.eq('created_by', created_by);
    } else if (agenda === 'all' && canViewAll) {
      // All agendas (totaal view) - no filter, show all
    } else {
      // Default: show only own events for regular employees
      if (!canViewAll) {
        query = query.eq('created_by', currentUserId);
      }
    }
    
    const { data: events, error } = await query;
    
    if (error) throw error;
    
    // Get all employees for color mapping
    let allEmployees = [];
    if (canViewAll) {
      const { data: empData } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, email')
        .or('employee_status.eq.active,employee_status.eq.paused,is_admin.eq.true')
        .order('first_name')
        .limit(200);
      allEmployees = empData || [];
    }
    
    // Default colors for employees
    const employeeColors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
      '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
    ];
    
    // Create color map
    const employeeColorMap = {};
    allEmployees.forEach(function(emp, index) {
      employeeColorMap[emp.id] = employeeColors[index % employeeColors.length];
    });
    
    // Default category colors
    const categoryColors = {
      'meeting': '#3b82f6',
      'call': '#10b981',
      'appointment': '#f59e0b',
      'task': '#ef4444'
    };
    
    // Add creator info and color to each event
    const processedEvents = (events || []).map(function(event) {
      var eventColor = null;
      if (event.created_by && employeeColorMap[event.created_by]) {
        eventColor = employeeColorMap[event.created_by];
      } else {
        // Default colors based on category
        eventColor = categoryColors[event.category] || '#6b7280';
      }
      
      return {
        ...event,
        creator_color: eventColor,
        creator_name: event.creator ? 
          ((event.creator.first_name || '') + ' ' + (event.creator.last_name || '')).trim() || event.creator.email || 'Onbekend' 
          : 'GrowSocial'
      };
    });
    
    res.json({ 
      success: true, 
      events: processedEvents 
    });
  } catch (err) {
    console.error('Get calendar events error:', err);
    res.status(500).json({ success: false, error: err.message || 'Fout bij ophalen afspraken' });
  }
});

// Create calendar event
router.post('/api/calendar/events', requireAuth, isAdmin, async (req, res) => {
  try {
    const {
      title,
      description,
      start_time,
      end_time,
      category,
      customer_id,
      contact_id,
      location,
      client_name,
      status
    } = req.body;
    
    if (!title || !start_time || !end_time) {
      return res.status(400).json({ 
        success: false, 
        error: 'Titel, starttijd en eindtijd zijn verplicht' 
      });
    }
    
    // Validate dates
    const start = new Date(start_time);
    const end = new Date(end_time);
    
    if (start >= end) {
      return res.status(400).json({ 
        success: false, 
        error: 'Eindtijd moet na starttijd zijn' 
      });
    }
    
    // Process reminder recipients - replace 'self' with current user ID
    let processedReminderRecipients = null;
    if (reminder_recipients && Array.isArray(reminder_recipients)) {
      processedReminderRecipients = reminder_recipients
        .filter(function(r) { return r !== 'self'; })
        .map(function(r) { return r; });
      
      // Add current user if 'self' was in the array
      if (reminder_recipients.indexOf('self') !== -1) {
        processedReminderRecipients.push(req.user.id);
      }
      
      if (processedReminderRecipients.length === 0) {
        processedReminderRecipients = null;
      }
    }
    
    const eventData = {
      title: title.trim(),
      description: description || null,
      start_time: start_time,
      end_time: end_time,
      category: category || 'appointment',
      customer_id: customer_id || null,
      contact_id: contact_id || null,
      location: location || null,
      client_name: client_name || null,
      status: status || 'scheduled',
      meeting_type: meeting_type || null,
      reminder_minutes: reminder_minutes && reminder_minutes.length > 0 ? reminder_minutes : null,
      reminder_recipients: processedReminderRecipients,
      is_recurring: is_recurring || false,
      recurrence_frequency: recurrence_frequency || null,
      recurrence_interval: recurrence_interval || null,
      recurrence_end_date: recurrence_end_date || null,
      recurrence_count: recurrence_count || null,
      recurrence_days_of_week: recurrence_days_of_week && recurrence_days_of_week.length > 0 ? recurrence_days_of_week : null,
      created_by: req.user.id
    };
    
    const { data: event, error } = await supabaseAdmin
      .from('calendar_events')
      .insert(eventData)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, event });
  } catch (err) {
    console.error('Create calendar event error:', err);
    res.status(500).json({ success: false, error: err.message || 'Fout bij aanmaken afspraak' });
  }
});

// Update calendar event
router.put('/api/calendar/events/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      start_time,
      end_time,
      category,
      customer_id,
      contact_id,
      location,
      client_name,
      status
    } = req.body;
    
    // Validate dates if provided
    if (start_time && end_time) {
      const start = new Date(start_time);
      const end = new Date(end_time);
      
      if (start >= end) {
        return res.status(400).json({ 
          success: false, 
          error: 'Eindtijd moet na starttijd zijn' 
        });
      }
    }
    
    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description || null;
    if (start_time !== undefined) updateData.start_time = start_time;
    if (end_time !== undefined) updateData.end_time = end_time;
    if (category !== undefined) updateData.category = category;
    if (customer_id !== undefined) updateData.customer_id = customer_id || null;
    if (contact_id !== undefined) updateData.contact_id = contact_id || null;
    if (location !== undefined) updateData.location = location || null;
    if (client_name !== undefined) updateData.client_name = client_name || null;
    if (status !== undefined) updateData.status = status;
    if (meeting_type !== undefined) updateData.meeting_type = meeting_type || null;
    if (reminder_minutes !== undefined) updateData.reminder_minutes = reminder_minutes && reminder_minutes.length > 0 ? reminder_minutes : null;
    if (reminder_recipients !== undefined) {
      // Process reminder recipients - replace 'self' with current user ID
      let processedRecipients = null;
      if (reminder_recipients && Array.isArray(reminder_recipients)) {
        processedRecipients = reminder_recipients
          .filter(function(r) { return r !== 'self'; })
          .map(function(r) { return r; });
        
        if (reminder_recipients.indexOf('self') !== -1) {
          processedRecipients.push(req.user.id);
        }
        
        if (processedRecipients.length === 0) {
          processedRecipients = null;
        }
      }
      updateData.reminder_recipients = processedRecipients;
    }
    if (is_recurring !== undefined) updateData.is_recurring = is_recurring || false;
    if (recurrence_frequency !== undefined) updateData.recurrence_frequency = recurrence_frequency || null;
    if (recurrence_interval !== undefined) updateData.recurrence_interval = recurrence_interval || null;
    if (recurrence_end_date !== undefined) updateData.recurrence_end_date = recurrence_end_date || null;
    if (recurrence_count !== undefined) updateData.recurrence_count = recurrence_count || null;
    if (recurrence_days_of_week !== undefined) updateData.recurrence_days_of_week = recurrence_days_of_week && recurrence_days_of_week.length > 0 ? recurrence_days_of_week : null;
    
    const { data: event, error } = await supabaseAdmin
      .from('calendar_events')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();
    
    if (error) throw error;
    
    if (!event) {
      return res.status(404).json({ success: false, error: 'Afspraak niet gevonden' });
    }
    
    res.json({ success: true, event });
  } catch (err) {
    console.error('Update calendar event error:', err);
    res.status(500).json({ success: false, error: err.message || 'Fout bij bijwerken afspraak' });
  }
});

// Delete calendar event
router.delete('/api/calendar/events/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Soft delete
    const { data: event, error } = await supabaseAdmin
      .from('calendar_events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();
    
    if (error) throw error;
    
    if (!event) {
      return res.status(404).json({ success: false, error: 'Afspraak niet gevonden' });
    }
    
    res.json({ success: true, message: 'Afspraak verwijderd' });
  } catch (err) {
    console.error('Delete calendar event error:', err);
    res.status(500).json({ success: false, error: err.message || 'Fout bij verwijderen afspraak' });
  }
});

// Delete contact photo
router.delete('/api/contacts/:id/photo', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    
    // Get current photo URL
    const { data: contact, error: getError } = await supabaseAdmin
      .from('contacts')
      .select('photo_url')
      .eq('id', id)
      .single()
    
    if (getError || !contact) {
      return res.status(404).json({ success: false, error: 'Contactpersoon niet gevonden' })
    }
    
    // Delete photo file if exists
    if (contact.photo_url) {
      const photoPath = path.join(__dirname, '..', 'public', contact.photo_url)
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath)
      }
    }
    
    // Update contact to remove photo URL
    const { data: updatedContact, error: updateError } = await supabaseAdmin
      .from('contacts')
      .update({
        photo_url: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (updateError) {
      return res.status(500).json({ success: false, error: 'Fout bij verwijderen foto: ' + updateError.message })
    }
    
    res.json({ success: true, contact: updatedContact })
  } catch (error) {
    console.error('Delete contact photo error:', error)
    res.status(500).json({ success: false, error: error.message || 'Fout bij verwijderen foto' })
  }
})

// ===== TEAMS (for Overleg / time tracker) =====
// GET /admin/api/teams - List teams for dropdown
router.get('/api/teams', requireAuth, async (req, res) => {
  try {
    const { data: teams, error } = await supabaseAdmin
      .from('teams')
      .select('id, name')
      .order('name')
    if (error) throw error
    res.json({ ok: true, data: teams || [] })
  } catch (err) {
    console.error('Error listing teams:', err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// POST /admin/api/teams - Create team (admin/manager)
router.post('/api/teams', requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { name } = req.body || {}
    if (!name || !String(name).trim()) {
      return res.status(400).json({ ok: false, error: 'Naam is verplicht' })
    }
    const { data: team, error } = await supabaseAdmin
      .from('teams')
      .insert({ name: String(name).trim() })
      .select('id, name')
      .single()
    if (error) throw error
    res.json({ ok: true, data: team })
  } catch (err) {
    console.error('Error creating team:', err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ===== COLLEAGUES SEARCH (overleg deelnemers: werknemers, managers, admins) =====
// GET /admin/api/profiles/search?q= - Search colleagues for time tracker Overleg participants
router.get('/api/profiles/search', requireAuth, async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim()
    if (q.length < 2) {
      return res.json([])
    }
    const sanitized = q.replace(/[%_]/g, '\\$&')
    const pattern = `%${sanitized}%`
    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email, company_name')
      .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},company_name.ilike.${pattern}`)
      .order('first_name')
      .limit(20)
    if (error) throw error
    const list = (profiles || []).map((p) => {
      const fullName = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
      const displayName = fullName || p.company_name || p.email || '—'
      return {
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email,
        full_name: fullName || null,
        display_name: displayName
      }
    })
    res.json(list)
  } catch (err) {
    console.error('Error colleagues search:', err)
    res.status(500).json({ error: 'Fout bij zoeken' })
  }
})

// ===== TICKET API ENDPOINTS =====
// GET /admin/api/tickets/search - Ticket search for time tracker (Support). Admin: all; else: assigned only.
router.get('/api/tickets/search', requireAuth, async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim().replace(/%/g, '\\%')
    const limit = Math.min(parseInt(req.query.limit) || 15, 20)
    const isAdmin = req.user?.user_metadata?.is_admin === true || req.user?.is_admin === true

    let query = supabaseAdmin
      .from('tickets')
      .select(`
        id,
        ticket_number,
        subject,
        status,
        priority,
        customer_id,
        assignee_id,
        customers:customer_id(id, name, company_name),
        assignee:assignee_id(id, first_name, last_name)
      `)
      .order('last_activity_at', { ascending: false })
      .limit(limit)

    if (q.length >= 2) {
      const pattern = `%${q}%`
      query = query.or(`subject.ilike.${pattern},ticket_number.ilike.${pattern},description.ilike.${pattern}`)
    }

    if (!isAdmin) {
      query = query.eq('assignee_id', req.user.id)
    }

    const { data: tickets, error } = await query

    if (error) throw error

    const results = (tickets || []).map((t) => {
      const customerName = t.customers?.company_name || t.customers?.name || null
      const assigneeName = t.assignee ? [t.assignee.first_name, t.assignee.last_name].filter(Boolean).join(' ') : null
      const title = (t.ticket_number || '') + (t.subject ? ' – ' + t.subject : '')
      const subtitle = [customerName, t.status, assigneeName].filter(Boolean).join(' · ')
      return {
        id: t.id,
        title: title || 'Ticket',
        subtitle: subtitle || undefined,
        status: t.status,
        priority: t.priority || null,
        customerName: customerName || undefined,
        assigneeName: assigneeName || undefined,
        avatarUrl: null
      }
    })

    res.json({ ok: true, data: results })
  } catch (error) {
    console.error('Error tickets search:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

router.post('/api/tickets', requireAuth, isAdmin, async (req, res) => {
  try {
    const { subject, description, customer_id, mail_id, priority, category, assigned_to, due_date } = req.body
    
    if (!subject) {
      return res.status(400).json({ error: 'Onderwerp is verplicht' })
    }
    
    const { data: ticket, error } = await supabaseAdmin
      .from('tickets')
      .insert({
        subject,
        description: description || null,
        customer_id: customer_id || null,
        mail_id: mail_id || null,
        priority: priority || 'normal',
        category: category || 'support',
        assignee_id: assigned_to || null,
        due_at: due_date || null,
        created_by: req.user.id,
        status: 'open'
      })
      .select()
      .single()
    
    if (error) throw error
    
    res.json({ success: true, ticket })
  } catch (e) {
    res.status(500).json({ error: 'Fout bij aanmaken ticket: ' + e.message })
  }
})

router.post('/api/tickets/from-mail/:mailId', requireAuth, isAdmin, async (req, res) => {
  try {
    const { mailId } = req.params
    const { subject, description, priority, category, assigned_to } = req.body
    
    // Get mail details
    const { data: mail, error: mailError } = await supabaseAdmin
      .from('mail_inbox')
      .select('*, customers!mail_inbox_customer_id_fkey(id)')
      .eq('id', mailId)
      .single()
    
    if (mailError || !mail) {
      return res.status(404).json({ error: 'Mail niet gevonden' })
    }
    
    // Get or create customer
    let customerId = mail.customer_id
    
    if (!customerId && mail.from_email) {
      // Try to find customer by email
      const emailDomain = mail.from_email.split('@')[1]
      
      const { data: customerByEmail } = await supabaseAdmin
        .from('customer_emails')
        .select('customer_id')
        .eq('email', mail.from_email)
        .maybeSingle()
      
      if (customerByEmail) {
        customerId = customerByEmail.customer_id
      } else {
        // Try by domain
        const { data: customerByDomain } = await supabaseAdmin
          .from('customers')
          .select('id')
          .eq('domain', emailDomain)
          .maybeSingle()
        
        if (customerByDomain) {
          customerId = customerByDomain.id
        }
      }
    }
    
    const ticketSubject = subject || (mail.subject && mail.subject.startsWith('Re:') ? mail.subject : `Re: ${mail.subject || 'Geen onderwerp'}`)
    const ticketDescription = description || `Ticket aangemaakt van e-mail:\n\nVan: ${mail.from_name || mail.from_email}\nOnderwerp: ${mail.subject || 'Geen onderwerp'}\n\n${mail.body_text || ''}`
    
    // Use suggested priority from AI analysis if available, otherwise use provided priority or default
    const ticketPriority = priority || mail.suggested_ticket_priority || 'normal'
    
    const { data: ticket, error } = await supabaseAdmin
      .from('tickets')
      .insert({
        subject: ticketSubject,
        description: ticketDescription,
        customer_id: customerId,
        mail_id: mailId,
        priority: ticketPriority,
        category: category || 'support',
        assignee_id: assigned_to || null,
        created_by: req.user.id,
        status: 'open',
        source: 'email'
      })
      .select(`
        *,
        customers:customer_id(name, email),
        assignee:assignee_id(first_name, last_name, email)
      `)
      .single()
    
    if (error) throw error
    
    // Update mail to link it to the ticket
    if (customerId) {
      await supabaseAdmin
        .from('mail_inbox')
        .update({ 
          customer_id: customerId,
          ticket_id: ticket.id,
          ticket_created_at: new Date().toISOString()
        })
        .eq('id', mailId)
    } else {
      // Still update ticket_id even if no customer
      await supabaseAdmin
        .from('mail_inbox')
        .update({ 
          ticket_id: ticket.id,
          ticket_created_at: new Date().toISOString()
        })
        .eq('id', mailId)
    }
    
    res.json({ success: true, ticket })
  } catch (e) {
    res.status(500).json({ error: 'Fout bij aanmaken ticket van mail: ' + e.message })
  }
})

// POST /api/mails/:mailId/confirm-customer-link - Confirm customer link manually
router.post('/api/mails/:mailId/confirm-customer-link', requireAuth, isAdmin, async (req, res) => {
  try {
    const { mailId } = req.params
    const { customer_id, create_mapping } = req.body
    
    if (!customer_id) {
      return res.status(400).json({ error: 'customer_id is verplicht' })
    }
    
    // Update mail with confirmed customer link
    const { data: mail, error: mailError } = await supabaseAdmin
      .from('mail_inbox')
      .select('from_email')
      .eq('id', mailId)
      .single()
    
    if (mailError || !mail) {
      return res.status(404).json({ error: 'Mail niet gevonden' })
    }
    
    // Update mail
    const { data: updatedMail, error: updateError } = await supabaseAdmin
      .from('mail_inbox')
      .update({
        customer_id: customer_id,
        customer_link_confirmed: true,
        customer_link_confirmed_by: req.user.id,
        customer_link_confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', mailId)
      .select()
      .single()
    
    if (updateError) throw updateError
    
    // If create_mapping is true, create email_customer_mapping for future emails
    if (create_mapping && mail.from_email) {
      const emailDomain = mail.from_email.split('@')[1]?.toLowerCase()
      
      // Create email mapping (exact email)
      await supabaseAdmin
        .from('email_customer_mappings')
        .upsert({
          mapping_type: 'email',
          email_or_domain: mail.from_email.toLowerCase(),
          customer_id: customer_id,
          confirmed: true,
          confirmed_by: req.user.id,
          confirmed_at: new Date().toISOString()
        }, {
          onConflict: 'mapping_type,email_or_domain,customer_id'
        })
      
      // Also create domain mapping if domain is not a common email provider
      if (emailDomain && !['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'live.com', 'icloud.com', 'me.com', 'protonmail.com', 'mail.com'].includes(emailDomain)) {
        await supabaseAdmin
          .from('email_customer_mappings')
          .upsert({
            mapping_type: 'domain',
            email_or_domain: emailDomain,
            customer_id: customer_id,
            confirmed: true,
            confirmed_by: req.user.id,
            confirmed_at: new Date().toISOString()
          }, {
            onConflict: 'mapping_type,email_or_domain,customer_id'
          })
      }
    }
    
    res.json({ success: true, mail: updatedMail })
  } catch (e) {
    res.status(500).json({ error: 'Fout bij bevestigen customer link: ' + e.message })
  }
})

// POST /api/mails/:mailId/auto-create-ticket - Auto-create ticket from email with AI-suggested priority
router.post('/api/mails/:mailId/auto-create-ticket', requireAuth, isAdmin, async (req, res) => {
  try {
    const { mailId } = req.params
    const TicketAssignmentService = require('../services/ticketAssignmentService')
    
    // Get mail with labels
    const { data: mail, error: mailError } = await supabaseAdmin
      .from('mail_inbox')
      .select(`
        *,
        customers!mail_inbox_customer_id_fkey(id, name, email, domain),
        mail_labels(label)
      `)
      .eq('id', mailId)
      .single()
    
    if (mailError || !mail) {
      return res.status(404).json({ error: 'Mail niet gevonden' })
    }
    
    // Check if ticket should be created
    if (!mail.should_create_ticket && !mail.suggested_ticket_priority) {
      // Re-analyze if not already analyzed
      const AiMailService = require('../services/aiMailService')
      const labels = (mail.mail_labels || []).map(l => l.label)
      const mailForAnalysis = {
        subject: mail.subject,
        body_text: mail.body_text,
        from_email: mail.from_email,
        labels: labels
      }
      
      const ticketAnalysis = AiMailService.analyzeTicketNeeds(mailForAnalysis)
      
      if (!ticketAnalysis.shouldCreateTicket) {
        return res.status(400).json({ error: 'Deze e-mail heeft geen ticket nodig volgens de AI analyse' })
      }
      
      // Update mail with analysis
      await supabaseAdmin
        .from('mail_inbox')
        .update({
          should_create_ticket: true,
          suggested_ticket_priority: ticketAnalysis.priority
        })
        .eq('id', mailId)
      
      mail.suggested_ticket_priority = ticketAnalysis.priority
    }
    
    // Get customer ID (use confirmed, auto-linked, or try to find)
    let customerId = mail.customer_id || mail.auto_linked_customer_id
    
    if (!customerId && mail.from_email) {
      // Try to find customer by email/domain
      const emailDomain = mail.from_email.split('@')[1]
      
      const { data: customerByDomain } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('domain', emailDomain)
        .maybeSingle()
      
      if (customerByDomain) {
        customerId = customerByDomain.id
      }
    }
    
    // Auto-assign ticket based on skills - ALWAYS assign to someone
    let assigneeId = null
    let assigneeName = null
    let assignmentInfo = null
    
    try {
      assignmentInfo = await TicketAssignmentService.autoAssignTicketFromMail(mail, {
        subject: mail.subject,
        description: mail.body_text,
        priority: mail.suggested_ticket_priority || 'normal'
      })
      
      if (assignmentInfo && assignmentInfo.assignee_id) {
        assigneeId = assignmentInfo.assignee_id
        assigneeName = assignmentInfo.assignee_name
        console.log(`✅ Auto-assigned ticket to ${assigneeName} (${assignmentInfo.reason})`)
      } else {
        // Fallback: assign to first available employee if service didn't return anyone
        // Try is_employee flag first, then fallback to non-admin active profiles
        const { data: fallbackEmployee } = await supabaseAdmin
          .from('profiles')
          .select('id, first_name, last_name, is_employee')
          .eq('status', 'active')
          .or('is_employee.eq.true,is_admin.eq.false')
          .order('is_employee', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle()
        
        if (fallbackEmployee) {
          assigneeId = fallbackEmployee.id
          assigneeName = [fallbackEmployee.first_name, fallbackEmployee.last_name].filter(Boolean).join(' ') || 'Onbekend'
          assignmentInfo = {
            assignee_id: fallbackEmployee.id,
            assignee_name: assigneeName,
            reason: 'Fallback: eerste beschikbare medewerker (geen skill match gevonden)'
          }
          console.log(`⚠️ No skill match found, assigned to first available employee: ${assigneeName}`)
        } else {
          console.warn('⚠️ No employees available for ticket assignment - ticket will be unassigned')
        }
      }
    } catch (assignError) {
      console.error('Error in auto-assignment, trying fallback:', assignError)
      // Try fallback even on error
      try {
        const { data: fallbackEmployee } = await supabaseAdmin
          .from('profiles')
          .select('id, first_name, last_name')
          .eq('status', 'active')
          .or('is_employee.eq.true,is_admin.eq.false')
          .limit(1)
          .maybeSingle()
        
        if (fallbackEmployee) {
          assigneeId = fallbackEmployee.id
          assigneeName = [fallbackEmployee.first_name, fallbackEmployee.last_name].filter(Boolean).join(' ') || 'Onbekend'
          console.log(`⚠️ Fallback assignment after error: ${assigneeName}`)
        }
      } catch (fallbackError) {
        console.error('Fallback assignment also failed:', fallbackError)
      }
    }
    
    // Generate AI summary for ticket description
    const AiMailService = require('../services/aiMailService')
    let ticketDescription = ''
    try {
      const mailForSummary = {
        subject: mail.subject,
        body_text: mail.body_text,
        from_email: mail.from_email,
        from_name: mail.from_name
      }
      ticketDescription = await AiMailService.generateSupportSummary(mailForSummary)
    } catch (summaryError) {
      console.error('Error generating summary, using fallback:', summaryError)
      // Fallback to original format
      ticketDescription = `Ticket automatisch aangemaakt van e-mail:\n\nVan: ${mail.from_name || mail.from_email}\nE-mail: ${mail.from_email}\nOnderwerp: ${mail.subject || 'Geen onderwerp'}\n\n${mail.body_text || ''}`
    }
    
    // Create ticket
    const ticketSubject = mail.subject || 'Geen onderwerp'
    
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .insert({
        subject: ticketSubject,
        description: ticketDescription,
        customer_id: customerId,
        mail_id: mailId,
        priority: mail.suggested_ticket_priority || 'normal',
        category: 'support',
        source: 'email',
        requester_email: mail.from_email,
        requester_name: mail.from_name,
        assignee_id: assigneeId,
        created_by: req.user.id,
        status: 'open'
      })
      .select(`
        *,
        customers:customer_id(id, name, email),
        assignee:assignee_id(first_name, last_name, email)
      `)
      .single()
    
    if (ticketError) throw ticketError
    
    // Update mail to link it to the ticket
    await supabaseAdmin
      .from('mail_inbox')
      .update({
        ticket_id: ticket.id,
        ticket_created_at: new Date().toISOString(),
        customer_id: customerId || undefined
      })
      .eq('id', mailId)
    
    res.json({ 
      success: true, 
      ticket,
      assignment: assignmentInfo ? {
        assigned_to: assigneeName,
        reason: assignmentInfo.reason,
        matching_skills: assignmentInfo.matching_skills || []
      } : null
    })
  } catch (e) {
    res.status(500).json({ error: 'Fout bij automatisch aanmaken ticket: ' + e.message })
  }
})

router.put('/api/tickets/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body
    
    const { data: ticket, error } = await supabaseAdmin
      .from('tickets')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    
    res.json({ success: true, ticket })
  } catch (e) {
    res.status(500).json({ error: 'Fout bij bijwerken ticket: ' + e.message })
  }
})

router.delete('/api/tickets/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    
    const { error } = await supabaseAdmin
      .from('tickets')
      .delete()
      .eq('id', id)
    
    if (error) throw error
    
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: 'Fout bij verwijderen ticket: ' + e.message })
  }
})

// ===== COMPREHENSIVE TICKET API ENDPOINTS =====

// GET /api/admin/tickets - List tickets with filters
router.get('/api/admin/tickets', requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const { 
      search, 
      status, 
      priority, 
      assignee, 
      category, 
      tag, 
      dateFrom, 
      dateTo, 
      sort = 'last_activity_at', 
      page = 1, 
      pageSize = 20,
      onlyMine 
    } = req.query
    
    let query = supabaseAdmin
      .from('tickets')
      .select(`
        *,
        customers:customer_id(name, email),
        assignee:assignee_id(id, first_name, last_name, email)
      `, { count: 'exact' })
    
    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    if (priority && priority !== 'all') {
      query = query.eq('priority', priority)
    }
    if (assignee && assignee !== 'all') {
      if (assignee === 'unassigned') {
        query = query.is('assignee_id', null)
      } else {
        query = query.eq('assignee_id', assignee)
      }
    }
    if (category && category !== 'all') {
      query = query.eq('category', category)
    }
    if (tag) {
      query = query.contains('tags', [tag])
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo)
    }
    if (onlyMine === 'true' && req.user?.id) {
      query = query.eq('assignee_id', req.user.id)
    }
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`
      query = query.or(`subject.ilike.${searchTerm},ticket_number.ilike.${searchTerm},description.ilike.${searchTerm},requester_email.ilike.${searchTerm},requester_name.ilike.${searchTerm}`)
    }
    
    // Sorting
    const ascending = sort.startsWith('-') ? false : true
    const sortField = sort.replace(/^-/, '') || 'last_activity_at'
    query = query.order(sortField, { ascending })
    
    // Pagination
    const pageNum = parseInt(page) || 1
    const pageSizeNum = parseInt(pageSize) || 20
    const offset = (pageNum - 1) * pageSizeNum
    query = query.range(offset, offset + pageSizeNum - 1)
    
    const { data: tickets, error, count } = await query
    
    if (error) throw error
    
    // Get comment and attachment counts
    const ticketIds = tickets?.map(t => t.id) || []
    let commentCounts = {}
    let attachmentCounts = {}
    
    if (ticketIds.length > 0) {
      const { data: comments } = await supabaseAdmin
        .from('ticket_comments')
        .select('ticket_id')
        .in('ticket_id', ticketIds)
      
      const { data: attachments } = await supabaseAdmin
        .from('ticket_attachments')
        .select('ticket_id')
        .in('ticket_id', ticketIds)
      
      comments?.forEach(c => {
        commentCounts[c.ticket_id] = (commentCounts[c.ticket_id] || 0) + 1
      })
      
      attachments?.forEach(a => {
        attachmentCounts[a.ticket_id] = (attachmentCounts[a.ticket_id] || 0) + 1
      })
    }
    
    // Fetch creator data separately if tickets exist
    let creatorMap = {}
    if (tickets && tickets.length > 0) {
      const creatorIds = [...new Set(tickets.map(t => t.created_by).filter(Boolean))]
      if (creatorIds.length > 0) {
        const { data: creators } = await supabaseAdmin
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', creatorIds)
        
        creators?.forEach(c => { creatorMap[c.id] = c })
      }
    }
    
    // Add derived fields
    const ticketsWithCounts = tickets?.map(ticket => ({
      ...ticket,
      creator: ticket.created_by && creatorMap[ticket.created_by] ? creatorMap[ticket.created_by] : null,
      comment_count: commentCounts[ticket.id] || 0,
      attachment_count: attachmentCounts[ticket.id] || 0,
      sla_risk: ticket.due_at && new Date(ticket.due_at) < new Date(),
      days_open: ticket.created_at ? Math.floor((new Date() - new Date(ticket.created_at)) / (1000 * 60 * 60 * 24)) : 0
    })) || []
    
    res.json({
      tickets: ticketsWithCounts,
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSizeNum)
      }
    })
  } catch (e) {
    console.error('Error fetching tickets:', e)
    res.status(500).json({ error: 'Fout bij ophalen tickets: ' + e.message })
  }
})

// GET /api/admin/tickets/:id - Get single ticket with comments, attachments, audit log
router.get('/api/admin/tickets/:id', requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const { id } = req.params
    if (!id || id === 'undefined') {
      return res.status(404).json({ error: 'Ticket niet gevonden' })
    }

    // Get ticket (customers: id, name, email only to avoid missing-column errors)
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .select(`
        *,
        customers:customer_id(id, name, email),
        assignee:assignee_id(id, first_name, last_name, email),
        creator:created_by(id, first_name, last_name, email)
      `)
      .eq('id', id)
      .single()

    if (ticketError) {
      console.error('API ticket by id Supabase error:', ticketError.message, { id })
    }
    if (ticketError || !ticket) {
      return res.status(404).json({ error: 'Ticket niet gevonden' })
    }
    
    // Check permissions (employee can only see if assigned or has support role)
    const isAdmin = req.user?.user_metadata?.is_admin === true || req.user?.is_admin === true
    if (!isAdmin && ticket.assignee_id !== req.user?.id) {
      // Check if user has support role
      const { data: role } = await supabaseAdmin
        .from('profiles')
        .select('roles(name)')
        .eq('id', req.user.id)
        .single()
      
      if (!role?.roles?.name?.toLowerCase().includes('support')) {
        return res.status(403).json({ error: 'Geen toegang tot dit ticket' })
      }
    }
    
    // Get comments (filter internal for non-internal roles)
    const { data: allComments } = await supabaseAdmin
      .from('ticket_comments')
      .select(`
        *,
        author:author_user_id(id, first_name, last_name, email)
      `)
      .eq('ticket_id', id)
      .order('created_at', { ascending: true })
    
    // Filter internal comments based on role
    const comments = isAdmin ? allComments : (allComments?.filter(c => !c.is_internal) || [])
    
    // Get attachments
    const { data: attachments } = await supabaseAdmin
      .from('ticket_attachments')
      .select(`
        *,
        uploader:uploaded_by(id, first_name, last_name, email)
      `)
      .eq('ticket_id', id)
      .order('created_at', { ascending: false })
    
    // Get audit log (admin only)
    let auditLog = []
    if (isAdmin) {
      const { data: audit } = await supabaseAdmin
        .from('ticket_audit_log')
        .select(`
          *,
          actor:actor_user_id(id, first_name, last_name, email)
        `)
        .eq('ticket_id', id)
        .order('created_at', { ascending: false })
      
      auditLog = audit || []
    }
    
    // Get watchers
    const { data: watchers } = await supabaseAdmin
      .from('ticket_watchers')
      .select(`
        *,
        user:user_id(id, first_name, last_name, email)
      `)
      .eq('ticket_id', id)
    
    res.json({
      ticket: {
        ...ticket,
        comment_count: comments?.length || 0,
        attachment_count: attachments?.length || 0,
        days_open: ticket.created_at ? Math.floor((new Date() - new Date(ticket.created_at)) / (1000 * 60 * 60 * 24)) : 0,
        sla_risk: ticket.due_at && new Date(ticket.due_at) < new Date()
      },
      comments,
      attachments,
      audit_log: auditLog,
      watchers: watchers || []
    })
  } catch (e) {
    console.error('Error fetching ticket:', e)
    res.status(500).json({ error: 'Fout bij ophalen ticket: ' + e.message })
  }
})

// POST /api/admin/tickets - Create ticket (admin only)
router.post('/api/admin/tickets', requireAuth, isAdmin, async (req, res) => {
  try {
    const { 
      subject, 
      description, 
      customer_id, 
      user_id,
      requester_email,
      requester_name,
      priority = 'normal', 
      category = 'support',
      tags = [],
      assignee_id,
      due_at,
      is_internal_only = false
    } = req.body
    
    if (!subject) {
      return res.status(400).json({ error: 'Onderwerp is verplicht' })
    }
    
    const { data: ticket, error } = await supabaseAdmin
      .from('tickets')
      .insert({
        subject,
        description: description || null,
        customer_id: customer_id || null,
        user_id: user_id || null,
        requester_email: requester_email || null,
        requester_name: requester_name || null,
        priority,
        category,
        tags: Array.isArray(tags) ? tags : [],
        assignee_id: assignee_id || null,
        due_at: due_at || null,
        is_internal_only,
        created_by: req.user.id,
        status: 'new'
      })
      .select(`
        *,
        customers:customer_id(name, email),
        assignee:assignee_id(first_name, last_name, email)
      `)
      .single()
    
    if (error) throw error
    
    // Log audit
    await supabaseAdmin
      .from('ticket_audit_log')
      .insert({
        ticket_id: ticket.id,
        actor_user_id: req.user.id,
        action: 'ticket_created',
        field_name: 'status',
        new_value: 'new'
      })
    
    res.json({ success: true, ticket })
  } catch (e) {
    console.error('Error creating ticket:', e)
    res.status(500).json({ error: 'Fout bij aanmaken ticket: ' + e.message })
  }
})

// PATCH /api/admin/tickets/:id - Update ticket
router.patch('/api/admin/tickets/:id', requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body
    
    // Get current ticket to check permissions and track changes
    const { data: currentTicket } = await supabaseAdmin
      .from('tickets')
      .select('*')
      .eq('id', id)
      .single()
    
    if (!currentTicket) {
      return res.status(404).json({ error: 'Ticket niet gevonden' })
    }
    
    // Check permissions
    const isAdmin = req.user?.user_metadata?.is_admin === true || req.user?.is_admin === true
    if (!isAdmin && currentTicket.assignee_id !== req.user?.id) {
      return res.status(403).json({ error: 'Geen toegang tot dit ticket' })
    }
    
    // Track changes for audit log
    const auditEntries = []
    if (updates.status && updates.status !== currentTicket.status) {
      auditEntries.push({
        ticket_id: id,
        actor_user_id: req.user.id,
        action: 'status_changed',
        field_name: 'status',
        old_value: currentTicket.status,
        new_value: updates.status
      })
    }
    if (updates.priority && updates.priority !== currentTicket.priority) {
      auditEntries.push({
        ticket_id: id,
        actor_user_id: req.user.id,
        action: 'priority_changed',
        field_name: 'priority',
        old_value: currentTicket.priority,
        new_value: updates.priority
      })
    }
    if (updates.assignee_id && updates.assignee_id !== currentTicket.assignee_id) {
      auditEntries.push({
        ticket_id: id,
        actor_user_id: req.user.id,
        action: updates.assignee_id ? 'assigned' : 'unassigned',
        field_name: 'assignee_id',
        old_value: currentTicket.assignee_id,
        new_value: updates.assignee_id
      })
    }
    
    // Update ticket
    const { data: ticket, error } = await supabaseAdmin
      .from('tickets')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        customers:customer_id(name, email),
        assignee:assignee_id(first_name, last_name, email)
      `)
      .single()
    
    if (error) throw error
    
    // Insert audit entries
    if (auditEntries.length > 0) {
      await supabaseAdmin
        .from('ticket_audit_log')
        .insert(auditEntries)
    }
    
    res.json({ success: true, ticket })
  } catch (e) {
    console.error('Error updating ticket:', e)
    res.status(500).json({ error: 'Fout bij bijwerken ticket: ' + e.message })
  }
})

// POST /api/admin/tickets/:id/assign - Assign ticket
router.post('/api/admin/tickets/:id/assign', requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { assignee_id } = req.body
    
    const { data: currentTicket } = await supabaseAdmin
      .from('tickets')
      .select('assignee_id')
      .eq('id', id)
      .single()
    
    if (!currentTicket) {
      return res.status(404).json({ error: 'Ticket niet gevonden' })
    }
    
    const { data: ticket, error } = await supabaseAdmin
      .from('tickets')
      .update({ assignee_id: assignee_id || null })
      .eq('id', id)
      .select(`
        *,
        assignee:assignee_id(first_name, last_name, email)
      `)
      .single()
    
    if (error) throw error
    
    // Log audit
    await supabaseAdmin
      .from('ticket_audit_log')
      .insert({
        ticket_id: id,
        actor_user_id: req.user.id,
        action: assignee_id ? 'assigned' : 'unassigned',
        field_name: 'assignee_id',
        old_value: currentTicket.assignee_id,
        new_value: assignee_id
      })
    
    res.json({ success: true, ticket })
  } catch (e) {
    console.error('Error assigning ticket:', e)
    res.status(500).json({ error: 'Fout bij toewijzen ticket: ' + e.message })
  }
})

// POST /api/admin/tickets/:id/status - Change status
router.post('/api/admin/tickets/:id/status', requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body
    
    const validStatuses = ['new', 'open', 'waiting_on_customer', 'waiting_on_internal', 'resolved', 'closed']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Ongeldige status' })
    }
    
    const { data: currentTicket } = await supabaseAdmin
      .from('tickets')
      .select('status')
      .eq('id', id)
      .single()
    
    if (!currentTicket) {
      return res.status(404).json({ error: 'Ticket niet gevonden' })
    }
    
    const { data: ticket, error } = await supabaseAdmin
      .from('tickets')
      .update({ status })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    
    // Log audit
    await supabaseAdmin
      .from('ticket_audit_log')
      .insert({
        ticket_id: id,
        actor_user_id: req.user.id,
        action: 'status_changed',
        field_name: 'status',
        old_value: currentTicket.status,
        new_value: status
      })
    
    res.json({ success: true, ticket })
  } catch (e) {
    console.error('Error changing ticket status:', e)
    res.status(500).json({ error: 'Fout bij wijzigen status: ' + e.message })
  }
})

// POST /api/admin/tickets/:id/comment - Add comment
router.post('/api/admin/tickets/:id/comment', requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { body, is_internal = false } = req.body
    
    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'Reactie is verplicht' })
    }
    
    // Check ticket exists and permissions
    const { data: ticket } = await supabaseAdmin
      .from('tickets')
      .select('assignee_id')
      .eq('id', id)
      .single()
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket niet gevonden' })
    }
    
    const isAdmin = req.user?.user_metadata?.is_admin === true || req.user?.is_admin === true
    if (!isAdmin && ticket.assignee_id !== req.user?.id) {
      return res.status(403).json({ error: 'Geen toegang tot dit ticket' })
    }
    
    const { data: comment, error } = await supabaseAdmin
      .from('ticket_comments')
      .insert({
        ticket_id: id,
        body: body.trim(),
        is_internal,
        author_user_id: req.user.id
      })
      .select(`
        *,
        author:author_user_id(id, first_name, last_name, email)
      `)
      .single()
    
    if (error) throw error
    
    // Log audit
    await supabaseAdmin
      .from('ticket_audit_log')
      .insert({
        ticket_id: id,
        actor_user_id: req.user.id,
        action: 'comment_added',
        field_name: 'comment',
        new_value: is_internal ? '[Internal note]' : '[Comment]'
      })
    
    res.json({ success: true, comment })
  } catch (e) {
    console.error('Error adding comment:', e)
    res.status(500).json({ error: 'Fout bij toevoegen reactie: ' + e.message })
  }
})

// POST /api/admin/tickets/:id/attachment - Register attachment
router.post('/api/admin/tickets/:id/attachment', requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { storage_path, url, file_name, mime_type, size_bytes } = req.body
    
    if (!storage_path && !url) {
      return res.status(400).json({ error: 'storage_path of url is verplicht' })
    }
    if (!file_name) {
      return res.status(400).json({ error: 'file_name is verplicht' })
    }
    
    const { data: attachment, error } = await supabaseAdmin
      .from('ticket_attachments')
      .insert({
        ticket_id: id,
        storage_path: storage_path || null,
        url: url || null,
        file_name,
        mime_type: mime_type || null,
        size_bytes: size_bytes || null,
        uploaded_by: req.user.id
      })
      .select(`
        *,
        uploader:uploaded_by(id, first_name, last_name, email)
      `)
      .single()
    
    if (error) throw error
    
    res.json({ success: true, attachment })
  } catch (e) {
    console.error('Error adding attachment:', e)
    res.status(500).json({ error: 'Fout bij toevoegen bijlage: ' + e.message })
  }
})

// POST /api/admin/tickets/bulk - Bulk actions
router.post('/api/admin/tickets/bulk', requireAuth, isAdmin, async (req, res) => {
  try {
    const { ticket_ids, action, value } = req.body
    
    if (!Array.isArray(ticket_ids) || ticket_ids.length === 0) {
      return res.status(400).json({ error: 'Geen tickets geselecteerd' })
    }
    
    if (!action) {
      return res.status(400).json({ error: 'Actie is verplicht' })
    }
    
    let updates = {}
    let auditAction = ''
    
    switch (action) {
      case 'assign':
        updates.assignee_id = value || null
        auditAction = value ? 'bulk_assigned' : 'bulk_unassigned'
        break
      case 'status':
        updates.status = value
        auditAction = 'bulk_status_changed'
        break
      case 'priority':
        updates.priority = value
        auditAction = 'bulk_priority_changed'
        break
      default:
        return res.status(400).json({ error: 'Ongeldige actie' })
    }
    
    const { data: tickets, error } = await supabaseAdmin
      .from('tickets')
      .update(updates)
      .in('id', ticket_ids)
      .select()
    
    if (error) throw error
    
    // Log bulk audit
    const auditEntries = ticket_ids.map(ticket_id => ({
      ticket_id,
      actor_user_id: req.user.id,
      action: auditAction,
      field_name: Object.keys(updates)[0],
      new_value: Object.values(updates)[0]
    }))
    
    await supabaseAdmin
      .from('ticket_audit_log')
      .insert(auditEntries)
    
    res.json({ success: true, updated: tickets?.length || 0 })
  } catch (e) {
    console.error('Error bulk updating tickets:', e)
    res.status(500).json({ error: 'Fout bij bulk actie: ' + e.message })
  }
})

router.post('/api/customers', requireAuth, isAdmin, async (req, res) => {
  try {
    const { 
      name, 
      email, 
      phone, 
      domain, 
      company_name, 
      contact_person, 
      address, 
      city, 
      postal_code, 
      country, 
      branch,
      status, 
      priority,
      create_account,
      send_welcome_email
    } = req.body
    
    // Use company_name as primary, fallback to name for backwards compatibility
    const customerName = company_name || name;
    
    if (!customerName) {
      return res.status(400).json({ success: false, error: 'Bedrijfsnaam is verplicht' })
    }

    // If create_account is true, email is required
    if (create_account && !email) {
      return res.status(400).json({ success: false, error: 'E-mailadres is verplicht om een account aan te maken' })
    }

    // Check if email already exists in profiles (if creating account)
    if (create_account && email) {
      const { data: existingProfile, error: checkError } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .eq('email', email)
        .maybeSingle();

      if (existingProfile) {
        return res.status(400).json({ 
          success: false,
          error: "Dit e-mailadres is al in gebruik voor een account" 
        });
      }
    }
    
    // Prepare customer data
    const customerData = {
      name: customerName,
        email: email || null,
        phone: phone || null,
        domain: domain || null,
      company_name: customerName,
        contact_person: contact_person || null,
        address: address || null,
        city: city || null,
        postal_code: postal_code || null,
        country: country || 'NL',
        status: status || 'active',
        priority: priority || 'normal',
        created_by: req.user.id
    };

    // Add customer_branch_id if provided
    // NOTE: This is for customer branch classification (separate from lead industries system)
    // Uses customer_branches table (internal CRM only), not industries table (for leads)
    if (branch) {
      // branch can be a single ID or comma-separated IDs from multiselect
      // For now, use the first one (single selection)
      const branchId = branch.split(',')[0]?.trim();
      if (branchId) {
        customerData.customer_branch_id = parseInt(branchId) || null;
      }
    }

    const { data: customer, error } = await supabaseAdmin
      .from('customers')
      .insert(customerData)
      .select()
      .single()
    
    if (error) throw error
    
    // Add email to customer_emails if provided
    if (email) {
      const { error: emailError } = await supabaseAdmin
        .from('customer_emails')
        .insert({
          customer_id: customer.id,
          email: email,
          is_primary: true
        });
      
      if (emailError) {
        console.log('Could not add primary email:', emailError);
        // Don't fail the whole request if email insert fails
      }
    }

    // Create user account if requested
    let userAccount = null;
    let emailSent = false;
    let emailError = null;

    if (create_account && email) {
      try {
        // Generate a temporary password for Supabase Auth
        const tempPassword = generateTemporaryPassword();

        // Create user in Supabase Auth
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: tempPassword,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            first_name: customerName.split(' ')[0] || '',
            last_name: customerName.split(' ').slice(1).join(' ') || '',
            phone: phone || '',
            company_name: customerName || '',
            is_admin: false
          }
        });

        if (authError) {
          console.error("Error creating auth user:", authError);
          emailError = "Fout bij aanmaken van gebruikersaccount: " + authError.message;
        } else {
          // Wait a moment for the trigger to create the profile
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Update the profile record that was created by the trigger
          const profileUpdate = {
            first_name: customerName.split(' ')[0] || '',
            last_name: customerName.split(' ').slice(1).join(' ') || '',
            email,
            phone: phone || '',
            company_name: customerName || '',
            is_admin: false,
            status: 'active',
            updated_at: new Date().toISOString()
          };

          // Find and assign default customer role
          const { data: customerRole, error: roleError } = await supabaseAdmin
            .from('roles')
            .select('id, name')
            .eq('name', 'customer')
            .maybeSingle();
          
          if (customerRole) {
            profileUpdate.role_id = customerRole.id;
          }

          const { data: newProfile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .update(profileUpdate)
            .eq('id', authUser.user.id)
            .select()
            .single();

          if (profileError) {
            console.error("Error updating profile:", profileError);
            await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
            emailError = "Fout bij bijwerken van profiel: " + profileError.message;
          } else {
            userAccount = newProfile;

            // Send welcome email if requested
            if (send_welcome_email) {
              try {
                console.log(`📧 Attempting to send welcome email to: ${email}`);
                
                const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
                  type: 'recovery',
                  email: email,
                  options: {
                    redirectTo: `${process.env.SITE_URL || process.env.APP_URL || process.env.BASE_URL || 'http://localhost:3000'}/auth/reset-password`
                  }
                });
                
                if (resetError) {
                  console.error("❌ Error generating password reset link:", resetError);
                  emailError = `Kon geen wachtwoord reset link genereren: ${resetError.message}`;
                } else if (!resetData || !resetData.properties?.action_link) {
                  console.error("❌ No reset link generated");
                  emailError = "Kon geen wachtwoord reset link genereren";
                } else {
                  console.log("✅ Password reset link generated for:", email);
                  
                  // Send beautiful welcome email with password setup instructions
                  const EmailService = require('../services/emailService');
                  const emailService = new EmailService();
                  
                  emailSent = await emailService.sendWelcomeEmail({
                    email,
                    first_name: customerName.split(' ')[0] || '',
                    last_name: customerName.split(' ').slice(1).join(' ') || ''
                  }, resetData.properties?.action_link);
                  
                  if (emailSent) {
                    console.log("✅ Welcome email sent successfully to:", email);
                  } else {
                    console.error("❌ Failed to send welcome email to:", email);
                    emailError = "Email service kon de email niet versturen. Check server logs voor details.";
                  }
                }
              } catch (emailErr) {
                console.error("❌ Exception while sending password reset email:", emailErr);
                emailError = `Fout bij versturen email: ${emailErr.message}`;
              }
            }
          }
        }
      } catch (accountError) {
        console.error("Error creating customer account:", accountError);
        emailError = accountError.message || "Fout bij aanmaken account";
      }
    }
    
    res.json({ 
      success: true, 
      customer,
      user: userAccount,
      email_sent: emailSent,
      email_error: emailError || null
    })
  } catch (e) {
    console.error("Error creating customer:", e);
    res.status(500).json({ success: false, error: 'Fout bij aanmaken klant: ' + e.message })
  }
})

// Logo upload endpoint - using memory storage for Supabase Storage upload
const uploadLogo = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Ongeldig bestandstype. Alleen afbeeldingen toegestaan (JPEG, PNG, GIF, WEBP).'))
    }
  }
})

router.post('/api/customers/:id/logo', requireAuth, isAdmin, (req, res, next) => {
  uploadLogo.single('logo')(req, res, (err) => {
    if (err) {
      // Handle multer errors
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'Bestand is te groot (max 5MB)' })
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ success: false, error: 'Onverwacht bestand. Gebruik het veld "logo".' })
      }
      // Handle file filter errors and other multer errors
      return res.status(400).json({ success: false, error: err.message || 'Upload fout: ' + (err.code || 'Onbekende fout') })
    }
    next()
  })
}, async (req, res) => {
  try {
    const { id } = req.params
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Geen bestand geüpload' })
    }
    
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(req.file.originalname) || '.png'
    const fileName = `customer-logos/customer-logo-${id}-${uniqueSuffix}${ext}`
    
    // Ensure storage bucket exists before uploading
    const bucketName = 'uploads'
    const bucketExists = await ensureStorageBucket(bucketName, true)
    
    if (!bucketExists) {
      console.error('Failed to ensure storage bucket exists')
      return res.status(500).json({ 
        success: false, 
        error: 'Kon storage bucket niet aanmaken. Neem contact op met de beheerder.' 
      })
    }
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from(bucketName)
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      })
    
    if (uploadError) {
      console.error('Supabase Storage upload error:', uploadError)
      return res.status(500).json({ 
        success: false, 
        error: 'Fout bij uploaden naar storage: ' + uploadError.message 
      })
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin
      .storage
      .from(bucketName)
      .getPublicUrl(fileName)
    
    // Update customer with logo URL
    const { data: customer, error: updateError } = await supabaseAdmin
      .from('customers')
      .update({
        logo_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (updateError) {
      // Try to delete uploaded file from storage if database update fails
      try {
        await supabaseAdmin.storage.from(bucketName).remove([fileName])
      } catch (deleteError) {
        console.error('Error deleting uploaded file from storage:', deleteError)
      }
      return res.status(500).json({ success: false, error: 'Fout bij bijwerken klant: ' + updateError.message })
    }
    
    res.json({ success: true, logo_url: publicUrl, customer })
  } catch (error) {
    console.error('Logo upload error:', error)
    console.error('Error stack:', error.stack)
    res.status(500).json({ success: false, error: error.message || 'Fout bij uploaden logo' })
  }
})

// Employee profile picture upload storage
const employeeProfileStorage = _isVercel ? multer.memoryStorage() : multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'profiles')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const { id } = req.params
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    cb(null, `employee-profile-${id}-${uniqueSuffix}${ext}`)
  }
})

const uploadEmployeeProfile = multer({ 
  storage: employeeProfileStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Ongeldig bestandstype. Alleen JPG en PNG toegestaan.'))
    }
  }
})

router.post('/api/employees/:id/profile-picture', requireAuth, isAdmin, uploadEmployeeProfile.single('profilePicture'), async (req, res) => {
  try {
    const { id } = req.params
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Geen bestand geüpload' })
    }
    let imageUrl
    if (_isVercel && req.file.buffer) {
      const bucketOk = await ensureStorageBucket('uploads', true)
      if (!bucketOk) return res.status(500).json({ success: false, error: 'Storage niet beschikbaar' })
      const ext = path.extname(req.file.originalname) || '.png'
      const fileName = `profiles/employee-profile-${id}-${Date.now()}${ext}`
      const { error: uploadErr } = await supabaseAdmin.storage.from('uploads').upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: true })
      if (uploadErr) return res.status(500).json({ success: false, error: 'Fout bij uploaden: ' + uploadErr.message })
      const { data: { publicUrl } } = supabaseAdmin.storage.from('uploads').getPublicUrl(fileName)
      imageUrl = publicUrl
    } else {
      imageUrl = '/uploads/profiles/' + req.file.filename
    }
    const { data: employee, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        profile_picture: imageUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (updateError) {
      if (!_isVercel && req.file?.path) fs.unlinkSync(req.file.path)
      return res.status(500).json({ success: false, error: 'Fout bij bijwerken werknemer: ' + updateError.message })
    }
    res.json({ success: true, profile_picture: imageUrl, employee })
  } catch (error) {
    console.error('Profile picture upload error:', error)
    if (!_isVercel && req.file?.path) fs.unlinkSync(req.file.path)
    res.status(500).json({ success: false, error: error.message || 'Fout bij uploaden profielfoto' })
  }
})

// Contract document upload storage for customers
const customerContractStorage = _isVercel ? multer.memoryStorage() : multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'customer-contracts')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const { id } = req.params
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    cb(null, `customer-contract-${id}-${uniqueSuffix}${ext}`)
  }
})

const uploadCustomerContract = multer({ 
  storage: customerContractStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(pdf|doc|docx)$/i)) {
      cb(null, true)
    } else {
      cb(new Error('Ongeldig bestandstype. Alleen PDF, DOC of DOCX toegestaan.'))
    }
  }
})

// POST /admin/api/customers/:id/contract
router.post('/api/customers/:id/contract', requireAuth, isAdmin, uploadCustomerContract.single('contract'), async (req, res) => {
  try {
    const { id } = req.params
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Geen bestand geüpload' })
    }
    let documentUrl
    let originalFileName = req.file.originalname
    if (typeof originalFileName === 'string') {
      try {
        if (originalFileName.includes('Ã') || originalFileName.includes('Ì')) {
          originalFileName = Buffer.from(originalFileName, 'latin1').toString('utf8')
        }
      } catch (e) {
        console.warn('Could not normalize filename encoding:', e.message)
      }
    }
    if (_isVercel && req.file.buffer) {
      const bucketOk = await ensureStorageBucket('uploads', true)
      if (!bucketOk) return res.status(500).json({ success: false, error: 'Storage niet beschikbaar' })
      const ext = path.extname(req.file.originalname) || '.pdf'
      const fileName = `customer-contracts/customer-contract-${id}-${Date.now()}${ext}`
      const { error: uploadErr } = await supabaseAdmin.storage.from('uploads').upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: true })
      if (uploadErr) return res.status(500).json({ success: false, error: 'Fout bij uploaden: ' + uploadErr.message })
      const { data: { publicUrl } } = supabaseAdmin.storage.from('uploads').getPublicUrl(fileName)
      documentUrl = publicUrl
    } else {
      documentUrl = '/uploads/customer-contracts/' + req.file.filename
    }
    const { data: customer, error: updateError } = await supabaseAdmin
      .from('customers')
      .update({
        contract_document_url: documentUrl,
        contract_document_name: originalFileName,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (updateError) {
      if (!_isVercel && req.file?.path) fs.unlinkSync(req.file.path)
      return res.status(500).json({ success: false, error: 'Fout bij bijwerken klant: ' + updateError.message })
    }
    res.json({ success: true, url: documentUrl, filename: originalFileName, customer })
  } catch (error) {
    console.error('Contract upload error:', error)
    if (!_isVercel && req.file?.path) fs.unlinkSync(req.file.path)
    res.status(500).json({ success: false, error: error.message || 'Fout bij uploaden contract' })
  }
})

// DELETE /admin/api/customers/:id/contract
router.delete('/api/customers/:id/contract', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('contract_document_url')
      .eq('id', id)
      .single()
    
    if (customer?.contract_document_url) {
      const url = customer.contract_document_url
      if (url.startsWith('http') && url.includes('supabase') && url.includes('/storage/')) {
        const match = url.match(/\/object\/public\/uploads\/(.+)$/)
        if (match) {
          await supabaseAdmin.storage.from('uploads').remove([match[1]])
        }
      } else {
        const filePath = path.join(__dirname, '..', 'public', url)
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      }
    }
    
    // Update customer to remove contract
    const { error: updateError } = await supabaseAdmin
      .from('customers')
      .update({
        contract_document_url: null,
        contract_document_name: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
    
    if (updateError) {
      return res.status(500).json({ success: false, error: 'Fout bij verwijderen contract: ' + updateError.message })
    }
    
    res.json({ success: true })
  } catch (error) {
    console.error('Contract delete error:', error)
    res.status(500).json({ success: false, error: error.message || 'Fout bij verwijderen contract' })
  }
})

router.put('/api/customers/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body
    
    const { data: customer, error } = await supabaseAdmin
      .from('customers')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    
    res.json({ success: true, customer })
  } catch (e) {
    res.status(500).json({ error: 'Fout bij bijwerken klant: ' + e.message })
  }
})

// POST /admin/api/customers/:id/move - Move customer to specific position
router.post('/api/customers/:id/move', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { targetIndex, direction } = req.body // targetIndex (0-based) or direction ('up'/'down' for backward compatibility)
    
    // Get current customer
    const { data: currentCustomer, error: currentError } = await supabaseAdmin
      .from('customers')
      .select('id, sort_order')
      .eq('id', id)
      .single()
    
    if (currentError || !currentCustomer) {
      return res.status(404).json({ success: false, error: 'Klant niet gevonden' })
    }
    
    // If targetIndex is provided, use it directly (faster)
    if (typeof targetIndex === 'number') {
      // Get all customers sorted by current sort_order
      const { data: allCustomers, error: allError } = await supabaseAdmin
        .from('customers')
        .select('id, sort_order')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
      
      if (allError) throw allError
      
      // Remove current customer from list
      const customersWithoutCurrent = (allCustomers || []).filter(c => c.id !== id)
      
      // Clamp targetIndex to valid range
      const validTargetIndex = Math.max(0, Math.min(targetIndex, customersWithoutCurrent.length))
      
      // Calculate new sort_order based on target position
      let newSortOrder
      if (validTargetIndex === 0) {
        // Moving to first position
        const firstCustomer = customersWithoutCurrent[0]
        newSortOrder = (firstCustomer?.sort_order || 0) - 10
      } else if (validTargetIndex >= customersWithoutCurrent.length) {
        // Moving to last position
        const lastCustomer = customersWithoutCurrent[customersWithoutCurrent.length - 1]
        newSortOrder = (lastCustomer?.sort_order || 0) + 10
      } else {
        // Moving to middle position - use average of surrounding items
        const prevCustomer = customersWithoutCurrent[validTargetIndex - 1]
        const nextCustomer = customersWithoutCurrent[validTargetIndex]
        const prevOrder = prevCustomer?.sort_order || 0
        const nextOrder = nextCustomer?.sort_order || 0
        
        // Calculate midpoint
        newSortOrder = Math.floor((prevOrder + nextOrder) / 2)
        
        // If they're too close (less than 2 apart), renumber all customers
        if (Math.abs(nextOrder - prevOrder) < 2) {
          // Renumber all customers to have proper spacing
          const allCustomersInOrder = [...customersWithoutCurrent]
          allCustomersInOrder.splice(validTargetIndex, 0, { id, sort_order: 0 }) // Insert at target position
          
          // Assign new sort_order values with proper spacing (multiples of 10)
          const updates = allCustomersInOrder.map((customer, idx) => ({
            id: customer.id,
            sort_order: idx * 10
          }))
          
          // Update all customers in a transaction-like manner
          for (const update of updates) {
            const { error: updateErr } = await supabaseAdmin
              .from('customers')
              .update({ sort_order: update.sort_order })
              .eq('id', update.id)
            
            if (updateErr) throw updateErr
          }
          
          return res.json({ success: true, message: 'Volgorde bijgewerkt' })
        }
      }
      
      // Update customer sort_order
      const { error: updateError } = await supabaseAdmin
        .from('customers')
        .update({ sort_order: newSortOrder })
        .eq('id', id)
      
      if (updateError) throw updateError
      
      return res.json({ success: true, message: 'Volgorde bijgewerkt' })
    }
    
    // Backward compatibility: direction-based move (slower, step-by-step)
    if (!direction || !['up', 'down'].includes(direction)) {
      return res.status(400).json({ success: false, error: 'Direction moet "up" of "down" zijn, of targetIndex moet worden opgegeven' })
    }
    
    const currentSortOrder = currentCustomer.sort_order || 0
    
    // Find the customer to swap with
    let swapCustomer
    if (direction === 'up') {
      const { data: customers } = await supabaseAdmin
        .from('customers')
        .select('id, sort_order')
        .lt('sort_order', currentSortOrder)
        .order('sort_order', { ascending: false })
        .limit(1)
      
      swapCustomer = customers?.[0]
    } else {
      const { data: customers } = await supabaseAdmin
        .from('customers')
        .select('id, sort_order')
        .gt('sort_order', currentSortOrder)
        .order('sort_order', { ascending: true })
        .limit(1)
      
      swapCustomer = customers?.[0]
    }
    
    if (!swapCustomer) {
      return res.json({ success: true, message: 'Kan niet verder verplaatsen' })
    }
    
    // Swap sort orders
    const swapSortOrder = swapCustomer.sort_order || 0
    
    const { error: update1Error } = await supabaseAdmin
      .from('customers')
      .update({ sort_order: swapSortOrder })
      .eq('id', id)
    
    if (update1Error) throw update1Error
    
    const { error: update2Error } = await supabaseAdmin
      .from('customers')
      .update({ sort_order: currentSortOrder })
      .eq('id', swapCustomer.id)
    
    if (update2Error) throw update2Error
    
    res.json({ success: true, message: 'Volgorde bijgewerkt' })
  } catch (e) {
    console.error('Error moving customer:', e)
    res.status(500).json({ success: false, error: 'Fout bij verplaatsen klant: ' + e.message })
  }
})

// ===== CUSTOMER RESPONSIBLE EMPLOYEES API =====
router.post('/api/customers/:id/employees', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { employee_id, role } = req.body;

    if (!employee_id) {
      return res.status(400).json({ success: false, error: 'Werknemer ID is verplicht' });
    }

    // Check if assignment already exists
    const { data: existing } = await supabaseAdmin
      .from('customer_responsible_employees')
      .select('id')
      .eq('customer_id', id)
      .eq('employee_id', employee_id)
      .single();

    if (existing) {
      return res.status(400).json({ success: false, error: 'Deze werknemer is al toegewezen aan deze klant' });
    }

    // Create assignment
    const { data: assignment, error } = await supabaseAdmin
      .from('customer_responsible_employees')
      .insert({
        customer_id: id,
        employee_id,
        role: role || 'responsible',
        assigned_by: req.user.id
      })
      .select(`
        *,
        employee:profiles!customer_responsible_employees_employee_id_fkey(id, first_name, last_name, email, employee_status),
        assigned_by_user:profiles!customer_responsible_employees_assigned_by_fkey(id, first_name, last_name, email)
      `)
      .single();

    if (error) throw error;

    res.json({ success: true, assignment });
  } catch (e) {
    console.error('Error assigning employee to customer:', e);
    res.status(500).json({ success: false, error: e.message || 'Fout bij toewijzen werknemer' });
  }
});

router.delete('/api/customers/:id/employees/:employeeId', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id, employeeId } = req.params;

    const { error } = await supabaseAdmin
      .from('customer_responsible_employees')
      .delete()
      .eq('customer_id', id)
      .eq('employee_id', employeeId);

    if (error) throw error;

    res.json({ success: true });
  } catch (e) {
    console.error('Error removing employee from customer:', e);
    res.status(500).json({ success: false, error: e.message || 'Fout bij verwijderen werknemer' });
  }
});

router.put('/api/customers/:id/employees/:employeeId', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id, employeeId } = req.params;
    const { role } = req.body;

    const updates = {};
    if (role) updates.role = role;

    const { data: assignment, error } = await supabaseAdmin
      .from('customer_responsible_employees')
      .update(updates)
      .eq('customer_id', id)
      .eq('employee_id', employeeId)
      .select(`
        *,
        employee:profiles!customer_responsible_employees_employee_id_fkey(id, first_name, last_name, email, employee_status),
        assigned_by_user:profiles!customer_responsible_employees_assigned_by_fkey(id, first_name, last_name, email)
      `)
      .single();

    if (error) throw error;

    res.json({ success: true, assignment });
  } catch (e) {
    console.error('Error updating employee assignment:', e);
    res.status(500).json({ success: false, error: e.message || 'Fout bij bijwerken werknemer toewijzing' });
  }
});

// PUT /admin/api/employees/:id - Update employee profile
router.put('/api/employees/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Build update object
    const updateData = {};
    if (updates.first_name !== undefined) updateData.first_name = updates.first_name;
    if (updates.last_name !== undefined) updateData.last_name = updates.last_name;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.employee_status !== undefined) updateData.employee_status = updates.employee_status;
    if (updates.created_at !== undefined) {
      // Only allow updating created_at if user is admin or manager
      updateData.created_at = updates.created_at;
    }
    
    updateData.updated_at = new Date().toISOString();
    
    const { data: employee, error } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, employee });
  } catch (e) {
    console.error('Error updating employee:', e);
    res.status(500).json({ success: false, error: e.message || 'Fout bij bijwerken werknemer' });
  }
});

// ==== GET: Get customer invoices ====
router.get('/api/customers/:id/invoices', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: invoices, error } = await supabaseAdmin
      .from('customer_invoices')
      .select('*')
      .eq('customer_id', id)
      .order('invoice_date', { ascending: false });
    
    if (error) throw error;
    
    // Normalize data: if status is "paid", outstanding_amount should be 0
    const normalizedInvoices = (invoices || []).map(inv => {
      if (inv.status === 'paid' && inv.outstanding_amount > 0) {
        // Auto-correct: if paid but outstanding > 0, update in database
        supabaseAdmin
          .from('customer_invoices')
          .update({ outstanding_amount: 0, updated_at: new Date().toISOString() })
          .eq('id', inv.id)
          .then(() => {
            console.log(`Auto-corrected outstanding_amount for invoice ${inv.id}`);
          })
          .catch(err => {
            console.error(`Error auto-correcting invoice ${inv.id}:`, err);
          });
        
        return { ...inv, outstanding_amount: 0 };
      }
      return inv;
    });
    
    res.json({ success: true, invoices: normalizedInvoices });
  } catch (e) {
    console.error('Error fetching customer invoices:', e);
    res.status(500).json({ error: 'Fout bij ophalen facturen: ' + e.message });
  }
});

// ==== POST: Create new invoice ====
router.post('/api/customers/:id/invoices', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      invoice_number,
      invoice_date,
      due_date,
      order_number,
      amount,
      outstanding_amount,
      status,
      notes,
      line_items
    } = req.body;
    
    // Validation
    if (!invoice_number || !invoice_date || amount === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Factuurnummer, factuurdatum en bedrag zijn verplicht'
      });
    }
    
    if (isNaN(amount) || amount < 0) {
      return res.status(400).json({
        success: false,
        error: 'Bedrag moet een geldig positief getal zijn'
      });
    }
    
    // Check if invoice number already exists for this customer
    const { data: existing } = await supabaseAdmin
      .from('customer_invoices')
      .select('id')
      .eq('customer_id', id)
      .eq('invoice_number', invoice_number.trim())
      .maybeSingle();
    
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Dit factuurnummer bestaat al voor deze klant'
      });
    }
    
    // Use outstanding_amount if provided, otherwise default to amount
    const finalOutstandingAmount = outstanding_amount !== undefined && outstanding_amount !== null
      ? parseFloat(outstanding_amount)
      : parseFloat(amount);
    
    // Validate and format line_items
    let formattedLineItems = [];
    if (line_items && Array.isArray(line_items) && line_items.length > 0) {
      formattedLineItems = line_items.map(item => ({
        description: item.description?.trim() || '',
        quantity: parseFloat(item.quantity) || 1,
        unit_price: parseFloat(item.unit_price) || 0,
        total: (parseFloat(item.quantity) || 1) * (parseFloat(item.unit_price) || 0)
      }));
    }
    
    // Create invoice
    const { data: invoice, error } = await supabaseAdmin
      .from('customer_invoices')
      .insert([{
        customer_id: id,
        invoice_number: invoice_number.trim(),
        invoice_date: invoice_date,
        due_date: due_date || null,
        order_number: order_number?.trim() || null,
        amount: parseFloat(amount),
        outstanding_amount: finalOutstandingAmount,
        status: status || 'pending',
        notes: notes?.trim() || null,
        line_items: formattedLineItems.length > 0 ? formattedLineItems : null,
        created_by: req.user.id
      }])
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(400).json({
          success: false,
          error: 'Dit factuurnummer bestaat al voor deze klant'
        });
      }
      throw error;
    }
    
    res.json({
      success: true,
      invoice: invoice,
      message: 'Factuur succesvol toegevoegd'
    });
  } catch (e) {
    console.error('Error creating invoice:', e);
    res.status(500).json({
      success: false,
      error: 'Fout bij aanmaken factuur: ' + e.message
    });
  }
});

// ==== PATCH: Update invoice ====
router.patch('/api/customers/:customerId/invoices/:invoiceId', requireAuth, isAdmin, async (req, res) => {
  try {
    const { customerId, invoiceId } = req.params;
    const updates = req.body;
    
    // Verify invoice exists and belongs to customer
    const { data: existingInvoice, error: fetchError } = await supabaseAdmin
      .from('customer_invoices')
      .select('id, customer_id')
      .eq('id', invoiceId)
      .eq('customer_id', customerId)
      .single();
    
    if (fetchError || !existingInvoice) {
      return res.status(404).json({
        success: false,
        error: 'Factuur niet gevonden'
      });
    }
    
    // Build update object (only allow specific fields)
    const allowedFields = ['invoice_date', 'due_date', 'order_number', 'status', 'notes', 'outstanding_amount'];
    const updateData = {};
    
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    });
    
    // If status is "paid", automatically set outstanding_amount to 0
    if (updateData.status === 'paid') {
      updateData.outstanding_amount = 0;
    }
    
    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString();
    
    // Update invoice
    const { data: updatedInvoice, error: updateError } = await supabaseAdmin
      .from('customer_invoices')
      .update(updateData)
      .eq('id', invoiceId)
      .eq('customer_id', customerId)
      .select()
      .single();
    
    if (updateError) {
      throw updateError;
    }
    
    res.json({
      success: true,
      invoice: updatedInvoice,
      message: 'Factuur succesvol bijgewerkt'
    });
  } catch (e) {
    console.error('Error updating invoice:', e);
    res.status(500).json({
      success: false,
      error: 'Fout bij bijwerken factuur: ' + e.message
    });
  }
});

// ==== POST: Import invoices from CSV ====
router.post('/api/customers/:id/invoices/import', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { invoices, format } = req.body; // Array of invoice objects from CSV, format: 'eboekhouden' | 'zoho'
    
    if (!Array.isArray(invoices) || invoices.length === 0) {
      return res.status(400).json({ success: false, error: 'Geen facturen opgegeven' });
    }
    
    // Get customer data to match invoices
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('name, company_name')
      .eq('id', id)
      .single();
    
    if (customerError || !customer) {
      return res.status(404).json({ success: false, error: 'Klant niet gevonden' });
    }
    
    // Prepare customer name variations for matching
    const customerNames = [
      customer.name,
      customer.company_name,
      customer.name?.toLowerCase(),
      customer.company_name?.toLowerCase(),
      customer.name?.trim(),
      customer.company_name?.trim()
    ].filter(Boolean);
    
    // Helper functions
    const parseDate = (dateStr) => {
      if (!dateStr) return null;
      // Handle both DD-MM-YYYY and YYYY-MM-DD formats
      if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          // If first part is 4 digits, it's YYYY-MM-DD
          if (parts[0].length === 4) {
            return dateStr;
          }
          // Otherwise DD-MM-YYYY
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2];
          return `${year}-${month}-${day}`;
        }
      }
      return null;
    };
    
    const parseAmount = (amountStr) => {
      if (!amountStr) return 0;
      if (typeof amountStr === 'number') return amountStr;
      // Handle formats: "1.190,00", "605,00", "-750,00", "€ 726,00"
      const isNegative = amountStr.toString().startsWith('-');
      const cleaned = amountStr.toString().replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.');
      const amount = parseFloat(cleaned) || 0;
      return isNegative ? -amount : amount;
    };
    
    // Map invoices based on format
    let mappedInvoices = [];
    
    if (format === 'eboekhouden') {
      // e-boekhouden format: Datum, Nummer, Relatie, Bedrag (Excl), Bedrag (Incl)
      // Filter invoices that match this customer
      const customerInvoices = invoices.filter(inv => {
        const relationName = (inv.Relatie || inv.customer_name || '').trim();
        if (!relationName) return false;
        
        // Match against customer name variations
        return customerNames.some(customerName => {
          if (!customerName) return false;
          const normalizedCustomer = customerName.toLowerCase().trim();
          const normalizedRelation = relationName.toLowerCase().trim();
          
          // Exact match
          if (normalizedCustomer === normalizedRelation) return true;
          
          // Partial match (customer name contains relation or vice versa)
          if (normalizedCustomer.includes(normalizedRelation) || normalizedRelation.includes(normalizedCustomer)) {
            return true;
          }
          
          // Match without common suffixes (B.V., BV, etc.)
          const cleanCustomer = normalizedCustomer.replace(/\s*(bv|b\.v\.|b\.v|nv|n\.v\.|n\.v|vof|v\.o\.f\.|v\.o\.f|beheer|interieurs)\s*$/i, '').trim();
          const cleanRelation = normalizedRelation.replace(/\s*(bv|b\.v\.|b\.v|nv|n\.v\.|n\.v|vof|v\.o\.f\.|v\.o\.f|beheer|interieurs)\s*$/i, '').trim();
          if (cleanCustomer === cleanRelation) return true;
          
          // Extract main surname/company name (remove common first names and words)
          const extractMainName = (name) => {
            // Remove common first names at the start
            const withoutFirstName = name.replace(/^(koos|jan|piet|henk|klaas|willem|peter|johan|mark|thomas|michael|david|john|paul|steven|robert|richard|james|william|charles|daniel|matthew|joseph|christopher|andrew|joshua|kenneth|kevin|brian|george|edward|ronald|anthony|timothy|jason|jeffrey|ryan|jacob|gary|nicholas|eric|stephen|jonathan|larry|justin|scott|brandon|benjamin|samuel|frank|gregory|raymond|alexander|patrick|jack|dennis|jerry|tyler|aaron|jose|henry|adam|douglas|nathan|zachary|kyle|noah|e than|jeremy|walter|christian|keith|roger|terry|gerald|harold|sean|austin|carl|arthur|lawrence|dylan|jesse|jordan|bryan|billy|bruce|albert|willie|gabriel|alan|juan|wayne|roy|ralph|eugene|logan|randy|louis|phillip|bobby|harry|johnny|russell|wayne)\s+/i, '');
            // Split into words and get the longest meaningful word (usually the surname/company name)
            const words = withoutFirstName.split(/\s+/).filter(w => w.length > 2);
            return words.length > 0 ? words[0] : withoutFirstName;
          };
          
          const customerMain = extractMainName(cleanCustomer);
          const relationMain = extractMainName(cleanRelation);
          
          // Match if main names are the same (e.g., "Kluytmans" matches "Kluytmans")
          if (customerMain && relationMain && customerMain === relationMain) {
            return true;
          }
          
          // Match if one contains the other's main name
          if (customerMain && normalizedRelation.includes(customerMain)) return true;
          if (relationMain && normalizedCustomer.includes(relationMain)) return true;
          
          return false;
        });
      });
      
      if (customerInvoices.length === 0) {
        // Get unique relation names from CSV for helpful error message
        const uniqueRelations = [...new Set(invoices.map(inv => (inv.Relatie || inv.customer_name || '').trim()).filter(Boolean))];
        const relationsList = uniqueRelations.length > 0 
          ? `\n\nGevonden relaties in bestand: ${uniqueRelations.slice(0, 10).join(', ')}${uniqueRelations.length > 10 ? '...' : ''}`
          : '';
        
        return res.status(400).json({ 
          success: false, 
          error: `Geen facturen gevonden voor klant "${customer.name || customer.company_name}". Controleer of de klantnaam in het CSV bestand overeenkomt met "${customer.name || customer.company_name}".${relationsList}` 
        });
      }
      
      mappedInvoices = customerInvoices.map(inv => {
        // Use pre-parsed values if available, otherwise parse
        const invoiceDate = inv.invoice_date || parseDate(inv.Datum || inv['Datum']);
        const invoiceNumber = inv.invoice_number || inv.Nummer || inv['Nummer'] || '';
        const amount = inv.amount !== undefined ? inv.amount : parseAmount(inv['Bedrag (Incl)'] || inv['Bedrag (Incl)']);
        const amountExcl = inv.amount_excl !== undefined ? inv.amount_excl : parseAmount(inv['Bedrag (Excl)'] || inv['Bedrag (Excl)']);
        
        // Calculate outstanding amount (if negative amount, it's a credit note)
        let outstandingAmount = amount;
        let status = 'pending';
        
        if (amount < 0) {
          // Credit note
          outstandingAmount = 0;
          status = 'paid';
        } else {
          // Regular invoice - assume outstanding equals amount (can be updated later)
          outstandingAmount = amount;
          // If amount is 0 or very small, might be paid
          if (Math.abs(amount) < 0.01) {
            status = 'paid';
            outstandingAmount = 0;
          }
        }
        
        // Normalize invoice number (trim and ensure consistent format)
        const normalizedInvoiceNumber = invoiceNumber.trim();
        
        return {
          customer_id: id,
          invoice_number: normalizedInvoiceNumber,
          invoice_date: invoiceDate,
          due_date: null, // e-boekhouden doesn't provide due date in this export
          order_number: null,
          amount: Math.abs(amount), // Store as positive
          outstanding_amount: Math.abs(outstandingAmount),
          status: status,
          external_id: normalizedInvoiceNumber,
          external_system: 'eboekhouden',
          notes: inv.customer_name ? `Geïmporteerd uit e-boekhouden - Relatie: ${inv.customer_name}` : 'Geïmporteerd uit e-boekhouden',
          created_by: req.user.id
        };
      }).filter(inv => inv.invoice_number && inv.invoice_date); // Filter out invalid entries
    } else {
      // Zoho Books format (original)
      const statusMap = {
        'Betaald': 'paid',
        'Achterstallig': 'overdue',
        'Concept': 'draft',
        'Ongeldig': 'invalid'
      };
      
      mappedInvoices = invoices.map(inv => {
        return {
          customer_id: id,
          invoice_number: inv['Factuurnr.'] || inv.invoice_number || '',
          invoice_date: parseDate(inv.Datum || inv.invoice_date),
          due_date: parseDate(inv.Vervaldatum || inv.due_date),
          order_number: inv.Ordernummer || inv.order_number || null,
          amount: parseAmount(inv.Bedrag || inv.amount),
          outstanding_amount: parseAmount(inv['Verschuldigd saldo'] || inv.outstanding_amount || inv['Verschuldigd saldo']),
          status: statusMap[inv.Status] || inv.status || 'pending',
          external_id: inv.INVOICE_ID || inv.external_id || null,
          external_system: 'zoho_books',
          created_by: req.user.id
        };
      });
    }
    
    // Filter out invalid invoices
    mappedInvoices = mappedInvoices.filter(inv => {
      return inv.invoice_number && inv.invoice_number.trim() && inv.invoice_date;
    });
    
    if (mappedInvoices.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Geen geldige facturen gevonden in bestand' 
      });
    }
    
    // Remove duplicates within the import batch (keep the last occurrence of each invoice_number)
    // This prevents "ON CONFLICT DO UPDATE command cannot affect row a second time" error
    const uniqueInvoices = [];
    const seenInvoices = new Map();
    
    // Normalize invoice numbers first
    mappedInvoices.forEach(inv => {
      if (inv.invoice_number) {
        inv.invoice_number = String(inv.invoice_number).trim();
      }
    });
    
    // Process in reverse to keep the last occurrence (most recent)
    for (let i = mappedInvoices.length - 1; i >= 0; i--) {
      const inv = mappedInvoices[i];
      // Create a unique key: customer_id + normalized invoice_number
      const key = `${inv.customer_id}_${String(inv.invoice_number || '').trim().toLowerCase()}`;
      if (!seenInvoices.has(key)) {
        seenInvoices.set(key, true);
        uniqueInvoices.unshift(inv); // Add to beginning to maintain order
      } else {
        console.log(`Skipping duplicate invoice in batch: ${inv.invoice_number} for customer ${inv.customer_id}`);
      }
    }
    
    console.log(`Importing ${uniqueInvoices.length} unique invoices (${mappedInvoices.length - uniqueInvoices.length} duplicates removed)`);
    
    // Insert invoices one by one to avoid the "cannot affect row a second time" error
    // Check if invoice exists first, then INSERT or UPDATE accordingly
    const insertedInvoices = [];
    const errors = [];
    const conflictErrors = [];
    
    for (const inv of uniqueInvoices) {
      try {
        // First, check if invoice already exists
        const { data: existingInvoice, error: checkError } = await supabaseAdmin
          .from('customer_invoices')
          .select('id')
          .eq('customer_id', inv.customer_id)
          .eq('invoice_number', inv.invoice_number)
          .maybeSingle();
        
        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error(`Error checking invoice ${inv.invoice_number}:`, checkError);
          errors.push({ invoice_number: inv.invoice_number, error: checkError.message });
          continue;
        }
        
        let result;
        if (existingInvoice) {
          // Update existing invoice
          const { data, error: updateError } = await supabaseAdmin
            .from('customer_invoices')
            .update({
              invoice_date: inv.invoice_date,
              due_date: inv.due_date,
              order_number: inv.order_number,
              amount: inv.amount,
              outstanding_amount: inv.outstanding_amount,
              status: inv.status,
              external_id: inv.external_id,
              external_system: inv.external_system,
              notes: inv.notes,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingInvoice.id)
            .select()
            .single();
          
          if (updateError) {
            console.error(`Error updating invoice ${inv.invoice_number}:`, updateError);
            const isConflict = (updateError.code === '23505' || updateError.code === '21000' || (updateError.message || '').toLowerCase().includes('on conflict'));
            if (isConflict) {
              conflictErrors.push({ invoice_number: inv.invoice_number, error: updateError.message });
            } else {
              errors.push({ invoice_number: inv.invoice_number, error: updateError.message });
            }
          } else if (data) {
            insertedInvoices.push(data);
          }
        } else {
          // Insert new invoice
          const { data, error: insertError } = await supabaseAdmin
            .from('customer_invoices')
            .insert(inv)
            .select()
            .single();
          
          if (insertError) {
            console.error(`Error inserting invoice ${inv.invoice_number}:`, insertError);
            const isConflict = (insertError.code === '23505' || insertError.code === '21000' || (insertError.message || '').toLowerCase().includes('on conflict'));
            if (isConflict) {
              conflictErrors.push({ invoice_number: inv.invoice_number, error: insertError.message });
            } else {
              errors.push({ invoice_number: inv.invoice_number, error: insertError.message });
            }
          } else if (data) {
            insertedInvoices.push(data);
          }
        }
      } catch (err) {
        console.error(`Exception processing invoice ${inv.invoice_number}:`, err);
        const isConflict = (err.code === '23505' || err.code === '21000' || (err.message || '').toLowerCase().includes('on conflict'));
        if (isConflict) {
          conflictErrors.push({ invoice_number: inv.invoice_number, error: err.message });
        } else {
          errors.push({ invoice_number: inv.invoice_number, error: err.message });
        }
      }
    }
    
    // If only conflict errors occurred (no hard errors), return success with warnings
    const hardErrors = errors.length > 0;
    if (hardErrors) {
      console.error('Database error(s) during import:', errors);
      return res.status(500).json({ 
        success: false,
        error: `Failed to import ${errors.length} invoices`,
        imported: insertedInvoices.length,
        failed: errors.length,
        errors,
        conflicts: conflictErrors
      });
    }
    
    res.json({ 
      success: true, 
      imported: insertedInvoices.length,
      invoices: insertedInvoices,
      duplicates_removed: mappedInvoices.length - uniqueInvoices.length,
      conflicts_ignored: conflictErrors.length,
      conflicts: conflictErrors
    });
  } catch (e) {
    console.error('Error importing invoices:', e);
    res.status(500).json({ 
      success: false,
      error: 'Fout bij importeren facturen: ' + e.message 
    });
  }
});

// ==== Customer Meetings API ====
router.get('/api/customers/:id/meetings', requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('customer_meetings')
      .select('id, meeting_date, title, notes, created_at, updated_at, created_by')
      .eq('customer_id', id)
      .order('meeting_date', { ascending: false });
    if (error) throw error;
    res.json({ meetings: data || [] });
  } catch (e) {
    console.error('Error fetching meetings:', e);
    res.status(500).json({ error: 'Fout bij ophalen meetings: ' + e.message });
  }
});

router.post('/api/customers/:id/meetings', requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { meeting_date, title, notes } = req.body;
    if (!meeting_date) {
      return res.status(400).json({ error: 'Meetingdatum is verplicht' });
    }
    const { data, error } = await supabaseAdmin
      .from('customer_meetings')
      .insert([{
        customer_id: id,
        meeting_date: meeting_date,
        title: (title || '').trim(),
        notes: (notes || '').trim(),
        created_by: req.user.id
      }])
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, meeting: data });
  } catch (e) {
    console.error('Error creating meeting:', e);
    res.status(500).json({ error: 'Fout bij aanmaken meeting: ' + e.message });
  }
});

router.put('/api/customers/:id/meetings/:meetingId', requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const { id, meetingId } = req.params;
    const { meeting_date, title, notes } = req.body;
    const updates = {};
    if (meeting_date !== undefined) updates.meeting_date = meeting_date;
    if (title !== undefined) updates.title = (title || '').trim();
    if (notes !== undefined) updates.notes = (notes || '').trim();
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Geen velden om bij te werken' });
    }
    const { data, error } = await supabaseAdmin
      .from('customer_meetings')
      .update(updates)
      .eq('id', meetingId)
      .eq('customer_id', id)
      .select()
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Meeting niet gevonden' });
    res.json({ success: true, meeting: data });
  } catch (e) {
    console.error('Error updating meeting:', e);
    res.status(500).json({ error: 'Fout bij bijwerken meeting: ' + e.message });
  }
});

router.delete('/api/customers/:id/meetings/:meetingId', requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const { id, meetingId } = req.params;
    const { error } = await supabaseAdmin
      .from('customer_meetings')
      .delete()
      .eq('id', meetingId)
      .eq('customer_id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    console.error('Error deleting meeting:', e);
    res.status(500).json({ error: 'Fout bij verwijderen meeting: ' + e.message });
  }
});

router.delete('/api/customers/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    
    const { error } = await supabaseAdmin
      .from('customers')
      .delete()
      .eq('id', id)
    
    if (error) throw error
    
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: 'Fout bij verwijderen klant: ' + e.message })
  }
})

router.post('/api/mail/:id/unsubscribe', requireAuth, isAdmin, async (req, res) => {
  try {
    const id = req.params.id
    const { data: mail } = await supabaseAdmin
      .from('mail_inbox')
      .select('from_email, body_html, body_text')
      .eq('id', id)
      .single()
    if (!mail) return res.status(404).json({ error: 'Mail niet gevonden' })

    // Try to find unsubscribe link in email body
    let unsubscribeUrl = null
    const bodyText = (mail.body_html || mail.body_text || '').toLowerCase()
    
    // Common unsubscribe link patterns
    const unsubscribePatterns = [
      /href=["']([^"']*unsubscribe[^"']*)["']/i,
      /href=["']([^"']*afmelden[^"']*)["']/i,
      /href=["']([^"']*uitschrijven[^"']*)["']/i,
      /href=["']([^"']*opt-out[^"']*)["']/i,
      /(https?:\/\/[^\s<>"']*unsubscribe[^\s<>"']*)/i,
      /(https?:\/\/[^\s<>"']*afmelden[^\s<>"']*)/i
    ]
    
    for (const pattern of unsubscribePatterns) {
      const match = bodyText.match(pattern)
      if (match && match[1]) {
        unsubscribeUrl = match[1].replace(/['"]/g, '').trim()
        // Make sure it's a full URL
        if (!unsubscribeUrl.startsWith('http')) {
          // Try to construct full URL from domain
          const domain = mail.from_email.split('@')[1]
          if (domain) {
            unsubscribeUrl = `https://${domain}${unsubscribeUrl.startsWith('/') ? '' : '/'}${unsubscribeUrl}`
          }
        }
        break
      }
    }

    // Save unsubscribe record (table might not exist, so use try-catch)
    try {
      await supabaseAdmin
        .from('mail_newsletter_subscriptions')
        .upsert({ 
          email: mail.from_email, 
          is_subscribed: false, 
          unsubscribed_at: new Date().toISOString(), 
          mail_id: id,
          unsubscribe_url: unsubscribeUrl
        }, {
          onConflict: 'email'
        })
    } catch (tableError) {
      // Table might not exist - that's OK, we still try to auto-unsubscribe
      console.log('Newsletter subscriptions table not found (this is OK):', tableError.message)
    }

    // If we found an unsubscribe URL, try to automatically unsubscribe
    let autoUnsubscribed = false
    if (unsubscribeUrl) {
      try {
        // Try to automatically unsubscribe via HTTP request
        const https = require('https')
        const http = require('http')
        const url = require('url')
        
        const parsedUrl = new URL(unsubscribeUrl)
        const client = parsedUrl.protocol === 'https:' ? https : http
        
        const requestOptions = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; GrowSocial/1.0)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          timeout: 5000
        }
        
        await new Promise((resolve, reject) => {
          const req = client.request(requestOptions, (res) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              autoUnsubscribed = true
            }
            resolve()
          })
          
          req.on('error', (err) => {
            // Silent fail
            resolve()
          })
          
          req.on('timeout', () => {
            req.destroy()
            resolve()
          })
          
          req.end()
        })
      } catch (autoError) {
        // Silent fail - we still saved the unsubscribe record
        console.log('Auto-unsubscribe failed (this is OK):', autoError.message)
      }
    }

    res.json({ 
      ok: true, 
      autoUnsubscribed,
      unsubscribeUrl: unsubscribeUrl || null
    })
  } catch (e) {
    res.status(500).json({ error: 'Fout bij afmelden: ' + (e.message || 'Unknown error') })
  }
})

router.post('/api/mail/:id/archive', requireAuth, isAdmin, async (req, res) => {
  try {
    const id = req.params.id
    await supabaseAdmin
      .from('mail_inbox')
      .update({ archived_at: new Date().toISOString(), status: 'archived' })
      .eq('id', id)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Fout bij archiveren' })
  }
})

router.delete('/api/mail/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const id = req.params.id
    await supabaseAdmin
      .from('mail_inbox')
      .delete()
      .eq('id', id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: 'Fout bij verwijderen mail' })
  }
})

// Bulk delete mail endpoint
router.post('/api/mail/bulk/delete', requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const { ids } = req.body
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Mail IDs zijn verplicht' })
    }
    
    // Verify user has access to these mails (check mailbox permissions)
    const currentUserId = req.user?.id
    const currentUserEmail = req.user?.email
    
    // Get accessible mailboxes for this user
    const accessibleMailboxes = await getAccessibleMailboxes(currentUserId, currentUserEmail)
    const accessibleMailboxIds = accessibleMailboxes.map(mb => mb.id)
    
    // Check if user is admin/manager (they can delete all mails)
    const isAdmin = req.user?.user_metadata?.is_admin === true || req.user?.is_admin === true
    let isManager = false
    if (!isAdmin && req.user?.role_id) {
      const { data: role } = await supabaseAdmin
        .from('roles')
        .select('name')
        .eq('id', req.user.role_id)
        .maybeSingle()
      if (role?.name?.toLowerCase().includes('manager')) {
        isManager = true
      }
    }
    
    // If not admin/manager, verify mails belong to accessible mailboxes
    if (!isAdmin && !isManager && accessibleMailboxIds.length > 0) {
      const { data: mails } = await supabaseAdmin
        .from('mail_inbox')
        .select('mailbox_id')
        .in('id', ids)
      
      const unauthorizedMails = mails?.filter(m => !accessibleMailboxIds.includes(m.mailbox_id)) || []
      if (unauthorizedMails.length > 0) {
        return res.status(403).json({ error: 'Je hebt geen toegang tot een of meer van deze e-mails' })
      }
    }
    
    // Delete all mails in one query
    const { error } = await supabaseAdmin
      .from('mail_inbox')
      .delete()
      .in('id', ids)
    
    if (error) {
      console.error('Error bulk deleting mails:', error)
      return res.status(500).json({ error: 'Fout bij verwijderen mails' })
    }
    
    res.json({ success: true, deleted: ids.length })
  } catch (e) {
    console.error('Error in bulk delete mail:', e)
    res.status(500).json({ error: 'Fout bij verwijderen mails: ' + e.message })
  }
})

// Opportunities (Kansen)
router.get('/opportunities', requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const perPage = 20;
    const { status, priority, assignee, search, stale } = req.query;

    // Build base query
    let query = supabaseAdmin
      .from('opportunities')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters if present
    if (status && status !== 'all') query = query.eq('status', status);
    if (priority && priority !== 'all') query = query.eq('priority', priority);
    if (assignee && assignee !== 'all') {
      if (assignee === 'unassigned') {
        query = query.is('assignee_id', null);
      } else {
        query = query.eq('assignee_id', assignee);
      }
    }
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      // Basic text filters across a few columns
      query = query.or(
        `title.ilike.${term},company_name.ilike.${term},contact_name.ilike.${term},description.ilike.${term}`
      );
    }

    // Fetch all matching (we'll paginate in-memory to keep things simple here)
    let allOpportunities;
    const { data: fetched, error: oppErr } = await query;
    if (oppErr) throw oppErr;
    allOpportunities = fetched || [];

    // Filter "Stale kansen": assigned, still new, assigned > 48h ago
    if (stale === '1') {
      const now = Date.now();
      const fortyEightHoursMs = 48 * 60 * 60 * 1000;
      allOpportunities = allOpportunities.filter(o => o.assigned_to && (o.sales_status || 'new') === 'new' && o.assigned_at && (now - new Date(o.assigned_at).getTime() > fortyEightHoursMs));
    }

    const totalCount = allOpportunities.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
    const startIndex = (page - 1) * perPage;
    const paginated = (allOpportunities || []).slice(startIndex, startIndex + perPage);

    // Sales reps list (simple profile list)
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name')
      .order('first_name', { ascending: true });

    const salesReps = (profiles || []).map(p => ({
      id: p.id,
      name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Onbekend'
    }));

    // Get historical deals for all reps (fetch once for all opportunities)
    const { data: allDeals } = await supabaseAdmin
      .from('deals')
      .select('sales_rep_id, status, value_eur');

    // AI Suggestion Logic: Match opportunities to best sales reps
    const generateAISuggestion = (opportunity, dealsData) => {
      if (!salesReps || salesReps.length === 0) return null;
      if (opportunity.assigned_to) return null; // Already assigned

      // Calculate rep stats
      const repStats = {};
      salesReps.forEach(rep => {
        const repDeals = (dealsData || []).filter(d => d.sales_rep_id === rep.id);
        const wonDeals = repDeals.filter(d => d.status === 'won');
        const totalValue = repDeals.reduce((sum, d) => sum + (d.value_eur || 0), 0);
        const successRate = repDeals.length > 0 ? Math.round((wonDeals.length / repDeals.length) * 100) : 50;

        repStats[rep.id] = {
          id: rep.id,
          name: rep.name,
          dealCount: repDeals.length,
          wonCount: wonDeals.length,
          successRate,
          totalValue
        };
      });

      // Score each rep for this opportunity
      const scores = salesReps.map(rep => {
        const stats = repStats[rep.id] || { successRate: 50, dealCount: 0, wonCount: 0 };
        let score = 0;

        // Factor 1: Success rate (0-50 points)
        score += (stats.successRate / 100) * 50;

        // Factor 2: Experience (0-30 points) - more deals = more experience
        const experienceScore = Math.min(30, (stats.dealCount / 10) * 30);
        score += experienceScore;

        // Factor 3: Value match (0-20 points) - if rep handles similar value deals
        const oppValue = opportunity.value || opportunity.value_eur || 0;
        if (stats.totalValue > 0) {
          const avgDealValue = stats.totalValue / stats.dealCount;
          const valueDiff = Math.abs(avgDealValue - oppValue);
          const maxValue = Math.max(avgDealValue, oppValue);
          if (maxValue > 0) {
            score += (1 - (valueDiff / maxValue)) * 20;
          }
        }

        return {
          rep_id: rep.id,
          rep_name: rep.name,
          score: Math.round(score),
          successRate: stats.successRate,
          dealCount: stats.dealCount,
          reason: stats.dealCount > 0 
            ? `Heeft ervaring met ${stats.dealCount} deals en ${stats.successRate}% slagingspercentage`
            : 'Nieuwe medewerker, bereid om te leren'
        };
      });

      // Get top match
      scores.sort((a, b) => b.score - a.score);
      const topMatch = scores[0];

      if (topMatch && topMatch.score > 0) {
        return {
          rep_id: topMatch.rep_id,
          rep_name: topMatch.rep_name,
          confidence: topMatch.score,
          reason: topMatch.reason,
          match_percentage: topMatch.score // Use score as match percentage
        };
      }

      return null;
    };

    // Generate AI suggestions for paginated opportunities
    const opportunitiesWithAI = paginated.map(opp => {
      const suggestion = generateAISuggestion(opp, allDeals || []);
      return {
        ...opp,
        ai_suggestion: suggestion
      };
    });

    // Derive KPIs from all opportunities
    const totalValue = (allOpportunities || []).reduce((sum, o) => sum + (o.value || o.value_eur || 0), 0);
    const openCount = (allOpportunities || []).filter(o => ['new','qualified','proposal','negotiation','open'].includes(o.status)).length;
    const wonCount = (allOpportunities || []).filter(o => o.status === 'won').length;
    const conversionRate = totalCount ? Math.round((wonCount / totalCount) * 100) : 0;
    const aiSuggestions = (allOpportunities || []).filter(o => !!o.ai_suggestion).length;

    // Admin/manager: show Kansenstromen quick-link and optional empty-state callout
    let showStreamsLink = false;
    let showStreamsEmptyCallout = false;
    try {
      let isUserAdmin = req.user?.user_metadata?.is_admin === true;
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('is_admin, role_id')
        .eq('id', req.user.id)
        .single();
      if (profile?.is_admin) isUserAdmin = true;
      let isManager = false;
      if (profile?.role_id) {
        const { data: role } = await supabaseAdmin.from('roles').select('name').eq('id', profile.role_id).maybeSingle();
        if (role && (role.name || '').toLowerCase().includes('manager')) isManager = true;
      }
      showStreamsLink = isUserAdmin || isManager;
      if (showStreamsLink) {
        const { count: streamsCount } = await supabaseAdmin.from('opportunity_streams').select('*', { count: 'exact', head: true });
        const streamOppsCount = (allOpportunities || []).filter(o => o.source_stream_id || (o.meta && o.meta.source === 'stream')).length;
        showStreamsEmptyCallout = (streamsCount === 0) || (streamOppsCount === 0);
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.log('Streams link/callout check:', err.message);
    }

    res.render('admin/opportunities', {
      title: 'Kansen',
      activeMenu: 'opportunities',
      user: req.user,
      kpis: { totalValue, openCount, conversionRate, aiSuggestions },
      opportunities: opportunitiesWithAI || [],
      salesReps,
      pagination: { page, perPage, totalPages, totalCount },
      showStreamsLink,
      showStreamsEmptyCallout,
      filterStale: stale === '1',
      filterQuery: { status, priority, assignee, search, stale },
      scripts: ['/js/admin/opportunities.js', '/js/admin/ai-kansen-router.js'],
      stylesheets: ['/css/opportunities.css', '/css/admin/ai-lead-router.css']
    });
  } catch (e) {
    res.status(500).render('error', { message: 'Kon kansen niet laden', error: {}, user: req.user });
  }
});

// Deals list (under Kansen) - MUST be before /opportunities/:id route
router.get('/opportunities/deals', requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const statusFilter = req.query.status || 'all'
    const viewMode = req.query.view || 'list' // list | kanban
    const { data: dealsRaw } = await supabaseAdmin
      .from('deals')
      .select('*, opportunity:opportunities(id, title, company_name, contact_name, email, phone, description)')
      .order('created_at', { ascending: false })

    let deals = dealsRaw || []
    if (statusFilter !== 'all') {
      deals = deals.filter(d => d.status === statusFilter)
    }

    const repIds = [...new Set(deals.map(d => d.sales_rep_id).filter(Boolean))]
    let salesRepsMap = {}
    if (repIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', repIds)
      salesRepsMap = (profiles || []).reduce((acc, p) => {
        acc[p.id] = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Onbekend'
        return acc
      }, {})
    }

    const allDeals = dealsRaw || []
    const kpis = {
      totalValue: allDeals.reduce((s, d) => s + (Number(d.value_eur) || 0), 0),
      openCount: allDeals.filter(d => d.status === 'open').length,
      wonCount: allDeals.filter(d => d.status === 'won').length,
      lostCount: allDeals.filter(d => d.status === 'lost').length
    }

    res.render('admin/deals', {
      title: 'Deals',
      activeMenu: 'opportunities',
      activeSubmenu: 'deals',
      user: req.user,
      deals,
      salesRepsMap,
      kpis,
      filterStatus: statusFilter,
      viewMode,
      scripts: ['/js/admin/deals.js'],
      stylesheets: ['/css/opportunities.css', '/css/deals.css']
    })
  } catch (e) {
    res.status(500).render('error', { message: 'Kon deals niet laden', error: {}, user: req.user })
  }
})

// Deal detail (single deal page) - MUST be before /opportunities/:id
router.get('/opportunities/deals/:id', requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { data: deal, error: dealErr } = await supabaseAdmin
      .from('deals')
      .select('*')
      .eq('id', id)
      .single()
    if (dealErr || !deal) {
      return res.status(404).render('error', { message: 'Deal niet gevonden', error: {}, user: req.user })
    }
    let opportunity = null
    if (deal.opportunity_id) {
      const { data: opp } = await supabaseAdmin
        .from('opportunities')
        .select('*')
        .eq('id', deal.opportunity_id)
        .single()
      opportunity = opp
    }
    let assignee = null
    if (deal.sales_rep_id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('id', deal.sales_rep_id)
        .single()
      if (profile) {
        assignee = {
          id: profile.id,
          name: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Onbekend',
          email: profile.email
        }
      }
    }
    res.render('admin/deal-detail', {
      title: deal.title || 'Deal',
      activeMenu: 'opportunities',
      activeSubmenu: 'deals',
      user: req.user,
      deal,
      opportunity,
      assignee,
      scripts: ['/js/admin/deal-detail.js'],
      stylesheets: ['/css/opportunities.css', '/css/opportunity-detail.css', '/css/deals.css']
    })
  } catch (e) {
    res.status(500).render('error', { message: 'Kon deal niet laden', error: {}, user: req.user })
  }
})

// Opportunity Streams (Kansenstromen) - admin/manager only
router.get('/opportunities/streams', requireAuth, requireManagerOrAdminPage, async (req, res) => {
  try {
    const { data: streams } = await supabaseAdmin
      .from('opportunity_streams')
      .select('id, name, type, is_active, config, created_at, updated_at')
      .order('created_at', { ascending: false })
    const streamIds = (streams || []).map(s => s.id)
    let lastEventByStream = {}
    let successRateByStream = {}
    if (streamIds.length > 0) {
      const { data: events } = await supabaseAdmin
        .from('opportunity_stream_events')
        .select('stream_id, received_at, status')
        .in('stream_id', streamIds)
        .order('received_at', { ascending: false })
      const last50ByStream = {}
      ;(events || []).forEach(ev => {
        if (!lastEventByStream[ev.stream_id]) lastEventByStream[ev.stream_id] = ev.received_at
        if (!last50ByStream[ev.stream_id]) last50ByStream[ev.stream_id] = []
        if (last50ByStream[ev.stream_id].length < 50) last50ByStream[ev.stream_id].push(ev.status)
      })
      Object.keys(last50ByStream).forEach(sid => {
        const arr = last50ByStream[sid]
        const success = arr.filter(s => s === 'success').length
        successRateByStream[sid] = arr.length ? Math.round((success / arr.length) * 100) : null
      })
    }
    res.render('admin/opportunity-streams/list', {
      title: 'Kansenstromen',
      activeMenu: 'opportunities',
      activeSubmenu: 'streams',
      user: req.user,
      streams: streams || [],
      lastEventByStream,
      successRateByStream,
      scripts: ['/js/admin/opportunity-streams.js'],
      stylesheets: ['/css/opportunities.css', '/css/admin/opportunity-streams.css']
    })
  } catch (e) {
    res.status(500).render('error', { message: 'Kon kansenstromen niet laden', error: {}, user: req.user })
  }
})

router.get('/opportunities/streams/new', requireAuth, requireManagerOrAdminPage, async (req, res) => {
  try {
    res.render('admin/opportunity-streams/form', {
      title: 'Nieuwe kansenstroom',
      activeMenu: 'opportunities',
      activeSubmenu: 'streams',
      user: req.user,
      stream: null,
      scripts: ['/js/admin/opportunity-streams-form.js'],
      stylesheets: ['/css/opportunities.css', '/css/admin/opportunity-streams.css']
    })
  } catch (e) {
    res.status(500).render('error', { message: 'Kon pagina niet laden', error: {}, user: req.user })
  }
})

router.get('/opportunities/streams/:id', requireAuth, requireManagerOrAdminPage, async (req, res) => {
  try {
    const { data: stream, error } = await supabaseAdmin
      .from('opportunity_streams')
      .select('id, name, type, is_active, config, created_at, updated_at')
      .eq('id', req.params.id)
      .single()
    if (error || !stream) {
      return res.status(404).render('error', { message: 'Kansenstroom niet gevonden', error: {}, user: req.user })
    }
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`
    res.render('admin/opportunity-streams/detail', {
      title: stream.name,
      activeMenu: 'opportunities',
      activeSubmenu: 'streams',
      user: req.user,
      stream,
      baseUrl: baseUrl.replace(/\/$/, ''),
      scripts: ['/js/admin/opportunity-streams-detail.js'],
      stylesheets: ['/css/opportunities.css', '/css/admin/opportunity-streams.css']
    })
  } catch (e) {
    res.status(500).render('error', { message: 'Kon kansenstroom niet laden', error: {}, user: req.user })
  }
})

router.get('/opportunities/streams/:id/edit', requireAuth, requireManagerOrAdminPage, async (req, res) => {
  try {
    const { data: stream, error } = await supabaseAdmin
      .from('opportunity_streams')
      .select('id, name, type, is_active, config, created_at, updated_at')
      .eq('id', req.params.id)
      .single()
    if (error || !stream) {
      return res.status(404).render('error', { message: 'Kansenstroom niet gevonden', error: {}, user: req.user })
    }
    res.render('admin/opportunity-streams/form', {
      title: `Bewerken: ${stream.name}`,
      activeMenu: 'opportunities',
      activeSubmenu: 'streams',
      user: req.user,
      stream,
      scripts: ['/js/admin/opportunity-streams-form.js'],
      stylesheets: ['/css/opportunities.css', '/css/admin/opportunity-streams.css']
    })
  } catch (e) {
    res.status(500).render('error', { message: 'Kon pagina niet laden', error: {}, user: req.user })
  }
})

// View single opportunity detail
router.get('/opportunities/:id', requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: opportunity, error: oppErr } = await supabaseAdmin
      .from('opportunities')
      .select('*')
      .eq('id', id)
      .single();
    
    if (oppErr || !opportunity) {
      return res.status(404).render('error', { 
        message: 'Kans niet gevonden', 
        error: {}, 
        user: req.user 
      });
    }

    // Get assigned rep info if available
    let assignedRep = null;
    if (opportunity.assigned_to) {
      const { data: rep } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('id', opportunity.assigned_to)
        .single();
      if (rep) {
        assignedRep = {
          id: rep.id,
          name: [rep.first_name, rep.last_name].filter(Boolean).join(' ') || 'Onbekend',
          email: rep.email
        };
      }
    }

    // Get all sales reps
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name')
      .order('first_name', { ascending: true });

    const salesReps = (profiles || []).map(p => ({
      id: p.id,
      name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Onbekend'
    }));

    // Get historical deals for AI suggestion
    const { data: allDeals } = await supabaseAdmin
      .from('deals')
      .select('sales_rep_id, status, value_eur');

    // AI Suggestion Logic (same as opportunities listing)
    let aiSuggestion = null;
    if (!opportunity.assigned_to && salesReps.length > 0) {
      // Calculate rep stats
      const repStats = {};
      salesReps.forEach(rep => {
        const repDeals = (allDeals || []).filter(d => d.sales_rep_id === rep.id);
        const wonDeals = repDeals.filter(d => d.status === 'won');
        const totalValue = repDeals.reduce((sum, d) => sum + (d.value_eur || 0), 0);
        const successRate = repDeals.length > 0 ? Math.round((wonDeals.length / repDeals.length) * 100) : 50;

        repStats[rep.id] = {
          id: rep.id,
          name: rep.name,
          dealCount: repDeals.length,
          wonCount: wonDeals.length,
          successRate,
          totalValue
        };
      });

      // Score each rep for this opportunity
      const scores = salesReps.map(rep => {
        const stats = repStats[rep.id] || { successRate: 50, dealCount: 0, wonCount: 0 };
        let score = 0;

        // Factor 1: Success rate (0-50 points)
        score += (stats.successRate / 100) * 50;

        // Factor 2: Experience (0-30 points) - more deals = more experience
        const experienceScore = Math.min(30, (stats.dealCount / 10) * 30);
        score += experienceScore;

        // Factor 3: Value match (0-20 points) - if rep handles similar value deals
        const oppValue = opportunity.value || opportunity.value_eur || 0;
        if (stats.totalValue > 0) {
          const avgDealValue = stats.totalValue / stats.dealCount;
          const valueDiff = Math.abs(avgDealValue - oppValue);
          const maxValue = Math.max(avgDealValue, oppValue);
          if (maxValue > 0) {
            score += (1 - (valueDiff / maxValue)) * 20;
          }
        }

        return {
          rep_id: rep.id,
          rep_name: rep.name,
          score: Math.round(score),
          successRate: stats.successRate,
          dealCount: stats.dealCount,
          reason: stats.dealCount > 0 
            ? `Heeft ervaring met ${stats.dealCount} deals en ${stats.successRate}% slagingspercentage`
            : 'Nieuwe medewerker, bereid om te leren'
        };
      });

      // Get top matches (primary + 2 alternatives)
      scores.sort((a, b) => b.score - a.score);
      const topMatch = scores[0];
      const alternatives = scores.slice(1, 3).filter(s => s.score > 0).map(s => ({
        name: s.rep_name,
        confidence: s.score,
        match_percentage: s.score,
        reason: s.reason
      }));

      if (topMatch && topMatch.score > 0) {
        aiSuggestion = {
          rep_id: topMatch.rep_id,
          rep_name: topMatch.rep_name,
          confidence: topMatch.score,
          reason: topMatch.reason,
          match_percentage: topMatch.score,
          alternatives: alternatives
        };
      }
    }

    // Get current user's admin status for sidebar navigation
    let isUserAdmin = req.user?.user_metadata?.is_admin === true;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, role_id')
        .eq('id', req.user.id)
        .single();
      
      if (profile?.is_admin) {
        isUserAdmin = true;
      }
    } catch (roleErr) {
      console.log('Error fetching user admin status:', roleErr);
    }

    const opportunityToDealService = require('../services/opportunityToDealService');
    const linkedDeal = await opportunityToDealService.getDealForOpportunity(id);

    res.render('admin/opportunity-detail', {
      title: opportunity.title || 'Kans details',
      activeMenu: 'opportunities',
      user: req.user,
      isUserAdmin: isUserAdmin,
      opportunity,
      assignedRep,
      salesReps,
      aiSuggestion,
      linkedDeal,
      scripts: ['/js/admin/opportunity-detail.js'],
      stylesheets: ['/css/opportunities.css']
    });
  } catch (e) {
    res.status(500).render('error', { 
      message: 'Kon kans niet laden', 
      error: {}, 
      user: req.user 
    });
  }
});

// Assign opportunity to a sales rep
router.post('/opportunities/:id/assign', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { rep_id } = req.body || {};
    if (!rep_id) return res.status(400).json({ success: false, error: 'rep_id ontbreekt' });

    // First verify opportunity exists
    const { data: opportunity, error: oppCheckErr } = await supabaseAdmin
      .from('opportunities')
      .select('id')
      .eq('id', id)
      .single();
    
    if (oppCheckErr || !opportunity) {
      return res.status(404).json({ success: false, error: 'Opportunity niet gevonden' });
    }

    // Get rep info
    const { data: rep, error: repErr } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('id', rep_id)
      .single();
    
    if (repErr || !rep) {
      return res.status(404).json({ success: false, error: 'Sales rep niet gevonden' });
    }

    const assigned_to_name = [rep.first_name, rep.last_name].filter(Boolean).join(' ') || 'Onbekend';
    
    // First, verify the opportunity exists
    const { data: currentOpp, error: checkErr } = await supabaseAdmin
      .from('opportunities')
      .select('id')
      .eq('id', id)
      .single();
    
    if (checkErr || !currentOpp) {
      console.error('Error checking opportunity:', checkErr);
      return res.status(404).json({ success: false, error: 'Opportunity niet gevonden of geen toegang' });
    }
    
    // Update opportunity - try without .select() first, then verify
    const updateData = {
      assigned_to: rep_id,
      assigned_to_name: assigned_to_name,
      assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: updErr } = await supabaseAdmin
      .from('opportunities')
      .update(updateData)
      .eq('id', id);

    if (updErr) {
      console.error('Supabase update error:', updErr);
      // Try to get more details about the error
      const errorDetails = {
        message: updErr.message,
        details: updErr.details,
        hint: updErr.hint,
        code: updErr.code
      };
      console.error('Full error details:', errorDetails);
      
      return res.status(500).json({ 
        success: false, 
        error: updErr.message || 'Fout bij bijwerken opportunity',
        details: updErr.details || updErr.hint || '',
        code: updErr.code || ''
      });
    }

    // Verify the update worked by fetching the updated record
    const { data: updated, error: fetchErr } = await supabaseAdmin
      .from('opportunities')
      .select('id, assigned_to, assigned_to_name')
      .eq('id', id)
      .single();

    if (fetchErr) {
      console.error('Error fetching updated opportunity:', fetchErr);
      // Update might have succeeded even if fetch fails
      return res.json({ success: true, message: 'Toewijzing voltooid' });
    }

    // Log manual override for router audit (mirror Leads)
    try {
      await opportunityAssignmentService.logManualOverride(id, rep_id, req.user?.id);
    } catch (logErr) {
      console.warn('Error logging manual override:', logErr.message);
    }

    // Assignment follow-up: email + task (idempotent)
    try {
      await opportunityAssignmentFollowUpService.recordAssignmentAndNotify(id, rep_id, req.user?.id, 'manual');
    } catch (followErr) {
      console.warn('Opportunity follow-up (email/task) failed:', followErr.message);
    }

    res.json({ success: true, opportunity: updated || { id, assigned_to: rep_id, assigned_to_name } });
  } catch (e) {
    console.error('Error in assign route:', e);
    res.status(500).json({ success: false, error: 'Fout bij toewijzen: ' + e.message });
  }
});

// Delete opportunity
router.delete('/opportunities/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user has permission to delete
    // Only admin or manager roles can delete
    // req.user.role is already set by middleware in server.js
    const userRole = req.user.role || null;
    const isAdminUser = req.user.is_admin || false;
    
    // Check permissions: admin, manager can delete
    const canDelete = isAdminUser || 
                      userRole === 'admin' || 
                      userRole === 'manager';
    
    if (!canDelete) {
      return res.status(403).json({ 
        success: false, 
        error: 'Je hebt geen rechten om opportunities te verwijderen. Alleen admins en managers kunnen verwijderen.' 
      });
    }
    
    // Check if opportunity exists
    const { data: opportunity, error: oppErr } = await supabaseAdmin
      .from('opportunities')
      .select('id, company_name')
      .eq('id', id)
      .single();
    
    if (oppErr || !opportunity) {
      return res.status(404).json({ 
        success: false, 
        error: 'Opportunity niet gevonden' 
      });
    }
    
    // Delete the opportunity
    const { error: deleteErr } = await supabaseAdmin
      .from('opportunities')
      .delete()
      .eq('id', id);
    
    if (deleteErr) {
      console.error('Error deleting opportunity:', deleteErr);
      return res.status(500).json({ 
        success: false, 
        error: 'Fout bij verwijderen: ' + deleteErr.message 
      });
    }
    
    res.json({ 
      success: true, 
      message: `Kans "${opportunity.company_name || 'onbekend'}" succesvol verwijderd` 
    });
  } catch (e) {
    console.error('Error in delete opportunity route:', e);
    res.status(500).json({ 
      success: false, 
      error: 'Fout bij verwijderen: ' + e.message 
    });
  }
});

// Update opportunity field
router.patch('/opportunities/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    
    // Only allow specific fields to be updated
    const allowedFields = [
      'company_name', 'contact_name', 'description', 'value', 'status', 
      'priority', 'assigned_to', 'email', 'phone', 'stage', 'notes', 'title'
    ];
    
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    // If updating assigned_to, also update assigned_to_name
    if (filteredUpdates.assigned_to !== undefined) {
      if (filteredUpdates.assigned_to === '' || filteredUpdates.assigned_to === null) {
        filteredUpdates.assigned_to = null;
        filteredUpdates.assigned_to_name = null;
        
        // If assignment was removed, automatically assign to best match
        const assignment = await autoAssignOpportunity(id);
        if (assignment) {
          // Refresh updates with auto-assignment
          const { data: opp } = await supabaseAdmin
            .from('opportunities')
            .select('assigned_to, assigned_to_name')
            .eq('id', id)
            .single();
          if (opp) {
            filteredUpdates.assigned_to = opp.assigned_to;
            filteredUpdates.assigned_to_name = opp.assigned_to_name;
          }
        }
      } else {
        const { data: rep } = await supabaseAdmin
          .from('profiles')
          .select('id, first_name, last_name')
          .eq('id', filteredUpdates.assigned_to)
          .single();
        if (rep) {
          filteredUpdates.assigned_to_name = [rep.first_name, rep.last_name].filter(Boolean).join(' ') || 'Onbekend';
          filteredUpdates.assigned_at = new Date().toISOString();
        }
      }
    }

    // Handle value conversion (make sure it's a number)
    if (filteredUpdates.value !== undefined) {
      filteredUpdates.value = parseFloat(filteredUpdates.value) || 0;
      filteredUpdates.value_eur = filteredUpdates.value;
    }

    filteredUpdates.updated_at = new Date().toISOString();

    const { error: updErr } = await supabaseAdmin
      .from('opportunities')
      .update(filteredUpdates)
      .eq('id', id);
    
    if (updErr) return res.status(500).json({ success: false, error: updErr.message });

    if (filteredUpdates.assigned_to) {
      try {
        await opportunityAssignmentFollowUpService.recordAssignmentAndNotify(id, filteredUpdates.assigned_to, req.user?.id, 'manual');
      } catch (followErr) {
        console.warn('Opportunity follow-up (email/task) failed:', followErr.message);
      }
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Fout bij bijwerken: ' + e.message });
  }
});

// Helper: auto-assign opportunity via AI Kansen Router (logs to opportunity_routing_decisions)
async function autoAssignOpportunity(opportunityId, streamId = null) {
  const result = await opportunityAssignmentService.assignOpportunity(opportunityId, {
    assignedBy: 'auto',
    streamId: streamId || null
  });
  if (!result) return null;
  return { rep_id: result.rep_id, rep_name: result.rep_name, score: result.score };
}

// Create opportunity from a mail
router.post('/api/opportunities/from-mail/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const id = req.params.id
    const { data: mail, error } = await supabaseAdmin
      .from('mail_inbox')
      .select('*')
      .eq('id', id)
      .single()
    if (error || !mail) return res.status(404).json({ error: 'Mail niet gevonden' })

    const title = (mail.subject || 'Nieuwe kans').slice(0, 140)
    const contactName = mail.from_name || null
    const email = mail.from_email || null

    // Extract company name from email domain or mail content
    let companyName = null
    if (email) {
      const domain = email.split('@')[1]
      if (domain && domain !== 'gmail.com' && domain !== 'hotmail.com' && domain !== 'outlook.com') {
        companyName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1)
      }
    }

    // Use AI to estimate opportunity value based on mail content
    const AiMailService = require('../services/aiMailService')
    const estimatedValue = await AiMailService.estimateOpportunityValue({
      subject: mail.subject || '',
      body_text: mail.body_text || '',
      from_email: mail.from_email || '',
      from_name: mail.from_name || ''
    })

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('opportunities')
      .insert({
        title,
        contact_name: contactName,
        email,
        company_name: companyName,
        source_mail_id: id,
        status: 'open',
        stage: 'nieuw',
        owner_id: req.user.id,
        value: estimatedValue,
        notes: (mail.body_text || '').slice(0, 2000)
      })
      .select()
      .single()

    if (insErr) return res.status(500).json({ error: insErr.message })

    // Automatically create contact person for the email sender
    let contactId = null
    if (email || contactName) {
      try {
        // Check if contact already exists with this email
        let existingContact = null
        if (email) {
          const { data: existing } = await supabaseAdmin
            .from('contacts')
            .select('id')
            .eq('email', email)
            .maybeSingle()
          
          if (existing) {
            existingContact = existing
          }
        }
        
        if (!existingContact) {
          // Parse name into first_name and last_name
          let firstName = null
          let lastName = null
          let fullName = contactName || email?.split('@')[0] || 'Onbekend'
          
          if (contactName) {
            const nameParts = contactName.trim().split(/\s+/)
            if (nameParts.length > 1) {
              firstName = nameParts[0]
              lastName = nameParts.slice(1).join(' ')
            } else {
              firstName = nameParts[0]
            }
          } else if (email) {
            firstName = email.split('@')[0]
          }
          
          // Extract company name from email domain if not already set
          let contactCompanyName = companyName
          if (!contactCompanyName && email) {
            const domain = email.split('@')[1]
            if (domain && !['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'live.com', 'icloud.com', 'me.com', 'protonmail.com', 'mail.com'].includes(domain)) {
              contactCompanyName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1)
            }
          }
          
          // Create new contact
          const { data: newContact, error: contactError } = await supabaseAdmin
            .from('contacts')
            .insert({
              first_name: firstName,
              last_name: lastName,
              name: fullName,
              email: email,
              company_name: contactCompanyName,
              source: 'mail',
              source_mail_id: id,
              opportunity_id: inserted.id,
              status: 'lead',
              created_by: req.user.id
            })
            .select()
            .single()
          
          if (!contactError && newContact) {
            contactId = newContact.id
            console.log(`✅ Auto-created contact ${contactId} from email for opportunity ${inserted.id}`)
          } else if (contactError) {
            console.error('Error creating contact:', contactError)
            // Don't fail the opportunity creation if contact creation fails
          }
        } else {
          // Update existing contact to link to opportunity
          contactId = existingContact.id
          await supabaseAdmin
            .from('contacts')
            .update({
              opportunity_id: inserted.id,
              source_mail_id: id,
              source: 'mail',
              updated_at: new Date().toISOString()
            })
            .eq('id', contactId)
          
          console.log(`✅ Linked existing contact ${contactId} to opportunity ${inserted.id}`)
        }
      } catch (contactErr) {
        console.error('Error in contact creation:', contactErr)
        // Don't fail the opportunity creation if contact creation fails
      }
    }

    // Automatically assign to best matching sales rep using AI
    const assignment = await autoAssignOpportunity(inserted.id);
    if (assignment) {
      // Refresh opportunity data with assignment
      const { data: updatedOpp } = await supabaseAdmin
        .from('opportunities')
        .select('*')
        .eq('id', inserted.id)
        .single();
      if (updatedOpp) {
        Object.assign(inserted, updatedOpp);
      }
    }

    // Don't update mail status - mail should remain visible in inbox
    // The opportunity is linked via source_mail_id, which is sufficient

    res.json({ 
      success: true, 
      opportunity: inserted, 
      autoAssigned: !!assignment, 
      estimatedValue,
      contactCreated: !!contactId,
      contactId: contactId
    })
  } catch (e) {
    res.status(500).json({ error: 'Fout bij aanmaken kans: ' + e.message })
  }
})

// Auto-assign all unassigned opportunities
router.post('/api/opportunities/auto-assign-all', requireAuth, isAdmin, async (req, res) => {
  try {
    // Get all unassigned opportunities
    const { data: unassigned, error: unassignedErr } = await supabaseAdmin
      .from('opportunities')
      .select('id')
      .is('assigned_to', null);
    
    if (unassignedErr) return res.status(500).json({ error: unassignedErr.message });
    
    const results = {
      total: unassigned.length,
      assigned: 0,
      failed: 0,
      skipped: 0
    };

    for (const opp of unassigned || []) {
      const assignment = await autoAssignOpportunity(opp.id);
      if (assignment) {
        results.assigned++;
      } else {
        results.skipped++;
      }
    }

    res.json({ success: true, results });
  } catch (e) {
    res.status(500).json({ error: 'Fout bij automatische toewijzing: ' + e.message });
  }
});

// Deals list removed - already defined earlier (line 5105)

// Convert opportunity to deal (idempotent; assignee or manager/admin)
const opportunityToDealService = require('../services/opportunityToDealService')
router.post('/api/opportunities/:id/convert-to-deal', requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { value_eur, sales_rep_id } = req.body || {}

    const { data: opp } = await supabaseAdmin
      .from('opportunities')
      .select('id, assigned_to')
      .eq('id', id)
      .single()
    if (!opp) return res.status(404).json({ success: false, error: 'Kans niet gevonden' })

    const isAssignee = opp.assigned_to === req.user.id
    let isManagerOrAdmin = req.user?.user_metadata?.is_admin === true
    if (!isManagerOrAdmin) {
      const { data: profile } = await supabaseAdmin.from('profiles').select('is_admin, role_id').eq('id', req.user.id).single()
      if (profile?.is_admin) isManagerOrAdmin = true
      else if (profile?.role_id) {
        const { data: role } = await supabaseAdmin.from('roles').select('name').eq('id', profile.role_id).maybeSingle()
        if ((role?.name || '').toLowerCase().includes('manager')) isManagerOrAdmin = true
      }
    }
    if (!isAssignee && !isManagerOrAdmin) {
      return res.status(403).json({ success: false, error: 'Alleen toegewezen medewerker of manager/admin kan converteren' })
    }

    const result = await opportunityToDealService.convertToDeal(id, {
      value_eur,
      sales_rep_id: sales_rep_id || undefined,
      actorId: req.user.id
    })

    res.json({ success: true, deal: result.deal, alreadyConverted: result.alreadyConverted })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || 'Fout bij converteren naar deal' })
  }
})

// Deal update (stage/status) – voor Kanban slepen
const ALLOWED_DEAL_STAGES = ['discovery', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']
router.patch('/api/deals/:id', requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { stage } = req.body || {}
    if (!stage || !ALLOWED_DEAL_STAGES.includes(stage)) {
      return res.status(400).json({ error: 'Ongeldige of ontbrekende stage' })
    }
    const status = stage === 'closed_won' ? 'won' : stage === 'closed_lost' ? 'lost' : 'open'
    const { data, error } = await supabaseAdmin
      .from('deals')
      .update({ stage, status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, stage, status')
      .single()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Deal niet gevonden' })
    res.json({ success: true, deal: data })
  } catch (e) {
    res.status(500).json({ error: 'Fout bij bijwerken deal: ' + e.message })
  }
})

// Deal reminders API
router.post('/api/deals/:id/reminders', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { remind_at, type, note } = req.body || {}

    const { data: ins, error } = await supabaseAdmin
      .from('deal_reminders')
      .insert({ deal_id: id, remind_at, type: type || 'nudge', note: note || null, created_by: req.user.id })
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ success: true, reminder: ins })
  } catch (e) {
    res.status(500).json({ error: 'Fout bij aanmaken reminder: ' + e.message })
  }
})

// Debug endpoint for mail
router.get('/api/mail/debug/info', requireAuth, isAdmin, async (req, res) => {
  try {
    // Get total mail count
    const { count: totalMails } = await supabaseAdmin
      .from('mail_inbox')
      .select('*', { count: 'exact', head: true })
    
    // Get mailboxes
    const { data: mailboxes, error: mailboxError } = await supabaseAdmin
      .from('mailboxes')
      .select('*')
    
    // Get mails per mailbox
    const mailsPerMailbox = {}
    if (mailboxes) {
      for (const mb of mailboxes) {
        const { count } = await supabaseAdmin
          .from('mail_inbox')
          .select('*', { count: 'exact', head: true })
          .eq('mailbox_id', mb.id)
        mailsPerMailbox[mb.email] = count || 0
      }
    }
    
    // Get recent mails (last 5)
    const { data: recentMails } = await supabaseAdmin
      .from('mail_inbox')
      .select('id, subject, from_email, received_at, mailbox_id')
      .order('received_at', { ascending: false })
      .limit(5)
    
    res.json({
      totalMails: totalMails || 0,
      mailboxes: (mailboxes || []).length,
      mailsPerMailbox,
      recentMails: recentMails || [],
      mailboxError: mailboxError ? mailboxError.message : null
    })
  } catch (e) {
    res.status(500).json({ error: 'Debug error: ' + e.message })
  }
})

// --- Employees demo routes (v0 design) ---
router.get('/admin/werknemers', requireAuth, isAdmin, async (req, res) => {
  try {
    const employees = [
      { id: 'e1', name: 'Sarah van Dam', role: 'Senior Sales Manager', department: 'Sales', status: 'active', performance: 96, email: 'sarah.vandam@growsocial.nl', phone: '+31 6 12345678', location: 'Amsterdam', startDate: new Date('2023-01-15'), dealsWon: 24, revenue: 1850000 },
      { id: 'e2', name: 'Tom Bakker', role: 'Sales Representative', department: 'Sales', status: 'active', performance: 92, email: 'tom.bakker@growsocial.nl', phone: '+31 6 98765432', location: 'Rotterdam', startDate: new Date('2023-03-20'), dealsWon: 18, revenue: 1420000 },
      { id: 'e3', name: 'Emma de Vries', role: 'E-commerce Specialist', department: 'Marketing', status: 'active', performance: 89, email: 'emma.devries@growsocial.nl', phone: '+31 6 55544433', location: 'Utrecht', startDate: new Date('2023-06-10'), dealsWon: 15, revenue: 980000 },
    ]
    return res.render('admin/werknemers', { employees })
  } catch (e) {
    return res.status(500).send('Server error')
  }
})

router.get('/admin/werknemers/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const employee = {
      id,
      name: 'Sarah van Dam',
      role: 'Senior Sales Manager',
      department: 'Sales',
      performance: 96,
      email: 'sarah.vandam@growsocial.nl',
      phone: '+31 6 12345678',
      location: 'Amsterdam',
      startDate: new Date('2023-01-15'),
      bio: 'Ervaren sales professional met meer dan 8 jaar ervaring in B2B software sales.',
      dealsWon: 24,
      dealsInProgress: 8,
      revenue: 1850000,
      skills: ['Enterprise Sales', 'Account Management', 'Negotiation', 'CRM', 'Lead Generation'],
      activities: [
        { type: 'deal_won', description: 'Deal gewonnen met TechCorp BV ter waarde van €125.000', relative: '2 dagen geleden' },
        { type: 'meeting', description: 'Ontmoeting met HealthCare Solutions', relative: '5 dagen geleden' },
        { type: 'email', description: 'Opvolg e-mail verstuurd naar NextTech', relative: '1 week geleden' }
      ],
      recentDeals: [
        { company: 'NextTech', expectedClose: new Date(), value: 45000, status: 'negotiation' },
        { company: 'Finexa', expectedClose: new Date(), value: 90000, status: 'negotiation' }
      ],
      monthlyPerformance: [
        { month: 'Oktober 2025', deals: 6, revenue: 380000 },
        { month: 'September 2025', deals: 5, revenue: 320000 }
      ]
    }
    return res.render('admin/werknemer-detail', { employee })
  } catch (e) {
    return res.status(500).send('Server error')
  }
})

// ==== Bugs overview page ====
router.get('/settings/bugs', requireAuth, isAdmin, async (req, res) => {
  try {
    // Fetch bugs from database
    const { data: bugsData, error: bugsError } = await supabaseAdmin
      .from('bugs')
      .select('*')
      .order('created_at', { ascending: false });

    if (bugsError) {
      console.error('Error fetching bugs:', bugsError);
      // Fallback to empty array if table doesn't exist yet
      return res.render('admin/bugs', {
        title: 'Bugs',
        bugs: [],
        kpis: { total: 0, open: 0, fixed: 0, urgent: 0 },
        filters: { search: '', priority: 'all', status: 'all' }
      });
    }

    // Transform database rows to match expected format
    const bugs = (bugsData || []).map(bug => ({
      id: bug.bug_id || bug.id,
      uuid: bug.id, // UUID for API calls
      bug_id: bug.bug_id,
      title: bug.title,
      description: bug.description,
      priority: bug.priority || 'normal',
      status: bug.status || 'open',
      area: bug.area,
      url: bug.url,
      reporter: bug.reporter,
      created_at: bug.created_at,
      tags: bug.tags || []
    }));

    // Filters
    const q = String(req.query.search || '').trim().toLowerCase();
    const priority = (req.query.priority || 'all').toLowerCase();
    const status = (req.query.status || 'all').toLowerCase();

    const filtered = bugs.filter(b => {
      const text = `${b.id} ${b.title} ${b.description} ${b.area} ${(b.tags || []).join(' ')}`.toLowerCase();
      const okQ = !q || text.includes(q);
      const okP = priority === 'all' || b.priority === priority;
      const okS = status === 'all' || b.status === status;
      return okQ && okP && okS;
    });

    const kpis = {
      total: bugs.filter(b => b.status !== 'fixed' && b.status !== 'closed').length,
      open: bugs.filter(b => b.status === 'open').length,
      fixed: bugs.filter(b => b.status === 'fixed').length,
      urgent: bugs.filter(b => b.priority === 'urgent' && b.status !== 'fixed' && b.status !== 'closed').length
    };

    return res.render('admin/bugs', {
      title: 'Bugs',
      activeMenu: 'settings',
      activeSubmenu: 'bugs',
      user: req.user,
      bugs: filtered,
      kpis,
      filters: { search: q, priority, status },
      stylesheets: ['/css/opportunities.css']
    });
  } catch (e) {
    console.error('Error rendering /admin/settings/bugs', e);
    return res.status(500).send('Server error');
  }
})

// ==== POST: Create new bug ====
router.post('/api/bugs', requireAuth, isAdmin, async (req, res) => {
  try {
    const { title, description, priority, status, area, url, reporter, tags } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Titel is verplicht' });
    }
    
    // Generate bug_id (e.g., BUG-101)
    const { count } = await supabaseAdmin
      .from('bugs')
      .select('id', { count: 'exact', head: true });
    
    const bugNumber = (count || 0) + 1;
    const bugId = `BUG-${bugNumber.toString().padStart(3, '0')}`;
    
    const { data: bug, error } = await supabaseAdmin
      .from('bugs')
      .insert({
        bug_id: bugId,
        title: title.trim(),
        description: description?.trim() || null,
        priority: priority || 'normal',
        status: status || 'open',
        area: area?.trim() || null,
        url: url?.trim() || null,
        // Sla automatisch de aanmaker op als reporter wanneer niet expliciet meegegeven
        reporter: (reporter && reporter.trim()) || (req.user && req.user.email) || null,
        tags: Array.isArray(tags) ? tags : (tags ? [tags] : []),
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, bug });
  } catch (e) {
    console.error('Error creating bug:', e);
    res.status(500).json({ error: 'Fout bij aanmaken bug: ' + e.message });
  }
})

// ==== PUT: Update bug (for drag-and-drop and editing) ====
router.put('/api/bugs/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority, title, description, area, tags } = req.body;
    
    const updateData = {};
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'fixed') updateData.fixed_at = new Date().toISOString();
      if (status !== 'fixed' && status !== 'closed') updateData.fixed_at = null;
    }
    if (priority !== undefined) updateData.priority = priority;
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (area !== undefined) updateData.area = area?.trim() || null;
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : (tags ? [tags] : []);
    
    // Try UUID first, then bug_id
    let query = supabaseAdmin
      .from('bugs')
      .update(updateData);
    
    // Check if id is UUID format or bug_id format
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    if (isUUID) {
      query = query.eq('id', id);
    } else {
      query = query.eq('bug_id', id);
    }
    
    const { data: bug, error } = await query
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, bug });
  } catch (e) {
    console.error('Error updating bug:', e);
    res.status(500).json({ error: 'Fout bij updaten bug: ' + e.message });
  }
})

// ==== DELETE: Delete bug ====
router.delete('/api/bugs/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if id is UUID format or bug_id format
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    let query = supabaseAdmin
      .from('bugs')
      .delete();
    
    if (isUUID) {
      query = query.eq('id', id);
    } else {
      query = query.eq('bug_id', id);
    }
    
    const { error } = await query;
    
    if (error) throw error;
    
    res.json({ success: true });
  } catch (e) {
    console.error('Error deleting bug:', e);
    res.status(500).json({ error: 'Fout bij verwijderen bug: ' + e.message });
  }
})

// ==== Todos overview page ====
router.get('/settings/todos', requireAuth, isAdmin, async (req, res) => {
  try {
    // Fetch todos from database
    const { data: todosData, error: todosError } = await supabaseAdmin
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false });

    if (todosError) {
      console.error('Error fetching todos:', todosError);
      // Fallback to empty array if table doesn't exist yet
      return res.render('admin/todos', {
        title: 'To-Do\'s',
        todos: [],
        kpis: { total: 0, todo: 0, in_progress: 0, done: 0 },
        filters: { search: '', priority: 'all', status: 'all' }
      });
    }

    // Transform database rows to match expected format
    const todos = (todosData || []).map(todo => ({
      id: todo.todo_id || todo.id,
      uuid: todo.id, // UUID for API calls
      todo_id: todo.todo_id,
      title: todo.title,
      description: todo.description,
      priority: todo.priority || 'normal',
      status: todo.status || 'todo',
      assignee: todo.assignee,
      due_date: todo.due_date,
      created_at: todo.created_at,
      completed_at: todo.completed_at,
      tags: todo.tags || []
    }));

    // Filters
    const q = String(req.query.search || '').trim().toLowerCase();
    const priority = (req.query.priority || 'all').toLowerCase();
    const status = (req.query.status || 'all').toLowerCase();

    const filtered = todos.filter(t => {
      const text = `${t.id} ${t.title} ${t.description} ${t.assignee} ${(t.tags || []).join(' ')}`.toLowerCase();
      const okQ = !q || text.includes(q);
      const okP = priority === 'all' || t.priority === priority;
      const okS = status === 'all' || t.status === status;
      return okQ && okP && okS;
    });

    const kpis = {
      total: todos.filter(t => t.status !== 'done').length,
      todo: todos.filter(t => t.status === 'todo').length,
      in_progress: todos.filter(t => t.status === 'in_progress').length,
      done: todos.filter(t => t.status === 'done').length
    };

    return res.render('admin/todos', {
      title: 'To-Do\'s',
      activeMenu: 'settings',
      activeSubmenu: 'todos',
      user: req.user,
      todos: filtered,
      kpis,
      filters: { search: q, priority, status },
      stylesheets: ['/css/opportunities.css']
    });
  } catch (e) {
    console.error('Error rendering /admin/settings/todos', e);
    return res.status(500).send('Server error');
  }
})

// ==== POST: Create new todo ====
router.post('/api/todos', requireAuth, isAdmin, async (req, res) => {
  try {
    const { title, description, priority, status, assignee, due_date, tags } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Titel is verplicht' });
    }
    
    // Generate todo_id (e.g., TODO-101)
    const { count } = await supabaseAdmin
      .from('todos')
      .select('id', { count: 'exact', head: true });
    
    const todoNumber = (count || 0) + 1;
    const todoId = `TODO-${todoNumber.toString().padStart(3, '0')}`;
    
    const { data: todo, error } = await supabaseAdmin
      .from('todos')
      .insert({
        todo_id: todoId,
        title: title.trim(),
        description: description?.trim() || null,
        priority: priority || 'normal',
        status: status || 'todo',
        assignee: assignee?.trim() || null,
        due_date: due_date || null,
        tags: Array.isArray(tags) ? tags : (tags ? [tags] : []),
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, todo });
  } catch (e) {
    console.error('Error creating todo:', e);
    res.status(500).json({ error: 'Fout bij aanmaken todo: ' + e.message });
  }
})

// ==== PUT: Update todo (for drag-and-drop and editing) ====
router.put('/api/todos/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority, title, description, assignee, due_date, tags } = req.body;
    
    const updateData = {};
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'done') updateData.completed_at = new Date().toISOString();
      if (status !== 'done') updateData.completed_at = null;
    }
    if (priority !== undefined) updateData.priority = priority;
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (assignee !== undefined) updateData.assignee = assignee?.trim() || null;
    if (due_date !== undefined) updateData.due_date = due_date || null;
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : (tags ? [tags] : []);
    
    // Try UUID first, then todo_id
    let query = supabaseAdmin
      .from('todos')
      .update(updateData);
    
    // Check if id is UUID format or todo_id format
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    if (isUUID) {
      query = query.eq('id', id);
    } else {
      query = query.eq('todo_id', id);
    }
    
    const { data: todo, error } = await query
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, todo });
  } catch (e) {
    console.error('Error updating todo:', e);
    res.status(500).json({ error: 'Fout bij updaten todo: ' + e.message });
  }
})

// ==== DELETE: Delete todo ====
router.delete('/api/todos/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if id is UUID format or todo_id format
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    let query = supabaseAdmin
      .from('todos')
      .delete();
    
    if (isUUID) {
      query = query.eq('id', id);
    } else {
      query = query.eq('todo_id', id);
    }
    
    const { error } = await query;
    
    if (error) throw error;
    
    res.json({ success: true });
  } catch (e) {
    console.error('Error deleting todo:', e);
    res.status(500).json({ error: 'Fout bij verwijderen todo: ' + e.message });
  }
})

// =====================================================
// SERVICES ROUTES
// =====================================================

// Main services page
router.get('/services', requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    // Check if user is admin or manager
    let isUserAdmin = req.user?.user_metadata?.is_admin === true || req.user?.is_admin === true;
    let isUserManager = false;
    
    if (!isUserAdmin && req.user?.role_id) {
      const { data: role } = await supabaseAdmin
        .from('roles')
        .select('name')
        .eq('id', req.user.role_id)
        .maybeSingle();
      if (role?.name?.toLowerCase().includes('manager')) {
        isUserManager = true;
      }
    }
    
    const canEdit = isUserAdmin || isUserManager;
    
    // Get services with filters
    const { search, status, type, page = 1 } = req.query;
    
    let query = supabaseAdmin
      .from('services')
      .select('*', { count: 'exact' });
    
    if (status && status !== 'all') {
      query = query.eq('status', status);
    } else if (!canEdit) {
      // Employees can only see active/inactive
      query = query.in('status', ['active', 'inactive']);
    }
    
    if (type && type !== 'all') {
      query = query.eq('service_type', type);
    }
    
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      query = query.or(`name.ilike.${searchTerm},slug.ilike.${searchTerm}`);
    }
    
    query = query.order('sort_order', { ascending: true })
                 .order('name', { ascending: true });
    
    const pageNum = parseInt(page) || 1;
    const pageSize = 20;
    const offset = (pageNum - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);
    
    const { data: services, error, count } = await query;
    
    if (error) throw error;
    
    res.render('admin/services', {
      title: 'Diensten',
      activeMenu: 'services',
      user: req.user,
      isUserAdmin: canEdit,
      services: services || [],
      pagination: {
        page: pageNum,
        pageSize: pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
      },
      filters: {
        search: search || '',
        status: status || 'all',
        type: type || 'all'
      }
    });
  } catch (err) {
    console.error('Error loading services:', err);
    res.status(500).render('error', {
      message: 'Kon diensten niet laden',
      error: {},
      user: req.user
    });
  }
});

// Service detail page (single service view)
router.get('/services/:id', requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    console.log('🔍 Service detail route hit:', req.path, req.params);
    const { id } = req.params;
    
    if (!id) {
      console.error('❌ No service ID provided');
      return res.status(404).render('error', {
        message: 'Service ID ontbreekt',
        error: {},
        user: req.user
      });
    }
    
    // Check if user is admin or manager
    let isUserAdmin = req.user?.user_metadata?.is_admin === true || req.user?.is_admin === true;
    let isUserManager = false;
    
    if (!isUserAdmin && req.user?.role_id) {
      const { data: role } = await supabaseAdmin
        .from('roles')
        .select('name')
        .eq('id', req.user.role_id)
        .maybeSingle();
      if (role?.name?.toLowerCase().includes('manager')) {
        isUserManager = true;
      }
    }
    
    const canEdit = isUserAdmin || isUserManager;
    
    // Get service data via API (will be loaded by frontend)
    // Just render the page with basic service info
    const { data: service, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('id, name, slug, status, service_type, pricing_mode, billing_model')
      .eq('id', id)
      .single();
    
    if (serviceError || !service) {
      return res.status(404).render('error', {
        message: 'Dienst niet gevonden',
        error: {},
        user: req.user
      });
    }
    
    // Check if employee can view (not archived)
    if (!canEdit && service.status === 'archived') {
      return res.status(403).render('error', {
        message: 'Geen toegang tot gearchiveerde diensten',
        error: {},
        user: req.user
      });
    }
    
    res.render('admin/service-detail', {
      title: service.name + ' - Diensten | GrowSocial Admin',
      activeMenu: 'services',
      user: req.user,
      isUserAdmin: canEdit,
      isUserManager: isUserManager,
      service: service,
      serviceId: id,
      stylesheets: ['/css/admin/service-detail.css'],
      scripts: ['/js/admin/service-detail.js']
    });
  } catch (err) {
    console.error('Error loading service detail:', err);
    res.status(500).render('error', {
      message: 'Kon dienst details niet laden',
      error: {},
      user: req.user
    });
  }
});

// Services catalog page (master data view)
router.get('/services/catalog', requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    // Check if user is admin or manager
    let isUserAdmin = req.user?.user_metadata?.is_admin === true || req.user?.is_admin === true;
    let isUserManager = false;
    
    if (!isUserAdmin && req.user?.role_id) {
      const { data: role } = await supabaseAdmin
        .from('roles')
        .select('name')
        .eq('id', req.user.role_id)
        .maybeSingle();
      if (role?.name?.toLowerCase().includes('manager')) {
        isUserManager = true;
      }
    }
    
    const canEdit = isUserAdmin || isUserManager;
    
    // Get all services (no pagination for catalog, show all)
    const { search, status, type } = req.query;
    
    let query = supabaseAdmin
      .from('services')
      .select('*', { count: 'exact' });
    
    if (status && status !== 'all') {
      query = query.eq('status', status);
    } else if (!canEdit) {
      // Employees can only see active/inactive
      query = query.in('status', ['active', 'inactive']);
    }
    
    if (type && type !== 'all') {
      query = query.eq('service_type', type);
    }
    
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      query = query.or(`name.ilike.${searchTerm},slug.ilike.${searchTerm}`);
    }
    
    query = query.order('sort_order', { ascending: true })
                 .order('name', { ascending: true });
    
    const { data: services, error, count } = await query;
    
    if (error) throw error;
    
    res.locals.activeSubmenu = 'catalog';
    res.render('admin/services-catalog', {
      title: 'Diensten Catalogus',
      activeMenu: 'services',
      activeSubmenu: 'catalog',
      user: req.user,
      isUserAdmin: canEdit,
      services: services || [],
      total: count || 0,
      filters: {
        search: search || '',
        status: status || 'all',
        type: type || 'all'
      }
    });
  } catch (err) {
    console.error('Error loading services catalog:', err);
    res.status(500).render('error', {
      message: 'Kon catalogus niet laden',
      error: {},
      user: req.user
    });
  }
});

// Services analytics page
router.get('/services/analytics', requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    res.render('admin/services-analytics', {
      title: 'Diensten Analytics',
      activeMenu: 'services',
      activeSubmenu: 'analytics',
      user: req.user
    });
  } catch (err) {
    console.error('Error loading services analytics:', err);
    res.status(500).render('error', {
      message: 'Kon analytics niet laden',
      error: {},
      user: req.user
    });
  }
});

// Services settings page
router.get('/services/settings', requireAuth, isEmployeeOrAdmin, async (req, res) => {
  try {
    res.render('admin/services-settings', {
      title: 'Diensten Instellingen',
      activeMenu: 'services',
      activeSubmenu: 'settings',
      user: req.user
    });
  } catch (err) {
    console.error('Error loading services settings:', err);
    res.status(500).render('error', {
      message: 'Kon instellingen niet laden',
      error: {},
      user: req.user
    });
  }
});

// GET /admin/notes - Notes page
router.get('/notes', requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    let notes = []
    try {
      const { data, error } = await supabaseAdmin
        .from('admin_notes')
        .select('id, title, content, created_at, updated_at, created_by')
        .order('created_at', { ascending: false })
      if (!error && data) notes = data
      else if (error) console.error('Error fetching notes (table may not exist yet):', error.message)
    } catch (dbErr) {
      console.error('Error fetching notes:', dbErr.message)
    }

    res.render('admin/notes', {
      title: 'Notities',
      activeMenu: 'tools',
      activeSubmenu: 'notes',
      user: req.user,
      notes
    })
  } catch (err) {
    console.error('Error loading notes page:', err)
    res.status(500).render('error', {
      message: 'Kon notities pagina niet laden',
      error: {},
      user: req.user
    })
  }
})

// GET /admin/scraper - Scraper page
router.get('/scraper', requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    // Check if user is admin or manager
    let isUserAdmin = req.user?.user_metadata?.is_admin === true || req.user?.is_admin === true
    let isUserManager = false
    
    if (!isUserAdmin && req.user?.role_id) {
      const { data: role } = await supabaseAdmin
        .from('roles')
        .select('name')
        .eq('id', req.user.role_id)
        .maybeSingle()
      if (role?.name?.toLowerCase().includes('manager')) {
        isUserManager = true
      }
    }

    // Get active services for dropdown
    const { data: services } = await supabaseAdmin
      .from('services')
      .select('id, name, slug, billing_model')
      .eq('status', 'active')
      .order('name', { ascending: true })

    // Get customer branches for selector
    const { data: branches } = await supabaseAdmin
      .from('customer_branches')
      .select('id, name')
      .eq('is_active', true)
      .order('name', { ascending: true })

    // Get current user's name for scripts
    const { data: currentUserProfile } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', req.user.id)
      .maybeSingle()
    
    const userName = currentUserProfile 
      ? `${currentUserProfile.first_name || ''} ${currentUserProfile.last_name || ''}`.trim() 
      : req.user.user_metadata?.first_name || 'jouw naam'

    res.render('admin/scraper', {
      title: 'Scraper',
      activeMenu: 'scraper',
      user: req.user,
      isUserAdmin: isUserAdmin || isUserManager,
      services: services || [],
      branches: branches || [],
      userName: userName
    })
  } catch (err) {
    console.error('Error loading scraper page:', err)
    res.status(500).render('error', {
      message: 'Kon scraper pagina niet laden',
      error: {},
      user: req.user
    })
  }
})

module.exports = router
