const express = require('express');
const router = express.Router();

// GET /api/admin/monthly-growth
router.get('/monthly-growth', async (req, res) => {
  try {
    // Query your database here
    // Calculate current month vs previous month
    // Example with PostgreSQL:
    // const currentMonth = await db.query(
    //   'SELECT SUM(amount) as revenue, COUNT(*) as payments FROM payments WHERE date_trunc(\'month\', created_at) = date_trunc(\'month\', CURRENT_DATE)'
    // );
    // const previousMonth = await db.query(
    //   'SELECT SUM(amount) as revenue, COUNT(*) as payments FROM payments WHERE date_trunc(\'month\', created_at) = date_trunc(\'month\', CURRENT_DATE - INTERVAL \'1 month\')'
    // );
    
    // Mock response
    const data = {
      revenue: {
        current: 125000,      // In cents: €1,250.00
        previous: 111111,     // In cents: €1,111.11
        change: 12.5          // Percentage
      },
      payments: {
        current: 156,
        previous: 142,
        change: 9.9           // Percentage
      }
    };
    
    res.json(data);
    
  } catch (error) {
    console.error('Error fetching monthly growth data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
