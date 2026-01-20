const express = require('express');
const { register, login, verifyPhone, sendOTP, forgotPassword, resetPassword } = require('../controllers/authController');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/verify-phone', verifyPhone);
router.post('/send-otp', sendOTP);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
