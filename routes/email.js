const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { loadUsers, saveUsers } = require('../middleware/storage');
const { generateToken } = require('../middleware/jwt');

router.post('/register', async (req, res) => {
    try {
        const { username, email, password, fullName } = req.body;
        if (!username || !email || !password)
            return res.status(400).json({ error: 'username, email, password required' });
        if (password.length < 6)
            return res.status(400).json({ error: 'Password min 6 characters' });

        const users = await loadUsers();
        const exists = Object.values(users).find(
            u => u.email === email || u.username === username
        );
        if (exists)
            return res.status(409).json({ error: 'Email or username already exists' });

        const hashedPassword = await bcrypt.hash(password, 12);
        const uid = uuidv4();

        users[uid] = {
            uid, username,
            email,
            fullName: fullName || username,
            hashedPassword,
            emailVerified: true,
            createdAt: new Date().toISOString(),
            provider: 'email'
        };

        await saveUsers(users);

        const token = generateToken({ uid, email, username, fullName: fullName || username, provider: 'email' });

        return res.status(201).json({
            success: true,
            message: 'Account created!',
            token,
            user: { uid, username, email, fullName: fullName || username, emailVerified: true }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ error: 'email and password required' });

        const users = await loadUsers();
        const user  = Object.values(users).find(u => u.email === email);

        if (!user)
            return res.status(401).json({ error: 'Invalid email or password' });

        const valid = await bcrypt.compare(password, user.hashedPassword);
        if (!valid)
            return res.status(401).json({ error: 'Invalid email or password' });

        // Password same rehta hai — naya hash nahi banta
        const token = generateToken({
            uid:      user.uid,
            email,
            username: user.username,
            fullName: user.fullName || user.username,
            provider: 'email'
        });

        return res.json({
            success: true,
            token,
            user: {
                uid:      user.uid,
                username: user.username,
                fullName: user.fullName || user.username,
                email,
                provider: 'email'
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/forgot', async (req, res) => {
    return res.status(503).json({
        error: 'Password reset not available',
        message: 'Contact admin or use Google login'
    });
});

module.exports = router;
