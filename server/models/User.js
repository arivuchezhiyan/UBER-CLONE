const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, sparse: true },
  password: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  userType: { type: String, enum: ['customer', 'driver', 'admin'], required: true },
  role: { type: String, enum: ['USER', 'DRIVER', 'ADMIN', 'SUPER_ADMIN'], default: 'USER' },
  profileImage: String,
  address: String,
  
  // Rating system
  rating: { type: Number, default: 5.0, min: 1, max: 5 },
  numberOfRatings: { type: Number, default: 0 },
  totalTrips: { type: Number, default: 0 },
  
  // Driver specific fields & Approval Workflow
  approvalStatus: { 
    type: String, 
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'], 
    default: 'APPROVED' // Default approved for backward compatibility, new drivers will be pending
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  rejectionReason: String,
  suspensionReason: String,

  isOnline: { type: Boolean, default: false },
  currentLocation: {
    latitude: Number,
    longitude: Number,
    lastUpdated: Date
  },
  vehicleDetails: {
    model: String,
    licensePlate: String,
    color: String
  },
  earnings: {
    today: { type: Number, default: 0 },
    weekly: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  acceptanceRate: { type: Number, default: 100 },
  cancellationRate: { type: Number, default: 0 },
  
  // Driver UPI for receiving payments
  upiId: { type: String, default: '' },
  
  // Driver wallet for online payments
  driverWallet: { type: Number, default: 0 },
  
  // Withdrawal history
  withdrawals: [{
    amount: Number,
    phone: String,
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    transactionId: String,
    requestedAt: { type: Date, default: Date.now },
    completedAt: Date
  }],
  
  // Payment methods
  paymentMethods: [{
    id: String,
    type: { type: String, enum: ['card', 'upi', 'wallet'] },
    details: {
      last4: String,
      brand: String,
      expiry: String,
      upiId: String
    },
    isDefault: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],
  
  // Wallet
  walletBalance: { type: Number, default: 0 },
  
  // Saved places
  savedPlaces: [{
    name: String,
    address: String,
    latitude: Number,
    longitude: Number,
    type: { type: String, enum: ['home', 'work', 'other'] }
  }],
  
  // Account status & Admin moderation
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  isBlocked: { type: Boolean, default: false },
  blockedReason: String,
  
  // Password reset
  resetOTP: String,
  resetOTPExpiry: Date,
  
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date }
});

userSchema.index({ phone: 1 }, { unique: true });
userSchema.index({ email: 1 }, { sparse: true });
userSchema.index({ userType: 1, isOnline: 1 });
userSchema.index({ approvalStatus: 1 });

module.exports = mongoose.model('User', userSchema);
