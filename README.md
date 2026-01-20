# 🚗 Uber-Like Rental App

A complete full-stack rental application similar to Uber, built with modern technologies. Features real-time location tracking, booking system, driver dashboard, and payment integration.

## Project Structure

```
uber/
├── server/                 # Node.js/Express backend
│   ├── models/            # MongoDB schemas
│   ├── controllers/       # Business logic
│   ├── routes/           # API endpoints
│   ├── middleware/       # Authentication & middleware
│   ├── server.js         # Main server file
│   └── package.json
└── client/               # React frontend
    ├── src/
    │   ├── pages/       # Page components
    │   ├── components/  # Reusable components
    │   ├── services/    # API client
    │   ├── styles/      # CSS files
    │   └── App.js       # Main app component
    └── package.json
```

## Features

### Customer Features
- 📍 **Book a Ride** - Easy ride booking with pickup/dropoff locations
- 💰 **Multiple Payment Methods** - Cash, card, or wallet
- ⭐ **Rate Drivers** - Rate your ride experience
- 📋 **Ride History** - View all past rides
- 🔍 **Find Drivers** - Browse available drivers with ratings

### Driver Features
- 📱 **Driver Dashboard** - Real-time ride requests and earnings
- 🟢 **Online/Offline Status** - Control availability
- 💵 **Earnings Tracking** - Daily and total earnings
- ⭐ **Driver Rating** - Build your reputation
- 📍 **Real-time Location** - Share location with customers

### Admin Features
- 👥 **User Management** - Manage customers and drivers
- 🚗 **Vehicle Management** - Track registered vehicles
- 💳 **Payment Management** - Monitor transactions
- 📊 **Analytics** - View platform statistics

## Tech Stack

### Backend
- **Node.js** with **Express.js** - Server framework
- **MongoDB** - Database
- **Socket.io** - Real-time communication
- **JWT** - Authentication
- **Stripe API** - Payment processing
- **Bcrypt** - Password hashing

### Frontend
- **React 18** - UI library
- **React Router** - Navigation
- **Axios** - HTTP client
- **Leaflet** - Maps integration
- **CSS3** - Styling

## Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- npm or yarn

### Backend Setup

```bash
cd server
npm install
```

Create `.env` file:
```
MONGODB_URI=mongodb://localhost:27017/rental-app
JWT_SECRET=your_jwt_secret_key_here
STRIPE_KEY=your_stripe_key_here
PORT=5000
NODE_ENV=development
```

Start the server:
```bash
npm run dev
```

### Frontend Setup

```bash
cd client
npm install
npm start
```

The app will open at `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Vehicles
- `GET /api/vehicles` - Get available vehicles
- `POST /api/vehicles` - Add vehicle (driver)
- `PUT /api/vehicles/location` - Update vehicle location

### Bookings
- `POST /api/bookings` - Request a ride
- `POST /api/bookings/accept` - Accept ride (driver)
- `GET /api/bookings` - Get user bookings
- `PUT /api/bookings/complete` - Complete ride

### Ratings
- `POST /api/ratings` - Add rating
- `GET /api/ratings/:userId` - Get user rating

### Payments
- `POST /api/payments` - Process payment

## Usage

### For Customers
1. Register with email and password
2. Select "Customer" during registration
3. Book a ride by entering pickup and dropoff locations
4. Wait for a driver to accept
5. Complete the ride and rate your driver

### For Drivers
1. Register with email and password
2. Select "Driver" during registration
3. Add your vehicle details
4. Go online on the dashboard
5. Accept incoming ride requests
6. Complete rides and earn money

## Real-time Features

The app uses **Socket.io** for:
- Driver location updates
- Real-time ride notifications
- Live driver tracking

## Database Schema

### User Model
```javascript
{
  name, email, password, phone, userType,
  profileImage, address, rating, numberOfRatings
}
```

### Vehicle Model
```javascript
{
  driverId, licensePlate, model, year, seats,
  vehicleType, pricePerKm, pricePerHour, currentLocation
}
```

### Booking Model
```javascript
{
  customerId, driverId, vehicleId,
  pickupLocation, dropoffLocation, status,
  fare, distance, duration, paymentMethod
}
```

## Security

- Passwords are hashed with bcrypt
- JWT tokens for authentication
- Protected API endpoints with auth middleware
- Input validation on all endpoints

## Future Enhancements

- [ ] Google Maps integration
- [ ] Ride scheduling
- [ ] Referral system
- [ ] Premium ride types
- [ ] Driver background check
- [ ] Emergency support
- [ ] Multiple language support
- [ ] Push notifications
- [ ] Admin dashboard
- [ ] Mobile app (React Native)

## Troubleshooting

### MongoDB connection issues
- Ensure MongoDB is running: `mongod`
- Check MONGODB_URI in .env

### Frontend not connecting to backend
- Ensure backend is running on port 5000
- Check proxy setting in client/package.json

### Port already in use
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is open source and available under the MIT License.

## Support

For issues and questions, please open an issue on GitHub.

---

**Made with ❤️ by Your Team**
