// services/notificationService.js
import { 
  getRecentNotifications, 
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount
} from '../models/notificationModel.js';
import nodemailer from 'nodemailer';
import pool from '../config/db.js';

// Email transporter (reuse your existing configuration)
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Notification types
export const NOTIFICATION_TYPES = {
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  BOOKING_CONFIRMED: 'booking_confirmed',
  BOOKING_CANCELLED: 'booking_cancelled',
  BOOKING_UPDATED: 'booking_updated',
  PET_ADDED: 'pet_added',
  PET_UPDATED: 'pet_updated',
  PET_DELETED: 'pet_deleted',
  ADMIN_MESSAGE: 'admin_message',
  SYSTEM_ALERT: 'system_alert',
  REMINDER: 'reminder',
  WELCOME: 'welcome'
};

// Rate limiting for notifications (prevent spam)
const notificationLimits = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_NOTIFICATIONS_PER_MINUTE = 10;

function checkRateLimit(userId) {
  const now = Date.now();
  const userLimits = notificationLimits.get(userId) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
  
  if (now > userLimits.resetTime) {
    userLimits.count = 0;
    userLimits.resetTime = now + RATE_LIMIT_WINDOW;
  }
  
  if (userLimits.count >= MAX_NOTIFICATIONS_PER_MINUTE) {
    return false; // Rate limited
  }
  
  userLimits.count++;
  notificationLimits.set(userId, userLimits);
  return true;
}

// Send email notification
async function sendEmailNotification(userEmail, subject, message, template = 'default') {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: `PetCare: ${subject}`,
      html: generateEmailTemplate(template, subject, message)
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${userEmail}: ${subject}`);
  } catch (error) {
    console.error('Email notification failed:', error);
  }
}

// Generate email templates
function generateEmailTemplate(template, subject, message) {
  const baseTemplate = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1><i class="fa-solid fa-paw"></i> PetCare</h1>
      </div>
      <div style="background: white; padding: 30px; border: 1px solid #eee; border-radius: 0 0 8px 8px;">
        <h2 style="color: #2c3e50;">${subject}</h2>
        <p style="font-size: 16px; line-height: 1.6; color: #333;">${message}</p>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666;">
          <p>Best regards,<br>The PetCare Team</p>
        </div>
      </div>
    </div>
  `;
  
  return baseTemplate;
}

// Main notification service class
export class NotificationService {
  
  // Get recent notifications
  static async getRecent(userId, limit = 5) {
    return await getRecentNotifications(userId, limit);
  }

  // Get all user notifications with pagination
  static async getUserNotifications(userId, page = 1, limit = 10) {
    return await getUserNotifications(userId, page, limit);
  }

  // Mark notification as read
  static async markAsRead(notificationId, userId) {
    return await markAsRead(notificationId, userId);
  }

  // Mark all notifications as read
  static async markAllAsRead(userId) {
    return await markAllAsRead(userId);
  }

  // Get unread count
  static async getUnreadCount(userId) {
    return await getUnreadCount(userId);
  }

  // Generic notification sender
  static async sendNotification(userId, message, type = NOTIFICATION_TYPES.SYSTEM_ALERT, metadata = null, sendEmail = false) {
    try {
      // Check rate limiting
      if (!checkRateLimit(userId)) {
        console.log(`Rate limit exceeded for user ${userId}`);
        return false;
      }

      // Create in-app notification
      const notificationId = await createNotification(userId, message, type, metadata);

      // Send email if requested
      if (sendEmail) {
        const [user] = await pool.query('SELECT email FROM users WHERE id = ?', [userId]);
        if (user.length > 0) {
          await sendEmailNotification(user[0].email, 'New Notification', message);
        }
      }

      return notificationId;
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  }

  // Payment notifications
  static async notifyPaymentSuccess(userId, userEmail, plan, amount, transactionId) {
    const message = `Payment successful! You've subscribed to ${plan} plan for $${amount}. Transaction ID: ${transactionId}`;
    const metadata = { plan, amount, transactionId, status: 'success' };
    
    await this.sendNotification(userId, message, NOTIFICATION_TYPES.PAYMENT_SUCCESS, metadata);
    await sendEmailNotification(userEmail, 'Payment Successful', message, 'payment_success');
    
    // Notify admin about new payment
    await this.notifyAllAdmins(`New payment: $${amount} for ${plan} plan`, NOTIFICATION_TYPES.ADMIN_MESSAGE);
  }

  static async notifyPaymentFailure(userId, userEmail, plan, amount, error = '') {
    const message = `Payment failed for ${plan} plan ($${amount}). ${error ? `Error: ${error}` : 'Please try again or contact support.'}`;
    const metadata = { plan, amount, error, status: 'failed' };
    
    await this.sendNotification(userId, message, NOTIFICATION_TYPES.PAYMENT_FAILED, metadata);
    await sendEmailNotification(userEmail, 'Payment Failed', message, 'payment_failed');
  }

  // Booking notifications
  static async notifyBookingConfirmed(userId, userEmail, service, date) {
    const message = `Your booking for ${service} on ${new Date(date).toLocaleDateString()} has been confirmed.`;
    const metadata = { service, date, status: 'confirmed' };
    
    await this.sendNotification(userId, message, NOTIFICATION_TYPES.BOOKING_CONFIRMED, metadata);
    await sendEmailNotification(userEmail, 'Booking Confirmed', message);
    
    // Notify admin
    await this.notifyAllAdmins(`New booking confirmed: ${service} for ${userEmail}`, NOTIFICATION_TYPES.ADMIN_MESSAGE);
  }

  static async notifyBookingCancelled(userId, userEmail, service, date, reason = '') {
    const message = `Your booking for ${service} on ${new Date(date).toLocaleDateString()} has been cancelled. ${reason}`;
    const metadata = { service, date, reason, status: 'cancelled' };
    
    await this.sendNotification(userId, message, NOTIFICATION_TYPES.BOOKING_CANCELLED, metadata);
    await sendEmailNotification(userEmail, 'Booking Cancelled', message);
  }

  static async notifyBookingUpdated(userId, userEmail, service, oldDate, newDate) {
    const message = `Your booking for ${service} has been rescheduled from ${new Date(oldDate).toLocaleDateString()} to ${new Date(newDate).toLocaleDateString()}.`;
    const metadata = { service, oldDate, newDate, status: 'updated' };
    
    await this.sendNotification(userId, message, NOTIFICATION_TYPES.BOOKING_UPDATED, metadata);
    await sendEmailNotification(userEmail, 'Booking Updated', message);
  }

  // Pet notifications
  static async notifyPetAdded(userId, userEmail, petName, byAdmin = false) {
    const message = byAdmin 
      ? `${petName} has been added to your pets by our admin team.`
      : `${petName} has been successfully added to your pets.`;
    const metadata = { petName, action: 'added', byAdmin };
    
    await this.sendNotification(userId, message, NOTIFICATION_TYPES.PET_ADDED, metadata);
    
    if (byAdmin) {
      await sendEmailNotification(userEmail, 'New Pet Added', message);
    }
  }

  static async notifyPetUpdated(userId, userEmail, petName, updates) {
    const message = `${petName}'s information has been updated.`;
    const metadata = { petName, updates, action: 'updated' };
    
    await this.sendNotification(userId, message, NOTIFICATION_TYPES.PET_UPDATED, metadata);
  }

  static async notifyPetDeleted(userId, userEmail, petName, byAdmin = false) {
    const message = byAdmin
      ? `${petName} has been removed from your pets by our admin team.`
      : `${petName} has been removed from your pets.`;
    const metadata = { petName, action: 'deleted', byAdmin };
    
    await this.sendNotification(userId, message, NOTIFICATION_TYPES.PET_DELETED, metadata);
    
    if (byAdmin) {
      await sendEmailNotification(userEmail, 'Pet Removed', message);
    }
  }

  // Admin notifications
  static async notifyAllAdmins(message, type = NOTIFICATION_TYPES.ADMIN_MESSAGE, metadata = null) {
    try {
      const [admins] = await pool.query('SELECT id, email FROM users WHERE role = "admin"');
      
      for (const admin of admins) {
        await this.sendNotification(admin.id, message, type, metadata);
        // Email admins for important notifications
        if (type === NOTIFICATION_TYPES.ADMIN_MESSAGE) {
          await sendEmailNotification(admin.email, 'Admin Alert', message);
        }
      }
    } catch (error) {
      console.error('Error notifying admins:', error);
    }
  }

  // Broadcast notifications
  static async broadcastToAllUsers(message, type = NOTIFICATION_TYPES.SYSTEM_ALERT, metadata = null, sendEmails = false) {
    try {
      const [users] = await pool.query('SELECT id, email FROM users WHERE role != "admin"');
      
      for (const user of users) {
        await this.sendNotification(user.id, message, type, metadata, sendEmails);
      }
      
      console.log(`Broadcast notification sent to ${users.length} users`);
    } catch (error) {
      console.error('Error broadcasting notification:', error);
    }
  }

  // Welcome notification for new users
  static async sendWelcomeNotification(userId, userEmail, userName) {
    const message = `Welcome to PetCare, ${userName || 'valued customer'}! We're excited to help you take care of your furry friends.`;
    const metadata = { type: 'welcome', userName };
    
    await this.sendNotification(userId, message, NOTIFICATION_TYPES.WELCOME, metadata);
    await sendEmailNotification(userEmail, 'Welcome to PetCare!', 
      `Dear ${userName || 'Pet Lover'},\n\nWelcome to PetCare! We're thrilled to have you join our community of pet enthusiasts.\n\nGet started by:\n- Adding your pets to your profile\n- Exploring our services\n- Booking your first appointment\n\nIf you have any questions, our support team is always here to help!`);
  }

  // Reminder notifications
  static async sendReminder(userId, userEmail, reminderType, details) {
    let message = '';
    let metadata = { reminderType, details };
    
    switch (reminderType) {
      case 'booking':
        message = `Reminder: You have an upcoming ${details.service} appointment on ${new Date(details.date).toLocaleDateString()}.`;
        break;
      case 'checkup':
        message = `It's time for ${details.petName}'s regular checkup. Book an appointment today!`;
        break;
      case 'vaccination':
        message = `${details.petName}'s vaccination is due. Don't forget to schedule an appointment.`;
        break;
      default:
        message = `Reminder: ${details.message}`;
    }
    
    await this.sendNotification(userId, message, NOTIFICATION_TYPES.REMINDER, metadata);
    await sendEmailNotification(userEmail, 'PetCare Reminder', message);
  }

  // System maintenance notifications
  static async notifySystemMaintenance(maintenanceStart, maintenanceEnd, description) {
    const message = `Scheduled maintenance: ${description}. Service may be temporarily unavailable from ${new Date(maintenanceStart).toLocaleString()} to ${new Date(maintenanceEnd).toLocaleString()}.`;
    const metadata = { maintenanceStart, maintenanceEnd, description };
    
    await this.broadcastToAllUsers(message, NOTIFICATION_TYPES.SYSTEM_ALERT, metadata, true);
  }

  // Clean up old notifications (run periodically)
  static async cleanupOldNotifications(daysOld = 30) {
    try {
      await pool.execute(
        'DELETE FROM notifications WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
        [daysOld]
      );
      console.log(`Cleaned up notifications older than ${daysOld} days`);
    } catch (error) {
      console.error('Error cleaning up notifications:', error);
    }
  }
}

// Export individual functions for backward compatibility
export const getRecent = (userId, limit) => NotificationService.getRecent(userId, limit);
export const sendNotification = (userId, message, type, metadata) => NotificationService.sendNotification(userId, message, type, metadata);

// Export the service as default
export default NotificationService;
