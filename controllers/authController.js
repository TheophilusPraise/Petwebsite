import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import { notifyAdmin } from '../utils/emailService.js';
import { sendOTPEmail } from '../utils/mailer.js';
import {
  createUser,
  findUserByEmail,
  findUserByPhone,
  findUserByContact,
  updatePassword
} from '../models/userModel.js';
import {
  createOTP,
  findValidOTP,
  markOTPUsed
} from '../models/otpModel.js';

const generateOTP = () => crypto.randomInt(100000, 999999).toString();


// --- REGISTRATION ---
export const showRegister = (req, res) => {
  res.render('auth/register', { error: undefined, email: '', phone: '' });
};


export const processRegister = async (req, res) => {
  try {
    const { email, phone } = req.body;
    if (!email || !phone)
      return res.render('auth/register', {
        error: "Both email and phone are required.",
        email,
        phone
      });


    if (await findUserByEmail(email))
      return res.render('auth/register', { error: 'Email already registered', email, phone });


    if (await findUserByPhone(phone))
      return res.render('auth/register', { error: 'Phone already registered', email, phone });


    const userId = await createUser(email, phone, 'user');
    const otp = generateOTP();
    await createOTP(userId, otp, 'register');


    // Only send OTP via email (no SMS or WhatsApp)
    await Promise.allSettled([
      sendOTPEmail(email, otp),
    ]);


    res.render('auth/verify-code', { contact: email, phone, purpose: 'register' });
  } catch (error) {
    console.error('Registration Error:', error);
    res.render('auth/register', {
      error: 'Server error',
      email: req.body?.email,
      phone: req.body?.phone
    });
  }
};


// --- LOGIN ---
export const showLogin = (req, res) => {
  res.render('auth/login', { error: undefined, contact: '' });
};


export const processLogin = async (req, res) => {
  try {
    const { contact } = req.body;
    let user;
    if (contact.includes('@')) {
      user = await findUserByEmail(contact);
    } else {
      user = await findUserByPhone(contact);
    }
    if (!user)
      return res.render('auth/login', { error: 'No account with that email or phone', contact });


    const otp = generateOTP();
    await createOTP(user.id, otp, 'login');


    const tasks = [];
    if (user.email) tasks.push(sendOTPEmail(user.email, otp));
    // No WhatsApp or SMS calls here
    await Promise.allSettled(tasks);


    res.render('auth/verify-code', {
      contact,
      email: user.email,
      phone: user.phone,
      purpose: 'login'
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.render('auth/login', { error: 'Server error', contact: req.body?.contact || '' });
  }
};


// --- PASSWORD RESET ---
export const showResetPassword = (req, res) => {
  res.render('auth/reset-password', { error: undefined, contact: '' });
};


export const processResetPassword = async (req, res) => {
  try {
    const { contact } = req.body;
    let user;
    if (contact.includes('@')) {
      user = await findUserByEmail(contact);
    } else {
      user = await findUserByPhone(contact);
    }
    if (!user)
      return res.render('auth/reset-password', { error: 'Account not found', contact });


    const otp = generateOTP();
    await createOTP(user.id, otp, 'reset');


    const tasks = [];
    if (user.email) tasks.push(sendOTPEmail(user.email, otp));
    // No WhatsApp or SMS calls here
    await Promise.allSettled(tasks);


    res.render('auth/verify-code', { contact, email: user.email, phone: user.phone, purpose: 'reset' });
  } catch (error) {
    console.error('Password Reset Error:', error);
    res.render('auth/reset-password', { error: 'Server error', contact: req.body?.contact || '' });
  }
};


// --- SET NEW PASSWORD AFTER OTP ---
export const showResetPasswordNew = (req, res) => {
  const { contact } = req.query;
  res.render('auth/reset-password-new', { contact, error: undefined });
};


export const processResetPasswordNew = async (req, res) => {
  try {
    const { contact, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await updatePassword(contact, hashedPassword);
    res.render('auth/reset-password-result', { success: 'Password updated successfully' });
  } catch (error) {
    console.error('Password Update Error:', error);
    res.render('auth/reset-password-new', {
      contact: req.body.contact,
      error: 'Failed to update password'
    });
  }
};


// --- OTP VERIFICATION ---
export const verifyCode = async (req, res) => {
  try {
    const { contact, code, purpose } = req.body;
    let user;
    if (contact.includes('@')) {
      user = await findUserByEmail(contact);
    } else {
      user = await findUserByPhone(contact);
    }
    if (!user)
      return res.render('auth/verify-code', { contact, purpose, error: 'Invalid session' });


    const otpRecord = await findValidOTP(user.id, code, purpose);
    if (!otpRecord)
      return res.render('auth/verify-code', { contact, purpose, error: 'Invalid or expired code' });


    await markOTPUsed(otpRecord.id);


    const [userData] = await pool.query('SELECT id, email, phone, role FROM users WHERE id = ?', [user.id]);
    if (!userData.length)
      return res.render('auth/verify-code', { contact, purpose, error: 'User not found' });
    const fullUser = userData[0];


    req.session.user = {
      id: fullUser.id,
      email: fullUser.email,
      phone: fullUser.phone,
      role: fullUser.role
    };
    if (fullUser.role === 'admin') {
      return res.redirect('/admin/dashboard');
    } else {
      return res.redirect('/dashboard/user');
    }
  } catch (error) {
    console.error('OTP Verification Error:', error);
    res.render('auth/verify-code', {
      contact: req.body.contact,
      purpose: req.body.purpose,
      error: 'Verification failed'
    });
  }
};


// --- LOGOUT ---
export const logout = (req, res) => {
  req.session.destroy(err => {
    res.clearCookie('petcare.sid');
    res.redirect('/auth/login');
  });
};


// --- Notify Admin on Registration ---
export const processARegister = async (req, res) => {
  await notifyAdmin('New User Registration', `New user registered: ${req.body.email || req.body.phone}`);
};


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
  processARegister,
  logout
};
