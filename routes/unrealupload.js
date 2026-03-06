const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Set up multer with a size limit of 1MB and no file extension restriction
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadPath = path.join(__dirname, '../public/uploads/unrealupload');
            if (!fs.existsSync(uploadPath)) {
                fs.mkdirSync(uploadPath, { recursive: true });
            }
            cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
            cb(null, file.originalname); // Save with the original file name
        }
    }),
    limits: { fileSize: 1 * 1024 * 1024 } // 1MB file size limit
});

// API for uploading a file as text
router.post('/upload', upload.single('ShotTimingTrainingSet'), (req, res) => {
    if (!req.file) {
        return res.status(400).send({ error: 'No file uploaded or invalid file type.' });
    }

    const filePath = path.join(__dirname, '../public/uploads/unrealupload', req.file.originalname);

    // If the file already exists, replace it (multer already saves the file)
    fs.writeFile(filePath, req.file.buffer, (err) => {
        if (err) {
            return res.status(500).send({ error: 'Error saving file.' });
        }
        return res.status(200).send({ message: 'File uploaded successfully.', fileName: req.file.originalname });
    });
});

// API to list all uploaded files
router.get('/files', (req, res) => {
    const uploadPath = path.join(__dirname, '../public/uploads/unrealupload');
    fs.readdir(uploadPath, (err, files) => {
        if (err) {
            return res.status(500).send({ error: 'Unable to read directory.' });
        }
        res.status(200).send({ files });
    });
});

// API to download a specific file
router.get('/download/:filename', (req, res) => {
    const fileName = req.params.filename;
    const filePath = path.join(__dirname, '../public/uploads/unrealupload', fileName);

    // Check if the file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            return res.status(404).send({ error: 'File not found.' });
        }
        // Send the file as a download response
        res.download(filePath, fileName, (err) => {
            if (err) {
                res.status(500).send({ error: 'Error downloading file.' });
            }
        });
    });
});

module.exports = router;
