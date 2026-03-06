const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Set up the storage engine
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', 'public', 'multiplayer');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

// File filter to accept only ZIP files
const fileFilter = function (req, file, cb) {
    if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed') {
        cb(null, true);
    } else {
        cb(new Error('Only ZIP files are allowed.'), false);
    }
};

// Set up multer middleware
const upload = multer({
    storage: storage,
    limits: { fileSize: 5242880 }, // 5 MB
    fileFilter: fileFilter
}).single('zipFile');

// Route to render the multiplayer page
router.get('/', (req, res) => {
    res.render('multiplayer');
});

// Route to handle file upload
router.post('/upload', (req, res) => {
    upload(req, res, function (err) {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.json({ success: false, message: 'File size exceeds the maximum limit of 5 MB.' });
            }
            return res.json({ success: false, message: err.message });
        }
        res.json({ success: true, message: 'File uploaded successfully.' });
    });
});

module.exports = router;
