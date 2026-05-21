const router = require("express").Router();
const auth = require("../middleware/auth");
const { Post, Like } = require("../models");
const { v4: uuidv4 } = require("uuid");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

router.get("/feed", auth, async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/", auth, async (req, res) => {
  try {
    const { mediaBase64, mediaType, caption, location } = req.body;
    let mediaUrl = "";
    if (mediaBase64) {
      const result = await cloudinary.uploader.upload(mediaBase64, { folder: "luciagram", resource_type: "auto" });
      mediaUrl = result.secure_url;
    }
    const post = await Post.create({ id: uuidv4(), userId: req.user.id, username: req.user.username, mediaUrl, mediaType: mediaType || "image", caption, location });
    res.status(201).json(post);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/:id/like", auth, async (req, res) => {
  try {
    const existing = await Like.findOne({ postId: req.params.id, userId: req.user.id });
    if (existing) { await existing.deleteOne(); return res.json({ liked: false }); }
    await Like.create({ postId: req.params.id, userId: req.user.id });
    res.json({ liked: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:id/likes", auth, async (req, res) => {
  try {
    const count = await Like.countDocuments({ postId: req.params.id });
    const liked = !!(await Like.findOne({ postId: req.params.id, userId: req.user.id }));
    res.json({ count, liked });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
