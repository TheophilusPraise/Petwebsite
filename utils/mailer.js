// utils/emailService.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

// Setup the transporter for Gmail SMTP
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Base email wrapper (header, footer, brand style)
const wrapWithTemplate = (content) => `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f9f9f9; padding: 30px;">
    <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 0 10px rgba(0,0,0,0.05);">
      <div style="background-color: #4e6ef5; color: white; padding: 20px 30px;">
        <h1 style="margin: 0; font-size: 22px;">🐾 PetCare</h1>
      </div>
      <div style="padding: 30px;">
        ${content}
      </div>
      <div style="background-color: #f1f1f1; text-align: center; padding: 15px; font-size: 12px; color: #777;">
        You’re receiving this email because you’re registered on PetCare. Please do not reply to this message.
      </div>
    </div>
  </div>
`;

// Email Templates
const emailTemplates = {
  otp: (otp) => wrapWithTemplate(`
    <h2 style="color: #333;">Your Verification Code</h2>
    <p style="font-size: 16px;">Hello,</p>
    <p style="font-size: 16px;">Use the code below to complete your action:</p>
    <div style="font-size: 28px; font-weight: bold; color: #4e6ef5; margin: 20px 0;">${otp}</div>
    <p style="font-size: 14px; color: #666;">This code will expire in 10 minutes. For your security, never share this code with anyone.</p>
  `),

  reset: (resetLink) => wrapWithTemplate(`
    <h2 style="color: #333;">Reset Your Password</h2>
    <p style="font-size: 16px;">We received a request to reset your PetCare account password.</p>
    <a href="${resetLink}" style="display: inline-block; margin: 20px 0; padding: 12px 24px; background-color: #4e6ef5; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
    <p style="font-size: 14px; color: #666;">This link will expire in 10 minutes. If you didn't request this, you can ignore this message.</p>
  `)
};

// Send OTP Email
export const sendOTPEmail = async (email, otp) => {
  try {
    await transporter.sendMail({
      from: `PetCare <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your PetCare Verification Code',
      html: emailTemplates.otp(otp)
    });
    console.log(`✅ OTP email sent to ${email}`);
  } catch (err) {
    console.error(`❌ Failed to send OTP to ${email}:`, err);
  }
};

// Send Password Reset Email
export const sendPasswordResetEmail = async (email, resetLink) => {
  try {
    await transporter.sendMail({
      from: `PetCare <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Reset Your PetCare Password',
      html: emailTemplates.reset(resetLink)
    });
    console.log(`✅ Password reset email sent to ${email}`);
  } catch (err) {
    console.error(`❌ Failed to send reset email to ${email}:`, err);
  }
};
