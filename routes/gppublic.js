const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Route: GET /gppublic
router.get('/', async (req, res) => {
  try {
    const { match_type = 'All', difficulty = 'All', time = 'Lifetime', format } = req.query;

    // 🔹 Pagination: start = offset to begin from (default 0), limit = records per page
    const limit = 100;
    const start = Math.max(0, parseInt(req.query.start) || 0);

    // Base query for GP aggregation
    let whereClause = "WHERE u.total_accumulated_gp > 0";
    const queryParams = [];

    // 🔹 Match type filter
    if (match_type && match_type !== 'All') {
      whereClause += " AND m.match_type = ?";
      queryParams.push(match_type);
    }

    // 🔹 Difficulty filter
    if (difficulty && difficulty !== 'All') {
      whereClause += " AND m.difficulty = ?";
      queryParams.push(difficulty);
    }

    // 🔹 Time filter using m.date_time column
    if (time === 'Weekly') {
      whereClause += " AND m.date_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
    } else if (time === 'Monthly') {
      whereClause += " AND m.date_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
    }
    // Lifetime → no time filter

    // 🔹 Fetch limit + 1 to detect if more records exist beyond this page
    const query = `
  SELECT 
    u.user_id,
    u.user_name,
    u.user_pic,
    SUM(ms.matchgp) AS total_gp
  FROM users u
  JOIN matches m ON u.user_id = m.user_id
  JOIN matchstatistics ms ON m.match_id = ms.match_id
  ${whereClause}
  GROUP BY u.user_id, u.user_name, u.user_pic
  HAVING total_gp > 0
  ORDER BY total_gp DESC
  LIMIT ? OFFSET ?
`;

    queryParams.push(limit + 1, start);

    const [results] = await db.query(query, queryParams);

    // 🔹 Check if there are more records beyond this page
    const hasMore = results.length > limit;
    const players = hasMore ? results.slice(0, limit) : results;

    // 🔹 API / JSON response (for Unreal)
    if (format === 'json') {
      return res.json({
        success: true,
        totalPlayers: players.length,
        start: start,
        limit: limit,
        hasMore: hasMore,
        nextStart: hasMore ? start + limit : null,
        filters: { match_type, difficulty, time },
        data: players
      });
    }

    // 🔹 EJS render (for web dashboard)
    res.render('gpranking', {
      title: 'GP Ranking',
      players: players,
      filters: { match_type, difficulty, time }
    });

  } catch (error) {
    console.error('❌ Error fetching GP rankings:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
