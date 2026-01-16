const schemaCache = new Map();

async function getAllowedFields(table, pool) {
  if (schemaCache.has(table)) {
    return schemaCache.get(table);
  }

  const res = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
  `, [table]);

  const fields = res.rows.map(r => r.column_name);
  schemaCache.set(table, fields);

  return fields;
}

module.exports = { getAllowedFields };