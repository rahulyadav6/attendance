"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { Button, Card, Spinner } from "@/components/ui/index";
import api from "@/lib/api";
import toast from "react-hot-toast";
import QRCode from "react-qr-code";
import { io } from "socket.io-client";

const ROTATE_INTERVAL_SECONDS = 29; // rotate QR every 29 seconds

export default function QRAttendancePage() {
  const [sections,   setSections]   = useState([]);
  const [sectionId,  setSectionId]  = useState("");
  const [duration,   setDuration]   = useState(3); // 1–5 minutes
  const [session,    setSession]    = useState(null);
  const [qrUrl,      setQrUrl]      = useState("");
  const [scanned,    setScanned]    = useState([]);
  const [absent,     setAbsent]     = useState([]);
  const [students,   setStudents]   = useState([]);
  const [generating, setGenerating] = useState(false);
  const [timeLeft,   setTimeLeft]   = useState(0);
  const [rotateTimeLeft, setRotateTimeLeft] = useState(0); // seconds until next QR rotation
  const [overallExpiresAt, setOverallExpiresAt] = useState(null); // true end time of the full session
  const pollRef  = useRef(null);
  const timerRef = useRef(null);
  const rotateRef = useRef(null); // interval ref for auto-rotation
  const socketRef = useRef(null);

  const sessionRef = useRef(session);
  const sectionIdRef = useRef(sectionId);
  const overallExpiresAtRef = useRef(overallExpiresAt);
  const rootSessionIdRef = useRef(null); // the very first session ID in the rotation chain

  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { sectionIdRef.current = sectionId; }, [sectionId]);
  useEffect(() => { overallExpiresAtRef.current = overallExpiresAt; }, [overallExpiresAt]);

  useEffect(() => {
    api.get("/sections").then(({ data }) => {
      setSections(data.sections);
      if (data.sections.length > 0) setSectionId(data.sections[0]._id);
    });

    // Initialize socket connection
    const socket = io({ path: "/api/socket" });
    socketRef.current = socket;

    socket.on("attendance_scanned", () => {
      // Re-fetch to guarantee data consistency
      if (sessionRef.current && sectionIdRef.current) {
        pollScans(sessionRef.current._id, sectionIdRef.current);
      }
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    if (socketRef.current && sectionId) {
      if (socketRef.current.connected) {
        socketRef.current.emit("join_section", sectionId);
      } else {
        socketRef.current.once("connect", () => {
          socketRef.current.emit("join_section", sectionId);
        });
      }
    }
  }, [sectionId]);

  useEffect(() => {
    if (socketRef.current && session) {
      // Ensure we fetch immediately in case of late socket events
      pollScans(session._id, sectionId);
    }
  }, [session]);

  // Handle overall session countdown
  useEffect(() => {
    if (!overallExpiresAt) {
      setTimeLeft(0);
      return;
    }
    const expiry = new Date(overallExpiresAt).getTime();
    timerRef.current = setInterval(() => {
      const left = Math.max(0, Math.round((expiry - Date.now()) / 1000));
      setTimeLeft(left);
      if (left <= 0) {
        clearInterval(timerRef.current);
        clearInterval(rotateRef.current);
        // Notify students that the session has expired
        if (socketRef.current) {
          socketRef.current.emit("end_session", { sectionId: sectionIdRef.current });
        }
        setSession(null);
        setQrUrl("");
        setOverallExpiresAt(null);
        setRotateTimeLeft(0);
        toast("QR session expired", { icon: "⏱" });
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [overallExpiresAt]);

  // Handle per-rotation countdown
  useEffect(() => {
    if (!session || !overallExpiresAt) {
      setRotateTimeLeft(0);
      return;
    }
    const sessionExpiry = new Date(session.expiresAt).getTime();
    const interval = setInterval(() => {
      const left = Math.max(0, Math.round((sessionExpiry - Date.now()) / 1000));
      setRotateTimeLeft(left);
      if (left <= 0) {
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [session, overallExpiresAt]);

  useEffect(() => {
    if (!sectionId) return;
    api.get(`/students?sectionId=${sectionId}`).then(({ data }) => {
      setStudents(data.students);
    }).catch(() => {});
  }, [sectionId]);

  // Auto-rotate function
  const rotateQR = useCallback(async () => {
    if (!sessionRef.current || !sectionIdRef.current || !overallExpiresAtRef.current) return;
    
    // Don't rotate if overall session has expired
    if (Date.now() >= new Date(overallExpiresAtRef.current).getTime()) return;

    try {
      const { data } = await api.post("/qr/rotate", {
        currentSessionId: sessionRef.current._id,
        sectionId: sectionIdRef.current,
        overallExpiresAt: overallExpiresAtRef.current,
      });
      setSession(data.session);
      setQrUrl(data.qrUrl);
      toast("QR code refreshed", { icon: "🔄", duration: 2000 });
    } catch (err) {
      // If rotation fails (e.g., session expired), stop rotating
      console.error("QR rotation failed:", err);
    }
  }, []);

  async function generate() {
    if (!sectionId) { toast.error("Select a section first"); return; }
    if (duration < 1 || duration > 5) { toast.error("Duration must be between 1 and 5 minutes"); return; }
    setGenerating(true);
    try {
      const { data } = await api.post("/qr/generate", { sectionId, durationMinutes: duration });
      const overallEnd = data.expiresAt;
      setSession(data.session);
      setQrUrl(data.qrUrl);
      setOverallExpiresAt(overallEnd);
      setScanned([]);
      rootSessionIdRef.current = data.session._id;
      
      // Load absent list initially
      const studRes = await api.get(`/students?sectionId=${sectionId}`);
      setAbsent(studRes.data.students);

      // Start auto-rotation: rotate QR every ROTATE_INTERVAL_SECONDS
      clearInterval(rotateRef.current);
      rotateRef.current = setInterval(() => {
        rotateQR();
      }, ROTATE_INTERVAL_SECONDS * 1000);

    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to generate QR");
    } finally { setGenerating(false); }
  }

  async function pollScans(sessionId, secId) {
    try {
      const { data } = await api.get(`/attendance/session/${sessionId}`);
      setScanned(data.attendance);
      const scannedIds = new Set(data.attendance.map(a => a.studentId?._id?.toString() || a.studentId?.toString()));
      const studRes = await api.get(`/students?sectionId=${secId}`);
      setAbsent(studRes.data.students.filter(s => !scannedIds.has(s._id.toString())));
    } catch {}
  }

  async function markAbsent(recordId) {
    try {
      await api.put(`/attendance/${recordId}`, { status: "absent" });
      toast.success("Marked as absent");
      if (session) pollScans(session._id, sectionId);
    } catch { toast.error("Failed to update"); }
  }

  function stopSession() {
    clearInterval(rotateRef.current);
    if (socketRef.current && session) {
      socketRef.current.emit("end_session", { sectionId });
    }
    setSession(null); setQrUrl(""); setTimeLeft(0); setOverallExpiresAt(null); setRotateTimeLeft(0);
    toast("Session ended. All attendance captured so far is saved.");
  }

  async function deleteSession() {
    if (!confirm("Are you sure? This will delete the session AND all attendance records marked so far for it.")) return;
    clearInterval(rotateRef.current);
    if (socketRef.current && session) {
      socketRef.current.emit("end_session", { sectionId });
    }
    try {
      await api.delete(`/attendance/session/${session._id}`);
      setSession(null); setQrUrl(""); setTimeLeft(0); setOverallExpiresAt(null); setRotateTimeLeft(0);
      toast.success("Session and connected attendance deleted.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete session");
    }
  }

  const formatTime = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
  const pct = session ? Math.round((scanned.length / (students.length || 1)) * 100) : 0;

  return (
    <>
      <PageHeader title="QR Attendance" subtitle="Generate a QR code for students to scan" />

      <div style={{ padding: "24px 28px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Left — controls + stats */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Controls */}
          <Card style={{ padding: "20px 22px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-900)", marginBottom: 14 }}>Session settings</div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Section</label>
              <select
                value={sectionId}
                onChange={(e) => { setSectionId(e.target.value); setSession(null); }}
                style={selectStyle}
                disabled={!!session}
              >
                <option value="">Choose section…</option>
                {sections.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Duration: {duration} minute{duration !== 1 ? "s" : ""}</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="range" min={1} max={5} step={1}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  disabled={!!session}
                  style={{ flex: 1, accentColor: "var(--teal-400)" }}
                />
                <span style={{ fontSize: 12, color: "var(--gray-400)", fontFamily: "'DM Mono', monospace", minWidth: 28 }}>{duration}m</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--gray-400)", marginTop: 2 }}>
                <span>1 min</span><span>5 min</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {!session ? (
                <Button onClick={generate} disabled={generating || !sectionId} style={{ flex: 1 }}>
                  {generating ? "Generating…" : "▦ Generate QR"}
                </Button>
              ) : (
                <>
                  <button onClick={stopSession} style={{ flex: 1, padding: "9px 0", borderRadius: 8, background: "#FCEBEB", border: "1px solid #F7C1C1", color: "#791F1F", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                    Stop Session
                  </button>
                  <button onClick={deleteSession} style={{ flex: 1, padding: "9px 0", borderRadius: 8, background: "#fff", border: "1px solid #E24B4A", color: "#E24B4A", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                    Delete Session
                  </button>
                </>
              )}
            </div>
          </Card>

          {/* Live stats */}
          {session && (
            <Card style={{ padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-900)" }}>Live stats</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: timeLeft > 0 ? "var(--teal-400)" : "#E24B4A", display: "inline-block", animation: timeLeft > 0 ? "pulse 1.5s ease infinite" : "none" }}/>
                  <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: timeLeft > 0 ? "var(--teal-600)" : "#E24B4A", fontWeight: 600 }}>
                    {timeLeft > 0 ? formatTime(timeLeft) : "Expired"}
                  </span>
                </div>
              </div>
              {/* Progress bar */}
              <div style={{ background: "var(--gray-100)", borderRadius: 6, height: 8, marginBottom: 10, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: "var(--teal-400)", borderRadius: 6, transition: "width 0.5s ease" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[
                  { label: "Present", value: scanned.length, color: "var(--teal-600)" },
                  { label: "Absent", value: absent.length, color: "#C0392B" },
                  { label: "Total", value: students.length, color: "var(--gray-900)" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign: "center", padding: "10px 0", background: "var(--gray-50)", borderRadius: 8 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
                    <div style={{ fontSize: 11, color: "var(--gray-400)", marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: "var(--teal-600)", fontWeight: 500, textAlign: "center" }}>
                {pct}% attendance
              </div>
            </Card>
          )}

          {/* Absent list */}
          {session && (
            <Card style={{ overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--gray-100)", fontSize: 12, fontWeight: 600, color: "#A32D2D", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#E24B4A", display: "inline-block" }}/>
                Not yet scanned ({absent.length})
              </div>
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {absent.length === 0 ? (
                  <div style={{ padding: 16, fontSize: 12, color: "var(--teal-600)", textAlign: "center" }}>All students scanned! 🎉</div>
                ) : absent.map((s) => (
                  <div key={s._id} style={{ padding: "9px 16px", borderBottom: "1px solid var(--gray-100)", fontSize: 13, color: "var(--gray-700)" }}>{s.name}</div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right — QR code + scanned list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ padding: "28px", textAlign: "center" }}>
            {session ? (
              <>
                <div style={{ marginBottom: 16, fontSize: 13, color: "var(--gray-400)" }}>
                  Students scan this QR with their phone — a popup appears to enter their Student ID
                </div>
                <div style={{ display: "inline-block", padding: 16, background: "#fff", border: "1px solid var(--gray-200)", borderRadius: 12 }}>
                  <QRCode value={qrUrl} size={200} fgColor="var(--dark-900)" />
                </div>
                <div style={{ marginTop: 14, fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--gray-400)", wordBreak: "break-all" }}>
                  {qrUrl}
                </div>
                {/* QR rotation sub-timer */}
                <div style={{
                  marginTop: 12,
                  padding: "8px 16px",
                  background: "var(--gray-50)",
                  borderRadius: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "var(--gray-700)",
                  border: "1px solid var(--gray-200)",
                }}>
                  <span style={{ animation: "spin 2s linear infinite", display: "inline-block" }}>🔄</span>
                  <span>QR refreshes in: <strong style={{ fontFamily: "'DM Mono', monospace", color: "var(--teal-600)" }}>{formatTime(rotateTimeLeft)}</strong></span>
                </div>
              </>
            ) : (
              <div style={{ padding: "40px 0", color: "var(--gray-400)" }}>
                <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.2 }}>▦</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6, color: "var(--gray-700)" }}>No active session</div>
                <div style={{ fontSize: 13 }}>Select a section and generate a QR code to start</div>
              </div>
            )}
          </Card>

          {/* Scanned (Present) list */}
          {session && (
            <Card style={{ overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--gray-100)", fontSize: 12, fontWeight: 600, color: "var(--teal-600)", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--teal-400)", display: "inline-block" }}/>
                Present ({scanned.length})
              </div>
              <div style={{ maxHeight: 260, overflowY: "auto" }}>
                {scanned.length === 0 ? (
                  <div style={{ padding: 16, fontSize: 12, color: "var(--gray-400)", textAlign: "center" }}>Waiting for scans…</div>
                ) : scanned.map((a, i) => (
                  <div key={i} style={{ padding: "9px 16px", borderBottom: "1px solid var(--gray-100)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, color: "var(--gray-900)" }}>{a.studentId?.name || "Student"}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--gray-400)" }}>
                        {new Date(a.markedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <button
                        onClick={() => markAbsent(a._id)}
                        title="Flag suspicious and mark absent"
                        style={{ padding: "3px 6px", borderRadius: 4, border: "1px solid #E24B4A", background: "transparent", color: "#E24B4A", fontSize: 10, cursor: "pointer" }}
                      >✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}

const labelStyle = { display: "block", fontSize: 12, fontWeight: 500, color: "var(--gray-700)", marginBottom: 6 };
const selectStyle = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--gray-200)", fontSize: 13, background: "#fff", color: "var(--gray-700)", fontFamily: "'DM Sans', system-ui, sans-serif", cursor: "pointer" };
