const express = require('express');

const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const httpServer = http.createServer(app);

app.use(helmet());
app.use(cors({
  origin: function(origin, callback) {
    const allowed = [
      "https://luciagram.onrender.com",
      "capacitor://localhost",
      "http://localhost",
      "http://localhost:3000",
    ];
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET","POST","PUT","DELETE","PATCH"],
  allowedHeaders: ["Content-Type","Authorization"]
}));
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const LuciagramUptimeBot = require('./uptimebot');
const bot = new LuciagramUptimeBot();
bot.start();

const { Server } = require('socket.io');
const io = new Server(httpServer, {
  cors: {
    origin: [
      "https://luciagram.onrender.com",
      "capacitor://localhost",
      "http://localhost",
      "http://localhost:3000",
    ],
    credentials: true,
    methods: ['GET','POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  upgradeTimeout: 30000,
});

io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);

  socket.on('join', (userId) => {
    socket.join('user_' + userId);
  });

  socket.on('send_message', (data) => {
    if (!data?.receiverId) return;
    io.to('user_' + data.receiverId).emit('new_message', data);
  });

  socket.on('typing', (data) => {
    if (!data?.receiverId) return;
    io.to('user_' + data.receiverId).emit('typing', { senderId: data.senderId });
  });

  socket.on('stop_typing', (data) => {
    io.to('user_' + data.receiverId).emit('stop_typing', { senderId: data.senderId });
  });

  socket.on('dm_reaction', (data) => {
    socket.to('user_' + data.receiverId).emit('dm_reaction', data);
  });

  socket.on('dm_unsend', (data) => {
    socket.to('user_' + data.receiverId).emit('dm_unsend', data);
  });

  socket.on('join_group', (groupId) => {
    socket.join('group_' + groupId);
  });

  socket.on('group_typing', (data) => {
    socket.to('group_' + data.groupId).emit('group_typing', data);
  });

  socket.on('group_stop_typing', (data) => {
    socket.to('group_' + data.groupId).emit('group_stop_typing', data);
  });

  socket.on('group_message', (data) => {
    socket.to('group_' + data.groupId).emit('group_message', data);
  });

  socket.on('group_reaction', (data) => {
    socket.to('group_' + data.groupId).emit('group_reaction', data);
  });

  socket.on('group_unsend', (data) => {
    socket.to('group_' + data.groupId).emit('group_unsend', data);
  });

  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected:', socket.id);
  });

  // ===== CALL SIGNALING =====
  socket.on('call:initiate', (data) => {
    if (!data?.receiverId || !data?.callerId) return;
    io.to('user_' + data.receiverId).emit('call:incoming', data);
  });
  socket.on('call:accept', (data) => {
    io.to('user_' + data.callerId).emit('call:accepted', data);
  });
  socket.on('call:reject', (data) => {
    io.to('user_' + data.callerId).emit('call:rejected');
  });
  socket.on('call:end', (data) => {
    io.to('user_' + data.receiverId).emit('call:ended');
  });
  socket.on('call:offer', (data) => {
    io.to('user_' + data.receiverId).emit('call:offer', data);
  });
  socket.on('call:answer', (data) => {
    io.to('user_' + data.callerId).emit('call:answer', data);
  });
  socket.on('call:ice', (data) => {
    io.to('user_' + data.receiverId).emit('call:ice', data);
  });
});

global.io = io;

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');
const storyRoutes = require('./routes/stories');
const messageRoutes = require('./routes/messages');
const commentRoutes = require('./routes/comments');
const noteRoutes = require('./routes/notes');

app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/auth', authRoutes);
app.use('/api/settings', require('./routes/settings'));
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/groups', require('./routes/groups'));
app.use('/api/notes', noteRoutes);
app.use('/api/music', require('./routes/music'));
app.use('/api/reports', require('./routes/reports'));

app.get('/media/:mediaId', async (req, res) => {
  try {
    const media = await LuciaStore.retrieve(req.params.mediaId);
    if (!media) return res.status(404).json({ message: 'Media not found' });
    const prefix = media.mediaType === 'video' ? 'data:video/mp4;base64,' : 'data:image/jpeg;base64,';
    res.json({ url: prefix + media.data, mediaType: media.mediaType });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/media/stats', async (req, res) => {
  const stats = await LuciaStore.stats();
  res.json({ ...stats, storage: 'LuciaStore v1.0' });
});

app.get('/status', (req, res) => {
  res.json({
    app: 'Luciagram',
    version: '1.0.0',
    ...bot.getReport(),
  });
});

app.get('/', (req, res) => {
  res.json({ message: '✨ Luciagram API is running!' });
});

require('./keepalive');

const SuspendBot = require('./suspendbot');
const suspendBot = new SuspendBot();
suspendBot.start();

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log('🚀 Luciagram server running on port ' + PORT);
});
