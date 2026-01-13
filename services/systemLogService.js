const { supabaseAdmin } = require('../config/supabase');

class SystemLogService {
    /**
     * Log a system activity
     * @param {Object} params - Log parameters
     * @param {string} params.type - Log type (info, warning, error, success, critical)
     * @param {string} params.category - Category (authentication, billing, user_management, system, payment, cron, api, database, security, admin)
     * @param {string} params.title - Log title
     * @param {string} params.message - Log message
     * @param {string} params.details - Additional details (optional)
     * @param {string} params.source - Source system (optional, defaults to 'System')
     * @param {string} params.userId - User ID (optional)
     * @param {string} params.adminId - Admin ID (optional)
     * @param {string} params.ipAddress - IP address (optional)
     * @param {string} params.userAgent - User agent (optional)
     * @param {Object} params.metadata - Additional metadata (optional)
     * @param {string} params.severity - Severity level (low, medium, high, critical, defaults to 'medium')
     * @returns {Promise<string>} Log ID
     */
    static async log({
        type,
        category,
        title,
        message,
        details = null,
        source = 'System',
        userId = null,
        adminId = null,
        ipAddress = null,
        userAgent = null,
        metadata = {},
        severity = 'medium'
    }) {
        try {
            console.log(`📝 System Log: ${type} - ${title}`);
            
            // Enhance metadata with user information
            const enhancedMetadata = await this.enhanceMetadataWithUserInfo({
                userId,
                adminId,
                metadata,
                source
            });
            
            const { data, error } = await supabaseAdmin.rpc('log_system_activity', {
                p_log_type: type,
                p_category: category,
                p_title: title,
                p_message: message,
                p_details: details,
                p_source: source,
                p_user_id: userId,
                p_admin_id: adminId,
                p_ip_address: ipAddress,
                p_user_agent: userAgent,
                p_metadata: enhancedMetadata,
                p_severity: severity
            });

            if (error) {
                console.error('Error logging system activity:', error);
                throw new Error('Failed to log system activity');
            }

            console.log(`✅ System log created successfully: ${data}`);
            return data;
        } catch (error) {
            console.error('SystemLogService.log error:', error);
            throw error;
        }
    }

    /**
     * Enhance metadata with user information
     * @param {Object} params - Parameters
     * @param {string} params.userId - User ID
     * @param {string} params.adminId - Admin ID
     * @param {Object} params.metadata - Existing metadata
     * @param {string} params.source - Source system
     * @returns {Promise<Object>} Enhanced metadata
     */
    static async enhanceMetadataWithUserInfo({ userId, adminId, metadata, source }) {
        const enhancedMetadata = { ...metadata };
        
        // Determine who performed the action
        let performedBy = 'Systeem';
        let isAdminAction = false;
        
        if (userId || adminId) {
            const targetUserId = adminId || userId;
            
            try {
                // Get user information
                const { data: user, error } = await supabaseAdmin
                    .from('profiles')
                    .select('id, email, first_name, last_name, company_name, is_admin')
                    .eq('id', targetUserId)
                    .single();
                
                if (!error && user) {
                    performedBy = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Onbekende gebruiker';
                    isAdminAction = user.is_admin === true;
                    
                    enhancedMetadata.performed_by = performedBy;
                    enhancedMetadata.performed_by_email = user.email;
                    enhancedMetadata.performed_by_company = user.company_name;
                    enhancedMetadata.is_admin_action = isAdminAction;
                }
            } catch (error) {
                console.log('Could not fetch user info for logging:', error.message);
                enhancedMetadata.performed_by = 'Onbekende gebruiker';
                enhancedMetadata.is_admin_action = false;
            }
        } else {
            enhancedMetadata.performed_by = 'Systeem';
            enhancedMetadata.is_admin_action = false;
        }
        
        // Add source information
        enhancedMetadata.action_source = source;
        enhancedMetadata.timestamp = new Date().toISOString();
        
        return enhancedMetadata;
    }

    /**
     * Get system logs with filtering and pagination
     * @param {Object} options - Query options
     * @param {number} options.limit - Number of logs to return (default: 50)
     * @param {number} options.offset - Offset for pagination (default: 0)
     * @param {string} options.type - Filter by log type
     * @param {string} options.category - Filter by category
     * @param {string} options.severity - Filter by severity
     * @param {string} options.userId - Filter by user ID
     * @param {Date} options.startDate - Start date filter
     * @param {Date} options.endDate - End date filter
     * @returns {Promise<Object>} Logs and pagination info
     */
    static async getLogs(options = {}) {
        try {
            const {
                limit = 50,
                offset = 0,
                type = null,
                category = null,
                severity = null,
                userId = null,
                startDate = null,
                endDate = null
            } = options;

            const { data, error } = await supabaseAdmin.rpc('get_system_logs', {
                p_limit: limit,
                p_offset: offset,
                p_log_type: type,
                p_category: category,
                p_severity: severity,
                p_user_id: userId,
                p_start_date: startDate,
                p_end_date: endDate
            });

            if (error) {
                console.error('Error fetching system logs:', error);
                throw new Error('Failed to fetch system logs');
            }

            return {
                logs: data || [],
                total: data && data.length > 0 ? data[0].total_count : 0,
                limit,
                offset
            };
        } catch (error) {
            console.error('SystemLogService.getLogs error:', error);
            throw error;
        }
    }

    // Convenience methods for common log types

    /**
     * Log user authentication events
     */
    static async logAuth(userId, action, details = null, ipAddress = null, userAgent = null) {
        return this.log({
            type: 'info',
            category: 'authentication',
            title: `User ${action}`,
            message: `User ${action} successfully`,
            details,
            source: 'Auth System',
            userId,
            ipAddress,
            userAgent,
            severity: 'medium'
        });
    }

    /**
     * Log billing events
     */
    static async logBilling(type, title, message, details = null, userId = null, adminId = null, metadata = {}) {
        return this.log({
            type,
            category: 'billing',
            title,
            message,
            details,
            source: 'Billing System',
            userId,
            adminId,
            metadata,
            severity: type === 'error' ? 'high' : 'medium'
        });
    }

    /**
     * Log user management events
     */
    static async logUserManagement(action, userId, details = null, adminId = null) {
        return this.log({
            type: 'info',
            category: 'user_management',
            title: `User ${action}`,
            message: `User ${action} successfully`,
            details,
            source: 'Admin Panel',
            userId,
            adminId,
            severity: 'medium'
        });
    }

    /**
     * Log system events
     */
    static async logSystem(type, title, message, details = null, metadata = {}, userId = null) {
        return this.log({
            type,
            category: 'system',
            title,
            message,
            details,
            source: 'System',
            userId,
            metadata,
            severity: type === 'error' ? 'high' : 'medium'
        });
    }

    /**
     * Log payment events
     */
    static async logPayment(type, title, message, details = null, userId = null, metadata = {}) {
        return this.log({
            type,
            category: 'payment',
            title,
            message,
            details,
            source: 'Payment System',
            userId,
            metadata,
            severity: type === 'error' ? 'high' : 'medium'
        });
    }

    /**
     * Log cron job events
     */
    static async logCron(type, jobName, message, details = null, metadata = {}) {
        return this.log({
            type,
            category: 'cron',
            title: `Cron Job: ${jobName}`,
            message,
            details,
            source: 'Cron System',
            metadata,
            severity: type === 'error' ? 'high' : 'low'
        });
    }

    /**
     * Log API events
     */
    static async logAPI(type, endpoint, message, details = null, userId = null, ipAddress = null, userAgent = null) {
        return this.log({
            type,
            category: 'api',
            title: `API ${endpoint}`,
            message,
            details,
            source: 'API Server',
            userId,
            ipAddress,
            userAgent,
            severity: type === 'error' ? 'high' : 'low'
        });
    }

    /**
     * Log admin actions
     */
    static async logAdmin(action, details = null, adminId = null, userId = null, metadata = {}) {
        return this.log({
            type: 'info',
            category: 'admin',
            title: `Admin ${action}`,
            message: `Admin performed ${action}`,
            details,
            source: 'Admin Panel',
            adminId,
            userId,
            metadata,
            severity: 'medium'
        });
    }
}

module.exports = SystemLogService;
