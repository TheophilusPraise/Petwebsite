// routes/dashboardRoutes.js
import express from 'express';
import { getUserDashboard } from '../controllers/userController.js';
import { isAuthenticated } from '../middleware/authMiddleware.js';

const router = express.Router();

// Render dashboard directly
router.get('/user', isAuthenticated, getUserDashboard);
router.get('/user', isAuthenticated, (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') {
    return res.redirect('/admin/dashboard');
  }
  next();
}, getUserDashboard);

export default router;
