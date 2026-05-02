import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { connectSocket, disconnectSocket } from '../utils/socket'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore session on app load
  useEffect(() => {
    const savedToken = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (savedToken && savedUser) {
      try {
        const parsed = JSON.parse(savedUser)
        // Check token not expired (basic check)
        const payload = JSON.parse(atob(savedToken.split('.')[1]))
        if (payload.exp * 1000 > Date.now()) {
          setToken(savedToken)
          setUser(parsed)
          connectSocket(savedToken)
        } else {
          // Token expired — clear storage
          localStorage.removeItem('token')
          localStorage.removeItem('user')
        }
      } catch {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    }
    setLoading(false)
  }, [])

  const saveSession = useCallback((token, user) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    setToken(token)
    setUser(user)
    connectSocket(token)
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    const { token, user } = res.data
    saveSession(token, user)
    return user
  }, [saveSession])

  const register = useCallback(async (data) => {
    const res = await api.post('/auth/register', data)
    const { token, user } = res.data
    saveSession(token, user)
    return user
  }, [saveSession])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
    disconnectSocket()
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}