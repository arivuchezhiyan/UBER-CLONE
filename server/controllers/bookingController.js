const Booking = require('../models/Booking');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');

// Generate 4-digit OTP
const generateOTP = () => Math.floor(1000 + Math.random() * 9000).toString();

// Calculate fare based on distance and vehicle type
const calculateFare = async (vehicleType, distance) => {
  const vehicle = await Vehicle.findOne({ name: vehicleType });
  if (!vehicle) {
    return { baseFare: 50, distanceFare: distance * 12, total: 50 + (distance * 12) };
  }
  
  const baseFare = vehicle.baseFare || 50;
  const distanceFare = distance * vehicle.pricePerKm;
  const total = Math.round(baseFare + distanceFare);
  
  return { baseFare, distanceFare, total, pricePerKm: vehicle.pricePerKm };
};

// Request a ride
const requestRide = async (req, res) => {
  try {
    const { pickupLocation, dropoffLocation, vehicleType, estimatedDistance, estimatedDuration, paymentMethod } = req.body;

    // Calculate estimated fare
    const fareDetails = await calculateFare(vehicleType, estimatedDistance || 5);
    
    const booking = new Booking({
      customerId: req.userId,
      pickupLocation,
      dropoffLocation,
      vehicleType,
      estimatedDistance,
      estimatedDuration,
      estimatedFare: fareDetails.total,
      baseFare: fareDetails.baseFare,
      paymentMethod: paymentMethod || 'cash',
      status: 'searching',
      rideOTP: generateOTP(),
      requestedAt: new Date()
    });

    await booking.save();
    
    // Populate customer details for response
    await booking.populate('customerId', 'name phone rating');
    
    // EMIT SOCKET EVENT to notify all online drivers about new ride
    const io = req.app.get('io');
    if (io) {
      io.emit('new-ride-available', {
        bookingId: booking._id,
        pickup: pickupLocation?.address || 'Pickup Location',
        dropoff: dropoffLocation?.address || 'Dropoff Location',
        pickupCoordinates: pickupLocation?.latitude ? {
          lat: pickupLocation.latitude,
          lng: pickupLocation.longitude
        } : null,
        dropoffCoordinates: dropoffLocation?.latitude ? {
          lat: dropoffLocation.latitude,
          lng: dropoffLocation.longitude
        } : null,
        fare: fareDetails.total,
        distance: `${estimatedDistance || 5} km`,
        duration: `${estimatedDuration || 15} min`,
        vehicleType,
        paymentMethod: paymentMethod || 'cash',
        customer: {
          name: booking.customerId?.name || 'Customer',
          rating: booking.customerId?.rating || 4.5
        },
        requestedAt: booking.requestedAt
      });
      console.log('📢 New ride broadcast to all drivers:', booking._id);
    }
    
    res.status(201).json({
      success: true,
      booking,
      fareDetails
    });
  } catch (error) {
    res.status(500).json({ message: 'Error requesting ride', error: error.message });
  }
};

// Get pending rides for drivers
const getPendingRides = async (req, res) => {
  try {
    const rides = await Booking.find({ status: 'searching' })
      .populate('customerId', 'name phone rating')
      .sort({ requestedAt: -1 })
      .limit(10);
    
    res.json(rides);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching rides', error: error.message });
  }
};

// Accept ride (Driver) - with atomic operation for synchronization
const acceptRide = async (req, res) => {
  try {
    const { bookingId } = req.body;

    // Use findOneAndUpdate with atomic condition to prevent race conditions
    // Only update if status is still 'searching' - this is atomic in MongoDB
    const booking = await Booking.findOneAndUpdate(
      { 
        _id: bookingId, 
        status: 'searching'  // Only accept if still searching
      },
      { 
        driverId: req.userId, 
        status: 'accepted',
        acceptedAt: new Date()
      },
      { new: true }
    ).populate('customerId', 'name phone rating')
     .populate('driverId', 'name phone rating vehicleDetails');

    // If no booking found or already taken
    if (!booking) {
      return res.status(400).json({ 
        success: false,
        message: 'Ride is no longer available. Another driver has accepted it.' 
      });
    }

    // Update driver status
    await User.findByIdAndUpdate(req.userId, { isOnline: true });

    // Emit socket event to notify all other drivers that this ride is taken
    const io = req.app.get('io');
    if (io) {
      io.emit('ride-taken', {
        bookingId: booking._id,
        driverId: req.userId
      });
    }

    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ message: 'Error accepting ride', error: error.message });
  }
};

// Start ride (after driver arrives and verifies OTP)
const startRide = async (req, res) => {
  try {
    const { bookingId, otp } = req.body;

    const booking = await Booking.findById(bookingId);
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check if driver is the one who accepted the ride
    if (booking.driverId?.toString() !== req.userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'You are not assigned to this ride' 
      });
    }
    
    // Check if ride status is 'accepted' - can only start accepted rides
    if (booking.status !== 'accepted') {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot start ride. Current status: ${booking.status}. Ride must be accepted first.`
      });
    }
    
    if (booking.rideOTP !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    booking.status = 'started';
    booking.otpVerified = true;
    booking.startedAt = new Date();
    await booking.save();

    // Emit socket event for ride start
    const io = req.app.get('io');
    if (io) {
      io.emit('ride-started', {
        bookingId: booking._id,
        customerId: booking.customerId,
        driverId: booking.driverId
      });
    }

    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ message: 'Error starting ride', error: error.message });
  }
};

// Complete ride
const completeRide = async (req, res) => {
  try {
    const { bookingId, distance, duration } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check if driver is the one assigned to this ride
    if (booking.driverId?.toString() !== req.userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'You are not assigned to this ride' 
      });
    }

    // Check if ride has been started (OTP verified)
    if (booking.status !== 'started') {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot complete ride. Current status: ${booking.status}. Ride must be started with OTP first.`
      });
    }

    // Calculate actual fare
    const fareDetails = await calculateFare(booking.vehicleType, distance || booking.estimatedDistance);

    booking.status = 'completed';
    booking.completedAt = new Date();
    booking.distance = distance || booking.estimatedDistance;
    booking.duration = duration || booking.estimatedDuration;
    booking.actualFare = fareDetails.total;
    booking.distanceFare = fareDetails.distanceFare;
    
    await booking.save();

    // Update driver earnings
    if (booking.driverId) {
      await User.findByIdAndUpdate(booking.driverId, {
        $inc: { 
          'earnings.today': fareDetails.total,
          'earnings.total': fareDetails.total,
          totalTrips: 1
        }
      });
    }

    // Update customer trip count
    await User.findByIdAndUpdate(booking.customerId, {
      $inc: { totalTrips: 1 }
    });

    // Emit socket event for ride completion
    const io = req.app.get('io');
    if (io) {
      io.emit('ride-completed', {
        bookingId: booking._id,
        customerId: booking.customerId,
        driverId: booking.driverId
      });
    }

    res.json({ success: true, booking, fare: fareDetails.total });
  } catch (error) {
    res.status(500).json({ message: 'Error completing ride', error: error.message });
  }
};

// Cancel ride
const cancelRide = async (req, res) => {
  try {
    const { bookingId, reason, cancelledBy } = req.body;

    // First, find the booking to check its current status
    const existingBooking = await Booking.findById(bookingId);
    
    if (!existingBooking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Check if ride has already started (OTP verified) or completed
    if (existingBooking.status === 'started') {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot cancel ride after it has started. The ride is in progress.' 
      });
    }

    if (existingBooking.status === 'completed') {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot cancel a completed ride.' 
      });
    }

    if (existingBooking.status === 'cancelled') {
      return res.status(400).json({ 
        success: false, 
        message: 'This ride has already been cancelled.' 
      });
    }

    // Driver can only cancel if they are assigned to the ride
    if (cancelledBy === 'driver' && existingBooking.driverId?.toString() !== req.userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'You are not assigned to this ride' 
      });
    }

    // Customer can only cancel their own rides
    if (cancelledBy === 'customer' && existingBooking.customerId?.toString() !== req.userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only cancel your own rides' 
      });
    }

    const booking = await Booking.findByIdAndUpdate(
      bookingId,
      { 
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: reason,
        cancelledBy: cancelledBy || 'customer'
      },
      { new: true }
    );

    // Emit socket event for ride cancellation
    const io = req.app.get('io');
    if (io) {
      io.emit('ride-cancelled', {
        bookingId: booking._id,
        cancelledBy: cancelledBy,
        customerId: booking.customerId,
        driverId: booking.driverId
      });
    }

    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ message: 'Error cancelling ride', error: error.message });
  }
};

// Get user bookings (for customers)
const getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ customerId: req.userId })
      .populate('driverId', 'name phone rating vehicleDetails')
      .sort({ requestedAt: -1 });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching bookings', error: error.message });
  }
};

// Get driver bookings
const getDriverBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ driverId: req.userId })
      .populate('customerId', 'name phone rating')
      .sort({ requestedAt: -1 });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching bookings', error: error.message });
  }
};

// Rate ride
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

    // Update user's average rating
    const userIdToUpdate = ratingType === 'driver' ? booking.driverId : booking.customerId;
    const user = await User.findById(userIdToUpdate);
    
    if (user) {
      const newRatingCount = user.numberOfRatings + 1;
      const newAvgRating = ((user.rating * user.numberOfRatings) + rating) / newRatingCount;
      
      await User.findByIdAndUpdate(userIdToUpdate, {
        rating: Math.round(newAvgRating * 100) / 100,
        numberOfRatings: newRatingCount
      });
    }

    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ message: 'Error rating ride', error: error.message });
  }
};

// Get active ride
const getActiveRide = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      $or: [
        { customerId: req.userId },
        { driverId: req.userId }
      ],
      status: { $in: ['searching', 'accepted', 'arriving', 'started'] }
    })
    .populate('customerId', 'name phone rating')
    .populate('driverId', 'name phone rating vehicleDetails');

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching active ride', error: error.message });
  }
};

module.exports = { 
  requestRide, 
  acceptRide, 
  startRide,
  completeRide, 
  cancelRide,
  getUserBookings, 
  getDriverBookings,
  getPendingRides,
  rateRide,
  getActiveRide
};
