const fs = require('fs');
let content = fs.readFileSync('src/components/AIParserView.tsx', 'utf8');

if (!content.includes('import { CameraScanner }')) {
  content = content.replace('import { Shield, Camera } from "lucide-react";', 'import { Shield, Camera, Upload, FolderOpen, Sparkles } from "lucide-react";');
  content = content.replace('import { Shield } from "lucide-react";', 'import { Shield, Camera } from "lucide-react";\\nimport { CameraScanner } from "./CameraScanner";');
}

// Add state for camera if not there
if (!content.includes('const [showCamera, setShowCamera]')) {
  content = content.replace(
    /const \[dragActive, setDragActive\] = useState\(false\);/,
    'const [dragActive, setDragActive] = useState(false);\n  const [showCamera, setShowCamera] = useState(false);'
  );
}

const cameraBtnStr = `
                <button 
                  onClick={() => setShowCamera(true)}
                  disabled={isReadOnly}
                  className={\`px-6 py-3 rounded-xl font-bold text-[14px] flex items-center gap-2 transition-all \${
                    isReadOnly 
                      ? "bg-neutral-200 text-neutral-500 cursor-not-allowed" 
                      : "bg-white border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 text-neutral-700 shadow-sm"
                  }\`}
                >
                  <Camera className="w-4 h-4 text-emerald-600" /> Take Picture
                </button>`;

const selectFilesStr = `                  <FolderOpen className="w-4 h-4" /> Select Files
                </button>`;

if (!content.includes('Take Picture')) {
  content = content.replace(selectFilesStr, selectFilesStr + cameraBtnStr);
}

// Add modal
const modalStr = `{showCamera && (
        <CameraScanner
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
          isProcessing={false}
          language="en"
        />
      )}`;

if (!content.includes('<CameraScanner')) {
  content = content.replace('{showDuplicatePrompt && (', modalStr + '\\n      {showDuplicatePrompt && (');
}

fs.writeFileSync('src/components/AIParserView.tsx', content);
