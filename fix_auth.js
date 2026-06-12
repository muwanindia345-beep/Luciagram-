const fs = require('fs');
let c = fs.readFileSync('routes/auth.js', 'utf8');
const old = `const token = jwt.sign({ id: user.id, username }, process.env.JWT_SECRET, { expiresIn: "7d" });`;
const neu = `if (!user) return res.status(500).json({ message: 'Account creation failed, try again' });\n    const token = jwt.sign({ id: user.id, username }, process.env.JWT_SECRET, { expiresIn: "7d" });`;
c = c.replace(old, neu);
fs.writeFileSync('routes/auth.js', c);
console.log('Done:', c.includes('Account creation failed') ? 'SUCCESS' : 'NOT FOUND');
