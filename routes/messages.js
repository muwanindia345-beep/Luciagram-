const router = require("express").Router();
const auth = require("../middleware/auth");
const { Message } = require("../models");
const notifRouter = require("./notifications");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");

const ENCRYPT_KEY = Buffer.from((process.env.MSG_ENCRYPT_KEY || "luciagram_msg_key_32bytes_secure!").slice(0, 32));
const IV_LENGTH = 16;

function encryptText(text) {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPT_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
  } catch { return text; }
}

function decryptText(text) {
  if (!text) return text;
  if (!text.includes(":")) return text;
  try {
    const parts = text.split(":");
    if (parts.length !== 2) return text;
    if (parts[0].length !== 32) return text;
    const iv = Buffer.from(parts[0], "hex");
    const enc = Buffer.from(parts[1], "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPT_KEY, iv);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch { return text; }
}

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
    }).sort({ createdAt: -1 }).limit(200).lean();
    const conversations = {};
    msgs.forEach(m => {
      const otherId = m.senderId === req.user.id ? m.receiverId : m.senderId;
      const otherUsername = m.senderId === req.user.id ? m.receiverUsername : m.senderUsername;
      if (!conversations[otherId]) {
        conversations[otherId] = {
          userId: otherId,
          username: otherUsername,
          lastMessage: decryptText(m.text),
          lastMedia: m.mediaUrl,
          createdAt: m.createdAt,
          unread: !m.isRead && m.receiverId === req.user.id ? 1 : 0,
          avatar: "",
        };
      } else {
        if (!m.isRead && m.receiverId === req.user.id) {
          conversations[otherId].unread = (conversations[otherId].unread || 0) + 1;
        }
      }
    });
    const { User } = require("../models");
    const userIds = Object.keys(conversations);
    const users = await User.find({ id: { $in: userIds } }).select("id avatar").lean();
    users.forEach(u => { if (conversations[u.id]) conversations[u.id].avatar = u.avatar || ""; });
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
    const decrypted = msgs.map(m => ({ ...m.toObject(), text: decryptText(m.text) }));
    res.json(decrypted);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/", auth, async (req, res) => {
  try {
    const { receiverId, receiverUsername, text, mediaUrl, mediaType, replyTo, music } = req.body;
    if (!receiverId) return res.status(400).json({ message: "receiverId required" });
    if (!text?.trim() && !mediaUrl) return res.status(400).json({ message: "Message cannot be empty" });
    const { User } = require("../models");
    const receiver = await User.findOne({ id: receiverId }).lean();
    if (!receiver) return res.status(404).json({ message: "User not found" });
    if (receiver.isSuspended) return res.status(403).json({ message: "This account has been suspended" });
    const msg = await Message.create({
      id: uuidv4(),
      senderId: req.user.id,
      senderUsername: req.user.username,
      receiverId,
      receiverUsername,
      text: encryptText(text),
      mediaUrl: mediaUrl || "",
      mediaType: mediaType || "",
      isRead: false,
      replyTo: replyTo || null,
      reactions: [],
      music: music || null,
    });
    const msgObj = msg.toObject();
    const decryptedMsg = { ...msgObj, text: decryptText(msgObj.text) };
    if (global.io) {
      global.io.to("user_" + receiverId).emit("new_message", decryptedMsg);
    }
    await notifRouter.createNotif({
      userId: receiverId,
      fromUserId: req.user.id,
      fromUsername: req.user.username,
      fromAvatar: req.user.avatar || "",
      type: "message",
      text: req.user.username + " sent you a message",
    });
    res.status(201).json(decryptedMsg);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const msg = await Message.findOne({ id: req.params.id });
    if (!msg) return res.status(404).json({ message: "Not found" });
    if (msg.senderId !== req.user.id) return res.status(403).json({ message: "Forbidden" });
    const otherId = msg.senderId === req.user.id ? msg.receiverId : msg.senderId;
    await msg.deleteOne();
    if (global.io) {
      global.io.to("user_" + otherId).emit("dm_unsend", { msgId: req.params.id });
    }
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/:id/react", auth, async (req, res) => {
  try {
    const { emoji } = req.body;
    const msg = await Message.findOne({ id: req.params.id });
    if (!msg) return res.status(404).json({ message: "Not found" });
    const existing = msg.reactions.find(r => r.userId === req.user.id);
    if (existing) {
      if (existing.emoji === emoji) {
        msg.reactions = msg.reactions.filter(r => r.userId !== req.user.id);
      } else {
        existing.emoji = emoji;
      }
    } else {
      msg.reactions.push({ userId: req.user.id, username: req.user.username, emoji });
    }
    await msg.save();
    const otherId = msg.senderId === req.user.id ? msg.receiverId : msg.senderId;
    if (global.io) {
      global.io.to("user_" + otherId).emit("dm_reaction", { msgId: req.params.id, reactions: msg.reactions });
    }
    res.json({ reactions: msg.reactions });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

const typingStatus = {};

router.post("/typing", auth, (req, res) => {
  const key = req.user.id + "_" + req.body.receiverId;
  typingStatus[key] = Date.now();
  res.json({ ok: true });
});

router.post("/typing/stop", auth, (req, res) => {
  const key = req.user.id + "_" + req.body.receiverId;
  delete typingStatus[key];
  res.json({ ok: true });
});

router.get("/typing/:userId", auth, (req, res) => {
  const key = req.params.userId + "_" + req.user.id;
  const lastTyped = typingStatus[key];
  const isTyping = lastTyped && (Date.now() - lastTyped < 3000);
  res.json({ isTyping: !!isTyping });
});

module.exports = router;
