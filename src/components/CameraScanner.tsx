import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

interface CameraScannerProps {
  onCapture: (base64Image: string) => void;
  onClose: () => void;
  isProcessing: boolean;
  language: "en" | "es";
}

export function CameraScanner({ onCapture, onClose, isProcessing, language }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCameraError, setHasCameraError] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        activeStream = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (error) {
        console.error("Camera error:", error);
        setHasCameraError(true);
      }
    }
    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Convert to base64 jpeg
      const base64Image = canvas.toDataURL('image/jpeg', 0.8);
      onCapture(base64Image);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-neutral-700"
      >
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h3 className="text-white font-bold flex items-center gap-2">
            <Camera className="h-5 w-5 text-emerald-500" />
            {language === "es" ? "Escanear artículo" : "Scan Item"}
          </h3>
          <button 
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="relative bg-black aspect-square sm:aspect-video flex items-center justify-center overflow-hidden">
          {hasCameraError ? (
            <div className="text-center p-6">
              <Camera className="h-12 w-12 text-neutral-600 mx-auto mb-2" />
              <p className="text-red-400 font-bold mb-1">
                {language === "es" ? "Error de cámara" : "Camera Error"}
              </p>
              <p className="text-neutral-500 text-sm">
                {language === "es" 
                  ? "No se pudo acceder a la cámara. Por favor verifique los permisos."
                  : "Could not access camera. Please check permissions."}
              </p>
            </div>
          ) : (
            <>
              <video 
                ref={videoRef}
                autoPlay 
                playsInline 
                muted
                className={`min-w-full min-h-full object-cover ${isProcessing ? 'opacity-50 grayscale' : ''}`}
              />
              {/* Scan overlay guides */}
              <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
                <div className="w-full h-full border-2 border-dashed border-emerald-500/50 rounded-lg"></div>
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </>
          )}

          {isProcessing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
              <RefreshCw className="h-10 w-10 text-emerald-500 animate-spin mb-3" />
              <p className="text-white font-bold text-sm">
                {language === "es" ? "Reconociendo artículo..." : "Recognizing item..."}
              </p>
            </div>
          )}
        </div>

        <div className="p-4 bg-neutral-900 border-t border-neutral-800 flex justify-center">
          <button
            onClick={handleCapture}
            disabled={hasCameraError || isProcessing}
            className="w-16 h-16 rounded-full bg-emerald-600 border-4 border-emerald-900 flex items-center justify-center hover:bg-emerald-500 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            <Camera className="h-6 w-6 text-white" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
