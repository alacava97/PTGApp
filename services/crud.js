const pool = require('../db/pool');
const { getAllowedFields } = require('../utils/dbHelpers');

async function createRecord({ table, data, returning = ['id'] }, client = pool) {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`);

  const query = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING ${returning.join(', ')}
  `;

  const result = await client.query(query, values);
  return result.rows[0];
}

module.exports = { createRecord };