"use client";
import { useState, useRef } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";

export default function FaceTrainer({ student, onTrained }) {
  const [status,  setStatus]  = useState("idle"); // idle | loading | done | error
  const canvasRef = useRef(null);

  async function train() {
    if (!student.photo) {
      toast.error("This student has no photo. Upload a photo first.");
      return;
    }

    setStatus("loading");
    try {
      // Dynamically import face-api to avoid SSR issues
      const faceapi = await import("face-api.js");
      const MODEL_URL = "/models";

      // Load models if not already loaded
      if (!faceapi.nets.ssdMobilenetv1.isLoaded) {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
      }

      // Create image element from base64
      const img = new Image();
      img.src = student.photo;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });

      // Detect face + get descriptor
      const detection = await faceapi
        .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        toast.error("No face detected in the photo. Use a clear front-facing photo.");
        setStatus("error");
        return;
      }

      // Save descriptor to MongoDB via API
      const descriptor = Array.from(detection.descriptor); // Float32Array → plain array
      await api.post(`/students/${student._id}/train`, { descriptor });

      setStatus("done");
      toast.success(`${student.name} face trained successfully`);
      if (onTrained) onTrained(student._id);
    } catch (err) {
      console.error("Training error:", err);
      toast.error("Face training failed. Check photo quality.");
      setStatus("error");
    }
  }

  if (student.descriptor?.length === 128 && status === "idle") {
    return (
      <span style={{
        fontSize: 11, color: "var(--teal-600)", fontFamily: "'DM Mono', monospace",
        background: "var(--teal-50)", padding: "3px 8px", borderRadius: 5,
      }}>
        ✓ Trained
      </span>
    );
  }

  return (
    <button
      onClick={train}
      disabled={status === "loading"}
      style={{
        padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: status === "loading" ? "wait" : "pointer",
        border: "1px solid var(--teal-100)", background: "var(--teal-50)", color: "var(--teal-600)",
        fontFamily: "'DM Sans', system-ui, sans-serif", opacity: status === "loading" ? 0.7 : 1,
      }}
    >
      {status === "loading" ? "Training..." : status === "done" ? "✓ Done" : status === "error" ? "Retry" : "Train face"}
    </button>
  );
}
