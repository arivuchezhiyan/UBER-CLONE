const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Booking = require('../models/Booking');
const User = require('../models/User');
const WalletService = require('../services/WalletService');

// Get saved payment methods
router.get('/methods', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('paymentMethods');
    res.json({ success: true, methods: user?.paymentMethods || [] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Add payment method
router.post('/methods', auth, async (req, res) => {
  try {
    const { type, details } = req.body;
    
    const user = await User.findById(req.userId);
    if (!user.paymentMethods) {
      user.paymentMethods = [];
    }
    
    const newMethod = {
      id: Date.now().toString(),
      type, // 'card', 'upi', 'wallet'
      details,
      isDefault: user.paymentMethods.length === 0,
      createdAt: new Date()
    };
    
    user.paymentMethods.push(newMethod);
    await user.save();
    
    res.json({ success: true, method: newMethod });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Remove payment method
router.delete('/methods/:methodId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    user.paymentMethods = user.paymentMethods.filter(m => m.id !== req.params.methodId);
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Process payment for a ride
router.post('/process', auth, async (req, res) => {
  try {
    const { bookingId, paymentMethod, amount } = req.body;
    
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    const paymentResult = {
      success: true,
      transactionId: 'TXN' + Date.now(),
      amount: amount || booking.actualFare || booking.estimatedFare,
      method: paymentMethod,
      timestamp: new Date()
    };
    
    booking.paymentStatus = 'completed';
    booking.paymentMethod = paymentMethod;
    await booking.save();
    
    res.json({ 
      success: true, 
      payment: paymentResult,
      message: 'Payment processed successfully'
    });
  } catch (err) {
    res.status(500).json({ message: 'Payment failed', error: err.message });
  }
});

// Get payment history
router.get('/history', auth, async (req, res) => {
  try {
    const bookings = await Booking.find({
      customerId: req.userId,
      paymentStatus: 'completed'
    })
    .select('actualFare paymentMethod paymentStatus completedAt pickupLocation dropoffLocation fareBreakdown rideNumber')
    .sort({ completedAt: -1 })
    .limit(20);
    
    res.json({ success: true, payments: bookings });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Add money to customer wallet
router.post('/wallet/add', auth, async (req, res) => {
  try {
    const { amount } = req.body;
    
    const user = await User.findById(req.userId);
    if (!user.walletBalance) {
      user.walletBalance = 0;
    }
    
    user.walletBalance += Number(amount);
    await user.save();
    
    res.json({ 
      success: true, 
      balance: user.walletBalance,
      message: `₹${amount} added to wallet`
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get customer & driver wallet balance
router.get('/wallet/balance', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('walletBalance driverWallet');
    const ledgerDetails = await WalletService.getWalletDetails(req.userId, 10);
    
    res.json({ 
      success: true, 
      balance: user?.walletBalance || 0,
      driverWallet: ledgerDetails.wallet.balance,
      ledger: ledgerDetails
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ==================== DRIVER UPI & WALLET ====================

// Update driver UPI ID
router.put('/driver/upi', auth, async (req, res) => {
  try {
    const { upiId } = req.body;
    
    if (!upiId || !upiId.includes('@')) {
      return res.status(400).json({ message: 'Invalid UPI ID format' });
    }
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      { upiId },
      { new: true }
    ).select('upiId');
    
    res.json({ success: true, upiId: user.upiId });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get driver UPI ID
router.get('/driver/upi', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('upiId');
    res.json({ success: true, upiId: user?.upiId || '' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Add money to driver wallet (Double-Entry Ledger integration)
router.post('/driver/wallet/add', auth, async (req, res) => {
  try {
    const { amount, bookingId, paymentMethod } = req.body;
    
    const result = await WalletService.recordTransaction({
      driverId: req.userId,
      rideId: bookingId || null,
      type: 'ADJUSTMENT',
      amount: Number(amount),
      direction: 'CREDIT',
      description: `Manual/Online Top-up via ${paymentMethod || 'online'}`,
      idempotencyKey: `TOPUP-${req.userId}-${Date.now()}`
    });

    await User.findByIdAndUpdate(req.userId, { driverWallet: result.balanceAfter });
    
    res.json({ 
      success: true, 
      driverWallet: result.balanceAfter,
      message: `₹${amount} added to your wallet`,
      transaction: result.transaction
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get driver wallet balance & full double-entry ledger history
router.get('/driver/wallet', auth, async (req, res) => {
  try {
    const ledger = await WalletService.getWalletDetails(req.userId, 20);
    const user = await User.findById(req.userId).select('withdrawals');
    
    res.json({ 
      success: true, 
      balance: ledger.wallet.balance,
      totalEarned: ledger.wallet.totalEarned,
      totalPaidOut: ledger.wallet.totalPaidOut,
      totalCommissionPaid: ledger.wallet.totalCommissionPaid,
      transactions: ledger.transactions,
      withdrawals: user?.withdrawals || []
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Request withdrawal (with ledger debit)
router.post('/driver/withdraw', auth, async (req, res) => {
  try {
    const { amount, phone } = req.body;
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }
    
    const withdrawPhone = phone || user.phone;
    
    // Execute double-entry debit
    const ledgerResult = await WalletService.requestPayout(req.userId, Number(amount), withdrawPhone.slice(-4));
    
    const withdrawal = {
      amount: Number(amount),
      phone: withdrawPhone,
      status: 'completed',
      transactionId: ledgerResult.transaction.idempotencyKey,
      requestedAt: new Date(),
      completedAt: new Date()
    };
    
    if (!user.withdrawals) user.withdrawals = [];
    user.withdrawals.push(withdrawal);
    user.driverWallet = ledgerResult.balanceAfter;
    await user.save();
    
    res.json({ 
      success: true, 
      withdrawal,
      newBalance: ledgerResult.balanceAfter,
      message: `₹${amount} withdrawal successful to ${withdrawPhone}`
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get withdrawal history
router.get('/driver/withdrawals', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('withdrawals');
    res.json({ 
      success: true, 
      withdrawals: user?.withdrawals || []
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Confirm online payment (customer pays, money goes to driver ledger)
router.post('/confirm-online-payment', auth, async (req, res) => {
  try {
    const { bookingId, amount } = req.body;
    
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    if (booking.driverId) {
      await WalletService.creditRideEarnings(
        booking.driverId,
        booking._id,
        Number(amount) || booking.actualFare || booking.estimatedFare,
        booking.rideNumber
      );
    }
    
    booking.paymentStatus = 'completed';
    await booking.save();
    
    res.json({ 
      success: true, 
      message: 'Payment confirmed and credited to driver wallet ledger'
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
