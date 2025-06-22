import pool from './db.js';

export const createOTP = async (userId, code, purpose) => {
  const expiresAt = new Date(Date.now() + 10 * 60000); // 10 minutes
  try {
    const [result] = await pool.execute(
      'INSERT INTO otps (user_id, code, purpose, expires_at) VALUES (?, ?, ?, ?)',
      [userId, code, purpose, expiresAt]
    );
    return result.insertId;
  } catch (error) {
    console.error('Error creating OTP:', error);
    throw new Error('Failed to create OTP');
  }
};

export const findValidOTP = async (userId, code, purpose) => {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM otps
       WHERE user_id = ? AND code = ? AND purpose = ?
       AND expires_at > NOW() AND used = 0
       ORDER BY expires_at DESC
       LIMIT 1`,
      [userId, code, purpose]
    );
    return rows[0] || null;
  } catch (error) {
    console.error('Error finding valid OTP:', error);
    throw new Error('Failed to validate OTP');
  }
};

export const markOTPUsed = async (otpId) => {
  try {
    await pool.execute(
      'UPDATE otps SET used = 1 WHERE id = ?',
      [otpId]
    );
    return true;
  } catch (error) {
    console.error('Error marking OTP used:', error);
    throw new Error('Failed to update OTP status');
  }
};

// Add this new function
export const invalidateUserOTPs = async (userId, purpose) => {
  try {
    await pool.execute(
      'UPDATE otps SET used = 1 WHERE user_id = ? AND purpose = ? AND used = 0',
      [userId, purpose]
    );
    return true;
  } catch (error) {
    console.error('Error invalidating OTPs:', error);
    throw new Error('Failed to invalidate previous OTPs');
  }
};
