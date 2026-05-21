const router = require("express").Router();
const auth = require("../middleware/auth");
const { Message } = require("../models");
const { v4: uuidv4 } = require("uuid");

router.get("/:userId", auth, async (req, res) => {
  try {
    const msgs = await Message.find({
      $or: [
        { senderId: req.user.id, receiverId: req.params.userId },
        { senderId: req.params.userId, receiverId: req.user.id }
      ]
    }).sort({ createdAt: 1 });
    res.json(msgs);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/", auth, async (req, res) => {
  try {
    const msg = await Message.create({ id: uuidv4(), senderId: req.user.id, receiverId: req.body.receiverId, text: req.body.text, isRead: false });
    res.status(201).json(msg);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
