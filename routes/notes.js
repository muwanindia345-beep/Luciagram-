const router = require("express").Router();
const auth = require("../middleware/auth");
const { Note } = require("../models");
const { v4: uuidv4 } = require("uuid");

// GET all active notes (visible to everyone)
router.get("/", auth, async (req, res) => {
  try {
    await Note.deleteMany({ expiresAt: { $lt: new Date() } });
    const notes = await Note.find().sort({ createdAt: -1 });
    res.json(notes);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST create/update own note
router.post("/", auth, async (req, res) => {
  try {
    const { text } = req.body;
    await Note.deleteMany({ userId: req.user.id });
    if (!text || !text.trim()) return res.json({ deleted: true });
    const note = await Note.create({
      id: uuidv4(),
      userId: req.user.id,
      username: req.user.username,
      avatar: req.user.avatar || "",
      text: text.trim(),
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
