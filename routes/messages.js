const router = require("express").Router();
const auth = require("../middleware/auth");
const { Message } = require("../models");
const { v4: uuidv4 } = require("uuid");

router.post("/upload", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
    const SupaStore = require("../supastore");
    const { mediaBase64, mediaType } = req.body;
    const result = await SupaStore.upload(mediaBase64, mediaType || "image", decoded.id);
    res.json({ url: result.url });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/conversations", auth, async (req, res) => {
  try {
    const msgs = await Message.find({
      $or: [{ senderId: req.user.id }, { receiverId: req.user.id }]
    }).sort({ createdAt: -1 });
    
    const conversations = {};
    msgs.forEach(m => {
      const otherId = m.senderId === req.user.id ? m.receiverId : m.senderId;
      const otherUsername = m.senderId === req.user.id ? m.receiverUsername : m.senderUsername;
      if (!conversations[otherId]) {
        conversations[otherId] = {
          userId: otherId,
          username: otherUsername,
          lastMessage: m.text,
          lastMedia: m.mediaUrl,
          createdAt: m.createdAt,
          unread: !m.isRead && m.receiverId === req.user.id ? 1 : 0,
        };
      }
    });
    res.json(Object.values(conversations));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:userId", auth, async (req, res) => {
  try {
    const msgs = await Message.find({
      $or: [
        { senderId: req.user.id, receiverId: req.params.userId },
        { senderId: req.params.userId, receiverId: req.user.id }
      ]
    }).sort({ createdAt: 1 });
    await Message.updateMany({ senderId: req.params.userId, receiverId: req.user.id, isRead: false }, { isRead: true });
    res.json(msgs);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/", auth, async (req, res) => {
  try {
    const { receiverId, receiverUsername, text, mediaUrl } = req.body;
    const msg = await Message.create({
      id: uuidv4(),
      senderId: req.user.id,
      senderUsername: req.user.username,
      receiverId,
      receiverUsername,
      text,
      mediaUrl: mediaUrl || "",
      isRead: false,
    });
    res.status(201).json(msg);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const msg = await Message.findOne({ id: req.params.id });
    if (!msg) return res.status(404).json({ message: "Not found" });
    if (msg.senderId !== req.user.id) return res.status(403).json({ message: "Forbidden" });
    await msg.deleteOne();
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
