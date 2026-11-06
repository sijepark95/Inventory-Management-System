import React, { useState, useRef } from "react";
import { 
  Upload, 
  Trash2, 
  AlertTriangle, 
  Plus, 
  Clock, 
  Search,
  FileCheck,
  Building,
  Coffee,
  Lock
} from "lucide-react";
import { Timecard, Employee } from "../types";
import AIAssistantModal from "./AIAssistantModal";

interface TimesheetViewProps {
  userId: string;
  timecards: Timecard[];
  employees: Employee[];
  onAddTimecard: (item: Omit<Timecard, "id" | "ownerId" | "createdAt">) => Promise<void>;
  onBulkDeleteTimecards: (ids: string[]) => Promise<void>;
  onAddEmployee: (item: Omit<Employee, "id" | "ownerId" | "createdAt">) => Promise<void>;
  isReadOnly?: boolean;
  onOpenTimeClock?: () => void;
  activeShiftsCount?: number;
}

export default function TimesheetView({ 
  userId, 
  timecards, 
  employees,
  onAddTimecard, 
  onBulkDeleteTimecards,
  onAddEmployee,
  isReadOnly = false,
  onOpenTimeClock,
  activeShiftsCount = 0
}: TimesheetViewProps) {
  
  const [dragActive, setDragActive] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "anomalies" | "auto" | "over8" | "sixPlus">("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  // Manual submission form
  const [manualName, setManualName] = useState("");
  const [manualDate, setManualDate] = useState(new Date().toISOString().split("T")[0]);
  const [manualClockIn, setManualClockIn] = useState("09:00 AM");
  const [manualClockOut, setManualClockOut] = useState("05:30 PM");
  const [manualIsAuto, setManualIsAuto] = useState(false);
  const [manualJob, setManualJob] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Robust helper to match employee profiles by name, ID, or fallback codes
  const findEmployee = (nameOrCode: string): Employee | undefined => {
    if (!nameOrCode) return undefined;
    const cleanStr = nameOrCode.toLowerCase().trim();
    
    // 1. Direct Name Match
    let found = employees.find(e => e.name.toLowerCase().trim() === cleanStr);
    if (found) return found;

    // 2. Direct Employee Code/ID Match (e.g., "EMP-101")
    found = employees.find(e => e.employeeCode && e.employeeCode.toLowerCase().trim() === cleanStr);
    if (found) return found;

    // 3. Fallback: Suffix/Number Clean Match (e.g. "101" inside code "EMP-101")
    const cleanedSearchStr = cleanStr.replace(/[^a-z0-9]/g, "");
    if (cleanedSearchStr) {
      found = employees.find(e => {
        if (!e.employeeCode) return false;
        const codeCleaned = e.employeeCode.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
        return codeCleaned === cleanedSearchStr || (cleanedSearchStr.length >= 2 && codeCleaned.endsWith(cleanedSearchStr));
      });
      if (found) return found;
    }

    // 4. Try partial containing Name (e.g., "Amara" matching "Amara Sterling")
    found = employees.find(e => e.name.toLowerCase().includes(cleanStr) || cleanStr.includes(e.name.toLowerCase()));
    if (found) return found;

    return undefined;
  };

  // Find employee rate helper using robust findEmployee
  const getEmployeeRate = (nameOrCode: string, code?: string): number => {
    const emp = findEmployee(nameOrCode) || (code ? findEmployee(code) : undefined);
    return emp ? emp.hourlyRate : 18.00;
  };

  const getEmployeeRole = (nameOrCode: string, code?: string): string => {
    const emp = findEmployee(nameOrCode) || (code ? findEmployee(code) : undefined);
    return emp ? emp.role : "Staff";
  };

  // Time Utilities
  const parseTimeToDecimal = (timeStr: string): number | null => {
    if (!timeStr) return null;
    const clean = timeStr.trim().toLowerCase();
    
    // Auto cutoff check or missing representation
    if (
      clean.includes("auto") || 
      clean.includes("system") || 
      clean === "n/a" || 
      clean === "missing" || 
      clean === "none" || 
      clean === ""
    ) {
      return null;
    }

    const pattern = /(\d+)[:.](\d+)\s*(am|pm)?/;
    const match = clean.match(pattern);
    if (!match) return null;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3];

    if (ampm) {
      if (ampm === "pm" && hours < 12) {
        hours += 12;
      } else if (ampm === "am" && hours === 12) {
        hours = 0;
      }
    } else if (hours < 7 && (clean.includes("pm") || clean.includes("p.m."))) {
      // Small fallback for informal pm labels
      hours += 12;
    }

    return hours + (minutes / 60);
  };

  const formatDecimalToTimeStr = (decimal: number): string => {
    const hours = Math.floor(decimal);
    const minutes = Math.round((decimal - hours) * 60);
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
    const ampm = hours >= 12 ? "PM" : "AM";
    return `${displayHours}:${displayMinutes} ${ampm}`;
  };

  // Process a row and calculate total hours, break, and anomalies
  const calculateShiftDetails = (
    nameOrCode: string,
    dateStr: string,
    clockInStr: string,
    clockOutStr: string,
    explicitAutoFlag?: boolean,
    explicitCode?: string,
    explicitJob?: string
  ): Omit<Timecard, "ownerId"> => {
    const matchedEmp = findEmployee(nameOrCode) || (explicitCode ? findEmployee(explicitCode) : undefined);
    const cleanName = matchedEmp ? matchedEmp.name : (nameOrCode.trim() || "Hourly Staff");
    const employeeCode = matchedEmp ? matchedEmp.employeeCode : (explicitCode || undefined);
    const cleanDate = dateStr.trim() || new Date().toISOString().split("T")[0];
    
    // Determine Auto Clock Out state
    const isAutoClockOut = 
      explicitAutoFlag || 
      !clockOutStr || 
      clockOutStr.trim() === "" || 
      clockOutStr.toLowerCase().includes("auto") ||
      clockOutStr.toLowerCase().includes("system") ||
      clockOutStr.toLowerCase().includes("missing");

    const clockInDecimal = parseTimeToDecimal(clockInStr);
    const clockOutDecimal = isAutoClockOut ? null : parseTimeToDecimal(clockOutStr);

    let totalHours = 0;
    let unpaidBreakMinutes = 0;
    let paidHours = 0;
    const anomalies: string[] = [];

    if (isAutoClockOut) {
      anomalies.push("Auto Clock out triggered (Staff failed to manual clock out)");
    } else if (clockInDecimal !== null && clockOutDecimal !== null) {
      let grossHours = clockOutDecimal - clockInDecimal;
      if (grossHours < 0) {
        // Handle overnight shift wrapping
        grossHours = (24 - clockInDecimal) + clockOutDecimal;
      }

      totalHours = Math.round(grossHours * 100) / 100;

      // Unpaid break rule: if works more than 6.0 hours, subtract unpaid break time.
      if (totalHours > 6.0) {
        unpaidBreakMinutes = 30; // 30 minutes standard unpaid break
        paidHours = Math.max(0, totalHours - 0.5);
        anomalies.push("6+ Hours threshold reached (Mandatory 30 min unpaid break deducted)");
      } else {
        paidHours = totalHours;
      }

      // Over 8 PM store hour end audit
      if (clockOutDecimal > 20.0) {
        anomalies.push(`Shift extends beyond 8:00 PM store hours (Clocked out: ${clockOutStr})`);
      }
    } else {
      anomalies.push("Incomplete clock entry (Failed to parse timestamp decimals)");
    }

    const isOver8PM = clockOutDecimal !== null && clockOutDecimal > 20.0;

    return {
      employeeName: cleanName,
      employeeCode,
      date: cleanDate,
      clockIn: clockInStr || "N/A",
      clockOut: isAutoClockOut ? "Auto Clock Out" : clockOutStr,
      totalHours,
      unpaidBreakMinutes,
      paidHours: Math.round(paidHours * 100) / 100,
      isAutoClockOut,
      isOver8PM,
      anomalies,
      job: explicitJob || matchedEmp?.dept || matchedEmp?.role || undefined
    };
  };

  // Robust CSV String Parser
  const parseCSVString = (csvText: string): Array<Omit<Timecard, "ownerId">> => {
    const lines = csvText.split(/\r?\n/);
    if (lines.length === 0) return [];

    let headers: string[] = [];
    const shifts: Array<Omit<Timecard, "ownerId">> = [];

    // Find first line that isn't completely empty
    let headerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() !== "") {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) return [];

    // Header extraction & mapping with clean robust CSV handling
    const parseCSVRow = (rowText: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < rowText.length; i++) {
        const char = rowText[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result.map(val => val.replace(/^"|"$/g, "").trim());
    };

    headers = parseCSVRow(lines[headerIndex]).map(h => h.toLowerCase());

    // Guess column mapping indices
    const dateIdx = headers.findIndex(h => h.includes("date") || h.includes("day"));
    
    // Find name column, while making sure we don't accidentally treat "id" or "code" as the only name column if there's a better name column
    let nameIdx = headers.findIndex(h => h === "name" || h === "employee name" || h === "staff name" || h === "worker name");
    if (nameIdx === -1) {
      nameIdx = headers.findIndex(h => h.includes("name") && !h.includes("code") && !h.includes("id"));
    }
    if (nameIdx === -1) {
      nameIdx = headers.findIndex(h => h.includes("employee") || h.includes("staff") || h.includes("worker"));
    }
    
    // Find ID or Code column (supporting Badge, Employee No, Code, Badge Num, Emp No/Code etc.)
    const codeIdx = headers.findIndex(h => 
      (h.includes("code") || h.includes("id") || h.includes("num") || h.includes("number") || h.includes("badge") || h.includes("emp")) &&
      !h.includes("name")
    );
    
    // Find job, dept, or role column
    const jobIdx = headers.findIndex(h => h.includes("job") || h.includes("dept") || h.includes("department") || h.includes("role") || h.includes("position") || h.includes("title"));
    
    const inIdx = headers.findIndex(h => h.includes("in") || h.includes("start"));
    const outIdx = headers.findIndex(h => h.includes("out") || h.includes("end"));
    const autoFlagIdx = headers.findIndex(h => h.includes("auto") || h.includes("no-clock"));
    const anomalyIdx = headers.findIndex(h => h.includes("anomalie") || h.includes("anomaly") || h.includes("anomalies") || h.includes("alert"));

    // Fallbacks if headers are absent (assume Standard: Date, Employee Name, Clock In, Clock Out)
    const finalDateIdx = dateIdx !== -1 ? dateIdx : 0;
    const finalNameIdx = nameIdx !== -1 ? nameIdx : (codeIdx !== -1 ? codeIdx : 1);
    const finalInIdx = inIdx !== -1 ? inIdx : 2;
    const finalOutIdx = outIdx !== -1 ? outIdx : 3;

    for (let i = headerIndex + 1; i < lines.length; i++) {
      const row = lines[i].trim();
      if (row === "") continue;

      const cells = parseCSVRow(row);
      if (cells.length < 2) continue; // skip corrupted partial rows

      const dateVal = cells[finalDateIdx] || new Date().toISOString().split("T")[0];
      const nameValRaw = cells[finalNameIdx] || "";
      const codeValRaw = codeIdx !== -1 && cells[codeIdx] ? cells[codeIdx] : "";
      const jobValRaw = jobIdx !== -1 && cells[jobIdx] ? cells[jobIdx] : "";
      
      const nameVal = nameValRaw || codeValRaw || "Unassigned Hand";
      const clockInVal = cells[finalInIdx] || "";
      const clockOutVal = cells[finalOutIdx] || "";
      
      const anomalyVal = anomalyIdx !== -1 && cells[anomalyIdx] ? cells[anomalyIdx].trim() : "";
      
      const isAnomalyAuto = anomalyVal.toUpperCase().includes("AUTO CLOCK-OUT") || anomalyVal.toLowerCase().includes("auto clock out");
      const isClockOutAuto = clockOutVal.toUpperCase().includes("AUTO CLOCK-OUT") || clockOutVal.toLowerCase().includes("auto clock out");

      const explicitAuto = (autoFlagIdx !== -1 && cells[autoFlagIdx] 
        ? ["true", "yes", "1", "y", "auto"].includes(cells[autoFlagIdx].toLowerCase().trim())
        : false) || isAnomalyAuto || isClockOutAuto;

      const details = calculateShiftDetails(nameVal, dateVal, clockInVal, clockOutVal, explicitAuto, codeValRaw || undefined, jobValRaw || undefined);
      shifts.push(details);
    }

    return shifts;
  };

  // Handlers for loading data
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await processSelectedFile(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await processSelectedFile(file);
    }
  };

  const processSelectedFile = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setFormError("Invalid format. Please drag/select a .csv file.");
      setFormSuccess("");
      return;
    }

    setIsSubmitting(true);
    try {
      const text = await file.text();
      const shifts = parseCSVString(text);
      if (shifts.length === 0) {
        throw new Error("No readable rows found in target CSV.");
      }

      // Add each shift sequentially to Firestore
      for (const shift of shifts) {
        await onAddTimecard(shift);
      }
      setFormSuccess(`Successfully verified and imported ${shifts.length} employee time records.`);
      setFormError("");
    } catch (e: any) {
      setFormError(e.message || "Failed parsing selected spreadsheet file.");
      setFormSuccess("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasteSubmit = async () => {
    if (!pasteText.trim()) return;
    setIsSubmitting(true);
    try {
      const shifts = parseCSVString(pasteText);
      if (shifts.length === 0) {
        throw new Error("No readable records identified in pasted dump.");
      }

      for (const shift of shifts) {
        await onAddTimecard(shift);
      }
      setFormSuccess(`Successfully audited and persisted ${shifts.length} pasted shifts.`);
      setPasteText("");
      setFormError("");
    } catch (e: any) {
      setFormError(e.message || "Spreadsheet alignment fail: could not read format.");
      setFormSuccess("");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submits a single manual entry
  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!manualName.trim()) {
      setFormError("Staff Name is mandatory.");
      return;
    }

    setIsSubmitting(true);
    try {
      const matchedEmp = findEmployee(manualName);
      const resolvedName = matchedEmp ? matchedEmp.name : manualName;
      const resolvedCode = matchedEmp ? matchedEmp.employeeCode : undefined;
      const resolvedJob = manualJob.trim() || matchedEmp?.dept || matchedEmp?.role || undefined;

      const shift = calculateShiftDetails(
        resolvedName,
        manualDate,
        manualClockIn,
        manualIsAuto ? "" : manualClockOut,
        manualIsAuto,
        resolvedCode,
        resolvedJob
      );

      await onAddTimecard(shift);
      setFormSuccess(`Shift for ${resolvedName} [${resolvedJob || "Staff"}] was added and mapped successfully.`);
      setManualName("");
      setManualJob("");
      setManualIsAuto(false);
    } catch (e: any) {
      setFormError("Failed adding manual shift: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add highly interactive demo mock set
  const loadMockData = async () => {
    setIsSubmitting(true);
    setFormError("");
    setFormSuccess("");
    
    // Curate a perfect scenario mock data with exact triggers matching instructions
    const sampleCSV = `Date,Employee Name,Clock In,Clock Out,Anomalie
2026-06-10,Amara Sterling,09:00 AM,05:30 PM,
2026-06-10,Devon Miller,12:00 PM,08:30 PM,
2026-06-10,Sarah Jenkins,08:00 AM,10:30 AM,AUTO CLOCK-OUT
2026-06-11,Amara Sterling,10:00 AM,03:30 PM,
2026-06-11,Devon Miller,01:30 PM,09:15 PM,
2026-06-11,Marcus Chen,11:00 AM,05:30 PM,
2026-06-11,Sarah Jenkins,08:30 AM,,AUTO CLOCK-OUT`;

    try {
      const shifts = parseCSVString(sampleCSV);
      for (const shift of shifts) {
        await onAddTimecard(shift);
      }
      setFormSuccess("Prefilled 7 illustrative shifts displaying Auto-Clock Outs, Store hour overflows (>8PM), and 6+ hour break deductions.");
    } catch (e: any) {
      setFormError("Unable to prefill demo: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkClear = async () => {
    if (timecards.length === 0) return;

    setIsSubmitting(true);
    try {
      const ids = timecards.map(tc => tc.id).filter((id): id is string => !!id);
      await onBulkDeleteTimecards(ids);
      setFormSuccess("All active timesheet logs have been cleared.");
      setFormError("");
      setShowClearConfirm(false);
    } catch (e: any) {
      setFormError("Clear failed: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtering calculations
  const filteredTimecards = timecards.filter(tc => {
    const terms = searchQuery.toLowerCase().split(',').map(t => t.trim()).filter(Boolean);
    const matchesSearch = terms.length === 0 || terms.some(t => 
      tc.employeeName.toLowerCase().includes(t) || 
      tc.date.includes(t) ||
      tc.anomalies.some(a => a.toLowerCase().includes(t))
    );

    if (!matchesSearch) return false;

    if (filterType === "anomalies") {
      return tc.isAutoClockOut || tc.isOver8PM;
    }
    if (filterType === "auto") {
      return tc.isAutoClockOut;
    }
    if (filterType === "over8") {
      return tc.isOver8PM;
    }
    if (filterType === "sixPlus") {
      return tc.totalHours > 6.0;
    }
    return true;
  });

  // Calculate dynamic aggregated counter statistics
  const totalShiftsCount = timecards.length;
  const autoClockOutsCount = timecards.filter(tc => tc.isAutoClockOut).length;
  const over8PMCount = timecards.filter(tc => tc.isOver8PM).length;
  const totalAnomaliesCount = autoClockOutsCount + over8PMCount;
  
  const totalRawHours = timecards.reduce((sum, tc) => sum + tc.totalHours, 0);
  const totalPaidHours = timecards.reduce((sum, tc) => sum + tc.paidHours, 0);
  const totalUnpaidBreakHours = timecards.reduce((sum, tc) => sum + (tc.totalHours - tc.paidHours), 0);

  const totalEstimatedWage = timecards.reduce((sum, tc) => {
    const rate = getEmployeeRate(tc.employeeName);
    return sum + (tc.isAutoClockOut ? 0 : (tc.paidHours * rate));
  }, 0);

  return (
    <div className="space-y-6 animate-none" id="timesheet-auditor-root">
      {onOpenTimeClock && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs text-slate-500">
              Time Management · Completed Shift Ledger & Payroll Audit
            </div>
            <h2 className="text-base font-bold text-slate-900 mt-0.5">
              Completed Timesheets & Labor Compliance Auditor
            </h2>
          </div>
          <button
            type="button"
            onClick={onOpenTimeClock}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>
              Open Live Time Clock Terminal ({activeShiftsCount} Active)
            </span>
          </button>
        </div>
      )}

      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5" id="timesheet-metrics-grid">
        <div className="bg-white border border-neutral-200 p-4 text-left rounded-xl shadow-sm relative overflow-hidden">
          <Clock className="absolute -right-3 -bottom-3 text-neutral-100 h-16 w-16" />
          <span className="text-[10px] text-neutral-900/60 font-bold font-mono">Monitored Shifts</span>
          <p className="text-2xl font-bold font-mono mt-1">{totalShiftsCount}</p>
          <span className="text-[10px] text-neutral-400 block mt-0.5 font-sans">Active historic database logs</span>
        </div>

        <div className="bg-white border border-neutral-200 p-4 text-left rounded-xl shadow-sm relative overflow-hidden">
          <AlertTriangle className={`absolute -right-3 -bottom-3 h-16 w-16 ${totalAnomaliesCount > 0 ? "text-red-50" : "text-neutral-100"}`} />
          <span className="text-[10px] text-neutral-900/60 font-bold font-mono">Gross Anomaly Alerts</span>
          <p className={`text-2xl font-bold font-mono mt-1 ${totalAnomaliesCount > 0 ? "text-red-650" : "text-neutral-900"}`}>{totalAnomaliesCount}</p>
          <span className="text-[10px] text-neutral-500 block mt-0.5 font-sans">
            {autoClockOutsCount} Auto Out • {over8PMCount} Past 8PM
          </span>
        </div>

        <div className="bg-white border border-neutral-200 p-4 text-left rounded-xl shadow-sm relative overflow-hidden text-neutral-900">
          <Coffee className="absolute -right-3 -bottom-3 text-neutral-100 h-16 w-16" />
          <span className="text-[10px] text-neutral-900/60 font-bold font-mono">Unpaid Breaks Imposed</span>
          <p className="text-2xl font-bold font-mono mt-1 text-amber-700">{totalUnpaidBreakHours.toFixed(1)} hrs</p>
          <span className="text-[10px] text-neutral-400 block mt-0.5 font-sans">30 mins deducted on 6h+ shifts</span>
        </div>

        <div className="bg-white border border-neutral-200 p-4 text-left rounded-xl shadow-sm relative overflow-hidden text-neutral-900">
          <FileCheck className="absolute -right-3 -bottom-3 text-neutral-100 h-16 w-16" />
          <span className="text-[10px] text-neutral-900/60 font-bold font-mono">Net Audited Paid hours</span>
          <p className="text-2xl font-bold font-mono mt-1 text-emerald-600">{(totalPaidHours).toFixed(2)} hrs</p>
          <span className="text-[10px] text-emerald-700 block mt-0.5 font-sans font-semibold">
            Est. Wage Budget: ${totalEstimatedWage.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* CSV Import/Add Section */}
        <div className="lg:col-span-5 space-y-6">
          {isReadOnly ? (
            <div className="bg-white border border-neutral-300 p-6 text-center flex flex-col justify-center items-center space-y-3 h-full min-h-[300px]">
              <Lock className="h-10 w-10 text-neutral-400 font-bold" />
              <h3 className="text-xs font-bold text-neutral-800">
                Auditing Restricted
              </h3>
              <p className="text-neutral-500 text-[11px] font-sans leading-relaxed">
                You are currently in Staff mode. Standard timesheet CSV imports, Excel pastes, and manual clock adjustments are locked for your security role.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-white border border-neutral-200 p-5 rounded-xl text-left shadow-sm" id="csv-import-box">
            <h3 className="text-xs font-bold font-sans text-neutral-900 pb-3 border-b border-dashed border-neutral-200">
              Timesheet CSV Importer
            </h3>
            
            <p className="text-neutral-500 text-[11px] font-sans my-3.5 leading-relaxed">
              Drag and drop an employee clock log CSV file, paste rows from an Excel selection, or populate a demo dataset below.
            </p>

            {/* Drag Zone */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed p-6 text-center cursor-pointer transition-all rounded-xl mb-4 flex flex-col items-center justify-center gap-2 ${
                dragActive 
                  ? "border-neutral-200 bg-neutral-100" 
                  : "border-neutral-300 hover:border-neutral-200 hover:bg-neutral-50/50"
              }`}
              id="csv-drag-zone"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange}
                accept=".csv"
                className="hidden" 
              />
              <Upload className="h-5 w-5 text-neutral-400" />
              <span className="text-xs font-bold text-neutral-900">Upload clock_log.csv</span>
              <span className="text-[10px] text-neutral-400 font-mono">Supports: Drag & drop or click file pick</span>
            </div>

            {/* Paste clipboard option */}
            <div className="space-y-2">
              <label className="text-[10px] text-neutral-900/60 font-bold font-mono block">Direct CSV Paste</label>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={"Date,Employee,Clock In,Clock Out\n2026-06-11,Sarah Jenkins,08:30 AM,Auto Clock out"}
                rows={3}
                className="w-full text-xs font-mono p-3 bg-neutral-50 border border-neutral-300 focus:outline-none focus:border-neutral-200 rounded-xl resize-y"
                id="csv-paste-textarea"
              />
              <button
                onClick={handlePasteSubmit}
                disabled={isSubmitting || !pasteText.trim()}
                className="w-full py-2.5 bg-emerald-600 hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed text-white text-[10px] font-bold transition-all rounded-xl block"
                id="sumbit-pasted-csv-btn"
              >
                Audit Clipboard Paste
              </button>
            </div>

            {/* Quick Demo Pre-population helpers */}
            <div className="mt-4 pt-4 border-t border-dotted border-neutral-200 flex flex-col sm:flex-row gap-2">
              <button
                onClick={loadMockData}
                disabled={isSubmitting}
                className="flex-1 py-2 text-[10px] font-bold font-sans border border-neutral-200 text-neutral-900 bg-white hover:bg-neutral-50 transition-colors rounded-xl"
                id="populate-mock-timesheet-btn"
              >
                Load Sample Timesheet Data
              </button>
              {timecards.length > 0 && (
                showClearConfirm ? (
                  <div className="flex flex-col gap-1.5 p-2 bg-rose-50 border border-rose-200 w-full text-left">
                    <span className="text-[9px] font-mono font-bold text-rose-800 text-center">Confirm delete {timecards.length} logs?</span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={handleBulkClear}
                        disabled={isSubmitting}
                        className="flex-1 py-1 text-[9px] font-bold bg-rose-600 hover:bg-rose-700 text-white text-center cursor-pointer"
                        id="sidebar-clear-confirm"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setShowClearConfirm(false)}
                        className="flex-1 py-1 text-[9px] font-bold bg-neutral-200 hover:bg-neutral-300 text-neutral-800 text-center border border-neutral-300 cursor-pointer"
                        id="sidebar-clear-cancel"
                      >
                        No
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    disabled={isSubmitting}
                    className="py-2 px-3 text-[10px] font-bold font-sans bg-rose-50 border border-rose-300 hover:bg-rose-100 text-rose-800 transition-colors rounded-xl flex items-center justify-center gap-1.5 w-full cursor-pointer"
                    id="clear-timesheets-btn"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear All
                  </button>
                )
              )}
            </div>

          </div>

          {/* Form to manual add a single record */}
          <div className="bg-white border border-neutral-200 p-5 rounded-xl text-left shadow-sm" id="manual-add-shift-box">
            <h3 className="text-xs font-bold font-sans text-neutral-900 pb-3 border-b border-dashed border-neutral-200">
              Manual Shift Recorder
            </h3>

            <form onSubmit={handleManualAdd} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-neutral-400 block font-mono">Employee Name *</label>
                  <select
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-50/50"
                  >
                    <option value="">-- Choose Existing --</option>
                    {employees.map((emp, idx) => (
                      <option key={emp.id ? `${emp.id}-${idx}` : idx} value={emp.name}>{emp.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="Or type unregistered name..."
                    required
                    className="w-full p-2 border border-neutral-300 text-[10px] focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-50/50 block mt-1"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-neutral-400 block font-mono">Shift Date *</label>
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    required
                    className="w-full p-1.5 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-50/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-neutral-400 block font-mono">Clock In Time</label>
                  <input
                    type="text"
                    value={manualClockIn}
                    onChange={(e) => setManualClockIn(e.target.value)}
                    placeholder="E.g., 09:00 AM or 14:00"
                    required
                    className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-50/50 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-neutral-400 block font-mono">Clock Out Time</label>
                  <input
                    type="text"
                    value={manualClockOut}
                    onChange={(e) => setManualClockOut(e.target.value)}
                    placeholder="E.g., 05:30 PM or 21:00"
                    disabled={manualIsAuto}
                    required={!manualIsAuto}
                    className={`w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-50/50 font-mono ${
                      manualIsAuto ? "bg-neutral-100 text-neutral-400 line-through cursor-not-allowed" : ""
                    }`}
                  />
                </div>
              </div>

              {/* Job / Department */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-neutral-400 block font-mono">Job / Department (Optional)</label>
                <input
                  type="text"
                  value={manualJob}
                  onChange={(e) => setManualJob(e.target.value)}
                  placeholder="E.g., Kitchen, Service, prep, dishwasher, Line Cook..."
                  className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-50/50"
                  id="manual-job-input"
                />
              </div>

              {/* Explicit Auto Clock out trigger */}
              <div className="flex items-center gap-2 py-1 bg-amber-50/40 p-2.5 border border-amber-500/20">
                <input
                  type="checkbox"
                  id="manual-is-auto"
                  checked={manualIsAuto}
                  onChange={(e) => setManualIsAuto(e.target.checked)}
                  className="h-3.5 w-3.5 rounded-xl border-neutral-300 text-neutral-900 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="manual-is-auto" className="text-[10px] font-sans text-amber-900 cursor-pointer select-none">
                  <strong>Mark as Auto Clock out</strong> (Employee missed manual clock out)
                </label>
              </div>

              {formError && (
                <div className="text-[10px] font-mono p-2 bg-red-50 text-red-700 border border-red-300" id="manual-form-error">
                  {formError}
                </div>
              )}

              {formSuccess && (
                <div className="text-[10px] font-sans p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-300" id="manual-form-success">
                  {formSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-emerald-600 hover:bg-neutral-800 disabled:bg-neutral-200 text-white font-bold text-[10px] transition-all rounded-xl flex items-center justify-center gap-2"
                id="submit-manual-shift-btn"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Save Audited Entry</span>
              </button>
            </form>
          </div>
            </>
          )}
        </div>

        {/* Timesheet Table & Grid Filter Section */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-neutral-200 p-5 rounded-xl text-left shadow-sm flex flex-col h-full min-h-[500px]" id="timesheet-audit-log-card">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-neutral-200">
              <div>
                <h3 className="text-xs font-bold font-sans text-neutral-900">
                  Audited Shift Logs
                </h3>
                <p className="text-[10px] text-neutral-400 font-sans mt-0.5 animate-none">
                  Showing {filteredTimecards.length} out of {totalShiftsCount} recorded shifts
                </p>
              </div>

              {/* Status & Quick Action Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 border border-neutral-200 p-1 bg-[#f0efeb] text-[9px] font-mono font-bold ">
                  <Building className="h-3 w-3" />
                  <span>Store Cutoff: 8:00 PM</span>
                </div>
                {!isReadOnly && timecards.length > 0 && (
                  showClearConfirm ? (
                    <div className="flex items-center gap-1 bg-[#f0efeb] p-0.5 border border-neutral-200">
                      <span className="text-[9px] font-mono font-bold px-1 text-rose-700">Clear Logs?</span>
                      <button
                        onClick={handleBulkClear}
                        disabled={isSubmitting}
                        className="py-0.5 px-1.5 text-[9px] font-bold bg-rose-600 text-white hover:bg-rose-700 cursor-pointer"
                        id="header-clear-confirm"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setShowClearConfirm(false)}
                        className="py-0.5 px-1.5 text-[9px] font-bold bg-white text-neutral-800 hover:bg-neutral-100 border border-neutral-300 cursor-pointer"
                        id="header-clear-cancel"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowClearConfirm(true)}
                      disabled={isSubmitting}
                      className="py-1 px-2.5 text-[9px] font-bold font-sans bg-rose-600 hover:bg-rose-700 disabled:bg-neutral-200 text-white transition-colors rounded-xl flex items-center justify-center gap-1 border border-rose-700 h-[24px] cursor-pointer"
                      title="Delete all shift logs in the timesheet"
                      id="clear-audited-logs-header-btn"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                      <span>Clear Logs</span>
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Filter and Search controls */}
            <div className="flex flex-col sm:flex-row gap-3 py-4" id="timesheet-controls">
              {/* Search input */}
              <div className="relative flex-1 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Filter name, date, or anomaly..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl font-sans"
                  />
                </div>
                <AIAssistantModal 
                  context="Timesheet Log"
                  itemNames={Array.from(new Set(timecards.map(tc => tc.employeeName)))}
                  onSearchTerms={(terms) => setSearchQuery(terms.join(", "))}
                />
              </div>

              {/* Filter tabs */}
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setFilterType("all")}
                  className={`px-2.5 py-1.5 text-[9px] font-bold rounded-xl border border-neutral-200 ${
                    filterType === "all" ? "bg-emerald-600 text-white" : "bg-white text-neutral-500 hover:bg-neutral-50"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterType("anomalies")}
                  className={`px-2.5 py-1.5 text-[9px] font-bold rounded-xl border border-red-400 text-red-800 ${
                    filterType === "anomalies" ? "bg-red-50" : "bg-white hover:bg-red-50/20"
                  }`}
                >
                  Anomalies ({totalAnomaliesCount})
                </button>
                <button
                  onClick={() => setFilterType("auto")}
                  className={`px-2.5 py-1.5 text-[9px] font-bold rounded-xl border border-amber-400 text-amber-800 ${
                    filterType === "auto" ? "bg-amber-50" : "bg-white hover:bg-amber-50/20"
                  }`}
                >
                  Auto Out ({autoClockOutsCount})
                </button>
                <button
                  onClick={() => setFilterType("over8")}
                  className={`px-2.5 py-1.5 text-[9px] font-bold rounded-xl border border-indigo-400 text-indigo-800 ${
                    filterType === "over8" ? "bg-indigo-50" : "bg-white hover:bg-indigo-50/20"
                  }`}
                >
                  &gt; 8PM ({over8PMCount})
                </button>
                <button
                  onClick={() => setFilterType("sixPlus")}
                  className={`px-3 py-1.5 text-[9px] font-bold rounded-xl border border-neutral-350 text-neutral-650 ${
                    filterType === "sixPlus" ? "bg-neutral-100" : "white"
                  }`}
                >
                  6h+ Break
                </button>
              </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-x-auto border border-neutral-200">
              {filteredTimecards.length === 0 ? (
                <div className="py-16 text-center text-neutral-400 space-y-2">
                  <Clock className="mx-auto h-8 w-8 stroke-1 text-neutral-300" />
                  <p className="text-xs font-mono text-neutral-500">No shift records logged</p>
                  <p className="text-[10px] max-w-xs mx-auto text-neutral-400 font-sans">
                    Use the CSV upload box, pasted columns raw output, or manual form inputs to register shift metrics.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse font-sans bg-white">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-[9px] font-bold text-neutral-500 font-mono">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Employee Name</th>
                      <th className="py-2.5 px-3 text-center">Clock-In</th>
                      <th className="py-2.5 px-3 text-center">Clock-Out</th>
                      <th className="py-2.5 px-3 text-right">Physical Hrs</th>
                      <th className="py-2.5 px-3 text-right text-emerald-700">Paid Work</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-150 text-xs">
                    {filteredTimecards.map((tc, index) => {
                      const matchedEmployee = findEmployee(tc.employeeName) || (tc.employeeCode ? findEmployee(tc.employeeCode) : undefined);
                      const isUnregistered = !matchedEmployee;
                      const hasMissingId = matchedEmployee && (!matchedEmployee.employeeCode || matchedEmployee.employeeCode.trim() === "");
                      const hasAnomalies = tc.isAutoClockOut || tc.isOver8PM || tc.totalHours > 6.0 || isUnregistered || hasMissingId;

                      return (
                        <tr 
                          key={tc.id ? `${tc.id}-${index}` : index}
                          className={`hover:bg-neutral-50/50 ${
                            tc.isAutoClockOut ? "bg-amber-50/20" : tc.isOver8PM ? "bg-indigo-50/10" : ""
                          }`}
                        >
                          <td className="py-2.5 px-3 font-mono text-[10px] text-neutral-500 whitespace-nowrap">
                            {tc.date}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold block text-neutral-900">{tc.employeeName}</span>
                              {isUnregistered ? (
                                <span className="text-[8px] font-mono bg-rose-50 text-rose-700 px-1.5 py-0.5 border border-dashed border-rose-300 font-bold flex items-center gap-1">
                                  <AlertTriangle className="h-2.5 w-2.5 text-rose-600 animate-pulse" />
                                  Unregistered
                                </span>
                              ) : hasMissingId ? (
                                <span className="text-[8px] font-mono bg-amber-50 text-amber-700 px-1.5 py-0.5 border border-dashed border-amber-300 font-bold flex items-center gap-1">
                                  <AlertTriangle className="h-2.5 w-2.5 text-amber-600 animate-pulse" />
                                  Missing ID
                                </span>
                              ) : (
                                <span className="text-[8px] font-mono bg-neutral-100 text-neutral-600 px-1 py-0.2 border border-neutral-200 font-semibold">
                                  ID: {matchedEmployee.employeeCode}
                                </span>
                              )}
                              
                              <span className="text-[10px] text-neutral-400 font-sans">
                                ({getEmployeeRole(tc.employeeName, tc.employeeCode)}
                                {tc.job && ` • Job: ${tc.job}`}
                                {` • $${getEmployeeRate(tc.employeeName, tc.employeeCode).toFixed(2)}/hr`})
                              </span>

                              {!isReadOnly && isUnregistered && (
                                <button
                                  onClick={async () => {
                                    try {
                                      const defaultCode = "EMP-" + Math.floor(1000 + Math.random() * 9000);
                                      await onAddEmployee({
                                        name: tc.employeeName,
                                        employeeCode: tc.employeeCode || defaultCode,
                                        role: tc.job || "Line Cook",
                                        dept: tc.job || "Kitchen",
                                        hourlyRate: 18.00
                                      });
                                    } catch (err) {
                                      console.error("Auto registration of employee failed: ", err);
                                    }
                                  }}
                                  className="text-[8px] font-bold bg-emerald-600 hover:bg-neutral-800 text-white px-1.5 py-0.5 rounded-xl transition-colors ml-1"
                                  title={`Click to automatically register ${tc.employeeName} with standard defaults and job mapped as role/department`}
                                >
                                  + Register
                                </button>
                              )}
                            </div>
                            {/* Anomaly micro messages */}
                            <div className="space-y-0.5 mt-0.5 text-[9px]" id={`anomaly-box-${index}`}>
                              {isUnregistered && (
                                <span className="inline-flex items-center gap-0.5 px-1 bg-red-100 text-red-900 border border-red-300 font-mono text-[8px] font-bold mr-1">
                                  ⚠️ Unregistered staff! Wage estimates might use cookbook default rates.
                                </span>
                              )}
                              {hasMissingId && (
                                <span className="inline-flex items-center gap-0.5 px-1 bg-amber-50 text-amber-900 border border-amber-200 font-sans text-[8px] mr-1">
                                  ⚠️ Missing unique employee payroll ID. Ensure assigned in staff directory.
                                </span>
                              )}
                              {tc.isAutoClockOut && (
                                <span className="inline-flex items-center gap-0.5 px-1 bg-amber-100 text-amber-900 border border-amber-300 font-mono text-[8px] font-bold mr-1">
                                  <AlertTriangle className="h-2 w-2" /> Auto Out
                                </span>
                              )}
                              {tc.isOver8PM && (
                                <span className="inline-flex items-center gap-0.5 px-1 bg-indigo-100 text-indigo-900 border border-indigo-300 font-mono text-[8px] font-bold mr-1">
                                  <AlertTriangle className="h-2 w-2" /> Over 8PM
                                </span>
                              )}
                              {tc.totalHours > 6.0 && (
                                <span className="inline-flex items-center gap-0.5 px-1 bg-amber-50 text-amber-800 border border-amber-200 font-sans text-[8px] mr-1">
                                  <Coffee className="h-1.5 w-1.5" /> 30m Unpaid break applied
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-[11px] whitespace-nowrap">
                            {tc.clockIn}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono whitespace-nowrap">
                            {tc.isAutoClockOut ? (
                              <span className="text-red-700 bg-red-50 px-1.5 py-0.5 border border-red-200 font-bold text-[10px]">
                                Auto Out
                              </span>
                            ) : (
                              <span className="text-[11px]">{tc.clockOut}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-[11px] text-neutral-500 whitespace-nowrap">
                            {tc.isAutoClockOut ? "N/A" : `${tc.totalHours.toFixed(2)}h`}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap bg-emerald-50/10">
                            {tc.isAutoClockOut ? (
                              <span className="text-amber-700 bg-amber-50/50 px-1 py-0.5 text-[8px] font-semibold">Correction rq.</span>
                            ) : (
                              <div className="text-right">
                                <span className="block">{tc.paidHours.toFixed(2)}h</span>
                                <span className="text-[9px] text-emerald-600/70 block font-sans font-normal">
                                  ${(tc.paidHours * getEmployeeRate(tc.employeeName)).toFixed(2)}
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Quick Informational Notice Banner representing rules */}
            <div className="mt-5 bg-neutral-50 border border-neutral-300 p-3 text-left space-y-1">
              <span className="text-[10px] font-mono font-bold text-neutral-900 block">Store Guidelines Applied:</span>
              <ul className="list-disc pl-4 text-[10px] text-neutral-500 space-y-0.5 leading-relaxed">
                <li>
                  <strong className="text-neutral-700">Auto Clock Out:</strong> Indicated by missing or "Auto" clock-out. Flags shift for adjustment.
                </li>
                <li>
                  <strong className="text-neutral-700">8:00 PM End Rule:</strong> Shifter clock-outs recorded after 8:00 PM trigger visual Store-End alerts due to operational closing limits.
                </li>
                <li>
                  <strong className="text-neutral-700">Unpaid Break Rule:</strong> Shifts exceeding 6 hours automatically have a mandatory 30-minute unpaid break deducted from total physical hours to compute paid net duration.
                </li>
              </ul>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
