const express = require('express');
const cors = require('cors'); // 1. Import CORS
// ... other existing imports (axios, jwt, etc.)

const app = express();
const PORT = process.env.PORT || 3000; // Updated to use env vars for K8s

// 2. Configure CORS
// Setting origin to '*' allows the dashboard to reach the service from any domain.
// In production, replace '*' with your specific dashboard URL (e.g., 'http://dashboard.local')
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// 3. Add Health Check Endpoint
// Returns a 200 OK status for both the Dashboard and Kubernetes Probes
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        service: process.env.SERVICE_NAME || 'service-name',
        timestamp: new Date().toISOString()
    });
});

// ... existing routes ...

app.listen(PORT, () => {
    console.log(`Service running on port ${PORT}`);
});