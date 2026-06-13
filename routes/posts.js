const router = require("express").Router();
const auth = require("../middleware/auth");
const { Post, Like, User, Follow } = require("../models");
const { v4: uuidv4 } = require("uuid");
const notifRouter = require("./notifications");

router.get("/feed", auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const suspended = await User.find({ isSuspended: true }).select("id");
    const suspendedIds = suspended.map(u => u.id);
    const follows = await Follow.find({ followerId: req.user.id });
    const followingIds = follows.map(f => f.followingId);
    const privateUsers = await User.find({ isPrivate: true, id: { $nin: [...followingIds, req.user.id] } }).select("id");
    const privateIds = privateUsers.map(u => u.id);
    const excludeIds = [...new Set([...suspendedIds, ...privateIds])];
    const posts = await Post.find({ mediaType: { $in: ["image", null] }, userId: { $nin: excludeIds } })
      .select("id userId username mediaUrl mediaFileName mediaType caption location music createdAt")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);
    res.json({ posts, hasMore: posts.length === limit, page });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/reels", auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const suspended = await User.find({ isSuspended: true }).select("id");
    const suspendedIds = suspended.map(u => u.id);
    const follows = await Follow.find({ followerId: req.user.id });
    const followingIds = follows.map(f => f.followingId);
    const privateUsers = await User.find({ isPrivate: true, id: { $nin: [...followingIds, req.user.id] } }).select("id");
    const excludeIds = [...new Set([...suspendedIds, ...privateUsers.map(u => u.id)])];
    const posts = await Post.find({ mediaType: "video", userId: { $nin: excludeIds } })
      .select("id userId username mediaUrl mediaType caption location createdAt")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);
    res.json({ posts, hasMore: posts.length === limit, page });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/explore", auth, async (req, res) => {
  try {
    const suspended = await User.find({ isSuspended: true }).select("id");
    const suspendedIds = suspended.map(u => u.id);
    const follows = await Follow.find({ followerId: req.user.id });
    const followingIds = follows.map(f => f.followingId);
    const privateUsers = await User.find({ isPrivate: true, id: { $nin: [...followingIds, req.user.id] } }).select("id");
    const excludeIds = [...new Set([...suspendedIds, ...privateUsers.map(u => u.id)])];
    const posts = await Post.find({ mediaType: { $in: ["image", "video"] }, userId: { $nin: excludeIds } })
      .select("id userId username mediaUrl mediaType caption createdAt")
      .sort({ createdAt: -1 })
      .limit(30);
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/saved", auth, async (req, res) => {
  try {
    const user = await User.findOne({ id: req.user.id });
    if (!user?.savedPosts?.length) return res.json([]);
    const posts = await Post.find({ id: { $in: user.savedPosts } });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/user/:username", auth, async (req, res) => {
  try {
    const posts = await Post.find({ username: req.params.username })
      .select("id userId username mediaUrl mediaFileName mediaType caption location music createdAt")
      .sort({ createdAt: -1 })
      .limit(30);
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/hashtag/:tag", auth, async (req, res) => {
  try {
    const tag = req.params.tag.replace("#", "").toLowerCase();
    if (!tag) return res.json([]);
    const posts = await Post.find({ caption: { $regex: "#" + tag, $options: "i" } })
      .select("id userId username mediaUrl mediaType caption createdAt")
      .sort({ createdAt: -1 })
      .limit(30);
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ FIXED: createdAt add kiya + Media model se store
router.post("/", auth, async (req, res) => {
  try {
    const { mediaBase64, mediaUrl: existingUrl, mediaType, caption, location, music } = req.body;
    let mediaUrl = existingUrl || "";
    let mediaFileName = "";

    if (mediaBase64) {
      const { Media } = require("../models");
      const mediaId = uuidv4();
      await Media.create({
        id: mediaId,
        userId: req.user.id,
        base64: mediaBase64,
        mediaType: mediaType || "image",
        createdAt: new Date().toISOString(),
      });
      mediaUrl = "muwandb://" + mediaId;
      mediaFileName = mediaId;
    }

    if (!mediaUrl) return res.status(400).json({ message: "Media required" });

    const post = await Post.create({
      id: uuidv4(),
      userId: req.user.id,
      username: req.user.username,
      mediaUrl,
      mediaFileName,
      mediaType: mediaType || "image",
      caption: caption?.slice(0, 2200) || "",
      music: music || null,
      location: location?.slice(0, 100) || "",
      createdAt: new Date().toISOString(), // ✅ FIX
    });

    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/:id/like", auth, async (req, res) => {
  try {
    const existing = await Like.findOne({ postId: req.params.id, userId: req.user.id });
    if (existing) {
      await existing.deleteOne();
      return res.json({ liked: false });
    }
    await Like.create({ id: uuidv4(), postId: req.params.id, userId: req.user.id });
    res.json({ liked: true });
    try {
      const post = await Post.findOne({ id: req.params.id });
      if (post && post.userId !== req.user.id) {
        await notifRouter.createNotif({
          userId: post.userId,
          fromUserId: req.user.id,
          fromUsername: req.user.username,
          fromAvatar: req.user.avatar || "",
          type: "like",
          postId: post.id,
          postThumb: post.mediaUrl || "",
          text: req.user.username + " liked your post",
        });
      }
    } catch (notifErr) { console.error("Like notif error:", notifErr.message); }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id/likes", auth, async (req, res) => {
  try {
    const count = await Like.countDocuments({ postId: req.params.id });
    const liked = cat > ~/luciagram-backend/server.js << 'EOF'
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

// ✅ FIXED: Media routes — MuwanDB Media model se fetch karo
app.get('/media/stats', async (req, res) => {
  try {
    const { Media } = require('./models');
    const count = await Media.countDocuments({});
    res.json({ totalFiles: count, storage: 'MuwanDB Media v1.0' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/media/:mediaId', async (req, res) => {
  try {
    const { Media } = require('./models');
    const media = await Media.findOne({ id: req.params.mediaId });
    if (!media) return res.status(404).json({ message: 'Media not found' });
    const prefix = media.mediaType === 'video'
      ? 'data:video/mp4;base64,'
      : 'data:image/jpeg;base64,';
    res.json({ url: prefix + media.base64, mediaType: media.mediaType });
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

app.post('/packet', (req, res) => {
  const packet = req.body;
  if (!packet.from || !packet.to || !packet.type) {
    return res.status(400).json({ error: 'Invalid packet' });
  }
  console.log(`[Muwan] ${packet.from} → ${packet.to} [${packet.type}]`);
  res.json({ received: true, packetId: packet.id, timestamp: Date.now() });
});
EOF(await Like.findOne({ postId: req.params.id, userId: req.user.id }));
    res.json({ count, liked });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/:id/save", auth, async (req, res) => {
  try {
    const user = await User.findOne({ id: req.user.id });
    if (!user) return res.status(404).json({ message: "User not found" });
    const saved = user.savedPosts || [];
    const idx = saved.indexOf(req.params.id);
    if (idx === -1) saved.push(req.params.id);
    else saved.splice(idx, 1);
    user.savedPosts = saved;
    await user.save();
    res.json({ saved: idx === -1 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const post = await Post.findOne({ id: req.params.id });
    if (!post) return res.status(404).json({ message: "Not found" });
    if (post.userId !== req.user.id) return res.status(403).json({ message: "Forbidden" });
    if (post.mediaFileName) {
      try {
        const { Media } = require("../models");
        await Media.deleteOne({ id: post.mediaFileName });
      } catch (e) { console.error("Media delete error:", e.message); }
    }
    await post.deleteOne();
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/bulk-meta", auth, async (req, res) => {
  try {
    const { postIds } = req.body;
    if (!Array.isArray(postIds) || postIds.length === 0) return res.json({});
    const [likes, liked, comments] = await Promise.all([
      Like.aggregate([
        { $match: { postId: { $in: postIds } } },
        { $group: { _id: "$postId", count: { $sum: 1 } } }
      ]),
      Like.find({ postId: { $in: postIds }, userId: req.user.id }),
      require("../models").Comment.aggregate([
        { $match: { postId: { $in: postIds } } },
        { $group: { _id: "$postId", count: { $sum: 1 } } }
      ])
    ]);
    const result = {};
    postIds.forEach(id => {
      result[id] = {
        likes: likes.find(l => l._id === id)?.count || 0,
        liked: cat > ~/luciagram-backend/server.js << 'EOF'
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

// ✅ FIXED: Media routes — MuwanDB Media model se fetch karo
app.get('/media/stats', async (req, res) => {
  try {
    const { Media } = require('./models');
    const count = await Media.countDocuments({});
    res.json({ totalFiles: count, storage: 'MuwanDB Media v1.0' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/media/:mediaId', async (req, res) => {
  try {
    const { Media } = require('./models');
    const media = await Media.findOne({ id: req.params.mediaId });
    if (!media) return res.status(404).json({ message: 'Media not found' });
    const prefix = media.mediaType === 'video'
      ? 'data:video/mp4;base64,'
      : 'data:image/jpeg;base64,';
    res.json({ url: prefix + media.base64, mediaType: media.mediaType });
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

app.post('/packet', (req, res) => {
  const packet = req.body;
  if (!packet.from || !packet.to || !packet.type) {
    return res.status(400).json({ error: 'Invalid packet' });
  }
  console.log(`[Muwan] ${packet.from} → ${packet.to} [${packet.type}]`);
  res.json({ received: true, packetId: packet.id, timestamp: Date.now() });
});
EOFliked.find(l => l.postId === id),
        comments: comments.find(c => c._id === id)?.count || 0,
      };
    });
    res.json(result);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
