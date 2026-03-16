const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const router = express.Router();

// Set up the storage engine
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', 'public', 'adstadium');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

// File filter to accept only specific file types
const fileFilter = function (req, file, cb) {
    if (['image/jpeg', 'image/png', 'image/gif', 'video/mp4'].includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only .jpg, .png, .gif, and .mp4 files are allowed.'), false);
    }
};

// Set up multer middleware
const upload = multer({
    storage: storage,
    fileFilter: fileFilter
}).single('stadiumFile');

// Route to render the ad stadium page
router.get('/', (req, res) => {
    res.render('adstadium');
});

// Route to handle file upload
router.post('/upload', (req, res) => {
    upload(req, res, async function (err) {
        if (err) {
            return res.json({ success: false, message: err.message });
        }
        if (!req.file) {
            return res.json({ success: false, message: 'Please select a file to upload.' });
        }

        const fileName = req.file.filename;
        const fileUrl = `/adstadium/${fileName}`;

        try {
            const query = 'INSERT INTO adstadium_files (name, type, size, url) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE size = ?, url = ?';
            const values = [fileName, req.file.mimetype, req.file.size, fileUrl, req.file.size, fileUrl];
            await db.query(query, values);
            res.json({ success: true, message: 'File uploaded successfully.' });
        } catch (error) {
            console.error('Upload Error:', error);
            res.json({ success: false, message: 'Database query failed.' });
        }
    });
});

// Route to fetch existing files
router.get('/files', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM adstadium_files ORDER BY id DESC');
        const files = results.map(file => ({
            id: file.id,
            name: file.name,
            type: file.type,
            size: file.size,
            url: file.url
        }));
        res.json({ success: true, files: files });
    } catch (error) {
        console.error('Fetch Files Error:', error);
        res.json({ success: false, message: 'Database query failed.' });
    }
});

// Route to delete a file
router.delete('/delete/:id', async (req, res) => {
    const fileId = req.params.id;

    try {
        const [results] = await db.query('SELECT * FROM adstadium_files WHERE id = ?', [fileId]);
        if (results.length === 0) {
            return res.json({ success: false, message: 'File not found.' });
        }

        const file = results[0];
        const filePath = path.join(__dirname, '..', 'public', 'adstadium', file.name);

        // Delete the file from the file system
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Delete the file record from the database
        await db.query('DELETE FROM adstadium_files WHERE id = ?', [fileId]);
        res.json({ success: true, message: 'File deleted successfully.' });
    } catch (error) {
        console.error('Delete Error:', error);
        res.json({ success: false, message: 'Failed to delete the file.' });
    }
});

module.exports = router;

module.exports = router;
