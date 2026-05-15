"use client";
import { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import toast from "react-hot-toast";

export default function StudentDashboard() {
  const { student, logout } = useAuth();
  const [data,          setData]          = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [activeSession, setActiveSession] = useState(null);
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

        // When teacher's QR auto-rotates, update the QR URL and token
        socket.on("session_rotated", (rotatedData) => {
          setActiveSession(prev => {
            if (!prev) return prev;
            // Only update if it's for the same section
            if (prev.sectionId && prev.sectionId !== rotatedData.sectionId) return prev;
            return {
              ...prev,
              sessionToken: rotatedData.sessionToken,
              qrUrl: rotatedData.qrUrl || `${window.location.protocol}//${window.location.host}/scan/${rotatedData.sessionToken}`,
              expiresAt: rotatedData.expiresAt,
            };
          });
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

      {/* Active QR session alert — no QR shown, students must scan from projector */}
      {activeSession && (
        <div style={{ marginBottom: 24, padding: "20px 24px", background: "#fff", borderRadius: 16, border: "1px solid var(--teal-200)", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--teal-50)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>📷</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--teal-400)", animation: "pulse 1.5s ease infinite" }}/>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--gray-900)" }}>{activeSession.sectionName || "Active Session"}</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--gray-500)", lineHeight: 1.5, margin: 0 }}>
              Your teacher has started an attendance session. Scan the QR code displayed on the classroom projector with your phone to mark your attendance.
            </p>
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



      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}
