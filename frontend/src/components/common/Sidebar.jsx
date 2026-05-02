import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

const teacherNav = [
  { to:'/teacher', label:'Dashboard', icon:'▦', exact:true },
  { to:'/teacher/students', label:'Students', icon:'◈' },
  { to:'/teacher/attendance', label:'Live Attendance', icon:'◎' },
  { to:'/teacher/history', label:'History & Export', icon:'◷' },
]
const studentNav = [
  { to:'/student', label:'Dashboard', icon:'▦', exact:true },
  { to:'/student/mark', label:'Mark Attendance', icon:'◎' },
  { to:'/student/history', label:'My Records', icon:'◷' },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const nav = user?.role === 'teacher' ? teacherNav : studentNav

  const handleLogout = () => {
    logout()
    toast.success('Signed out')
    navigate('/login')
  }

  return (
    <div className="sidebar">
      {/* Brand */}
      <div style={{ padding:'20px 18px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#16a34a,#22c55e)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0, boxShadow:'0 2px 8px rgba(22,163,74,0.3)' }}>🔊</div>
          <div>
            <div style={{ fontFamily:'Plus Jakarta Sans', fontWeight:700, fontSize:14, color:'var(--text1)', lineHeight:1.2 }}>Ultrasonic</div>
            <div style={{ fontSize:10, color:'var(--text3)', letterSpacing:'0.12em', textTransform:'uppercase' }}>Attendance</div>
          </div>
        </div>
      </div>

      {/* User */}
      <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ width:36, height:36, borderRadius:10, background:'var(--accent-light)', border:'1px solid #bbf7d0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, marginBottom:8 }}>
          {user?.role === 'teacher' ? '👩‍🏫' : '👨‍🎓'}
        </div>
        <div style={{ fontWeight:600, fontSize:13, color:'var(--text1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.name}</div>
        <div style={{ fontSize:11, color:'var(--text3)', textTransform:'capitalize', marginTop:2 }}>{user?.role}</div>
        {user?.rollNumber && <div className="mono accent-text" style={{ marginTop:4, fontSize:11 }}>{user.rollNumber}</div>}
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:'12px 10px', display:'flex', flexDirection:'column', gap:2 }}>
        {nav.map(item => (
          <NavLink key={item.to} to={item.to} end={item.exact}
            style={({ isActive }) => ({
              display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
              borderRadius:10, textDecoration:'none', fontSize:13, fontWeight:500,
              transition:'all 0.15s',
              background: isActive ? 'var(--accent-light)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--text2)',
              borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent'
            })}>
            <span style={{ fontSize:14 }}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding:'14px 10px', borderTop:'1px solid var(--border)' }}>
        <button onClick={handleLogout} className="btn-ghost" style={{ width:'100%', justifyContent:'center', fontSize:13, padding:'8px 16px' }}>
          ↩ Sign Out
        </button>
      </div>
    </div>
  )
}