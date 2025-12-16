const express = require('express');
const axios = require('axios');
const amqp = require('amqplib');

// --- 1. EXPRESS & MIDDLEWARE INITIALIZATION ---
const app = express();
const PORT = 3003;
app.use(express.json()); // Essential middleware for parsing JSON bodies

// Mock database for orders (in-memory array)
const orders = [];

// --- 2. SERVICE & MESSAGING CONFIGURATION (CORRECTED FALLBACKS) ---

// CRITICAL FIX: Use the Docker service name 'product-service' as the fallback
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002'; 

// CRITICAL FIX: Ensure 'rabbitmq' is used as the service name
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672';
const QUEUE_NAME = 'new_orders';

let channel;

// Function to connect to RabbitMQ and create channel
const connectRabbitMQ = async () => {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });
        console.log('RabbitMQ connection successful.');
    } catch (error) {
        console.error('RabbitMQ connection error:', error.message);
        // We log the error here. Docker's 'depends_on' and 'service_healthy' 
        // in docker-compose.yml should prevent API calls until this works.
    }
};

// Connect upon startup
connectRabbitMQ();

// --- 3. ROUTE to create order (Completed with Product Service call and Messaging) ---
app.post('/orders', async (req, res) => {
    // The Gateway Service should have injected 'userId' from the JWT, 
    // but we allow it in the body for direct testing.
    const { userId, productId, quantity } = req.body; 

    if (!userId || !productId || !quantity) {
        return res.status(400).send('Missing required fields: userId, productId, quantity');
    }

    try {
        // A. Call Product Service to get product details (Inter-service communication)
        const productResponse = await axios.get(`${PRODUCT_SERVICE_URL}/products/${productId}`);
        const product = productResponse.data;

        // B. Create the new order object
        const newOrder = {
            orderId: `O${orders.length + 1001}`,
            userId,
            product: {
                id: product.id,
                name: product.name,
                price: product.price,
            },
            quantity,
            totalAmount: product.price * quantity,
            status: 'Pending'
        };
        orders.push(newOrder);

        // C. Publish message to RabbitMQ 
        if (channel) {
            const message = JSON.stringify({
                orderId: newOrder.orderId,
                userId: newOrder.userId,
                total: newOrder.totalAmount
            });
            channel.sendToQueue(QUEUE_NAME, Buffer.from(message), {
                persistent: true // Ensure message survives broker restart
            });
            console.log(`[Order Service] Message sent to RabbitMQ for order: ${newOrder.orderId}`);
        } else {
             console.warn(`[Order Service] RabbitMQ channel not available. Order ${newOrder.orderId} created but not published.`);
        }

        console.log(`[Order Service] New order created: ${newOrder.orderId}`);
        res.status(201).json(newOrder);

    } catch (error) {
        console.error('[Order Service] Error creating order:', error.message);
        
        // Handle errors from dependency (Product Service)
        const status = error.response ? error.response.status : 500;
        // Provide the specific error from the Product Service if possible
        const message = error.response ? error.response.data : `Internal server error or dependency failure: ${error.message}`;
        res.status(status).send(message);
    }
});

// NEW ROUTE: Simple GET route to retrieve all orders (for testing)
app.get('/orders', (req, res) => {
    res.json(orders);
});

// --- 4. START SERVER ---
app.listen(PORT, () => {
    console.log(`Order Service running on http://localhost:${PORT}`);
});