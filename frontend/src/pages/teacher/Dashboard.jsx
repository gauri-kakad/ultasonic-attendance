import React, { useEffect, useState } from 'react'
import Sidebar from '../../components/common/Sidebar'
import api from '../../utils/api'
import { useAuth } from '../../context/AuthContext'
import { Line, Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js'
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler)

export default function TeacherDashboard() {
  const { user } = useAuth()
  const [students, setStudents] = useState([])
  const [analytics, setAnalytics] = useState([])
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchData = (cls = '') => {
    setLoading(true)
    const q = cls ? `?class=${cls}` : ''
    Promise.all([
      api.get('/teacher/students'),
      api.get(`/teacher/analytics${q}`),
      api.get('/teacher/classes')
    ]).then(([s, a, c]) => {
      setStudents(s.data.students || [])
      setAnalytics(a.data.stats || [])
      setClasses(c.data.classes || [])
    }).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  const avgAttendance = analytics.length
    ? Math.round(analytics.reduce((a, s) => a + s.percentage, 0) / analytics.length) : 0
  const atRisk = analytics.filter(s => s.percentage < 75).length
  const good = analytics.filter(s => s.percentage >= 75).length

  // Per-class breakdown
  const classBreakdown = classes.map(cls => {
    const clsStudents = analytics.filter(s => s.class === cls)
    const avg = clsStudents.length ? Math.round(clsStudents.reduce((a,s)=>a+s.percentage,0)/clsStudents.length) : 0
    return { cls, count: clsStudents.length, avg }
  })

  const doughnutData = {
    labels: ['Good (≥75%)', 'At Risk (<75%)'],
    datasets: [{ data: [good, atRisk], backgroundColor: ['rgba(34,197,94,0.8)','rgba(239,68,68,0.7)'], borderColor: ['#22c55e','#ef4444'], borderWidth: 2 }]
  }
  const lineData = {
    labels: analytics.slice(0,10).map(s => s.rollNumber || s.name.substring(0,6)),
    datasets: [{ label: 'Attendance %', data: analytics.slice(0,10).map(s => s.percentage), borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.08)', fill: true, tension: 0.4, pointBackgroundColor: '#16a34a', pointRadius: 4 }]
  }
  const chartOpts = {
    responsive: true,
    plugins: { legend: { labels: { color:'#94a3b8', font:{family:'Plus Jakarta Sans'} } } },
    scales: { x: { ticks:{color:'#94a3b8'}, grid:{color:'rgba(0,0,0,0.04)'} }, y: { ticks:{color:'#94a3b8'}, grid:{color:'rgba(0,0,0,0.04)'}, min:0, max:100 } }
  }

  if (loading) return (
    <div style={{ display:'flex' }}>
      <Sidebar />
      <div className="main-content" style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div className="sonic-wave">{[...Array(8)].map((_,i)=><div key={i} className="sonic-bar"/>)}</div>
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex' }}>
      <Sidebar />
      <div className="main-content page-bg">
        <div className="fade-in">
          <div style={{ marginBottom:28 }}>
            <h1 style={{ fontSize:26, fontWeight:700, color:'var(--text1)' }}>
              Good morning, <span style={{ color:'var(--accent)' }}>{user?.name?.split(' ')[0]}</span> 👋
            </h1>
            <p style={{ color:'var(--text3)', marginTop:5, fontSize:14 }}>Here's your attendance overview</p>
          </div>

          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14, marginBottom:24 }}>
            {[
              { label:'Total Students', value:students.length, icon:'👥', cls:'blue' },
              { label:'Avg Attendance', value:`${avgAttendance}%`, icon:'📊', cls:'green' },
              { label:'At Risk (<75%)', value:atRisk, icon:'⚠️', cls:'red' },
              { label:'Total Classes', value:classes.length, icon:'🏫', cls:'amber' },
            ].map(s => (
              <div key={s.label} className={`stat-card ${s.cls}`}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ fontSize:11, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:600, marginBottom:8 }}>{s.label}</div>
                    <div style={{ fontSize:28, fontWeight:700, color: s.cls==='green'?'var(--accent)':s.cls==='red'?'var(--danger)':s.cls==='blue'?'var(--info)':'var(--warning)' }}>{s.value}</div>
                  </div>
                  <span style={{ fontSize:22 }}>{s.icon}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Class breakdown */}
          {classBreakdown.length > 0 && (
            <div className="card" style={{ padding:20, marginBottom:20 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <h3 style={{ fontWeight:600, fontSize:14, color:'var(--text1)' }}>Class Overview</h3>
                <span style={{ fontSize:12, color:'var(--text3)' }}>{classes.length} classes</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:10 }}>
                {classBreakdown.map(c => (
                  <div key={c.cls} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 16px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                      <span className="badge-class">{c.cls}</span>
                      <span style={{ fontFamily:'JetBrains Mono', fontSize:14, fontWeight:600, color: c.avg>=75?'var(--accent)':'var(--danger)' }}>{c.avg}%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width:`${c.avg}%`, background: c.avg>=75?'#22c55e':'#ef4444' }} />
                    </div>
                    <div style={{ fontSize:11, color:'var(--text3)', marginTop:6 }}>{c.count} students</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Charts */}
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16, marginBottom:20 }}>
            <div className="card" style={{ padding:22 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <h3 style={{ fontWeight:600, fontSize:14 }}>Student Attendance Distribution</h3>
                <select className="input" value={selectedClass} onChange={e=>{setSelectedClass(e.target.value);fetchData(e.target.value)}} style={{ width:'auto', padding:'5px 10px', fontSize:12 }}>
                  <option value="">All classes</option>
                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {analytics.length > 0 ? <Line data={lineData} options={chartOpts} /> :
                <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)' }}>No data yet</div>}
            </div>
            <div className="card" style={{ padding:22 }}>
              <h3 style={{ fontWeight:600, fontSize:14, marginBottom:16 }}>Status Breakdown</h3>
              {analytics.length > 0 ? <Doughnut data={doughnutData} options={{ plugins:{ legend:{ position:'bottom', labels:{ color:'#64748b', font:{family:'Plus Jakarta Sans'}, padding:12 } } } }} /> :
                <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)' }}>No data yet</div>}
            </div>
          </div>

          {/* Students table */}
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ fontWeight:600, fontSize:14 }}>Student Summary</h3>
              <span style={{ fontSize:12, color:'var(--text3)' }}>{analytics.length} students</span>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table className="data-table">
                <thead><tr><th>Roll No</th><th>Name</th><th>Class</th><th>Present</th><th>Total</th><th>Attendance</th></tr></thead>
                <tbody>
                  {analytics.slice(0,8).map(s => (
                    <tr key={s.studentId}>
                      <td className="mono accent-text">{s.rollNumber}</td>
                      <td style={{ fontWeight:500 }}>{s.name}</td>
                      <td><span className="badge-class">{s.class}</span></td>
                      <td style={{ color:'var(--accent)', fontWeight:600 }}>{s.present}</td>
                      <td style={{ color:'var(--text3)' }}>{s.total}</td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div className="progress-track" style={{ flex:1 }}>
                            <div className="progress-fill" style={{ width:`${s.percentage}%`, background: s.percentage>=75?'#22c55e':'#ef4444' }} />
                          </div>
                          <span className="mono" style={{ color: s.percentage>=75?'var(--accent)':'var(--danger)', minWidth:34 }}>{s.percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {analytics.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign:'center', padding:'40px 20px', color:'var(--text3)' }}>
                      No attendance data yet. Start a session to begin!
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}