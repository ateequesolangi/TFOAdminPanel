const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Route: GET /gpranking
// Route: GET /gpranking
router.get('/', async (req, res) => {
  try {
    // Extract filters and pagination params
    const { match_type = 'All', difficulty = 'All', page = 1 } = req.query;
    const limit = 20;
    const offset = (page - 1) * limit;

    // --- build WHERE clause + params ---
    // always require players who actually have GP
    let whereClause = "WHERE u.total_accumulated_gp > 0";
    const filterParams = [];

    // only add match_type filter if it's not "All" and not empty
    if (match_type && match_type !== 'All') {
      whereClause += " AND m.match_type = ?";
      filterParams.push(match_type);
    }

    // only add difficulty filter if it's not "All" and not empty
    if (difficulty && difficulty !== 'All') {
      whereClause += " AND m.difficulty = ?";
      filterParams.push(difficulty);
    }

    // --- main paginated query ---
    const mainQuery = `
      SELECT 
        u.user_id,
        u.user_name,
        SUM(ms.matchgp) AS total_gp
      FROM users u
      JOIN matches m ON u.user_id = m.user_id
      JOIN matchstatistics ms ON m.match_id = ms.match_id
      ${whereClause}
      GROUP BY u.user_id, u.user_name
      HAVING total_gp > 0
      ORDER BY total_gp DESC
      LIMIT ? OFFSET ?
    `;

    // mainQuery params = dynamic filters + pagination values
    const mainParams = [...filterParams, limit, offset];

    // execute main query
    const [results] = await db.query(mainQuery, mainParams);

    // --- count query (for total pages) ---
    const countQuery = `
      SELECT COUNT(DISTINCT u.user_id) AS total
      FROM users u
      JOIN matches m ON u.user_id = m.user_id
      JOIN matchstatistics ms ON m.match_id = ms.match_id
      ${whereClause}
      HAVING SUM(ms.matchgp) > 0
    `;

    // countQuery params = only the dynamic filter params (no limit/offset)
    const [countRows] = await db.query(countQuery, filterParams);

    // when there are zero rows, COUNT(...) still returns 1 row in MySQL,
    // but to be safe:
    const totalPlayers = countRows.length ? countRows[0].total : 0;
    const totalPages = Math.ceil(totalPlayers / limit) || 1;

    // render page
    res.render('gpranking', {
      title: 'GP Ranking',
      players: results,
      currentPage: parseInt(page, 10),
      totalPages,
      filters: {
        match_type: match_type === 'All' ? '' : match_type,
        difficulty: difficulty === 'All' ? '' : difficulty
      }
    });

  } catch (error) {
    console.error('❌ Error fetching GP rankings:', error);
    res.status(500).send('Internal Server Error');
  }
});


module.exports = router;
