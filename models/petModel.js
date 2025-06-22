// models/petModel.js
import pool from './db.js';

export const countAll = async () => {
  const [rows] = await pool.execute('SELECT COUNT(*) AS count FROM pets');
  return rows[0].count;
};
