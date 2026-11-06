const fs = require('fs');
let content = fs.readFileSync('src/components/AIParserView.tsx', 'utf8');

if (!content.includes('import { CameraScanner }')) {
  content = content.replace('import { Shield } from "lucide-react";', 'import { Shield, Camera } from "lucide-react";\\nimport { CameraScanner } from "./CameraScanner";');
}

// Add state for camera
if (!content.includes('const [showCamera, setShowCamera]')) {
  content = content.replace(
    /const \[isDragging, setIsDragging\] = useState\(false\);/,
    'const [isDragging, setIsDragging] = useState(false);\n  const [showCamera, setShowCamera] = useState(false);'
  );
}

// Function to handle camera capture
const uploadToAPI = `
  const handleCameraCapture = async (base64Image: string) => {
    setShowCamera(false);
    
    // Convert base64 to Blob/File
    const res = await fetch(base64Image);
    const blob = await res.blob();
    const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
    
    // We can simulate a FileList
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    handleFilesAdded(dataTransfer.files);
  };
`;
if (!content.includes('const handleCameraCapture')) {
  content = content.replace(
    /const handleFileChange = \(e: React\.ChangeEvent<HTMLInputElement>\) => \{/,
    uploadToAPI + '\\n  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {'
  );
}

// Add the Camera option in the UI
// Look for "Browse Files" button
const browseFilesBtn = `                  <button 
                    onClick={() => document.getElementById('ai-batch-upload')?.click()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-colors text-sm"
                  >
                    Browse Files
                  </button>`;
                  
const cameraBtn = `                  <button 
                    onClick={() => setShowCamera(true)}
                    className="px-4 py-2 bg-white border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-bold rounded-lg shadow-sm transition-colors text-sm flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" /> Take Picture
                  </button>`;
                  
if (content.includes(browseFilesBtn) && !content.includes('Take Picture')) {
  content = content.replace(browseFilesBtn, browseFilesBtn + '\\n' + cameraBtn);
}

// Add the CameraScanner modal
const modalPlaceholder = `{showDuplicatePrompt && (`;
const cameraModal = `{showCamera && (
        <CameraScanner
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
          isProcessing={false}
          language="en"
        />
      )}
      `;

if (content.includes(modalPlaceholder) && !content.includes('<CameraScanner')) {
  content = content.replace(modalPlaceholder, cameraModal + modalPlaceholder);
}

fs.writeFileSync('src/components/AIParserView.tsx', content);
