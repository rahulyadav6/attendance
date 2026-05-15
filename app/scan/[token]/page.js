"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";

export default function ScanPage() {
  const { token }     = useParams();
  const [studentId,   setStudentId]   = useState("");
  const [password,    setPassword]    = useState("");
  const [status,      setStatus]      = useState("idle");
  // idle | loading | face_verify | capturing | verifying | success | error | expired | duplicate | face_mismatch
  const [message,     setMessage]     = useState("");
  const [name,        setName]        = useState("");
  const [sessionInfo, setSessionInfo] = useState(null);
  const [showPw,      setShowPw]      = useState(false);
  const [modelsLoaded,setModelsLoaded]= useState(false);

  const studentTokenRef = useRef(null);
  const videoRef        = useRef(null);
  const streamRef       = useRef(null);
  const canvasRef       = useRef(null);
  const faceApiRef      = useRef(null);

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
      } catch {}
    }
    if (token) checkToken();
  }, [token]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => { t.stop(); t.enabled = false; });
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  const loadModels = useCallback(async () => {
    if (faceApiRef.current && modelsLoaded) return true;
    try {
      const faceapi = await import("face-api.js");
      faceApiRef.current = faceapi;
      const MODEL_URL = "/models";
      if (!faceapi.nets.ssdMobilenetv1.isLoaded) {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
      }
      setModelsLoaded(true);
      return true;
    } catch (err) {
      console.error("Model load error:", err);
      return false;
    }
  }, [modelsLoaded]);

  async function openCamera() {
    // Check if camera API is available (requires HTTPS on mobile)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus("camera_blocked");
      setMessage("Camera is not available. On mobile, the site must be accessed via HTTPS. Please ask your teacher to use the secure URL.");
      return;
    }

    try {
      // Check permission state first (if supported)
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const perm = await navigator.permissions.query({ name: "camera" });
          if (perm.state === "denied") {
            setStatus("camera_blocked");
            setMessage("Camera permission was denied. Please go to your browser settings → Site Settings → Camera → Allow for this site, then try again.");
            return;
          }
        } catch {
          // permissions.query might not support 'camera' on some browsers — continue
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
      });
      streamRef.current = stream;
      setStatus("face_verify");
    } catch (err) {
      console.error("Camera error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setStatus("camera_blocked");
        setMessage("Camera permission was denied. Please allow camera access in your browser and try again.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setStatus("camera_blocked");
        setMessage("No camera found on this device.");
      } else if (err.name === "NotReadableError") {
        setStatus("camera_blocked");
        setMessage("Camera is in use by another app. Close other apps using the camera and try again.");
      } else {
        setStatus("camera_blocked");
        setMessage("Unable to access camera. Make sure you're using HTTPS and camera permissions are enabled.");
      }
    }
  }

  async function captureSelfie() {
    if (!videoRef.current) return;
    setStatus("capturing");

    try {
      const ok = await loadModels();
      if (!ok) {
        setStatus("error");
        setMessage("Failed to load face recognition models. Check your connection.");
        return;
      }
      const faceapi = faceApiRef.current;

      // Draw video frame to canvas
      const canvas = canvasRef.current || document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoRef.current, 0, 0);

      // Create image for detection
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      const img = new Image();
      img.src = dataUrl;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });

      // Detect face + extract descriptor
      const detection = await faceapi
        .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setStatus("face_verify");
        setMessage("No face detected. Please position your face clearly and try again.");
        return;
      }

      const selfieDescriptor = Array.from(detection.descriptor);
      stopCamera();

      // Send to verify API with face data
      setStatus("verifying");
      setMessage("");
      await verifyWithFace(selfieDescriptor);
    } catch (err) {
      console.error("Capture error:", err);
      setStatus("face_verify");
      setMessage("Failed to process face. Try again with better lighting.");
    }
  }

  async function verifyWithFace(selfieDescriptor) {
    try {
      const res = await fetch("/api/qr/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          studentToken: studentTokenRef.current,
          selfieDescriptor,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setName(data.studentName);
        setMessage(data.faceVerified
          ? "Identity verified & attendance marked!"
          : "Attendance marked successfully!");
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
        setMessage(loginData.error || "Invalid credentials.");
        return;
      }

      studentTokenRef.current = loginData.token;
      setName(loginData.student.name);

      // Step 2: Try to verify — API will tell us if face is needed
      const res = await fetch("/api/qr/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, studentToken: loginData.token }),
      });
      const data = await res.json();

      if (res.ok) {
        // No face verification needed — marked directly
        setStatus("success");
        setName(data.studentName);
        setMessage(data.message || "Attendance marked successfully!");
      } else if (data.code === "FACE_REQUIRED") {
        // Student has trained face — need selfie verification
        setName(data.studentName);
        setMessage("");
        // Start loading models while opening camera
        loadModels();
        openCamera();
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
    success:        { emoji: "✓", bg: "#E1F5EE", color: "#085041", border: "#9FE1CB", title: "Marked Present!" },
    expired:        { emoji: "⏱", bg: "#FAEEDA", color: "#633806", border: "#FAC775", title: "Session Expired" },
    duplicate:      { emoji: "✓", bg: "#E6F1FB", color: "#0C447C", border: "#B5D4F4", title: "Already Marked" },
    not_found:      { emoji: "✗", bg: "#FCEBEB", color: "#791F1F", border: "#F7C1C1", title: "Not In Section" },
    face_mismatch:  { emoji: "🚫", bg: "#FCEBEB", color: "#791F1F", border: "#F7C1C1", title: "Face Mismatch" },
    camera_blocked: { emoji: "📷", bg: "#FAEEDA", color: "#633806", border: "#FAC775", title: "Camera Required" },
    error:          { emoji: "✗", bg: "#FCEBEB", color: "#791F1F", border: "#F7C1C1", title: "Error" },
    invalid:        { emoji: "✗", bg: "#FCEBEB", color: "#791F1F", border: "#F7C1C1", title: "Invalid QR" },
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
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
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
          <div style={{ fontSize: 13, color: "#8FA89F", marginTop: 2 }}>Secure attendance verification</div>
          {sessionInfo && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#1D9E75", fontWeight: 500 }}>
              Section: {sessionInfo.sectionName || "—"}
            </div>
          )}
        </div>

        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #D4DDD9", padding: "28px 24px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>

          {/* LOGIN FORM */}
          {status === "idle" && (
            <form onSubmit={submit}>
              <div style={{ background: "#FAEEDA", borderRadius: 8, padding: "10px 14px", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>🔒</span>
                <p style={{ fontSize: 12, color: "#633806", lineHeight: 1.4 }}>
                  Login + face verification to prevent proxy attendance
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
                    type="button" onClick={() => setShowPw(!showPw)}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#8FA89F", padding: 4 }}
                  >{showPw ? "🙈" : "👁"}</button>
                </div>
              </div>

              <button type="submit" style={{ width: "100%", padding: "13px 0", background: "#1D9E75", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", transition: "background 0.15s", boxShadow: "0 2px 8px rgba(29,158,117,0.25)" }}
                onMouseOver={(e) => e.target.style.background = "#0F6E56"}
                onMouseOut={(e) => e.target.style.background = "#1D9E75"}>
                Login & Verify
              </button>
            </form>
          )}

          {/* LOADING */}
          {status === "loading" && (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <div style={{ width: 40, height: 40, border: "3px solid #E1F5EE", borderTopColor: "#1D9E75", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 14px" }}/>
              <p style={{ fontSize: 14, color: "#8FA89F" }}>Authenticating…</p>
            </div>
          )}

          {/* FACE VERIFICATION - Camera */}
          {(status === "face_verify" || status === "capturing") && (
            <div style={{ animation: "fadeUp 0.3s ease" }}>
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📸</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#1A2820" }}>
                  Face Verification
                </div>
                <div style={{ fontSize: 13, color: "#8FA89F", marginTop: 4 }}>
                  Hi {name}! Take a selfie to verify your identity
                </div>
              </div>

              {message && (
                <div style={{ background: "#FAEEDA", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#633806", textAlign: "center" }}>
                  {message}
                </div>
              )}

              <div style={{ borderRadius: 12, overflow: "hidden", border: "2px solid #1D9E75", position: "relative", background: "#0d1a14", marginBottom: 14 }}>
                <video
                  ref={(el) => {
                    videoRef.current = el;
                    if (el && streamRef.current) el.srcObject = streamRef.current;
                  }}
                  autoPlay muted playsInline
                  style={{ width: "100%", display: "block", transform: "scaleX(-1)" }}
                />
                {/* Face guide oval */}
                <div style={{
                  position: "absolute", top: "50%", left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 130, height: 170,
                  border: "2px dashed rgba(29,158,117,0.6)",
                  borderRadius: "50%",
                  pointerEvents: "none",
                }}/>
                {status === "capturing" && (
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "rgba(0,0,0,0.5)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <div style={{ width: 36, height: 36, border: "3px solid #fff", borderTopColor: "#1D9E75", borderRadius: "50%", animation: "spin 0.7s linear infinite" }}/>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={captureSelfie}
                disabled={status === "capturing"}
                style={{
                  width: "100%", padding: "13px 0",
                  background: status === "capturing" ? "#8FA89F" : "#1D9E75",
                  color: "#fff", border: "none", borderRadius: 10, fontSize: 15,
                  fontWeight: 600, cursor: status === "capturing" ? "wait" : "pointer",
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  boxShadow: "0 2px 8px rgba(29,158,117,0.25)",
                }}
              >
                {status === "capturing" ? "Verifying face…" : "📸 Capture & Verify"}
              </button>
            </div>
          )}

          {/* VERIFYING after face capture */}
          {status === "verifying" && (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <div style={{ width: 40, height: 40, border: "3px solid #E1F5EE", borderTopColor: "#1D9E75", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 14px" }}/>
              <p style={{ fontSize: 14, color: "#8FA89F" }}>Verifying your identity…</p>
            </div>
          )}

          {/* CAMERA BLOCKED - with instructions and retry */}
          {status === "camera_blocked" && (
            <div style={{ textAlign: "center", animation: "pop 0.35s ease-out" }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#FAEEDA", border: "2px solid #FAC775", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 16px" }}>
                📷
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#633806", marginBottom: 8 }}>Camera Access Needed</div>
              <div style={{ fontSize: 13, color: "#3D5249", marginBottom: 16, lineHeight: 1.6 }}>{message}</div>
              <div style={{ background: "#F8FAF9", borderRadius: 10, padding: "14px 16px", marginBottom: 18, textAlign: "left" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#3D5249", marginBottom: 8 }}>How to enable camera:</div>
                <div style={{ fontSize: 11, color: "#8FA89F", lineHeight: 1.8 }}>
                  <div>📱 <strong>Chrome:</strong> Tap 🔒 in address bar → Permissions → Camera → Allow</div>
                  <div>📱 <strong>Safari:</strong> Settings → Safari → Camera → Allow</div>
                  <div>📱 <strong>Brave:</strong> Tap 🦁 icon → Site Settings → Camera → Allow</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button onClick={() => openCamera()}
                  style={{ padding: "10px 20px", borderRadius: 8, background: "#1D9E75", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                  🔄 Retry Camera
                </button>
                <button onClick={() => { setStatus("idle"); setPassword(""); setMessage(""); }}
                  style={{ padding: "10px 16px", borderRadius: 8, background: "#F0FAF6", border: "1px solid #D4DDD9", color: "#3D5249", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                  Back
                </button>
              </div>
            </div>
          )}

          {/* RESULTS */}
          {!["idle","loading","face_verify","capturing","verifying","camera_blocked"].includes(status) && (
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
                <button onClick={() => { setStatus("idle"); setPassword(""); setMessage(""); stopCamera(); }}
                  style={{ padding: "10px 24px", borderRadius: 8, background: "#F0FAF6", border: "1px solid #D4DDD9", color: "#3D5249", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
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

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}
