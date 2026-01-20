# Rental App Project Setup

This is a complete Uber-like rental application with React frontend and Node.js backend.

## Project Setup Completed ✅

### Backend (Node.js/Express)
- ✅ Server configuration with Socket.io
- ✅ MongoDB models (User, Vehicle, Booking, Payment, Rating)
- ✅ Authentication with JWT
- ✅ RESTful API routes for all features
- ✅ Real-time location tracking
- ✅ Payment and rating systems

### Frontend (React)
- ✅ Authentication pages (Login/Register)
- ✅ Customer dashboard with booking
- ✅ Driver dashboard with online status
- ✅ Ride history and ratings
- ✅ Responsive UI design
- ✅ API integration with Axios

## To Get Started

### 1. Install Dependencies

```bash
# Backend
cd server && npm install

# Frontend
cd client && npm install
```

### 2. Setup Database

Ensure MongoDB is running:
```bash
mongod
```

### 3. Configure Environment

Create `server/.env`:
```
MONGODB_URI=mongodb://localhost:27017/rental-app
JWT_SECRET=your_secret_key_here
PORT=5000
```

### 4. Run Application

```bash
# Terminal 1: Backend
cd server && npm run dev

# Terminal 2: Frontend
cd client && npm start
```

## Features Implemented

✅ User Authentication (Register/Login)
✅ Customer Ride Booking
✅ Driver Dashboard
✅ Real-time Location Tracking
✅ Ride Acceptance System
✅ Rating System
✅ Payment Integration Ready
✅ Responsive Design

## Project Structure

- `server/` - Backend (Express.js + MongoDB)
- `client/` - Frontend (React)
- `README.md` - Full documentation
- `SETUP.md` - Installation guide

## Default Access

- Backend: http://localhost:5000
- Frontend: http://localhost:3000

## Test Credentials

Create test accounts through the registration flow.

---

For detailed setup instructions, see `SETUP.md`
