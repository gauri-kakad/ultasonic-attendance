const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

let io;
const socketMeta = new Map();

function initSocket(server) {
  const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map(o => o.trim());

  io = socketIo(server, {
    cors: {
      origin: function(origin, callback) {
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
          return callback(null, true);
        }
        return callback(new Error('Socket CORS: origin not allowed'));
      },
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    // Allow upgrade from polling to websocket
    allowUpgrades: true,
  });

  // Auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] + ${socket.id} (${socket.userRole})`);

    // Teacher joins session room
    socket.on('teacher:join-session', ({ sessionId }) => {
      socket.join(`session:${sessionId}`);
      socketMeta.set(socket.id, { userId: socket.userId, role: 'teacher', sessionId });
      console.log(`[Socket] Teacher joined session:${sessionId}`);
    });

    // Student joins session room
    socket.on('student:join-session', ({ sessionId }) => {
      socket.join(`session:${sessionId}`);
      socketMeta.set(socket.id, { userId: socket.userId, role: 'student', sessionId });
      console.log(`[Socket] Student joined session:${sessionId}`);
    });

    // Teacher ends session
    socket.on('teacher:end-session', ({ sessionId }) => {
      io.to(`session:${sessionId}`).emit('session:ended', { sessionId });
    });

    socket.on('disconnect', (reason) => {
      socketMeta.delete(socket.id);
      console.log(`[Socket] - ${socket.id} (${reason})`);
    });

    socket.on('error', (err) => {
      console.error('[Socket] Error:', err.message);
    });
  });

  return io;
}

function getIO() { return io; }

function emitAttendanceUpdate(sessionId, data) {
  if (!io) return;
  io.to(`session:${sessionId}`).emit('session:attendance-update', data);
  console.log(`[Socket] Attendance update → session:${sessionId} (${data.name})`);
}

function emitTokenRefresh(sessionId, data) {
  if (!io) return;
  io.to(`session:${sessionId}`).emit('session:token-refresh', data);
}

function emitNewSession(data) {
  if (!io) return;
  io.emit('session:new', data);
}

module.exports = { initSocket, getIO, emitAttendanceUpdate, emitTokenRefresh, emitNewSession };