const { supabaseAdmin } = require('../config/supabase');

class ActivityService {
    /**
     * Log an activity to the database
     * @param {Object} params - Activity parameters
     * @param {string} params.userId - User ID (optional)
     * @param {string} params.adminId - Admin ID (optional)
     * @param {string} params.type - Activity type
     * @param {string} params.severity - Activity severity (low, medium, high, critical)
     * @param {string} params.title - Activity title
     * @param {string} params.description - Activity description (optional)
     * @param {Object} params.metadata - Additional metadata (optional)
     * @param {string} params.ipAddress - IP address (optional)
     * @param {string} params.userAgent - User agent (optional)
     * @returns {Promise<string>} Activity ID
     */
    static async logActivity({
        userId = null,
        adminId = null,
        type,
        severity = 'medium',
        title,
        description = null,
        metadata = {},
        ipAddress = null,
        userAgent = null
    }) {
        try {
            console.log(`📝 Logging activity: ${type} - ${title}`);
            
            const { data, error } = await supabaseAdmin.rpc('log_activity', {
                p_user_id: userId,
                p_admin_id: adminId,
                p_activity_type: type,
                p_severity: severity,
                p_title: title,
                p_description: description,
                p_metadata: metadata,
                p_ip_address: ipAddress,
                p_user_agent: userAgent
            });

            if (error) {
                console.error('Error logging activity:', error);
                throw new Error('Failed to log activity');
            }

            console.log(`✅ Activity logged successfully: ${data}`);
            return data;
        } catch (error) {
            console.error('ActivityService.logActivity error:', error);
            throw error;
        }
    }

    /**
     * Get activities for admin dashboard
     * @param {Object} options - Query options
     * @param {number} options.limit - Number of activities to return
     * @param {number} options.offset - Offset for pagination
     * @param {string} options.type - Filter by activity type
     * @param {string} options.severity - Filter by severity
     * @param {string} options.userId - Filter by user ID
     * @param {Date} options.startDate - Start date filter
     * @param {Date} options.endDate - End date filter
     * @returns {Promise<Object>} Activities and pagination info
     */
    static async getActivities({
        limit = 50,
        offset = 0,
        type = null,
        severity = null,
        userId = null,
        startDate = null,
        endDate = null
    } = {}) {
        try {
            let query = supabase
                .from('admin_activities')
                .select('*')
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            // Apply filters
            if (type) {
                query = query.eq('activity_type', type);
            }
            if (severity) {
                query = query.eq('severity', severity);
            }
            if (userId) {
                query = query.eq('user_id', userId);
            }
            if (startDate) {
                query = query.gte('created_at', startDate.toISOString());
            }
            if (endDate) {
                query = query.lte('created_at', endDate.toISOString());
            }

            const { data, error, count } = await query;

            if (error) {
                console.error('Error fetching activities:', error);
                throw new Error('Failed to fetch activities');
            }

            return {
                activities: data || [],
                total: count || 0,
                limit,
                offset,
                hasMore: (data?.length || 0) === limit
            };
        } catch (error) {
            console.error('ActivityService.getActivities error:', error);
            throw error;
        }
    }

    /**
     * Get activity statistics for admin dashboard
     * @param {Date} startDate - Start date for statistics
     * @param {Date} endDate - End date for statistics
     * @returns {Promise<Object>} Activity statistics
     */
    static async getActivityStats(startDate = null, endDate = null) {
        try {
            let query = supabase
                .from('activities')
                .select('activity_type, severity, created_at');

            if (startDate) {
                query = query.gte('created_at', startDate.toISOString());
            }
            if (endDate) {
                query = query.lte('created_at', endDate.toISOString());
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching activity stats:', error);
                throw new Error('Failed to fetch activity statistics');
            }

            // Process statistics
            const stats = {
                total: data?.length || 0,
                byType: {},
                bySeverity: {},
                byDay: {},
                recentActivity: data?.slice(0, 10) || []
            };

            data?.forEach(activity => {
                // Count by type
                stats.byType[activity.activity_type] = (stats.byType[activity.activity_type] || 0) + 1;
                
                // Count by severity
                stats.bySeverity[activity.severity] = (stats.bySeverity[activity.severity] || 0) + 1;
                
                // Count by day
                const day = new Date(activity.created_at).toISOString().split('T')[0];
                stats.byDay[day] = (stats.byDay[day] || 0) + 1;
            });

            return stats;
        } catch (error) {
            console.error('ActivityService.getActivityStats error:', error);
            throw error;
        }
    }

    /**
     * Helper method to extract request info
     * @param {Object} req - Express request object
     * @returns {Object} Request info
     */
    static getRequestInfo(req) {
        return {
            ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        };
    }
}

module.exports = ActivityService;
