// models/bookingModel.js
import pool from './db.js';

export const countAll = async () => {
  const [rows] = await pool.execute('SELECT COUNT(*) AS count FROM appointments');
  return rows[0].count;
};

export const getUpcoming = async () => {
  const [rows] = await pool.execute('SELECT * FROM appointments WHERE date > NOW()');
  return rows;
};
