# Server Startup Issue - Root Cause & Prevention

## The Problem

The server was crashing on startup with `Error: supabaseUrl is required` because:

1. **`services/imapSyncService.js`** was creating a Supabase client at the **top level** (module load time):
   ```javascript
   const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey); // ❌ Runs immediately when module loads
   ```

2. When `cron/mailSyncJobs.js` required `imapSyncService.js`, it tried to create the client **before** environment variables were guaranteed to be loaded.

3. If `SUPABASE_URL` was undefined/null, the Supabase library throws an error **during module loading**, which crashes the entire server.

## The Fix

Changed to **lazy initialization** - only create the client when actually needed:

```javascript
// ✅ Lazy initialization - only creates client when getSupabaseAdmin() is called
let supabaseAdmin = null;
function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    }
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabaseAdmin;
}
```

## Prevention Rules

**NEVER create Supabase clients (or any external service clients) at the top level of a module that gets required during server startup.**

### ✅ DO:
- Use lazy initialization (create on first use)
- Create clients inside functions/methods
- Use the shared `config/supabase.js` for most cases

### ❌ DON'T:
- Create clients at module top level
- Create clients in cron job files that run at startup
- Create clients before `dotenv.config()` is guaranteed to run

## Files Fixed

1. ✅ `services/imapSyncService.js` - Changed to lazy initialization
2. ✅ `server.js` - Made `riskAssessmentWorker` load lazily (was taking 65 seconds)

## Files Fixed

1. ✅ `services/imapSyncService.js` - Changed to lazy initialization
2. ✅ `server.js` - Made `riskAssessmentWorker` load lazily (was taking 65 seconds)
3. ✅ `routes/subscriptions.js` - Changed to lazy initialization with backward compatibility
4. ✅ `config/supabase.js` - Added validation to fail fast with clear error messages

## Prevention Checklist

When creating new services or routes:
- [ ] Never create Supabase clients at module top level
- [ ] Use lazy initialization pattern (create on first use)
- [ ] Or use the shared `config/supabase.js` which is safe
- [ ] Always validate env vars before creating clients
- [ ] Add error messages that point to `.env` file if missing

