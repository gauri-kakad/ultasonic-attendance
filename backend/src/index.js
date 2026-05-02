const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { initSocket } = require('./sockets/socketManager');

dotenv.config();

const app = express();
const server = http.createServer(app);

// ── Database ──────────────────────────────────────────────────
connectDB();

// ── Socket.io ─────────────────────────────────────────────────
initSocket(server);

// ── Security middleware ───────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
}));
app.use(compression());

// ── CORS ──────────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error('CORS: origin not allowed — ' + origin));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

// ── Logging ───────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── Global rate limiter ───────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});
app.use('/api', globalLimiter);

// ── Auth rate limiter (stricter) ──────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many login attempts, please try again in 15 minutes.' }
});

// ── Attendance verify rate limiter ────────────────────────────
const verifyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { message: 'Too many verification attempts. Please wait a minute.' }
});

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',       authLimiter,   require('./routes/auth'));
app.use('/api/teacher',                   require('./routes/teacher'));
app.use('/api/student',                   require('./routes/student'));
app.use('/api/attendance', verifyLimiter, require('./routes/attendance'));
app.use('/api/sessions',                  require('./routes/sessions'));

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    env: process.env.NODE_ENV || 'development',
    time: new Date().toISOString(),
    uptime: Math.round(process.uptime()) + 's'
  });
});

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  if (err.message.startsWith('CORS')) {
    return res.status(403).json({ message: err.message });
  }
  res.status(err.status || 500).json({
    message: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

// ── Start server ──────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('');
  console.log('  🔊  Ultrasonic Attendance System v2.0');
  console.log('  ──────────────────────────────────────');
  console.log('  Env     :', process.env.NODE_ENV || 'development');
  console.log('  Server  : http://localhost:' + PORT);
  console.log('  Health  : http://localhost:' + PORT + '/api/health');
  console.log('');
});

// ── Graceful shutdown ─────────────────────────────────────────
process.on('SIGTERM', () => {
  console.log('SIGTERM received — shutting down gracefully');
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  console.log('SIGINT received — shutting down gracefully');
  server.close(() => process.exit(0));
});