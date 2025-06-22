import express from 'express';
import multer from 'multer';
import { 
  getUserDashboard,
  getUserServices,
  getUserNotifications,
  getUserBookings,
  getUserPets,
  addPet,
  updatePetImage,
  getPetById,
  editPet,
  showBookPage,
  processBook
} from '../controllers/userController.js';
import { isAuthenticated } from '../middleware/authMiddleware.js';

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

const router = express.Router();

// Redirect admins to admin dashboard
router.get('/dashboard', isAuthenticated, (req, res, next) => {
  if (req.session.user.role === 'admin') {
    return res.redirect('/admin/dashboard');
  }
  next();
}, getUserDashboard);

// Other routes remain unchanged
router.get('/services', isAuthenticated, getUserServices);
router.get('/notifications', isAuthenticated, getUserNotifications);
router.get('/bookings', isAuthenticated, getUserBookings);
router.get('/pets', isAuthenticated, getUserPets);
router.post('/pets', isAuthenticated, upload.single('image'), addPet);
router.get('/book', isAuthenticated, showBookPage);
router.post('/book', isAuthenticated, processBook);
router.post('/pets/update-image/:id', isAuthenticated, upload.single('image'), updatePetImage);
router.get('/pets/:id', isAuthenticated, getPetById);
router.post('/pets/edit/:id', isAuthenticated, editPet);

export default router;
