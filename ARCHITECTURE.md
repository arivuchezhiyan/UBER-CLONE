# Architecture & Flow Diagrams

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (React)                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Pages: Login, Home, Booking, History, Driver       │  │
│  │  Components: Navigation, Cards, Forms               │  │
│  │  Services: API (Axios), Socket.io                  │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/WebSocket
┌──────────────────────▼──────────────────────────────────────┐
│                   SERVER (Node.js/Express)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Routes: /api/auth, /vehicles, /bookings, /ratings  │  │
│  │  Controllers: Business Logic                        │  │
│  │  Middleware: JWT Auth, Error Handler               │  │
│  │  Socket.io: Real-time Events                       │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │ Mongoose ODM
┌──────────────────────▼──────────────────────────────────────┐
│            DATABASE (MongoDB)                               │
│  Collections: Users, Vehicles, Bookings, Ratings, Payments │
└──────────────────────────────────────────────────────────────┘
```

## User Flow - Booking a Ride

```
CUSTOMER                           SYSTEM                    DRIVER
   │                                  │                         │
   ├──── Register ────────────────────▶│                         │
   │                                  ├──── Hash Password       │
   │                                  ├──── Save to DB         │
   │                                  └──── Return JWT         │
   │                                                            │
   ├──── Request Ride ─────────────────▶│                        │
   │                                  ├──── Create Booking    │
   │                                  ├──── Status: Pending   │
   │ (waiting for driver)            │                        │
   │                                  ├──── Emit Socket Event  │
   │                                  ├──────────────────────▶ │
   │                                  │  Incoming Ride Alert   │
   │                                  │                  (Online)
   │                                  │                        │
   │                                  │  ◀─ Accept Ride ──────┤
   │                                  ├──── Status: Accepted  │
   │ (driver accepted)  ◀────────────┤                        │
   │                                  │                        │
   ├──── Ride Complete ───────────────▶│                        │
   │                                  ├──── Calculate Fare    │
   │                                  ├──── Status: Completed │
   │                                  │                        │
   ├──── Rate Driver ──────────────────▶│                        │
   │                                  ├──── Update Rating ◀────┤
   │                                  │                  (Rated)
   │                                  │                        │
   └────── View History ──────────────▶│                        │
                                       ├──── Return Bookings   │
                                       │                        │
```

## Database Relationships

```
┌─────────────┐         ┌──────────────┐
│   User      │         │   Vehicle    │
│             │         │              │
│ id          │    ┌────│ driverId (FK)│
│ email       │    │    │ licensePlate │
│ password    │    │    │ model        │
│ userType    │    │    │ pricePerKm   │
│ rating      │    │    │              │
└─────────────┘    │    └──────────────┘
       │           │            │
       │           └────┐       │
       │                │       │
       │         ┌──────▼───────▼──┐
       │         │   Booking       │
       │         │                 │
       ├─────────│ customerId (FK) │
       │         │ driverId (FK)   │
       │         │ vehicleId (FK)  │
       │         │ status          │
       │         │ fare            │
       │         └────────┬────────┘
       │                  │
       │          ┌───────▼────────┐
       │          │   Rating       │
       │          │                │
       ├──────────│ ratedUser (FK) │
       │          │ ratedBy (FK)   │
       │          │ rating         │
       │          │ review         │
       │          └────────────────┘
       │
       │         ┌──────────────────┐
       │         │    Payment       │
       │         │                  │
       └─────────│ userId (FK)      │
               │ bookingId (FK) │
               │ amount         │
               │ status         │
               └──────────────────┘
```

## State Management Flow

```
Login/Register
       │
       ▼
   Authentication
   (JWT Token + userType)
       │
   ┌───┴──────┬──────────┐
   │          │          │
   ▼          ▼          ▼
Customer   Driver      Admin
  Home   Dashboard    Analytics
   │          │          │
   ├──────────┼──────────┤
   │ Available Rides
   │ (Real-time via Socket.io)
   │
   ├─ Book Ride ─────▶ Create Booking
   │                      │
   │ (WebSocket emit)◀─────┤
   │                      │
   └─ Ride Accepted
         │
         ├─ In Progress
         │
         ├─ Complete
         │
         └─ Rate & Review
                │
                ▼
           Update Ratings
```

## API Request/Response Pattern

```
CLIENT REQUEST:
POST /api/bookings
Headers: Authorization: Bearer <JWT_TOKEN>
Body: {
  pickupLocation: { address, latitude, longitude },
  dropoffLocation: { address, latitude, longitude },
  startTime: <timestamp>,
  specialRequests: <string>
}

SERVER RESPONSE:
200 OK
{
  _id: <bookingId>,
  customerId: <userId>,
  status: "pending",
  createdAt: <timestamp>
}

REAL-TIME UPDATE (WebSocket):
Event: "ride-accepted"
Data: {
  bookingId: <id>,
  driverId: <id>,
  driverName: <string>,
  estimatedArrival: <minutes>
}
```

## Authentication Flow

```
1. REGISTER
   User Input → Hash Password → Save to DB → Return JWT

2. LOGIN
   Email + Password → Validate → Compare Hash → Return JWT

3. API CALL
   Client → Request with JWT in Header
            → Server validates token
            → Extract userId from token
            → Process request
            → Return data

4. TOKEN STORAGE
   localStorage.setItem('token', jwtToken)
   → Use in all API calls
   → Clear on logout
```

## Real-Time Location Update Flow

```
DRIVER                          SERVER                    CUSTOMER
   │                               │                          │
   ├─ Share Location ─────────────▶│                          │
   │  (Socket: driver-location)    │                          │
   │                               ├─ Broadcast to Customers │
   │                               ├─────────────────────────▶│
   │                               │  Socket: driver-location │
   │                               │                 Update Map
   │                               │                          │
   │  (Every 5 sec)                │                          │
   │  New Location ────────────────▶│                          │
   │                               ├─ Update & Broadcast ────▶│
   │                               │                      Refresh
   │                               │                          │
   └─ Ride Complete ──────────────▶│                          │
     (Status: completed)           ├─ Stop Broadcasting ─────▶│
                                   │                       (Refresh)
```

## Feature Implementation Checklist

```
✅ COMPLETED:
├─ User Authentication (Register/Login)
├─ Customer Dashboard
├─ Ride Booking System
├─ Driver Dashboard
├─ Real-time Socket.io Setup
├─ Booking Status Management
├─ Rating System
├─ Payment Models
├─ JWT Authentication Middleware
├─ Database Models & Relationships
└─ Responsive UI

⚙️ READY TO IMPLEMENT:
├─ Google Maps Integration
├─ Stripe Payment Processing
├─ Email Notifications (Nodemailer)
├─ SMS Notifications (Twilio)
├─ Push Notifications (Firebase)
├─ Admin Dashboard
├─ Analytics & Reports
├─ Driver Document Verification
├─ Ride Scheduling
└─ Referral System

📱 FUTURE ENHANCEMENTS:
├─ React Native Mobile App
├─ Progressive Web App (PWA)
├─ Multi-language Support
├─ Accessibility Features
├─ Dark Mode
├─ Advanced Search Filters
├─ Ride Sharing (UberPool)
├─ Subscription Plans
├─ Corporate Accounts
└─ AI-Based Price Optimization
```

---

This architecture supports scalability and can be easily extended with additional features.
