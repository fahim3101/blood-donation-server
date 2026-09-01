const crypto = require('crypto');

// Create a cryptographically random token (URL-safe)
const generateResetToken = () => crypto.randomBytes(32).toString('hex');

// Hash a token with SHA-256 so we can store it safely in the DB
const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

module.exports = { generateResetToken, hashToken };
