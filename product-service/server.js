const express = require('express');
const mongoose = require('mongoose');
const redis = require('redis');
const axios = require('axios'); // Added Axios just in case for future expansion, though not strictly needed here

// --- 1. EXPRESS & MIDDLEWARE INITIALIZATION ---
const app = express();
const PORT = 3002;
app.use(express.json()); // Essential middleware for parsing JSON bodies

// --- 2. REDIS CACHE SETUP ---
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CACHE_TTL = 30; // Time to live: 30 seconds

const redisClient = redis.createClient({ url: REDIS_URL });

redisClient.on('error', (err) => console.error('Redis Client Error', err));

// Connect to Redis. In Mongoose setup, we ensure the server only starts after both connections are ready.
redisClient.connect()
    .then(() => console.log('Redis connection successful.'))
    .catch(err => console.error('Redis connection error:', err.message));


// --- 3. DATABASE SETUP (Mongoose) ---
// const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/ecom_products';
const MONGO_URL = process.env.MONGO_URL || 'mongodb://user:password@db:27017/ecom_products?authSource=admin';
// Define Product Schema
const productSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    stock: { type: Number, default: 0 }
});
const Product = mongoose.model('Product', productSchema);

// Connect to MongoDB and start the server only upon success
mongoose.connect(MONGO_URL)
    .then(() => {
        console.log('MongoDB connection successful');
        initializeProducts(); // Ensure initial data exists
        app.listen(PORT, () => {
            console.log(`Product Service running on http://localhost:${PORT}`);
        });
    })
    .catch(err => console.error('MongoDB connection error (CRITICAL):', err.message));


// Function to ensure some data exists
const initializeProducts = async () => {
    // This function is defined below the Product model definition
    const count = await Product.countDocuments();
    if (count === 0) {
        const initialProducts = [
            { id: 'P001', name: 'Laptop Pro', price: 1500.00, stock: 15 },
            { id: 'P002', name: 'Mechanical Keyboard', price: 120.00, stock: 50 },
            { id: 'P003', name: '4K Monitor', price: 450.00, stock: 10 }
        ];
        await Product.insertMany(initialProducts);
        console.log('Initial product data inserted.');
    }
};

// --- 4. ROUTES ---

// Route to get all products (no caching needed here)
app.get('/products', async (req, res) => {
    try {
        const products = await Product.find({}, { _id: 0, __v: 0 }); 
        res.json(products);
    } catch (error) {
        res.status(500).send('Database fetch error: ' + error.message);
    }
});

// Route to get a single product by ID (WITH CACHING)
app.get('/products/:productId', async (req, res) => {
    try {
        const productId = req.params.productId;
        const cacheKey = `product:${productId}`;

        // 1. Try to fetch from cache
        const cachedProduct = await redisClient.get(cacheKey);
        if (cachedProduct) {
            console.log(`[Product Service] HIT: ${productId}`);
            return res.json(JSON.parse(cachedProduct));
        }
        console.log(`[Product Service] MISS: ${productId}`);

        // 2. Fetch from database (if cache miss)
        const product = await Product.findOne({ id: productId }, { _id: 0, __v: 0 });

        if (product) {
            // 3. Store in cache for next time
            const productJson = JSON.stringify(product);
            await redisClient.setEx(cacheKey, CACHE_TTL, productJson);
            res.json(product);
        } else {
            res.status(404).send('Product not found');
        }
    } catch (error) {
        res.status(500).send('Service error: ' + error.message);
    }
});


// NEW ROUTE: Update a product (WITH CACHE INVALIDATION)
app.put('/products/:productId', async (req, res) => {
    try {
        const productId = req.params.productId;
        const cacheKey = `product:${productId}`;
        const updateData = req.body;

        const updatedProduct = await Product.findOneAndUpdate(
            { id: productId },
            updateData,
            { new: true, fields: { _id: 0, __v: 0 } } // Return the updated document, exclude _id and __v
        );

        if (updatedProduct) {
            // CRITICAL: Invalidate the cache for this product
            await redisClient.del(cacheKey);
            console.log(`[Product Service] Cache invalidated for product: ${productId}`);
            res.json(updatedProduct);
        } else {
            res.status(404).send('Product not found for update');
        }
    } catch (error) {
        res.status(500).send('Update failed: ' + error.message);
    }
});

// Route to create a new product 
app.post('/products', async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        await newProduct.save();
        res.status(201).json(newProduct);
    } catch (error) {
        res.status(400).send('Failed to create product: ' + error.message);
    }
});