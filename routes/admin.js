const router = require("express").Router();
const { Post, Story } = require("../models");

// Admin cleanup - removes old base64 posts to free space
router.get("/cleanup", async (req, res) => {
  try {
    // Find posts with base64 data (starts with data:)
    const allPosts = await Post.find().lean();
    let cleaned = 0;
    let spaceSaved = 0;

    for (const post of allPosts) {
      if (post.mediaUrl && post.mediaUrl.startsWith("data:")) {
        spaceSaved += post.mediaUrl.length;
        await Post.updateOne({ _id: post._id }, { $set: { mediaUrl: "" } });
        cleaned++;
      }
    }

    // Clean stories too
    const allStories = await Story.find().lean();
    let storiesCleaned = 0;
    for (const story of allStories) {
      if (story.mediaUrl && story.mediaUrl.startsWith("data:")) {
        await Story.updateOne({ _id: story._id }, { $set: { mediaUrl: "" } });
        storiesCleaned++;
      }
    }

    res.json({
      message: "Cleanup complete!",
      postsCleaned: cleaned,
      storiesCleaned,
      spaceSavedMB: (spaceSaved / 1024 / 1024).toFixed(2) + " MB"
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const totalPosts = await Post.countDocuments();
    const totalStories = await Story.countDocuments();
    const base64Posts = await Post.countDocuments({ mediaUrl: /^data:/ });
    const supabasePosts = await Post.countDocuments({ mediaFileName: { $exists: true, $ne: "" } });
    res.json({ totalPosts, totalStories, base64Posts, supabasePosts });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
