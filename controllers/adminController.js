// controllers/adminController.js
import pool from '../config/db.js';

// Helper function to add notifications
const addNotification = async (userId, message) => {
  try {
    await pool.execute(
      'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
      [userId, message]
    );
  } catch (err) {
    console.error('Error adding notification:', err);
  }
};

// Admin Dashboard
export const getAdminDashboard = async (req, res) => {
  try {
    // Get stats from database
    const [[{ totalUsers }]] = await pool.query('SELECT COUNT(*) AS totalUsers FROM users');
    const [[{ totalBookings }]] = await pool.query('SELECT COUNT(*) AS totalBookings FROM bookings');
    const [[{ totalPets }]] = await pool.query('SELECT COUNT(*) AS totalPets FROM pets');
    const [[{ totalNotifications }]] = await pool.query('SELECT COUNT(*) AS totalNotifications FROM notifications');
    
    // Get data for modals
    const [users] = await pool.query('SELECT * FROM users ORDER BY id DESC');
    const [bookings] = await pool.query(`
      SELECT b.*, u.email AS user_email 
      FROM bookings b 
      JOIN users u ON b.user_id = u.id 
      ORDER BY b.id DESC
    `);
    const [pets] = await pool.query(`
      SELECT p.*, u.email AS user_email 
      FROM pets p 
      JOIN users u ON p.user_id = u.id 
      ORDER BY p.id DESC
    `);
    const [notifications] = await pool.query(`
      SELECT n.*, u.email AS user_email 
      FROM notifications n 
      JOIN users u ON n.user_id = u.id 
      ORDER BY n.created_at DESC
    `);

    res.render('admin/dashboard', {
      stats: { 
        totalUsers, 
        totalBookings, 
        totalPets, 
        totalNotifications 
      },
      users: users || [],
      bookings: bookings || [],
      pets: pets || [],
      notifications: notifications || []
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.render('admin/dashboard', { 
      stats: { 
        totalUsers: 0, 
        totalBookings: 0, 
        totalPets: 0, 
        totalNotifications: 0 
      },
      users: [], 
      bookings: [], 
      pets: [], 
      notifications: [] 
    });
  }
};

// User Management Functions
export const manageUsers = async (req, res) => {
  try {
    const [users] = await pool.query('SELECT * FROM users ORDER BY id DESC');
    res.render('admin/users', { users: users || [] });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.render('admin/users', { users: [], error: 'Failed to load users' });
  }
};

export const createUser = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    
    // Check if user already exists
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.redirect('/admin/dashboard?error=user_exists');
    }
    
    await pool.execute(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
      [email, password, role || 'user']
    );
    
    res.redirect('/admin/dashboard?success=user_created');
  } catch (err) {
    console.error('Error creating user:', err);
    res.redirect('/admin/dashboard?error=create_failed');
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id, email, role } = req.body;
    
    await pool.execute(
      'UPDATE users SET email = ?, role = ? WHERE id = ?',
      [email, role, id]
    );
    
    res.redirect('/admin/dashboard?success=user_updated');
  } catch (err) {
    console.error('Error updating user:', err);
    res.redirect('/admin/dashboard?error=update_failed');
  }
};

export const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Don't allow deletion of admin users
    const [user] = await pool.query('SELECT role FROM users WHERE id = ?', [userId]);
    if (user.length > 0 && user[0].role === 'admin') {
      return res.status(403).json({ error: 'Cannot delete admin user' });
    }
    
    await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
};

// Booking Management Functions
export const manageBookings = async (req, res) => {
  try {
    const [bookings] = await pool.query(`
      SELECT b.*, u.email AS user_email 
      FROM bookings b 
      JOIN users u ON b.user_id = u.id 
      ORDER BY b.booking_date DESC
    `);
    res.render('admin/bookings', { bookings: bookings || [] });
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.render('admin/bookings', { bookings: [], error: 'Failed to load bookings' });
  }
};

export const createBooking = async (req, res) => {
  try {
    const { user_id, service, booking_date, status } = req.body;
    
    await pool.execute(
      'INSERT INTO bookings (user_id, service, booking_date, status) VALUES (?, ?, ?, ?)',
      [user_id, service, booking_date, status || 'pending']
    );
    
    // Add notification to user
    await addNotification(user_id, `Admin created a booking for ${service}`);
    
    res.redirect('/admin/dashboard?success=booking_created');
  } catch (err) {
    console.error('Error creating booking:', err);
    res.redirect('/admin/dashboard?error=booking_create_failed');
  }
};

export const updateBookingStatus = async (req, res) => {
  try {
    const { id, status } = req.body;
    
    await pool.execute(
      'UPDATE bookings SET status = ? WHERE id = ?',
      [status, id]
    );
    
    // Get booking details to notify user
    const [booking] = await pool.query('SELECT user_id, service FROM bookings WHERE id = ?', [id]);
    if (booking.length > 0) {
      await addNotification(booking[0].user_id, `Your booking for ${booking[0].service} status updated to ${status}`);
    }
    
    res.redirect('/admin/dashboard?success=booking_updated');
  } catch (err) {
    console.error('Error updating booking:', err);
    res.redirect('/admin/dashboard?error=booking_update_failed');
  }
};

// Pet Management Functions
export const managePets = async (req, res) => {
  try {
    const [pets] = await pool.query(`
      SELECT p.*, u.email AS user_email 
      FROM pets p 
      JOIN users u ON p.user_id = u.id 
      ORDER BY p.id DESC
    `);
    res.render('admin/pets', { pets: pets || [] });
  } catch (err) {
    console.error('Error fetching pets:', err);
    res.render('admin/pets', { pets: [], error: 'Failed to load pets' });
  }
};

export const deletePet = async (req, res) => {
  try {
    const petId = req.params.id;
    
    // Get pet details before deletion
    const [pet] = await pool.query('SELECT name, user_id FROM pets WHERE id = ?', [petId]);
    
    await pool.execute('DELETE FROM pets WHERE id = ?', [petId]);
    
    // Notify pet owner
    if (pet.length > 0) {
      await addNotification(pet[0].user_id, `Your pet ${pet[0].name} was removed by admin`);
    }
    
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error deleting pet:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
};

// Notification Management Functions
export const manageNotifications = async (req, res) => {
  try {
    const [notifications] = await pool.query(`
      SELECT n.*, u.email AS user_email 
      FROM notifications n 
      JOIN users u ON n.user_id = u.id 
      ORDER BY n.created_at DESC
    `);
    res.render('admin/notifications', { notifications: notifications || [] });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.render('admin/notifications', { notifications: [], error: 'Failed to load notifications' });
  }
};

export const sendNotification = async (req, res) => {
  try {
    const { user_id, message } = req.body;
    
    await addNotification(user_id, message);
    
    res.redirect('/admin/dashboard?success=notification_sent');
  } catch (err) {
    console.error('Error sending notification:', err);
    res.redirect('/admin/dashboard?error=notification_failed');
  }
};

// Broadcast message to all users
export const sendBroadcast = async (req, res) => {
  try {
    const { subject, message } = req.body;
    
    // Get all users
    const [users] = await pool.query('SELECT id FROM users');
    
    // Send notification to all users
    for (const user of users) {
      await addNotification(user.id, `${subject}: ${message}`);
    }
    
    res.redirect('/admin/dashboard?success=broadcast_sent');
  } catch (err) {
    console.error('Error sending broadcast:', err);
    res.redirect('/admin/dashboard?error=broadcast_failed');
  }
};
