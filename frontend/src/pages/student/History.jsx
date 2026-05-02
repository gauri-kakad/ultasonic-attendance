import React, { useEffect, useState } from 'react'
import Sidebar from '../../components/common/Sidebar'
import api from '../../utils/api'
import toast from 'react-hot-toast'

export default function StudentHistory() {
  const [data, setData] = useState({ records:[], subjectStats:[], overall:{ total:0, present:0, percentage:0 } })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ subject:'', class:'', startDate:'', endDate:'' })

  const fetchData = () => {
    setLoading(true)
    const params = new URLSearchParams(filter).toString()
    api.get(`/attendance/my?${params}`).then(r => setData(r.data)).finally(() => setLoading(false))
  }

  useEffect(fetchData, [])

  const f = k => e => setFilter(p => ({ ...p, [k]: e.target.value }))

  const handleDownload = () => {
    const headers = ['Date','Subject','Class','Time','Status']
    const rows = data.records.map(r => {
      const d = new Date(r.date)
      return [d.toLocaleDateString(), r.subject, r.class, d.toLocaleTimeString(), r.status]
    })
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type:'text/csv' }))
    const a = document.createElement('a'); a.href=url; a.download='my_attendance.csv'; a.click()
    URL.revokeObjectURL(url)
    toast.success('Downloaded!')
  }

  // Unique classes and subjects from records
  const uniqueClasses = [...new Set(data.records.map(r=>r.class).filter(Boolean))]
  const uniqueSubjects = [...new Set(data.records.map(r=>r.subject).filter(Boolean))]

  return (
    <div style={{ display:'flex' }}>
      <Sidebar />
      <div className="main-content page-bg">
        <div className="fade-in">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
            <div>
              <h1 style={{ fontSize:24, fontWeight:700 }}>My Records</h1>
              <p style={{ color:'var(--text3)', fontSize:13, marginTop:3 }}>Complete attendance history</p>
            </div>
            <button className="btn-ghost" onClick={handleDownload}>↓ Download CSV</button>
          </div>

          {/* Overall stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:20 }}>
            <div className="stat-card green">
              <div style={{ fontSize:11, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600, marginBottom:6 }}>Overall</div>
              <div style={{ fontSize:28, fontWeight:700, color: data.overall.percentage>=75?'var(--accent)':'var(--danger)' }}>{data.overall.percentage}%</div>
              <div style={{ fontSize:12, color:'var(--text3)', marginTop:4 }}>{data.overall.present}/{data.overall.total} classes</div>
            </div>
            {data.subjectStats.slice(0,4).map(s => (
              <div key={`${s.class}-${s.subject}`} className="stat-card" style={{ borderTopColor: s.percentage>=75?'#22c55e':'#ef4444' }}>
                <div style={{ fontSize:11, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600, marginBottom:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.subject}</div>
                <div style={{ fontSize:28, fontWeight:700, color: s.percentage>=75?'var(--accent)':'var(--danger)' }}>{s.percentage}%</div>
                <div style={{ fontSize:12, color:'var(--text3)', marginTop:4 }}>{s.class} · {s.present}/{s.total}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="card" style={{ padding:18, marginBottom:16 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12 }}>
              <div>
                <label className="label">Class</label>
                <select className="input" value={filter.class} onChange={f('class')}>
                  <option value="">All classes</option>
                  {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Subject</label>
                <select className="input" value={filter.subject} onChange={f('subject')}>
                  <option value="">All subjects</option>
                  {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">From</label>
                <input className="input" type="date" value={filter.startDate} onChange={f('startDate')} />
              </div>
              <div>
                <label className="label">To</label>
                <input className="input" type="date" value={filter.endDate} onChange={f('endDate')} />
              </div>
              <div style={{ display:'flex', alignItems:'flex-end' }}>
                <button className="btn-primary" onClick={fetchData} style={{ width:'100%', justifyContent:'center' }}>Apply</button>
              </div>
            </div>
          </div>

          {/* Records table */}
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <table className="data-table">
              <thead><tr><th>Date</th><th>Day</th><th>Subject</th><th>Class</th><th>Time</th><th>Method</th><th>Status</th></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Loading...</td></tr>
                ) : data.records.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign:'center', padding:48, color:'var(--text3)' }}>
                    <div style={{ fontSize:40, marginBottom:10 }}>📭</div>
                    <div>No attendance records found</div>
                    <div style={{ fontSize:12, marginTop:6 }}>Adjust your filters or mark attendance to see records</div>
                  </td></tr>
                ) : data.records.map((r,i) => {
                  const d = new Date(r.date)
                  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
                  return (
                    <tr key={i}>
                      <td style={{ color:'var(--text2)', fontFamily:'JetBrains Mono', fontSize:12 }}>{d.toLocaleDateString()}</td>
                      <td style={{ color:'var(--text3)', fontSize:12 }}>{days[d.getDay()]}</td>
                      <td style={{ fontWeight:500 }}>{r.subject}</td>
                      <td><span className="badge-class">{r.class}</span></td>
                      <td className="mono muted" style={{ fontSize:11 }}>{d.toLocaleTimeString()}</td>
                      <td><span style={{ fontSize:11, color:'var(--info)', background:'var(--info-light)', border:'1px solid #bfdbfe', padding:'2px 8px', borderRadius:6 }}>🔊 Ultrasonic</span></td>
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