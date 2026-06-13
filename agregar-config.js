const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const TAG = '<script src="js/config.js"></script>';
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.html'));
let m = 0;
for (const file of files) {
  const fp = path.join(DIR, file);
  let html = fs.readFileSync(fp, 'utf-8');
  if (html.includes('js/config.js')) { console.log('  skip ' + file); continue; }
  const match = html.match(/<script[\s>]/);
  if (!match) continue;
  const pos = html.indexOf(match[0]);
  html = html.slice(0, pos) + TAG + '\n' + html.slice(pos);
  fs.writeFileSync(fp, html, 'utf-8');
  console.log('  done ' + file);
  m++;
}
console.log(m + ' archivos modificados');
