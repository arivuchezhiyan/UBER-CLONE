const mongoose = require('mongoose');

// ============================================================
// CANCELLATION RULE
// Mirrors PICKME schema: table 25 (cancellation_rule)
// ============================================================
const cancellationRuleSchema = new mongoose.Schema({
  vehicleCategory: String, // null = all categories
  rideType: { type: String, enum: ['IMMEDIATE', 'SCHEDULED'] },
  cancelledByRole: { type: String, enum: ['RIDER', 'DRIVER'], required: true },
  rideStatus: { type: String, required: true },
  
  minMinutesAfterAssignment: { type: Number, default: 0 },
  maxMinutesAfterAssignment: Number,
  
  cancellationFee: { type: Number, required: true },
  feeType: { type: String, enum: ['FLAT', 'PERCENTAGE'], default: 'FLAT' },
  
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

cancellationRuleSchema.index({ cancelledByRole: 1, rideStatus: 1, isActive: 1 });

module.exports = mongoose.model('CancellationRule', cancellationRuleSchema);
