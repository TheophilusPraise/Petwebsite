// utils/emailService.js
import nodemailer from 'nodemailer';
import pool from '../config/db.js';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// 📧 Email Template with inline styles
const getStyledTemplate = (title, message) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; background-color: #fafafa;">
    <div style="text-align: center; padding-bottom: 10px;">
      <h2 style="color: #3f51b5;">🐾 PetCare Notification</h2>
    </div>
    <div style="background-color: #ffffff; padding: 20px; border-radius: 6px;">
      <h3 style="color: #333;">${title}</h3>
      <p style="color: #555; font-size: 16px; line-height: 1.5;">
        ${message}
      </p>
    </div>
    <div style="text-align: center; padding-top: 20px; font-size: 12px; color: #888;">
      <p>You're receiving this because you're registered on the PetCare platform.</p>
    </div>
  </div>
`;

// Reusable sender
const sendEmail = async ({ to, subject, text, html }) => {
  const mailOptions = {
    from: `"PetCare Admin" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to: ${to}`);
  } catch (err) {
    console.error(`❌ Failed to send email to ${to}:`, err);
  }
};

// Notify admin
export const notifyAdmin = async (subject, text) => {
  try {
    const [admins] = await pool.query('SELECT email FROM admins LIMIT 1');
    if (!admins.length) return;

    const html = getStyledTemplate(subject, text);

    await sendEmail({
      to: admins[0].email,
      subject,
      text,
      html
    });
  } catch (err) {
    console.error('❌ Admin notification failed:', err);
  }
};

// Broadcast to users
export const broadcastToUsers = async (subject, message) => {
  try {
    const [users] = await pool.query('SELECT id, email FROM users');
    if (!users.length) return;

    for (const user of users) {
      const html = getStyledTemplate(subject, message);

      await sendEmail({
        to: user.email,
        subject,
        text: message,
        html
      });

      await pool.query(
        'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
        [user.id, message]
      );
    }

    console.log(`✅ Broadcast sent to ${users.length} users.`);
  } catch (err) {
    console.error('❌ Broadcast failed:', err);
  }
};
