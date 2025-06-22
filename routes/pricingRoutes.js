import express from 'express';
const router = express.Router();  // Initialize router properly

// Pricing Page Route
router.get('/pricing', (req, res) => {
  res.render('pricing', {
    user: req.session.user || null
  });
});

// Purchase Handling Route
router.post('/purchase', async (req, res) => {
  const { plan, amount } = req.body;
  try {
    console.log(`Purchase initiated: ${plan} for ${amount}`);
    res.redirect('/pricing?success=1');
  } catch (error) {
    console.error('Purchase error:', error);
    res.redirect('/pricing?error=purchase_failed');
  }
});  // Added closing parenthesis and brace

export default router;  // Export the router
