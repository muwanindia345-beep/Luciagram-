const router = require("express").Router();
const auth = require("../middleware/auth");
const { Comment } = require("../models");
const { v4: uuidv4 } = require("uuid");

router.get("/:postId", async (req, res) => {
  try {
    const comments = await Comment.find({ postId: req.params.postId }).sort({ createdAt: 1 });
    res.json(comments);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/:postId", auth, async (req, res) => {
  try {
    const comment = await Comment.create({ id: uuidv4(), postId: req.params.postId, userId: req.user.id, username: req.user.username, text: req.body.text });
    res.status(201).json(comment);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
