# Quick Reference Guide

## Database Models

### User
- Customers and Drivers
- Authentication with password hashing
- Rating system
- Profile information

### Vehicle  
- Owned by drivers
- Pricing per km and hour
- Current location tracking
- Document storage (registration, insurance)

### Booking
- Links customers with drivers and vehicles
- Pickup/dropoff locations
- Status tracking (pending → accepted → completed)
- Fare calculation

### Rating
- Post-ride feedback
- Updates user average rating
- Reviews and comments

### Payment
- Transaction records
- Payment method tracking
- Status monitoring

## API Endpoints Reference

### Auth
- `POST /api/auth/register` - New user registration
- `POST /api/auth/login` - User login

### Vehicles
- `GET /api/vehicles` - List available vehicles
- `POST /api/vehicles` - Driver adds vehicle
- `PUT /api/vehicles/location` - Update driver location

### Bookings
- `POST /api/bookings` - Request a ride
- `POST /api/bookings/accept` - Accept ride (driver)
- `GET /api/bookings` - Get user bookings
- `PUT /api/bookings/complete` - Complete ride

### Ratings
- `POST /api/ratings` - Add rating and review
- `GET /api/ratings/:userId` - Get user rating

### Payments
- `POST /api/payments` - Process payment

## Environment Variables

```
MONGODB_URI=mongodb://localhost:27017/rental-app
JWT_SECRET=your_jwt_secret_key
STRIPE_KEY=sk_test_your_stripe_key  
PORT=5000
NODE_ENV=development
```

## Key Technologies

- **Authentication**: JWT tokens
- **Database**: MongoDB with Mongoose
- **Real-time**: Socket.io
- **Payments**: Stripe (ready to integrate)
- **Maps**: Leaflet/Maps (ready to integrate)
- **Security**: Bcrypt for password hashing

## To Add Features

1. **Google Maps Integration** - Update BookingPage with map component
2. **Payment Processing** - Implement Stripe in paymentRoutes
3. **Email Notifications** - Add nodemailer to send emails
4. **SMS Notifications** - Add Twilio for SMS
5. **Admin Dashboard** - Create admin routes and pages
6. **Push Notifications** - Add Firebase Cloud Messaging

## File Structure for New Features

1. Create model in `server/models/`
2. Create controller in `server/controllers/`
3. Create routes in `server/routes/`
4. Create pages in `client/src/pages/`
5. Create styles in `client/src/styles/`
6. Update API service in `client/src/services/api.js`

## Testing

- Register as customer and book rides
- Register as driver and accept rides
- Complete rides and add ratings
- Check ride history

## Common Customizations

**Change Primary Color**: Update `#667eea` in CSS files
**Change Company Name**: Replace "Rental App" text globally
**Add Logo**: Update public/index.html and navbar components
**Custom Pricing**: Modify `pricePerKm` and `pricePerHour` fields

## Deployment Checklist

- [ ] Setup MongoDB Atlas
- [ ] Update MONGODB_URI to Atlas URL
- [ ] Get Stripe API keys
- [ ] Update JWT_SECRET to secure key
- [ ] Deploy backend to Heroku/Railway/Vercel
- [ ] Deploy frontend to Vercel/Netlify
- [ ] Update API_URL in frontend
- [ ] Setup domain and SSL
- [ ] Test all features in production
