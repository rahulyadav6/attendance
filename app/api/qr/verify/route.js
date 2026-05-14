import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import QRSession from "@/models/QRSession";
import Attendance from "@/models/Attendance";
import Student from "@/models/Student";
import { format } from "date-fns";

// POST /api/qr/verify
// Called when student scans the QR code and logs in to take attendance
export async function POST(request) {
  await connectDB();
  const { token, studentId } = await request.json();

  if (!token) return NextResponse.json({ error: "Token is required" }, { status: 400 });
  if (!studentId) return NextResponse.json({ error: "Student ID is required", code: "INVALID" }, { status: 400 });

  // 1. Find session
  const session = await QRSession.findOne({ token });
  if (!session) return NextResponse.json({ error: "Invalid QR code", code: "INVALID" }, { status: 404 });

  // 2. Check expiry
  if (new Date() > new Date(session.expiresAt)) {
    return NextResponse.json({ error: "This QR code has expired", code: "EXPIRED" }, { status: 410 });
  }

  // 3. Look up student by studentId and section
  const student = await Student.findOne({ studentId, sectionIds: session.sectionId });
  if (!student) {
    return NextResponse.json({ error: "Student ID not found in this section.", code: "NOT_FOUND" }, { status: 404 });
  }

  // 5. Check already scanned
  if (session.scannedBy.includes(student._id)) {
    return NextResponse.json({ error: "Attendance already marked for today", code: "DUPLICATE", studentName: student.name }, { status: 409 });
  }

  // 6. Mark attendance
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

  // 7. Record scan in session
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
