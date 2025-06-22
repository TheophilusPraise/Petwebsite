import pool from '../config/db.js';

// Notification types enum
export const NOTIFICATION_TYPES = {
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  BOOKING_CONFIRMED: 'booking_confirmed',
  BOOKING_CANCELLED: 'booking_cancelled',
  PET_ADDED: 'pet_added',
  PET_DELETED: 'pet_deleted',
  ADMIN_MESSAGE: 'admin_message',
  SYSTEM_ALERT: 'system_alert',
  REMINDER: 'reminder'
};

// Get recent notifications for a user
export const getRecentNotifications = async (userId, limit = 5) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, message, type, is_read, created_at, metadata 
       FROM notifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [userId, limit]
    );
    return rows;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
};

// Get all notifications for a user with pagination
export const getUserNotifications = async (userId, page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    const [rows] = await pool.execute(
      `SELECT id, message, type, is_read, created_at, metadata 
       FROM notifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
    
    const [[{ total }]] = await pool.execute(
      'SELECT COUNT(*) AS total FROM notifications WHERE user_id = ?',
      [userId]
    );
    
    return { notifications: rows, total: total, hasMore: offset + limit < total };
  } catch (error) {
    console.error('Error fetching user notifications:', error);
    return { notifications: [], total: 0, hasMore: false };
  }
};

// Create a notification
export const createNotification = async (userId, message, type = 'system_alert', metadata = null) => {
  try {
    const [result] = await pool.execute(
      'INSERT INTO notifications (user_id, message, type, metadata) VALUES (?, ?, ?, ?)',
      [userId, message, type, JSON.stringify(metadata)]
    );
    return result.insertId;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Create notifications for multiple users (broadcast)
export const createBroadcastNotification = async (userIds, message, type = 'admin_message', metadata = null) => {
  try {
    const notifications = userIds.map(userId => [userId, message, type, JSON.stringify(metadata)]);
    await pool.execute(
      `INSERT INTO notifications (user_id, message, type, metadata) VALUES ${userIds.map(() => '(?, ?, ?, ?)').join(', ')}`,
      notifications.flat()
    );
  } catch (error) {
    console.error('Error creating broadcast notification:', error);
    throw error;
  }
};

// Mark notification as read
export const markAsRead = async (notificationId, userId) => {
  try {
    await pool.execute(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
};

// Mark all notifications as read for a user
export const markAllAsRead = async (userId) => {
  try {
    await pool.execute(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
      [userId]
    );
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
  }
};

// Get unread notification count
export const getUnreadCount = async (userId) => {
  try {
    const [[{ count }]] = await pool.execute(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    return count;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};

// Delete notification
export const deleteNotification = async (notificationId, userId) => {
  try {
    await pool.execute(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );
  } catch (error) {
    console.error('Error deleting notification:', error);
  }
};

// Clean old notifications (older than 30 days)
export const cleanOldNotifications = async () => {
  try {
    await pool.execute(
      'DELETE FROM notifications WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)'
    );
  } catch (error) {
    console.error('Error cleaning old notifications:', error);
  }
};

// Payment specific notifications
export const createPaymentNotification = async (userId, plan, amount, status, transactionId) => {
  const type = status === 'success' ? NOTIFICATION_TYPES.PAYMENT_SUCCESS : NOTIFICATION_TYPES.PAYMENT_FAILED;
  const message = status === 'success' 
    ? `Payment successful! You've subscribed to ${plan} plan for $${amount}.`
    : `Payment failed for ${plan} plan. Please try again or contact support.`;
  
  const metadata = { plan, amount, transactionId, status };
  
  return await createNotification(userId, message, type, metadata);
};

// Booking specific notifications
export const createBookingNotification = async (userId, service, date, status) => {
  const type = status === 'confirmed' ? NOTIFICATION_TYPES.BOOKING_CONFIRMED : NOTIFICATION_TYPES.BOOKING_CANCELLED;
  const message = status === 'confirmed'
    ? `Your booking for ${service} on ${date} has been confirmed.`
    : `Your booking for ${service} on ${date} has been cancelled.`;
  
  const metadata = { service, date, status };
  
  return await createNotification(userId, message, type, metadata);
};

// Pet specific notifications
export const createPetNotification = async (userId, petName, action) => {
  const type = action === 'added' ? NOTIFICATION_TYPES.PET_ADDED : NOTIFICATION_TYPES.PET_DELETED;
  const message = action === 'added'
    ? `${petName} has been added to your pets.`
    : `${petName} has been removed from your pets.`;
  
  const metadata = { petName, action };
  
  return await createNotification(userId, message, type, metadata);
};
