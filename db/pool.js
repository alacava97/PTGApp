const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idelTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

module.exports = pool;