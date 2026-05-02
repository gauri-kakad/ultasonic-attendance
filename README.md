# 🔊 Ultrasonic Attendance System — v3 (Production Ready)

## Quick Start (Local Development)

```bash
# Terminal 1 — Backend
cd backend
npm install
cp .env.example .env       # Edit .env with your values
npm run dev

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev

# Terminal 3 — ngrok (for phone testing only)
ngrok http 5173
```

Open http://localhost:5173 on laptop, ngrok URL on phone.

---

## Deployment (Vercel + Render + MongoDB Atlas)

### Step 1 — MongoDB Atlas (Free Cloud Database)

1. Go to https://cloud.mongodb.com → Create free account
2. Create a free cluster (M0 — Free Forever)
3. Database Access → Add user → username + password → note them down
4. Network Access → Add IP Address → Allow Access from Anywhere (0.0.0.0/0)
5. Clusters → Connect → Drivers → Copy connection string
6. Replace `<password>` in the string with your actual password

```
mongodb+srv://youruser:yourpass@cluster0.xxxxx.mongodb.net/ultrasonic_attendance
```

---

### Step 2 — Deploy Backend to Render.com

1. Push your code to GitHub (backend folder)
2. Go to https://render.com → New → Web Service
3. Connect your GitHub repo
4. Settings:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Add Environment Variables:
   ```
   NODE_ENV        = production
   PORT            = 10000
   MONGODB_URI     = (your Atlas connection string)
   JWT_SECRET      = (generate: openssl rand -hex 64)
   JWT_EXPIRES_IN  = 7d
   CLIENT_URL      = https://your-app.vercel.app
   ```
6. Deploy → Copy the URL: `https://your-backend.onrender.com`

---

### Step 3 — Deploy Frontend to Vercel

1. Go to https://vercel.com → New Project
2. Import your GitHub repo
3. Root Directory: `frontend`
4. Add Environment Variables:
   ```
   VITE_API_URL    = https://your-backend.onrender.com/api
   VITE_SOCKET_URL = https://your-backend.onrender.com
   ```
5. Deploy → Copy the URL: `https://your-app.vercel.app`

---

### Step 4 — Update Backend CORS

Go back to Render → your service → Environment → Update:
```
CLIENT_URL = https://your-app.vercel.app
```
Render will auto-redeploy.

---

### Step 5 — Prevent Render Free Tier Sleep

Option A — UptimeRobot (recommended, free):
1. Go to https://uptimerobot.com → Sign up free
2. Add Monitor → HTTP(s)
3. URL: `https://your-backend.onrender.com/api/health`
4. Interval: Every 5 minutes
5. Done — server stays awake 24/7

Option B — Run locally:
```bash
cd backend
BACKEND_URL=https://your-backend.onrender.com/api/health node keep-alive.js
```

---

## Environment Variables Reference

### Backend (.env)
| Variable | Example | Notes |
|----------|---------|-------|
| NODE_ENV | production | Changes logging, error details |
| PORT | 5000 | Render sets this automatically |
| MONGODB_URI | mongodb+srv://... | Get from MongoDB Atlas |
| JWT_SECRET | abc123... | Long random string, keep secret |
| JWT_EXPIRES_IN | 7d | How long login sessions last |
| CLIENT_URL | https://app.vercel.app | Your Vercel URL (CORS) |

### Frontend (.env.production)
| Variable | Example | Notes |
|----------|---------|-------|
| VITE_API_URL | https://backend.onrender.com/api | Your Render URL + /api |
| VITE_SOCKET_URL | https://backend.onrender.com | Your Render URL (no /api) |

---

## Troubleshooting Deployment

| Problem | Cause | Fix |
|---------|-------|-----|
| CORS error in browser | CLIENT_URL wrong | Update backend env to match Vercel URL exactly |
| Socket not connecting | VITE_SOCKET_URL wrong | Must be Render URL without /api |
| Mic blocked on phone | HTTP instead of HTTPS | Vercel and Render both provide HTTPS automatically |
| Server timeout (30-60s) | Render free tier sleeping | Set up UptimeRobot |
| "Student not found" | Roll number mismatch | Roll number student types must exactly match teacher's student record |
| Login works, attendance fails | VITE_API_URL wrong | Check both env vars are set on Vercel |
| MongoDB connection failed | IP not whitelisted | MongoDB Atlas → Network Access → Allow 0.0.0.0/0 |

---

## Project Structure

```
ultrasonic-v3/
├── .gitignore
├── render.yaml              Render auto-deploy config
├── README.md
│
├── backend/
│   ├── .env                 Local dev (not committed)
│   ├── .env.example         Template — commit this
│   ├── .gitignore
│   ├── keep-alive.js        Prevents Render free tier sleep
│   ├── package.json
│   └── src/
│       ├── index.js         Express + security middleware
│       ├── config/db.js     MongoDB with retry logic
│       ├── middleware/auth.js
│       ├── models/          User, Student, Session, Attendance
│       ├── controllers/     Auth, Teacher, Session, Attendance
│       ├── routes/
│       └── sockets/socketManager.js
│
└── frontend/
    ├── .env.development     Local URLs (not committed)
    ├── .env.production      Production URLs (not committed)
    ├── .env.example         Template — commit this
    ├── .gitignore
    ├── vercel.json          Vercel deploy config
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── context/AuthContext.jsx
        ├── hooks/useUltrasonic.js
        ├── utils/api.js     Uses VITE_API_URL env var
        ├── utils/socket.js  Uses VITE_SOCKET_URL env var
        └── pages/
```

---

## Security Features in This Version

- Helmet.js — sets secure HTTP headers
- Rate limiting — 200 req/15min global, 20 login attempts/15min, 10 verify attempts/min
- Input validation and sanitization on all endpoints
- CORS locked to specific origins in production
- JWT expiry checked on frontend before making requests
- Passwords hashed with bcrypt (12 rounds)
- Generic error messages in production (no stack traces)
- Graceful shutdown on SIGTERM/SIGINT

---

## Speaker Tips for Large Classrooms

| Room size | Recommendation |
|-----------|---------------|
| Small (< 20 students) | Laptop speaker works fine |
| Medium (20–50 students) | External Bluetooth speaker near front |
| Large (50+ students) | Multiple devices placed around room, all running teacher session |
| Auditorium | Dedicated ultrasonic transducer connected to PA system |
