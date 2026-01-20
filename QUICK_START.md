# 🚀 5-Minute Startup Guide

## Before You Begin
- [ ] Node.js installed (https://nodejs.org)
- [ ] MongoDB running locally OR MongoDB Atlas account
- [ ] VS Code or any text editor
- [ ] Git (optional but recommended)

---

## Step 1: Install Dependencies (2 minutes)

Open terminal/command prompt in the `uber` folder:

### Option A: Quick Install
```bash
npm run install:all
```

### Option B: Manual Install
```bash
# Install backend dependencies
cd server
npm install
cd ..

# Install frontend dependencies
cd client
npm install
cd ..
```

✅ **Done!** Node modules installed.

---

## Step 2: Configure Environment (1 minute)

Edit `server/.env` file:

```
MONGODB_URI=mongodb://localhost:27017/rental-app
JWT_SECRET=dev_secret_key_12345
STRIPE_KEY=sk_test_your_key_later
PORT=5000
NODE_ENV=development
```

✅ **Done!** Environment configured.

---

## Step 3: Start MongoDB (30 seconds)

### Windows
```bash
mongod
```

### macOS
```bash
brew services start mongodb-community
```

### Using MongoDB Atlas (Cloud)
```
Update MONGODB_URI in .env to your Atlas connection string
```

✅ **Done!** Database ready.

---

## Step 4: Start Backend Server (30 seconds)

**Open Terminal 1:**

```bash
cd server
npm run dev
```

You should see:
```
Server running on port 5000
MongoDB connected
```

✅ **Done!** Backend running on http://localhost:5000

---

## Step 5: Start Frontend App (30 seconds)

**Open Terminal 2:**

```bash
cd client
npm start
```

Browser opens automatically to: http://localhost:3000

✅ **Done!** App ready to use!

---

## 🎮 Test the App

### Try These Actions:

1. **Register as Customer**
   - Email: customer@test.com
   - Password: Test123
   - Phone: 1234567890
   - Click Register

2. **Book a Ride**
   - Click "Book a Ride"
   - Enter pickup: "Home"
   - Enter dropoff: "Office"
   - Click "Request Ride"

3. **Register as Driver**
   - Open incognito/new browser
   - Register with different email
   - Select "Driver"
   - Toggle "Online"

4. **View Ride History**
   - Click "Your Rides"
   - See all bookings listed

---

## 📱 App Features Ready to Use

### Customer Features ✅
- Register/Login
- Book rides
- View history
- Rate drivers
- Real-time updates

### Driver Features ✅
- Register/Login
- Accept rides
- Track earnings
- Online/Offline toggle
- Real-time notifications

---

## 🛠️ Common Commands

```bash
# Start everything
npm run dev:server    # Terminal 1
npm run dev:client    # Terminal 2

# Stop servers
Ctrl+C in each terminal

# Install all dependencies
npm run install:all

# Build for production
npm run build

# Check MongoDB
mongosh
use rental-app
db.users.find()
```

---

## 📝 Default Ports

- Frontend: http://localhost:3000
- Backend: http://localhost:5000
- MongoDB: mongodb://localhost:27017

---

## ⚡ Stuck? Quick Fixes

```bash
# Port in use?
netstat -ano | findstr :5000

# MongoDB not running?
mongod

# Dependencies broken?
rm -rf node_modules && npm install

# Cache issues?
npm cache clean --force
```

See `TROUBLESHOOTING.md` for detailed help.

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| README.md | Project overview |
| SETUP.md | Detailed setup |
| QUICK_REFERENCE.md | Dev tips |
| ARCHITECTURE.md | System design |
| FILE_STRUCTURE.md | Code organization |
| TROUBLESHOOTING.md | Common issues |
| PROJECT_SUMMARY.md | Feature checklist |

---

## 🔐 Security Note

**Before Production:**
1. Change JWT_SECRET to strong random string
2. Use environment variables from secure vault
3. Add HTTPS
4. Use MongoDB Atlas instead of local
5. Add rate limiting
6. Add input validation

---

## ✨ Next Steps

1. ✅ Get app running (you are here)
2. ⚙️ Customize branding (colors, logo, name)
3. 🗺️ Add Google Maps
4. 💳 Add Stripe payments
5. 📧 Add email notifications
6. 📱 Deploy to production

---

## 🎯 Quick Customization

**Change Colors:**
- Search for `#667eea` in CSS files
- Replace with your color

**Change Company Name:**
- Search for "Rental App"
- Replace with your company name

**Add Logo:**
- Add image to `client/public/logo.png`
- Update in components

---

## 🆘 Need Help?

1. Check `TROUBLESHOOTING.md`
2. Review error message carefully
3. Check browser console (F12)
4. Check server logs
5. Verify environment variables
6. Try clearing cache (Ctrl+Shift+Delete)

---

## 🎉 You're All Set!

Your Uber-like rental app is running!

```
✅ Backend: Ready
✅ Frontend: Ready  
✅ Database: Ready
✅ Authentication: Ready
✅ Booking System: Ready
✅ Real-time: Ready
```

**Start customizing and building! 🚗**

---

**Questions?** See the other documentation files for detailed information.

**Happy coding! 🚀**
