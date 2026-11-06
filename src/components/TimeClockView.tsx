import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Clock,
  KeyRound,
  Users,
  Coffee,
  Play,
  Square,
  AlertTriangle,
  CheckCircle2,
  Delete,
  ShieldCheck,
  DollarSign,
  UserCheck,
  Search,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { ActiveShift, Employee, Timecard } from "../types";
import { getEffectiveEmployeePin } from "../hooks/useTimeclock";
import { STANDARD_DEPARTMENT_NAMES } from "../constants/departments";

interface TimeClockViewProps {
  employees: Employee[];
  activeShifts: ActiveShift[];
  timecards: Timecard[];
  verifyEmployeeByPinOrCode: (input: string) => Employee | null;
  getActiveShiftForEmployee: (
    employeeId?: string,
    employeeName?: string
  ) => ActiveShift | undefined;
  onClockIn: (
    employee: Employee,
    roleOverride?: string,
    deptOverride?: string,
    notes?: string
  ) => Promise<ActiveShift>;
  onStartBreak: (
    shiftId: string,
    breakType: "meal_unpaid" | "rest_paid"
  ) => Promise<void>;
  onEndBreak: (shiftId: string) => Promise<void>;
  onClockOut: (
    shiftId: string,
    options?: {
      isAutoClockOut?: boolean;
      customClockOutDate?: Date;
      managerNote?: string;
    }
  ) => Promise<Timecard | null>;
  onAssignEmployeePin: (employeeId: string, newPin: string) => Promise<void>;
  onSwitchToTimesheets?: () => void;
  departments?: string[];
  isReadOnly?: boolean;
}

function formatDurationHMS(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ].join(":");
}

export default function TimeClockView({
  employees,
  activeShifts,
  timecards,
  verifyEmployeeByPinOrCode,
  getActiveShiftForEmployee,
  onClockIn,
  onStartBreak,
  onEndBreak,
  onClockOut,
  onAssignEmployeePin,
  onSwitchToTimesheets,
  departments = STANDARD_DEPARTMENT_NAMES,
  isReadOnly = false,
}: TimeClockViewProps) {
  const [activeTab, setActiveTab] = useState<"terminal" | "manager" | "pins">(
    "terminal"
  );

  // Isolated 1-second clock ticker for live shift timers
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // PIN Terminal States
  const [pinInput, setPinInput] = useState<string>("");
  const [verifiedEmployee, setVerifiedEmployee] = useState<Employee | null>(
    null
  );
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [terminalError, setTerminalError] = useState<string>("");
  const [terminalReceipt, setTerminalReceipt] = useState<{
    title: string;
    subtitle: string;
    timestamp: string;
    tone: "emerald" | "amber" | "indigo";
  } | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);
  const [showPinDirectory, setShowPinDirectory] = useState<boolean>(true);

  // Manager Quick Clock-In States
  const [managerSelectedEmpId, setManagerSelectedEmpId] = useState<string>("");
  const [managerSelectedDept, setManagerSelectedDept] = useState<string>("Kitchen");
  const [managerSearch, setManagerSearch] = useState<string>("");

  // PIN Management States
  const [editingPinEmpId, setEditingPinEmpId] = useState<string | null>(null);
  const [editingPinValue, setEditingPinValue] = useState<string>("");
  const [pinSaveStatus, setPinSaveStatus] = useState<string>("");

  // Verify PIN or Employee Code handler
  const handleVerifyInput = useCallback(
    (codeToVerify?: string) => {
      const target = (codeToVerify ?? pinInput).trim();
      setTerminalError("");
      setTerminalReceipt(null);
      if (!target) {
        setTerminalError("Enter your 4-digit PIN or Employee Code.");
        return;
      }
      const matched = verifyEmployeeByPinOrCode(target);
      if (!matched) {
        setTerminalError(
          `No staff profile matched "${target}". Check the Staff PIN directory or try your Employee Code.`
        );
        return;
      }
      setVerifiedEmployee(matched);
      setSelectedRole(matched.role || "Staff");
      setSelectedDept(matched.dept || "Kitchen");
    },
    [pinInput, verifyEmployeeByPinOrCode]
  );

  // Auto-verify when 4 digits are typed on keypad if they match a known employee
  const handleKeypadDigit = useCallback(
    (digit: string) => {
      setTerminalError("");
      setTerminalReceipt(null);
      setPinInput((prev) => {
        const next = (prev + digit).slice(0, 10);
        if (next.length === 4) {
          const matched = verifyEmployeeByPinOrCode(next);
          if (matched) {
            setVerifiedEmployee(matched);
            setSelectedRole(matched.role || "Staff");
            setSelectedDept(matched.dept || "Kitchen");
          }
        }
        return next;
      });
    },
    [verifyEmployeeByPinOrCode]
  );

  const handleResetTerminal = useCallback(() => {
    setPinInput("");
    setVerifiedEmployee(null);
    setTerminalError("");
  }, []);

  // Physical Keyboard Support when on Terminal tab
  useEffect(() => {
    if (activeTab !== "terminal" || verifiedEmployee) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleKeypadDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setPinInput((prev) => prev.slice(0, -1));
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleResetTerminal();
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleVerifyInput();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activeTab,
    verifiedEmployee,
    handleKeypadDigit,
    handleResetTerminal,
    handleVerifyInput,
  ]);

  // Active shift for the currently verified employee on the terminal
  const currentVerifiedShift = useMemo(() => {
    if (!verifiedEmployee) return undefined;
    return getActiveShiftForEmployee(verifiedEmployee.id, verifiedEmployee.name);
  }, [verifiedEmployee, getActiveShiftForEmployee]);

  // Terminal Punch Actions
  const handleTerminalClockIn = async () => {
    if (!verifiedEmployee || isProcessingAction) return;
    setIsProcessingAction(true);
    setTerminalError("");
    try {
      const shift = await onClockIn(
        verifiedEmployee,
        selectedRole || verifiedEmployee.role,
        selectedDept || verifiedEmployee.dept
      );
      setTerminalReceipt({
        title: `Clocked In — ${verifiedEmployee.name}`,
        subtitle: `${shift.role} · ${shift.dept} · Started at ${shift.clockInFormatted}`,
        timestamp: shift.clockInFormatted,
        tone: "emerald",
      });
      setTimeout(() => {
        setPinInput("");
        setVerifiedEmployee(null);
      }, 2800);
    } catch (err: any) {
      setTerminalError(err?.message || "Could not clock in.");
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleTerminalStartBreak = async (
    breakType: "meal_unpaid" | "rest_paid"
  ) => {
    if (!currentVerifiedShift?.id || isProcessingAction) return;
    setIsProcessingAction(true);
    setTerminalError("");
    try {
      await onStartBreak(currentVerifiedShift.id, breakType);
      const label =
        breakType === "meal_unpaid"
          ? "Unpaid Meal Break (30m)"
          : "Paid Rest Break (15m)";
      setTerminalReceipt({
        title: `Break Started — ${currentVerifiedShift.employeeName}`,
        subtitle: `${label} · Started at ${new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        tone: "amber",
      });
      setTimeout(() => {
        setPinInput("");
        setVerifiedEmployee(null);
      }, 2800);
    } catch (err: any) {
      setTerminalError(err?.message || "Could not start break.");
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleTerminalEndBreak = async () => {
    if (!currentVerifiedShift?.id || isProcessingAction) return;
    setIsProcessingAction(true);
    setTerminalError("");
    try {
      await onEndBreak(currentVerifiedShift.id);
      setTerminalReceipt({
        title: `Shift Resumed — ${currentVerifiedShift.employeeName}`,
        subtitle: `Break ended · Back on active floor duty`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        tone: "emerald",
      });
      setTimeout(() => {
        setPinInput("");
        setVerifiedEmployee(null);
      }, 2800);
    } catch (err: any) {
      setTerminalError(err?.message || "Could not end break.");
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleTerminalClockOut = async () => {
    if (!currentVerifiedShift?.id || isProcessingAction) return;
    setIsProcessingAction(true);
    setTerminalError("");
    try {
      const completed = await onClockOut(currentVerifiedShift.id);
      setTerminalReceipt({
        title: `Clocked Out — ${currentVerifiedShift.employeeName}`,
        subtitle: completed
          ? `Paid Hours: ${completed.paidHours.toFixed(2)}h · Unpaid Break: ${completed.unpaidBreakMinutes}m · Saved to Timesheets`
          : "Shift completed and logged to Timesheets",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        tone: "indigo",
      });
      setTimeout(() => {
        setPinInput("");
        setVerifiedEmployee(null);
      }, 3200);
    } catch (err: any) {
      setTerminalError(err?.message || "Could not clock out.");
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Live Telemetry & Compliance Calculations for Manager Dashboard
  const shiftMetrics = useMemo(() => {
    let onFloorCount = 0;
    let onBreakCount = 0;
    let liveAccruedLaborCost = 0;
    let complianceAlertsCount = 0;

    const enrichedShifts = activeShifts.map((shift) => {
      const startMs = new Date(shift.clockInIso).getTime();
      const elapsedMs = Math.max(0, nowMs - startMs);
      const elapsedHours = elapsedMs / (1000 * 60 * 60);

      let currentBreakMins = 0;
      if (shift.status === "on_break" && shift.currentBreakStartIso) {
        currentBreakMins = Math.max(
          0,
          Math.floor(
            (nowMs - new Date(shift.currentBreakStartIso).getTime()) / 60000
          )
        );
      }

      const totalUnpaidMins =
        (shift.accumulatedUnpaidBreakMinutes || 0) +
        (shift.status === "on_break" &&
        (shift.currentBreakType || "meal_unpaid") === "meal_unpaid"
          ? currentBreakMins
          : 0);
      const totalPaidBreakMins =
        (shift.accumulatedPaidBreakMinutes || 0) +
        (shift.status === "on_break" && shift.currentBreakType === "rest_paid"
          ? currentBreakMins
          : 0);

      const netPaidHours = Math.max(0, elapsedHours - totalUnpaidMins / 60);
      const rate = Number(shift.hourlyRate) || 18.0;
      const regularHrs = Math.min(8, netPaidHours);
      const overtimeHrs = Math.max(0, netPaidHours - 8);
      const accruedCost = regularHrs * rate + overtimeHrs * (rate * 1.5);

      if (shift.status === "on_break") {
        onBreakCount += 1;
      } else {
        onFloorCount += 1;
      }
      liveAccruedLaborCost += accruedCost;

      // Compliance check
      let complianceStatus: "nominal" | "approaching_break" | "break_overdue" | "overtime" =
        "nominal";
      let complianceLabel = "Nominal";

      if (netPaidHours > 8) {
        complianceStatus = "overtime";
        complianceLabel = `Daily OT (+${overtimeHrs.toFixed(1)}h)`;
        complianceAlertsCount += 1;
      } else if (elapsedHours >= 5.0 && totalUnpaidMins < 25) {
        complianceStatus = "break_overdue";
        complianceLabel = "5h+ Meal Break Due";
        complianceAlertsCount += 1;
      } else if (elapsedHours >= 4.25 && totalUnpaidMins < 25) {
        complianceStatus = "approaching_break";
        complianceLabel = "Approaching 5h Break";
        complianceAlertsCount += 1;
      }

      return {
        ...shift,
        elapsedMs,
        elapsedHours,
        currentBreakMins,
        totalUnpaidMins,
        totalPaidBreakMins,
        netPaidHours,
        accruedCost,
        complianceStatus,
        complianceLabel,
      };
    });

    return {
      onFloorCount,
      onBreakCount,
      totalActive: activeShifts.length,
      liveAccruedLaborCost,
      complianceAlertsCount,
      enrichedShifts,
    };
  }, [activeShifts, nowMs]);

  const filteredEnrichedShifts = useMemo(() => {
    const q = managerSearch.trim().toLowerCase();
    if (!q) return shiftMetrics.enrichedShifts;
    return shiftMetrics.enrichedShifts.filter(
      (s) =>
        s.employeeName.toLowerCase().includes(q) ||
        (s.role || "").toLowerCase().includes(q) ||
        (s.dept || "").toLowerCase().includes(q) ||
        (s.employeeCode || "").toLowerCase().includes(q)
    );
  }, [shiftMetrics.enrichedShifts, managerSearch]);

  // Off-clock employees for Manager Quick Clock-In
  const offClockEmployees = useMemo(() => {
    return employees.filter(
      (emp) => !getActiveShiftForEmployee(emp.id, emp.name)
    );
  }, [employees, getActiveShiftForEmployee]);

  const handleManagerQuickClockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managerSelectedEmpId) return;
    const emp = employees.find(
      (item) => (item.id || item.name) === managerSelectedEmpId
    );
    if (!emp) return;
    try {
      await onClockIn(emp, emp.role, managerSelectedDept || emp.dept || "Kitchen");
      setManagerSelectedEmpId("");
    } catch (err: any) {
      setTerminalError(err?.message || "Failed to clock in staff member.");
    }
  };

  const handleSaveEmployeePin = async (emp: Employee, idx: number) => {
    if (!emp.id) return;
    const cleaned = editingPinValue.replace(/\D/g, "").slice(0, 6);
    if (cleaned.length < 4) {
      setPinSaveStatus("PIN must be at least 4 digits.");
      return;
    }
    await onAssignEmployeePin(emp.id, cleaned);
    setEditingPinEmpId(null);
    setEditingPinValue("");
    setPinSaveStatus(`Updated PIN for ${emp.name} to ${cleaned}`);
    setTimeout(() => setPinSaveStatus(""), 3000);
  };

  const todayDateFormatted = useMemo(() => {
    return new Date(nowMs).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [nowMs]);

  const liveClockFormatted = useMemo(() => {
    return new Date(nowMs).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }, [nowMs]);

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto">
      {/* Top Workspace Header & Segmented View Switcher */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Time Management</span>
            <span aria-hidden="true">·</span>
            <span>Real-Time Attendance & Shift Compliance</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{todayDateFormatted}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Employee Check-In / Check-Out & Live Shift Board
          </h2>
        </div>

        {/* Clean Segmented Control Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab("terminal")}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
                activeTab === "terminal"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>PIN Pad Terminal</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("manager")}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
                activeTab === "manager"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>
                Who is Clocked In ({shiftMetrics.totalActive})
              </span>
            </button>

            {!isReadOnly && (
              <button
                type="button"
                onClick={() => setActiveTab("pins")}
                className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
                  activeTab === "pins"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Staff PINs ({employees.length})</span>
              </button>
            )}
          </div>

          {onSwitchToTimesheets && !isReadOnly && (
            <button
              type="button"
              onClick={onSwitchToTimesheets}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Completed Timesheets ({timecards.length})</span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: DEDICATED EMPLOYEE CHECK-IN / CHECK-OUT PIN PAD TERMINAL       */}
      {/* ===================================================================== */}
      {activeTab === "terminal" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Column: Live Digital Clock, Floor Status & Quick Staff Directory */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              {/* Live Digital Time Display */}
              <div className="pb-5 border-b border-slate-200">
                <div className="text-xs font-medium text-slate-500">
                  Station Time · {todayDateFormatted}
                </div>
                <div className="text-4xl font-bold font-mono tabular-nums text-slate-900 tracking-tight mt-1">
                  {liveClockFormatted}
                </div>
              </div>

              {/* Active Shift Summary Strip */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[11px] font-medium text-slate-500">
                    On Active Floor
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-0.5">
                    {shiftMetrics.onFloorCount}
                  </div>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[11px] font-medium text-slate-500">
                    On Meal / Rest Break
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-amber-600 mt-0.5">
                    {shiftMetrics.onBreakCount}
                  </div>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[11px] font-medium text-slate-500">
                    Registered Staff
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {employees.length}
                  </div>
                </div>
              </div>

              {/* Quick Staff Lookup & One-Tap PIN Directory */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-900">
                    Staff Quick-Select & PIN Reference
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowPinDirectory((prev) => !prev)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {showPinDirectory ? "Hide PINs" : "Show PINs"}
                  </button>
                </div>

                <div className="border border-slate-200 rounded-lg divide-y divide-slate-200 max-h-[340px] overflow-y-auto">
                  {employees.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No employees registered yet. Add staff in the Staff Registry tab.
                    </div>
                  ) : (
                    employees.map((emp, idx) => {
                      const effectivePin = getEffectiveEmployeePin(emp, idx);
                      const activeShift = getActiveShiftForEmployee(
                        emp.id,
                        emp.name
                      );
                      const isSelected =
                        verifiedEmployee?.id === emp.id &&
                        verifiedEmployee?.name === emp.name;

                      return (
                        <button
                          key={emp.id || `${emp.name}-${idx}`}
                          type="button"
                          onClick={() => {
                            setPinInput(effectivePin);
                            handleVerifyInput(effectivePin);
                          }}
                          className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-indigo-50/70"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {emp.name}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              <span>{emp.role || "Staff"}</span>
                              <span aria-hidden="true"> · </span>
                              <span>{emp.dept || "Kitchen"}</span>
                              {emp.employeeCode && (
                                <>
                                  <span aria-hidden="true"> · </span>
                                  <span className="font-mono tabular-nums">
                                    {emp.employeeCode}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {activeShift ? (
                              <span
                                className={`text-[11px] font-medium ${
                                  activeShift.status === "on_break"
                                    ? "text-amber-700"
                                    : "text-emerald-700"
                                }`}
                              >
                                {activeShift.status === "on_break"
                                  ? "On Break"
                                  : `In ${activeShift.clockInFormatted}`}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">
                                Off Clock
                              </span>
                            )}

                            {showPinDirectory && (
                              <span className="font-mono tabular-nums text-xs font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                                PIN: {effectivePin}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>Enter 4-digit PIN or tap your name above</span>
              <span className="font-mono tabular-nums">Keyboard Enabled</span>
            </div>
          </div>

          {/* Right Column: High-Contrast Tactile PIN Keypad OR Verified Shift Action Console */}
          <div className="lg:col-span-7 bg-[#0F172A] text-white border border-slate-800 rounded-xl p-6 md:p-8 flex flex-col justify-between">
            {/* Receipt Confirmation Toast Banner */}
            {terminalReceipt && (
              <div
                className={`mb-6 p-4 rounded-lg border flex items-start justify-between gap-3 ${
                  terminalReceipt.tone === "emerald"
                    ? "bg-emerald-950/80 border-emerald-700 text-emerald-100"
                    : terminalReceipt.tone === "amber"
                    ? "bg-amber-950/80 border-amber-700 text-amber-100"
                    : "bg-indigo-950/80 border-indigo-700 text-indigo-100"
                }`}
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
                  <div>
                    <div className="text-sm font-bold">
                      {terminalReceipt.title}
                    </div>
                    <div className="text-xs opacity-90 mt-0.5">
                      {terminalReceipt.subtitle}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-mono tabular-nums opacity-80 shrink-0">
                  {terminalReceipt.timestamp}
                </span>
              </div>
            )}

            {!verifiedEmployee ? (
              /* STATE A: PIN / EMPLOYEE CODE ENTRY KEYPAD */
              <div className="max-w-md mx-auto w-full space-y-6 my-auto">
                <div className="text-center space-y-1.5">
                  <h3 className="text-lg font-bold tracking-tight text-white">
                    Enter Employee PIN or ID Code
                  </h3>
                  <p className="text-xs text-slate-400">
                    Use the keypad or keyboard to verify your identity
                  </p>
                </div>

                {/* PIN Input Display Box */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={pinInput}
                      onChange={(e) => {
                        setTerminalError("");
                        setPinInput(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleVerifyInput();
                        }
                      }}
                      placeholder="4-Digit PIN or EMP-101"
                      className="w-full bg-[#1E293B] border border-slate-700 focus:border-indigo-500 rounded-lg px-4 py-3.5 text-center text-2xl font-mono tabular-nums tracking-widest text-white placeholder:text-slate-500 placeholder:text-sm placeholder:tracking-normal focus:outline-hidden"
                    />
                  </div>

                  {terminalError && (
                    <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-lg text-xs text-rose-200 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{terminalError}</span>
                    </div>
                  )}
                </div>

                {/* Tactile 12-Button Keypad */}
                <div className="grid grid-cols-3 gap-3">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleKeypadDigit(digit)}
                      className="h-14 bg-[#1E293B] hover:bg-slate-700 active:bg-slate-600 border border-slate-700 rounded-lg text-xl font-bold font-mono tabular-nums text-white transition-colors cursor-pointer"
                    >
                      {digit}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={handleResetTerminal}
                    className="h-14 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
                  >
                    Clear
                  </button>

                  <button
                    type="button"
                    onClick={() => handleKeypadDigit("0")}
                    className="h-14 bg-[#1E293B] hover:bg-slate-700 active:bg-slate-600 border border-slate-700 rounded-lg text-xl font-bold font-mono tabular-nums text-white transition-colors cursor-pointer"
                  >
                    0
                  </button>

                  <button
                    type="button"
                    onClick={() => setPinInput((prev) => prev.slice(0, -1))}
                    className="h-14 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center justify-center text-slate-300 transition-colors cursor-pointer"
                    aria-label="Backspace"
                  >
                    <Delete className="w-5 h-5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleVerifyInput()}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Verify Staff Identity</span>
                </button>
              </div>
            ) : (
              /* STATE B: VERIFIED EMPLOYEE SHIFT CONTROL PAD */
              <div className="space-y-6 my-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                  <div>
                    <div className="text-xs text-slate-400">
                      Verified Staff Profile
                    </div>
                    <h3 className="text-2xl font-bold text-white tracking-tight mt-0.5">
                      {verifiedEmployee.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 mt-1">
                      <span>{verifiedEmployee.role || "Staff"}</span>
                      <span aria-hidden="true">·</span>
                      <span>{verifiedEmployee.dept || "Kitchen"}</span>
                      {verifiedEmployee.employeeCode && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {verifiedEmployee.employeeCode}
                          </span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums text-emerald-400">
                        ${Number(verifiedEmployee.hourlyRate || 18).toFixed(2)}/hr
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetTerminal}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Switch Staff / Cancel
                  </button>
                </div>

                {terminalError && (
                  <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-lg text-xs text-rose-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{terminalError}</span>
                  </div>
                )}

                {!currentVerifiedShift ? (
                  /* EMPLOYEE IS CURRENTLY OFF THE CLOCK */
                  <div className="space-y-5">
                    <div className="p-4 bg-[#1E293B] border border-slate-700 rounded-lg flex items-center justify-between">
                      <div>
                        <div className="text-xs text-slate-400">
                          Current Shift Status
                        </div>
                        <div className="text-base font-semibold text-slate-200 mt-0.5">
                          Off the Clock — Ready to Check In
                        </div>
                      </div>
                      <span className="text-xs font-mono tabular-nums text-slate-400">
                        {liveClockFormatted}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Shift Role / Station
                        </label>
                        <input
                          type="text"
                          value={selectedRole}
                          onChange={(e) => setSelectedRole(e.target.value)}
                          className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white focus:border-indigo-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Department
                        </label>
                        <select
                          value={selectedDept}
                          onChange={(e) => setSelectedDept(e.target.value)}
                          className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white focus:border-indigo-500 focus:outline-hidden"
                        >
                          {Array.from(
                            new Set([
                              verifiedEmployee.dept || "Kitchen",
                              ...departments,
                            ])
                          ).map((dept) => (
                            <option key={dept} value={dept}>
                              {dept}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isProcessingAction}
                      onClick={handleTerminalClockIn}
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>
                        {isProcessingAction
                          ? "Recording Check-In..."
                          : "Clock In — Start Shift Now"}
                      </span>
                    </button>
                  </div>
                ) : (
                  /* EMPLOYEE IS CURRENTLY CLOCKED IN OR ON BREAK */
                  <div className="space-y-5">
                    {(() => {
                      const shiftStartMs = new Date(
                        currentVerifiedShift.clockInIso
                      ).getTime();
                      const shiftElapsedMs = Math.max(0, nowMs - shiftStartMs);
                      const isOnBreak =
                        currentVerifiedShift.status === "on_break";
                      const breakElapsedMs =
                        isOnBreak && currentVerifiedShift.currentBreakStartIso
                          ? Math.max(
                              0,
                              nowMs -
                                new Date(
                                  currentVerifiedShift.currentBreakStartIso
                                ).getTime()
                            )
                          : 0;

                      return (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="p-4 bg-[#1E293B] border border-slate-700 rounded-lg">
                              <div className="text-xs text-slate-400">
                                Shift Status
                              </div>
                              <div
                                className={`text-sm font-bold mt-1 ${
                                  isOnBreak
                                    ? "text-amber-400"
                                    : "text-emerald-400"
                                }`}
                              >
                                {isOnBreak
                                  ? currentVerifiedShift.currentBreakType ===
                                    "rest_paid"
                                    ? "On Paid Rest Break"
                                    : "On Unpaid Meal Break"
                                  : "Active on Clock"}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5 font-mono tabular-nums">
                                In at {currentVerifiedShift.clockInFormatted}
                              </div>
                            </div>

                            <div className="p-4 bg-[#1E293B] border border-slate-700 rounded-lg">
                              <div className="text-xs text-slate-400">
                                {isOnBreak
                                  ? "Current Break Timer"
                                  : "Total Shift Elapsed"}
                              </div>
                              <div className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
                                {isOnBreak
                                  ? formatDurationHMS(breakElapsedMs)
                                  : formatDurationHMS(shiftElapsedMs)}
                              </div>
                            </div>

                            <div className="p-4 bg-[#1E293B] border border-slate-700 rounded-lg">
                              <div className="text-xs text-slate-400">
                                Logged Breaks
                              </div>
                              <div className="text-sm font-bold font-mono tabular-nums text-slate-200 mt-1">
                                {currentVerifiedShift.accumulatedUnpaidBreakMinutes ||
                                  0}
                                m Unpaid ·{" "}
                                {currentVerifiedShift.accumulatedPaidBreakMinutes ||
                                  0}
                                m Paid
                              </div>
                            </div>
                          </div>

                          {isOnBreak ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <button
                                type="button"
                                disabled={isProcessingAction}
                                onClick={handleTerminalEndBreak}
                                className="py-4 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <Play className="w-4 h-4 fill-current" />
                                <span>End Break — Resume Shift</span>
                              </button>

                              <button
                                type="button"
                                disabled={isProcessingAction}
                                onClick={handleTerminalClockOut}
                                className="py-4 px-4 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <Square className="w-4 h-4 fill-current" />
                                <span>Clock Out — End Shift</span>
                              </button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <button
                                type="button"
                                disabled={isProcessingAction}
                                onClick={() =>
                                  handleTerminalStartBreak("meal_unpaid")
                                }
                                className="py-4 px-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                              >
                                <Coffee className="w-4 h-4" />
                                <span>Start Meal Break (Unpaid)</span>
                              </button>

                              <button
                                type="button"
                                disabled={isProcessingAction}
                                onClick={() =>
                                  handleTerminalStartBreak("rest_paid")
                                }
                                className="py-4 px-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                              >
                                <Coffee className="w-4 h-4" />
                                <span>Start Rest Break (Paid)</span>
                              </button>

                              <button
                                type="button"
                                disabled={isProcessingAction}
                                onClick={handleTerminalClockOut}
                                className="py-4 px-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                              >
                                <Square className="w-4 h-4 fill-current" />
                                <span>Clock Out — End Shift</span>
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: LIVE MANAGER SHIFT BOARD ("WHO IS CLOCKED IN")                 */}
      {/* ===================================================================== */}
      {activeTab === "manager" && (
        <div className="space-y-6">
          {/* 4-Metric Live Telemetry Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">
                Active Staff on Floor
              </div>
              <div className="text-3xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                {shiftMetrics.onFloorCount}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {shiftMetrics.totalActive} total open shifts today
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">
                Currently on Meal / Rest Break
              </div>
              <div className="text-3xl font-bold font-mono tabular-nums text-amber-600 mt-1">
                {shiftMetrics.onBreakCount}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Live break timers active
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">
                Live Accrued Shift Labor Cost
              </div>
              <div className="text-3xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                ${shiftMetrics.liveAccruedLaborCost.toFixed(2)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Includes 1.5x daily overtime calculation
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">
                Break & Overtime Compliance Alerts
              </div>
              <div
                className={`text-3xl font-bold font-mono tabular-nums mt-1 ${
                  shiftMetrics.complianceAlertsCount > 0
                    ? "text-rose-600"
                    : "text-slate-900"
                }`}
              >
                {shiftMetrics.complianceAlertsCount}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Monitors 5h meal break & 8h OT thresholds
              </div>
            </div>
          </div>

          {/* Manager Quick Clock-In & Search Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={managerSearch}
                onChange={(e) => setManagerSearch(e.target.value)}
                placeholder="Filter active shifts by employee name, role, or code..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-indigo-600 focus:outline-hidden"
              />
            </div>

            {!isReadOnly && (
              <form
                onSubmit={handleManagerQuickClockIn}
                className="flex flex-wrap items-center gap-2"
              >
                <span className="text-xs font-semibold text-slate-700 mr-1">
                  Quick Clock-In:
                </span>
                <select
                  value={managerSelectedEmpId}
                  onChange={(e) => setManagerSelectedEmpId(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:border-indigo-600 focus:outline-hidden"
                >
                  <option value="">Select Off-Clock Staff ({offClockEmployees.length})</option>
                  {offClockEmployees.map((emp) => (
                    <option key={emp.id || emp.name} value={emp.id || emp.name}>
                      {emp.name} ({emp.role || "Staff"})
                    </option>
                  ))}
                </select>

                <select
                  value={managerSelectedDept}
                  onChange={(e) => setManagerSelectedDept(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:border-indigo-600 focus:outline-hidden"
                >
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  disabled={!managerSelectedEmpId}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  + Clock In Staff
                </button>
              </form>
            )}
          </div>

          {/* High-Density Active Shift Roster Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                    <th className="py-3 px-4">Employee & Station</th>
                    <th className="py-3 px-4">Clock In</th>
                    <th className="py-3 px-4">Live Status</th>
                    <th className="py-3 px-4 text-right">Breaks (Unpaid / Paid)</th>
                    <th className="py-3 px-4 text-right">Elapsed Time</th>
                    <th className="py-3 px-4 text-right">Accrued Cost</th>
                    <th className="py-3 px-4">Compliance</th>
                    <th className="py-3 px-4 text-right">Manager Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {filteredEnrichedShifts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        <div className="max-w-sm mx-auto space-y-2">
                          <div className="text-sm font-semibold text-slate-800">
                            No Employees Currently Clocked In
                          </div>
                          <p className="text-xs text-slate-500">
                            Staff can check in using their 4-digit PIN on the PIN Pad Terminal tab, or you can use Quick Clock-In above.
                          </p>
                          <button
                            type="button"
                            onClick={() => setActiveTab("terminal")}
                            className="mt-2 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            Open PIN Pad Terminal
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredEnrichedShifts.map((shift) => {
                      const isOnBreak = shift.status === "on_break";
                      return (
                        <tr
                          key={shift.id}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">
                              {shift.employeeName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              <span>{shift.role || "Staff"}</span>
                              <span aria-hidden="true"> · </span>
                              <span>{shift.dept || "Kitchen"}</span>
                              {shift.employeeCode && (
                                <>
                                  <span aria-hidden="true"> · </span>
                                  <span className="font-mono tabular-nums">
                                    {shift.employeeCode}
                                  </span>
                                </>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4 font-mono tabular-nums text-slate-700">
                            {shift.clockInFormatted}
                          </td>

                          <td className="py-3 px-4">
                            {isOnBreak ? (
                              <span className="font-semibold text-amber-700">
                                {shift.currentBreakType === "rest_paid"
                                  ? `Rest Break (${shift.currentBreakMins}m)`
                                  : `Meal Break (${shift.currentBreakMins}m)`}
                              </span>
                            ) : (
                              <span className="font-semibold text-emerald-700">
                                Active on Floor
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                            {shift.totalUnpaidMins}m / {shift.totalPaidBreakMins}m
                          </td>

                          <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                            {formatDurationHMS(shift.elapsedMs)}
                          </td>

                          <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                            ${shift.accruedCost.toFixed(2)}
                          </td>

                          <td className="py-3 px-4">
                            <span
                              className={`font-medium ${
                                shift.complianceStatus === "overtime" ||
                                shift.complianceStatus === "break_overdue"
                                  ? "text-rose-600 font-semibold"
                                  : shift.complianceStatus === "approaching_break"
                                  ? "text-amber-700 font-semibold"
                                  : "text-slate-600"
                              }`}
                            >
                              {shift.complianceLabel}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isOnBreak ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    shift.id && onEndBreak(shift.id)
                                  }
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                                >
                                  End Break
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      shift.id &&
                                      onStartBreak(shift.id, "meal_unpaid")
                                    }
                                    className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-semibold rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                                  >
                                    Meal Break
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      shift.id &&
                                      onStartBreak(shift.id, "rest_paid")
                                    }
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                                  >
                                    Rest Break
                                  </button>
                                </>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  shift.id && onClockOut(shift.id)
                                }
                                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                Clock Out
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: STAFF PIN DIRECTORY & ACCESS CODE MANAGER                      */}
      {/* ===================================================================== */}
      {activeTab === "pins" && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Staff 4-Digit PIN & Employee Code Registry
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Assign or update 4-digit check-in PINs for each employee. Both the 4-digit PIN and Employee Code work on the terminal.
              </p>
            </div>
            {pinSaveStatus && (
              <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                {pinSaveStatus}
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-3 px-4">Employee Name</th>
                  <th className="py-3 px-4">Role & Department</th>
                  <th className="py-3 px-4">Employee Code</th>
                  <th className="py-3 px-4">Active Terminal PIN</th>
                  <th className="py-3 px-4 text-right">Hourly Rate</th>
                  <th className="py-3 px-4 text-right">Manage PIN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {employees.map((emp, idx) => {
                  const effectivePin = getEffectiveEmployeePin(emp, idx);
                  const isEditing = editingPinEmpId === emp.id;

                  return (
                    <tr key={emp.id || idx} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {emp.name}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {emp.role || "Staff"} · {emp.dept || "Kitchen"}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-700">
                        {emp.employeeCode || "—"}
                      </td>
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <input
                            type="text"
                            maxLength={6}
                            value={editingPinValue}
                            onChange={(e) =>
                              setEditingPinValue(
                                e.target.value.replace(/\D/g, "")
                              )
                            }
                            placeholder="4-digit PIN"
                            className="w-28 px-2.5 py-1 border border-indigo-500 rounded font-mono tabular-nums text-xs"
                          />
                        ) : (
                          <span className="font-mono tabular-nums font-bold text-slate-900">
                            {effectivePin}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        ${Number(emp.hourlyRate || 18).toFixed(2)}/hr
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSaveEmployeePin(emp, idx)}
                              className="px-2.5 py-1 bg-indigo-600 text-white text-[11px] font-semibold rounded cursor-pointer"
                            >
                              Save PIN
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPinEmpId(null);
                                setEditingPinValue("");
                              }}
                              className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[11px] font-semibold rounded cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPinEmpId(emp.id || null);
                              setEditingPinValue(effectivePin);
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold rounded cursor-pointer"
                          >
                            Change PIN
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
