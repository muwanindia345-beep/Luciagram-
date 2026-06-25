const router = require("express").Router();
const { Post, Story, User, Notification, Report } = require("../models");
const { v4: uuidv4 } = require("uuid");

// FIX: extracted admin auth check — apply to ALL routes including cleanup/stats
function adminAuth(req, res, next) {
  if (req.headers["x-admin-key"] !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

// FIX: was completely unauthenticated before
router.get("/cleanup", adminAuth, async (req, res) => {
  try {
    const allPosts = await Post.find();
    let cleaned = 0, spaceSaved = 0;
    for (const post of allPosts) {
      if (post.mediaUrl && post.mediaUrl.startsWith("data:")) {
        spaceSaved += post.mediaUrl.length;
        await Post.updateOne({ _id: post._id }, { $set: { mediaUrl: "" } });
        cleaned++;
      }
    }
    const allStories = await Story.find();
    let storiesCleaned = 0;
    for (const story of allStories) {
      if (story.mediaUrl && story.mediaUrl.startsWith("data:")) {
        await Story.updateOne({ _id: story._id }, { $set: { mediaUrl: "" } });
        storiesCleaned++;
      }
    }
    res.json({ message: "Cleanup complete, postsCleaned: cleaned, storiesCleaned, spaceSavedMB: (spaceSaved / 1024 / 1024).toFixed(2) + " MB" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// FIX: was unauthenticated before
router.get("/stats", adminAuth, async (req, res) => {
  try {
    const totalPosts = await Post.countDocuments();
    const totalStories = await Story.countDocuments();
    const base64Posts = await Post.countDocuments({ mediaUrl: /^data:/ });
    const supabasePosts = await Post.countDocuments({ mediaFileName: { $exists: true, $ne: "" } });
    res.json({ totalPosts, totalStories, base64Posts, supabasePosts });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// FIX: was unauthenticated + was duplicated — kept only once with auth
router.get("/cleanup-luciastore", adminAuth, async (req, res) => {
  try {
    const mongoose = require("mongoose");
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const names = collections.map(c => c.name);
    let dropped = [];
    if (names.includes("mediachunks")) { await db.collection("mediachunks").drop(); dropped.push("mediachunks"); }
    if (names.includes("mediametas")) { await db.collection("mediametas").drop(); dropped.push("mediametas"); }
    res.json({ message: "LuciaStore cleaned, droppedCollections: dropped, note: "This freed the most MongoDB space });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/suspend/:username", adminAuth, async (req, res) => {
  try {
    const { reason, suspendedBy } = req.body;
    const user = await User.findOneAndUpdate(
      { username: req.params.username },
      { isSuspended: true, suspendedAt: new Date(), suspendReason: reason || "Policy violation", suspendedBy: suspendedBy || "admin" },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    if (global.io) global.io.to("user_" + user.id).emit("account_suspended", { reason: user.suspendReason });
    res.json({ message: "✅ @" + user.username + " suspended", reason: user.suspendReason });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/unsuspend/:username", adminAuth, async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { username: req.params.username },
      { isSuspended: false, suspendedAt: null, suspendReason: null },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    if (global.io) global.io.to("user_" + user.id).emit("account_unsuspended", {});
    res.json({ message: "✅ @" + user.username + " unsuspended" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/warn/:username", adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findOneAndUpdate(
      { username: req.params.username },
      { $push: { warnings: { reason: reason || "Suspicious activity", issuedBy: "admin", issuedAt: new Date() } } },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    await Notification.create({ id: uuidv4(), userId: user.id, fromUserId: "system", fromUsername: "Luciagram", type: "follow", text: "⚠️ Warning: " + (reason || "Suspicious activity detected on your account."), isRead: false });
    if (global.io) global.io.to("user_" + user.id).emit("new_notification", { type: "warning", text: "⚠️ " + reason });
    res.json({ message: "⚠️ Warning sent to @" + user.username, totalWarnings: user.warnings.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/delete/:username", adminAuth, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ message: "User not found" });
    const SupaStore = require("../supastore");
    const { Post, Story } = require("../models");
    const userPosts = await Post.find({ userId: user.id });
    for (const p of userPosts) { if (p.mediaFileName) await SupaStore.delete(p.mediaFileName); }
    await Post.deleteMany({ userId: user.id });
    const userStories = await Story.find({ userId: user.id });
    for (const s of userStories) { if (s.mediaFileName) await SupaStore.delete(s.mediaFileName); }
    await Story.deleteMany({ userId: user.id });
    const { Message, Notification, Report, Follow } = require("../models");
    await Message.deleteMany({ $or: [{ senderId: user.id }, { receiverId: user.id }] });
    await Notification.deleteMany({ $or: [{ userId: user.id }, { fromUserId: user.id }] });
    await Report.deleteMany({ $or: [{ reporterId: user.id }, { targetUserId: user.id }] });
    await Follow.deleteMany({ $or: [{ followerId: user.id }, { followingId: user.id }] });
    await User.deleteOne({ id: user.id });
    res.json({ message: "🗑️ @" + req.params.username + " permanently deleted with all content" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/check/:username", adminAuth, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    const { Report } = require("../models");
    const reportCount = await Report.countDocuments({ targetUserId: user.id, status: "pending" });
    res.json({ username: user.username, isSuspended: user.isSuspended, suspendReason: user.suspendReason, warnings: user.warnings?.length || 0, pendingReports: reportCount });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/posts/:username", adminAuth, async (req, res) => {
  try {
    const result = await Post.deleteMany({ username: req.params.username });
    res.json({ message: "✅ Deleted " + result.deletedCount + " posts by @" + req.params.username });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/stories/:username", adminAuth, async (req, res) => {
  try {
    const result = await Story.deleteMany({ username: req.params.username });
    res.json({ message: "✅ Deleted " + result.deletedCount + " stories by @" + req.params.username });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/nuke/:username", adminAuth, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ message: "User not found" });
    const { Message, Follow } = require("../models");
    const [posts, stories, msgs, follows] = await Promise.all([
      Post.deleteMany({ userId: user.id }),
      Story.deleteMany({ userId: user.id }),
      Message.deleteMany({ $or: [{ senderId: user.id }, { receiverId: user.id }] }),
      Follow.deleteMany({ $or: [{ followerId: user.id }, { followingId: user.id }] }),
    ]);
    await User.updateOne({ id: user.id }, { isSuspended: true, suspendedAt: new Date(), suspendReason: "Content removed by admin", suspendedBy: "admin" });
    if (global.io) global.io.to("user_" + user.id).emit("account_suspended", { reason: "Your account has been suspended." });
    res.json({ message: "✅ Nuked @" + req.params.username, posts: posts.deletedCount, stories: stories.deletedCount, messages: msgs.deletedCount, follows: follows.deletedCount });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
