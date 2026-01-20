const Vehicle = require('../models/Vehicle');

// Get ride types (UberGo, Premier, etc.)
const getRideTypes = async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ name: { $exists: true } });
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching ride types', error: error.message });
  }
};

// Get available vehicles (driver owned)
const getAvailableVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ isActive: true, driverId: { $exists: true } })
      .populate('driverId', 'name rating');
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching vehicles', error: error.message });
  }
};

// Calculate fare estimate
const getFareEstimate = async (req, res) => {
  try {
    const { vehicleType, distance } = req.query;
    
    const vehicle = await Vehicle.findOne({ name: vehicleType });
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle type not found' });
    }
    
    const baseFare = vehicle.baseFare || 50;
    const distanceFare = (parseFloat(distance) || 5) * vehicle.pricePerKm;
    const total = Math.round(baseFare + distanceFare);
    
    res.json({
      vehicleType,
      baseFare,
      distanceFare,
      pricePerKm: vehicle.pricePerKm,
      total,
      currency: 'INR'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error calculating fare', error: error.message });
  }
};

// Add vehicle (Driver)
const addVehicle = async (req, res) => {
  try {
    const { licensePlate, model, year, seats, vehicleType, pricePerKm, pricePerHour } = req.body;

    const vehicle = new Vehicle({
      driverId: req.userId,
      licensePlate,
      model,
      year,
      seats,
      type: vehicleType,
      pricePerKm,
      pricePerHour,
    });

    await vehicle.save();
    res.status(201).json(vehicle);
  } catch (error) {
    res.status(500).json({ message: 'Error adding vehicle', error: error.message });
  }
};

// Update vehicle location
const updateLocation = async (req, res) => {
  try {
    const { vehicleId, latitude, longitude } = req.body;

    const vehicle = await Vehicle.findByIdAndUpdate(
      vehicleId,
      { currentLocation: { latitude, longitude } },
      { new: true }
    );

    res.json(vehicle);
  } catch (error) {
    res.status(500).json({ message: 'Error updating location', error: error.message });
  }
};

module.exports = { getAvailableVehicles, getRideTypes, getFareEstimate, addVehicle, updateLocation };
