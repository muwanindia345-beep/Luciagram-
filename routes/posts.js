const router = require("express").Router();
const auth = require("../middleware/auth");
const { Post, Like, User, Follow } = require("../models");
const SupaStore = require("../supastore");
const { v4: uuidv4 } = require("uuid");
const notifRouter = require("./notifications");

// ⚠️ IMPORTANT: Specific routes MUST come before /:id

// Home feed - images only with pagination
router.get("/feed", auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    // Get suspended user IDs to exclude
    const suspended = await User.find({ isSuspended: true }).select("id");
    const suspendedIds = suspended.map(u => u.id);
    // Get private accounts the user does NOT follow
    const follows = await Follow.find({ followerId: req.user.id });
    const followingIds = follows.map(f => f.followingId);
    const privateUsers = await User.find({ isPrivate: true, id: { $nin: [...followingIds, req.user.id] } }).select("id");
    const privateIds = privateUsers.map(u => u.id);
    const excludeIds = [...new Set([...suspendedIds, ...privateIds])];
    const posts = await Post.find({ mediaType: { $in: ["image", null] }, userId: { $nin: excludeIds } })
      .select("id userId username mediaUrl mediaFileName mediaType caption location music createdAt")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      ;
    res.json({ posts, hasMore: posts.length === limit, page });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Reels feed - videos only with pagination
router.get("/reels", auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const suspended = await User.find({ isSuspended: true }).select("id");
    const suspendedIds = suspended.map(u => u.id);
    const follows = await Follow.find({ followerId: req.user.id });
    const followingIds = follows.map(f => f.followingId);
    const privateUsers = await User.find({ isPrivate: true, id: { $nin: [...followingIds, req.user.id] } }).select("id");
    const excludeIds = [...new Set([...suspendedIds, ...privateUsers.map(u => u.id)])];
    const posts = await Post.find({ mediaType: "video", userId: { $nin: excludeIds } })
      .select("id userId username mediaUrl mediaType caption location createdAt")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      ;
    res.json({ posts, hasMore: posts.length === limit, page });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Explore - recent posts grid
router.get("/explore", auth, async (req, res) => {
  try {
    const suspended = await User.find({ isSuspended: true }).select("id");
    const suspendedIds = suspended.map(u => u.id);
    const follows = await Follow.find({ followerId: req.user.id });
    const followingIds = follows.map(f => f.followingId);
    const privateUsers = await User.find({ isPrivate: true, id: { $nin: [...followingIds, req.user.id] } }).select("id");
    const excludeIds = [...new Set([...suspendedIds, ...privateUsers.map(u => u.id)])];
    const posts = await Post.find({ mediaType: { $in: ["image", "video"] }, userId: { $nin: excludeIds } })
      .select("id userId username mediaUrl mediaType caption createdAt")
      .sort({ createdAt: -1 })
      .limit(30)
      ;
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Saved posts
router.get("/saved", auth, async (req, res) => {
  try {
    const { User } = require("../models");
    const user = await User.findOne({ id: req.user.id });
    if (!user?.savedPosts?.length) return res.json([]);
    const posts = await Post.find({ id: { $in: user.savedPosts } });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// User posts
router.get("/user/:username", auth, async (req, res) => {
  try {
    const posts = await Post.find({ username: req.params.username })
      .select("id userId username mediaUrl mediaFileName mediaType caption location music createdAt")
      .sort({ createdAt: -1 })
      .limit(30)
      ;
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Hashtag search
router.get("/hashtag/:tag", auth, async (req, res) => {
  try {
    const tag = req.params.tag.replace("#", "").toLowerCase();
    if (!tag) return res.json([]);
    const posts = await Post.find({
      caption: { $regex: "#" + tag, $options: "i" }
    })
      .select("id userId username mediaUrl mediaType caption createdAt")
      .sort({ createdAt: -1 })
      .limit(30)
      ;
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create post
router.post("/", auth, async (req, res) => {
  try {
    const { mediaBase64, mediaUrl: existingUrl, mediaType, caption, location, music } = req.body;
    let mediaUrl = existingUrl || "";
    let mediaFileName = "";

    if (mediaBase64) {
      const result = await SupaStore.upload(mediaBase64, mediaType || "image", req.user.id);
      mediaUrl = result.url;
      mediaFileName = result.fileName;
    }

    if (!mediaUrl) return res.status(400).json({ message: "Media required" });

    const post = await Post.create({
      id: uuidv4(),
      userId: req.user.id,
      username: req.user.username,
      mediaUrl,
      mediaFileName,
      mediaType: mediaType || "image",
      caption: caption?.slice(0, 2200) || "",
      music: music || null,
      location: location?.slice(0, 100) || "",
    });

    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Like / unlike post
router.post("/:id/like", auth, async (req, res) => {
  try {
    const existing = await Like.findOne({ postId: req.params.id, userId: req.user.id });
    if (existing) {
      await existing.deleteOne();
      return res.json({ liked: false });
    }
    await Like.create({ postId: req.params.id, userId: req.user.id });
    res.json({ liked: true });
    // Notification separately — like fail nahi hoga agar notif fail ho
    try {
      const post = await Post.findOne({ id: req.params.id });
      if (post && post.userId !== req.user.id) {
        await notifRouter.createNotif({
          userId: post.userId,
          fromUserId: req.user.id,
          fromUsername: req.user.username,
          fromAvatar: req.user.avatar || "",
          type: "like",
          postId: post.id,
          postThumb: post.mediaUrl || "",
          text: req.user.username + " liked your post",
        });
      }
    } catch (notifErr) { console.error("Like notif error:", notifErr.message); }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get likes
router.get("/:id/likes", auth, async (req, res) => {
  try {
    const count = await Like.countDocuments({ postId: req.params.id });
    const liked = !!(await Like.findOne({ postId: req.params.id, userId: req.user.id }));
    res.json({ count, liked });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
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
    res.json({ saved: idx === -1 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete post
router.delete("/:id", auth, async (req, res) => {
  try {
    const post = await Post.findOne({ id: req.params.id });
    if (!post) return res.status(404).json({ message: "Not found" });
    if (post.userId !== req.user.id) return res.status(403).json({ message: "Forbidden" });
    if (post.mediaFileName) await SupaStore.delete(post.mediaFileName);
    await post.deleteOne();
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Bulk get likes and comment counts for multiple posts
router.post("/bulk-meta", auth, async (req, res) => {
  try {
    const { postIds } = req.body;
    if (!Array.isArray(postIds) || postIds.length === 0) return res.json({});
    const [likes, liked, comments] = await Promise.all([
      Like.aggregate([
        { $match: { postId: { $in: postIds } } },
        { $group: { _id: "$postId", count: { $sum: 1 } } }
      ]),
      Like.find({ postId: { $in: postIds }, userId: req.user.id }),
      require("../models").Comment.aggregate([
        { $match: { postId: { $in: postIds } } },
        { $group: { _id: "$postId", count: { $sum: 1 } } }
      ])
    ]);
    const result = {};
    postIds.forEach(id => {
      const likeData = likes.find(l => l._id === id);
      const commentData = comments.find(c => c._id === id);
      result[id] = {
        likes: likeData?.count || 0,
        liked: !!liked.find(l => l.postId === id),
        comments: commentData?.count || 0,
      };
    });
    res.json(result);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
