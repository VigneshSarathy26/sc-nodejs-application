const express = require('express');
const cors = require('cors'); // <-- 1. Import CORS
// ... other imports (axios, mongoose, etc.)

const app = express();
const PORT = process.env.PORT || 3000; // Use env var for K8s flexibility

// 2. Configure CORS
// Replace '*' with your dashboard's specific domain (e.g., 'http://dashboard.local') 
// for better security in production.
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// 3. Add Health Endpoint
// This returns a 200 OK status for K8s and your Dashboard
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        service: process.env.SERVICE_NAME || 'microservice',
        timestamp: new Date().toISOString()
    });
});

// ... your existing routes ...

app.listen(PORT, () => {
    console.log(`Service running on port ${PORT}`);
});