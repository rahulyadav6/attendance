import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Attendance from "@/models/Attendance";
import QRSession from "@/models/QRSession";
import { withAuth } from "@/middleware/auth";

// GET /api/attendance/session/:sessionId — poll for live scan updates
export const GET = withAuth(async (request, { params }) => {
  await connectDB();
  const session = await QRSession.findOne({ _id: params.sessionId, teacherId: request.teacher.id });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const attendance = await Attendance.find({
    sectionId: session.sectionId,
    date: session.date,
    method: "qr",
    status: { $ne: "absent" },
  }).populate("studentId", "name studentId").sort({ markedAt: 1 });

  return NextResponse.json({ attendance });
});

// DELETE /api/attendance/session/:sessionId - delete session and its attendance records
export const DELETE = withAuth(async (request, { params }) => {
  await connectDB();
  const session = await QRSession.findOne({ _id: params.sessionId, teacherId: request.teacher.id });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  // Delete all attendance records associated with this session
  await Attendance.deleteMany({
    sectionId: session.sectionId,
    date: session.date,
    method: "qr",
    status: { $ne: "absent" },
    studentId: { $in: session.scannedBy }
  });

  // Delete the session itself
  await QRSession.deleteOne({ _id: params.sessionId });

  // Broadcast session_ended so students see the QR disappear immediately
  try {
    const { getIO } = await import("@/lib/socket");
    const io = getIO();
    if (io) {
      io.to(`section:${session.sectionId}`).emit("session_ended", { sectionId: session.sectionId });
      io.to(session.sectionId.toString()).emit("session_ended", { sectionId: session.sectionId });
    }
  } catch (e) {}

  return NextResponse.json({ success: true, message: "Session and related attendance records deleted" });
});
