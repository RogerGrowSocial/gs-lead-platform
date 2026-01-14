const { supabaseAdmin } = require('../config/supabase');

/**
 * Parse user agent string to extract browser, OS, and device info
 * @param {string} userAgent - User agent string
 * @returns {Object} Parsed user agent info
 */
function parseUserAgent(userAgent) {
  if (!userAgent) {
    return {
      browser: 'Unknown',
      os: 'Unknown',
      device: 'Unknown',
      userAgent: ''
    };
  }

  const ua = userAgent.toLowerCase();
  
  // Browser detection
  let browser = 'Unknown';
  if (ua.includes('chrome') && !ua.includes('edg')) {
    browser = 'Chrome';
  } else if (ua.includes('firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'Safari';
  } else if (ua.includes('edg')) {
    browser = 'Edge';
  } else if (ua.includes('opera') || ua.includes('opr')) {
    browser = 'Opera';
  }

  // OS detection
  let os = 'Unknown';
  if (ua.includes('windows')) {
    os = 'Windows';
  } else if (ua.includes('mac os') || ua.includes('macos') || ua.includes('macintosh')) {
    os = 'macOS';
  } else if (ua.includes('linux')) {
    os = 'Linux';
  } else if (ua.includes('android')) {
    os = 'Android';
  } else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
    os = 'iOS';
  }

  // Device detection
  let device = 'Desktop';
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    device = 'Mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    device = 'Tablet';
  }

  return {
    browser,
    os,
    device,
    userAgent
  };
}

/**
 * Get location from IP address (simplified - can be enhanced with IP geolocation API)
 * @param {string} ipAddress - IP address
 * @returns {Promise<Object>} Location info
 */
async function getLocationFromIP(ipAddress) {
  // For now, return a simplified location
  // In production, you could use services like:
  // - ipapi.co (free tier available)
  // - ip-api.com (free tier available)
  // - maxmind GeoIP2
  
  // Skip private/local IPs
  if (!ipAddress || 
      ipAddress.startsWith('127.') || 
      ipAddress.startsWith('192.168.') || 
      ipAddress.startsWith('10.') ||
      ipAddress.startsWith('172.') ||
      ipAddress === '::1') {
    return {
      location: 'Local',
      city: null,
      country: null
    };
  }

  // TODO: Implement real IP geolocation
  // For now, return unknown for non-local IPs
  return {
    location: 'Unknown',
    city: null,
    country: null
  };
}

/**
 * Get client IP address from request
 * @param {Object} req - Express request object
 * @returns {string} IP address
 */
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.ip ||
         'Unknown';
}

/**
 * Log a login attempt to the database
 * @param {Object} params - Login history parameters
 * @param {string} params.userId - User ID
 * @param {Object} params.req - Express request object
 * @param {string} params.status - Login status ('success', 'failed', 'blocked')
 * @param {string} params.loginMethod - Login method ('password', 'oauth', '2fa', 'session')
 * @returns {Promise<boolean>} Success status
 */
async function logLoginHistory({ userId, req, status = 'success', loginMethod = 'password' }) {
  try {
    const ipAddress = getClientIP(req);
    const userAgent = req.headers['user-agent'] || '';
    const parsedUA = parseUserAgent(userAgent);
    const locationInfo = await getLocationFromIP(ipAddress);

    // Format device string for display
    const deviceString = `${parsedUA.browser} op ${parsedUA.os}`;
    const locationString = !locationInfo.location
      ? 'Onbekend'
      : (locationInfo.location.toLowerCase() === 'local'
          ? 'Lokaal netwerk'
          : (locationInfo.location.toLowerCase() === 'unknown'
              ? 'Onbekend'
              : locationInfo.location));

    // OPTIMIZED: Skip new device check during login to speed up login flow
    // This check can be done asynchronously later if needed
    // For now, we'll skip it to make login instant
    let isNewDevice = false;
    // Note: New device detection is disabled for faster login
    // Can be re-enabled later with async processing if needed

    const { error } = await supabaseAdmin
      .from('login_history')
      .insert({
        user_id: userId,
        ip_address: ipAddress === 'Unknown' ? null : ipAddress,
        user_agent: userAgent,
        device: parsedUA.device,
        browser: parsedUA.browser,
        os: parsedUA.os,
        location: locationString,
        city: locationInfo.city,
        country: locationInfo.country,
        status,
        login_method: loginMethod
      });

    if (error) {
      console.error('Error logging login history:', error);
      return false;
    }

    console.log(`✅ Login history logged for user ${userId}: ${status} from ${ipAddress}`);

    // Send new device notification if this is a new device
    if (isNewDevice && status === 'success') {
      try {
        const NotificationService = require('../services/notificationService');
        const notificationService = new NotificationService();
        
        await notificationService.sendLoginFromNewDevice(userId, {
          login_time: new Date().toLocaleString('nl-NL'),
          location: locationString,
          device: `${parsedUA.os} (${parsedUA.device})`,
          browser: parsedUA.browser
        });
      } catch (notifError) {
        console.error('Error sending new device notification:', notifError);
        // Don't throw error, login was successful
      }
    }

    return true;
  } catch (err) {
    console.error('Error in logLoginHistory:', err);
    return false;
  }
}

module.exports = {
  parseUserAgent,
  getLocationFromIP,
  getClientIP,
  logLoginHistory
};

