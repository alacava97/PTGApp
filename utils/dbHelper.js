async function getAllowedFields(table, client) {
  const res = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
  `, [table]);

  return res.rows.map(r => r.column_name);
}

module.exports = { getAllowedFields };