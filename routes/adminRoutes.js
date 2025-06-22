import express from 'express';
import { 
  getAdminDashboard,
  manageUsers,
  deleteUser,
  manageBookings,
  updateBookingStatus,
  managePets,
  deletePet,
  manageNotifications,
  sendNotification,
  sendBroadcast  // Added to the import list
} from '../controllers/adminController.js';
import { isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Dashboard
router.get('/dashboard', isAdmin, getAdminDashboard);

// Broadcast message to all users
router.post('/broadcast', isAdmin, sendBroadcast);

// User Management
router.get('/users', isAdmin, manageUsers);
router.post('/users/delete/:id', isAdmin, deleteUser);

// Booking Management
router.get('/bookings', isAdmin, manageBookings);
router.post('/bookings/update-status/:id', isAdmin, updateBookingStatus);

// Pet Management
router.get('/pets', isAdmin, managePets);
router.post('/pets/delete/:id', isAdmin, deletePet);

// Notification Management
router.get('/notifications', isAdmin, manageNotifications);
router.post('/notifications/send', isAdmin, sendNotification);

export default router;
