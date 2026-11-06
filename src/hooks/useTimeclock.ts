import { useState, useEffect, useMemo, useCallback } from "react";
import { safeSetDoc, safeUpdateDoc, safeDeleteDoc, subscribeWorkspaceCollection } from "../lib/firebase";
import { ActiveShift, Employee, Timecard, ShiftBreakInterval } from "../types";

interface UseTimeclockOptions {
  workspaceOwnerId: string | null;
  employees: Employee[];
  onAddTimecard: (item: Omit<Timecard, "id" | "ownerId" | "createdAt">) => Promise<void>;
  onEditEmployee?: (id: string, edits: Partial<Employee>) => Promise<void>;
}

export function formatTime12Hour(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Generates or retrieves the canonical 4-digit PIN for an employee.
 * If the employee has an explicit `pin`, uses that; otherwise derives a 4-digit code
 * from `employeeCode` digits (e.g., EMP-101 -> 0101) or fallback index.
 */
export function getEffectiveEmployeePin(emp: Employee, index = 0): string {
  if (emp.pin && emp.pin.trim().length > 0) {
    return emp.pin.trim();
  }
  if (emp.employeeCode) {
    const digits = emp.employeeCode.replace(/\D/g, "");
    if (digits.length >= 4) {
      return digits.slice(-4);
    }
    if (digits.length > 0) {
      return digits.padStart(4, "0");
    }
  }
  return String(1001 + index);
}

export function useTimeclock({
  workspaceOwnerId,
  employees,
  onAddTimecard,
  onEditEmployee,
}: UseTimeclockOptions) {
  const [activeShifts, setActiveShifts] = useState<ActiveShift[]>([]);
  const [loadingShifts, setLoadingShifts] = useState<boolean>(true);

  const localStorageKey = useMemo(
    () => (workspaceOwnerId ? `sma_active_shifts_${workspaceOwnerId}` : null),
    [workspaceOwnerId]
  );

  // Sync active_shifts from Firestore with localStorage resilience
  useEffect(() => {
    if (!workspaceOwnerId) {
      setActiveShifts([]);
      setLoadingShifts(false);
      return;
    }

    // Load cached shifts immediately for zero-latency initialization
    if (localStorageKey) {
      try {
        const cached = localStorage.getItem(localStorageKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            setActiveShifts(parsed);
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    const unsubscribe = subscribeWorkspaceCollection<ActiveShift>(
      "active_shifts",
      { ownerId: workspaceOwnerId },
      (items) => {
        const data = [...items];
        data.sort(
          (a, b) =>
            new Date(b.clockInIso || "").getTime() - new Date(a.clockInIso || "").getTime()
        );
        setActiveShifts(data);
        setLoadingShifts(false);

        if (localStorageKey) {
          try {
            localStorage.setItem(localStorageKey, JSON.stringify(data));
          } catch {
            // Ignore storage quota errors
          }
        }
      },
      (err) => {
        console.warn("Active shifts listener fallback to local cache:", err);
        setLoadingShifts(false);
      }
    );

    return () => unsubscribe();
  }, [workspaceOwnerId, localStorageKey]);

  // O(1) Memoized Employee Lookup Map by PIN, Employee Code, or Numeric Suffix
  const employeeLookupMap = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach((emp, idx) => {
      const effectivePin = getEffectiveEmployeePin(emp, idx).toLowerCase();
      if (!map.has(effectivePin)) {
        map.set(effectivePin, emp);
      }
      if (emp.pin) {
        map.set(emp.pin.trim().toLowerCase(), emp);
      }
      if (emp.employeeCode) {
        const rawCode = emp.employeeCode.trim().toLowerCase();
        map.set(rawCode, emp);
        const digitsOnly = rawCode.replace(/\D/g, "");
        if (digitsOnly) {
          if (!map.has(digitsOnly)) {
            map.set(digitsOnly, emp);
          }
          const padded = digitsOnly.padStart(4, "0");
          if (!map.has(padded)) {
            map.set(padded, emp);
          }
        }
      }
    });
    return map;
  }, [employees]);

  const verifyEmployeeByPinOrCode = useCallback(
    (input: string): Employee | null => {
      const cleaned = input.trim().toLowerCase();
      if (!cleaned) return null;
      const direct = employeeLookupMap.get(cleaned);
      if (direct) return direct;

      const digits = cleaned.replace(/\D/g, "");
      if (digits && employeeLookupMap.has(digits)) {
        return employeeLookupMap.get(digits) || null;
      }
      return null;
    },
    [employeeLookupMap]
  );

  // O(1) Active Shift Lookup by Employee ID or Name
  const activeShiftByEmployeeMap = useMemo(() => {
    const map = new Map<string, ActiveShift>();
    activeShifts.forEach((shift) => {
      if (shift.employeeId) {
        map.set(shift.employeeId, shift);
      }
      if (shift.employeeName) {
        map.set(shift.employeeName.toLowerCase().trim(), shift);
      }
    });
    return map;
  }, [activeShifts]);

  const getActiveShiftForEmployee = useCallback(
    (employeeId?: string, employeeName?: string): ActiveShift | undefined => {
      if (employeeId && activeShiftByEmployeeMap.has(employeeId)) {
        return activeShiftByEmployeeMap.get(employeeId);
      }
      if (employeeName) {
        return activeShiftByEmployeeMap.get(employeeName.toLowerCase().trim());
      }
      return undefined;
    },
    [activeShiftByEmployeeMap]
  );

  // Clock In Action
  const clockIn = useCallback(
    async (
      employee: Employee,
      roleOverride?: string,
      deptOverride?: string,
      notes?: string
    ): Promise<ActiveShift> => {
      if (!workspaceOwnerId) {
        throw new Error("Workspace not initialized.");
      }
      const empKey = employee.id || employee.employeeCode || employee.name;
      const existing = getActiveShiftForEmployee(employee.id, employee.name);
      if (existing) {
        throw new Error(`${employee.name} is already clocked in.`);
      }

      const now = new Date();
      const shiftId = `shift_${workspaceOwnerId}_${String(empKey).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
      const newShift: ActiveShift = {
        id: shiftId,
        employeeId: employee.id || empKey,
        employeeName: employee.name,
        employeeCode: employee.employeeCode || "",
        pin: employee.pin || "",
        role: roleOverride || employee.role || "Staff",
        dept: deptOverride || employee.dept || "Kitchen",
        hourlyRate: Number(employee.hourlyRate) || 18.0,
        date: now.toISOString().split("T")[0],
        clockInIso: now.toISOString(),
        clockInFormatted: formatTime12Hour(now),
        status: "clocked_in",
        currentBreakStartIso: null,
        currentBreakType: null,
        accumulatedUnpaidBreakMinutes: 0,
        accumulatedPaidBreakMinutes: 0,
        breakHistory: [],
        notes: notes || "",
        ownerId: workspaceOwnerId,
        createdAt: now.toISOString(),
      };

      // Optimistic local state update
      setActiveShifts((prev) => [
        newShift,
        ...prev.filter((s) => s.id !== shiftId),
      ]);

      await safeSetDoc("active_shifts", shiftId, newShift);
      return newShift;
    },
    [workspaceOwnerId, getActiveShiftForEmployee]
  );

  // Start Meal or Rest Break
  const startBreak = useCallback(
    async (shiftId: string, breakType: "meal_unpaid" | "rest_paid") => {
      const shift = activeShifts.find((s) => s.id === shiftId);
      if (!shift) return;
      if (shift.status === "on_break") return;

      const nowIso = new Date().toISOString();
      const updates: Partial<ActiveShift> = {
        status: "on_break",
        currentBreakStartIso: nowIso,
        currentBreakType: breakType,
      };

      setActiveShifts((prev) =>
        prev.map((s) => (s.id === shiftId ? { ...s, ...updates } : s))
      );

      await safeUpdateDoc("active_shifts", shiftId, updates);
    },
    [activeShifts]
  );

  // End Current Break
  const endBreak = useCallback(
    async (shiftId: string) => {
      const shift = activeShifts.find((s) => s.id === shiftId);
      if (!shift || shift.status !== "on_break" || !shift.currentBreakStartIso) {
        return;
      }

      const now = new Date();
      const breakStart = new Date(shift.currentBreakStartIso);
      const elapsedMinutes = Math.max(
        1,
        Math.round((now.getTime() - breakStart.getTime()) / 60000)
      );

      const breakType = shift.currentBreakType || "meal_unpaid";
      const newInterval: ShiftBreakInterval = {
        id: `brk_${Date.now()}`,
        type: breakType,
        startedAtIso: shift.currentBreakStartIso,
        endedAtIso: now.toISOString(),
        durationMinutes: elapsedMinutes,
      };

      const nextUnpaid =
        breakType === "meal_unpaid"
          ? (shift.accumulatedUnpaidBreakMinutes || 0) + elapsedMinutes
          : shift.accumulatedUnpaidBreakMinutes || 0;
      const nextPaid =
        breakType === "rest_paid"
          ? (shift.accumulatedPaidBreakMinutes || 0) + elapsedMinutes
          : shift.accumulatedPaidBreakMinutes || 0;

      const nextHistory = [...(shift.breakHistory || []), newInterval].slice(-10);

      const updates: Partial<ActiveShift> = {
        status: "clocked_in",
        currentBreakStartIso: null,
        currentBreakType: null,
        accumulatedUnpaidBreakMinutes: nextUnpaid,
        accumulatedPaidBreakMinutes: nextPaid,
        breakHistory: nextHistory,
      };

      setActiveShifts((prev) =>
        prev.map((s) => (s.id === shiftId ? { ...s, ...updates } : s))
      );

      await safeUpdateDoc("active_shifts", shiftId, updates);
    },
    [activeShifts]
  );

  // Clock Out & Atomically Generate Completed Timecard
  const clockOut = useCallback(
    async (
      shiftId: string,
      options?: {
        isAutoClockOut?: boolean;
        customClockOutDate?: Date;
        managerNote?: string;
      }
    ): Promise<Timecard | null> => {
      const shift = activeShifts.find((s) => s.id === shiftId);
      if (!shift) return null;

      const clockOutDate = options?.customClockOutDate || new Date();
      const clockInDate = new Date(shift.clockInIso);

      // If employee was still on break, close the break interval first
      let totalUnpaidBreakMins = shift.accumulatedUnpaidBreakMinutes || 0;
      if (shift.status === "on_break" && shift.currentBreakStartIso) {
        const openBreakMins = Math.max(
          1,
          Math.round(
            (clockOutDate.getTime() -
              new Date(shift.currentBreakStartIso).getTime()) /
              60000
          )
        );
        if ((shift.currentBreakType || "meal_unpaid") === "meal_unpaid") {
          totalUnpaidBreakMins += openBreakMins;
        }
      }

      const rawDiffMs = Math.max(0, clockOutDate.getTime() - clockInDate.getTime());
      const totalHours = Number((rawDiffMs / (1000 * 60 * 60)).toFixed(2));
      const unpaidBreakHours = totalUnpaidBreakMins / 60;
      const paidHours = Number(Math.max(0, totalHours - unpaidBreakHours).toFixed(2));

      const isAuto = Boolean(options?.isAutoClockOut);
      const clockOutHourDecimal =
        clockOutDate.getHours() + clockOutDate.getMinutes() / 60;
      const isOver8PM =
        clockOutHourDecimal > 20.0 ||
        clockOutDate.getDate() !== clockInDate.getDate();

      // Check employee Meal & Break exemption in Staff Registry
      const matchedEmp = employees.find(
        (e) =>
          e.id === shift.employeeId ||
          e.name.toLowerCase().trim() === shift.employeeName.toLowerCase().trim()
      );
      const isMbExempt = Boolean(matchedEmp?.mbExempt);

      const anomalies: string[] = [];
      if (isAuto) {
        anomalies.push("Auto Clock-Out");
      }
      if (totalHours >= 6 && totalUnpaidBreakMins < 25 && !isMbExempt) {
        anomalies.push("6h+ Worked - No Break");
      }
      if (paidHours > 8) {
        anomalies.push("Overtime (>8h)");
      }
      if (isOver8PM) {
        anomalies.push("Shift > 8:00 PM");
      }

      const completedTimecard: Omit<Timecard, "id" | "ownerId" | "createdAt"> = {
        employeeName: shift.employeeName,
        employeeCode: shift.employeeCode || matchedEmp?.employeeCode || "",
        date: shift.date || clockInDate.toISOString().split("T")[0],
        clockIn: shift.clockInFormatted,
        clockOut: isAuto ? "Auto Clock-Out" : formatTime12Hour(clockOutDate),
        totalHours,
        unpaidBreakMinutes: totalUnpaidBreakMins,
        paidHours,
        isAutoClockOut: isAuto,
        isOver8PM,
        anomalies,
        job: shift.role || shift.dept || "Staff",
      };

      // Optimistically remove from active shifts
      setActiveShifts((prev) => prev.filter((s) => s.id !== shiftId));

      // Write completed timecard and delete active shift
      await onAddTimecard(completedTimecard);
      await safeDeleteDoc("active_shifts", shiftId);

      return {
        ...completedTimecard,
        ownerId: workspaceOwnerId || "",
      };
    },
    [activeShifts, employees, onAddTimecard, workspaceOwnerId]
  );

  // Assign or update a 4-digit PIN for an employee
  const assignEmployeePin = useCallback(
    async (employeeId: string, newPin: string) => {
      const cleanPin = newPin.trim();
      if (!employeeId || !cleanPin) return;
      if (onEditEmployee) {
        await onEditEmployee(employeeId, { pin: cleanPin });
      } else {
        await safeUpdateDoc("employees", employeeId, { pin: cleanPin });
      }
    },
    [onEditEmployee]
  );

  return {
    activeShifts,
    loadingShifts,
    verifyEmployeeByPinOrCode,
    getActiveShiftForEmployee,
    clockIn,
    startBreak,
    endBreak,
    clockOut,
    assignEmployeePin,
  };
}
