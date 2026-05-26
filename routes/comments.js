const router = require("express").Router();
const auth = require("../middleware/auth");
const { Comment, Like } = require("../models");
const { v4: uuidv4 } = require("uuid");
const notifRouter = require("./notifications");

router.get("/:postId", async (req, res) => {
  try {
    const comments = await Comment.find({ postId: req.params.postId }).sort({ createdAt: 1 });
    res.json(comments);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/:postId", auth, async (req, res) => {
  try {
    const comment = await Comment.create({
      id: uuidv4(),
      postId: req.params.postId,
      userId: req.user.id,
      username: req.user.username,
      text: req.body.text,
    });
    res.status(201).json(comment);
    // Notify post owner
    const { Post } = require("../models");
    const post = await Post.findOne({ id: req.params.postId }).lean();
    if (post) {
      await notifRouter.createNotif({
        userId: post.userId,
        fromUserId: req.user.id,
        fromUsername: req.user.username,
        type: "comment",
        postId: post.id,
        postThumb: post.mediaUrl,
        text: req.user.username + " commented: " + req.body.text.slice(0, 50),
      });
    }
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const comment = await Comment.findOne({ id: req.params.id });
    if (!comment) return res.status(404).json({ message: "Not found" });
    if (comment.userId !== req.user.id) return res.status(403).json({ message: "Forbidden" });
    await comment.deleteOne();
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Like / unlike a comment
router.post("/:id/like", auth, async (req, res) => {
  try {
    const existing = await Like.findOne({ postId: "comment_" + req.params.id, userId: req.user.id });
    if (existing) {
      await existing.deleteOne();
      return res.json({ liked: false });
    }
    await Like.create({ postId: "comment_" + req.params.id, userId: req.user.id });
    res.json({ liked: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get comment like count
router.get("/:id/likes", auth, async (req, res) => {
  try {
    const count = await Like.countDocuments({ postId: "comment_" + req.params.id });
    const liked = !!(await Like.findOne({ postId: "comment_" + req.params.id, userId: req.user.id }));
    res.json({ count, liked });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
