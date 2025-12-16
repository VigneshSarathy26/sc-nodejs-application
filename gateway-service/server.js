const express = require('express');
const httpProxy = require('express-http-proxy');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
const winston = require('winston');
const cors = require('cors'); // <-- NEW: Required for Frontend communication

const app = express();
const PORT = 3000;

// --- CONFIGURATION ---
const AUTH_SECRET = process.env.AUTH_SECRET || 'your_secret_key'; // Used for JWT validation
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3001';
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002';
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://order-service:3003';

// --- WINSTON LOGGER SETUP ---
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console(),
    ],
});

// --- MIDDLEWARE ---
app.use(express.json()); // To parse JSON bodies
app.use(morgan('short')); // HTTP request logging

// --- CORS CONFIGURATION (CRITICAL FIX for Frontend Dashboard) ---
app.use(cors({
    origin: 'http://localhost:8080', // Only allow requests from the frontend UI
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
// ------------------------------------------

// --- PROXY SETUP ---
const userServiceProxy = httpProxy(USER_SERVICE_URL);
const productServiceProxy = httpProxy(PRODUCT_SERVICE_URL);
const orderServiceProxy = httpProxy(ORDER_SERVICE_URL);

// --- JWT AUTHENTICATION MIDDLEWARE ---
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader) {
        const token = authHeader.split(' ')[1];

        jwt.verify(token, AUTH_SECRET, (err, user) => {
            if (err) {
                logger.error('JWT Validation Error', { error: err.message, token });
                return res.sendStatus(403); // Forbidden
            }
            
            // Attach user payload (userId, role) to the request object
            req.user = user; 
            logger.info('JWT validated successfully', { userId: user.userId, role: user.role });
            next();
        });
    } else {
        res.sendStatus(401); // Unauthorized (No token provided)
    }
};

// --- ROUTING ---

// 1. User & Authentication (Public)
app.use('/api/auth', (req, res, next) => {
    logger.info('Routing to User Service', { method: req.method, route: req.url, ip: req.ip });
    userServiceProxy(req, res, next);
});

// 2. Product Service (Public)
app.use('/api/products', (req, res, next) => {
    logger.info('Routing to Product Service', { method: req.method, route: req.url, ip: req.ip });
    productServiceProxy(req, res, next);
});

// 3. Order Service (Protected)
app.use('/api/orders', authenticateJWT, (req, res, next) => {
    // Before proxying, inject the userId from the validated JWT payload into the request body
    // This allows the Order Service to know who placed the order without re-validating the JWT.
    if (req.method === 'POST') {
        req.body.userId = req.user.userId;
        logger.info('PROTECTED Request received for new order', { userId: req.user.userId, ip: req.ip });
    }
    
    orderServiceProxy(req, res, next);
});

// --- START SERVER ---
app.listen(PORT, () => {
    logger.info(`API Gateway running on http://localhost:${PORT}`);
});