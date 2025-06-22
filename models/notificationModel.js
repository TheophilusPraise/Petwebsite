// models/notificationModel.js
import pool from './db.js';

export const getRecentNotifications = async () => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5'
    );
    return rows;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
};

// Add other notification-related functions as needed
export const createNotification = async (userId, message) => {
  await pool.execute(
    'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
    [userId, message]
  );
};
