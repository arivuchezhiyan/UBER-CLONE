# 🔧 Troubleshooting Guide

## Common Issues & Solutions

### 1. MongoDB Connection Error

**Error**: `MongooseError: connect ECONNREFUSED`

**Solution**:
```bash
# Make sure MongoDB is running
mongod

# On macOS with Homebrew
brew services start mongodb-community

# On Windows, check if MongoDB service is running
# If not installed, download from https://www.mongodb.com/try/download/community
```

**Verify Connection**:
```bash
# Test MongoDB is running
mongo --version

# Connect to local MongoDB
mongosh
```

---

### 2. Port Already in Use

**Error**: `Error: listen EADDRINUSE: address already in use :::5000`

**Solution**:

**Windows**:
```bash
# Find process on port 5000
netstat -ano | findstr :5000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Or change port in server/.env
PORT=5001
```

**macOS/Linux**:
```bash
# Find process on port 5000
lsof -i :5000

# Kill the process (replace PID with actual process ID)
kill -9 <PID>
```

---

### 3. Dependencies Installation Failed

**Error**: `npm ERR! code ERESOLVE`

**Solution**:
```bash
# Clear npm cache
npm cache clean --force

# Try installation again
npm install

# Or use legacy peer deps flag
npm install --legacy-peer-deps

# Or delete node_modules and try again
rm -rf node_modules
npm install
```

---

### 4. JWT Token Errors

**Error**: `Invalid token` or `No token provided`

**Solution**:
- Make sure to include Authorization header: `Authorization: Bearer <token>`
- Check JWT_SECRET is set in .env
- Verify token hasn't expired (set to 7 days)
- Clear localStorage and login again

```javascript
// Correct header format
headers: { Authorization: `Bearer ${token}` }
```

---

### 5. CORS (Cross-Origin) Error

**Error**: `Access to XMLHttpRequest blocked by CORS policy`

**Solution**:
- Ensure `cors()` middleware is in server.js (already included)
- Make sure frontend API URL matches backend URL
- Check proxy setting in client/package.json

```javascript
// In server.js (already set)
app.use(cors());

// In client/package.json
"proxy": "http://localhost:5000"
```

---

### 6. React App Not Loading

**Error**: Blank page or `Cannot GET /`

**Solution**:
```bash
# Make sure you're in the client folder
cd client

# Start React app
npm start

# Should open http://localhost:3000 automatically
# If not, open manually

# Clear cache if needed
rm -rf node_modules
npm install
npm start
```

---

### 7. API Calls Not Working

**Error**: `404 Not Found` or `Network Error`

**Solution**:
1. Check backend is running on port 5000
2. Verify API endpoint spelling matches routes
3. Check Content-Type header: `application/json`
4. Use Postman to test endpoint separately

```bash
# Test backend is running
curl http://localhost:5000/api/health

# Should return: {"status":"Server is running"}
```

---

### 8. Socket.io Connection Failed

**Error**: WebSocket connection fails

**Solution**:
```javascript
// In server.js (should be set correctly)
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Verify port matches
const server = http.createServer(app);
server.listen(PORT, () => console.log(`Server on ${PORT}`));
```

---

### 9. Environment Variables Not Loading

**Error**: `undefined` values for process.env variables

**Solution**:
```bash
# Make sure .env file exists in server folder
# File should be: server/.env

# Restart server after creating .env
# npm run dev should show loaded values

# Check .env file has correct format:
MONGODB_URI=mongodb://localhost:27017/rental-app
JWT_SECRET=your_secret_key
PORT=5000
```

---

### 10. Database Query Errors

**Error**: `ValidationError` or `CastError`

**Solution**:
- Check field names match schema in models/
- Verify ObjectId format for references
- Check required fields are provided
- Review MongoDB schema documentation

```javascript
// Example User schema (server/models/User.js)
{
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  userType: { type: String, enum: ['customer', 'driver'], required: true }
}
```

---

### 11. React Import Errors

**Error**: `Module not found` or `Can't resolve`

**Solution**:
```bash
# Check imports use correct path
// ❌ Wrong
import { api } from 'api'

// ✅ Correct
import { registerUser } from '../services/api'

# Reinstall node_modules
rm -rf node_modules
npm install
npm start
```

---

### 12. Styling Issues

**Error**: CSS not applied or styles look broken

**Solution**:
```javascript
// Check CSS file is imported correctly
import '../styles/Auth.css'

// Make sure file exists in correct location
client/src/styles/Auth.css

// Clear browser cache (Ctrl+F5 or Cmd+Shift+R)
// Or use incognito mode to test

// Check no typos in className
// ❌ Wrong
<div classname="container">

// ✅ Correct
<div className="container">
```

---

## Debugging Tips

### 1. Check Console Logs
```javascript
// Add console.log to debug
console.log('Response:', response.data);
console.log('Error:', error.message);
```

### 2. Use Browser DevTools
- Open: F12 or Cmd+Option+I
- Network tab to check API calls
- Console for JavaScript errors
- Application tab to check localStorage

### 3. MongoDB Debug
```bash
# View all databases
show dbs

# Switch to rental-app
use rental-app

# View all collections
show collections

# View users
db.users.find()

# View bookings
db.bookings.find()
```

### 4. Test API with Postman
```
Method: POST
URL: http://localhost:5000/api/auth/login
Headers: Content-Type: application/json
Body: {
  "email": "test@example.com",
  "password": "password123"
}
```

### 5. Check Network Requests
- Open DevTools → Network tab
- Perform action that fails
- Click on request to see full details
- Check Status, Response, Headers

---

## Performance Issues

### Slow Database Queries

**Solution**: Add indexes to frequently queried fields
```javascript
// In model file
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, index: true },
  userType: { type: String, enum: ['customer', 'driver'], index: true }
});
```

### High Memory Usage

**Solution**: 
- Limit results: `.limit(10)`
- Use pagination
- Close connections properly
- Clear intervals/timers

### Slow Frontend

**Solution**:
- Use React DevTools Profiler
- Optimize re-renders
- Lazy load components
- Minimize CSS files

---

## Testing Checklist

- [ ] Can register as customer
- [ ] Can register as driver
- [ ] Can login with correct credentials
- [ ] Correct error for wrong password
- [ ] Can book a ride
- [ ] Can view ride history
- [ ] Driver can go online/offline
- [ ] Driver can see incoming rides
- [ ] Can complete a ride
- [ ] Can rate a ride
- [ ] All pages load without errors
- [ ] Styling looks correct on mobile

---

## Getting Help

### Resources
- **MongoDB**: https://docs.mongodb.com
- **Express**: https://expressjs.com
- **React**: https://react.dev
- **Mongoose**: https://mongoosejs.com
- **Socket.io**: https://socket.io/docs

### If Still Having Issues
1. Check error message carefully
2. Search error online
3. Check relevant documentation
4. Review similar code in project
5. Try simpler test case first
6. Ask on Stack Overflow with full error

---

## Quick Fixes Summary

```bash
# Port in use
netstat -ano | findstr :5000

# Dependencies broken
rm -rf node_modules && npm install

# MongoDB not running
mongod

# Clear cache
npm cache clean --force

# Reinstall everything
npm run install:all

# Restart everything
# Kill all terminals and start fresh
```

---

Remember: **Most issues are configuration-related!** Double-check:
- ✅ MongoDB is running
- ✅ Environment variables in .env
- ✅ Port 5000 is free
- ✅ All dependencies installed
- ✅ No typos in imports/routes
- ✅ Browser cache cleared

**Happy coding! 🚀**
