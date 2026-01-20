const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');

// Get user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile', error: error.message });
  }
});

// Update user profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, email, address, vehicleDetails } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (address) updateData.address = address;
    if (vehicleDetails) updateData.vehicleDetails = vehicleDetails;
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      updateData,
      { new: true }
    ).select('-password');
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile', error: error.message });
  }
});

// Update driver online status
router.put('/driver-status', authMiddleware, async (req, res) => {
  try {
    const { isOnline } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      { isOnline },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found. Please login again.' });
    }
    
    res.json({ success: true, isOnline: user.isOnline });
  } catch (error) {
    console.error('Driver status update error:', error);
    res.status(500).json({ message: 'Error updating status', error: error.message });
  }
});

// Update driver location
router.put('/location', authMiddleware, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      { 
        currentLocation: { 
          latitude, 
          longitude, 
          lastUpdated: new Date() 
        } 
      },
      { new: true }
    ).select('-password');
    
    res.json({ success: true, location: user.currentLocation });
  } catch (error) {
    res.status(500).json({ message: 'Error updating location', error: error.message });
  }
});

// Get driver earnings
router.get('/earnings', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('earnings totalTrips');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching earnings', error: error.message });
  }
});

// Get online drivers (for ride matching)
router.get('/online-drivers', async (req, res) => {
  try {
    const drivers = await User.find({ 
      userType: 'driver', 
      isOnline: true 
    }).select('name rating currentLocation vehicleDetails');
    
    res.json(drivers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching drivers', error: error.message });
  }
});

module.exports = router;
