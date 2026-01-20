import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ==================== AUTH APIs ====================
export const registerUser = (userData) => {
  return api.post('/auth/register', userData);
};

export const loginUser = (credentials) => {
  return api.post('/auth/login', credentials);
};

export const verifyPhone = (phone) => {
  return api.post('/auth/verify-phone', { phone });
};

export const sendOTP = (phone) => {
  return api.post('/auth/send-otp', { phone });
};

export const forgotPassword = (phone) => {
  return api.post('/auth/forgot-password', { phone });
};

export const resetPassword = (phone, otp, newPassword) => {
  return api.post('/auth/reset-password', { phone, otp, newPassword });
};

// ==================== VEHICLE APIs ====================
export const getRideTypes = () => {
  return api.get('/vehicles/types');
};

export const getAvailableVehicles = () => {
  return api.get('/vehicles');
};

export const getFareEstimate = (vehicleType, distance) => {
  return api.get(`/vehicles/fare-estimate?vehicleType=${vehicleType}&distance=${distance}`);
};

// ==================== BOOKING APIs ====================
export const requestRide = (rideData) => {
  return api.post('/bookings', rideData);
};

export const getUserBookings = () => {
  return api.get('/bookings');
};

export const getActiveRide = () => {
  return api.get('/bookings/active');
};

export const cancelRide = (bookingId, reason) => {
  return api.post('/bookings/cancel', { bookingId, reason, cancelledBy: 'customer' });
};

export const rateRide = (bookingId, rating, feedback, ratingType) => {
  return api.post('/bookings/rate', { bookingId, rating, feedback, ratingType });
};

// ==================== DRIVER APIs ====================
export const getPendingRides = () => {
  return api.get('/bookings/pending');
};

export const getDriverBookings = () => {
  return api.get('/bookings/driver');
};

export const acceptRide = (bookingId) => {
  return api.post('/bookings/accept', { bookingId });
};

export const startRide = (bookingId, otp) => {
  return api.post('/bookings/start', { bookingId, otp });
};

export const completeRide = (bookingId, distance, duration) => {
  return api.post('/bookings/complete', { bookingId, distance, duration });
};

// ==================== USER APIs ====================
export const getUserProfile = () => {
  return api.get('/users/profile');
};

export const updateUserProfile = (userData) => {
  return api.put('/users/profile', userData);
};

export const updateDriverStatus = (isOnline) => {
  return api.put('/users/driver-status', { isOnline });
};

export const updateDriverLocation = (latitude, longitude) => {
  return api.put('/users/location', { latitude, longitude });
};

// ==================== RATING APIs ====================
export const addRating = (ratingData) => {
  return api.post('/ratings', ratingData);
};

export const getUserRating = (userId) => {
  return api.get(`/ratings/${userId}`);
};

// ==================== PAYMENT APIs ====================
export const getPaymentMethods = () => {
  return api.get('/payments/methods');
};

export const addPaymentMethod = (type, details) => {
  return api.post('/payments/methods', { type, details });
};

export const removePaymentMethod = (methodId) => {
  return api.delete(`/payments/methods/${methodId}`);
};

export const processPayment = (bookingId, paymentMethod, amount) => {
  return api.post('/payments/process', { bookingId, paymentMethod, amount });
};

export const getPaymentHistory = () => {
  return api.get('/payments/history');
};

export const getWalletBalance = () => {
  return api.get('/payments/wallet/balance');
};

export const addMoneyToWallet = (amount) => {
  return api.post('/payments/wallet/add', { amount });
};

// ==================== DRIVER PAYMENT APIs ====================
export const getDriverUpiId = () => {
  return api.get('/payments/driver/upi');
};

export const updateDriverUpiId = (upiId) => {
  return api.put('/payments/driver/upi', { upiId });
};

export const getDriverWallet = () => {
  return api.get('/payments/driver/wallet');
};

export const addToDriverWallet = (amount, bookingId, paymentMethod) => {
  return api.post('/payments/driver/wallet/add', { amount, bookingId, paymentMethod });
};

export const requestWithdrawal = (amount, phone) => {
  return api.post('/payments/driver/withdraw', { amount, phone });
};

export const getWithdrawalHistory = () => {
  return api.get('/payments/driver/withdrawals');
};

export const confirmOnlinePayment = (bookingId, amount) => {
  return api.post('/payments/confirm-online-payment', { bookingId, amount });
};

export default api;
