const User = require('../models/User');
const Booking = require('../models/Booking');
const FareRule = require('../models/FareRule');
const FareModifier = require('../models/FareModifier');
const DriverWallet = require('../models/DriverWallet');
const WalletTransaction = require('../models/WalletTransaction');
const DriverDocument = require('../models/DriverDocument');
const SupportTicket = require('../models/SupportTicket');
const AuditLog = require('../models/AuditLog');

// ============================================================
// 1. DASHBOARD OVERVIEW & METRICS
// ============================================================
const getDashboardStats = async (req, res) => {
  try {
    const totalRides = await Booking.countDocuments();
    const activeRides = await Booking.countDocuments({
      status: { $in: ['REQUESTED', 'SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'TRIP_STARTED'] }
    });
    const completedRides = await Booking.countDocuments({
      status: { $in: ['TRIP_COMPLETED', 'SETTLED', 'completed'] }
    });
    const cancelledRides = await Booking.countDocuments({
      status: { $in: ['CANCELLED_BY_RIDER', 'CANCELLED_BY_DRIVER', 'EXPIRED', 'cancelled'] }
    });

    const totalDrivers = await User.countDocuments({ userType: 'driver' });
    const onlineDrivers = await User.countDocuments({ userType: 'driver', isOnline: true });
    const pendingApprovals = await User.countDocuments({ userType: 'driver', approvalStatus: 'PENDING' });
    const totalCustomers = await User.countDocuments({ userType: 'customer' });

    // Financial calculations
    const wallets = await DriverWallet.find();
    let totalDriverEarnings = 0;
    let totalPlatformCommission = 0;
    let totalPaidOut = 0;

    for (const w of wallets) {
      totalDriverEarnings += (Number(w.totalEarned) || 0);
      totalPlatformCommission += (Number(w.totalCommissionPaid) || 0);
      totalPaidOut += (Number(w.totalPaidOut) || 0);
    }

    // Recent 5 rides for activity stream
    const recentRides = await Booking.find()
      .sort({ requestedAt: -1 })
      .limit(5)
      .populate('customerId', 'name phone')
      .populate('driverId', 'name phone');

    // Recent 5 audit logs
    const recentLogs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('adminId', 'name');

    res.json({
      success: true,
      stats: {
        totalRides,
        activeRides,
        completedRides,
        cancelledRides,
        totalDrivers,
        onlineDrivers,
        pendingApprovals,
        totalCustomers,
        totalDriverEarnings,
        totalPlatformCommission,
        totalPaidOut
      },
      recentRides,
      recentLogs
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error loading dashboard stats', error: error.message });
  }
};

// ============================================================
// 2. DRIVERS MANAGEMENT & APPROVAL WORKFLOW
// ============================================================
const getDrivers = async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = { userType: 'driver' };

    if (status && status !== 'ALL') {
      filter.approvalStatus = status;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { 'vehicleDetails.licensePlate': { $regex: search, $options: 'i' } }
      ];
    }

    const drivers = await User.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: drivers.length, drivers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching drivers', error: error.message });
  }
};

const updateDriverStatus = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { status, reason } = req.body;

    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status: ${status}` });
    }

    const driver = await User.findById(driverId);
    if (!driver || driver.userType !== 'driver') {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }

    const oldStatus = driver.approvalStatus;
    driver.approvalStatus = status;
    if (status === 'APPROVED') {
      driver.approvedBy = req.userId;
      driver.approvedAt = new Date();
    } else if (status === 'REJECTED') {
      driver.rejectionReason = reason;
    } else if (status === 'SUSPENDED') {
      driver.suspensionReason = reason;
      driver.isOnline = false;
    }
    await driver.save();

    // Audit log
    await AuditLog.create({
      adminId: req.userId,
      action: `DRIVER_${status}`,
      entityType: 'DRIVER',
      entityId: driver._id,
      previousValue: { approvalStatus: oldStatus },
      newValue: { approvalStatus: status, reason },
      description: `Admin updated driver ${driver.name} status from ${oldStatus} to ${status}`
    });

    res.json({ success: true, driver, message: `Driver status updated to ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating driver status', error: error.message });
  }
};

// ============================================================
// 3. DRIVER DOCUMENTS VERIFICATION
// ============================================================
const getDriverDocuments = async (req, res) => {
  try {
    const { driverId } = req.params;
    const documents = await DriverDocument.find({ driverId }).sort({ createdAt: -1 });
    res.json({ success: true, documents });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching documents', error: error.message });
  }
};

const verifyDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { status, reason } = req.body;

    const doc = await DriverDocument.findById(documentId);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    doc.verificationStatus = status;
    doc.verifiedBy = req.userId;
    doc.verifiedAt = new Date();
    if (reason) doc.rejectionReason = reason;
    await doc.save();

    // Audit log
    await AuditLog.create({
      adminId: req.userId,
      action: `DOCUMENT_${status}`,
      entityType: 'DOCUMENT',
      entityId: doc._id,
      description: `Verified document ${doc.documentType} for driver ${doc.driverId}`
    });

    res.json({ success: true, document: doc });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error verifying document', error: error.message });
  }
};

// ============================================================
// 4. RIDES MONITORING & EMERGENCY ACTIONS
// ============================================================
const getRides = async (req, res) => {
  try {
    const { status, limit = 20, page = 1 } = req.query;
    const filter = {};

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    const total = await Booking.countDocuments(filter);
    const rides = await Booking.find(filter)
      .populate('customerId', 'name phone rating')
      .populate('driverId', 'name phone rating vehicleDetails')
      .sort({ requestedAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, total, page: Number(page), rides });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching rides', error: error.message });
  }
};

const cancelRideEmergency = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { reason = 'Cancelled by administrator' } = req.body;

    const booking = await Booking.findById(rideId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Ride not found' });
    }

    const oldStatus = booking.status;
    booking.status = 'CANCELLED_BY_RIDER';
    booking.cancelledBy = 'admin';
    booking.cancelledAt = new Date();
    booking.cancellationReason = reason;
    booking.statusHistory.push({
      fromStatus: oldStatus,
      toStatus: 'CANCELLED_BY_RIDER',
      changedBy: req.userId,
      changedByRole: 'ADMIN',
      reason,
      timestamp: new Date()
    });
    await booking.save();

    // Audit log
    await AuditLog.create({
      adminId: req.userId,
      action: 'RIDE_ADMIN_CANCELLED',
      entityType: 'RIDE',
      entityId: booking._id,
      description: `Admin cancelled Ride #${booking.rideNumber}: ${reason}`
    });

    res.json({ success: true, booking, message: 'Ride cancelled successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error cancelling ride', error: error.message });
  }
};

// ============================================================
// 5. PRICING RULES & DYNAMIC MODIFIERS
// ============================================================
const getPricingConfig = async (req, res) => {
  try {
    const fareRules = await FareRule.find().sort({ vehicleCategory: 1 });
    const modifiers = await FareModifier.find().sort({ createdAt: -1 });
    res.json({ success: true, fareRules, modifiers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching pricing configuration', error: error.message });
  }
};

const saveFareRule = async (req, res) => {
  try {
    const {
      vehicleCategory,
      distanceType = 'SHORT',
      baseFare,
      perKmRate,
      perMinuteRate,
      minimumFare,
      waitingChargePerMin,
      commissionPercentage,
      taxPercentage
    } = req.body;

    const rule = await FareRule.findOneAndUpdate(
      { vehicleCategory, distanceType },
      {
        $set: {
          baseFare: Number(baseFare),
          perKmRate: Number(perKmRate),
          perMinuteRate: Number(perMinuteRate),
          minimumFare: Number(minimumFare),
          waitingChargePerMin: Number(waitingChargePerMin) || 2,
          commissionPercentage: Number(commissionPercentage) || 20,
          taxPercentage: Number(taxPercentage) || 5,
          isActive: true,
          updatedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    await AuditLog.create({
      adminId: req.userId,
      action: 'FARE_RULE_UPDATED',
      entityType: 'PRICING',
      entityId: rule._id,
      description: `Updated fare rules for ${vehicleCategory} (${distanceType})`
    });

    res.json({ success: true, rule, message: 'Fare configuration saved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error saving fare rule', error: error.message });
  }
};

const saveFareModifier = async (req, res) => {
  try {
    const { name, modifierType, multiplier, flatAddition, appliesToCategory, isActive } = req.body;

    const modifier = new FareModifier({
      name,
      modifierType,
      multiplier: Number(multiplier) || 1.0,
      flatAddition: Number(flatAddition) || 0,
      appliesToCategory: appliesToCategory || null,
      isActive: isActive !== false
    });
    await modifier.save();

    await AuditLog.create({
      adminId: req.userId,
      action: 'FARE_MODIFIER_CREATED',
      entityType: 'PRICING',
      entityId: modifier._id,
      description: `Created ${modifierType} fare modifier: ${name} (${multiplier}x)`
    });

    res.json({ success: true, modifier, message: 'Fare modifier created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error saving fare modifier', error: error.message });
  }
};

// ============================================================
// 6. FINANCE & LEDGER OVERVIEW
// ============================================================
const getFinanceOverview = async (req, res) => {
  try {
    const wallets = await DriverWallet.find().populate('driverId', 'name phone');
    const recentTransactions = await WalletTransaction.find()
      .sort({ createdAt: -1 })
      .limit(30)
      .populate('driverId', 'name phone');

    res.json({ success: true, wallets, recentTransactions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error loading finance overview', error: error.message });
  }
};

// ============================================================
// 7. AUDIT LOGS
// ============================================================
const getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('adminId', 'name email');
    res.json({ success: true, count: logs.length, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching audit logs', error: error.message });
  }
};

// ============================================================
// 8. SUPPORT TICKETS
// ============================================================
const getSupportTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find()
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name phone userType');
    res.json({ success: true, count: tickets.length, tickets });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching support tickets', error: error.message });
  }
};

const updateSupportTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status, resolution } = req.body;

    const ticket = await SupportTicket.findByIdAndUpdate(
      ticketId,
      {
        $set: {
          status,
          resolution,
          assignedTo: req.userId,
          resolvedAt: status === 'RESOLVED' ? new Date() : undefined,
          updatedAt: new Date()
        }
      },
      { new: true }
    );

    res.json({ success: true, ticket, message: `Ticket status updated to ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating support ticket', error: error.message });
  }
};

module.exports = {
  getDashboardStats,
  getDrivers,
  updateDriverStatus,
  getDriverDocuments,
  verifyDocument,
  getRides,
  cancelRideEmergency,
  getPricingConfig,
  saveFareRule,
  saveFareModifier,
  getFinanceOverview,
  getAuditLogs,
  getSupportTickets,
  updateSupportTicket
};
