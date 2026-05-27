const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { User } = require("../models");

router.post("/register", async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;
    if (await User.findOne({ email })) return res.status(400).json({ message: "Email already exists" });
    if (await User.findOne({ username })) return res.status(400).json({ message: "Username taken" });
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ id: uuidv4(), username, email, password: hashed, fullName });
    const token = jwt.sign({ id: user.id, username }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user: { id: user.id, username, email, fullName } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password, publicKey } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil - new Date()) / 60000);
      return res.status(423).json({ message: `Account locked. Try again in ${mins} minute(s).` });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      user.failedLogins = (user.failedLogins || 0) + 1;
      if (user.failedLogins >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // lock 15 mins
        user.failedLogins = 0;
      }
      await user.save();
      const remaining = 5 - (user.failedLogins || 0);
      return res.status(400).json({ message: `Invalid password. ${remaining > 0 ? remaining + ' attempts left.' : 'Account locked for 15 mins.'}` });
    }

    // Reset failed logins on success
    user.failedLogins = 0;
    user.lockedUntil = null;

    // Save public key for E2E encryption
    if (publicKey) user.publicKey = publicKey;

    // Save login history
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const device = req.headers['user-agent']?.slice(0, 100) || 'unknown';
    user.loginHistory = [{ ip, device, time: new Date() }, ...(user.loginHistory || [])].slice(0, 10);
    await user.save();

    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: "24h" });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, fullName: user.fullName, avatar: user.avatar, publicKey: user.publicKey } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get another user's public key for E2E encryption
router.get("/pubkey/:username", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ publicKey: user.publicKey || null });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get login history (protected)
router.get("/login-history", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const jwt2 = require("jsonwebtoken");
    const decoded = jwt2.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ id: decoded.id });
    res.json({ loginHistory: user?.loginHistory || [] });
  } catch { res.status(401).json({ message: "Unauthorized" }); }
});

module.exports = router;
