import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Student from "@/models/Student";
import QRSession from "@/models/QRSession";
import jwt from "jsonwebtoken";

// GET /api/student/active-session
// Returns the currently active (non-expired) QR session for the student's sections.
// Used by the student dashboard to poll for live attendance sessions.
export async function GET(request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "student") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const student = await Student.findById(decoded.id).select("sectionIds");
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Find any non-expired QR session for any of the student's sections
    const now = new Date();
    const session = await QRSession.findOne({
      sectionId: { $in: student.sectionIds },
      expiresAt: { $gt: now },
    })
      .populate("sectionId", "name")
      .sort({ createdAt: -1 });

    if (!session) {
      return NextResponse.json({ session: null });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const qrUrl = `${appUrl}/scan/${session.token}`;

    return NextResponse.json({
      session: {
        id: session._id,
        token: session.token,
        sectionId: session.sectionId?._id,
        sectionName: session.sectionId?.name,
        expiresAt: session.expiresAt,
        qrUrl,
      },
    });
  } catch (err) {
    console.error("Active session error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
