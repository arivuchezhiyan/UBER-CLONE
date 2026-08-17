# 🔍 RideNow — System Troubleshooting Guide

This guide helps engineers and system administrators diagnose and resolve operational issues across the RideNow platform.

---

## 1. Common Issues & Instant Diagnostic Procedures

### 🚨 1.1 "No Drivers Found" False Positives

**Symptom**: Riders get "No driver accepted this ride" despite drivers being visible online in the admin panel.

**Diagnostic Steps**:
1. **Check Redis Geo Index**:
   ```bash
   redis-cli GEORADIUS driver:locations 80.2707 13.0827 15 km WITHDIST
   ```
   *If empty*: Drivers' location updates are failing to write to Redis.
2. **Check Driver Stale Heartbeat**:
   ```sql
   SELECT id, is_online, last_heartbeat 
   FROM driver_availability 
   WHERE is_online = true AND last_heartbeat < NOW() - INTERVAL '2 minutes';
   ```
   *Resolution*: Stale drivers were not cleaned up. Run `StaleRideCleanupJob` or check Redis connection pool limits.
3. **Verify Vehicle Category Mapping**: Ensure the driver's active vehicle belongs to the category requested by the rider.

---

### 💳 1.2 Payment Status Mismatch (Stuck in `PAYMENT_PENDING`)

**Symptom**: Rider paid via UPI/Card, money deducted from bank account, but ride status remains `PAYMENT_PENDING`.

**Diagnostic Steps**:
1. Check Webhook Log in Backend:
   ```sql
   SELECT * FROM payment_transaction 
   WHERE gateway_transaction_id = 'pay_XXXXXXXXXXXXX';
   ```
2. If transaction is missing: Razorpay webhook failed to reach the server.
   - Check Nginx access logs: `grep "webhooks/razorpay" /var/log/nginx/access.log`
   - Check if Razorpay signature verification failed due to mismatched `RAZORPAY_WEBHOOK_SECRET`.
3. **Manual Resolution Trigger**:
   Execute manual sync via Admin Panel -> Payments -> "Sync with Gateway" API:
   `POST /api/v1/admin/finance/payments/{paymentId}/sync`

---

### 📡 1.3 Driver App Not Receiving Notifications in Background

**Symptom**: Drivers don't get new ride popups when using Google Maps or when screen is locked.

**Diagnostic Steps**:
1. Verify FCM Token Validity: Check `driver.fcm_token` is present and updated within 24 hours.
2. Check FCM Payload Structure: Ensure payload uses `data` field and high priority flag.
3. Android Device Check:
   - Check if battery saver / MIUI / Samsung App Optimization killed background process.
   - Ensure "Draw over other apps" / "Appear on top" permission is enabled.
   - Ensure Notification Channel `ride_requests` priority is set to `IMPORTANCE_HIGH`.

---

### 🔒 1.4 Database Lock Contention / Timeout Errors

**Symptom**: Log contains `org.hibernate.exception.LockAcquisitionException` or `PSQLException: ERROR: canceling statement due to lock timeout`.

**Diagnostic Steps**:
1. Identify Blocking Queries:
   ```sql
   SELECT pid, user, pg_blocking_pids(pid) AS blocked_by, query 
   FROM pg_stat_activity 
   WHERE cardinality(pg_blocking_pids(pid)) > 0;
   ```
2. Resolution:
   - Ensure transactions are short-lived. Never make external API calls (e.g. Google Maps or Razorpay) inside a `@Transactional` database lock boundary.
   - Verify all `SELECT FOR UPDATE` queries specify `NOWAIT` or reasonable lock timeouts (`SET lock_timeout = '3s'`).

---

## 2. Health Monitoring Diagnostics

Health endpoints for uptime checks:

```bash
# General System Health
curl http://localhost:8080/actuator/health

# Detailed Service Components
curl http://localhost:8080/actuator/health/db
curl http://localhost:8080/actuator/health/redis
```

Expected Response:
```json
{
  "status": "UP",
  "components": {
    "db": { "status": "UP", "details": { "database": "PostgreSQL" } },
    "redis": { "status": "UP", "details": { "version": "7.0.12" } }
  }
}
```
