import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/common/Sidebar'
import { useUltrasonicDetector } from '../../hooks/useUltrasonic'
import { getSocket } from '../../utils/socket'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

const S = {
  IDLE:'idle', MIC:'mic', CALIBRATING:'calibrating',
  LISTENING:'listening', DETECTED:'detected', SELECT:'select',
  VERIFYING:'verifying', SUCCESS:'success', ERROR:'error'
}

export default function StudentMarkAttendance() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(S.IDLE)
  const [activeSession, setActiveSession] = useState(null)
  const [pattern, setPattern] = useState(null)
  const [selectedOption, setSelectedOption] = useState(null)
  const [detectedFreq, setDetectedFreq] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [rollNumber, setRollNumber] = useState(user?.rollNumber || '')
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [socketConnected, setSocketConnected] = useState(false)
  const detectTimeoutRef = useRef(null)
  const retryTimerRef = useRef(null)
  const sessionRef = useRef(null)

  const {
    isListening, detectedFrequency, signalStrength,
    status: detStatus, startListening, stopListening
  } = useUltrasonicDetector()

  // Track online status
  useEffect(() => {
    const onOnline = () => { setIsOnline(true); toast.success('Back online') }
    const onOffline = () => { setIsOnline(false); toast.error('No internet connection') }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  }, [])

  // Socket events
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    setSocketConnected(socket.connected)
    socket.on('connect', () => setSocketConnected(true))
    socket.on('disconnect', () => setSocketConnected(false))

    socket.on('session:new', (data) => {
      console.log('[Student] New session:', data.sessionId)
      setActiveSession(data)
      sessionRef.current = data
      setPattern(data.pattern)
      toast('A class session has started!', { icon:'🔔', duration:4000 })
    })

    socket.on('session:token-refresh', (data) => {
      setPattern(data.pattern)
      setActiveSession(prev => prev ? { ...prev, tokenFrequency: data.tokenFrequency, expiresAt: data.expiresAt } : prev)
      sessionRef.current = { ...sessionRef.current, tokenFrequency: data.tokenFrequency, expiresAt: data.expiresAt }
    })

    socket.on('session:ended', () => {
      setActiveSession(null)
      sessionRef.current = null
      setPattern(null)
      if (isListening) stopListening()
      setStep(S.IDLE)
      toast('Session ended by teacher', { icon:'🔔' })
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('session:new')
      socket.off('session:token-refresh')
      socket.off('session:ended')
    }
  }, [isListening, stopListening])

  // Calibration done → start listening
  useEffect(() => {
    if (detStatus === 'listening' && step === S.CALIBRATING) setStep(S.LISTENING)
  }, [detStatus, step])

  const handleDetection = (frequency) => {
    const session = sessionRef.current
    if (!session) return
    const diff = Math.abs(frequency - session.tokenFrequency)
    console.log(`[Student] Detected ${frequency}Hz, expected ${session.tokenFrequency}Hz, diff=${diff}`)
    if (diff <= 800) {
      setDetectedFreq(frequency)
      setStep(S.DETECTED)
      stopListening()
      if (detectTimeoutRef.current) clearTimeout(detectTimeoutRef.current)
      toast.success('Signal detected!', { duration:2000 })
      setTimeout(() => setStep(S.SELECT), 700)
    }
  }

  const startDetection = async () => {
    if (!activeSession) { toast.error('No active session. Wait for teacher to start.'); return }
    if (!rollNumber.trim()) { toast.error('Enter your roll number first'); return }
    if (!isOnline) { toast.error('No internet connection'); return }

    setStep(S.MIC)
    setErrorMsg('')
    setSelectedOption(null)

    // Join socket room BEFORE opening mic
    const socket = getSocket()
    if (socket) {
      socket.emit('student:join-session', { sessionId: activeSession.sessionId })
    }

    try {
      await startListening(handleDetection)
      setStep(S.CALIBRATING)
      detectTimeoutRef.current = setTimeout(() => {
        stopListening()
        setStep(S.ERROR)
        setErrorMsg('Signal not detected. Move closer to the speaker and tap Retry.')
      }, 180000) // 3 minute timeout
    } catch(err) {
      setStep(S.ERROR)
      setErrorMsg(
        err.name === 'NotAllowedError'
          ? 'Microphone access denied. Go to Chrome Settings → Site Settings → Microphone → Allow this site.'
          : 'Could not open microphone: ' + err.message
      )
    }
  }

  const handleOptionSelect = async (optionId) => {
    setSelectedOption(optionId)
    setStep(S.VERIFYING)
    try {
      await api.post('/attendance/verify', {
        sessionId: activeSession.sessionId,
        detectedFrequency: detectedFreq || activeSession.tokenFrequency,
        selectedOptionId: optionId,
        rollNumber: rollNumber.trim()
      })
      setStep(S.SUCCESS)
      toast.success('Attendance marked!')
    } catch(err) {
      const code = err.response?.data?.code
      const msg = err.response?.data?.message || 'Verification failed. Try again.'
      if (code === 'WRONG_SELECTION') {
        toast.error('Wrong option! Look at the board carefully.')
        setStep(S.SELECT)
        setSelectedOption(null)
      } else if (err.response?.status === 429) {
        setStep(S.ERROR)
        setErrorMsg('Too many attempts. Wait 1 minute and try again.')
      } else {
        setStep(S.ERROR)
        setErrorMsg(msg)
      }
    }
  }

  const retry = () => {
    stopListening()
    if (detectTimeoutRef.current) clearTimeout(detectTimeoutRef.current)
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    setStep(S.IDLE)
    setErrorMsg('')
    setSelectedOption(null)
    setRetryCount(r => r + 1)
  }

  useEffect(() => {
    return () => {
      stopListening()
      if (detectTimeoutRef.current) clearTimeout(detectTimeoutRef.current)
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [stopListening])

  const signalPct = Math.round(signalStrength * 100)

  return (
    <div style={{ display:'flex' }}>
      <Sidebar />
      <div className="main-content page-bg">
        <div className="fade-in" style={{ maxWidth:560, margin:'0 auto' }}>

          {/* Connection status bar */}
          {(!isOnline || !socketConnected) && (
            <div style={{ background: !isOnline ? 'var(--danger-light)' : 'var(--warning-light)', border:`1px solid ${!isOnline ? '#fecaca' : '#fed7aa'}`, borderRadius:10, padding:'10px 16px', marginBottom:14, display:'flex', alignItems:'center', gap:10, fontSize:13 }}>
              <span>{!isOnline ? '❌ No internet connection' : '⚠ Reconnecting to server...'}</span>
            </div>
          )}

          <div style={{ marginBottom:24 }}>
            <h1 style={{ fontSize:24, fontWeight:700 }}>Mark Attendance</h1>
            <p style={{ color:'var(--text3)', fontSize:13, marginTop:3 }}>Ultrasonic token verification</p>
          </div>

          {/* Roll number input */}
          {(step === S.IDLE || step === S.ERROR) && (
            <div className="card" style={{ padding:20, marginBottom:14 }}>
              <label className="label">Your Roll Number</label>
              <input className="input" placeholder="e.g. CS2024001" value={rollNumber}
                onChange={e=>setRollNumber(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&startDetection()} />
              <p style={{ fontSize:11, color:'var(--text3)', marginTop:6 }}>Must exactly match what your teacher has registered</p>
            </div>
          )}

          {/* Session badge */}
          {activeSession && step !== S.SUCCESS && (
            <div style={{ background:'var(--accent-light)', border:'1px solid #bbf7d0', borderRadius:10, padding:'11px 16px', marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:13, flexWrap:'wrap', gap:8 }}>
              <span style={{ color:'var(--accent)', fontWeight:600 }}>Active Session</span>
              <span style={{ color:'var(--text2)' }}>{activeSession.subject} · Class {activeSession.class}</span>
              <span className="mono" style={{ color:'var(--accent)', fontSize:11 }}>{activeSession.tokenFrequency?.toLocaleString()} Hz</span>
            </div>
          )}

          {/* Main card */}
          <div className="card" style={{ padding:32, textAlign:'center', marginBottom:14 }}>

            {step === S.IDLE && (
              <div>
                {activeSession ? (
                  <>
                    <div style={{ fontSize:52, marginBottom:14 }}>🎓</div>
                    <h3 style={{ fontWeight:700, fontSize:18, marginBottom:8 }}>Session Detected!</h3>
                    <p style={{ color:'var(--text3)', fontSize:14, marginBottom:24 }}>Hold your phone near the classroom speaker. The system will detect the ultrasonic signal automatically.</p>
                    <button className="btn-primary" onClick={startDetection} style={{ padding:'13px 36px', fontSize:15 }}>
                      Start Detection
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize:52, marginBottom:14 }}>📡</div>
                    <h3 style={{ fontWeight:700, fontSize:18, marginBottom:8 }}>Waiting for Session</h3>
                    <p style={{ color:'var(--text3)', fontSize:14 }}>Your teacher hasn't started a session yet. Stay on this page — it updates automatically when a session begins.</p>
                    <div style={{ display:'flex', justifyContent:'center', gap:6, marginTop:20 }}>
                      {[0,1,2].map(i => <div key={i} style={{ width:8, height:8, borderRadius:'50%', background:'var(--border2)', animation:`dotPulse 1.4s ${i*0.2}s infinite ease-in-out` }} />)}
                    </div>
                  </>
                )}
              </div>
            )}

            {step === S.MIC && (
              <div>
                <div style={{ fontSize:52, marginBottom:14 }}>🎤</div>
                <h3 style={{ fontWeight:700, fontSize:18, marginBottom:8 }}>Requesting Microphone</h3>
                <p style={{ color:'var(--text3)', fontSize:14 }}>Tap Allow when Chrome asks for microphone permission...</p>
              </div>
            )}

            {step === S.CALIBRATING && (
              <div>
                <div style={{ fontSize:52, marginBottom:14 }}>🔧</div>
                <h3 style={{ fontWeight:700, fontSize:18, marginBottom:8 }}>Calibrating</h3>
                <p style={{ color:'var(--text3)', fontSize:14, marginBottom:20 }}>Measuring ambient noise — stay quiet for a moment...</p>
                <div className="progress-track"><div className="progress-fill" style={{ width:'100%', background:'var(--accent)', animation:'calibAnim 2.5s ease-in-out' }} /></div>
              </div>
            )}

            {step === S.LISTENING && (
              <div>
                <div style={{ position:'relative', display:'inline-flex', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
                  {[1,2,3].map(r => <div key={r} style={{ position:'absolute', borderRadius:'50%', border:'2px solid rgba(22,163,74,0.3)', animation:`ringOut 2s ${r*0.6}s ease-out infinite` }} />)}
                  <div style={{ width:72, height:72, borderRadius:'50%', background:'var(--accent-light)', border:'2px solid var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:30, position:'relative', zIndex:1 }}>📡</div>
                </div>
                <h3 style={{ fontWeight:700, fontSize:18, marginBottom:6 }}>Scanning for Signal</h3>
                <p style={{ color:'var(--text3)', fontSize:14, marginBottom:20 }}>Detecting 18–22 kHz ultrasonic frequency...</p>
                <div style={{ marginBottom:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text3)', marginBottom:6 }}>
                    <span>Signal strength</span>
                    <span className="mono" style={{ color: signalPct>50?'var(--accent)':signalPct>20?'var(--warning)':'var(--danger)' }}>{signalPct}%</span>
                  </div>
                  <div className="progress-track" style={{ height:8 }}>
                    <div className="progress-fill" style={{ width:`${signalPct}%`, background: signalPct>50?'#22c55e':signalPct>20?'#f59e0b':'#ef4444', transition:'width 0.1s' }} />
                  </div>
                </div>
                {detectedFrequency && <div className="mono" style={{ fontSize:12, color:'var(--text2)', marginBottom:16 }}>Reading: <span style={{ color:'var(--accent)' }}>{detectedFrequency?.toLocaleString()} Hz</span></div>}
                <button className="btn-ghost" onClick={retry} style={{ fontSize:13, padding:'8px 20px' }}>Cancel</button>
              </div>
            )}

            {step === S.DETECTED && (
              <div>
                <div style={{ fontSize:64, marginBottom:14 }}>🎯</div>
                <h3 style={{ fontWeight:700, fontSize:20, color:'var(--accent)', marginBottom:6 }}>Signal Detected!</h3>
                <div className="mono" style={{ fontSize:16, color:'var(--text2)' }}>{detectedFreq?.toLocaleString()} Hz</div>
                <p style={{ color:'var(--text3)', fontSize:13, marginTop:12 }}>Loading options...</p>
              </div>
            )}

            {step === S.SELECT && pattern && (
              <div>
                <h3 style={{ fontWeight:700, fontSize:18, marginBottom:6 }}>Select the Correct Option</h3>
                <p style={{ color:'var(--text3)', fontSize:14, marginBottom:22 }}>Look at your teacher's screen and tap the highlighted option</p>
                <div style={{ display:'flex', gap:12 }}>
                  {pattern.options.map(opt => (
                    <button key={opt.id} onClick={()=>handleOptionSelect(opt.id)}
                      disabled={!!selectedOption}
                      style={{ flex:1, padding:'20px 10px', borderRadius:14, cursor:'pointer', background: selectedOption===opt.id?'var(--accent-light)':'var(--bg)', border:`2px solid ${selectedOption===opt.id?'var(--accent)':'var(--border)'}`, transition:'all 0.15s', textAlign:'center', opacity: selectedOption && selectedOption!==opt.id ? 0.5 : 1 }}>
                      <div style={{ fontSize:34, marginBottom:8 }}>{opt.icon}</div>
                      <div style={{ fontSize:20, fontWeight:700, color:'var(--text1)' }}>{opt.id}</div>
                      <div style={{ fontSize:12, color:'var(--text3)', marginTop:4 }}>{opt.label}</div>
                    </button>
                  ))}
                </div>
                <p style={{ color:'var(--warning)', fontSize:12, marginTop:16 }}>Wrong selection will NOT mark attendance</p>
              </div>
            )}

            {step === S.VERIFYING && (
              <div>
                <div style={{ width:48, height:48, border:'3px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spinAnim 0.8s linear infinite', margin:'0 auto 20px' }} />
                <h3 style={{ fontWeight:700, fontSize:18, marginBottom:8 }}>Verifying...</h3>
                <p style={{ color:'var(--text3)', fontSize:14 }}>Checking with server — do not close this page</p>
              </div>
            )}

            {step === S.SUCCESS && (
              <div>
                <div style={{ fontSize:64, marginBottom:16 }}>✅</div>
                <h3 style={{ fontWeight:700, fontSize:22, color:'var(--accent)', marginBottom:8 }}>Attendance Marked!</h3>
                <p style={{ color:'var(--text2)', fontSize:14, marginBottom:22 }}>{activeSession?.subject} · {new Date().toLocaleTimeString()}</p>
                <div style={{ background:'var(--accent-light)', border:'1px solid #bbf7d0', borderRadius:12, padding:16, textAlign:'left', fontFamily:'JetBrains Mono', fontSize:12, color:'var(--text2)', lineHeight:2.2, marginBottom:22 }}>
                  Token: <span style={{ color:'var(--accent)' }}>{detectedFreq?.toLocaleString()} Hz ✓</span><br/>
                  Selected: <span style={{ color:'var(--accent)' }}>{selectedOption} ✓</span><br/>
                  Roll No: <span style={{ color:'var(--accent)' }}>{rollNumber} ✓</span><br/>
                  Status: <span style={{ color:'var(--accent)', fontWeight:600 }}>PRESENT ✓</span>
                </div>
                <button className="btn-ghost" onClick={()=>navigate('/student')} style={{ fontSize:14 }}>Back to Dashboard</button>
              </div>
            )}

            {step === S.ERROR && (
              <div>
                <div style={{ fontSize:52, marginBottom:14 }}>❌</div>
                <h3 style={{ fontWeight:700, fontSize:18, color:'var(--danger)', marginBottom:10 }}>Failed</h3>
                <p style={{ color:'var(--text3)', fontSize:14, marginBottom:24, lineHeight:1.6 }}>{errorMsg}</p>
                <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
                  <button className="btn-primary" onClick={startDetection}>Retry {retryCount > 0 ? `(${retryCount+1})` : ''}</button>
                  <button className="btn-ghost" onClick={retry}>Reset</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes dotPulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
        @keyframes calibAnim{0%{width:0%}100%{width:100%}}
        @keyframes ringOut{0%{width:72px;height:72px;opacity:.6}100%{width:160px;height:160px;opacity:0}}
        @keyframes spinAnim{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  )
}