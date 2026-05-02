import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const user = await login(email, password)
      toast.success(`Welcome back, ${user.name}!`)
      navigate(user.role === 'teacher' ? '/teacher' : '/student')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid credentials')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      {/* Subtle background pattern */}
      <div style={{ position:'fixed', inset:0, backgroundImage:'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.04) 1px, transparent 0)', backgroundSize:'24px 24px', pointerEvents:'none' }} />
      
      <div style={{ width:'100%', maxWidth:420, position:'relative' }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:56, height:56, borderRadius:16, background:'linear-gradient(135deg,#16a34a,#22c55e)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, margin:'0 auto 14px', boxShadow:'0 4px 20px rgba(22,163,74,0.3)' }}>🔊</div>
          <h1 style={{ fontFamily:'Plus Jakarta Sans', fontWeight:700, fontSize:22, color:'var(--text1)', marginBottom:4 }}>Ultrasonic Attendance</h1>
          <div className="sonic-wave" style={{ justifyContent:'center' }}>
            {[...Array(8)].map((_,i) => <div key={i} className="sonic-bar" />)}
          </div>
        </div>

        <div className="card" style={{ padding:32 }}>
          <h2 style={{ fontWeight:700, fontSize:18, marginBottom:6 }}>Sign In</h2>
          <p style={{ color:'var(--text3)', fontSize:13, marginBottom:24 }}>Access your attendance portal</p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom:16 }}>
              <label className="label">Email Address</label>
              <input className="input" type="email" placeholder="you@university.edu" value={email} onChange={e=>setEmail(e.target.value)} required />
            </div>
            <div style={{ marginBottom:24 }}>
              <label className="label">Password</label>
              <input className="input" type="password" placeholder="Enter password" value={password} onChange={e=>setPassword(e.target.value)} required />
            </div>
            <button className="btn-primary" type="submit" disabled={loading} style={{ width:'100%', justifyContent:'center', padding:'12px', fontSize:15 }}>
              {loading ? 'Signing in...' : '→  Sign In'}
            </button>
          </form>

          <div style={{ textAlign:'center', marginTop:20, color:'var(--text3)', fontSize:13 }}>
            No account?{' '}
            <Link to="/register" style={{ color:'var(--accent)', textDecoration:'none', fontWeight:600 }}>Register here</Link>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}