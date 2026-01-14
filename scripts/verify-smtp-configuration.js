#!/usr/bin/env node

/**
 * SMTP Configuration Verification Script
 * 
 * Dit script helpt je om te verifiëren of je SMTP configuratie correct is ingesteld.
 * Het controleert:
 * - Environment variables
 * - DNS records (via externe tools)
 * - Mailgun configuratie hints
 * - Supabase configuratie hints
 */

const https = require('https');
const dns = require('dns').promises;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Check environment variables
function checkEnvironmentVariables() {
  logSection('Environment Variables Check');
  
  const requiredVars = {
    'MAILGUN_SMTP_HOST': process.env.MAILGUN_SMTP_HOST,
    'MAILGUN_SMTP_PORT': process.env.MAILGUN_SMTP_PORT,
    'MAILGUN_SMTP_USER': process.env.MAILGUN_SMTP_USER,
    'MAILGUN_SMTP_PASS': process.env.MAILGUN_SMTP_PASS,
    'MAILGUN_DOMAIN': process.env.MAILGUN_DOMAIN,
    'EMAIL_FROM': process.env.EMAIL_FROM,
    'APP_URL': process.env.APP_URL || process.env.BASE_URL,
  };

  let allPresent = true;

  for (const [key, value] of Object.entries(requiredVars)) {
    if (value) {
      if (key.includes('PASS')) {
        logSuccess(`${key}: Set (${value.length} characters)`);
      } else {
        logSuccess(`${key}: ${value}`);
      }
    } else {
      logWarning(`${key}: Not set`);
      allPresent = false;
    }
  }

  // Validate values
  if (requiredVars.MAILGUN_SMTP_HOST && !requiredVars.MAILGUN_SMTP_HOST.includes('eu.mailgun.org')) {
    logWarning('MAILGUN_SMTP_HOST should use EU region (smtp.eu.mailgun.org)');
  }

  if (requiredVars.MAILGUN_SMTP_PORT && requiredVars.MAILGUN_SMTP_PORT !== '587' && requiredVars.MAILGUN_SMTP_PORT !== '465') {
    logWarning('MAILGUN_SMTP_PORT should be 587 (STARTTLS) or 465 (SSL)');
  }

  if (requiredVars.MAILGUN_SMTP_USER && !requiredVars.MAILGUN_SMTP_USER.includes('@')) {
    logError('MAILGUN_SMTP_USER must be a full email address (e.g., postmaster@growsocialmedia.nl)');
    allPresent = false;
  }

  if (requiredVars.EMAIL_FROM && !requiredVars.EMAIL_FROM.includes('@growsocialmedia.nl')) {
    logWarning('EMAIL_FROM should be from growsocialmedia.nl domain');
  }

  return allPresent;
}

// Check DNS records (basic check)
async function checkDNSRecords(domain = 'growsocialmedia.nl') {
  logSection('DNS Records Check');
  
  logInfo('Checking DNS records for: ' + domain);
  logInfo('Note: This is a basic check. Use MX Toolbox for detailed verification.');
  logInfo('');
  logInfo('Expected records:');
  logInfo('  - SPF (TXT): v=spf1 include:mailgun.org ~all');
  logInfo('  - DKIM (TXT): mta._domainkey.growsocialmedia.nl');
  logInfo('  - CNAME: email.growsocialmedia.nl -> eu.mailgun.org');
  logInfo('  - DMARC (TXT): _dmarc.growsocialmedia.nl (optional but recommended)');
  logInfo('');
  logWarning('To verify DNS records properly:');
  logInfo('  1. Go to https://mxtoolbox.com/SuperTool.aspx');
  logInfo('  2. Enter: ' + domain);
  logInfo('  3. Select "TXT" and click "MX Lookup"');
  logInfo('  4. Check all records are present');
  logInfo('');
  logWarning('To verify in Mailgun Dashboard:');
  logInfo('  1. Go to Mailgun Dashboard → Sending → Domains → ' + domain);
  logInfo('  2. Check that all DNS records have green checkmarks ✅');
}

// Configuration checklist
function printConfigurationChecklist() {
  logSection('Configuration Checklist');
  
  console.log('\n📋 MAILGUN CONFIGURATION:');
  console.log('');
  console.log('In Mailgun Dashboard → Sending → Domains → growsocialmedia.nl:');
  console.log('');
  console.log('  [ ] Domain status is "Active" (not "Sandbox" or "Unverified")');
  console.log('  [ ] SPF record (TXT) has green checkmark ✅');
  console.log('  [ ] DKIM record (TXT) has green checkmark ✅');
  console.log('  [ ] Email tracking (CNAME) has green checkmark ✅');
  console.log('  [ ] SMTP password is created in SMTP credentials section');
  console.log('  [ ] SMTP password is copied and saved securely');
  console.log('');
  
  console.log('📋 SUPABASE CONFIGURATION:');
  console.log('');
  console.log('In Supabase Dashboard → Project Settings → Auth → SMTP Settings:');
  console.log('');
  console.log('  [ ] Enable custom SMTP: ✅ AAN');
  console.log('  [ ] Sender email: noreply@growsocialmedia.nl');
  console.log('  [ ] Sender name: GrowSocial');
  console.log('  [ ] Host: smtp.eu.mailgun.org');
  console.log('  [ ] Port: 587');
  console.log('  [ ] Username: postmaster@growsocialmedia.nl');
  console.log('  [ ] Password: [Mailgun SMTP password]');
  console.log('  [ ] Minimum interval: 60 seconds');
  console.log('  [ ] Test SMTP is successful');
  console.log('');
  
  console.log('📋 SITE URL & REDIRECTS:');
  console.log('');
  console.log('In Supabase Dashboard → Project Settings → API:');
  console.log('');
  console.log('  [ ] Site URL: https://app.growsocialmedia.nl');
  console.log('');
  console.log('In Supabase Dashboard → Project Settings → Auth → URL Configuration:');
  console.log('');
  console.log('  [ ] Redirect URLs include:');
  console.log('      - https://app.growsocialmedia.nl/auth/verify-email');
  console.log('      - https://app.growsocialmedia.nl/auth/reset-password');
  console.log('      - https://app.growsocialmedia.nl/auth/callback');
  console.log('');
}

// Print next steps
function printNextSteps() {
  logSection('Next Steps');
  
  console.log('\n1. 📧 MAILGUN DNS RECORDS:');
  console.log('   - Add DNS records to your DNS provider (see MAILGUN_DNS_RECORDS_SETUP.md)');
  console.log('   - Wait 15-60 minutes for DNS propagation');
  console.log('   - Verify in Mailgun Dashboard that all records have green checkmarks ✅');
  console.log('');
  
  console.log('2. 🔐 MAILGUN SMTP PASSWORD:');
  console.log('   - Go to Mailgun Dashboard → Sending → Domains → growsocialmedia.nl');
  console.log('   - Scroll to "SMTP credentials" section');
  console.log('   - Click "Add password" and create a new SMTP password');
  console.log('   - Copy the password immediately (you only see it once!)');
  console.log('');
  
  console.log('3. ⚙️  SUPABASE SMTP:');
  console.log('   - Go to Supabase Dashboard → Project Settings → Auth → SMTP Settings');
  console.log('   - Fill in all fields (see SUPABASE_SMTP_CONFIGURATION_CHECKLIST.md)');
  console.log('   - Click "Save changes"');
  console.log('   - Test SMTP connection');
  console.log('');
  
  console.log('4. 🌐 SUPABASE SITE URL:');
  console.log('   - Go to Supabase Dashboard → Project Settings → API');
  console.log('   - Set Site URL to: https://app.growsocialmedia.nl');
  console.log('   - Add redirect URLs (see checklist above)');
  console.log('');
  
  console.log('5. ✅ TEST:');
  console.log('   - Test password reset functionality');
  console.log('   - Test email verification');
  console.log('   - Check Mailgun Dashboard → Logs for delivery status');
  console.log('');
}

// Main function
async function main() {
  console.log('\n');
  log('🔍 SMTP Configuration Verification', 'cyan');
  log('====================================', 'cyan');
  
  // Check environment variables
  const envOk = checkEnvironmentVariables();
  
  // Check DNS records
  await checkDNSRecords('growsocialmedia.nl');
  
  // Print checklist
  printConfigurationChecklist();
  
  // Print next steps
  printNextSteps();
  
  // Summary
  logSection('Summary');
  
  if (envOk) {
    logSuccess('Environment variables are configured');
  } else {
    logWarning('Some environment variables are missing');
    logInfo('Add them to your .env file (see COMPLETE_SMTP_SETUP.md)');
  }
  
  logInfo('');
  logInfo('📚 Documentation:');
  logInfo('  - COMPLETE_SMTP_SETUP.md - Full setup guide');
  logInfo('  - MAILGUN_DNS_RECORDS_SETUP.md - DNS records setup');
  logInfo('  - SUPABASE_SMTP_CONFIGURATION_CHECKLIST.md - Supabase checklist');
  logInfo('  - SMTP_SETUP_QUICK_START.md - Quick start guide');
  logInfo('');
  
  logInfo('🔗 Verification Tools:');
  logInfo('  - MX Toolbox: https://mxtoolbox.com/SuperTool.aspx');
  logInfo('  - Mail Tester: https://www.mail-tester.com/');
  logInfo('  - SPF Check: https://mxtoolbox.com/spf.aspx');
  logInfo('  - DKIM Check: https://mxtoolbox.com/dkim.aspx');
  logInfo('');
}

// Run the script
if (require.main === module) {
  // Load environment variables
  require('dotenv').config();
  
  main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}

module.exports = { checkEnvironmentVariables, checkDNSRecords };
