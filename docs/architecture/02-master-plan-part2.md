# 🚀 MASTER DEVELOPMENT PLAN — PART 2 (Sections 16–30)

> **Companion to**: [Master Plan Part 1 (Sections 1-15)](file:///C:/Users/arivu/.gemini/antigravity-ide/brain/cb9be255-2842-4494-af3e-2af43464dab8/implementation_plan.md)  
> **Database Schema**: [Database Schema](file:///C:/Users/arivu/.gemini/antigravity-ide/brain/cb9be255-2842-4494-af3e-2af43464dab8/database_schema.md)  
> **API Design**: [API Design](file:///C:/Users/arivu/.gemini/antigravity-ide/brain/cb9be255-2842-4494-af3e-2af43464dab8/api_design.md)

---

## Table of Contents

| Section | Title |
|---------|-------|
| 16 | [Payment Architecture](#section-16--payment-architecture) |
| 17 | [Driver Wallet / Commission / Settlement](#section-17--driver-wallet--commission--settlement-architecture) |
| 18 | [Scheduled Ride Architecture](#section-18--scheduled-ride-architecture) |
| 19 | [Cancellation Architecture](#section-19--cancellation-architecture) |
| 20 | [Notification / Email Architecture](#section-20--notification--email-architecture) |
| 21 | [Security Architecture](#section-21--security-architecture) |
| 22 | [Failure / Recovery Strategy](#section-22--failure--recovery-strategy) |
| 23 | [API Architecture](#section-23--api-architecture) |
| 24 | [Folder / Project Structure](#section-24--folder--project-structure) |
| 25 | [Testing Strategy](#section-25--testing-strategy) |
| 26 | [Deployment / DevOps Architecture](#section-26--deployment--devops-architecture) |
| 27 | [MVP Development Roadmap](#section-27--mvp-development-roadmap) |
| 28 | [Production Roadmap](#section-28--production-roadmap) |
| 29 | [Complete End-to-End Ride Flows](#section-29--complete-end-to-end-ride-flows) |
| 30 | [Potential Problems / Conflicts](#section-30--potential-problems--conflicts) |
| 31 | [MISSED EDGE CASES AND RECOMMENDATIONS](#section-31--missed-edge-cases-and-recommendations) |

---

# SECTION 16 — PAYMENT ARCHITECTURE

## 16.1 Payment Flow Overview

```
TRIP COMPLETED
       │
       ▼
┌──────────────────┐
│ Backend calculates│
│ final fare         │
└────────┬─────────┘
         │
    ┌────▼────┐
    │  CASH?  │
    └────┬────┘
    Yes  │  No
    ┌────▼────┐    ┌─────────────────────────┐
    │Mark as  │    │ Create Razorpay Order    │
    │CASH_    │    │ (server-side)            │
    │PENDING  │    └──────────┬──────────────┘
    │         │               │
    │Driver   │    ┌──────────▼──────────────┐
    │confirms │    │ Rider opens Razorpay     │
    │cash     │    │ checkout (frontend)      │
    │received │    │ UPI / Card / Wallet      │
    └────┬────┘    └──────────┬──────────────┘
         │                    │
         │         ┌──────────▼──────────────┐
         │         │ Razorpay processes       │
         │         │ payment                  │
         │         └──────────┬──────────────┘
         │                    │
         │         ┌──────────▼──────────────┐
         │         │ Razorpay Webhook         │
         │         │ → Backend receives       │
         │         │ → Verify signature       │
         │         │ → Update payment status  │
         │         └──────────┬──────────────┘
         │                    │
         ├────────────────────┘
         │
    ┌────▼──────────────────────┐
    │ PAYMENT_COMPLETED          │
    │                            │
    │ → Calculate commission     │
    │ → Credit driver wallet     │
    │ → Create financial record  │
    │ → Generate invoice         │
    │ → Send admin email         │
    │ → Update ride status       │
    └───────────────────────────┘
```

## 16.2 Payment Rules

| Rule | Implementation |
|------|----------------|
| **Never trust frontend payment status** | Only Razorpay webhook or server-side verification confirms payment |
| **Idempotent webhooks** | `UNIQUE(gateway_payment_id)` on payment_transaction table |
| **Webhook signature verification** | Verify HMAC-SHA256 signature using Razorpay secret |
| **No raw card storage** | Razorpay handles PCI compliance; we only store payment_id |
| **Retry failed payments** | Allow 3 retry attempts within 24 hours |
| **Refund via backend only** | Admin-initiated or system-initiated, never frontend |
| **Double-spend prevention** | Lock payment row during processing |

## 16.3 Payment States

```
CREATED → PROCESSING → COMPLETED
                    → FAILED → RETRY → COMPLETED
                                    → FAILED (final)
COMPLETED → REFUND_INITIATED → REFUNDED
                             → REFUND_FAILED
```

## 16.4 Webhook Processing (Idempotent)

```java
@PostMapping("/webhooks/razorpay")
public ResponseEntity<String> handleRazorpayWebhook(
    @RequestBody String payload,
    @RequestHeader("X-Razorpay-Signature") String signature
) {
    // 1. Verify webhook signature
    boolean isValid = razorpayService.verifyWebhookSignature(payload, signature);
    if (!isValid) {
        log.warn("Invalid Razorpay webhook signature");
        return ResponseEntity.status(400).body("Invalid signature");
    }
    
    WebhookEvent event = objectMapper.readValue(payload, WebhookEvent.class);
    String gatewayPaymentId = event.getPaymentId();
    
    // 2. Idempotency check — has this webhook been processed?
    Optional<PaymentTransaction> existing = 
        paymentTransactionRepository.findByGatewayTransactionId(gatewayPaymentId);
    if (existing.isPresent() && existing.get().getStatus() == TransactionStatus.COMPLETED) {
        // Already processed — return 200 to stop Razorpay retries
        return ResponseEntity.ok("Already processed");
    }
    
    // 3. Process in a transaction
    try {
        paymentService.processWebhookPayment(event);
    } catch (Exception e) {
        log.error("Webhook processing failed for {}", gatewayPaymentId, e);
        // Return 500 so Razorpay retries
        return ResponseEntity.status(500).body("Processing failed");
    }
    
    // 4. Return 200 to acknowledge
    return ResponseEntity.ok("Processed");
}
```

## 16.5 Cash Payment Handling

```
Driver arrives → OTP verified → Trip starts → Trip completes
       │
       ▼
Payment method = CASH
       │
       ├──► Rider pays cash to driver
       │
       ├──► Driver presses "Cash Received" in app
       │       │
       │       ▼
       │    Backend validates:
       │    • Ride is in PAYMENT_PENDING status
       │    • Driver is assigned to this ride
       │    │
       │    ▼
       │    Mark payment as CASH_COLLECTED
       │    │
       │    ▼
       │    Deduct platform commission from driver's wallet
       │    (Driver received full amount in cash, owes commission)
       │
       └──► Settlement: Driver wallet balance reduced by commission amount
```

> [!IMPORTANT]
> For cash payments, the platform commission is **deducted** from the driver's wallet balance (or accumulated as a payable). The driver collected the full fare in cash, so they owe the platform its commission share.

## 16.6 Refund Architecture

| Scenario | Refund Amount | Trigger |
|----------|--------------|---------|
| Driver cancelled after acceptance | 100% | Automatic |
| Platform error | 100% | Admin-initiated |
| Rider cancellation (within free window) | 100% | Automatic |
| Rider cancellation (after driver arrived) | Fare - cancellation fee | Automatic |
| Overcharge | Difference | Admin-initiated |
| Partial trip (driver issue) | Proportional | Admin review |

```java
@Transactional
public Refund processRefund(UUID paymentId, BigDecimal amount, String reason, UUID adminId) {
    Payment payment = paymentRepository.findByIdForUpdate(paymentId)
        .orElseThrow(() -> new ResourceNotFoundException("Payment not found"));
    
    // Validate refund is possible
    if (payment.getStatus() != PaymentStatus.COMPLETED) {
        throw new BusinessException("Can only refund completed payments");
    }
    if (amount.compareTo(payment.getAmount()) > 0) {
        throw new BusinessException("Refund amount exceeds payment amount");
    }
    
    // Check for existing refund (prevent duplicate)
    Optional<Refund> existingRefund = refundRepository.findByPaymentId(paymentId);
    if (existingRefund.isPresent()) {
        throw new BusinessException("Refund already processed for this payment");
    }
    
    // Process refund via Razorpay
    RazorpayRefundResponse gatewayResponse = razorpayGateway.initiateRefund(
        payment.getGatewayPaymentId(), amount
    );
    
    // Create refund record
    Refund refund = Refund.builder()
        .paymentId(paymentId)
        .rideId(payment.getRideId())
        .amount(amount)
        .reason(reason)
        .status(RefundStatus.INITIATED)
        .gatewayRefundId(gatewayResponse.getRefundId())
        .initiatedBy(adminId)
        .build();
    refundRepository.save(refund);
    
    // Reverse driver wallet credit
    walletService.debitWallet(
        payment.getRide().getDriverId(),
        amount,
        WalletTransactionType.REFUND_DEDUCT,
        payment.getRideId(),
        "Refund: " + reason
    );
    
    // Audit log
    auditService.log(adminId, "REFUND_INITIATED", 
        "Payment " + paymentId + " refunded " + amount);
    
    return refund;
}
```

---

# SECTION 17 — DRIVER WALLET / COMMISSION / SETTLEMENT ARCHITECTURE

## 17.1 Architecture Choice: Wallet + Ledger (Not Just Balance)

**Why a ledger and not just a balance field?**

| Approach | Problem |
|----------|---------|
| Just updating `balance` field | No audit trail. Can't trace how balance was reached. Disputes impossible to resolve. |
| **Ledger (wallet_transaction)** | Every credit and debit is an immutable row. Balance can be reconstructed from transactions. Full audit trail. |

## 17.2 Wallet Operations

```
RIDE COMPLETED + PAYMENT CONFIRMED
        │
        ▼
┌───────────────────────────────────────┐
│ 1. Create ride_financial record       │
│    (immutable snapshot)               │
│                                       │
│    total_fare:         ₹1,000         │
│    commission_pct:     20%            │
│    platform_commission: ₹200          │
│    driver_earnings:    ₹800           │
│    commission_gst:     ₹36            │
└───────────────┬───────────────────────┘
                │
                ▼
┌───────────────────────────────────────┐
│ 2. Credit driver wallet               │
│                                       │
│    wallet_transaction:                 │
│    type: RIDE_EARNING                 │
│    direction: CREDIT                  │
│    amount: ₹800                       │
│    balance_before: ₹5,000             │
│    balance_after: ₹5,800              │
│    idempotency_key: ride-{rideId}-earn│
└───────────────┬───────────────────────┘
                │
                ▼
┌───────────────────────────────────────┐
│ 3. Record commission deduction        │
│                                       │
│    wallet_transaction:                 │
│    type: COMMISSION_DEDUCT            │
│    direction: DEBIT                   │
│    amount: ₹200                       │
│    (This is conceptual — for online   │
│     payments, platform already keeps  │
│     its share. For CASH payments,     │
│     this is an actual deduction.)     │
└───────────────────────────────────────┘
```

## 17.3 Cash vs Online Settlement Difference

| Payment Method | Platform Gets | Driver Gets | Wallet Impact |
|----------------|---------------|-------------|---------------|
| **Online** | Rider pays ₹1000 to gateway → Platform receives ₹1000 → Credits ₹800 to driver wallet | ₹800 (when payout processed) | Credit ₹800 |
| **Cash** | Driver collects ₹1000 cash → Platform deducts ₹200 from driver wallet | ₹1000 cash minus ₹200 commission | Debit ₹200 |

## 17.4 Wallet Transaction with Optimistic Locking

```java
@Transactional
public WalletTransaction creditWallet(UUID driverId, BigDecimal amount, 
    WalletTransactionType type, UUID rideId, String description) {
    
    // Idempotency key prevents double-crediting
    String idempotencyKey = "ride-" + rideId + "-" + type.name();
    
    Optional<WalletTransaction> existing = 
        walletTransactionRepository.findByIdempotencyKey(idempotencyKey);
    if (existing.isPresent()) {
        return existing.get(); // Already processed
    }
    
    // Optimistic locking: retry up to 3 times on version conflict
    int retries = 3;
    while (retries > 0) {
        try {
            DriverWallet wallet = walletRepository.findByDriverId(driverId)
                .orElseThrow(() -> new ResourceNotFoundException("Wallet not found"));
            
            BigDecimal balanceBefore = wallet.getBalance();
            BigDecimal balanceAfter = balanceBefore.add(amount);
            
            wallet.setBalance(balanceAfter);
            wallet.setTotalEarned(wallet.getTotalEarned().add(amount));
            // wallet.version auto-incremented by @Version annotation
            walletRepository.save(wallet); // Throws OptimisticLockException on conflict
            
            WalletTransaction txn = WalletTransaction.builder()
                .walletId(wallet.getId())
                .driverId(driverId)
                .rideId(rideId)
                .type(type)
                .direction(TransactionDirection.CREDIT)
                .amount(amount)
                .balanceBefore(balanceBefore)
                .balanceAfter(balanceAfter)
                .description(description)
                .idempotencyKey(idempotencyKey)
                .build();
            
            return walletTransactionRepository.save(txn);
            
        } catch (OptimisticLockException e) {
            retries--;
            if (retries == 0) throw new ConcurrencyException("Wallet update failed after retries");
        }
    }
    throw new ConcurrencyException("Wallet update failed");
}
```

## 17.5 Payout System

```
Driver requests payout
       │
       ▼
Validate:
• Balance >= minimum payout (₹500)
• No pending payout
• Bank details verified
       │
       ▼
Create payout record (status: INITIATED)
       │
       ▼
Debit wallet (balance_after reflects deduction)
       │
       ▼
Queue bank transfer (Razorpay Payout API or manual)
       │
       ▼
Webhook confirms transfer
       │
       ▼
Update payout status: COMPLETED
       │
       ▼
If transfer fails:
• Re-credit wallet
• Mark payout: FAILED
• Notify driver
```

## 17.6 Driver Earnings Dashboard Data

| Metric | Calculation |
|--------|-------------|
| Today's Earnings | SUM(wallet_transaction.amount) WHERE direction='CREDIT' AND type='RIDE_EARNING' AND date=today |
| This Week | Same, filtered by current week |
| This Month | Same, filtered by current month |
| Total Earned | driver_wallet.total_earned |
| Current Balance | driver_wallet.balance |
| Pending Payout | SUM(payout.amount) WHERE status='INITIATED' |
| Total Paid Out | driver_wallet.total_paid_out |
| Commission Paid | SUM(ride_financial.platform_commission) WHERE driver_id=X |

---

# SECTION 18 — SCHEDULED RIDE ARCHITECTURE

## 18.1 Scheduled Ride Lifecycle

```
TODAY (Aug 8)                                      RIDE DAY (Aug 15)
                                                          
Rider books ride ──────────────────────────────────► 7:15 AM: Pre-matching starts
for Aug 15, 8 AM                                          │
     │                                                    ▼
     ▼                                              7:15 AM: Find eligible drivers
Validation:                                         within 10km of pickup
• Date must be > 30 min from now                          │
• Date must be < 7 days from now                          ▼
• No duplicate schedule for same                    7:15 AM: Send requests to 
  rider at overlapping time                         ranked drivers (sequential)
     │                                                    │
     ▼                                                    ▼
Store in scheduled_ride table                       7:20 AM: Driver D accepts
Store ride with status REQUESTED                          │
+ ride_type = SCHEDULED                                   ▼
     │                                              Ride status → DRIVER_ASSIGNED
     ▼                                              Rider notified: "Driver assigned
Rider receives confirmation:                        for your 8 AM ride"
"Ride scheduled for Aug 15                                │
at 8:00 AM"                                               ▼
     │                                              7:45 AM: Reminder to driver
     ▼                                              "Your scheduled pickup is
Reminders:                                          in 15 minutes"
• Aug 14, 8 PM: "Reminder:                                │
  ride tomorrow at 8 AM"                                   ▼
• Aug 15, 7:30 AM: "Your                            8:00 AM: Driver navigates
  ride is in 30 minutes"                             to pickup → normal ride flow
```

## 18.2 Scheduled Ride Job (Spring @Scheduled)

```java
@Component
public class ScheduledRideJob {
    
    // Run every minute — check for scheduled rides approaching their time
    @Scheduled(fixedRate = 60000)
    public void processUpcomingScheduledRides() {
        Instant now = Instant.now();
        Instant matchingWindow = now.plus(45, ChronoUnit.MINUTES);
        
        // Find scheduled rides that need driver matching
        // (45 min before pickup, not yet assigned, not cancelled)
        List<ScheduledRide> upcoming = scheduledRideRepository
            .findByScheduledTimeBetweenAndStatusIn(
                now, matchingWindow,
                List.of(ScheduledRideStatus.CONFIRMED, ScheduledRideStatus.MATCHING)
            );
        
        for (ScheduledRide scheduled : upcoming) {
            // Skip if already being processed (distributed lock)
            String lockKey = "scheduled-ride-lock:" + scheduled.getId();
            boolean acquired = redisLock.tryAcquire(lockKey, Duration.ofMinutes(5));
            if (!acquired) continue;
            
            try {
                if (scheduled.getStatus() == ScheduledRideStatus.CONFIRMED) {
                    // First time: Start matching
                    scheduled.setStatus(ScheduledRideStatus.MATCHING);
                    scheduledRideRepository.save(scheduled);
                    
                    // Trigger matching service
                    matchingService.matchScheduledRide(scheduled.getRideId());
                }
            } finally {
                redisLock.release(lockKey);
            }
        }
    }
    
    // Send reminders
    @Scheduled(fixedRate = 300000) // Every 5 minutes
    public void sendScheduledRideReminders() {
        Instant now = Instant.now();
        
        // 24-hour reminder
        List<ScheduledRide> tomorrow = scheduledRideRepository
            .findRidesNeedingReminder(now, Duration.ofHours(24), "REMINDER_24H");
        for (ScheduledRide sr : tomorrow) {
            notificationService.sendScheduledRideReminder(sr, "24h");
            sr.addSentReminder("REMINDER_24H");
            scheduledRideRepository.save(sr);
        }
        
        // 30-minute reminder
        List<ScheduledRide> soon = scheduledRideRepository
            .findRidesNeedingReminder(now, Duration.ofMinutes(30), "REMINDER_30M");
        for (ScheduledRide sr : soon) {
            notificationService.sendScheduledRideReminder(sr, "30m");
            sr.addSentReminder("REMINDER_30M");
            scheduledRideRepository.save(sr);
        }
    }
}
```

## 18.3 Scheduled Ride Edge Cases

| Scenario | Handling |
|----------|----------|
| No driver accepts before scheduled time | Expand search radius. If still none: notify rider 15 min before, offer to increase fare or cancel. |
| Assigned driver cancels | Immediately start re-matching. Notify rider. |
| Rider cancels scheduled ride | Follow cancellation rules (time-based fee). Free if > 2 hours before. |
| Rider books overlapping scheduled rides | Prevent: check for time conflicts (±30 min window). |
| Driver has overlapping scheduled rides | Prevent: check driver assignments before offering. |
| Scheduled time passes with no match | Auto-cancel ride. Full refund if paid. Notify rider. |
| Driver assigned but goes offline | Heartbeat monitor detects. Re-match. Notify rider. |

---

# SECTION 19 — CANCELLATION ARCHITECTURE

## 19.1 Cancellation Rules Matrix

| Stage | Who Cancels | Fee | Refund |
|-------|-------------|-----|--------|
| Before driver search starts | Rider | ₹0 | 100% |
| During driver search | Rider | ₹0 | 100% |
| After driver assigned, within 2 min | Rider | ₹0 | 100% |
| After driver assigned, 2-5 min | Rider | ₹25 | Fare - ₹25 |
| After driver arrived | Rider | ₹50 | Fare - ₹50 |
| After trip started | Rider | Calculated based on distance covered | Partial |
| Driver cancels before reaching pickup | Driver | Penalty on driver (internal, affects rating + possible deduction) | 100% to rider |
| Driver cancels after arriving | Driver | Higher penalty on driver | 100% to rider |
| Scheduled ride, > 2 hours before | Rider | ₹0 | 100% |
| Scheduled ride, 1-2 hours before | Rider | ₹50 | Fare - ₹50 |
| Scheduled ride, < 1 hour before | Rider | ₹100 | Fare - ₹100 |
| Rider no-show (driver waited > 10 min) | System (driver-initiated) | Full fare or configured no-show fee | ₹0 |

> [!NOTE]
> All cancellation fees are **configurable by admin** through the `cancellation_rule` table, not hardcoded.

## 19.2 Cancellation Processing

```java
@Transactional
public CancellationResult cancelRide(UUID rideId, UUID cancelledBy, 
    UserRole role, String reason) {
    
    Ride ride = rideRepository.findByIdForUpdate(rideId)
        .orElseThrow(() -> new ResourceNotFoundException("Ride not found"));
    
    // Validate cancellation is possible in current state
    RideStatus currentStatus = ride.getStatus();
    if (!CANCELLABLE_STATES.contains(currentStatus)) {
        throw new BusinessException("Ride cannot be cancelled in " + currentStatus + " status");
    }
    
    // Determine cancellation fee
    CancellationRule rule = cancellationRuleService
        .findApplicableRule(ride.getVehicleCategoryId(), currentStatus, role, ride.getRideType());
    
    BigDecimal cancellationFee = cancellationRuleEngine.calculateFee(ride, rule);
    
    // Update ride status
    RideStatus newStatus = (role == UserRole.RIDER) 
        ? RideStatus.CANCELLED_BY_RIDER 
        : RideStatus.CANCELLED_BY_DRIVER;
    rideStatusMachine.validateTransition(currentStatus, newStatus);
    ride.setStatus(newStatus);
    ride.setCancelledAt(Instant.now());
    rideRepository.save(ride);
    
    // Record status history
    rideStatusHistoryService.record(ride, currentStatus, newStatus, cancelledBy, role, reason);
    
    // Create cancellation record
    Cancellation cancellation = Cancellation.builder()
        .rideId(rideId)
        .cancelledBy(cancelledBy)
        .cancelledByRole(role)
        .reason(reason)
        .cancellationFee(cancellationFee)
        .rideStatusAtCancellation(currentStatus)
        .build();
    cancellationRepository.save(cancellation);
    
    // Free up driver if assigned
    if (ride.getDriverId() != null) {
        driverAvailabilityService.markAvailable(ride.getDriverId());
        // Remove assignment
        rideAssignmentRepository.deleteByRideId(rideId);
    }
    
    // Handle payment/refund
    if (ride.getPayment() != null && ride.getPayment().getStatus() == PaymentStatus.COMPLETED) {
        BigDecimal refundAmount = ride.getPayment().getAmount().subtract(cancellationFee);
        if (refundAmount.compareTo(BigDecimal.ZERO) > 0) {
            refundService.processRefund(ride.getPayment().getId(), refundAmount, 
                "Cancellation: " + reason, null);
        }
    }
    
    // Notify parties
    notificationService.notifyCancellation(ride, cancellation);
    
    // If driver cancelled, apply penalty
    if (role == UserRole.DRIVER) {
        driverPenaltyService.applyCancellationPenalty(ride.getDriverId(), rideId);
    }
    
    return new CancellationResult(cancellation, cancellationFee);
}
```

## 19.3 Driver Cancellation Penalties

| Consecutive Cancellations (24h) | Penalty |
|--------------------------------|---------|
| 1-2 | Warning notification |
| 3-4 | 15-minute cool-down (no new ride requests) |
| 5+ | Auto-offline for 1 hour |
| 10+ in a week | Admin review flagged, possible suspension |

---

# SECTION 20 — NOTIFICATION / EMAIL ARCHITECTURE

## 20.1 Notification Service Architecture

```
Business Event (Ride Created, Driver Assigned, etc.)
        │
        ▼
NotificationService.send(event)
        │
        ├──► Determine recipients & channels
        │
        ├──► Queue notification jobs (async)
        │    │
        │    ├──► Push Notification Job → FCM Provider
        │    ├──► Email Job → SES/SendGrid Provider  
        │    ├──► SMS Job → MSG91/Twilio Provider
        │    └──► In-App Notification → DB Insert + WebSocket
        │
        └──► Return immediately (never blocks business logic)
```

## 20.2 Notification Channel Matrix

| Event | Push | In-App | Email | SMS |
|-------|------|--------|-------|-----|
| Ride confirmed | ✅ Rider | ✅ | ❌ | ❌ |
| Driver assigned | ✅ Rider | ✅ | ❌ | ❌ |
| Driver arriving | ✅ Rider | ✅ | ❌ | ❌ |
| Driver arrived | ✅ Rider | ✅ | ❌ | ✅ OTP |
| Trip started | ✅ Rider | ✅ | ❌ | ❌ |
| Trip completed | ✅ Rider + Driver | ✅ | ✅ Invoice | ❌ |
| Payment completed | ✅ Rider + Driver | ✅ | ✅ Receipt | ❌ |
| Ride cancelled | ✅ Both | ✅ | ❌ | ❌ |
| New ride request | ✅ Driver | ✅ | ❌ | ❌ |
| Scheduled ride reminder | ✅ Both | ✅ | ✅ | ✅ |
| Driver approved | ✅ Driver | ✅ | ✅ | ✅ |
| Payout processed | ✅ Driver | ✅ | ✅ | ❌ |
| Ride info to admin | ❌ | ❌ | ✅ | ❌ |

## 20.3 Email to Admin (Ride Completion)

```html
<!-- Template: admin-ride-report.html -->
Subject: [RideNow] Ride Completed - RN-20260808-0042

Ride ID: RN-20260808-0042
Type: IMMEDIATE | SHORT_DISTANCE
Status: COMPLETED → SETTLED

RIDER
  Name: Arivuchelvan
  Phone: +91 98XXXX1234

DRIVER  
  Name: Karthik R
  Vehicle: TN-07-AB-1234 (Sedan - Maruti Dzire)

ROUTE
  Pickup: T. Nagar, Chennai
  Drop: Adyar, Chennai
  Distance: 8.5 km
  Duration: 25 min

FINANCIAL BREAKDOWN
  Base Fare:         ₹50.00
  Distance Fare:     ₹91.00
  Time Fare:         ₹50.00
  Subtotal:          ₹191.00
  GST (5%):          ₹9.55
  Total Fare:        ₹200.55
  
  Platform Commission (20%): ₹40.11
  Driver Earnings:           ₹160.44

PAYMENT
  Method: UPI
  Status: COMPLETED
  Gateway ID: pay_XXXXX

TIMESTAMPS
  Requested: 2026-08-08 10:30:00 IST
  Driver Assigned: 2026-08-08 10:30:45 IST
  Trip Started: 2026-08-08 10:42:00 IST
  Trip Completed: 2026-08-08 11:07:00 IST
```

## 20.4 Retry Mechanism

```java
@Component
public class NotificationRetryHandler {
    
    private static final int MAX_RETRIES = 3;
    private static final int[] BACKOFF_SECONDS = {30, 120, 600}; // 30s, 2min, 10min
    
    public void handleFailedNotification(NotificationJob job) {
        int attempt = job.getAttemptCount();
        
        if (attempt >= MAX_RETRIES) {
            // Move to dead-letter queue
            deadLetterQueue.add(job);
            log.error("Notification permanently failed after {} attempts: {}", 
                MAX_RETRIES, job.getId());
            
            // Record failure for monitoring
            metricsService.incrementCounter("notification.permanent_failure", 
                "channel", job.getChannel().name());
            return;
        }
        
        // Schedule retry with exponential backoff
        int delaySeconds = BACKOFF_SECONDS[attempt];
        job.setAttemptCount(attempt + 1);
        job.setNextRetryAt(Instant.now().plusSeconds(delaySeconds));
        notificationQueue.scheduleRetry(job);
        
        log.warn("Notification retry scheduled: attempt={}, delay={}s, job={}", 
            attempt + 1, delaySeconds, job.getId());
    }
}
```

> [!CAUTION]
> **Notification failures must NEVER block ride operations.** All notification sending is async. If email/SMS/push fails, the ride continues normally. The failure is logged and retried in the background.

---

# SECTION 21 — SECURITY ARCHITECTURE

## 21.1 Authentication Strategy

### JWT + Refresh Token Flow

```
LOGIN
  │
  ├──► Verify credentials (phone + OTP)
  │
  ├──► Generate Access Token (JWT)
  │    • Expires: 15 minutes
  │    • Contains: userId, role, deviceId
  │    • Signed: HMAC-SHA256
  │
  ├──► Generate Refresh Token
  │    • Expires: 30 days
  │    • Stored in DB (hashed)
  │    • Rotated on each use
  │    • One per device
  │
  └──► Return both tokens to client

API REQUEST
  │
  ├──► Client sends: Authorization: Bearer <access_token>
  │
  ├──► JwtAuthenticationFilter validates token
  │    • Check signature
  │    • Check expiration
  │    • Extract userId + role
  │    • Set SecurityContext
  │
  └──► If expired:
       │
       ├──► Client sends refresh token to /auth/refresh
       │
       ├──► Server validates refresh token
       │    • Check exists in DB (not revoked)
       │    • Check not expired
       │    • Check device matches
       │
       ├──► Rotate: invalidate old refresh token, issue new pair
       │
       └──► Return new access + refresh tokens
```

## 21.2 Role-Based Access Control (RBAC)

```java
// Controller-level authorization
@PreAuthorize("hasRole('RIDER')")
@PostMapping("/rides")
public ResponseEntity<RideResponse> createRide(...) { ... }

@PreAuthorize("hasRole('DRIVER')")
@PostMapping("/rides/{id}/accept")
public ResponseEntity<Void> acceptRide(...) { ... }

@PreAuthorize("hasRole('ADMIN')")
@GetMapping("/admin/rides")
public ResponseEntity<Page<RideResponse>> getAllRides(...) { ... }

// Resource-level authorization (beyond role)
// Rider can only view their own rides
@PreAuthorize("hasRole('RIDER') and @rideAuthz.isOwner(#rideId, authentication)")
@GetMapping("/rides/{rideId}")
public ResponseEntity<RideResponse> getRide(@PathVariable UUID rideId) { ... }
```

## 21.3 Security Measures Matrix

| Threat | Mitigation |
|--------|-----------|
| **Brute force login** | Rate limiting: 5 OTP attempts per phone per 15 min. Lockout after 10 failed attempts. |
| **Token theft** | Short-lived access tokens (15 min). Refresh token rotation. Token revocation on logout. |
| **SQL injection** | JPA parameterized queries. Never raw SQL concatenation. Input validation. |
| **XSS** | Content-Type headers. Output encoding. CSP headers on admin panel. |
| **CSRF** | Not applicable for API (JWT in Authorization header). Admin panel uses SameSite cookies. |
| **Man-in-the-middle** | HTTPS only. HSTS headers. Certificate pinning in mobile apps (production). |
| **Unauthorized access** | RBAC on every endpoint. Resource-level authorization. |
| **Data exposure** | API responses exclude sensitive fields. Phone numbers partially masked for cross-party display. |
| **File upload attacks** | File type validation (magic bytes, not just extension). Size limits. Virus scan (Phase 3). Store outside webroot (S3). |
| **Document access** | Pre-signed URLs with expiration. Only admin can access driver documents. |
| **Password storage** | BCrypt with cost factor 12 (for admin passwords). Riders/drivers use OTP (no password). |
| **API abuse** | Rate limiting per IP and per user. Request size limits. |
| **Fare manipulation** | All fare calculations server-side. Frontend is display-only. |
| **Fake GPS** | GPS spoofing detection (velocity checks, cell tower correlation). Flag suspicious patterns. |
| **Session hijacking** | Device fingerprinting. Session bound to device. Concurrent session limits. |
| **Webhook tampering** | HMAC signature verification on all webhooks. |
| **Admin impersonation** | Admin accounts require email + password + optional 2FA. Admin actions audited. |

## 21.4 Input Validation

```java
// Every DTO uses Bean Validation annotations
public class CreateRideRequest {
    
    @NotNull(message = "Pickup latitude is required")
    @DecimalMin(value = "-90.0") @DecimalMax(value = "90.0")
    private BigDecimal pickupLat;
    
    @NotNull(message = "Pickup longitude is required")
    @DecimalMin(value = "-180.0") @DecimalMax(value = "180.0")
    private BigDecimal pickupLng;
    
    @NotBlank(message = "Pickup address is required")
    @Size(max = 500)
    private String pickupAddress;
    
    @NotNull @Valid
    private LocationDto dropLocation;
    
    @NotNull
    private UUID vehicleCategoryId;
    
    @NotNull
    @Pattern(regexp = "IMMEDIATE|SCHEDULED")
    private String rideType;
    
    @DecimalMin(value = "0.0")
    @DecimalMax(value = "5000.0")
    private BigDecimal extraAmount;
    
    // Sanitize text inputs
    @JsonSetter("pickupAddress")
    public void setPickupAddress(String address) {
        this.pickupAddress = HtmlUtils.htmlEscape(address.trim());
    }
}
```

## 21.5 Secrets Management

| Secret | Storage | NOT Stored In |
|--------|---------|---------------|
| JWT signing key | Environment variable / Vault | application.yml, Git |
| Database password | Environment variable / Vault | application.yml, Git |
| Razorpay API keys | Environment variable / Vault | Frontend code, Git |
| FCM server key | Environment variable / Vault | Frontend code, Git |
| AWS credentials | IAM roles (in cloud) / Env vars | Code, Git |
| Admin passwords | BCrypt hashed in DB | Plaintext anywhere |
| OTP values | Redis (TTL: 5 min) | Long-term storage |

---

# SECTION 22 — FAILURE / RECOVERY STRATEGY

## 22.1 Complete Failure Scenario Table

| # | Scenario | System Behavior |
|---|----------|----------------|
| 1 | **Rider loses internet during booking** | Booking request may not reach server. Client retries with same idempotency key. If already created, returns existing ride. |
| 2 | **Rider loses internet during ride** | Ride continues (driver drives). On reconnect, app fetches current status via REST. WebSocket reconnects. |
| 3 | **Driver loses internet during matching** | Heartbeat timeout (2 min) → auto-offline. Current ride request expires → next driver. If driver had active ride: ride continues, driver reconnects and fetches status. |
| 4 | **Driver loses internet during trip** | Trip continues. GPS stops updating. Backend tracks last known position. On reconnect: driver resumes sending location. If extended (>5 min): alert admin, notify rider "driver connection lost". |
| 5 | **Server crashes** | Load balancer routes to surviving instances. If single-server (MVP): ride data persists in DB. On restart: stale rides cleaned up by job. Active WebSocket connections lost → clients reconnect. |
| 6 | **Database temporarily unavailable** | Service returns 503. Clients retry. Redis continues serving cached data. Critical writes fail → clients retry with idempotency keys. |
| 7 | **Payment gateway fails** | Ride status stays PAYMENT_PENDING. Rider sees "Payment failed, please retry". Allow 3 retries. If all fail: ride marked PAYMENT_FAILED, admin notified. |
| 8 | **Push notification fails** | Logged. Retried 3x with backoff. If all fail: recorded in dead-letter queue. Ride unaffected. WebSocket may still deliver the notification. |
| 9 | **Email fails** | Logged. Retried 3x. If all fail: dead-letter queue. Admin notified via alternate channel. Ride unaffected. |
| 10 | **Two drivers accept simultaneously** | SELECT FOR UPDATE prevents. Only one INSERT into ride_assignment succeeds (UNIQUE constraint). Losing driver receives "Ride already assigned" response. |
| 11 | **Rider cancels while driver accepts** | Race condition on ride status. The transaction that completes first wins. If cancel wins: driver sees "Ride was cancelled". If accept wins: cancellation processes normally (fee may apply). |
| 12 | **Driver cancels after acceptance** | Ride returns to SEARCHING_DRIVER. Matching restarts. Rider notified "Your driver cancelled, finding new driver". Driver receives cancellation penalty. |
| 13 | **Driver goes offline during matching** | Heartbeat timeout removes driver from pool. Their pending ride request expires. Matching moves to next driver. |
| 14 | **GPS stops working** | Driver app shows "GPS signal lost" warning. Backend continues with last known position. If GPS lost > 3 min during trip: flag ride for review. |
| 15 | **Phone restarted** | All services stop. On reboot: app may not auto-start. Driver must reopen app. Heartbeat timeout → auto-offline. Active ride data persists server-side; driver can resume. |
| 16 | **App force-closed** | Foreground service killed (Android). WebSocket disconnects. Heartbeat stops. Auto-offline after timeout. FCM still delivers notifications for any pending requests. |
| 17 | **Scheduled ride driver cancels** | Re-matching starts immediately. If close to pickup time: expand search radius aggressively. Rider notified with new ETA for driver assignment. |
| 18 | **Payment webhook arrives twice** | Idempotency: UNIQUE constraint on gateway_payment_id. Second processing attempt returns "already processed" and responds 200 to gateway. |
| 19 | **Same API request sent twice** | Idempotency key in request header. Second request returns cached response. No duplicate ride/payment/transaction created. |
| 20 | **User presses payment button multiple times** | Frontend disables button after first press. Backend checks idempotency key. Only one payment order created. |
| 21 | **Driver reaches wrong pickup location** | System compares driver location to pickup coordinates. If > 200m difference when marking "Arrived": show warning "You appear to be far from pickup". Allow override but flag for review. |
| 22 | **Razorpay webhook endpoint is down** | Razorpay retries webhooks exponentially (up to 24 hours). Our endpoint idempotency handles replayed webhooks. |
| 23 | **Redis crashes** | Geo queries fail. Fallback: query PostgreSQL for driver locations (slower). Sessions may be lost → users re-login. Matching degraded but functional. |
| 24 | **Ride stuck in intermediate state** | Stale Ride Cleanup Job runs every 10 min. Rides in SEARCHING_DRIVER > 10 min → NO_DRIVER_FOUND. Rides in DRIVER_ARRIVING > 30 min → flag for admin review. |

## 22.2 Data Recovery Guarantees

| Data Type | Durability |
|-----------|-----------|
| Ride records | PostgreSQL WAL + daily backups. Survives server crash. |
| Payment records | PostgreSQL + Razorpay has its own records. Reconcile daily. |
| Wallet transactions | PostgreSQL with UNIQUE idempotency keys. No phantom transactions. |
| Driver location | Redis (ephemeral). Lost on Redis crash. Rebuilt as drivers send updates. |
| Session tokens | Redis (ephemeral). Lost on crash → users re-login. No data loss. |
| File uploads | S3/GCS (99.999999999% durability). |

---

# SECTION 23 — API ARCHITECTURE

## 23.1 API Design Principles

| Principle | Implementation |
|-----------|---------------|
| **RESTful** | Resource-oriented URLs, proper HTTP methods |
| **Versioned** | `/api/v1/...` prefix |
| **Authenticated** | JWT Bearer token on all endpoints except auth |
| **Authorized** | Role-based + resource-level checks |
| **Validated** | Bean Validation on all request DTOs |
| **Paginated** | All list endpoints use `page`, `size`, `sort` params |
| **Consistent responses** | Standardized envelope: `{ success, data, error, timestamp }` |
| **Idempotent** | `X-Idempotency-Key` header on all write operations |
| **Rate limited** | Per-IP and per-user limits |

## 23.2 API Response Envelope

```json
// Success
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-08-08T12:30:00Z"
}

// Error
{
  "success": false,
  "error": {
    "code": "RIDE_NOT_FOUND",
    "message": "Ride with ID xyz not found",
    "details": null
  },
  "timestamp": "2026-08-08T12:30:00Z"
}

// Paginated
{
  "success": true,
  "data": {
    "content": [...],
    "page": 0,
    "size": 20,
    "totalElements": 156,
    "totalPages": 8
  },
  "timestamp": "2026-08-08T12:30:00Z"
}
```

## 23.3 Complete API Endpoint Summary

> [!NOTE]
> Full API specifications with request/response schemas are in [API Design](file:///C:/Users/arivu/.gemini/antigravity-ide/brain/cb9be255-2842-4494-af3e-2af43464dab8/api_design.md)

| Module | Key Endpoints | Count |
|--------|--------------|-------|
| **Auth** | POST /register, /login, /verify-otp, /refresh-token, /logout | 5 |
| **User** | GET/PUT /profile, POST /profile/photo, CRUD /saved-addresses | 6 |
| **Driver** | POST /register, /documents, /vehicle, PUT /online, /offline, POST /heartbeat | 8 |
| **Ride** | POST /rides, GET /rides/{id}, POST /{id}/cancel, GET /rides/history, GET /rides/upcoming | 7 |
| **Matching** | POST /rides/{id}/accept, /reject (driver-side) | 2 |
| **Tracking** | WebSocket: /ws → STOMP topics | 3 |
| **Pricing** | GET /fare-estimate, GET /vehicle-categories | 2 |
| **Payment** | POST /payments/create-order, POST /payments/verify, Webhook | 3 |
| **Wallet** | GET /wallet, GET /wallet/transactions, POST /wallet/payout | 3 |
| **Rating** | POST /ratings, GET /ratings | 2 |
| **Notification** | GET /notifications, PUT /notifications/{id}/read | 2 |
| **Support** | POST /tickets, GET /tickets, GET /tickets/{id} | 3 |
| **Admin** | ~25 endpoints for user/driver/ride/finance/pricing/support management | 25 |
| **Total** | | **~71** |

---

# SECTION 24 — FOLDER / PROJECT STRUCTURE

## 24.1 Complete Repository Structure

```
ridenow/
│
├── backend/                              # Spring Boot Backend
│   ├── src/main/java/com/ridenow/        # (see Section 6 for full structure)
│   ├── src/main/resources/
│   │   ├── application.yml
│   │   ├── application-dev.yml
│   │   ├── application-staging.yml
│   │   ├── application-prod.yml
│   │   ├── db/migration/                 # Flyway migrations
│   │   └── templates/                    # Email templates
│   ├── src/test/java/com/ridenow/
│   ├── Dockerfile
│   ├── pom.xml
│   └── README.md
│
├── rider-app/                            # Flutter Rider App
│   ├── lib/                              # (see Section 7 for full structure)
│   ├── android/
│   ├── ios/
│   ├── test/
│   ├── pubspec.yaml
│   └── README.md
│
├── driver-app/                           # Flutter Driver App
│   ├── lib/                              # (see Section 8 for full structure)
│   ├── android/
│   │   └── app/src/main/
│   │       ├── AndroidManifest.xml       # Foreground service permissions
│   │       └── kotlin/.../
│   │           └── ForegroundService.kt  # Platform channel
│   ├── ios/
│   │   └── Runner/
│   │       └── Info.plist                # Background modes
│   ├── test/
│   ├── pubspec.yaml
│   └── README.md
│
├── admin-panel/                          # Next.js Admin Dashboard
│   ├── src/                              # (see Section 9 for full structure)
│   ├── public/
│   ├── package.json
│   ├── next.config.js
│   ├── Dockerfile
│   └── README.md
│
├── shared/                               # Shared code/contracts
│   ├── api-contracts/                    # OpenAPI specs
│   │   └── openapi.yaml
│   ├── proto/                            # Protobuf (if needed later)
│   └── constants/                        # Shared enums/constants
│       ├── ride_status.json
│       └── error_codes.json
│
├── infrastructure/                       # DevOps & Deployment
│   ├── docker/
│   │   ├── docker-compose.yml            # Local development
│   │   ├── docker-compose.prod.yml
│   │   ├── Dockerfile.backend
│   │   └── Dockerfile.admin
│   ├── nginx/
│   │   └── nginx.conf                    # Reverse proxy config
│   ├── scripts/
│   │   ├── setup-dev.sh
│   │   ├── backup-db.sh
│   │   └── deploy.sh
│   └── k8s/                             # Kubernetes (Phase 3)
│       ├── backend-deployment.yaml
│       ├── admin-deployment.yaml
│       ├── postgres-statefulset.yaml
│       └── redis-deployment.yaml
│
├── docs/                                 # Documentation
│   ├── architecture/
│   │   ├── system-overview.md
│   │   ├── database-design.md
│   │   └── api-design.md
│   ├── guides/
│   │   ├── setup-guide.md
│   │   ├── deployment-guide.md
│   │   └── troubleshooting.md
│   ├── legal/
│   │   ├── privacy-policy.md
│   │   └── terms-of-service.md
│   └── runbooks/                         # Operational procedures
│       ├── incident-response.md
│       ├── database-restore.md
│       └── payment-reconciliation.md
│
├── .github/
│   └── workflows/
│       ├── backend-ci.yml
│       ├── rider-app-ci.yml
│       ├── driver-app-ci.yml
│       └── admin-ci.yml
│
├── .gitignore
├── README.md
└── LICENSE
```

---

# SECTION 25 — TESTING STRATEGY

## 25.1 Testing Pyramid

```
          ┌─────────┐
          │  E2E    │  ← Few, expensive, critical flows only
          │ Tests   │
         ┌┴─────────┴┐
         │ Integration│  ← API tests, DB tests, service tests
         │   Tests    │
        ┌┴────────────┴┐
        │  Unit Tests   │  ← Fast, many, isolated business logic
        │               │
        └───────────────┘
```

## 25.2 Critical Test Scenarios

### Race Condition Tests

```java
@Test
@Transactional
void testTwoDriversAcceptSameRide_OnlyOneSucceeds() {
    // Given: A ride in SEARCHING_DRIVER status
    Ride ride = createTestRide(RideStatus.SEARCHING_DRIVER);
    Driver driverA = createTestDriver("A");
    Driver driverB = createTestDriver("B");
    createRideRequest(ride, driverA);
    createRideRequest(ride, driverB);
    
    // When: Both drivers try to accept simultaneously
    ExecutorService executor = Executors.newFixedThreadPool(2);
    Future<RideAcceptanceResult> resultA = executor.submit(
        () -> rideAcceptanceService.acceptRide(ride.getId(), driverA.getId()));
    Future<RideAcceptanceResult> resultB = executor.submit(
        () -> rideAcceptanceService.acceptRide(ride.getId(), driverB.getId()));
    
    // Then: Exactly one succeeds, one fails
    RideAcceptanceResult a = resultA.get();
    RideAcceptanceResult b = resultB.get();
    
    int successCount = (a.isSuccess() ? 1 : 0) + (b.isSuccess() ? 1 : 0);
    assertEquals(1, successCount, "Exactly one driver should succeed");
    
    // Verify only one assignment exists
    List<RideAssignment> assignments = rideAssignmentRepository.findByRideId(ride.getId());
    assertEquals(1, assignments.size());
}

@Test
void testDuplicatePaymentWebhook_ProcessedOnce() {
    // Given: A completed ride with pending payment
    Ride ride = createCompletedRide();
    String webhookPayload = createWebhookPayload(ride.getPayment().getGatewayId());
    
    // When: Same webhook delivered twice
    paymentWebhookService.processWebhook(webhookPayload);
    paymentWebhookService.processWebhook(webhookPayload); // Duplicate
    
    // Then: Only one payment transaction created
    List<PaymentTransaction> txns = paymentTransactionRepository
        .findByPaymentId(ride.getPayment().getId());
    assertEquals(1, txns.size());
    
    // And: Driver wallet credited only once
    List<WalletTransaction> walletTxns = walletTransactionRepository
        .findByRideId(ride.getId());
    assertEquals(1, walletTxns.stream()
        .filter(t -> t.getType() == WalletTransactionType.RIDE_EARNING)
        .count());
}

@Test
void testRiderCancelsWhileDriverAccepts() {
    // Given: A ride being searched
    Ride ride = createTestRide(RideStatus.SEARCHING_DRIVER);
    Driver driver = createTestDriver("A");
    createRideRequest(ride, driver);
    
    // When: Rider cancels and driver accepts simultaneously
    ExecutorService executor = Executors.newFixedThreadPool(2);
    Future<CancellationResult> cancelResult = executor.submit(
        () -> cancellationService.cancelRide(ride.getId(), ride.getRiderId(), 
            UserRole.RIDER, "Changed mind"));
    Future<RideAcceptanceResult> acceptResult = executor.submit(
        () -> rideAcceptanceService.acceptRide(ride.getId(), driver.getId()));
    
    // Then: One operation succeeds, the other gracefully fails
    // Ride ends up in a consistent state (either cancelled or assigned, not both)
    Ride finalRide = rideRepository.findById(ride.getId()).get();
    assertTrue(
        finalRide.getStatus() == RideStatus.CANCELLED_BY_RIDER || 
        finalRide.getStatus() == RideStatus.DRIVER_ASSIGNED,
        "Ride must be in exactly one valid state"
    );
}
```

### Key Unit Tests

| Area | Test Count (Approx) | Focus |
|------|---------------------|-------|
| Fare Calculator | 25+ | Edge cases: minimum fare, long distance tiers, zero distance, max values |
| State Machine | 30+ | All valid transitions, all invalid transitions |
| Cancellation Rules | 15+ | Each stage, each role, fee calculations |
| Wallet Operations | 20+ | Credit, debit, concurrent access, negative balance prevention |
| Matching Algorithm | 15+ | Scoring, ranking, proximity, eligibility filters |

### Integration Tests

| Area | Focus |
|------|-------|
| API endpoints | Auth flow, ride creation, payment flow |
| Database | Migration testing, constraint validation, query performance |
| WebSocket | Connection, subscription, message delivery |
| External APIs | Mock Razorpay, mock FCM, mock Maps API |

### Load Tests (Phase 2+)

| Scenario | Target |
|----------|--------|
| Concurrent ride creation | 100 rides/second |
| Driver location updates | 1000 updates/second |
| Concurrent ride acceptance | 50 simultaneous acceptances |
| WebSocket connections | 5000 concurrent connections |

---

# SECTION 26 — DEPLOYMENT / DEVOPS ARCHITECTURE

## 26.1 Phase 1: MVP Deployment (Months 1-3)

```
┌──────────────────────────────────────────────┐
│          Single Server (DigitalOcean)          │
│          4 vCPU · 8 GB RAM · 80 GB SSD        │
│                                               │
│  ┌────────────────────────────────────────┐   │
│  │           Docker Compose                │   │
│  │                                         │   │
│  │  ┌─────────┐ ┌──────────┐ ┌─────────┐ │   │
│  │  │ Spring  │ │PostgreSQL│ │  Redis  │ │   │
│  │  │  Boot   │ │    16    │ │    7    │ │   │
│  │  │ :8080   │ │  :5432   │ │ :6379  │ │   │
│  │  └─────────┘ └──────────┘ └─────────┘ │   │
│  │                                         │   │
│  │  ┌─────────┐                           │   │
│  │  │  Nginx  │ (Reverse proxy + SSL)     │   │
│  │  │  :443   │                           │   │
│  │  └─────────┘                           │   │
│  └────────────────────────────────────────┘   │
│                                               │
│  Admin Panel: Vercel (free tier)               │
│  Mobile Apps: Play Store + App Store           │
│  Files: S3 / Cloudflare R2                     │
│  Email: SendGrid free tier (100/day)           │
│  SMS: MSG91 (pay-as-you-go)                    │
│  Domain + SSL: Let's Encrypt                   │
└──────────────────────────────────────────────┘

Estimated Monthly Cost: ~$50-80
```

## 26.2 Phase 2: Growing (Months 4-8)

```
┌──────────────────────────────────────────────────────┐
│                  AWS / GCP                            │
│                                                      │
│  ┌────────────┐                                      │
│  │   ALB      │ (Application Load Balancer)          │
│  │  + WAF     │                                      │
│  └──────┬─────┘                                      │
│         │                                            │
│  ┌──────▼──────┐  ┌──────────────┐                   │
│  │ Backend x2  │  │ Backend x2   │ (Auto-scaling)    │
│  │ (EC2/ECS)   │  │ (EC2/ECS)    │                   │
│  └──────┬──────┘  └──────┬───────┘                   │
│         │                │                            │
│  ┌──────▼────────────────▼───────┐                   │
│  │     RDS PostgreSQL            │ (Managed, backups) │
│  │     + Read Replica            │                   │
│  └───────────────────────────────┘                   │
│                                                      │
│  ┌─────────────┐  ┌─────────────┐                   │
│  │ ElastiCache │  │   S3        │                    │
│  │ (Redis)     │  │ (Files)     │                    │
│  └─────────────┘  └─────────────┘                    │
│                                                      │
│  Monitoring: CloudWatch + Sentry                      │
│  CI/CD: GitHub Actions → ECR → ECS                    │
└──────────────────────────────────────────────────────┘

Estimated Monthly Cost: ~$300-600
```

## 26.3 Phase 3: Production Scale (Months 9+)

```
Add:
• Kubernetes (EKS/GKE) for orchestration
• RabbitMQ for message queuing
• Elasticsearch for search/analytics
• CDN for static assets
• Multi-AZ deployment
• Automated backups + point-in-time recovery
• Blue-green deployments
• Auto-scaling based on ride volume

Estimated Monthly Cost: $1,000-3,000+
```

## 26.4 CI/CD Pipeline

```
Git Push → GitHub Actions
    │
    ├──► Lint + Static Analysis
    ├──► Unit Tests
    ├──► Integration Tests (with Testcontainers)
    ├──► Build Docker Image
    ├──► Push to Container Registry
    │
    ├──► [develop branch] → Deploy to Staging
    └──► [main branch] → Deploy to Production (manual approval)
```

## 26.5 Database Backup Strategy

| Type | Frequency | Retention | Storage |
|------|-----------|-----------|---------|
| Automated snapshot | Daily | 30 days | RDS automated |
| Point-in-time recovery | Continuous (WAL) | 7 days | RDS |
| Manual backup | Before major deployments | Indefinite | S3 |
| Export | Weekly | 90 days | S3 Glacier |

---

# SECTION 27 — MVP DEVELOPMENT ROADMAP

## 27.1 MVP Scope (What's IN)

| Feature | Included |
|---------|----------|
| Rider registration/login (OTP) | ✅ |
| Driver registration/login (OTP) | ✅ |
| Driver document upload | ✅ |
| Admin driver approval | ✅ |
| Immediate ride booking | ✅ |
| Short-distance rides | ✅ |
| 2 vehicle categories (Auto, Sedan) | ✅ |
| Fare estimation | ✅ |
| Driver matching (basic) | ✅ |
| Real-time tracking | ✅ |
| OTP ride verification | ✅ |
| Online payment (Razorpay) | ✅ |
| Cash payment | ✅ |
| Basic admin dashboard | ✅ |
| Driver earnings view | ✅ |
| Push notifications | ✅ |
| Cancellation (basic) | ✅ |
| Rating (5-star, no review text) | ✅ |
| Ride history | ✅ |
| Race-condition prevention | ✅ |

## 27.2 MVP Exclusions (Phase 2+)

| Feature | When |
|---------|------|
| Scheduled rides | Phase 2 |
| Long-distance rides | Phase 2 |
| Chat (rider ↔ driver) | Phase 2 |
| Surge pricing | Phase 2 |
| Promo codes | Phase 2 |
| Driver wallet + payouts | Phase 2 (MVP: manual settlement) |
| Support tickets | Phase 2 |
| Advanced analytics | Phase 2 |
| SOS / Safety features | Phase 2 |
| Trip sharing | Phase 3 |
| Route deviation detection | Phase 3 |
| Multi-city | Phase 3 |

## 27.3 MVP Development Phases (16 Weeks)

### Phase 1 — Foundation (Weeks 1-2)

| Item | Details |
|------|---------|
| **Goal** | Project setup, database, infrastructure |
| **Database** | PostgreSQL setup, Flyway migrations for core tables (user, driver, vehicle, vehicle_category, ride, payment) |
| **Backend** | Spring Boot project scaffold, security config, JWT, global error handling, common utilities |
| **DevOps** | Docker Compose (local), CI pipeline (build + test) |
| **Completion** | Server runs, DB migrates, JWT auth works |

### Phase 2 — Authentication (Weeks 2-3)

| Item | Details |
|------|---------|
| **Goal** | Complete auth flow for all roles |
| **Backend** | Registration, OTP (SMS), login, token refresh, logout, role-based access |
| **Rider App** | Splash, onboarding, register, OTP verify, login screens |
| **Driver App** | Same auth flow |
| **Admin** | Email + password login |
| **Testing** | Auth unit tests, API tests |
| **Completion** | All three apps can register and login |

### Phase 3 — User & Driver Profiles (Weeks 3-4)

| Item | Details |
|------|---------|
| **Goal** | Profile management, driver onboarding |
| **Backend** | User CRUD, driver CRUD, document upload (S3), vehicle management |
| **Rider App** | Profile screen, saved addresses |
| **Driver App** | Profile, document upload flow (licence, vehicle, photos), pending approval screen |
| **Admin** | Driver list, document viewer, approve/reject buttons |
| **Testing** | Profile tests, file upload tests |
| **Completion** | Driver can register, upload docs, admin can approve |

### Phase 4 — Maps & Location (Weeks 4-5)

| Item | Details |
|------|---------|
| **Goal** | Maps integration, location services |
| **Backend** | Google Maps API integration (Directions, Distance Matrix, Geocoding), Redis GEO setup |
| **Rider App** | Map screen, place search, pickup/drop selection, route display |
| **Driver App** | Location service, foreground service (Android), background location (iOS) |
| **Testing** | Location service tests, Maps API mock tests |
| **Completion** | Rider sees map, selects locations. Driver sends location updates. |

### Phase 5 — Fare & Pricing Engine (Weeks 5-6)

| Item | Details |
|------|---------|
| **Goal** | Fare calculation, vehicle categories |
| **Backend** | FareCalculator service, fare rules CRUD, vehicle category CRUD |
| **Rider App** | Vehicle category selection, fare estimate display, fare breakdown |
| **Admin** | Fare rule management, commission settings |
| **Testing** | 25+ fare calculation unit tests |
| **Completion** | Rider sees accurate fare estimate before booking |

### Phase 6 — Ride Creation & State Machine (Weeks 6-7)

| Item | Details |
|------|---------|
| **Goal** | Ride booking, status management |
| **Backend** | Ride CRUD, state machine, status transitions, ride history, idempotency |
| **Rider App** | Booking confirmation, searching animation, ride status screen |
| **Testing** | State machine tests (all transitions) |
| **Completion** | Rider can create a ride, ride progresses through states |

### Phase 7 — Driver Matching (Weeks 7-8)

| Item | Details |
|------|---------|
| **Goal** | Match riders with drivers |
| **Backend** | MatchingService, NearbyDriverFinder (Redis GEO), DriverRanker, RequestDispatcher, ride_request table, ride_assignment table |
| **Rider App** | Searching driver UI, no-driver-found UI, increase fare option |
| **Driver App** | Online/offline toggle, incoming ride request dialog |
| **Testing** | Matching algorithm tests, race-condition tests (critical) |
| **Completion** | Rider requests ride → nearest driver receives request |

### Phase 8 — Real-Time Tracking (Weeks 8-9)

| Item | Details |
|------|---------|
| **Goal** | Live ride tracking |
| **Backend** | WebSocket config, STOMP topics, location broadcast, ride status broadcast |
| **Rider App** | WebSocket client, live driver marker on map, ride status updates |
| **Driver App** | WebSocket client, continuous location sending, navigation to pickup |
| **Testing** | WebSocket connection tests, message delivery tests |
| **Completion** | Rider sees driver moving on map in real-time |

### Phase 9 — Trip Flow (Weeks 9-10)

| Item | Details |
|------|---------|
| **Goal** | Complete trip lifecycle |
| **Backend** | Arrive, OTP verify, start trip, complete trip, final fare calculation |
| **Rider App** | Driver arriving → arrived (show OTP) → trip started → trip complete |
| **Driver App** | Navigate → arrive button → OTP input → start trip → complete trip → earnings summary |
| **Testing** | Full trip flow integration test |
| **Completion** | Complete ride from booking to completion |

### Phase 10 — Payment (Weeks 10-12)

| Item | Details |
|------|---------|
| **Goal** | Payment processing |
| **Backend** | Razorpay integration, order creation, webhook handling, payment verification, cash payment flow, ride_financial record |
| **Rider App** | Payment method selection, Razorpay checkout, payment success/failure screens |
| **Driver App** | "Cash received" button, trip earnings display |
| **Admin** | Payment list, payment details |
| **Testing** | Payment flow tests, webhook idempotency tests, concurrent payment tests |
| **Completion** | Rider can pay online or cash. Platform commission calculated. |

### Phase 11 — Notifications (Weeks 12-13)

| Item | Details |
|------|---------|
| **Goal** | Push notifications |
| **Backend** | FCM integration, notification service, email service (admin ride email) |
| **Rider App** | FCM setup, notification handling |
| **Driver App** | FCM setup, high-priority ride request notifications, background notification handling |
| **Admin** | Ride completion email |
| **Testing** | Notification delivery tests |
| **Completion** | All parties receive timely notifications |

### Phase 12 — Cancellation & Rating (Weeks 13-14)

| Item | Details |
|------|---------|
| **Goal** | Cancellation flow, rating system |
| **Backend** | CancellationService, cancellation rules, RatingService, basic refund |
| **Rider App** | Cancel button, cancellation reason, 5-star rating |
| **Driver App** | Cancel button, rider rating |
| **Testing** | Cancellation rule tests, refund tests |
| **Completion** | Users can cancel rides and rate each other |

### Phase 13 — Admin Dashboard (Weeks 14-15)

| Item | Details |
|------|---------|
| **Goal** | Admin panel MVP |
| **Backend** | Admin APIs (users, drivers, rides, finance, settings) |
| **Admin Panel** | Dashboard with metrics, user list, driver list, ride list, payment list, pricing config, basic audit log |
| **Testing** | Admin API tests |
| **Completion** | Admin can manage the platform |

### Phase 14 — Testing & Polish (Weeks 15-16)

| Item | Details |
|------|---------|
| **Goal** | QA, bug fixes, optimization |
| **All** | End-to-end testing, edge case handling, UI polish, performance optimization |
| **Security** | Penetration testing (basic), input validation review |
| **DevOps** | Staging deployment, load testing (basic) |
| **Documentation** | Setup guide, API docs |
| **Completion** | MVP ready for beta launch |

---

# SECTION 28 — PRODUCTION ROADMAP

## Phase 2 Features (Months 5-7)

| Feature | Effort |
|---------|--------|
| Scheduled rides | 3 weeks |
| Long-distance rides | 2 weeks |
| Driver wallet + payouts | 2 weeks |
| Chat (rider ↔ driver) | 1 week |
| Support tickets | 1 week |
| Promo codes / discounts | 1 week |
| Surge pricing | 1 week |
| Advanced cancellation rules | 1 week |
| SOS button + emergency contact | 1 week |

## Phase 3 Features (Months 8-12)

| Feature | Effort |
|---------|--------|
| Trip sharing (share ride link) | 2 weeks |
| Route deviation detection | 2 weeks |
| Driver incentives/bonuses | 1 week |
| Multi-city support | 2 weeks |
| Advanced analytics dashboard | 2 weeks |
| Elasticsearch integration | 1 week |
| Kubernetes migration | 3 weeks |
| Ride PIN for safety | 1 week |
| Review text (in addition to rating) | 1 week |
| Driver heat map | 1 week |
| Rider favorites (favorite drivers) | 1 week |

## Phase 4 Features (Year 2)

- Carpooling / ride sharing
- Package delivery
- Rental rides (hourly)
- Multi-language support
- Accessibility features
- Driver training/onboarding videos
- Referral program
- Corporate accounts
- API for third-party integrations

---

# SECTION 29 — COMPLETE END-TO-END RIDE FLOWS

## Flow 1: Happy Path — Immediate Ride

```
1.  Rider opens app → Home screen with map
2.  Rider taps search → Types/selects destination
3.  App shows route on map + estimated distance (8.5 km) + ETA (25 min)
4.  Rider selects "Ride Now" (immediate)
5.  Rider selects vehicle: Sedan
6.  Backend calculates fare estimate: ₹200
7.  Rider sees fare breakdown → Taps "Confirm Booking"
8.  Frontend sends: POST /api/v1/rides (with idempotency key)
9.  Backend creates ride (status: REQUESTED)
10. Backend generates OTP (e.g., 4827)
11. Backend transitions to SEARCHING_DRIVER
12. Backend queries Redis GEORADIUS for nearby online Sedan drivers
13. Found: Driver K (1.2 km away, rating 4.8)
14. Backend creates ride_request for Driver K
15. Backend sends WebSocket message to Driver K: new ride request
16. Backend sends FCM push to Driver K (in case app is backgrounded)
17. Driver K sees: Pickup: T. Nagar | Drop: Adyar | ₹160 earnings | 30s countdown
18. Driver K taps ACCEPT (within 30s)
19. Backend: SELECT FOR UPDATE on ride row
20. Backend validates: status is still SEARCHING_DRIVER
21. Backend creates ride_assignment (UNIQUE on ride_id)
22. Backend updates ride: status → DRIVER_ASSIGNED, driver_id = K
23. Backend records status history
24. Backend marks Driver K as assigned (not available for other rides)
25. Rider receives: "Driver K is on the way!" (WebSocket + push)
26. Rider sees: Driver name, vehicle (TN-07-AB-1234, Maruti Dzire), photo, rating
27. Backend transitions: DRIVER_ASSIGNED → DRIVER_ARRIVING
28. Driver K navigates to pickup (Google Maps launched for directions)
29. Driver K's location updates flow: App → WebSocket → Redis + DB → WebSocket → Rider App
30. Rider sees driver marker moving on map
31. Driver K arrives at pickup → taps "I've Arrived"
32. Backend validates driver is within 200m of pickup GPS
33. Backend transitions: DRIVER_ARRIVING → DRIVER_ARRIVED
34. Rider receives notification: "Your driver has arrived!"
35. Rider sees OTP: 4827 (must tell driver verbally)
36. Driver K enters OTP in app: 4827
37. Backend verifies OTP matches
38. Backend transitions: DRIVER_ARRIVED → TRIP_STARTED
39. Trip timer and distance tracking begin
40. Location updates stored in ride_location (every 30s)
41. Rider sees live trip progress on map
42. Driver reaches destination → taps "Complete Trip"
43. Backend calculates actual distance (8.7 km) and duration (28 min)
44. Backend runs fare calculator with actual values
45. Final fare: ₹205 (slightly higher due to actual distance)
46. Backend transitions: TRIP_STARTED → TRIP_COMPLETED → PAYMENT_PENDING
47. Rider sees: "Trip Complete! Fare: ₹205" + fare breakdown
48. Rider selects payment method: UPI
49. Backend creates Razorpay order (₹205)
50. Rider completes UPI payment in Razorpay SDK
51. Razorpay sends webhook to backend
52. Backend verifies webhook signature
53. Backend checks idempotency (first time = process)
54. Backend transitions: PAYMENT_PENDING → PAYMENT_COMPLETED
55. Backend creates ride_financial: total=₹205, commission(20%)=₹41, driver=₹164
56. Backend credits Driver K's wallet: +₹164
57. Backend creates wallet_transaction (idempotency key: ride-{id}-earn)
58. Backend generates invoice
59. Backend queues admin email (async)
60. Backend transitions: PAYMENT_COMPLETED → SETTLED
61. Rider sees: "Payment Successful!" + Receipt
62. Rider prompted to rate: selects ⭐⭐⭐⭐⭐ → Submit
63. Backend stores rating (prevents duplicate via UNIQUE ride_id + rater_id)
64. Driver K sees: "Trip Complete! You earned ₹164" + rate rider prompt
65. Driver K rates rider ⭐⭐⭐⭐⭐
66. Admin receives email with full ride details
67. RIDE COMPLETE ✅
```

## Flow 2: Driver Rejects → Next Driver

```
Steps 1-16 (same as Flow 1)
17. Driver K sees ride request → taps REJECT
18. Backend marks ride_request for K as REJECTED
19. Backend finds next driver: Driver M (2.1 km, rating 4.6)
20. Backend sends request to Driver M
21. Driver M ACCEPTS → (continue from step 19 of Flow 1, with Driver M)
```

## Flow 3: Driver Timeout → Next Driver

```
Steps 1-16 (same as Flow 1)
17. Driver K does not respond for 30 seconds
18. Backend marks ride_request for K as EXPIRED
19. Backend finds next driver (expanded radius if needed)
20. Continue matching...
```

## Flow 4: No Driver Accepts

```
Steps 1-15 (same as Flow 1)
16-30. All drivers in radius reject or timeout
31. Backend transitions: SEARCHING_DRIVER → NO_DRIVER_FOUND
32. Rider sees: "No drivers available at ₹200"
33. Options presented:
    a) "Try Again at ₹200" → restart matching
    b) "Increase fare: ₹250 / ₹300 / Custom" → rider selects ₹250
34. Rider adds ₹50 extra → Backend stores extra_amount = 50
35. Backend recalculates: estimated_fare = ₹250
36. Backend transitions: NO_DRIVER_FOUND → SEARCHING_DRIVER
37. New matching round with ₹250 fare displayed to drivers
38. Driver sees higher earnings → more likely to accept
39. (Continue normal flow)
```

## Flow 5: Rider Cancels Before Driver Assigned

```
Steps 1-12 (ride created, searching)
13. Rider taps "Cancel Ride"
14. Backend checks status: SEARCHING_DRIVER
15. Cancellation fee: ₹0 (no driver assigned yet)
16. Backend transitions: SEARCHING_DRIVER → CANCELLED_BY_RIDER
17. All pending ride_requests marked CANCELLED
18. Ride marked cancelled
19. Rider sees: "Ride cancelled. No fee charged."
```

## Flow 6: Rider Cancels After Driver Assigned

```
Steps 1-22 (driver assigned, en route)
23. Rider taps "Cancel Ride"
24. Backend checks: DRIVER_ARRIVING, driver assigned 4 minutes ago
25. Cancellation rule: after 2 min of assignment → ₹25 fee
26. Backend transitions: DRIVER_ARRIVING → CANCELLED_BY_RIDER
27. Creates cancellation record (fee: ₹25)
28. If pre-paid: refund ₹175 (₹200 - ₹25)
29. Driver K freed up, notified: "Rider cancelled"
30. Driver K gets cancellation inconvenience credit (if configured)
31. Rider sees: "Ride cancelled. Cancellation fee: ₹25"
```

## Flow 7: Driver Cancels After Acceptance

```
Steps 1-22 (driver assigned)
23. Driver K taps "Cancel Ride" (reason: "Cannot reach pickup")
24. Backend transitions: DRIVER_ARRIVING → CANCELLED_BY_DRIVER
25. Driver K receives cancellation penalty (affects acceptance rate, possible cooldown)
26. Rider refunded 100%
27. Backend transitions back to SEARCHING_DRIVER (automatic re-match)
28. Rider notified: "Your driver cancelled. Finding a new driver..."
29. Matching restarts from Step 12
```

## Flow 8: Payment Fails

```
Steps 1-46 (trip completed, payment pending)
47. Rider selects UPI → payment fails (insufficient balance)
48. Backend receives failure webhook (or timeout)
49. Ride stays in PAYMENT_PENDING
50. Rider sees: "Payment failed. Please try again."
51. Rider retries with different method (card)
52. Payment succeeds → continue from step 51 of Flow 1
53. If 3 consecutive failures:
    Ride marked PAYMENT_FAILED
    Admin notified
    Driver still sees earnings (driver will be paid regardless)
    Rider's account flagged for follow-up
```

## Flow 9: Scheduled Ride

```
1.  Aug 8: Rider opens app → selects "Schedule Ride"
2.  Selects: Aug 15, 8:00 AM
3.  Selects pickup & drop
4.  Fare estimate shown (includes scheduling fee)
5.  Rider confirms → POST /api/v1/rides (ride_type: SCHEDULED)
6.  Backend creates ride + scheduled_ride record
7.  Rider sees: "Ride scheduled for Aug 15, 8:00 AM ✅"
8.  Ride appears in "Upcoming Rides"
9.  
10. Aug 14, 8 PM: Reminder push: "Your ride is tomorrow at 8 AM"
11. Aug 15, 7:15 AM: ScheduledRideJob triggers
12. Backend starts matching (expanded radius, longer timeout)
13. Driver M accepts scheduled ride
14. Rider notified: "Driver M assigned for your 8 AM ride"
15. Aug 15, 7:45 AM: Reminder to Driver M: "Pickup in 15 min"
16. Aug 15, 8:00 AM: Driver M navigates to pickup
17. (Continue normal trip flow)
```

## Flow 10: Driver Loses Connection During Trip

```
Steps 1-39 (trip started, in progress)
40. Driver's phone loses internet (enters tunnel / dead zone)
41. Location updates stop flowing
42. Backend detects: no location update for 60 seconds
43. Rider sees: driver marker stops moving, toast: "Driver connection weak"
44. After 3 minutes: Rider notified "Driver's connection lost. Trip is still in progress."
45. Trip continues (driver is still driving)
46. Driver's phone reconnects
47. App re-establishes WebSocket connection
48. App sends queued location updates
49. Location tracking resumes
50. If driver never reconnects (> 15 min):
    Admin alerted
    Ride flagged for manual review
    Rider can contact support
```

## Flow 11: Duplicate Acceptance (Race Condition)

```
Steps 1-15 (ride request sent to Driver K)
16. Due to edge case: both Driver K and Driver L receive the request
    (perhaps Driver L was queued just before K's timeout)
17. Driver K taps ACCEPT at T=29.9s
18. Driver L taps ACCEPT at T=30.1s
19. K's request: Backend acquires FOR UPDATE lock on ride
20. K's request: Validates status = SEARCHING_DRIVER ✅
21. K's request: INSERT INTO ride_assignment → succeeds (UNIQUE)
22. K's request: Status → DRIVER_ASSIGNED
23. K's request: Transaction commits, lock released
24. L's request: Backend acquires FOR UPDATE lock on ride
25. L's request: Validates status = DRIVER_ASSIGNED ❌ (not SEARCHING_DRIVER)
26. L's request: Returns "Ride already assigned"
27. Driver L sees: "Sorry, this ride was assigned to another driver"
28. RESULT: Only Driver K is assigned. No conflict. ✅
```

## Flow 12: Duplicate Payment Webhook

```
Steps 1-50 (rider completes payment)
51. Razorpay sends webhook #1 → Backend receives
52. Backend checks: UNIQUE(gateway_payment_id) → not found → process
53. Payment marked COMPLETED
54. Wallet credited
55. Financial record created
56. Ride settled
57. Razorpay sends webhook #2 (retry, network issue caused #1 to appear as failed)
58. Backend checks: UNIQUE(gateway_payment_id) → FOUND → already processed
59. Return HTTP 200 to Razorpay (stops further retries)
60. No duplicate wallet credit. No duplicate financial record.
61. RESULT: Exactly-once processing. ✅
```

---

# SECTION 30 — POTENTIAL PROBLEMS / CONFLICTS

## 30.1 Technical Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Google Maps API costs | HIGH | Implement caching for frequent routes. Set daily quota limits. Monitor usage. Consider OSRM for distance calc backup. |
| SMS OTP cost | MEDIUM | Rate limit OTP requests. Consider WhatsApp OTP (cheaper). Implement OTP cooldown (60s between requests). |
| FCM delivery unreliability (China, custom ROMs) | MEDIUM | WebSocket as primary when app is open. Implement in-app polling fallback. Consider HMS for Huawei devices. |
| WebSocket scaling (> 10K connections) | LOW (Phase 1) | Use Redis pub/sub to broadcast across multiple server instances. Sticky sessions for Phase 2. |
| Database connection exhaustion | MEDIUM | Connection pooling (HikariCP, max 20 connections). Timeout stale connections. |
| Large file uploads (driver docs) | LOW | Pre-signed S3 URLs (upload directly to S3, not through backend). Size limits (10 MB). |

## 30.2 Business Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Not enough drivers at launch | Rides fail → riders leave | Launch in one city/area. Onboard drivers BEFORE riders. Offer driver incentives. |
| Driver fraud (fake GPS) | Wrong locations, distance manipulation | GPS spoofing detection. Cross-reference cell tower data. Flag anomalous speeds. |
| Payment disputes | Financial loss | Immutable financial records. Detailed ride history. Admin dispute resolution tools. |
| Peak-time driver shortage | User frustration | Surge pricing (incentivizes more drivers online). Fare boost feature. |
| Competitor poaching | Drivers leave for better commission | Loyalty rewards. Gradual commission reduction for high-performers. |

## 30.3 Legal Risks (See Section 43 in User's Requirements)

| Area | Status | Action |
|------|--------|--------|
| Commercial transport licence | ❗ Required | Verify local regulations BEFORE launch. Drivers may need commercial licence plates. |
| Insurance | ❗ Required | Verify if ride-sharing insurance is needed. Liability coverage. |
| GST registration | ❗ Required | Platform must be GST-registered. Invoice must include GSTIN. |
| Data privacy (DPDP Act 2023, India) | ❗ Required | Privacy policy, data retention policy, user consent, right to deletion. |
| RBI payment guidelines | ❗ Required | Use authorized payment aggregator (Razorpay is RBI-authorized). |
| Motor Vehicles Act | ❗ Required | Driver eligibility, vehicle fitness certificate, pollution certificate. |
| Employee vs Contractor | ❗ Required | Drivers are independent contractors. Terms must reflect this. |

> [!CAUTION]
> **This plan covers the technical architecture. Legal compliance requires consultation with a legal professional specializing in transport/fintech regulations in your target geography.**

---

# SECTION 31 — MISSED EDGE CASES AND RECOMMENDATIONS

## As a senior architect reviewing this plan, here are additional edge cases and scenarios that could fail in a real production system:

---

### 🔴 CRITICAL EDGE CASES

#### 1. **GPS Accuracy Issues in Urban Canyons**
**Problem**: In areas with tall buildings, GPS can be off by 50-200 meters. Driver may appear at pickup when they're actually on the next street.  
**Solution**: 
- Use Wi-Fi + cell tower + GPS fusion for location (handled by mobile OS, but app should request high-accuracy mode)
- When driver marks "Arrived", show rider the driver's actual position and let rider confirm
- Add "I can see the driver" confirmation from rider
- Allow +/- 200m tolerance for "arrived" validation

#### 2. **Mid-Trip Destination Change**
**Problem**: Rider asks driver to change destination during the trip. Current system doesn't support this.  
**Solution (Phase 2)**:
- Allow rider to "Edit Destination" during TRIP_STARTED
- Backend recalculates fare estimate with new destination
- Show rider the new estimate before confirming
- Store original and updated destination for audit
- Do NOT allow unlimited changes (max 2 per trip)

#### 3. **Multiple Stops**
**Problem**: Rider wants to stop at an ATM or pick up a friend before final destination.  
**Solution (Phase 3)**:
- Add multi-waypoint support: pickup → stop 1 → stop 2 → destination
- Additional charge per stop (configurable)
- Driver can add stops during trip
- Waiting time at each stop metered

#### 4. **Driver Phone Number Privacy**
**Problem**: When rider calls driver (or vice versa), phone numbers are exposed permanently.  
**Solution**:
- Use **virtual number masking** (e.g., Exotel, Knowlarity)
- Rider calls platform number → routed to driver (and vice versa)
- Numbers not visible to either party
- Virtual number released after trip ends
- **MVP**: Accept direct calling with masked last 4 digits display. Phase 2: Virtual numbers.

#### 5. **Toll Calculation**
**Problem**: Long-distance routes pass through toll plazas. Who pays? How is it added to fare?  
**Solution**:
- Tolls are estimated using Google Maps Toll API (or maintained in DB for known routes)
- Toll amount shown to rider in fare estimate
- Driver can add actual toll (with photo receipt) during trip
- If actual > estimate by >20%: admin review triggered
- Toll is pass-through (not subject to commission)

#### 6. **Return Trip for Long-Distance**
**Problem**: Driver drives Chennai → Pondicherry (150 km). Must drive back empty (150 km deadhead).  
**Solution**:
- Long-distance fare includes **return charge** component (configurable percentage, e.g., 50% of one-way)
- OR: System can offer return ride matching (if another rider going back)
- Clearly shown in fare breakdown: "Includes ₹X return allowance"
- Driver can opt to wait at destination for return rides

#### 7. **Driver Battery/Data Reimbursement**
**Problem**: GPS tracking drains battery and uses mobile data. Drivers complain.  
**Solution**: 
- Optimize location update frequency: 15s when idle, 10s during trip, 5s near pickup
- Battery saver mode: reduce update frequency when battery < 20%
- Consider small per-trip data/battery allowance in driver earnings

#### 8. **Stale Fare Estimate**
**Problem**: Rider gets fare estimate at 5 PM (₹200). Traffic changes. Rider books at 5:30 PM. Actual fare differs significantly.  
**Solution**:
- Fare estimates expire after **10 minutes**
- If rider books after expiry, recalculate before confirming
- Show rider: "Fare may have changed. Updated estimate: ₹215. Continue?"
- Final fare always based on actual trip metrics (distance + time)

#### 9. **Peak Hour Pricing (Surge) Transparency**
**Problem**: Surge pricing without transparency leads to user complaints and potential legal issues.  
**Solution**:
- Always show: "Fares are currently X.Xz higher due to high demand"
- Show both: normal fare AND surged fare
- Cap surge multiplier (e.g., max 3x)
- Rider must explicitly acknowledge surge before booking
- Store surge_multiplier in ride record for audit

#### 10. **Driver Identity Swap**
**Problem**: Approved driver lends account to unapproved person. Someone else drives.  
**Solution (Phase 2-3)**:
- Random selfie verification during online status (randomly, 1 in every 10 online toggles)
- Face comparison with registration photo (ML service)
- If mismatch: auto-offline + admin alert
- Rider can report "Driver doesn't match photo"

---

### 🟡 IMPORTANT EDGE CASES

#### 11. **Time Zone Handling**
**Problem**: Scheduled rides booked across time zones (less relevant in India, critical for future expansion).  
**Solution**: Store ALL timestamps in UTC. Convert to local time zone only in the presentation layer. Store rider's timezone in user profile.

#### 12. **Currency & Locale**
**Problem**: System assumes INR. Future expansion to other countries breaks everything.  
**Solution**: 
- Store currency code with every monetary amount
- Use `BigDecimal` (never `float`/`double`) for all money
- Centralize currency formatting
- Phase 1: INR only. Phase 4: multi-currency support

#### 13. **Concurrent Ride Prevention**
**Problem**: Rider tries to book a second ride while one is already active.  
**Solution**: Before creating a ride, check: `SELECT COUNT(*) FROM ride WHERE rider_id = ? AND status IN ('REQUESTED', 'SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'TRIP_STARTED') > 0`. If true: reject with "You already have an active ride."

#### 14. **Driver Concurrent Ride Prevention**
**Problem**: Driver accepts Ride A, then somehow receives and accepts Ride B.  
**Solution**: 
- `driver_availability.current_ride_id` is set when ride accepted
- Matching service checks `current_ride_id IS NULL`
- `ride_assignment` has UNIQUE on `driver_id` with composite unique on `driver_id WHERE active = true`
- Double-check in acceptance: if driver already assigned, reject

#### 15. **App Version Compatibility**
**Problem**: Old app version sends incompatible API requests after backend update.  
**Solution**:
- API versioning: `/api/v1/`, `/api/v2/`
- Force-update mechanism: minimum app version check on login
- App sends version in header: `X-App-Version: 1.2.0`
- Backend can respond with `426 Upgrade Required` if version too old

#### 16. **Ride in Progress but Rider Reports Emergency**
**Problem**: Rider feels unsafe during trip.  
**Solution (Phase 2)**:
- SOS button visible during trip (prominent, always accessible)
- Tapping SOS:
  1. Shares live location with emergency contacts
  2. Optionally dials emergency services (112 in India)
  3. Alerts admin dashboard with priority
  4. Records audio (with consent) for evidence
  5. Silently starts recording ride details with higher GPS frequency

#### 17. **Network Change During Payment**
**Problem**: Rider initiates payment, switches from WiFi to mobile data. Connection drops mid-payment.  
**Solution**:
- Razorpay handles this (their SDK retries)
- Backend relies ONLY on webhook for payment confirmation
- If webhook doesn't arrive within 5 minutes, backend polls Razorpay API to check status
- Payment status polling job: check PAYMENT_PENDING rides older than 5 minutes

#### 18. **Map API Failure**
**Problem**: Google Maps API is down or returns errors. System can't calculate routes.  
**Solution**:
- Graceful degradation: show error "Unable to calculate route. Please try again."
- Cache frequently requested routes (within TTL)
- Fallback: allow manual address entry with straight-line distance estimate
- Alert admin if Maps API error rate > 5%

#### 19. **Clock Skew Between Client and Server**
**Problem**: Driver's phone clock is wrong. Countdown timer shows incorrect time. Request appears expired on client but not server.  
**Solution**:
- Always use server timestamps for expiration logic
- Send `expires_at` (absolute time) AND `duration_seconds` (relative) in ride request
- Client uses `duration_seconds` for countdown display
- Acceptance/rejection validated against server clock only

#### 20. **Extremely Short Rides**
**Problem**: Rider books a ride for 200 meters. Driver arrives, trip takes 2 minutes. Fare is ₹15. Not worth the driver's time.  
**Solution**:
- Enforce minimum fare (e.g., ₹50 for Auto, ₹80 for Sedan)
- Show rider the minimum fare upfront: "Minimum fare applies: ₹50"
- Driver still earns minimum fare share

#### 21. **Extremely Long Trips**
**Problem**: Chennai → Bangalore (350 km, 6+ hours). Single fare. Driver fatigue.  
**Solution**:
- For trips > 4 hours: show warning to rider about estimated duration
- For trips > 6 hours: recommend scheduled ride
- Driver must acknowledge long trip before accepting
- Include rest stop recommendations in driver navigation
- Consider per-day cap on driving hours (12 hours) — auto-offline after

#### 22. **Ride During Natural Disaster / Emergency**
**Problem**: Flooding, cyclone. Roads blocked. Rides shouldn't be offered on dangerous routes.  
**Solution (Phase 3)**:
- Admin can set "restricted zones" (geo-fence)
- Rides with pickup or drop in restricted zone are blocked
- Show message: "Service unavailable in this area due to [reason]"
- Emergency rides to hospitals: allow with explicit warning

#### 23. **Driver Manipulates Route**
**Problem**: Driver takes a longer route to increase fare.  
**Solution**:
- Compare actual route (GPS breadcrumbs) with Google Maps optimal route
- If actual distance > optimal + 20%: flag ride for review
- Notify rider: "Your trip was longer than expected. Tap here to report."
- Admin reviews flagged rides
- Repeat offenders: warning → suspension

#### 24. **Promo Code Abuse**
**Problem**: Users create multiple accounts to abuse promo codes.  
**Solution (Phase 2)**:
- One promo per phone number (not per account)
- One promo per device ID
- Limit promo uses per user per timeframe
- Detect duplicate devices/IPs
- Promo budget limits (auto-disable when exhausted)

#### 25. **Accessibility**
**Problem**: Visually impaired users, hearing impaired users, wheelchair users.  
**Solution (Phase 3)**:
- Rider app: VoiceOver/TalkBack compatible
- Vehicle category: "Wheelchair Accessible" option
- Driver app: visual (not just sound) alerts for hearing-impaired drivers
- Font size settings
- High contrast mode

---

### 🟢 OPERATIONAL EDGE CASES

#### 26. **Daylight Saving Time / Holiday Pricing**
India doesn't observe DST, but for future expansion:
- All times stored in UTC
- Holiday pricing: admin configurable fare modifiers by date

#### 27. **Database Migration in Production**
- Zero-downtime migrations using Flyway
- Only additive changes (add columns, create tables)
- Never rename/drop columns in production without deprecation period
- Use feature flags for schema-dependent changes

#### 28. **Session Hijacking on Shared Devices**
- Driver logs in on shared phone → another person uses the account
- Solution: show "Active Sessions" in app. Allow remote logout. New device login invalidates old device token.

#### 29. **International Phone Numbers**
- Store phone numbers in E.164 format (+919876543210)
- Validate format before storing
- OTP providers must support the target country

#### 30. **Orphaned Scheduled Rides**
- Rider creates scheduled ride → deletes account before ride date
- Solution: account deletion process cancels all upcoming rides and refunds

#### 31. **Driver Registration Spam**
- Bots submitting fake driver registrations
- Solution: CAPTCHA on registration, phone OTP verification, document verification by admin

#### 32. **Concurrent Admin Edits**
- Two admins approve/reject same driver simultaneously
- Solution: optimistic locking on driver record (version field)

#### 33. **Timezone-Aware Scheduled Rides**
- Rider books "8 AM ride" — 8 AM in which timezone?
- Solution: Always use the rider's local timezone for display. Store as UTC. Confirm timezone at booking if device timezone differs from usual.

#### 34. **Payment Reconciliation**
- Daily job compares:
  - All rides marked SETTLED
  - vs. actual Razorpay settlements
  - Flag discrepancies
  - Email admin reconciliation report

#### 35. **Map Pin Inaccuracy**
- Rider places pin on wrong side of road. Driver goes to wrong side.
- Solution: Snap pickup to nearest road using Google Maps Roads API. Show confirmation: "Your pickup is on [Road Name]. Is this correct?"

#### 36. **Driver Rest / Fatigue Management**
- Drivers driving 12+ hours without break
- Solution: Track cumulative online time. After 10 hours: show warning. After 12 hours: auto-offline with cool-down period. Log for compliance.

#### 37. **Ride Cancellation Loop**
- Rider books → driver cancels → re-match → driver cancels → loop
- Solution: After 3 driver cancellations on same ride, expand search aggressively. After 5: mark NO_DRIVER_FOUND. Alert admin.

#### 38. **Half-Completed Trip**
- Driver marks trip complete at halfway point (accidentally or intentionally).
- Solution: Compare GPS position at completion to drop location. If > 1km from destination: "Are you sure? You appear to be far from the destination." Require confirmation. Flag for review if confirmed.

#### 39. **Backend Timezone Configuration**
- Server should run in UTC. JVM should be set to `-Duser.timezone=UTC`. All `TIMESTAMP WITH TIME ZONE` columns. LocalDateTime must never be used for persisted data.

#### 40. **Rate Limiting per Endpoint**
- Login: 5/min per IP
- OTP request: 3/5min per phone
- Ride create: 5/min per user
- Driver location: 10/sec per driver
- General API: 60/min per user

#### 41. **Account Deletion (DPDP Act Compliance)**
- User requests account deletion → soft delete immediately → hard delete PII after 30 days
- Retain anonymized ride/payment records for 7 years (tax compliance)
- Notify user: "Your data will be deleted within 30 days"

#### 42. **Child Safety / Age Verification**
- Riders must be 18+ (terms of service)
- Cannot verify programmatically in MVP
- Include age checkbox during registration
- Flag/report mechanism for underage riders

#### 43. **Vehicle Inspection Expiry**
- Driver's vehicle fitness certificate expires
- Solution: Store `expiry_date` on driver_document. Background job checks expiry. 30 days before: reminder notification. On expiry: auto-suspend driver until renewed.

#### 44. **Insurance Expiry**
- Same as vehicle inspection. Track, remind, auto-suspend.

#### 45. **Duplicate User Detection**
- Same person registers with different phone numbers
- Phase 1: Not handled (phone is unique identifier)
- Phase 3: Device fingerprint tracking, flag suspicious duplicates

#### 46. **Geo-Fencing for Service Area**
- Rides requested outside service area (e.g., rural area where no drivers exist)
- Solution: Define service area polygons in DB. Validate pickup location is within service area. "Service not available in this area."

#### 47. **Night-Time Safety**
- Additional safety for rides between 10 PM - 6 AM
- Auto-share trip with emergency contact
- Driver identity re-verification at night
- Higher cancellation fee for drivers (discourage night-time cancellation)

#### 48. **Government ID Masking**
- Driver documents (Aadhaar, PAN) shown to admin must mask sensitive portions
- Aadhaar: show only last 4 digits (UIDAI guidelines)
- Store encrypted; display masked

#### 49. **Network-Level Security**
- API only accessible via HTTPS
- WebSocket over WSS (TLS)
- Database not publicly accessible
- Redis not publicly accessible
- S3 buckets private (pre-signed URLs only)
- WAF rules for common attacks

#### 50. **Disaster Recovery Plan**
- Database: Multi-AZ deployment (Phase 2), daily backups, point-in-time recovery
- Application: Multiple instances behind load balancer
- Redis: Redis Sentinel or ElastiCache with replication
- RTO (Recovery Time Objective): < 1 hour
- RPO (Recovery Point Objective): < 5 minutes

---

## FINAL ARCHITECTURE VALIDATION CHECKLIST

| # | Requirement | Covered |
|---|-------------|---------|
| 1 | Backend is source of truth | ✅ Section 1, 15, 46 rules |
| 2 | Never trust frontend calculations | ✅ Section 15 |
| 3 | Never trust frontend payment status | ✅ Section 16 |
| 4 | Never allow two drivers for one ride | ✅ Section 12 |
| 5 | Never allow duplicate financial transactions | ✅ Section 12, 17 |
| 6 | Never expose sensitive info unnecessarily | ✅ Section 21 |
| 7 | Never store raw card info | ✅ Section 16 (Razorpay handles) |
| 8 | Use transactions for critical ops | ✅ Section 12 |
| 9 | Use idempotency for retryable ops | ✅ Section 12, 16, 23 |
| 10 | Use proper authorization | ✅ Section 21 |
| 11 | Keep financial records auditable | ✅ Section 17 (ledger) |
| 12 | Make pricing configurable | ✅ Section 15 (admin-managed fare_rule) |
| 13 | Make commission configurable | ✅ Section 15 (fare_rule.commission_percentage) |
| 14 | Backend controls ride state | ✅ Section 10 (state machine) |
| 15 | Handle network failure gracefully | ✅ Section 22 |
| 16 | No unrestricted background popups | ✅ Section 14 (OS-aware) |
| 17 | Respect Android/iOS restrictions | ✅ Section 8, 14 |
| 18 | Separate scheduled ride handling | ✅ Section 18 |
| 19 | Don't over-engineer MVP | ✅ Section 27 (clear MVP scope) |
| 20 | Expandable architecture | ✅ Section 26 (Phase 1→2→3) |

---

> [!IMPORTANT]
> This master plan is designed to be your complete blueprint. Each section can be expanded into detailed specifications during implementation. The plan prioritizes:
> 1. **Correctness** — Race conditions, idempotency, state machines
> 2. **Security** — Never trust the client, always validate server-side
> 3. **Auditability** — Every financial movement recorded, every state change logged
> 4. **Practicality** — MVP first, scale later, don't over-engineer
> 5. **Real-world readiness** — Edge cases, failure scenarios, legal considerations
