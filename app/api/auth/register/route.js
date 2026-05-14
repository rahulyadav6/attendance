import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Teacher from "@/models/Teacher";
import { signToken } from "@/lib/auth";

// POST /api/auth/register
// Used once to create the teacher account
export async function POST(request) {
  try {
    await connectDB();

    const count = await Teacher.countDocuments();
    if (count > 0) {
      return NextResponse.json(
        { error: "A teacher account already exists. This system supports one teacher." },
        { status: 403 }
      );
    }

    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const teacher = await Teacher.create({ name, email, password });
    const token = signToken({ id: teacher._id, email: teacher.email, name: teacher.name });

    return NextResponse.json({
      token,
      teacher: { id: teacher._id, name: teacher.name, email: teacher.email },
    }, { status: 201 });
  } catch (err) {
    if (err.code === 11000) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
    console.error("Register error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
