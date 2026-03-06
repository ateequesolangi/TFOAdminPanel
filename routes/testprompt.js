const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Route to display the test prompt page
router.get('/', async (req, res) => {
    try {
        const [results] = await db.query('SELECT prompt FROM testPrompt ORDER BY id DESC LIMIT 1');
        const prompt = results.length > 0 ? results[0].prompt : 'No prompt available';
        res.render('testprompt', { prompt });
    } catch (error) {
        console.error('Failed to fetch prompt:', error);
        res.render('testprompt', { prompt: 'Error fetching prompt' });
    }
});

router.get('/testPrompt', async (req, res) => {
    try {
        const [results] = await db.query('SELECT prompt FROM testPrompt ORDER BY id DESC LIMIT 1');
        const prompt = results.length > 0 ? results[0].prompt : 'No prompt available';
        res.json({ success: true, message: prompt });
    } catch (error) {
        console.error('Failed to fetch prompt:', error);
        res.status(500).json({ success: false, message: 'Error fetching prompt' });
    }
});

// Route to update/create prompt
router.post('/', async (req, res) => {
    const { prompt } = req.body;

    try {
        // Attempt to insert or on conflict replace
        const sql = `
            INSERT INTO testPrompt (id, prompt) VALUES (1, ?)
            ON DUPLICATE KEY UPDATE prompt = VALUES(prompt), created_at = CURRENT_TIMESTAMP;
        `;
        await db.query(sql, [prompt]);
        res.json({ success: true, message: 'Prompt updated successfully' });
    } catch (error) {
        console.error('Error saving prompt:', error);
        res.status(500).json({ success: false, message: 'Error saving prompt' });
    }
});

// Route to get JSON data (latest record)
router.get('/matchData', async (req, res) => {
    try {
        const [results] = await db.query('SELECT match_data FROM matchesPrompt ORDER BY id DESC LIMIT 1');
        const matchData = results.length > 0 ? results[0].match_data : 'No match data available';
        res.json({ success: true, matchData: JSON.parse(matchData) });
    } catch (error) {
        console.error('Failed to fetch match data:', error);
        res.status(500).json({ success: false, message: 'Error fetching match data' });
    }
});

// Route to store/update JSON data
router.post('/matchData', async (req, res) => {
    console.log('Request body:', req.body);  // Log the entire request body

    const matchData = req.body;  // Use the entire request body

    if (!matchData || Object.keys(matchData).length === 0) {
        return res.status(400).json({ success: false, message: 'Match data is required' });
    }

    try {
        const sql = `
            INSERT INTO matchesPrompt (match_data) VALUES (?)
            ON DUPLICATE KEY UPDATE match_data = VALUES(match_data), updated_at = CURRENT_TIMESTAMP;
        `;
        await db.query(sql, [JSON.stringify(matchData)]);
        res.json({ success: true, message: 'Match data saved successfully' });
    } catch (error) {
        console.error('Error saving match data:', error);
        res.status(500).json({ success: false, message: 'Error saving match data' });
    }
});





module.exports = router;
