const mysql = require('mysql2/promise');

const db = mysql.createPool({
    host: 'localhost',
    user: 'halljyqm_rehman9090',
    password: '4*4fwc$)cV$6',
    database: 'halljyqm_tfoprofile'
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
