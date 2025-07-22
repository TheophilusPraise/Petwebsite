// controllers/authController.js

import { sendOTPEmail } from '../utils/emailService.js';
import { sendOTPSMSWithTermii } from "../utils/termiiService.js";
import { sendOTPWhatsApp } from '../utils/whatsappService.js';
import { saveOtpForUser } from '../models/otpModel.js';
import { createUser, findUserByEmail, findUserByPhone } from '../models/userModel.js';

const generateRandomOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

/**
 * Registration: expects both email AND phone.
 * Sends the same OTP to Email, SMS (via Termii), and WhatsApp.
 */
export const registerAndSendOTP = async (req, res) => {
  const { email, phone } = req.body;
  if (!email || !phone)
    return res.status(400).render('auth/register', { error: 'Both email and phone are required', email, phone });

  if (await findUserByEmail(email))
    return res.render('auth/register', { error: 'Email already used', email, phone });
  if (await findUserByPhone(phone))
    return res.render('auth/register', { error: 'Phone number already used', email, phone });

  try {
    const userId = await createUser(email, phone);
    const otp = generateRandomOTP();
    await saveOtpForUser(userId, otp, 'register');

    // Use Termii for SMS sending!
    await Promise.allSettled([
      sendOTPEmail(email, otp),
      sendOTPSMSWithTermii(phone, otp), // <-- Termii for SMS
      sendOTPWhatsApp(phone, otp)
    ]);

    res.render('auth/verify-code', { email, phone });
  } catch (err) {
    console.error("[Register] Error sending OTP:", err);
    res.render('auth/register', { error: 'Server error sending OTP', email, phone });
  }
};

/**
 * Login: expects either email or phone.
 * Sends OTP to all channels if available.
 */
export const loginSendOTP = async (req, res) => {
  const { contact } = req.body;

  let user;
  if (contact.includes('@')) {
    user = await findUserByEmail(contact);
  } else {
    user = await findUserByPhone(contact);
  }
  if (!user) return res.render('auth/login', { error: 'Account not found', contact });

  try {
    const otp = generateRandomOTP();
    await saveOtpForUser(user.id, otp, 'login');

    const deliveries = [];
    if (user.email) deliveries.push(sendOTPEmail(user.email, otp));
    if (user.phone) {
      deliveries.push(sendOTPSMSWithTermii(user.phone, otp)); // <-- Switch SMS to Termii
      deliveries.push(sendOTPWhatsApp(user.phone, otp));
    }
    await Promise.allSettled(deliveries);

    res.render('auth/verify-code', { email: user.email, phone: user.phone, contact });
  } catch (err) {
    console.error("[Login] Error sending OTP:", err);
    res.render('auth/login', { error: 'Server error sending OTP', contact });
  }
};
