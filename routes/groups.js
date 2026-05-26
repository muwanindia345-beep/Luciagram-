const router = require("express").Router();
const auth = require("../middleware/auth");
const { Group, GroupMessage } = require("../models");
const { v4: uuidv4 } = require("uuid");
const SupaStore = require("../supastore");

router.get("/", auth, async (req, res) => {
  try {
    const groups = await Group.find({ "members.id": req.user.id }).sort({ updatedAt: -1 });
    res.json(groups);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/", auth, async (req, res) => {
  try {
    const { name, avatarBase64 } = req.body;
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
    const msgs = await GroupMessage.find({ groupId: req.params.id }).sort({ createdAt: 1 });
    res.json(msgs);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/:id/messages", auth, async (req, res) => {
  try {
    const { text, mediaUrl, mediaType } = req.body;
    const { User } = require("../models");
    const sender = await User.findOne({ id: req.user.id }).select("avatar").lean();
    const msg = await GroupMessage.create({
      id: uuidv4(), groupId: req.params.id,
      senderId: req.user.id, senderUsername: req.user.username,
      senderAvatar: sender?.avatar || "",
      text: text || "", mediaUrl: mediaUrl || "", mediaType: mediaType || "",
    });
    await Group.updateOne({ id: req.params.id }, { updatedAt: new Date() });
    if (global.io) {
      global.io.to('group_' + req.params.id).emit('group_message', msg);
    }
    res.status(201).json(msg);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/upload", auth, async (req, res) => {
  try {
    const { mediaBase64, mediaType } = req.body;
    const result = await SupaStore.upload(mediaBase64, mediaType || "image", req.user.id);
    res.json({ url: result.url });
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
