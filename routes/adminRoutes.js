import express from 'express';
import multer from 'multer';
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
  deleteNotification,
  sendNotification,
  sendBroadcast,
  createPetByAdmin,
  deletePurchase
} from '../controllers/adminController.js';
import { isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Multer setup for pet image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Dashboard Route
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
router.post('/pets/create', isAdmin, upload.single('image'), createPetByAdmin);

// Notification Management Routes
router.get('/notifications', isAdmin, manageNotifications);
router.post('/notifications/delete/:id', isAdmin, deleteNotification);
router.post('/notifications/send', isAdmin, sendNotification);

// Broadcast Route
router.post('/broadcast', isAdmin, sendBroadcast);
router.post('/purchases/delete/:id', isAdmin, deletePurchase);
export default router;
