const { supabaseAdmin } = require('../config/supabase');
const SystemLogService = require('./systemLogService');
const logger = require('../utils/logger');

class PauseExpiryService {
    /**
     * Check and automatically resume expired pauses
     */
    async checkAndResumeExpiredPauses() {
        try {
            logger.info('Checking for expired pauses...');
            
            const now = new Date().toISOString();
            
            // Find users with expired pauses
            const { data: expiredPauses, error } = await supabaseAdmin
                .from('profiles')
                .select(`
                    id,
                    email,
                    user_metadata
                `)
                .not('user_metadata->pause_expires_at', 'is', null)
                .lt('user_metadata->pause_expires_at', now);

            if (error) {
                throw new Error(`Failed to fetch expired pauses: ${error.message}`);
            }

            if (!expiredPauses || expiredPauses.length === 0) {
                logger.info('No expired pauses found');
                return [];
            }

            logger.info(`Found ${expiredPauses.length} expired pauses`);

            const resumedPauses = [];

            for (const user of expiredPauses) {
                try {
                    // Update subscription to active
                    const { error: subscriptionError } = await supabaseAdmin
                        .from('subscriptions')
                        .update({
                            is_paused: false,
                            status: 'active',
                            updated_at: now
                        })
                        .eq('user_id', user.id);

                    if (subscriptionError) {
                        logger.error(`Failed to update subscription for user ${user.id}:`, subscriptionError);
                        continue;
                    }

                    // Clear pause metadata
                    const { error: profileError } = await supabaseAdmin
                        .from('profiles')
                        .update({
                            user_metadata: {
                                ...user.user_metadata,
                                pause_reason: null,
                                pause_other_reason: null,
                                pause_expires_at: null,
                                pause_requested_at: null,
                                pause_requested_by: null
                            },
                            updated_at: now
                        })
                        .eq('id', user.id);

                    if (profileError) {
                        logger.error(`Failed to update profile for user ${user.id}:`, profileError);
                        continue;
                    }

                    // Log the automatic resume
                    await SystemLogService.log({
                        type: 'info',
                        category: 'user_management',
                        title: 'Pauze Automatisch Opgeheven',
                        message: `Pauze voor gebruiker ${user.email} is automatisch opgeheven na verlopen`,
                        details: `Pauze was verlopen op ${user.user_metadata.pause_expires_at}`,
                        source: 'Pause System',
                        userId: user.id,
                        metadata: {
                            user_id: user.id,
                            user_email: user.email,
                            original_pause_reason: user.user_metadata.pause_reason,
                            expired_at: user.user_metadata.pause_expires_at,
                            action: 'auto_resume',
                            performed_by: 'System',
                            performed_by_email: 'system@automatic',
                            is_admin_action: false
                        },
                        severity: 'low'
                    });

                    resumedPauses.push({
                        user_id: user.id,
                        email: user.email,
                        expired_at: user.user_metadata.pause_expires_at
                    });

                    logger.info(`Automatically resumed pause for user ${user.email}`);

                } catch (userError) {
                    logger.error(`Error processing user ${user.id}:`, userError);
                }
            }

            logger.info(`Successfully resumed ${resumedPauses.length} expired pauses`);
            return resumedPauses;

        } catch (error) {
            logger.error('Error checking expired pauses:', error);
            throw error;
        }
    }

    /**
     * Get users with active pauses and their expiry information
     */
    async getActivePausesWithExpiry() {
        try {
            const { data: activePauses, error } = await supabaseAdmin
                .from('profiles')
                .select(`
                    id,
                    email,
                    company_name,
                    user_metadata->pause_reason,
                    user_metadata->pause_other_reason,
                    user_metadata->pause_expires_at,
                    user_metadata->pause_requested_at,
                    user_metadata->pause_requested_by
                `)
                .not('user_metadata->pause_expires_at', 'is', null);

            if (error) {
                throw new Error(`Failed to fetch active pauses: ${error.message}`);
            }

            return activePauses || [];
        } catch (error) {
            logger.error('Error fetching active pauses:', error);
            throw error;
        }
    }
}

module.exports = new PauseExpiryService();
