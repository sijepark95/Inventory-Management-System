const fs = require('fs');
const path = require('path');
const p = path.resolve(__dirname, 'src/components/RecipesView.tsx');
let code = fs.readFileSync(p, 'utf8');

const regex = /<td className="px-3 py-2\.5 text-right font-mono font-bold text-neutral-900 border-r border-neutral-200">\s*<div className="flex items-center justify-end gap-1\.5">\s*<input[^>]+>\s*<span[^>]+>\{getBaseUnitLabel\(ing\)\}<\/span>\s*<\/div>\s*\{ing && \(hasCustomUnit \|\| ing\.weightPerCase\) && \(\s*<span[^>]+>\s*≈[^<]+<>[^<]+<\/>[^<]+<>[^<]+<\/>[^<]+\s*<\/span>\s*\)\}\s*<\/td>/;

// Wait, the inner structure of the `≈` span uses ternary operators and JSX blocks which are hard to regex exactly.
