const express = require('express');
const router = express.Router();

// GET /api/admin/revenue
router.get('/revenue', async (req, res) => {
  try {
    const { period, year } = req.query;
    
    // Query your database here
    // Example with PostgreSQL:
    // const result = await db.query(
    //   'SELECT * FROM get_admin_revenue_stats($1, $2)',
    //   [period, year]
    // );
    
    // Mock response based on period
    let data;
    
    switch(period) {
      case 'dag':
        data = {
          labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
          values: [120.50, 340.25, 890.75, 1250.00, 980.50, 450.25]
        };
        break;
      case 'week':
        data = {
          labels: ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'],
          values: [2500.00, 3200.50, 2800.75, 3500.00, 4200.25, 1800.50, 1200.00]
        };
        break;
      case 'maand':
        data = {
          labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
          values: [12500.00, 15200.50, 13800.75, 16500.00]
        };
        break;
      case 'jaar':
        data = {
          labels: ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'],
          values: [45000, 48000, 52000, 49000, 55000, 58000, 62000, 59000, 61000, 64000, 67000, 70000]
        };
        break;
      default:
        data = {
          labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
          values: [120.50, 340.25, 890.75, 1250.00, 980.50, 450.25]
        };
    }
    
    res.json(data);
    
  } catch (error) {
    console.error('Error fetching revenue data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
