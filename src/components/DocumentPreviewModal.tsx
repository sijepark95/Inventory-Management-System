import React, { useState } from "react";
import { X, Download, ExternalLink, ZoomIn, ZoomOut, RotateCw, FileText, Image as ImageIcon, Receipt, Building2, Calendar, FileDigit } from "lucide-react";
import { isImageFile, isPdfFile, formatFileSize, downloadFile } from "../lib/fileHelper";
import { Invoice } from "../types";

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
  title?: string;
  subtitle?: string;
  invoiceData?: Invoice;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  fileUrl,
  fileName,
  fileType,
  fileSize,
  title,
  subtitle,
  invoiceData,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!isOpen || !fileUrl) return null;

  const isImg = isImageFile(fileType, fileName) || fileUrl.startsWith("data:image/");
  const isPdf = isPdfFile(fileType, fileName) || fileUrl.startsWith("data:application/pdf");

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  const handleOpenInNewTab = () => {
    const win = window.open();
    if (win) {
      if (isImg) {
        win.document.write(`<body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;height:100vh;"><img src="${fileUrl}" style="max-width:100%;max-height:100%;object-fit:contain;"/></body>`);
      } else {
        win.location.href = fileUrl;
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className={`bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col w-full h-[92vh] max-h-[900px] overflow-hidden ${invoiceData ? 'max-w-7xl' : 'max-w-5xl'}`}>
        
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-neutral-950 border-b border-neutral-800 text-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              {isImg ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-white truncate">
                {title || fileName}
              </h3>
              <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono">
                <span className="truncate">{fileName}</span>
                {fileSize ? (
                  <>
                    <span>•</span>
                    <span>{formatFileSize(fileSize)}</span>
                  </>
                ) : null}
                {subtitle ? (
                  <>
                    <span>•</span>
                    <span className="text-emerald-400 font-medium">{subtitle}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {/* Action controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isImg && (
              <div className="hidden sm:flex items-center bg-neutral-800 rounded-lg p-0.5 border border-neutral-700 mr-2">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="p-1.5 hover:bg-neutral-700 rounded text-neutral-300 hover:text-white transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono px-1.5 text-neutral-400">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="p-1.5 hover:bg-neutral-700 rounded text-neutral-300 hover:text-white transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleRotate}
                  className="p-1.5 hover:bg-neutral-700 rounded text-neutral-300 hover:text-white transition-colors ml-1"
                  title="Rotate 90°"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg border border-neutral-700 transition-colors"
              title="Open in new window"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => downloadFile(fileUrl, fileName)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
              title="Download File"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-lg transition-colors ml-1"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Modal Body Preview Area */}
          <div className="flex-1 bg-neutral-950 overflow-auto flex items-center justify-center p-4 relative">
            {isImg ? (
              <div className="overflow-auto w-full h-full flex items-center justify-center">
                <img
                  src={fileUrl}
                  alt={fileName}
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transition: "transform 0.15s ease-out",
                    maxHeight: zoom <= 1 ? "100%" : "none",
                    maxWidth: zoom <= 1 ? "100%" : "none",
                  }}
                  className="object-contain rounded shadow-lg select-none"
                />
              </div>
            ) : isPdf ? (
              <div className="w-full h-full flex flex-col items-center justify-center">
                <iframe
                  src={fileUrl}
                  title={fileName}
                  className="w-full h-full rounded border border-neutral-800 bg-white"
                />
              </div>
            ) : (
              <div className="text-center p-8 bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md">
                <FileText className="w-12 h-12 text-neutral-500 mx-auto mb-3" />
                <h4 className="font-bold text-white text-base mb-1">{fileName}</h4>
                <p className="text-xs text-neutral-400 mb-4">
                  This document is saved with this invoice ({formatFileSize(fileSize)}).
                </p>
                <button
                  type="button"
                  onClick={() => downloadFile(fileUrl, fileName)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg inline-flex items-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Original File
                </button>
              </div>
            )}
          </div>

          {/* Right Details Panel */}
          {invoiceData && (
            <div className="w-80 md:w-96 bg-neutral-900 border-l border-neutral-800 flex flex-col shrink-0 overflow-y-auto">
              <div className="p-5 border-b border-neutral-800">
                <h4 className="text-white font-bold flex items-center gap-2 mb-4">
                  <Receipt className="w-4 h-4 text-emerald-400" />
                  Invoice Details
                </h4>
                
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Building2 className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-neutral-500 font-medium">Vendor</p>
                      <p className="text-sm text-neutral-200 font-semibold">{invoiceData.vendor || "N/A"}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <FileDigit className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-neutral-500 font-medium">Invoice Number</p>
                      <p className="text-sm text-neutral-200 font-mono">{invoiceData.invoiceNumber || "N/A"}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-neutral-500 font-medium">Issue Date</p>
                      <p className="text-sm text-neutral-200">{invoiceData.issueDate || "N/A"}</p>
                    </div>
                  </div>
                  
                  {invoiceData.totalAmount !== undefined && (
                    <div className="mt-4 p-3 bg-neutral-800/50 rounded-lg border border-neutral-700/50 flex items-center justify-between">
                      <span className="text-sm text-neutral-300 font-medium">Total Amount</span>
                      <span className="text-lg font-bold text-emerald-400 font-mono">
                        ${invoiceData.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-5 flex-1 overflow-auto">
                <h5 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span>Line Items</span>
                  <span className="bg-neutral-800 px-2 py-0.5 rounded text-[10px]">{invoiceData.items?.length || 0}</span>
                </h5>
                
                {(!invoiceData.items || invoiceData.items.length === 0) ? (
                  <p className="text-sm text-neutral-500 italic">No line items recorded.</p>
                ) : (
                  <ul className="space-y-2">
                    {invoiceData.items.map((item, idx) => (
                      <li key={idx} className="p-3 bg-neutral-800/30 rounded-lg border border-neutral-800 hover:border-neutral-700 transition-colors">
                        <div className="flex justify-between items-start mb-1 gap-2">
                          <span className="text-sm font-medium text-neutral-200 leading-snug">{item.name}</span>
                          <span className="text-sm font-bold text-neutral-300 font-mono shrink-0">
                            ${Number(item.totalPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-neutral-500 font-mono">
                          <span>Qty: {item.quantity} {item.unit}</span>
                          {item.pricePerUnit ? (
                            <span>@ ${Number(item.pricePerUnit).toLocaleString(undefined, { minimumFractionDigits: 2 })}/{item.unit}</span>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Status Bar */}
        <div className="px-4 py-2 bg-neutral-950 border-t border-neutral-800 text-[11px] font-mono text-neutral-400 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Saved in Invoice Archive</span>
          </div>
          {isImg && (
            <button
              type="button"
              onClick={handleReset}
              className="text-neutral-400 hover:text-white underline cursor-pointer"
            >
              Reset Zoom
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
