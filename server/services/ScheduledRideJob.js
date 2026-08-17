const Booking = require('../models/Booking');
const MatchingService = require('./MatchingService');

class ScheduledRideJob {
  /**
   * Scan and trigger matching for scheduled rides approaching their pickup time (30-45 min prior)
   */
  static async processUpcomingScheduledRides(io) {
    try {
      const now = new Date();
      // Look ahead 45 minutes
      const windowEnd = new Date(now.getTime() + 45 * 60 * 1000);

      const scheduledRides = await Booking.find({
        rideType: 'SCHEDULED',
        status: { $in: ['REQUESTED', 'CONFIRMED'] },
        'scheduledRide.scheduledAt': { $lte: windowEnd, $gte: new Date(now.getTime() - 15 * 60 * 1000) },
        'scheduledRide.status': { $in: ['CONFIRMED', null] }
      });

      for (const booking of scheduledRides) {
        console.log(`⏰ Scheduled Ride #${booking.rideNumber} is due at ${booking.scheduledRide?.scheduledAt}. Initiating driver matching...`);

        booking.status = 'SEARCHING_DRIVER';
        if (!booking.scheduledRide) booking.scheduledRide = {};
        booking.scheduledRide.status = 'MATCHING';
        booking.scheduledRide.matchingStartedAt = new Date();

        booking.statusHistory.push({
          fromStatus: 'REQUESTED',
          toStatus: 'SEARCHING_DRIVER',
          changedByRole: 'SYSTEM',
          reason: 'Scheduled ride matching window reached (30-45 min before pickup)',
          timestamp: new Date()
        });

        await booking.save();

        // Start sequential driver matching
        MatchingService.startSequentialDispatch(booking._id, io);

        // Notify rider
        if (io) {
          io.emit(`scheduled-ride-matching-${booking.customerId}`, {
            bookingId: booking._id,
            rideNumber: booking.rideNumber,
            scheduledAt: booking.scheduledRide.scheduledAt
          });
        }
      }
    } catch (error) {
      console.error('Error in ScheduledRideJob:', error.message);
    }
  }

  /**
   * Start recurring cron interval (every 60 seconds)
   */
  static start(io) {
    console.log('⏰ ScheduledRideJob worker initialized (runs every 60s)');
    setInterval(() => this.processUpcomingScheduledRides(io), 60 * 1000);
  }
}

module.exports = ScheduledRideJob;
