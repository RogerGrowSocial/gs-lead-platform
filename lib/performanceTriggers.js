const { supabaseAdmin } = require('../config/supabase');

/**
 * Performance Triggers Helper
 * 
 * Deze helper functies zorgen ervoor dat performance metrics automatisch
 * worden bijgewerkt wanneer bepaalde activiteiten plaatsvinden.
 */

/**
 * Handle first contact - check of first_contact_at al gezet is
 * (Trigger doet dit automatisch, maar we checken voor zekerheid)
 * 
 * @param {string} leadId - UUID van de lead
 * @param {string} activityType - Type van de activity
 * @returns {Promise<boolean>} - True als first_contact_at is gezet
 */
async function handleFirstContact(leadId, activityType) {
  // Contact types die first_contact_at moeten triggeren
  const contactTypes = ['phone_call', 'email_sent', 'whatsapp', 'meeting', 'status_change_contacted'];
  
  if (!contactTypes.includes(activityType)) {
    return false;
  }
  
  try {
    // Check of first_contact_at al gezet is
    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .select('first_contact_at')
      .eq('id', leadId)
      .single();
    
    if (error) {
      console.error('Error checking first_contact_at:', error);
      return false;
    }
    
    // Als first_contact_at al gezet is, hoef je niets te doen
    // (trigger heeft dit al gedaan)
    if (lead && lead.first_contact_at) {
      return true;
    }
    
    // Als first_contact_at nog NULL is, zet het handmatig
    // (fallback voor het geval de trigger niet werkt)
    const { error: updateError } = await supabaseAdmin
      .from('leads')
      .update({ first_contact_at: new Date().toISOString() })
      .eq('id', leadId)
      .is('first_contact_at', null);
    
    if (updateError) {
      console.error('Error setting first_contact_at:', updateError);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in handleFirstContact:', error);
    return false;
  }
}

/**
 * Handle won status - update lead status en deal_value, log activity
 * 
 * @param {string} leadId - UUID van de lead
 * @param {number|null} dealValue - Optionele deal waarde
 * @param {string} userId - UUID van de gebruiker die de actie uitvoert
 * @returns {Promise<boolean>} - True als succesvol
 */
async function handleWon(leadId, dealValue = null, userId) {
  try {
    // Update lead status naar 'won'
    const updateData = { status: 'won' };
    if (dealValue !== null && dealValue !== undefined) {
      updateData.deal_value = parseFloat(dealValue);
    }
    
    const { error: updateError } = await supabaseAdmin
      .from('leads')
      .update(updateData)
      .eq('id', leadId);
    
    if (updateError) {
      console.error('Error updating lead to won:', updateError);
      return false;
    }
    
    // Log activity: status_change_won
    const activityData = {
      lead_id: leadId,
      type: 'status_changed',
      description: dealValue 
        ? `Status gewijzigd naar Opdracht binnen (€${parseFloat(dealValue).toFixed(2)})`
        : 'Status gewijzigd naar Opdracht binnen',
      created_by: userId,
      metadata: {
        status: 'won',
        deal_value: dealValue ? parseFloat(dealValue) : null
      }
    };
    
    // Probeer eerst met created_by (geen partner_id kolom)
    const { error: activityError } = await supabaseAdmin
      .from('lead_activities')
      .insert(activityData);
    
    if (activityError) {
      console.error('Error logging won activity:', activityError);
      // Activity logging faalt niet de hele operatie
    }
    
    return true;
  } catch (error) {
    console.error('Error in handleWon:', error);
    return false;
  }
}

/**
 * Handle lost status - update lead status, log activity
 * 
 * @param {string} leadId - UUID van de lead
 * @param {string} userId - UUID van de gebruiker die de actie uitvoert
 * @returns {Promise<boolean>} - True als succesvol
 */
async function handleLost(leadId, userId) {
  try {
    // Update lead status naar 'lost'
    const { error: updateError } = await supabaseAdmin
      .from('leads')
      .update({ status: 'lost' })
      .eq('id', leadId);
    
    if (updateError) {
      console.error('Error updating lead to lost:', updateError);
      return false;
    }
    
    // Log activity: status_change_lost
    const activityData = {
      lead_id: leadId,
      type: 'status_changed',
      description: 'Status gewijzigd naar Geen opdracht',
      created_by: userId,
      metadata: {
        status: 'lost'
      }
    };
    
    // Probeer eerst met created_by (geen partner_id kolom)
    const { error: activityError } = await supabaseAdmin
      .from('lead_activities')
      .insert(activityData);
    
    if (activityError) {
      console.error('Error logging lost activity:', activityError);
      // Activity logging faalt niet de hele operatie
    }
    
    return true;
  } catch (error) {
    console.error('Error in handleLost:', error);
    return false;
  }
}

module.exports = {
  handleFirstContact,
  handleWon,
  handleLost
};

