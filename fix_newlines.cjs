const fs = require('fs');
let content = fs.readFileSync('src/components/AIParserView.tsx', 'utf8');

content = content.replace('import { Shield, Camera } from "lucide-react";\\nimport { CameraScanner } from "./CameraScanner";',
`import { Shield, Camera, Upload, FolderOpen, Sparkles } from "lucide-react";
import { CameraScanner } from "./CameraScanner";`);

content = content.replace('\\n  const handleFileChange', '\n  const handleFileChange');

fs.writeFileSync('src/components/AIParserView.tsx', content);
