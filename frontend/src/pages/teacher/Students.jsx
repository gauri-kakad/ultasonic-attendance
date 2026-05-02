import React, { useEffect, useState } from 'react'
import Sidebar from '../../components/common/Sidebar'
import api from '../../utils/api'
import toast from 'react-hot-toast'

const emptyForm = { name:'', rollNumber:'', class:'', subjects:'', email:'', phone:'' }

export default function TeacherStudents() {
  const [students, setStudents] = useState([])
  const [allClasses, setAllClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchStudents = async () => {
    try {
      const [s, c] = await Promise.all([
        api.get('/teacher/students'),
        api.get('/teacher/classes')
      ])
      setStudents(s.data.students || [])
      setAllClasses(c.data.classes || [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchStudents() }, [])

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowModal(true) }
  const openEdit = s => {
    setEditing(s)
    setForm({ name:s.name, rollNumber:s.rollNumber, class:s.class, subjects:(s.subjects||[]).join(', '), email:s.email||'', phone:s.phone||'' })
    setShowModal(true)
  }

  const handleSave = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, subjects: form.subjects ? form.subjects.split(',').map(s=>s.trim()).filter(Boolean) : [] }
      if (editing) {
        await api.put(`/teacher/students/${editing._id}`, payload)
        toast.success('Student updated')
      } else {
        await api.post('/teacher/students', payload)
        toast.success('Student added')
      }
      fetchStudents()
      setShowModal(false)
    } catch(err) { toast.error(err.response?.data?.message || 'Error saving') }
    finally { setSaving(false) }
  }

  const handleDelete = async id => {
    if (!confirm('Delete this student?')) return
    try {
      await api.delete(`/teacher/students/${id}`)
      toast.success('Student removed')
      fetchStudents()
    } catch { toast.error('Error deleting') }
  }

  const filtered = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.rollNumber.toLowerCase().includes(search.toLowerCase())
    const matchClass = !filterClass || s.class === filterClass
    return matchSearch && matchClass
  })

  // Group by class for display
  const grouped = {}
  filtered.forEach(s => {
    if (!grouped[s.class]) grouped[s.class] = []
    grouped[s.class].push(s)
  })

  return (
    <div style={{ display:'flex' }}>
      <Sidebar />
      <div className="main-content page-bg">
        <div className="fade-in">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
            <div>
              <h1 style={{ fontSize:24, fontWeight:700 }}>Students</h1>
              <p style={{ color:'var(--text3)', fontSize:13, marginTop:3 }}>{students.length} students across {allClasses.length} classes</p>
            </div>
            <button className="btn-primary" onClick={openAdd}>+ Add Student</button>
          </div>

          {/* Class summary cards */}
          {allClasses.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10, marginBottom:20 }}>
              <div onClick={()=>setFilterClass('')} style={{ background: !filterClass?'var(--accent)':'var(--surface)', border:`2px solid ${!filterClass?'var(--accent)':'var(--border)'}`, borderRadius:10, padding:'12px 16px', cursor:'pointer', textAlign:'center', transition:'all 0.15s' }}>
                <div style={{ fontSize:20, fontWeight:700, color: !filterClass?'#fff':'var(--text1)' }}>{students.length}</div>
                <div style={{ fontSize:11, color: !filterClass?'rgba(255,255,255,0.8)':'var(--text3)', marginTop:2, textTransform:'uppercase', letterSpacing:'0.08em' }}>All Classes</div>
              </div>
              {allClasses.map(cls => {
                const count = students.filter(s => s.class === cls).length
                const isActive = filterClass === cls
                return (
                  <div key={cls} onClick={()=>setFilterClass(isActive?'':cls)}
                    style={{ background: isActive?'var(--accent)':'var(--surface)', border:`2px solid ${isActive?'var(--accent)':'var(--border)'}`, borderRadius:10, padding:'12px 16px', cursor:'pointer', textAlign:'center', transition:'all 0.15s' }}>
                    <div style={{ fontSize:20, fontWeight:700, color: isActive?'#fff':'var(--text1)' }}>{count}</div>
                    <div style={{ fontSize:11, color: isActive?'rgba(255,255,255,0.8)':'var(--text3)', marginTop:2, textTransform:'uppercase', letterSpacing:'0.08em' }}>{cls}</div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Search */}
          <div style={{ marginBottom:16 }}>
            <input className="input" placeholder="🔍  Search by name or roll number..." value={search} onChange={e=>setSearch(e.target.value)} style={{ maxWidth:360 }} />
          </div>

          {/* Students table */}
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <table className="data-table">
              <thead><tr><th>Roll No</th><th>Name</th><th>Class</th><th>Subjects</th><th>Email</th><th>Phone</th><th>Actions</th></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Loading students...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign:'center', padding:48, color:'var(--text3)' }}>
                    <div style={{ fontSize:36, marginBottom:10 }}>👨‍🎓</div>
                    {search || filterClass ? 'No students match your filter' : 'No students yet. Click "+ Add Student" to get started.'}
                  </td></tr>
                ) : filtered.map(s => (
                  <tr key={s._id}>
                    <td className="mono accent-text">{s.rollNumber}</td>
                    <td style={{ fontWeight:600 }}>{s.name}</td>
                    <td><span className="badge-class">{s.class}</span></td>
                    <td style={{ color:'var(--text3)', fontSize:12 }}>{(s.subjects||[]).join(', ') || '—'}</td>
                    <td style={{ color:'var(--text3)', fontSize:12 }}>{s.email || '—'}</td>
                    <td style={{ color:'var(--text3)', fontSize:12 }}>{s.phone || '—'}</td>
                    <td>
                      <div style={{ display:'flex', gap:6 }}>
                        <button className="btn-sm edit" onClick={()=>openEdit(s)}>Edit</button>
                        <button className="btn-sm del" onClick={()=>handleDelete(s._id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal-box">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
              <h2 style={{ fontWeight:700, fontSize:18 }}>{editing ? 'Edit Student' : 'Add New Student'}</h2>
              <button onClick={()=>setShowModal(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'var(--text3)' }}>×</button>
            </div>
            <form onSubmit={handleSave} style={{ display:'grid', gap:14 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div><label className="label">Full Name</label><input className="input" placeholder="John Doe" value={form.name} onChange={set('name')} required /></div>
                <div><label className="label">Roll Number</label><input className="input" placeholder="CS2024001" value={form.rollNumber} onChange={set('rollNumber')} required /></div>
              </div>
              <div>
                <label className="label">Class</label>
                <input className="input" placeholder="e.g. CS-3A, MCA-2B, BCA-1C" value={form.class} onChange={set('class')} required />
                {allClasses.length > 0 && (
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
                    <span style={{ fontSize:11, color:'var(--text3)' }}>Existing:</span>
                    {allClasses.map(c => (
                      <button key={c} type="button" onClick={()=>setForm(p=>({...p,class:c}))}
                        style={{ background: form.class===c?'var(--accent-light)':'var(--surface2)', border:`1px solid ${form.class===c?'var(--accent)':'var(--border)'}`, color: form.class===c?'var(--accent)':'var(--text2)', padding:'2px 10px', borderRadius:20, fontSize:11, cursor:'pointer' }}>
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div><label className="label">Subjects (comma separated)</label><input className="input" placeholder="DSA, OS, CN, DBMS" value={form.subjects} onChange={set('subjects')} /></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div><label className="label">Email</label><input className="input" type="email" placeholder="john@uni.edu" value={form.email} onChange={set('email')} /></div>
                <div><label className="label">Phone</label><input className="input" placeholder="+91 9876543210" value={form.phone} onChange={set('phone')} /></div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:6 }}>
                <button type="button" className="btn-ghost" onClick={()=>setShowModal(false)} style={{ flex:1, justifyContent:'center' }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ flex:1, justifyContent:'center' }}>{saving ? 'Saving...' : editing ? 'Update Student' : 'Add Student'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}