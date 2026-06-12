const fs = require('fs');
let c = fs.readFileSync('models/index.js', 'utf8');
const old = `const toRow = (doc) => {
  const row = {};
  for (const [k, v] of Object.entries(doc)) {
    if (v !== undefined) row[snk(k)] = v;
  }
  return row;
};`;
const neu = `const toRow = (doc) => {
  const row = {};
  for (const [k, v] of Object.entries(doc)) {
    if (v !== undefined) {
      row[snk(k)] = (Array.isArray(v) || (v && typeof v === 'object' && !(v instanceof Date)))
        ? JSON.stringify(v)
        : v;
    }
  }
  return row;
};`;
c = c.replace(old, neu);
fs.writeFileSync('models/index.js', c);
console.log(c.includes('JSON.stringify(v)') ? 'SUCCESS' : 'NOT FOUND');
