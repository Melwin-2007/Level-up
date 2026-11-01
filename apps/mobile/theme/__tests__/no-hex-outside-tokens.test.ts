import fs from 'node:fs';
import path from 'node:path';

describe('Design System Integrity: No Hex Literals Outside theme/tokens.ts', () => {
  const mobileRoot = path.resolve(__dirname, '../..');
  const tokensFilePath = path.resolve(__dirname, '../tokens.ts');

  function scanDirectory(dir: string, filesList: string[] = []): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (
          entry.name === 'node_modules' ||
          entry.name === '.expo' ||
          entry.name === 'dist' ||
          entry.name === 'assets' ||
          entry.name === '__tests__'
        ) {
          continue;
        }
        scanDirectory(fullPath, filesList);
      } else if (
        (entry.name.endsWith('.ts') ||
          entry.name.endsWith('.tsx') ||
          entry.name.endsWith('.js') ||
          entry.name.endsWith('.jsx')) &&
        fullPath !== tokensFilePath
      ) {
        filesList.push(fullPath);
      }
    }

    return filesList;
  }

  it('should find ZERO hex color literals outside theme/tokens.ts in source code', () => {
    const filesToScan = scanDirectory(mobileRoot);
    const hexPattern = /#([0-9a-fA-F]{3,8})\b/g;
    const violations: { file: string; line: number; match: string }[] = [];

    for (const filePath of filesToScan) {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line: string, index: number) => {
        const matches = line.match(hexPattern);
        if (matches) {
          for (const match of matches) {
            violations.push({
              file: path.relative(mobileRoot, filePath),
              line: index + 1,
              match,
            });
          }
        }
      });
    }

    if (violations.length > 0) {
      const details = violations.map((v) => `  ${v.file}:${v.line} -> ${v.match}`).join('\n');
      throw new Error(
        `Hex literals found outside theme/tokens.ts:\n${details}\nAll colours must come from theme/tokens.ts tokens!`
      );
    }

    expect(violations).toHaveLength(0);
  });
});
