const pool = require('../db/pool');
const { getAllowedFields } = require('../utils/dbHelper');

async function createRecord({ table, data, returning = ['id'] }, client = pool) {
  const allowedFields = await getAllowedFields(table, client);

  const filteredData = Object.fromEntries(
    Object.entries(data).filter(([key]) =>
      allowedFields.includes(key)
    )
  );

  const columns = Object.keys(filteredData);
  const values = Object.values(filteredData);
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