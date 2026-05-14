import { verifyToken } from "@/lib/auth";
import { NextResponse } from "next/server";

export function withAuth(handler) {
  return async (request, context) => {
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized — no token provided" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { error: "Unauthorized — invalid or expired token" },
        { status: 401 }
      );
    }

    // NextRequest is immutable — attach auth data via a plain wrapper object
    // so routes can access req.teacher.id / req.student.id reliably.
    const authContext = {
      user: decoded,
      userRole: decoded.role || "teacher",
      teacher: decoded.role !== "student" ? decoded : undefined,
      student: decoded.role === "student" ? decoded : undefined,
    };

    // Proxy the request so routes can still use request.teacher, request.student, etc.
    const augmented = new Proxy(request, {
      get(target, prop) {
        if (prop in authContext) return authContext[prop];
        const value = target[prop];
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    return handler(augmented, context);
  };
}
