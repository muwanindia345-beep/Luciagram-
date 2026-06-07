const fs = require('fs');
let code = fs.readFileSync('models/index.js', 'utf8');

// Fix INSERT syntax for MuwanDB
code = code.replace(
`    create: async (doc) => {
      const rowData = toRow(doc);
      const cols = Object.keys(rowData).join(", ");
      const vals = Object.values(rowData).map(v => \`'\${v}'\`).join(", ");
      const rows = await runQuery(\`INSERT INTO \${table} (\${cols}) VALUES (\${vals}) RETURNING *\`);`,
`    create: async (doc) => {
      const rowData = toRow(doc);
      const vals = Object.values(rowData).join(" ");
      const rows = await runQuery(\`INSERT INTO \${table} (\${vals})\`);`
);

fs.writeFileSync('models/index.js', code);
console.log('Done!');
