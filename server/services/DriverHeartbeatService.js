const User = require('../models/User');

class DriverHeartbeatService {
  /**
   * Record driver heartbeat with GPS coordinates
   */
  static async recordHeartbeat(driverId, { latitude, longitude, batteryLevel } = {}) {
    const updateDoc = {
      isOnline: true,
      'currentLocation.lastUpdated': new Date()
    };

    if (latitude && longitude) {
      updateDoc['currentLocation.latitude'] = latitude;
      updateDoc['currentLocation.longitude'] = longitude;
    }

    const driver = await User.findByIdAndUpdate(driverId, { $set: updateDoc }, { new: true });
    return driver;
  }

  /**
   * Auto-offline drivers who haven't sent a heartbeat/GPS update in > 5 minutes
   */
  static async checkStaleDrivers(io) {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const staleDrivers = await User.find({
        userType: 'driver',
        isOnline: true,
        $or: [
          { 'currentLocation.lastUpdated': { $lt: fiveMinutesAgo } },
          { 'currentLocation.lastUpdated': { $exists: false } }
        ]
      });

      for (const driver of staleDrivers) {
        driver.isOnline = false;
        await driver.save();

        console.log(`🔌 Driver ${driver.name} (${driver._id}) auto-marked OFFLINE due to inactivity (>5 min no heartbeat)`);

        if (io) {
          io.emit('driver-offline', {
            driverId: driver._id,
            reason: 'Heartbeat timeout'
          });
        }
      }
    } catch (error) {
      console.error('Error in DriverHeartbeatService:', error.message);
    }
  }

  /**
   * Start recurring heartbeat monitor (every 60 seconds)
   */
  static start(io) {
    console.log('💓 DriverHeartbeatService monitor initialized (runs every 60s)');
    setInterval(() => this.checkStaleDrivers(io), 60 * 1000);
  }
}

module.exports = DriverHeartbeatService;
