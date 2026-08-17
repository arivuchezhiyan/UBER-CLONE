# 🚀 RideNow — Production Deployment Guide

This document outlines the step-by-step procedure for deploying the **RideNow** platform to production cloud infrastructure (AWS/DigitalOcean/GCP).

---

## 1. Production Architecture Overview

```
                      ┌─────────────────────────┐
                      │    Cloudflare DNS       │
                      │  WAF + SSL + DDoS Prot. │
                      └────────────┬────────────┘
                                   │
                      ┌────────────▼────────────┐
                      │ Application Load Balancer│
                      │   (AWS ALB / Nginx)     │
                      └────────────┬────────────┘
                                   │
             ┌─────────────────────┴─────────────────────┐
             │                                           │
┌────────────▼────────────┐                 ┌────────────▼────────────┐
│ Backend Instance 1      │                 │ Backend Instance 2      │
│ (Spring Boot App)       │                 │ (Spring Boot App)       │
└────────────┬────────────┘                 └────────────┬────────────┘
             │                                           │
             └─────────────────────┬─────────────────────┘
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       │                           │                           │
┌──────▼──────────────┐   ┌────────▼─────────────┐   ┌─────────▼───────────┐
│ Managed PostgreSQL  │   │ Managed Redis        │   │ AWS S3 / R2         │
│ (RDS + PostGIS)     │   │ (ElastiCache / Cluster)│   │ (Document Storage)  │
└─────────────────────┘   └──────────────────────┘   └─────────────────────┘
```

---

## 2. Infrastructure Provisions

### PostgreSQL Database (AWS RDS / DigitalOcean Managed DB)
- **Engine**: PostgreSQL 16
- **Extension**: `postgis` enabled
- **RAM**: Minimum 8 GB (Production)
- **Storage**: 100 GB Auto-scaling SSD
- **Multi-AZ**: Enabled for automatic failover
- **Backup**: Daily automated snapshots, 30-day retention, WAL archiving enabled.

### Redis Cache (AWS ElastiCache / Redis Cloud)
- **Engine**: Redis 7.x
- **Cluster Mode**: Multi-AZ with Automatic Failover enabled
- **Eviction Policy**: `volatile-lru`

---

## 3. Environment Variables & Secrets Management

Store secrets in **AWS Secrets Manager** or **HashiCorp Vault**. Inject via environment variables into containers:

```bash
# Database Secrets
DB_HOST=ridenow-prod-db.c123456789.ap-south-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=ridenow_prod
DB_USER=ridenow_admin
DB_PASSWORD={{SECRET:DB_PASSWORD}}

# Redis Secrets
REDIS_HOST=ridenow-prod-redis.ab12cd.clustercfg.aps1.cache.amazonaws.com
REDIS_PORT=6379
REDIS_PASSWORD={{SECRET:REDIS_PASSWORD}}

# Security & Tokens
JWT_SECRET={{SECRET:JWT_SECRET_256BIT}}

# Payment Gateway
RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET={{SECRET:RAZORPAY_LIVE_SECRET}}
RAZORPAY_WEBHOOK_SECRET={{SECRET:RAZORPAY_WEBHOOK_SECRET}}

# Firebase / FCM
FCM_CREDENTIALS_JSON={{SECRET:FCM_SERVICE_ACCOUNT_JSON}}

# Maps API
GOOGLE_MAPS_API_KEY={{SECRET:GOOGLE_MAPS_LIVE_KEY}}

# SMS Gateway (MSG91 / Twilio)
SMS_AUTH_KEY={{SECRET:MSG91_AUTH_KEY}}
SMS_DLT_TE_ID=1207161234567890123
```

---

## 4. Docker Deployment Commands

### Building Production Image:
```bash
cd backend
docker build -t ridenow/backend:v1.0.0 -f Dockerfile .
docker push ridenow/backend:v1.0.0
```

### Deploying Admin Panel to Vercel / Docker:
```bash
cd admin-panel
docker build -t ridenow/admin-panel:v1.0.0 .
docker push ridenow/admin-panel:v1.0.0
```

---

## 5. Mobile App Store Submission Preparation

### Play Store (Android):
1. Key Store Signing Setup: `android/app/key.properties`
2. Update `versionCode` and `versionName` in `pubspec.yaml`
3. Request Permissions Justification for:
   - `ACCESS_BACKGROUND_LOCATION` (Foreground Service Video Proof required by Play Console team)
   - `USE_FULL_SCREEN_INTENT`
4. Build App Bundle:
   ```bash
   flutter build appbundle --release
   ```

### App Store (iOS):
1. Set up App Store Connect App ID with Push Notifications & Location capabilities enabled.
2. Update version and build numbers.
3. Provide Privacy Policy URL and Terms URL.
4. Add clear Info.plist permission strings for background location and notifications.
5. Build IPA:
   ```bash
   flutter build ipa --release
   ```

---

## 6. Pre-Launch Verification Checklist

- [ ] All database migrations applied successfully (`flyway migrate`)
- [ ] SSL certificates active and verified (TLS 1.2+ minimum)
- [ ] Domain names configured (`api.ridenow.com`, `admin.ridenow.com`)
- [ ] Razorpay webhook URL registered: `https://api.ridenow.com/api/v1/webhooks/razorpay`
- [ ] FCM Production credentials linked to Firebase App ID
- [ ] Google Maps API key restricted to production IP addresses / bundle IDs
- [ ] S3 bucket CORS and private policy applied (Pre-signed URL generation tested)
- [ ] Sentry / LogRocket monitoring connected
- [ ] Load testing executed up to 5,000 concurrent drivers without database connection starvation
