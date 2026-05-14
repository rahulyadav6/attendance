// Helper to get the global socket.io instance set by server.js
export function getIO() {
  return global.__io || null;
}
