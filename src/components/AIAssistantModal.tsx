import React, { useState } from "react";
import { Sparkles, Loader2, X } from "lucide-react";

interface AIAssistantProps {
  context: string;
  itemNames: string[];
  onSearchTerms: (terms: string[]) => void;
  onAddItems?: (items: any[]) => void;
}

export default function AIAssistantModal({ context, itemNames, onSearchTerms, onAddItems }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, context, itemNames })
      });

      if (!response.ok) {
        throw new Error("Failed to process request");
      }

      const data = await response.json();
      
      if (data.action === "search" && data.searchTerms) {
        onSearchTerms(data.searchTerms);
        setIsOpen(false);
        setPrompt("");
      } else if (data.action === "add" && data.newItems && onAddItems) {
        onAddItems(data.newItems);
        setIsOpen(false);
        setPrompt("");
      } else {
        // Fallback if action is add but onAddItems is not provided (e.g. recipes view)
        if (data.action === "add" && !onAddItems) {
          setError("Adding items is not supported in this view. Please try searching instead.");
        } else {
          setError("I couldn't understand that request. Please try rephrasing.");
        }
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="bg-emerald-600 text-white px-4 py-3 flex items-center justify-center gap-2 hover:bg-black/90 transition-colors cursor-pointer text-xs font-bold whitespace-nowrap"
      >
        <Sparkles className="h-4 w-4" />
        AI Assist
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white border-2 border-neutral-200 w-full max-w-lg shadow-[8px_8px_0_0_#141414]">
            <div className="flex justify-between items-center border-b-2 border-neutral-200 p-4 bg-[#f0efeb]">
              <h3 className="font-bold text-neutral-900 flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-amber-500" />
                AI Assistant
              </h3>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-neutral-900/50 hover:text-neutral-900 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 p-3 text-xs border border-red-200 font-medium">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold text-neutral-900 mb-2">
                  What would you like to do?
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={onAddItems 
                    ? "e.g. 'Show me all the dairy products' or 'Add 10 bags of carrots for $20'"
                    : "e.g. 'Show me chicken and beef recipes'"
                  }
                  className="w-full bg-neutral-50 border border-neutral-200 p-3 text-sm font-medium focus:outline-hidden min-h-[100px] resize-none"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 border border-neutral-200 text-xs font-bold hover:bg-neutral-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!prompt.trim() || isProcessing}
                  className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold hover:bg-black/90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Submit"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
