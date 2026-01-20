const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Booking = require('../models/Booking');
const User = require('../models/User');

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
    
    // Simulate payment processing
    const paymentResult = {
      success: true,
      transactionId: 'TXN' + Date.now(),
      amount: amount || booking.actualFare || booking.estimatedFare,
      method: paymentMethod,
      timestamp: new Date()
    };
    
    // Update booking payment status
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
    .select('actualFare paymentMethod paymentStatus completedAt pickupLocation dropoffLocation')
    .sort({ completedAt: -1 })
    .limit(20);
    
    res.json({ success: true, payments: bookings });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Add money to wallet
router.post('/wallet/add', auth, async (req, res) => {
  try {
    const { amount } = req.body;
    
    const user = await User.findById(req.userId);
    if (!user.walletBalance) {
      user.walletBalance = 0;
    }
    
    user.walletBalance += amount;
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

// Get wallet balance
router.get('/wallet/balance', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('walletBalance driverWallet');
    res.json({ 
      success: true, 
      balance: user?.walletBalance || 0,
      driverWallet: user?.driverWallet || 0
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

// Add money to driver wallet (when online payment is confirmed)
router.post('/driver/wallet/add', auth, async (req, res) => {
  try {
    const { amount, bookingId, paymentMethod } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $inc: { driverWallet: amount } },
      { new: true }
    ).select('driverWallet');
    
    res.json({ 
      success: true, 
      driverWallet: user.driverWallet,
      message: `₹${amount} added to your wallet`
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get driver wallet balance
router.get('/driver/wallet', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('driverWallet withdrawals');
    res.json({ 
      success: true, 
      balance: user?.driverWallet || 0,
      withdrawals: user?.withdrawals || []
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Request withdrawal
router.post('/driver/withdraw', auth, async (req, res) => {
  try {
    const { amount, phone } = req.body;
    
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }
    
    if (user.driverWallet < amount) {
      return res.status(400).json({ message: 'Insufficient wallet balance' });
    }
    
    // Validate phone (should match user's registered phone or provided phone)
    const withdrawPhone = phone || user.phone;
    
    // Create withdrawal record
    const withdrawal = {
      amount,
      phone: withdrawPhone,
      status: 'completed', // In production, this would be 'pending' and processed later
      transactionId: 'WD' + Date.now(),
      requestedAt: new Date(),
      completedAt: new Date()
    };
    
    // Deduct from wallet and add withdrawal record
    user.driverWallet -= amount;
    if (!user.withdrawals) user.withdrawals = [];
    user.withdrawals.push(withdrawal);
    await user.save();
    
    res.json({ 
      success: true, 
      withdrawal,
      newBalance: user.driverWallet,
      message: `₹${amount} withdrawal successful to ${withdrawPhone}`
    });
  } catch (err) {
    res.status(500).json({ message: 'Withdrawal failed', error: err.message });
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

// Confirm online payment (customer pays, money goes to driver wallet)
router.post('/confirm-online-payment', auth, async (req, res) => {
  try {
    const { bookingId, amount } = req.body;
    
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    // Add money to driver's wallet
    if (booking.driverId) {
      await User.findByIdAndUpdate(
        booking.driverId,
        { $inc: { driverWallet: amount } }
      );
    }
    
    // Update booking payment status
    booking.paymentStatus = 'completed';
    await booking.save();
    
    res.json({ 
      success: true, 
      message: 'Payment confirmed and added to driver wallet'
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
