const express = require('express');
const { getAvailableVehicles, getRideTypes, getFareEstimate, addVehicle, updateLocation } = require('../controllers/vehicleController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', getAvailableVehicles);
router.get('/types', getRideTypes);
router.get('/fare-estimate', getFareEstimate);
router.post('/', authMiddleware, addVehicle);
router.put('/location', authMiddleware, updateLocation);

module.exports = router;
