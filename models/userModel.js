import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import pool from './db.js';

// Create User with email and phone (both required for your use-case)
export const createUser = async (email, phone, role = 'user') => {
  if (!email || !phone) throw new Error('Both email and phone are required');
  const tempPassword = crypto.randomBytes(16).toString('hex');
  const hashedTempPassword = await bcrypt.hash(tempPassword, 10);

  const [result] = await pool.execute(
    'INSERT INTO users (email, phone, role, password_hash) VALUES (?, ?, ?, ?)',
    [email, phone, role, hashedTempPassword]
  );
  return result.insertId;
};

// Find user by either email or phone
export const findUserByContact = async (contact) => {
  const isEmail = contact.includes('@');
  const [rows] = await pool.execute(
    isEmail
      ? 'SELECT * FROM users WHERE email = ?'
      : 'SELECT * FROM users WHERE phone = ?',
    [contact]
  );
  return rows[0];
};

// Find user by email
export const findUserByEmail = async (email) => {
  const [rows] = await pool.execute(
    'SELECT * FROM users WHERE email = ?',
    [email]
  );
  return rows[0];
};

// Find user by phone
export const findUserByPhone = async (phone) => {
  const [rows] = await pool.execute(
    'SELECT * FROM users WHERE phone = ?',
    [phone]
  );
  return rows[0];
};

// Update password by email or phone
export const updatePassword = async (contact, passwordHash) => {
  const isEmail = contact.includes('@');
  await pool.execute(
    isEmail
      ? 'UPDATE users SET password_hash = ? WHERE email = ?'
      : 'UPDATE users SET password_hash = ? WHERE phone = ?',
    [passwordHash, contact]
  );
};
