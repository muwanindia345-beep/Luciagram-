const router = require("express").Router();
const auth = require("../middleware/auth");
const { Story } = require("../models");
const { v4: uuidv4 } = require("uuid");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

router.get("/", auth, async (req, res) => {
  try {
    const stories = await Story.find({ expiresAt: { $gt: new Date() } });
    res.json(stories);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/", auth, async (req, res) => {
  try {
    const { mediaBase64, mediaType } = req.body;
    let mediaUrl = "";
    if (mediaBase64) {
      const result = await cloudinary.uploader.upload(mediaBase64, { folder: "luciagram/stories", resource_type: "auto" });
      mediaUrl = result.secure_url;
    }
    const story = await Story.create({ id: uuidv4(), userId: req.user.id, username: req.user.username, mediaUrl, mediaType: mediaType || "image", expiresAt: new Date(Date.now() + 86400000) });
    res.status(201).json(story);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
