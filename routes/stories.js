const router = require("express").Router();
const auth = require("../middleware/auth");
const { Story, StoryView, Follow, User } = require("../models");
const { v4: uuidv4 } = require("uuid");

// ✅ Expired story cleanup — SupaStore hata diya
setInterval(async () => {
  try {
    const expired = await Story.find({ expiresAt: { $lt: new Date().toISOString() } });
    for (const s of expired) {
      if (s.mediaFileName) {
        try {
          const { Media } = require("../models");
          await Media.deleteOne({ id: s.mediaFileName });
        } catch (e) { console.error("Media delete error:", e.message); }
      }
      await s.deleteOne();
    }
    if (expired.length > 0) console.log("🗑️ Deleted", expired.length, "expired stories");
  } catch (err) { console.error("Story cleanup error:", err); }
}, 60 * 60 * 1000);

router.get("/", auth, async (req, res) => {
  try {
    const follows = await Follow.find({ followerId: req.user.id });
    const followingIds = follows.map(f => f.followingId);
    followingIds.push(req.user.id);
    const allStories = await Story.find({}).sort({ createdAt: -1 });
    const now = new Date().toISOString();
    const stories = allStories.filter(s => s.expiresAt > now);
    res.json(stories);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ✅ FIXED: SupaStore → MuwanDB Media, createdAt add kiya
router.post("/", auth, async (req, res) => {
  try {
    const { mediaBase64, mediaType, music } = req.body;
    let mediaUrl = "";
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

    const story = await Story.create({
      id: uuidv4(),
      userId: req.user.id,
      username: req.user.username,
      mediaUrl,
      mediaFileName,
      mediaType: mediaType || "image",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      music: music || null,
      createdAt: new Date().toISOString(), // ✅ FIX
    });
    res.status(201).json(story);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/share", auth, async (req, res) => {
  try {
    const { mediaUrl, mediaType } = req.body;
    if (!mediaUrl) return res.status(400).json({ message: "mediaUrl required" });
    const story = await Story.create({
      id: uuidv4(),
      userId: req.user.id,
      username: req.user.username,
      mediaUrl,
      mediaType: mediaType || "video",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(), // ✅ FIX
    });
    res.status(201).json(story);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const story = await Story.findOne({ id: req.params.id });
    if (!story) return res.status(404).json({ message: "Not found" });
    if (story.userId !== req.user.id) return res.status(403).json({ message: "Forbidden" });
    if (story.mediaFileName) {
      try {
        const { Media } = require("../models");
        await Media.deleteOne({ id: story.mediaFileName });
      } catch (e) { console.error("Media delete error:", e.message); }
    }
    await story.deleteOne();
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/:id/view", auth, async (req, res) => {
  try {
    const existing = await StoryView.findOne({ storyId: req.params.id, userId: req.user.id });
    if (!existing) {
      await StoryView.create({
        id: uuidv4(),
        storyId: req.params.id,
        userId: req.user.id,
        username: req.user.username,
        createdAt: new Date().toISOString(),
      });
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:id/views", auth, async (req, res) => {
  try {
    const story = await Story.findOne({ id: req.params.id });
    if (!story) return res.status(404).json({ message: "Not found" });
    if (story.userId !== req.user.id) return res.status(403).json({ message: "Forbidden" });
    const views = await StoryView.find({ storyId: req.params.id }).sort({ createdAt: -1 });
    res.json({ count: views.length, viewers: views });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/user/:username", auth, async (req, res) => {
  try {
    const now = new Date().toISOString();
    const storyUser = await User.findOne({ username: req.params.username });
    if (!storyUser) return res.json([]);
    if (storyUser.isPrivate && storyUser.id !== req.user.id) {
      const isFollowing = await Follow.findOne({ followerId: req.user.id, followingId: storyUser.id });
      if (!isFollowing) return res.json([]);
    }
    const stories = await Story.find({
      username: req.params.username,
      expiresAt: { $gt: now }
    }).sort({ createdAt: -1 });
    res.json(stories);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
