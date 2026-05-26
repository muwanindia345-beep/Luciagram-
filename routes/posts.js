const router = require("express").Router();
const auth = require("../middleware/auth");
const { Post, Like } = require("../models");
const SupaStore = require("../supastore");
const { v4: uuidv4 } = require("uuid");
const notifRouter = require("./notifications");

router.get("/feed", auth, async (req, res) => {
  try {
    const posts = await Post.find()
      .select("id userId username mediaUrl mediaFileName mediaType caption location createdAt")
      .hint({ createdAt: -1 })
      .limit(20)
      .lean();
    
    // Sort in memory (avoid MongoDB sort memory limit)
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(posts);
  } catch (err) {
    console.error("Feed error:", err);
    // Fallback without sort
    try {
      const posts = await Post.find()
        .select("id userId username mediaUrl mediaFileName mediaType caption location createdAt")
        .limit(20)
        .lean();
      res.json(posts);
    } catch(err2) {
      res.status(500).json({ message: err2.message });
    }
  }
});

router.get("/user/:username", auth, async (req, res) => {
  try {
    const posts = await Post.find({ username: req.params.username })
      .select("id userId username mediaUrl mediaFileName mediaType caption location createdAt")
      .limit(30)
      .lean();
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const { mediaBase64, mediaType, caption, location } = req.body;
    let mediaUrl = "";
    let mediaFileName = "";

    if (mediaBase64) {
      const result = await SupaStore.upload(mediaBase64, mediaType || "image", req.user.id);
      mediaUrl = result.url;
      mediaFileName = result.fileName;
    }

    const post = await Post.create({
      id: uuidv4(),
      userId: req.user.id,
      username: req.user.username,
      mediaUrl,
      mediaFileName,
      mediaType: mediaType || "image",
      caption,
      location,
    });

    res.status(201).json(post);
  } catch (err) {
    console.error("Post create error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const post = await Post.findOne({ id: req.params.id });
    if (!post) return res.status(404).json({ message: "Not found" });
    if (post.userId !== req.user.id) return res.status(403).json({ message: "Forbidden" });
    if (post.mediaFileName) await SupaStore.delete(post.mediaFileName);
    await post.deleteOne();
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/:id/like", auth, async (req, res) => {
  try {
    const existing = await Like.findOne({ postId: req.params.id, userId: req.user.id });
    if (existing) { await existing.deleteOne(); return res.json({ liked: false }); }
    await Like.create({ postId: req.params.id, userId: req.user.id });
    // Notify post owner
    const { Post } = require("../models");
    const post = await Post.findOne({ id: req.params.id }).lean();
    if (post) {
      await notifRouter.createNotif({
        userId: post.userId,
        fromUserId: req.user.id,
        fromUsername: req.user.username,
        type: "like",
        postId: post.id,
        postThumb: post.mediaUrl,
        text: req.user.username + " liked your post",
      });
    }
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

// Explore — recent posts grid
router.get("/explore", auth, async (req, res) => {
  try {
    const posts = await Post.find({ mediaType: { $in: ["image", "video"] } })
      .select("id userId username mediaUrl mediaType caption createdAt")
      .limit(30)
      .lean();
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(posts);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Hashtag search
router.get("/hashtag/:tag", auth, async (req, res) => {
  try {
    const tag = req.params.tag.replace("#", "").toLowerCase();
    const posts = await Post.find({
      caption: { $regex: "#" + tag, $options: "i" }
    })
      .select("id userId username mediaUrl mediaType caption createdAt")
      .limit(30)
      .lean();
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(posts);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
