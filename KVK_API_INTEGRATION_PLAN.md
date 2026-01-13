# KVK API Integration Plan

## Executive Summary

This document outlines the plan for integrating the KVK (Kamer van Koophandel / Chamber of Commerce) API into the risk assessment service. The integration will enable real-time business verification during signup and enhance risk assessment accuracy using official KVK data.

**Status**: Ready for implementation  
**Date**: January 2025  
**Priority**: High

---

## 1. Current State Analysis

### 1.1 Existing Infrastructure

✅ **Already in Place:**
- Risk assessment service (`userRiskAssessmentService.js`) is functional
- `coc_number` (KVK number) field exists in `profiles` table
- KVK number is collected during onboarding and profile updates
- Risk assessment triggers automatically on profile updates (including `coc_number` changes)
- Frontend validation for KVK numbers (8 digits for NL)
- Placeholders/comments indicate KVK API integration was planned

❌ **Missing:**
- KVK API service/client implementation
- KVK API key configuration
- Integration of KVK data into risk assessment prompts
- KVK verification scoring in risk assessment
- Company age/founding date from KVK (currently disabled)
- Data consistency checks between user input and KVK records

### 1.2 Code Locations

**Key Files:**
- `services/userRiskAssessmentService.js` - Main risk assessment service
- `services/riskAssessmentWorker.js` - Background worker for risk assessments
- `routes/api.js` - API endpoints (onboarding, profile updates)
- `routes/admin.js` - Admin endpoints (manual risk assessment trigger)
- `supabase/migrations/20250113000002_add_risk_assessment_trigger.sql` - Database triggers

**Integration Points:**
1. **Signup/Onboarding** (`routes/api.js:6133`): When KVK number is provided
2. **Profile Updates** (`routes/api.js:3234`): When KVK number is updated
3. **Risk Assessment** (`services/userRiskAssessmentService.js:200`): During risk evaluation

---

## 2. KVK API Overview

### 2.1 Available APIs

The KVK provides multiple APIs for accessing Business Register data:

1. **Zoeken API (Search API)**
   - Search companies by name, address, or other criteria
   - Returns list of matching companies with KVK numbers
   - Use case: Find KVK number when only company name is known

2. **Basisprofiel API (Basic Profile API)** ⭐ **PRIMARY**
   - Retrieve company information using KVK number
   - Returns: company name, address, status, founding date, etc.
   - Use case: Verify business details during signup and risk assessment

3. **Vestigingsprofiel API (Branch Profile API)**
   - Get information about specific company establishments
   - Use case: Verify branch locations (if needed)

4. **Naamgeving API (Naming API)**
   - Get trade names associated with a company
   - Use case: Verify alternative company names

### 2.2 API Access Requirements

- **Subscription**: €6.20/month + usage fees per API call
- **API Key**: Required for authentication (obtain from [KVK Developer Portal](https://developers.kvk.nl/))
- **Test Environment**: Available for development/testing
- **Documentation**: [KVK Developer Portal](https://developers.kvk.nl/documentation)

### 2.3 Expected Data from KVK API

From **Basisprofiel API** (using KVK number):
- ✅ Official company name
- ✅ Registered address (street, postal code, city)
- ✅ Company status (active, dissolved, etc.)
- ✅ Founding date (oprichtingsdatum)
- ✅ Legal form (rechtsvorm)
- ✅ Main activity (hoofdactiviteit)
- ✅ Number of employees (if available)
- ✅ Associated VAT number (BTW nummer)

---

## 3. Implementation Plan

### Phase 1: KVK API Service Setup (Foundation)

#### 1.1 Create KVK API Service
**File**: `services/kvkApiService.js`

**Responsibilities:**
- Handle API authentication (API key)
- Make HTTP requests to KVK API endpoints
- Parse and normalize API responses
- Handle errors and rate limiting
- Cache responses (optional, for cost optimization)

**Key Methods:**
```javascript
class KvkApiService {
  // Get company profile by KVK number
  static async getCompanyProfile(kvkNumber)
  
  // Search companies by name
  static async searchCompanies(companyName, city = null)
  
  // Verify KVK number exists and is valid
  static async verifyKvkNumber(kvkNumber)
  
  // Get company age/founding date
  static async getCompanyAge(kvkNumber)
}
```

**Configuration:**
- Environment variable: `KVK_API_KEY`
- Base URL: `https://api.kvk.nl/api/v2/` (production) or test URL
- Test mode flag: `KVK_API_TEST_MODE=true` (optional)

#### 1.2 Environment Configuration
**File**: `.env`

Add:
```env
# KVK API Configuration
KVK_API_KEY=your-api-key-here
KVK_API_TEST_MODE=false  # Set to true for testing
```

**Documentation**: Create `KVK_API_SETUP.md` (similar to `OPENAI_SETUP.md`)

---

### Phase 2: Signup Verification Integration

#### 2.1 Onboarding Flow Enhancement
**File**: `routes/api.js` (onboarding endpoint)

**Changes:**
1. When user provides KVK number during onboarding:
   - Call KVK API to verify the number
   - Fetch company profile from KVK
   - Compare user-provided data with KVK data
   - Store KVK verification status and data

2. Store KVK data in profile:
   - Add fields to `profiles` table:
     - `kvk_verified` (boolean) - Is KVK number verified?
     - `kvk_verified_at` (timestamp) - When was it verified?
     - `kvk_company_name` (text) - Official name from KVK
     - `kvk_founding_date` (date) - Founding date from KVK
     - `kvk_status` (text) - Company status (active, dissolved, etc.)
     - `kvk_data` (jsonb) - Full KVK response (for reference)

3. Validation:
   - If KVK number doesn't exist → Show error to user
   - If company name doesn't match → Show warning, allow user to confirm
   - If address doesn't match → Show warning, allow user to confirm

#### 2.2 Database Migration
**File**: `supabase/migrations/YYYYMMDD_add_kvk_verification_fields.sql`

```sql
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS kvk_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS kvk_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS kvk_company_name TEXT,
ADD COLUMN IF NOT EXISTS kvk_founding_date DATE,
ADD COLUMN IF NOT EXISTS kvk_status TEXT,
ADD COLUMN IF NOT EXISTS kvk_data JSONB;
```

---

### Phase 3: Risk Assessment Integration

#### 3.1 Enhance Risk Assessment Service
**File**: `services/userRiskAssessmentService.js`

**Changes:**

1. **Update `evaluateUserRisk` method** (line 200):
   - If `coc_number` exists, fetch KVK data
   - Add KVK data to `additionalInfo` object
   - Pass to prompt builder

2. **Update `buildRiskAssessmentPrompt` method** (line 124):
   - Include KVK number in prompt (currently commented out, line 141)
   - Add KVK verification section with:
     - Official company name from KVK
     - Company age/founding date
     - Company status
     - Address verification
   - Update scoring criteria to include KVK verification points

3. **Update scoring criteria** (lines 148-165):
   - **Volledigheid**: +10 points if KVK number is verified
   - **Consistentie**: 
     - +10 points if company name matches KVK
     - +5 points if address matches KVK
   - **Legitimiteit**:
     - +10 points if KVK verified and company is active
     - +5 points if company age > 2 years (from founding date)
   - **Risico indicatoren**:
     - -15 points if KVK number doesn't exist
     - -10 points if company name doesn't match
     - -10 points if company status is "dissolved" or "inactive"

4. **Replace `getCompanyAge` method** (line 470):
   - Remove OpenAI-based search
   - Use KVK API to get founding date
   - Calculate age from founding date

#### 3.2 Update Prompt Rules
**File**: `services/userRiskAssessmentService.js` (line 166)

Add to "BELANGRIJKE REGELS":
```
- KVK verificatie is beschikbaar - gebruik deze informatie in je beoordeling
- Als KVK nummer is geverifieerd, vermeld dit expliciet
- Als bedrijfsnaam of adres niet matcht met KVK gegevens, vermeld dit als risicofactor
- Bedrijfsleeftijd is beschikbaar via KVK - gebruik dit in je beoordeling
```

---

### Phase 4: Error Handling & Edge Cases

#### 4.1 Error Scenarios

1. **KVK API Unavailable**
   - Fallback: Continue risk assessment without KVK data
   - Log warning for monitoring
   - Don't block user signup

2. **Invalid KVK Number**
   - Show clear error message to user
   - Don't save invalid KVK number
   - Allow user to correct or skip

3. **Rate Limiting**
   - Implement request caching (cache KVK data for 24 hours)
   - Queue requests if rate limit exceeded
   - Log rate limit warnings

4. **Data Mismatches**
   - Company name mismatch: Show warning, allow user to confirm
   - Address mismatch: Show warning, allow user to confirm
   - Store mismatch flags for review

#### 4.2 Caching Strategy

**Purpose**: Reduce API calls and costs

**Implementation:**
- Cache KVK data in database (`kvk_data` JSONB field)
- Cache duration: 24 hours (KVK data doesn't change frequently)
- Invalidate cache when:
  - User updates KVK number
  - Manual refresh requested
  - Cache is older than 24 hours

---

### Phase 5: Testing & Validation

#### 5.1 Test Scenarios

1. **Valid KVK Number**
   - ✅ Verify API returns correct data
   - ✅ Verify data is stored correctly
   - ✅ Verify risk assessment uses KVK data

2. **Invalid KVK Number**
   - ✅ Verify error handling
   - ✅ Verify user sees appropriate error

3. **Data Mismatches**
   - ✅ Test company name mismatch
   - ✅ Test address mismatch
   - ✅ Verify warnings are shown

4. **API Failures**
   - ✅ Test when API is unavailable
   - ✅ Verify fallback behavior
   - ✅ Verify error logging

5. **Rate Limiting**
   - ✅ Test rate limit handling
   - ✅ Verify caching works

#### 5.2 Test Data

Use KVK test environment with test API key:
- Test KVK numbers provided by KVK
- Test various company statuses
- Test edge cases

---

## 4. Implementation Steps (Detailed)

### Step 1: Setup KVK API Access
- [ ] Apply for KVK API subscription at [developers.kvk.nl](https://developers.kvk.nl/)
- [ ] Obtain API key
- [ ] Test API key in test environment
- [ ] Document setup process in `KVK_API_SETUP.md`

### Step 2: Create KVK API Service
- [ ] Create `services/kvkApiService.js`
- [ ] Implement `getCompanyProfile(kvkNumber)` method
- [ ] Implement `searchCompanies(companyName)` method (optional)
- [ ] Implement error handling
- [ ] Add environment variable configuration
- [ ] Test with real API calls

### Step 3: Database Schema Updates
- [ ] Create migration file for KVK verification fields
- [ ] Run migration in development
- [ ] Test database changes

### Step 4: Signup Verification
- [ ] Update onboarding endpoint to call KVK API
- [ ] Implement data comparison logic
- [ ] Add validation and error messages
- [ ] Store KVK verification data
- [ ] Test signup flow with valid/invalid KVK numbers

### Step 5: Risk Assessment Integration
- [ ] Update `evaluateUserRisk` to fetch KVK data
- [ ] Update `buildRiskAssessmentPrompt` to include KVK data
- [ ] Update scoring criteria with KVK verification points
- [ ] Replace `getCompanyAge` with KVK API call
- [ ] Update prompt rules
- [ ] Test risk assessment with KVK data

### Step 6: Error Handling & Caching
- [ ] Implement error handling for API failures
- [ ] Implement caching strategy
- [ ] Add logging for monitoring
- [ ] Test error scenarios

### Step 7: Testing
- [ ] Test all scenarios from Phase 5
- [ ] Test in production-like environment
- [ ] Monitor API usage and costs
- [ ] Fix any issues found

### Step 8: Documentation
- [ ] Update risk assessment documentation
- [ ] Document KVK API setup process
- [ ] Document error handling
- [ ] Update admin documentation

---

## 5. Cost Considerations

### 5.1 API Costs
- **Subscription**: €6.20/month
- **Per API Call**: Varies (check KVK pricing)
- **Estimated Usage**:
  - Signup verification: ~1 call per new user
  - Risk assessment: ~1 call per assessment (if KVK number exists)
  - Estimated: 50-200 calls/month (depending on user growth)

### 5.2 Cost Optimization
- **Caching**: Cache KVK data for 24 hours to avoid duplicate calls
- **Lazy Loading**: Only fetch KVK data when needed (not on every profile update)
- **Batch Processing**: If possible, batch multiple requests

---

## 6. Security & Compliance

### 6.1 Data Protection
- ✅ KVK API key stored in environment variables (not in code)
- ✅ KVK data stored securely in database
- ✅ Follow KVK API terms of service
- ✅ Don't expose KVK API key in frontend

### 6.2 Privacy
- ✅ Only fetch KVK data when user provides KVK number
- ✅ Store KVK data only for verification purposes
- ✅ Allow users to see what KVK data is stored
- ✅ Comply with GDPR (KVK data is public, but still handle carefully)

---

## 7. Monitoring & Maintenance

### 7.1 Monitoring
- Monitor API call success rate
- Monitor API response times
- Monitor error rates
- Track API usage and costs
- Alert on API failures

### 7.2 Maintenance
- Keep KVK API service updated
- Monitor KVK API changes/updates
- Update error handling as needed
- Review and optimize caching strategy

---

## 8. Success Criteria

✅ **Phase 1 Complete When:**
- KVK API service is created and tested
- API key is configured
- Can successfully fetch company data from KVK API

✅ **Phase 2 Complete When:**
- Users can verify KVK number during signup
- KVK verification data is stored in database
- Validation errors are shown to users

✅ **Phase 3 Complete When:**
- Risk assessment uses KVK data in scoring
- KVK verification affects risk score appropriately
- Company age is calculated from KVK data

✅ **Full Integration Complete When:**
- All test scenarios pass
- Error handling works correctly
- Documentation is complete
- System is production-ready

---

## 9. Next Steps

1. **Immediate Actions:**
   - Review and approve this plan
   - Obtain KVK API subscription and key
   - Set up test environment

2. **Implementation Order:**
   - Start with Phase 1 (KVK API Service)
   - Then Phase 2 (Signup Verification)
   - Finally Phase 3 (Risk Assessment Integration)

3. **Timeline Estimate:**
   - Phase 1: 1-2 days
   - Phase 2: 2-3 days
   - Phase 3: 2-3 days
   - Testing & Documentation: 1-2 days
   - **Total: ~1-2 weeks**

---

## 10. Questions & Considerations

### Open Questions:
1. Should we verify KVK number on every profile update, or only once?
2. How strict should we be with data mismatches? (Block signup vs. warning)
3. Should we cache KVK data, and for how long?
4. Do we need to support searching by company name (Zoeken API)?
5. Should we verify KVK number for existing users retroactively?

### Decisions Needed:
- [ ] Approval to proceed with implementation
- [ ] Decision on data mismatch handling (strict vs. lenient)
- [ ] Decision on caching strategy
- [ ] Decision on retroactive verification for existing users

---

## Appendix A: KVK API Endpoints Reference

### Basisprofiel API
```
GET https://api.kvk.nl/api/v2/basisprofiel/{kvkNumber}
Headers:
  apikey: {KVK_API_KEY}
```

### Zoeken API (if needed)
```
GET https://api.kvk.nl/api/v2/zoeken
Query Parameters:
  q: {companyName}
  apikey: {KVK_API_KEY}
```

**Note**: Exact endpoint structure may vary - refer to KVK API documentation.

---

## Appendix B: Example KVK API Response

```json
{
  "kvkNummer": "12345678",
  "handelsnaam": "Example Company B.V.",
  "adres": {
    "straatnaam": "Example Street",
    "huisnummer": "123",
    "postcode": "1234AB",
    "plaats": "Amsterdam"
  },
  "oprichtingsdatum": "2010-01-15",
  "status": "Actief",
  "rechtsvorm": "Besloten Vennootschap",
  "hoofdactiviteit": "Software development"
}
```

**Note**: Actual response structure may vary - refer to KVK API documentation.

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Status**: Ready for Implementation


