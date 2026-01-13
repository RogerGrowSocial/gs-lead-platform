const bcrypt = require('bcrypt');

async function generateHash(password) {
  const saltRounds = 10;
  const hash = await bcrypt.hash(password, saltRounds);
  console.log('Hashed password:', hash);
}

// Haal het wachtwoord op uit de command line argumenten
const password = process.argv[2];

if (!password) {
  console.log('Gebruik: node scripts/generate-password.js "jouw_wachtwoord"');
  process.exit(1);
}

generateHash(password); 