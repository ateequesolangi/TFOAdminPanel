// routes/feedback.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const axios = require('axios');
require('dotenv').config(); // Load environment variables



//---------------------------------------------------------
// Helper function to aggregate responses
//---------------------------------------------------------
function aggregateResponses(questions, responses) {
    const aggregated = questions.map(question => {
        const questionResponses = responses.filter(response => response.question_id === question.question_id);
        question.totalResponses = questionResponses.length;

        if (question.question_type === 'yesno') {
            const yesCount = questionResponses.filter(r => r.answer_text === 'yes').length;
            const noCount = questionResponses.filter(r => r.answer_text === 'no').length;
            question.aggregatedResponses = { Yes: yesCount, No: noCount };
        } else if (question.question_type === 'rating') {
            const starCounts = [1, 2, 3, 4, 5].map(star =>
                questionResponses.filter(r => parseInt(r.answer_text) === star).length
            );
            const totalStars = starCounts.reduce((sum, count, index) => sum + count * (index + 1), 0);
            const totalResponses = starCounts.reduce((sum, count) => sum + count, 0);
            const averageRating = totalResponses > 0 ? (totalStars / totalResponses).toFixed(1) : 0;
            question.aggregatedResponses = starCounts.map((count, index) => ({ star: index + 1, count }));
            question.averageRating = averageRating;
        } else if (question.question_type === 'emoji') {
            const emojiCounts = [1, 2, 3, 4, 5].map(emoji =>
                questionResponses.filter(r => parseInt(r.answer_text) === emoji).length
            );
            question.aggregatedResponses = {
                Like: emojiCounts[0],
                Heart: emojiCounts[1],
                Wow: emojiCounts[2],
                Sad: emojiCounts[3],
                Angry: emojiCounts[4]
            };
        }

        question.mode = question.mode;
        question.difficulty = question.difficulty;
        question.stadium = question.stadium;
        question.created_at = question.created_at ? new Date(question.created_at) : null;
        return question;
    });
    return aggregated;
}

//---------------------------------------------------------
//  AI Insights Route (Protected by global middleware)
//---------------------------------------------------------
async function fetchFeedbackData() {
    const [questions] = await db.query('SELECT * FROM feedbackquestions');
    const [responses] = await db.query('SELECT * FROM usersfeedback');
    return aggregateResponses(questions, responses);
}

router.get('/ai-insights', async (req, res) => {
    const forceNew = req.query.forceNew === 'true';

    try {
        if (!forceNew) {
            const [existingSummary] = await db.query(
                'SELECT * FROM aisummary ORDER BY modifydate DESC LIMIT 1'
            );
            if (existingSummary.length > 0) {
                return res.json({
                    success: true,
                    insights: existingSummary[0].aisummary,
                    date: existingSummary[0].modifydate
                });
            }
        }

        const feedbackData = await fetchFeedbackData();

        const aiResponse = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'user',
                        content: `Following are the questions and responses from our VR Cricket game. Based on this data, provide a 1-2 line insightful summary:\n\n${JSON.stringify(
                            feedbackData
                        )}`
                    }
                ],
                temperature: 0.7
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.TFOProject}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const summary = aiResponse.data.choices[0].message.content;
        const newDate = new Date();
        await db.query('INSERT INTO aisummary (aisummary, modifydate) VALUES (?, ?)', [
            summary,
            newDate
        ]);

        res.json({ success: true, insights: summary, date: newDate });
    } catch (error) {
        console.error('Error in /ai-insights route:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate insights.',
            error: error.message
        });
    }
});

//---------------------------------------------------------
//  Feedback Main Page (Protected by global middleware)
//---------------------------------------------------------
router.get('/', async (req, res) => {
    const successMessage = req.flash('success');
    const errorMessage = req.flash('error');

    try {
        const [questions] = await db.query('SELECT * FROM feedbackquestions');
        const [responses] = await db.query('SELECT * FROM usersfeedback');
        const aggregatedQuestions = aggregateResponses(questions, responses);

        res.render('feedback', { questions: aggregatedQuestions, successMessage, errorMessage });
    } catch (error) {
        console.error('Error loading feedback page:', error);
        res.status(500).send('Database query failed.');
    }
});

//---------------------------------------------------------
// Create Feedback Question (Protected by global middleware)
//---------------------------------------------------------
router.post('/create', async (req, res) => {
    const { question_text, question_type, is_active, mode, difficulty, stadium, version_name } =
        req.body;
    const created_at = new Date();
    const versionNameValue = version_name ? version_name : null;

    const query = `
        INSERT INTO feedbackquestions 
        (question_text, question_type, is_active, created_at, mode, difficulty, stadium, version_name) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
        question_text,
        question_type,
        is_active,
        created_at,
        mode,
        difficulty,
        stadium,
        versionNameValue
    ];



    try {
        await db.query(query, values);
        res.json({ success: true, message: 'Question successfully inserted.' });
    } catch (error) {
        console.error('Error creating feedback question:', error);

        res.status(500).json({ success: false, message: 'Failed to insert the question.' });
    }
});

//---------------------------------------------------------
//  Submit User Responses (Public endpoint)
//---------------------------------------------------------
router.post('/submit-response', async (req, res) => {
    const responses = req.body;
    const date_time = new Date();

    try {
        const conn = await db.getConnection();
        await conn.beginTransaction();
        const responseStatus = [];

        for (const response of responses) {
            const { match_id, question_id, user_id, answer_text } = response;

            const [existingResponses] = await conn.query(
                'SELECT * FROM usersfeedback WHERE user_id = ? AND question_id = ?',
                [user_id, question_id]
            );

            if (existingResponses.length > 0) {
                responseStatus.push({
                    success: false,
                    message: `User ${user_id} already answered question ${question_id}.`
                });
            } else {
                await conn.query(
                    'INSERT INTO usersfeedback (match_id, question_id, user_id, answer_text, date_time) VALUES (?, ?, ?, ?, ?)',
                    [match_id, question_id, user_id, answer_text, date_time]
                );
                responseStatus.push({ success: true, message: 'Response submitted successfully.' });
            }
        }

        await conn.commit();
        conn.release();
        res.status(200).json({ success: true, messages: responseStatus });
    } catch (error) {
        console.error('Error submitting response:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to commit transaction.',
            error: error.message
        });
    }
});

//---------------------------------------------------------
//  Get user-specific unanswered questions (restored endpoint)
//---------------------------------------------------------
router.get('/user-questions/:user_id', async (req, res) => {
    const user_id = req.params.user_id;
    const versionName = req.query.versionName;

    try {
        let questionsQuery = 'SELECT * FROM feedbackquestions WHERE is_active = 1';
        const queryParams = [];

        if (versionName) {
            questionsQuery += ' AND (version_name = ? OR version_name IS NULL)';
            queryParams.push(versionName);
        } else {
            questionsQuery += ' AND version_name IS NULL';
        }

        const [questions] = await db.query(questionsQuery, queryParams);
        const [responses] = await db.query('SELECT * FROM usersfeedback WHERE user_id = ?', [user_id]);

        const answeredIds = responses.map(r => r.question_id);
        const unanswered = questions.filter(q => !answeredIds.includes(q.question_id));

        res.status(200).json({
            success: true,
            questions: unanswered.map(q => ({ ...q, answered: false }))
        });
    } catch (error) {
        console.error('Error fetching user questions:', error);
        res.status(500).json({ success: false, message: 'Database query failed.' });
    }
});


//---------------------------------------------------------
// Other Routes (Protected by global middleware)
//---------------------------------------------------------
router.get('/versions', async (req, res) => {
    try {
        const [results] = await db.query(
            'SELECT DISTINCT version_name FROM feedbackquestions WHERE version_name IS NOT NULL AND version_name != ""'
        );
        const versions = results.map(row => row.version_name);
        res.json({ success: true, versions });
    } catch (error) {
        console.error('Error fetching versions:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch versions.' });
    }
});

router.get('/chart-data', async (req, res) => {
    try {
        const [questions] = await db.query('SELECT * FROM feedbackquestions');
        const [responses] = await db.query('SELECT * FROM usersfeedback');
        const aggregatedQuestions = aggregateResponses(questions, responses);
        res.status(200).json({ success: true, questions: aggregatedQuestions });
    } catch (error) {
        console.error('Error fetching chart data:', error);
        res.status(500).json({ success: false, message: 'Database query failed.' });
    }
});

router.delete('/delete/:question_id', async (req, res) => {
    const question_id = req.params.question_id;
    try {
        await db.query('DELETE FROM usersfeedback WHERE question_id = ?', [question_id]);
        await db.query('DELETE FROM feedbackquestions WHERE question_id = ?', [question_id]);
        res.json({
            success: true,
            message: 'Feedback question and its responses deleted successfully.'
        });
    } catch (error) {
        console.error('Error deleting feedback question:', error);
        res.status(500).json({ success: false, message: 'Failed to delete responses.' });
    }
});

router.post('/updateQuestion', async (req, res) => {
    const { question_id, question_text, question_type, is_active, mode, difficulty, stadium } =
        req.body;

    const query = `
        UPDATE feedbackquestions
        SET question_text = ?, question_type = ?, is_active = ?, mode = ?, difficulty = ?, stadium = ?
        WHERE question_id = ?;
    `;
    const values = [
        question_text,
        question_type,
        is_active,
        mode,
        difficulty,
        stadium,
        question_id
    ];

    try {
        await db.query(query, values);
        res.json({ success: true, message: 'Feedback question updated successfully.' });
    } catch (error) {
        console.error('Error updating question:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update the feedback question.',
            error
        });
    }
});

module.exports = router;
