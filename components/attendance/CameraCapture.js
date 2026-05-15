"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

/**
 * CameraCapture — Opens the webcam, lets the user capture a face photo,
 * then automatically extracts the face descriptor using face-api.js.
 *
 * Props:
 *   onCapture({ photo: base64, descriptor: number[128] })  — called on success
 *   existingPhoto  — optional base64 preview of an already-captured photo
 */
export default function CameraCapture({ onCapture, existingPhoto }) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(existingPhoto || "");

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const faceApiRef = useRef(null);

  // Sync external photo prop
  useEffect(() => {
    if (existingPhoto) setCapturedPhoto(existingPhoto);
  }, [existingPhoto]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

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
      console.error("Failed to load face models:", err);
      toast.error("Failed to load face recognition models.");
      return false;
    }
  }, [modelsLoaded]);

  // When camera opens and video element mounts, attach the stream
  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOpen]);

  async function openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 360, facingMode: "user" },
      });
      streamRef.current = stream;
      setCameraOpen(true);
      // Pre-load models while user positions their face
      loadModels();
    } catch {
      toast.error("Camera access denied. Please allow camera permissions.");
    }
  }

  function stopCamera() {
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
    setCameraOpen(false);
  }

  async function captureAndTrain() {
    if (!videoRef.current) return;
    setProcessing(true);

    try {
      // Draw video frame to canvas
      const canvas = canvasRef.current || document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoRef.current, 0, 0);

      // Get base64 photo
      const photo = canvas.toDataURL("image/jpeg", 0.85);

      // Load face-api models
      const ok = await loadModels();
      if (!ok) {
        setProcessing(false);
        return;
      }
      const faceapi = faceApiRef.current;

      // Create image element from canvas for face detection
      const img = new Image();
      img.src = photo;
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
      });

      // Detect face + extract descriptor
      const detection = await faceapi
        .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        toast.error("No face detected. Please face the camera clearly and try again.");
        setProcessing(false);
        return;
      }

      const descriptor = Array.from(detection.descriptor);

      // Stop camera and set preview
      stopCamera();
      setCapturedPhoto(photo);

      // Notify parent
      if (onCapture) onCapture({ photo, descriptor });

      toast.success("Face captured and trained successfully!");
    } catch (err) {
      console.error("Capture error:", err);
      toast.error("Failed to process face. Try again with better lighting.");
    } finally {
      setProcessing(false);
    }
  }

  function retake() {
    setCapturedPhoto("");
    if (onCapture) onCapture({ photo: "", descriptor: [] });
    openCamera();
  }

  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 500,
          color: "var(--gray-700)",
          marginBottom: 6,
        }}
      >
        Face Photo (live camera)
      </label>

      {/* State: No photo, no camera */}
      {!cameraOpen && !capturedPhoto && (
        <button
          type="button"
          onClick={openCamera}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px dashed var(--gray-300)",
            background: "var(--gray-50)",
            color: "var(--gray-600)",
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            width: "100%",
            justifyContent: "center",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--teal-400)";
            e.currentTarget.style.color = "var(--teal-600)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--gray-300)";
            e.currentTarget.style.color = "var(--gray-600)";
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 5.5a1 1 0 0 1 1-1h2l1-1.5h4l1 1.5h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-7z" />
            <circle cx="8" cy="9" r="2.5" />
          </svg>
          Open Camera to Capture Face
        </button>
      )}

      {/* State: Camera is open */}
      {cameraOpen && (
        <div
          style={{
            borderRadius: 10,
            overflow: "hidden",
            border: "2px solid var(--teal-200)",
            background: "#0d1a14",
            position: "relative",
          }}
        >
          <video
            ref={(el) => {
              videoRef.current = el;
              if (el && streamRef.current) {
                el.srcObject = streamRef.current;
              }
            }}
            autoPlay
            muted
            playsInline
            style={{ width: "100%", display: "block" }}
          />
          {/* Overlay guide */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 140,
              height: 180,
              border: "2px dashed rgba(29,158,117,0.5)",
              borderRadius: "50%",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "10px",
              display: "flex",
              gap: 8,
              justifyContent: "center",
              background: "linear-gradient(transparent, rgba(0,0,0,0.6))",
            }}
          >
            <button
              type="button"
              onClick={captureAndTrain}
              disabled={processing}
              style={{
                padding: "8px 20px",
                borderRadius: 8,
                border: "none",
                background: processing ? "var(--gray-400)" : "var(--teal-400)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                cursor: processing ? "wait" : "pointer",
                fontFamily: "'DM Sans', system-ui, sans-serif",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {processing ? (
                <>
                  <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span>
                  Processing...
                </>
              ) : (
                "📸 Capture & Train"
              )}
            </button>
            <button
              type="button"
              onClick={stopCamera}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.3)",
                background: "transparent",
                color: "#fff",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* State: Photo captured */}
      {!cameraOpen && capturedPhoto && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative" }}>
            <img
              src={capturedPhoto}
              alt="Captured face"
              style={{
                width: 64,
                height: 64,
                borderRadius: 10,
                objectFit: "cover",
                border: "2px solid var(--teal-200)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: -4,
                right: -4,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "var(--teal-400)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                color: "#fff",
                border: "2px solid #fff",
              }}
            >
              ✓
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--teal-600)" }}>
              Face captured & trained
            </div>
            <button
              type="button"
              onClick={retake}
              style={{
                marginTop: 4,
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid var(--gray-200)",
                background: "var(--gray-50)",
                color: "var(--gray-600)",
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}
            >
              Retake
            </button>
          </div>
        </div>
      )}

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
