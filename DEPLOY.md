# 🚀 Deployment Guide - Uber Clone App

## Quick Deploy (Free Hosting)

This guide deploys your app to:
- **Backend**: Render.com (Free)
- **Frontend**: Vercel.com (Free)  
- **Database**: MongoDB Atlas (Free 512MB)

---

## Step 1: Setup MongoDB Atlas (Free Database)

1. Go to **https://www.mongodb.com/cloud/atlas**
2. Click **"Try Free"** and create an account
3. Create a **FREE** cluster (M0 Sandbox)
4. Click **"Database Access"** → **"Add New Database User"**
   - Username: `uberclone`
   - Password: Generate a secure password (save it!)
   - Role: `Read and write to any database`
5. Click **"Network Access"** → **"Add IP Address"**
   - Click **"Allow Access from Anywhere"** (0.0.0.0/0)
6. Click **"Databases"** → **"Connect"** → **"Connect your application"**
7. Copy the connection string (looks like):
   ```
   mongodb+srv://uberclone:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
8. Replace `<password>` with your actual password

---

## Step 2: Deploy Backend to Render

1. Go to **https://render.com** and sign up (use GitHub)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository (or use "Public Git repository")
   - If public: `https://github.com/YOUR_USERNAME/uber-clone`
4. Configure the service:
   - **Name**: `uber-clone-api`
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add **Environment Variables**:
   ```
   NODE_ENV = production
   MONGODB_URI = mongodb+srv://uberclone:yourpassword@cluster0.xxxxx.mongodb.net/rental-app?retryWrites=true&w=majority
   JWT_SECRET = your_super_secret_key_at_least_32_characters_long
   CLIENT_URL = (leave empty for now, add after Vercel deploy)
   ```
6. Click **"Create Web Service"**
7. Wait for deployment (3-5 minutes)
8. Copy your backend URL: `https://uber-clone-api.onrender.com`

---

## Step 3: Deploy Frontend to Vercel

1. Go to **https://vercel.com** and sign up (use GitHub)
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. Configure:
   - **Root Directory**: `client`
   - **Framework Preset**: `Create React App`
5. Add **Environment Variables**:
   ```
   REACT_APP_API_URL = https://uber-clone-api.onrender.com/api
   REACT_APP_SOCKET_URL = https://uber-clone-api.onrender.com
   ```
6. Click **"Deploy"**
7. Wait for deployment (2-3 minutes)
8. Copy your frontend URL: `https://uber-clone.vercel.app`

---

## Step 4: Update Backend CORS

1. Go back to **Render.com** → Your service → **Environment**
2. Update `CLIENT_URL`:
   ```
   CLIENT_URL = https://uber-clone.vercel.app
   ```
3. Click **"Save Changes"** (will auto-redeploy)

---

## 🎉 Done! Your App is Live!

- **Frontend**: `https://uber-clone.vercel.app`
- **Backend API**: `https://uber-clone-api.onrender.com`

---

## Alternative: Push to GitHub First

If you haven't pushed to GitHub yet:

```bash
# Initialize git (if not done)
cd c:\Users\arivu\OneDrive\Desktop\uber
git init

# Create .gitignore
echo "node_modules" > .gitignore
echo ".env" >> .gitignore

# Add all files
git add .
git commit -m "Initial commit - Uber clone app"

# Create GitHub repo and push
# Go to github.com, create new repo named "uber-clone"
git remote add origin https://github.com/YOUR_USERNAME/uber-clone.git
git branch -M main
git push -u origin main
```

---

## Test Your Deployed App

1. Open `https://your-app.vercel.app`
2. Register as a **Customer** (e.g., phone: 9876543210)
3. Register as a **Driver** in another browser/incognito
4. Driver goes **Online**
5. Customer books a ride
6. Driver accepts and starts ride with OTP
7. Complete ride and rate!

---

## Troubleshooting

### Backend not starting?
- Check Render logs for errors
- Verify MONGODB_URI is correct
- Ensure JWT_SECRET is set

### CORS errors?
- Add your Vercel URL to CLIENT_URL in Render

### Database connection failed?
- Check MongoDB Atlas IP whitelist (0.0.0.0/0)
- Verify username/password in connection string

### Free tier limitations?
- Render: Spins down after 15 min inactivity (cold start ~30s)
- MongoDB Atlas: 512MB storage limit
- Vercel: 100GB bandwidth/month

---

## 📱 Share Your App!

Your app is now live! Share the Vercel URL with friends to test:
- One person as **Driver**
- Others as **Customers**
- Test the full ride flow!
