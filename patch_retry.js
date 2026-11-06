const fs = require('fs');
const file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

const targetContent = `  const supportedFallbacks = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];`;
const replacementContent = `  const supportedFallbacks = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-flash-latest", "gemini-1.5-flash", "gemini-3.1-flash-lite", "gemini-3.1-pro-preview"];`;

content = content.replace(targetContent, replacementContent);
fs.writeFileSync(file, content);
