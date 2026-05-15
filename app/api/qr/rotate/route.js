import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import QRSession from "@/models/QRSession";
import Section from "@/models/Section";
import { withAuth } from "@/middleware/auth";
import { v4 as uuidv4 } from "uuid";

// POST /api/qr/rotate — rotate QR token within an active attendance session
export const POST = withAuth(async (request) => {
  await connectDB();
  const teacherId = request.teacher.id;
  const { currentSessionId, sectionId, overallExpiresAt } = await request.json();

  if (!currentSessionId || !sectionId || !overallExpiresAt) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify section belongs to teacher
  const section = await Section.findOne({ _id: sectionId, teacherId });
  if (!section) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  // Don't rotate if overall session has expired
  const overallEnd = new Date(overallExpiresAt).getTime();
  if (Date.now() >= overallEnd) {
    return NextResponse.json({ error: "Session has already expired" }, { status: 410 });
  }

  // Find the current session and expire it
  const currentSession = await QRSession.findById(currentSessionId);
  if (!currentSession) {
    return NextResponse.json({ error: "Current session not found" }, { status: 404 });
  }

  // Determine the root parent (the very first session in the rotation chain)
  const rootParentId = currentSession.parentSessionId || currentSession._id;

  // Expire the current token immediately
  currentSession.expiresAt = new Date();
  currentSession.used = true;
  await currentSession.save();

  // New token expires in 60s or at overall session end, whichever is sooner
  const newToken = uuidv4();
  const tokenExpiry = new Date(Math.min(Date.now() + 45 * 1000, overallEnd));
  const date = currentSession.date;

  // Gather all scannedBy IDs from the entire rotation chain so duplicates are detected
  const allSessions = await QRSession.find({
    $or: [
      { _id: rootParentId },
      { parentSessionId: rootParentId },
    ],
  });
  const allScannedIds = new Set();
  for (const s of allSessions) {
    for (const id of s.scannedBy) {
      allScannedIds.add(id.toString());
    }
  }

  const newSession = await QRSession.create({
    token: newToken,
    sectionId,
    teacherId,
    date,
    expiresAt: tokenExpiry,
    parentSessionId: rootParentId,
    scannedBy: [...allScannedIds], // carry forward scanned students
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const qrUrl = `${appUrl}/scan/${newToken}`;

  // Emit socket event so students see the new QR code
  try {
    const io = global.__io;
    if (io) {
      io.to(`section:${sectionId}`).emit("session_rotated", {
        sessionToken: newToken,
        sectionId,
        sectionName: section.name,
        expiresAt: tokenExpiry,
        qrUrl,
        sessionId: newSession._id,
      });
      io.to(sectionId.toString()).emit("session_rotated", {
        sessionToken: newToken,
        sectionId,
        sectionName: section.name,
        expiresAt: tokenExpiry,
        qrUrl,
        sessionId: newSession._id,
      });
    }
  } catch (e) {
    console.error("Socket emit failed on rotate", e);
  }

  return NextResponse.json({ session: newSession, qrUrl, expiresAt: tokenExpiry }, { status: 201 });
});
