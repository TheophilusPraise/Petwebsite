import crypto from 'crypto'; // Add this import at the top
import bcrypt from 'bcryptjs';
import pool from './db.js';

export const createUser = async (email, role = 'user') => {
  // Create a temporary random password for initial registration
  const tempPassword = crypto.randomBytes(16).toString('hex');
  const hashedTempPassword = await bcrypt.hash(tempPassword, 10);
  
  const [result] = await pool.execute(
    'INSERT INTO users (email, role, password_hash) VALUES (?, ?, ?)',
    [email, role, hashedTempPassword]
  );
  return result.insertId;
};


export const findUserByEmail = async (email) => {
  const [rows] = await pool.execute(
    'SELECT * FROM users WHERE email = ?',
    [email]
  );
  return rows[0];
};

export const updatePassword = async (email, password) => {
  await pool.execute(
    'UPDATE users SET password = ? WHERE email = ?',
    [password, email]
  );
};
