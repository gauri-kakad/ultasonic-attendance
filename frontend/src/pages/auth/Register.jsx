import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

export default function Register() {
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'student', rollNumber:'', class:'', subjects:'' })
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = { ...form, subjects: form.subjects ? form.subjects.split(',').map(s=>s.trim()).filter(Boolean) : [] }
      const user = await register(payload)
      toast.success('Account created!')
      navigate(user.role === 'teacher' ? '/teacher' : '/student')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ width:'100%', maxWidth:500 }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ width:50, height:50, borderRadius:14, background:'linear-gradient(135deg,#16a34a,#22c55e)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, margin:'0 auto 12px', boxShadow:'0 4px 20px rgba(22,163,74,0.25)' }}>🔊</div>
          <h1 style={{ fontFamily:'Plus Jakarta Sans', fontWeight:700, fontSize:20, color:'var(--text1)' }}>Create Account</h1>
          <p style={{ color:'var(--text3)', fontSize:13, marginTop:4 }}>Join the Ultrasonic Attendance System</p>
        </div>

        <div className="card" style={{ padding:30 }}>
          <form onSubmit={handleSubmit}>
            <div style={{ display:'flex', gap:8, marginBottom:22 }}>
              {['teacher','student'].map(r => (
                <button key={r} type="button" onClick={() => setForm(p=>({...p,role:r}))}
                  style={{ flex:1, padding:'10px 16px', borderRadius:10, border:`1.5px solid ${form.role===r?'var(--accent)':'var(--border)'}`, background: form.role===r?'var(--accent-light)':'transparent', color: form.role===r?'var(--accent)':'var(--text2)', cursor:'pointer', fontFamily:'Plus Jakarta Sans', fontWeight:600, fontSize:13, textTransform:'capitalize', transition:'all 0.15s' }}>
                  {r === 'teacher' ? '👩‍🏫' : '👨‍🎓'} {r}
                </button>
              ))}
            </div>

            <div style={{ display:'grid', gap:14 }}>
              <div>
                <label className="label">Full Name</label>
                <input className="input" placeholder="Dr. Jane Smith" value={form.name} onChange={set('name')} required />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" placeholder="you@university.edu" value={form.email} onChange={set('email')} required />
              </div>
              <div>
                <label className="label">Password</label>
                <input className="input" type="password" placeholder="Min 6 characters" value={form.password} onChange={set('password')} required minLength={6} />
              </div>
              {form.role === 'student' && (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div>
                      <label className="label">Roll Number</label>
                      <input className="input" placeholder="CS2024001" value={form.rollNumber} onChange={set('rollNumber')} />
                    </div>
                    <div>
                      <label className="label">Class</label>
                      <input className="input" placeholder="CS-3A" value={form.class} onChange={set('class')} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Subjects (comma separated)</label>
                    <input className="input" placeholder="DSA, OS, CN, DBMS" value={form.subjects} onChange={set('subjects')} />
                  </div>
                </>
              )}
            </div>

            <button className="btn-primary" type="submit" disabled={loading} style={{ width:'100%', justifyContent:'center', padding:'12px', marginTop:22, fontSize:15 }}>
              {loading ? 'Creating...' : '→  Create Account'}
            </button>
          </form>
          <div style={{ textAlign:'center', marginTop:18, color:'var(--text3)', fontSize:13 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color:'var(--accent)', textDecoration:'none', fontWeight:600 }}>Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  )
}