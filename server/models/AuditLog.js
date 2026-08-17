const mongoose = require('mongoose');

// ============================================================
// AUDIT LOG — System and Admin Action Logging
// Mirrors PICKME schema: table 30 (audit_log)
// ============================================================
const auditLogSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  entityType: { type: String, required: true }, // e.g. 'DRIVER', 'RIDE', 'PRICING', 'PAYMENT'
  entityId: mongoose.Schema.Types.ObjectId,
  previousValue: mongoose.Schema.Types.Mixed,
  newValue: mongoose.Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String,
  description: String,
  createdAt: { type: Date, default: Date.now }
});

auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ adminId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
