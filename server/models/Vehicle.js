const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  // For ride type vehicles (UberGo, Premier, etc.)
  name: { type: String },
  type: { type: String, enum: ['sedan', 'suv', 'auto', 'bike', 'economy', 'comfort', 'premium'] },
  pricePerKm: { type: Number, required: true },
  baseFare: { type: Number, default: 50 },
  image: { type: String },
  capacity: { type: Number, default: 4 },
  description: { type: String },
  
  // For driver-owned vehicles
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  licensePlate: { type: String },
  model: { type: String },
  year: { type: Number },
  seats: { type: Number, default: 4 },
  pricePerHour: { type: Number },
  isActive: { type: Boolean, default: true },
  currentLocation: {
    latitude: Number,
    longitude: Number,
  },
  documents: {
    registrationCertificate: String,
    insurance: String,
    inspection: String,
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Vehicle', vehicleSchema);
