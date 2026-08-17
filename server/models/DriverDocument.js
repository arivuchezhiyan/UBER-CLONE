const mongoose = require('mongoose');

// ============================================================
// DRIVER DOCUMENT — Licence, Aadhaar, RC, Insurance
// Mirrors PICKME schema: table 4 (driver_document)
// ============================================================
const driverDocumentSchema = new mongoose.Schema({
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  documentType: {
    type: String,
    enum: [
      'DRIVING_LICENCE',
      'AADHAAR',
      'PAN',
      'VEHICLE_RC',
      'INSURANCE',
      'PERMIT',
      'POLLUTION',
      'PHOTO'
    ],
    required: true
  },
  documentNumber: String,
  fileUrl: { type: String, required: true },
  fileName: String,
  fileSize: Number,
  mimeType: String,
  expiryDate: Date,

  verificationStatus: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: Date,
  rejectionReason: String,

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

driverDocumentSchema.index({ driverId: 1, documentType: 1 });
driverDocumentSchema.index({ verificationStatus: 1 });

module.exports = mongoose.model('DriverDocument', driverDocumentSchema);
