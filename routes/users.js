const router = require("express").Router();
const auth = require("../middleware/auth");
const { User, Follow } = require("../models");

router.get("/:username", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/:id/follow", auth, async (req, res) => {
  try {
    const existing = await Follow.findOne({ followerId: req.user.id, followingId: req.params.id });
    if (existing) { await existing.deleteOne(); return res.json({ message: "Unfollowed" }); }
    await Follow.create({ followerId: req.user.id, followingId: req.params.id });
    res.json({ message: "Followed" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
