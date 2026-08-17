const mongoose = require('mongoose');

// ============================================================
// DRIVER WALLET — Double-Entry Ledger Base
// Mirrors PICKME schema: table 19 (driver_wallet)
// ============================================================
const driverWalletSchema = new mongoose.Schema({
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  
  balance: { type: Number, default: 0 },
  pendingAmount: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  totalPaidOut: { type: Number, default: 0 },
  totalCommissionPaid: { type: Number, default: 0 },

  // Optimistic locking — prevents double credits/debits
  version: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

// Optimistic locking middleware
driverWalletSchema.pre('save', function(next) {
  this.version += 1;
  this.updatedAt = new Date();
  next();
});

driverWalletSchema.index({ driverId: 1 }, { unique: true });

module.exports = mongoose.model('DriverWallet', driverWalletSchema);
