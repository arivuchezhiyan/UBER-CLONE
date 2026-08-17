const express = require('express');
const auth = require('../middleware/authMiddleware');
const adminAuth = require('../middleware/adminMiddleware');
const {
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
} = require('../controllers/adminController');

const router = express.Router();

// Apply auth + adminAuth to all admin endpoints
router.use(auth, adminAuth);

// Dashboard
router.get('/dashboard', getDashboardStats);

// Drivers
router.get('/drivers', getDrivers);
router.put('/drivers/:driverId/status', updateDriverStatus);
router.get('/drivers/:driverId/documents', getDriverDocuments);
router.put('/documents/:documentId/verify', verifyDocument);

// Rides
router.get('/rides', getRides);
router.post('/rides/:rideId/cancel', cancelRideEmergency);

// Pricing
router.get('/pricing', getPricingConfig);
router.post('/pricing/rule', saveFareRule);
router.post('/pricing/modifier', saveFareModifier);

// Finance
router.get('/finance', getFinanceOverview);

// Audit Logs
router.get('/audit-logs', getAuditLogs);

// Support Tickets
router.get('/tickets', getSupportTickets);
router.put('/tickets/:ticketId', updateSupportTicket);

module.exports = router;
