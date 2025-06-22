import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

// Debug logs
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);

import express from 'express';
import session from 'express-session';
import flash from 'connect-flash';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { Server } from 'socket.io';
import { createRequire } from 'module';
import fs from 'fs';
import pool from './config/db.js'; // Import your pool instance
// Create require function
const require = createRequire(import.meta.url);

// Create uploads directory if not exists
const uploadsDir = 'public/uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Load MySQL session store
const MySQLStore = require('express-mysql-session')(session);

// Create app and server
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Create __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MySQL Session Store Configuration
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

// Middleware
app.use(express.urlencoded({ extended: true })); // Parse form data
app.use(express.json()); // Parse JSON bodies
app.use(express.static(path.join(__dirname, 'public')));

app.set('trust proxy', 1); // Must come before session
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', '*');
  next();
});

// Session Middleware
app.use(session({
  key: 'petcare.sid',
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Must be false for HTTP
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Session save-redirect middleware
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

app.use(flash()); // Must come AFTER session

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import userRoutes from './routes/userRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
// At the top with other imports
import pricingRoutes from './routes/pricingRoutes.js';

// After other route declarations
app.use('/', pricingRoutes);

// Database connection
import './models/db.js';

// Apply routes
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/user', userRoutes);
app.use('/dashboard', dashboardRoutes);

// Add this function
// At the top of app.js


// ... (other imports and config)

// After database connection
async function initializeAdmin() {
  try {
    // 1. Create admins table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(100) NOT NULL UNIQUE,
        otp_code VARCHAR(6),
        otp_expiry DATETIME
      )
    `);
    
    // 2. Insert admin email if not exists
    await pool.query(`
      INSERT IGNORE INTO admins (email) 
      VALUES ('codefernocompany@gmail.com')
    `);
    
    console.log('Admin setup completed');
  } catch (err) {
    console.error('Admin setup error:', err);
  }
}

// Call after database connection is established
initializeAdmin();

// Home Route
app.get('/', (req, res) => {
    res.render('index', { user: req.session.user });
});

// Additional routes
app.get('/index', (req, res) => res.render('index'));
app.get('/about', (req, res) => res.render('about'));
app.get('/contact', (req, res) => res.render('contact'));


app.get('/services', (req, res) => res.render('services'));
app.get('/book', (req, res) => {
  res.render('user/book', { service: req.query.service || '' });
});

// Socket.io notifications
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Debug middleware
app.use((req, res, next) => {
  console.log('--- NEW REQUEST ---');
  console.log('URL:', req.url);
  console.log('Session ID:', req.sessionID);
  next();
});

app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;
  // ... send email ...
  await notifyAdmin('Contact Form Submission', `From: ${name} (${email})\nMessage: ${message}`);
  res.redirect('/contact?success=1');
});

// Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Export app for testing
export default app;
