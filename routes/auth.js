const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { Users } = require('../models');

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;
    const users = Users();
    if (users.findOne({ email })) return res.status(400).json({ message: 'Email already exists' });
    if (users.findOne({ username })) return res.status(400).json({ message: 'Username taken' });
    const hashed = await bcrypt.hash(password, 10);
    const user = users.insert({ id: uuidv4(), username, email, password: hashed, fullName, bio: '', avatar: '', isPrivate: false, isVerified: false, createdAt: new Date() });
    const token = jwt.sign({ id: user.id, username }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user.id, username, email, fullName } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = Users().findOne({ email });
    if (!user) return res.status(400).json({ message: 'User not found' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: 'Invalid password' });
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, fullName: user.fullName, avatar: user.avatar } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
