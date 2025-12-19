const express = require('express');
const cors = require('cors'); // Required for cross-origin requests
const app = express();
const PORT = process.env.PORT || 3000; // Use environment variables for K8s

// 1. Configure CORS
// In production, replace '*' with your specific domain (e.g., 'http://ecommerce.local')
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// 2. Health Check Endpoint
// Used by the Dashboard and K8s Liveness/Readiness probes
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        service: process.env.SERVICE_NAME || 'microservice'
    });
});

// ... Existing routes (Login, Products, etc.)

app.listen(PORT, () => {
    console.log(`Service running on port ${PORT}`);
});