# HTTPS Development Setup

## Problem
The browser shows "Betaalmethode automatisch invullen is uitgezet omdat dit formulier geen beveiligde verbinding heeft" because the application runs on HTTP instead of HTTPS.

## Solutions

### Option 1: HTTPS Development Server (Recommended)

1. **Generate SSL certificates:**
   ```bash
   ./setup-https.sh
   ```

2. **Start HTTPS development server:**
   ```bash
   npm run dev:https
   ```

3. **Visit the application:**
   ```
   https://localhost:3000
   ```

4. **Accept the browser security warning** for the self-signed certificate

### Option 2: Use ngrok (Alternative)

1. **Install ngrok:**
   ```bash
   npm install -g ngrok
   ```

2. **Start your normal HTTP server:**
   ```bash
   npm run dev
   ```

3. **Create HTTPS tunnel:**
   ```bash
   ngrok http 3000
   ```

4. **Use the HTTPS URL** provided by ngrok

### Option 3: Browser Settings (Temporary)

For Chrome/Edge:
1. Go to `chrome://flags/#autofill-credit-card-upload`
2. Enable "Allow credit card upload forms to be filled on non-secure origins"
3. Restart browser

**Note:** This is not recommended for production use.

## Why HTTPS is Required

- **Security**: Browsers require HTTPS for autofill to protect sensitive payment information
- **PCI Compliance**: Payment forms must use secure connections
- **User Trust**: HTTPS shows the lock icon, indicating a secure connection
- **Modern Standards**: Most modern web features require HTTPS

## Production Deployment

In production, ensure your hosting provider provides:
- Valid SSL certificate
- HTTPS redirect from HTTP
- Proper security headers

## Files Modified

- `server-https.js` - HTTPS development server
- `setup-https.sh` - SSL certificate generation script
- `package.json` - Added `dev:https` script
- `views/layouts/dashboard.ejs` - Added referrer meta tag
- `views/partials/payment-method-toggle.ejs` - Added autocomplete attributes
