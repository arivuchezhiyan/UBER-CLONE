const Booking = require('../models/Booking');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const Cancellation = require('../models/Cancellation');
const CancellationRule = require('../models/CancellationRule');
const FareCalculator = require('../services/FareCalculator');
const WalletService = require('../services/WalletService');
const MatchingService = require('../services/MatchingService');

// Generate 4-digit OTP
const generateOTP = () => Math.floor(1000 + Math.random() * 9000).toString();

// ============================================================
// 1. REQUEST RIDE (Immediate or Scheduled with Sequential Dispatch)
// ============================================================
const requestRide = async (req, res) => {
  try {
    const {
      pickupLocation,
      dropoffLocation,
      vehicleType = 'UberGo',
      estimatedDistance = 5,
      estimatedDuration = 15,
      paymentMethod = 'cash',
      rideType = 'IMMEDIATE',
      scheduledDate,
      scheduledTime,
      promoCode = null,
      specialRequests
    } = req.body;

    // 1. Check if rider already has an active ride in progress
    const activeRide = await Booking.findOne({
      customerId: req.userId,
      status: {
        $in: [
          'REQUESTED',
          'SEARCHING_DRIVER',
          'DRIVER_ASSIGNED',
          'DRIVER_ARRIVING',
          'DRIVER_ARRIVED',
          'TRIP_STARTED'
        ]
      }
    });

    if (activeRide && rideType === 'IMMEDIATE') {
      return res.status(400).json({
        success: false,
        message: 'You already have an active ride request in progress',
        activeBookingId: activeRide._id,
        status: activeRide.status
      });
    }

    // 2. Compute full fare breakdown via FareCalculator
    const fareBreakdown = await FareCalculator.calculateFare({
      vehicleCategory: vehicleType,
      distanceKm: estimatedDistance,
      durationMin: estimatedDuration,
      isScheduled: rideType === 'SCHEDULED',
      promoCode
    });

    const isScheduled = rideType === 'SCHEDULED' && scheduledDate;

    // 3. Create Booking Document with 16-state machine
    const booking = new Booking({
      customerId: req.userId,
      pickupLocation,
      dropoffLocation,
      vehicleType,
      rideType: isScheduled ? 'SCHEDULED' : 'IMMEDIATE',
      distanceType: estimatedDistance >= 50 ? 'LONG' : 'SHORT',
      estimatedDistance,
      estimatedDuration,
      estimatedFare: fareBreakdown.totalFare,
      fareBreakdown,
      paymentMethod,
      status: isScheduled ? 'REQUESTED' : 'SEARCHING_DRIVER',
      rideOTP: generateOTP(),
      specialRequests,
      requestedAt: new Date(),
      statusHistory: [{
        fromStatus: null,
        toStatus: isScheduled ? 'REQUESTED' : 'SEARCHING_DRIVER',
        changedBy: req.userId,
        changedByRole: 'RIDER',
        reason: isScheduled ? 'Scheduled ride requested' : 'Immediate ride search initiated',
        timestamp: new Date()
      }]
    });

    if (isScheduled) {
      booking.scheduledRide = {
        scheduledDate: new Date(scheduledDate),
        scheduledTime,
        scheduledAt: new Date(`${scheduledDate}T${scheduledTime || '00:00:00'}`),
        status: 'CONFIRMED'
      };
    }

    await booking.save();
    await booking.populate('customerId', 'name phone rating profileImage');

    const io = req.app.get('io');

    // 4. Start Sequential 30s Driver Dispatch if immediate ride
    if (!isScheduled) {
      MatchingService.startSequentialDispatch(booking._id, io);
    }

    res.status(201).json({
      success: true,
      booking,
      fareDetails: fareBreakdown
    });
  } catch (error) {
    console.error('Error requesting ride:', error);
    res.status(500).json({ success: false, message: 'Error requesting ride', error: error.message });
  }
};

// ============================================================
// 2. GET PENDING RIDES (For Drivers)
// ============================================================
const getPendingRides = async (req, res) => {
  try {
    const rides = await Booking.find({
      status: { $in: ['SEARCHING_DRIVER', 'searching'] }
    })
      .populate('customerId', 'name phone rating profileImage')
      .sort({ requestedAt: -1 })
      .limit(15);

    res.json(rides);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching rides', error: error.message });
  }
};

// ============================================================
// 3. ACCEPT RIDE (Driver) — 3-Layer Race Condition Safe
// ============================================================
const acceptRide = async (req, res) => {
  try {
    const { bookingId } = req.body;

    // Check if driver is already on another active ride
    const driverActiveRide = await Booking.findOne({
      driverId: req.userId,
      status: { $in: ['DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'TRIP_STARTED'] }
    });

    if (driverActiveRide) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active assigned ride. Complete it before accepting a new one.'
      });
    }

    // ATOMIC RACE CONDITION DEFENSE:
    // Only accept if status is SEARCHING_DRIVER (or legacy 'searching') and no driver is assigned
    const booking = await Booking.findOneAndUpdate(
      {
        _id: bookingId,
        status: { $in: ['SEARCHING_DRIVER', 'searching', 'REQUESTED'] },
        driverId: null
      },
      {
        $set: {
          driverId: req.userId,
          status: 'DRIVER_ASSIGNED',
          acceptedAt: new Date(),
          updatedAt: new Date()
        },
        $push: {
          statusHistory: {
            fromStatus: 'SEARCHING_DRIVER',
            toStatus: 'DRIVER_ASSIGNED',
            changedBy: req.userId,
            changedByRole: 'DRIVER',
            reason: 'Driver accepted ride request',
            timestamp: new Date()
          }
        },
        $inc: { version: 1 }
      },
      { new: true }
    )
      .populate('customerId', 'name phone rating profileImage')
      .populate('driverId', 'name phone rating vehicleDetails profileImage');

    if (!booking) {
      return res.status(400).json({
        success: false,
        message: 'Ride is no longer available. Another driver has already accepted it or it was cancelled.'
      });
    }

    // Cancel sequential dispatch timer
    MatchingService.cancelDispatch(bookingId);

    // Update driver status to online
    await User.findByIdAndUpdate(req.userId, { isOnline: true });

    // Broadcast ride-taken to prevent duplicate driver attempts
    const io = req.app.get('io');
    if (io) {
      io.emit('ride-taken', {
        bookingId: booking._id,
        driverId: req.userId,
        status: 'DRIVER_ASSIGNED'
      });

      // Direct message to customer that driver is assigned
      io.emit(`ride-status-${booking.customerId?._id || booking.customerId}`, {
        bookingId: booking._id,
        status: 'DRIVER_ASSIGNED',
        driver: {
          name: booking.driverId?.name,
          phone: booking.driverId?.phone,
          rating: booking.driverId?.rating,
          vehicleDetails: booking.driverId?.vehicleDetails
        }
      });
    }

    res.json({ success: true, booking });
  } catch (error) {
    console.error('Error accepting ride:', error);
    res.status(500).json({ success: false, message: 'Error accepting ride', error: error.message });
  }
};

// ============================================================
// 4. REJECT RIDE (Driver declines targeted request)
// ============================================================
const rejectRide = async (req, res) => {
  try {
    const { bookingId, reason = 'Driver declined' } = req.body;
    const io = req.app.get('io');

    await MatchingService.handleDriverRejection(bookingId, req.userId, reason, io);

    res.json({ success: true, message: 'Ride request declined. Dispatched to next available driver.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error declining ride', error: error.message });
  }
};

// ============================================================
// 5. DRIVER ARRIVED AT PICKUP
// ============================================================
const driverArrived = async (req, res) => {
  try {
    const { bookingId } = req.body;

    const booking = await Booking.findOne({
      _id: bookingId,
      driverId: req.userId,
      status: { $in: ['DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'accepted', 'arriving'] }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Active assigned booking not found' });
    }

    booking.status = 'DRIVER_ARRIVED';
    booking.driverArrivedAt = new Date();
    booking.statusHistory.push({
      fromStatus: 'DRIVER_ARRIVING',
      toStatus: 'DRIVER_ARRIVED',
      changedBy: req.userId,
      changedByRole: 'DRIVER',
      reason: 'Driver arrived at pickup point',
      timestamp: new Date()
    });

    await booking.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('driver-arrived', {
        bookingId: booking._id,
        customerId: booking.customerId
      });
    }

    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating arrival status', error: error.message });
  }
};

// ============================================================
// 6. START RIDE (OTP Verification)
// ============================================================
const startRide = async (req, res) => {
  try {
    const { bookingId, otp } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.driverId?.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: 'You are not the assigned driver for this ride' });
    }

    const validStartStatuses = ['DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'accepted', 'arriving'];
    if (!validStartStatuses.includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot start ride in '${booking.status}' status.`
      });
    }

    if (booking.rideOTP !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP. Please verify with customer.' });
    }

    booking.status = 'TRIP_STARTED';
    booking.otpVerified = true;
    booking.startedAt = new Date();
    booking.statusHistory.push({
      fromStatus: booking.status,
      toStatus: 'TRIP_STARTED',
      changedBy: req.userId,
      changedByRole: 'DRIVER',
      reason: 'OTP verified, trip started',
      timestamp: new Date()
    });

    await booking.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('ride-started', {
        bookingId: booking._id,
        customerId: booking.customerId,
        driverId: booking.driverId,
        startedAt: booking.startedAt
      });
    }

    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error starting ride', error: error.message });
  }
};

// ============================================================
// 7. COMPLETE RIDE & DOUBLE-ENTRY FINANCIAL SETTLEMENT
// ============================================================
const completeRide = async (req, res) => {
  try {
    const {
      bookingId,
      distance,
      duration,
      waitingTimeMin = 0,
      tollAmount = 0,
      parkingAmount = 0
    } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.driverId?.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this ride' });
    }

    if (!['TRIP_STARTED', 'started'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot complete ride in '${booking.status}' status. Ride must be in progress (OTP verified).`
      });
    }

    const actualDistance = Number(distance) || booking.estimatedDistance || 5;
    const actualDuration = Number(duration) || booking.estimatedDuration || 15;

    // 1. Calculate actual finalized fare breakdown
    const finalFareBreakdown = await FareCalculator.calculateFare({
      vehicleCategory: booking.vehicleType || 'UberGo',
      distanceKm: actualDistance,
      durationMin: actualDuration,
      waitingTimeMin,
      tollAmount,
      parkingAmount,
      isScheduled: booking.rideType === 'SCHEDULED',
      promoCode: booking.fareBreakdown?.promoCode
    });

    finalFareBreakdown.isFinalized = true;
    finalFareBreakdown.finalizedAt = new Date();

    // 2. Update booking status to TRIP_COMPLETED / PAYMENT_COMPLETED
    booking.status = 'TRIP_COMPLETED';
    booking.completedAt = new Date();
    booking.distance = actualDistance;
    booking.duration = actualDuration;
    booking.actualFare = finalFareBreakdown.totalFare;
    booking.fareBreakdown = finalFareBreakdown;
    booking.waitingTimeMin = waitingTimeMin;
    booking.tollAmount = tollAmount;
    booking.parkingAmount = parkingAmount;

    booking.statusHistory.push({
      fromStatus: 'TRIP_STARTED',
      toStatus: 'TRIP_COMPLETED',
      changedBy: req.userId,
      changedByRole: 'DRIVER',
      reason: 'Trip completed by driver',
      timestamp: new Date()
    });

    // 3. Financial settlement via Double-Entry Driver Ledger
    if (booking.paymentMethod === 'cash') {
      // CASH: Driver collects full cash, platform commission is debited from driver ledger
      booking.paymentStatus = 'cash_collected';
      await WalletService.debitCashCommission(
        booking.driverId,
        booking._id,
        finalFareBreakdown.platformCommission,
        booking.rideNumber
      );
    } else {
      // ONLINE / WALLET / CARD: Driver receives full earnings credited to wallet
      booking.paymentStatus = 'completed';
      await WalletService.creditRideEarnings(
        booking.driverId,
        booking._id,
        finalFareBreakdown.driverEarnings,
        booking.rideNumber
      );
    }

    booking.status = 'SETTLED';
    await booking.save();

    // 4. Update driver & customer lifetime metrics
    await User.findByIdAndUpdate(booking.driverId, {
      $inc: {
        'earnings.today': finalFareBreakdown.driverEarnings,
        'earnings.total': finalFareBreakdown.driverEarnings,
        totalTrips: 1
      }
    });

    await User.findByIdAndUpdate(booking.customerId, {
      $inc: { totalTrips: 1 }
    });

    // 5. Emit real-time completion event
    const io = req.app.get('io');
    if (io) {
      io.emit('ride-completed', {
        bookingId: booking._id,
        rideNumber: booking.rideNumber,
        customerId: booking.customerId,
        driverId: booking.driverId,
        fare: finalFareBreakdown.totalFare,
        fareBreakdown: finalFareBreakdown,
        paymentMethod: booking.paymentMethod
      });
    }

    res.json({
      success: true,
      booking,
      fare: finalFareBreakdown.totalFare,
      fareBreakdown: finalFareBreakdown
    });
  } catch (error) {
    console.error('Error completing ride:', error);
    res.status(500).json({ success: false, message: 'Error completing ride', error: error.message });
  }
};

// ============================================================
// 8. CANCEL RIDE (With Cancellation Fee Evaluation & Dispatch Cancellation)
// ============================================================
const cancelRide = async (req, res) => {
  try {
    const { bookingId, reason = 'No reason specified', reasonCode = 'OTHER', cancelledBy = 'customer' } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (['TRIP_STARTED', 'TRIP_COMPLETED', 'SETTLED', 'started', 'completed'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel ride in '${booking.status}' status.`
      });
    }

    if (['CANCELLED_BY_RIDER', 'CANCELLED_BY_DRIVER', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'This ride is already cancelled.' });
    }

    // Cancel any active sequential driver dispatch timer
    MatchingService.cancelDispatch(bookingId);

    const previousStatus = booking.status;
    const newStatus = cancelledBy === 'driver' ? 'CANCELLED_BY_DRIVER' : 'CANCELLED_BY_RIDER';

    // Calculate cancellation fee if driver was already assigned for > 3 minutes
    let fee = 0;
    if (previousStatus === 'DRIVER_ASSIGNED' || previousStatus === 'DRIVER_ARRIVING' || previousStatus === 'DRIVER_ARRIVED') {
      const minutesSinceAssignment = booking.acceptedAt
        ? (Date.now() - new Date(booking.acceptedAt).getTime()) / (1000 * 60)
        : 0;

      if (minutesSinceAssignment > 3 && cancelledBy === 'customer') {
        fee = 50; // Standard flat cancellation fee
      }
    }

    booking.status = newStatus;
    booking.cancelledAt = new Date();
    booking.cancellationReason = reason;
    booking.cancellationReasonCode = reasonCode;
    booking.cancelledBy = cancelledBy;
    booking.cancellationFee = fee;
    booking.statusAtCancellation = previousStatus;

    booking.statusHistory.push({
      fromStatus: previousStatus,
      toStatus: newStatus,
      changedBy: req.userId,
      changedByRole: cancelledBy === 'driver' ? 'DRIVER' : 'RIDER',
      reason,
      timestamp: new Date()
    });

    await booking.save();

    // Record formal cancellation audit log
    const cancellationRecord = new Cancellation({
      rideId: booking._id,
      cancelledBy: req.userId,
      cancelledByRole: cancelledBy === 'driver' ? 'DRIVER' : 'RIDER',
      reason,
      reasonCode,
      cancellationFee: fee,
      statusAtCancellation: previousStatus
    });
    await cancellationRecord.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('ride-cancelled', {
        bookingId: booking._id,
        cancelledBy,
        reason,
        fee,
        customerId: booking.customerId,
        driverId: booking.driverId
      });
    }

    res.json({ success: true, booking, cancellationFee: fee });
  } catch (error) {
    console.error('Error cancelling ride:', error);
    res.status(500).json({ success: false, message: 'Error cancelling ride', error: error.message });
  }
};

// ============================================================
// 9. RECORD GPS BREADCRUMB
// ============================================================
const recordLocation = async (req, res) => {
  try {
    const { bookingId, latitude, longitude, heading = 0, speed = 0 } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    booking.routeCoordinates.push({
      latitude,
      longitude,
      heading,
      speed,
      recordedAt: new Date(),
      source: 'DRIVER'
    });

    await booking.save();

    res.json({ success: true, count: booking.routeCoordinates.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error recording GPS breadcrumb', error: error.message });
  }
};

// ============================================================
// 10. GET USER BOOKINGS
// ============================================================
const getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ customerId: req.userId })
      .populate('driverId', 'name phone rating vehicleDetails profileImage')
      .sort({ requestedAt: -1 });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching bookings', error: error.message });
  }
};

// ============================================================
// 11. GET DRIVER BOOKINGS
// ============================================================
const getDriverBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ driverId: req.userId })
      .populate('customerId', 'name phone rating profileImage')
      .sort({ requestedAt: -1 });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching driver bookings', error: error.message });
  }
};

// ============================================================
// 12. RATE RIDE
// ============================================================
const rateRide = async (req, res) => {
  try {
    const { bookingId, rating, feedback, ratingType } = req.body;

    const updateField = ratingType === 'driver' ? 'driverRating' : 'customerRating';
    const feedbackField = ratingType === 'driver' ? 'driverFeedback' : 'customerFeedback';

    const booking = await Booking.findByIdAndUpdate(
      bookingId,
      { [updateField]: rating, [feedbackField]: feedback },
      { new: true }
    );

    const userIdToUpdate = ratingType === 'driver' ? booking.driverId : booking.customerId;
    const user = await User.findById(userIdToUpdate);

    if (user) {
      const newRatingCount = (user.numberOfRatings || 0) + 1;
      const currentRating = user.rating || 5.0;
      const newAvgRating = ((currentRating * (user.numberOfRatings || 0)) + Number(rating)) / newRatingCount;

      await User.findByIdAndUpdate(userIdToUpdate, {
        rating: Math.round(newAvgRating * 100) / 100,
        numberOfRatings: newRatingCount
      });
    }

    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error rating ride', error: error.message });
  }
};

// ============================================================
// 13. GET ACTIVE RIDE
// ============================================================
const getActiveRide = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      $or: [{ customerId: req.userId }, { driverId: req.userId }],
      status: {
        $in: [
          'REQUESTED',
          'SEARCHING_DRIVER',
          'DRIVER_ASSIGNED',
          'DRIVER_ARRIVING',
          'DRIVER_ARRIVED',
          'TRIP_STARTED',
          'PAYMENT_PENDING',
          'searching',
          'accepted',
          'arriving',
          'started'
        ]
      }
    })
      .populate('customerId', 'name phone rating profileImage')
      .populate('driverId', 'name phone rating vehicleDetails profileImage');

    res.json(booking);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching active ride', error: error.message });
  }
};

module.exports = {
  requestRide,
  acceptRide,
  rejectRide,
  driverArrived,
  startRide,
  completeRide,
  cancelRide,
  recordLocation,
  getUserBookings,
  getDriverBookings,
  getPendingRides,
  rateRide,
  getActiveRide
};
