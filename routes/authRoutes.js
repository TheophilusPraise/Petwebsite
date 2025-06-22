import express from 'express';
const router = express.Router();
import authController from '../controllers/authController.js';
import { logout } from '../controllers/authController.js';

// Login routes
router.get('/login', authController.showLogin);
router.post('/login', authController.processLogin);

// Logout route (using controller)
router.get('/logout', logout);

// Registration routes
router.get('/register', authController.showRegister);
router.post('/register', authController.processRegister);

// Password reset routes
router.get('/reset-password', authController.showResetPassword);
router.post('/reset-password', authController.processResetPassword);

// Verify code route
router.get('/verify-code', (req, res) => res.render('auth/verify-code'));
router.post('/verify-code', authController.verifyCode);

// New password routes
router.get('/reset-password-new', authController.showResetPasswordNew);
router.post('/reset-password-new', authController.processResetPasswordNew);

export default router;
