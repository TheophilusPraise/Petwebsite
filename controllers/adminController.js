import pool from '../config/db.js';

// Admin Dashboard - MUST fetch and pass all data
export const getAdminDashboard = async (req, res) => {
  try {
    console.log('Loading admin dashboard...');
    
    // Get stats
    const [[{ totalUsers }]] = await pool.query('SELECT COUNT(*) AS totalUsers FROM users');
    const [[{ totalBookings }]] = await pool.query('SELECT COUNT(*) AS totalBookings FROM bookings');
    const [[{ totalPets }]] = await pool.query('SELECT COUNT(*) AS totalPets FROM pets');
    const [[{ totalNotifications }]] = await pool.query('SELECT COUNT(*) AS totalNotifications FROM notifications');
    
    // Get actual data for modals
    const [users] = await pool.query('SELECT id, email, role FROM users ORDER BY id DESC');
    const [bookings] = await pool.query(`
      SELECT b.id, b.service, b.booking_date, b.status, u.email AS user_email 
      FROM bookings b 
      LEFT JOIN users u ON b.user_id = u.id 
      ORDER BY b.id DESC
    `);
    const [pets] = await pool.query(`
      SELECT p.id, p.name, p.species, u.email AS user_email 
      FROM pets p 
      LEFT JOIN users u ON p.user_id = u.id 
      ORDER BY p.id DESC
    `);
    const [notifications] = await pool.query(`
      SELECT n.id, n.message, n.created_at, n.is_read, u.email AS user_email 
      FROM notifications n 
      LEFT JOIN users u ON n.user_id = u.id 
      ORDER BY n.created_at DESC
    `);

    console.log('Data fetched:', {
      users: users.length,
      bookings: bookings.length,
      pets: pets.length,
      notifications: notifications.length
    });

    res.render('admin/dashboard', {
      stats: { totalUsers, totalBookings, totalPets, totalNotifications },
      users,
      bookings,
      pets,
      notifications
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.render('admin/dashboard', {
      stats: { totalUsers: 0, totalBookings: 0, totalPets: 0, totalNotifications: 0 },
      users: [],
      bookings: [],
      pets: [],
      notifications: [],
      error: 'Failed to load dashboard'
    });
  }
};

// User Management
export const createUser = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    
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
    await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
};

// Booking Management
export const createBooking = async (req, res) => {
  try {
    const { user_id, service, booking_date, status } = req.body;
    
    await pool.execute(
      'INSERT INTO bookings (user_id, service, booking_date, status) VALUES (?, ?, ?, ?)',
      [user_id, service, booking_date, status || 'pending']
    );
    
    res.redirect('/admin/dashboard?success=booking_created');
  } catch (err) {
    console.error('Error creating booking:', err);
    res.redirect('/admin/dashboard?error=booking_create_failed');
  }
};

export const updateBookingStatus = async (req, res) => {
  try {
    const { id, status } = req.body;
    
    await pool.execute('UPDATE bookings SET status = ? WHERE id = ?', [status, id]);
    
    res.redirect('/admin/dashboard?success=booking_updated');
  } catch (err) {
    console.error('Error updating booking:', err);
    res.redirect('/admin/dashboard?error=booking_update_failed');
  }
};

// Pet Management
export const deletePet = async (req, res) => {
  try {
    await pool.execute('DELETE FROM pets WHERE id = ?', [req.params.id]);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error deleting pet:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
};

// Notification Management
export const sendNotification = async (req, res) => {
  try {
    const { user_id, message } = req.body;
    
    await pool.execute(
      'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
      [user_id, message]
    );
    
    res.redirect('/admin/dashboard?success=notification_sent');
  } catch (err) {
    console.error('Error sending notification:', err);
    res.redirect('/admin/dashboard?error=notification_failed');
  }
};

// Broadcast
export const sendBroadcast = async (req, res) => {
  try {
    const { subject, message } = req.body;
    const [users] = await pool.query('SELECT id FROM users');
    
    for (const user of users) {
      await pool.execute(
        'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
        [user.id, `${subject}: ${message}`]
      );
    }
    
    res.redirect('/admin/dashboard?success=broadcast_sent');
  } catch (err) {
    console.error('Error sending broadcast:', err);
    res.redirect('/admin/dashboard?error=broadcast_failed');
  }
};

// Placeholder functions for other routes
export const manageUsers = async (req, res) => {
  res.redirect('/admin/dashboard');
};

export const manageBookings = async (req, res) => {
  res.redirect('/admin/dashboard');
};

export const managePets = async (req, res) => {
  res.redirect('/admin/dashboard');
};

export const manageNotifications = async (req, res) => {
  res.redirect('/admin/dashboard');
};
