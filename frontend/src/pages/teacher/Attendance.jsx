import React, { useState, useEffect, useRef } from 'react'
import Sidebar from '../../components/common/Sidebar'
import { useUltrasonicEmitter } from '../../hooks/useUltrasonic'
import { getSocket } from '../../utils/socket'
import api from '../../utils/api'
import toast from 'react-hot-toast'

export default function TeacherAttendance() {
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [session, setSession] = useState(null)
  const [liveList, setLiveList] = useState([])
  const [pattern, setPattern] = useState(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef(null)
  const { isEmitting, startEmitting, stopEmitting, currentFrequency } = useUltrasonicEmitter()

  useEffect(() => {
    api.get('/teacher/classes').then(r => {
      setClasses(r.data.classes || [])
      setSubjects(r.data.subjects || [])
    })
    // Check for existing active session on load
    api.get('/sessions/active').then(r => {
      if (r.data.session) {
        const s = r.data.session
        setSession(s)
        setPattern(s.pattern)
        const ttl = Math.max(0, Math.round((new Date(s.expiresAt) - Date.now()) / 1000))
        setTimeLeft(ttl)
        startEmitting(s.tokenFrequency)
        loadLiveAttendance(s.sessionId)
        // Join socket room
        const socket = getSocket()
        if (socket) socket.emit('teacher:join-session', { sessionId: s.sessionId })
      }
    }).catch(() => {})
  }, [])

  // Socket listeners
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const onAttendanceUpdate = (data) => {
      console.log('[Teacher] Received attendance update:', data)
      setLiveList(prev => {
        const exists = prev.find(s => s.studentId?.toString() === data.studentId?.toString())
        if (exists) {
          return prev.map(s => s.studentId?.toString() === data.studentId?.toString()
            ? { ...s, status:'present', markedAt: data.markedAt } : s)
        }
        return [...prev, { ...data, status:'present' }]
      })
      toast.success(`✅ ${data.name} marked present!`, { duration:2500 })
    }

    const onTokenRefresh = (data) => {
      setPattern(data.pattern)
      setTimeLeft(Math.round((new Date(data.expiresAt) - Date.now()) / 1000))
      if (isEmitting) startEmitting(data.tokenFrequency)
    }

    const onSessionEnded = () => {
      setSession(null); setPattern(null); setLiveList([])
    }

    socket.on('session:attendance-update', onAttendanceUpdate)
    socket.on('session:token-refresh', onTokenRefresh)
    socket.on('session:ended', onSessionEnded)

    return () => {
      socket.off('session:attendance-update', onAttendanceUpdate)
      socket.off('session:token-refresh', onTokenRefresh)
      socket.off('session:ended', onSessionEnded)
    }
  }, [isEmitting, startEmitting])

  // Countdown timer
  useEffect(() => {
    if (!session) return
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setTimeLeft(p => Math.max(0, p - 1)), 1000)
    return () => clearInterval(timerRef.current)
  }, [session])

  const loadLiveAttendance = async (sessionId) => {
    try {
      const res = await api.get(`/sessions/${sessionId}/attendance`)
      setLiveList(res.data.list || [])
    } catch(e) { console.error(e) }
  }

  const startSession = async () => {
    if (!selectedClass || !selectedSubject) { toast.error('Select class and subject first'); return }
    setLoading(true)
    try {
      const res = await api.post('/sessions/start', { class: selectedClass, subject: selectedSubject })
      const { session: s, sessionId, tokenFrequency, pattern: p, expiresAt } = res.data
      setSession({ ...s, sessionId })
      setPattern(p)
      setTimeLeft(Math.round((new Date(expiresAt) - Date.now()) / 1000))

      // Join socket room as teacher
      const socket = getSocket()
      if (socket) {
        socket.emit('teacher:join-session', { sessionId })
        console.log('[Teacher] Joined session room:', sessionId)
      }

      startEmitting(tokenFrequency)
      await loadLiveAttendance(sessionId)
      toast.success('🔊 Session started! Ultrasonic signal broadcasting...')
    } catch(err) { toast.error(err.response?.data?.message || 'Failed to start') }
    finally { setLoading(false) }
  }

  const endSession = async () => {
    if (!session) return
    try {
      await api.put(`/sessions/${session.sessionId}/end`)
      stopEmitting()
      const socket = getSocket()
      if (socket) socket.emit('teacher:end-session', { sessionId: session.sessionId })
      if (timerRef.current) clearInterval(timerRef.current)
      toast.success('Session ended')
      setSession(null); setPattern(null); setLiveList([])
    } catch { toast.error('Error ending session') }
  }

  const presentCount = liveList.filter(s => s.status === 'present').length
  const totalCount = liveList.length
  const pct = totalCount > 0 ? Math.round((presentCount/totalCount)*100) : 0

  return (
    <div style={{ display:'flex' }}>
      <Sidebar />
      <div className="main-content page-bg">
        <div className="fade-in">
          <div style={{ marginBottom:24 }}>
            <h1 style={{ fontSize:24, fontWeight:700 }}>Live Attendance</h1>
            <p style={{ color:'var(--text3)', fontSize:13, marginTop:3 }}>Ultrasonic attendance control panel</p>
          </div>

          {/* Start session form */}
          {!session ? (
            <div className="card" style={{ padding:28, maxWidth:580, marginBottom:20 }}>
              <h3 style={{ fontWeight:700, fontSize:16, marginBottom:20 }}>Start New Session</h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
                <div>
                  <label className="label">Select Class</label>
                  <select className="input" value={selectedClass} onChange={e=>setSelectedClass(e.target.value)}>
                    <option value="">Choose class...</option>
                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {classes.length === 0 && <p style={{ fontSize:11, color:'var(--warning)', marginTop:6 }}>⚠ Add students first</p>}
                </div>
                <div>
                  <label className="label">Select Subject</label>
                  <select className="input" value={selectedSubject} onChange={e=>setSelectedSubject(e.target.value)}>
                    <option value="">Choose subject...</option>
                    {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input className="input" placeholder="Or type subject name..." value={selectedSubject} onChange={e=>setSelectedSubject(e.target.value)} style={{ marginTop:6 }} />
                </div>
              </div>
              <button className="btn-primary" onClick={startSession} disabled={loading||!selectedClass||!selectedSubject} style={{ padding:'13px 32px', fontSize:15 }}>
                {loading ? '⏳ Starting...' : '▶  Start Attendance Session'}
              </button>
            </div>
          ) : (
            <>
              {/* Active session banner */}
              <div className="session-banner" style={{ marginBottom:20 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:14 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                    <div style={{ position:'relative', width:48, height:48 }}>
                      <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'2px solid var(--accent)', animation:'pingAnim 1.5s ease-out infinite', opacity:0.4 }} />
                      <div style={{ width:48, height:48, borderRadius:'50%', background:'var(--accent-light)', border:'2px solid var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, position:'relative', zIndex:1 }}>🔊</div>
                    </div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:16, color:'var(--text1)' }}>Session Active</div>
                      <div style={{ color:'var(--text2)', fontSize:13 }}>{session.class} · {session.subject}</div>
                    </div>
                    <div className="sonic-wave" style={{ marginLeft:4 }}>
                      {[...Array(8)].map((_,i) => <div key={i} className="sonic-bar" />)}
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:20 }}>
                    <div style={{ textAlign:'center' }}>
                      <div className="mono" style={{ fontSize:18, color:'var(--accent)', fontWeight:600 }}>{currentFrequency?.toLocaleString()} Hz</div>
                      <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.1em' }}>Frequency</div>
                    </div>
                    <div style={{ textAlign:'center' }}>
                      <div className="mono" style={{ fontSize:18, color: timeLeft<20?'var(--danger)':'var(--warning)', fontWeight:600 }}>{timeLeft}s</div>
                      <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.1em' }}>Token TTL</div>
                    </div>
                    <button className="btn-danger" onClick={endSession}>■ End Session</button>
                  </div>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18 }}>
                {/* SmartBoard pattern */}
                {pattern && (
                  <div className="card" style={{ padding:24 }}>
                    <div style={{ fontSize:11, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:600, marginBottom:16 }}>📺 Smart Board — Students must select:</div>
                    <div style={{ display:'flex', gap:10, marginBottom:16 }}>
                      {pattern.options.map(opt => (
                        <div key={opt.id} style={{ flex:1, padding:'16px 8px', borderRadius:12, textAlign:'center', background: opt.id===pattern.correctId?'var(--accent-light)':'var(--bg)', border:`2px solid ${opt.id===pattern.correctId?'var(--accent)':'var(--border)'}`, position:'relative' }}>
                          {opt.id===pattern.correctId && (
                            <div style={{ position:'absolute', top:-10, left:'50%', transform:'translateX(-50%)', background:'var(--accent)', color:'#fff', fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:20, textTransform:'uppercase', letterSpacing:'0.08em', whiteSpace:'nowrap' }}>✓ Correct</div>
                          )}
                          <div style={{ fontSize:30, marginBottom:6 }}>{opt.icon}</div>
                          <div style={{ fontWeight:700, fontSize:18, color: opt.id===pattern.correctId?'var(--accent)':'var(--text1)' }}>{opt.id}</div>
                          <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>{opt.label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 14px', fontSize:12, color:'var(--text3)' }}>
                      Token auto-refreshes every ~110s for security
                    </div>
                  </div>
                )}

                {/* Live tracking */}
                <div className="card" style={{ padding:22 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <h3 style={{ fontWeight:700, fontSize:15 }}>Live Tracking</h3>
                    <div className="mono" style={{ fontSize:22, color:'var(--accent)', fontWeight:700 }}>{presentCount}/{totalCount}</div>
                  </div>
                  <div style={{ marginBottom:14 }}>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width:`${pct}%`, background:'var(--accent)' }} />
                    </div>
                    <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>{pct}% attendance so far</div>
                  </div>
                  <div style={{ maxHeight:280, overflowY:'auto', display:'flex', flexDirection:'column', gap:7 }}>
                    {liveList.map(s => (
                      <div key={s.studentId} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderRadius:10, background: s.status==='present'?'var(--accent-light)':'var(--bg)', border:`1px solid ${s.status==='present'?'#bbf7d0':'var(--border)'}`, transition:'all 0.4s' }}>
                        <div>
                          <div style={{ fontWeight:600, fontSize:13 }}>{s.name}</div>
                          <div className="mono muted" style={{ fontSize:11 }}>{s.rollNumber}</div>
                        </div>
                        <span className={s.status==='present'?'badge-present':'badge-absent'}>{s.status==='present'?'✓ Present':'Waiting'}</span>
                      </div>
                    ))}
                    {liveList.length === 0 && <p style={{ textAlign:'center', color:'var(--text3)', padding:24, fontSize:13 }}>Loading student list...</p>}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes pingAnim{0%{transform:scale(1);opacity:0.4}100%{transform:scale(1.8);opacity:0}}`}</style>
    </div>
  )
}