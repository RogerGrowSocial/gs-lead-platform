const express = require('express')
const https = require('https')
const fs = require('fs')
const path = require('path')

// Import all the same middleware and routes from server.js
const app = require('./server')

const PORT = process.env.PORT || 3000

// Create self-signed certificate for development
const options = {
  key: fs.readFileSync(path.join(__dirname, 'certs', 'server.key')),
  cert: fs.readFileSync(path.join(__dirname, 'certs', 'server.crt'))
}

// Create HTTPS server
https.createServer(options, app).listen(PORT, () => {
  console.log(`🔒 HTTPS Server draait op https://localhost:${PORT}`)
  console.log(`⚠️  Self-signed certificate - accepteer de waarschuwing in je browser`)
  console.log(`💡 Voor autofill functionaliteit: https://localhost:${PORT}`)
})

// Handle certificate errors gracefully
process.on('uncaughtException', (err) => {
  if (err.code === 'ENOENT' && err.path.includes('certs')) {
    console.log('❌ SSL certificaten niet gevonden. Maak eerst certificaten aan:')
    console.log('   mkdir certs')
    console.log('   openssl req -x509 -newkey rsa:4096 -keyout certs/server.key -out certs/server.crt -days 365 -nodes -subj "/C=NL/ST=Netherlands/L=Amsterdam/O=GrowSocial/CN=localhost"')
    console.log('')
    console.log('🔄 Start de normale HTTP server: npm run dev')
    process.exit(1)
  }
  throw err
})
