# 🛡️ RideNow — Security Architecture

> Production-level security design for a real-world ride-booking platform.

---

## 1. Authentication

### 1.1 Rider & Driver: Phone + OTP (No Passwords)

```
Register/Login Flow:
1. User enters phone number
2. Backend generates 6-digit OTP
3. OTP sent via SMS (MSG91/Twilio)
4. OTP stored in Redis with 5-minute TTL
5. User enters OTP
6. Backend validates OTP
7. Backend issues JWT access token + refresh token
8. OTP deleted from Redis
```

**Why OTP, not password?**
- No password to leak/breach
- Phone possession = identity verification
- Standard in Indian ride-booking market
- Simpler UX for mobile-first users

### 1.2 Admin: Email + Password + Optional 2FA

```
Admin Login Flow:
1. Admin enters email + password
2. Backend verifies BCrypt hash (cost factor 12)
3. If 2FA enabled: prompt for TOTP code
4. Backend verifies TOTP
5. Issue JWT tokens
6. Log: admin_id, IP, timestamp, user_agent
```

### 1.3 JWT Token Strategy

| Token | Lifetime | Storage | Purpose |
|-------|----------|---------|---------|
| Access Token | 15 minutes | Memory (mobile), HttpOnly cookie (admin) | API authentication |
| Refresh Token | 30 days | Secure Storage (mobile), HttpOnly cookie (admin) | Get new access token |

**Access Token Payload:**
```json
{
  "sub": "user-uuid",
  "role": "RIDER",
  "deviceId": "device-hash",
  "iat": 1723108200,
  "exp": 1723109100
}
```

**Refresh Token:**
- Random 256-bit value (not JWT)
- BCrypt-hashed and stored in DB
- **Rotated on every use** (old token invalidated, new one issued)
- Tied to device ID — different device = different refresh token
- Max 3 active refresh tokens per user (one per device)

### 1.4 Token Revocation

| Event | Action |
|-------|--------|
| User logs out | Delete refresh token from DB |
| User changes phone | Revoke all tokens |
| Admin blocks user | Revoke all tokens |
| Suspicious activity | Revoke all tokens + force re-login |
| New device login | Optionally revoke old device token |

---

## 2. Authorization (RBAC)

### 2.1 Role Hierarchy

```
SUPER_ADMIN
    └── ADMIN
        └── DRIVER
        └── RIDER
```

### 2.2 Endpoint Access Matrix

| Endpoint Pattern | RIDER | DRIVER | ADMIN | SUPER_ADMIN |
|-----------------|-------|--------|-------|-------------|
| `/api/v1/auth/**` | ✅ | ✅ | ✅ | ✅ |
| `/api/v1/users/**` | ✅ (own) | ❌ | ✅ | ✅ |
| `/api/v1/drivers/**` | ❌ | ✅ (own) | ✅ | ✅ |
| `/api/v1/rides` (POST) | ✅ | ❌ | ❌ | ❌ |
| `/api/v1/rides/{id}/accept` | ❌ | ✅ | ❌ | ❌ |
| `/api/v1/rides/{id}` (GET) | ✅ (own) | ✅ (assigned) | ✅ | ✅ |
| `/api/v1/wallet/**` | ❌ | ✅ (own) | ✅ (read) | ✅ |
| `/api/v1/admin/**` | ❌ | ❌ | ✅ | ✅ |
| `/api/v1/admin/admins/**` | ❌ | ❌ | ❌ | ✅ |

### 2.3 Resource-Level Authorization

Beyond role checks, verify resource ownership:

```java
@Component("rideAuthz")
public class RideAuthorizationService {
    
    public boolean isRider(UUID rideId, Authentication auth) {
        UUID userId = ((UserPrincipal) auth.getPrincipal()).getId();
        return rideRepository.existsByIdAndRiderId(rideId, userId);
    }
    
    public boolean isAssignedDriver(UUID rideId, Authentication auth) {
        UUID driverId = ((UserPrincipal) auth.getPrincipal()).getId();
        return rideRepository.existsByIdAndDriverId(rideId, driverId);
    }
}

// Usage in controller:
@PreAuthorize("hasRole('RIDER') and @rideAuthz.isRider(#rideId, authentication)")
@GetMapping("/rides/{rideId}")
public ResponseEntity<RideResponse> getRide(@PathVariable UUID rideId) { ... }
```

---

## 3. Input Validation & Sanitization

### 3.1 Bean Validation on All DTOs

```java
public class CreateRideRequest {
    @NotNull(message = "Pickup latitude required")
    @DecimalMin("-90.0") @DecimalMax("90.0")
    private BigDecimal pickupLat;

    @NotNull @DecimalMin("-180.0") @DecimalMax("180.0")
    private BigDecimal pickupLng;

    @NotBlank @Size(max = 500)
    private String pickupAddress;

    @NotNull
    private UUID vehicleCategoryId;

    @NotNull @Pattern(regexp = "IMMEDIATE|SCHEDULED")
    private String rideType;

    @DecimalMin("0.0") @DecimalMax("10000.0")
    private BigDecimal extraAmount;
}
```

### 3.2 SQL Injection Prevention

- **JPA parameterized queries only** — never string concatenation
- **No native queries with user input** unless parameterized
- Spring Data JPA's `@Query` uses named parameters: `:param`

```java
// SAFE:
@Query("SELECT r FROM Ride r WHERE r.riderId = :riderId AND r.status = :status")
List<Ride> findByRiderAndStatus(@Param("riderId") UUID riderId, @Param("status") String status);

// NEVER DO THIS:
@Query("SELECT * FROM ride WHERE rider_id = '" + riderId + "'")  // SQL INJECTION!
```

### 3.3 XSS Prevention

- All text inputs sanitized with `HtmlUtils.htmlEscape()`
- API responses set `Content-Type: application/json` (not HTML)
- Admin panel uses React (auto-escapes by default)
- CSP headers on admin panel:
```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
```

### 3.4 File Upload Security

| Check | Implementation |
|-------|---------------|
| File size limit | Max 10 MB (configurable) |
| File type validation | Check magic bytes, not just extension |
| Allowed types | JPG, PNG, PDF only |
| Storage | S3/GCS private bucket — NOT public |
| Access | Pre-signed URLs with 15-minute expiry |
| Filename | Generate UUID filename — never use original |
| Virus scan | Phase 3: ClamAV integration |

```java
public String uploadDocument(MultipartFile file) {
    // Validate size
    if (file.getSize() > MAX_FILE_SIZE) throw new BusinessException("File too large");
    
    // Validate MIME type (check actual content, not just extension)
    String mimeType = tika.detect(file.getInputStream());
    if (!ALLOWED_MIME_TYPES.contains(mimeType)) throw new BusinessException("Invalid file type");
    
    // Generate safe filename
    String key = "documents/" + UUID.randomUUID() + getExtension(mimeType);
    
    // Upload to S3 (private bucket)
    s3Client.putObject(PutObjectRequest.builder()
        .bucket(PRIVATE_BUCKET)
        .key(key)
        .contentType(mimeType)
        .serverSideEncryption(ServerSideEncryption.AES256)
        .build(), 
        RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
    
    return key; // Store key, not full URL
}

// When admin needs to view:
public String getDocumentUrl(String key) {
    return s3Presigner.presignGetObject(
        GetObjectPresignRequest.builder()
            .signatureDuration(Duration.ofMinutes(15))
            .getObjectRequest(GetObjectRequest.builder()
                .bucket(PRIVATE_BUCKET)
                .key(key)
                .build())
            .build()
    ).url().toString();
}
```

---

## 4. Rate Limiting

```java
@Configuration
public class RateLimitConfig {

    @Bean
    public RateLimiter authRateLimiter() {
        // 5 login attempts per phone per 15 minutes
        return RateLimiter.of("auth", RateLimiterConfig.custom()
            .limitRefreshPeriod(Duration.ofMinutes(15))
            .limitForPeriod(5)
            .timeoutDuration(Duration.ZERO)
            .build());
    }

    @Bean
    public RateLimiter otpRateLimiter() {
        // 3 OTP requests per phone per 5 minutes
        return RateLimiter.of("otp", RateLimiterConfig.custom()
            .limitRefreshPeriod(Duration.ofMinutes(5))
            .limitForPeriod(3)
            .timeoutDuration(Duration.ZERO)
            .build());
    }
}
```

| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| Login/OTP | 5 | 15 min | Per phone |
| OTP request | 3 | 5 min | Per phone |
| Ride create | 5 | 1 min | Per user |
| General API | 60 | 1 min | Per user |
| Admin API | 120 | 1 min | Per admin |
| Webhooks | Unlimited | — | Signature verified |
| Driver location | 12 | 1 min | Per driver |

---

## 5. Data Privacy & Protection

### 5.1 Sensitive Data Handling

| Data | Storage | Display |
|------|---------|---------|
| Phone number | Full in DB (encrypted at rest) | Masked to other party: +91****3210 |
| Email | Full in DB | Not shared with other party |
| Aadhaar | Document number encrypted (AES-256) | Admin sees last 4 digits only |
| PAN | Document number encrypted | Admin sees masked |
| Driver location | Redis (ephemeral) + ride_location (trip only) | Rider sees during active ride only |
| Payment info | Gateway handles (PCI compliance) | Only payment status shown |
| OTP | Redis with 5-min TTL | Never logged, never stored permanently |
| JWT secret | Environment variable / Vault | Never in code or config files |

### 5.2 Data Retention Policy

| Data Type | Retention | Reason |
|-----------|-----------|--------|
| Ride records | 7 years | Tax/legal compliance |
| Payment records | 7 years | Financial audit |
| GPS breadcrumbs (ride_location) | 90 days | Dispute resolution, then purge |
| Driver live location | Real-time only (Redis) | Not stored permanently |
| OTP | 5 minutes | Auto-expires |
| Audit logs | Indefinite | Compliance |
| Support tickets | 3 years | Customer service |
| Deleted user PII | 30 days after deletion | DPDP Act compliance |

### 5.3 Encryption

| Layer | Method |
|-------|--------|
| In transit | TLS 1.2+ (HTTPS only) |
| At rest (DB) | PostgreSQL TDE or AWS RDS encryption |
| At rest (S3) | AES-256 server-side encryption |
| Sensitive columns (Aadhaar, PAN) | Application-level AES-256-GCM |
| Passwords (admin) | BCrypt (cost 12) |
| JWT signing | HMAC-SHA256 (256-bit key) |

---

## 6. API Security Headers

```java
@Configuration
public class SecurityHeadersConfig implements WebMvcConfigurer {
    
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override
            public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) {
                res.setHeader("X-Content-Type-Options", "nosniff");
                res.setHeader("X-Frame-Options", "DENY");
                res.setHeader("X-XSS-Protection", "1; mode=block");
                res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
                res.setHeader("Cache-Control", "no-store");
                res.setHeader("Pragma", "no-cache");
                return true;
            }
        });
    }
}
```

---

## 7. Fraud Prevention

| Threat | Detection | Response |
|--------|-----------|----------|
| Fake GPS (driver) | Velocity check: impossible speed changes. Cell tower mismatch. | Flag + warn → review → suspend |
| Multiple accounts (rider) | Same device ID, same IP pattern | Flag for review |
| Promo code abuse | Multiple redemptions from same device/IP | Block promo, flag user |
| Fare manipulation | Backend is sole fare calculator | N/A — frontend can't manipulate |
| Fake driver registration | Document verification by admin | Manual review required |
| Payment fraud | Razorpay's fraud detection + webhook verification | Block user, reverse transaction |
| Driver rating manipulation | Rate limiting on ratings, one per ride | Duplicate check (UNIQUE constraint) |
| Bot ride requests | Rate limiting + CAPTCHA (if needed) | Block IP/device |

---

## 8. Audit Trail

Every admin action is logged immutably:

```java
@Aspect
@Component
public class AuditAspect {
    
    @Around("@annotation(Auditable)")
    public Object audit(ProceedingJoinPoint joinPoint) throws Throwable {
        Auditable annotation = getAnnotation(joinPoint);
        
        // Capture before state
        Object beforeState = captureState(annotation, joinPoint);
        
        // Execute
        Object result = joinPoint.proceed();
        
        // Capture after state
        Object afterState = captureState(annotation, joinPoint);
        
        // Log
        AuditLog log = AuditLog.builder()
            .adminId(getCurrentAdminId())
            .action(annotation.action())
            .entityType(annotation.entityType())
            .entityId(extractEntityId(joinPoint))
            .previousValue(toJson(beforeState))
            .newValue(toJson(afterState))
            .ipAddress(getClientIp())
            .userAgent(getUserAgent())
            .description(annotation.description())
            .build();
        auditLogRepository.save(log);
        
        return result;
    }
}

// Usage:
@Auditable(action = "COMMISSION_CHANGED", entityType = "FARE_RULE")
public FareRule updateCommission(UUID ruleId, BigDecimal newPercentage) { ... }
```

---

## 9. Security Checklist for Production

- [ ] HTTPS everywhere (no HTTP)
- [ ] HSTS header enabled
- [ ] Database not publicly accessible
- [ ] Redis not publicly accessible
- [ ] S3 buckets private
- [ ] JWT secret in environment variables (not code)
- [ ] Razorpay keys in environment variables
- [ ] BCrypt cost factor ≥ 12 for admin passwords
- [ ] Rate limiting on all public endpoints
- [ ] Input validation on all API endpoints
- [ ] File upload type + size validation
- [ ] CORS configured (not `*` in production)
- [ ] SQL injection: only parameterized queries
- [ ] XSS: output encoding + CSP headers
- [ ] Audit logging for all admin actions
- [ ] Certificate pinning in mobile apps (Phase 2)
- [ ] Penetration test before launch
- [ ] Dependency vulnerability scan (OWASP)
- [ ] Secrets rotation plan
- [ ] Incident response plan documented
