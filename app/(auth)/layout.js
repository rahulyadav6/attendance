export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4"
         style={{ background: "var(--gray-50)" }}>
      {children}
    </div>
  );
}
