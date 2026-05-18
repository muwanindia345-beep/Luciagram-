const router = require("express").Router();
const auth = require("../middleware/auth");
const { Users, Follows } = require("../models");
router.get("/:username", (req, res) => { const user = Users().findOne({ username: req.params.username }); if (!user) return res.status(404).json({ message: "User not found" }); const { password, ...safe } = user; res.json(safe); });
router.post("/:id/follow", auth, (req, res) => { const follows = Follows(); const existing = follows.findOne({ followerId: req.user.id, followingId: req.params.id }); if (existing) { follows.remove(existing); return res.json({ message: "Unfollowed" }); } follows.insert({ followerId: req.user.id, followingId: req.params.id }); res.json({ message: "Followed" }); });
module.exports = router;
