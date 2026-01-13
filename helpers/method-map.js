// helpers/method-map.js
function mapMollieMethodToDb(method) {
  const m = String(method || '').toLowerCase();

  // Our Postgres enum allows: credit_card | sepa | ideal | paypal
  if (m === 'creditcard')  return 'credit_card';
  if (m === 'ideal')       return 'ideal';
  if (m === 'paypal')      return 'paypal';
  if (m === 'directdebit') return 'sepa';

  return null; // unknown/unsupported → let caller handle
}

module.exports = { mapMollieMethodToDb };
