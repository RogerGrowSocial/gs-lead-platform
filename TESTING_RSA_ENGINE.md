# Testing RSA Asset Engine

This guide explains how to test the new RSA Asset Engine and Quality Gate system.

## Quick Start

### 1. Test the Preview Script

Generate a preview of RSA assets for manual review:

```bash
node scripts/generateRSAPreview.js glaszetter Friesland "glaszetter Friesland" "glaszetter offerte" "glaszetter prijs"
```

This will output:
- 15 headlines (all <= 30 chars)
- 4 descriptions (all <= 90 chars)
- Sitelinks, callouts, structured snippets
- Quality score breakdown

### 2. Run Unit Tests

Test the core functionality:

```bash
# Test RSA Asset Engine
node services/rsaAssetEngine.test.js

# Test Quality Gate
node services/qualityGate.test.js
```

### 3. Test Integration

Test with the actual campaign builder (requires Google Ads API setup):

```bash
# Set environment variable to use new engine
export GOOGLE_ADS_USE_RSA_ENGINE=true

# Then create a campaign (via your normal campaign creation flow)
```

## Testing Scenarios

### Scenario 1: Basic Test (Glaszetter Friesland)

```bash
node scripts/generateRSAPreview.js glaszetter Friesland "glaszetter Friesland" "glaszetter offerte"
```

**Expected:**
- ✅ Exactly 15 headlines
- ✅ All headlines <= 30 chars
- ✅ At least 6 headlines contain "glaszetter" + "Friesland"
- ✅ Exactly 4 descriptions
- ✅ All descriptions <= 90 chars
- ✅ Quality score >= 80

### Scenario 2: Long Service Name (Installatiebedrijven)

```bash
node scripts/generateRSAPreview.js installatiebedrijven Noord-Brabant "installatiebedrijven Noord-Brabant" "installatiebedrijven offerte"
```

**Expected:**
- ✅ Headlines still fit within 30 chars (may use abbreviations)
- ✅ Quality score still >= 80

### Scenario 3: Multiple Keywords

```bash
node scripts/generateRSAPreview.js schilder Amsterdam "schilder Amsterdam" "schilder offerte" "schilder prijs" "schilder kosten" "goedkope schilder Amsterdam"
```

**Expected:**
- ✅ Keyword coverage score >= 75
- ✅ Multiple keyword variants appear in headlines

## Quality Gate Criteria

The quality gate **PASSES** if:

1. **Total Score >= 80**
2. **Keyword Coverage Score >= 75**
   - At least 6/15 headlines contain primary keyword or "service + location"
   - At least 2 additional keyword variants appear
3. **Diversity Score >= 75**
   - Max 2 headlines start with same first word
   - At least 3 benefit/USP headlines
   - At least 2 price/offer headlines
   - At least 2 CTA headlines
   - At least 2 location-specific headlines
   - Descriptions have different angles
4. **No Errors**
   - Length errors = 0
   - Duplicate errors = 0
   - Near-duplicate errors = 0

## Manual Verification Checklist

When reviewing generated assets:

- [ ] Headlines: Exactly 15, all <= 30 chars
- [ ] Descriptions: Exactly 4, all <= 90 chars
- [ ] No exact duplicates (case-insensitive)
- [ ] No near-duplicates (similarity < 0.7)
- [ ] At least 6 headlines mention service + location
- [ ] Headlines are diverse (different first words, different angles)
- [ ] Descriptions cover different angles (speed, price, quality, process)
- [ ] All assets are policy-safe (no invented ratings, no misleading claims)

## Integration Testing

### Enable New Engine

Set environment variable:

```bash
export GOOGLE_ADS_USE_RSA_ENGINE=true
```

Or in `.env`:

```
GOOGLE_ADS_USE_RSA_ENGINE=true
```

### Disable New Engine (Fallback to Legacy)

```bash
export GOOGLE_ADS_USE_RSA_ENGINE=false
```

### Check Logs

When creating a campaign, check logs for:

```
✅ RSA assets generated with Quality Gate
  totalScore: 85
  keywordCoverage: 82
  diversity: 88
  iterations: 1
```

If quality gate fails:

```
⚠️ RSA Asset Engine did not pass quality gate, falling back to legacy method
```

## Troubleshooting

### Issue: "Cannot find module '../utils/logger'"

**Solution:** Make sure you're running from the project root directory.

### Issue: Quality Gate Always Fails

**Check:**
1. Are headlines exactly 15?
2. Are all headlines <= 30 chars?
3. Are descriptions exactly 4?
4. Are all descriptions <= 90 chars?
5. Do at least 6 headlines contain service + location?

**Fix:** The engine auto-iterates up to 5 times. If it still fails, check the error messages in the output.

### Issue: Headlines Too Similar

**Solution:** The similarity threshold is 0.7 (Jaccard). If headlines are too similar, the engine will reject them. Check the `nearDuplicateErrors` in the quality score.

## Example Output

See `examples/rsaAssetExample.json` for a complete example of input and expected output.

## Next Steps

1. Run the preview script with your test cases
2. Verify quality scores meet thresholds
3. Enable the engine in production (set `GOOGLE_ADS_USE_RSA_ENGINE=true`)
4. Monitor campaign creation logs for quality gate results
5. Compare "Ad Strength" in Google Ads UI (should be "Goed" or "Uitstekend")
