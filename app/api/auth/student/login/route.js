import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Student from "@/models/Student";
import { signToken } from "@/lib/auth";

export async function POST(request) {
  try {
    await connectDB();
    const { studentId, password } = await request.json();

    if (!studentId || !password) {
      return NextResponse.json({ error: "Student ID/email and password are required" }, { status: 400 });
    }

    const identifier = studentId.trim();

    // Try by studentId first (case-insensitive), then by email
    let student = await Student.findOne({ studentId: identifier.toUpperCase() }).select("+password");
    if (!student) {
      student = await Student.findOne({ email: identifier.toLowerCase() }).select("+password");
    }

    if (!student) {
      return NextResponse.json({ error: "Invalid Student ID/email or password" }, { status: 401 });
    }

    if (student.isBlocked) {
      return NextResponse.json({ error: "Your account has been blocked. Please contact your teacher." }, { status: 403 });
    }

    const isMatch = await student.comparePassword(password);
    if (!isMatch) {
      return NextResponse.json({ error: "Invalid Student ID/email or password" }, { status: 401 });
    }

    const token = signToken({ id: student._id, role: "student", name: student.name, studentId: student.studentId });

    return NextResponse.json({
      token,
      student: { id: student._id, name: student.name, email: student.email, studentId: student.studentId },
    });
  } catch (err) {
    console.error("Student login error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
