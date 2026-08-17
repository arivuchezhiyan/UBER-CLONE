const mongoose = require('mongoose');

// ============================================================
// SUPPORT TICKET — Customer & Driver Support Management
// Mirrors PICKME schema: table 29 (support_ticket)
// ============================================================
const supportTicketSchema = new mongoose.Schema({
  ticketNumber: { type: String, unique: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByRole: { type: String, enum: ['RIDER', 'DRIVER'], required: true },
  rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },

  category: {
    type: String,
    enum: ['FARE_DISPUTE', 'LOST_ITEM', 'DRIVER_BEHAVIOR', 'APP_ISSUE', 'PAYMENT_FAILURE', 'OTHER'],
    default: 'OTHER'
  },
  subject: { type: String, required: true },
  description: { type: String, required: true },

  status: {
    type: String,
    enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    default: 'OPEN'
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    default: 'MEDIUM'
  },

  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolution: String,
  resolvedAt: Date,

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

supportTicketSchema.pre('save', function(next) {
  if (!this.ticketNumber) {
    this.ticketNumber = `TCK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
  }
  this.updatedAt = new Date();
  next();
});

supportTicketSchema.index({ ticketNumber: 1 }, { unique: true });
supportTicketSchema.index({ createdBy: 1, status: 1 });
supportTicketSchema.index({ status: 1, priority: 1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
