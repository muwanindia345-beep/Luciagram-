const router = require("express").Router();
const auth = require("../middleware/auth");
const { Posts, Likes } = require("../models");
const { v4: uuidv4 } = require("uuid");
router.get("/feed", auth, (req, res) => { res.json(Posts().find().reverse()); });
router.post("/", auth, (req, res) => { const { mediaUrl, mediaType, caption, location } = req.body; const post = Posts().insert({ id: uuidv4(), userId: req.user.id, mediaUrl, mediaType: mediaType||"image", caption, location, createdAt: new Date() }); res.status(201).json(post); });
router.post("/:id/like", auth, (req, res) => { const likes = Likes(); const existing = likes.findOne({ postId: req.params.id, userId: req.user.id }); if (existing) { likes.remove(existing); return res.json({ message: "Unliked" }); } likes.insert({ postId: req.params.id, userId: req.user.id }); res.json({ message: "Liked" }); });
module.exports = router;
