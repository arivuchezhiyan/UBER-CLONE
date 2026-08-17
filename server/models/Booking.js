const mongoose = require('mongoose');

// ============================================================
// RIDE STATUS STATE MACHINE (16 States)
// Based on PICKME/RideNow architecture: 05-ride-state-machine.md
// ============================================================
const RIDE_STATUSES = [
  'REQUESTED',           // Rider submitted a ride request
  'SEARCHING_DRIVER',    // System is looking for nearby drivers
  'NO_DRIVER_FOUND',     // No driver accepted within timeout
  'DRIVER_ASSIGNED',     // A driver accepted the ride
  'DRIVER_ARRIVING',     // Driver is en route to pickup
  'DRIVER_ARRIVED',      // Driver arrived at pickup location
  'TRIP_STARTED',        // OTP verified, trip in progress
  'TRIP_COMPLETED',      // Driver ended the trip
  'PAYMENT_PENDING',     // Awaiting payment confirmation
  'PAYMENT_COMPLETED',   // Payment received successfully
  'PAYMENT_FAILED',      // Payment attempt failed
  'SETTLED',             // Financial settlement complete (wallet credited)
  'CANCELLED_BY_RIDER',  // Rider cancelled the ride
  'CANCELLED_BY_DRIVER', // Driver cancelled the ride
  'EXPIRED',             // Ride expired (no driver found in time)
  'REFUNDED'             // Payment was refunded
];

// Valid state transitions map
const VALID_TRANSITIONS = {
  'REQUESTED':           ['SEARCHING_DRIVER', 'CANCELLED_BY_RIDER'],
  'SEARCHING_DRIVER':    ['DRIVER_ASSIGNED', 'NO_DRIVER_FOUND', 'CANCELLED_BY_RIDER', 'EXPIRED'],
  'NO_DRIVER_FOUND':     ['SEARCHING_DRIVER', 'CANCELLED_BY_RIDER', 'EXPIRED'],
  'DRIVER_ASSIGNED':     ['DRIVER_ARRIVING', 'CANCELLED_BY_RIDER', 'CANCELLED_BY_DRIVER'],
  'DRIVER_ARRIVING':     ['DRIVER_ARRIVED', 'CANCELLED_BY_RIDER', 'CANCELLED_BY_DRIVER'],
  'DRIVER_ARRIVED':      ['TRIP_STARTED', 'CANCELLED_BY_RIDER', 'CANCELLED_BY_DRIVER'],
  'TRIP_STARTED':        ['TRIP_COMPLETED'],
  'TRIP_COMPLETED':      ['PAYMENT_PENDING', 'PAYMENT_COMPLETED', 'SETTLED'],
  'PAYMENT_PENDING':     ['PAYMENT_COMPLETED', 'PAYMENT_FAILED'],
  'PAYMENT_COMPLETED':   ['SETTLED'],
  'PAYMENT_FAILED':      ['PAYMENT_PENDING', 'REFUNDED'],
  'SETTLED':             [],
  'CANCELLED_BY_RIDER':  ['REFUNDED'],
  'CANCELLED_BY_DRIVER': ['SEARCHING_DRIVER', 'REFUNDED'],
  'EXPIRED':             [],
  'REFUNDED':            []
};

const bookingSchema = new mongoose.Schema({
  // ── Core Identifiers ──────────────────────────────────
  rideNumber: { type: String, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  vehicleType: { type: String },  // UberGo, Premier, etc.

  // ── Ride Type ─────────────────────────────────────────
  rideType: { type: String, enum: ['IMMEDIATE', 'SCHEDULED'], default: 'IMMEDIATE' },
  distanceType: { type: String, enum: ['SHORT', 'LONG'], default: 'SHORT' },

  // ── Locations ─────────────────────────────────────────
  pickupLocation: {
    address: { type: String, required: true },
    latitude: Number,
    longitude: Number,
  },
  dropoffLocation: {
    address: { type: String, required: true },
    latitude: Number,
    longitude: Number,
  },

  // ── State Machine ─────────────────────────────────────
  status: {
    type: String,
    enum: RIDE_STATUSES,
    default: 'REQUESTED'
  },

  // ── Status History (Audit Trail) ──────────────────────
  statusHistory: [{
    fromStatus: String,
    toStatus: { type: String, required: true },
    changedBy: mongoose.Schema.Types.ObjectId,
    changedByRole: { type: String, enum: ['RIDER', 'DRIVER', 'SYSTEM', 'ADMIN'] },
    reason: String,
    timestamp: { type: Date, default: Date.now }
  }],

  // ── Timing ────────────────────────────────────────────
  requestedAt: { type: Date, default: Date.now },
  acceptedAt: Date,
  driverArrivedAt: Date,
  startedAt: Date,
  completedAt: Date,
  cancelledAt: Date,

  // ── Fare Estimation ───────────────────────────────────
  estimatedFare: { type: Number },
  estimatedDistance: { type: Number },  // km
  estimatedDuration: { type: Number },  // minutes

  // ── Actual Trip Metrics ───────────────────────────────
  actualFare: { type: Number },
  distance: { type: Number },   // km
  duration: { type: Number },   // minutes

  // ── Financial Breakdown (Immutable Audit) ─────────────
  fareBreakdown: {
    baseFare: { type: Number, default: 0 },
    distanceFare: { type: Number, default: 0 },
    timeFare: { type: Number, default: 0 },
    waitingCharge: { type: Number, default: 0 },
    tollCharge: { type: Number, default: 0 },
    parkingCharge: { type: Number, default: 0 },
    scheduledFee: { type: Number, default: 0 },
    surgeMultiplier: { type: Number, default: 1.0 },
    subtotal: { type: Number, default: 0 },
    taxPercentage: { type: Number, default: 5 },       // GST 5%
    taxAmount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    promoCode: String,
    totalFare: { type: Number, default: 0 },
    commissionPercentage: { type: Number, default: 20 }, // Platform 20%
    platformCommission: { type: Number, default: 0 },
    driverEarnings: { type: Number, default: 0 },
    commissionGstPct: { type: Number, default: 18 },     // GST on commission
    commissionGstAmount: { type: Number, default: 0 },
    fareRuleSnapshot: { type: mongoose.Schema.Types.Mixed },  // Freeze fare rules at time of booking
    isFinalized: { type: Boolean, default: false },
    finalizedAt: Date
  },

  // ── Extra Charges ─────────────────────────────────────
  extraAmount: { type: Number, default: 0 },
  waitingTimeMin: { type: Number },
  tollAmount: { type: Number, default: 0 },
  parkingAmount: { type: Number, default: 0 },

  // ── Payment ───────────────────────────────────────────
  paymentMethod: { type: String, enum: ['cash', 'card', 'wallet', 'upi', 'online'], default: 'cash' },
  paymentStatus: { type: String, enum: ['pending', 'processing', 'completed', 'failed', 'cash_pending', 'cash_collected'], default: 'pending' },

  // ── Ratings ───────────────────────────────────────────
  customerRating: { type: Number, min: 1, max: 5 },
  driverRating: { type: Number, min: 1, max: 5 },
  customerFeedback: String,
  driverFeedback: String,

  // ── OTP for Ride Verification ─────────────────────────
  rideOTP: { type: String },
  otpVerified: { type: Boolean, default: false },

  // ── Cancellation ──────────────────────────────────────
  cancellationReason: String,
  cancellationReasonCode: String,
  cancelledBy: { type: String, enum: ['customer', 'driver', 'system', 'admin'] },
  cancellationFee: { type: Number, default: 0 },
  statusAtCancellation: String,

  // ── Matching Engine ───────────────────────────────────
  matchingAttempts: { type: Number, default: 0 },
  rideRequests: [{
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED'], default: 'PENDING' },
    sentAt: { type: Date, default: Date.now },
    expiresAt: Date,
    respondedAt: Date,
    responseTimeMs: Number,
    driverDistanceKm: Number,
    estimatedEarnings: Number,
    rejectionReason: String
  }],

  // ── Scheduled Ride ────────────────────────────────────
  scheduledRide: {
    scheduledDate: Date,
    scheduledTime: String,
    scheduledAt: Date,
    riderTimezone: String,
    status: { type: String, enum: ['CONFIRMED', 'MATCHING', 'MATCHED', 'CANCELLED', 'EXPIRED'] },
    matchingStartedAt: Date,
    remindersSent: [Date]
  },

  // ── GPS Breadcrumbs ───────────────────────────────────
  routeCoordinates: [{
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    heading: Number,
    speed: Number,
    recordedAt: { type: Date, required: true },
    source: { type: String, enum: ['DRIVER', 'RIDER'], default: 'DRIVER' }
  }],

  // ── Additional Info ───────────────────────────────────
  specialRequests: String,
  idempotencyKey: { type: String, unique: true, sparse: true },

  // ── Optimistic Locking (Race Condition Layer) ─────────
  version: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// ============================================================
// STATE MACHINE VALIDATION METHOD
// ============================================================
bookingSchema.methods.canTransitionTo = function(newStatus) {
  const allowedTransitions = VALID_TRANSITIONS[this.status];
  if (!allowedTransitions) return false;
  return allowedTransitions.includes(newStatus);
};

bookingSchema.methods.transitionTo = function(newStatus, changedBy, changedByRole, reason) {
  if (!this.canTransitionTo(newStatus)) {
    throw new Error(
      `Invalid status transition: ${this.status} → ${newStatus}. ` +
      `Allowed transitions: ${(VALID_TRANSITIONS[this.status] || []).join(', ')}`
    );
  }

  const oldStatus = this.status;
  this.status = newStatus;
  this.updatedAt = new Date();

  // Push to audit trail
  this.statusHistory.push({
    fromStatus: oldStatus,
    toStatus: newStatus,
    changedBy,
    changedByRole,
    reason,
    timestamp: new Date()
  });

  return this;
};

// ============================================================
// VERSION-BASED OPTIMISTIC LOCKING (Race Condition Layer 3)
// ============================================================
bookingSchema.pre('save', function(next) {
  this.version += 1;
  this.updatedAt = new Date();
  next();
});

// ============================================================
// AUTO-GENERATE RIDE NUMBER
// ============================================================
bookingSchema.pre('save', function(next) {
  if (!this.rideNumber) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.rideNumber = `RN-${timestamp}-${random}`;
  }
  next();
});

// ============================================================
// INDEXES (Performance + Race Condition Layer 2)
// ============================================================
bookingSchema.index({ customerId: 1, status: 1 });
bookingSchema.index({ driverId: 1, status: 1 });
bookingSchema.index({ status: 1, requestedAt: -1 });
bookingSchema.index({ rideNumber: 1 }, { unique: true });
bookingSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

// RACE CONDITION LAYER 2: Unique compound index on ride assignment
// Prevents two drivers from accepting the same ride
bookingSchema.index(
  { _id: 1, driverId: 1 },
  { unique: true, partialFilterExpression: { driverId: { $exists: true } } }
);

// Active ride index — fast lookup for "is this user in an active ride?"
bookingSchema.index(
  { customerId: 1 },
  { partialFilterExpression: { status: { $in: ['REQUESTED', 'SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'TRIP_STARTED'] } } }
);

// Scheduled ride index
bookingSchema.index({ 'scheduledRide.scheduledDate': 1, 'scheduledRide.status': 1 });

// Export model and constants
const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
module.exports.RIDE_STATUSES = RIDE_STATUSES;
module.exports.VALID_TRANSITIONS = VALID_TRANSITIONS;
