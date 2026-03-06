const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database'); // Ensure this points to your database configuration
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
        cb(null, file.originalname);
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
    upload(req, res, function (err) {
        if (err) {
            return res.json({ success: false, message: err.message });
        }

        const filePath = path.join('public', 'adstadium', req.file.originalname);
        const fileUrl = path.join('/adstadium', req.file.originalname);

        // Save file details to database
        const query = 'INSERT INTO adstadium_files (name, type, size, url) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE size = ?, url = ?';
        const values = [req.file.originalname, req.file.mimetype, req.file.size, fileUrl, req.file.size, fileUrl];

        db.query(query, values, (error) => {
            if (error) {
                return res.json({ success: false, message: 'Database query failed.' });
            }
            res.json({ success: true, message: 'File uploaded successfully.' });
        });
    });
});

// Route to fetch existing files
router.get('/files', (req, res) => {
    db.query('SELECT * FROM adstadium_files', (error, results) => {
        if (error) {
            return res.json({ success: false, message: 'Database query failed.' });
        }
        const baseUrl = 'https://admin.finalovers.cricket';
        const files = results.map(file => ({
            id: file.id,
            name: file.name,
            type: file.type,
            size: file.size,
            url: `${baseUrl}/public/adstadium/${file.name}`
        }));
        res.json({ success: true, files: files });
    });
});


// Route to delete a file
router.delete('/delete/:id', (req, res) => {
    const fileId = req.params.id;

    const query = 'SELECT * FROM adstadium_files WHERE id = ?';
    db.query(query, [fileId], (error, results) => {
        if (error || results.length === 0) {
            return res.json({ success: false, message: 'File not found.' });
        }

        const file = results[0];
        const filePath = path.join(__dirname, '..', 'public', 'adstadium', file.name);

        // Delete the file from the file system
        fs.unlink(filePath, (err) => {
            if (err) {
                return res.json({ success: false, message: 'Failed to delete file from server.' });
            }

            // Delete the file record from the database
            const deleteQuery = 'DELETE FROM adstadium_files WHERE id = ?';
            db.query(deleteQuery, [fileId], (error) => {
                if (error) {
                    return res.json({ success: false, message: 'Failed to delete file from database.' });
                }
                res.json({ success: true, message: 'File deleted successfully.' });
            });
        });
    });
});

module.exports = router;
