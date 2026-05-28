const router = require("express").Router();
const auth = require("../middleware/auth");
const { Comment, Like } = require("../models");
const { v4: uuidv4 } = require("uuid");
const notifRouter = require("./notifications");

// Get comments for a post
router.get("/:postId", async (req, res) => {
  try {
    const comments = await Comment.find({ postId: req.params.postId })
      .sort({ createdAt: 1 })
      .limit(100)
      .lean();
    res.json(comments);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Post a comment
router.post("/:postId", auth, async (req, res) => {
  try {
    const { text } = req.body;

    // Validation
    if (!text || !text.trim()) return res.status(400).json({ message: "Comment cannot be empty" });
    if (text.length > 500) return res.status(400).json({ message: "Comment too long (max 500 chars)" });

    const comment = await Comment.create({
      id: uuidv4(),
      postId: req.params.postId,
      userId: req.user.id,
      username: req.user.username,
      avatar: req.user.avatar || "",
      text: text.trim(),
    });

    res.status(201).json(comment);

    // Notifications (after response sent)
    try {
      const { Post, User } = require("../models");
      const post = await Post.findOne({ id: req.params.postId }).lean();
      if (post) {
        // Notify post owner (not self)
        if (post.userId !== req.user.id) {
          await notifRouter.createNotif({
            userId: post.userId,
            fromUserId: req.user.id,
            fromUsername: req.user.username,
            fromAvatar: req.user.avatar || "",
            type: "comment",
            postId: post.id,
            postThumb: post.mediaUrl,
            text: req.user.username + " commented: " + text.trim().slice(0, 50),
          });
        }

        // Notify @mentioned users
        const mentioned = text.match(/@([a-zA-Z0-9_]+)/g);
        if (mentioned) {
          for (const m of mentioned) {
            const mentionedUser = await User.findOne({ username: m.slice(1) }).lean();
            if (mentionedUser && mentionedUser.id !== req.user.id) {
              await notifRouter.createNotif({
                userId: mentionedUser.id,
                fromUserId: req.user.id,
                fromUsername: req.user.username,
                fromAvatar: req.user.avatar || "",
                type: "mention",
                postId: req.params.postId,
                text: req.user.username + " mentioned you in a comment",
              });
            }
          }
        }
      }
    } catch (notifErr) { console.error("Comment notif error:", notifErr); }

  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Delete comment
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

// Get comment likes
router.get("/:id/likes", auth, async (req, res) => {
  try {
    const count = await Like.countDocuments({ postId: "comment_" + req.params.id });
    const liked = !!(await Like.findOne({ postId: "comment_" + req.params.id, userId: req.user.id }));
    res.json({ count, liked });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
