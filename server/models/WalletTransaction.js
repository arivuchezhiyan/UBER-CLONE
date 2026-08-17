const mongoose = require('mongoose');

// ============================================================
// WALLET TRANSACTION — Double-Entry Ledger Entry
// Mirrors PICKME schema: table 20 (wallet_transaction)
// ============================================================
const walletTransactionSchema = new mongoose.Schema({
  walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'DriverWallet', required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },

  type: {
    type: String,
    enum: [
      'RIDE_EARNING',
      'COMMISSION_DEDUCT',
      'PAYOUT',
      'ADJUSTMENT',
      'REFUND_DEDUCT',
      'BONUS',
      'CANCELLATION_FEE',
      'CASH_COMMISSION'
    ],
    required: true
  },

  amount: { type: Number, required: true },
  direction: { type: String, enum: ['CREDIT', 'DEBIT'], required: true },
  balanceBefore: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },

  description: String,
  referenceId: String,
  idempotencyKey: { type: String, required: true, unique: true },

  createdAt: { type: Date, default: Date.now }
});

walletTransactionSchema.index({ walletId: 1, createdAt: -1 });
walletTransactionSchema.index({ driverId: 1, createdAt: -1 });
walletTransactionSchema.index({ rideId: 1 });
walletTransactionSchema.index({ idempotencyKey: 1 }, { unique: true });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
