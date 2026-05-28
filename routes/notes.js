const router = require("express").Router();
const auth = require("../middleware/auth");
const { Note, Follow } = require("../models");
const { v4: uuidv4 } = require("uuid");

// GET notes - only from people you follow + your own
router.get("/", auth, async (req, res) => {
  try {
    await Note.deleteMany({ expiresAt: { $lt: new Date() } });
    
    // Get list of people you follow
    const following = await Follow.find({ followerId: req.user.id });
    const followingIds = following.map(f => f.followingId);
    
    // Include your own note too
    followingIds.push(req.user.id);
    
    const notes = await Note.find({ userId: { $in: followingIds } })
      .sort({ createdAt: -1 });
    res.json(notes);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST create/update own note
router.post("/", auth, async (req, res) => {
  try {
    const { text, avatar, music } = req.body;
    await Note.deleteMany({ userId: req.user.id });
    if (!text || !text.trim()) return res.json({ deleted: true });
    const note = await Note.create({
      id: uuidv4(),
      userId: req.user.id,
      username: req.user.username,
      avatar: avatar || req.user.avatar || "",
      text: text.trim(),
      music: music || null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    res.status(201).json(note);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE own note
router.delete("/", auth, async (req, res) => {
  try {
    await Note.deleteMany({ userId: req.user.id });
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
