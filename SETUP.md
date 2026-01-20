# Getting Started Guide

## Quick Start

### 1. Install Dependencies

**Backend:**
```bash
cd server
npm install
```

**Frontend:**
```bash
cd client
npm install
```

### 2. Configure Environment

In `server/.env`:
```
MONGODB_URI=mongodb://localhost:27017/rental-app
JWT_SECRET=your_secret_key_change_this
STRIPE_KEY=sk_test_your_stripe_key
PORT=5000
NODE_ENV=development
```

### 3. Start MongoDB

```bash
# On Windows
mongod

# On macOS/Linux
brew services start mongodb-community
```

### 4. Run the Application

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd client
npm start
```

## Testing the App

### Customer Flow
1. Go to http://localhost:3000
2. Click "Register" 
3. Fill in details and select "Customer"
4. Click "Book a Ride"
5. Enter pickup and dropoff locations
6. Wait for driver acceptance

### Driver Flow
1. Go to http://localhost:3000
2. Click "Register"
3. Fill in details and select "Driver"
4. Go to Dashboard and toggle "Online"
5. Add your vehicle details
6. Accept incoming ride requests
7. View earnings

## Common Issues

**Port 5000 already in use?**
```bash
# Find and kill the process
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

**MongoDB not running?**
```bash
# Start MongoDB
mongod
```

**Dependencies not installing?**
```bash
# Clear npm cache
npm cache clean --force
npm install
```

## API Testing

Use Postman or curl to test endpoints:

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com","password":"pass123","phone":"1234567890","userType":"customer"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"pass123"}'

# Get vehicles
curl http://localhost:5000/api/vehicles
```

## Next Steps

1. Set up payment integration with Stripe
2. Implement Google Maps for location
3. Add real-time notifications
4. Deploy to production
5. Add admin dashboard
