const express = require('express');
const router = express.Router();
const db = require('../config/database');
const crypto = require('crypto');
const axios = require('axios');
const secret = process.env.SESSION_SECRET || 'your_secret_key_for_encryption'; 
const recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY; // reCAPTCHA secret key from env

// Encryption and Decryption Functions
const algorithm = 'aes-256-cbc';
// Use a fixed key and iv for consistent encryption/decryption of "remembered" passwords
const key = crypto.createHash('sha256').update(secret).digest();
const iv = Buffer.alloc(16, 0); 

function encrypt(text) {
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

function decrypt(text) {
    try {
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(text, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        console.error('Decryption failed:', e);
        return null;
    }
}

router.get('/', (req, res) => {
    if (req.session.loggedin) {
        return res.redirect('/dashboard');
    }
    let rememberedPassword = null;
    if (req.cookies.rememberedPassword) {
        rememberedPassword = decrypt(req.cookies.rememberedPassword);
    }
    const isLocal = req.headers.host === 'localhost:3000';
    res.render('login', { 
        errorMessage: null, 
        rememberedUsername: req.cookies.rememberedUsername, 
        rememberedPassword, 
        isDevelopment: isLocal
    });
});

router.post('/auth', async (req, res) => {
    const { username, password, 'remember-me': rememberMe, 'g-recaptcha-response': recaptchaResponse } = req.body;

    console.log('Received login attempt:', { username, rememberMe });

    // Bypass reCAPTCHA for local development if host is localhost:3000
    const isLocal = req.headers.host === 'localhost:3000';
    let recaptchaSuccess = false;

    if (isLocal && !recaptchaResponse) {
        console.log('Skipping reCAPTCHA verification for localhost:3000.');
        recaptchaSuccess = true;
    } else if (recaptchaResponse) {
        try {
            const recaptchaVerifyResponse = await axios.post(`https://www.google.com/recaptcha/api/siteverify?secret=${recaptchaSecretKey}&response=${recaptchaResponse}`);
            console.log('reCAPTCHA verification response:', recaptchaVerifyResponse.data);
            recaptchaSuccess = recaptchaVerifyResponse.data.success;
        } catch (error) {
            console.error('Error verifying reCAPTCHA:', error);
            return res.render('login', { errorMessage: 'An error occurred during verification. Please try again.', rememberedUsername: username, isDevelopment: isLocal });
        }
    } else {
        console.log('reCAPTCHA response missing.');
        return res.render('login', { errorMessage: 'Please complete the reCAPTCHA.', rememberedUsername: username, isDevelopment: isLocal });
    }

    if (recaptchaSuccess) {
        if (username && password) {
            try {
                const [results] = await db.query('SELECT * FROM admin WHERE username = ? AND password = ?', [username, password]);
                console.log('Database query results:', results);

                if (results.length > 0) {
                    req.session.loggedin = true;
                    req.session.username = username;
                    if (rememberMe) {
                        res.cookie('rememberedUsername', username, { maxAge: 30 * 24 * 60 * 60 * 1000 }); // 30 days
                        res.cookie('rememberedPassword', encrypt(password), { maxAge: 30 * 24 * 60 * 60 * 1000 }); // 30 days
                    } else {
                        res.clearCookie('rememberedUsername');
                        res.clearCookie('rememberedPassword');
                    }
                    console.log('Login successful, redirecting to dashboard.');
                    res.redirect('/feedback');
                } else {
                    console.log('Incorrect Username and/or Password.');
                    res.render('login', { errorMessage: 'Incorrect Username and/or Password!', rememberedUsername: username, isDevelopment: isLocal });
                }
            } catch (error) {
                console.error('Error querying database:', error);
                res.render('login', { errorMessage: 'An error occurred. Please try again later.', rememberedUsername: username, isDevelopment: isLocal });
            }
        } else {
            console.log('Username or password missing.');
            res.render('login', { errorMessage: 'Please enter Username and Password!', rememberedUsername: username, isDevelopment: isLocal });
        }
    } else {
        console.log('reCAPTCHA verification failed.');
        res.render('login', { errorMessage: 'reCAPTCHA verification failed. Please try again.', rememberedUsername: username, isDevelopment: isLocal });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.redirect('/dashboard');
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

module.exports = router;
