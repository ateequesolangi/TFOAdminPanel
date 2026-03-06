const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Route to render the index.ejs
router.get('/', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM prompt ORDER BY id DESC LIMIT 1');
        const prompt = results.length > 0 ? results[0].text : "No prompt found";
        res.render('index', {
            username: req.session.username,
            prompt: prompt  // Pass prompt to the view
        });
    } catch (error) {
        console.error('Error fetching prompt:', error);
        res.render('index', {
            username: req.session.username,
            prompt: "Failed to load prompt"
        });
    }
});

// Route to handle saving the prompt
router.post('/prompt', async (req, res) => {
    const { text } = req.body;
    const createdAt = new Date();

    try {
        // Insert or update the single prompt row
        await db.query(`
            INSERT INTO prompt (id, text, created_at) VALUES (1, ?, ?)
            ON DUPLICATE KEY UPDATE text = VALUES(text), created_at = VALUES(created_at)
        `, [text, createdAt]);

        res.status(200).json({ message: 'Prompt saved successfully' });
    } catch (error) {
        console.error('Error saving prompt:', error);
        res.status(500).json({ error: 'Error saving prompt' });
    }
});

// Route to get the prompt
router.get('/prompt', async (req, res) => {
    try {
        const [results] = await db.query('SELECT text FROM prompt WHERE id = 1');

        if (results.length > 0) {
            res.status(200).json({ prompt: results[0].text });
        } else {
            res.status(404).json({ message: 'No prompt found' });
        }
    } catch (error) {
        console.error('Error fetching prompt:', error);
        res.status(500).json({ error: 'Error fetching prompt' });
    }
});


module.exports = router;
