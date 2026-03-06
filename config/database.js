const mysql = require('mysql2/promise');

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'halljyqm_tfoprofile'
});

db.getConnection()
    .then(conn => {
        console.log('Connected to MySQL Database.');
        conn.release();
    })
    .catch(err => {
        console.error('Unable to connect to the database:', err);
    });

module.exports = db;
