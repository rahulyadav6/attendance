import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import QRSession from "@/models/QRSession";
import Attendance from "@/models/Attendance";
import Student from "@/models/Student";
import { format } from "date-fns";
import jwt from "jsonwebtoken";

// Euclidean distance between two 128-dim face descriptors
function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < 128; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

const FACE_MATCH_THRESHOLD = 0.6; // lower = stricter

// POST /api/qr/verify
// Called when student logs in and scans QR — uses JWT + face selfie to prevent proxy
export async function POST(request) {
  await connectDB();
  const { token, studentToken, selfieDescriptor } = await request.json();

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

  // 6. Face verification — if student has a trained face, require selfie match
  const hasFaceData = Array.isArray(student.descriptor) && student.descriptor.length === 128;

  if (hasFaceData) {
    if (!selfieDescriptor || !Array.isArray(selfieDescriptor) || selfieDescriptor.length !== 128) {
      // Student has face data but no selfie provided — tell client to capture one
      return NextResponse.json({
        error: "Face verification required",
        code: "FACE_REQUIRED",
        studentName: student.name,
      }, { status: 428 });
    }

    // Compare selfie with stored descriptor
    const distance = euclideanDistance(student.descriptor, selfieDescriptor);
    if (distance > FACE_MATCH_THRESHOLD) {
      return NextResponse.json({
        error: "Face does not match your profile. Proxy attendance is not allowed.",
        code: "FACE_MISMATCH",
        studentName: student.name,
      }, { status: 403 });
    }
  }

  // 7. Check already scanned — across all rotations in this session group
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

  // 8. Mark attendance
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

  // 9. Record scan in session
  session.scannedBy.push(student._id);
  await session.save();

  try {
    const { getIO } = await import("@/lib/socket");
    const io = getIO();
    if (io) {
      io.to(`section:${session.sectionId}`).emit("attendance_scanned", {
        studentId: student,
        markedAt: new Date().toISOString(),
      });
      io.to(session.sectionId.toString()).emit("attendance_scanned", {
        studentId: student,
        markedAt: new Date().toISOString(),
      });
      io.to(`student:${student.studentId}`).emit("attendance_updated");
    }
  } catch (e) {
    console.error("Socket emit failed", e);
  }

  return NextResponse.json({
    success: true,
    message: "Attendance marked successfully!",
    studentName: student.name,
    date,
    method: "qr",
    faceVerified: hasFaceData,
  });
}
