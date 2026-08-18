const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app);

// CORS configuration for production
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.CLIENT_URL
].filter(Boolean);

const io = socketIo(server, {
  cors: { 
    origin: allowedOrigins.length > 0 ? allowedOrigins : "*", 
    methods: ["GET", "POST", "PUT", "DELETE"] 
  }
});

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? allowedOrigins : '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
let mongoServer;

async function connectDatabase() {
  try {
    let mongoUri;
    
    // Use MongoDB Atlas in production, In-Memory for development
    if (process.env.NODE_ENV === 'production' && process.env.MONGODB_URI) {
      mongoUri = process.env.MONGODB_URI;
      await mongoose.connect(mongoUri);
      console.log('✅ MongoDB Atlas connected!');
    } else {
      // Use In-Memory MongoDB for local development
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongoServer = await MongoMemoryServer.create();
      mongoUri = mongoServer.getUri();
      await mongoose.connect(mongoUri);
      console.log('✅ MongoDB In-Memory Server connected!');
      console.log('📍 Database URI:', mongoUri);
      console.log('💡 Note: Data resets on server restart (dev mode)');
    }
    
    // Seed initial data
    await seedInitialData();
  } catch (err) {
    console.log('❌ Database connection error:', err.message);
    console.log('🔄 Retrying connection in 5 seconds...');
    setTimeout(connectDatabase, 5000);
  }
}

// Seed initial vehicles & enterprise fare rules
async function seedInitialData() {
  try {
    const Vehicle = require('./models/Vehicle');
    const FareRule = require('./models/FareRule');
    const CancellationRule = require('./models/CancellationRule');

    // 1. Seed Vehicles
    const vehicleCount = await Vehicle.countDocuments();
    if (vehicleCount === 0) {
      const vehicles = [
        { name: 'UberGo', type: 'sedan', pricePerKm: 12, baseFare: 50, image: '🚗', capacity: 4, description: 'Affordable, everyday rides' },
        { name: 'Premier', type: 'sedan', pricePerKm: 15, baseFare: 70, image: '🚙', capacity: 4, description: 'Comfortable sedans, top-quality drivers' },
        { name: 'UberXL', type: 'suv', pricePerKm: 18, baseFare: 100, image: '🚐', capacity: 6, description: 'Affordable rides for groups up to 6' },
        { name: 'Uber Auto', type: 'auto', pricePerKm: 8, baseFare: 25, image: '🛺', capacity: 3, description: 'Auto-rickshaw at your doorstep' },
        { name: 'Uber Moto', type: 'bike', pricePerKm: 5, baseFare: 15, image: '🏍️', capacity: 1, description: 'Affordable motorcycle rides' },
      ];
      await Vehicle.insertMany(vehicles);
      console.log('🚗 Initial vehicle categories seeded');
    }

    // 2. Seed Fare Rules
    const fareRuleCount = await FareRule.countDocuments();
    if (fareRuleCount === 0) {
      const fareRules = [
        { vehicleCategory: 'UberGo', distanceType: 'SHORT', baseFare: 50, perKmRate: 12, perMinuteRate: 1.5, minimumFare: 60, commissionPercentage: 20, taxPercentage: 5 },
        { vehicleCategory: 'UberGo', distanceType: 'LONG', baseFare: 100, perKmRate: 11, perMinuteRate: 1.2, minimumFare: 500, commissionPercentage: 18, taxPercentage: 5 },
        { vehicleCategory: 'Premier', distanceType: 'SHORT', baseFare: 70, perKmRate: 15, perMinuteRate: 2.0, minimumFare: 90, commissionPercentage: 20, taxPercentage: 5 },
        { vehicleCategory: 'UberXL', distanceType: 'SHORT', baseFare: 100, perKmRate: 18, perMinuteRate: 2.5, minimumFare: 130, commissionPercentage: 20, taxPercentage: 5 },
        { vehicleCategory: 'Uber Auto', distanceType: 'SHORT', baseFare: 25, perKmRate: 8, perMinuteRate: 1.0, minimumFare: 30, commissionPercentage: 15, taxPercentage: 5 },
        { vehicleCategory: 'Uber Moto', distanceType: 'SHORT', baseFare: 15, perKmRate: 5, perMinuteRate: 0.8, minimumFare: 20, commissionPercentage: 15, taxPercentage: 5 },
      ];
      await FareRule.insertMany(fareRules);
      console.log('💰 Enterprise FareRules seeded (base, per-km, per-min, taxes & commission)');
    }

    // 3. Seed Cancellation Rules
    const cancelRuleCount = await CancellationRule.countDocuments();
    if (cancelRuleCount === 0) {
      await CancellationRule.create({
        cancelledByRole: 'RIDER',
        rideStatus: 'DRIVER_ASSIGNED',
        minMinutesAfterAssignment: 3,
        cancellationFee: 50,
        feeType: 'FLAT',
        isActive: true
      });
      console.log('🛡️ Default cancellation policy rule seeded');
    }

    // 4. Seed Demo Users (Rider, Car Captain, Auto Captain, Admin)
    const bcrypt = require('bcryptjs');
    const User = require('./models/User');
    const hashedPassword = await bcrypt.hash('password123', 10);
    const adminHashedPassword = await bcrypt.hash('adminpassword123', 10);

    // Rider
    let rider = await User.findOne({ phone: '9000000001' });
    if (!rider) {
      await User.create({
        name: 'Alex Rider',
        email: 'rider@uberclone.com',
        phone: '9000000001',
        password: hashedPassword,
        userType: 'customer',
        walletBalance: 500,
        rating: 4.9
      });
      console.log('👤 Demo Rider seeded: 9000000001 / password123');
    }

    // Car Captain (Approved)
    let driver1 = await User.findOne({ phone: '9000000002' });
    if (!driver1) {
      await User.create({
        name: 'Captain Vikram (Car)',
        email: 'driver.vikram@uberclone.com',
        phone: '9000000002',
        password: hashedPassword,
        userType: 'driver',
        approvalStatus: 'APPROVED',
        rating: 4.9,
        vehicleDetails: {
          vehicleType: 'UberGo',
          model: 'Maruti Swift Dzire',
          licensePlate: 'KA 01 AB 1234',
          color: 'Pearl White',
          year: 2023,
          vehiclePhoto: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=500'
        },
        documents: {
          drivingLicense: { documentNumber: 'DL-KA01-2022001', status: 'APPROVED' },
          vehicleRC: { documentNumber: 'RC-KA01-AB1234', status: 'APPROVED' },
          vehicleInsurance: { documentNumber: 'INS-HDFC-9921', status: 'APPROVED' }
        }
      });
      console.log('🚗 Demo Car Captain seeded: 9000000002 / password123 (Approved)');
    }

    // Auto Captain (Approved)
    let driver2 = await User.findOne({ phone: '9000000003' });
    if (!driver2) {
      await User.create({
        name: 'Captain Suresh (Auto)',
        email: 'driver.suresh@uberclone.com',
        phone: '9000000003',
        password: hashedPassword,
        userType: 'driver',
        approvalStatus: 'APPROVED',
        rating: 4.8,
        vehicleDetails: {
          vehicleType: 'Uber Auto',
          model: 'Bajaj Compact Auto',
          licensePlate: 'KA 01 AC 5678',
          color: 'Yellow-Green',
          year: 2022
        }
      });
      console.log('🛺 Demo Auto Captain seeded: 9000000003 / password123 (Approved)');
    }

    // Admin
    let admin = await User.findOne({ phone: '9000000000' });
    if (!admin) {
      await User.create({
        name: 'Super Admin',
        email: 'admin@uberclone.com',
        phone: '9000000000',
        password: adminHashedPassword,
        userType: 'admin',
        role: 'SUPER_ADMIN'
      });
      console.log('👑 Demo Admin seeded: 9000000000 / adminpassword123');
    }
  } catch (err) {
    console.error('Seed data error:', err.message);
  }
}

connectDatabase();

// Handle MongoDB connection events
mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.log('❌ MongoDB error:', err);
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/vehicles', require('./routes/vehicleRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/ratings', require('./routes/ratingRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// Make io accessible to routes
app.set('io', io);

// Track connected drivers & active tracking rooms
const connectedDrivers = new Map();

// Import Phase 2 Services
const MatchingService = require('./services/MatchingService');
const ScheduledRideJob = require('./services/ScheduledRideJob');
const DriverHeartbeatService = require('./services/DriverHeartbeatService');

// Start Phase 2 Background Jobs
ScheduledRideJob.start(io);
DriverHeartbeatService.start(io);

// WebSocket events for real-time synchronization
io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  // Driver joins with their user ID
  socket.on('driver-online', async (driverId) => {
    connectedDrivers.set(driverId, socket.id);
    socket.driverId = driverId;
    await DriverHeartbeatService.recordHeartbeat(driverId);
    console.log(`Driver ${driverId} is online with socket ${socket.id}`);
  });

  // Driver Heartbeat & GPS ping
  socket.on('driver-heartbeat', async (data) => {
    if (socket.driverId) {
      await DriverHeartbeatService.recordHeartbeat(socket.driverId, data);
    }
  });

  // Join ride tracking room
  socket.on('join-ride-tracking', (rideId) => {
    socket.join(`ride-${rideId}`);
    console.log(`Socket ${socket.id} joined tracking room ride-${rideId}`);
  });

  // Leave ride tracking room
  socket.on('leave-ride-tracking', (rideId) => {
    socket.leave(`ride-${rideId}`);
  });

  // Real-time GPS Breadcrumb streaming
  socket.on('driver-location-update', async (data) => {
    if (socket.driverId) {
      await DriverHeartbeatService.recordHeartbeat(socket.driverId, {
        latitude: data.lat || data.latitude,
        longitude: data.lng || data.longitude
      });
    }
    // Broadcast to tracking room if rideId is provided
    if (data.rideId) {
      io.to(`ride-${data.rideId}`).emit('live-driver-location', data);
    }
    // Global broadcast for map discovery
    socket.broadcast.emit('driver-location', data);
  });

  // New ride request - broadcast to all online drivers
  socket.on('new-ride-request', (rideData) => {
    socket.broadcast.emit('ride-available', rideData);
  });

  // When a driver accepts a ride - notify all other drivers & cancel dispatch
  socket.on('ride-accepted', (data) => {
    MatchingService.cancelDispatch(data.bookingId);
    socket.broadcast.emit('ride-taken', {
      bookingId: data.bookingId,
      driverId: data.driverId
    });
    console.log(`Ride ${data.bookingId} accepted by driver ${data.driverId}`);
  });

  // When a driver declines a ride - advance sequential dispatch
  socket.on('driver-reject-ride', async (data) => {
    await MatchingService.handleDriverRejection(data.bookingId, socket.driverId, data.reason, io);
  });

  socket.on('disconnect', () => {
    if (socket.driverId) {
      connectedDrivers.delete(socket.driverId);
      console.log(`Driver ${socket.driverId} disconnected`);
    }
    console.log('User disconnected:', socket.id);
  });
});

// Auto-cancel stale bookings with 16-state machine transition
const Booking = require('./models/Booking');
const cleanupStaleBookings = async () => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const staleBookings = await Booking.find({
      status: { $in: ['SEARCHING_DRIVER', 'searching', 'REQUESTED'] },
      requestedAt: { $lt: fiveMinutesAgo }
    });
    
    for (const booking of staleBookings) {
      const oldStatus = booking.status;
      booking.status = 'EXPIRED';
      booking.cancelledAt = new Date();
      booking.cancellationReason = 'No drivers available within 5 minutes - auto expired';
      booking.cancelledBy = 'system';
      if (!booking.statusHistory) booking.statusHistory = [];
      booking.statusHistory.push({
        fromStatus: oldStatus,
        toStatus: 'EXPIRED',
        changedByRole: 'SYSTEM',
        reason: 'Timeout waiting for driver acceptance',
        timestamp: new Date()
      });
      await booking.save();
      
      // Notify customer via socket
      io.emit('ride-cancelled', {
        bookingId: booking._id,
        rideNumber: booking.rideNumber,
        cancelledBy: 'system',
        reason: 'No drivers available within timeout',
        customerId: booking.customerId
      });
      
      console.log(`Auto-expired stale booking: ${booking._id} (${booking.rideNumber})`);
    }
  } catch (err) {
    console.error('Error cleaning up stale bookings:', err);
  }
};

// Run cleanup every minute
setInterval(cleanupStaleBookings, 60 * 1000);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'Server is running',
    environment: process.env.NODE_ENV || 'development',
    features: [
      '16-state ride machine',
      '3-layer race condition defense',
      'centralized FareCalculator pricing engine',
      'double-entry driver wallet ledger',
      'sequential 30s driver matching dispatch',
      'scheduled ride background worker',
      'driver heartbeat & auto-offline monitor',
      'real-time WebSocket GPS breadcrumbs'
    ]
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
