// utils/one.js
function ensureOneOr404(res, row, message = 'Not found') {
  if (!row) {
    return { end: res.status(404).json({ error: 'not_found', message }) };
  }
  return { row };
}

module.exports = { ensureOneOr404 };
