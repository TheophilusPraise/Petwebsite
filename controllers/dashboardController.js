// controllers/userController.js
import pool from '../config/db.js';
import multer from 'multer';
import path from 'path';
import bcrypt from 'bcrypt';
import { notifyAdmin } from '../utils/emailService.js';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

export const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed!'), false);
    }
  }
});

// Helper functions
const getPetsByUserId = async (userId) => {
  try {
    const [pets] = await pool.query('SELECT * FROM pets WHERE user_id = ?', [userId]);
    return pets;
  } catch (err) {
    console.error('Error fetching pets:', err);
    return [];
  }
};

const getBookingsByUserId = async (userId) => {
  try {
    const [bookings] = await pool.query(
      'SELECT * FROM bookings WHERE user_id = ? ORDER BY booking_date DESC',
      [userId]
    );
    return bookings;
  } catch (err) {
    console.error('Error fetching bookings:', err);
    return [];
  }
};

const addNotification = async (userId, message) => {
  try {
    await pool.execute(
      'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
      [userId, message]
    );
    
    // Notify admin about important events
    if (message.includes('booking') || message.includes('pet')) {
      await notifyAdmin('User Activity', `User ${userId}: ${message}`);
    }
  } catch (err) {
    console.error('Error adding notification:', err);
  }
};

function getErrorMessage(code) {
  switch(code) {
    case 'empty_body': 
      return 'No data received. Please fill the form.';
    case 'name_and_species_required':
      return 'Pet name and species are required.';
    case 'server_error':
      return 'Server failed to process request. Please try again.';
    case 'missing_fields':
      return 'Please fill all required fields.';
    case 'invalid_image':
      return 'Only JPG, PNG or GIF images are allowed (max 5MB).';
    default:
      return 'An error occurred.';
  }
}

// Dashboard Controller
export const getUserDashboard = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect('/auth/login');
    
    // Get bookings stats
    const [bookingsResult] = await pool.query(
      'SELECT COUNT(*) AS totalBookings FROM bookings WHERE user_id = ?', 
      [userId]
    );
    
    // Get pets stats
    const [petsResult] = await pool.query(
      'SELECT COUNT(*) AS totalPets FROM pets WHERE user_id = ?',
      [userId]
    );
    
    // Get notifications
    const [notifications] = await pool.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
      [userId]
    );
    
    // Get upcoming bookings
    const [upcomingBookings] = await pool.query(
      `SELECT id, service, booking_date, status 
       FROM bookings 
       WHERE user_id = ? AND booking_date >= NOW()
       ORDER BY booking_date ASC
       LIMIT 5`,
      [userId]
    );

    const stats = {
      totalBookings: bookingsResult[0].totalBookings || 0,
      totalPets: petsResult[0].totalPets || 0,
      upcomingBookings: upcomingBookings || []
    };

    res.render('user/dashboard', {
      user: req.session.user,
      stats,
      notifications: notifications || []
    });
  } catch (err) {
    console.error('Error loading dashboard:', err);
    res.render('user/dashboard', {
      user: req.session.user,
      stats: { 
        totalBookings: 0,
        totalPets: 0,
        upcomingBookings: []
      },
      notifications: []
    });
  }
};

export const getUserServices = (req, res) => {
  res.render('user/services', { user: req.session.user, services: [] });
};

export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect('/auth/login');
    
    const [notifications] = await pool.query(
      `SELECT n.*, u.email AS user_email 
       FROM notifications n
       JOIN users u ON n.user_id = u.id
       WHERE n.user_id = ? 
       ORDER BY n.created_at DESC`,
      [userId]
    );

    res.render('user/notifications', { 
      user: req.session.user, 
      notifications: notifications || [] 
    });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.render('user/notifications', { 
      user: req.session.user, 
      notifications: [] 
    });
  }
};

export const getUserBookings = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect('/auth/login');
    
    const bookings = await getBookingsByUserId(userId);
    
    res.render('user/bookings', {
      user: req.session.user,
      bookings: bookings || [],
      success: req.query.success ? true : false,
      error: req.query.error ? getErrorMessage(req.query.error) : null
    });
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.render('user/bookings', {
      user: req.session.user,
      bookings: [],
      success: false,
      error: 'Failed to load bookings'
    });
  }
};

export const getUserPets = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect('/auth/login');
    
    const pets = await getPetsByUserId(userId);
    res.render('user/pets', { 
      pets: pets || [],
      user: req.session.user,
      error: req.query.error ? getErrorMessage(req.query.error) : null
    });
  } catch (err) {
    console.error('Error in getUserPets:', err);
    res.render('user/pets', {
      pets: [],
      user: req.session.user,
      error: 'Failed to load pets'
    });
  }
};

export const addPet = async (req, res) => {
  try {
    const { name, species, breed, age } = req.body;
    const userId = req.session.user?.id;
    
    if (!userId) return res.redirect('/auth/login');
    if (!name || !species) {
      return res.redirect('/user/pets?error=name_and_species_required');
    }

    let image_url = null;
    if (req.file) {
      image_url = '/uploads/' + req.file.filename;
    }
    
    await pool.execute(
      'INSERT INTO pets (name, species, breed, age, image_url, user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [name, species, breed || null, age || null, image_url, userId]
    );

    // Add notification
    await addNotification(userId, `You added a new pet: ${name}`);
    
    res.redirect('/user/pets');
  } catch (err) {
    console.error('Database error:', err);
    
    let errorCode = 'server_error';
    if (err.message.includes('image format')) {
      errorCode = 'invalid_image';
    }
    
    res.redirect(`/user/pets?error=${errorCode}`);
  }
};

export const updatePetImage = async (req, res) => {
  const petId = req.params.id;
  try {
    let image_url = null;
    if (req.file) {
      image_url = '/uploads/' + req.file.filename;
    }

    await pool.execute('UPDATE pets SET image_url = ? WHERE id = ?', [image_url, petId]);
    
    // Add notification
    const userId = req.session.user?.id;
    await addNotification(userId, 'Pet image updated successfully');
    
    res.redirect('/user/pets');
  } catch (err) {
    console.error('Error updating pet image:', err);
    
    let errorCode = 'server_error';
    if (err.message.includes('image format')) {
      errorCode = 'invalid_image';
    }
    
    res.redirect(`/user/pets?error=${errorCode}`);
  }
};

export const getPetById = async (req, res) => {
  const petId = req.params.id;
  try {
    const [pets] = await pool.query('SELECT * FROM pets WHERE id = ?', [petId]);
    if (!pets.length) return res.status(404).json({ error: 'Pet not found' });
    res.json(pets[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load pet' });
  }
};

export const editPet = async (req, res) => {
  const petId = req.params.id;
  const { name, species, breed, age } = req.body;
  try {
    await pool.execute(
      'UPDATE pets SET name=?, species=?, breed=?, age=? WHERE id=?',
      [name, species, breed || null, age || null, petId]
    );

    // Add notification
    const userId = req.session.user?.id;
    await addNotification(userId, `Pet ${name} updated successfully`);
    
    res.redirect('/user/pets');
  } catch (err) {
    console.error('Error updating pet:', err);
    res.redirect('/user/pets?error=server_error');
  }
};

export const showBookPage = (req, res) => {
  res.render('user/book', { 
    user: req.session.user, 
    service: req.query.service || '', 
    error: req.query.error ? getErrorMessage(req.query.error) : null 
  });
};

export const processBook = async (req, res) => {
  try {
    const { service, booking_date, notes } = req.body;
    const userId = req.session.user?.id;
    
    if (!userId) return res.redirect('/auth/login');
    if (!service || !booking_date) {
      return res.redirect('/user/book?error=missing_fields');
    }
    
    await pool.execute(
      'INSERT INTO bookings (user_id, service, booking_date, notes) VALUES (?, ?, ?, ?)',
      [userId, service, booking_date, notes || null]
    );

    // Add notification
    await addNotification(userId, `New booking created for ${service}`);
    
    // Notify admin
    await notifyAdmin(
      'New Booking', 
      `User ${req.session.user.email} booked: ${service} on ${booking_date}`
    );
    
    res.redirect('/user/bookings?success=1');
  } catch (err) {
    console.error('Error saving booking:', err);
    res.redirect('/user/book?error=server_error');
  }
};

// New function: Update user profile
export const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const userId = req.session.user?.id;
    
    if (!userId) return res.redirect('/auth/login');
    
    await pool.execute(
      'UPDATE users SET name = ?, email = ? WHERE id = ?',
      [name, email, userId]
    );
    
    // Update session
    req.session.user.name = name;
    req.session.user.email = email;
    
    res.redirect('/user/profile?success=1');
  } catch (err) {
    console.error('Error updating profile:', err);
    res.redirect('/user/profile?error=update_failed');
  }
};

// New function: Change password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.user?.id;
    
    if (!userId) return res.redirect('/auth/login');
    if (newPassword !== confirmPassword) {
      return res.redirect('/user/profile?error=password_mismatch');
    }
    
    // Verify current password
    const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [userId]);
    if (!rows.length) return res.redirect('/auth/login');
    
    const isValid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!isValid) {
      return res.redirect('/user/profile?error=invalid_password');
    }
    
    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.execute(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [hashedPassword, userId]
    );
    
    res.redirect('/user/profile?success=2');
  } catch (err) {
    console.error('Error changing password:', err);
    res.redirect('/user/profile?error=password_change_failed');
  }
};
