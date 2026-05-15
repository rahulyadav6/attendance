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

  // ── Schedule enforcement ──────────────────────────────────────────
  // Section schedule is stored as "Day HH:MM", e.g. "Friday 21:00"
  if (section.schedule) {
    const parts = section.schedule.trim().split(/\s+/);
    if (parts.length >= 2) {
      const scheduledDay = parts[0];   // e.g. "Friday"
      const scheduledTime = parts[1];  // e.g. "21:00"

      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const now = new Date();
      const currentDay = dayNames[now.getDay()];

      if (currentDay.toLowerCase() !== scheduledDay.toLowerCase()) {
        return NextResponse.json(
          { error: `There is no class for this section right now. This section is scheduled for ${scheduledDay} at ${scheduledTime}.` },
          { status: 400 }
        );
      }

      // Check if current time falls within the 1-hour class window
      const [schedH, schedM] = scheduledTime.split(":").map(Number);
      const classStart = schedH * 60 + schedM;          // in minutes
      const classEnd = classStart + 60;                  // 1-hour window
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      if (currentMinutes < classStart || currentMinutes >= classEnd) {
        // Format times for a clear message
        const fmtTime = (mins) => {
          const h = Math.floor(mins / 60) % 24;
          const m = mins % 60;
          const ampm = h >= 12 ? "PM" : "AM";
          const h12 = h % 12 || 12;
          return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
        };
        return NextResponse.json(
          { error: `There is no class for this section right now. Class is scheduled from ${fmtTime(classStart)} to ${fmtTime(classEnd)}.` },
          { status: 400 }
        );
      }
    }
  }

  const token     = uuidv4();
  const overallExpiresAt = new Date(Date.now() + clampedDuration * 60 * 1000);
  // First token expires in 29s or at overall end, whichever is sooner
  const tokenExpiresAt = new Date(Math.min(Date.now() + 29 * 1000, overallExpiresAt.getTime()));
  const date      = format(new Date(), "yyyy-MM-dd");

  const session = await QRSession.create({ token, sectionId, teacherId, date, expiresAt: tokenExpiresAt });

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
        expiresAt: overallExpiresAt,
        qrUrl,
      });
    }
  } catch (e) {
    // Socket not available in this env, skip
  }

  return NextResponse.json({ session, qrUrl, expiresAt: overallExpiresAt }, { status: 201 });
});
