const express = require('express');
const cors = require('cors'); // 1. Added CORS requirement
const axios = require('axios');
const amqp = require('amqplib');

const app = express();
const PORT = process.env.PORT || 3003;

// 2. Configure CORS
// Setting origin to '*' allows the dashboard to reach the service regardless of where it's hosted.
// For production, you can change '*' to 'http://your-dashboard-domain.com'
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// 3. New Health Check Endpoint
// This is used by both your Dashboard and Kubernetes Liveness/Readiness probes
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        service: process.env.SERVICE_NAME || 'order-service'
    });
});

// ... [Existing routes like app.post('/orders')]

app.listen(PORT, () => {
    console.log(`Service running on port ${PORT}`);
});