const router = require("express").Router();
const auth = require("../middleware/auth");
const { Posts, Likes } = require("../models");
const { v4: uuidv4 } = require("uuid");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

router.get("/feed", auth, (req, res) => {
  const posts = Posts().find();
  res.json(posts.reverse());
});

router.post("/", auth, async (req, res) => {
  try {
    const { mediaBase64, mediaType, caption, location } = req.body;
    let mediaUrl = "";
    if (mediaBase64) {
      const result = await cloudinary.uploader.upload(mediaBase64, {
        folder: "luciagram",
        resource_type: "auto",
      });
      mediaUrl = result.secure_url;
    }
    const post = Posts().insert({
      id: uuidv4(),
      userId: req.user.id,
      username: req.user.username,
      mediaUrl,
      mediaType: mediaType || "image",
      caption,
      location,
      createdAt: new Date(),
    });
    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", auth, (req, res) => {
  const posts = Posts();
  const post = posts.findOne({ id: req.params.id });
  if (post.userId !== req.user.id) return res.status(403).json({ message: "Forbidden" });
  posts.remove(post);
  res.json({ message: "Deleted" });
});

router.post("/:id/like", auth, (req, res) => {
  const likes = Likes();
  const existing = likes.findOne({ postId: req.params.id, userId: req.user.id });
  if (existing) { likes.remove(existing); return res.json({ liked: false }); }
  likes.insert({ postId: req.params.id, userId: req.user.id });
  res.json({ liked: true });
});

router.get("/:id/likes", auth, (req, res) => {
  const count = Likes().find({ postId: req.params.id }).length;
  const liked = cd ~/luciagram-backendLikes().findOne({ postId: req.params.id, userId: req.user.id });  res.json({ count, liked });
});

module.exports = router;
