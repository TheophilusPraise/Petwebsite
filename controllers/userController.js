import pool from '../config/db.js';
import { subMonths, format } from 'date-fns'; 
import { notifyAdmin } from '../utils/emailService.js';

// --- Helper Functions ---
function getLast6Months() {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(now, i);
    const ym = format(d, 'yyyy-MM');
    months.push({
      label: format(d, 'MMM'),
      ym
    });
  }
  return months;
}

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
    const [rows] = await pool.query('SELECT * FROM bookings WHERE user_id = ? ORDER BY booking_date DESC', [userId]);
    return rows;
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
      return 'Server failed to add pet. Please try again.';
    case 'missing_fields':
      return 'Please fill all required fields.';
    default:
      return 'An error occurred.';
  }
}

// --- Controllers ---

export const getUserDashboard = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect('/auth/login');

    // 1. Fetch totals for dashboard cards
    const [bookingsResult] = await pool.query(
      'SELECT COUNT(*) AS totalBookings FROM bookings WHERE user_id = ?', 
      [userId]
    );
    const [petsResult] = await pool.query(
      'SELECT COUNT(*) AS totalPets FROM pets WHERE user_id = ?',
      [userId]
    );
    const [notifications] = await pool.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
      [userId]
    );
    const [upcomingBookings] = await pool.query(
      `SELECT
         booking_date AS appointment_date,
         TIME(booking_date) AS appointment_time,
         service AS service_name,
         status
       FROM bookings
       WHERE user_id = ? AND booking_date >= NOW()
       ORDER BY booking_date ASC
       LIMIT 5`,
      [userId]
    );

    // 2. Generate last 6 months array
    const months = getLast6Months();
    const ymArray = months.map(m => m.ym);

    // 3. Query monthly bookings counts
    const [monthlyBookings] = await pool.query(
      `SELECT DATE_FORMAT(booking_date, '%Y-%m') as ym, COUNT(*) as count
       FROM bookings
       WHERE user_id = ?
         AND booking_date >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 5 MONTH), '%Y-%m-01')
       GROUP BY ym`,
      [userId]
    );

    // 4. Query monthly pets counts (using created_at)
    const [monthlyPets] = await pool.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') as ym, COUNT(*) as count
       FROM pets
       WHERE user_id = ?
         AND created_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 5 MONTH), '%Y-%m-01')
       GROUP BY ym`,
      [userId]
    );

    // 5. Query monthly notifications counts
    const [monthlyNotifs] = await pool.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') as ym, COUNT(*) as count
       FROM notifications
       WHERE user_id = ?
         AND created_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 5 MONTH), '%Y-%m-01')
       GROUP BY ym`,
      [userId]
    );

    // 6. Map months to counts for easy lookup
    const bookingsMap = {};
    monthlyBookings.forEach(row => { bookingsMap[row.ym] = row.count; });
    const petsMap = {};
    monthlyPets.forEach(row => { petsMap[row.ym] = row.count; });
    const notifMap = {};
    monthlyNotifs.forEach(row => { notifMap[row.ym] = row.count; });

    // 7. Prepare arrays for frontend chart, zero-filling missing months
    const monthlyBookingCounts = ymArray.map(ym => bookingsMap[ym] || 0);
    const monthlyPetCounts = ymArray.map(ym => petsMap[ym] || 0);
    const monthlyNotificationCounts = ymArray.map(ym => notifMap[ym] || 0);

    // 8. Compose stats object for rendering
    const stats = {
      totalBookings: bookingsResult[0].totalBookings || 0,
      totalPets: petsResult[0].totalPets || 0,
      upcomingBookings: upcomingBookings || [],
      monthlyBookingCounts,
      monthlyPetCounts,
      monthlyNotificationCounts
    };

    // Render dashboard with user, stats, notifications
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
        upcomingBookings: [],
        monthlyBookingCounts: [0,0,0,0,0,0],
        monthlyPetCounts: [0,0,0,0,0,0],
        monthlyNotificationCounts: [0,0,0,0,0,0],
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
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    res.render('user/notifications', { 
      user: req.session.user, 
      notifications: notifications || [] 
    });
  } catch (err) {
    res.render('user/notifications', { user: req.session.user, notifications: [] });
  }
};

export const processABook = async (req, res) => {
  await notifyAdmin('New Booking', `New booking for ${service} by ${req.session.user.email}`);
};

export const getUserBookings = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect('/auth/login');
    const bookings = await getBookingsByUserId(userId);
    res.render('user/bookings', {
      user: req.session.user,
      bookings,
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
    if (!name || !species) return res.redirect('/user/pets?error=name_and_species_required');
    let image_url = null;
    if (req.file) image_url = '/uploads/' + req.file.filename;
    await pool.execute(
      'INSERT INTO pets (name, species, breed, age, image_url, user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [name, species, breed || null, age || null, image_url, userId]
    );
    await addNotification(userId, `You added a new pet: ${name}`);
    res.redirect('/user/pets');
  } catch (err) {
    console.error('Database error:', err);
    res.redirect('/user/pets?error=server_error');
  }
};

export const showUpdatePetImage = async (req, res) => {
  const petId = req.params.id;
  try {
    const [pets] = await pool.query('SELECT * FROM pets WHERE id = ?', [petId]);
    if (!pets.length) return res.status(404).render('error', { message: 'Pet not found' });
    res.render('user/update-pet-image', { 
      pet: pets[0], 
      user: req.session.user, 
      error: req.query.error || null 
    });
  } catch (err) {
    console.error('Error loading pet:', err);
    res.status(500).render('error', { message: 'Failed to load pet' });
  }
};

export const updatePetImage = async (req, res) => {
  const petId = req.params.id;
  try {
    let image_url = null;
    if (req.file) image_url = '/uploads/' + req.file.filename;
    await pool.execute('UPDATE pets SET image_url = ? WHERE id = ?', [image_url, petId]);
    const userId = req.session.user?.id;
    await addNotification(userId, 'Pet image updated successfully');
    res.redirect('/user/pets');
  } catch (err) {
    console.error('Error updating pet image:', err);
    res.redirect(`/user/pets/update-image/${petId}?error=server_error`);
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
    await addNotification(userId, `New booking created for ${service}`);
    res.redirect('/user/bookings?success=1');
  } catch (err) {
    console.error('Error saving booking:', err);
    res.redirect('/user/book?error=server_error');
  }
};
