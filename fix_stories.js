const fs = require('fs');
let code = fs.readFileSync('./routes/stories.js', 'utf8');

// Fix 1: GET stories feed - $gt filter hatao
code = code.replace(
  /const stories = await Story\.find\(\{[\s\S]*?expiresAt[\s\S]*?\}\)[\s\S]*?\.sort[\s\S]*?;/m,
  `const allStories = await Story.find({}).sort({ createdAt: -1 });
    const now = new Date().toISOString();
    const stories = allStories.filter(s => s.expiresAt > now);`
);

fs.writeFileSync('./routes/stories.js', code);
console.log('Done!');
