const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const httpServer = http.createServer(app);

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const LuciagramUptimeBot = require('./uptimebot');
const bot = new LuciagramUptimeBot();
bot.start();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');
const storyRoutes = require('./routes/stories');
const messageRoutes = require('./routes/messages');
const commentRoutes = require('./routes/comments');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/comments', commentRoutes);

// LuciaStore Media Server
const { LuciaStore } = require('./luciastore');

app.get('/media/:mediaId', async (req, res) => {
  try {
    const media = await LuciaStore.retrieve(req.params.mediaId);
    if (!media) return res.status(404).json({ message: 'Media not found' });
    
    // Send as data URL
    res.json({ 
      url: 'data:' + (media.mediaType === 'video' ? 'video/mp4' : 'image/jpeg') + ';base64,' + media.data,
      mediaType: media.mediaType
    });
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

// Smart Keep-Alive Bot
require('./keepalive');

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log('🚀 Luciagram server running on port ' + PORT);
});
