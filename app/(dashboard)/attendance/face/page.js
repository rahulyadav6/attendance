"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { Button, Select, Badge, Card, Spinner } from "@/components/ui/index";
import api from "@/lib/api";
import toast from "react-hot-toast";

export default function FaceAttendancePage() {
  const [sections,    setSections]    = useState([]);
  const [sectionId,   setSectionId]   = useState("");
  const [students,    setStudents]    = useState([]);
  const [marked,      setMarked]      = useState([]);
  const [active,      setActive]      = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [detecting,   setDetecting]   = useState(false);
  const [lastMatch,   setLastMatch]   = useState(null);

  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  const intervalRef  = useRef(null);
  const faceApiRef   = useRef(null);
  const markedIdsRef = useRef(new Set()); // synchronous duplicate guard
  const sectionIdRef = useRef(sectionId);
  const studentsRef  = useRef(students);

  // Keep refs in sync with state
  useEffect(() => { sectionIdRef.current = sectionId; }, [sectionId]);
  useEffect(() => { studentsRef.current = students; }, [students]);

  // Load sections on mount
  useEffect(() => {
    api.get("/sections").then(({ data }) => setSections(data.sections));
  }, []);

  // Load students when section changes
  useEffect(() => {
    if (!sectionId) return;
    api.get(`/students?sectionId=${sectionId}`).then(({ data }) => {
      setStudents(data.students);
      setMarked([]);
      markedIdsRef.current = new Set();
    });
  }, [sectionId]);

  // Load face-api.js models
  const loadModels = useCallback(async () => {
    if (faceApiRef.current) return true;
    setLoading(true);
    try {
      const faceapi = await import("face-api.js");
      faceApiRef.current = faceapi;
      const MODEL_URL = "/models";
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      setModelsReady(true);
      return true;
    } catch (err) {
      toast.error("Failed to load face recognition models. Ensure /public/models/ files are present.");
      console.error(err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  async function startCamera() {
    if (!sectionId)  { toast.error("Select a section first"); return; }
    const trained = students.filter((s) => s.descriptor?.length === 128);
    if (trained.length === 0) {
      toast.error("No students have face data. Add photos and train them first.");
      return;
    }

    const ok = await loadModels();
    if (!ok) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setActive(true);
      startDetection();
    } catch {
      toast.error("Camera access denied. Please allow camera permissions.");
    }
  }

  function stopCamera() {
    clearInterval(intervalRef.current);
    // Stop all tracks to release camera hardware
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        t.stop();
        t.enabled = false;
      });
      streamRef.current = null;
    }
    // Clear video element source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setActive(false);
    setDetecting(false);
    setLastMatch(null);
  }

  function buildMatcher() {
    const faceapi   = faceApiRef.current;
    const trained   = studentsRef.current.filter((s) => s.descriptor?.length === 128);
    const labeled   = trained.map((s) => {
      const desc = new Float32Array(s.descriptor);
      return new faceapi.LabeledFaceDescriptors(s._id, [desc]);
    });
    return new faceapi.FaceMatcher(labeled, 0.5);
  }

  function startDetection() {
    const faceapi = faceApiRef.current;
    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current || detecting) return;
      setDetecting(true);

      try {
        const detections = await faceapi
          .detectAllFaces(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptors();

        // Draw canvas overlay
        const dims = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
        faceapi.matchDimensions(canvasRef.current, dims);
        const resized = faceapi.resizeResults(detections, dims);
        const ctx = canvasRef.current.getContext("2d");
        ctx.clearRect(0, 0, dims.width, dims.height);

        if (detections.length === 0) { setDetecting(false); return; }

        const matcher = buildMatcher();

        for (const det of resized) {
          const match  = matcher.findBestMatch(det.descriptor);
          const box    = det.detection.box;
          const isKnown = match.label !== "unknown";

          // Draw bounding box
          ctx.strokeStyle = isKnown ? "#1D9E75" : "#E24B4A";
          ctx.lineWidth   = 2;
          ctx.strokeRect(box.x, box.y, box.width, box.height);

          if (isKnown) {
            const student = studentsRef.current.find((s) => s._id === match.label);
            if (student) {
              // Draw name label
              ctx.fillStyle = "#1D9E75";
              ctx.fillRect(box.x, box.y - 24, box.width, 24);
              ctx.fillStyle = "#fff";
              ctx.font      = "13px 'DM Sans', system-ui, sans-serif";
              ctx.fillText(student.name, box.x + 6, box.y - 7);

              // Auto-mark if not already marked (use synchronous ref to prevent duplicates)
              if (!markedIdsRef.current.has(student._id)) {
                markedIdsRef.current.add(student._id);
                await markPresent(student);
              }
            }
          }
        }
      } catch (err) {
        console.error("Detection error:", err);
      } finally {
        setDetecting(false);
      }
    }, 1500); // run every 1.5s
  }

  async function markPresent(student) {
    try {
      await api.post("/attendance", {
        studentId: student._id,
        sectionId: sectionIdRef.current,
        method: "face",
        status: "present",
      });
      setMarked((prev) => {
        if (prev.some((m) => m.studentId === student._id)) return prev;
        return [...prev, { studentId: student._id, name: student.name, time: new Date() }];
      });
      setLastMatch(student.name);
      setTimeout(() => setLastMatch(null), 3000);
      toast.success(`${student.name} marked present`);
    } catch (err) {
      if (err.response?.data?.code === "DUPLICATE") {
        // Already marked today — update UI to reflect that
        setMarked((prev) => {
          if (prev.some((m) => m.studentId === student._id)) return prev;
          return [...prev, { studentId: student._id, name: student.name, time: new Date() }];
        });
      } else {
        console.error("Mark error:", err);
        // Remove from ref so it can retry on next detection
        markedIdsRef.current.delete(student._id);
      }
    }
  }

  // Manual mark from list
  async function manualMark(student) {
    if (markedIdsRef.current.has(student._id)) { toast.error("Already marked"); return; }
    markedIdsRef.current.add(student._id);
    try {
      await api.post("/attendance", { studentId: student._id, sectionId, method: "manual", status: "present" });
      setMarked((prev) => {
        if (prev.some((m) => m.studentId === student._id)) return prev;
        return [...prev, { studentId: student._id, name: student.name, time: new Date() }];
      });
      toast.success(`${student.name} manually marked`);
    } catch (err) {
      if (err.response?.data?.code === "DUPLICATE") toast.error("Already marked today");
      else toast.error("Failed to mark attendance");
    }
  }

  const markedIds = new Set(marked.map((m) => m.studentId));
  const absent    = students.filter((s) => !markedIds.has(s._id));
  const trained   = students.filter((s) => s.descriptor?.length === 128);

  return (
    <>
      <PageHeader title="Face Recognition" subtitle="Auto-mark attendance via webcam" />

      <div style={{ padding: "24px 28px", display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
        {/* Left — webcam */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Controls */}
          <Card style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <select
              value={sectionId}
              onChange={(e) => { if (active) stopCamera(); setSectionId(e.target.value); }}
              style={{
                padding: "8px 12px", borderRadius: 8, border: "1px solid var(--gray-200)",
                fontSize: 13, background: "#fff", color: "var(--gray-700)",
                fontFamily: "'DM Sans', system-ui, sans-serif", cursor: "pointer", minWidth: 180,
              }}
            >
              <option value="">Choose section...</option>
              {sections.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>

            {sectionId && (
              <span style={{ fontSize: 11, color: "var(--gray-400)", fontFamily: "'DM Mono', monospace" }}>
                {trained.length}/{students.length} students trained
              </span>
            )}

            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {!active ? (
                <Button onClick={startCamera} disabled={loading || !sectionId}>
                  {loading ? "Loading models..." : "Start camera"}
                </Button>
              ) : (
                <Button variant="danger" onClick={stopCamera}>Stop camera</Button>
              )}
            </div>
          </Card>

          {/* Camera feed */}
          <Card style={{ overflow: "hidden", position: "relative" }}>
            <div style={{ position: "relative", background: "#0d1a14", minHeight: 400,
                          display: "flex", alignItems: "center", justifyContent: "center" }}>
              <video
                ref={videoRef}
                autoPlay muted playsInline
                style={{ width: "100%", display: active ? "block" : "none" }}
              />
              <canvas
                ref={canvasRef}
                style={{ position: "absolute", top: 0, left: 0, width: "100%",
                         display: active ? "block" : "none" }}
              />

              {!active && (
                <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.3)" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>◉</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>Camera inactive</div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>Select a section and start camera</div>
                </div>
              )}

              {/* Match toast overlay */}
              {lastMatch && (
                <div style={{
                  position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
                  background: "var(--teal-400)", color: "#fff", padding: "8px 20px",
                  borderRadius: 30, fontSize: 13, fontWeight: 500, whiteSpace: "nowrap",
                  animation: "fadeIn 0.3s ease",
                }}>
                  ✓ {lastMatch} marked present
                </div>
              )}

              {detecting && active && (
                <div style={{ position: "absolute", top: 10, right: 10 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: "50%", background: "var(--teal-400)",
                    animation: "pulse 1s ease infinite",
                  }}/>
                </div>
              )}
            </div>

            {active && (
              <div style={{ padding: "10px 16px", borderTop: "1px solid var(--gray-100)",
                            display: "flex", alignItems: "center", gap: 8,
                            fontSize: 12, color: "var(--gray-400)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--teal-400)",
                               display: "inline-block", animation: "pulse 1.5s ease infinite" }}/>
                Scanning every 1.5 seconds · Green box = recognized · Red box = unknown face
              </div>
            )}
          </Card>

          <style>{`
            @keyframes fadeIn { from{opacity:0;transform:translate(-50%,10px)} to{opacity:1;transform:translateX(-50%)} }
            @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
          `}</style>
        </div>

        {/* Right — attendance list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Present */}
          <Card style={{ overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--gray-100)",
                          fontSize: 12, fontWeight: 600, color: "var(--teal-600)",
                          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--teal-400)",
                               display: "inline-block" }}/>
                Present ({marked.length})
              </span>
            </div>
            <div style={{ maxHeight: 240, overflowY: "auto" }}>
              {marked.length === 0 ? (
                <div style={{ padding: 16, fontSize: 12, color: "var(--gray-400)", textAlign: "center" }}>
                  No one marked yet
                </div>
              ) : [...marked].reverse().map((m, i) => (
                <div key={i} style={{ padding: "8px 14px", borderBottom: "1px solid var(--gray-100)",
                                      display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "var(--gray-900)" }}>{m.name}</span>
                  <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--gray-400)" }}>
                    {m.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Absent / not yet */}
          <Card style={{ overflow: "hidden", flex: 1 }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--gray-100)",
                          fontSize: 12, fontWeight: 600, color: "#A32D2D",
                          display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#E24B4A",
                             display: "inline-block" }}/>
              Not marked ({absent.length})
            </div>
            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              {absent.length === 0 && students.length > 0 ? (
                <div style={{ padding: 16, fontSize: 12, color: "var(--teal-600)", textAlign: "center" }}>
                  All students marked!
                </div>
              ) : absent.map((s, i) => (
                <div key={s._id} style={{ padding: "8px 14px", borderBottom: "1px solid var(--gray-100)",
                                          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, color: "var(--gray-900)" }}>{s.name}</div>
                    {s.descriptor?.length !== 128 && (
                      <div style={{ fontSize: 10, color: "var(--gray-400)", fontFamily: "'DM Mono', monospace" }}>
                        no face data
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => manualMark(s)}
                    style={{
                      padding: "4px 10px", borderRadius: 6, border: "1px solid var(--gray-200)",
                      background: "var(--gray-50)", color: "var(--gray-700)", fontSize: 11,
                      cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif",
                    }}
                  >
                    Manual
                  </button>
                </div>
              ))}
            </div>
          </Card>

          {/* Train faces shortcut */}
          <Card style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 12, color: "var(--gray-400)", marginBottom: 8 }}>
              Students need face data to be recognized. Train them from the Students page.
            </div>
            <a href="/students" style={{ textDecoration: "none" }}>
              <button style={{
                width: "100%", padding: "8px 0", borderRadius: 8,
                border: "1px solid var(--teal-100)", background: "var(--teal-50)",
                color: "var(--teal-600)", fontSize: 12, fontWeight: 500,
                cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif",
              }}>
                Go to Students → train faces
              </button>
            </a>
          </Card>
        </div>
      </div>
    </>
  );
}
