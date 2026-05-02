import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import TeacherDashboard from './pages/teacher/Dashboard'
import TeacherStudents from './pages/teacher/Students'
import TeacherAttendance from './pages/teacher/Attendance'
import TeacherHistory from './pages/teacher/History'
import StudentDashboard from './pages/student/Dashboard'
import StudentMarkAttendance from './pages/student/MarkAttendance'
import StudentHistory from './pages/student/History'

const ProtectedRoute = ({ children, role }) => {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg)' }}>
      <div style={{ textAlign:'center' }}>
        <div className="sonic-wave" style={{ justifyContent:'center', marginBottom:16 }}>
          {[...Array(8)].map((_,i) => <div key={i} className="sonic-bar" />)}
        </div>
        <p style={{ color:'var(--text3)', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Loading...</p>
      </div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to={user.role === 'teacher' ? '/teacher' : '/student'} replace />
  return children
}

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to={user.role === 'teacher' ? '/teacher' : '/student'} replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background:'#fff',
              color:'#0f172a',
              border:'1px solid #e4e7ec',
              fontFamily:"'Plus Jakarta Sans',sans-serif",
              fontSize:13,
              boxShadow:'0 4px 16px rgba(0,0,0,0.08)'
            },
            success: { iconTheme: { primary:'#22c55e', secondary:'#fff' } },
            error: { iconTheme: { primary:'#ef4444', secondary:'#fff' } }
          }}
        />
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/teacher" element={<ProtectedRoute role="teacher"><TeacherDashboard /></ProtectedRoute>} />
          <Route path="/teacher/students" element={<ProtectedRoute role="teacher"><TeacherStudents /></ProtectedRoute>} />
          <Route path="/teacher/attendance" element={<ProtectedRoute role="teacher"><TeacherAttendance /></ProtectedRoute>} />
          <Route path="/teacher/history" element={<ProtectedRoute role="teacher"><TeacherHistory /></ProtectedRoute>} />
          <Route path="/student" element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/mark" element={<ProtectedRoute role="student"><StudentMarkAttendance /></ProtectedRoute>} />
          <Route path="/student/history" element={<ProtectedRoute role="student"><StudentHistory /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}