# Google Ads URL Accessibility Check - Complete Fix

## The Problem

Google Ads was rejecting campaigns with error:
```
POLICY_FINDING: DESTINATION_NOT_WORKING
"The resource has been disapproved since the policy summary includes policy topics of type PROHIBITED."
```

**Root Cause**: Google Ads checks if destination URLs are actually accessible. If a URL:
- Returns 404, 500, or other error status
- Times out
- Is not publicly accessible
- Has network issues

Google Ads will reject the ad with `DESTINATION_NOT_WORKING`.

## The Complete Fix

### 1. HTTP Accessibility Check ✅

Added real HTTP HEAD request to verify URLs are accessible before sending to Google Ads:

```javascript
static async validateUrl(url) {
  // 1. Validates URL format
  // 2. Makes HTTP HEAD request to check accessibility
  // 3. Accepts 200-399 status codes
  // 4. 5 second timeout
  // 5. Returns true only if URL is accessible
}
```

### 2. Pre-Validation Before RSA Creation ✅

- Validates landing page URL **before** creating Responsive Search Ads
- Uses fallback URL (`https://growsocialmedia.nl`) if validation fails
- Logs warnings when fallback is used

### 3. URL Validation in RSA Creation ✅

- Validates all `finalUrls` before creating ad
- Filters out inaccessible URLs
- Ensures at least one valid URL exists

### 4. Better Error Messages ✅

- Detects `DESTINATION_NOT_WORKING` policy violations
- Provides user-friendly Dutch error messages
- Suggests solutions

## How It Works

### Step 1: Landing Page URL Construction
```javascript
// In routes/api.js
finalLandingPageUrl = `${platformUrl}${landingPage.path}`;
// Example: https://growsocialmedia.nl/timmerman-gelderland-offerte
```

### Step 2: Pre-Validation (Before Creating Ads)
```javascript
// In createCompleteCampaign()
const isUrlAccessible = await this.validateUrl(landingPageUrl);
if (!isUrlAccessible) {
  // Use fallback
  validatedLandingPageUrl = 'https://growsocialmedia.nl';
}
```

### Step 3: Final URL Validation (In RSA Creation)
```javascript
// In createResponsiveSearchAd()
for (const url of finalUrls) {
  const isValid = await this.validateUrl(url);
  if (isValid) {
    validatedUrls.push(url);
  }
}
```

## Validation Process

1. **Format Check**: Validates URL structure (protocol, hostname)
2. **HTTP HEAD Request**: Checks if URL is accessible
   - Timeout: 5 seconds
   - Method: HEAD (no content download)
   - Accepts: 200-399 status codes
3. **Fallback**: Uses `https://growsocialmedia.nl` if validation fails

## Logging

**Success:**
```
✅ Landing page URL is accessible and valid: https://growsocialmedia.nl/...
✅ URL validated and accessible: https://growsocialmedia.nl/...
```

**Failure:**
```
❌ Landing page URL is NOT accessible: https://growsocialmedia.nl/...
⚠️ URL is not accessible: https://... - Error message
⚠️ Google Ads will reject this URL. Using fallback: https://growsocialmedia.nl
```

## Testing

To test the fix:

1. **Test with invalid URL:**
   - Create campaign with URL that doesn't exist
   - Should see warning and fallback to main site

2. **Test with inaccessible URL:**
   - Create campaign with URL that returns 404/500
   - Should see warning and fallback

3. **Test with valid URL:**
   - Create campaign with accessible landing page
   - Should see success logs

## Prevention

**Rules:**
1. ✅ Always validate URLs before sending to Google Ads
2. ✅ Use HTTP HEAD request to check accessibility
3. ✅ Have fallback URL ready (`https://growsocialmedia.nl`)
4. ✅ Log all validation results for debugging
5. ✅ Provide clear error messages to users

**Best Practices:**
- Test landing pages before campaign creation
- Ensure landing pages are published and accessible
- Use HTTPS URLs
- Avoid URLs that require authentication

## Files Modified

1. `services/googleAdsCampaignBuilderService.js`
   - Added `validateUrl()` with HTTP accessibility check
   - Updated `createCompleteCampaign()` to validate before creating ads
   - Updated `createResponsiveSearchAd()` to validate all final URLs
   - Enhanced error handling for policy violations

2. `routes/api.js`
   - Added URL format validation
   - Improved logging

## Next Steps

1. ✅ HTTP accessibility check implemented
2. ✅ Pre-validation before ad creation
3. ✅ Fallback URL logic
4. ✅ Better error messages
5. ⚠️ Consider adding retry logic for newly created landing pages (might need time to be accessible)
6. ⚠️ Consider caching URL validation results (to avoid repeated checks)
