const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const expressLayouts = require('express-ejs-layouts'); // ✅ Layouts
require('dotenv').config();

// Import routes and DB config
const db = require('./config/db');
const homeRoutes = require('./routes/home');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');
const chatRoutes = require('./routes/chat');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// ✅ Connect to DB
db.connect();

// ✅ Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ✅ Sessions
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// ✅ Set up EJS and Layouts
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main'); // Default layout file

// ✅ Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Make Socket.IO available to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ✅ Routes
app.use('/', homeRoutes);
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/admin', adminRoutes);
app.use('/chat', chatRoutes);

// ✅ Socket.IO logic
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`User ${socket.id} joined room ${room}`);
  });

  socket.on('chat-message', async (data) => {
    const ChatMessage = require('./models/ChatMessage');

    try {
      // Validate message data
      if (!data.sessionId || !data.message || !data.senderType) {
        console.error('Invalid message data:', data);
        return;
      }

      const message = new ChatMessage({
        sessionId: data.sessionId,
        sender: data.sender,
        senderType: data.senderType,
        message: data.message,
        createdAt: new Date()
      });

      await message.save();

      // Broadcast to all clients in the room
      io.to(data.sessionId).emit('chat-message', {
        _id: message._id,
        sessionId: data.sessionId,
        sender: data.sender,
        senderType: data.senderType,
        message: data.message,
        createdAt: message.createdAt,
        timestamp: message.createdAt
      });

      // Send confirmation to sender
      socket.emit('message-sent', {
        tempId: data.tempId,
        messageId: message._id
      });

    } catch (error) {
      console.error('Error saving chat message:', error);
      socket.emit('message-error', {
        tempId: data.tempId,
        error: 'Failed to send message'
      });
    }
  });

  socket.on('user-typing', (data) => {
    socket.to(data.sessionId).emit('user-typing', data);
  });

  socket.on('user-stopped-typing', (data) => {
    socket.to(data.sessionId).emit('user-stopped-typing', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// ✅ Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    title: 'Server Error',
    message: 'Something went wrong!'
  });
});

// ✅ 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    message: 'The page you are looking for does not exist.'
  });
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`AdvanceTravels server running on port ${PORT}`);
  console.log(`Visit: http://localhost:${PORT}`);
});
