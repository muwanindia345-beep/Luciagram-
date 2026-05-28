const router = require("express").Router();
const auth = require("../middleware/auth");
const { User, Follow, Post, Story, Message, Comment } = require("../models");
const notifRouter = require("./notifications");


router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    const { password, ...safe } = user;
    res.json(safe);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/search", auth, async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q || q.length < 1) return res.json([]);
    if (q.length > 30) return res.status(400).json({ message: "Search query too long" });
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const users = await User.find({
      $or: [
        { username: { $regex: escaped, $options: "i" } },
        { fullName: { $regex: escaped, $options: "i" } }
      ]
    }).select("-password").limit(10);
    res.json(users);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/following-list", auth, async (req, res) => {
  try {
    const follows = await Follow.find({ followerId: req.user.id });
    const ids = follows.map(f => f.followingId);
    const users = await User.find({ id: { $in: ids }, isSuspended: { $ne: true } })
      .select("id username avatar fullName isVerified");
    res.json(users);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/my/following-ids", auth, async (req, res) => {
  try {
    const follows = await Follow.find({ followerId: req.user.id });
    res.json(follows.map(f => f.followingId));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:id/followers/list", auth, async (req, res) => {
  try {
    const follows = await Follow.find({ followingId: req.params.id });
    const users = await User.find({ id: { $in: follows.map(f => f.followerId) } })
      .select("id username avatar isVerified");
    res.json(users);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:id/following/list", auth, async (req, res) => {
  try {
    const follows = await Follow.find({ followerId: req.params.id });
    const users = await User.find({ id: { $in: follows.map(f => f.followingId) } })
      .select("id username avatar isVerified");
    res.json(users);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:id/followers", auth, async (req, res) => {
  try {
    const followers = await Follow.countDocuments({ followingId: req.params.id });
    const following = await Follow.countDocuments({ followerId: req.params.id });
    const isFollowing = !!(await Follow.findOne({ followerId: req.user.id, followingId: req.params.id }));
    const targetUser = await User.findOne({ id: req.params.id });
    const isPending = !!(targetUser?.followRequests || []).find(r => r.userId === req.user.id);
    res.json({ followers, following, isFollowing, isPending });
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
    const oldUser = await User.findOne({ id: req.user.id });
    const user = await User.findOneAndUpdate(
      { id: req.user.id },
      update,
      { new: true }
    ).select("-password");
    // If username changed, update all posts, stories, messages, comments
    if (username && username !== oldUser.username) {
      await Promise.all([
        Post.updateMany({ userId: req.user.id }, { username }),
        Story.updateMany({ userId: req.user.id }, { username }),
        Message.updateMany({ senderId: req.user.id }, { senderUsername: username }),
        Message.updateMany({ receiverId: req.user.id }, { receiverUsername: username }),
        Comment.updateMany({ userId: req.user.id }, { username }),
      ]);
    }
    // If avatar changed, update stories and posts author avatar reference
    if (avatar !== undefined && avatar !== oldUser.avatar) {
      await Story.updateMany({ userId: req.user.id }, { avatar });
    }
    res.json(user);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

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

router.put("/privacy", auth, async (req, res) => {
  try {
    const user = await User.findOne({ id: req.user.id });
    await User.findByIdAndUpdate(user.id, { "isPrivate": !user.isPrivate });
    res.json({ isPrivate: user.isPrivate });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/:id/follow", auth, async (req, res) => {
  try {
    const existing = await Follow.findOne({ followerId: req.user.id, followingId: req.params.id });
    if (existing) { await existing.deleteOne(); return res.json({ message: "Unfollowed", following: false }); }
    const followedUser = await User.findOne({ id: req.params.id });
    await Follow.create({
      followerId: req.user.id,
      followerUsername: req.user.username,
      followingId: req.params.id,
      followingUsername: followedUser?.username || ""
    });
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

router.post("/:id/follow-request", auth, async (req, res) => {
  try {
    const targetUser = await User.findOne({ id: req.params.id });
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    if (!targetUser.isPrivate) {
      const existing = await Follow.findOne({ followerId: req.user.id, followingId: req.params.id });
      if (existing) { await existing.deleteOne(); return res.json({ status: "unfollowed" }); }
      await Follow.create({
        followerId: req.user.id,
        followerUsername: req.user.username,
        followingId: req.params.id,
        followingUsername: targetUser.username
      });
      await notifRouter.createNotif({
        userId: req.params.id,
        fromUserId: req.user.id,
        fromUsername: req.user.username,
        fromAvatar: targetUser?.avatar || "",
        type: "follow",
        text: req.user.username + " started following you",
      });
      return res.json({ status: "following" });
    }

    if (!targetUser.followRequests) targetUser.followRequests = [];
    const alreadyRequested = targetUser.followRequests.find(r => r.userId === req.user.id);
    if (alreadyRequested) {
      targetUser.followRequests = targetUser.followRequests.filter(r => r.userId !== req.user.id);
      await targetUser.save();
      return res.json({ status: "request_cancelled" });
    }
    targetUser.followRequests.push({ userId: req.user.id, username: req.user.username });
    await targetUser.save();
    await notifRouter.createNotif({
      userId: req.params.id,
      fromUserId: req.user.id,
      fromUsername: req.user.username,
      fromAvatar: targetUser?.avatar || "",
      type: "follow",
      text: req.user.username + " requested to follow you",
    });
    res.json({ status: "requested" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/follow-request/:requesterId/accept", auth, async (req, res) => {
  try {
    const user = await User.findOne({ id: req.user.id });
    await User.findByIdAndUpdate(user.id, { "followRequests": (user.followRequests || []).filter(r => r.userId !== req.params.requesterId) });
    const requester = await User.findOne({ id: req.params.requesterId });
    await Follow.create({
      followerId: req.params.requesterId,
      followerUsername: requester?.username || "",
      followingId: req.user.id,
      followingUsername: user.username
    });
    await notifRouter.createNotif({
      userId: req.params.requesterId,
      fromUserId: req.user.id,
      fromUsername: req.user.username,
      fromAvatar: user?.avatar || "",
      type: "follow",
      text: req.user.username + " accepted your follow request",
    });
    res.json({ message: "Accepted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/follow-request/:requesterId/decline", auth, async (req, res) => {
  try {
    const user = await User.findOne({ id: req.user.id });
    await User.findByIdAndUpdate(user.id, { "followRequests": (user.followRequests || []).filter(r => r.userId !== req.params.requesterId) });
    res.json({ message: "Declined" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:username", auth, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isSuspended) return res.status(404).json({ message: "User not found", suspended: true });
    const isFollowing = !!(await Follow.findOne({ followerId: req.user.id, followingId: user.id }));
    const isPending = !!(user.followRequests || []).find(r => r.userId === req.user.id);
    // Always return avatar so profile pics show everywhere
    // Hide sensitive fields for private accounts you don't follow
    if (user.isPrivate && !isFollowing && user.id !== req.user.id) {
      return res.json({ id: user.id, username: user.username, fullName: user.fullName, avatar: user.avatar, isPrivate: true, isVerified: user.isVerified, isFollowing, isPending });
    }
    res.json({ ...user, followRequests: undefined, isFollowing, isPending });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;

