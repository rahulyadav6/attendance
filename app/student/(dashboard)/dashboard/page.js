"use client";
import { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import toast from "react-hot-toast";
import QRCode from "react-qr-code";

export default function StudentDashboard() {
  const { student, logout } = useAuth();
  const [data,          setData]          = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [activeSession, setActiveSession] = useState(null);
  const [showAttModal,  setShowAttModal]  = useState(false);
  const [studentIdInput, setStudentIdInput] = useState("");
  const [markStatus,    setMarkStatus]    = useState("idle"); // idle | loading | success | error | duplicate | expired
  const [markMessage,   setMarkMessage]   = useState("");
  const [todayAtt,      setTodayAtt]      = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    async function init() {
      try {
        const res = await api.get("/student/me");
        setData(res.data.student);

        // Load today's attendance
        const todayRes = await api.get("/student/attendance/today");
        setTodayAtt(todayRes.data.attendance || []);

        // Connect socket for live session notifications
        const { default: io } = await import("socket.io-client");
        const socket = io({ path: "/api/socket" });
        socketRef.current = socket;

        const studentId = res.data.student.studentId;
        const sectionIds = res.data.student.sections.map(s => s._id);

        // CRITICAL: Wait for socket to actually connect before joining rooms
        // Emitting before 'connect' fires causes events to be silently dropped
        function joinRooms() {
          socket.emit("join_student", studentId);
          sectionIds.forEach(id => socket.emit("join_section", id));
        }

        if (socket.connected) {
          joinRooms();
        } else {
          socket.once("connect", joinRooms);
        }

        // Load active session (if any)
        try {
          const sessionRes = await api.get("/student/active-session");
          if (sessionRes.data.session) {
            setActiveSession({
              ...sessionRes.data.session,
              sessionToken: sessionRes.data.session.token,
            });
          }
        } catch (err) {
          console.error("Failed to load active session:", err);
        }

        socket.on("session_started", (sessionData) => {
          toast.success("📢 Your teacher started an attendance session!", { duration: 6000 });
          setActiveSession({
            ...sessionData,
            qrUrl: sessionData.qrUrl || `${window.location.protocol}//${window.location.host}/scan/${sessionData.sessionToken}`,
          });
        });

        socket.on("session_ended", () => {
          setActiveSession(null);
        });

        socket.on("section_added", ({ sectionId, sectionName }) => {
          // Refresh full student data to get updated sections with stats
          api.get("/student/me").then(r => {
            setData(r.data.student);
            // Also join the new section's socket room
            socket.emit("join_section", sectionId);
          }).catch(() => {});
          toast.success(`You have been added to "${sectionName || "a new section"}"!`, { duration: 5000 });
        });

        socket.on("section_removed", ({ sectionId }) => {
          setData(prev => {
            if (!prev) return prev;
            return { ...prev, sections: prev.sections.filter(s => s._id !== sectionId) };
          });
          setActiveSession(prev => {
            if (!prev) return null;
            if (prev.sectionId === sectionId) return null;
            return prev;
          });
          toast("A section was removed by your teacher.", { icon: "📚" });
        });

        socket.on("attendance_updated", () => {
          // Refresh today's attendance and section stats
          api.get("/student/attendance/today").then(r => setTodayAtt(r.data.attendance || [])).catch(() => {});
          api.get("/student/me").then(r => setData(r.data.student)).catch(() => {});
        });

      } catch (err) {
        if (err.response?.status === 401) logout();
      } finally {
        setLoading(false);
      }
    }
    init();

    const expiryTimer = setInterval(() => {
      setActiveSession(prev => {
        if (!prev) return null;
        const expiry = prev.expiresAt ? new Date(prev.expiresAt).getTime() : 0;
        if (expiry && expiry <= Date.now()) return null;
        return prev;
      });
    }, 1000);

    return () => {
      clearInterval(expiryTimer);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [logout]);

  async function markAttendance() {
    if (!studentIdInput.trim()) { toast.error("Enter your Student ID"); return; }
    if (!activeSession?.sessionToken) { toast.error("No active session token"); return; }
    setMarkStatus("loading");
    try {
      const res = await fetch("/api/qr/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: activeSession.sessionToken, studentId: studentIdInput.trim() }),
      });
      const result = await res.json();
      if (res.ok) {
        setMarkStatus("success");
        setMarkMessage("Attendance marked successfully!");
        toast.success("Attendance marked!");
        // Refresh today's attendance
        const todayRes = await api.get("/student/attendance/today");
        setTodayAtt(todayRes.data.attendance || []);
      } else {
        setMarkStatus(result.code?.toLowerCase() || "error");
        setMarkMessage(result.error || "Failed to mark attendance");
      }
    } catch {
      setMarkStatus("error");
      setMarkMessage("Network error. Please try again.");
    }
  }

  function closeModal() {
    setShowAttModal(false);
    setMarkStatus("idle");
    setMarkMessage("");
    setStudentIdInput("");
  }

  if (loading) return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid var(--gray-100)", borderTopColor: "var(--teal-400)", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 12px" }}/>
        <div style={{ fontSize: 13, color: "var(--gray-400)" }}>Loading dashboard…</div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!data) return <div style={{ padding: 40, textAlign: "center", color: "var(--gray-400)" }}>Error loading data. Please refresh.</div>;

  const initials = (name) => name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{ padding: "32px 36px", maxWidth: 900, margin: "0 auto" }}>
      {/* Blocked Alert */}
      {data.isBlocked && (
        <div style={{ marginBottom: 24, padding: "24px", background: "#FCEBEB", borderRadius: 16, border: "2px solid #F7C1C1", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 32 }}>🚫</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#791F1F", marginBottom: 4 }}>Account Restricted</div>
            <div style={{ fontSize: 14, color: "#A83C3C", lineHeight: 1.5 }}>
              Your account has been blocked by your teacher. You cannot mark attendance or join new sessions while blocked. 
              Please contact your instructor for details.
            </div>
          </div>
        </div>
      )}

      {/* Welcome header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--teal-100)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "var(--teal-800)", flexShrink: 0 }}>
          {initials(data.name)}
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--gray-900)", margin: 0 }}>Welcome back, {data.name.split(" ")[0]}!</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--gray-400)", fontFamily: "'DM Mono', monospace" }}>{data.studentId} · {data.email}</p>
        </div>
      </div>

      {/* Active QR session alert */}
      {activeSession && (
        <div style={{ marginBottom: 24, padding: "24px", background: "#fff", borderRadius: 16, border: "1px solid var(--teal-200)", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap", opacity: data.isBlocked ? 0.6 : 1, pointerEvents: data.isBlocked ? "none" : "auto" }}>
          <div style={{ flex: "1 1 300px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--teal-400)", animation: "pulse 1.5s ease infinite" }}/>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--teal-600)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Live Attendance</span>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--gray-900)", marginBottom: 8 }}>{activeSession.sectionName || "Active Session"}</h2>
            <p style={{ fontSize: 14, color: "var(--gray-500)", lineHeight: 1.5, marginBottom: 20 }}>
              Scan this QR code with your phone or click the button below to mark your attendance before the session expires.
            </p>
            <button
              onClick={() => { setShowAttModal(true); setMarkStatus("idle"); setStudentIdInput(data.studentId || ""); }}
              disabled={data.isBlocked}
              style={{ padding: "11px 24px", background: data.isBlocked ? "var(--gray-300)" : "var(--teal-400)", border: "none", color: "#fff", cursor: data.isBlocked ? "not-allowed" : "pointer", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', system-ui, sans-serif" }}
            >
              {data.isBlocked ? "Account Blocked" : "Mark Attendance Now"}
            </button>
          </div>
          
          <div style={{ background: "#F0FBF7", padding: 16, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            {activeSession.qrUrl ? (
              <div style={{ background: "#fff", padding: 12, borderRadius: 8, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
                <QRCode value={activeSession.qrUrl} size={140} />
              </div>
            ) : (
              <div style={{ width: 140, height: 140, background: "var(--gray-100)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 11, color: "var(--gray-400)" }}>Generating...</span>
              </div>
            )}
            <div style={{ fontSize: 11, color: "var(--teal-700)", fontWeight: 500 }}>Scan with Phone</div>
          </div>
        </div>
      )}

      {/* Today's Attendance */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--gray-900)", marginBottom: 12 }}>Today's Attendance</h2>
        {todayAtt.length === 0 ? (
          <div style={{ padding: "20px 24px", background: "var(--gray-50)", borderRadius: 12, border: "1px solid var(--gray-200)", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 13, color: "var(--gray-500)" }}>No attendance recorded today yet.</div>
            {activeSession && (
              <button onClick={() => setShowAttModal(true)} style={{ marginTop: 12, padding: "8px 18px", background: "var(--teal-400)", border: "none", color: "#fff", borderRadius: 7, fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                Mark attendance now
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {todayAtt.map((att, i) => (
              <div key={i} style={{ background: "#fff", borderRadius: 10, border: "1px solid var(--gray-200)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>{att.status === "present" ? "✅" : att.status === "late" ? "🕐" : "❌"}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--gray-900)" }}>{att.sectionName}</div>
                  <div style={{ fontSize: 11, color: "var(--gray-400)", fontFamily: "'DM Mono', monospace" }}>
                    {att.status} · {att.method} · {new Date(att.markedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My Sections */}
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--gray-900)", marginBottom: 12 }}>My Sections</h2>
        {data.sections.length === 0 ? (
          <div style={{ padding: "20px 24px", background: "var(--gray-50)", borderRadius: 12, border: "1px solid var(--gray-200)", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📚</div>
            <div style={{ fontSize: 13, color: "var(--gray-500)" }}>You haven't been added to any sections yet.</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
            {data.sections.map((s) => (
              <div key={s._id} style={{ background: "#fff", padding: "18px 20px", borderRadius: 12, border: "1px solid var(--gray-200)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--teal-50)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📖</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--gray-900)" }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: "var(--gray-400)", fontFamily: "'DM Mono', monospace" }}>{s.schedule || "No schedule"}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--gray-50)" }}>
                  <div style={{ fontSize: 11, color: "var(--gray-500)" }}>
                    <span style={{ fontWeight: 600, color: "var(--gray-900)" }}>{s.attended}</span> / {s.totalClasses} classes
                  </div>
                  <div style={{ 
                    padding: "4px 10px", borderRadius: 6, fontSize: 13, fontWeight: 700,
                    background: s.percentage >= 75 ? "#E1F5EE" : s.percentage >= 50 ? "#FFFBEB" : "#FCEBEB",
                    color: s.percentage >= 75 ? "#085041" : s.percentage >= 50 ? "#92400E" : "#791F1F",
                    border: `1px solid ${s.percentage >= 75 ? "#9FE1CB" : s.percentage >= 50 ? "#FDE68A" : "#F7C1C1"}`
                  }}>
                    {s.percentage}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attendance Modal — popup stays on same page, no redirect */}
      {showAttModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "32px 28px", maxWidth: 400, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            {markStatus === "idle" || markStatus === "loading" ? (
              <>
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  <div style={{ width: 48, height: 48, background: "var(--teal-400)", borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  </div>
                  <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--gray-900)", margin: 0 }}>Mark Your Attendance</h2>
                  <p style={{ fontSize: 13, color: "var(--gray-400)", marginTop: 6 }}>Enter your Student ID to confirm your presence</p>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--gray-700)", marginBottom: 6 }}>Student ID</label>
                  <input
                    type="text"
                    placeholder="e.g. BSCS-001"
                    value={studentIdInput}
                    onChange={(e) => setStudentIdInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && markAttendance()}
                    autoFocus
                    style={{ width: "100%", padding: "11px 14px", border: "2px solid var(--teal-200)", borderRadius: 8, fontSize: 15, outline: "none", fontFamily: "'DM Sans', system-ui, sans-serif", color: "var(--gray-900)", boxSizing: "border-box" }}
                    onFocus={(e) => e.target.style.borderColor = "var(--teal-400)"}
                    onBlur={(e)  => e.target.style.borderColor = "var(--teal-200)"}
                  />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={closeModal} style={{ flex: 1, padding: "10px 0", borderRadius: 8, background: "var(--gray-100)", border: "1px solid var(--gray-200)", color: "var(--gray-700)", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                    Cancel
                  </button>
                  <button
                    onClick={markAttendance}
                    disabled={markStatus === "loading"}
                    style={{ flex: 2, padding: "10px 0", borderRadius: 8, background: "var(--teal-400)", border: "none", color: "#fff", fontSize: 14, fontWeight: 500, cursor: markStatus === "loading" ? "not-allowed" : "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}
                  >
                    {markStatus === "loading" ? "Marking…" : "Mark Attendance"}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center" }}>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: markStatus === "success" ? "#E1F5EE" : markStatus === "duplicate" ? "#E6F1FB" : "#FCEBEB",
                  border: `2px solid ${markStatus === "success" ? "#9FE1CB" : markStatus === "duplicate" ? "#B5D4F4" : "#F7C1C1"}`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
                  margin: "0 auto 16px",
                }}>
                  {markStatus === "success" ? "✓" : markStatus === "duplicate" ? "✓" : "✗"}
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, color: markStatus === "success" ? "#085041" : markStatus === "duplicate" ? "#0C447C" : "#791F1F", marginBottom: 8 }}>
                  {markStatus === "success" ? "Attendance Marked!" : markStatus === "duplicate" ? "Already Marked" : markStatus === "expired" ? "Session Expired" : "Error"}
                </div>
                <div style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 24, lineHeight: 1.6 }}>{markMessage}</div>
                <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                  {markStatus !== "success" && markStatus !== "duplicate" && (
                    <button onClick={() => { setMarkStatus("idle"); setMarkMessage(""); }} style={{ padding: "9px 20px", borderRadius: 8, background: "var(--gray-100)", border: "1px solid var(--gray-200)", color: "var(--gray-700)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                      Try again
                    </button>
                  )}
                  <button onClick={closeModal} style={{ padding: "9px 20px", borderRadius: 8, background: "var(--teal-400)", border: "none", color: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}
