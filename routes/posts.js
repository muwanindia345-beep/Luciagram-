const router = require("express").Router();
const auth = require("../middleware/auth");
const { Post, Like } = require("../models");
const SupaStore = require("../supastore");
const { v4: uuidv4 } = require("uuid");
const notifRouter = require("./notifications");

router.get("/feed", auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    // Home feed = images only
    const posts = await Post.find({ mediaType: { $in: ["image", null] } })
      .select("id userId username mediaUrl mediaFileName mediaType caption location music createdAt")
      .limit(limit)
      .skip(skip)
      .lean();
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ posts, hasMore: posts.length === limit, page });
  } catch (err) {
    console.error("Feed error:", err);
    try {
      const posts = await Post.find({ mediaType: { $in: ["image", null] } })
        .select("id userId username mediaUrl mediaFileName mediaType caption location music createdAt")
        .limit(10)
        .lean();
      res.json({ posts, hasMore: false, page: 1 });
    } catch(err2) {
      res.status(500).json({ message: err2.message });
    }
  }
});

// Reels feed - videos only with pagination
router.get("/reels", auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const posts = await Post.find({ mediaType: "video" })
      .select("id userId username mediaUrl mediaType caption location createdAt")
      .limit(limit)
      .skip(skip)
      .lean();
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ posts, hasMore: posts.length === limit, page });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Reels feed - only video posts
router.get("/reels", auth, async (req, res) => {
  try {
    const posts = await Post.find({ mediaType: "video" })
      .select("id userId username mediaUrl mediaType caption location createdAt")
      .limit(30)
      .lean();
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(posts);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/user/:username", auth, async (req, res) => {
  try {
    const posts = await Post.find({ username: req.params.username })
      .select("id userId username mediaUrl mediaFileName mediaType caption location music createdAt")
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
    const { mediaBase64, mediaType, caption, location, music } = req.body;
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
      music: music || null,
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

// Save / unsave post
router.post("/:id/save", auth, async (req, res) => {
  try {
    const { User } = require("../models");
    const user = await User.findOne({ id: req.user.id });
    if (!user) return res.status(404).json({ message: "User not found" });
    const saved = user.savedPosts || [];
    const idx = saved.indexOf(req.params.id);
    if (idx === -1) {
      saved.push(req.params.id);
    } else {
      saved.splice(idx, 1);
    }
    user.savedPosts = saved;
    await user.save();
    res.json({ saved: idx === -1, savedPosts: saved });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get saved posts
router.get("/saved", auth, async (req, res) => {
  try {
    const { User } = require("../models");
    const user = await User.findOne({ id: req.user.id }).lean();
    if (!user?.savedPosts?.length) return res.json([]);
    const posts = await Post.find({ id: { $in: user.savedPosts } }).lean();
    res.json(posts);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
