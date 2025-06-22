import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'petcare_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test connection
pool.getConnection()
  .then(conn => {
    console.log('Connected to database!');
    conn.release();
  })
  .catch(err => {
    console.error('Database connection failed:', err);
  });

export default pool;
