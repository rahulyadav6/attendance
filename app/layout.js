import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import { Toaster } from "react-hot-toast";

export const metadata = {
  title: "AttendIQ — Student Attendance System",
  description: "Automated student attendance monitoring with QR code and facial recognition",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontSize: "13px",
                borderRadius: "8px",
                border: "1px solid #D4DDD9",
              },
              success: { iconTheme: { primary: "#1D9E75", secondary: "#fff" } },
              error:   { iconTheme: { primary: "#E24B4A", secondary: "#fff" } },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
