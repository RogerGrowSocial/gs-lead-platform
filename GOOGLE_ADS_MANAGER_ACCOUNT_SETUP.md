# Google Ads Manager Account (MCC) Setup

## The Problem

Campaign creation fails with:
```
USER_PERMISSION_DENIED
"User doesn't have permission to access customer. Note: If you're accessing a client customer, the manager's customer id must be set in the 'login-customer-id' header."
```

## Root Cause

When using a **client customer account** (not a Manager Account/MCC), Google Ads requires:
- `customer_id`: The actual customer account where campaigns are created
- `login_customer_id`: The Manager Account (MCC) that has access to the customer account

**The Manager Account (MCC) is missing from the database.**

## Solution: Add Manager Account to Database

### Step 1: Find Your Manager Account (MCC) ID

1. Log in to [Google Ads](https://ads.google.com/)
2. Click the account selector (top right)
3. Look for your **Manager Account** (MCC) - it usually has "Manager" in the name
4. The Manager Account ID is in the format: `123-456-7890` (with dashes) or `1234567890` (without dashes)
5. **Note**: This is different from your client customer account ID

### Step 2: Add Manager Account to Database

**Option A: Via Admin UI**
1. Go to Admin → Google Ads → Accounts
2. Click "Add Account"
3. Fill in:
   - **Account Name**: "Manager Account" or your MCC name
   - **Customer ID**: Your Manager Account ID (without dashes, e.g., `1234567890`)
   - **Is Manager Account**: ✅ **Check this box** (CRITICAL!)
4. Click "Add Account"

**Option B: Via SQL**
```sql
INSERT INTO google_ads_accounts (
  account_name,
  customer_id,
  is_manager_account,
  is_active
) VALUES (
  'Manager Account (MCC)',
  '1234567890',  -- Your Manager Account ID (without dashes)
  true,          -- CRITICAL: This must be true for Manager Accounts
  true
);
```

### Step 3: Verify Setup

After adding the Manager Account, the code will:
1. ✅ Find the Manager Account in the database
2. ✅ Use it as `login_customer_id` when accessing client customer accounts
3. ✅ Log: `🔐 Using Manager Account (MCC) 1234567890 to access Customer Account 9876543210`

## Database Structure

You should have **TWO** accounts in `google_ads_accounts`:

1. **Manager Account (MCC)**:
   ```sql
   customer_id: '1234567890'
   is_manager_account: true
   ```

2. **Customer Account** (client):
   ```sql
   customer_id: '9876543210'
   is_manager_account: false
   ```

## How It Works

```
┌─────────────────────┐
│ Manager Account     │  (MCC)
│ (login_customer_id) │  ← Has access to client customers
└──────────┬──────────┘
           │
           │ Accesses
           ▼
┌─────────────────────┐
│ Customer Account    │  (Client)
│ (customer_id)       │  ← Where campaigns are created
└─────────────────────┘
```

## Troubleshooting

### "No Manager Account (MCC) found"
- ✅ Check if Manager Account exists in `google_ads_accounts` table
- ✅ Verify `is_manager_account = true`
- ✅ Verify `is_active = true`

### "Manager Account ID matches Customer ID"
- This means you're using the same ID for both
- You need a **separate** Manager Account (MCC) that has access to your customer account
- The Manager Account must be linked to your customer account in Google Ads

### "USER_PERMISSION_DENIED" after adding Manager Account
- Verify the Manager Account has access to the customer account in Google Ads
- Check that the Manager Account is linked to the customer account in Google Ads UI
- The Manager Account must have proper permissions (at least "Standard" access)

## Verification

After setup, check the logs when creating a campaign:
- ✅ Should see: `🔐 Using Manager Account (MCC) XXXX to access Customer Account YYYY`
- ❌ Should NOT see: `⚠️ No Manager Account (MCC) found`

## Next Steps

1. ✅ Add Manager Account to database
2. ✅ Verify it appears in Admin UI
3. ✅ Test campaign creation
4. ✅ Check logs for confirmation
