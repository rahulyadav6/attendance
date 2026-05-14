"use client";
import axios from "axios";
import { TEACHER_TOKEN_KEY, STUDENT_TOKEN_KEY } from "@/lib/AuthContext";

const api = axios.create({ baseURL: "/api" });

// Attach JWT token to every request automatically.
// Teacher pages use the teacher-specific token; student pages use the student token.
// This prevents cross-role token collision when both dashboards are open simultaneously.
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    // Pick token based on current route prefix
    const isStudentRoute = window.location.pathname === "/student" ||
                           window.location.pathname.startsWith("/student/") ||
                           window.location.pathname.startsWith("/scan/");
    const token = isStudentRoute
      ? (localStorage.getItem(STUDENT_TOKEN_KEY) || localStorage.getItem("attendiq_token"))
      : (localStorage.getItem(TEACHER_TOKEN_KEY) || localStorage.getItem("attendiq_token"));

    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401 — clear appropriate token and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      const isStudentRoute = window.location.pathname === "/student" ||
                             window.location.pathname.startsWith("/student/") ||
                             window.location.pathname.startsWith("/scan/");
      if (isStudentRoute) {
        localStorage.removeItem(STUDENT_TOKEN_KEY);
        localStorage.removeItem("attendiq_student");
        window.location.href = "/student/login";
      } else {
        localStorage.removeItem(TEACHER_TOKEN_KEY);
        localStorage.removeItem("attendiq_teacher");
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export default api;
