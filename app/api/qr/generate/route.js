import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import QRSession from "@/models/QRSession";
import Student from "@/models/Student";
import Section from "@/models/Section";
import { withAuth } from "@/middleware/auth";
import { v4 as uuidv4 } from "uuid";
import { format } from "date-fns";

// POST /api/qr/generate — teacher starts an attendance session
export const POST = withAuth(async (request) => {
  await connectDB();
  const teacherId = request.teacher.id;
  const { sectionId, durationMinutes = 3 } = await request.json();

  if (!sectionId) {
    return NextResponse.json({ error: "Section ID is required" }, { status: 400 });
  }

  // Enforce 1-5 min range
  const clampedDuration = Math.min(5, Math.max(1, Number(durationMinutes) || 3));

  // Verify section belongs to teacher
  const section = await Section.findOne({ _id: sectionId, teacherId });
  if (!section) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  const token     = uuidv4();
  const expiresAt = new Date(Date.now() + clampedDuration * 60 * 1000);
  const date      = format(new Date(), "yyyy-MM-dd");

  const session = await QRSession.create({ token, sectionId, teacherId, date, expiresAt });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const qrUrl  = `${appUrl}/scan/${token}`;

  // Emit socket event to students in this section
  // We do this via a global socket.io instance attached to the HTTP server
  try {
    const { getIO } = await import("@/lib/socket");
    const io = getIO();
    if (io) {
      io.to(`section:${sectionId}`).emit("session_started", {
        sessionToken: token,
        sectionId,
        sectionName: section.name,
        expiresAt,
        qrUrl,
      });
    }
  } catch (e) {
    // Socket not available in this env, skip
  }

  return NextResponse.json({ session, qrUrl, expiresAt }, { status: 201 });
});
