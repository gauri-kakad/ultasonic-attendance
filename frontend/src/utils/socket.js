import { io } from 'socket.io-client'

let socket = null

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'

export const connectSocket = (token) => {
  // Already connected — reuse
  if (socket?.connected) return socket

  // Disconnect stale socket
  if (socket) { socket.disconnect(); socket = null }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 10,
    timeout: 20000,
  })

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id)
  })
  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason)
    // Auto-reconnect except on deliberate disconnect
    if (reason === 'io server disconnect') {
      socket.connect()
    }
  })
  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message)
  })
  socket.on('reconnect', (attempt) => {
    console.log('[Socket] Reconnected after', attempt, 'attempts')
  })

  return socket
}

export const getSocket = () => socket

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export default { connectSocket, getSocket, disconnectSocket }