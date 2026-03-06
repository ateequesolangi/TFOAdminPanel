// middleware/authMiddleware.js

function authMiddleware(req, res, next) {
    // ✅ Bypass auth completely when testing (for Postman or local API checks)
    if (process.env.DISABLE_AUTH === 'true') {
        console.log('🧪 Auth disabled for testing -> Allowing:', req.originalUrl);
        return next();
    }

    // ✅ Normal session-based authentication check
    if (req.session && (req.session.loggedin || req.session.user || req.session.admin || req.session.adminUser)) {
        return next();
    }

    console.log('🔒 Session inactive, redirecting to / from:', req.originalUrl);
    return res.redirect('/');
}


module.exports = authMiddleware;
