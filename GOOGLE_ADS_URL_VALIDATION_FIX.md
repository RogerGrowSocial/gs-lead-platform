# Google Ads Campaign Creation - URL Validation Fix

## The Problem

Google Ads campaign creation was failing with error:
```
POLICY_FINDING: DESTINATION_NOT_WORKING
"The resource has been disapproved since the policy summary includes policy topics of type PROHIBITED."
```

This means Google Ads tried to access the destination URL and it failed (404, 500, or policy violation).

## Root Causes

1. **Invalid or inaccessible landing page URLs** - URLs might not be accessible when Google Ads checks them
2. **No URL validation** - URLs were sent to Google Ads without validation
3. **Poor error messages** - Generic errors didn't explain the URL issue

## The Fixes

### 1. URL Validation Function ✅
Added `validateUrl()` method to check URL format before sending to Google Ads:
```javascript
static async validateUrl(url) {
  // Validates URL format, protocol, and hostname
  // Returns true if valid, false otherwise
}
```

### 2. URL Validation in RSA Creation ✅
- Validates all URLs before creating Responsive Search Ads
- Filters out invalid URLs
- Falls back to `https://growsocialmedia.nl` if no valid URLs found
- Logs warnings for invalid URLs

### 3. URL Validation Before Campaign Creation ✅
- Validates landing page URL before generating RSA content
- Uses fallback URL if validation fails
- Logs warnings when fallback is used

### 4. Better Error Handling ✅
- Detects `DESTINATION_NOT_WORKING` policy violations
- Provides user-friendly error messages in Dutch
- Includes suggestions for fixing the issue
- Logs detailed error information to `campaign_logs` table

### 5. URL Format Validation in API Route ✅
- Validates URL format when constructing landing page URL
- Falls back to main site URL if format is invalid

## Code Changes

### `services/googleAdsCampaignBuilderService.js`
1. Added `validateUrl()` static method
2. Updated `createResponsiveSearchAd()` to validate URLs
3. Updated `createCompleteCampaign()` to validate landing page URL before creating ads
4. Enhanced error handling for policy violations

### `routes/api.js`
1. Added URL format validation when constructing landing page URL
2. Improved error messages for policy violations
3. Better user-friendly error messages in Dutch

## Error Messages

**Before:**
```
Failed to create Google Ads campaign
```

**After:**
```
De landing page URL is niet toegankelijk of wordt door Google Ads afgewezen. 
Controleer of de URL "https://..." publiekelijk toegankelijk is en een geldige HTTP 200 response geeft.
```

## Prevention

**Rules for landing page URLs:**
1. ✅ Must be valid URL format (http:// or https://)
2. ✅ Must be publicly accessible (no authentication required)
3. ✅ Must return HTTP 200 (not 404, 500, etc.)
4. ✅ Must not violate Google Ads policies
5. ✅ Should be tested before campaign creation

**Fallback behavior:**
- If landing page URL is invalid → uses `https://growsocialmedia.nl`
- If no valid URLs found → uses `https://growsocialmedia.nl`
- Logs warnings when fallback is used

## Testing

To test the fix:
1. Try creating a campaign with an invalid URL
2. Check logs for validation warnings
3. Verify fallback URL is used
4. Check error messages are user-friendly

## Next Steps

1. ✅ URL validation implemented
2. ✅ Error handling improved
3. ⚠️ Consider adding HTTP accessibility check (HEAD request) before sending to Google Ads
4. ⚠️ Consider adding retry logic for newly created landing pages (might need time to be accessible)
