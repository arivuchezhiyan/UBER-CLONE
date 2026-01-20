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
  process.env.CLIENT_URL
].filter(Boolean);

const io = socketIo(server, {
  cors: { 
    origin: allowedOrigins.length > 0 ? allowedOrigins : "*", 
    methods: ["GET", "POST"] 
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

// Seed initial vehicle data
async function seedInitialData() {
  const Vehicle = require('./models/Vehicle');
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
    console.log('🚗 Initial vehicle data seeded');
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

// Make io accessible to routes
app.set('io', io);

// Track connected drivers
const connectedDrivers = new Map();

// WebSocket events for real-time synchronization
io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  // Driver joins with their user ID
  socket.on('driver-online', (driverId) => {
    connectedDrivers.set(driverId, socket.id);
    socket.driverId = driverId;
    console.log(`Driver ${driverId} is online with socket ${socket.id}`);
  });

  // Driver location update
  socket.on('driver-location-update', (data) => {
    socket.broadcast.emit('driver-location', data);
  });

  // New ride request - broadcast to all online drivers
  socket.on('new-ride-request', (rideData) => {
    socket.broadcast.emit('ride-available', rideData);
  });

  // When a driver accepts a ride - notify all other drivers
  socket.on('ride-accepted', (data) => {
    // Broadcast to ALL sockets except sender that this ride is taken
    socket.broadcast.emit('ride-taken', {
      bookingId: data.bookingId,
      driverId: data.driverId
    });
    console.log(`Ride ${data.bookingId} accepted by driver ${data.driverId}`);
  });

  socket.on('disconnect', () => {
    if (socket.driverId) {
      connectedDrivers.delete(socket.driverId);
      console.log(`Driver ${socket.driverId} disconnected`);
    }
    console.log('User disconnected:', socket.id);
  });
});

// Auto-cancel stale bookings (rides stuck in 'searching' for more than 5 minutes)
const Booking = require('./models/Booking');
const cleanupStaleBookings = async () => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const staleBookings = await Booking.find({
      status: 'searching',
      requestedAt: { $lt: fiveMinutesAgo }
    });
    
    for (const booking of staleBookings) {
      booking.status = 'cancelled';
      booking.cancelledAt = new Date();
      booking.cancellationReason = 'No drivers available - auto cancelled';
      booking.cancelledBy = 'system';
      await booking.save();
      
      // Notify customer via socket
      io.emit('ride-cancelled', {
        bookingId: booking._id,
        cancelledBy: 'system',
        reason: 'No drivers available',
        customerId: booking.customerId
      });
      
      console.log(`Auto-cancelled stale booking: ${booking._id}`);
    }
  } catch (err) {
    console.error('Error cleaning up stale bookings:', err);
  }
};

// Run cleanup every minute
setInterval(cleanupStaleBookings, 60 * 1000);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
