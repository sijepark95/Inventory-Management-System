import React, { useState, useRef } from "react";
import { 
  Users, 
  Search, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  Fingerprint, 
  DollarSign, 
  X, 
  Check, 
  SlidersHorizontal,
  Edit,
  Smile,
  Calendar,
  Phone,
  MapPin,
  FileText,
  ChevronDown,
  ChevronUp,
  Coins,
  CheckCircle,
  Briefcase,
  Upload,
  Loader2,
  Sparkles,
  AlertCircle,
  FileSpreadsheet,
  Lock
} from "lucide-react";
import { Employee } from "../types";
import { RAW_STAFF_REGISTRY_CSV } from "../constants/employees";
import AIAssistantModal from "./AIAssistantModal";

interface StaffRegistryViewProps {
  employees: Employee[];
  onAddEmployee: (item: Omit<Employee, "id" | "ownerId" | "createdAt">) => Promise<void>;
  onEditEmployee: (id: string, edits: Partial<Employee>) => Promise<void>;
  onDeleteEmployee: (id: string) => Promise<void>;
  isReadOnly?: boolean;
}

export default function StaffRegistryView({
  employees,
  onAddEmployee,
  onEditEmployee,
  onDeleteEmployee,
  isReadOnly = false
}: StaffRegistryViewProps) {
  // Search & Filtering States
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [idFilter, setIdFilter] = useState<"all" | "missing" | "with-id">("all");

  // AI & CSV Employee Reader States
  const [activeAddTab, setActiveAddTab] = useState<"manual" | "ai" | "csv">("manual");
  const [aiPasteText, setAiPasteText] = useState("");
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiDragActive, setAiDragActive] = useState(false);
  const [aiParsing, setAiParsing] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiSuccess, setAiSuccess] = useState("");
  const [aiParsedResult, setAiParsedResult] = useState<Partial<Omit<Employee, "id" | "ownerId" | "createdAt">> | null>(null);
  
  const aiFileInputRef = useRef<HTMLInputElement>(null);

  // CSV Bulk Importer States
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPasteText, setCsvPasteText] = useState("");
  const [csvDragActive, setCsvDragActive] = useState(false);
  const [csvError, setCsvError] = useState("");
  const [csvSuccess, setCsvSuccess] = useState("");
  const [csvParsedEmployees, setCsvParsedEmployees] = useState<Array<Omit<Employee, "id" | "ownerId" | "createdAt">>>([]);
  const [csvIsSubmitting, setCsvIsSubmitting] = useState(false);

  const csvFileInputRef = useRef<HTMLInputElement>(null);

  // Registration Form States
  const [empFormName, setEmpFormName] = useState("");
  const [empFormCode, setEmpFormCode] = useState("");
  const [empFormRole, setEmpFormRole] = useState("Line Cook");
  const [empFormRate, setEmpFormRate] = useState<number>(18.00);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Advanced Optional Registration Fields
  const [empFormShowAdvanced, setEmpFormShowAdvanced] = useState(false);
  const [empFormDept, setEmpFormDept] = useState("Kitchen");
  const [empFormDateHired, setEmpFormDateHired] = useState("");
  const [empFormDateTerminated, setEmpFormDateTerminated] = useState("");
  const [empFormOtRate, setEmpFormOtRate] = useState<number>(27.00); // 1.5x standard
  const [empFormTaxStatus, setEmpFormTaxStatus] = useState("Single");
  const [empFormTaxableIncome, setEmpFormTaxableIncome] = useState<number>(0);
  const [empFormTaxesWithheld, setEmpFormTaxesWithheld] = useState<number>(0);
  const [empFormInsuranceDeduction, setEmpFormInsuranceDeduction] = useState<number>(0);
  const [empFormTaxesWithheld2, setEmpFormTaxesWithheld2] = useState<number>(0);
  const [empFormCheckAmount, setEmpFormCheckAmount] = useState<number>(0);
  const [empFormMbExempt, setEmpFormMbExempt] = useState(false);
  const [empFormTipped, setEmpFormTipped] = useState(false);
  const [empFormIsSalary, setEmpFormIsSalary] = useState(false);
  const [empFormSalaryAmount, setEmpFormSalaryAmount] = useState<number>(0);
  const [empFormPayAmount, setEmpFormPayAmount] = useState<number>(0);
  const [empFormActualCashPay, setEmpFormActualCashPay] = useState<number>(0);
  const [empFormSickDayEligible, setEmpFormSickDayEligible] = useState(false);
  const [empFormPhoneNo, setEmpFormPhoneNo] = useState("");
  const [empFormAddress, setEmpFormAddress] = useState("");
  const [empFormNote, setEmpFormNote] = useState("");

  // Detailed Card / sliding drawer Overlay States
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileEditState, setProfileEditState] = useState<Partial<Employee>>({});

  // Inline Editing States for the list (simple inline edit)
  const [editEmpId, setEditEmpId] = useState<string | null>(null);
  const [editEmpName, setEditEmpName] = useState("");
  const [editEmpCode, setEditEmpCode] = useState("");
  const [editEmpRole, setEditEmpRole] = useState("");
  const [editEmpRate, setEditEmpRate] = useState<number>(18.00);
  const [editError, setEditError] = useState("");

  // Quick statistics
  const totalCount = employees.length;
  const missingIdCount = employees.filter(e => !e.employeeCode || e.employeeCode.trim() === "").length;
  const averageHourlyRate = totalCount > 0 
    ? employees.reduce((sum, e) => sum + e.hourlyRate, 0) / totalCount 
    : 0;

  // Obtain unique roles list for filtering dropdown
  const uniqueRoles = Array.from(new Set(employees.map(e => e.role || "Staff"))).filter(Boolean);

  // Form submit handler
  const handleRegisterEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    const trimmedName = empFormName.trim();
    if (!trimmedName) {
      setFormError("Full name is required.");
      return;
    }

    // Check pre-existing staff to avoid collisions
    const duplicate = employees.some(emp => emp.name.toLowerCase().trim() === trimmedName.toLowerCase().trim());
    if (duplicate) {
      setFormError("An employee with this exact name already exists in your registry.");
      return;
    }

    // Check code collision if any is entered
    const trimmedCode = empFormCode.trim();
    if (trimmedCode) {
      const codeDuplicate = employees.some(emp => emp.employeeCode && emp.employeeCode.toLowerCase().trim() === trimmedCode.toLowerCase().trim());
      if (codeDuplicate) {
        setFormError(`Employee ID "${trimmedCode}" is already utilized by another staff member.`);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await onAddEmployee({
        name: trimmedName,
        employeeCode: trimmedCode || undefined,
        role: empFormRole.trim() || "Staff",
        hourlyRate: empFormRate > 0 ? empFormRate : 18.00,
        dept: empFormDept.trim() || undefined,
        dateHired: empFormDateHired || undefined,
        dateTerminated: empFormDateTerminated || undefined,
        otRate: empFormOtRate > 0 ? empFormOtRate : (empFormRate * 1.5),
        taxStatus: empFormTaxStatus || undefined,
        taxableIncome: empFormTaxableIncome || 0,
        taxesWithheld: empFormTaxesWithheld || 0,
        insuranceDeduction: empFormInsuranceDeduction || 0,
        taxesWithheld2: empFormTaxesWithheld2 || 0,
        checkAmount: empFormCheckAmount || 0,
        mbExempt: empFormMbExempt,
        tipped: empFormTipped,
        isSalary: empFormIsSalary,
        salaryAmount: empFormSalaryAmount || 0,
        payAmount: empFormPayAmount || 0,
        actualCashPay: empFormActualCashPay || 0,
        sickDayEligible: empFormSickDayEligible,
        phoneNo: empFormPhoneNo.trim() || undefined,
        address: empFormAddress.trim() || undefined,
        note: empFormNote.trim() || undefined
      });

      setFormSuccess(`Successfully registered ${trimmedName}!`);
      setEmpFormName("");
      setEmpFormCode("");
      setEmpFormRole("Line Cook");
      setEmpFormRate(18.00);
      setEmpFormDept("Kitchen");
      setEmpFormDateHired("");
      setEmpFormDateTerminated("");
      setEmpFormOtRate(27.00);
      setEmpFormTaxStatus("Single");
      setEmpFormTaxableIncome(0);
      setEmpFormTaxesWithheld(0);
      setEmpFormInsuranceDeduction(0);
      setEmpFormTaxesWithheld2(0);
      setEmpFormCheckAmount(0);
      setEmpFormMbExempt(false);
      setEmpFormTipped(false);
      setEmpFormIsSalary(false);
      setEmpFormSalaryAmount(0);
      setEmpFormPayAmount(0);
      setEmpFormActualCashPay(0);
      setEmpFormSickDayEligible(false);
      setEmpFormPhoneNo("");
      setEmpFormAddress("");
      setEmpFormNote("");
      setEmpFormShowAdvanced(false);
    } catch (err: any) {
      setFormError("Error registering employee: " + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // AI Employee Reader Functions
  const handleAiDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setAiDragActive(true);
    } else if (e.type === "dragleave") {
      setAiDragActive(false);
    }
  };

  const handleAiDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAiDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setAiFile(e.dataTransfer.files[0]);
      setAiError("");
      setAiSuccess("");
    }
  };

  const handleAiFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAiFile(e.target.files[0]);
      setAiError("");
      setAiSuccess("");
    }
  };

  const handleAiParse = async () => {
    if (!aiFile && !aiPasteText.trim()) {
      setAiError("Please upload an employee document or paste text description.");
      return;
    }

    setAiParsing(true);
    setAiError("");
    setAiSuccess("");
    setAiParsedResult(null);

    const performServerCall = async (base64Data?: string, mimeType?: string, fileName?: string) => {
      try {
        const response = await fetch("/api/parse-employee", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileData: base64Data,
            mimeType: mimeType,
            fileName: fileName,
            textInput: aiPasteText.trim() || undefined
          }),
        });

        if (!response.ok) {
          let errBody: any;
          try {
            errBody = await response.json();
          } catch(e) {
            errBody = { error: `Server responded with ${response.status} ${response.statusText}` };
          }
          throw new Error(errBody.message || errBody.error || "AI failed to process the employee data");
        }

        const data = await response.json();
        setAiParsedResult(data);
        setAiSuccess(`AI extracted values for "${data.name || 'new employee'}" successfully!`);
      } catch (err: any) {
        console.error("AI parse error:", err);
        setAiError(err.message || "Failed to parse employee data.");
      } finally {
        setAiParsing(false);
      }
    };

    if (aiFile) {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(",")[1];
        await performServerCall(base64Data, aiFile.type || "application/octet-stream", aiFile.name);
      };
      reader.onerror = () => {
        setAiError("Failed to read the file from disk.");
        setAiParsing(false);
      };
      reader.readAsDataURL(aiFile);
    } else {
      await performServerCall();
    }
  };

  const handleSaveAiParsedEmployee = async () => {
    if (!aiParsedResult || !aiParsedResult.name) {
      setAiError("Name is required to register personnel.");
      return;
    }

    const trimmedName = aiParsedResult.name.trim();
    const duplicate = employees.some(emp => emp.name.toLowerCase().trim() === trimmedName.toLowerCase().trim());
    if (duplicate) {
      setAiError("An employee with this exact name already exists in your registry.");
      return;
    }

    try {
      setAiParsing(true);
      await onAddEmployee({
        name: trimmedName,
        role: aiParsedResult.role || "Staff",
        hourlyRate: aiParsedResult.hourlyRate || 18.00,
        employeeCode: aiParsedResult.employeeCode || undefined,
        dept: aiParsedResult.dept || undefined,
        dateHired: aiParsedResult.dateHired || undefined,
        dateTerminated: aiParsedResult.dateTerminated || undefined,
        otRate: aiParsedResult.otRate || (aiParsedResult.hourlyRate ? aiParsedResult.hourlyRate * 1.5 : 27.00),
        taxStatus: aiParsedResult.taxStatus || "Single",
        phoneNo: aiParsedResult.phoneNo?.trim() || undefined,
        address: aiParsedResult.address?.trim() || undefined,
        note: aiParsedResult.note?.trim() || undefined,
        mbExempt: aiParsedResult.mbExempt || false,
        tipped: aiParsedResult.tipped || false,
        isSalary: aiParsedResult.isSalary || false,
        sickDayEligible: aiParsedResult.sickDayEligible || false,
        taxableIncome: aiParsedResult.taxableIncome || 0,
        taxesWithheld: aiParsedResult.taxesWithheld || 0,
        insuranceDeduction: aiParsedResult.insuranceDeduction || 0,
        taxesWithheld2: aiParsedResult.taxesWithheld2 || 0,
        checkAmount: aiParsedResult.checkAmount || 0,
        payAmount: aiParsedResult.payAmount || 0,
        actualCashPay: aiParsedResult.actualCashPay || 0
      });

      setAiSuccess(`Registered ${trimmedName} successfully via AI!`);
      setAiParsedResult(null);
      setAiFile(null);
      setAiPasteText("");
    } catch (err: any) {
      setAiError(err.message || "Failed to add parsed employee.");
    } finally {
      setAiParsing(false);
    }
  };

  // CSV Bulk Importer Actions
  const handleCsvDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setCsvDragActive(true);
    } else if (e.type === "dragleave") {
      setCsvDragActive(false);
    }
  };

  const handleCsvDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCsvDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith(".csv")) {
        setCsvFile(file);
        processCsvFile(file);
      } else {
        setCsvError("Invalid format. Please drag/select a .csv file.");
      }
    }
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.endsWith(".csv")) {
        setCsvFile(file);
        processCsvFile(file);
      } else {
        setCsvError("Invalid format. Please select a .csv file.");
      }
    }
  };

  const processCsvFile = (file: File) => {
    setCsvError("");
    setCsvSuccess("");
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const parsed = parseEmployeeCSV(text);
        if (parsed.length === 0) {
          setCsvError("No readable employee rows resolved in target CSV.");
        } else {
          setCsvParsedEmployees(parsed);
          setCsvSuccess(`Parsed ${parsed.length} employee records from "${file.name}"!`);
        }
      } catch (err: any) {
        setCsvError("Failed to parse CSV file: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleCsvPasteSubmit = () => {
    setCsvError("");
    setCsvSuccess("");
    if (!csvPasteText.trim()) {
      setCsvError("Please paste some CSV content first.");
      return;
    }
    try {
      const parsed = parseEmployeeCSV(csvPasteText);
      if (parsed.length === 0) {
        setCsvError("No readable employee rows resolved in pasted text.");
      } else {
        setCsvParsedEmployees(parsed);
        setCsvSuccess(`Parsed ${parsed.length} employee records from custom paste!`);
      }
    } catch (err: any) {
      setCsvError("Failed to parse pasted text: " + err.message);
    }
  };

  // Robust CSV String Parser for Employees
  const parseEmployeeCSV = (csvText: string): Array<Omit<Employee, "id" | "ownerId" | "createdAt">> => {
    const lines = csvText.split(/\r?\n/);
    if (lines.length === 0) return [];

    let headers: string[] = [];
    const parsed: Array<Omit<Employee, "id" | "ownerId" | "createdAt">> = [];

    // Find first non-empty line as header
    let headerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() !== "") {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) return [];

    // Matches with commas inside double quotes
    const parseRow = (rowText: string): string[] => {
      const matches = rowText.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || rowText.split(",");
      return matches.map(val => val.replace(/^"|"$/g, "").trim());
    };

    headers = parseRow(lines[headerIndex]).map(h => h.toLowerCase());

    const nameIdx = headers.findIndex(h => h.includes("name") || h.includes("employee") || h.includes("staff") || h.includes("worker") || h.includes("person"));
    const codeIdx = headers.findIndex(h => h === "employee id" || h === "id" || (h.includes("code") && !h.includes("pin")) || (h.includes("id") && !h.includes("tax") && !h.includes("paid")));
    const pinIdx = headers.findIndex(h => h.includes("pin") || h.includes("passcode") || h.includes("terminal"));
    const roleIdx = headers.findIndex(h => h.includes("role") || h.includes("title") || h.includes("job") || h.includes("position"));
    const deptIdx = headers.findIndex(h => h.includes("dept") || h.includes("department"));
    const rateIdx = headers.findIndex(h => (h.includes("rate") || h.includes("hourly") || h.includes("wage")) && !h.includes("overtime") && !h.includes("ot"));
    const otRateIdx = headers.findIndex(h => h.includes("overtime") || h.includes("ot"));
    const isSalaryIdx = headers.findIndex(h => h.includes("salaried") || (h.includes("salary") && !h.includes("amount")));
    const salaryAmtIdx = headers.findIndex(h => h.includes("salary amount"));
    const taxStatusIdx = headers.findIndex(h => h.includes("tax status") || h.includes("filing status"));
    const phoneIdx = headers.findIndex(h => h.includes("phone") || h.includes("contact") || h.includes("cell") || h.includes("mobile"));
    const addressIdx = headers.findIndex(h => h.includes("address") || h.includes("residence") || h.includes("home"));
    const hiredIdx = headers.findIndex(h => h.includes("hired") || h.includes("start date"));
    const terminatedIdx = headers.findIndex(h => h.includes("terminated") || h.includes("end date"));
    const sickIdx = headers.findIndex(h => h.includes("sick"));
    const tippedIdx = headers.findIndex(h => h.includes("tipped") || h.includes("tip"));
    const mbExemptIdx = headers.findIndex(h => h.includes("mb") || h.includes("exempt"));
    const notesIdx = headers.findIndex(h => h.includes("note") || h.includes("comment"));

    // Fallbacks if headers are absent (assume Standard order: Name, Role, Hourly Rate, ID)
    const finalNameIdx = nameIdx !== -1 ? nameIdx : 0;
    const finalRoleIdx = roleIdx !== -1 ? roleIdx : 1;
    const finalRateIdx = rateIdx !== -1 ? rateIdx : 2;
    const finalCodeIdx = codeIdx !== -1 ? codeIdx : 3;

    for (let i = headerIndex + 1; i < lines.length; i++) {
      const row = lines[i].trim();
      if (row === "") continue;

      const cells = parseRow(row);
      if (cells.length < 1) continue;

      const nameVal = cells[finalNameIdx] || "";
      if (!nameVal || nameVal.toLowerCase() === "employee name" || nameVal.toLowerCase() === "name") continue;

      const roleVal = finalRoleIdx !== -1 && cells[finalRoleIdx] ? cells[finalRoleIdx] : "Staff";
      const rateStr = finalRateIdx !== -1 && cells[finalRateIdx] ? cells[finalRateIdx].replace(/[^0-9.]/g, "") : "18.00";
      const rateVal = parseFloat(rateStr) || 18.00;
      const codeVal = finalCodeIdx !== -1 && cells[finalCodeIdx] ? cells[finalCodeIdx].trim() : "";
      const pinVal = pinIdx !== -1 && cells[pinIdx] ? cells[pinIdx].trim() : "";
      const deptVal = deptIdx !== -1 && cells[deptIdx] ? cells[deptIdx] : "Kitchen";
      const phoneVal = phoneIdx !== -1 && cells[phoneIdx] ? cells[phoneIdx] : undefined;
      const addressVal = addressIdx !== -1 && cells[addressIdx] ? cells[addressIdx] : undefined;
      const otRateStr = otRateIdx !== -1 && cells[otRateIdx] ? cells[otRateIdx].replace(/[^0-9.]/g, "") : "";
      const otRateVal = otRateStr ? parseFloat(otRateStr) : rateVal * 1.5;
      const isSalaryVal = isSalaryIdx !== -1 && cells[isSalaryIdx] ? ["yes", "true", "1", "y"].includes(cells[isSalaryIdx].toLowerCase().trim()) : false;
      const salaryAmtStr = salaryAmtIdx !== -1 && cells[salaryAmtIdx] ? cells[salaryAmtIdx].replace(/[^0-9.]/g, "") : "0";
      const salaryAmtVal = parseFloat(salaryAmtStr) || 0;
      const taxStatusVal = taxStatusIdx !== -1 && cells[taxStatusIdx] ? cells[taxStatusIdx] : "Single";
      const dateHiredVal = hiredIdx !== -1 && cells[hiredIdx] ? cells[hiredIdx].trim() : undefined;
      const dateTerminatedVal = terminatedIdx !== -1 && cells[terminatedIdx] ? cells[terminatedIdx].trim() : undefined;
      const sickEligibleVal = sickIdx !== -1 && cells[sickIdx] ? ["yes", "true", "1", "y"].includes(cells[sickIdx].toLowerCase().trim()) : false;
      const tippedVal = tippedIdx !== -1 && cells[tippedIdx] ? ["yes", "true", "1", "y"].includes(cells[tippedIdx].toLowerCase().trim()) : false;
      const mbExemptVal = mbExemptIdx !== -1 && cells[mbExemptIdx] ? ["yes", "true", "1", "y"].includes(cells[mbExemptIdx].toLowerCase().trim()) : false;
      const notesVal = notesIdx !== -1 && cells[notesIdx] ? cells[notesIdx].trim() : "Imported via CSV";

      parsed.push({
        name: nameVal,
        role: roleVal,
        hourlyRate: rateVal,
        employeeCode: codeVal || undefined,
        pin: pinVal || undefined,
        dept: deptVal,
        otRate: otRateVal,
        taxStatus: taxStatusVal,
        taxableIncome: 0,
        taxesWithheld: 0,
        insuranceDeduction: 0,
        taxesWithheld2: 0,
        checkAmount: 0,
        mbExempt: mbExemptVal,
        tipped: tippedVal,
        isSalary: isSalaryVal,
        salaryAmount: salaryAmtVal,
        payAmount: 0,
        actualCashPay: 0,
        sickDayEligible: sickEligibleVal,
        phoneNo: phoneVal,
        address: addressVal,
        dateHired: dateHiredVal,
        dateTerminated: dateTerminatedVal,
        note: notesVal
      });
    }

    return parsed;
  };

  const loadDefaultCsvEmployees = () => {
    const defaultCSV = RAW_STAFF_REGISTRY_CSV;

    setCsvPasteText(defaultCSV);
    const parsed = parseEmployeeCSV(defaultCSV);
    setCsvParsedEmployees(parsed);
    setCsvSuccess(`Loaded ${parsed.length} official staff registry profiles from your personnel dataset.`);
    setCsvError("");
  };

  const handleSaveAllCsvEmployees = async () => {
    if (csvParsedEmployees.length === 0) {
      setCsvError("No employee profiles parsed to register.");
      return;
    }

    setCsvIsSubmitting(true);
    setCsvError("");
    setCsvSuccess("");

    let countSaved = 0;
    try {
      for (const emp of csvParsedEmployees) {
        // Skip duplicate names to prevent duplicate writes
        const duplicate = employees.some(existing => existing.name.toLowerCase().trim() === emp.name.toLowerCase().trim());
        if (duplicate) continue;

        await onAddEmployee(emp);
        countSaved++;
      }

      setCsvSuccess(`Successfully registered ${countSaved} new staff profiles in your registry!`);
      setCsvParsedEmployees([]);
      setCsvFile(null);
      setCsvPasteText("");
    } catch (err: any) {
      setCsvError("Error registering personnel list: " + (err.message || err));
    } finally {
      setCsvIsSubmitting(false);
    }
  };

  const removeParsedCsvEmployeeItem = (indexToRemove: number) => {
    setCsvParsedEmployees(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Inline editing actions
  const startEdit = (emp: Employee) => {
    setEditEmpId(emp.id!);
    setEditEmpName(emp.name);
    setEditEmpCode(emp.employeeCode || "");
    setEditEmpRole(emp.role || "Staff");
    setEditEmpRate(emp.hourlyRate);
    setEditError("");
  };

  const handleSaveEdit = async (empId: string) => {
    setEditError("");
    const trimmedName = editEmpName.trim();
    if (!trimmedName) {
      setEditError("Name is required");
      return;
    }

    // Check duplication across other employees
    const nameCollision = employees.some(emp => emp.id !== empId && emp.name.toLowerCase().trim() === trimmedName.toLowerCase().trim());
    if (nameCollision) {
      setEditError("Another staff member already uses this name.");
      return;
    }

    const trimmedCode = editEmpCode.trim();
    if (trimmedCode) {
      const codeCollision = employees.some(emp => emp.id !== empId && emp.employeeCode && emp.employeeCode.toLowerCase().trim() === trimmedCode.toLowerCase().trim());
      if (codeCollision) {
        setEditError(`ID "${trimmedCode}" is already allocated.`);
        return;
      }
    }

    try {
      await onEditEmployee(empId, {
        name: trimmedName,
        employeeCode: trimmedCode || undefined,
        role: editEmpRole.trim(),
        hourlyRate: editEmpRate
      });
      setEditEmpId(null);
    } catch (err: any) {
      setEditError("Failed to update: " + (err.message || err));
    }
  };

  const [profileEditError, setProfileEditError] = useState("");

  const handleSaveProfileEdit = async () => {
    if (!selectedEmp || !selectedEmp.id) return;
    setProfileEditError("");
    try {
      await onEditEmployee(selectedEmp.id, profileEditState);
      setSelectedEmp({
        ...selectedEmp,
        ...profileEditState
      });
      setIsEditingProfile(false);
    } catch (err: any) {
      setProfileEditError(err.message || String(err));
    }
  };

  // Filter list hierarchically 
  const filteredEmployees = employees.filter(emp => {
    const terms = searchQuery.toLowerCase().split(',').map(t => t.trim()).filter(Boolean);
    const textMatch = terms.length === 0 || terms.some(t => 
      emp.name.toLowerCase().includes(t) || 
      (emp.employeeCode || "").toLowerCase().includes(t) || 
      (emp.role || "").toLowerCase().includes(t)
    );
    
    const roleMatch = roleFilter === "all" || (emp.role || "Staff").toLowerCase() === roleFilter.toLowerCase();
    
    let idMatch = true;
    if (idFilter === "missing") {
      idMatch = !emp.employeeCode || emp.employeeCode.trim() === "";
    } else if (idFilter === "with-id") {
      idMatch = !!emp.employeeCode && emp.employeeCode.trim() !== "";
    }

    return textMatch && roleMatch && idMatch;
  });

  return (
    <div className="space-y-8 animate-none" id="staff-registry-root">
      
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5" id="staff-metrics-grid">
        <div className="bg-white border border-neutral-200 p-4 text-left rounded-xl shadow-sm relative overflow-hidden">
          <Users className="absolute -right-3 -bottom-3 text-neutral-100 h-16 w-16" />
          <span className="text-[10px] text-neutral-900/60 font-bold font-mono">Total Staff Roster</span>
          <p className="text-2xl font-bold font-mono mt-1">{totalCount}</p>
          <span className="text-[10px] text-neutral-400 block mt-0.5 font-sans">Active in payroll directory</span>
        </div>

        <div className="bg-white border border-neutral-200 p-4 text-left rounded-xl shadow-sm relative overflow-hidden">
          <Fingerprint className="absolute -right-3 -bottom-3 text-neutral-100 h-16 w-16" />
          <span className="text-[10px] text-neutral-900/60 font-bold font-mono">Signed with IDs</span>
          <p className="text-2xl font-bold font-mono mt-1 text-neutral-800">{totalCount - missingIdCount}</p>
          <span className="text-[10px] text-emerald-700 block mt-0.5 font-sans">Properly indexed in system</span>
        </div>

        <div className="bg-white border border-neutral-200 p-4 text-left rounded-xl shadow-sm relative overflow-hidden">
          <AlertTriangle className={`absolute -right-3 -bottom-3 h-16 w-16 ${missingIdCount > 0 ? "text-amber-50" : "text-neutral-100"}`} />
          <span className="text-[10px] text-neutral-900/60 font-bold font-mono">Missing Employee ID</span>
          <p className={`text-2xl font-bold font-mono mt-1 ${missingIdCount > 0 ? "text-amber-700" : "text-neutral-500"}`}>{missingIdCount}</p>
          <span className="text-[10px] text-neutral-400 block mt-0.5 font-sans">
            {missingIdCount > 0 ? "Requires manual ID updates" : "All staff registered!"}
          </span>
        </div>

        <div className="bg-white border border-neutral-200 p-4 text-left rounded-xl shadow-sm relative overflow-hidden">
          <DollarSign className="absolute -right-3 -bottom-3 text-neutral-100 h-16 w-16" />
          <span className="text-[10px] text-neutral-900/60 font-bold font-mono">Average Hourly Rate</span>
          <p className="text-2xl font-bold font-mono mt-1 text-emerald-600">${averageHourlyRate.toFixed(2)}/hr</p>
          <span className="text-[10px] text-neutral-400 block mt-0.5 font-sans">Registry hourly wage index</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Registration Column */}
        <div className="lg:col-span-4 space-y-6">
          {isReadOnly ? (
            <div className="bg-white border border-neutral-300 p-6 text-center flex flex-col justify-center items-center space-y-3 h-full min-h-[300px]" id="staff-add-box-readonly">
              <Lock className="h-10 w-10 text-neutral-400 font-bold" />
              <h3 className="text-xs font-bold text-neutral-800">
                Registry Restricted
              </h3>
              <p className="text-neutral-500 text-[11px] font-sans leading-relaxed">
                You are currently in Staff mode. Registering new employees, updating contract terms, and importing payroll logs are restricted to Managers and Admins.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-neutral-200 p-5 rounded-xl text-left shadow-sm" id="staff-add-box">
            <h3 className="text-xs font-bold font-sans text-neutral-900 pb-3 border-b border-dashed border-neutral-200">
              Register New Personnel
            </h3>
            <p className="text-neutral-500 text-[11px] font-sans my-3 leading-relaxed">
              Register new kitchen, front-of-house, or management staff here. Assign roles and specific hourly compensation rates to calculate timesheet wages correctly.
            </p>

            {/* Tab Swapping Header */}
            <div className="flex border border-neutral-200 mb-4">
              <button
                type="button"
                onClick={() => setActiveAddTab("manual")}
                className={`flex-1 py-1.5 text-[9px] font-bold transition-colors rounded-xl cursor-pointer ${
                  activeAddTab === "manual" 
                    ? "bg-emerald-600 text-white" 
                    : "bg-white text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                Manual Entry
              </button>
              <button
                type="button"
                onClick={() => setActiveAddTab("ai")}
                className={`flex-1 py-1.5 text-[9px] font-bold transition-colors rounded-xl cursor-pointer flex items-center justify-center gap-1 border-x border-neutral-200 ${
                  activeAddTab === "ai" 
                    ? "bg-emerald-600 text-white" 
                    : "bg-white text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                <Sparkles className="h-3 w-3 text-amber-500 fill-amber-500" />
                <span>AI Reader</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveAddTab("csv")}
                className={`flex-1 py-1.5 text-[9px] font-bold transition-colors rounded-xl cursor-pointer flex items-center justify-center gap-1 ${
                  activeAddTab === "csv" 
                    ? "bg-emerald-600 text-white" 
                    : "bg-white text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                <FileSpreadsheet className="h-3 w-3 text-emerald-500" />
                <span>CSV Bulk</span>
              </button>
            </div>

            {activeAddTab === "manual" && (
              <form onSubmit={handleRegisterEmployee} className="space-y-4 mt-4">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-neutral-400 block font-mono">Employee Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Eleanor Vance"
                  value={empFormName}
                  onChange={(e) => setEmpFormName(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-50/20 font-sans"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-bold text-neutral-400 block font-mono">Unique Employee ID (Code)</label>
                  <span className="text-[8px] font-mono text-amber-600 block">(Flagged if left empty)</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. EMP-088"
                  value={empFormCode}
                  onChange={(e) => setEmpFormCode(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-50/20 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-neutral-400 block font-mono">Role Title</label>
                  <input
                    type="text"
                    placeholder="Line Cook"
                    value={empFormRole}
                    onChange={(e) => setEmpFormRole(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-50/20 font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-neutral-400 block font-mono">Hourly Rate *</label>
                  <div className="flex bg-neutral-50/20 items-center border border-neutral-300 px-2 h-9">
                    <span className="text-xs font-mono text-neutral-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="18.00"
                      value={empFormRate}
                      onChange={(e) => setEmpFormRate(parseFloat(e.target.value) || 0)}
                      required
                      disabled={isSubmitting}
                      className="p-1 border-0 text-xs focus:outline-none rounded-xl bg-transparent w-full font-mono text-neutral-900"
                    />
                  </div>
                </div>
              </div>

              {/* Optional Advanced Fields Toggle Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setEmpFormShowAdvanced(!empFormShowAdvanced)}
                  className="w-full flex items-center justify-between text-[10px] font-bold text-neutral-600 hover:text-black py-2 px-2.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 transition-colors cursor-pointer"
                >
                  <span>Advanced Payroll & HR Fields</span>
                  {empFormShowAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </div>

              {empFormShowAdvanced && (
                <div className="space-y-4 pt-3 border-t border-dashed border-neutral-200 animate-none">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 block font-mono">Department</label>
                      <input
                        type="text"
                        placeholder="Kitchen"
                        value={empFormDept}
                        onChange={(e) => setEmpFormDept(e.target.value)}
                        className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-50/20 font-sans"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 block font-mono">OT Rate ($/hr)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="27.00"
                        value={empFormOtRate}
                        onChange={(e) => setEmpFormOtRate(parseFloat(e.target.value) || 0)}
                        className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-50/20 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 block font-mono">Date Hired</label>
                      <input
                        type="date"
                        value={empFormDateHired}
                        onChange={(e) => setEmpFormDateHired(e.target.value)}
                        className="w-full p-1.5 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-50/20 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 block font-mono">Date Terminated</label>
                      <input
                        type="date"
                        value={empFormDateTerminated}
                        onChange={(e) => setEmpFormDateTerminated(e.target.value)}
                        className="w-full p-1.5 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-50/20 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 block font-mono">Tax Status</label>
                      <select
                        value={empFormTaxStatus}
                        onChange={(e) => setEmpFormTaxStatus(e.target.value)}
                        className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-white font-sans font-medium"
                      >
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Head of Household">Head of Household</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 block font-mono">Phone No</label>
                      <input
                        type="text"
                        placeholder="555-0199"
                        value={empFormPhoneNo}
                        onChange={(e) => setEmpFormPhoneNo(e.target.value)}
                        className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-50/20 font-sans"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-neutral-400 block font-mono">Home Address</label>
                    <input
                      type="text"
                      placeholder="123 Main St, Springfield"
                      value={empFormAddress}
                      onChange={(e) => setEmpFormAddress(e.target.value)}
                      className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-50/20 font-sans"
                    />
                  </div>

                  {/* Financial items */}
                  <div className="border-t border-neutral-100 pt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-neutral-400 block font-mono">Taxable Income ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={empFormTaxableIncome}
                          onChange={(e) => setEmpFormTaxableIncome(parseFloat(e.target.value) || 0)}
                          className="w-full p-1.5 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-50/20 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-neutral-400 block font-mono">Taxes Withheld ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={empFormTaxesWithheld}
                          onChange={(e) => setEmpFormTaxesWithheld(parseFloat(e.target.value) || 0)}
                          className="w-full p-1.5 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-50/20 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-neutral-400 block font-mono">Insurance Deduction ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={empFormInsuranceDeduction}
                          onChange={(e) => setEmpFormInsuranceDeduction(parseFloat(e.target.value) || 0)}
                          className="w-full p-1.5 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-50/20 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-neutral-400 block font-mono">Check Amount ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={empFormCheckAmount}
                          onChange={(e) => setEmpFormCheckAmount(parseFloat(e.target.value) || 0)}
                          className="w-full p-1.5 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-50/20 font-mono"
                        />
                      </div>
                    </div>

                    {/* Boolean Toggles */}
                    <div className="grid grid-cols-1 gap-2 pt-2 text-[11px] font-sans">
                      <label className="flex items-center gap-2 text-neutral-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={empFormMbExempt}
                          onChange={(e) => setEmpFormMbExempt(e.target.checked)}
                          className="rounded-xl border-neutral-300 text-neutral-900 focus:ring-[#141414] h-3.5 w-3.5"
                        />
                        <span>M & B Exempt (Meals & Bev)</span>
                      </label>

                      <label className="flex items-center gap-2 text-neutral-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={empFormTipped}
                          onChange={(e) => setEmpFormTipped(e.target.checked)}
                          className="rounded-xl border-neutral-300 text-neutral-900 focus:ring-[#141414] h-3.5 w-3.5"
                        />
                        <span>Tipped Employee</span>
                      </label>

                      <label className="flex items-center gap-2 text-neutral-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={empFormIsSalary}
                          onChange={(e) => setEmpFormIsSalary(e.target.checked)}
                          className="rounded-xl border-neutral-300 text-neutral-900 focus:ring-[#141414] h-3.5 w-3.5"
                        />
                        <span>Salaried Staff</span>
                      </label>

                      <label className="flex items-center gap-2 text-neutral-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={empFormSickDayEligible}
                          onChange={(e) => setEmpFormSickDayEligible(e.target.checked)}
                          className="rounded-xl border-neutral-300 text-neutral-900 focus:ring-[#141414] h-3.5 w-3.5"
                        />
                        <span>Sick Day Eligible</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-neutral-400 block font-mono">Special Profile Note</label>
                    <textarea
                      placeholder="Add custom onboarding instructions or wage conditions..."
                      value={empFormNote}
                      onChange={(e) => setEmpFormNote(e.target.value)}
                      rows={2}
                      className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-50/20 font-sans resize-none"
                    />
                  </div>
                </div>
              )}

              {formError && (
                <div className="text-[10px] font-mono p-2 bg-rose-50 text-rose-800 border border-rose-300">
                  {formError}
                </div>
              )}

              {formSuccess && (
                <div className="text-[10px] font-sans p-2 bg-emerald-50 text-emerald-800 border border-emerald-300">
                  {formSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-emerald-600 hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white font-bold text-[10px] transition-all rounded-xl flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                <span>{isSubmitting ? "Registering..." : "Add Staff Member"}</span>
              </button>
            </form>
            )}

            {activeAddTab === "ai" && (
              <div className="space-y-4 text-left font-sans mt-4">
                {/* Drag and Drop Zone */}
                <div
                  onDragEnter={handleAiDrag}
                  onDragOver={handleAiDrag}
                  onDragLeave={handleAiDrag}
                  onDrop={handleAiDrop}
                  className={`border border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer ${
                    aiDragActive 
                      ? "border-emerald-500 bg-emerald-50/10" 
                      : aiFile 
                        ? "border-neutral-200 bg-emerald-600/5" 
                        : "border-neutral-300 hover:border-neutral-400 bg-neutral-50/30"
                  }`}
                  onClick={() => aiFileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={aiFileInputRef}
                    onChange={handleAiFileChange}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  />
                  
                  <div className="flex flex-col items-center justify-center space-y-1.5">
                    <Upload className={`h-6 w-6 ${aiFile ? "text-emerald-600 animate-pulse" : "text-neutral-400"}`} />
                    <p className="text-[11px] font-bold text-neutral-700 font-sans">
                      {aiFile ? "Document Loaded" : "Upload Contract / Resume / Bio"}
                    </p>
                    <p className="text-[9px] text-neutral-900/60 font-mono">
                      {aiFile ? aiFile.name : "or click / drag & drop file here"}
                    </p>
                  </div>
                  
                  {aiFile && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAiFile(null);
                      }}
                      className="text-[8px] font-mono text-rose-600 hover:underline mt-2 cursor-pointer font-bold block mx-auto "
                    >
                      Clear File
                    </button>
                  )}
                </div>

                {/* Plain Text input area */}
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-neutral-400 block font-mono">
                    Paste Bios, Notes or Emails (Optional alternative)
                  </span>
                  <textarea
                    placeholder="e.g. Eleanor joined today on $19.50/hr as Line Cook in Kitchen. Phone is 555-019-2831. Lives on 123 Main St. Single filing status..."
                    value={aiPasteText}
                    onChange={(e) => setAiPasteText(e.target.value)}
                    rows={3}
                    className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-50/20 font-sans resize-none placeholder-neutral-400"
                  />
                </div>

                {/* Execute button */}
                <button
                  type="button"
                  onClick={handleAiParse}
                  disabled={aiParsing || (!aiFile && !aiPasteText.trim())}
                  className="w-full py-2 bg-emerald-600 hover:bg-neutral-800 disabled:bg-neutral-100 disabled:text-neutral-400 text-white font-bold text-[10px] transition-all rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  {aiParsing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Reading Data...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                      <span>Read Employee Material</span>
                    </>
                  )}
                </button>

                {/* Error presentation */}
                {aiError && (
                  <div className="space-y-3">
                    <div className="text-[10px] font-mono p-2 bg-rose-50 text-rose-800 border border-rose-300 flex items-start gap-1.5 animate-none">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-rose-700" />
                      <span>{aiError}</span>
                    </div>

                    {(aiError.toLowerCase().includes("quota") || aiError.toLowerCase().includes("429") || aiError.toLowerCase().includes("limit") || aiError.toLowerCase().includes("exhausted")) && (
                      <div className="p-3 bg-amber-50 border border-amber-200 text-amber-950 text-xs">
                        <p className="font-bold text-[9px] text-amber-900 mb-1 font-mono">Bypass Gemini Rate-Limits Instantly:</p>
                        <p className="mb-2 text-[10px] leading-relaxed">
                          Because the shared Gemini API free tier has hit its limit (max 20 requests/day), you can use our built-in <strong>CSV Bulk</strong> prefill. Switch tabs to seed employee profiles instantly, or simply rely on the system auto-seeding them.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveAddTab("csv");
                            loadDefaultCsvEmployees();
                          }}
                          className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[9px] py-1.5 px-3 rounded-xl border-0 cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-300" />
                          <span>Switch to CSV Bulk & Prefill</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Success presentation */}
                {aiSuccess && !aiParsedResult && (
                  <div className="text-[10px] font-sans p-2 bg-emerald-50 text-emerald-800 border border-emerald-300">
                    {aiSuccess}
                  </div>
                )}

                {/* Parsed Result Form Preview */}
                {aiParsedResult && (
                  <div className="space-y-3 pt-3 border-t border-dashed border-neutral-200 animate-none">
                    <div className="p-2.5 bg-neutral-50 border border-neutral-200">
                      <div className="flex justify-between items-center pb-2 border-b border-neutral-200 mb-2">
                        <span className="text-[9px] font-bold text-neutral-500 font-mono">Dossier Extraction Review</span>
                        <span className="text-[8px] bg-emerald-100 text-emerald-800 font-bold px-1 py-0.5 font-mono">AI Draft</span>
                      </div>
                      
                      <div className="space-y-2 text-[11px] font-sans">
                        <div>
                          <label className="text-[8px] text-neutral-400 block font-mono">Name *</label>
                          <input
                            type="text"
                            value={aiParsedResult.name || ""}
                            onChange={(e) => setAiParsedResult({ ...aiParsedResult, name: e.target.value })}
                            className="w-full p-1 bg-white border border-neutral-300 text-xs rounded-xl font-bold text-neutral-900 focus:outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[8px] text-neutral-400 block font-mono">Role *</label>
                            <input
                              type="text"
                              value={aiParsedResult.role || ""}
                              onChange={(e) => setAiParsedResult({ ...aiParsedResult, role: e.target.value })}
                              className="w-full p-1 bg-white border border-neutral-300 text-xs rounded-xl text-neutral-900 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[8px] text-neutral-400 block font-mono">Hourly Rate ($) *</label>
                            <input
                              type="number"
                              step="0.01"
                              value={aiParsedResult.hourlyRate || 18.00}
                              onChange={(e) => setAiParsedResult({ ...aiParsedResult, hourlyRate: parseFloat(e.target.value) || 0 })}
                              className="w-full p-1 bg-white border border-neutral-300 text-xs rounded-xl text-neutral-900 font-mono focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[8px] text-neutral-400 block font-mono">Department</label>
                            <input
                              type="text"
                              value={aiParsedResult.dept || ""}
                              onChange={(e) => setAiParsedResult({ ...aiParsedResult, dept: e.target.value })}
                              className="w-full p-1 bg-white border border-neutral-300 text-xs rounded-xl text-neutral-900 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[8px] text-neutral-400 block font-mono">Employee ID</label>
                            <input
                              type="text"
                              value={aiParsedResult.employeeCode || ""}
                              placeholder="EMP-..."
                              onChange={(e) => setAiParsedResult({ ...aiParsedResult, employeeCode: e.target.value })}
                              className="w-full p-1 bg-white border border-neutral-300 text-xs rounded-xl text-neutral-900 font-mono focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[8px] text-neutral-400 block font-mono">Contact Phone</label>
                            <input
                              type="text"
                              value={aiParsedResult.phoneNo || ""}
                              onChange={(e) => setAiParsedResult({ ...aiParsedResult, phoneNo: e.target.value })}
                              className="w-full p-1 bg-white border border-neutral-300 text-xs rounded-xl text-neutral-900 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[8px] text-neutral-400 block font-mono">Date Hired</label>
                            <input
                              type="text"
                              placeholder="YYYY-MM-DD"
                              value={aiParsedResult.dateHired || ""}
                              onChange={(e) => setAiParsedResult({ ...aiParsedResult, dateHired: e.target.value })}
                              className="w-full p-1 bg-white border border-neutral-300 text-xs text-neutral-900 font-mono focus:outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[8px] text-neutral-400 block font-mono">Home Address</label>
                          <input
                            type="text"
                            value={aiParsedResult.address || ""}
                            onChange={(e) => setAiParsedResult({ ...aiParsedResult, address: e.target.value })}
                            className="w-full p-1 bg-white border border-neutral-300 text-xs text-neutral-900 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[8px] text-neutral-400 block font-mono">Extracted Note</label>
                          <p className="text-[10px] text-neutral-600 bg-emerald-600/5 p-1.5 border-l border-neutral-500 font-sans italic leading-tight">
                            {aiParsedResult.note || "No profile bio remarks extracted."}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => setAiParsedResult(null)}
                          className="flex-1 py-1.5 border border-neutral-300 bg-white hover:bg-neutral-50 text-[9px] font-bold text-neutral-600 rounded-xl cursor-pointer"
                        >
                          Reset / Scrap
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveAiParsedEmployee}
                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-neutral-800 text-white text-[9px] font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1"
                        >
                          <CheckCircle className="h-3 w-3 text-emerald-400" />
                          <span>Approve & Save</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeAddTab === "csv" && (
              <div className="space-y-4 text-left mt-4 animate-fade-in-down">
                <p className="text-[10px] text-neutral-500 leading-relaxed font-mono ">
                  Bulk Register Personnel via CSV
                </p>

                {/* Pre-fill Option */}
                <div className="border border-emerald-200 bg-emerald-50/20 p-2.5">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] font-bold text-emerald-800 font-mono">Worklog Match Auto-Prefill</span>
                    <span className="text-[8px] bg-emerald-100 text-emerald-800 font-bold px-1 py-0.5 font-mono">Recommended</span>
                  </div>
                  <p className="text-[10px] text-neutral-600 leading-normal mb-2">
                    Instantly seed Amara Sterling, Devon Miller, Sarah Jenkins, and Marcus Chen to match your existing clock-In/Out sheets and resolve outstanding rate badges automatically.
                  </p>
                  <button
                    type="button"
                    onClick={loadDefaultCsvEmployees}
                    className="w-full py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[9px] rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition-colors border-0"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    <span>Prefill & Parse Standard profiles</span>
                  </button>
                </div>

                {/* Drag and Drop Zone */}
                <div
                  onDragEnter={handleCsvDrag}
                  onDragOver={handleCsvDrag}
                  onDragLeave={handleCsvDrag}
                  onDrop={handleCsvDrop}
                  className={`border border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer ${
                    csvDragActive 
                      ? "border-emerald-500 bg-emerald-50/10" 
                      : csvFile 
                        ? "border-neutral-200 bg-emerald-600/5" 
                        : "border-neutral-300 hover:border-neutral-400 bg-neutral-50/30"
                  }`}
                  onClick={() => csvFileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={csvFileInputRef}
                    onChange={handleCsvFileChange}
                    className="hidden"
                    accept=".csv"
                  />
                  <Upload className="h-6 w-6 text-neutral-400 mx-auto mb-1.5" />
                  <p className="text-[10px] font-bold text-neutral-600 font-sans">
                    {csvFile ? csvFile.name : "Select or Drop employee CSV"}
                  </p>
                  <p className="text-[9px] text-neutral-400 font-mono mt-0.5">
                    or click to pick files
                  </p>
                </div>

                <div className="text-center text-[9px] font-bold text-neutral-400 font-mono block my-1">
                  - OR paste raw code -
                </div>

                {/* Paste Area */}
                <div className="space-y-1">
                  <textarea
                    placeholder="Employee Name,Role,Hourly Rate,Employee ID,Department&#10;Amara Sterling,Senior Server,19.50,EMP-101,Service&#10;Devon Miller,Line Cook,18.00,EMP-102,Kitchen"
                    value={csvPasteText}
                    onChange={(e) => setCsvPasteText(e.target.value)}
                    rows={4}
                    className="w-full p-2 border border-neutral-300 text-[10px] focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-50/20 font-mono resize-none leading-relaxed"
                  />
                  <button
                    type="button"
                    onClick={handleCsvPasteSubmit}
                    className="w-full py-1.5 border border-neutral-200 hover:bg-neutral-50 text-neutral-900 font-bold font-mono text-[9px] rounded-xl cursor-pointer flex items-center justify-center gap-1 bg-white"
                  >
                    Parse Paste Lines
                  </button>
                </div>

                {csvError && (
                  <div className="text-[10px] font-mono p-2 bg-rose-50 text-rose-800 border border-rose-300">
                    {csvError}
                  </div>
                )}

                {csvSuccess && (
                  <div className="text-[10px] font-sans p-2 bg-emerald-50 text-emerald-800 border border-emerald-300">
                    {csvSuccess}
                  </div>
                )}

                {/* Parsed CSV Members Preview */}
                {csvParsedEmployees.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-dashed border-neutral-200">
                    <div className="p-2.5 bg-neutral-50 border border-neutral-200">
                      <div className="flex justify-between items-center pb-2 border-b border-neutral-200 mb-2">
                        <span className="text-[8px] font-bold text-neutral-500 font-mono">Ready to Register ({csvParsedEmployees.length})</span>
                        <span className="text-[8px] font-bold text-emerald-700 font-mono">Dossier Rows</span>
                      </div>

                      <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1">
                        {csvParsedEmployees.map((emp, index) => (
                          <div key={index} className="flex justify-between items-center bg-white p-1.5 border border-neutral-200 text-[10px]">
                            <div className="truncate pr-2">
                              <span className="font-bold text-neutral-800 text-[11px] block truncate">{emp.name}</span>
                              <span className="text-neutral-500 font-mono text-[9px] block">
                                {emp.role} • ${emp.hourlyRate.toFixed(2)}/hr {emp.employeeCode ? `• ID: ${emp.employeeCode}` : ""}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeParsedCsvEmployeeItem(index)}
                              className="text-neutral-400 hover:text-rose-600 transition-colors cursor-pointer p-1 border-0 bg-transparent"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2 mt-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setCsvParsedEmployees([])}
                          className="flex-1 py-1.5 border border-neutral-300 bg-white hover:bg-neutral-50 text-[9px] font-bold text-neutral-600 rounded-xl cursor-pointer"
                        >
                          Scrap All
                        </button>
                        <button
                          type="button"
                          disabled={csvIsSubmitting}
                          onClick={handleSaveAllCsvEmployees}
                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-neutral-850 text-white text-[9px] font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1 bg-neutral-900 border-0"
                        >
                          {csvIsSubmitting ? (
                            <Loader2 className="h-3 w-3 animate-spin text-white" />
                          ) : (
                            <Plus className="h-3 w-3 text-emerald-400" />
                          )}
                          <span>{csvIsSubmitting ? "Running..." : "Save Members"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          )}
        </div>

        {/* Directory Listing Column (Expanded to handle many registered users) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-neutral-200 p-5 rounded-xl text-left shadow-sm flex flex-col h-full min-h-[500px]" id="staff-list-card">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-neutral-200">
              <div>
                <h3 className="text-xs font-bold font-sans text-neutral-900">
                  Staff Directory & Payroll Index
                </h3>
                <p className="text-[10px] text-neutral-400 font-sans mt-0.5 animate-none">
                  Showing {filteredEmployees.length} of {totalCount} registered employees
                </p>
              </div>

              <div className="flex items-center gap-2 border border-neutral-200 px-2 py-1 bg-neutral-50/50 text-[10px] font-mono">
                <SlidersHorizontal className="h-3 w-3 text-neutral-500" />
                <span className="text-neutral-500">Fast Filters Active</span>
              </div>
            </div>

            {/* Controls for large registry */}
            <div className="flex flex-col sm:flex-row gap-3 py-4" id="directory-controls">
              
              {/* Search */}
              <div className="relative flex-1 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search name, role, or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl font-sans"
                  />
                </div>
                <AIAssistantModal 
                  context="Staff Registry"
                  itemNames={Array.from(new Set(employees.map(e => e.name)))}
                  onSearchTerms={(terms) => setSearchQuery(terms.join(", "))}
                />
              </div>

              {/* ID Filters */}
              <div className="flex gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIdFilter("all")}
                  className={`px-2.5 py-1.5 text-[9px] font-bold border rounded-xl ${
                    idFilter === "all" ? "bg-emerald-600 text-white border-neutral-200" : "bg-white text-neutral-500 border-neutral-300 hover:bg-neutral-50"
                  }`}
                >
                  All State
                </button>
                <button
                  type="button"
                  onClick={() => setIdFilter("missing")}
                  className={`px-2.5 py-1.5 text-[9px] font-bold border rounded-xl ${
                    idFilter === "missing" 
                      ? "bg-amber-600 text-white border-amber-600" 
                      : "bg-amber-50/50 text-amber-800 border-amber-300 hover:bg-amber-50"
                  }`}
                >
                  Missing ID ({missingIdCount})
                </button>
              </div>

              {/* Role filter dropdown */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="p-1 px-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-white min-w-[120px]"
              >
                <option value="all">All Roles</option>
                {uniqueRoles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            {/* List stage and cards */}
            <div className="flex-1 overflow-y-auto border border-neutral-200 divide-y divide-neutral-150 max-h-[500px]">
              {filteredEmployees.length === 0 ? (
                <div className="py-16 text-center text-neutral-400 space-y-2">
                  <Smile className="h-8 w-8 text-neutral-300 mx-auto" />
                  <p className="text-[10px] font-mono text-neutral-500">No results match filters</p>
                  <p className="text-[9px] text-neutral-900/60 max-w-xs mx-auto">Try typing a different keyword, clearing your filters, or registering a new staff member on the left.</p>
                </div>
              ) : (
                filteredEmployees.map((emp, idx) => {
                  const isEditing = editEmpId === emp.id;
                  const isMissingId = !emp.employeeCode || emp.employeeCode.trim() === "";

                  return (
                    <div key={emp.id ? `${emp.id}-${idx}` : idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-neutral-50/55 transition-colors">
                      {isEditing ? (
                        <div className="flex-1 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <span className="text-[8px] text-neutral-400 font-bold font-mono block mb-1">Staff Member Name</span>
                              <input
                                type="text"
                                value={editEmpName}
                                onChange={(e) => setEditEmpName(e.target.value)}
                                className="p-1.5 border border-neutral-300 text-xs w-full focus:outline-none focus:border-neutral-200 rounded-xl"
                              />
                            </div>
                            <div>
                              <span className="text-[8px] text-neutral-400 font-bold font-mono block mb-1">Employee ID</span>
                              <input
                                type="text"
                                value={editEmpCode}
                                onChange={(e) => setEditEmpCode(e.target.value)}
                                placeholder="E.g. EMP-99"
                                className="p-1.5 border border-neutral-300 text-xs w-full font-mono focus:outline-none focus:border-neutral-200 rounded-xl"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <span className="text-[8px] text-neutral-400 font-bold font-mono block mb-1">Role Title</span>
                              <input
                                type="text"
                                value={editEmpRole}
                                onChange={(e) => setEditEmpRole(e.target.value)}
                                className="p-1.5 border border-neutral-300 text-xs w-full focus:outline-none focus:border-neutral-200 rounded-xl"
                              />
                            </div>
                            <div>
                              <span className="text-[8px] text-neutral-400 font-bold font-mono block mb-1">Hourly Rate ($)</span>
                              <input
                                type="number"
                                step="0.01"
                                value={editEmpRate}
                                onChange={(e) => setEditEmpRate(parseFloat(e.target.value) || 0)}
                                className="p-1.5 border border-neutral-300 text-xs w-full font-mono focus:outline-none focus:border-neutral-200 rounded-xl"
                              />
                            </div>
                          </div>

                          {editError && (
                            <p className="text-[9px] font-mono text-rose-700 bg-rose-50 p-1 border border-rose-200">{editError}</p>
                          )}

                          <div className="flex gap-2 justify-end pt-1">
                            <button
                              onClick={() => setEditEmpId(null)}
                              className="px-2.5 py-1 border border-neutral-300 hover:bg-neutral-100 text-[10px] font-bold rounded-xl flex items-center gap-1 transition-colors"
                            >
                              <X className="h-3 w-3" />
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveEdit(emp.id!)}
                              className="px-2.5 py-1 bg-emerald-600 text-white hover:bg-neutral-800 text-[10px] font-bold rounded-xl flex items-center gap-1 transition-colors"
                            >
                              <Check className="h-3 w-3" />
                              Save Changes
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="text-left space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span 
                                onClick={() => setSelectedEmp(emp)} 
                                className="font-bold text-neutral-900 text-sm hover:underline hover:text-black cursor-pointer" 
                                title="Click to view detailed employee HR & payroll dossier"
                              >
                                {emp.name}
                              </span>
                              <span className="text-[8px] font-mono bg-neutral-100 text-neutral-600 px-1.5 py-0.5 border border-neutral-200 font-semibold">
                                {emp.role || "Staff"}
                              </span>
                              {emp.employeeCode ? (
                                <span className="text-[8px] font-mono bg-neutral-100 text-neutral-800 px-1.5 py-0.5 border border-dashed border-neutral-300 font-bold">
                                  ID: {emp.employeeCode}
                                </span>
                              ) : (
                                <span className="text-[8px] font-mono bg-rose-50 text-rose-700 px-1.5 py-0.5 border border-dashed border-rose-300 font-bold flex items-center gap-1 animate-pulse">
                                  <AlertTriangle className="h-2.5 w-2.5 text-rose-600" />
                                  No Employee ID
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-neutral-500 font-mono">
                              Payroll compensation: <strong className="text-emerald-700 font-bold">${emp.hourlyRate.toFixed(2)}/hr</strong>
                              {emp.dept && <span className="text-neutral-400 font-sans ml-2">({emp.dept})</span>}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 justify-end">
                            <button
                              onClick={() => {
                                setSelectedEmp(emp);
                                setIsEditingProfile(false);
                              }}
                              className="p-2 border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50 text-neutral-600 transition-all rounded-xl"
                              title="Detailed HR Dossier Profile"
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </button>
                            {!isReadOnly ? (
                              <>
                                <button
                                  onClick={() => startEdit(emp)}
                                  className="p-2 border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50 text-neutral-600 transition-all rounded-xl"
                                  title="Edit worker basic record"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => emp.id && onDeleteEmployee(emp.id)}
                                  className="p-2 border border-neutral-200 hover:border-red-400 hover:bg-rose-50 text-neutral-400 hover:text-rose-700 transition-all rounded-xl"
                                  title="Delete worker record"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            ) : (
                              <div className="p-2 text-neutral-400" title="Read Only">
                                <Lock className="h-3.5 w-3.5" />
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>

      {/* EMPLOYEE DETAILED DOSSIER PROFILE DRAWER */}
      {selectedEmp && (
        <div className="fixed inset-0 z-50 flex justify-end" id="employee-profile-drawer">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-neutral-900/40 backdrop-blur-[2px] transition-opacity cursor-pointer"
            onClick={() => {
              setSelectedEmp(null);
              setIsEditingProfile(false);
            }}
          />

          {/* Drawer Body */}
          <div className="relative w-full max-w-lg bg-white border-l border-neutral-200 shadow-2xl h-full flex flex-col z-50 animate-none">
            
            {/* Header */}
            <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/50">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {selectedEmp.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 ">{selectedEmp.name}</h3>
                  <p className="text-[10px] text-neutral-400 font-mono italic">HR & Financial Payroll Profile</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditingProfile) {
                        setIsEditingProfile(false);
                      } else {
                        setProfileEditState(selectedEmp);
                        setIsEditingProfile(true);
                      }
                    }}
                    className="px-2.5 py-1.5 text-[9px] font-bold border border-neutral-200 rounded-xl hover:bg-neutral-50 text-neutral-800 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit className="h-3 w-3" />
                    <span>{isEditingProfile ? "View Info" : "Edit Profile"}</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedEmp(null);
                    setIsEditingProfile(false);
                  }}
                  className="p-1.5 border border-neutral-300 hover:bg-neutral-100 rounded-xl cursor-pointer"
                >
                  <X className="h-4 w-4 text-neutral-500" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              
              {profileEditError && (
                <div className="text-[10px] font-mono p-2 bg-rose-50 text-rose-800 border border-rose-300">
                  {profileEditError}
                </div>
              )}

              {isEditingProfile ? (
                // ==================== EDIT PROFILE VIEW ====================
                <div className="space-y-4 text-left">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 block font-mono">Employee Full Name *</label>
                      <input
                        type="text"
                        value={profileEditState.name || ""}
                        onChange={(e) => setProfileEditState({ ...profileEditState, name: e.target.value })}
                        className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-100/10 font-sans"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 block font-mono">Employee ID (Code)</label>
                      <input
                        type="text"
                        value={profileEditState.employeeCode || ""}
                        onChange={(e) => setProfileEditState({ ...profileEditState, employeeCode: e.target.value })}
                        className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-100/10 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 block font-mono">Role Title</label>
                      <input
                        type="text"
                        value={profileEditState.role || ""}
                        onChange={(e) => setProfileEditState({ ...profileEditState, role: e.target.value })}
                        className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-100/10 font-sans"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 block font-mono">Department</label>
                      <input
                        type="text"
                        value={profileEditState.dept || ""}
                        onChange={(e) => setProfileEditState({ ...profileEditState, dept: e.target.value })}
                        className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-100/10 font-sans"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 block font-mono">Reg Rate ($/hr) *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={profileEditState.hourlyRate ?? 0}
                        onChange={(e) => setProfileEditState({ ...profileEditState, hourlyRate: parseFloat(e.target.value) || 0 })}
                        className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-100/10 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 block font-mono">OT Rate ($/hr)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={profileEditState.otRate ?? 0}
                        onChange={(e) => setProfileEditState({ ...profileEditState, otRate: parseFloat(e.target.value) || 0 })}
                        className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-100/10 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 block font-mono">Date Hired</label>
                      <input
                        type="date"
                        value={profileEditState.dateHired || ""}
                        onChange={(e) => setProfileEditState({ ...profileEditState, dateHired: e.target.value })}
                        className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-100/10 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 block font-mono">Date Terminated</label>
                      <input
                        type="date"
                        value={profileEditState.dateTerminated || ""}
                        onChange={(e) => setProfileEditState({ ...profileEditState, dateTerminated: e.target.value })}
                        className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-100/10 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 block font-mono">Tax Status</label>
                      <select
                        value={profileEditState.taxStatus || "Single"}
                        onChange={(e) => setProfileEditState({ ...profileEditState, taxStatus: e.target.value })}
                        className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-white font-sans"
                      >
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Head of Household">Head of Household</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 block font-mono">Phone No</label>
                      <input
                        type="text"
                        value={profileEditState.phoneNo || ""}
                        onChange={(e) => setProfileEditState({ ...profileEditState, phoneNo: e.target.value })}
                        className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-100/10 font-sans"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-neutral-400 block font-mono">Home Address</label>
                    <input
                      type="text"
                      value={profileEditState.address || ""}
                      onChange={(e) => setProfileEditState({ ...profileEditState, address: e.target.value })}
                      className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-100/10 font-sans"
                    />
                  </div>

                  {/* Financial Fields */}
                  <div className="border-t border-neutral-200 pt-3 space-y-3">
                    <h4 className="text-[10px] font-bold text-neutral-500 font-mono">Payroll Calculations</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-neutral-400 block font-mono">Taxable Income ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={profileEditState.taxableIncome ?? 0}
                          onChange={(e) => setProfileEditState({ ...profileEditState, taxableIncome: parseFloat(e.target.value) || 0 })}
                          className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-100/10 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-neutral-400 block font-mono">Taxes Withheld ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={profileEditState.taxesWithheld ?? 0}
                          onChange={(e) => setProfileEditState({ ...profileEditState, taxesWithheld: parseFloat(e.target.value) || 0 })}
                          className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-100/10 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-neutral-400 block font-mono">Insurance Deduction ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={profileEditState.insuranceDeduction ?? 0}
                          onChange={(e) => setProfileEditState({ ...profileEditState, insuranceDeduction: parseFloat(e.target.value) || 0 })}
                          className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-100/10 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-neutral-400 block font-mono">Check Amount ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={profileEditState.checkAmount ?? 0}
                          onChange={(e) => setProfileEditState({ ...profileEditState, checkAmount: parseFloat(e.target.value) || 0 })}
                          className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-100/10 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-neutral-400 block font-mono">Pay Amount ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={profileEditState.payAmount ?? 0}
                          onChange={(e) => setProfileEditState({ ...profileEditState, payAmount: parseFloat(e.target.value) || 0 })}
                          className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-100/10 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-neutral-400 block font-mono">Actual Cash Pay ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={profileEditState.actualCashPay ?? 0}
                          onChange={(e) => setProfileEditState({ ...profileEditState, actualCashPay: parseFloat(e.target.value) || 0 })}
                          className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-neutral-100/10 font-mono"
                        />
                      </div>
                    </div>

                    {/* Checkboxes */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-sans pt-2">
                      <label className="flex items-center gap-2 text-neutral-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={profileEditState.mbExempt || false}
                          onChange={(e) => setProfileEditState({ ...profileEditState, mbExempt: e.target.checked })}
                          className="h-3.5 w-3.5 border-neutral-300 rounded-xl focus:ring-[#141414]"
                        />
                        <span>M & B Exempt</span>
                      </label>

                      <label className="flex items-center gap-2 text-neutral-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={profileEditState.tipped || false}
                          onChange={(e) => setProfileEditState({ ...profileEditState, tipped: e.target.checked })}
                          className="h-3.5 w-3.5 border-neutral-300 rounded-xl focus:ring-[#141414]"
                        />
                        <span>Tipped Employee</span>
                      </label>

                      <label className="flex items-center gap-2 text-neutral-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={profileEditState.isSalary || false}
                          onChange={(e) => setProfileEditState({ ...profileEditState, isSalary: e.target.checked })}
                          className="h-3.5 w-3.5 border-neutral-300 rounded-xl focus:ring-[#141414]"
                        />
                        <span>Salaried Basis</span>
                      </label>

                      <label className="flex items-center gap-2 text-neutral-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={profileEditState.sickDayEligible || false}
                          onChange={(e) => setProfileEditState({ ...profileEditState, sickDayEligible: e.target.checked })}
                          className="h-3.5 w-3.5 border-neutral-300 rounded-xl focus:ring-[#141414]"
                        />
                        <span>Sick Day Eligible</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-neutral-400 block font-mono">Special Profile Notes</label>
                    <textarea
                      value={profileEditState.note || ""}
                      onChange={(e) => setProfileEditState({ ...profileEditState, note: e.target.value })}
                      rows={3}
                      className="w-full p-2 border border-neutral-300 text-xs focus:outline-none focus:border-neutral-200 rounded-xl bg-emerald-600/5 font-sans resize-none"
                    />
                  </div>
                </div>
              ) : (
                // ==================== READ EMBEDDED PROFILE DOSSIER ====================
                <div className="space-y-6 text-left">
                  
                  {/* Category 1: Info and General */}
                  <div className="border border-neutral-200 p-4 bg-neutral-50/25 space-y-3.5">
                    <h4 className="text-[9px] font-bold text-neutral-400 font-mono flex items-center gap-1">
                      <Briefcase className="h-3 w-3 text-neutral-500" />
                      <span>General & Location Info</span>
                    </h4>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-[9px] text-neutral-400 block font-mono">Dept (Department)</span>
                        <strong className="text-neutral-800 text-sm font-sans block mt-0.5">{selectedEmp.dept || "Unassigned"}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-400 block font-mono">Access ID Code</span>
                        <strong className="text-neutral-800 text-sm font-mono block mt-0.5">{selectedEmp.employeeCode || "N/A"}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-400 block font-mono">Phone No</span>
                        <strong className="text-neutral-800 font-sans block mt-0.5 flex items-center gap-1">
                          <Phone className="h-3 w-3 text-neutral-400 font-mono" />
                          {selectedEmp.phoneNo || "N/A"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-400 block font-mono">Role Title</span>
                        <strong className="text-neutral-800 text-sm font-sans block mt-0.5">{selectedEmp.role || "Staff"}</strong>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-neutral-150">
                      <span className="text-[9px] text-neutral-400 block font-mono">Home Address</span>
                      <p className="text-neutral-700 text-xs mt-0.5 flex items-center gap-1 font-sans">
                        <MapPin className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                        <span>{selectedEmp.address || "No address declared"}</span>
                      </p>
                    </div>
                  </div>

                  {/* Category 2: Compensation Rates */}
                  <div className="border border-neutral-200 p-4 bg-neutral-50/25 space-y-3.5">
                    <h4 className="text-[9px] font-bold text-neutral-400 font-mono flex items-center gap-1">
                      <Coins className="h-3 w-3 text-neutral-500" />
                      <span>HR Compensation index</span>
                    </h4>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-[9px] text-neutral-400 block font-mono">Reg Rate (Regular)</span>
                        <strong className="text-emerald-700 text-lg font-mono block mt-0.5">${selectedEmp.hourlyRate.toFixed(2)}<span className="text-xs text-neutral-400">/hr</span></strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-400 block font-mono">OT Rate (Overtime)</span>
                        <strong className="text-neutral-800 text-lg font-mono block mt-0.5">
                          ${(selectedEmp.otRate ?? (selectedEmp.hourlyRate * 1.5)).toFixed(2)}<span className="text-xs text-neutral-400">/hr</span>
                        </strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-400 block font-mono">Employment Type</span>
                        <span className={`inline-block mt-1.5 text-[9px] font-bold px-2 py-0.5 border ${selectedEmp.isSalary ? "bg-amber-50 text-amber-900 border-amber-300" : "bg-emerald-50 text-emerald-900 border-emerald-300"}`}>
                          {selectedEmp.isSalary ? "Salaried Basis" : "Hourly wage"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-400 block font-mono">Sick Day Eligible</span>
                        <span className={`inline-block mt-1.5 text-[9px] font-bold px-2 py-0.5 border ${selectedEmp.sickDayEligible ? "bg-blue-50 text-blue-900 border-blue-300" : "bg-neutral-100 text-neutral-500 border-neutral-200"}`}>
                          {selectedEmp.sickDayEligible ? "Eligible" : "Non-eligible"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Category 3: Payroll Details */}
                  <div className="border border-neutral-200 p-4 bg-neutral-50/25 space-y-3.5">
                    <h4 className="text-[9px] font-bold text-neutral-400 font-mono flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-neutral-500" />
                      <span>Structured Payroll Calculations</span>
                    </h4>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                      <div>
                        <span className="text-[9px] text-neutral-400 block font-mono">Tax Status</span>
                        <strong className="text-neutral-800 font-sans block mt-0.5">{selectedEmp.taxStatus || "Single"}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-400 block font-mono">Taxable Income</span>
                        <strong className="text-neutral-800 font-mono block mt-0.5">${(selectedEmp.taxableIncome ?? 0).toFixed(2)}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-400 block font-mono">Taxes Withheld</span>
                        <strong className="text-red-700 font-mono block mt-0.5">${(selectedEmp.taxesWithheld ?? 0).toFixed(2)}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-400 block font-mono">Insurance Deduction</span>
                        <strong className="text-neutral-700 font-mono block mt-0.5">${(selectedEmp.insuranceDeduction ?? 0).toFixed(2)}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-400 block font-mono">Net Check Amount</span>
                        <strong className="text-emerald-700 font-bold font-mono block mt-0.5">${(selectedEmp.checkAmount ?? 0).toFixed(2)}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-400 block font-mono">Actual Cash Pay</span>
                        <strong className="text-emerald-700 font-bold font-mono block mt-0.5">${(selectedEmp.actualCashPay ?? 0).toFixed(2)}</strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-105 text-[10px] font-sans text-neutral-600">
                      <div className="flex items-center gap-1.5">{selectedEmp.mbExempt ? "✅" : "❌"} M & B Exempt</div>
                      <div className="flex items-center gap-1.5">{selectedEmp.tipped ? "✅" : "❌"} Tipped worker</div>
                    </div>
                  </div>

                  {/* Category 4: Employment Schedule & Notes */}
                  <div className="border border-neutral-200 p-4 bg-neutral-50/25 space-y-3">
                    <h4 className="text-[9px] font-bold text-neutral-400 font-mono flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-neutral-500" />
                      <span>Employment Schedule Dates</span>
                    </h4>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-[9px] text-neutral-400 block font-mono">Date Hired</span>
                        <strong className="text-neutral-800 font-mono block mt-0.5">{selectedEmp.dateHired || "No date defined"}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-400 block font-mono">Date Terminated</span>
                        <strong className="text-neutral-800 font-mono block mt-0.5">{selectedEmp.dateTerminated || "Active service"}</strong>
                      </div>
                    </div>

                    {selectedEmp.note && (
                      <div className="pt-3 border-t border-neutral-150">
                        <span className="text-[9px] text-neutral-400 block font-mono">Special Dossier Remarks</span>
                        <p className="text-neutral-600 font-sans italic text-xs mt-1 bg-white p-2 border border-neutral-200 rounded-xl leading-relaxed">
                          "{selectedEmp.note}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            {isEditingProfile && (
              <div className="px-5 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="px-4 py-2 border border-neutral-300 hover:bg-neutral-150 text-[10px] font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfileEdit}
                  className="px-4 py-2 bg-emerald-600 hover:bg-neutral-800 text-white text-[10px] font-bold rounded-xl flex items-center gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Save Profile</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
