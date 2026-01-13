# Location Targeting - Netherlands Only

**Status:** ✅ Current Implementation  
**Date:** December 5, 2025

---

## ⚠️ IMPORTANT: Netherlands Only

**This system currently ONLY supports Dutch provinces for location targeting.**

If you see incorrect locations in Google Ads (e.g., "Rovaniemi, Lapland, Finland" instead of "Friesland"), this indicates:

1. **The location codes are incorrect** - The mapping in `REGION_TO_LOCATION_CODES` needs to be verified
2. **International expansion is not yet supported** - The system is designed for Dutch provinces only

---

## Supported Regions

The following Dutch provinces are supported:

- ✅ Noord-Holland
- ✅ Zuid-Holland
- ✅ Noord-Brabant
- ✅ Gelderland
- ✅ Utrecht
- ✅ Friesland
- ✅ Overijssel
- ✅ Groningen
- ✅ Drenthe
- ✅ Flevoland
- ✅ Limburg
- ✅ Zeeland

---

## Location Code Mapping

Location codes are stored in `GoogleAdsCampaignBuilderService.REGION_TO_LOCATION_CODES`.

**Current Implementation:**
```javascript
static REGION_TO_LOCATION_CODES = {
  'noord-holland': ['1005653'],
  'zuid-holland': ['1005654'],
  'noord-brabant': ['1005655'],
  'gelderland': ['1005656'],
  'utrecht': ['1005657'],
  'friesland': ['1005658'],
  'overijssel': ['1005659'],
  'groningen': ['1005660'],
  'drenthe': ['1005661'],
  'flevoland': ['1005662'],
  'limburg': ['1005663'],
  'zeeland': ['1005664']
};
```

---

## Verifying Location Codes

If you see incorrect locations in Google Ads UI:

1. **Check the location code** in the campaign settings
2. **Verify against Google Ads Geo Target Constants API:**
   - https://developers.google.com/google-ads/api/data/geotargets
   - Use the Geo Target Constants API to find the correct location IDs

3. **Update the mapping** in `services/googleAdsCampaignBuilderService.js`

---

## International Expansion

**⚠️ For international expansion, the following must be done:**

1. **Extend `REGION_TO_LOCATION_CODES`** with location codes for other countries
2. **Add country validation** to ensure only supported countries are used
3. **Update `getLocationCodes()`** to handle country-specific mappings
4. **Test thoroughly** with actual Google Ads campaigns to verify location targeting

### Example for International Expansion:

```javascript
static REGION_TO_LOCATION_CODES = {
  // Netherlands (current)
  'noord-holland': ['1005653'],
  'friesland': ['1005658'],
  // ... other Dutch provinces
  
  // Belgium (example - needs verification)
  'vlaanderen': ['geoTargetConstants/XXXXX'], // Verify code
  'brussel': ['geoTargetConstants/XXXXX'], // Verify code
  
  // Germany (example - needs verification)
  'nordrhein-westfalen': ['geoTargetConstants/XXXXX'], // Verify code
};
```

---

## Troubleshooting

### Problem: Wrong location shown in Google Ads UI

**Example:** "Rovaniemi, Lapland, Finland" instead of "Friesland"

**Solution:**
1. Check the location code in `REGION_TO_LOCATION_CODES` for the region
2. Verify the code using Google Ads Geo Target Constants API
3. Update the code if incorrect
4. Re-create the campaign or update location targeting

### Problem: "No location codes resolved for region"

**Solution:**
1. Check if the region name matches exactly (case-insensitive)
2. Verify the region is in `REGION_TO_LOCATION_CODES`
3. For international regions, extend the mapping (see International Expansion above)

---

## Testing

After updating location codes:

1. **Create a test campaign** with the updated location codes
2. **Verify in Google Ads UI** that the correct location is shown
3. **Check campaign settings** to ensure location targeting is correct
4. **Test with actual searches** to verify targeting works

---

## Related Files

- `services/googleAdsCampaignBuilderService.js` - Location code mapping and campaign creation
- `services/googleAdsCampaignBuilderService.js::addLocationTargeting()` - Location targeting implementation
- `services/googleAdsCampaignBuilderService.js::inspectCampaignBasics()` - Location verification

---

## Notes

- Location codes are Google Ads `geo_target_constant` IDs
- Codes must be verified against Google Ads Geo Target Constants API
- The system uses province-level targeting (not city-level)
- Negative location targeting excludes country-level Netherlands to ensure province-only targeting

