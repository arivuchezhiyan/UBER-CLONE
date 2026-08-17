# 🔄 RideNow — Ride State Machine

> Complete state transition rules enforced by the backend.  
> Frontend cannot change ride status directly — only trigger backend APIs that perform validated transitions.

---

## State Diagram

```
                              ┌──────────────────────────────────────────┐
                              │          CANCELLED_BY_RIDER              │
                              │  (from any pre-trip state)               │
                              └──────────────────────────────────────────┘
                                              ▲
                                              │ (rider cancels)
                                              │
┌──────────┐    ┌──────────────────┐    ┌─────┴──────────┐    ┌──────────────┐
│ REQUESTED├───►│ SEARCHING_DRIVER ├───►│ DRIVER_ASSIGNED├───►│DRIVER_ARRIVING│
└──────────┘    └───────┬──────────┘    └────────────────┘    └──────┬───────┘
                        │                                            │
                        ▼                                            ▼
                ┌───────────────┐                            ┌──────────────┐
                │NO_DRIVER_FOUND│                            │DRIVER_ARRIVED│
                │               │                            └──────┬───────┘
                │ (retry/boost) │                                    │
                └───────┬───────┘                                    ▼
                        │                                    ┌──────────────┐
                        └─────── back to SEARCHING ─────────►│ TRIP_STARTED │
                                                             └──────┬───────┘
                                                                     │
                                                                     ▼
                                                             ┌──────────────┐
                                                             │TRIP_COMPLETED│
                                                             └──────┬───────┘
                                                                     │
                                                                     ▼
                                                            ┌────────────────┐
                                                            │PAYMENT_PENDING │
                                                            └───────┬────────┘
                                                                    │
                                                        ┌───────────┼───────────┐
                                                        ▼                       ▼
                                                ┌───────────────┐     ┌──────────────┐
                                                │PAYMENT_FAILED │────►│  PAYMENT_    │
                                                │  (retry)      │     │  COMPLETED   │
                                                └───────────────┘     └──────┬───────┘
                                                                             │
                                                                             ▼
                                                                      ┌──────────┐
                                                                      │ SETTLED  │
                                                                      └──────────┘
```

---

## All States

| State | Description | Terminal? |
|-------|-------------|-----------|
| `REQUESTED` | Ride created by rider, not yet searching | No |
| `SEARCHING_DRIVER` | Actively matching with drivers | No |
| `NO_DRIVER_FOUND` | All drivers exhausted or timed out | No (can retry) |
| `DRIVER_ASSIGNED` | Driver accepted, assignment confirmed | No |
| `DRIVER_ARRIVING` | Driver en route to pickup | No |
| `DRIVER_ARRIVED` | Driver at pickup location | No |
| `TRIP_STARTED` | OTP verified, trip in progress | No |
| `TRIP_COMPLETED` | Driver completed the trip | No |
| `PAYMENT_PENDING` | Awaiting payment | No |
| `PAYMENT_COMPLETED` | Payment confirmed | No |
| `PAYMENT_FAILED` | Payment failed (can retry) | No |
| `SETTLED` | Commission calculated, wallet credited, complete | **Yes** ✅ |
| `CANCELLED_BY_RIDER` | Rider cancelled | **Yes** ✅ |
| `CANCELLED_BY_DRIVER` | Driver cancelled | **Yes** ✅ |
| `EXPIRED` | Scheduled ride expired without match | **Yes** ✅ |
| `REFUNDED` | Refund processed after cancellation | **Yes** ✅ |

---

## Valid Transitions (Enforced by Backend)

| # | From | To | Trigger | Actor |
|---|------|----|---------|-------|
| 1 | `REQUESTED` | `SEARCHING_DRIVER` | System starts matching | System |
| 2 | `REQUESTED` | `CANCELLED_BY_RIDER` | Rider cancels before search | Rider |
| 3 | `SEARCHING_DRIVER` | `DRIVER_ASSIGNED` | Driver accepts ride | Driver (via System) |
| 4 | `SEARCHING_DRIVER` | `NO_DRIVER_FOUND` | All drivers rejected/timed out | System |
| 5 | `SEARCHING_DRIVER` | `CANCELLED_BY_RIDER` | Rider cancels during search | Rider |
| 6 | `NO_DRIVER_FOUND` | `SEARCHING_DRIVER` | Rider retries or increases fare | Rider |
| 7 | `NO_DRIVER_FOUND` | `CANCELLED_BY_RIDER` | Rider gives up | Rider |
| 8 | `DRIVER_ASSIGNED` | `DRIVER_ARRIVING` | Assignment confirmed, driver starts moving | System |
| 9 | `DRIVER_ASSIGNED` | `CANCELLED_BY_DRIVER` | Driver cancels | Driver |
| 10 | `DRIVER_ASSIGNED` | `CANCELLED_BY_RIDER` | Rider cancels | Rider |
| 11 | `DRIVER_ARRIVING` | `DRIVER_ARRIVED` | Driver marks arrived at pickup | Driver |
| 12 | `DRIVER_ARRIVING` | `CANCELLED_BY_DRIVER` | Driver cancels en route | Driver |
| 13 | `DRIVER_ARRIVING` | `CANCELLED_BY_RIDER` | Rider cancels | Rider |
| 14 | `DRIVER_ARRIVED` | `TRIP_STARTED` | OTP verified, trip begins | Driver |
| 15 | `DRIVER_ARRIVED` | `CANCELLED_BY_DRIVER` | Rider no-show after wait | Driver |
| 16 | `DRIVER_ARRIVED` | `CANCELLED_BY_RIDER` | Rider cancels at pickup | Rider |
| 17 | `TRIP_STARTED` | `TRIP_COMPLETED` | Driver completes trip | Driver |
| 18 | `TRIP_COMPLETED` | `PAYMENT_PENDING` | Final fare calculated | System |
| 19 | `PAYMENT_PENDING` | `PAYMENT_COMPLETED` | Payment verified | System |
| 20 | `PAYMENT_PENDING` | `PAYMENT_FAILED` | Payment fails | System |
| 21 | `PAYMENT_FAILED` | `PAYMENT_PENDING` | Rider retries | System |
| 22 | `PAYMENT_FAILED` | `PAYMENT_COMPLETED` | Retry succeeds | System |
| 23 | `PAYMENT_COMPLETED` | `SETTLED` | Commission + wallet done | System |
| 24 | `CANCELLED_BY_RIDER` | `REFUNDED` | Refund processed | System |
| 25 | `CANCELLED_BY_DRIVER` | `REFUNDED` | Refund processed | System |

---

## Invalid Transitions (Examples — MUST be rejected)

| From | To | Why Invalid |
|------|----|-------------|
| `TRIP_STARTED` | `CANCELLED_BY_RIDER` | Cannot cancel after trip starts |
| `TRIP_STARTED` | `CANCELLED_BY_DRIVER` | Cannot cancel during trip |
| `SETTLED` | Any | Terminal state, no changes allowed |
| `PAYMENT_COMPLETED` | `CANCELLED_BY_RIDER` | Too late to cancel |
| `REQUESTED` | `TRIP_STARTED` | Cannot skip intermediate states |
| `DRIVER_ARRIVING` | `TRIP_STARTED` | Must arrive first, then verify OTP |

---

## State Machine Implementation (Java)

```java
public enum RideStatus {
    REQUESTED,
    SEARCHING_DRIVER,
    NO_DRIVER_FOUND,
    DRIVER_ASSIGNED,
    DRIVER_ARRIVING,
    DRIVER_ARRIVED,
    TRIP_STARTED,
    TRIP_COMPLETED,
    PAYMENT_PENDING,
    PAYMENT_COMPLETED,
    PAYMENT_FAILED,
    SETTLED,
    CANCELLED_BY_RIDER,
    CANCELLED_BY_DRIVER,
    EXPIRED,
    REFUNDED;

    // Terminal states — no further transitions allowed
    public boolean isTerminal() {
        return this == SETTLED || this == CANCELLED_BY_RIDER 
            || this == CANCELLED_BY_DRIVER || this == EXPIRED || this == REFUNDED;
    }

    // States where ride can be cancelled by rider
    public boolean isCancellableByRider() {
        return this == REQUESTED || this == SEARCHING_DRIVER 
            || this == DRIVER_ASSIGNED || this == DRIVER_ARRIVING || this == DRIVER_ARRIVED;
    }

    // States where ride can be cancelled by driver
    public boolean isCancellableByDriver() {
        return this == DRIVER_ASSIGNED || this == DRIVER_ARRIVING || this == DRIVER_ARRIVED;
    }

    // States where ride is considered "active"
    public boolean isActive() {
        return this == REQUESTED || this == SEARCHING_DRIVER || this == DRIVER_ASSIGNED
            || this == DRIVER_ARRIVING || this == DRIVER_ARRIVED || this == TRIP_STARTED;
    }
}
```

```java
@Component
public class RideStatusMachine {

    private static final Map<RideStatus, Set<RideStatus>> TRANSITIONS = Map.ofEntries(
        entry(REQUESTED,         Set.of(SEARCHING_DRIVER, CANCELLED_BY_RIDER)),
        entry(SEARCHING_DRIVER,  Set.of(DRIVER_ASSIGNED, NO_DRIVER_FOUND, CANCELLED_BY_RIDER)),
        entry(NO_DRIVER_FOUND,   Set.of(SEARCHING_DRIVER, CANCELLED_BY_RIDER, EXPIRED)),
        entry(DRIVER_ASSIGNED,   Set.of(DRIVER_ARRIVING, CANCELLED_BY_DRIVER, CANCELLED_BY_RIDER)),
        entry(DRIVER_ARRIVING,   Set.of(DRIVER_ARRIVED, CANCELLED_BY_DRIVER, CANCELLED_BY_RIDER)),
        entry(DRIVER_ARRIVED,    Set.of(TRIP_STARTED, CANCELLED_BY_DRIVER, CANCELLED_BY_RIDER)),
        entry(TRIP_STARTED,      Set.of(TRIP_COMPLETED)),
        entry(TRIP_COMPLETED,    Set.of(PAYMENT_PENDING)),
        entry(PAYMENT_PENDING,   Set.of(PAYMENT_COMPLETED, PAYMENT_FAILED)),
        entry(PAYMENT_FAILED,    Set.of(PAYMENT_PENDING, PAYMENT_COMPLETED)),
        entry(PAYMENT_COMPLETED, Set.of(SETTLED)),
        entry(CANCELLED_BY_RIDER, Set.of(REFUNDED)),
        entry(CANCELLED_BY_DRIVER, Set.of(REFUNDED))
    );

    public void validateTransition(RideStatus from, RideStatus to) {
        Set<RideStatus> allowed = TRANSITIONS.get(from);
        if (allowed == null || !allowed.contains(to)) {
            throw new InvalidStateTransitionException(
                String.format("Invalid ride transition: %s → %s", from, to)
            );
        }
    }

    public RideStatus transition(Ride ride, RideStatus newStatus, UUID changedBy, String role, String reason) {
        RideStatus current = ride.getStatus();
        validateTransition(current, newStatus);

        ride.setStatus(newStatus);
        ride.setUpdatedAt(Instant.now());

        // Record history (immutable audit trail)
        RideStatusHistory history = RideStatusHistory.builder()
            .rideId(ride.getId())
            .fromStatus(current)
            .toStatus(newStatus)
            .changedBy(changedBy)
            .changedByRole(role)
            .reason(reason)
            .build();
        statusHistoryRepository.save(history);

        return newStatus;
    }
}
```

---

## Scheduled Ride Additional States

| State | Description |
|-------|-------------|
| `REQUESTED` + `ride_type=SCHEDULED` | Scheduled ride created, waiting for matching window |
| `SEARCHING_DRIVER` | Matching started 30-45 min before scheduled time |
| `DRIVER_ASSIGNED` | Driver assigned for the scheduled ride |
| `EXPIRED` | Scheduled time passed without successful match |

The scheduled ride uses the same state machine, with the addition of `EXPIRED` for rides that time out.
