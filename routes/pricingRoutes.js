import express from 'express';
import axios from 'axios';
import pool from '../config/db.js'; // Adjust path as needed

const router = express.Router();

// Pricing Page Route
router.get('/pricing', (req, res) => {
  res.render('pricing', {
    user: req.session.user || null
  });
});

// Purchase Handling Route (optional, for manual or non-card flows)
router.post('/purchase', async (req, res) => {
  const { plan, amount } = req.body;
  try {
    console.log(`Purchase initiated: ${plan} for ${amount}`);
    res.redirect('/pricing?success=1');
  } catch (error) {
    console.error('Purchase error:', error);
    res.redirect('/pricing?error=purchase_failed');
  }
});

// Paystack Payment Verification Route
router.post('/verify-payment', async (req, res) => {
  const { reference, plan, amount } = req.body;
  const user = req.session.user;

  if (!reference || !plan || !amount || !user) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    // Verify with Paystack
    const paystackRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer sk_test_0c8409c6931f64397e549ba20a736fb38580b5fa`, // Use environment variable in production!
          'Content-Type': 'application/json'
        }
      }
    );

    const data = paystackRes.data;
    if (data.status && data.data.status === 'success') {
      // Prepare data for DB
      const paidAmount = data.data.amount / 100; // Convert from kobo to Naira
      const transaction_id = data.data.reference;
      const status = data.data.status;

      // Insert payment record
      try {
        const result = await pool.query(
          `INSERT INTO purchases (user_id, plan, amount, transaction_id, status, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE status=VALUES(status), amount=VALUES(amount), created_at=NOW()`,
          [user.id, plan, paidAmount, transaction_id, status]
        );
        console.log('DB insert result:', result);
        return res.status(200).json({ message: 'Payment verified and saved.', transaction: data.data });
      } catch (dbError) {
        console.error('DB insert error:', dbError);
        return res.status(500).json({ error: 'Database insert failed.', details: dbError.message });
      }
    } else {
      return res.status(400).json({ error: 'Payment not successful.', details: data.data });
    }
  } catch (error) {
    console.error('Paystack verification error:', error?.response?.data || error.message);
    return res.status(500).json({ error: 'Error verifying payment.', details: error.message });
  }
});

export default router;
