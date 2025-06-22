import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import { notifyAdmin } from '../utils/emailService.js';
import { sendOTPEmail } from '../utils/mailer.js';
import { createUser, findUserByEmail, updatePassword } from '../models/userModel.js';
import { createOTP, findValidOTP, markOTPUsed } from '../models/otpModel.js';

const generateOTP = () => crypto.randomInt(100000, 999999).toString();

// Show registration page
export const showRegister = (req, res) => {
  res.render('auth/register', { error: undefined, email: '' });
};

// Handle registration form
export const processRegister = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await findUserByEmail(email);
    if (user) {
      return res.render('auth/register', { error: 'Email already registered', email });
    }
    
    await createUser(email, 'user');
    const otp = generateOTP();
    
    console.log(`Sending OTP ${otp} to ${email} for registration`);
    await sendOTPEmail(email, otp);
    
    res.render('auth/verify-code', { email, purpose: 'register' });
  } catch (error) {
    console.error('Registration Error:', error);
    res.render('auth/register', { error: 'Server error', email: req.body?.email || '' });
  }
};

// Show login page
export const showLogin = (req, res) => {
  res.render('auth/login', { error: undefined, email: '' });
};

// Handle login form
export const processLogin = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await findUserByEmail(email);
    if (!user) {
      return res.render('auth/login', { error: 'Email not registered', email });
    }
    
    const otp = generateOTP();
    await createOTP(user.id, otp, 'login');
    
    console.log(`Sending OTP ${otp} to ${email} for login`);
    await sendOTPEmail(email, otp);
    
    res.render('auth/verify-code', { email, purpose: 'login' });
  } catch (error) {
    console.error('Login Error:', error);
    res.render('auth/login', { error: 'Server error', email: req.body?.email || '' });
  }
};

// Show password reset request page
export const showResetPassword = (req, res) => {
  res.render('auth/reset-password', { error: undefined, email: '' });
};

// Handle password reset request
export const processResetPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await findUserByEmail(email);
    if (!user) {
      return res.render('auth/reset-password', { error: 'Email not registered', email });
    }
    
    const otp = generateOTP();
    await createOTP(user.id, otp, 'reset');
    
    console.log(`Sending OTP ${otp} to ${email} for password reset`);
    await sendOTPEmail(email, otp);
    
    res.render('auth/verify-code', { email, purpose: 'reset' });
  } catch (error) {
    console.error('Password Reset Error:', error);
    res.render('auth/reset-password', { error: 'Server error', email: req.body?.email || '' });
  }
};

// Show new password form after successful OTP verification
export const showResetPasswordNew = (req, res) => {
  const { email } = req.query;
  res.render('auth/reset-password-new', { email, error: undefined });
};

// Handle new password submission
export const processResetPasswordNew = async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await updatePassword(email, hashedPassword);
    res.render('auth/reset-password-result', { success: 'Password updated successfully' });
  } catch (error) {
    console.error('Password Update Error:', error);
    res.render('auth/reset-password-new', { email: req.body.email, error: 'Failed to update password' });
  }
};
export const verifyCode = async (req, res) => {
  try {
    const { email, code, purpose } = req.body;
    const user = await findUserByEmail(email);
    
    if (!user) {
      return res.render('auth/verify-code', { 
        email, 
        purpose, 
        error: 'Invalid session' 
      });
    }
    
    const otpRecord = await findValidOTP(user.id, code, purpose);
    if (!otpRecord) {
      return res.render('auth/verify-code', { 
        email, 
        purpose, 
        error: 'Invalid or expired code' 
      });
    }
    
    await markOTPUsed(otpRecord.id);

    // Fetch complete user data including role using pool
    const [userData] = await pool.query(
      'SELECT id, email, role FROM users WHERE id = ?', 
      [user.id]
    );
    
    if (!userData.length) {
      return res.render('auth/verify-code', { 
        email, 
        purpose, 
        error: 'User not found' 
      });
    }

    const fullUser = userData[0];
    
    // Set session with role
    req.session.user = {
      id: fullUser.id,
      email: fullUser.email,
      role: fullUser.role
    };
    
    console.log('Session set after OTP:', req.session.user);
    console.log('Authenticated user:', fullUser.email);
    
    // Redirect based on role
    if (fullUser.role === 'admin') {
      return res.redirect('/admin/dashboard');
    } else {
      return res.redirect('/dashboard/user');
    }
    
  } catch (error) {
    console.error('OTP Verification Error:', error);
    res.render('auth/verify-code', { 
      email: req.body.email, 
      purpose: req.body.purpose, 
      error: 'Verification failed' 
    });
  }
};


export const logout = (req, res) => {
  req.session.destroy(err => {
    res.clearCookie('petcare.sid'); // Match your session key
    res.redirect('/auth/login');
  });
};


export const processARegister = async (req, res) => {
  // ... after successful registration ...
  await notifyAdmin('New User Registration', `New user registered: ${email}`);
};
// Default export for routes
export default {
  showRegister,
  processRegister,
  showLogin,
  processLogin,
  showResetPassword,
  processResetPassword,
  showResetPasswordNew,
  processResetPasswordNew,
  verifyCode,
  processARegister ,
  logout
};
