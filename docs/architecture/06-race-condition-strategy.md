# 🔒 RideNow — Race Condition & Concurrency Strategy

> How we prevent every possible data corruption scenario in the platform.

---

## 1. The Core Race Condition: Two Drivers Accept One Ride

### Problem
```
T=0.000s  Ride R1001 created, status = SEARCHING_DRIVER
T=0.100s  Request sent to Driver A (30s countdown)
T=29.90s  Driver A taps ACCEPT
T=29.95s  System sends request to Driver B (A was about to timeout)
T=30.05s  Driver A's ACCEPT reaches server
T=30.10s  Driver B's ACCEPT reaches server

WITHOUT PROTECTION: Both drivers get assigned. Chaos.
```

### Solution: Three-Layer Defense

```
LAYER 1: SELECT FOR UPDATE (pessimistic lock on ride row)
    ↓
LAYER 2: Status validation (ride must be SEARCHING_DRIVER)
    ↓
LAYER 3: UNIQUE constraint on ride_assignment.ride_id
```

### Implementation

```java
@Service
public class RideAcceptanceService {

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public RideAcceptanceResult acceptRide(UUID rideId, UUID driverId) {

        // LAYER 1: Acquire exclusive row lock
        // Second transaction BLOCKS here until first commits/rolls back
        Ride ride = rideRepository.findByIdWithLock(rideId)  // SELECT ... FOR UPDATE
            .orElseThrow(() -> new ResourceNotFoundException("Ride not found"));

        // LAYER 2: Validate ride is still available
        if (ride.getStatus() != RideStatus.SEARCHING_DRIVER) {
            return RideAcceptanceResult.alreadyAssigned();
        }

        // Validate this driver has a valid pending request
        RideRequest request = rideRequestRepository
            .findByRideIdAndDriverIdAndStatus(rideId, driverId, RequestStatus.PENDING)
            .orElseThrow(() -> new BusinessException("No pending request"));

        // Validate request hasn't expired
        if (request.getExpiresAt().isBefore(Instant.now())) {
            request.setStatus(RequestStatus.EXPIRED);
            rideRequestRepository.save(request);
            return RideAcceptanceResult.expired();
        }

        // Validate driver is still available
        if (driverAvailabilityService.hasActiveRide(driverId)) {
            return RideAcceptanceResult.driverBusy();
        }

        // LAYER 3: Insert assignment (UNIQUE constraint = absolute safety net)
        try {
            RideAssignment assignment = new RideAssignment();
            assignment.setRideId(rideId);
            assignment.setDriverId(driverId);
            rideAssignmentRepository.save(assignment);
        } catch (DataIntegrityViolationException e) {
            // UNIQUE(ride_id) violated — another transaction beat us
            return RideAcceptanceResult.alreadyAssigned();
        }

        // All clear — assign the ride
        ride.setStatus(RideStatus.DRIVER_ASSIGNED);
        ride.setDriverId(driverId);
        ride.setDriverAssignedAt(Instant.now());
        rideRepository.save(ride);

        // Mark request as accepted, expire others
        request.setStatus(RequestStatus.ACCEPTED);
        request.setRespondedAt(Instant.now());
        rideRequestRepository.save(request);
        rideRequestRepository.expireOtherRequests(rideId, driverId);

        // Mark driver as busy
        driverAvailabilityService.markAssigned(driverId, rideId);

        return RideAcceptanceResult.success(ride);
    }
}
```

### SQL Behind the Lock

```sql
-- findByIdWithLock
SELECT * FROM ride WHERE id = :rideId FOR UPDATE;

-- What happens with two concurrent transactions:
-- T1: SELECT * FROM ride WHERE id = 'R1001' FOR UPDATE;  → Gets lock, proceeds
-- T2: SELECT * FROM ride WHERE id = 'R1001' FOR UPDATE;  → BLOCKS (waits for T1)
-- T1: UPDATE ride SET status = 'DRIVER_ASSIGNED' ... ; COMMIT;  → Lock released
-- T2: Gets lock, reads UPDATED row → status = 'DRIVER_ASSIGNED' → fails validation
```

---

## 2. All Race Conditions & Prevention

### 2.1 Duplicate Ride Creation

| Scenario | User taps "Book Ride" button twice rapidly |
|----------|-------------------------------------------|
| **Risk** | Two identical rides created |
| **Prevention** | `X-Idempotency-Key` header (client-generated UUID) |
| **DB Constraint** | `UNIQUE(idempotency_key)` on `ride` table |
| **Behavior** | Second request returns the already-created ride |

```java
// Check idempotency before creating
Optional<Ride> existing = rideRepository.findByIdempotencyKey(idempotencyKey);
if (existing.isPresent()) {
    return existing.get(); // Return existing, don't create duplicate
}
```

### 2.2 Duplicate Payment Webhook

| Scenario | Razorpay sends webhook twice (network retry) |
|----------|----------------------------------------------|
| **Risk** | Driver wallet credited twice |
| **Prevention** | `UNIQUE(gateway_transaction_id)` on `payment_transaction` |
| **Behavior** | Second webhook: check exists → return 200 (acknowledge without processing) |

```java
Optional<PaymentTransaction> existing = 
    paymentTransactionRepo.findByGatewayTransactionId(gatewayPaymentId);
if (existing.isPresent() && existing.get().getStatus() == COMPLETED) {
    return ResponseEntity.ok("Already processed");
}
```

### 2.3 Duplicate Wallet Credit

| Scenario | Wallet credit operation retried due to network timeout |
|----------|-------------------------------------------------------|
| **Risk** | Balance inflated, phantom earnings |
| **Prevention** | `UNIQUE(idempotency_key)` on `wallet_transaction` |
| **Format** | Key = `ride-{rideId}-{type}` e.g., `ride-abc123-RIDE_EARNING` |

### 2.4 Rider Cancels While Driver Accepts

| Scenario | Rider taps Cancel, Driver taps Accept — near-simultaneously |
|----------|-------------------------------------------------------------|
| **Risk** | Ride is both cancelled AND assigned |
| **Prevention** | Both operations acquire `SELECT FOR UPDATE` on the same ride row |
| **Behavior** | Whichever transaction gets the lock first wins. Second sees updated status and fails gracefully. |

```
Timeline:
T=0: Cancel transaction acquires lock
T=0: Accept transaction BLOCKS
T=1: Cancel commits → status = CANCELLED_BY_RIDER
T=1: Accept gets lock → reads CANCELLED_BY_RIDER → returns "Ride was cancelled"
```

### 2.5 Concurrent Rider Booking Prevention

| Scenario | Rider tries to book two rides simultaneously |
|----------|----------------------------------------------|
| **Risk** | Rider has two active rides, driver confusion |
| **Prevention** | Check before creating: |

```sql
SELECT COUNT(*) FROM ride 
WHERE rider_id = :riderId 
AND status IN ('REQUESTED', 'SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 
               'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'TRIP_STARTED')
```

If count > 0, reject with `ACTIVE_RIDE_EXISTS`.

### 2.6 Driver Assigned to Two Rides

| Scenario | Driver accepts Ride A, system also sends them Ride B |
|----------|------------------------------------------------------|
| **Risk** | Driver has two assigned rides |
| **Prevention** | |

```sql
-- UNIQUE constraint: one active assignment per driver
CREATE UNIQUE INDEX idx_assignment_driver_active 
ON ride_assignment (driver_id) WHERE is_active = TRUE;

-- Also check in matching: skip drivers where current_ride_id IS NOT NULL
```

### 2.7 Double Refund

| Scenario | Admin clicks refund twice, or automated + manual refund |
|----------|--------------------------------------------------------|
| **Risk** | Money refunded twice |
| **Prevention** | `UNIQUE(payment_id)` on `refund` table (one refund per payment) |
| **Additional** | Check payment status: only COMPLETED payments can be refunded |

### 2.8 Concurrent Wallet Updates

| Scenario | Two rides complete simultaneously for same driver |
|----------|---------------------------------------------------|
| **Risk** | Lost update — balance shows only one credit |
| **Prevention** | Optimistic locking with `@Version` |

```java
@Entity
public class DriverWallet {
    @Version
    private Integer version;  // Auto-incremented by JPA on each update
    
    private BigDecimal balance;
}

// If two transactions read version=5, both try to write version=6
// First succeeds, second gets OptimisticLockException → retry
```

### 2.9 Concurrent Admin Edits

| Scenario | Two admins approve/reject same driver simultaneously |
|----------|------------------------------------------------------|
| **Risk** | Driver both approved and rejected |
| **Prevention** | `@Version` on `driver` entity + status validation |

### 2.10 Payment Button Spam

| Scenario | User rapidly taps "Pay Now" 5 times |
|----------|--------------------------------------|
| **Risk** | 5 payment orders created at gateway |
| **Prevention** | Frontend: disable button after first tap. Backend: idempotency key per ride payment. |

---

## 3. Idempotency Key Strategy

| Operation | Key Format | Storage |
|-----------|-----------|---------|
| Create Ride | Client-generated UUID | `ride.idempotency_key` |
| Accept Ride | `accept-{rideId}-{driverId}` | Checked via `ride_assignment.UNIQUE(ride_id)` |
| Create Payment | `payment-{rideId}` | `payment.idempotency_key` |
| Wallet Credit | `ride-{rideId}-RIDE_EARNING` | `wallet_transaction.idempotency_key` |
| Wallet Debit | `ride-{rideId}-COMMISSION_DEDUCT` | `wallet_transaction.idempotency_key` |
| Payout | `payout-{driverId}-{timestamp}` | `payout.idempotency_key` |
| Refund | `refund-{paymentId}` | `refund` table UNIQUE on `payment_id` |
| Webhook | `{gateway_transaction_id}` | `payment_transaction.gateway_transaction_id` |

---

## 4. Locking Strategy Summary

| Technique | Where Used | Why |
|-----------|-----------|-----|
| **Pessimistic Lock (SELECT FOR UPDATE)** | Ride acceptance, ride cancellation, payment processing | Critical sections where we need exclusive access to a row |
| **Optimistic Lock (@Version)** | Wallet balance update, driver profile update | Allows concurrent reads, catches conflicts on write |
| **UNIQUE Constraint** | Assignment, payment webhook, wallet transaction | Absolute last line of defense against duplicates |
| **Idempotency Key** | All write APIs | Prevents duplicate processing of retried requests |
| **Redis Distributed Lock** | Scheduled ride processing, background jobs | Prevents multiple server instances processing same job |
| **Database Advisory Lock** | Driver matching per ride | Prevents multiple matching processes for same ride |

---

## 5. Testing Race Conditions

```java
@Test
void twoDriversAcceptSameRide() {
    // Setup
    Ride ride = createRide(SEARCHING_DRIVER);
    Driver a = createDriver();
    Driver b = createDriver();
    createRequest(ride, a);
    createRequest(ride, b);
    
    // Execute concurrently
    ExecutorService exec = Executors.newFixedThreadPool(2);
    Future<Result> fa = exec.submit(() -> service.acceptRide(ride.getId(), a.getId()));
    Future<Result> fb = exec.submit(() -> service.acceptRide(ride.getId(), b.getId()));
    
    // Assert exactly one winner
    Result ra = fa.get();
    Result rb = fb.get();
    assertTrue(ra.isSuccess() ^ rb.isSuccess()); // XOR: exactly one true
    assertEquals(1, assignmentRepo.countByRideId(ride.getId()));
}
```
