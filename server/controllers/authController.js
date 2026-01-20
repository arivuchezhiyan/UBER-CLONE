const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Register
const register = async (req, res) => {
  try {
    const { name, email, password, phone, userType } = req.body;

    // Check for existing user by phone or email
    const existingUser = await User.findOne({ 
      $or: [
        { email: email || '' },
        { phone: phone || '' }
      ]
    });
    
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email or phone' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email: email || `${phone}@phone.user`,
      password: hashedPassword,
      phone,
      userType,
    });

    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret_key', {
      expiresIn: '7d',
    });

    res.status(201).json({ 
      token, 
      user: { 
        id: user._id, 
        email: user.email, 
        name, 
        phone,
        userType 
      } 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error registering user', error: error.message });
  }
};

// Login - supports both email and phone
const login = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    // Find user by email or phone
    const user = await User.findOne(
      email ? { email } : { phone }
    );
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret_key', {
      expiresIn: '7d',
    });

    res.json({ 
      token, 
      user: { 
        id: user._id, 
        email: user.email, 
        name: user.name, 
        phone: user.phone,
        userType: user.userType 
      } 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
};

// Verify if phone exists (for login flow)
const verifyPhone = async (req, res) => {
  try {
    const { phone } = req.body;
    const user = await User.findOne({ phone });
    
    res.json({ exists: !!user });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying phone', error: error.message });
  }
};

// Send OTP (mock - in production use SMS service)
const sendOTP = async (req, res) => {
  try {
    const { phone } = req.body;
    // In production, integrate with SMS service like Twilio
    // For now, just return success
    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error sending OTP', error: error.message });
  }
};

// Forgot Password - Send OTP to phone
const forgotPassword = async (req, res) => {
  try {
    const { phone } = req.body;
    
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: 'No account found with this phone number' });
    }
    
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP with expiry (5 minutes)
    user.resetOTP = otp;
    user.resetOTPExpiry = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();
    
    // In production, send OTP via SMS
    console.log(`Password reset OTP for ${phone}: ${otp}`);
    
    res.json({ 
      success: true, 
      message: 'OTP sent to your phone number',
      // Remove this in production - only for testing
      otp: otp 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error sending reset OTP', error: error.message });
  }
};

// Verify OTP and Reset Password
const resetPassword = async (req, res) => {
  try {
    const { phone, otp, newPassword } = req.body;
    
    const user = await User.findOne({ 
      phone,
      resetOTP: otp,
      resetOTPExpiry: { $gt: new Date() }
    });
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password and clear OTP
    user.password = hashedPassword;
    user.resetOTP = undefined;
    user.resetOTPExpiry = undefined;
    await user.save();
    
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error resetting password', error: error.message });
  }
};

module.exports = { register, login, verifyPhone, sendOTP, forgotPassword, resetPassword };
