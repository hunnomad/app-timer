const mysql = require('mysql2/promise'); // Promise alapú MySQL kapcsolat
const axios = require('axios');
const winston = require('winston');
require('winston-daily-rotate-file');
require('dotenv').config(); // .env fájl beolvasása

// Winston logger konfiguráció log rotációval
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
            filename: 'logs/app-%DATE%.log', // Log fájl forgatása dátummal
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            zippedArchive: true
        })
    ]
});

// Alkalmazás indítás log üzenet
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

let isProcessing = false; // Lock állapot követése

// 2 másodpercenként ellenőrizzük a feldolgozatlan rekordokat
setInterval(async () => {
    if (isProcessing) {
        logger.debug('Folyamatban lévő kérés van, újabb nem indul.');
        return;
    }

    try {
        isProcessing = true;

        // Kapcsolat pool használata lekérdezéshez
        const [results] = await pool.execute(
            'SELECT COUNT(*) AS count FROM message_tbl WHERE processed_push = 0'
        );

        const hasNewMessages = results[0].count > 0;

        if (hasNewMessages) {
            logger.info('Van új feldolgozandó rekord! PHP meghívása...');

            // Axios kérés timeout-tal (2000 ms) és .env-ből vett URL-lel
            const response = await axios.post(process.env.PHP_ENDPOINT, {}, {
                timeout: 2000 // Timeout beállítása 2 másodpercre
            });

            logger.info(`PHP válasz: ${response.data}`);
        } else {
            logger.debug('Nincs új feldolgozandó rekord.');
        }
    } catch (err) {
        if (err.code === 'ECONNABORTED') {
            logger.warn('PHP kérés timeout: A válaszidő túllépte a 2 másodpercet.');
        } else {
            logger.error(`Hiba történt: ${err.message}`);
        }
    } finally {
        isProcessing = false; // Lock feloldása
    }
}, 5000);
