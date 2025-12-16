# Post-Deployment Microservices Test Guide (API Gateway Checks)

This guide describes how to interact with the deployed microservices through the API Gateway to verify core functionality.

The API Gateway listens on port **3000** and is the single entry point for client requests.

---

## 1. System Status & Access

Overview of service endpoints:

| Service | Docker Name | Internal Port | External URL | Purpose |
| :--- | :--- | :---: | :--- | :--- |
| API Gateway | `gateway-service` | 3000 | `http://localhost:3000` | Routing, auth, logging |
| User Service | `user-service` | 3001 | *(internal only)* | Authentication (JWT) |
| Product Service | `product-service` | 3002 | *(internal only)* | Product DB (MongoDB/Redis) |
| Order Service | `order-service` | 3003 | *(internal only)* | Order processing (RabbitMQ) |
| Frontend UI | `frontend` | 8080 | `http://localhost:8080` | Client UI (placeholder) |

Required tool: use Postman, Insomnia, or curl to exercise the endpoints.

---

## 2. Authentication (User Service)

First obtain a JWT to access protected routes.

Login (POST)
- Goal: Get a JWT
- Endpoint: `/api/auth/login`

| Item | Value |
| :--- | :--- |
| Method | `POST` |
| URL | `http://localhost:3000/api/auth/login` |
| Header | `Content-Type: application/json` |
| Body | `{"email":"alice@example.com","password":"pass"}` |

Expected response: `200 OK` with a token—save it for Authorization.

```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiI..."
}
```

---

## 3. Public Product Endpoints (Product Service)

These do not require a JWT.

Get All Products (GET)
- Goal: Fetch product list
- Endpoint: `/api/products`

| Item | Value |
| :--- | :--- |
| Method | `GET` |
| URL | `http://localhost:3000/api/products` |

Expected: `200 OK` with product array.

Get Single Product (GET)
- Goal: Fetch a product and exercise Redis cache
- Endpoint: `/api/products/:productId`

| Item | Value |
| :--- | :--- |
| Method | `GET` |
| URL | `http://localhost:3000/api/products/P001` |

Expected: `200 OK` with product details for `P001`.

---

## 4. Protected Order Endpoint (Order Service)

Validates authentication, service-to-service calls, and messaging.

Create Order (POST)
- Goal: Create an order, call Product Service, publish to RabbitMQ
- Endpoint: `/api/orders`

| Item | Value |
| :--- | :--- |
| Method | `POST` |
| URL | `http://localhost:3000/api/orders` |
| Headers | `Content-Type: application/json`<br>`Authorization: Bearer <TOKEN>` |
| Body | JSON order with a valid productId |

Example request body:

```json
{
  "productId": "P002",
  "quantity": 2
}
```

Expected: `201 Created` with order details. Order Service should log a RabbitMQ publish.

Example response:

```json
{
  "orderId": "O1001",
  "userId": "101",
  "product": {
    "id": "P002"
    // ... price, name ...
  },
  "totalAmount": 240,
  "status": "Pending"
}
```

---

## 5. Post-Request Verification

Check logs and messaging after order creation.

Check service logs:

```bash
docker-compose logs <service-name>
```

Look for:
- `gateway-service`: `PROTECTED Request received for new order` — confirms valid JWT and routing.
- `product-service`: `[Product Service] MISS: P002` — confirms product lookup (cache miss).
- `order-service`: `[Order Service] Message sent to RabbitMQ for order: O1001` — confirms message published.

Check RabbitMQ Management UI:
- Access: `http://localhost:15672`
- Login: default `guest` / `guest`
- Verify queue `new_orders` shows >= 1 ready messages.

---
