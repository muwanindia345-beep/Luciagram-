const router = require("express").Router();
const auth = require("../middleware/auth");
const { Messages } = require("../models");
const { v4: uuidv4 } = require("uuid");
router.get("/:userId", auth, (req, res) => { res.json(Messages().where(m => (m.senderId===req.user.id&&m.receiverId===req.params.userId)||(m.senderId===req.params.userId&&m.receiverId===req.user.id))); });
router.post("/", auth, (req, res) => { const msg = Messages().insert({ id: uuidv4(), senderId: req.user.id, receiverId: req.body.receiverId, text: req.body.text, isRead: false, createdAt: new Date() }); res.status(201).json(msg); });
module.exports = router;
