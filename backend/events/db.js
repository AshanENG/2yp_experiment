const { Pool } = require('pg');  //pg class

// Create a connection pool for your local PostgreSQL database
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
});

// Test connection
pool.on('connect', () => {
    console.log('Connected to PostgreSQL database:', process.env.DB_NAME);
});

pool.on('error', (err) => {
    console.error('PostgreSQL connection error:', err);
});

module.exports = pool;