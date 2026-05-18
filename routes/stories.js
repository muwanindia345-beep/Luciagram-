const router = require("express").Router();
const auth = require("../middleware/auth");
const { Stories } = require("../models");
const { v4: uuidv4 } = require("uuid");
router.get("/", auth, (req, res) => { const now = new Date(); res.json(Stories().where(s => new Date(s.expiresAt) > now)); });
router.post("/", auth, (req, res) => { const { mediaUrl, mediaType } = req.body; const story = Stories().insert({ id: uuidv4(), userId: req.user.id, mediaUrl, mediaType: mediaType||"image", expiresAt: new Date(Date.now()+86400000), createdAt: new Date() }); res.status(201).json(story); });
module.exports = router;
