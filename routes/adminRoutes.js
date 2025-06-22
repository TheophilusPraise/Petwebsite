import express from 'express';
import { 
  getAdminDashboard,
  manageUsers,
  createUser,
  updateUser,
  deleteUser,
  manageBookings,
  createBooking,
  updateBookingStatus,
  managePets,
  deletePet,
  manageNotifications,
  sendNotification,
  sendBroadcast
} from '../controllers/adminController.js';
import { isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Dashboard
router.get('/dashboard', isAdmin, getAdminDashboard);

// User Management Routes
router.get('/users', isAdmin, manageUsers);
router.post('/users/create', isAdmin, createUser);
router.post('/users/update', isAdmin, updateUser);
router.post('/users/delete/:id', isAdmin, deleteUser);

// Booking Management Routes
router.get('/bookings', isAdmin, manageBookings);
router.post('/bookings/create', isAdmin, createBooking);
router.post('/bookings/update', isAdmin, updateBookingStatus);

// Pet Management Routes
router.get('/pets', isAdmin, managePets);
router.post('/pets/delete/:id', isAdmin, deletePet);

// Notification Management Routes
router.get('/notifications', isAdmin, manageNotifications);
router.post('/notifications/send', isAdmin, sendNotification);

// Broadcast Route
router.post('/broadcast', isAdmin, sendBroadcast);

export default router;
