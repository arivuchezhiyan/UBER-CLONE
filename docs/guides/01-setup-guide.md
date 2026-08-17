# 🛠️ RideNow — Developer Setup Guide

This guide provides step-by-step instructions for setting up the **RideNow** ride-booking platform on your local machine for development and testing.

---

## Prerequisites

Before starting, ensure you have the following installed:

| Tool | Version Requirement | Purpose |
|------|--------------------|---------|
| **Java JDK** | OpenJDK 21 LTS | Backend development |
| **Node.js** | v18.x or v20.x LTS | Admin panel (Next.js) |
| **Flutter SDK** | 3.19.x or higher | Rider & Driver mobile apps |
| **Docker Desktop** | Latest | Database (PostgreSQL+PostGIS), Redis, Mailpit |
| **Git** | Latest | Version control |
| **Android Studio / Xcode** | Latest | Emulators & mobile builds |

---

## 1. Quick Start with Docker Compose

The fastest way to get the infrastructure up and running is using Docker Compose.

```bash
# Clone repository
git clone https://github.com/your-org/ridenow.com.git
cd ridenow

# Start PostgreSQL, Redis, and Mailpit
docker-compose -f infrastructure/docker/docker-compose.yml up -d
```

### Verified Services:
- **PostgreSQL 16 + PostGIS**: `localhost:5432` (DB: `ridenow`, User: `ridenow_user`, Password: `ridenow_password`)
- **Redis 7**: `localhost:6379`
- **Mailpit (Local Email Testing)**: Web UI `localhost:8025`, SMTP `localhost:1025`

---

## 2. Backend Setup (Spring Boot)

### Environment Variables
Copy `.env.example` to `.env` or configure IDE environment variables:

```properties
SPRING_PROFILES_ACTIVE=dev
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ridenow
DB_USER=ridenow_user
DB_PASSWORD=ridenow_password
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=super-secret-jwt-key-minimum-256-bits-long-for-hmac-sha256
RAZORPAY_KEY_ID=rzp_test_mock_key
RAZORPAY_KEY_SECRET=mock_secret
FCM_SERVICE_ACCOUNT_PATH=classpath:firebase-service-account.json
GOOGLE_MAPS_API_KEY=AIzaSyMockKeyForDev
```

### Build & Run Backend:
```bash
cd backend
./mvnw clean install
./mvnw spring-boot:run
```
Backend will be live at: `http://localhost:8080`  
Swagger API Docs: `http://localhost:8080/swagger-ui.html`

---

## 3. Admin Panel Setup (Next.js 14)

```bash
cd admin-panel
npm install
npm run dev
```
Admin Dashboard will be live at: `http://localhost:3000`  
Default Admin Credentials (seeded by Flyway):
- **Email**: `admin@ridenow.com`
- **Password**: `Admin@12345`

---

## 4. Rider Mobile App Setup (Flutter)

```bash
cd rider-app
flutter pub get
flutter run
```
*Note: Make sure an Android Emulator or iOS Simulator is running.*

---

## 5. Driver Mobile App Setup (Flutter)

```bash
cd driver-app
flutter pub get
flutter run
```

---

## 6. Seed Data & Test Flows

Run the test script to create mock drivers, vehicles, and users:

```bash
# In bash/zsh
./infrastructure/scripts/seed-test-data.sh

# In PowerShell
.\infrastructure\scripts\seed-test-data.ps1
```

This creates:
- 5 Approved online drivers (Sedan & Auto)
- 1 Test Rider (Phone: `+919876543210`, OTP for dev is always `123456`)
- 1 Test Driver (Phone: `+919876543211`, OTP `123456`)
