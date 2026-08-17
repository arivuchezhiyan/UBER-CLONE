const mongoose = require('mongoose');

// ============================================================
// CANCELLATION RECORD
// Mirrors PICKME schema: table 24 (cancellation)
// ============================================================
const cancellationSchema = new mongoose.Schema({
  rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  cancelledByRole: { 
    type: String, 
    enum: ['RIDER', 'DRIVER', 'SYSTEM', 'ADMIN'], 
    required: true 
  },
  reason: String,
  reasonCode: String,
  cancellationFee: { type: Number, default: 0 },
  statusAtCancellation: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

cancellationSchema.index({ rideId: 1 }, { unique: true });
cancellationSchema.index({ cancelledBy: 1, createdAt: -1 });

module.exports = mongoose.model('Cancellation', cancellationSchema);
