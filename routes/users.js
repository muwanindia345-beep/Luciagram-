const router = require("express").Router();
const auth = require("../middleware/auth");
const { User, Follow } = require("../models");

router.get("/search", auth, async (req, res) => {
  try {
    const q = req.query.q;
    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: "i" } },
        { fullName: { $regex: q, $options: "i" } }
      ]
    }).select("-password").limit(10);
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
    const { fullName, username, bio, website, avatar } = req.body;
    const existing = await User.findOne({ username, id: { $ne: req.user.id } });
    if (existing) return res.status(400).json({ message: "Username taken" });
    const user = await User.findOneAndUpdate(
      { id: req.user.id },
      { fullName, username, bio, website, avatar },
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

module.exports = router;
