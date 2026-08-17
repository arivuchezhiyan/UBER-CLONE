# 🚖 Uber-Clone — Enterprise Full-Stack Ride-Booking Platform

A production-grade, highly scalable, enterprise ride-booking platform with a full-featured **Node.js/Express** backend, **MongoDB** database with double-entry ledgers, **React 18** client, **Socket.io** real-time GPS streaming, a **16-state ride machine**, centralized **pricing engine**, **3-layer race condition defense**, and an administrative control suite.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React 18 Web Client                     │
│  (Customer Booking, Driver Dashboard, Active Map Tracking)  │
└──────────────┬──────────────────────────────┬───────────────┘
               │ HTTP REST API                │ WebSocket (Socket.io)
               ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Node.js / Express Backend                   │
│  - 16-State Ride State Machine & Validation Engine          │
│  - 3-Layer Race Condition Lock & Version Control            │
│  - Centralized FareCalculator (Base + Km + Min + GST 5%)    │
│  - Sequential 30s Driver Dispatcher & Distance Ranking      │
│  - Scheduled Ride Background Matching Worker                │
│  - Double-Entry Driver Ledger Wallet & Payout Processor     │
│  - Driver Heartbeat & Auto-Offline Background Monitor       │
│  - Admin Control Suite & Audit Log Trail                    │
└──────────────┬──────────────────────────────┬───────────────┘
               │ Mongoose ODM                 │ In-Memory / Standalone
               ▼                              ▼
┌─────────────────────────────┐┌──────────────────────────────┐
│     MongoDB Database        ││     Redis 7 Cache (Optional) │
│ (10 Schemas, Unique Indexes)││ (Location & Pub/Sub Support) │
└─────────────────────────────┘└──────────────────────────────┘
```

---

## 🚀 Key Features Implemented

### 1. 🛡️ 16-State Ride State Machine
- Strict validation rules preventing invalid state skips:
  `REQUESTED` → `SEARCHING_DRIVER` → `DRIVER_ASSIGNED` → `DRIVER_ARRIVING` → `DRIVER_ARRIVED` → `TRIP_STARTED` → `TRIP_COMPLETED` → `SETTLED` (with proper `CANCELLED_BY_RIDER`, `CANCELLED_BY_DRIVER`, `EXPIRED`, `REFUNDED` branches).
- Immutable audit history log (`statusHistory`) recording timestamps, reasons, and actors.

### 2. ⚡ 3-Layer Race Condition Lock Defense
- **Layer 1**: Atomic `findOneAndUpdate` conditional status query (`status: 'SEARCHING_DRIVER'`, `driverId: null`).
- **Layer 2**: Unique partial indexes on `_id` + `driverId` and unique `idempotencyKey`.
- **Layer 3**: Version-based optimistic locking on `Booking` and `DriverWallet` models.

### 3. 💰 Centralized Fare Pricing Engine (`FareCalculator`)
- Calculates Base Fare, Per-Km Rate, Per-Minute Rate, Minimum Fare enforcement.
- Extra waiting charges (`waitingChargePerMin` after free threshold).
- Toll & parking pass-throughs.
- Dynamic Surge Modifiers (`FareModifier` models) for rain, night, and holiday multipliers.
- 5% GST tax and 20% platform commission split with 18% GST audit trail.

### 4. 📒 Double-Entry Driver Ledger Wallet (`WalletService`)
- Complete audit trail (`WalletTransaction` collection) with `CREDIT` and `DEBIT` tracking.
- Automated earnings credit for online payments and platform commission deduction for cash rides.
- Bank payout requests with balance verification and unique idempotency keys.

### 5. 🎯 Sequential 30-Second Driver Dispatcher
- Real-time Haversine distance calculation and composite driver ranking.
- Dispatches targeted ride requests with a 30-second countdown timer.
- Fallback loop automatically advances to the next best-ranked candidate driver if declined or timed out.

### 6. ⏰ Scheduled Rides Background Worker
- Automated cron worker scanning upcoming scheduled bookings 30-45 minutes before pickup.
- Transitions confirmed bookings to active matching without manual intervention.

### 7. 💓 Driver Heartbeat & Auto-Offline Monitor
- Periodic GPS heartbeat recording driver location and battery status.
- Background worker auto-marks inactive drivers (>5 min no ping) as offline.

### 8. 🛡️ Admin Management & Compliance
- Admin endpoints for live dashboard statistics, driver approvals (`PENDING` → `APPROVED` / `REJECTED` / `SUSPENDED`), document verification, emergency cancellations, pricing configuration, and audit logging.

---

## 📁 Repository Structure

```
.
├── client/                     # React 18 Web Application
│   ├── src/
│   │   ├── components/         # Map (Leaflet), Location Search, Payment Selector
│   │   ├── pages/              # BookRide, ActiveRide, DriverHome, History, Profile
│   │   └── services/           # Axios API Client
│   ├── Dockerfile
│   └── package.json
│
├── server/                     # Express.js / Node.js Backend Server
│   ├── controllers/            # bookingController, authController, adminController, etc.
│   ├── middleware/             # authMiddleware, adminMiddleware
│   ├── models/                 # Booking, User, Vehicle, FareRule, DriverWallet, etc.
│   ├── routes/                 # bookingRoutes, authRoutes, adminRoutes, paymentRoutes, etc.
│   ├── services/               # FareCalculator, WalletService, MatchingService, etc.
│   ├── test-enterprise-features.js
│   ├── test-phase2-matching-notifications.js
│   ├── test-phase3-admin-security.js
│   ├── test-ride-flow.js
│   ├── Dockerfile
│   └── server.js
│
├── docs/                       # Architecture Specifications & Runbooks
│   ├── architecture/           # Master plans, DB schema, API design, race condition specs
│   ├── guides/                 # Setup, deployment, troubleshooting
│   ├── legal/                  # Privacy policy, Terms of service, Driver contract
│   ├── runbooks/               # Incident response, DB restore, payment reconciliation
│   └── reference/              # OpenAPI spec, enum constants, SQL migrations
│
├── docker-compose.yml          # Multi-container Docker deployment
└── README.md
```

---

## ⚡ Quick Start

### Prerequisites
- **Node.js** (v18 or higher)
- **MongoDB** (running locally or MongoDB Atlas connection string)
- **Git**

### 1. Start the Backend Server
```bash
cd server
npm install
node server.js
```
*The server will auto-seed default vehicle types, enterprise fare rules, and cancellation policies on port `5000`.*

### 2. Start the Frontend Client
```bash
cd client
npm install
npm start
```
*Access the React Web App at `http://localhost:3000`.*

---

## 🧪 Automated Test Verification

Run all test suites inside the `server/` directory:

```bash
# 1. Test Enterprise Features (FareCalculator, Ledger, 16-State Machine)
node test-enterprise-features.js

# 2. Test Matching & Dispatch (30s Timer, Distance Ranking, Heartbeat)
node test-phase2-matching-notifications.js

# 3. Test Admin Panel & Security (Approvals, Documents, Audit Logs)
node test-phase3-admin-security.js

# 4. Test Complete End-to-End Live Ride Flow with Race Conditions
node test-ride-flow.js
```

---

## 🐳 Docker Deployment

Run the complete multi-container stack with a single command:

```bash
docker-compose up -d --build
```

---

© 2026 Uber-Clone Platform. All Rights Reserved.
