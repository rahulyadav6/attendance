const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Global io reference accessible from API routes
let _io = null;
global.__io = null;

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(server, {
    path: "/api/socket",
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Store globally so API routes can emit events
  global.__io = io;

  io.on('connection', (socket) => {
    // Students join their section rooms (prefixed with "section:")
    socket.on('join_section', (sectionId) => {
      socket.join(`section:${sectionId}`);
      // Also join without prefix for backwards compat
      socket.join(sectionId);
    });

    // Students join a personal room so server can target them by studentId
    socket.on('join_student', (studentId) => {
      socket.join(`student:${studentId}`);
    });

    // Teacher broadcasts a new QR session
    socket.on('new_session', (data) => {
      io.to(`section:${data.sectionId}`).emit('session_started', data);
      io.to(data.sectionId).emit('session_started', data);
    });

    socket.on('end_session', (data) => {
      io.to(`section:${data.sectionId}`).emit('session_ended', data);
      io.to(data.sectionId).emit('session_ended', data);
    });

    socket.on('disconnect', () => {});
  });

  server.once('error', (err) => {
    console.error(err);
    process.exit(1);
  });

  server.listen(port,hostname, () => {
    console.log(`> AttendIQ ready on http://${hostname}:${port}`);
  });
});
