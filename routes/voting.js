const express = require('express');
const router = express.Router();
const db = require('../config/database');
router.use(express.json());

// Get all active voting questions
router.get('/', async (req, res) => {
    try {
        const [questions] = await db.query('SELECT * FROM voting_questions WHERE is_active = true');
        res.render('voting', { questions: questions });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Database query failed.' });
    }
});

// Create a new voting question
router.post('/create', async (req, res) => {
    const { question_text, options } = req.body;

    if (!question_text || !options || !Array.isArray(options) || options.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid input data.' });
    }

    try {
        const [result] = await db.query('INSERT INTO voting_questions (question_text) VALUES (?)', [question_text]);
        const question_id = result.insertId;
        const optionValues = options.map(option => [question_id, option]);

        await db.query('INSERT INTO voting_options (question_id, option_text) VALUES ?', [optionValues]);
        res.json({ success: true, message: 'Voting question created successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to create question.' });
    }
});

// Get options for a specific question
router.get('/options/:questionId', async (req, res) => {
    const questionId = req.params.questionId;
    try {
        const [options] = await db.query('SELECT * FROM voting_options WHERE question_id = ?', [questionId]);
        res.json({ success: true, options: options });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Database query failed.' });
    }
});

// Toggle isDone status for an option
router.post('/toggle-option', async (req, res) => {
    const { option_id } = req.body;

    try {
        const [results] = await db.query('SELECT isDone FROM voting_options WHERE id = ?', [option_id]);

        if (results.length === 0) {
            return res.status(400).json({ success: false, message: 'Option not found.' });
        }

        const newIsDone = results[0].isDone ? 0 : 1;
        await db.query('UPDATE voting_options SET isDone = ? WHERE id = ?', [newIsDone, option_id]);
        res.json({ success: true, message: 'Option status updated successfully.', isDone: newIsDone });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to update option status.' });
    }
});

// Submit a vote
router.post('/vote', async (req, res) => {
    const votes = req.body;

    if (!Array.isArray(votes)) {
        return res.status(400).json({ success: false, message: 'Invalid input data. Expected an array of votes.' });
    }

    try {
        const results = await Promise.allSettled(votes.map(async (vote) => {
            const { user_id, question_id, option_id } = vote;

            // Validate the question_id and option_id mapping
            const [options] = await db.query('SELECT id FROM voting_options WHERE question_id = ? ORDER BY id', [question_id]);

            if (options.length === 0 || option_id > options.length) {
                throw new Error('Invalid option for the selected question.');
            }

            const internalOptionId = options[option_id - 1].id;

            // Check if the user has already voted for this question and option
            const [existingVotes] = await db.query('SELECT * FROM user_votes WHERE user_id = ? AND question_id = ? AND option_id = ?', [user_id, question_id, internalOptionId]);

            if (existingVotes.length > 0) {
                // User has already voted for this option, delete the existing vote
                await db.query('DELETE FROM user_votes WHERE id = ?', [existingVotes[0].id]);

                // Update the vote count
                await db.query('UPDATE voting_options SET votes = votes - 1 WHERE id = ?', [internalOptionId]);
                return 'Vote removed successfully.';
            } else {
                // User has not voted for this option yet, check the total votes for this question
                const [voteCounts] = await db.query('SELECT COUNT(*) AS total_votes FROM user_votes WHERE user_id = ? AND question_id = ?', [user_id, question_id]);
                const totalVotes = voteCounts[0].total_votes;

                if (totalVotes >= 3) {
                    throw new Error('You have already voted for this question 3 times.');
                }

                // Insert the new vote
                await db.query('INSERT INTO user_votes (user_id, question_id, option_id) VALUES (?, ?, ?)', [user_id, question_id, internalOptionId]);

                // Update the vote count
                await db.query('UPDATE voting_options SET votes = votes + 1 WHERE id = ?', [internalOptionId]);
                return 'Vote submitted successfully.';
            }
        }));

        const successfulVotes = results.filter(result => result.status === 'fulfilled').length;
        const failedVotes = results.filter(result => result.status === 'rejected').length;

        res.status(200).json({
            success: true,
            message: `Votes processed: ${successfulVotes} successful, ${failedVotes} failed.`,
            details: results
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'An error occurred while processing votes.', error: error });
    }
});


router.get('/questions', (req, res) => {
    db.query(`
        SELECT vq.id AS question_id, vq.question_text, 
               vo.id AS option_id, vo.option_text, vo.votes, vo.isDone
        FROM voting_questions vq
        JOIN voting_options vo ON vq.id = vo.question_id
        ORDER BY vq.id, vo.id
    `, (error, results) => {
        if (error) {
            return res.status(500).json({ success: false, message: 'Database query failed.' });
        }

        // Group the results by question
        const questions = results.reduce((acc, row) => {
            if (!acc[row.question_id]) {
                acc[row.question_id] = {
                    question_id: row.question_id,
                    question_text: row.question_text,
                    options: []
                };
            }
            acc[row.question_id].options.push({
                option_id: row.option_id,
                option_text: row.option_text,
                votes: row.votes,
                isDone: row.isDone
            });
            return acc;
        }, {});

        res.json({ success: true, questions: Object.values(questions) });
    });
});

// Fetch voting results
router.get('/voting-results', async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT 
                vq.id AS question_id,
                vq.question_text,
                vo.id AS option_id,
                vo.option_text,
                vo.votes,
                vo.isDone,
                vt.total_votes,
                CASE WHEN vt.total_votes > 0 THEN ROUND((vo.votes / vt.total_votes * 100), 2) ELSE 0 END AS percentage
            FROM 
                voting_questions vq
            JOIN 
                voting_options vo ON vq.id = vo.question_id
            LEFT JOIN 
                (SELECT question_id, SUM(votes) AS total_votes FROM voting_options GROUP BY question_id) vt ON vq.id = vt.question_id
            WHERE 
                vq.is_active = true
            ORDER BY 
                vq.id, vo.votes DESC;
        `);
        
        const questions = results.reduce((acc, row) => {
            if (!acc[row.question_id]) {
                acc[row.question_id] = {
                    question_id: row.question_id,
                    question_text: row.question_text,
                    options: []
                };
            }
            acc[row.question_id].options.push({
                option_id: row.option_id,
                option_text: row.option_text,
                votes: row.votes,
                isDone: row.isDone,
                percentage: row.percentage
            });
            return acc;
        }, {});

        res.json({ success: true, questions: Object.values(questions) });
    } catch (error) {
        console.error("Error fetching voting results:", error);
        res.status(500).json({ success: false, message: 'Failed to fetch voting results.' });
    }
});



// Get all questions with voting details for a specific user
router.get('/user-questions/:user_id', (req, res) => {
    const user_id = req.params.user_id;

    db.query(`
        SELECT vq.id AS question_id, vq.question_text, 
               vo.id AS option_id, vo.option_text, vo.votes, vo.isDone,
               (SELECT COUNT(*) FROM user_votes WHERE user_id = ? AND question_id = vq.id) AS has_voted,
               (SELECT COUNT(*) FROM user_votes WHERE user_id = ? AND option_id = vo.id) AS has_voted_option
        FROM voting_questions vq
        JOIN voting_options vo ON vq.id = vo.question_id
        ORDER BY vq.id, vo.id
    `, [user_id, user_id], (error, results) => {
        if (error) {
            return res.status(500).json({ success: false, message: 'Database query failed.' });
        }

        // Group the results by question
        const questions = results.reduce((acc, row) => {
            if (!acc[row.question_id]) {
                acc[row.question_id] = {
                    question_id: row.question_id,
                    question_text: row.question_text,
                    has_voted: row.has_voted > 0,
                    options: []
                };
            }
            acc[row.question_id].options.push({
                option_id: row.option_id,
                option_text: row.option_text,
                votes: row.votes,
                isDone: row.isDone,
                has_voted_option: row.has_voted_option > 0
            });
            return acc;
        }, {});

        res.json({ success: true, questions: Object.values(questions) });
    });
});

module.exports = router;
