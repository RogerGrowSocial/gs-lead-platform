# Campaign Goal & Location Targeting Fixes

**Date:** December 5, 2025  
**Status:** ✅ Implemented

---

## Problems Fixed

### 1. ❌ Missing Campaign Goal (Marketingdoel)

**Problem:** New campaigns in Google Ads had no marketing goal set, showing "Geen marketingdoel geselecteerd".

**Solution:** Added `campaign_goal: 'LEADS'` to campaign creation payload.

**Implementation:**
- Default: `'LEADS'` (for lead generation campaigns)
- Configurable via `GOOGLE_ADS_CAMPAIGN_GOAL` environment variable
- Gracefully handles API versions that don't support this field

**Code Location:** `services/googleAdsCampaignBuilderService.js::createCompleteCampaign()`

---

### 2. ❌ Wrong Location Targeting (Friesland → Lapland, Finland)

**Problem:** Campaigns showed "Rovaniemi, Lapland, Finland" instead of "Friesland" in Google Ads UI.

**Root Cause:** Location codes in `REGION_TO_LOCATION_CODES` are incorrect or not verified.

**Solution:**
1. **Added validation** for location codes (numeric format check)
2. **Enhanced error messages** to indicate only Dutch provinces are supported
3. **Added documentation** explaining the location code mapping
4. **Created troubleshooting guide** for location issues

**Important Notes:**
- ⚠️ **Current implementation ONLY supports Dutch provinces**
- Location codes must be verified against Google Ads Geo Target Constants API
- For international expansion, extend `REGION_TO_LOCATION_CODES` with verified codes

---

## Implementation Details

### Campaign Goal

```javascript
// In createCompleteCampaign()
const campaignPayload = {
  // ... other fields
  campaign_goal: process.env.GOOGLE_ADS_CAMPAIGN_GOAL || 'LEADS'
};
```

**Environment Variable:**
```bash
# Optional: Override default campaign goal
GOOGLE_ADS_CAMPAIGN_GOAL=LEADS  # Options: LEADS, SALES, BRAND_AWARENESS_AND_REACH, etc.
```

### Location Targeting

**Current Location Codes:**
```javascript
static REGION_TO_LOCATION_CODES = {
  'friesland': ['1005658'], // ⚠️ VERIFY THIS CODE - may be incorrect
  // ... other provinces
};
```

**Validation Added:**
- Numeric format check for location codes
- Error messages indicate only Dutch provinces supported
- Logging of location codes being used

---

## Verification Steps

### 1. Verify Campaign Goal

After creating a campaign:
1. Go to Google Ads UI
2. Open the campaign settings
3. Check "Marketingdoel" (Campaign Goal)
4. Should show "Leads" (Leads)

### 2. Verify Location Targeting

After creating a campaign:
1. Go to Google Ads UI
2. Open the campaign settings
3. Check "Locaties" (Locations)
4. Should show the correct Dutch province (e.g., "Friesland")
5. **If wrong location appears:**
   - Check the location code in `REGION_TO_LOCATION_CODES`
   - Verify using Google Ads Geo Target Constants API
   - Update the code if incorrect

---

## Troubleshooting

### Problem: Campaign Goal Still Missing

**Possible Causes:**
1. API version doesn't support `campaign_goal` field
2. Field name is different in your API version

**Solution:**
- Check Google Ads API version
- Verify `campaign_goal` is supported
- If not supported, may need to use `CampaignConversionGoal` resource instead

### Problem: Wrong Location Still Appearing

**Possible Causes:**
1. Location code is incorrect
2. Location code maps to wrong location in Google Ads

**Solution:**
1. **Find correct location code:**
   - Use Google Ads Geo Target Constants API
   - Search for "Friesland, Netherlands" or "Friesland province"
   - Get the correct `geo_target_constant` ID

2. **Update the code:**
   ```javascript
   'friesland': ['CORRECT_CODE_HERE'], // Replace with verified code
   ```

3. **Test:**
   - Create a test campaign
   - Verify location in Google Ads UI
   - Update if still incorrect

---

## Next Steps

### For Location Codes

1. **Verify all location codes** using Google Ads Geo Target Constants API
2. **Update `REGION_TO_LOCATION_CODES`** with verified codes
3. **Test each province** to ensure correct targeting
4. **Document verified codes** in code comments

### For International Expansion

1. **Extend `REGION_TO_LOCATION_CODES`** with other countries
2. **Add country validation** to ensure only supported countries
3. **Update `getLocationCodes()`** to handle country-specific mappings
4. **Test thoroughly** with actual campaigns

---

## Related Files

- `services/googleAdsCampaignBuilderService.js` - Campaign creation and location targeting
- `docs/LOCATION_TARGETING_NETHERLANDS_ONLY.md` - Location targeting documentation
- `services/googleAdsCampaignBuilderService.js::REGION_TO_LOCATION_CODES` - Location code mapping

---

## Environment Variables

```bash
# Campaign goal (optional, defaults to LEADS)
GOOGLE_ADS_CAMPAIGN_GOAL=LEADS

# Location targeting (already configured in code)
# No env vars needed - codes are in REGION_TO_LOCATION_CODES
```

---

## Summary

✅ **Campaign Goal:** Added `campaign_goal: 'LEADS'` to campaign creation  
✅ **Location Validation:** Added code format validation and better error messages  
✅ **Documentation:** Created troubleshooting guide for location issues  
⚠️ **Location Codes:** Still need verification - codes may be incorrect for some provinces

**Action Required:** Verify and update location codes in `REGION_TO_LOCATION_CODES` using Google Ads Geo Target Constants API.

