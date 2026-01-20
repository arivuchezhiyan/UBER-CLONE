# 🚀 Run This Now - Complete Commands

## Copy and Paste These Commands

### Step 1: Install All Dependencies
```bash
npm run install:all
```

Or do it manually:
```bash
cd server
npm install
cd ../client
npm install
cd ..
```

### Step 2: Start MongoDB

**Windows/Command Prompt:**
```bash
mongod
```

**macOS/Homebrew:**
```bash
brew services start mongodb-community
```

**Using MongoDB Atlas (Cloud - Skip MongoDB locally):**
```
Update MONGODB_URI in server/.env to your Atlas URL
```

### Step 3: Open Two Terminals

**Terminal 1 - Backend Server:**
```bash
cd server
npm run dev
```

Expected output:
```
Server running on port 5000
MongoDB connected
```

**Terminal 2 - Frontend React App:**
```bash
cd client
npm start
```

Expected output:
```
Compiled successfully!
You can now view rental-app-client in the browser.
Local: http://localhost:3000
```

---

## 🎯 Open Your App

```
http://localhost:3000
```

Browser should open automatically!

---

## ✅ Verify Everything Works

1. **Login Page** - You should see the rental app login screen
2. **Register** - Create a test account
3. **Book a Ride** - Test ride booking
4. **View History** - See your bookings

---

## 🆘 If Port 5000 is In Use

**Windows:**
```bash
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

**macOS/Linux:**
```bash
lsof -i :5000
kill -9 <PID>
```

**Or change port in server/.env:**
```
PORT=5001
```

---

## 🆘 If MongoDB Won't Start

**Windows:**
```bash
# Install MongoDB Community Edition
# Download: https://www.mongodb.com/try/download/community
# Follow installer instructions

# Or use MongoDB Atlas (Cloud)
# https://www.mongodb.com/cloud/atlas
```

**macOS:**
```bash
# Install MongoDB via Homebrew
brew tap mongodb/brew
brew install mongodb-community

# Start service
brew services start mongodb-community

# Stop service
brew services stop mongodb-community
```

---

## 📊 API Testing (Optional)

**Test Backend is Running:**
```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{"status":"Server is running"}
```

---

## 🎓 Test Account Workflow

### Create Customer Account
1. Go to http://localhost:3000
2. Click "Register here"
3. Fill in details:
   - Name: John Customer
   - Email: customer@test.com
   - Password: Test123!
   - Phone: 1234567890
   - Select: "Customer"
4. Click "Register"

### Book a Ride
1. Click "Book a Ride"
2. Enter:
   - Pickup: Home
   - Dropoff: Office
3. Click "Request Ride"
4. See confirmation message

### Create Driver Account
1. Open new incognito browser (or different browser)
2. Go to http://localhost:3000
3. Click "Register here"
4. Fill in details:
   - Name: John Driver
   - Email: driver@test.com
   - Password: Test123!
   - Phone: 9876543210
   - Select: "Driver"
5. Click "Register"

### Driver Accepts Ride
1. Dashboard automatically shows available rides
2. Click "Toggle Online" to go online
3. See incoming ride requests
4. Click "Accept Ride"

---

## 📁 Project Structure Quick Check

Verify these folders exist:
```
uber/
├── server/
│   ├── models/
│   ├── controllers/
│   ├── routes/
│   ├── middleware/
│   ├── package.json
│   └── server.js
├── client/
│   ├── src/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── styles/
│   │   └── App.js
│   └── package.json
└── README.md
```

---

## 🔧 Useful Commands

```bash
# Install specific package
npm install package-name

# Update all packages
npm update

# Check for security vulnerabilities
npm audit

# Clean cache
npm cache clean --force

# Run build
npm run build

# Stop server
Ctrl+C (in terminal)

# View installed packages
npm list

# Check Node version
node --version

# Check npm version
npm --version

# MongoDB commands
mongosh                    # Open MongoDB shell
use rental-app            # Switch database
db.users.find()          # View users
db.bookings.find()       # View bookings
db.users.deleteMany({})  # Clear all users (testing only!)
```

---

## 🎯 First Time Checklist

- [ ] Node.js installed (`node --version`)
- [ ] npm available (`npm --version`)
- [ ] MongoDB running locally OR MongoDB Atlas account
- [ ] `.env` file exists in `server/` folder
- [ ] `npm run install:all` completed
- [ ] `npm run dev:server` running in Terminal 1
- [ ] `npm run dev:client` running in Terminal 2
- [ ] http://localhost:3000 opens in browser
- [ ] Can register and login
- [ ] Can book a ride
- [ ] Backend shows no errors

---

## ⚡ Quick Tips

1. **Keep Both Servers Running**
   - Don't close Terminal 1 or Terminal 2
   - They must both run simultaneously

2. **Browser Cache Issues**
   - Press Ctrl+Shift+Delete to clear cache
   - Or use Incognito/Private mode for testing

3. **Changes Not Showing**
   - Backend: Auto-reloads (nodemon)
   - Frontend: Auto-reloads (npm start)
   - If not: Stop and restart the server

4. **Check Console for Errors**
   - Browser: Press F12
   - Look at Network tab for API errors
   - Look at Console tab for JS errors

5. **Database Issues**
   - Run `mongosh` to verify MongoDB works
   - Check MONGODB_URI in .env

---

## 🆘 If Something Breaks

```bash
# Step 1: Stop all servers (Ctrl+C in both terminals)

# Step 2: Clear npm cache
npm cache clean --force

# Step 3: Delete node_modules and reinstall
rm -rf node_modules server/node_modules client/node_modules
npm run install:all

# Step 4: Restart MongoDB
mongod

# Step 5: Start servers again
cd server && npm run dev     # Terminal 1
cd client && npm start       # Terminal 2
```

---

## 📞 Quick Reference

| Problem | Solution |
|---------|----------|
| Port in use | Kill process or change PORT in .env |
| MongoDB error | Start mongod or use MongoDB Atlas |
| Dependencies not installing | Clear cache: `npm cache clean --force` |
| App not loading | Hard refresh: Ctrl+F5 or Cmd+Shift+R |
| API calls failing | Check backend is running on :5000 |
| Styles look broken | Clear browser cache or use incognito |
| Lost progress | Data is in MongoDB, should persist |

---

## 🎉 When Everything Works

You should see:
```
✅ Backend running on http://localhost:5000
✅ Frontend running on http://localhost:3000
✅ Login page displays in browser
✅ Can create new accounts
✅ Can book rides
✅ Can view history
✅ No errors in console
```

---

## 🎊 You're Ready!

Run these commands now:

```bash
# 1. Install
npm run install:all

# 2. Start MongoDB
mongod

# 3. Start Backend (Terminal 1)
cd server && npm run dev

# 4. Start Frontend (Terminal 2)
cd client && npm start
```

**That's it! Your app is running! 🚗**

See you at http://localhost:3000

---

**Happy coding! 🚀**
