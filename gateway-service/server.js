const express = require('express');
const axios = require('axios');
const winston = require('winston');
const jwt = require('jsonwebtoken');

// --- 1. EXPRESS & MIDDLEWARE INITIALIZATION (CRITICAL FIX) ---
const app = express();
const PORT = 3000;
app.use(express.json()); // Essential middleware for parsing JSON bodies
// -------------------------------------------------------------

// --- 2. SERVICE & AUTH CONFIGURATION ---
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3001';
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002';
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://order-service:3003';
const AUTH_SECRET = process.env.AUTH_SECRET || 'my_secure_jwt_secret';

// --- 3. WINSTON LOGGER SETUP ---
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
    ],
});

// --- 4. AUTHENTICATION MIDDLEWARE ---
// This function verifies the JWT sent by the client
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    // Expects header format: 'Bearer TOKEN'
    const token = authHeader && authHeader.split(' ')[1]; 

    if (token == null) {
        logger.warn('Authentication failure: No token provided', { route: req.originalUrl, ip: req.ip });
        return res.sendStatus(401); // Unauthorized
    }

    jwt.verify(token, AUTH_SECRET, (err, user) => {
        if (err) {
            logger.error('Authentication failure: Invalid or expired token', { route: req.originalUrl, ip: req.ip, error: err.message });
            return res.sendStatus(403); // Forbidden
        }
        req.user = user; // Attach decoded user payload (userId, email, role) to the request
        next();
    });
};

// --- 5. ROUTING AND PROXY LOGIC ---

// A. Route to User Service (for /auth/login, etc.)
app.use('/api/auth', (req, res) => {
    logger.info(`Routing to User Service`, { method: req.method, route: req.originalUrl, ip: req.ip });
    const url = `${USER_SERVICE_URL}${req.originalUrl.replace('/api/auth', '/auth')}`;
    
    // Proxy POST request (like login)
    axios.post(url, req.body)
        .then(response => res.json(response.data))
        .catch(error => {
            const status = error.response ? error.response.status : 500;
            const message = error.response ? error.response.data : error.message;
            logger.error('User Auth Service Error', { status: status, message: message });
            res.status(status).send(message);
        });
});

// B. Route to Product Service (Publicly accessible)
app.get('/api/products', (req, res) => {
    logger.info('Request received for all products', { route: req.originalUrl, ip: req.ip });
    axios.get(`${PRODUCT_SERVICE_URL}/products`)
        .then(response => res.json(response.data))
        .catch(error => {
            logger.error('Product Service Error', { status: 500, message: error.message });
            res.status(500).send('Product Service Error: ' + error.message);
        });
});

app.get('/api/products/:productId', (req, res) => {
    logger.info('Request received for single product', { route: req.originalUrl, ip: req.ip });
    axios.get(`${PRODUCT_SERVICE_URL}/products/${req.params.productId}`)
        .then(response => res.json(response.data))
        .catch(error => {
            const status = error.response ? error.response.status : 500;
            const message = error.response ? error.response.data : error.message;
            logger.error('Product Service Error', { status: status, message: message });
            res.status(status).send(message);
        });
});

// C. Route to Order Service (PROTECTED ROUTE) 
app.post('/api/orders', authenticateToken, (req, res) => {
    logger.info('PROTECTED Request received for new order', { user: req.user.userId, route: req.originalUrl, ip: req.ip });

    // The order service needs the userId, which we can extract from the JWT payload (req.user)
    const orderData = {
        ...req.body,
        userId: req.user.userId // Inject userId from the authenticated token
    };

    axios.post(`${ORDER_SERVICE_URL}/orders`, orderData)
        .then(response => res.status(201).json(response.data))
        .catch(error => {
            const status = error.response ? error.response.status : 500;
            const message = error.response ? error.response.data : error.message;
            logger.error('Order Service Error', { status: status, message: message, user: req.user.userId });
            res.status(status).send(message);
        });
});

// --- 6. START SERVER ---
app.listen(PORT, () => {
    console.log(`API Gateway running on http://localhost:${PORT}`);
});