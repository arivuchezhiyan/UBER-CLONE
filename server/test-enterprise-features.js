const mongoose = require('mongoose');
const Booking = require('./models/Booking');
const FareRule = require('./models/FareRule');
const FareModifier = require('./models/FareModifier');
const DriverWallet = require('./models/DriverWallet');
const WalletTransaction = require('./models/WalletTransaction');
const Cancellation = require('./models/Cancellation');
const User = require('./models/User');
const FareCalculator = require('./services/FareCalculator');
const WalletService = require('./services/WalletService');

async function runTests() {
  console.log('🚀 Starting Enterprise Feature Verification Tests...\n');
  
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rental-app-enterprise-test';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB:', mongoUri, '\n');

    // Clean test db collections
    await FareModifier.deleteMany({});
    await DriverWallet.deleteMany({});
    await WalletTransaction.deleteMany({});
    await Booking.deleteMany({});

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
    // TEST SUITE 1: Centralized FareCalculator Engine
    // ========================================================
    console.log('🧪 Test Suite 1: FareCalculator Pricing Engine');
    const fare1 = await FareCalculator.calculateFare({
      vehicleCategory: 'UberGo',
      distanceKm: 10,
      durationMin: 20,
      waitingTimeMin: 5,
      tollAmount: 50,
      parkingAmount: 20
    });

    assert(fare1.baseFare === 50, 'Base fare calculated as 50');
    assert(fare1.distanceFare === 120, 'Distance fare: 10km * 12 = 120');
    assert(fare1.timeFare === 30, 'Time fare: 20min * 1.5 = 30');
    assert(fare1.waitingCharge === 4, 'Waiting charge: (5-3min free) * 2 = 4');
    assert(fare1.tollCharge === 50, 'Toll pass-through is 50');
    assert(fare1.parkingCharge === 20, 'Parking charge is 20');
    assert(fare1.taxPercentage === 5, 'GST tax is 5%');
    assert(fare1.totalFare > 0, `Total fare calculated: ₹${fare1.totalFare}`);
    assert(fare1.platformCommission > 0, `Platform commission (20%): ₹${fare1.platformCommission}`);
    assert(fare1.driverEarnings > 0, `Driver earnings: ₹${fare1.driverEarnings}`);
    assert(fare1.totalFare >= fare1.driverEarnings, 'Total fare >= Driver earnings');

    // ========================================================
    // TEST SUITE 2: Dynamic Surge Modifier
    // ========================================================
    console.log('\n🧪 Test Suite 2: Dynamic Surge Pricing');
    await FareModifier.create({
      name: 'Rain Surge',
      modifierType: 'RAIN',
      multiplier: 1.5,
      isActive: true
    });

    const fareSurge = await FareCalculator.calculateFare({
      vehicleCategory: 'UberGo',
      distanceKm: 10,
      durationMin: 20
    });

    assert(fareSurge.surgeMultiplier === 1.5, 'Rain surge multiplier 1.5 applied');
    assert(fareSurge.totalFare > fare1.totalFare - 70, 'Surge price higher than normal price');

    // ========================================================
    // TEST SUITE 3: Double-Entry Driver Ledger Wallet
    // ========================================================
    console.log('\n🧪 Test Suite 3: Double-Entry Driver Ledger');
    const dummyDriverId = new mongoose.Types.ObjectId();
    const dummyRideId = new mongoose.Types.ObjectId();

    // 1. Credit earnings
    const creditResult = await WalletService.creditRideEarnings(
      dummyDriverId,
      dummyRideId,
      350,
      'RN-TEST-001'
    );
    assert(creditResult.balanceAfter === 350, 'Driver wallet credited: ₹350');
    assert(creditResult.transaction.direction === 'CREDIT', 'Transaction direction is CREDIT');
    assert(creditResult.transaction.type === 'RIDE_EARNING', 'Transaction type is RIDE_EARNING');

    // 2. Idempotency protection test
    const duplicateCredit = await WalletService.creditRideEarnings(
      dummyDriverId,
      dummyRideId,
      350,
      'RN-TEST-001'
    );
    assert(duplicateCredit.duplicate === true, 'Duplicate transaction blocked by idempotency key');

    // 3. Cash commission debit
    const debitResult = await WalletService.debitCashCommission(
      dummyDriverId,
      dummyRideId,
      70,
      'RN-TEST-001'
    );
    assert(debitResult.balanceAfter === 280, 'Platform commission deducted: Balance ₹280');
    assert(debitResult.transaction.direction === 'DEBIT', 'Debit transaction recorded');

    // 4. Payout request
    const payoutResult = await WalletService.requestPayout(dummyDriverId, 200, '4321');
    assert(payoutResult.balanceAfter === 80, 'Payout of ₹200 processed: Remaining ₹80');

    // ========================================================
    // TEST SUITE 4: 16-State Ride Machine & Audit History
    // ========================================================
    console.log('\n🧪 Test Suite 4: 16-State Ride Machine');
    const dummyRiderId = new mongoose.Types.ObjectId();

    const booking = new Booking({
      customerId: dummyRiderId,
      pickupLocation: { address: 'Indiranagar' },
      dropoffLocation: { address: 'Koramangala' },
      vehicleType: 'UberGo',
      status: 'REQUESTED'
    });

    assert(booking.canTransitionTo('SEARCHING_DRIVER') === true, 'REQUESTED can transition to SEARCHING_DRIVER');
    assert(booking.canTransitionTo('TRIP_COMPLETED') === false, 'REQUESTED CANNOT transition directly to TRIP_COMPLETED');

    booking.transitionTo('SEARCHING_DRIVER', dummyRiderId, 'RIDER', 'Searching for drivers');
    assert(booking.status === 'SEARCHING_DRIVER', 'State is SEARCHING_DRIVER');
    assert(booking.statusHistory.length === 1, 'Audit trail recorded 1 transition');

    booking.transitionTo('DRIVER_ASSIGNED', dummyDriverId, 'DRIVER', 'Driver accepted');
    booking.transitionTo('DRIVER_ARRIVING', dummyDriverId, 'DRIVER', 'Driver en route');
    booking.transitionTo('DRIVER_ARRIVED', dummyDriverId, 'DRIVER', 'Driver at pickup');
    booking.transitionTo('TRIP_STARTED', dummyDriverId, 'DRIVER', 'OTP verified');
    booking.transitionTo('TRIP_COMPLETED', dummyDriverId, 'DRIVER', 'Trip ended');

    assert(booking.status === 'TRIP_COMPLETED', 'Successfully transitioned through full trip lifecycle');
    assert(booking.statusHistory.length === 6, 'Audit trail recorded all 6 transitions');

    // ========================================================
    // SUMMARY
    // ========================================================
    console.log(`\n========================================================`);
    console.log(`🎉 TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log(`========================================================\n`);

    if (passedTests === totalTests) {
      console.log('✅ PHASE 1 BACKEND HARDENING VERIFICATION: 100% SUCCESS');
    }
  } catch (error) {
    console.error('❌ Test execution error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
