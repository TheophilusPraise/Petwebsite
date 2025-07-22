import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import nodemailer from 'nodemailer';
import { sendSmsWithSendchamp, sendWhatsappWithSendchamp } from './services/sendchampNotifier.js';
import cron from 'node-cron';
import express from 'express';
import session from 'express-session';
import flash from 'connect-flash';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { Server } from 'socket.io';
import { createRequire } from 'module';
import fs from 'fs';
import pool from './config/db.js';

const require = createRequire(import.meta.url);

const uploadsDir = 'public/uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const MySQLStore = require('express-mysql-session')(session);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sessionStore = new MySQLStore({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  createDatabaseTable: true,
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', '*');
  next();
});

app.use(session({
  key: 'petcare.sid',
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use((req, res, next) => {
  const oldRedirect = res.redirect;
  res.redirect = function (...args) {
    if (req.session) {
      req.session.save(() => Reflect.apply(oldRedirect, this, args));
    } else {
      Reflect.apply(oldRedirect, this, args);
    }
  };
  next();
});
app.use('/admin', adminRoutes);

app.use(flash());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import userRoutes from './routes/userRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import pricingRoutes from './routes/pricingRoutes.js';

app.use('/', pricingRoutes);

import './models/db.js';

app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/user', userRoutes);
app.use('/dashboard', dashboardRoutes);

async function initializeAdmin() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(100) NOT NULL UNIQUE,
        otp_code VARCHAR(6),
        otp_expiry DATETIME
      )
    `);

    await pool.query(`
      INSERT IGNORE INTO admins (email) 
      VALUES ('codefernocompany@gmail.com')
    `);

    console.log('Admin setup completed');
  } catch (err) {
    console.error('Admin setup error:', err);
  }
}

initializeAdmin();

app.get('/', (req, res) => {
  res.render('index', { user: req.session.user });
});
app.get('/index', (req, res) => res.render('index'));
app.get('/about', (req, res) => res.render('about'));
app.get('/contact', (req, res) => res.render('contact'));
app.get('/services', (req, res) => res.render('services'));
app.get('/book', (req, res) => {
  res.render('user/book', { service: req.query.service || '' });
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

app.use((req, res, next) => {
  console.log('--- NEW REQUEST ---');
  console.log('URL:', req.url);
  console.log('Session ID:', req.sessionID);
  next();
});

app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;
  await notifyAdmin('Contact Form Submission', `From: ${name} (${email})\nMessage: ${message}`);
  res.redirect('/contact?success=1');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// ------------ REMINDER SYSTEM SECTION ------------------

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

app.post('/user/pets/set-reminder/:petId', async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const user_id = req.session.user.id;
    const pet_id = req.params.petId;
    const { description, time, sendEmail, sendSMS, sendWhatsApp, phone } = req.body;

    if (!description || !time)
      return res.status(400).json({ error: 'Missing info' });
    if ((sendSMS || sendWhatsApp) && !phone)
      return res.status(400).json({ error: 'Phone required for SMS/WhatsApp reminder' });

    await pool.query(
      `INSERT INTO reminders (user_id, pet_id, description, remind_at, send_email, send_sms, send_whatsapp, sms_phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, pet_id, description, time, sendEmail ? 1 : 0, sendSMS ? 1 : 0, sendWhatsApp ? 1 : 0, (sendSMS || sendWhatsApp) ? phone : null]
    );
    res.status(200).json({ message: 'Reminder scheduled!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to set reminder' });
  }
});

app.get('/user/pets/:petId', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM pets WHERE id = ?', [req.params.petId]);
    if (!rows.length) return res.status(404).json({ error: 'Pet not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pet' });
  }
});

// Async, non-blocking cron job for reminders
cron.schedule('* * * * *', async () => {
  try {
    const [reminders] = await pool.query(
      `SELECT r.*, u.email as user_email
       FROM reminders r
       JOIN users u ON r.user_id = u.id
       WHERE r.status='pending' AND r.remind_at <= NOW()`
    );
    // Process up to e.g. 50 reminders per tick to avoid blocking
    for (const r of reminders.slice(0, 50)) {
      try {
        // Email
        if (r.send_email && r.user_email) {
          await transporter.sendMail({
            from: process.env.SITE_EMAIL,
            to: r.user_email,
            subject: `PetCare: Reminder for your pet`,
            text: `Hi! This is your reminder: "${r.description}" for your pet at ${r.remind_at}.`
          });
        }
        // SMS
        if (r.send_sms && r.sms_phone) {
          const phone = r.sms_phone.startsWith('+') ? r.sms_phone.slice(1) : r.sms_phone;
          await sendSmsWithSendchamp(phone, `PetCare: ${r.description} for your pet at ${r.remind_at}`);
        }
        // WhatsApp
        if (r.send_whatsapp && r.sms_phone) {
          const phone = r.sms_phone.startsWith('+') ? r.sms_phone.slice(1) : r.sms_phone;
          await sendWhatsappWithSendchamp(phone, `PetCare WhatsApp: ${r.description} for your pet at ${r.remind_at}`);
        }
        // Mark as sent
        await pool.query('UPDATE reminders SET status="sent" WHERE id=?', [r.id]);
      } catch (remindErr) {
        // Log, but continue with next reminder
        console.error('[Reminder Cron Error - Single Reminder]', remindErr);
      }
    }
    if (reminders.length) {
      console.log(`[Reminders] Processed ${reminders.length} reminders`);
    }
  } catch (err) {
    console.error('[Reminders Cron Error]', err);
  }
});

// ------------ END OF REMINDER SYSTEM SECTION ------------------
// Export app for testing
export default app;
