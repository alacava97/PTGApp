const crypto = require('crypto');

function createPublicToken() {
  return crypto.randomBytes(5).toString('hex'); // 10-character token
}

module.exports = {
  createPublicToken
};