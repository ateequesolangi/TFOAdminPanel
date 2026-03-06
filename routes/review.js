const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Route: GET /review-bat-unlock
// Displays users who have reviewed the game
router.get('/', async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT user_id, user_name, total_accumulated_gp FROM users WHERE HasReviewedTheGame = 1 ORDER BY user_id DESC'
        );

        res.render('review_bat_unlock', {
            title: 'Review Bat Unlock',
            username: req.session.username,
            users: users
        });
    } catch (error) {
        console.error('❌ Error fetching reviewers:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route: POST /review-bat-unlock/add
// Manually marks a user as having reviewed the game
router.post('/add', async (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ success: false, message: 'Username is required.' });
    }

    try {
        // First check if the user exists
        const [checkUser] = await db.query('SELECT user_id FROM users WHERE user_name = ?', [username]);

        if (checkUser.length === 0) {
            return res.status(404).json({ success: false, message: `User "${username}" not found.` });
        }

        // Update the user
        await db.query('UPDATE users SET HasReviewedTheGame = 1 WHERE user_name = ?', [username]);

        res.json({ success: true, message: `Successfully unlocked review bat for ${username}.` });
    } catch (error) {
        console.error('❌ Error updating reviewer status:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

module.exports = router;
