"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

const AuthContext = createContext(null);

// Separate storage keys per role — prevents teacher/student tokens from
// overwriting each other when both dashboards are open in different tabs.
export const TEACHER_TOKEN_KEY = "attendiq_teacher_token";
export const STUDENT_TOKEN_KEY = "attendiq_student_token";

export function AuthProvider({ children }) {
  const [teacher, setTeacher] = useState(null);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const teacherToken = localStorage.getItem(TEACHER_TOKEN_KEY);
    const studentToken = localStorage.getItem(STUDENT_TOKEN_KEY);

    if (teacherToken) {
      const tstored = localStorage.getItem("attendiq_teacher");
      if (tstored) { try { setTeacher(JSON.parse(tstored)); } catch {} }
    }
    if (studentToken) {
      const sstored = localStorage.getItem("attendiq_student");
      if (sstored) { try { setStudent(JSON.parse(sstored)); } catch {} }
    }

    // Migrate old single-token to role-specific key if applicable
    const legacyToken = localStorage.getItem("attendiq_token");
    if (legacyToken && !teacherToken && !studentToken) {
      const tstored = localStorage.getItem("attendiq_teacher");
      const sstored = localStorage.getItem("attendiq_student");
      if (tstored) {
        localStorage.setItem(TEACHER_TOKEN_KEY, legacyToken);
        try { setTeacher(JSON.parse(tstored)); } catch {}
      } else if (sstored) {
        localStorage.setItem(STUDENT_TOKEN_KEY, legacyToken);
        try { setStudent(JSON.parse(sstored)); } catch {}
      }
      localStorage.removeItem("attendiq_token");
    }

    setLoading(false);
  }, []);

  async function login(email, password) {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem(TEACHER_TOKEN_KEY, data.token);
    localStorage.setItem("attendiq_teacher", JSON.stringify(data.teacher));
    setTeacher(data.teacher);
    router.push("/dashboard");
  }

  async function register(name, email, password) {
    const { data } = await api.post("/auth/register", { name, email, password });
    localStorage.setItem(TEACHER_TOKEN_KEY, data.token);
    localStorage.setItem("attendiq_teacher", JSON.stringify(data.teacher));
    setTeacher(data.teacher);
    router.push("/dashboard");
  }

  // identifier = studentId OR email
  async function studentLogin(identifier, password) {
    const { data } = await api.post("/auth/student/login", { studentId: identifier, password });
    localStorage.setItem(STUDENT_TOKEN_KEY, data.token);
    localStorage.setItem("attendiq_student", JSON.stringify(data.student));
    setStudent(data.student);
    router.push("/student/dashboard");
  }

  function logout() {
    localStorage.removeItem(TEACHER_TOKEN_KEY);
    localStorage.removeItem(STUDENT_TOKEN_KEY);
    localStorage.removeItem("attendiq_token"); // legacy cleanup
    localStorage.removeItem("attendiq_teacher");
    localStorage.removeItem("attendiq_student");
    setTeacher(null);
    setStudent(null);
    router.push("/");
  }

  return (
    <AuthContext.Provider value={{ teacher, student, loading, login, studentLogin, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
