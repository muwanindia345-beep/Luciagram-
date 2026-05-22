const router = require("express").Router();
const auth = require("../middleware/auth");
const { Story } = require("../models");
const { v4: uuidv4 } = require("uuid");

// Auto delete expired stories every hour
setInterval(async () => {
  try {
    const result = await Story.deleteMany({ expiresAt: { $lt: new Date() } });
    if (result.deletedCount > 0) console.log("🗑️ Deleted " + result.deletedCount + " expired stories");
  } catch (err) { console.error("Story cleanup error:", err); }
}, 60 * 60 * 1000);

router.get("/", auth, async (req, res) => {
  try {
    const stories = await Story.find({ expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
    res.json(stories);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/", auth, async (req, res) => {
  try {
    const { mediaBase64, mediaType } = req.body;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const story = await Story.create({
      id: uuidv4(),
      userId: req.user.id,
      username: req.user.username,
      mediaUrl: mediaBase64 || "",
      mediaType: mediaType || "image",
      expiresAt,
    });
    res.status(201).json(story);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const story = await Story.findOne({ id: req.params.id });
    if (!story) return res.status(404).json({ message: "Not found" });
    if (story.userId !== req.user.id) return res.status(403).json({ message: "Forbidden" });
    await story.deleteOne();
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
