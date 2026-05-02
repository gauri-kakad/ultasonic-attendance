import React, { useState, useEffect } from 'react'
import Sidebar from '../../components/common/Sidebar'
import api from '../../utils/api'
import toast from 'react-hot-toast'

export default function TeacherHistory() {
  const [stats, setStats] = useState([])
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ class:'', subject:'', startDate:'', endDate:'' })

  useEffect(() => {
    api.get('/teacher/classes').then(r => {
      setClasses(r.data.classes || [])
      setSubjects(r.data.subjects || [])
    })
    fetchData()
  }, [])

  const fetchData = () => {
    setLoading(true)
    const params = new URLSearchParams(filters).toString()
    api.get(`/teacher/analytics?${params}`)
      .then(r => setStats(r.data.stats || []))
      .finally(() => setLoading(false))
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams(filters).toString()
      const res = await api.get(`/attendance/export?${params}`, { responseType:'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a'); a.href = url
      a.download = `attendance_${filters.class||'all'}_${new Date().toLocaleDateString().replace(/\//g,'-')}.csv`
      a.click(); URL.revokeObjectURL(url)
      toast.success('CSV exported!')
    } catch { toast.error('Export failed') }
  }

  const f = k => e => setFilters(p => ({ ...p, [k]: e.target.value }))

  return (
    <div style={{ display:'flex' }}>
      <Sidebar />
      <div className="main-content page-bg">
        <div className="fade-in">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
            <div>
              <h1 style={{ fontSize:24, fontWeight:700 }}>History & Export</h1>
              <p style={{ color:'var(--text3)', fontSize:13, marginTop:3 }}>Analyze attendance records and download reports</p>
            </div>
            <button className="btn-ghost" onClick={handleExport}>↓ Export CSV</button>
          </div>

          {/* Filters */}
          <div className="card" style={{ padding:20, marginBottom:18 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12 }}>
              <div>
                <label className="label">Class</label>
                <select className="input" value={filters.class} onChange={f('class')}>
                  <option value="">All classes</option>
                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Subject</label>
                <select className="input" value={filters.subject} onChange={f('subject')}>
                  <option value="">All subjects</option>
                  {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">From Date</label>
                <input className="input" type="date" value={filters.startDate} onChange={f('startDate')} />
              </div>
              <div>
                <label className="label">To Date</label>
                <input className="input" type="date" value={filters.endDate} onChange={f('endDate')} />
              </div>
              <div style={{ display:'flex', alignItems:'flex-end' }}>
                <button className="btn-primary" onClick={fetchData} style={{ width:'100%', justifyContent:'center' }}>Apply Filters</button>
              </div>
            </div>
          </div>

          {/* Summary chips */}
          {!loading && stats.length > 0 && (
            <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
              {[
                { label:'Total Students', value:stats.length, color:'var(--info)' },
                { label:'Avg Attendance', value:`${Math.round(stats.reduce((a,s)=>a+s.percentage,0)/stats.length)}%`, color:'var(--accent)' },
                { label:'At Risk (<75%)', value:stats.filter(s=>s.percentage<75).length, color:'var(--danger)' },
              ].map(chip => (
                <div key={chip.label} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 16px', display:'flex', gap:10, alignItems:'center' }}>
                  <span style={{ fontWeight:700, fontSize:18, color:chip.color }}>{chip.value}</span>
                  <span style={{ fontSize:12, color:'var(--text3)' }}>{chip.label}</span>
                </div>
              ))}
            </div>
          )}

          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <table className="data-table">
              <thead><tr><th>Roll No</th><th>Name</th><th>Class</th><th>Present</th><th>Total</th><th>Attendance %</th><th>Status</th></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Loading...</td></tr>
                ) : stats.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign:'center', padding:48, color:'var(--text3)' }}>No records found for selected filters</td></tr>
                ) : stats.map(s => (
                  <tr key={s.studentId}>
                    <td className="mono accent-text">{s.rollNumber}</td>
                    <td style={{ fontWeight:500 }}>{s.name}</td>
                    <td><span className="badge-class">{s.class}</span></td>
                    <td style={{ color:'var(--accent)', fontWeight:600 }}>{s.present}</td>
                    <td style={{ color:'var(--text3)' }}>{s.total}</td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div className="progress-track" style={{ width:80 }}>
                          <div className="progress-fill" style={{ width:`${s.percentage}%`, background: s.percentage>=75?'#22c55e':'#ef4444' }} />
                        </div>
                        <span className="mono" style={{ color: s.percentage>=75?'var(--accent)':'var(--danger)', minWidth:34 }}>{s.percentage}%</span>
                      </div>
                    </td>
                    <td><span className={s.percentage>=75?'badge-present':'badge-absent'}>{s.percentage>=75?'Good':'At Risk'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}