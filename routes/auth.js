const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { User } = require("../models");

function isValidEmail(email) {
  return email && email.includes("@") && email.includes(".") && email.length > 5;
}
function isValidUsername(username) {
  return /^[a-zA-Z0-9_.]+$/.test(username);
}

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, fullName, phone } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ message: "All fields required" });
    if (username.length < 3 || username.length > 20)
      return res.status(400).json({ message: "Username must be 3-20 characters" });
    if (!isValidUsername(username))
      return res.status(400).json({ message: "Username can only contain letters, numbers, _ and ." });
    if (!isValidEmail(email))
      return res.status(400).json({ message: "Invalid email address" });
    if (password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    if (password.length > 100)
      return res.status(400).json({ message: "Password too long" });

    const emailLower = email.toLowerCase().trim();
    if (await User.findOne({ email: emailLower }))
      return res.status(400).json({ message: "Email already exists" });
    if (await User.findOne({ username }))
      return res.status(400).json({ message: "Username taken" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      id: uuidv4(), username,
      email: emailLower,
      password: hashed,
      fullName: fullName || username,
    });

    const token = jwt.sign({ id: user.id, username }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none", maxAge: 7*24*60*60*1000 });
    res.status(201).json({ token, user: { id: user.id, username, email: emailLower, fullName: user.fullName } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// LOGIN — email ya username dono se
router.post("/login", async (req, res) => {
  try {
    const { email, password, publicKey } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email/username and password required" });

    // Email hai ya username — dono check karo
    const isEmail = email.includes("@");
    const user = isEmail
      ? await User.findOne({ email: email.toLowerCase().trim() })
      : await User.findOne({ username: email.trim() });

    if (!user) return res.status(400).json({ message: "User not found" });

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const mins = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60000);
      return res.status(423).json({ message: "Account locked. Try again in " + mins + " minute(s)." });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      const fails = (user.failedLogins || 0) + 1;
      if (fails >= 5) {
        await User.findByIdAndUpdate(user.id, { failedLogins: 0, lockedUntil: new Date(Date.now() + 15*60*1000) });
        return res.status(400).json({ message: "Too many attempts. Account locked for 15 mins." });
      }
      await User.findByIdAndUpdate(user.id, { failedLogins: fails });
      return res.status(400).json({ message: "Invalid password. " + (5-fails) + " attempts left." });
    }

    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    const device = (req.headers["user-agent"] || "unknown").slice(0, 100);
    const loginHistory = [{ ip, device, time: new Date() }, ...(user.loginHistory || [])].slice(0, 10);
    await User.findByIdAndUpdate(user.id, {
      failedLogins: 0, lockedUntil: null, loginHistory,
      ...(publicKey ? { publicKey } : {}),
    });

    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none", maxAge: 7*24*60*60*1000 });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, fullName: user.fullName, avatar: user.avatar, publicKey: user.publicKey } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get public key
router.get("/pubkey/:username", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ publicKey: user.publicKey || null });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Login history
router.get("/login-history", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ id: decoded.id });
    res.json({ loginHistory: user?.loginHistory || [] });
  } catch { res.status(401).json({ message: "Unauthorized" }); }
});

// Logout
router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out" });
});

module.exports = router;
