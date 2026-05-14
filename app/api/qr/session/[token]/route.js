import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import QRSession from "@/models/QRSession";
import Section from "@/models/Section";

// GET /api/qr/session/:token — check if session is valid (public, no auth needed)
export async function GET(request, { params }) {
  try {
    await connectDB();
    const session = await QRSession.findOne({ token: params.token }).populate("sectionId", "name");
    if (!session) {
      return NextResponse.json({ error: "Invalid QR session", code: "INVALID" }, { status: 404 });
    }
    if (new Date() > new Date(session.expiresAt)) {
      return NextResponse.json({ error: "This QR session has expired", code: "EXPIRED" }, { status: 410 });
    }
    return NextResponse.json({
      session: {
        sectionName: session.sectionId?.name || "—",
        expiresAt: session.expiresAt,
        date: session.date,
      }
    });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
