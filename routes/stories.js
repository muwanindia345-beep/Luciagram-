const router = require("express").Router();
const auth = require("../middleware/auth");
const { Story } = require("../models");
const { LuciaStore } = require("../luciastore");
const { v4: uuidv4 } = require("uuid");

setInterval(async () => {
  try {
    const expired = await Story.find({ expiresAt: { $lt: new Date() } });
    for (const s of expired) {
      if (s.mediaId) await LuciaStore.delete(s.mediaId);
      await s.deleteOne();
    }
    if (expired.length > 0) console.log("🗑️ Deleted", expired.length, "expired stories");
  } catch (err) { console.error("Story cleanup error:", err); }
}, 60 * 60 * 1000);

router.get("/", auth, async (req, res) => {
  try {
    const stories = await Story.find({ expiresAt: { $gt: new Date() } })
      .select("id userId username mediaId mediaType expiresAt createdAt")
      .sort({ createdAt: -1 })
      .lean();
    res.json(stories);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/", auth, async (req, res) => {
  try {
    const { mediaBase64, mediaType } = req.body;
    let mediaId = null;
    if (mediaBase64) {
      const base64Data = mediaBase64.includes(",") ? mediaBase64.split(",")[1] : mediaBase64;
      mediaId = await LuciaStore.store(base64Data, mediaType || "image", req.user.id);
    }
    const story = await Story.create({
      id: uuidv4(),
      userId: req.user.id,
      username: req.user.username,
      mediaId,
      mediaType: mediaType || "image",
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
    if (story.mediaId) await LuciaStore.delete(story.mediaId);
    await story.deleteOne();
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
