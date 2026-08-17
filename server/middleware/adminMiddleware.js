const User = require('../models/User');

const adminMiddleware = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (user.userType !== 'admin' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied: Admin privileges required' });
    }

    req.adminUser = user;
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Authorization error', error: error.message });
  }
};

module.exports = adminMiddleware;
