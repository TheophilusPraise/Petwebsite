import pool from '../config/db.js';
import { subMonths, format } from 'date-fns';
import { broadcastToUsers } from '../utils/emailService.js';

// Helper: Get last 6 months labels + keys
function getLast6Months() {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(now, i);
    months.push({
      label: format(d, 'MMM'),
      ym: format(d, 'yyyy-MM'),
    });
  }
  return months;
}

export const getAdminDashboard = async (req, res) => {
  try {
    const months = getLast6Months();
    const ymArray = months.map(m => m.ym);

    // Total counts
    const [[{ totalUsers }]] = await pool.query('SELECT COUNT(*) AS totalUsers FROM users');
    const [[{ totalBookings }]] = await pool.query('SELECT COUNT(*) AS totalBookings FROM bookings');
    const [[{ totalPets }]] = await pool.query('SELECT COUNT(*) AS totalPets FROM pets');
    const [[{ totalNotifications }]] = await pool.query('SELECT COUNT(*) AS totalNotifications FROM notifications');
    const [[{ totalPurchases }]] = await pool.query('SELECT COUNT(*) AS totalPurchases FROM purchases');

    // Recent records for modals
    const [users] = await pool.query('SELECT id, email, role FROM users ORDER BY id DESC');
    const [bookings] = await pool.query(`
      SELECT b.id, b.service, b.booking_date, b.status, u.email AS user_email
      FROM bookings b LEFT JOIN users u ON b.user_id = u.id ORDER BY b.id DESC
    `);
    const [pets] = await pool.query(`
      SELECT p.id, p.name, p.species, u.email AS user_email
      FROM pets p LEFT JOIN users u ON p.user_id = u.id ORDER BY p.id DESC
    `);
    const [notifications] = await pool.query(`
      SELECT n.id, n.message, n.created_at, n.is_read, u.email AS user_email
      FROM notifications n LEFT JOIN users u ON n.user_id = u.id ORDER BY n.created_at DESC
    `);
    const [purchases] = await pool.query(`
      SELECT p.*, u.email AS user_email
      FROM purchases p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC
    `);

    // Monthly aggregations for chart

    // Bookings per month
    const [monthlyBookings] = await pool.query(
      `SELECT DATE_FORMAT(booking_date, '%Y-%m') AS ym, COUNT(*) AS count
       FROM bookings
       WHERE booking_date >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 5 MONTH), '%Y-%m-01')
       GROUP BY ym`
    );

    // Pets per month
    const [monthlyPets] = await pool.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym, COUNT(*) AS count
       FROM pets
       WHERE created_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 5 MONTH), '%Y-%m-01')
       GROUP BY ym`
    );

    // Notifications per month
    const [monthlyNotifications] = await pool.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym, COUNT(*) AS count
       FROM notifications
       WHERE created_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 5 MONTH), '%Y-%m-01')
       GROUP BY ym`
    );

    // Purchases per month
    const [monthlyPurchases] = await pool.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym, COUNT(*) AS count
       FROM purchases
       WHERE created_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 5 MONTH), '%Y-%m-01')
       GROUP BY ym`
    );

    // Maps for fast lookup
    const bookingsMap = {};
    monthlyBookings.forEach(r => { bookingsMap[r.ym] = r.count; });
    const petsMap = {};
    monthlyPets.forEach(r => { petsMap[r.ym] = r.count; });
    const notifMap = {};
    monthlyNotifications.forEach(r => { notifMap[r.ym] = r.count; });
    const purchasesMap = {};
    monthlyPurchases.forEach(r => { purchasesMap[r.ym] = r.count; });

    // Build 6-item arrays zero-filling missing months
    const monthlyBookingCounts = ymArray.map(ym => bookingsMap[ym] || 0);
    const monthlyPetCounts = ymArray.map(ym => petsMap[ym] || 0);
    const monthlyNotificationCounts = ymArray.map(ym => notifMap[ym] || 0);
    const monthlyPurchaseCounts = ymArray.map(ym => purchasesMap[ym] || 0);

    res.render('admin/dashboard', {
      stats: { totalUsers, totalBookings, totalPets, totalNotifications, totalPurchases },
      users,
      bookings,
      pets,
      notifications,
      purchases,
      monthlyBookingCounts,
      monthlyPetCounts,
      monthlyNotificationCounts,
      monthlyPurchaseCounts
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.render('admin/dashboard', {
      stats: { totalUsers: 0, totalBookings: 0, totalPets: 0, totalNotifications: 0, totalPurchases: 0 },
      users: [], bookings: [], pets: [], notifications: [], purchases: [],
      monthlyBookingCounts: [0,0,0,0,0,0],
      monthlyPetCounts: [0,0,0,0,0,0],
      monthlyNotificationCounts: [0,0,0,0,0,0],
      monthlyPurchaseCounts: [0,0,0,0,0,0],
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
  const userId = req.params.id;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Delete related bookings
    await connection.query('DELETE FROM bookings WHERE user_id = ?', [userId]);
    
    // Delete related notifications
    await connection.query('DELETE FROM notifications WHERE user_id = ?', [userId]);
    
    // Delete related pets
    await connection.query('DELETE FROM pets WHERE user_id = ?', [userId]);
    
    // Delete related purchases
    await connection.query('DELETE FROM purchases WHERE user_id = ?', [userId]);

    // Delete user
    await connection.query('DELETE FROM users WHERE id = ?', [userId]);

    await connection.commit();
    res.status(200).json({ success: true });
  } catch (err) {
    await connection.rollback();
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Delete failed due to related records' });
  } finally {
    connection.release();
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
export const deleteNotification = async (req, res) => {
  try {
    await pool.execute('DELETE FROM notifications WHERE id = ?', [req.params.id]);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error deleting notification:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
};

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

    // Insert notifications into DB
    for (const user of users) {
      await pool.execute(
        'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
        [user.id, `${subject}: ${message}`]
      );
    }

    // Send broadcast email to all users
    await broadcastToUsers(subject, message);

    res.redirect('/admin/dashboard?success=broadcast_sent');
  } catch (err) {
    console.error('Error sending broadcast:', err);
    res.redirect('/admin/dashboard?error=broadcast_failed');
  }
};

// Placeholder redirect functions
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

export const createPetByAdmin = async (req, res) => {
  try {
    const { name, species, breed, age, owner_email } = req.body;
    // Find user by email
    const [users] = await pool.query('SELECT id FROM users WHERE email = ?', [owner_email]);
    if (!users.length) {
      return res.redirect('/admin/dashboard?error=user_not_found');
    }
    const userId = users[0].id;
    let image_url = null;
    if (req.file) image_url = '/uploads/' + req.file.filename;

    await pool.execute(
      'INSERT INTO pets (name, species, breed, age, image_url, user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [name, species, breed || null, age || null, image_url, userId]
    );
    res.redirect('/admin/dashboard?success=pet_added');
  } catch (err) {
    console.error('Admin add pet error:', err);
    res.redirect('/admin/dashboard?error=pet_add_failed');
  }
};
// Purchase Management
export const deletePurchase = async (req, res) => {
  try {
    await pool.execute('DELETE FROM purchases WHERE id = ?', [req.params.id]);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error deleting purchase:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
};

