require('dotenv').config()

const https = require('https')
const querystring = require('querystring')

// Get credentials from env or command line args
const clientId = process.argv[2] || process.env.GOOGLE_ADS_CLIENT_ID
const clientSecret = process.argv[3] || process.env.GOOGLE_ADS_CLIENT_SECRET
const code = process.argv[4] || process.env.GOOGLE_ADS_AUTH_CODE

if (!clientId || !clientSecret || !code) {
  console.error('❌ Missing required parameters!')
  console.error('\nUsage:')
  console.error('  node scripts/get-google-ads-refresh-token.js [CLIENT_ID] [CLIENT_SECRET] [AUTH_CODE]')
  console.error('\nOr set in .env:')
  console.error('  GOOGLE_ADS_CLIENT_ID=...')
  console.error('  GOOGLE_ADS_CLIENT_SECRET=...')
  console.error('  GOOGLE_ADS_AUTH_CODE=...')
  process.exit(1)
}

const postData = querystring.stringify({
  client_id: clientId,
  client_secret: clientSecret,
  code: code,
  grant_type: 'authorization_code',
  redirect_uri: 'http://localhost:3000/auth/google-ads/callback'
})

const options = {
  hostname: 'oauth2.googleapis.com',
  port: 443,
  path: '/token',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': postData.length
  }
}

console.log('🔄 Exchanging authorization code for tokens...\n')

const req = https.request(options, (res) => {
  let data = ''

  res.on('data', (chunk) => {
    data += chunk
  })

  res.on('end', () => {
    try {
      const response = JSON.parse(data)
      
      if (response.error) {
        console.error('❌ Error:', response.error)
        console.error('   Description:', response.error_description)
        process.exit(1)
      }

      if (response.refresh_token) {
        console.log('✅ Success! Refresh token obtained:\n')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(response.refresh_token)
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('\n📝 Add this to your .env file:')
        console.log(`GOOGLE_ADS_REFRESH_TOKEN=${response.refresh_token}`)
        console.log('\n✅ Then restart your server!')
      } else {
        console.error('❌ No refresh_token in response!')
        console.error('Response:', JSON.stringify(response, null, 2))
        process.exit(1)
      }
    } catch (err) {
      console.error('❌ Error parsing response:', err.message)
      console.error('Raw response:', data)
      process.exit(1)
    }
  })
})

req.on('error', (err) => {
  console.error('❌ Request error:', err.message)
  process.exit(1)
})

req.write(postData)
req.end()
