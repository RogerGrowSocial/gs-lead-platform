const winston = require('winston');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Check if running on Vercel (read-only filesystem)
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

// Create logger instance
const transports = [
    // Write all logs to console (always available)
    new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    })
];

// Only add file transports if not on Vercel (Vercel has read-only filesystem)
if (!isVercel) {
    // Create logs directory if it doesn't exist (lazy, non-blocking)
    const fs = require('fs');
    const logsDir = path.join(process.cwd(), 'logs');
    try {
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        // Write all logs with level 'info' and below to combined.log
        transports.push(new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }));
        // Write all logs with level 'error' and below to error.log
        transports.push(new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }));
    } catch (err) {
        // Non-blocking: if directory creation fails, continue anyway
        // Logs will just go to console
        console.warn('⚠️ Could not create logs directory:', err.message);
    }
}

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: transports
});

module.exports = logger; 