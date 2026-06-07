const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const httpServer = http.createServer(app);

const getAllowedOrigins = () => {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  }
  return ['https://luciagram.onrender.com', 'capacitor://localhost'];
};

const corsOptions = {
  origin: true,
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

const LuciagramUptimeBot = require('./uptimebot');
const bot = new LuciagramUptimeBot();
bot.start();

const { Server } = require('socket.io');
const io = new Server(httpServer, {
  cors: {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  upgradeTimeout: 30000,
});

io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);

  socket.on('join', (userId) => socket.join('user_' + userId));

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

  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected:', socket.id);
  });

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

app.get('/media/stats', async (req, res) => {
  try {
    const stats = await LuciaStore.stats();
    res.json({ ...stats, storage: 'LuciaStore v1.0' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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

app.get('/status', (req, res) => {
  res.json({
    app: 'Luciagram',
    version: '1.0.0',
    allowedOrigins: getAllowedOrigins(),
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
  console.log('🌐 Allowed origins:', getAllowedOrigins());
});

// Muwan Network packet endpoint
app.post('/packet', (req, res) => {
  const packet = req.body;
  
  if (!packet.from || !packet.to || !packet.type) {
    return res.status(400).json({ error: 'Invalid packet' });
  }

  console.log(`[Muwan] ${packet.from} → ${packet.to} [${packet.type}]`);

  res.json({
    received: true,
    packetId: packet.id,
    timestamp: Date.now()
  });
});
