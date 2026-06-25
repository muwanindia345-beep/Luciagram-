const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const httpServer = http.createServer(app);

const getAllowedOrigins = () => {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  }
  return ['https://luciagram-production-5bfe.up.railway.app', 'capacitor://localhost'];
};

// FIX: was `origin: true` (allows ALL origins) — now uses actual whitelist
const corsOptions = {
  origin: getAllowedOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(helmet());
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const { Server } = require('socket.io');
const io = new Server(httpServer, {
  cors: {
    // FIX: socket.io CORS also uses whitelist now
    origin: getAllowedOrigins(),
    credentials: true,
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  upgradeTimeout: 30000,
});

// FIX: Socket.io auth middleware — unauthenticated sockets are rejected
io.use((socket, next) => {
  const token = socket.handshake.auth?.token
    || socket.handshake.headers?.authorization?.split(' ')[1];
  if (!token) return next(new Error('Unauthorized'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = String(decoded.uid || decoded.id);
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id, '| user:', socket.userId);

  // Auto-join own room on connect
  socket.join('user_' + socket.userId);

  // FIX: only allow joining own room — prevents listening to other users' messages
  socket.on('join', (userId) => {
    if (String(userId) === socket.userId) socket.join('user_' + userId);
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

  socket.on('join_group', (groupId) => socket.join('group_' + groupId));

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

  socket.on('call:initiate', (data) => {
    if (!data?.receiverId || !data?.callerId) return;
    io.to('user_' + data.receiverId).emit('call:incoming', data);
  });
  socket.on('call:accept',  (data) => { io.to('user_' + data.callerId).emit('call:accepted', data); });
  socket.on('call:reject',  (data) => { io.to('user_' + data.callerId).emit('call:rejected'); });
  socket.on('call:end',     (data) => { io.to('user_' + data.receiverId).emit('call:ended'); });
  socket.on('call:offer',   (data) => { io.to('user_' + data.receiverId).emit('call:offer', data); });
  socket.on('call:answer',  (data) => { io.to('user_' + data.callerId).emit('call:answer', data); });
  socket.on('call:ice',     (data) => { io.to('user_' + data.receiverId).emit('call:ice', data); });

  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected:', socket.id);
  });
});

global.io = io;

app.use('/api/admin',         require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/settings',      require('./routes/settings'));
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/posts',         require('./routes/posts'));
app.use('/api/stories',       require('./routes/stories'));
app.use('/api/messages',      require('./routes/messages'));
app.use('/api/comments',      require('./routes/comments'));
app.use('/api/groups',        require('./routes/groups'));
app.use('/api/notes',         require('./routes/notes'));
app.use('/api/music',         require('./routes/music'));
app.use('/api/reports',       require('./routes/reports'));

app.get('/api/media/stats', async (req, res) => {
  try {
    const { Media } = require('./models');
    const count = await Media.countDocuments({});
    res.json({ totalFiles: count, storage: 'MuwanDB Media v1.0' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// FIX: sanitize mediaId to prevent SQL injection before passing to MuwanDB query
app.get('/api/media/:mediaId', async (req, res) => {
  try {
    const mediaId = String(req.params.mediaId).replace(/[^a-zA-Z0-9_\-]/g, '');
    if (!mediaId) return res.status(400).json({ message: 'Invalid media ID' });
    const axios = require('axios');
    const result = await axios.post(process.env.MUWAN_DB_URL + '/query', {
      query: `SELECT * FROM media WHERE id = '${mediaId}' LIMIT 1`,
      dbPassword: process.env.MUWAN_DB_PASSWORD
    }, {
      headers: {
        'x-api-key': process.env.MUWAN_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    const rows = result.data?.data;
    if (!rows || rows.length === 0) return res.status(404).json({ message: 'Media not found' });
    const media = rows[0];
    const prefix = (media.mediaType || media.media_type) === 'video' ? 'data:video/mp4;base64,' : 'data:image/jpeg;base64,';
    res.json({ url: prefix + (media.base64), mediaType: media.mediaType });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// FIX: removed bot.getReport() — bot was never defined, caused ReferenceError crash
app.get('/status', (req, res) => {
  res.json({ app: 'Luciagram', version: '1.0.0', allowedOrigins: getAllowedOrigins() });
});

app.get('/', (req, res) => {
  res.json({ message: '✨ Luciagram API is running!' });
});

app.post('/packet', (req, res) => {
  const packet = req.body;
  if (!packet.from || !packet.to || !packet.type) {
    return res.status(400).json({ error: 'Invalid packet' });
  }
  console.log(`[Muwan] ${packet.from} → ${packet.to} [${packet.type}]`);
  res.json({ received: true, packetId: packet.id, timestamp: Date.now() });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log('🚀 Luciagram server running on port ' + PORT);
  console.log('🌐 Allowed origins:', getAllowedOrigins());
});
