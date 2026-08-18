const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Payment = require('../models/Payment');
const WalletService = require('../services/WalletService');
const RazorpayService = require('../services/RazorpayService');

// ============================================================
// 1. RAZORPAY INTEGRATION ENDPOINTS
// ============================================================

// Get Razorpay Public Config (Key ID)
router.get('/razorpay/config', auth, (req, res) => {
  res.json({
    success: true,
    keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_TRFJ7gXnnDU8Kc',
    currency: 'INR'
  });
});

// Create Razorpay Order
router.post('/razorpay/create-order', auth, async (req, res) => {
  try {
    const { bookingId, amount, purpose = 'RIDE_PAYMENT' } = req.body;

    let targetAmount = Number(amount);
    let rideReceipt = `rcpt_${Date.now()}`;
    let booking = null;

    if (bookingId) {
      booking = await Booking.findById(bookingId);
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }
      targetAmount = targetAmount || booking.actualFare || booking.estimatedFare || 100;
      rideReceipt = booking.rideNumber || booking._id.toString();
    }

    if (!targetAmount || targetAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid payment amount' });
    }

    // Call Razorpay API to create order
    const orderData = await RazorpayService.createOrder({
      amountInRupees: targetAmount,
      receipt: rideReceipt,
      notes: {
        userId: req.userId,
        bookingId: bookingId || '',
        purpose
      }
    });

    // Create pending Payment audit record
    const payment = new Payment({
      bookingId: bookingId || null,
      userId: req.userId,
      driverId: booking?.driverId || null,
      amount: targetAmount,
      currency: 'INR',
      paymentMethod: 'razorpay',
      gateway: 'RAZORPAY',
      razorpayOrderId: orderData.orderId,
      status: 'pending',
      notes: { purpose, receipt: rideReceipt }
    });
    await payment.save();

    res.json({
      success: true,
      orderId: orderData.orderId,
      amount: orderData.amount, // in paise
      amountInRupees: orderData.amountInRupees,
      currency: orderData.currency,
      keyId: orderData.keyId,
      paymentRecordId: payment._id,
      customer: {
        id: req.userId
      }
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Verify Razorpay Payment Signature & Settle
router.post('/razorpay/verify-payment', auth, async (req, res) => {
  try {
    const {
      bookingId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      purpose = 'RIDE_PAYMENT'
    } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Missing payment signature verification parameters' });
    }

    // 1. Verify HMAC Signature
    const verification = RazorpayService.verifyPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature
    });

    if (!verification.isValid) {
      // Mark payment failed
      await Payment.findOneAndUpdate(
        { razorpayOrderId },
        { status: 'failed', failureReason: 'Invalid HMAC signature' }
      );
      return res.status(400).json({ success: false, message: 'Payment signature verification failed. Tampering detected.' });
    }

    // 2. Update Payment Record to completed
    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId },
      {
        $set: {
          razorpayPaymentId,
          razorpaySignature,
          transactionId: razorpayPaymentId,
          status: 'completed',
          isVerified: true,
          verifiedAt: new Date(),
          updatedAt: new Date()
        }
      },
      { new: true }
    );

    // 3. Purpose: RIDE_PAYMENT -> Settle ride and credit driver wallet
    if (purpose === 'RIDE_PAYMENT' && bookingId) {
      const booking = await Booking.findById(bookingId);
      if (booking) {
        booking.paymentStatus = 'completed';
        booking.paymentMethod = 'online';
        booking.status = 'SETTLED';

        const driverEarnings = booking.fareBreakdown?.driverEarnings || Math.round((payment?.amount || booking.estimatedFare) * 0.8);

        // Double-entry ledger credit to driver
        if (booking.driverId) {
          await WalletService.creditRideEarnings(
            booking.driverId,
            booking._id,
            driverEarnings,
            booking.rideNumber
          );
        }

        await booking.save();

        // Emit real-time completion to sockets
        const io = req.app.get('io');
        if (io) {
          io.emit('payment-completed', {
            bookingId: booking._id,
            rideNumber: booking.rideNumber,
            amount: payment?.amount || booking.estimatedFare,
            paymentId: razorpayPaymentId,
            status: 'SETTLED'
          });
        }
      }
    } else if (purpose === 'WALLET_TOPUP') {
      // Purpose: WALLET_TOPUP -> Credit user wallet balance
      const topupAmount = payment?.amount || Number(req.body.amount);
      await User.findByIdAndUpdate(req.userId, {
        $inc: { walletBalance: topupAmount }
      });
    }

    res.json({
      success: true,
      message: 'Payment verified and settled successfully',
      paymentId: razorpayPaymentId,
      orderId: razorpayOrderId,
      verified: true
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Razorpay Webhook Handler (Asynchronous Fail-Safe)
router.post('/razorpay/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;

    const isValid = RazorpayService.verifyWebhookSignature({
      rawBody: req.body,
      signature,
      secret
    });

    if (!isValid) {
      return res.status(400).json({ message: 'Invalid webhook signature' });
    }

    const event = req.body.event;
    const paymentEntity = req.body.payload?.payment?.entity;

    if (event === 'payment.captured' && paymentEntity) {
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;

      await Payment.findOneAndUpdate(
        { razorpayOrderId: orderId },
        {
          $set: {
            razorpayPaymentId: paymentId,
            status: 'completed',
            isVerified: true,
            verifiedAt: new Date()
          }
        }
      );
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============================================================
// 2. SAVED PAYMENT METHODS
// ============================================================
router.get('/methods', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('paymentMethods');
    res.json({ success: true, methods: user?.paymentMethods || [] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

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

// Process payment for a ride (Generic/Legacy)
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

// Customer Wallet Add
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
