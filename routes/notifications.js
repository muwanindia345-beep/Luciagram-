const router = require("express").Router();
const auth = require("../middleware/auth");
const { Notification } = require("../models");
const { v4: uuidv4 } = require("uuid");

// Get my notifications
router.get("/", auth, async (req, res) => {
  try {
    const notifs = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      ;
    res.json(notifs);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get unread count
router.get("/unread", auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user.id, isRead: false });
    res.json({ count });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Mark all as read
router.put("/read", auth, async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user.id, isRead: false }, { isRead: true });
    res.json({ message: "All marked as read" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Mark single as read
router.put("/:id/read", auth, async (req, res) => {
  try {
    await Notification.updateOne({ id: req.params.id }, { isRead: true });
    res.json({ message: "Marked as read" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Delete a notification
router.delete("/:id", auth, async (req, res) => {
  try {
    await Notification.deleteOne({ id: req.params.id, userId: req.user.id });
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Internal helper - create notification (used by other routes)
router.createNotif = async ({ userId, fromUserId, fromUsername, fromAvatar, type, postId, postThumb, text }) => {
  try {
    if (!userId || userId === fromUserId) return;
    await Notification.create({
      id: uuidv4(),
      user_id: userId,
      from_user_id: fromUserId,
      from_username: fromUsername || "",
      from_avatar: fromAvatar || "",
      type: type || "like",
      post_id: postId || "",
      post_thumb: postThumb || "",
      text: text || "",
      is_read: false,
    });
    // Emit real-time via socket
    if (global.io) {
      global.io.to("user_" + userId).emit("new_notification", { type, fromUsername, text });
    }
  } catch (err) { console.error("Notif error:", err); }
};

module.exports = router;
