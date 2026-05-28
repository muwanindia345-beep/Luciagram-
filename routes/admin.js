const router = require("express").Router();
const { Post, Story, User, Notification, Report } = require("../models");
const { v4: uuidv4 } = require("uuid");

// Admin cleanup - removes old base64 posts to free space
router.get("/cleanup", async (req, res) => {
  try {
    // Find posts with base64 data (starts with data:)
    const allPosts = await Post.find().lean();
    let cleaned = 0;
    let spaceSaved = 0;

    for (const post of allPosts) {
      if (post.mediaUrl && post.mediaUrl.startsWith("data:")) {
        spaceSaved += post.mediaUrl.length;
        await Post.updateOne({ _id: post._id }, { $set: { mediaUrl: "" } });
        cleaned++;
      }
    }

    // Clean stories too
    const allStories = await Story.find().lean();
    let storiesCleaned = 0;
    for (const story of allStories) {
      if (story.mediaUrl && story.mediaUrl.startsWith("data:")) {
        await Story.updateOne({ _id: story._id }, { $set: { mediaUrl: "" } });
        storiesCleaned++;
      }
    }

    res.json({
      message: "Cleanup complete!",
      postsCleaned: cleaned,
      storiesCleaned,
      spaceSavedMB: (spaceSaved / 1024 / 1024).toFixed(2) + " MB"
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const totalPosts = await Post.countDocuments();
    const totalStories = await Story.countDocuments();
    const base64Posts = await Post.countDocuments({ mediaUrl: /^data:/ });
    const supabasePosts = await Post.countDocuments({ mediaFileName: { $exists: true, $ne: "" } });
    res.json({ totalPosts, totalStories, base64Posts, supabasePosts });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Clean LuciaStore chunks (old storage system)
router.get("/cleanup-luciastore", async (req, res) => {
  try {
    const mongoose = require("mongoose");
    const db = mongoose.connection.db;
    
    // Drop old LuciaStore collections
    const collections = await db.listCollections().toArray();
    const names = collections.map(c => c.name);
    
    let dropped = [];
    if (names.includes("mediachunks")) {
      await db.collection("mediachunks").drop();
      dropped.push("mediachunks");
    }
    if (names.includes("mediametas")) {
      await db.collection("mediametas").drop();
      dropped.push("mediametas");
    }
    
    res.json({ 
      message: "LuciaStore cleaned!", 
      droppedCollections: dropped,
      note: "This freed the most MongoDB space!"
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Clean LuciaStore chunks (old storage system)
router.get("/cleanup-luciastore", async (req, res) => {
  try {
    const mongoose = require("mongoose");
    const db = mongoose.connection.db;
    
    // Drop old LuciaStore collections
    const collections = await db.listCollections().toArray();
    const names = collections.map(c => c.name);
    
    let dropped = [];
    if (names.includes("mediachunks")) {
      await db.collection("mediachunks").drop();
      dropped.push("mediachunks");
    }
    if (names.includes("mediametas")) {
      await db.collection("mediametas").drop();
      dropped.push("mediametas");
    }
    
    res.json({ 
      message: "LuciaStore cleaned!", 
      droppedCollections: dropped,
      note: "This freed the most MongoDB space!"
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});



// ── TERMINAL COMMANDS (use x-admin-key header, no JWT needed) ──────────────

// SUSPEND account
// curl -X POST https://your-api/api/admin/suspend/USERNAME -H "x-admin-key: YOUR_KEY" -H "Content-Type: application/json" -d '{"reason":"spam"}'
router.post("/suspend/:username", async (req, res) => {
  try {
    if (req.headers["x-admin-key"] !== process.env.ADMIN_SECRET) return res.status(403).json({ message: "Forbidden" });
    const { reason, suspendedBy } = req.body;
    const user = await User.findOneAndUpdate(
      { username: req.params.username },
      { isSuspended: true, suspendedAt: new Date(), suspendReason: reason || "Policy violation", suspendedBy: suspendedBy || "admin" },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    // Notify user
    if (global.io) global.io.to("user_" + user.id).emit("account_suspended", { reason: user.suspendReason });
    res.json({ message: "✅ @" + user.username + " suspended", reason: user.suspendReason });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// UNSUSPEND account
// curl -X POST https://your-api/api/admin/unsuspend/USERNAME -H "x-admin-key: YOUR_KEY"
router.post("/unsuspend/:username", async (req, res) => {
  try {
    if (req.headers["x-admin-key"] !== process.env.ADMIN_SECRET) return res.status(403).json({ message: "Forbidden" });
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

// WARN account (no suspend, just warning)
// curl -X POST https://your-api/api/admin/warn/USERNAME -H "x-admin-key: YOUR_KEY" -d '{"reason":"..."}'
router.post("/warn/:username", async (req, res) => {
  try {
    if (req.headers["x-admin-key"] !== process.env.ADMIN_SECRET) return res.status(403).json({ message: "Forbidden" });
    const { reason } = req.body;
    const user = await User.findOneAndUpdate(
      { username: req.params.username },
      { $push: { warnings: { reason: reason || "Suspicious activity", issuedBy: "admin", issuedAt: new Date() } } },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    await Notification.create({
      id: uuidv4(), userId: user.id,
      fromUserId: "system", fromUsername: "Luciagram",
      type: "follow",
      text: "⚠️ Warning: " + (reason || "Suspicious activity detected on your account."),
      isRead: false,
    });
    if (global.io) global.io.to("user_" + user.id).emit("new_notification", { type: "warning", text: "⚠️ " + reason });
    res.json({ message: "⚠️ Warning sent to @" + user.username, totalWarnings: user.warnings.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE account + all posts & reels (force-delete even with auth issues)
// curl -X DELETE https://your-api/api/admin/delete/USERNAME -H "x-admin-key: YOUR_KEY"
router.delete("/delete/:username", async (req, res) => {
  try {
    if (req.headers["x-admin-key"] !== process.env.ADMIN_SECRET) return res.status(403).json({ message: "Forbidden" });
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ message: "User not found" });
    const SupaStore = require("../supastore");
    const { Post, Story } = require("../models");
    // Delete all posts media
    const userPosts = await Post.find({ userId: user.id });
    for (const p of userPosts) { if (p.mediaFileName) await SupaStore.delete(p.mediaFileName); }
    await Post.deleteMany({ userId: user.id });
    // Delete all stories media
    const userStories = await Story.find({ userId: user.id });
    for (const s of userStories) { if (s.mediaFileName) await SupaStore.delete(s.mediaFileName); }
    await Story.deleteMany({ userId: user.id });
    // Delete messages, notifications, reports
    const { Message, Notification, Report, Follow, GroupMessage } = require("../models");
    await Message.deleteMany({ $or: [{ senderId: user.id }, { receiverId: user.id }] });
    await Notification.deleteMany({ $or: [{ userId: user.id }, { fromUserId: user.id }] });
    await Report.deleteMany({ $or: [{ reporterId: user.id }, { targetUserId: user.id }] });
    await Follow.deleteMany({ $or: [{ followerId: user.id }, { followingId: user.id }] });
    await User.deleteOne({ id: user.id });
    res.json({ message: "🗑️ @" + req.params.username + " permanently deleted with all content" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// CHECK account status
// curl https://your-api/api/admin/check/USERNAME -H "x-admin-key: YOUR_KEY"
router.get("/check/:username", async (req, res) => {
  try {
    if (req.headers["x-admin-key"] !== process.env.ADMIN_SECRET) return res.status(403).json({ message: "Forbidden" });
    const user = await User.findOne({ username: req.params.username }).select("-password").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    const { Report } = require("../models");
    const reportCount = await Report.countDocuments({ targetUserId: user.id, status: "pending" });
    res.json({ username: user.username, isSuspended: user.isSuspended, suspendReason: user.suspendReason, warnings: user.warnings?.length || 0, pendingReports: reportCount });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
