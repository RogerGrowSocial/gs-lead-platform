const { createMollieClient } = require('@mollie/api-client');

// Initialize Mollie client with API key from environment variables
const mollieClient = createMollieClient({
  apiKey: process.env.MOLLIE_API_KEY
});

module.exports = {
  mollieClient
}; 