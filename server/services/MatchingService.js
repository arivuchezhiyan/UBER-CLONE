const Booking = require('../models/Booking');
const User = require('../models/User');

// Active dispatch timers keyed by bookingId
const activeDispatchTimers = new Map();

class MatchingService {
  /**
   * Haversine formula to compute great-circle distance in kilometers
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 999;
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100; // round to 2 decimals
  }

  /**
   * Find and rank online nearby drivers based on distance, rating, and acceptance rate
   */
  static async findRankedDrivers({ pickupLocation, vehicleType, excludeDriverIds = [], maxRadiusKm = 10 }) {
    const pickupLat = pickupLocation?.latitude || 12.9716;
    const pickupLng = pickupLocation?.longitude || 77.5946;

    // 1. Fetch online drivers not in exclude list
    const candidateDrivers = await User.find({
      userType: 'driver',
      isOnline: true,
      _id: { $nin: excludeDriverIds }
    }).select('name phone rating acceptanceRate currentLocation vehicleDetails profileImage');

    // 2. Filter out drivers currently assigned to active rides
    const busyDriverIds = await Booking.find({
      status: {
        $in: [
          'DRIVER_ASSIGNED',
          'DRIVER_ARRIVING',
          'DRIVER_ARRIVED',
          'TRIP_STARTED',
          'accepted',
          'arriving',
          'started'
        ]
      },
      driverId: { $ne: null }
    }).distinct('driverId');

    const busySet = new Set(busyDriverIds.map(id => id.toString()));

    const availableDrivers = candidateDrivers.filter(
      d => !busySet.has(d._id.toString())
    );

    // 3. Compute distance and ranking score for each driver
    const rankedList = [];

    for (const driver of availableDrivers) {
      const driverLat = driver.currentLocation?.latitude || pickupLat;
      const driverLng = driver.currentLocation?.longitude || pickupLng;
      const distanceKm = this.calculateDistance(pickupLat, pickupLng, driverLat, driverLng);

      if (distanceKm <= maxRadiusKm) {
        const rating = Number(driver.rating) || 5.0;
        const acceptanceRate = Number(driver.acceptanceRate) || 100;

        // Composite scoring formula: lower score = higher priority
        // Score = (Distance in km * 10) - (Rating * 5) - (AcceptanceRate * 0.1)
        const score = (distanceKm * 10) - (rating * 5) - (acceptanceRate * 0.1);

        rankedList.push({
          driver,
          distanceKm,
          rating,
          acceptanceRate,
          score
        });
      }
    }

    // Sort ascending by score (closest + highest rated)
    rankedList.sort((a, b) => a.score - b.score);
    return rankedList;
  }

  /**
   * Start sequential 30-second driver dispatch
   */
  static async startSequentialDispatch(bookingId, io) {
    const booking = await Booking.findById(bookingId).populate('customerId', 'name phone rating profileImage');
    if (!booking || !['SEARCHING_DRIVER', 'searching', 'REQUESTED'].includes(booking.status)) {
      return;
    }

    // List of drivers already notified for this booking
    const alreadyContacted = (booking.rideRequests || []).map(r => r.driverId.toString());

    // Find next ranked candidate driver
    const rankedCandidates = await this.findRankedDrivers({
      pickupLocation: booking.pickupLocation,
      vehicleType: booking.vehicleType,
      excludeDriverIds: alreadyContacted,
      maxRadiusKm: 15
    });

    if (rankedCandidates.length === 0) {
      // If no drivers available, check if we should transition to NO_DRIVER_FOUND
      console.log(`⚠️ No available drivers found for Ride #${booking.rideNumber || booking._id}`);
      
      booking.status = 'NO_DRIVER_FOUND';
      booking.statusHistory.push({
        fromStatus: 'SEARCHING_DRIVER',
        toStatus: 'NO_DRIVER_FOUND',
        changedByRole: 'SYSTEM',
        reason: 'All available drivers contacted or no drivers within radius',
        timestamp: new Date()
      });
      await booking.save();

      if (io) {
        io.emit('no-drivers-found', {
          bookingId: booking._id,
          rideNumber: booking.rideNumber,
          customerId: booking.customerId?._id || booking.customerId
        });
      }
      return;
    }

    const nextTarget = rankedCandidates[0];
    const targetDriver = nextTarget.driver;
    const timeoutSec = 30;
    const expiresAt = new Date(Date.now() + timeoutSec * 1000);

    // 1. Record rideRequest attempt in booking
    booking.rideRequests.push({
      driverId: targetDriver._id,
      status: 'PENDING',
      sentAt: new Date(),
      expiresAt,
      driverDistanceKm: nextTarget.distanceKm,
      estimatedEarnings: booking.fareBreakdown?.driverEarnings || booking.estimatedFare
    });
    booking.matchingAttempts = (booking.matchingAttempts || 0) + 1;
    await booking.save();

    console.log(
      `📢 [Dispatch Attempt ${booking.matchingAttempts}] Dispatching Ride #${booking.rideNumber} to driver ${targetDriver.name} (${targetDriver._id}) — Distance: ${nextTarget.distanceKm}km, Timeout: ${timeoutSec}s`
    );

    // 2. Emit dedicated high-priority countdown event to driver socket
    if (io) {
      const dispatchPayload = {
        bookingId: booking._id,
        rideNumber: booking.rideNumber,
        pickup: booking.pickupLocation?.address || 'Pickup Location',
        dropoff: booking.dropoffLocation?.address || 'Dropoff Location',
        pickupCoordinates: booking.pickupLocation?.latitude ? {
          lat: booking.pickupLocation.latitude,
          lng: booking.pickupLocation.longitude
        } : null,
        dropoffCoordinates: booking.dropoffLocation?.latitude ? {
          lat: booking.dropoffLocation.latitude,
          lng: booking.dropoffLocation.longitude
        } : null,
        fare: booking.estimatedFare,
        fareBreakdown: booking.fareBreakdown,
        distance: `${booking.estimatedDistance} km`,
        duration: `${booking.estimatedDuration} min`,
        driverDistanceKm: nextTarget.distanceKm,
        vehicleType: booking.vehicleType,
        paymentMethod: booking.paymentMethod,
        customer: {
          name: booking.customerId?.name || 'Customer',
          rating: booking.customerId?.rating || 5.0,
          phone: booking.customerId?.phone
        },
        timeoutSec,
        expiresAt
      };

      // Direct message to targeted driver
      io.emit(`ride-request-driver-${targetDriver._id}`, dispatchPayload);
      // General broadcast fallback
      io.emit('new-ride-available', dispatchPayload);
    }

    // 3. Set 30-Second Countdown Timeout
    if (activeDispatchTimers.has(booking._id.toString())) {
      clearTimeout(activeDispatchTimers.get(booking._id.toString()));
    }

    const timer = setTimeout(async () => {
      activeDispatchTimers.delete(booking._id.toString());
      
      // Check if booking was accepted during the 30s window
      const freshBooking = await Booking.findById(booking._id);
      if (!freshBooking || !['SEARCHING_DRIVER', 'searching', 'REQUESTED'].includes(freshBooking.status)) {
        return; // Ride was accepted or cancelled, stop dispatch loop
      }

      // Mark the current attempt as EXPIRED
      const lastRequest = freshBooking.rideRequests[freshBooking.rideRequests.length - 1];
      if (lastRequest && lastRequest.status === 'PENDING') {
        lastRequest.status = 'EXPIRED';
        lastRequest.respondedAt = new Date();
        await freshBooking.save();
      }

      console.log(`⏱️ 30s Timeout expired for driver ${targetDriver.name} on Ride #${freshBooking.rideNumber}. Advancing to next driver...`);

      // Dispatch to next candidate
      MatchingService.startSequentialDispatch(booking._id, io);
    }, timeoutSec * 1000);

    activeDispatchTimers.set(booking._id.toString(), timer);
  }

  /**
   * Handle explicit driver rejection — immediately advances to next driver without waiting for 30s timeout
   */
  static async handleDriverRejection(bookingId, driverId, reason = 'Driver declined', io) {
    if (activeDispatchTimers.has(bookingId.toString())) {
      clearTimeout(activeDispatchTimers.get(bookingId.toString()));
      activeDispatchTimers.delete(bookingId.toString());
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) return;

    // Update ride request record
    const reqEntry = booking.rideRequests.find(
      r => r.driverId.toString() === driverId.toString() && r.status === 'PENDING'
    );
    if (reqEntry) {
      reqEntry.status = 'REJECTED';
      reqEntry.rejectionReason = reason;
      reqEntry.respondedAt = new Date();
      await booking.save();
    }

    console.log(`❌ Driver ${driverId} rejected Ride #${booking.rideNumber}. Immediately dispatching to next driver...`);

    // Advance to next driver
    if (['SEARCHING_DRIVER', 'searching', 'REQUESTED'].includes(booking.status)) {
      await this.startSequentialDispatch(bookingId, io);
    }
  }

  /**
   * Cancel active dispatch timer when ride is accepted or cancelled
   */
  static cancelDispatch(bookingId) {
    if (activeDispatchTimers.has(bookingId.toString())) {
      clearTimeout(activeDispatchTimers.get(bookingId.toString()));
      activeDispatchTimers.delete(bookingId.toString());
    }
  }
}

module.exports = MatchingService;
