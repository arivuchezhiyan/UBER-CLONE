const DriverWallet = require('../models/DriverWallet');
const WalletTransaction = require('../models/WalletTransaction');

class WalletService {
  /**
   * Get or create a driver's ledger wallet
   */
  static async getOrCreateWallet(driverId) {
    let wallet = await DriverWallet.findOne({ driverId });
    if (!wallet) {
      wallet = new DriverWallet({
        driverId,
        balance: 0,
        pendingAmount: 0,
        totalEarned: 0,
        totalPaidOut: 0,
        totalCommissionPaid: 0
      });
      await wallet.save();
    }
    return wallet;
  }

  /**
   * Record a double-entry ledger transaction with balance integrity & idempotency
   */
  static async recordTransaction({
    driverId,
    rideId = null,
    type,
    amount,
    direction,
    description = '',
    referenceId = '',
    idempotencyKey
  }) {
    if (!idempotencyKey) {
      idempotencyKey = `WTXN-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    }

    // 1. Idempotency Check — return existing transaction if already processed
    const existingTxn = await WalletTransaction.findOne({ idempotencyKey });
    if (existingTxn) {
      return { success: true, transaction: existingTxn, duplicate: true };
    }

    // 2. Fetch driver's wallet
    const wallet = await this.getOrCreateWallet(driverId);
    const balanceBefore = Number(wallet.balance) || 0;
    let balanceAfter = balanceBefore;

    if (direction === 'CREDIT') {
      balanceAfter = balanceBefore + Number(amount);
      wallet.balance = balanceAfter;
      if (type === 'RIDE_EARNING' || type === 'BONUS') {
        wallet.totalEarned = (Number(wallet.totalEarned) || 0) + Number(amount);
      }
    } else if (direction === 'DEBIT') {
      balanceAfter = balanceBefore - Number(amount);
      wallet.balance = balanceAfter;
      if (type === 'PAYOUT') {
        wallet.totalPaidOut = (Number(wallet.totalPaidOut) || 0) + Number(amount);
      } else if (type === 'COMMISSION_DEDUCT' || type === 'CASH_COMMISSION') {
        wallet.totalCommissionPaid = (Number(wallet.totalCommissionPaid) || 0) + Number(amount);
      }
    }

    await wallet.save();

    // 3. Create immutable audit ledger entry
    const transaction = new WalletTransaction({
      walletId: wallet._id,
      driverId,
      rideId,
      type,
      amount: Number(amount),
      direction,
      balanceBefore,
      balanceAfter,
      description,
      referenceId,
      idempotencyKey
    });

    await transaction.save();

    return {
      success: true,
      wallet,
      transaction,
      balanceAfter
    };
  }

  /**
   * Credit driver for online ride completion
   */
  static async creditRideEarnings(driverId, rideId, earningsAmount, rideNumber) {
    return this.recordTransaction({
      driverId,
      rideId,
      type: 'RIDE_EARNING',
      amount: earningsAmount,
      direction: 'CREDIT',
      description: `Earnings for Ride #${rideNumber || rideId}`,
      referenceId: rideNumber || rideId.toString(),
      idempotencyKey: `CREDIT-RIDE-${rideId}`
    });
  }

  /**
   * Debit platform commission when ride was paid in CASH to driver
   */
  static async debitCashCommission(driverId, rideId, commissionAmount, rideNumber) {
    return this.recordTransaction({
      driverId,
      rideId,
      type: 'CASH_COMMISSION',
      amount: commissionAmount,
      direction: 'DEBIT',
      description: `Platform commission for Cash Ride #${rideNumber || rideId}`,
      referenceId: rideNumber || rideId.toString(),
      idempotencyKey: `COMMISSION-RIDE-${rideId}`
    });
  }

  /**
   * Request bank payout
   */
  static async requestPayout(driverId, amount, bankAccountLast4 = 'XXXX') {
    const wallet = await this.getOrCreateWallet(driverId);
    if (wallet.balance < amount) {
      throw new Error(`Insufficient wallet balance. Available: ₹${wallet.balance}, Requested: ₹${amount}`);
    }

    return this.recordTransaction({
      driverId,
      type: 'PAYOUT',
      amount,
      direction: 'DEBIT',
      description: `Payout to bank account ending in ${bankAccountLast4}`,
      referenceId: `PO-${Date.now()}`,
      idempotencyKey: `PAYOUT-${driverId}-${Date.now()}`
    });
  }

  /**
   * Fetch wallet and recent transaction history
   */
  static async getWalletDetails(driverId, limit = 20) {
    const wallet = await this.getOrCreateWallet(driverId);
    const transactions = await WalletTransaction.find({ driverId })
      .sort({ createdAt: -1 })
      .limit(limit);

    return {
      wallet,
      transactions
    };
  }
}

module.exports = WalletService;
