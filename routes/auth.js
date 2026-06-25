const router = require("express").Router();
const https = require("https");
const http = require("http");
const jwt = require("jsonwebtoken");
const { User } = require("../models");

const MUWAN_AUTH_URL = process.env.MUWAN_AUTH_URL || "https://muwan-auth.onrender.com";

function muwanPost(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(MUWAN_AUTH_URL + path);
    const isHttps = url.protocol === "https:";
    const payload = JSON.stringify(body);
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };
    const lib = isHttps ? https : http;
    const req = lib.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("Muwan Auth timeout")); });
    req.write(payload);
    req.end();
  });
}

async function syncUser(muwanUser) {
  const { uid, email, username, provider, picture } = muwanUser;
  let user = await User.findOne({ id: uid });
  if (!user) user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    user = await User.create({
      id: uid,
      username,
      email: email.toLowerCase(),
      fullName: username,
      avatar: picture || null,
      provider: provider || "email",
      isSuspended: false,
    });
  }
  return user;
}

router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const result = await muwanPost("/auth/email/register", { username, email, password });
    if (result.status !== 201) return res.status(result.status).json({ message: result.body.error || "Registration failed" });
    const { token, user: muwanUser } = result.body;
    await syncUser(muwanUser);
    res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none", maxAge: 7*24*60*60*1000 });
    res.status(201).json({ token, user: { id: muwanUser.uid, username: muwanUser.username, email: muwanUser.email } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await muwanPost("/auth/email/login", { email, password });
    if (result.status !== 200) return res.status(result.status).json({ message: result.body.error || "Login failed" });
    const { token, user: muwanUser } = result.body;
    const localUser = await syncUser(muwanUser);
    res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none", maxAge: 7*24*60*60*1000 });
    res.json({ token, user: { id: muwanUser.uid, username: localUser.username, email: localUser.email, fullName: localUser.fullName, avatar: localUser.avatar } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/google", async (req, res) => {
  try {
    const { idToken } = req.body;
    const result = await muwanPost("/auth/google/android", { idToken });
    if (result.status !== 200) return res.status(result.status).json({ message: result.body.error || "Google auth failed" });
    const { token } = result.body;
    const decoded = jwt.decode(token);
    const localUser = await syncUser({ uid: decoded.uid, email: decoded.email, username: decoded.username, provider: "google" });
    res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none", maxAge: 7*24*60*60*1000 });
    res.json({ token, user: { id: decoded.uid, username: localUser.username, email: localUser.email, fullName: localUser.fullName, avatar: localUser.avatar } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/google-mobile", async (req, res) => {
  try {
    const { idToken } = req.body;
    const result = await muwanPost("/auth/google/android", { idToken });
    if (result.status !== 200) return res.status(result.status).json({ message: result.body.error || "Google auth failed" });
    const { token } = result.body;
    const decoded = jwt.decode(token);
    const localUser = await syncUser({ uid: decoded.uid, email: decoded.email, username: decoded.username, provider: "google" });
    res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none", maxAge: 7*24*60*60*1000 });
    res.json({ token, user: { id: decoded.uid, username: localUser.username, email: localUser.email, fullName: localUser.fullName, avatar: localUser.avatar } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out" });
});

router.get("/me", async (req, res) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const uid = decoded.uid || decoded.id;
    const user = await User.findOne({ id: uid });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user: { id: user.id, username: user.username, email: user.email, fullName: user.fullName, avatar: user.avatar } });
  } catch { res.status(401).json({ message: "Session expired" }); }
});

router.get("/login-history", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const uid = decoded.uid || decoded.id;
    const user = await User.findOne({ id: uid });
    res.json({ loginHistory: user?.loginHistory || [] });
  } catch { res.status(401).json({ message: "Unauthorized" }); }
});

module.exports = router;
