const express = require('express');
const jwt = require('jsonwebtoken');

// --- 1. EXPRESS & MIDDLEWARE INITIALIZATION (CRITICAL FIX) ---
const app = express();
const PORT = 3001;
// Essential middleware for parsing JSON bodies in POST requests
app.use(express.json()); 
// -------------------------------------------------------------

const AUTH_SECRET = process.env.AUTH_SECRET || 'my_secure_jwt_secret';

// Mock user data for profile lookup (in a real app, this hits a database)
const users = {
    '101': { id: '101', name: 'Alice Smith', email: 'alice@example.com', role: 'customer' },
    '102': { id: '102', name: 'Bob Johnson', email: 'bob@example.com', role: 'admin' }
};

// --- 2. AUTHENTICATION ROUTE (MOCK LOGIN) ---
// Generates a JWT upon successful mock login
app.post('/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    // Mock authentication check
    if (email === 'alice@example.com' && password === 'pass') {
        const user = users['101'];
        
        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            AUTH_SECRET,
            { expiresIn: '1h' }
        );
        // 
        return res.json({ 
            message: "Login successful",
            token: token 
        });
    } else if (email === 'bob@example.com' && password === 'pass') {
        const user = users['102'];
        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            AUTH_SECRET,
            { expiresIn: '1h' }
        );
        return res.json({ 
            message: "Login successful",
            token: token 
        });
    }
    
    res.status(401).send('Invalid credentials');
});

// --- 3. PROFILE ROUTE ---
// Returns mock user data based on ID
app.get('/users/:userId', (req, res) => {
    const userId = req.params.userId;
    console.log(`[User Service] Request for user ID: ${userId}`);
    
    const user = users[userId];

    if (user) {
        // Return only necessary profile data, excluding sensitive fields
        res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
    } else {
        res.status(404).send('User not found');
    }
});

// --- 4. START SERVER ---
app.listen(PORT, () => {
    console.log(`User Service running on http://localhost:${PORT}`);
});