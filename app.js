// app.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const flash = require('connect-flash');
const app = express();

// Import middleware
const authMiddleware = require('./middleware/authMiddleware');

// Database config
const db = require('./config/database');

const appUrl = (process.env.APP_URL || '').toLowerCase();
const host = (process.env.HOSTNAME || '').toLowerCase();
const isProduction =
    process.env.NODE_ENV === 'production' ||
    appUrl.includes('admin.finalovers.cricket') ||
    host.includes('admin.finalovers.cricket');

if (isProduction) {
    // Required so secure cookies survive behind cPanel/Passenger proxying.
    app.set('trust proxy', 1);
}

// Middleware setup
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(
    session({
        secret: process.env.SESSION_SECRET || 'fallback_secret',
        resave: false,
        saveUninitialized: false,
        proxy: isProduction,
        cookie: {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        }
    })
);
app.use(flash());

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.locals.recaptchaSiteKey = process.env.RECAPTCHA_SITE_KEY;

// Routers
const authRouter = require('./routes/auth');
const dashboardRouter = require('./routes/dashboard');
const feedbackRouter = require('./routes/feedback');
const votingRouter = require('./routes/voting');
const multiplayerRouter = require('./routes/multiplayer');
const adstadiumRouter = require('./routes/adstadium');
const testPromptRouter = require('./routes/testprompt');
const unrealuploadRouter = require('./routes/unrealupload');
const gprankingRouter = require('./routes/gpranking');
const gppublic = require('./routes/gppublic');
const reviewRouter = require('./routes/review');

// Public routes (no auth)
app.use('/', authRouter);

// Protected web page routes
app.use('/dashboard', authMiddleware, dashboardRouter);
app.use('/voting', authMiddleware, votingRouter);
app.use('/adstadium', authMiddleware, adstadiumRouter);
app.use('/multiplayer', authMiddleware, multiplayerRouter);
app.use('/testprompt', authMiddleware, testPromptRouter);
app.use('/unrealupload', authMiddleware, unrealuploadRouter);
app.use('/gpranking', authMiddleware, gprankingRouter);
app.use('/gppublic', gppublic);
app.use('/review-bat-unlock', authMiddleware, reviewRouter);

// Feedback routes
app.get('/feedback', authMiddleware, (req, res, next) => {
    feedbackRouter.handle(req, res, next);
});

app.use('/feedback', feedbackRouter);

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.redirect('/dashboard');
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
