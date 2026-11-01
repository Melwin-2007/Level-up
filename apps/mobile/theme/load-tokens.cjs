const fs = require('node:fs');
const path = require('node:path');

function loadTokens() {
  const content = fs.readFileSync(path.resolve(__dirname, 'tokens.ts'), 'utf8');
  const colorsBlock = content.match(/export const colors = \{([\s\S]*?)\} as const;/)?.[1] || '';
  const colors = {};
  for (const line of colorsBlock.split('\n')) {
    const match = line.match(/^\s*(\w+):\s*['"]([^'"]+)['"]/);
    if (match) {
      colors[match[1]] = match[2];
    }
  }
  return { colors };
}

module.exports = { loadTokens };
