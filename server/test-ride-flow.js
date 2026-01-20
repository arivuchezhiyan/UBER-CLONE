/**
 * UBER CLONE - COMPREHENSIVE END-TO-END TEST
 * Tests the complete ride flow with multiple drivers and riders
 * 
 * Test Scenarios:
 * 1. Create 3 driver accounts and 4 rider accounts
 * 2. All 4 riders request rides
 * 3. Test that only ONE driver can accept each ride (race condition test)
 * 4. Complete full ride flow: booking → accept → start (OTP) → complete → payment
 */

const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

// Test accounts storage
const drivers = [];
const riders = [];
const bookings = [];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.cyan}${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}${colors.reset}`),
  step: (msg) => console.log(`${colors.magenta}→ ${msg}${colors.reset}`)
};

// Helper to make authenticated requests
const authRequest = (token) => {
  return axios.create({
    baseURL: API_URL,
    headers: { Authorization: `Bearer ${token}` }
  });
};

// ============ STEP 1: CREATE TEST ACCOUNTS ============

async function createDriverAccounts() {
  log.header('STEP 1: Creating 3 Driver Accounts');
  
  const driverData = [
    { name: 'Driver Raj', email: 'driver1@test.com', phone: '9000000001', password: 'test123', userType: 'driver' },
    { name: 'Driver Kumar', email: 'driver2@test.com', phone: '9000000002', password: 'test123', userType: 'driver' },
    { name: 'Driver Amit', email: 'driver3@test.com', phone: '9000000003', password: 'test123', userType: 'driver' }
  ];

  for (const driver of driverData) {
    try {
      // Try to register
      const res = await axios.post(`${API_URL}/auth/register`, driver);
      drivers.push({
        ...driver,
        id: res.data.user._id || res.data.user.id,
        token: res.data.token
      });
      log.success(`Created driver: ${driver.name} (ID: ${res.data.user._id || res.data.user.id})`);
    } catch (err) {
      // If already exists, try login
      if (err.response?.status === 400) {
        try {
          const loginRes = await axios.post(`${API_URL}/auth/login`, {
            phone: driver.phone,
            password: driver.password
          });
          drivers.push({
            ...driver,
            id: loginRes.data.user._id || loginRes.data.user.id,
            token: loginRes.data.token
          });
          log.info(`Driver ${driver.name} already exists, logged in successfully`);
        } catch (loginErr) {
          log.error(`Failed to login driver ${driver.name}: ${loginErr.message}`);
        }
      } else {
        log.error(`Failed to create driver ${driver.name}: ${err.response?.data?.message || err.message}`);
      }
    }
  }
  
  console.log(`\nTotal drivers ready: ${drivers.length}`);
}

async function createRiderAccounts() {
  log.header('STEP 2: Creating 4 Rider Accounts');
  
  const riderData = [
    { name: 'Rider Priya', email: 'rider1@test.com', phone: '9100000001', password: 'test123', userType: 'customer' },
    { name: 'Rider Rahul', email: 'rider2@test.com', phone: '9100000002', password: 'test123', userType: 'customer' },
    { name: 'Rider Anita', email: 'rider3@test.com', phone: '9100000003', password: 'test123', userType: 'customer' },
    { name: 'Rider Vikram', email: 'rider4@test.com', phone: '9100000004', password: 'test123', userType: 'customer' }
  ];

  for (const rider of riderData) {
    try {
      const res = await axios.post(`${API_URL}/auth/register`, rider);
      riders.push({
        ...rider,
        id: res.data.user._id || res.data.user.id,
        token: res.data.token
      });
      log.success(`Created rider: ${rider.name} (ID: ${res.data.user._id || res.data.user.id})`);
    } catch (err) {
      if (err.response?.status === 400) {
        try {
          const loginRes = await axios.post(`${API_URL}/auth/login`, {
            phone: rider.phone,
            password: rider.password
          });
          riders.push({
            ...rider,
            id: loginRes.data.user._id || loginRes.data.user.id,
            token: loginRes.data.token
          });
          log.info(`Rider ${rider.name} already exists, logged in successfully`);
        } catch (loginErr) {
          log.error(`Failed to login rider ${rider.name}: ${loginErr.message}`);
        }
      } else {
        log.error(`Failed to create rider ${rider.name}: ${err.response?.data?.message || err.message}`);
      }
    }
  }
  
  console.log(`\nTotal riders ready: ${riders.length}`);
}

// ============ STEP 2: SET DRIVERS ONLINE ============

async function setDriversOnline() {
  log.header('STEP 3: Setting All Drivers Online');
  
  for (const driver of drivers) {
    try {
      await authRequest(driver.token).put('/users/driver-status', { isOnline: true });
      log.success(`${driver.name} is now ONLINE`);
    } catch (err) {
      log.error(`Failed to set ${driver.name} online: ${err.response?.data?.message || err.message}`);
    }
  }
}

// ============ STEP 3: RIDERS REQUEST RIDES ============

async function ridersRequestRides() {
  log.header('STEP 4: All 4 Riders Requesting Rides');
  
  const locations = [
    { pickup: { address: 'MG Road Metro Station', latitude: 12.9758, longitude: 77.6063 }, dropoff: { address: 'Koramangala 4th Block', latitude: 12.9279, longitude: 77.6271 } },
    { pickup: { address: 'Whitefield Tech Park', latitude: 12.9698, longitude: 77.7500 }, dropoff: { address: 'Indiranagar 100ft Road', latitude: 12.9784, longitude: 77.6408 } },
    { pickup: { address: 'HSR Layout', latitude: 12.9116, longitude: 77.6389 }, dropoff: { address: 'Electronic City', latitude: 12.8399, longitude: 77.6770 } },
    { pickup: { address: 'Jayanagar 4th Block', latitude: 12.9250, longitude: 77.5938 }, dropoff: { address: 'Bangalore Airport', latitude: 13.1989, longitude: 77.7068 } }
  ];

  for (let i = 0; i < riders.length; i++) {
    const rider = riders[i];
    const location = locations[i];
    
    try {
      const res = await authRequest(rider.token).post('/bookings', {
        pickupLocation: location.pickup,
        dropoffLocation: location.dropoff,
        vehicleType: 'UberGo',
        estimatedDistance: 5 + Math.floor(Math.random() * 15),
        estimatedDuration: 15 + Math.floor(Math.random() * 30),
        paymentMethod: i % 2 === 0 ? 'cash' : 'upi'
      });
      
      const booking = res.data.booking;
      bookings.push({
        id: booking._id,
        riderId: rider.id,
        riderName: rider.name,
        otp: booking.rideOTP,
        fare: booking.estimatedFare,
        pickup: location.pickup.address,
        dropoff: location.dropoff.address,
        status: 'searching',
        paymentMethod: booking.paymentMethod
      });
      
      log.success(`${rider.name} requested ride: ${location.pickup.address} → ${location.dropoff.address}`);
      log.info(`  Booking ID: ${booking._id}, OTP: ${booking.rideOTP}, Fare: ₹${booking.estimatedFare}`);
    } catch (err) {
      log.error(`${rider.name} failed to request ride: ${err.response?.data?.message || err.message}`);
    }
  }
  
  console.log(`\nTotal active ride requests: ${bookings.length}`);
}

// ============ STEP 4: TEST RACE CONDITION - ALL DRIVERS TRY TO ACCEPT SAME RIDE ============

async function testRaceCondition() {
  log.header('STEP 5: RACE CONDITION TEST - All 3 Drivers Try to Accept Same Ride');
  
  if (bookings.length === 0) {
    log.error('No bookings available for testing');
    return;
  }
  
  const targetBooking = bookings[0];
  log.info(`Testing with booking: ${targetBooking.id}`);
  log.info(`Ride: ${targetBooking.pickup} → ${targetBooking.dropoff}`);
  
  // All 3 drivers try to accept the same ride simultaneously
  const acceptPromises = drivers.map(async (driver) => {
    try {
      const res = await authRequest(driver.token).post('/bookings/accept', {
        bookingId: targetBooking.id
      });
      return { driver: driver.name, success: true, response: res.data };
    } catch (err) {
      return { driver: driver.name, success: false, error: err.response?.data?.message || err.message };
    }
  });
  
  const results = await Promise.all(acceptPromises);
  
  let successCount = 0;
  let acceptedDriver = null;
  
  console.log('\n--- RACE CONDITION RESULTS ---');
  for (const result of results) {
    if (result.success) {
      successCount++;
      acceptedDriver = result.driver;
      log.success(`${result.driver}: ACCEPTED THE RIDE ✓`);
      targetBooking.driverName = result.driver;
      targetBooking.status = 'accepted';
    } else {
      log.warn(`${result.driver}: ${result.error}`);
    }
  }
  
  console.log('\n--- VERDICT ---');
  if (successCount === 1) {
    log.success(`PASS: Only ONE driver (${acceptedDriver}) accepted the ride!`);
    log.success('Race condition handling is WORKING CORRECTLY! 🎉');
  } else if (successCount === 0) {
    log.error('FAIL: No driver could accept the ride');
  } else {
    log.error(`FAIL: ${successCount} drivers accepted the same ride! Race condition BUG!`);
  }
}

// ============ STEP 5: COMPLETE FULL RIDE FLOWS ============

async function completeRideFlows() {
  log.header('STEP 6: Completing Full Ride Flows for Remaining Bookings');
  
  // Assign remaining rides to available drivers
  let driverIndex = 0;
  
  for (let i = 1; i < bookings.length; i++) {
    const booking = bookings[i];
    const driver = drivers[driverIndex % drivers.length];
    driverIndex++;
    
    log.step(`\n--- Processing Ride ${i + 1}: ${booking.riderName} ---`);
    
    try {
      // Driver accepts the ride
      const acceptRes = await authRequest(driver.token).post('/bookings/accept', {
        bookingId: booking.id
      });
      
      if (acceptRes.data.success) {
        booking.driverName = driver.name;
        booking.status = 'accepted';
        log.success(`${driver.name} accepted ${booking.riderName}'s ride`);
      } else {
        log.warn(`Ride may have been taken by another driver`);
        continue;
      }
    } catch (err) {
      log.warn(`${driver.name} could not accept: ${err.response?.data?.message || 'Already taken'}`);
      continue;
    }
    
    // Small delay to simulate driver arriving
    await new Promise(r => setTimeout(r, 500));
    
    // Start the ride with OTP
    try {
      const startRes = await authRequest(driver.token).post('/bookings/start', {
        bookingId: booking.id,
        otp: booking.otp
      });
      
      if (startRes.data.success) {
        booking.status = 'started';
        log.success(`Ride STARTED - OTP ${booking.otp} verified`);
      }
    } catch (err) {
      log.error(`Failed to start ride: ${err.response?.data?.message || err.message}`);
      continue;
    }
    
    // Small delay to simulate ride in progress
    await new Promise(r => setTimeout(r, 500));
    
    // Complete the ride
    try {
      const completeRes = await authRequest(driver.token).post('/bookings/complete', {
        bookingId: booking.id,
        distance: booking.fare / 15, // Approximate distance
        duration: 20
      });
      
      if (completeRes.data.success) {
        booking.status = 'completed';
        booking.actualFare = completeRes.data.fare;
        log.success(`Ride COMPLETED - Fare: ₹${completeRes.data.fare} (${booking.paymentMethod.toUpperCase()})`);
      }
    } catch (err) {
      log.error(`Failed to complete ride: ${err.response?.data?.message || err.message}`);
    }
  }
}

// ============ STEP 6: COMPLETE THE FIRST RIDE (from race condition test) ============

async function completeFirstRide() {
  log.header('STEP 7: Completing the First Ride (from race condition test)');
  
  const booking = bookings[0];
  
  if (booking.status !== 'accepted') {
    log.warn('First ride was not accepted, skipping completion');
    return;
  }
  
  // Find the driver who accepted
  const driver = drivers.find(d => d.name === booking.driverName);
  
  if (!driver) {
    log.error('Could not find the accepting driver');
    return;
  }
  
  log.info(`${driver.name} will complete ${booking.riderName}'s ride`);
  
  // Start the ride
  try {
    const startRes = await authRequest(driver.token).post('/bookings/start', {
      bookingId: booking.id,
      otp: booking.otp
    });
    
    if (startRes.data.success) {
      log.success(`Ride STARTED - OTP ${booking.otp} verified`);
    }
  } catch (err) {
    log.error(`Failed to start: ${err.response?.data?.message || err.message}`);
  }
  
  // Complete the ride
  try {
    const completeRes = await authRequest(driver.token).post('/bookings/complete', {
      bookingId: booking.id,
      distance: 8,
      duration: 25
    });
    
    if (completeRes.data.success) {
      booking.status = 'completed';
      booking.actualFare = completeRes.data.fare;
      log.success(`Ride COMPLETED - Fare: ₹${completeRes.data.fare}`);
    }
  } catch (err) {
    log.error(`Failed to complete: ${err.response?.data?.message || err.message}`);
  }
  
  // Rate the ride (rider rates driver)
  const rider = riders.find(r => r.name === booking.riderName);
  if (rider) {
    try {
      await authRequest(rider.token).post('/bookings/rate', {
        bookingId: booking.id,
        rating: 5,
        feedback: 'Great ride!',
        ratingType: 'driver'
      });
      log.success(`${booking.riderName} rated ${driver.name}: ⭐⭐⭐⭐⭐`);
    } catch (err) {
      log.warn(`Rating failed: ${err.message}`);
    }
  }
}

// ============ FINAL SUMMARY ============

function printSummary() {
  log.header('📊 TEST SUMMARY');
  
  console.log('\n--- Accounts Created ---');
  console.log(`Drivers: ${drivers.length}`);
  drivers.forEach(d => console.log(`  • ${d.name} (${d.phone})`));
  console.log(`Riders: ${riders.length}`);
  riders.forEach(r => console.log(`  • ${r.name} (${r.phone})`));
  
  console.log('\n--- Ride Results ---');
  bookings.forEach((b, i) => {
    const statusEmoji = b.status === 'completed' ? '✅' : b.status === 'accepted' ? '🚗' : '⏳';
    console.log(`${statusEmoji} Ride ${i + 1}: ${b.riderName}`);
    console.log(`   Route: ${b.pickup} → ${b.dropoff}`);
    console.log(`   Driver: ${b.driverName || 'Not assigned'}`);
    console.log(`   Status: ${b.status.toUpperCase()}`);
    console.log(`   Fare: ₹${b.actualFare || b.fare} (${b.paymentMethod})`);
    console.log('');
  });
  
  const completed = bookings.filter(b => b.status === 'completed').length;
  console.log(`\n--- Statistics ---`);
  console.log(`Total Rides: ${bookings.length}`);
  console.log(`Completed: ${completed}`);
  console.log(`Success Rate: ${((completed / bookings.length) * 100).toFixed(1)}%`);
}

// ============ MAIN TEST RUNNER ============

async function runTests() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║        UBER CLONE - END-TO-END TEST SUITE                     ║
║        Testing complete ride flow with race conditions        ║
╚═══════════════════════════════════════════════════════════════╝
  `);
  
  try {
    // Check server connection
    try {
      await axios.get(`${API_URL}/vehicles`);
      log.success('Server is running!');
    } catch (err) {
      log.error('Server is not running. Please start the server first.');
      process.exit(1);
    }
    
    await createDriverAccounts();
    await createRiderAccounts();
    await setDriversOnline();
    await ridersRequestRides();
    
    // Wait a bit for rides to be available
    await new Promise(r => setTimeout(r, 1000));
    
    await testRaceCondition();
    await completeFirstRide();
    await completeRideFlows();
    
    printSummary();
    
    log.header('🎉 ALL TESTS COMPLETED!');
    
  } catch (err) {
    log.error(`Test suite failed: ${err.message}`);
    console.error(err);
  }
}

// Run the tests
runTests();
