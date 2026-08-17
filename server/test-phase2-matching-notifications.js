const mongoose = require('mongoose');
const Booking = require('./models/Booking');
const User = require('./models/User');
const MatchingService = require('./services/MatchingService');
const ScheduledRideJob = require('./services/ScheduledRideJob');
const DriverHeartbeatService = require('./services/DriverHeartbeatService');

async function runPhase2Tests() {
  console.log('🚀 Starting Phase 2 Matching & Notification Tests...\n');
  
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rental-app-phase2-test';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB:', mongoUri, '\n');

    await Booking.deleteMany({});
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
    // TEST SUITE 1: Distance Calculation (Haversine Formula)
    // ========================================================
    console.log('🧪 Test Suite 1: Haversine Distance Calculation');
    // MG Road (12.9756, 77.6066) to Koramangala (12.9352, 77.6245) is approx 5.0 - 5.5 km
    const dist1 = MatchingService.calculateDistance(12.9756, 77.6066, 12.9352, 77.6245);
    assert(dist1 > 4.5 && dist1 < 6.0, `Calculated distance between MG Road and Koramangala: ${dist1} km`);

    // Zero distance
    const distZero = MatchingService.calculateDistance(12.9756, 77.6066, 12.9756, 77.6066);
    assert(distZero === 0, 'Same coordinate distance is 0 km');

    // ========================================================
    // TEST SUITE 2: Driver Ranking Algorithm
    // ========================================================
    console.log('\n🧪 Test Suite 2: Driver Ranking & Candidate Discovery');
    // Driver 1: Closest (1 km away), rating 4.8
    const d1 = await User.create({
      name: 'Driver Close',
      phone: '9000000010',
      password: 'hash',
      userType: 'driver',
      isOnline: true,
      rating: 4.8,
      acceptanceRate: 95,
      currentLocation: { latitude: 12.9760, longitude: 77.6100, lastUpdated: new Date() }
    });

    // Driver 2: Farther (7 km away), rating 5.0
    const d2 = await User.create({
      name: 'Driver Far',
      phone: '9000000020',
      password: 'hash',
      userType: 'driver',
      isOnline: true,
      rating: 5.0,
      acceptanceRate: 100,
      currentLocation: { latitude: 12.9200, longitude: 77.6500, lastUpdated: new Date() }
    });

    // Driver 3: Offline (should be excluded)
    await User.create({
      name: 'Driver Offline',
      phone: '9000000030',
      password: 'hash',
      userType: 'driver',
      isOnline: false,
      currentLocation: { latitude: 12.9760, longitude: 77.6100, lastUpdated: new Date() }
    });

    const rankedDrivers = await MatchingService.findRankedDrivers({
      pickupLocation: { latitude: 12.9756, longitude: 77.6066 },
      vehicleType: 'UberGo'
    });

    assert(rankedDrivers.length === 2, `Found ${rankedDrivers.length} online nearby drivers (offline driver excluded)`);
    assert(rankedDrivers[0].driver._id.toString() === d1._id.toString(), 'Closer driver ranked #1 with lower composite score');
    assert(rankedDrivers[1].driver._id.toString() === d2._id.toString(), 'Farther driver ranked #2');

    // ========================================================
    // TEST SUITE 3: Sequential Dispatch & Driver Rejection
    // ========================================================
    console.log('\n🧪 Test Suite 3: Sequential Dispatch & Driver Rejection Flow');
    const rider = await User.create({
      name: 'Test Rider',
      phone: '9100000050',
      password: 'hash',
      userType: 'customer'
    });

    const booking = await Booking.create({
      customerId: rider._id,
      pickupLocation: { address: 'MG Road', latitude: 12.9756, longitude: 77.6066 },
      dropoffLocation: { address: 'Indiranagar', latitude: 12.9780, longitude: 77.6400 },
      vehicleType: 'UberGo',
      status: 'SEARCHING_DRIVER',
      estimatedFare: 150,
      estimatedDistance: 4,
      estimatedDuration: 12
    });

    // Mock IO event collector
    const emittedEvents = [];
    const mockIo = {
      emit: (evt, data) => emittedEvents.push({ evt, data })
    };

    // Trigger dispatch
    await MatchingService.startSequentialDispatch(booking._id, mockIo);

    const freshBooking1 = await Booking.findById(booking._id);
    assert(freshBooking1.rideRequests.length === 1, 'Dispatch attempt recorded in rideRequests array');
    assert(freshBooking1.rideRequests[0].driverId.toString() === d1._id.toString(), 'First dispatch targeted Driver Close (#1 rank)');
    assert(freshBooking1.rideRequests[0].status === 'PENDING', 'Request status is PENDING');

    // Driver 1 declines the ride
    await MatchingService.handleDriverRejection(booking._id, d1._id, 'Too far from destination', mockIo);

    const freshBooking2 = await Booking.findById(booking._id);
    assert(freshBooking2.rideRequests[0].status === 'REJECTED', 'Driver 1 request marked as REJECTED');
    assert(freshBooking2.rideRequests.length === 2, 'Sequential dispatch automatically advanced to Driver Far (#2 rank)');
    assert(freshBooking2.rideRequests[1].driverId.toString() === d2._id.toString(), 'Driver 2 received second dispatch request');

    // Clean timer
    MatchingService.cancelDispatch(booking._id);

    // ========================================================
    // TEST SUITE 4: Scheduled Ride Job Matching Window
    // ========================================================
    console.log('\n🧪 Test Suite 4: Scheduled Ride Auto-Matching Window');
    const scheduledBooking = await Booking.create({
      customerId: rider._id,
      pickupLocation: { address: 'Airport' },
      dropoffLocation: { address: 'City' },
      vehicleType: 'UberGo',
      rideType: 'SCHEDULED',
      status: 'REQUESTED',
      scheduledRide: {
        scheduledDate: new Date(),
        scheduledAt: new Date(Date.now() + 25 * 60 * 1000), // 25 minutes from now (inside 45-min window)
        status: 'CONFIRMED'
      },
      estimatedFare: 600,
      estimatedDistance: 35,
      estimatedDuration: 45
    });

    await ScheduledRideJob.processUpcomingScheduledRides(mockIo);

    const scheduledUpdated = await Booking.findById(scheduledBooking._id);
    assert(scheduledUpdated.status === 'SEARCHING_DRIVER', 'Upcoming scheduled ride status changed to SEARCHING_DRIVER');
    assert(scheduledUpdated.scheduledRide.status === 'MATCHING', 'Scheduled ride sub-status changed to MATCHING');

    // Clean timer
    MatchingService.cancelDispatch(scheduledBooking._id);

    // ========================================================
    // TEST SUITE 5: Driver Heartbeat & Stale Inactivity Offline
    // ========================================================
    console.log('\n🧪 Test Suite 5: Driver Heartbeat & Auto-Offline Monitoring');
    // Update heartbeat
    const activeDriver = await DriverHeartbeatService.recordHeartbeat(d1._id, {
      latitude: 12.9800,
      longitude: 77.6200
    });
    assert(activeDriver.isOnline === true, 'Driver marked online after heartbeat');
    assert(activeDriver.currentLocation.latitude === 12.9800, 'Driver coordinates updated from heartbeat');

    // Simulate stale driver (last updated 10 minutes ago)
    const staleDriver = await User.create({
      name: 'Stale Driver',
      phone: '9000000099',
      password: 'hash',
      userType: 'driver',
      isOnline: true,
      currentLocation: {
        latitude: 12.9000,
        longitude: 77.6000,
        lastUpdated: new Date(Date.now() - 10 * 60 * 1000) // 10 min ago
      }
    });

    await DriverHeartbeatService.checkStaleDrivers(mockIo);

    const staleRefreshed = await User.findById(staleDriver._id);
    assert(staleRefreshed.isOnline === false, 'Stale driver auto-marked OFFLINE due to inactivity');

    // ========================================================
    // SUMMARY
    // ========================================================
    console.log(`\n========================================================`);
    console.log(`🎉 TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log(`========================================================\n`);

    if (passedTests === totalTests) {
      console.log('✅ PHASE 2 MATCHING & NOTIFICATIONS VERIFICATION: 100% SUCCESS');
    }
  } catch (error) {
    console.error('❌ Test execution error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

runPhase2Tests();
