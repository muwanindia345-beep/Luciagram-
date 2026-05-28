const router = require("express").Router();
const auth = require("../middleware/auth");
const { User, Follow } = require("../models");
const notifRouter = require("./notifications");

router.get("/search", auth, async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q || q.length < 1) return res.json([]);
    if (q.length > 30) return res.status(400).json({ message: "Search query too long" });
    // Escape special regex chars to prevent ReDoS
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const users = await User.find({
      $or: [
        { username: { $regex: escaped, $options: "i" } },
        { fullName: { $regex: escaped, $options: "i" } }
      ]
    }).select("-password").limit(10).lean();
    res.json(users);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:username", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put("/profile", auth, async (req, res) => {
  try {
    const { fullName, username, bio, website, avatar, song } = req.body;
    if (username && username.length < 3) return res.status(400).json({ message: "Username too short" });
    if (username && !/^[a-zA-Z0-9_.]+$/.test(username)) return res.status(400).json({ message: "Invalid username format" });
    if (bio && bio.length > 150) return res.status(400).json({ message: "Bio max 150 characters" });
    if (website && website.length > 100) return res.status(400).json({ message: "Website URL too long" });
    const existing = await User.findOne({ username, id: { $ne: req.user.id } });
    if (existing) return res.status(400).json({ message: "Username taken" });
    const update = { fullName, username, bio, website, avatar };
    if (song !== undefined) update.song = song;
    const user = await User.findOneAndUpdate(
      { id: req.user.id },
      update,
      { new: true }
    ).select("-password");
    res.json(user);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/:id/follow", auth, async (req, res) => {
  try {
    const existing = await Follow.findOne({ followerId: req.user.id, followingId: req.params.id });
    if (existing) { await existing.deleteOne(); return res.json({ message: "Unfollowed", following: false }); }
    await Follow.create({ followerId: req.user.id, followerUsername: req.user.username, followingId: req.params.id });
    // Notify followed user
    const followedUser = await User.findOne({ id: req.params.id }).lean();
    await notifRouter.createNotif({
      userId: req.params.id,
      fromUserId: req.user.id,
      fromUsername: req.user.username,
      fromAvatar: followedUser?.avatar || "",
      type: "follow",
      text: req.user.username + " started following you",
    });
    res.json({ message: "Followed", following: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:id/followers", auth, async (req, res) => {
  try {
    const followers = await Follow.countDocuments({ followingId: req.params.id });
    const following = await Follow.countDocuments({ followerId: req.params.id });
    const isFollowing = !!(await Follow.findOne({ followerId: req.user.id, followingId: req.params.id }));
    res.json({ followers, following, isFollowing });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Remove profile picture
router.put("/remove-avatar", auth, async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { id: req.user.id },
      { avatar: "" },
      { new: true }
    ).select("-password");
    res.json(user);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Toggle private account
router.put("/privacy", auth, async (req, res) => {
  try {
    const user = await User.findOne({ id: req.user.id });
    user.isPrivate = !user.isPrivate;
    await user.save();
    res.json({ isPrivate: user.isPrivate });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Follow request system
router.post("/:id/follow-request", auth, async (req, res) => {
  try {
    const targetUser = await User.findOne({ id: req.params.id });
    if (!targetUser) return res.status(404).json({ message: "User not found" });
    
    if (!targetUser.isPrivate) {
      // Public account — direct follow
      const existing = await Follow.findOne({ followerId: req.user.id, followingId: req.params.id });
      if (existing) { await existing.deleteOne(); return res.json({ status: "unfollowed" }); }
      await Follow.create({ followerId: req.user.id, followerUsername: req.user.username, followingId: req.params.id });
      const notifRouter = require("./notifications");
      await notifRouter.createNotif({
        userId: req.params.id,
        fromUserId: req.user.id,
        fromUsername: req.user.username,
        type: "follow",
        text: req.user.username + " started following you",
      });
      return res.json({ status: "following" });
    }
    
    // Private account — send request
    if (!targetUser.followRequests) targetUser.followRequests = [];
    const alreadyRequested = targetUser.followRequests.find(r => r.userId === req.user.id);
    if (alreadyRequested) {
      targetUser.followRequests = targetUser.followRequests.filter(r => r.userId !== req.user.id);
      await targetUser.save();
      return res.json({ status: "request_cancelled" });
    }
    targetUser.followRequests.push({ userId: req.user.id, username: req.user.username });
    await targetUser.save();
    // Notify
    const notifRouter = require("./notifications");
    await notifRouter.createNotif({
      userId: req.params.id,
      fromUserId: req.user.id,
      fromUsername: req.user.username,
      type: "follow",
      text: req.user.username + " requested to follow you",
    });
    res.json({ status: "requested" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Accept/decline follow request
router.post("/follow-request/:requesterId/accept", auth, async (req, res) => {
  try {
    const user = await User.findOne({ id: req.user.id });
    user.followRequests = (user.followRequests || []).filter(r => r.userId !== req.params.requesterId);
    await user.save();
    await Follow.create({ followerId: req.params.requesterId, followingId: req.user.id });
    const notifRouter = require("./notifications");
    await notifRouter.createNotif({
      userId: req.params.requesterId,
      fromUserId: req.user.id,
      fromUsername: req.user.username,
      type: "follow",
      text: req.user.username + " accepted your follow request",
    });
    res.json({ message: "Accepted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/follow-request/:requesterId/decline", auth, async (req, res) => {
  try {
    const user = await User.findOne({ id: req.user.id });
    user.followRequests = (user.followRequests || []).filter(r => r.userId !== req.params.requesterId);
    await user.save();
    res.json({ message: "Declined" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
