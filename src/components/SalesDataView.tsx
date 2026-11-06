import React, { useState } from "react";
import * as XLSX from "xlsx";
import { Recipe, DailySale } from "../types";
import { 
  FileSpreadsheet, 
  UploadCloud, 
  Check, 
  AlertCircle, 
  Calendar, 
  ChevronRight, 
  Trash2, 
  Columns, 
  User, 
  Clock, 
  Search,
  Database,
  CheckCircle2,
  Edit,
  Save,
  X,
  AlertTriangle,
  CalendarRange
} from "lucide-react";

interface SalesUploadRecord {
  id?: string;
  fileName: string;
  fileSize: string;
  uploadedAt: string;
  uploadedBy: string;
  sheetNames: string[];
  rowCount: number;
  detectedDate: string;
  status: string;
  ownerId: string;
}

interface SalesDataViewProps {
  recipes: Recipe[];
  dailySales: DailySale[];
  salesUploads: SalesUploadRecord[];
  onAddDailySale: (item: Omit<DailySale, "id" | "ownerId" | "createdAt">) => Promise<void>;
  onDeleteDailySale: (id: string) => Promise<void>;
  onUpdateDailySale: (id: string, edits: Partial<DailySale>) => Promise<void>;
  onAddSalesUpload: (upload: Omit<SalesUploadRecord, "id" | "ownerId">) => Promise<void>;
  onDeleteSalesUpload: (id: string) => Promise<void>;
  userRole: string;
  currentUserEmail?: string;
}

interface ParsedRow {
  rawName: string;
  quantity: number;
  unitPrice: number;
  matchedRecipeId: string;
  selected: boolean;
}

export default function SalesDataView({
  recipes,
  dailySales,
  salesUploads,
  onAddDailySale,
  onDeleteDailySale,
  onUpdateDailySale,
  onAddSalesUpload,
  onDeleteSalesUpload,
  userRole,
  currentUserEmail
}: SalesDataViewProps) {
  // Parsing & File state
  const [isLoading, setIsLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Excel parsed structures
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [workbookData, setWorkbookData] = useState<any[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  
  // Column Mappings
  const [colItemName, setColItemName] = useState("");
  const [colQuantity, setColQuantity] = useState("");
  const [colUnitPrice, setColUnitPrice] = useState("");
  const [colIsTotalRevenue, setColIsTotalRevenue] = useState(false);
  
  // Ledger date
  const [ledgerDate, setLedgerDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Final review list
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isMappingConfirmed, setIsMappingConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Duplication Overwrite state
  const [overwriteExisting, setOverwriteExisting] = useState(true);

  // Inline editing state for previously uploaded sales
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(0);
  const [editPrice, setEditPrice] = useState<number>(0);

  // Filter history of uploads
  const [searchQuery, setSearchQuery] = useState("");

  // Generate last 7 days for daily upload compliance ribbon
  const getComplianceDays = () => {
    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateString = d.toISOString().split("T")[0];
      
      // Check if dailySales has any entries for this date string
      const hasSales = dailySales.some(s => s.date === dateString);
      
      days.push({
        dateString,
        dayLabel: d.toLocaleDateString("en-US", { weekday: "short" }),
        dayNum: d.getDate(),
        hasSales
      });
    }
    return days;
  };

  const handleStartInlineEdit = (sale: DailySale) => {
    if (!sale.id) return;
    setEditingSaleId(sale.id);
    setEditQuantity(sale.quantitySold);
    setEditPrice(sale.sellingPrice);
  };

  const handleSaveInlineEdit = async (sale: DailySale) => {
    if (!sale.id) return;
    const recipe = recipes.find(r => r.id === sale.recipeId);
    const unitCost = recipe?.costPerPortion || sale.costPerPortion || 0;
    
    const totalRevenue = editQuantity * editPrice;
    const totalCost = editQuantity * unitCost;
    const profit = totalRevenue - totalCost;

    try {
      await onUpdateDailySale(sale.id, {
        quantitySold: editQuantity,
        sellingPrice: editPrice,
        totalRevenue,
        totalCost,
        margin: totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0
      });
      setEditingSaleId(null);
      setSuccessMessage(`Successfully updated portion sale record for "${sale.recipeName}"!`);
      setErrorMessage("");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update portion sale record.");
    }
  };

  // Helper to match recipe name fuzzy style
  const findRecipeMatch = (excelName: string): string => {
    if (!excelName || recipes.length === 0) return "";
    const nameLower = excelName.toLowerCase().trim();
    
    // Clean common characters/quantifiers
    const cleaned = nameLower
      .replace(/[\d\(\)\.\#\-]/g, "")
      .replace(/\b(portion|portions|pcs|pc|order|orders|servings|serving|sold|qty|x)\b/g, "")
      .trim();

    if (!cleaned) return "";

    // Exact Match
    const exactMatch = recipes.find(r => r.name.toLowerCase().trim() === cleaned);
    if (exactMatch) return exactMatch.id || "";

    // Substring match
    const subMatch = recipes.find(r => 
      cleaned.includes(r.name.toLowerCase().trim()) || 
      r.name.toLowerCase().trim().includes(cleaned)
    );
    if (subMatch) return subMatch.id || "";

    // Word-by-word match (minimum word length of 4 chars)
    const words = cleaned.split(/\s+/).filter(w => w.length > 3);
    if (words.length > 0) {
      const fuzzyMatch = recipes.find(r => {
        const rName = r.name.toLowerCase();
        return words.some(word => rName.includes(word));
      });
      if (fuzzyMatch) return fuzzyMatch.id || "";
    }

    return "";
  };

  // Drag handlings
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleSelectedFile(e.target.files[0]);
    }
  };

  // Process selected file
  const handleSelectedFile = (selectedFile: File) => {
    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "xls" && ext !== "csv") {
      setErrorMessage("Unsupported file format. Please upload a valid Excel (.xlsx, .xls) or CSV file.");
      return;
    }
    setFile(selectedFile);
    setErrorMessage("");
    setSuccessMessage("");
    setIsMappingConfirmed(false);
    setParsedRows([]);
    
    // Auto-detect date from file name if possible
    const datePattern = /(\d{4}-\d{2}-\d{2})|(\d{2}-\d{2}-\d{4})|(\d{1,2}[_/-]\d{1,2}[_/-]\d{2,4})/;
    const foundDate = selectedFile.name.match(datePattern);
    if (foundDate) {
      // Simple date normalization
      const rawDate = foundDate[0].replace(/_/g, "-").replace(/\//g, "-");
      setLedgerDate(rawDate);
    }

    readSpreadsheet(selectedFile);
  };

  const readSpreadsheet = (fileObj: File) => {
    setIsLoading(true);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        setSheets(workbook.SheetNames);
        
        if (workbook.SheetNames.length > 0) {
          const firstSheet = workbook.SheetNames[0];
          setSelectedSheet(firstSheet);
          processSheet(workbook, firstSheet);
        }
      } catch (err) {
        console.error(err);
        setErrorMessage("Error reading spreadsheet file content. Please verify that the file is not corrupted.");
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setErrorMessage("Failed to read file.");
      setIsLoading(false);
    };

    reader.readAsArrayBuffer(fileObj);
  };

  const processSheet = (workbook: XLSX.WorkBook, sheetName: string) => {
    const worksheet = workbook.Sheets[sheetName];
    // Convert sheet to raw 2D array of values
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    if (rawRows.length === 0) {
      setErrorMessage(`The sheet "${sheetName}" is empty.`);
      return;
    }

    setWorkbookData(rawRows);

    // 1. Auto-extract date from the first 5 rows if found (e.g., "07/14/2026")
    let detectedDateStr = "";
    for (let r = 0; r < Math.min(rawRows.length, 5); r++) {
      if (!rawRows[r]) continue;
      for (let c = 0; c < rawRows[r].length; c++) {
        const valStr = String(rawRows[r][c] || "");
        // Match MM/DD/YYYY or YYYY-MM-DD
        const match = valStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
        if (match) {
          const month = parseInt(match[1]);
          const day = parseInt(match[2]);
          let year = parseInt(match[3]);
          if (year < 100) year += 2000;
          detectedDateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          break;
        }
      }
      if (detectedDateStr) break;
    }
    if (detectedDateStr) {
      setLedgerDate(detectedDateStr);
    }

    // Find first row that has several entries to serve as headers
    let headerIndex = 0;
    for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
      if (rawRows[i] && rawRows[i].filter(val => val !== null && val !== undefined && val !== "").length > 1) {
        headerIndex = i;
        break;
      }
    }

    const rawHeaders = rawRows[headerIndex] || [];
    const cleanedHeaders = rawHeaders.map((h, idx) => (h ? String(h).trim() : `Column ${idx + 1}`));
    setHeaders(cleanedHeaders);

    // Dynamic fuzzy mapping detection
    let matchedItemName = "";
    let matchedQty = "";
    let matchedPrice = "";

    cleanedHeaders.forEach((h) => {
      const hl = h.toLowerCase();
      // Item Name fuzzy matches
      if (!matchedItemName && (hl.includes("item") || hl.includes("recipe") || hl.includes("product") || hl.includes("description") || hl.includes("name") || hl.includes("article"))) {
        matchedItemName = h;
      }
      // Quantity fuzzy matches
      if (!matchedQty && (hl.includes("qty") || hl.includes("quantity") || hl.includes("sold") || hl.includes("count") || hl.includes("volume") || hl.includes("portions"))) {
        matchedQty = h;
      }
      // Price / Total Sales fuzzy matches: include 'sales' if it doesn't represent quantity or discount
      if (!matchedPrice && (hl.includes("price") || hl.includes("rate") || hl.includes("selling") || hl.includes("amount") || hl.includes("value") || (hl.includes("sales") && !hl.includes("volume") && !hl.includes("discount")))) {
        matchedPrice = h;
      }
    });

    const finalItemCol = matchedItemName || cleanedHeaders[0] || "";
    const finalQtyCol = matchedQty || cleanedHeaders[1] || "";
    const finalPriceCol = matchedPrice || cleanedHeaders[2] || "";

    // Fallbacks
    setColItemName(finalItemCol);
    setColQuantity(finalQtyCol);
    setColUnitPrice(finalPriceCol);

    // Auto-detect if Price/Sales column represents Total Sales Revenue instead of Unit Price
    if (finalPriceCol) {
      const fpl = finalPriceCol.toLowerCase();
      if (fpl === "sales" || fpl === "revenue" || fpl.includes("subtotal") || fpl.includes("total")) {
        setColIsTotalRevenue(true);
      } else {
        setColIsTotalRevenue(false);
      }
    } else {
      setColIsTotalRevenue(false);
    }
  };

  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "array" });
          processSheet(workbook, sheetName);
        } catch (err) {
          console.error(err);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // Convert raw rows to mapped values
  const handleMapColumns = () => {
    if (!colItemName || !colQuantity) {
      setErrorMessage("Please map at least the Item Name and Quantity Sold columns to continue.");
      return;
    }

    const nameIdx = headers.indexOf(colItemName);
    const qtyIdx = headers.indexOf(colQuantity);
    const priceIdx = colUnitPrice ? headers.indexOf(colUnitPrice) : -1;

    // Find header index to skip metadata rows above it
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(workbookData.length, 10); i++) {
      if (workbookData[i] && workbookData[i].map(v => v ? String(v).trim() : "").includes(colItemName)) {
        headerRowIdx = i;
        break;
      }
    }

    const rowsToProcess = workbookData.slice(headerRowIdx + 1);
    const tempRows: ParsedRow[] = [];

    rowsToProcess.forEach((row) => {
      const rawNameVal = row[nameIdx];
      const rawQtyVal = row[qtyIdx];
      const rawPriceVal = priceIdx !== -1 ? row[priceIdx] : null;

      if (!rawNameVal) return; // skip rows with empty names

      const rawName = String(rawNameVal).trim();
      if (rawName === "" || rawName.toLowerCase() === "total" || rawName.toLowerCase() === "grand total") return;

      // Parse quantity
      const quantity = Math.abs(parseFloat(String(rawQtyVal).replace(/[^\d\.]/g, "")) || 0);
      if (quantity === 0) return; // skip items with zero quantities sold

      // Parse unit selling price
      let unitPrice = 0;
      if (rawPriceVal !== null && rawPriceVal !== undefined) {
        const rawNum = parseFloat(String(rawPriceVal).replace(/[^\d\.]/g, "")) || 0;
        if (colIsTotalRevenue && quantity > 0) {
          unitPrice = rawNum / quantity;
        } else {
          unitPrice = rawNum;
        }
      }

      const autoRecipeId = findRecipeMatch(rawName);
      
      // If no unit price parsed, and we found a matched recipe, default to recipe's standard selling price!
      let resolvedPrice = unitPrice;
      if (resolvedPrice === 0 && autoRecipeId) {
        const recipeObj = recipes.find(r => r.id === autoRecipeId);
        if (recipeObj) {
          resolvedPrice = recipeObj.sellingPrice;
        }
      }

      tempRows.push({
        rawName,
        quantity,
        unitPrice: resolvedPrice,
        matchedRecipeId: autoRecipeId,
        selected: true // Keep checked by default so we store every single thing
      });
    });

    if (tempRows.length === 0) {
      setErrorMessage("No valid sales rows found. Please make sure the selected column headers contain active data rows.");
      return;
    }

    setParsedRows(tempRows);
    setIsMappingConfirmed(true);
    setErrorMessage("");
    setSuccessMessage(`Parsed ${tempRows.length} active item records from the sheet. Review their mappings below.`);
  };

  // Record everything to state/database
  const handleSaveSalesLedger = async () => {
    const selectedRows = parsedRows.filter(r => r.selected);
    if (selectedRows.length === 0) {
      setErrorMessage("Please select at least one row to record.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      // Clean up previous portion sales for this date if overwrite is enabled to prevent duplication/double uploads
      if (overwriteExisting) {
        const existingSalesForDate = dailySales.filter(s => s.date === ledgerDate);
        for (const s of existingSalesForDate) {
          if (s.id) {
            await onDeleteDailySale(s.id);
          }
        }
      }

      let savedCount = 0;

      // Save each portion sales record
      for (const row of selectedRows) {
        const recipe = recipes.find(r => r.id === row.matchedRecipeId);

        const totalRevenue = row.quantity * row.unitPrice;
        const totalCost = recipe ? row.quantity * (recipe.costPerPortion || 0) : 0;
        const profit = totalRevenue - totalCost;
        const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

        // Ensure fallback recipeId meets rule pattern: alphanumeric string <= 200 chars
        const safeRecipeId = row.matchedRecipeId || "unmapped_" + row.rawName.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 50);

        await onAddDailySale({
          date: ledgerDate,
          recipeId: safeRecipeId,
          recipeName: recipe ? recipe.name : row.rawName,
          quantitySold: row.quantity,
          sellingPrice: row.unitPrice,
          costPerPortion: recipe ? (recipe.costPerPortion || 0) : 0,
          totalRevenue,
          totalCost,
          margin
        });
        savedCount++;
      }

      // Record spreadsheet upload metadata to keep history
      if (file) {
        await onAddSalesUpload({
          fileName: file.name,
          fileSize: `${(file.size / 1024).toFixed(1)} KB`,
          uploadedAt: new Date().toISOString(),
          uploadedBy: currentUserEmail || "Manager",
          sheetNames: sheets,
          rowCount: parsedRows.length,
          detectedDate: ledgerDate,
          status: "processed"
        });
      }

      setSuccessMessage(`Successfully uploaded sales spreadsheet and logged ${savedCount} portion sales entries for ${ledgerDate}!`);
      
      // Reset uploader
      setFile(null);
      setWorkbookData([]);
      setHeaders([]);
      setParsedRows([]);
      setIsMappingConfirmed(false);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to record daily spreadsheet records to the active ledger.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter spreadsheet logs history
  const filteredHistory = salesUploads.filter(u => {
    const q = searchQuery.toLowerCase();
    return (
      u.fileName.toLowerCase().includes(q) ||
      u.uploadedBy.toLowerCase().includes(q) ||
      u.detectedDate.includes(q)
    );
  });

  return (
    <div className="space-y-8 text-neutral-900" id="sales-data-view">
      
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-neutral-200/60 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            <span>Daily Sales Spreadsheet Logs</span>
          </h2>
          <p className="text-neutral-500 text-xs mt-1 max-w-2xl">
            Upload terminal spreadsheet logs (.xlsx, .csv) to automatically map items to recipes, record portion volumes, and persist daily gross profit metadata securely.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-neutral-100 border border-neutral-200/80 px-3.5 py-1.5 rounded-xl text-[11px] font-mono">
            <User className="h-3.5 w-3.5 text-neutral-400" />
            <span className="text-neutral-600">{currentUserEmail || "Anonymous"}</span>
            <span className="bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.2 rounded uppercase text-[8px]">
              {userRole}
            </span>
          </div>
        </div>
      </div>

      {/* DAILY UPLOAD COMPLIANCE RIBBON */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm" id="compliance-tracker">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
              <CalendarRange className="h-4 w-4 text-emerald-600" />
              <span>Daily Upload Compliance Monitor</span>
            </h3>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Tracks daily portion sales uploads. Click any date below to quickly inspect or upload sales for that specific ledger date.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-neutral-500 bg-neutral-50 border border-neutral-200 px-2.5 py-1 rounded-lg shrink-0">
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            <span>Green = Logged</span>
            <span className="flex h-1.5 w-1.5 rounded-full bg-amber-500 ml-2"></span>
            <span>Amber = Missing Upload</span>
          </div>
        </div>

        {/* Calendar Horizontal Streak cards */}
        <div className="grid grid-cols-7 gap-2">
          {getComplianceDays().map((day) => {
            const isActive = ledgerDate === day.dateString;
            return (
              <button
                key={day.dateString}
                onClick={() => {
                  setLedgerDate(day.dateString);
                  setSuccessMessage("");
                  setErrorMessage("");
                }}
                className={`p-2 rounded-xl border transition-all text-center flex flex-col justify-between items-center relative overflow-hidden group cursor-pointer ${
                  isActive
                    ? "bg-emerald-600/10 border-emerald-500 shadow-xs scale-[1.02] ring-1 ring-emerald-500/50"
                    : "bg-neutral-50/50 hover:bg-neutral-100/80 border-neutral-200"
                }`}
              >
                {/* Small indicator circle in the corner */}
                <span className={`absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full ${
                  day.hasSales ? "bg-emerald-500" : "bg-amber-500"
                }`} />

                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wide">
                  {day.dayLabel}
                </span>
                <span className={`text-sm font-extrabold my-0.5 ${
                  isActive ? "text-emerald-700 scale-105" : "text-neutral-700"
                }`}>
                  {day.dayNum}
                </span>

                <div className="flex items-center gap-0.5 mt-0.5">
                  {day.hasSales ? (
                    <span className="text-[8px] font-bold text-emerald-600 uppercase flex items-center gap-0.5">
                      <Check className="h-2 w-2 stroke-[3]" />
                      <span>Logged</span>
                    </span>
                  ) : (
                    <span className="text-[8px] font-bold text-amber-600 uppercase flex items-center gap-0.5">
                      <AlertTriangle className="h-2 w-2 stroke-[3]" />
                      <span>Missing</span>
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* FLASH MESSAGES */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3" id="sales-error-alert">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="text-xs font-medium text-rose-800">{errorMessage}</div>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3" id="sales-success-alert">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="text-xs font-medium text-emerald-800">{successMessage}</div>
        </div>
      )}

      {/* CORE WORKSPACE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: UPLOADER & MAPPINGS (COL-SPAN 2) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* UPLOAD PANEL */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-4 pb-3 border-b border-neutral-100">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <UploadCloud className="h-4 w-4 text-emerald-600" />
                <span>1. Upload Spreadsheet File</span>
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Target Ledger Date:</span>
                <input
                  type="date"
                  value={ledgerDate}
                  onChange={(e) => {
                    setLedgerDate(e.target.value);
                    setSuccessMessage("");
                    setErrorMessage("");
                  }}
                  className="text-xs border border-neutral-200 rounded-lg px-2 py-1 bg-white font-medium focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            {dailySales.filter(s => s.date === ledgerDate).length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 mb-4 shadow-xs">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-850 leading-relaxed">
                  <span className="font-bold">Duplicate Entry Safeguard: </span>
                  There are already <strong className="text-amber-950 font-extrabold">{dailySales.filter(s => s.date === ledgerDate).length}</strong> portion sale records saved for <strong className="font-extrabold">{ledgerDate}</strong>.
                  <label className="flex items-center gap-2 mt-2 font-bold cursor-pointer text-emerald-850 hover:text-emerald-950 select-none bg-emerald-100/50 p-1.5 rounded border border-emerald-200/50 w-fit">
                    <input
                      type="checkbox"
                      checked={overwriteExisting}
                      onChange={(e) => setOverwriteExisting(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                    />
                    <span>Overwrite & clean duplicates when importing new sheet</span>
                  </label>
                </div>
              </div>
            )}

            {/* DRAG AND DROP TARGET */}
            {!file ? (
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all ${
                  dragActive 
                    ? "border-emerald-500 bg-emerald-50/50" 
                    : "border-neutral-200 hover:border-neutral-300 bg-neutral-50/30"
                }`}
                id="sales-file-dropzone"
              >
                <div className="bg-white p-3 border border-neutral-200 shadow-xs mb-3 text-emerald-600">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <p className="text-xs font-semibold text-neutral-800 mb-1">
                  Drag and drop your Excel or CSV sales sheet here
                </p>
                <p className="text-[10px] text-neutral-500 mb-4 font-mono">
                  Supports .xlsx, .xls, .csv up to 10MB
                </p>
                
                <label className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-4 py-2 rounded-xl border border-emerald-700 cursor-pointer shadow-xs hover:shadow-sm transition-all">
                  Browse Files
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
            ) : (
              /* ACTIVE FILE INFO */
              <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-xl space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 text-emerald-700 p-2.5 rounded-lg border border-emerald-200">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-neutral-900 truncate max-w-[280px]">
                        {file.name}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono text-neutral-500 bg-neutral-200/50 px-1.5 py-0.2 rounded">
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                        {sheets.length > 0 && (
                          <span className="text-[10px] font-mono text-neutral-500 bg-neutral-200/50 px-1.5 py-0.2 rounded">
                            {sheets.length} sheet(s)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setFile(null);
                      setWorkbookData([]);
                      setHeaders([]);
                      setParsedRows([]);
                      setIsMappingConfirmed(false);
                      setSuccessMessage("");
                    }}
                    className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 border border-neutral-200 rounded-lg"
                    title="Remove File"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Ledgers Selection & Sheets selector */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-neutral-200/60">
                  
                  {/* Ledger Date confirmation */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider block">
                      Ledger Sales Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
                      <input
                        type="date"
                        value={ledgerDate}
                        onChange={(e) => setLedgerDate(e.target.value)}
                        className="w-full text-xs border border-neutral-200 rounded-xl pl-9 pr-3 py-2 bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium"
                      />
                    </div>
                    <span className="text-[9px] text-neutral-500 italic block">
                      Verify the date matches your Excel transaction logs.
                    </span>
                  </div>

                  {/* Active worksheet selector */}
                  {sheets.length > 1 && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider block">
                        Select Worksheet
                      </label>
                      <select
                        value={selectedSheet}
                        onChange={(e) => handleSheetChange(e.target.value)}
                        className="w-full text-xs border border-neutral-200 rounded-xl px-3 py-2 bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-semibold"
                      >
                        {sheets.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* COLUMN MAPPING PANEL (ONLY IF FILE LOADED AND NOT YET CONFIRMED) */}
          {file && !isMappingConfirmed && headers.length > 0 && (
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <Columns className="h-4 w-4 text-emerald-600" />
                  <span>2. Map Spreadsheet Columns</span>
                </h3>
                <span className="text-[9px] bg-amber-50 border border-amber-200 text-amber-800 font-semibold px-2 py-0.5 rounded-lg uppercase">
                  Auto-Detected
                </span>
              </div>
              <p className="text-neutral-500 text-xs leading-relaxed">
                Map your spreadsheet headings to the corresponding system attributes. If column names were auto-detected, verify below before processing.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-neutral-50/50 p-4 border border-neutral-200 rounded-xl">
                {/* Recipe Name / Item Name column selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider block">
                    * Recipe / Item Column
                  </label>
                  <select
                    value={colItemName}
                    onChange={(e) => setColItemName(e.target.value)}
                    className="w-full text-xs border border-neutral-200 rounded-xl px-3 py-2 bg-white font-medium"
                  >
                    <option value="">-- Choose Column --</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Quantity column selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider block">
                    * Qty Sold Column
                  </label>
                  <select
                    value={colQuantity}
                    onChange={(e) => setColQuantity(e.target.value)}
                    className="w-full text-xs border border-neutral-200 rounded-xl px-3 py-2 bg-white font-medium"
                  >
                    <option value="">-- Choose Column --</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Unit Price column selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider block">
                    Unit Price Column (Optional)
                  </label>
                  <select
                    value={colUnitPrice}
                    onChange={(e) => {
                      setColUnitPrice(e.target.value);
                      if (e.target.value) {
                        const l = e.target.value.toLowerCase();
                        setColIsTotalRevenue(l === "sales" || l === "revenue" || l.includes("total") || l.includes("subtotal"));
                      }
                    }}
                    className="w-full text-xs border border-neutral-200 rounded-xl px-3 py-2 bg-white font-medium"
                  >
                    <option value="">-- Fallback to Recipe Price --</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>

              {colUnitPrice && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5" id="revenue-interpretation-safeguard">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-emerald-850 leading-relaxed">
                    <span className="font-bold">Revenue Calculation Guard: </span>
                    If your mapped column <strong>{colUnitPrice}</strong> represents the <strong>total gross sales revenue</strong> for the item (rather than the individual unit price), we can automatically divide it by the sold quantity to prevent double-calculation.
                    <label className="flex items-center gap-2 mt-2.5 font-bold cursor-pointer text-emerald-950 select-none bg-white border border-emerald-200 px-2.5 py-1.5 rounded-lg w-fit">
                      <input
                        type="checkbox"
                        checked={colIsTotalRevenue}
                        onChange={(e) => setColIsTotalRevenue(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                      />
                      <span>Interpret "{colUnitPrice}" as Total Sales Revenue (Gross Amount)</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleMapColumns}
                  className="bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl border border-neutral-950 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span>Parse Data Rows</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* PARSED PREVIEW REVIEW TABLE */}
          {file && isMappingConfirmed && parsedRows.length > 0 && (
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">
                    3. Review Portions & Recipe Mappings
                  </h3>
                  <p className="text-neutral-500 text-xs mt-0.5">
                    Verify mapped recipes, quantities, and portion prices before importing.
                  </p>
                </div>
                <button
                  onClick={() => setIsMappingConfirmed(false)}
                  className="text-emerald-700 hover:text-emerald-800 text-xs font-bold hover:underline"
                >
                  Re-map Columns
                </button>
              </div>

              {/* TABLE AREA */}
              <div className="border border-neutral-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-neutral-50 text-neutral-500 border-b border-neutral-200 font-bold">
                        <th className="py-3 px-4 text-center w-12">
                          <input
                            type="checkbox"
                            checked={parsedRows.every(r => r.selected)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setParsedRows(prev => prev.map(r => ({ ...r, selected: checked })));
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                        </th>
                        <th className="py-3 px-4">Excel Item Name</th>
                        <th className="py-3 px-4">Mapped Recipe</th>
                        <th className="py-3 px-4 text-center w-20">Qty</th>
                        <th className="py-3 px-4 text-right w-24">Unit Price</th>
                        <th className="py-3 px-4 text-right w-24">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {parsedRows.map((row, idx) => {
                        const matchedRecipe = recipes.find(r => r.id === row.matchedRecipeId);
                        
                        return (
                          <tr 
                            key={idx} 
                            className={`hover:bg-neutral-50/50 transition-colors ${
                              !row.matchedRecipeId ? "bg-amber-50/20" : ""
                            }`}
                          >
                            <td className="py-3 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={row.selected}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setParsedRows(prev => prev.map((r, i) => i === idx ? { ...r, selected: checked } : r));
                                }}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                              />
                            </td>
                            <td className="py-3 px-4 font-medium text-neutral-800 truncate max-w-[200px]" title={row.rawName}>
                              {row.rawName}
                            </td>
                            <td className="py-3 px-4">
                              <select
                                value={row.matchedRecipeId}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const recObj = recipes.find(r => r.id === val);
                                  setParsedRows(prev => prev.map((r, i) => {
                                    if (i === idx) {
                                      return { 
                                        ...r, 
                                        matchedRecipeId: val,
                                        selected: true, // Keep it selected to prevent data loss
                                        unitPrice: val !== "" && r.unitPrice === 0 && recObj ? recObj.sellingPrice : r.unitPrice
                                      };
                                    }
                                    return r;
                                  }));
                                }}
                                className={`w-full text-xs py-1 px-2 border rounded-lg bg-white ${
                                  !row.matchedRecipeId 
                                    ? "border-amber-400 text-amber-850 font-medium bg-amber-50/20" 
                                    : "border-neutral-200 text-neutral-850"
                                }`}
                              >
                                <option value="">-- Save as Generic Custom Item --</option>
                                {recipes.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name} (${r.sellingPrice.toFixed(2)})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={row.quantity}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setParsedRows(prev => prev.map((r, i) => i === idx ? { ...r, quantity: val } : r));
                                }}
                                className="w-16 py-1 px-1.5 border border-neutral-200 rounded text-center text-xs"
                              />
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-neutral-400">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={row.unitPrice}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setParsedRows(prev => prev.map((r, i) => i === idx ? { ...r, unitPrice: val } : r));
                                  }}
                                  className="w-20 py-1 px-1.5 border border-neutral-200 rounded text-right text-xs"
                                />
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-neutral-850 font-mono">
                              ${(row.quantity * row.unitPrice).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Warnings if unmapped items are saved as custom */}
              {parsedRows.some(r => !r.matchedRecipeId) && (
                <div className="flex gap-2.5 bg-emerald-50/50 border border-emerald-200 rounded-xl p-3 text-[11px] text-emerald-850 items-start">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                  <div>
                    <span className="font-bold">Full Data Capture Enabled: </span>
                    Unmapped items like Beers, Toppings, or Custom Bubble Teas will be recorded as custom daily sale items so you don't lose any data from your file.
                  </div>
                </div>
              )}

              {/* SAVE ACTION BUTTONS */}
              <div className="flex justify-between items-center pt-3">
                <span className="text-xs font-medium text-neutral-500">
                  Importing <strong className="text-neutral-900">{parsedRows.filter(r => r.selected).length}</strong> of {parsedRows.length} rows to daily ledger.
                </span>
                <button
                  onClick={handleSaveSalesLedger}
                  disabled={isSubmitting || parsedRows.filter(r => r.selected).length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl border border-emerald-700 shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <Clock className="h-4 w-4 animate-spin" />
                      <span>Writing Ledger...</span>
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4" />
                      <span>Approve and Record Sales</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* DIRECT PORTIONS RECORDS EDITOR */}
          {dailySales.filter(s => s.date === ledgerDate).length > 0 && (
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-4" id="direct-sales-editor">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <Database className="h-4.5 w-4.5 text-emerald-600" />
                    <span>Active Portions Ledger for {ledgerDate}</span>
                  </h3>
                  <p className="text-neutral-500 text-[11px] mt-0.5">
                    Previously saved portion sales for this date are listed below. You can edit quantities, update prices, or wipe accidental logs immediately.
                  </p>
                </div>
                {userRole !== "staff" && (
                  <button
                    onClick={async () => {
                      if (window.confirm(`Are you sure you want to permanently clear ALL saved portion sales for ${ledgerDate}? This action cannot be undone.`)) {
                        try {
                          const toDelete = dailySales.filter(s => s.date === ledgerDate);
                          for (const s of toDelete) {
                            if (s.id) await onDeleteDailySale(s.id);
                          }
                          setSuccessMessage(`Permanently wiped all recorded portion sales for ${ledgerDate}.`);
                          setErrorMessage("");
                        } catch (err: any) {
                          setErrorMessage(err.message || "Failed to clear sales records.");
                        }
                      }
                    }}
                    className="text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/50 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Clear All Daily Sales</span>
                  </button>
                )}
              </div>

              {/* LIST OF LOGGED DAILY PORTIONS */}
              <div className="border border-neutral-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-neutral-50/70 text-neutral-500 border-b border-neutral-200 font-bold text-[10px] uppercase tracking-wide">
                        <th className="py-2.5 px-4">Recipe Item</th>
                        <th className="py-2.5 px-4 text-center w-24">Portions Sold</th>
                        <th className="py-2.5 px-4 text-right w-24">Selling Price</th>
                        <th className="py-2.5 px-4 text-right w-28">Total Sales</th>
                        <th className="py-2.5 px-4 text-center w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {dailySales.filter(s => s.date === ledgerDate).map((sale) => {
                        const isEditing = editingSaleId === sale.id;
                        
                        return (
                          <tr key={sale.id} className="hover:bg-neutral-50/40 transition-colors">
                            <td className="py-3 px-4 font-semibold text-neutral-800">
                              {sale.recipeName}
                            </td>
                            
                            {/* Quantity Sold */}
                            <td className="py-3 px-4 text-center">
                              {isEditing ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={editQuantity}
                                  onChange={(e) => setEditQuantity(parseFloat(e.target.value) || 0)}
                                  className="w-16 py-1 border border-neutral-300 rounded text-center text-xs focus:border-emerald-500"
                                />
                              ) : (
                                <span className="font-mono bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded font-bold">
                                  {sale.quantitySold}
                                </span>
                              )}
                            </td>

                            {/* Selling Price */}
                            <td className="py-3 px-4 text-right">
                              {isEditing ? (
                                <div className="flex items-center justify-end gap-1">
                                  <span className="text-neutral-400">$</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editPrice}
                                    onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)}
                                    className="w-20 py-1 border border-neutral-300 rounded text-right text-xs focus:border-emerald-500"
                                  />
                                </div>
                              ) : (
                                <span className="font-mono text-neutral-600">
                                  ${sale.sellingPrice.toFixed(2)}
                                </span>
                              )}
                            </td>

                            {/* Total Revenue */}
                            <td className="py-3 px-4 text-right font-bold text-neutral-900 font-mono">
                              ${(sale.quantitySold * sale.sellingPrice).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4 text-center">
                              {isEditing ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleSaveInlineEdit(sale)}
                                    className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-lg cursor-pointer animate-pulse"
                                    title="Save changes"
                                  >
                                    <Save className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingSaleId(null)}
                                    className="p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 border border-neutral-200 rounded-lg cursor-pointer"
                                    title="Cancel"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleStartInlineEdit(sale)}
                                    className="p-1 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 border border-neutral-200 rounded-lg cursor-pointer"
                                    title="Edit record"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (sale.id && window.confirm(`Are you sure you want to delete the daily sale record for "${sale.recipeName}"?`)) {
                                        try {
                                          await onDeleteDailySale(sale.id);
                                          setSuccessMessage(`Successfully deleted daily sale entry for "${sale.recipeName}".`);
                                          setErrorMessage("");
                                        } catch (err: any) {
                                          setErrorMessage(err.message || "Failed to delete sale record.");
                                        }
                                      }
                                    }}
                                    className="p-1 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 border border-neutral-200 rounded-lg cursor-pointer"
                                    title="Delete record"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total revenue summary for date */}
              <div className="flex justify-between items-center bg-emerald-50/50 border border-emerald-200/50 rounded-xl p-4 text-xs font-semibold text-emerald-800">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Ledger fully recorded & calculated.</span>
                </span>
                <span className="font-mono text-sm font-extrabold text-emerald-950">
                  Daily Gross Sales: ${dailySales.filter(s => s.date === ledgerDate).reduce((acc, curr) => acc + (curr.quantitySold * curr.sellingPrice), 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: METADATA & HISTORIC SPREADSHEET LEDGER */}
        <div className="space-y-6">
          
          {/* SPREADSHEET IMPORT LEDGER STATS */}
          <div className="bg-[#fafaf9] border border-neutral-200 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
              Spreadsheet Upload History
            </h3>

            {/* SEARCH INPUT */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search spreadsheets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs border border-neutral-200 rounded-xl pl-9 pr-3 py-1.5 bg-white placeholder-neutral-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* LOGS LIST */}
            {filteredHistory.length === 0 ? (
              <div className="py-8 text-center text-neutral-400 text-xs">
                No spreadsheet upload metadata found.
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[480px] overflow-y-auto pr-1">
                {filteredHistory.map((upload) => (
                  <div 
                    key={upload.id} 
                    className="bg-white border border-neutral-200/80 p-3.5 rounded-xl hover:shadow-xs transition-all flex flex-col gap-2 relative group"
                  >
                    {/* Delete button for spreadsheet history if admin/manager */}
                    {userRole !== "staff" && (
                      <button
                        onClick={() => {
                          if (upload.id && window.confirm("Are you sure you want to delete this spreadsheet upload metadata log? This will not revert the recorded portion sales.")) {
                            onDeleteSalesUpload(upload.id);
                          }
                        }}
                        className="absolute top-3 right-3 text-neutral-400 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100 p-1 hover:bg-neutral-100 rounded"
                        title="Delete metadata log"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}

                    <div className="flex items-start gap-2.5 pr-6">
                      <div className="bg-emerald-50 text-emerald-700 p-2 rounded-lg border border-emerald-100 shrink-0">
                        <FileSpreadsheet className="h-4 w-4" />
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="text-xs font-bold text-neutral-900 truncate" title={upload.fileName}>
                          {upload.fileName}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-neutral-500">
                          <span>{upload.fileSize}</span>
                          <span>•</span>
                          <span>{upload.rowCount} rows</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-neutral-50 p-2 rounded-lg text-[10px] text-neutral-600 border border-neutral-100">
                      <div className="flex flex-col">
                        <span className="text-neutral-400 text-[8px] font-bold uppercase tracking-wider">Ledger Date</span>
                        <span className="font-semibold text-neutral-900 mt-0.5 flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-neutral-500" />
                          <span>{upload.detectedDate}</span>
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-neutral-400 text-[8px] font-bold uppercase tracking-wider">Uploaded By</span>
                        <span className="font-semibold text-neutral-900 mt-0.5 truncate flex items-center gap-1" title={upload.uploadedBy}>
                          <User className="h-3 w-3 text-neutral-500" />
                          <span>{upload.uploadedBy.split("@")[0]}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[9px] text-neutral-500 font-mono mt-1">
                      <div className="flex items-center gap-1 text-neutral-400">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(upload.uploadedAt).toLocaleString()}</span>
                      </div>
                      <span className="bg-emerald-100/80 text-emerald-700 border border-emerald-200/50 px-1.5 py-0.5 font-bold uppercase rounded">
                        {upload.status}
                      </span>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

          {/* HELP INFO BOX */}
          <div className="bg-emerald-50/40 border border-emerald-200/60 p-4 rounded-2xl text-xs space-y-2">
            <h4 className="font-bold text-emerald-900 flex items-center gap-1.5">
              <Check className="h-4 w-4" />
              <span>How Spreadsheet Parser Works:</span>
            </h4>
            <ol className="list-decimal pl-4 space-y-1 text-neutral-700 leading-relaxed text-[11px]">
              <li>Upload any transaction register or sales spreadsheet.</li>
              <li>Confirm which columns represent menu items and volume counts.</li>
              <li>Our fuzzy matcher automatically identifies active recipe cost sheets and maps the volumes accurately.</li>
              <li>Review the ledger entries and record portion sales to compile active kitchen metrics and overall margin charts.</li>
            </ol>
          </div>

        </div>

      </div>

    </div>
  );
}
