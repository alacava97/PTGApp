const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idelTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

module.exports = pool;