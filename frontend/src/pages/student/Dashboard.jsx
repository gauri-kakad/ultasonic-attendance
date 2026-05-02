import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../../components/common/Sidebar'
import api from '../../utils/api'
import { useAuth } from '../../context/AuthContext'
import { Doughnut, Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js'
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

export default function StudentDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState({ records:[], subjectStats:[], overall:{ total:0, present:0, percentage:0 } })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/attendance/my').then(r => setData(r.data)).finally(() => setLoading(false))
  }, [])

  const barData = {
    labels: data.subjectStats.map(s => s.subject),
    datasets: [{ label:'Attendance %', data: data.subjectStats.map(s => s.percentage), backgroundColor: data.subjectStats.map(s => s.percentage>=75?'rgba(34,197,94,0.7)':'rgba(239,68,68,0.7)'), borderRadius:6, borderSkipped:false }]
  }
  const doughnutData = {
    labels: ['Present','Absent'],
    datasets: [{ data:[data.overall.present, data.overall.total-data.overall.present], backgroundColor:['rgba(34,197,94,0.8)','rgba(239,68,68,0.6)'], borderColor:['#22c55e','#ef4444'], borderWidth:2 }]
  }
  const barOpts = { responsive:true, plugins:{legend:{display:false}}, scales:{ y:{min:0,max:100,ticks:{color:'#94a3b8'},grid:{color:'rgba(0,0,0,0.04)'}}, x:{ticks:{color:'#94a3b8'},grid:{display:false}} } }

  return (
    <div style={{ display:'flex' }}>
      <Sidebar />
      <div className="main-content page-bg">
        <div className="fade-in">
          <div style={{ marginBottom:24 }}>
            <h1 style={{ fontSize:24, fontWeight:700 }}>
              Hello, <span style={{ color:'var(--accent)' }}>{user?.name?.split(' ')[0]}</span> 👋
            </h1>
            <p style={{ color:'var(--text3)', fontSize:13, marginTop:3 }}>Your attendance at a glance</p>
          </div>

          {/* Quick Mark CTA if < 75% */}
          {data.overall.percentage > 0 && data.overall.percentage < 75 && (
            <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:12, padding:'14px 20px', marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontWeight:600, fontSize:14, color:'#c2410c' }}>⚠ Your attendance is below 75%</div>
                <div style={{ fontSize:12, color:'#9a3412', marginTop:2 }}>Attend more classes to improve your standing</div>
              </div>
              <Link to="/student/mark" className="btn-primary" style={{ textDecoration:'none', padding:'8px 18px', fontSize:13 }}>Mark Now →</Link>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:14, marginBottom:22 }}>
            {[
              { label:'Overall Attendance', value:`${data.overall.percentage}%`, icon:'📊', cls: data.overall.percentage>=75?'green':'red' },
              { label:'Classes Present', value:data.overall.present, icon:'✅', cls:'green' },
              { label:'Total Classes', value:data.overall.total, icon:'📅', cls:'blue' },
              { label:'Subjects', value:data.subjectStats.length, icon:'📚', cls:'amber' },
            ].map(s => (
              <div key={s.label} className={`stat-card ${s.cls}`}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ fontSize:11, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600, marginBottom:7 }}>{s.label}</div>
                    <div style={{ fontSize:26, fontWeight:700, color: s.cls==='green'?'var(--accent)':s.cls==='red'?'var(--danger)':s.cls==='blue'?'var(--info)':'var(--warning)' }}>{s.value}</div>
                  </div>
                  <span style={{ fontSize:20 }}>{s.icon}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:16, marginBottom:20 }}>
            <div className="card" style={{ padding:22 }}>
              <h3 style={{ fontWeight:600, fontSize:14, marginBottom:16 }}>Subject-wise Attendance</h3>
              {data.subjectStats.length > 0 ? <Bar data={barData} options={barOpts} /> :
                <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)', flexDirection:'column', gap:8 }}>
                  <span style={{ fontSize:36 }}>📊</span>
                  <span style={{ fontSize:13 }}>No data yet</span>
                </div>}
            </div>
            <div className="card" style={{ padding:22, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
              <h3 style={{ fontWeight:600, fontSize:14, marginBottom:16, alignSelf:'flex-start' }}>Overall Status</h3>
              {data.overall.total > 0 ? (
                <>
                  <Doughnut data={doughnutData} options={{ plugins:{legend:{position:'bottom',labels:{color:'#64748b',font:{family:'Plus Jakarta Sans'},padding:12}}} }} />
                  <div style={{ marginTop:14, textAlign:'center' }}>
                    <div style={{ fontSize:32, fontWeight:700, color: data.overall.percentage>=75?'var(--accent)':'var(--danger)' }}>{data.overall.percentage}%</div>
                    <div style={{ fontSize:12, color:'var(--text3)', marginTop:4 }}>{data.overall.percentage>=75?'✅ Good standing':'⚠ Below minimum (75%)'}</div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign:'center', color:'var(--text3)' }}>
                  <div style={{ fontSize:40, marginBottom:10 }}>🎯</div>
                  <p style={{ fontSize:13 }}>Attend your first class!</p>
                  <Link to="/student/mark" className="btn-primary" style={{ textDecoration:'none', marginTop:14, display:'inline-flex', padding:'8px 18px', fontSize:13 }}>Mark Attendance</Link>
                </div>
              )}
            </div>
          </div>

          {/* Subject cards */}
          {data.subjectStats.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12, marginBottom:20 }}>
              {data.subjectStats.map(s => (
                <div key={`${s.class}-${s.subject}`} className="card" style={{ padding:18 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:14, color:'var(--text1)' }}>{s.subject}</div>
                      <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{s.class} · {s.present}/{s.total} classes</div>
                    </div>
                    <div style={{ fontSize:20, fontWeight:700, color: s.percentage>=75?'var(--accent)':'var(--danger)' }}>{s.percentage}%</div>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width:`${s.percentage}%`, background: s.percentage>=75?'#22c55e':'#ef4444' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recent records */}
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ fontWeight:600, fontSize:14 }}>Recent Attendance</h3>
              <Link to="/student/history" style={{ fontSize:12, color:'var(--accent)', textDecoration:'none', fontWeight:600 }}>View all →</Link>
            </div>
            <table className="data-table">
              <thead><tr><th>Date</th><th>Subject</th><th>Class</th><th>Time</th><th>Status</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={5} style={{ textAlign:'center', padding:32, color:'var(--text3)' }}>Loading...</td></tr>
                : data.records.slice(0,6).length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>
                    <div style={{ fontSize:36, marginBottom:8 }}>📭</div>
                    No records yet. Mark your first attendance!
                  </td></tr>
                ) : data.records.slice(0,6).map((r,i) => {
                  const d = new Date(r.date)
                  return (
                    <tr key={i}>
                      <td style={{ color:'var(--text2)' }}>{d.toLocaleDateString()}</td>
                      <td style={{ fontWeight:500 }}>{r.subject}</td>
                      <td><span className="badge-class">{r.class}</span></td>
                      <td className="mono muted" style={{ fontSize:11 }}>{d.toLocaleTimeString()}</td>
                      <td><span className={r.status==='present'?'badge-present':'badge-absent'}>{r.status}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}