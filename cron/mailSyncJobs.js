const cron = require('node-cron');
// Lazy load ImapSyncService to avoid blocking server startup
let ImapSyncService = null;
function getImapSyncService() {
  if (!ImapSyncService) {
    ImapSyncService = require('../services/imapSyncService');
  }
  return ImapSyncService;
}
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger') || console;

/**
 * Automatically sync all active mailboxes every 30 seconds
 * This ensures new emails are fetched almost instantly
 */
cron.schedule('*/30 * * * * *', async () => {
  try {
    // Starting automatic mailbox sync log verwijderd voor schonere terminal output
    
    // Get all active mailboxes
    const { data: mailboxes, error } = await supabaseAdmin
      .from('mailboxes')
      .select('*')
      .eq('is_active', true);
    
    if (error) {
      logger.error('Error fetching active mailboxes:', error);
      return;
    }
    
    if (!mailboxes || mailboxes.length === 0) {
      // No active mailboxes log verwijderd voor schonere terminal output
      return;
    }
    
    // Syncing mailboxes log verwijderd voor schonere terminal output
    
    // Sync each mailbox
    for (const mailbox of mailboxes) {
      try {
        // Calculate "since" date - sync emails from last sync or last hour
        // We sync from last sync time to catch all new emails
        let sinceDate = null;
        
        if (mailbox.last_sync_at) {
          // Sync from last sync time (with 5 minute buffer to catch any missed emails)
          const lastSync = new Date(mailbox.last_sync_at);
          lastSync.setMinutes(lastSync.getMinutes() - 5); // 5 minute buffer for safety
          sinceDate = lastSync;
        } else {
          // If never synced, sync from last 30 days to catch recent history
          const monthAgo = new Date();
          monthAgo.setDate(monthAgo.getDate() - 30);
          sinceDate = monthAgo;
        }
        
        // Syncing mailbox log verwijderd voor schonere terminal output
        
        // Sync with limit to avoid overwhelming the system
        const result = await getImapSyncService().syncMailbox(mailbox, {
          limit: 50, // Reasonable limit per sync
          since: sinceDate,
          folder: 'INBOX'
        });
        
        // Update last sync time and count
        await supabaseAdmin
          .from('mailboxes')
          .update({
            last_sync_at: new Date().toISOString(),
            total_mails_synced: (mailbox.total_mails_synced || 0) + result.synced,
            last_error: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', mailbox.id);
        
        // Synced mailbox log verwijderd voor schonere terminal output
        
      } catch (mailboxError) {
        logger.error(`❌ Error syncing mailbox ${mailbox.email}:`, mailboxError);
        
        // Update error in database
        await supabaseAdmin
          .from('mailboxes')
          .update({
            last_error: mailboxError.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', mailbox.id)
          .catch(err => logger.error('Failed to update mailbox error:', err));
      }
    }
    
    // Automatic mailbox sync completed log verwijderd voor schonere terminal output
    
  } catch (error) {
    logger.error('❌ Error in automatic mailbox sync job:', error);
  }
}, {
  scheduled: true,
  timezone: 'Europe/Amsterdam'
});

/**
 * Also run a full sync every hour (to catch any missed emails)
 */
cron.schedule('0 * * * *', async () => {
  try {
    // Starting hourly full mailbox sync log verwijderd voor schonere terminal output
    
    const { data: mailboxes } = await supabaseAdmin
      .from('mailboxes')
      .select('*')
      .eq('is_active', true);
    
    if (!mailboxes || mailboxes.length === 0) return;
    
    // Sync from last 24 hours (broader search)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const sinceDate = yesterday; // Use Date object for IMAP SINCE
    
    for (const mailbox of mailboxes) {
      try {
        await getImapSyncService().syncMailbox(mailbox, {
          limit: 200,
          since: sinceDate,
          folder: 'INBOX'
        });
        
        await supabaseAdmin
          .from('mailboxes')
          .update({
            last_sync_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', mailbox.id);
        
        // Hourly sync completed log verwijderd voor schonere terminal output
      } catch (error) {
        logger.error(`❌ Hourly sync error for ${mailbox.email}:`, error);
      }
    }
  } catch (error) {
    logger.error('❌ Error in hourly sync job:', error);
  }
}, {
  scheduled: true,
  timezone: 'Europe/Amsterdam'
});

// Log when cron jobs are initialized
logger.info('📬 Mail sync cron jobs initialized');

