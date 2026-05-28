const router = require("express").Router();
const auth = require("../middleware/auth");
const { Report } = require("../models");
const { v4: uuidv4 } = require("uuid");

// Submit a report
router.post("/", auth, async (req, res) => {
  try {
    const { targetUserId, targetUsername, targetId, type, reason, details } = req.body;
    if (!targetUserId || !type || !reason) return res.status(400).json({ message: "targetUserId, type and reason required" });
    if (targetUserId === req.user.id) return res.status(400).json({ message: "Cannot report yourself" });
    const dup = await Report.findOne({ reporterId: req.user.id, targetUserId, targetId: targetId || "", status: "pending" });
    if (dup) return res.status(400).json({ message: "You already reported this" });
    await Report.create({
      id: uuidv4(),
      reporterId: req.user.id,
      reporterUsername: req.user.username,
      targetUserId, targetUsername: targetUsername || "",
      targetId: targetId || "", type, reason,
      details: details?.slice(0, 500) || "",
      status: "pending",
    });
    res.status(201).json({ message: "Report submitted. Our team will review it." });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Admin — get all reports
router.get("/admin/all", async (req, res) => {
  try {
    if (req.headers["x-admin-key"] !== process.env.ADMIN_SECRET) return res.status(403).json({ message: "Forbidden" });
    const status = req.query.status || "pending";
    const reports = await Report.find(status === "all" ? {} : { status }).sort({ createdAt: -1 }).limit(200);
    res.json(reports);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Admin — update report status
router.patch("/admin/:id", async (req, res) => {
  try {
    if (req.headers["x-admin-key"] !== process.env.ADMIN_SECRET) return res.status(403).json({ message: "Forbidden" });
    const { status, actionTaken, reviewedBy } = req.body;
    await Report.updateOne({ id: req.params.id }, { status, actionTaken, reviewedBy });
    res.json({ message: "Report updated" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Admin — report count for a user
router.get("/admin/user/:userId", async (req, res) => {
  try {
    if (req.headers["x-admin-key"] !== process.env.ADMIN_SECRET) return res.status(403).json({ message: "Forbidden" });
    const pending = await Report.countDocuments({ targetUserId: req.params.userId, status: "pending" });
    const total = await Report.countDocuments({ targetUserId: req.params.userId });
    res.json({ pending, total });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
