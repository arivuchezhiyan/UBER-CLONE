const express = require('express');
const { 
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
} = require('../controllers/bookingController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Customer routes
router.post('/', authMiddleware, requestRide);
router.get('/', authMiddleware, getUserBookings);
router.get('/active', authMiddleware, getActiveRide);
router.post('/cancel', authMiddleware, cancelRide);
router.post('/rate', authMiddleware, rateRide);

// Driver routes
router.get('/pending', authMiddleware, getPendingRides);
router.get('/driver', authMiddleware, getDriverBookings);
router.post('/accept', authMiddleware, acceptRide);
router.post('/reject', authMiddleware, rejectRide);
router.post('/arrived', authMiddleware, driverArrived);
router.post('/start', authMiddleware, startRide);
router.post('/complete', authMiddleware, completeRide);
router.post('/location', authMiddleware, recordLocation);

module.exports = router;
