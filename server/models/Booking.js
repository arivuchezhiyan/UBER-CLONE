const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  vehicleType: { type: String }, // UberGo, Premier, etc.
  
  pickupLocation: {
    address: { type: String, required: true },
    latitude: Number,
    longitude: Number,
  },
  dropoffLocation: {
    address: { type: String, required: true },
    latitude: Number,
    longitude: Number,
  },
  
  // Timing
  requestedAt: { type: Date, default: Date.now },
  acceptedAt: Date,
  startedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  
  // Ride details
  status: { 
    type: String, 
    enum: ['pending', 'searching', 'accepted', 'arriving', 'started', 'completed', 'cancelled'],
    default: 'pending'
  },
  
  // Fare calculation
  estimatedFare: { type: Number },
  actualFare: { type: Number },
  baseFare: { type: Number },
  distanceFare: { type: Number },
  timeFare: { type: Number },
  surgePricing: { type: Number, default: 1 },
  discount: { type: Number, default: 0 },
  
  // Trip metrics
  distance: { type: Number }, // in km
  duration: { type: Number }, // in minutes
  estimatedDistance: { type: Number },
  estimatedDuration: { type: Number },
  
  // Payment
  paymentMethod: { type: String, enum: ['cash', 'card', 'wallet', 'upi'], default: 'cash' },
  paymentStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  
  // Ratings
  customerRating: { type: Number, min: 1, max: 5 },
  driverRating: { type: Number, min: 1, max: 5 },
  customerFeedback: String,
  driverFeedback: String,
  
  // Additional info
  specialRequests: String,
  cancellationReason: String,
  cancelledBy: { type: String, enum: ['customer', 'driver', 'system'] },
  
  // OTP for ride verification
  rideOTP: { type: String },
  otpVerified: { type: Boolean, default: false },
  
  createdAt: { type: Date, default: Date.now },
});

// Index for faster queries
bookingSchema.index({ customerId: 1, status: 1 });
bookingSchema.index({ driverId: 1, status: 1 });
bookingSchema.index({ status: 1, requestedAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);
