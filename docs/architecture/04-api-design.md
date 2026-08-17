# 🔌 RideNow — Complete API Design

> **Base URL**: `https://api.ridenow.com/api/v1`  
> **Authentication**: JWT Bearer Token (except auth endpoints)  
> **Content-Type**: `application/json`  
> **Idempotency**: `X-Idempotency-Key` header required on all POST/PUT

---

## Standard Response Format

```json
// Success
{ "success": true, "data": { ... }, "timestamp": "2026-08-08T12:30:00Z" }

// Error  
{ "success": false, "error": { "code": "ERROR_CODE", "message": "...", "details": null }, "timestamp": "..." }

// Paginated
{ "success": true, "data": { "content": [...], "page": 0, "size": 20, "totalElements": 156, "totalPages": 8 }, "timestamp": "..." }
```

---

## 1. AUTHENTICATION MODULE

### 1.1 Register

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/auth/register` |
| **Auth** | None |
| **Role** | Any |

**Request:**
```json
{
  "phone": "+919876543210",
  "fullName": "Arivuchelvan",
  "role": "RIDER",            // RIDER or DRIVER
  "email": "ariv@example.com" // optional
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "phone": "+919876543210",
    "otpSent": true,
    "otpExpiresIn": 300
  }
}
```

**Errors:**
| Code | Status | Description |
|------|--------|-------------|
| `PHONE_ALREADY_EXISTS` | 409 | Phone number already registered |
| `INVALID_PHONE_FORMAT` | 400 | Phone not in E.164 format |
| `RATE_LIMITED` | 429 | Too many registration attempts |

---

### 1.2 Login (Request OTP)

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/auth/login` |
| **Auth** | None |
| **Role** | Any |

**Request:**
```json
{
  "phone": "+919876543210",
  "role": "RIDER"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "otpSent": true,
    "otpExpiresIn": 300,
    "maskedPhone": "+91****3210"
  }
}
```

**Errors:**
| Code | Status |
|------|--------|
| `USER_NOT_FOUND` | 404 |
| `ACCOUNT_BLOCKED` | 403 |
| `OTP_COOLDOWN` | 429 |

---

### 1.3 Verify OTP

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/auth/verify-otp` |
| **Auth** | None |
| **Role** | Any |

**Request:**
```json
{
  "phone": "+919876543210",
  "otp": "123456",
  "role": "RIDER",
  "deviceId": "device-fingerprint-hash"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1...",
    "refreshToken": "dGhpcyBpcyBhIH...",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "user": {
      "id": "uuid",
      "fullName": "Arivuchelvan",
      "phone": "+919876543210",
      "role": "RIDER",
      "profilePhotoUrl": null
    }
  }
}
```

**Errors:**
| Code | Status |
|------|--------|
| `INVALID_OTP` | 401 |
| `OTP_EXPIRED` | 401 |
| `MAX_OTP_ATTEMPTS` | 429 |

---

### 1.4 Refresh Token

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/auth/refresh-token` |
| **Auth** | None (refresh token in body) |
| **Role** | Any |

**Request:**
```json
{
  "refreshToken": "dGhpcyBpcyBhIH..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "new-access-token",
    "refreshToken": "new-refresh-token",
    "expiresIn": 900
  }
}
```

---

### 1.5 Logout

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/auth/logout` |
| **Auth** | Bearer Token |
| **Role** | Any |

**Response (200):**
```json
{ "success": true, "data": { "message": "Logged out successfully" } }
```

---

## 2. USER (RIDER) MODULE

### 2.1 Get Profile

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/users/profile` |
| **Auth** | Bearer Token |
| **Role** | RIDER |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "fullName": "Arivuchelvan",
    "phone": "+919876543210",
    "email": "ariv@example.com",
    "profilePhotoUrl": "https://s3.../photo.jpg",
    "averageRating": 4.85,
    "totalRides": 42,
    "phoneVerified": true,
    "emailVerified": false,
    "createdAt": "2026-01-15T10:30:00Z"
  }
}
```

### 2.2 Update Profile

| | |
|---|---|
| **Method** | `PUT` |
| **URL** | `/users/profile` |
| **Auth** | Bearer Token |
| **Role** | RIDER |

**Request:**
```json
{
  "fullName": "Arivuchelvan K",
  "email": "ariv.k@example.com"
}
```

### 2.3 Upload Profile Photo

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/users/profile/photo` |
| **Auth** | Bearer Token |
| **Role** | RIDER |
| **Content-Type** | `multipart/form-data` |

**Request:** Form data with `photo` file field (max 5 MB, JPG/PNG)

### 2.4 Saved Addresses (CRUD)

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/users/saved-addresses` | List all saved addresses |
| `POST` | `/users/saved-addresses` | Add new address |
| `PUT` | `/users/saved-addresses/{id}` | Update address |
| `DELETE` | `/users/saved-addresses/{id}` | Delete address |

**POST Request:**
```json
{
  "label": "Home",
  "address": "123 Anna Salai, T. Nagar, Chennai",
  "latitude": 13.0418,
  "longitude": 80.2341
}
```

### 2.5 Update FCM Token

| | |
|---|---|
| **Method** | `PUT` |
| **URL** | `/users/fcm-token` |
| **Auth** | Bearer Token |
| **Role** | RIDER, DRIVER |

**Request:**
```json
{
  "fcmToken": "fMkJ9x..."
}
```

---

## 3. DRIVER MODULE

### 3.1 Driver Registration (Additional Details)

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/drivers/details` |
| **Auth** | Bearer Token |
| **Role** | DRIVER |

**Request:**
```json
{
  "dateOfBirth": "1995-03-15",
  "gender": "MALE",
  "address": "45, Lake Area, Chennai"
}
```

### 3.2 Upload Document

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/drivers/documents` |
| **Auth** | Bearer Token |
| **Role** | DRIVER |
| **Content-Type** | `multipart/form-data` |

**Form fields:**
- `documentType`: DRIVING_LICENCE, AADHAAR, PAN, VEHICLE_RC, INSURANCE, PERMIT, POLLUTION, PHOTO
- `documentNumber`: (optional, depends on type)
- `expiryDate`: (optional, yyyy-MM-dd)
- `file`: The document file (max 10 MB, JPG/PNG/PDF)

**Response (201):**
```json
{
  "success": true,
  "data": {
    "documentId": "uuid",
    "documentType": "DRIVING_LICENCE",
    "verificationStatus": "PENDING",
    "uploadedAt": "2026-08-08T10:30:00Z"
  }
}
```

### 3.3 Register Vehicle

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/drivers/vehicle` |
| **Auth** | Bearer Token |
| **Role** | DRIVER |

**Request:**
```json
{
  "vehicleCategoryId": "uuid",
  "make": "Maruti",
  "model": "Dzire",
  "year": 2022,
  "color": "White",
  "registrationNumber": "TN-07-AB-1234",
  "seatingCapacity": 4,
  "fuelType": "PETROL"
}
```

### 3.4 Go Online

| | |
|---|---|
| **Method** | `PUT` |
| **URL** | `/drivers/status/online` |
| **Auth** | Bearer Token |
| **Role** | DRIVER |

**Request:**
```json
{
  "latitude": 13.0827,
  "longitude": 80.2707
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "isOnline": true,
    "wentOnlineAt": "2026-08-08T10:30:00Z"
  }
}
```

**Errors:**
| Code | Status | Description |
|------|--------|-------------|
| `DRIVER_NOT_APPROVED` | 403 | Driver not yet approved by admin |
| `DRIVER_SUSPENDED` | 403 | Driver is suspended |
| `DRIVER_ON_COOLDOWN` | 403 | Driver in penalty cooldown |
| `DOCUMENTS_EXPIRED` | 403 | One or more documents expired |

### 3.5 Go Offline

| | |
|---|---|
| **Method** | `PUT` |
| **URL** | `/drivers/status/offline` |
| **Auth** | Bearer Token |
| **Role** | DRIVER |

### 3.6 Heartbeat

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/drivers/heartbeat` |
| **Auth** | Bearer Token |
| **Role** | DRIVER |

**Request:**
```json
{
  "latitude": 13.0830,
  "longitude": 80.2710,
  "batteryLevel": 78,
  "appVersion": "1.2.0"
}
```

### 3.7 Get Driver Profile (Self)

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/drivers/profile` |
| **Auth** | Bearer Token |
| **Role** | DRIVER |

### 3.8 Get Driver Documents

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/drivers/documents` |
| **Auth** | Bearer Token |
| **Role** | DRIVER |

---

## 4. RIDE MODULE

### 4.1 Create Ride

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/rides` |
| **Auth** | Bearer Token |
| **Role** | RIDER |
| **Idempotency** | Required |

**Request:**
```json
{
  "pickupLat": 13.0418,
  "pickupLng": 80.2341,
  "pickupAddress": "T. Nagar, Chennai",
  "dropLat": 13.0067,
  "dropLng": 80.2206,
  "dropAddress": "Adyar, Chennai",
  "vehicleCategoryId": "uuid",
  "rideType": "IMMEDIATE",
  "paymentMethod": "ONLINE",
  "scheduledAt": null,
  "extraAmount": 0
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "rideId": "uuid",
    "rideNumber": "RN-20260808-0042",
    "status": "SEARCHING_DRIVER",
    "estimatedFare": 200.55,
    "estimatedDistance": 8.5,
    "estimatedDuration": 25,
    "fareBreakdown": {
      "baseFare": 50.00,
      "distanceFare": 91.00,
      "timeFare": 50.00,
      "subtotal": 191.00,
      "tax": 9.55,
      "total": 200.55
    },
    "rideOtp": "4827",
    "createdAt": "2026-08-08T10:30:00Z"
  }
}
```

**Errors:**
| Code | Status | Description |
|------|--------|-------------|
| `ACTIVE_RIDE_EXISTS` | 409 | User already has an active ride |
| `PICKUP_OUTSIDE_SERVICE_AREA` | 400 | Location not serviceable |
| `INVALID_SCHEDULED_TIME` | 400 | Scheduled time must be > 30 min from now |
| `DUPLICATE_REQUEST` | 200 | Idempotency key already used (returns existing ride) |

### 4.2 Get Ride Details

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/rides/{rideId}` |
| **Auth** | Bearer Token |
| **Role** | RIDER (own rides), DRIVER (assigned rides) |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "rideId": "uuid",
    "rideNumber": "RN-20260808-0042",
    "status": "DRIVER_ARRIVING",
    "rideType": "IMMEDIATE",
    "distanceType": "SHORT",
    "pickup": {
      "lat": 13.0418, "lng": 80.2341, "address": "T. Nagar, Chennai"
    },
    "drop": {
      "lat": 13.0067, "lng": 80.2206, "address": "Adyar, Chennai"
    },
    "estimatedFare": 200.55,
    "estimatedDistance": 8.5,
    "estimatedDuration": 25,
    "driver": {
      "id": "uuid",
      "name": "Karthik R",
      "phone": "+91****5678",
      "photoUrl": "https://...",
      "rating": 4.8,
      "vehicle": {
        "make": "Maruti",
        "model": "Dzire",
        "color": "White",
        "registrationNumber": "TN-07-AB-1234"
      }
    },
    "rideOtp": "4827",
    "createdAt": "2026-08-08T10:30:00Z",
    "driverAssignedAt": "2026-08-08T10:30:45Z"
  }
}
```

### 4.3 Cancel Ride

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/rides/{rideId}/cancel` |
| **Auth** | Bearer Token |
| **Role** | RIDER, DRIVER |

**Request:**
```json
{
  "reason": "Changed my plans",
  "reasonCode": "CHANGED_PLANS"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "rideId": "uuid",
    "status": "CANCELLED_BY_RIDER",
    "cancellationFee": 25.00,
    "refundAmount": 175.55,
    "message": "Ride cancelled. Cancellation fee: ₹25.00"
  }
}
```

### 4.4 Add Extra Amount (Fare Boost)

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/rides/{rideId}/extra-amount` |
| **Auth** | Bearer Token |
| **Role** | RIDER |

**Request:**
```json
{
  "extraAmount": 50.00
}
```

### 4.5 Get Ride History

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/rides/history?page=0&size=20&status=COMPLETED` |
| **Auth** | Bearer Token |
| **Role** | RIDER, DRIVER |

### 4.6 Get Upcoming Rides

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/rides/upcoming` |
| **Auth** | Bearer Token |
| **Role** | RIDER |

### 4.7 Get Active Ride

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/rides/active` |
| **Auth** | Bearer Token |
| **Role** | RIDER, DRIVER |

---

## 5. MATCHING MODULE (Driver-Side)

### 5.1 Accept Ride

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/rides/{rideId}/accept` |
| **Auth** | Bearer Token |
| **Role** | DRIVER |
| **Idempotency** | Required |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "rideId": "uuid",
    "status": "DRIVER_ASSIGNED",
    "rider": {
      "name": "Arivuchelvan",
      "phone": "+91****3210",
      "rating": 4.85
    },
    "pickup": { "lat": 13.0418, "lng": 80.2341, "address": "T. Nagar" },
    "drop": { "lat": 13.0067, "lng": 80.2206, "address": "Adyar" },
    "estimatedEarnings": 160.44,
    "estimatedDistance": 8.5
  }
}
```

**Errors:**
| Code | Status | Description |
|------|--------|-------------|
| `RIDE_ALREADY_ASSIGNED` | 409 | Another driver already accepted |
| `REQUEST_EXPIRED` | 410 | Acceptance window closed |
| `DRIVER_UNAVAILABLE` | 403 | Driver is already on another ride |

### 5.2 Reject Ride

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/rides/{rideId}/reject` |
| **Auth** | Bearer Token |
| **Role** | DRIVER |

**Request:**
```json
{
  "reason": "Too far"
}
```

---

## 6. TRIP FLOW (Driver-Side)

### 6.1 Mark Arrived

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/rides/{rideId}/arrived` |
| **Auth** | Bearer Token |
| **Role** | DRIVER |

**Request:**
```json
{
  "latitude": 13.0420,
  "longitude": 80.2343
}
```

### 6.2 Verify OTP & Start Trip

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/rides/{rideId}/start` |
| **Auth** | Bearer Token |
| **Role** | DRIVER |

**Request:**
```json
{
  "otp": "4827"
}
```

**Errors:**
| Code | Status |
|------|--------|
| `INVALID_OTP` | 400 |
| `OTP_NOT_VERIFIED` | 400 |

### 6.3 Complete Trip

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/rides/{rideId}/complete` |
| **Auth** | Bearer Token |
| **Role** | DRIVER |

**Request:**
```json
{
  "latitude": 13.0069,
  "longitude": 80.2208,
  "tollAmount": 0,
  "parkingAmount": 0,
  "waitingTimeMinutes": 2
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "rideId": "uuid",
    "status": "PAYMENT_PENDING",
    "actualDistance": 8.7,
    "actualDuration": 28,
    "finalFare": 205.00,
    "fareBreakdown": { ... },
    "driverEarnings": 164.00,
    "platformCommission": 41.00
  }
}
```

---

## 7. TRACKING (WebSocket STOMP)

### Connection

| | |
|---|---|
| **URL** | `wss://api.ridenow.com/ws` |
| **Protocol** | STOMP over WebSocket |
| **Auth** | JWT token as query param or STOMP header |

### 7.1 Driver Sends Location

**Destination:** `/app/driver/location`

```json
{
  "latitude": 13.0830,
  "longitude": 80.2710,
  "heading": 45.5,
  "speed": 30.2,
  "timestamp": "2026-08-08T10:35:00Z"
}
```

### 7.2 Rider Subscribes to Ride Updates

**Subscribe to:** `/topic/ride/{rideId}`

**Receives:**
```json
{
  "type": "LOCATION_UPDATE",
  "data": {
    "latitude": 13.0830,
    "longitude": 80.2710,
    "heading": 45.5,
    "speed": 30.2,
    "eta": 3
  }
}
```

```json
{
  "type": "STATUS_UPDATE",
  "data": {
    "status": "DRIVER_ARRIVED",
    "timestamp": "2026-08-08T10:42:00Z"
  }
}
```

### 7.3 Driver Subscribes to Ride Requests

**Subscribe to:** `/user/queue/ride-requests`

**Receives:**
```json
{
  "type": "NEW_RIDE_REQUEST",
  "data": {
    "rideId": "uuid",
    "pickup": { "lat": 13.0418, "lng": 80.2341, "address": "T. Nagar" },
    "drop": { "lat": 13.0067, "lng": 80.2206, "address": "Adyar" },
    "estimatedDistance": 8.5,
    "estimatedDuration": 25,
    "estimatedEarnings": 160.44,
    "rideType": "IMMEDIATE",
    "vehicleCategory": "Sedan",
    "expiresAt": "2026-08-08T10:31:00Z"
  }
}
```

---

## 8. PRICING MODULE

### 8.1 Get Fare Estimate

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/pricing/estimate` |
| **Auth** | Bearer Token |
| **Role** | RIDER |

**Request:**
```json
{
  "pickupLat": 13.0418,
  "pickupLng": 80.2341,
  "dropLat": 13.0067,
  "dropLng": 80.2206,
  "rideType": "IMMEDIATE"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "estimates": [
      {
        "vehicleCategoryId": "uuid",
        "categoryName": "Auto",
        "estimatedFare": 135.00,
        "estimatedDistance": 8.5,
        "estimatedDuration": 30,
        "fareBreakdown": { ... }
      },
      {
        "vehicleCategoryId": "uuid",
        "categoryName": "Sedan",
        "estimatedFare": 200.55,
        "estimatedDistance": 8.5,
        "estimatedDuration": 25,
        "fareBreakdown": { ... }
      },
      {
        "vehicleCategoryId": "uuid",
        "categoryName": "SUV",
        "estimatedFare": 280.00,
        "estimatedDistance": 8.5,
        "estimatedDuration": 25,
        "fareBreakdown": { ... }
      }
    ],
    "distanceType": "SHORT",
    "estimateExpiresAt": "2026-08-08T10:40:00Z"
  }
}
```

### 8.2 Get Vehicle Categories

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/pricing/vehicle-categories` |
| **Auth** | Bearer Token |
| **Role** | RIDER, DRIVER |

---

## 9. PAYMENT MODULE

### 9.1 Create Payment Order

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/payments/create-order` |
| **Auth** | Bearer Token |
| **Role** | RIDER |
| **Idempotency** | Required |

**Request:**
```json
{
  "rideId": "uuid"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "orderId": "order_XXXXX",
    "amount": 20055,
    "currency": "INR",
    "razorpayKeyId": "rzp_live_XXXX",
    "prefill": {
      "name": "Arivuchelvan",
      "email": "ariv@example.com",
      "contact": "+919876543210"
    }
  }
}
```

### 9.2 Verify Payment (Client-Side Callback)

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/payments/verify` |
| **Auth** | Bearer Token |
| **Role** | RIDER |

**Request:**
```json
{
  "rideId": "uuid",
  "razorpayPaymentId": "pay_XXXXX",
  "razorpayOrderId": "order_XXXXX",
  "razorpaySignature": "signature_hash"
}
```

> **Note:** This is a secondary verification. The primary confirmation comes from the Razorpay webhook. This endpoint provides immediate UI feedback.

### 9.3 Confirm Cash Payment

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/payments/{rideId}/cash-collected` |
| **Auth** | Bearer Token |
| **Role** | DRIVER |

### 9.4 Razorpay Webhook (Server-to-Server)

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/webhooks/razorpay` |
| **Auth** | Signature verification |
| **Role** | N/A (server-to-server) |

---

## 10. WALLET MODULE

### 10.1 Get Wallet

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/wallet` |
| **Auth** | Bearer Token |
| **Role** | DRIVER |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "balance": 5800.00,
    "pendingAmount": 164.00,
    "totalEarned": 125000.00,
    "totalPaidOut": 119200.00,
    "totalCommissionPaid": 31250.00
  }
}
```

### 10.2 Get Wallet Transactions

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/wallet/transactions?page=0&size=20&type=RIDE_EARNING&from=2026-08-01&to=2026-08-08` |
| **Auth** | Bearer Token |
| **Role** | DRIVER |

### 10.3 Request Payout

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/wallet/payout` |
| **Auth** | Bearer Token |
| **Role** | DRIVER |
| **Idempotency** | Required |

**Request:**
```json
{
  "amount": 5000.00
}
```

**Errors:**
| Code | Status |
|------|--------|
| `INSUFFICIENT_BALANCE` | 400 |
| `BELOW_MINIMUM_PAYOUT` | 400 |
| `PENDING_PAYOUT_EXISTS` | 409 |
| `BANK_DETAILS_MISSING` | 400 |

---

## 11. RATING MODULE

### 11.1 Submit Rating

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/ratings` |
| **Auth** | Bearer Token |
| **Role** | RIDER, DRIVER |

**Request:**
```json
{
  "rideId": "uuid",
  "rating": 5,
  "review": "Great driver, very polite!"
}
```

**Errors:**
| Code | Status |
|------|--------|
| `RIDE_NOT_COMPLETED` | 400 |
| `ALREADY_RATED` | 409 |
| `NOT_PARTICIPANT` | 403 |

### 11.2 Get My Ratings

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/ratings?page=0&size=20` |
| **Auth** | Bearer Token |
| **Role** | DRIVER |

---

## 12. NOTIFICATION MODULE

### 12.1 Get Notifications

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/notifications?page=0&size=20&unreadOnly=true` |
| **Auth** | Bearer Token |
| **Role** | RIDER, DRIVER |

### 12.2 Mark as Read

| | |
|---|---|
| **Method** | `PUT` |
| **URL** | `/notifications/{id}/read` |
| **Auth** | Bearer Token |
| **Role** | RIDER, DRIVER |

---

## 13. SUPPORT MODULE

### 13.1 Create Ticket

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/support/tickets` |
| **Auth** | Bearer Token |
| **Role** | RIDER, DRIVER |

**Request:**
```json
{
  "rideId": "uuid",
  "category": "PAYMENT",
  "subject": "Payment deducted but ride cancelled",
  "description": "My payment of ₹200 was deducted but the ride was cancelled by the driver..."
}
```

### 13.2 Get My Tickets

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/support/tickets?page=0&size=20` |
| **Auth** | Bearer Token |
| **Role** | RIDER, DRIVER |

### 13.3 Get Ticket Detail

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/support/tickets/{id}` |
| **Auth** | Bearer Token |
| **Role** | RIDER, DRIVER |

---

## 14. ADMIN MODULE

### User Management

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/admin/users?page=0&size=20&search=ariv` | List/search users |
| `GET` | `/admin/users/{id}` | User detail |
| `PUT` | `/admin/users/{id}/block` | Block user |
| `PUT` | `/admin/users/{id}/unblock` | Unblock user |
| `GET` | `/admin/users/{id}/rides` | User's ride history |
| `GET` | `/admin/users/{id}/payments` | User's payments |

### Driver Management

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/admin/drivers?page=0&size=20&status=PENDING` | List/search drivers |
| `GET` | `/admin/drivers/{id}` | Driver detail |
| `PUT` | `/admin/drivers/{id}/approve` | Approve driver |
| `PUT` | `/admin/drivers/{id}/reject` | Reject driver (with reason) |
| `PUT` | `/admin/drivers/{id}/suspend` | Suspend driver |
| `PUT` | `/admin/drivers/{id}/activate` | Reactivate driver |
| `GET` | `/admin/drivers/{id}/documents` | View documents |
| `PUT` | `/admin/drivers/{id}/documents/{docId}/verify` | Approve/reject document |
| `GET` | `/admin/drivers/{id}/rides` | Driver's ride history |
| `GET` | `/admin/drivers/{id}/earnings` | Driver's earnings summary |
| `GET` | `/admin/drivers/online` | Currently online drivers |

### Ride Management

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/admin/rides?page=0&size=20&status=TRIP_STARTED` | List/filter rides |
| `GET` | `/admin/rides/active` | All active rides |
| `GET` | `/admin/rides/scheduled` | Scheduled rides |
| `GET` | `/admin/rides/{id}` | Full ride detail |
| `GET` | `/admin/rides/{id}/financial` | Financial breakdown |
| `GET` | `/admin/rides/{id}/locations` | GPS breadcrumbs |
| `GET` | `/admin/rides/{id}/status-history` | Status timeline |

### Financial Management

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/admin/finance/overview` | Revenue dashboard data |
| `GET` | `/admin/finance/commissions?from=&to=` | Commission report |
| `GET` | `/admin/finance/payments?page=0&size=20` | All payments |
| `GET` | `/admin/finance/payouts?page=0&size=20` | Driver payouts |
| `POST` | `/admin/finance/refund` | Process refund |

### Pricing Configuration

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/admin/pricing/fare-rules` | All fare rules |
| `POST` | `/admin/pricing/fare-rules` | Create fare rule |
| `PUT` | `/admin/pricing/fare-rules/{id}` | Update fare rule |
| `GET` | `/admin/pricing/cancellation-rules` | Cancellation rules |
| `POST` | `/admin/pricing/cancellation-rules` | Create cancellation rule |
| `PUT` | `/admin/pricing/cancellation-rules/{id}` | Update cancellation rule |
| `GET` | `/admin/pricing/vehicle-categories` | Vehicle categories |
| `POST` | `/admin/pricing/vehicle-categories` | Create category |
| `PUT` | `/admin/pricing/vehicle-categories/{id}` | Update category |

### Support Tickets

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/admin/support/tickets?page=0&size=20&status=OPEN` | All tickets |
| `GET` | `/admin/support/tickets/{id}` | Ticket detail |
| `PUT` | `/admin/support/tickets/{id}` | Update ticket (assign, resolve) |

### Analytics

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/admin/analytics/dashboard` | Dashboard metrics |
| `GET` | `/admin/analytics/rides?period=daily&from=&to=` | Ride analytics |
| `GET` | `/admin/analytics/revenue?period=monthly&from=&to=` | Revenue analytics |

### Audit Logs

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/admin/audit-logs?page=0&size=50&action=DRIVER_APPROVED` | Audit logs |

### Settings

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/admin/settings` | Platform settings |
| `PUT` | `/admin/settings` | Update settings |

---

## Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Missing or invalid auth token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Duplicate or conflicting operation |
| `GONE` | 410 | Resource no longer available (expired) |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | External service down |

---

## Rate Limits

| Endpoint Group | Limit |
|---------------|-------|
| Auth (login, OTP) | 5 req/min per IP |
| Ride creation | 5 req/min per user |
| Driver location | 12 req/min per driver |
| General API | 60 req/min per user |
| Admin API | 120 req/min per admin |
| Webhooks | No limit (server-to-server) |
