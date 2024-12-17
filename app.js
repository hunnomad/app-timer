const mysql = require('mysql2/promise'); // Promise-based MySQL connection
const axios = require('axios');
const winston = require('winston');
require('winston-daily-rotate-file');
require('dotenv').config(); // Reading .env file

// Winston logger configuration with log rotation
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.DailyRotateFile({
            filename: 'logs/app-%DATE%.log', // Rotate log file with date
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            zippedArchive: true
        })
    ]
});

// Application startup log message
logger.info('Application started successfully. Environment: ' + process.env.NODE_ENV);

// MySQL kapcsolat pool létrehozása
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

let isProcessing = false; // Track lock status

// Get refresh time from .env
const refreshInterval = parseInt(process.env.APP_REFRESH, 10) || 5000; // Default value: 5000 ms

// Check for unprocessed records every 5 seconds
setInterval(async () => {
    if (isProcessing) {
        logger.debug('There is a pending request, no new one will be started.');
        return;
    }

    try {
        isProcessing = true;

        // Use connection pool for query
        const [results] = await pool.execute(
            'SELECT COUNT(*) AS count FROM message_tbl WHERE processed_push = 0'
        );

        const hasNewMessages = results[0].count > 0;

        if (hasNewMessages) {
            logger.info('There is a new record to process! Calling PHP...');

            // Axios request with timeout (5000 ms) and URL taken from .env
            const response = await axios.post(process.env.PHP_ENDPOINT, {}, {
                timeout: 2000 // Set timeout to 2 seconds
            });

            logger.info(`PHP response: ${response.data}`);
        } else {
            logger.debug('There are no new records to process.');
        }
    } catch (err) {
        if (err.code === 'ECONNABORTED') {
            logger.warn('PHP request timeout: Response time exceeded 2 seconds.');
        } else {
            logger.error(`An error occurred: ${err.message}`);
        }
    } finally {
        isProcessing = false; // Unlock lock
    }
}, refreshInterval);
