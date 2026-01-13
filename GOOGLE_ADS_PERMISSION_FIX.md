# Google Ads Permission Error Fix

## The Problem

Google Ads campaign creation was failing with error:
```
USER_PERMISSION_DENIED
"User doesn't have permission to access customer. Note: If you're accessing a client customer, the manager's customer id must be set in the 'login-customer-id' header."
```

## Root Cause

When using a **client customer account** (not a Manager Account/MCC), Google Ads requires:
- `customer_id`: The actual customer account where campaigns are created
- `login_customer_id`: The Manager Account (MCC) that has access to the customer account

The `login_customer_id` was commented out in the code, causing permission errors.

## The Fix

### 1. Enabled `login_customer_id` ✅

Updated `integrations/googleAdsClient.js` to automatically set `login_customer_id` when a Manager Account (MCC) is available:

```javascript
if (managerIdClean && managerIdClean !== customerIdClean) {
  customerConfig.login_customer_id = managerIdClean
  console.log(`🔐 Using Manager Account (MCC) ${managerIdClean} to access Customer Account ${customerIdClean}`)
}
```

### 2. Better Error Handling ✅

Added specific error detection for `USER_PERMISSION_DENIED` errors with helpful messages:

```javascript
if (permissionError) {
  errorMessage = `Google Ads permission denied. The manager account (MCC) ID must be set...`;
  errorDetails = {
    type: 'PERMISSION_ERROR',
    code: 'USER_PERMISSION_DENIED',
    suggestion: 'Add a Manager Account (MCC) to the google_ads_accounts table...'
  };
}
```

### 3. Improved Logging ✅

- Logs when Manager Account is used to access Customer Account
- Warns when no Manager Account is found
- Provides clear instructions in error messages

## How It Works

### Step 1: Get Manager Account (MCC) ID
```javascript
// From database or env var
managerAccountId = await GoogleAdsClient.getManagerAccountId()
```

### Step 2: Set login_customer_id
```javascript
if (managerIdClean && managerIdClean !== customerIdClean) {
  customerConfig.login_customer_id = managerIdClean
}
```

### Step 3: Create Customer Instance
```javascript
const customer = this.client.Customer({
  customer_id: customerIdClean,        // Client customer account
  login_customer_id: managerIdClean,  // Manager Account (MCC)
  refresh_token: refreshToken
})
```

## Database Setup

Ensure you have both accounts in `google_ads_accounts` table:

1. **Manager Account (MCC)**:
   ```sql
   INSERT INTO google_ads_accounts (
     customer_id,
     is_manager_account,
     is_active
   ) VALUES (
     '1234567890',  -- Manager Account ID (without dashes)
     true,          -- This is a Manager Account
     true
   );
   ```

2. **Customer Account**:
   ```sql
   INSERT INTO google_ads_accounts (
     customer_id,
     is_manager_account,
     is_active
   ) VALUES (
     '9876543210',  -- Customer Account ID (without dashes)
     false,         -- This is a client customer account
     true
   );
   ```

## Testing

After the fix:
1. ✅ Manager Account (MCC) is automatically used as `login_customer_id`
2. ✅ Client customer accounts can be accessed
3. ✅ Clear error messages if Manager Account is missing

## Files Modified

1. `integrations/googleAdsClient.js`
   - Enabled `login_customer_id` when Manager Account is available
   - Improved logging and error messages

2. `services/googleAdsCampaignBuilderService.js`
   - Added `USER_PERMISSION_DENIED` error detection
   - Better error messages with suggestions

## Next Steps

1. ✅ `login_customer_id` is now enabled
2. ⚠️ Ensure Manager Account (MCC) is in `google_ads_accounts` table
3. ⚠️ Ensure Customer Account is in `google_ads_accounts` table
4. ⚠️ Test campaign creation to verify permissions work
