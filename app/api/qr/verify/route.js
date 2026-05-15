import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import QRSession from "@/models/QRSession";
import Attendance from "@/models/Attendance";
import Student from "@/models/Student";
import { format } from "date-fns";
import jwt from "jsonwebtoken";

// POST /api/qr/verify
// Called when student logs in and scans QR — uses JWT to prevent proxy attendance
export async function POST(request) {
  await connectDB();
  const { token, studentToken } = await request.json();

  if (!token) return NextResponse.json({ error: "Token is required" }, { status: 400 });
  if (!studentToken) return NextResponse.json({ error: "Student authentication is required", code: "INVALID" }, { status: 400 });

  // 1. Verify student JWT to get their real identity
  let decoded;
  try {
    decoded = jwt.verify(studentToken, process.env.JWT_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid or expired login. Please try again.", code: "INVALID" }, { status: 401 });
  }

  if (!decoded.id || decoded.role !== "student") {
    return NextResponse.json({ error: "Invalid student credentials", code: "INVALID" }, { status: 401 });
  }

  // 2. Find session
  const session = await QRSession.findOne({ token });
  if (!session) return NextResponse.json({ error: "Invalid QR code", code: "INVALID" }, { status: 404 });

  // 3. Check expiry
  if (new Date() > new Date(session.expiresAt)) {
    return NextResponse.json({ error: "This QR code has expired", code: "EXPIRED" }, { status: 410 });
  }

  // 4. Look up the authenticated student and verify they belong to this section
  const student = await Student.findOne({ _id: decoded.id, sectionIds: session.sectionId });
  if (!student) {
    return NextResponse.json({ error: "You are not enrolled in this section.", code: "NOT_FOUND" }, { status: 404 });
  }

  // 5. Check if student is blocked
  if (student.isBlocked) {
    return NextResponse.json({ error: "Your account has been blocked. Contact your teacher.", code: "ERROR" }, { status: 403 });
  }

  // 6. Check already scanned — across all rotations in this session group
  const rootParentId = session.parentSessionId || session._id;
  const siblingSessions = await QRSession.find({
    $or: [
      { _id: rootParentId },
      { parentSessionId: rootParentId },
    ],
  });
  const alreadyScanned = siblingSessions.some(s =>
    s.scannedBy.some(id => id.toString() === student._id.toString())
  );
  if (alreadyScanned) {
    return NextResponse.json({ error: "Attendance already marked for today", code: "DUPLICATE", studentName: student.name }, { status: 409 });
  }

  // 7. Mark attendance
  const date = format(new Date(), "yyyy-MM-dd");
  try {
    await Attendance.create({
      studentId: student._id,
      sectionId: session.sectionId,
      teacherId: session.teacherId,
      date,
      status: "present",
      method: "qr",
    });
  } catch (err) {
    if (err.code === 11000) {
      return NextResponse.json({ error: "Attendance already recorded today", code: "DUPLICATE", studentName: student.name }, { status: 409 });
    }
    throw err;
  }

  // 8. Record scan in session
  session.scannedBy.push(student._id);
  await session.save();

  try {
    const { getIO } = await import("@/lib/socket");
    const io = getIO();
    if (io) {
      // Notify teacher dashboard of scan
      io.to(`section:${session.sectionId}`).emit("attendance_scanned", {
        studentId: student,
        markedAt: new Date().toISOString(),
      });
      io.to(session.sectionId.toString()).emit("attendance_scanned", {
        studentId: student,
        markedAt: new Date().toISOString(),
      });
      // Notify the student's own browser so their stats refresh
      io.to(`student:${student.studentId}`).emit("attendance_updated");
    }
  } catch (e) {
    console.error("Socket emit failed", e);
  }

  return NextResponse.json({ success: true, message: "Attendance marked successfully!", studentName: student.name, date, method: "qr" });
}
