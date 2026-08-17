const mongoose = require('mongoose');

// ============================================================
// FARE RULE — Per vehicle category & distance type pricing
// Mirrors PICKME schema: table 22 (fare_rule)
// ============================================================
const fareRuleSchema = new mongoose.Schema({
  vehicleCategory: { type: String, required: true },  // 'UberGo', 'Premier', 'UberXL', etc.
  distanceType: { type: String, enum: ['SHORT', 'LONG'], required: true, default: 'SHORT' },

  baseFare: { type: Number, required: true },
  perKmRate: { type: Number, required: true },
  perMinuteRate: { type: Number, required: true, default: 1.5 },
  minimumFare: { type: Number, required: true },
  minDistanceKm: { type: Number, default: 0 },             // Base fare covers this distance

  // Waiting charges
  waitingChargePerMin: { type: Number, default: 2 },
  freeWaitingMin: { type: Number, default: 3 },

  // Scheduled ride fee
  scheduledRideFee: { type: Number, default: 0 },

  // Commission & Tax
  commissionPercentage: { type: Number, default: 20 },       // Platform commission %
  taxPercentage: { type: Number, default: 5 },                // GST on fare

  // Long distance threshold
  longDistanceThresholdKm: { type: Number, default: 50 },

  isActive: { type: Boolean, default: true },
  effectiveFrom: { type: Date, default: Date.now },
  effectiveUntil: Date,

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

fareRuleSchema.index({ vehicleCategory: 1, distanceType: 1, isActive: 1 });

module.exports = mongoose.model('FareRule', fareRuleSchema);
