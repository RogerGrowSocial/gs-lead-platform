require('dotenv').config()

const clientId = process.env.GOOGLE_ADS_CLIENT_ID || '238167531028-gcpc0skr2irjiabhp16k79p083rhle6r.apps.googleusercontent.com'
const redirectUri = 'http://localhost:3000/auth/google-ads/callback'

const authUrl = `https://accounts.google.com/o/oauth2/auth?` +
  `client_id=${encodeURIComponent(clientId)}&` +
  `redirect_uri=${encodeURIComponent(redirectUri)}&` +
  `scope=${encodeURIComponent('https://www.googleapis.com/auth/adwords')}&` +
  `response_type=code&` +
  `access_type=offline&` +
  `prompt=consent`

console.log('🔗 Google Ads OAuth URL:\n')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(authUrl)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('\n📝 Instructions:')
console.log('1. Copy the URL above')
console.log('2. Open it in your browser')
console.log('3. Log in with a Google account that has access to BOTH:')
console.log('   - MCC Account (3905411772)')
console.log('   - Customer Account (1785154066)')
console.log('4. After authorization, you\'ll be redirected to:')
console.log('   http://localhost:3000/auth/google-ads/callback?code=...')
console.log('5. Copy the "code" parameter from that URL')
console.log('6. Run: node scripts/get-google-ads-refresh-token.js [CODE]')
console.log('\n⚠️  Make sure you\'re logged in as a user with admin access to both accounts!')
