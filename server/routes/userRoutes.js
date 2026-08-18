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

// Update driver online status (With Verification Guard)
router.put('/driver-status', authMiddleware, async (req, res) => {
  try {
    const { isOnline } = req.body;
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found. Please login again.' });
    }

    // Unapproved drivers cannot go online
    if (isOnline && user.approvalStatus !== 'APPROVED') {
      return res.status(403).json({
        success: false,
        message: 'Your driver account is pending verification. Please complete KYC and wait for admin approval.',
        approvalStatus: user.approvalStatus || 'PENDING'
      });
    }

    user.isOnline = isOnline;
    await user.save();
    
    res.json({ success: true, isOnline: user.isOnline, approvalStatus: user.approvalStatus });
  } catch (error) {
    console.error('Driver status update error:', error);
    res.status(500).json({ message: 'Error updating status', error: error.message });
  }
});

// Submit Driver KYC Documents & Vehicle Details
router.post('/driver/documents', authMiddleware, async (req, res) => {
  try {
    const {
      vehicleType,
      model,
      licensePlate,
      color,
      year,
      vehiclePhoto,
      drivingLicenseNumber,
      drivingLicensePhoto,
      rcNumber,
      rcPhoto,
      insuranceNumber,
      insurancePhoto
    } = req.body;

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.vehicleDetails = {
      vehicleType: vehicleType || user.vehicleDetails?.vehicleType || 'UberGo',
      model: model || user.vehicleDetails?.model || 'Swift Dzire',
      licensePlate: licensePlate || user.vehicleDetails?.licensePlate || 'KA 01 XX 1234',
      color: color || user.vehicleDetails?.color || 'White',
      year: Number(year) || user.vehicleDetails?.year || 2022,
      vehiclePhoto: vehiclePhoto || user.vehicleDetails?.vehiclePhoto
    };

    user.documents = {
      drivingLicense: {
        documentNumber: drivingLicenseNumber || user.documents?.drivingLicense?.documentNumber || 'DL-PENDING',
        fileUrl: drivingLicensePhoto || user.documents?.drivingLicense?.fileUrl,
        status: 'PENDING'
      },
      vehicleRC: {
        documentNumber: rcNumber || user.documents?.vehicleRC?.documentNumber || 'RC-PENDING',
        fileUrl: rcPhoto || user.documents?.vehicleRC?.fileUrl,
        status: 'PENDING'
      },
      vehicleInsurance: {
        documentNumber: insuranceNumber || user.documents?.vehicleInsurance?.documentNumber || 'INS-PENDING',
        fileUrl: insurancePhoto || user.documents?.vehicleInsurance?.fileUrl,
        status: 'PENDING'
      },
      vehiclePhoto: {
        fileUrl: vehiclePhoto || user.documents?.vehiclePhoto?.fileUrl,
        status: 'PENDING'
      }
    };

    user.approvalStatus = 'PENDING';
    await user.save();

    res.json({
      success: true,
      message: 'KYC documents and vehicle details submitted for verification.',
      approvalStatus: user.approvalStatus,
      vehicleDetails: user.vehicleDetails,
      documents: user.documents
    });
  } catch (error) {
    console.error('Error submitting driver documents:', error);
    res.status(500).json({ message: 'Error submitting documents', error: error.message });
  }
});

// Get Driver KYC & Verification Status
router.get('/driver/documents', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('approvalStatus vehicleDetails documents rejectionReason suspensionReason');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      success: true,
      approvalStatus: user.approvalStatus,
      vehicleDetails: user.vehicleDetails,
      documents: user.documents,
      rejectionReason: user.rejectionReason,
      suspensionReason: user.suspensionReason
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching verification status', error: error.message });
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
    
    res.json({ success: true, location: user?.currentLocation });
  } catch (error) {
    res.status(500).json({ message: 'Error updating location', error: error.message });
  }
});

// Get driver earnings
router.get('/earnings', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('earnings totalTrips');
    res.json(user?.earnings || { today: 0, weekly: 0, total: 0 });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching earnings', error: error.message });
  }
});

// Add saved place
router.post('/saved-places', authMiddleware, async (req, res) => {
  try {
    const { name, address, latitude, longitude, type } = req.body;
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    user.savedPlaces.push({ name, address, latitude, longitude, type });
    await user.save();
    
    res.json(user.savedPlaces);
  } catch (error) {
    res.status(500).json({ message: 'Error adding saved place', error: error.message });
  }
});

// Delete saved place
router.delete('/saved-places/:placeId', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    user.savedPlaces = user.savedPlaces.filter(
      place => place._id.toString() !== req.params.placeId
    );
    await user.save();
    
    res.json(user.savedPlaces);
  } catch (error) {
    res.status(500).json({ message: 'Error deleting saved place', error: error.message });
  }
});

module.exports = router;
