"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

export default function ScanPage() {
  const { token }     = useParams();
  const [studentId,   setStudentId]   = useState("");
  const [password,    setPassword]    = useState("");
  const [status,      setStatus]      = useState("idle"); // idle | loading | success | error | expired | duplicate
  const [message,     setMessage]     = useState("");
  const [name,        setName]        = useState("");
  const [sessionInfo, setSessionInfo] = useState(null);
  const [showPw,      setShowPw]      = useState(false);

  // Verify the token is valid on mount
  useEffect(() => {
    async function checkToken() {
      try {
        const res = await fetch(`/api/qr/session/${token}`);
        if (!res.ok) {
          const d = await res.json();
          setStatus(d.code?.toLowerCase() || "error");
          setMessage(d.error || "Invalid or expired session");
        } else {
          const d = await res.json();
          setSessionInfo(d.session);
        }
      } catch {
        // If can't check, let user try anyway
      }
    }
    if (token) checkToken();
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    if (!studentId.trim() || !password.trim()) return;
    setStatus("loading");

    try {
      // Step 1: Authenticate the student
      const loginRes = await fetch("/api/auth/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: studentId.trim(), password: password.trim() }),
      });
      const loginData = await loginRes.json();

      if (!loginRes.ok) {
        setStatus("error");
        setMessage(loginData.error || "Invalid credentials. Please check your Student ID and password.");
        return;
      }

      // Step 2: Mark attendance using the authenticated student token
      const res = await fetch("/api/qr/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, studentToken: loginData.token }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setName(data.studentName);
        setMessage(data.message || "Attendance marked successfully!");
      } else {
        setStatus(data.code?.toLowerCase() || "error");
        setMessage(data.error);
        setName(data.studentName || "");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  const resultStyles = {
    success:   { emoji: "✓", bg: "#E1F5EE", color: "#085041", border: "#9FE1CB", title: "Marked Present!" },
    expired:   { emoji: "⏱", bg: "#FAEEDA", color: "#633806", border: "#FAC775", title: "Session Expired" },
    duplicate: { emoji: "✓", bg: "#E6F1FB", color: "#0C447C", border: "#B5D4F4", title: "Already Marked" },
    not_found: { emoji: "✗", bg: "#FCEBEB", color: "#791F1F", border: "#F7C1C1", title: "Not In Section" },
    error:     { emoji: "✗", bg: "#FCEBEB", color: "#791F1F", border: "#F7C1C1", title: "Error" },
    invalid:   { emoji: "✗", bg: "#FCEBEB", color: "#791F1F", border: "#F7C1C1", title: "Invalid QR" },
  };

  const style = resultStyles[status] || resultStyles.error;

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "#F0FAF6", padding: 20,
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --gray-50: #F8FAF9; --gray-100: #EEF2F0; --gray-200: #D4DDD9;
          --gray-400: #8FA89F; --gray-700: #3D5249; --gray-900: #1A2820;
          --teal-400: #1D9E75; --teal-600: #0F6E56;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pop  { 0%{transform:scale(0.85);opacity:0} 100%{transform:scale(1);opacity:1} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div style={{ width: "100%", maxWidth: 400, animation: "fadeUp 0.4s ease" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, background: "#1D9E75", borderRadius: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12, boxShadow: "0 4px 14px rgba(29,158,117,0.3)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
            </svg>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#1A2820" }}>AttendIQ</div>
          <div style={{ fontSize: 13, color: "#8FA89F", marginTop: 2 }}>Login to mark your attendance</div>
          {sessionInfo && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#1D9E75", fontWeight: 500 }}>
              Section: {sessionInfo.sectionName || "—"}
            </div>
          )}
        </div>

        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #D4DDD9", padding: "28px 24px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
          {status === "idle" && (
            <form onSubmit={submit}>
              <div style={{ background: "#FAEEDA", borderRadius: 8, padding: "10px 14px", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>🔒</span>
                <p style={{ fontSize: 12, color: "#633806", lineHeight: 1.4 }}>
                  Login with your credentials to prevent proxy attendance
                </p>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#3D5249", marginBottom: 6 }}>Student ID or Email</label>
                <input
                  type="text" placeholder="e.g. 3 or student@school.edu"
                  value={studentId} onChange={(e) => setStudentId(e.target.value)}
                  autoFocus required
                  style={{ width: "100%", padding: "12px 14px", fontSize: 15, border: "2px solid #D4DDD9", borderRadius: 10, outline: "none", fontFamily: "'DM Sans', sans-serif", color: "#1A2820", transition: "border-color 0.15s" }}
                  onFocus={(e) => e.target.style.borderColor = "#1D9E75"}
                  onBlur={(e)  => e.target.style.borderColor = "#D4DDD9"}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#3D5249", marginBottom: 6 }}>Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPw ? "text" : "password"} placeholder="Enter your password"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ width: "100%", padding: "12px 40px 12px 14px", fontSize: 15, border: "2px solid #D4DDD9", borderRadius: 10, outline: "none", fontFamily: "'DM Sans', sans-serif", color: "#1A2820", transition: "border-color 0.15s" }}
                    onFocus={(e) => e.target.style.borderColor = "#1D9E75"}
                    onBlur={(e)  => e.target.style.borderColor = "#D4DDD9"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#8FA89F", padding: 4 }}
                  >
                    {showPw ? "🙈" : "👁"}
                  </button>
                </div>
              </div>

              <button type="submit" style={{ width: "100%", padding: "13px 0", background: "#1D9E75", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", transition: "background 0.15s", boxShadow: "0 2px 8px rgba(29,158,117,0.25)" }}
                onMouseOver={(e) => e.target.style.background = "#0F6E56"}
                onMouseOut={(e) => e.target.style.background = "#1D9E75"}>
                Login & Mark Attendance
              </button>
            </form>
          )}

          {status === "loading" && (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <div style={{ width: 40, height: 40, border: "3px solid #E1F5EE", borderTopColor: "#1D9E75", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 14px" }}/>
              <p style={{ fontSize: 14, color: "#8FA89F" }}>Verifying your identity…</p>
            </div>
          )}

          {!["idle","loading"].includes(status) && (
            <div style={{ textAlign: "center", animation: "pop 0.35s ease-out" }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: style.bg, border: `2px solid ${style.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 16px", boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
                {style.emoji}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: style.color, marginBottom: 6 }}>{style.title}</div>
              {name && <div style={{ fontSize: 16, fontWeight: 600, color: "#1A2820", marginBottom: 6 }}>{name}</div>}
              <div style={{ fontSize: 14, color: "#3D5249", marginBottom: 24, lineHeight: 1.6 }}>{message}</div>
              {status === "success" && (
                <div style={{ padding: "10px 16px", background: "#E1F5EE", borderRadius: 8, fontSize: 12, color: "#085041", display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                  <span>✓</span> {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Today
                </div>
              )}
              {status !== "success" && (
                <button onClick={() => { setStatus("idle"); setPassword(""); }} style={{ padding: "10px 24px", borderRadius: 8, background: "#F0FAF6", border: "1px solid #D4DDD9", color: "#3D5249", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                  Try again
                </button>
              )}
            </div>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: 18, fontSize: 11, color: "#8FA89F", fontFamily: "'DM Mono', monospace" }}>
          AttendIQ · Secure scan portal · {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
