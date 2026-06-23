const router = require("express").Router();
const auth = require("../middleware/auth");
const { User } = require("../models");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");

// GET /api/settings
router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findOne({ id: req.user.id });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      email: user.email,
      phone: user.phone || "",
      twoFactorEnabled: user.twoFactorEnabled || false,
      loginHistory: user.loginHistory || [],
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/settings/change-email
router.post("/change-email", auth, async (req, res) => {
  try {
    const { newEmail, password } = req.body;
    if (!newEmail || !password) return res.status(400).json({ message: "All fields required" });
    const user = await User.findOne({ id: req.user.id });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "Wrong password" });
    const exists = await User.findOne({ email: newEmail.toLowerCase() });
    if (exists) return res.status(400).json({ message: "Email already in use" });
    await User.updateOne({ id: req.user.id }, { email: newEmail.toLowerCase() });
    res.json({ message: "Email updated!" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/settings/change-password
router.post("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: "All fields required" });
    if (newPassword.length < 6) return res.status(400).json({ message: "Min 6 characters" });
    const user = await User.findOne({ id: req.user.id });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(400).json({ message: "Current password is wrong" });
    const hashed = await bcrypt.hash(newPassword, 10);
    await User.updateOne({ id: req.user.id }, { password: hashed });
    res.json({ message: "Password updated!" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/settings/2fa/setup — Generate QR code
router.post("/2fa/setup", auth, async (req, res) => {
  try {
    const user = await User.findOne({ id: req.user.id });
    const secret = speakeasy.generateSecret({
      name: "Luciagram (" + user.username + ")",
      length: 20,
    });
    // Save temp secret
    await User.updateOne({ id: req.user.id }, { twoFactorTemp: secret.base32 });
    const qr = await qrcode.toDataURL(secret.otpauth_url);
    res.json({ qrCode: qr, secret: secret.base32 });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/settings/2fa/verify — Verify and enable
router.post("/2fa/verify", auth, async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findOne({ id: req.user.id });
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorTemp,
      encoding: "base32",
      token: token,
      window: 2,
    });
    if (!verified) return res.status(400).json({ message: "Invalid code. Try again." });
    await User.updateOne({ id: req.user.id }, {
      twoFactorEnabled: true,
      twoFactorSecret: user.twoFactorTemp,
      twoFactorTemp: null,
    });
    res.json({ message: "2FA enabled!" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/settings/2fa/disable
router.post("/2fa/disable", auth, async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findOne({ id: req.user.id });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "Wrong password" });
    await User.updateOne({ id: req.user.id }, {
      twoFactorEnabled: false,
      twoFactorSecret: null,
    });
    res.json({ message: "2FA disabled" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});


// POST /api/settings — key-value save
router.post("/", auth, async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ message: "Key required" });
    const user = await User.findOne({ id: req.user.id });
    if (!user) return res.status(404).json({ message: "User not found" });
    const settings = user.settings ? JSON.parse(user.settings) : {};
    settings[key] = value;
    await User.updateOne({ id: req.user.id }, { settings: JSON.stringify(settings) });
    res.json({ message: "Setting saved", key, value });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/settings/:key — key delete
router.delete("/:key", auth, async (req, res) => {
  try {
    const { key } = req.params;
    const user = await User.findOne({ id: req.user.id });
    if (!user) return res.status(404).json({ message: "User not found" });
    const settings = user.settings ? JSON.parse(user.settings) : {};
    delete settings[key];
    await User.updateOne({ id: req.user.id }, { settings: JSON.stringify(settings) });
    res.json({ message: "Setting removed", key });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
