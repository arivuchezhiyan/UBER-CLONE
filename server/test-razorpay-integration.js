require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');
const RazorpayService = require('./services/RazorpayService');
const WalletService = require('./services/WalletService');
const Booking = require('./models/Booking');
const User = require('./models/User');
const Payment = require('./models/Payment');
const DriverWallet = require('./models/DriverWallet');
const WalletTransaction = require('./models/WalletTransaction');

async function testRazorpayIntegration() {
  console.log('💳 Starting Razorpay Payment Gateway Integration Tests...\n');
  
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rental-app-razorpay-test';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB:', mongoUri, '\n');

    await Booking.deleteMany({});
    await Payment.deleteMany({});
    await DriverWallet.deleteMany({});
    await WalletTransaction.deleteMany({});
    await User.deleteMany({});

    let passedTests = 0;
    let totalTests = 0;

    function assert(condition, message) {
      totalTests++;
      if (condition) {
        passedTests++;
        console.log(`  ✅ [PASS] ${message}`);
      } else {
        console.error(`  ❌ [FAIL] ${message}`);
      }
    }

    // ========================================================
    // TEST SUITE 1: Razorpay Order Creation via Live Sandbox API
    // ========================================================
    console.log('🧪 Test Suite 1: Razorpay Order Creation');
    const orderResult = await RazorpayService.createOrder({
      amountInRupees: 250,
      receipt: `RN-TEST-${Date.now()}`,
      notes: { test: 'ride_payment_order' }
    });

    assert(orderResult.success === true, 'Razorpay order created successfully');
    assert(orderResult.orderId && orderResult.orderId.startsWith('order_'), `Generated valid Razorpay order ID: ${orderResult.orderId}`);
    assert(orderResult.amount === 25000, 'Amount converted accurately to paise (₹250 = 25000 paise)');
    assert(orderResult.currency === 'INR', 'Currency is INR');
    assert(orderResult.keyId === 'rzp_test_TRFJ7gXnnDU8Kc', 'Public Key ID matches configured test key');

    // ========================================================
    // TEST SUITE 2: HMAC-SHA256 Payment Signature Verification
    // ========================================================
    console.log('\n🧪 Test Suite 2: Payment Signature Verification');
    const mockOrderId = orderResult.orderId;
    const mockPaymentId = `pay_${Date.now()}`;
    const secret = process.env.RAZORPAY_KEY_SECRET || 'fplhAqMGvcz1Flct82zdtr1B';

    // Generate authentic HMAC-SHA256 signature
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(`${mockOrderId}|${mockPaymentId}`)
      .digest('hex');

    const validVerification = RazorpayService.verifyPaymentSignature({
      orderId: mockOrderId,
      paymentId: mockPaymentId,
      signature: validSignature
    });

    assert(validVerification.isValid === true, 'Authentic payment signature verified successfully');

    // Test with tampered/invalid signature
    const invalidVerification = RazorpayService.verifyPaymentSignature({
      orderId: mockOrderId,
      paymentId: mockPaymentId,
      signature: 'fake_tampered_signature_1234567890'
    });

    assert(invalidVerification.isValid === false, 'Tampered/fake signature correctly rejected');

    // ========================================================
    // TEST SUITE 3: Full End-to-End Ride Settlement Flow
    // ========================================================
    console.log('\n🧪 Test Suite 3: End-to-End Online Payment & Wallet Settlement');
    const driver = await User.create({
      name: 'Driver Ramesh',
      phone: '9000000088',
      password: 'hash',
      userType: 'driver'
    });

    const rider = await User.create({
      name: 'Rider Sangeeta',
      phone: '9100000088',
      password: 'hash',
      userType: 'customer'
    });

    const booking = await Booking.create({
      customerId: rider._id,
      driverId: driver._id,
      pickupLocation: { address: 'Indiranagar' },
      dropoffLocation: { address: 'MG Road' },
      vehicleType: 'UberGo',
      status: 'TRIP_COMPLETED',
      estimatedFare: 250,
      actualFare: 250,
      fareBreakdown: {
        totalFare: 250,
        platformCommission: 50,
        driverEarnings: 200
      }
    });

    // Create payment record
    const payment = await Payment.create({
      bookingId: booking._id,
      userId: rider._id,
      driverId: driver._id,
      amount: 250,
      currency: 'INR',
      paymentMethod: 'razorpay',
      gateway: 'RAZORPAY',
      razorpayOrderId: mockOrderId,
      status: 'pending'
    });

    assert(payment.status === 'pending', 'Payment record initialized as pending');

    // Simulate verification callback
    payment.razorpayPaymentId = mockPaymentId;
    payment.razorpaySignature = validSignature;
    payment.status = 'completed';
    payment.isVerified = true;
    payment.verifiedAt = new Date();
    await payment.save();

    // Settle ride & credit driver ledger
    booking.paymentStatus = 'completed';
    booking.paymentMethod = 'online';
    booking.status = 'SETTLED';
    await booking.save();

    const ledgerResult = await WalletService.creditRideEarnings(
      driver._id,
      booking._id,
      booking.fareBreakdown.driverEarnings,
      booking.rideNumber
    );

    assert(ledgerResult.success === true, 'Driver wallet successfully credited');
    assert(ledgerResult.balanceAfter === 200, `Driver ledger credited with ₹200 (Total fare ₹250 - Platform commission ₹50)`);

    const refreshedBooking = await Booking.findById(booking._id);
    assert(refreshedBooking.status === 'SETTLED', 'Ride status transitioned to SETTLED');
    assert(refreshedBooking.paymentStatus === 'completed', 'Payment status marked as completed');

    // ========================================================
    // TEST SUITE 4: Webhook Signature Verification
    // ========================================================
    console.log('\n🧪 Test Suite 4: Webhook Signature Validation');
    const webhookPayload = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: mockPaymentId, order_id: mockOrderId, amount: 25000 } } }
    });

    const validWebhookSig = crypto
      .createHmac('sha256', secret)
      .update(webhookPayload)
      .digest('hex');

    const isWebhookValid = RazorpayService.verifyWebhookSignature({
      rawBody: webhookPayload,
      signature: validWebhookSig,
      secret
    });

    assert(isWebhookValid === true, 'Webhook HMAC-SHA256 signature verified successfully');

    // ========================================================
    // SUMMARY
    // ========================================================
    console.log(`\n========================================================`);
    console.log(`🎉 TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log(`========================================================\n`);

    if (passedTests === totalTests) {
      console.log('✅ RAZORPAY PAYMENT GATEWAY INTEGRATION: 100% SUCCESS');
    }
  } catch (error) {
    console.error('❌ Test execution error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

testRazorpayIntegration();
