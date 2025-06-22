// models/bookingModel.js
import pool from './db.js';

export const countAll = async () => {
  const [rows] = await pool.execute('SELECT COUNT(*) AS count FROM appointments');
  return rows[0].count;
};

// models/bookingModel.js
// models/bookingModel.js
export const getUpcoming = async () => {
  const [rows] = await pool.execute(
    // Use appointment_date instead of date
    'SELECT * FROM appointments WHERE appointment_date > NOW()'
  );
  return rows;
};

export const createAppointment = async (userId, petId, serviceId, date, time) => {
  await pool.execute(
    `INSERT INTO appointments (
      user_id, 
      pet_id, 
      service_id, 
      appointment_date, 
      appointment_time
    ) VALUES (?, ?, ?, ?, ?)`,
    [userId, petId, serviceId, date, time]
  );
};
