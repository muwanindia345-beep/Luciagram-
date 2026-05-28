const router = require("express").Router();
const auth = require("../middleware/auth");
const { Group, GroupMessage } = require("../models");
const { v4: uuidv4 } = require("uuid");
const SupaStore = require("../supastore");

router.get("/", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const groups = await Group.find({
      $or: [
        { "members.id": userId },
        { createdById: userId }
      ]
    }).sort({ updatedAt: -1 });
    res.json(Array.isArray(groups) ? groups : []);
  } catch (err) {
    console.error("Groups fetch error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const { name, avatarBase64 } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: "Group name required" });
    if (name.length > 50) return res.status(400).json({ message: "Group name max 50 chars" });
    let avatarUrl = "";
    if (avatarBase64) {
      const result = await SupaStore.upload(avatarBase64, "image", req.user.id);
      avatarUrl = result.url;
    }
    const group = await Group.create({
      id: uuidv4(), name, avatar: avatarUrl,
      createdBy: req.user.username, createdById: req.user.id,
      admins: [req.user.id],
      members: [{ id: req.user.id, username: req.user.username, avatar: req.user.avatar || "" }],
    });
    res.status(201).json(group);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/upload", auth, async (req, res) => {
  try {
    const { mediaBase64, mediaType } = req.body;
    if (!mediaBase64) return res.status(400).json({ message: "mediaBase64 required" });
    const result = await SupaStore.upload(mediaBase64, mediaType || "image", req.user.id);
    res.json({ url: result.url });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:id", auth, async (req, res) => {
  try {
    const group = await Group.findOne({ id: req.params.id });
    if (!group) return res.status(404).json({ message: "Not found" });
    res.json(group);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/:id/members", auth, async (req, res) => {
  try {
    const group = await Group.findOne({ id: req.params.id });
    if (!group) return res.status(404).json({ message: "Not found" });
    const { userId, username, avatar } = req.body;
    if (group.members.find(m => m.id === userId)) return res.status(400).json({ message: "Already member" });
    group.members.push({ id: userId, username, avatar: avatar || "" });
    await group.save();
    res.json(group);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/:id/members/:userId", auth, async (req, res) => {
  try {
    const group = await Group.findOne({ id: req.params.id });
    if (!group) return res.status(404).json({ message: "Not found" });
    if (!group.admins.includes(req.user.id)) return res.status(403).json({ message: "Admins only" });
    if (req.params.userId === group.createdById) return res.status(403).json({ message: "Cannot remove creator" });
    group.members = group.members.filter(m => m.id !== req.params.userId);
    group.admins = group.admins.filter(a => a !== req.params.userId);
    await group.save();
    res.json(group);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/:id/admins/:userId", auth, async (req, res) => {
  try {
    const group = await Group.findOne({ id: req.params.id });
    if (!group) return res.status(404).json({ message: "Not found" });
    if (group.createdById !== req.user.id) return res.status(403).json({ message: "Creator only" });
    if (!group.admins.includes(req.params.userId)) group.admins.push(req.params.userId);
    await group.save();
    res.json(group);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/:id/admins/:userId", auth, async (req, res) => {
  try {
    const group = await Group.findOne({ id: req.params.id });
    if (!group) return res.status(404).json({ message: "Not found" });
    if (group.createdById !== req.user.id) return res.status(403).json({ message: "Creator only" });
    if (req.params.userId === group.createdById) return res.status(403).json({ message: "Cannot remove creator admin" });
    group.admins = group.admins.filter(a => a !== req.params.userId);
    await group.save();
    res.json(group);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:id/messages", auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const skip = (page - 1) * limit;
    const msgs = await GroupMessage.find({ groupId: req.params.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    res.json({ messages: msgs.reverse() });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/:id/messages", auth, async (req, res) => {
  try {
    const { text, mediaUrl, mediaType, replyTo, music } = req.body;
    if (!text?.trim() && !mediaUrl) return res.status(400).json({ message: "Message cannot be empty" });
    const { User } = require("../models");
    const [sender, grp] = await Promise.all([
      User.findOne({ id: req.user.id }).select("avatar"),
      Group.findOne({ id: req.params.id }),
    ]);
    if (!grp) return res.status(404).json({ message: "Group not found" });
    const msg = await GroupMessage.create({
      id: uuidv4(), groupId: req.params.id,
      senderId: req.user.id, senderUsername: req.user.username,
      senderAvatar: sender?.avatar || "",
      text: text || "", mediaUrl: mediaUrl || "", mediaType: mediaType || "",
      replyTo: replyTo || null,
    });
    await Group.updateOne({ id: req.params.id }, { updatedAt: new Date() });
    if (global.io) {
      global.io.to("group_" + req.params.id).emit("group_message", msg);
    }
    res.status(201).json(msg);
  } catch (err) { res.status(500).json({ message: err.message }); }
});



const groupTyping = {};
router.post("/:id/typing", auth, (req, res) => {
  if (!groupTyping[req.params.id]) groupTyping[req.params.id] = {};
  groupTyping[req.params.id][req.user.id] = { username: req.user.username, avatar: req.user.avatar || "", time: Date.now() };
  res.json({ ok: true });
});
router.post("/:id/typing/stop", auth, (req, res) => {
  if (groupTyping[req.params.id]) delete groupTyping[req.params.id][req.user.id];
  res.json({ ok: true });
});
router.get("/:id/typing", auth, (req, res) => {
  const group = groupTyping[req.params.id] || {};
  const typers = Object.entries(group)
    .filter(([id, v]) => id !== req.user.id && Date.now() - v.time < 3000)
    .map(([id, v]) => ({ id, username: v.username, avatar: v.avatar }));
  res.json({ typers });
});

router.delete("/:id/messages/:msgId", auth, async (req, res) => {
  try {
    const msg = await GroupMessage.findOne({ id: req.params.msgId });
    if (!msg) return res.status(404).json({ message: "Not found" });
    if (msg.senderId !== req.user.id) return res.status(403).json({ message: "Own messages only" });
    await GroupMessage.deleteOne({ id: req.params.msgId });
    if (global.io) {
      global.io.to("group_" + req.params.id).emit("group_unsend", { msgId: req.params.msgId });
    }
    res.json({ message: "Unsent" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/:id/messages/:msgId/react", auth, async (req, res) => {
  try {
    const { emoji } = req.body;
    const msg = await GroupMessage.findOne({ id: req.params.msgId });
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
    if (global.io) {
      global.io.to("group_" + req.params.id).emit("group_reaction", { msgId: req.params.msgId, reactions: msg.reactions });
    }
    res.json({ reactions: msg.reactions });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const group = await Group.findOne({ id: req.params.id });
    if (!group) return res.status(404).json({ message: "Not found" });
    if (group.createdById !== req.user.id) return res.status(403).json({ message: "Creator only" });
    await GroupMessage.deleteMany({ groupId: req.params.id });
    await Group.deleteOne({ id: req.params.id });
    res.json({ message: "Group deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch("/:id/approval", auth, async (req, res) => {
  try {
    const group = await Group.findOne({ id: req.params.id });
    if (!group) return res.status(404).json({ message: "Not found" });
    if (!group.admins.includes(req.user.id)) return res.status(403).json({ message: "Admins only" });
    group.requireApproval = !group.requireApproval;
    await group.save();
    res.json({ requireApproval: group.requireApproval });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:id/pending", auth, async (req, res) => {
  try {
    const group = await Group.findOne({ id: req.params.id });
    if (!group) return res.status(404).json({ message: "Not found" });
    res.json(group.pendingMembers || []);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/:id/pending/:userId/approve", auth, async (req, res) => {
  try {
    const group = await Group.findOne({ id: req.params.id });
    if (!group) return res.status(404).json({ message: "Not found" });
    if (!group.admins.includes(req.user.id)) return res.status(403).json({ message: "Admins only" });
    const pending = (group.pendingMembers || []).find(m => m.id === req.params.userId);
    if (!pending) return res.status(404).json({ message: "Not in pending" });
    group.members.push({ id: pending.id, username: pending.username, avatar: pending.avatar });
    group.pendingMembers = group.pendingMembers.filter(m => m.id !== req.params.userId);
    await group.save();
    res.json(group);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/:id/pending/:userId/reject", auth, async (req, res) => {
  try {
    const group = await Group.findOne({ id: req.params.id });
    if (!group) return res.status(404).json({ message: "Not found" });
    if (!group.admins.includes(req.user.id)) return res.status(403).json({ message: "Admins only" });
    group.pendingMembers = (group.pendingMembers || []).filter(m => m.id !== req.params.userId);
    await group.save();
    res.json({ message: "Rejected" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
