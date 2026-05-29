const router = require("express").Router();
const auth = require("../middleware/auth");
const { Story, StoryView, Follow, User } = require("../models");
const SupaStore = require("../supastore");
const { v4: uuidv4 } = require("uuid");

setInterval(async () => {
  try {
    const expired = await Story.find({ expiresAt: { $lt: new Date() } });
    for (const s of expired) {
      if (s.mediaFileName) await SupaStore.delete(s.mediaFileName);
      await s.deleteOne();
    }
    if (expired.length > 0) console.log("🗑️ Deleted", expired.length, "expired stories");
  } catch (err) { console.error("Story cleanup error:", err); }
}, 60 * 60 * 1000);

router.get("/", auth, async (req, res) => {
  try {
    // Get list of userIds the current user follows
    const follows = await Follow.find({ followerId: req.user.id });
    const followingIds = follows.map(f => f.followingId);
    // Include own stories too
    followingIds.push(req.user.id);

    const stories = await Story.find({
      expiresAt: { $gt: new Date() },
      userId: { $in: followingIds }
    })
      .select("id userId username mediaUrl mediaType music caption expiresAt createdAt")
      .sort({ createdAt: -1 })
      ;
    res.json(stories);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/", auth, async (req, res) => {
  try {
    const { mediaBase64, mediaType, music } = req.body;
    let mediaUrl = "";
    let mediaFileName = "";
    if (mediaBase64) {
      const result = await SupaStore.upload(mediaBase64, mediaType || "image", req.user.id);
      mediaUrl = result.url;
      mediaFileName = result.fileName;
    }
    const story = await Story.create({
      id: uuidv4(),
      userId: req.user.id,
      username: req.user.username,
      mediaUrl,
      mediaFileName,
      mediaType: mediaType || "image",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      music: music || null,
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
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    res.status(201).json(story);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const story = await Story.findOne({ id: req.params.id });
    if (!story) return res.status(404).json({ message: "Not found" });
    if (story.userId !== req.user.id) return res.status(403).json({ message: "Forbidden" });
    if (story.mediaFileName) await SupaStore.delete(story.mediaFileName);
    await story.deleteOne();
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Record story view
router.post("/:id/view", auth, async (req, res) => {
  try {
    res.json({ ok: true }); // respond first
    const existing = await StoryView.findOne({ storyId: req.params.id, userId: req.user.id });
    if (!existing) {
      await StoryView.create({
        storyId: req.params.id,
        userId: req.user.id,
        username: req.user.username,
      });
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get story views (only story owner can see)
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
    const now = new Date();
    const storyUser = await User.findOne({ username: req.params.username });
    if (!storyUser) return res.json([]);

    // If private, only owner or followers can see stories
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
