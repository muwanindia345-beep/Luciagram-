const router = require("express").Router();
const auth = require("../middleware/auth");
const { Comments } = require("../models");
const { v4: uuidv4 } = require("uuid");
router.get("/:postId", (req, res) => { res.json(Comments().find({ postId: req.params.postId })); });
router.post("/:postId", auth, (req, res) => { const comment = Comments().insert({ id: uuidv4(), postId: req.params.postId, userId: req.user.id, text: req.body.text, createdAt: new Date() }); res.status(201).json(comment); });
module.exports = router;
