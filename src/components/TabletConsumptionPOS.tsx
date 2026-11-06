import React, { useState, useMemo, useEffect, useRef } from "react";
import { Ingredient, ConsumptionLog, Vendor, Department, Employee } from "../types";
import { STANDARD_DEPARTMENT_NAMES } from "../constants/departments";
import { 
  X, 
  Search, 
  Check, 
  Calculator, 
  MapPin, 
  SearchX, 
  CheckCircle, 
  Monitor, 
  Grid, 
  ArrowLeft, 
  User, 
  TrendingDown, 
  TrendingUp, 
  Plus, 
  PlusCircle, 
  ChevronDown, 
  Camera, 
  Eye, 
  EyeOff, 
  SlidersHorizontal,
  Lock,
  ShieldCheck,
  UserCheck,
  Delete,
  Users,
  KeyRound,
  Trash2,
  ListPlus,
  ShoppingBag
} from "lucide-react";
import { motion } from "motion/react";
import { safeAddDoc, fetchCloudSqlCollection } from "../lib/firebase";
import { calculatePoundData, convertInputToNativeQty } from "../lib/unitConverter";
import { CameraScanner } from "./CameraScanner";

const UNIT_TO_GRAMS: { [key: string]: number } = {
  g: 1, gram: 1, grams: 1, kg: 1000, kilogram: 1000, kilograms: 1000,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592,
  ml: 1, milliliter: 1, milliliters: 1,
  l: 1000, liter: 1000, liters: 1000
};

const DEFAULT_RESTAURANTS = [
  "UMAI FISH",
  "TWO GEESE BAKERY",
  "TG SANDWICH & DRINKS",
  "TG BREAKFAST",
  "BUON CIBO",
  "SAL ANTHONY'S",
  "CHICKEN N BUNS",
  "NARI EXPRESS",
  "CEBICHELSEA",
  "EAT WELL",
  "MOMO CURRY",
  "SAMMY'S TAQUERIA"
];

const COMMON_SPANISH_DICTIONARY: { [key: string]: string } = {
  // Meats & Poultry
  beef: "Carne de res",
  chicken: "Pollo",
  pork: "Cerdo",
  bacon: "Tocino",
  sausage: "Salchicha",
  ham: "Jamón",
  turkey: "Pavo",
  steak: "Filete",
  ribs: "Costillas",
  meatballs: "Albóndigas",
  "ground beef": "Carne molida",
  lamb: "Cordero",
  duck: "Pato",
  veal: "Ternera",
  chorizo: "Chorizo",
  pepperoni: "Pepperoni",
  salami: "Salami",

  // Seafood
  salmon: "Salmón",
  shrimp: "Camarones",
  tuna: "Atún",
  fish: "Pescado",
  lobster: "Langosta",
  crab: "Cangrejo",
  clams: "Almejas",
  octopus: "Pulpo",
  mussels: "Mejillones",
  cod: "Bacalao",
  squid: "Calamar",
  scallops: "Vieiras",

  // Vegetables
  onion: "Cebolla",
  garlic: "Ajo",
  tomato: "Tomate",
  tomatoes: "Tomates",
  lettuce: "Lechuga",
  potato: "Papa",
  potatoes: "Papas",
  carrots: "Zanahorias",
  carrot: "Zanahoria",
  cucumber: "Pepino",
  spinach: "Espinaca",
  pepper: "Pimiento",
  peppers: "Pimientos",
  cilantro: "Cilantro",
  parsley: "Perejil",
  cabbage: "Repollo",
  mushroom: "Champiñón",
  mushrooms: "Champiñones",
  avocado: "Aguacate",
  avocados: "Aguacates",
  lemon: "Limón",
  lemons: "Limones",
  lime: "Limón verde",
  limes: "Limones verdes",
  ginger: "Jengibre",
  celery: "Apio",
  broccoli: "Brócoli",
  cauliflower: "Coliflor",
  asparagus: "Espárrago",
  zucchini: "Calabacín",
  eggplant: "Berenjena",
  corn: "Maíz",
  peas: "Chícharos / Guisantes",
  beans: "Frijoles",
  green_beans: "Ejotes",
  radish: "Rábano",
  kale: "Col rizada",

  // Fruits
  apple: "Manzana",
  apples: "Manzanas",
  banana: "Plátano",
  bananas: "Plátanos",
  orange: "Naranja",
  oranges: "Naranjas",
  strawberry: "Fresa",
  strawberries: "Fresas",
  blueberry: "Arándano",
  blueberries: "Arándanos",
  grape: "Uva",
  grapes: "Uvas",
  pineapple: "Piña",
  mango: "Mango",
  peach: "Durazno",
  watermelon: "Sandía",

  // Dairy & Eggs
  milk: "Leche",
  cheese: "Queso",
  butter: "Mantequilla",
  cream: "Crema",
  sour_cream: "Crema agria",
  egg: "Huevo",
  eggs: "Huevos",
  yogurt: "Yogur",
  parmesan: "Queso parmesano",
  cheddar: "Queso cheddar",
  mozzarella: "Queso mozzarella",

  // Baking, Dry Goods & Grains
  bread: "Pan",
  bun: "Pan de hamburguesa",
  buns: "Panes",
  tortilla: "Tortilla",
  tortillas: "Tortillas",
  flour: "Harina",
  rice: "Arroz",
  pasta: "Pasta",
  noodles: "Fideos",
  sugar: "Azúcar",
  salt: "Sal",
  yeast: "Levadura",
  baking_powder: "Polvo de hornear",
  oats: "Avena",
  quinoa: "Quinoa",

  // Liquids, Oils & Sauces
  oil: "Aceite",
  olive_oil: "Aceite de oliva",
  sauce: "Salsa",
  soy_sauce: "Salsa de soya",
  vinegar: "Vinagre",
  honey: "Miel",
  mayo: "Mayonesa",
  ketchup: "Ketchup",
  mustard: "Mostaza",
  water: "Agua",
  juice: "Jugo",
  wine: "Vino",
  beer: "Cerveza",
  coffee: "Café",
  tea: "Té",
  syrup: "Jarabe"
};

interface MultiUnitBalance {
  unitLabel: string;
  qtyFormatted: string;
}

function getMultiUnitBreakdown(
  stockQty: number,
  ingredient: Ingredient
): MultiUnitBalance[] {
  if (stockQty === undefined || stockQty === null || isNaN(stockQty)) {
    return [];
  }

  const nativeUnit = (ingredient.unit || "pcs").trim();
  const cleanNative = nativeUnit.toLowerCase();
  
  const results: MultiUnitBalance[] = [];
  const addedUnits = new Set<string>();

  const fmt = (num: number, u: string) => {
    const formatted = Number.isInteger(num) || Math.abs(num - Math.round(num)) < 0.0001
      ? `${Math.round(num)} ${u}`
      : `${num.toFixed(2)} ${u}`;
    return formatted;
  };

  // 1. Primary / Native unit
  results.push({
    unitLabel: nativeUnit,
    qtyFormatted: fmt(stockQty, nativeUnit),
  });
  addedUnits.add(cleanNative);

  const isBoxNative = ["box", "boxes", "case", "cases"].includes(cleanNative);
  const isPcsNative = ["pcs", "piece", "pieces", "ea", "each", "ct", "count"].includes(cleanNative);
  const isPackNative = ["pack", "packs", "bag", "bags", "bottle", "can", "container"].includes(cleanNative);
  const isLbNative = ["lb", "lbs", "pound", "pounds"].includes(cleanNative);

  // 2. Boxes / Cases
  if (!isBoxNative) {
    let boxes: number | null = null;
    const boxName = ingredient.packagingUnit && ["box", "boxes", "case", "cases"].includes(ingredient.packagingUnit.toLowerCase())
      ? ingredient.packagingUnit
      : "box";

    if (ingredient.pcsPerPound && ingredient.pcsPerPound > 0 && (isPcsNative || isPackNative)) {
      boxes = stockQty / ingredient.pcsPerPound;
    } else if (ingredient.weightPerCase && ingredient.weightPerCase > 0) {
      const poundData = calculatePoundData(
        stockQty,
        ingredient.unit,
        ingredient.weightPerCase,
        ingredient.weightPerCaseUnit,
        ingredient.pcsPerPound,
        ingredient.quantity
      );
      if (poundData.lbs > 0) {
        boxes = poundData.lbs / ingredient.weightPerCase;
      }
    } else if (ingredient.conversions && ingredient.conversions.length > 0) {
      const conv = ingredient.conversions.find(c => c.targetUnit && ["box", "boxes", "case", "cases"].includes(c.targetUnit.toLowerCase()));
      if (conv && conv.ratio > 0) {
        boxes = stockQty / conv.ratio;
      }
    }

    if (boxes !== null && !isNaN(boxes) && boxes >= 0 && !addedUnits.has("box") && !addedUnits.has("boxes")) {
      const labelStr = boxes === 1 ? boxName : (boxName.endsWith("s") || boxName.endsWith("x") ? `${boxName}es` : `${boxName}s`);
      results.push({
        unitLabel: "Boxes",
        qtyFormatted: fmt(boxes, labelStr),
      });
      addedUnits.add("box");
      addedUnits.add("boxes");
    }
  }

  // 3. Pieces / Packs
  if (!isPcsNative && !isPackNative) {
    let pcs: number | null = null;
    const pcsName = ingredient.packagingUnit && !["box", "boxes", "case", "cases"].includes(ingredient.packagingUnit.toLowerCase())
      ? ingredient.packagingUnit
      : "pcs";

    if (isBoxNative && ingredient.pcsPerPound && ingredient.pcsPerPound > 0) {
      pcs = stockQty * ingredient.pcsPerPound;
    } else if (ingredient.conversions && ingredient.conversions.length > 0) {
      const conv = ingredient.conversions.find(c => c.targetUnit && ["pcs", "piece", "pieces", "pack", "packs", "ea", "each"].includes(c.targetUnit.toLowerCase()));
      if (conv && conv.ratio > 0) {
        pcs = stockQty * conv.ratio;
      }
    }

    if (pcs !== null && !isNaN(pcs) && pcs >= 0 && !addedUnits.has("pcs") && !addedUnits.has("pieces")) {
      results.push({
        unitLabel: "Pieces/Packs",
        qtyFormatted: fmt(pcs, pcsName),
      });
      addedUnits.add("pcs");
      addedUnits.add("pieces");
    }
  }

  // 4. Weight (Pounds)
  if (!isLbNative && !addedUnits.has("lb") && !addedUnits.has("lbs")) {
    const poundData = calculatePoundData(
      stockQty,
      ingredient.unit,
      ingredient.weightPerCase,
      ingredient.weightPerCaseUnit,
      ingredient.pcsPerPound,
      ingredient.quantity
    );
    if (poundData.hasWeightSpec && poundData.lbs > 0) {
      results.push({
        unitLabel: "Pounds",
        qtyFormatted: `${poundData.lbs.toFixed(2)} lbs`,
      });
      addedUnits.add("lbs");
      addedUnits.add("lb");
    }
  }

  // 5. Additional Custom Conversions
  if (ingredient.conversions && ingredient.conversions.length > 0) {
    ingredient.conversions.forEach(c => {
      if (!c.targetUnit) return;
      const targetClean = c.targetUnit.toLowerCase();
      if (addedUnits.has(targetClean)) return;

      const convertedVal = stockQty / (c.ratio || 1);
      results.push({
        unitLabel: c.targetUnit,
        qtyFormatted: fmt(convertedVal, c.targetUnit),
      });
      addedUnits.add(targetClean);
    });
  }

  return results;
}

export interface ActiveOperator {
  id?: string;
  name: string;
  role?: string;
  dept?: string;
  employeeCode?: string;
  pin: string;
}

export function resolveEmployeePin(emp: Employee, index: number = 0): string {
  if (emp.employeeCode) {
    const digits = emp.employeeCode.replace(/\D/g, "");
    if (digits.length >= 4) {
      return digits.slice(-4);
    } else if (digits.length > 0) {
      return digits.padStart(4, "0");
    }
  }
  return String(1001 + index);
}

interface TabletPinKeypadProps {
  allStaff: Employee[];
  user: any;
  onLogin: (operator: ActiveOperator) => void;
  onClose?: () => void;
  isModal?: boolean;
  logoutNotice?: string | null;
  onClearLogoutNotice?: () => void;
}

function TabletPinKeypad({
  allStaff,
  user,
  onLogin,
  onClose,
  isModal = false,
  logoutNotice,
  onClearLogoutNotice
}: TabletPinKeypadProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [staffSearchQuery, setStaffSearchQuery] = useState("");

  const filteredStaff = useMemo(() => {
    if (!staffSearchQuery.trim()) return allStaff;
    const q = staffSearchQuery.toLowerCase().trim();
    return allStaff.filter((staff, idx) => {
      const staffPin = resolveEmployeePin(staff, idx);
      const name = (staff.name || "").toLowerCase();
      const role = (staff.role || "").toLowerCase();
      const dept = (staff.dept || "").toLowerCase();
      const code = (staff.employeeCode || "").toLowerCase();
      return name.includes(q) || role.includes(q) || dept.includes(q) || code.includes(q) || staffPin.includes(q);
    });
  }, [allStaff, staffSearchQuery]);

  const handleClear = () => {
    setPin("");
    setError(null);
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError(null);
  };

  const validateAndLogin = (enteredPin: string) => {
    const cleanPin = enteredPin.trim();
    if (!cleanPin) return;

    // 1. Try matching with registered staff
    let matchedEmp: Employee | null = null;
    let matchedPin = cleanPin;

    for (let i = 0; i < allStaff.length; i++) {
      const emp = allStaff[i];
      const derivedPin = resolveEmployeePin(emp, i);
      if (derivedPin === cleanPin) {
        matchedEmp = emp;
        matchedPin = derivedPin;
        break;
      }
      if (emp.employeeCode) {
        const codeDigits = emp.employeeCode.replace(/\D/g, "");
        if (codeDigits === cleanPin || codeDigits.padStart(4, "0") === cleanPin || cleanPin.replace(/^0+/, "") === codeDigits) {
          matchedEmp = emp;
          matchedPin = derivedPin;
          break;
        }
        if (emp.employeeCode.toLowerCase().trim() === cleanPin.toLowerCase()) {
          matchedEmp = emp;
          matchedPin = derivedPin;
          break;
        }
      }
    }

    // 2. Master fallback PIN (0000 or 1234)
    if (!matchedEmp && (cleanPin === "0000" || cleanPin === "1234")) {
      const manager = allStaff.find(e => (e.role || "").toLowerCase().includes("manager")) || allStaff[0];
      if (manager) {
        matchedEmp = manager;
        matchedPin = resolveEmployeePin(manager, 0);
      } else {
        onLogin({
          name: user?.displayName || "Restaurant Manager",
          role: "General Manager",
          dept: "Management",
          employeeCode: "MGR-001",
          pin: cleanPin
        });
        return;
      }
    }

    if (matchedEmp) {
      onLogin({
        id: matchedEmp.id,
        name: matchedEmp.name,
        role: matchedEmp.role,
        dept: matchedEmp.dept,
        employeeCode: matchedEmp.employeeCode,
        pin: matchedPin
      });
    } else {
      setError("Invalid 4-digit staff code. Please try again.");
      setPin("");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleKeyPress = (val: string) => {
    if (val === "clear") {
      handleClear();
    } else if (val === "backspace") {
      handleBackspace();
    } else {
      if (pin.length < 4) {
        const next = pin + val;
        setPin(next);
        setError(null);
        if (next.length === 4) {
          setTimeout(() => validateAndLogin(next), 120);
        }
      }
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not intercept if user is typing in the PIN search bar or any other text field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key >= "0" && e.key <= "9") {
        handleKeyPress(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Escape" && onClose) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pin, onClose]);

  const keypadRows = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["clear", "0", "backspace"]
  ];

  const terminalContent = (
    <div className="w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-3xl p-5 sm:p-7 md:p-8 shadow-2xl relative overflow-hidden text-left">
      {/* Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header */}
      <div className="flex items-center justify-between pb-5 border-b border-neutral-800 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white font-mono tracking-tight flex items-center gap-2">
              <span>{isModal ? "Switch Staff Operator" : "Tablet POS Terminal"}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </h2>
            <p className="text-xs text-neutral-400">
              {isModal ? "Authenticate another staff operator" : "Staff Code 4-Digit Login • Audit Tracking"}
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            title="Exit"
          >
            <X className="h-5 w-5" />
            <span className="hidden sm:inline">{isModal ? "Cancel" : "Exit to Inventory"}</span>
          </button>
        )}
      </div>

      {/* Logout Notice Banner */}
      {logoutNotice && (
        <div className="mb-5 p-3.5 sm:p-4 bg-emerald-950/80 border border-emerald-500/70 rounded-2xl flex items-center justify-between text-xs text-emerald-200 shadow-xl gap-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-white text-xs sm:text-sm">{logoutNotice}</p>
              <p className="text-[11px] text-emerald-300 mt-0.5">Operator logged out. Enter 4-digit PIN code to begin next session.</p>
            </div>
          </div>
          {onClearLogoutNotice && (
            <button
              onClick={onClearLogoutNotice}
              className="text-emerald-400 hover:text-white p-1 rounded-lg cursor-pointer shrink-0"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* 2-Column Responsive Grid on Tablet / Desktop */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 items-stretch">
        {/* Left Column: Keypad & Input (7 cols on md) */}
        <div className="md:col-span-7 flex flex-col justify-between space-y-4 sm:space-y-5">
          {/* PIN Indicator Box */}
          <div className="text-center bg-neutral-950/70 border border-neutral-800/80 rounded-2xl p-4 sm:p-5">
            <p className="text-xs text-neutral-400 font-medium mb-3">
              Enter 4-digit staff code to authenticate operator
            </p>

            {/* 4 Digit Boxes */}
            <div className="flex justify-center items-center gap-3 sm:gap-4 mb-2">
              {[0, 1, 2, 3].map((idx) => {
                const isFilled = pin.length > idx;
                const isCurrent = pin.length === idx;
                return (
                  <div
                    key={idx}
                    className={`w-12 h-14 sm:w-14 sm:h-16 rounded-xl flex items-center justify-center font-mono font-bold text-2xl transition-all duration-150 ${
                      isFilled
                        ? "bg-emerald-950/80 border-2 border-emerald-400 text-emerald-300 shadow-lg shadow-emerald-500/20 scale-105"
                        : isCurrent
                          ? "bg-neutral-900 border-2 border-emerald-500/60 ring-2 ring-emerald-500/20 text-neutral-500"
                          : "bg-neutral-900/60 border border-neutral-800 text-neutral-600"
                    }`}
                  >
                    {isFilled ? "●" : isCurrent ? <span className="w-2 h-0.5 bg-emerald-400 animate-pulse"></span> : ""}
                  </div>
                );
              })}
            </div>

            {error ? (
              <p className="text-xs font-bold text-red-400 bg-red-950/70 border border-red-800/80 px-3 py-1.5 rounded-lg mt-3 inline-block">
                {error}
              </p>
            ) : (
              <p className="text-[11px] text-neutral-500 font-mono mt-2">
                {pin.length} / 4 digits entered
              </p>
            )}
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
            {keypadRows.map((row, rowIdx) => (
              <React.Fragment key={rowIdx}>
                {row.map((btn) => {
                  if (btn === "clear") {
                    return (
                      <button
                        key={btn}
                        type="button"
                        onClick={handleClear}
                        className="h-13 sm:h-14 rounded-2xl bg-neutral-800/60 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 border border-neutral-700/60 flex items-center justify-center cursor-pointer select-none"
                      >
                        Clear
                      </button>
                    );
                  }
                  if (btn === "backspace") {
                    return (
                      <button
                        key={btn}
                        type="button"
                        onClick={handleBackspace}
                        className="h-13 sm:h-14 rounded-2xl bg-neutral-800/60 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-all active:scale-95 border border-neutral-700/60 flex items-center justify-center cursor-pointer select-none"
                        title="Backspace"
                      >
                        <Delete className="h-5 w-5" />
                      </button>
                    );
                  }
                  return (
                    <button
                      key={btn}
                      type="button"
                      onClick={() => handleKeyPress(btn)}
                      className="h-13 sm:h-14 rounded-2xl bg-neutral-800 hover:bg-neutral-750 text-white font-mono font-bold text-2xl transition-all active:scale-95 border border-neutral-700 hover:border-emerald-500/50 shadow-sm flex items-center justify-center cursor-pointer select-none active:bg-emerald-600/30"
                    >
                      {btn}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          {/* Manager quick override hint */}
          <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1">
            <span>Manager Override:</span>
            <button
              type="button"
              onClick={() => validateAndLogin("0000")}
              className="font-mono font-bold text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer bg-neutral-800/60 border border-neutral-700 px-2 py-0.5 rounded-lg"
            >
              Use PIN 0000
            </button>
          </div>
        </div>

        {/* Right Column: Quick Staff Select & PIN Finder (5 cols on md) */}
        <div className="md:col-span-5 flex flex-col border-t md:border-t-0 md:border-l border-neutral-800 pt-5 md:pt-0 md:pl-6 lg:pl-8">
          <div className="flex items-center justify-between mb-2.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <KeyRound className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-bold text-neutral-200 uppercase tracking-wider font-mono">
                Staff PIN Finder
              </span>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono font-bold">
              {filteredStaff.length} of {allStaff.length} Staff
            </span>
          </div>

          {/* Search Bar for PIN Code and Name */}
          <div className="relative mb-3 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              value={staffSearchQuery}
              onChange={(e) => setStaffSearchQuery(e.target.value)}
              placeholder="Search your name or code to find PIN..."
              className="w-full pl-9 pr-8 py-2 bg-neutral-950/80 border border-neutral-700/80 hover:border-neutral-600 focus:border-emerald-500 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all font-sans"
            />
            {staffSearchQuery && (
              <button
                type="button"
                onClick={() => setStaffSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-0.5 rounded cursor-pointer"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Search Result Hint Banner if query is active */}
          {staffSearchQuery && (
            <div className="mb-2 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-[11px] text-emerald-300 flex items-center justify-between shrink-0">
              <span className="truncate">Matching for: "{staffSearchQuery}"</span>
              <span className="font-bold font-mono shrink-0 ml-1">{filteredStaff.length} found</span>
            </div>
          )}

          <div className="flex-1 max-h-[250px] sm:max-h-[290px] md:max-h-[330px] overflow-y-auto space-y-2 pr-1">
            {filteredStaff.length > 0 ? (
              filteredStaff.map((staff, idx) => {
                const staffPin = resolveEmployeePin(staff, allStaff.indexOf(staff) >= 0 ? allStaff.indexOf(staff) : idx);
                return (
                  <button
                    key={staff.id || staff.name + idx}
                    type="button"
                    onClick={() => {
                      onLogin({
                        id: staff.id,
                        name: staff.name,
                        role: staff.role,
                        dept: staff.dept,
                        employeeCode: staff.employeeCode,
                        pin: staffPin
                      });
                    }}
                    className="w-full p-2.5 bg-neutral-800/80 hover:bg-emerald-950/70 border border-neutral-700/80 hover:border-emerald-500/60 rounded-xl transition-all flex items-center justify-between cursor-pointer group text-left shadow-sm active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        {(staff.name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 truncate">
                        <div className="text-xs font-bold text-neutral-200 group-hover:text-emerald-300 transition-colors truncate">
                          {staff.name}
                        </div>
                        <div className="text-[10px] text-neutral-400 truncate">
                          {staff.role || "Staff"} {staff.dept ? `• ${staff.dept}` : ""}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="text-xs font-mono font-bold bg-neutral-950 border border-neutral-700 group-hover:border-emerald-400/80 px-2.5 py-1 rounded-lg text-emerald-400 shadow-xs">
                        PIN: {staffPin}
                      </span>
                    </div>
                  </button>
                );
              })
            ) : allStaff.length > 0 ? (
              <div className="p-4 bg-neutral-950/60 border border-neutral-800 rounded-xl text-center">
                <p className="text-xs text-neutral-400 font-medium">
                  No staff member found matching "{staffSearchQuery}"
                </p>
                <button
                  type="button"
                  onClick={() => setStaffSearchQuery("")}
                  className="mt-2 text-xs font-bold text-emerald-400 hover:underline cursor-pointer"
                >
                  Clear search filter
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onLogin({
                    name: user?.displayName || "Restaurant Manager",
                    role: "General Manager",
                    dept: "Management",
                    employeeCode: "MGR-001",
                    pin: "0000"
                  });
                }}
                className="w-full p-3 bg-neutral-800 hover:bg-emerald-950/70 border border-neutral-700 rounded-xl transition-all flex items-center justify-between cursor-pointer text-left"
              >
                <div>
                  <div className="text-xs font-bold text-neutral-200">
                    {user?.displayName || "Workspace Owner"}
                  </div>
                  <div className="text-[10px] text-neutral-400">Manager Default Login</div>
                </div>
                <span className="text-[11px] font-mono font-bold bg-neutral-900 px-2 py-0.5 rounded-lg text-emerald-400 border border-neutral-700">
                  PIN: 0000
                </span>
              </button>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-800 text-[10px] text-neutral-400 flex items-center gap-1.5 shrink-0">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span>Digital operator signature attached to each ledger record.</span>
          </div>
        </div>
      </div>

      {!isModal && onClose && (
        <div className="mt-6 pt-4 border-t border-neutral-800/80 flex items-center justify-between">
          <span className="text-[11px] text-neutral-500 font-mono">
            Restaurant POS Client • v2.4
          </span>
          <button
            onClick={onClose}
            className="text-xs font-bold text-neutral-400 hover:text-white transition-colors cursor-pointer py-1 px-3 rounded-lg hover:bg-neutral-800"
          >
            ← Exit Tablet POS to Inventory
          </button>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return terminalContent;
  }

  return (
    <div className="w-full min-h-[100dvh] bg-neutral-950 flex flex-col justify-start md:justify-center items-center p-3 sm:p-6 md:p-8 font-sans overflow-y-auto">
      {terminalContent}
    </div>
  );
}

export interface BatchItem {
  ingredient: Ingredient;
  quantity: number;
  unit: string;
}

interface TabletConsumptionPOSProps {
  ingredients: Ingredient[];
  vendors?: Vendor[];
  departments?: Department[];
  employees?: Employee[];
  workspaceOwnerId: string | null;
  user: any;
  onClose: () => void;
  onEditIngredient: (id: string, edits: Partial<Ingredient>) => Promise<void>;
  onAddIngredient: (ing: Partial<Ingredient>) => Promise<void>;
  isReadOnly?: boolean;
}

export default function TabletConsumptionPOS({ 
  ingredients, 
  vendors = [],
  departments = [],
  employees = [],
  workspaceOwnerId, 
  user, 
  onClose, 
  onEditIngredient,
  onAddIngredient,
  isReadOnly = false
}: TabletConsumptionPOSProps) {
  // Mode selection: "deduct" (Consumption) | "receive" (Increase) | "add-item" (Quick Catalog Creation)
  const [posMode, setPosMode] = useState<"deduct" | "receive" | "add-item">("deduct");

  const [department, setDepartment] = useState("");
  const [showDeptModal, setShowDeptModal] = useState(false);

  // List of registered departments for selection (strictly limited to registered departments if available)
  const deptOptions = useMemo(() => {
    const list = new Set<string>();
    if (departments && Array.isArray(departments) && departments.length > 0) {
      departments.forEach(d => {
        if (d.name && d.name.trim()) list.add(d.name.trim());
      });
    }
    const registered = Array.from(list);
    if (registered.length > 0) {
      return registered;
    }
    // Fallback defaults only if no departments have been registered yet
    return STANDARD_DEPARTMENT_NAMES;
  }, [departments]);

  const [date, setDate] = useState(() => {
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().split("T")[0];
    return localISOTime;
  });
  
  const [selectedLocation, setSelectedLocation] = useState<string>("All Locations");
  const [selectedCategory, setSelectedCategory] = useState<string>("All Categories");
  const [searchQuery, setSearchQuery] = useState("");

  // Spanish translation and language controls
  const [language, setLanguage] = useState<"en" | "es">("en");
  const [spanishTranslations, setSpanishTranslations] = useState<{[id: string]: string}>({});
  const [isTranslating, setIsTranslating] = useState(false);

  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [isProcessingCamera, setIsProcessingCamera] = useState(false);

  // Trigger translation when Spanish mode is activated
  useEffect(() => {
    if (language !== "es") return;

    const untranslated = ingredients.filter(
      ing => ing.id && !spanishTranslations[ing.id]
    );

    if (untranslated.length === 0) return;

    const fetchTranslations = async () => {
      setIsTranslating(true);
      try {
        const res = await fetch("/api/translate-ingredients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: untranslated.map(i => ({ id: i.id, name: i.name }))
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.translations && Array.isArray(data.translations)) {
            setSpanishTranslations(prev => {
              const updated = { ...prev };
              data.translations.forEach((item: any) => {
                if (item.id && item.translation) {
                  updated[item.id] = item.translation;
                }
              });
              return updated;
            });
          }
        }
      } catch (err) {
        console.error("Error fetching ingredient translations:", err);
      } finally {
        setIsTranslating(false);
      }
    };

    fetchTranslations();
  }, [language, ingredients]);

  const getIngredientDisplayName = (ing: Ingredient) => {
    if (language === "en") return ing.name;

    // 1. Check AI translation cache first
    if (ing.id && spanishTranslations[ing.id]) {
      return spanishTranslations[ing.id];
    }

    // 2. Local dictionary fallback
    const lowerName = ing.name.toLowerCase().trim();
    if (COMMON_SPANISH_DICTIONARY[lowerName]) {
      return COMMON_SPANISH_DICTIONARY[lowerName];
    }

    // Attempt word substitution for composite terms
    let substituted = ing.name;
    for (const [enKey, esVal] of Object.entries(COMMON_SPANISH_DICTIONARY)) {
      const regex = new RegExp(`\\b${enKey}\\b`, "gi");
      if (regex.test(substituted)) {
        substituted = substituted.replace(regex, esVal);
      }
    }

    return substituted;
  };
  
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [inputQty, setInputQty] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("pound");
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [logoutNotice, setLogoutNotice] = useState<string | null>(null);
  const [showHideUnitSelector, setShowHideUnitSelector] = useState(false);
  const [hiddenUnits, setHiddenUnits] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("culinary_pos_hidden_units");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [autoUpdateStock, setAutoUpdateStock] = useState(true);
  
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{type: "success" | "error", text: string} | null>(null);

  // Active logged-in operator state via 4-digit staff code
  const [activeOperator, setActiveOperator] = useState<ActiveOperator | null>(null);
  const [showSwitchOperatorModal, setShowSwitchOperatorModal] = useState(false);
  const [showSignaturePage, setShowSignaturePage] = useState(false);
  const [fetchedEmployees, setFetchedEmployees] = useState<Employee[]>([]);

  // Fetch staff from Cloud SQL if not provided in props
  useEffect(() => {
    if (!workspaceOwnerId) return;
    if (employees && employees.length > 0) return;

    fetchCloudSqlCollection("employees", { ownerId: workspaceOwnerId }).then((list) => {
      if (Array.isArray(list)) {
        const sorted = [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setFetchedEmployees(sorted);
      }
    }).catch((err) => {
      console.warn("Could not load employees from Cloud SQL:", err);
    });
  }, [workspaceOwnerId, employees]);

  // Combined staff array from props or direct firestore listener
  const allStaff = useMemo(() => {
    if (employees && employees.length > 0) return employees;
    return fetchedEmployees;
  }, [employees, fetchedEmployees]);

  // Add New Item form states
  const [newItemName, setNewItemName] = useState("");
  const [newItemVendor, setNewItemVendor] = useState("unassigned");
  const [newItemLocation, setNewItemLocation] = useState("Walk-In Cooler");
  const [newItemPrice, setNewItemPrice] = useState("0");
  const [newItemUnit, setNewItemUnit] = useState("lb");
  const [newItemPackQty, setNewItemPackQty] = useState("1");
  const [newInitialStock, setNewInitialStock] = useState("");
  const [newMinStock, setNewMinStock] = useState("0");
  const [newItemCategory, setNewItemCategory] = useState("Meat");

  // Auto-set default unit based on selected category when adding a new item
  useEffect(() => {
    const cat = newItemCategory.toLowerCase();
    if (["meat", "vegetables", "seafood"].includes(cat)) {
      setNewItemUnit("lb");
    } else if (["beverages", "dairy", "other"].includes(cat) || cat.includes("milk") || cat.includes("beverage") || cat.includes("dairy")) {
      setNewItemUnit("pcs");
    }
  }, [newItemCategory]);

  // Pre-populate unique vendors from registered vendors
  const vendorsList = useMemo(() => {
    const list = new Set<string>();
    if (vendors && Array.isArray(vendors)) {
      vendors.forEach(v => {
        if (v.name && v.name.trim()) {
          list.add(v.name.trim());
        }
      });
    }
    return Array.from(list).sort((a, b) => a.localeCompare(b));
  }, [vendors]);

  // Group locations
  const locations = useMemo(() => {
    const locs = new Set<string>();
    ingredients.forEach(i => {
      if (i.location) locs.add(i.location.trim());
    });
    return ["All Locations", ...Array.from(locs).sort()];
  }, [ingredients]);

  // Group categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    ingredients.forEach(i => {
      if (i.category) cats.add(i.category.trim());
    });
    const defaults = ["Meat", "Vegetables", "Fruit", "Bread", "Seafood", "Dairy", "Dry Goods", "Beverages", "Other"];
    defaults.forEach(c => cats.add(c));
    return ["All Categories", ...Array.from(cats).sort()];
  }, [ingredients]);

  // Adaptive unit options based on selected ingredient - always includes pound (lb) and piece (pc)
  const allAvailableUnits = useMemo(() => {
    if (!selectedIngredient) return ["lb", "pc"];
    const nativeUnit = selectedIngredient.unit || "lb";

    const unitsSet = new Set<string>();
    unitsSet.add(nativeUnit); // Always include native unit first

    // Always ensure pound and pc options are available for fast selection
    const cleanNative = nativeUnit.toLowerCase().trim();
    const isWeightNative = ["lb", "lbs", "pound", "pounds", "kg", "g", "oz"].includes(cleanNative);
    const isCountNative = ["pc", "pcs", "piece", "pieces", "ea", "each", "count", "ct"].includes(cleanNative);

    if (!isWeightNative) {
      unitsSet.add("lb");
    }
    if (!isCountNative) {
      unitsSet.add("pc");
    }

    if (selectedIngredient.packagingUnit && selectedIngredient.pcsPerPound && selectedIngredient.pcsPerPound > 0) {
      unitsSet.add(selectedIngredient.packagingUnit);
    }

    if (selectedIngredient.conversions && selectedIngredient.conversions.length > 0) {
      selectedIngredient.conversions.forEach(c => {
        if (c.targetUnit) unitsSet.add(c.targetUnit);
      });
    }

    return Array.from(unitsSet);
  }, [selectedIngredient, posMode]);

  // Filter out units that the user marked as hidden
  const visibleUnits = useMemo(() => {
    return allAvailableUnits.filter(u => !hiddenUnits.some(hu => hu.toLowerCase() === u.toLowerCase()));
  }, [allAvailableUnits, hiddenUnits]);

  // Toggle hiding a specific unit
  const toggleHideUnit = (unitName: string) => {
    const isHidden = hiddenUnits.some(hu => hu.toLowerCase() === unitName.toLowerCase());
    let next: string[];
    if (isHidden) {
      next = hiddenUnits.filter(hu => hu.toLowerCase() !== unitName.toLowerCase());
    } else {
      next = [...hiddenUnits, unitName];
    }
    setHiddenUnits(next);
    try {
      localStorage.setItem("culinary_pos_hidden_units", JSON.stringify(next));
    } catch {}
  };

  const unhideAllUnits = () => {
    setHiddenUnits([]);
    try {
      localStorage.removeItem("culinary_pos_hidden_units");
    } catch {}
  };

  // Reset unit when ingredient changes (unless already in batch with a chosen unit)
  useEffect(() => {
    if (selectedIngredient) {
      const inBatch = batchItems.find(b => b.ingredient.id === selectedIngredient.id);
      if (inBatch) {
        setSelectedUnit(inBatch.unit);
        return;
      }
      const nativeUnit = selectedIngredient.unit || "lb";
      if (!hiddenUnits.some(hu => hu.toLowerCase() === nativeUnit.toLowerCase())) {
        setSelectedUnit(nativeUnit);
      } else if (visibleUnits.length > 0) {
        setSelectedUnit(visibleUnits[0]);
      } else {
        setSelectedUnit(nativeUnit);
      }
    }
  }, [selectedIngredient?.id]);

  // Adjust unit if posMode changes or if the currently selected unit was hidden
  useEffect(() => {
    if (selectedIngredient && selectedUnit) {
      if (visibleUnits.length > 0 && !visibleUnits.some(u => u.toLowerCase() === selectedUnit.toLowerCase())) {
        setSelectedUnit(visibleUnits[0]);
      } else if (visibleUnits.length === 0 && allAvailableUnits.length > 0 && !allAvailableUnits.some(u => u.toLowerCase() === selectedUnit.toLowerCase())) {
        setSelectedUnit(allAvailableUnits[0]);
      }
    }
  }, [visibleUnits, allAvailableUnits, selectedIngredient, selectedUnit, posMode]);

  
  const filteredIngredients = useMemo(() => {
    // Exclude hidden catalog items
    let filtered = ingredients.filter(i => !i.isHiddenFromInventory);
    
    // Deduct mode: only show items currently in stock to avoid clutter
    // Receive mode: show everything so they can receive out-of-stock items!
    if (posMode === "deduct") {
      filtered = filtered.filter(i => i.inStock !== undefined && i.inStock > 0);
    }
    
    if (selectedLocation !== "All Locations") {
      filtered = filtered.filter(i => i.location === selectedLocation);
    }
    if (selectedCategory !== "All Categories") {
      filtered = filtered.filter(i => i.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(i => {
        const engName = i.name.toLowerCase();
        const espName = getIngredientDisplayName(i).toLowerCase();
        return engName.includes(q) || espName.includes(q);
      });
    }
    // Sort by display name (which could be Spanish or English depending on active mode)
    return [...filtered].sort((a, b) => {
      const nameA = getIngredientDisplayName(a);
      const nameB = getIngredientDisplayName(b);
      return nameA.localeCompare(nameB);
    });
  }, [ingredients, selectedLocation, selectedCategory, searchQuery, posMode, language, spanishTranslations]);

  const getStockDisplay = (ing: Ingredient) => {
    const stock = ing.inStock !== undefined ? ing.inStock : 0;
    const baseDisplay = `${stock} ${ing.unit || 'packs'}`;
    
    // Attempt to calculate lb equivalent if it exists and is valid
    const poundInfo = calculatePoundData(
      stock,
      ing.unit,
      ing.weightPerCase,
      ing.weightPerCaseUnit,
      ing.pcsPerPound,
      ing.quantity
    );
    
    // Only append if there is actual weight specification and native unit is not lbs already
    const cleanUnit = (ing.unit || "lbs").toLowerCase().trim();
    if (poundInfo.hasWeightSpec && !["lb", "lbs", "pound", "pounds"].includes(cleanUnit)) {
      return `${baseDisplay} (${poundInfo.lbs.toFixed(2)} lbs)`;
    }
    
    return baseDisplay;
  };

  // Helper to sync quantity updates with batch items
  const updateQtyValue = (nextQty: string, customUnit?: string) => {
    if (!selectedIngredient) return;
    setInputQty(nextQty);
    const unitToUse = customUnit || selectedUnit;
    const num = parseFloat(nextQty);
    if (!isNaN(num) && num > 0) {
      // Chosen when the user types its pound or pc / quantity
      setBatchItems(prev => {
        const idx = prev.findIndex(b => b.ingredient.id === selectedIngredient.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = {
            ingredient: selectedIngredient,
            quantity: num,
            unit: unitToUse
          };
          return next;
        } else {
          return [...prev, {
            ingredient: selectedIngredient,
            quantity: num,
            unit: unitToUse
          }];
        }
      });
    } else {
      // If quantity is cleared or zero, remove from batchItems
      setBatchItems(prev => prev.filter(b => b.ingredient.id !== selectedIngredient.id));
    }
  };

  const handleNumClick = (val: string) => {
    if (!selectedIngredient) return;
    let nextQty = inputQty;
    if (val === "C") {
      nextQty = "";
    } else if (val === ".") {
      if (!inputQty.includes(".")) {
        nextQty = inputQty === "" ? "0." : inputQty + ".";
      }
    } else if (val === "DEL") {
      nextQty = inputQty.slice(0, -1);
    } else {
      if (inputQty === "0") nextQty = val;
      else nextQty = inputQty + val;
    }
    updateQtyValue(nextQty);
  };

  // Keyboard support: when an ingredient is selected, user can type quantity directly on keyboard
  useEffect(() => {
    if (!activeOperator || showSignaturePage || posMode === "add-item") return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // If user is typing in a search bar, modal input, or other text fields, don't intercept
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
        return;
      }

      if (!selectedIngredient) return;

      if ((e.key >= "0" && e.key <= "9") || e.key === ".") {
        e.preventDefault();
        handleNumClick(e.key);
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        handleNumClick("DEL");
      } else if (e.key.toLowerCase() === "c" || e.key === "Escape") {
        e.preventDefault();
        handleNumClick("C");
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [activeOperator, showSignaturePage, posMode, selectedIngredient, inputQty, selectedUnit]);

  // Add Brand-New Item catalog submit
  const handleAddNewItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemPrice.trim()) {
      setMessage({ type: "error", text: "Please enter an item name and price." });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const priceVal = parseFloat(newItemPrice) || 0;
      const packQtyVal = parseFloat(newItemPackQty) || 1;
      const initialStockVal = parseFloat(newInitialStock) || 0;
      const minStockVal = parseFloat(newMinStock) || 0;

      await onAddIngredient({
        name: newItemName.trim(),
        price: priceVal,
        unit: newItemUnit.trim() || "lb",
        vendor: newItemVendor.trim() || "unassigned",
        location: newItemLocation,
        inStock: initialStockVal,
        minStock: minStockVal,
        quantity: packQtyVal,
        pricePerGram: priceVal / packQtyVal,
        source: "Tablet POS Catalog",
        category: newItemCategory
      });

      setMessage({ type: "success", text: `Successfully created and added ${newItemName} to catalog!` });
      
      // Clear fields
      setNewItemName("");
      setNewItemVendor("unassigned");
      setNewItemPrice("0");
      setNewItemUnit("lb");
      setNewItemPackQty("1");
      setNewInitialStock("");
      setNewMinStock("0");
      setNewItemCategory("Meat");
      
      // Auto-switch back to Receive Stock mode to see the newly created catalog item
      setPosMode("receive");
      
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      console.error("Error creating item from tablet:", err);
      setMessage({ 
        type: "error", 
        text: err.message === "DUPLICATE_ENTRY" 
          ? "Item with this name and vendor already exists." 
          : (err.message || "Failed to create item.") 
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to calculate stock impact and cost for a batch item
  const calculateItemMetrics = (item: BatchItem, isDeductMode: boolean) => {
    const ing = item.ingredient;
    const qty = item.quantity;
    const unit = item.unit;

    const equivalentQty = convertInputToNativeQty(qty, unit, ing);
    const cleanNative = (ing.unit || "lbs").toLowerCase().trim();
    const isLb = ["lb", "lbs", "pound", "pounds"].includes(cleanNative);

    let displayCost = 0;
    if (ing.pricePerGram) {
      const gramsAmt = isLb ? equivalentQty * 453.59237 : equivalentQty;
      displayCost = gramsAmt * ing.pricePerGram;
    } else if (isLb && ing.quantity) {
      displayCost = (equivalentQty / ing.quantity) * ing.price;
    } else {
      displayCost = (equivalentQty / (ing.quantity || 1)) * ing.price;
    }

    const currentStock = ing.inStock !== undefined ? ing.inStock : 0;
    const stockAfter = isDeductMode
      ? Math.max(0, parseFloat((currentStock - equivalentQty).toFixed(4)))
      : parseFloat((currentStock + equivalentQty).toFixed(4));

    const remainingUnitsBreakdown = getMultiUnitBreakdown(stockAfter, ing);
    const currentUnitsBreakdown = getMultiUnitBreakdown(currentStock, ing);

    return {
      equivalentQty,
      displayCost,
      currentStock,
      stockAfter,
      remainingUnitsBreakdown,
      currentUnitsBreakdown
    };
  };

  // Add / Update item in batch
  const handleAddOrUpdateBatch = () => {
    if (!selectedIngredient) return;
    const qtyNum = parseFloat(inputQty);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setMessage({ type: "error", text: "Please enter a valid quantity greater than 0." });
      return;
    }
    if (!department && posMode === "deduct") {
      setMessage({ type: "error", text: "Please select a department first." });
      setShowDeptModal(true);
      return;
    }

    setBatchItems(prev => {
      const idx = prev.findIndex(b => b.ingredient.id === selectedIngredient.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ingredient: selectedIngredient,
          quantity: qtyNum,
          unit: selectedUnit
        };
        return next;
      } else {
        return [...prev, {
          ingredient: selectedIngredient,
          quantity: qtyNum,
          unit: selectedUnit
        }];
      }
    });

    setMessage({
      type: "success",
      text: `✓ Added ${qtyNum} ${selectedUnit} of ${selectedIngredient.name} to batch.`
    });
    setTimeout(() => setMessage(null), 2500);
  };

  // Remove single item from batch
  const handleRemoveBatchItem = (ingId: string) => {
    setBatchItems(prev => prev.filter(b => b.ingredient.id !== ingId));
    if (selectedIngredient?.id === ingId) {
      setSelectedIngredient(null);
      setInputQty("");
    }
  };

  // Clear entire batch
  const handleClearBatch = () => {
    setBatchItems([]);
    setSelectedIngredient(null);
    setInputQty("");
  };

  // Change unit and sync with batch if currently chosen
  const handleSelectUnit = (unit: string) => {
    setSelectedUnit(unit);
    if (selectedIngredient) {
      const num = parseFloat(inputQty);
      if (!isNaN(num) && num > 0) {
        setBatchItems(prev => {
          const idx = prev.findIndex(b => b.ingredient.id === selectedIngredient.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = {
              ...next[idx],
              unit: unit
            };
            return next;
          }
          return prev;
        });
      }
    }
  };

  // Select card from catalog grid:
  // - Clicking an ingredient that is ALREADY IN THE BATCH or CURRENTLY SELECTED cancels it!
  // - Fresh ingredient starts with empty quantity so it is only chosen when user types pound or pc
  const handleSelectCard = (ing: Ingredient) => {
    const isCurrentlySelected = selectedIngredient?.id === ing.id;
    const itemInBatch = batchItems.find(b => b.ingredient.id === ing.id);

    // If clicking an ingredient that is ALREADY IN THE BATCH or CURRENTLY SELECTED -> CANCEL IT!
    if (isCurrentlySelected || itemInBatch) {
      setBatchItems(prev => prev.filter(b => b.ingredient.id !== ing.id));
      if (isCurrentlySelected) {
        setSelectedIngredient(null);
        setInputQty("");
      }
      setMessage({
        type: "success",
        text: `✓ Cancelled ${getIngredientDisplayName(ing)}.`
      });
      setTimeout(() => setMessage(null), 1800);
      return;
    }

    // Fresh selection: not in batch and not selected
    setSelectedIngredient(ing);
    setInputQty(""); // Start EMPTY so it is ONLY chosen when the user types pound or pc!
    const nativeUnit = ing.unit || "lb";
    if (!hiddenUnits.some(hu => hu.toLowerCase() === nativeUnit.toLowerCase())) {
      setSelectedUnit(nativeUnit);
    } else if (visibleUnits.length > 0) {
      setSelectedUnit(visibleUnits[0]);
    } else {
      setSelectedUnit(nativeUnit);
    }

    if (!department && posMode === "deduct") {
      setShowDeptModal(true);
    }
  };

  // Remove single item from batch while in Review screen (infallible id or index matching)
  const handleRemoveReviewItem = (ingId?: string, itemIndex?: number) => {
    if (ingId && selectedIngredient?.id === ingId) {
      setSelectedIngredient(null);
      setInputQty("");
    }
    setBatchItems(prev => {
      const next = prev.filter((b, i) => {
        if (itemIndex !== undefined && i === itemIndex) return false;
        if (ingId && b.ingredient.id === ingId) return false;
        return true;
      });
      if (next.length === 0) {
        setShowSignaturePage(false);
      }
      return next;
    });
  };

  // Proceed to review
  const handleProceedToReview = () => {
    let finalBatch = [...batchItems];
    if (selectedIngredient) {
      const q = parseFloat(inputQty);
      if (!isNaN(q) && q > 0) {
        const idx = finalBatch.findIndex(b => b.ingredient.id === selectedIngredient.id);
        if (idx >= 0) {
          finalBatch[idx] = {
            ingredient: selectedIngredient,
            quantity: q,
            unit: selectedUnit
          };
        } else {
          finalBatch.push({
            ingredient: selectedIngredient,
            quantity: q,
            unit: selectedUnit
          });
        }
        setBatchItems(finalBatch);
      }
      // Reset active selection so batchItems is the single source of truth in review
      setSelectedIngredient(null);
      setInputQty("");
    }

    if (finalBatch.length === 0) {
      setMessage({ type: "error", text: "Please select an ingredient and enter its quantity to record." });
      return;
    }

    if (!department && posMode === "deduct") {
      setMessage({ type: "error", text: "Please select a department first." });
      setShowDeptModal(true);
      return;
    }

    setShowSignaturePage(true);
  };

  // Handle inventory change submission (with signature audit log and automatic operator logout)
  const handleConfirmBatchSignOff = async (itemsToSave: BatchItem[]) => {
    if (!workspaceOwnerId) return;
    if (itemsToSave.length === 0) return;

    const isDeduct = posMode === "deduct";
    const finalDepartment = department;

    if (!finalDepartment && isDeduct) {
      setMessage({ type: "error", text: "Please select a department." });
      setShowDeptModal(true);
      return;
    }

    setSubmitting(true);
    setMessage(null);

    const opName = activeOperator?.name || "Staff Operator";
    const digitalAuth = "PIN_VERIFIED:" + (activeOperator?.employeeCode || activeOperator?.pin || "POS");

    try {
      const now = new Date();
      const createdAtIso = now.toISOString();
      const dateIso = createdAtIso.slice(0, 10);

      for (const item of itemsToSave) {
        const ing = item.ingredient;
        const qtyNum = item.quantity;
        const unit = item.unit;

        const metrics = calculateItemMetrics(item, isDeduct);
        const consumptionRecord: Omit<ConsumptionLog, "id"> = {
          date: dateIso,
          vendorName: isDeduct 
            ? finalDepartment 
            : `INBOUND RECEIVING (${ing.vendor || "Direct"})`,
          ingredientId: ing.id!,
          ingredientName: ing.name,
          quantity: isDeduct ? qtyNum : -qtyNum,
          unit: unit,
          pricePerPack: ing.price,
          totalCost: isDeduct ? metrics.displayCost : -metrics.displayCost,
          recordedBy: opName,
          operatorName: opName,
          signatureBase64: digitalAuth,
          ownerId: workspaceOwnerId,
          createdAt: createdAtIso
        };

        await safeAddDoc("inventory_consumptions", consumptionRecord);

        if (autoUpdateStock) {
          await onEditIngredient(ing.id!, {
            inStock: metrics.stockAfter
          });
        }
      }

      const count = itemsToSave.length;
      // Reset state
      setBatchItems([]);
      setSelectedIngredient(null);
      setInputQty("");
      setDepartment("");
      setShowSignaturePage(false);

      // Auto-logout: Return to 4-digit PIN login terminal
      setActiveOperator(null);
      setLogoutNotice(
        isDeduct
          ? `✓ Successfully recorded consumption for ${count} ${count === 1 ? 'ingredient' : 'ingredients'} by ${opName}. Operator session closed.`
          : `✓ Successfully recorded stock receipt for ${count} ${count === 1 ? 'ingredient' : 'ingredients'} by ${opName}. Operator session closed.`
      );

      setTimeout(() => {
        setLogoutNotice(null);
      }, 9000);
    } catch (err: any) {
      console.error("Error committing batch to ledger:", err);
      setMessage({ type: "error", text: err.message || "Failed to commit batch to ledger." });
    } finally {
      setSubmitting(false);
    }
  };

  if (showSignaturePage) {
    // Current review items
    const reviewItems = batchItems;

    const isDeduct = posMode === "deduct";
    const totalBatchCost = reviewItems.reduce((acc, item) => {
      const m = calculateItemMetrics(item, isDeduct);
      return acc + m.displayCost;
    }, 0);

    return (
      <div className="fixed inset-0 z-50 bg-[#F4F4F5] flex flex-col font-sans overflow-hidden" id="pos-sign-off-page">
        {/* Sign-off Header */}
        <div className="bg-neutral-900 text-white flex items-center justify-between px-4 sm:px-6 py-4 shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSignaturePage(false)}
              className="p-1 hover:bg-neutral-800 rounded transition-colors text-neutral-400 hover:text-white cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-bold font-mono text-emerald-400 flex items-center gap-2">
                <span>
                  {isDeduct 
                    ? `Review Consumption Batch (${reviewItems.length} ${reviewItems.length === 1 ? 'item' : 'items'})` 
                    : `Review Stock Receipt Batch (${reviewItems.length} ${reviewItems.length === 1 ? 'item' : 'items'})`}
                </span>
              </h1>
              <p className="text-[10px] text-neutral-400 uppercase tracking-wider">
                Auditor Ledger Signature Step • Review all items before committing
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSignaturePage(false)}
            className="text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-white px-3 sm:px-4 py-2 rounded-xl transition-colors cursor-pointer"
          >
            ← Cancel & Go Back
          </button>
        </div>

        {/* Layout split */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto lg:overflow-hidden">
          {/* Left Column: Transaction details summary & items list */}
          <div className="flex-1 bg-neutral-900 text-white p-4 sm:p-6 flex flex-col justify-between border-r border-neutral-800 overflow-y-auto min-h-0">
            <div className="space-y-4">
              {/* Batch Summary Stats Bar */}
              <div className="bg-neutral-800/90 border border-neutral-700/60 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase block">Total Items</label>
                  <span className="text-base sm:text-lg font-black font-mono text-white">
                    {reviewItems.length} {reviewItems.length === 1 ? "Ingredient" : "Ingredients"}
                  </span>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase block">Total Value</label>
                  <span className="text-base sm:text-lg font-black font-mono text-emerald-400">
                    ${totalBatchCost.toFixed(2)}
                  </span>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase block">
                    {isDeduct ? "Operating Department" : "Receipt Source"}
                  </label>
                  <span className="text-xs sm:text-sm font-bold text-neutral-200 truncate block">
                    {isDeduct ? (department || "⚠️ Missing") : "Inbound Store"}
                  </span>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase block">Ledger Mode</label>
                  <span className={`text-xs font-mono font-bold uppercase inline-block px-2 py-0.5 rounded-full ${
                    isDeduct ? "bg-red-500/20 text-red-300 border border-red-500/30" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  }`}>
                    {isDeduct ? "Consumption Deduction" : "Inbound Stock Receipt"}
                  </span>
                </div>
              </div>

              {/* Items Table / Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    Selected Ingredients Breakdown ({reviewItems.length})
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    Scroll to review all items
                  </span>
                </div>

                {reviewItems.length === 0 ? (
                  <div className="p-8 text-center text-neutral-400 bg-neutral-800/40 rounded-2xl border border-neutral-700/50">
                    <p className="text-sm font-bold">No ingredients in this batch.</p>
                    <button
                      onClick={() => setShowSignaturePage(false)}
                      className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
                    >
                      ← Back to POS to select ingredients
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[50vh] lg:max-h-[54vh] overflow-y-auto pr-1">
                    {reviewItems.map((item, idx) => {
                      const metrics = calculateItemMetrics(item, isDeduct);
                      const ing = item.ingredient;

                      return (
                        <div
                          key={ing.id || idx}
                          className="bg-neutral-800/80 border border-neutral-700/60 rounded-xl p-3.5 sm:p-4 hover:border-neutral-600 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3 mb-2.5">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm sm:text-base text-white">
                                  {getIngredientDisplayName(ing)}
                                </span>
                                {ing.category && (
                                  <span className="text-[9px] font-bold text-amber-300 bg-amber-950/60 border border-amber-800 px-1.5 py-0.2 rounded uppercase">
                                    {ing.category}
                                  </span>
                                )}
                                <span className="text-[10px] text-neutral-400 font-mono">
                                  📍 {ing.location || "Unassigned"}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono font-bold text-emerald-400">
                                ${metrics.displayCost.toFixed(2)}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveReviewItem(ing.id, idx);
                                }}
                                className="text-neutral-400 hover:text-red-400 p-2 rounded-lg hover:bg-neutral-700/80 transition-colors cursor-pointer"
                                title="Remove item from batch"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-neutral-700/60">
                            <div>
                              <label className="text-[9px] font-semibold text-neutral-400 uppercase block">
                                Current Stock
                              </label>
                              <span className="font-mono font-bold text-neutral-300 text-xs">
                                {metrics.currentStock} {ing.unit || "pcs"}
                              </span>
                            </div>

                            <div>
                              <label className="text-[9px] font-semibold text-neutral-400 uppercase block">
                                {isDeduct ? "Deducting" : "Receiving"}
                              </label>
                              <span className={`font-mono font-bold text-xs ${
                                isDeduct ? "text-red-400" : "text-emerald-400"
                              }`}>
                                {isDeduct ? "-" : "+"}{item.quantity} {item.unit}
                              </span>
                              {item.unit.toLowerCase().trim() !== (ing.unit || "lbs").toLowerCase().trim() && (
                                <span className="text-[9px] text-neutral-400 block font-mono">
                                  (~{metrics.equivalentQty.toFixed(2)} {ing.unit || "lbs"})
                                </span>
                              )}
                            </div>

                            <div>
                              <label className="text-[9px] font-bold text-emerald-400 uppercase block">
                                Stock After
                              </label>
                              <span className="font-mono font-black text-emerald-300 text-xs sm:text-sm">
                                {metrics.stockAfter} {ing.unit || "pcs"}
                              </span>
                            </div>
                          </div>

                          {/* Multi-unit remaining breakdown if applicable */}
                          {metrics.remainingUnitsBreakdown.length > 1 && (
                            <div className="mt-2 pt-1.5 border-t border-neutral-750 flex flex-wrap gap-2 text-[10px] text-neutral-400 font-mono">
                              <span className="text-neutral-500">Breakdown:</span>
                              {metrics.remainingUnitsBreakdown.map((b, bi) => (
                                <span key={bi} className="bg-neutral-900 px-1.5 py-0.5 rounded text-neutral-300">
                                  {b.qtyFormatted}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-emerald-950/60 border border-emerald-800/80 p-3.5 rounded-xl text-[11px] text-emerald-200 leading-relaxed mt-4 shrink-0">
              <span className="font-bold flex items-center gap-1.5 text-emerald-400 mb-0.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400" /> Digital PIN Operator Audit & Auto-Logout
              </span>
              This batch adjustment is authenticated under operator <strong className="text-white">{activeOperator?.name}</strong> (Staff PIN #{activeOperator?.pin}). Once confirmed, it commits all {reviewItems.length} records to the consumption ledger and automatically logs out to enter a new PIN.
            </div>
          </div>

          {/* Right Column: Verified Operator Sign-Off & Confirm */}
          <div className="w-full lg:w-[420px] xl:w-[450px] p-5 sm:p-6 bg-white overflow-y-auto min-h-0 flex flex-col justify-between shrink-0 border-t lg:border-t-0 lg:border-l border-neutral-200">
            <div className="space-y-5">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold font-mono">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                  Operator Authenticated
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight font-sans">
                  {isDeduct ? "Confirm Consumption Batch" : "Confirm Stock Receipt"}
                </h2>
                <p className="text-xs text-neutral-500">
                  Verify the operating staff signature before committing {reviewItems.length} items to the inventory ledger.
                </p>
              </div>

              {/* Verified Operator Card */}
              <div className="bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-850 text-white rounded-2xl p-5 border border-neutral-700 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-black text-xl flex items-center justify-center shadow-lg border border-emerald-400/40">
                      {(activeOperator?.name || "O").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-white font-sans">{activeOperator?.name || "Staff Operator"}</span>
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                          PIN #{activeOperator?.pin}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-300 mt-0.5 flex items-center gap-2">
                        <span>{activeOperator?.role || "Staff"}</span>
                        {activeOperator?.dept && <span className="text-neutral-500">• {activeOperator.dept}</span>}
                        {activeOperator?.employeeCode && (
                          <span className="text-neutral-400 font-mono text-[11px]">(ID: {activeOperator.employeeCode})</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowSwitchOperatorModal(true)}
                    className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-lg text-xs font-bold border border-neutral-600 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Switch</span>
                  </button>
                </div>

                <div className="mt-4 pt-4 border-t border-neutral-800 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase text-neutral-400 font-bold block">Authorization</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1 mt-0.5 text-xs">
                      <ShieldCheck className="h-3.5 w-3.5" /> PIN Verified
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-neutral-400 font-bold block">Sign-Off Time</span>
                    <span className="text-neutral-300 font-mono text-[11px] mt-0.5 block">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action summary badge */}
              <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-2">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                  Batch Ledger Summary
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-neutral-500">Operation:</span>
                    <span className={`font-bold block ${isDeduct ? "text-red-600" : "text-emerald-600"}`}>
                      {isDeduct ? "Consumption Deduction" : "Inbound Receipt"}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Allocation Target:</span>
                    <span className="font-bold text-neutral-800 block truncate">
                      {isDeduct ? department : "Inbound Receiving"}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Total Entries:</span>
                    <span className="font-mono font-bold text-neutral-900 block">
                      {reviewItems.length} records
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Total Cost:</span>
                    <span className="font-mono font-bold text-emerald-700 block">
                      ${totalBatchCost.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
                <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  After confirming, you will be <strong>automatically logged out</strong> to protect the terminal for the next operator PIN.
                </span>
              </div>
            </div>

            {/* Submit Controls */}
            <div className="pt-4 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => handleConfirmBatchSignOff(reviewItems)}
                disabled={submitting || reviewItems.length === 0}
                className={`w-full py-4 text-white font-bold text-sm sm:text-base rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] ${
                  submitting || reviewItems.length === 0
                    ? "bg-neutral-300 text-neutral-500 cursor-not-allowed shadow-none"
                    : isDeduct 
                      ? "bg-red-600 hover:bg-red-700 border border-red-700 shadow-red-900/20" 
                      : "bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 shadow-emerald-900/20"
                }`}
              >
                <Check className="h-5 w-5" />
                {submitting 
                  ? "Recording Ledger & Logging Out..." 
                  : isDeduct 
                    ? `Confirm & Record Consumption (${reviewItems.length})` 
                    : `Confirm & Record Receipt (${reviewItems.length})`}
              </button>

              <button
                type="button"
                onClick={() => setShowSignaturePage(false)}
                className="w-full py-2.5 text-neutral-600 hover:text-neutral-900 text-xs font-bold transition-colors cursor-pointer hover:bg-neutral-100 rounded-xl"
              >
                ← Back to POS / Add More Items
              </button>
            </div>
          </div>
        </div>

        {showSwitchOperatorModal && (
          <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <TabletPinKeypad
              allStaff={allStaff}
              user={user}
              onLogin={(op) => {
                setActiveOperator(op);
                setShowSwitchOperatorModal(false);
              }}
              onClose={() => setShowSwitchOperatorModal(false)}
              isModal={true}
            />
          </div>
        )}
      </div>
    );
  }

  const handleCameraCapture = async (base64Image: string) => {
    setIsProcessingCamera(true);
    try {
      const itemNames = ingredients.map(ing => ing.name);
      const res = await fetch("/api/ai/recognize-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64Image, itemNames })
      });

      if (!res.ok) {
        throw new Error("Failed to recognize item");
      }

      const data = await res.json();
      if (data.recognizedName) {
        setSearchQuery(data.recognizedName);
        setShowCameraScanner(false);
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Camera recognition failed. Please try again." });
    } finally {
      setIsProcessingCamera(false);
    }
  };

  // If no operator is logged in, show the 4-digit staff code login terminal
  if (!activeOperator) {
    return (
      <div className="fixed inset-0 z-50 bg-neutral-950 flex flex-col font-sans overflow-y-auto min-h-[100dvh] w-full">
        <TabletPinKeypad
          allStaff={allStaff}
          user={user}
          onLogin={(op) => {
            setActiveOperator(op);
          }}
          onClose={onClose}
          isModal={false}
          logoutNotice={logoutNotice}
          onClearLogoutNotice={() => setLogoutNotice(null)}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#F8F9FA] flex flex-col font-sans overflow-hidden h-[100dvh] w-full">
      {/* Top Navigation */}
      <div className="bg-emerald-600 text-white flex flex-wrap md:flex-nowrap items-center justify-between px-4 sm:px-6 py-3 sm:py-3.5 shadow-xl shrink-0 gap-3">
        <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-300" />
            <h1 className="text-base sm:text-xl font-bold font-mono">
              {posMode === "deduct" && (language === "es" ? "Deducir Stock (POS)" : "POS Deduct Stock")}
              {posMode === "receive" && (language === "es" ? "Recibir Stock (POS)" : "POS Receive Stock")}
              {posMode === "add-item" && (language === "es" ? "Adición Catálogo (POS)" : "POS Catalog Addition")}
            </h1>
          </div>
          
          {posMode === "deduct" && (
            <div className="flex gap-2 sm:gap-3 items-center sm:pl-4 sm:border-l sm:border-emerald-500">
              <button
                type="button"
                onClick={() => setShowDeptModal(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  !department
                    ? "bg-amber-400 text-amber-950 border-amber-300 animate-pulse font-extrabold shadow-sm"
                    : "bg-emerald-800 hover:bg-emerald-700 border-emerald-500 text-white shadow-xs"
                }`}
              >
                <MapPin className="h-4 w-4 text-emerald-300" />
                <span className="truncate max-w-[140px] sm:max-w-none">
                  {department || (language === "es" ? "⚠️ Elegir Departamento" : "⚠️ Select Department")}
                </span>
                <ChevronDown className="h-3.5 w-3.5 opacity-70 ml-1" />
              </button>
            </div>
          )}

          {posMode === "receive" && (
            <div className="flex items-center sm:pl-4 sm:border-l sm:border-emerald-500">
              <span className="text-xs bg-emerald-800 px-3 py-1.5 font-mono font-bold text-emerald-100 uppercase tracking-wide rounded-md">
                {language === "es" ? "Modo reabastecimiento" : "Stock replenishment mode"}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
          {/* Active Operator Badge & Switcher */}
          {activeOperator && (
            <div className="flex items-center gap-2 bg-emerald-900 border border-emerald-500/60 rounded-xl px-2.5 sm:px-3 py-1.5 shadow-sm">
              <div className="relative">
                <div className="w-7 h-7 rounded-full bg-white text-emerald-900 font-black text-xs flex items-center justify-center shadow-xs">
                  {activeOperator.name.charAt(0).toUpperCase()}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-emerald-900 animate-pulse"></span>
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-xs font-bold text-white flex items-center gap-1.5 leading-tight">
                  <span className="truncate max-w-[110px]">{activeOperator.name}</span>
                  <span className="text-[10px] font-mono text-emerald-300 font-normal">#{activeOperator.pin}</span>
                </div>
                <div className="text-[10px] text-emerald-200 leading-tight truncate max-w-[140px]">
                  {activeOperator.role || "Operator"} {activeOperator.dept ? `• ${activeOperator.dept}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSwitchOperatorModal(true)}
                className="ml-1 px-2 py-1 bg-emerald-700/80 hover:bg-emerald-600 text-emerald-100 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1"
                title="Switch Staff Operator"
              >
                <Lock className="h-3 w-3" />
                <span>Switch</span>
              </button>
            </div>
          )}

          {/* Language Selection Toggle */}
          <div className="flex bg-emerald-800 rounded-lg p-0.5 border border-emerald-700 shadow-inner shrink-0">
            <button
              onClick={() => setLanguage("en")}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                language === "en"
                  ? "bg-white text-emerald-900 shadow-sm font-black"
                  : "text-emerald-200 hover:text-white"
              }`}
            >
              🇺🇸 EN
            </button>
            <button
              onClick={() => setLanguage("es")}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                language === "es"
                  ? "bg-white text-emerald-900 shadow-sm font-black"
                  : "text-emerald-200 hover:text-white"
              }`}
            >
              🇪🇸 ES
            </button>
          </div>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-colors font-bold text-xs sm:text-sm cursor-pointer shadow-sm"
          >
            <X className="h-4 w-4" /> <span className="hidden sm:inline">{language === "es" ? "Salir de POS" : "Exit POS"}</span>
          </button>
        </div>
      </div>

      {/* Mode Segmented Controls Bar */}
      <div className="bg-neutral-900 text-white flex flex-wrap sm:flex-nowrap items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3 border-b border-neutral-800 shadow-md shrink-0 gap-2">
        <div className="flex gap-2">
          <button
            onClick={() => {
              setPosMode("deduct");
              setSelectedIngredient(null);
              setInputQty("");
              setBatchItems([]);
            }}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              posMode === "deduct"
                ? "bg-red-600 text-white shadow-md shadow-red-900/30"
                : "bg-neutral-800 text-neutral-400 hover:bg-neutral-750 hover:text-white"
            }`}
          >
            <TrendingDown className="h-4 w-4" />
            {language === "es" ? "Deducir Stock (Consumo)" : "Deduct Stock (Consumption)"}
          </button>
          
          {!isReadOnly && (
            <>
              <button
                onClick={() => {
                  setPosMode("receive");
                  setSelectedIngredient(null);
                  setInputQty("");
                  setBatchItems([]);
                }}
                className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  posMode === "receive"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/30"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-750 hover:text-white"
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                {language === "es" ? "Recibir Stock (Aumento)" : "Receive Stock (Increase)"}
              </button>

              <button
                onClick={() => {
                  setPosMode("add-item");
                  setSelectedIngredient(null);
                  setInputQty("");
                  setBatchItems([]);
                }}
                className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  posMode === "add-item"
                    ? "bg-amber-600 text-white shadow-md shadow-amber-900/30"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-750 hover:text-white"
                }`}
              >
                <Plus className="h-4 w-4" />
                {language === "es" ? "Nuevo Artículo" : "Add New Item"}
              </button>
            </>
          )}
        </div>
        
        <div className="text-[10px] font-mono text-neutral-400 font-bold uppercase tracking-wider hidden sm:block">
          {language === "es" ? "Cliente de Tablet de Costos" : "Culinary Cost Tablet Client"}
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
        {/* Render standard layout for Deduct and Receive modes */}
        {posMode !== "add-item" && (
          <>
            {/* Left column: Categories & Items */}
            <div className="flex-1 flex flex-col border-r border-neutral-300 bg-white min-w-0 overflow-hidden">
              <div className="p-3 sm:p-4 border-b border-neutral-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-neutral-50 shadow-sm z-10 shrink-0">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
                  <input 
                    type="text" 
                    placeholder={language === "es" ? "Buscar ingredientes... (bilingüe)" : "Search ingredients..."}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-12 py-2.5 sm:py-3 bg-white border border-neutral-300 rounded-xl text-sm sm:text-base focus:ring-2 focus:ring-[#141414] focus:outline-none shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCameraScanner(true)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-emerald-600 transition-colors bg-white rounded-lg"
                    title={language === "es" ? "Escanear con cámara" : "Scan with camera"}
                  >
                    <Camera className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Category Filter */}
                  <div className="relative">
                    <Grid className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600 pointer-events-none" />
                    <select
                      value={selectedCategory}
                      onChange={e => setSelectedCategory(e.target.value)}
                      className="pl-9 pr-9 py-2.5 sm:py-3 bg-white border border-neutral-300 text-neutral-800 font-bold rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none cursor-pointer appearance-none shadow-sm min-w-[130px]"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>
                          {cat === "All Categories" 
                            ? (language === "es" ? "📁 Todas las categorías" : "📁 All Categories") 
                            : `📁 ${cat}`}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-neutral-500">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>

                  {/* Location Filter */}
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600 pointer-events-none" />
                    <select
                      value={selectedLocation}
                      onChange={e => setSelectedLocation(e.target.value)}
                      className="pl-9 pr-9 py-2.5 sm:py-3 bg-white border border-neutral-300 text-neutral-800 font-bold rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none cursor-pointer appearance-none shadow-sm"
                    >
                      {locations.map(loc => (
                        <option key={loc} value={loc}>
                          {loc === "All Locations" 
                            ? (language === "es" ? "📍 Todas las ubicaciones" : "📍 All Locations") 
                            : `📍 ${loc}`}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-neutral-500">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>

                  {isTranslating && (
                    <div className="text-[10px] font-bold text-neutral-500 animate-pulse font-mono shrink-0 bg-neutral-100 px-2 py-1 rounded">
                      Translating...
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-neutral-100">
                {filteredIngredients.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-neutral-400 p-6">
                    <SearchX className="h-12 w-12 mb-4" />
                    <p className="text-base sm:text-lg font-bold text-center">
                      {language === "es" ? "No se encontraron artículos" : "No items found"}
                    </p>
                    <p className="text-xs text-neutral-500 max-w-xs text-center mt-1">
                      {posMode === "deduct" 
                        ? (language === "es" 
                            ? "Solo los artículos con stock se muestran en el modo Deducir. Cambie a Recibir para agregar stock." 
                            : "Only items currently in-stock are shown in Deduct mode. Switch to Receive mode to manage catalog items with zero stock.") 
                        : (language === "es"
                            ? "Intente ajustar sus filtros de búsqueda o agregue un nuevo artículo."
                            : "Try adjusting your search filters or add a new item to catalog.")}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
                    {filteredIngredients.map(ing => {
                      const itemInBatch = batchItems.find(b => b.ingredient.id === ing.id);
                      const isSelected = selectedIngredient?.id === ing.id;

                      return (
                        <button
                          key={ing.id}
                          onClick={() => handleSelectCard(ing)}
                          title={
                            itemInBatch || isSelected
                              ? "Click card again to cancel & remove"
                              : "Click to select item and type quantity"
                          }
                          className={`text-left p-3.5 sm:p-4 rounded-xl border-2 transition-all shadow-sm flex flex-col justify-between min-h-[118px] cursor-pointer relative group ${
                            isSelected
                              ? posMode === "deduct"
                                ? "border-red-500 bg-red-50/90 shadow-md ring-2 ring-red-400/40"
                                : "border-emerald-500 bg-emerald-50/90 shadow-md ring-2 ring-emerald-400/40"
                              : itemInBatch
                                ? posMode === "deduct"
                                ? "border-red-300 bg-red-50/40 shadow-xs hover:border-red-400"
                                : "border-emerald-300 bg-emerald-50/40 shadow-xs hover:border-emerald-400"
                                : "border-transparent bg-white hover:border-neutral-300 hover:shadow"
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-1.5 mb-1">
                              <div className="font-bold text-neutral-900 leading-snug line-clamp-2 text-sm sm:text-base">
                                {getIngredientDisplayName(ing)}
                              </div>
                              {itemInBatch && (
                                <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 shadow-xs transition-colors ${
                                  posMode === "deduct"
                                    ? "bg-red-600 group-hover:bg-red-700 text-white"
                                    : "bg-emerald-600 group-hover:bg-emerald-700 text-white"
                                }`}
                                title="Chosen in batch. Click card again to cancel."
                                >
                                  <Check className="h-3 w-3 stroke-[3]" />
                                  <span>{itemInBatch.quantity} {itemInBatch.unit}</span>
                                  <span className="text-[9px] opacity-80 ml-0.5">✕</span>
                                </span>
                              )}
                              {!itemInBatch && isSelected && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white shrink-0 shadow-xs animate-pulse">
                                  {language === "es" ? "Escriba..." : "Type Qty..."}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-neutral-500 font-mono mt-1.5 flex flex-wrap gap-1.5 items-center">
                              <span className="flex items-center gap-0.5">
                                <MapPin className="h-3 w-3 text-neutral-400" /> {ing.location || "Unassigned"}
                              </span>
                              {ing.category && (
                                <span className="text-[9px] text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                  {ing.category}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 pt-2 border-t border-neutral-100 flex items-center justify-between">
                            <div className="text-xs font-bold text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded">
                              {ing.quantity} {ing.unit}
                            </div>
                            <div className={`text-xs font-mono font-bold ${ing.inStock === 0 || ing.inStock === undefined ? 'text-red-700' : 'text-neutral-600'}`}>
                              {getStockDisplay(ing)}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right column: Current Ticket / Numpad */}
            <div className="w-full md:w-[320px] lg:w-[360px] xl:w-[380px] flex flex-col bg-white shadow-xl z-20 overflow-hidden shrink-0">
              <div className="p-3 sm:p-4 bg-neutral-50 border-b border-neutral-200 flex-1 flex flex-col justify-between overflow-y-auto min-h-0 space-y-3">
                
                {/* Batch Selection Status Header (shown when ingredients have been chosen) */}
                {batchItems.length > 0 && (
                  <div className="flex items-center justify-between px-3.5 py-2.5 bg-neutral-100 border border-neutral-200 rounded-xl text-xs shadow-2xs">
                    <span className="font-bold text-neutral-800 font-mono flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${posMode === "deduct" ? "bg-red-500 animate-pulse" : "bg-emerald-500 animate-pulse"}`} />
                      {batchItems.length} {batchItems.length === 1 ? (language === "es" ? "artículo en lote" : "item chosen") : (language === "es" ? "artículos en lote" : "items chosen")}
                    </span>
                    <button
                      type="button"
                      onClick={handleClearBatch}
                      className="text-[11px] font-bold text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                    >
                      {language === "es" ? "Deseleccionar todos" : "Clear all"}
                    </button>
                  </div>
                )}

                {/* Active Item Editor Box */}
                {!selectedIngredient ? (
                  <div className="py-12 px-4 flex flex-col items-center justify-center text-neutral-400 border-2 border-dashed border-neutral-200 rounded-2xl text-center">
                    <Grid className="h-8 w-8 mb-2 text-neutral-300" />
                    <p className="text-sm font-bold text-neutral-700">
                      {language === "es" ? "Seleccione un artículo de la izquierda" : "Select an item from left"}
                    </p>
                    <p className="text-xs text-neutral-400 mt-1 max-w-xs">
                      {language === "es"
                        ? "Toque cualquier tarjeta de inventario para ingresar su cantidad en libras o piezas."
                        : "Tap any ingredient card on the left to enter its pound or pc."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className={`p-3 rounded-xl shadow-xs transition-all ${
                      posMode === "deduct" ? "bg-red-700 text-white" : "bg-emerald-600 text-white"
                    }`}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-bold text-xs sm:text-sm leading-tight truncate">
                          {getIngredientDisplayName(selectedIngredient)}
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/20 text-white shrink-0 font-bold">
                          {selectedIngredient.unit || "unit"}
                        </span>
                      </div>
                      <p className="font-mono text-white/80 text-[11px] mb-1.5">
                        {language === "es" ? "Stock Actual" : "Current Stock"}: {getStockDisplay(selectedIngredient)}
                      </p>
                      
                      {/* Interactive Quantity Field */}
                      <div className="bg-black/30 border border-white/20 rounded-xl p-1.5 flex items-center justify-center min-h-[46px] relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={inputQty}
                          placeholder="0"
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9.]/g, '');
                            const parts = val.split('.');
                            const cleanVal = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : val;
                            updateQtyValue(cleanVal);
                          }}
                          className="w-full text-center bg-transparent text-2xl sm:text-3xl font-mono font-black tracking-wider text-white focus:outline-none placeholder-white/30"
                          title="Type quantity in pounds or pieces"
                        />
                        <span className="absolute right-3 text-xs sm:text-sm text-white/80 font-normal pointer-events-none uppercase font-mono">
                          {selectedUnit}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <label className="block text-[9px] font-bold text-neutral-500 uppercase tracking-wider font-mono">
                            {language === "es" ? "Unidad de Medida" : "Unit of Measure"}
                          </label>
                          {hiddenUnits.length > 0 && (
                            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.1 rounded">
                              {allAvailableUnits.filter(u => hiddenUnits.some(hu => hu.toLowerCase() === u.toLowerCase())).length} {language === "es" ? "ocultas" : "hidden"}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowHideUnitSelector(true)}
                          className="text-[9px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer border text-neutral-700 bg-white hover:bg-neutral-100 border-neutral-300"
                          title="Units"
                        >
                          <Eye className="h-2.5 w-2.5" />
                          <span>{language === "es" ? "Elegir / Ocultar" : "Units"}</span>
                        </button>
                      </div>

                      {/* Visible Units Button Grid */}
                      {visibleUnits.length > 0 && (
                        <div className={`grid gap-1 mb-2 ${visibleUnits.length > 2 ? "grid-cols-3" : "grid-cols-2"}`}>
                          {visibleUnits.map(u => (
                            <button
                              key={u}
                              onClick={() => handleSelectUnit(u)}
                              className={`py-1.5 px-1 rounded-lg font-bold text-[11px] transition-all capitalize text-center truncate cursor-pointer ${
                                selectedUnit.toLowerCase() === u.toLowerCase()
                                  ? "bg-neutral-900 text-white shadow-xs"
                                  : "bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100"
                              }`}
                              title={u}
                            >
                              {u === "lb" ? "lb (pound)" : u === "pc" ? "pc (piece)" : u}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Add to Batch / Update Button */}
                      <button
                        type="button"
                        onClick={handleAddOrUpdateBatch}
                        className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                          batchItems.some(b => b.ingredient.id === selectedIngredient.id)
                            ? "bg-neutral-800 hover:bg-neutral-900 text-white"
                            : posMode === "deduct"
                              ? "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
                              : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>
                          {batchItems.some(b => b.ingredient.id === selectedIngredient.id)
                            ? (language === "es" ? "✓ Elegido en Lote" : "✓ Chosen in Batch")
                            : (language === "es" ? "+ Elegir artículo" : "+ Choose Ingredient")}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Numpad & Submit Action */}
              <div className="p-3 sm:p-4 bg-white space-y-2 shrink-0 border-t border-neutral-200">
                {/* Numpad */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-1">
                  {["7", "8", "9", "4", "5", "6", "1", "2", "3", "C", "0", "."].map(btn => (
                    <button
                      key={btn}
                      disabled={!selectedIngredient}
                      onClick={() => handleNumClick(btn)}
                      className={`h-10 sm:h-11 text-lg font-bold font-mono rounded-xl transition-all active:scale-95 cursor-pointer shadow-2xs ${
                        !selectedIngredient 
                          ? "bg-neutral-100 text-neutral-300 cursor-not-allowed border border-neutral-200"
                          : btn === "C"
                            ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                            : "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 active:bg-neutral-300 border border-neutral-200"
                      }`}
                    >
                      {btn}
                    </button>
                  ))}
                  <div className="col-span-3 grid grid-cols-2 gap-2 mt-0.5">
                    <button
                      disabled={!selectedIngredient}
                      onClick={() => handleNumClick("DEL")}
                      className="h-9 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Delete className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </button>
                    <div className="flex items-center gap-1.5 justify-center bg-neutral-50 border border-neutral-200 rounded-xl px-2">
                      <input
                        type="checkbox"
                        id="autoUpdateTablet"
                        checked={autoUpdateStock}
                        onChange={e => setAutoUpdateStock(e.target.checked)}
                        className="w-3.5 h-3.5 text-emerald-600 focus:ring-emerald-500 rounded border-neutral-300 cursor-pointer"
                      />
                      <label htmlFor="autoUpdateTablet" className="text-[10px] font-bold text-neutral-600 cursor-pointer select-none">
                        {posMode === "deduct" ? "Auto-Deduct" : "Auto-Update"}
                      </label>
                    </div>
                  </div>
                </div>

                {/* Bottom Action: Review & Record Consumption / Inbound */}
                {(() => {
                  const activeInputQtyNum = parseFloat(inputQty);
                  const hasActiveValidInput = Boolean(selectedIngredient && !isNaN(activeInputQtyNum) && activeInputQtyNum > 0);
                  const isCurrentSelectedInBatch = Boolean(selectedIngredient && batchItems.some(b => b.ingredient.id === selectedIngredient.id));
                  let effectiveCount = batchItems.length;
                  if (hasActiveValidInput && !isCurrentSelectedInBatch) {
                    effectiveCount += 1;
                  }

                  const isDisabled = effectiveCount === 0 || submitting;

                  return (
                    <button
                      disabled={isDisabled}
                      onClick={handleProceedToReview}
                      className={`w-full h-12 rounded-xl flex flex-col items-center justify-center font-bold transition-all cursor-pointer shadow-md active:scale-[0.98] ${
                        isDisabled
                          ? "bg-neutral-200 text-neutral-400 cursor-not-allowed shadow-none"
                          : posMode === "deduct"
                            ? "bg-red-600 hover:bg-red-700 text-white shadow-red-900/30"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/30"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        <CheckCircle className="h-4 w-4" />
                        <span>
                          {posMode === "deduct" 
                            ? (language === "es" 
                                ? `Revisar y Deducir (${effectiveCount})` 
                                : `Record Consumption (${effectiveCount} ${effectiveCount === 1 ? 'item' : 'items'})`)
                            : (language === "es" 
                                ? `Revisar y Recibir (${effectiveCount})` 
                                : `Record Receipt / Inbound (${effectiveCount} ${effectiveCount === 1 ? 'item' : 'items'})`)}
                        </span>
                      </div>
                      <span className="text-[10px] opacity-80 font-normal">
                        Proceed to Review & Sign-Off →
                      </span>
                    </button>
                  );
                })()}
              </div>
            </div>
          </>
        )}

        {/* Render New Catalog Item quick form */}
        {posMode === "add-item" && (
          <div className="flex-1 flex items-center justify-center bg-neutral-100 p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-neutral-200 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden"
            >
              <div className="bg-amber-600 text-white px-6 py-4 flex items-center gap-3">
                <PlusCircle className="h-6 w-6 text-amber-200" />
                <div>
                  <h2 className="text-base font-bold font-mono text-white">Create Brand-New Inventory Item</h2>
                  <p className="text-[10px] text-amber-100 uppercase tracking-wider font-semibold">Tablet Catalog Quick Add</p>
                </div>
              </div>
              
              <form onSubmit={handleAddNewItemSubmit} className="p-6 space-y-5 text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Item Name */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                      Item Name / Description <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newItemName}
                      onChange={e => setNewItemName(e.target.value)}
                      placeholder="e.g. skinless pork belly, sliced prime flank steak"
                      className="w-full text-sm border border-neutral-300 rounded-xl px-4 py-3 bg-[#fafaf9] focus:bg-white focus:border-amber-500 focus:outline-none transition-all font-semibold text-neutral-800"
                    />
                  </div>

                  {/* Supplier / Vendor */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                      Supplier / Vendor
                    </label>
                    <select
                      value={newItemVendor}
                      onChange={e => setNewItemVendor(e.target.value)}
                      className="w-full text-sm border border-neutral-300 rounded-xl px-4 py-3 bg-[#fafaf9] focus:bg-white focus:border-amber-500 focus:outline-none transition-all font-semibold text-neutral-800 cursor-pointer"
                    >
                      <option value="unassigned">-- Unassigned / No Supplier --</option>
                      {vendorsList.map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>

                  {/* Item Category */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                      Item Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={newItemCategory}
                      onChange={e => setNewItemCategory(e.target.value)}
                      className="w-full text-sm border border-neutral-300 rounded-xl px-4 py-3 bg-[#fafaf9] focus:bg-white focus:border-amber-500 focus:outline-none transition-all font-semibold text-neutral-800 cursor-pointer"
                    >
                      <option value="Meat">🥩 Meat</option>
                      <option value="Vegetables">🥦 Vegetables</option>
                      <option value="Fruit">🍎 Fruit</option>
                      <option value="Bread">🍞 Bread</option>
                      <option value="Seafood">🐟 Seafood</option>
                      <option value="Dairy">🥛 Dairy</option>
                      <option value="Dry Goods">🌾 Dry Goods</option>
                      <option value="Beverages">🥤 Beverages</option>
                      <option value="Other">🍽️ Other / Something else</option>
                    </select>
                  </div>

                  {/* Storage Location */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                      Storage Location
                    </label>
                    <select
                      value={newItemLocation}
                      onChange={e => setNewItemLocation(e.target.value)}
                      className="w-full text-sm border border-neutral-300 rounded-xl px-4 py-3 bg-[#fafaf9] focus:bg-white focus:border-amber-500 focus:outline-none transition-all font-semibold text-neutral-800 cursor-pointer"
                    >
                      <option value="Walk-In Cooler">❄️ Walk-In Cooler</option>
                      <option value="Freezer">🥶 Freezer</option>
                      <option value="Dry Storage">📦 Dry Storage</option>
                      <option value="Bar Storage">🍹 Bar Storage</option>
                      <option value="Bakery Rack">🥖 Bakery Rack</option>
                      <option value="Line Station">🍳 Line Station</option>
                    </select>
                  </div>

                  {/* Base Unit Price */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                      Base Unit Price ($) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-neutral-400 text-sm">$</span>
                      <input
                        type="number"
                        step="any"
                        required
                        min="0"
                        value={newItemPrice}
                        onChange={e => setNewItemPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full text-sm border border-neutral-300 rounded-xl pl-8 pr-4 py-3 bg-[#fafaf9] focus:bg-white focus:border-amber-500 focus:outline-none transition-all font-semibold font-mono text-neutral-800"
                      />
                    </div>
                  </div>

                  {/* Pack Size Quantity */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                        Pack Amount
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0.001"
                        required
                        value={newItemPackQty}
                        onChange={e => setNewItemPackQty(e.target.value)}
                        className="w-full text-sm border border-neutral-300 rounded-xl px-4 py-3 bg-[#fafaf9] focus:bg-white focus:border-amber-500 focus:outline-none transition-all font-semibold font-mono text-neutral-800"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                        Unit
                      </label>
                      <select
                        required
                        value={newItemUnit}
                        onChange={e => setNewItemUnit(e.target.value)}
                        className="w-full text-sm border border-neutral-300 rounded-xl px-4 py-3 bg-[#fafaf9] focus:bg-white focus:border-amber-500 focus:outline-none transition-all font-semibold text-neutral-800"
                      >
                        <option value="" disabled>Select...</option>
                        <option value="lb">lb</option>
                        <option value="g">gram</option>
                        <option value="gal">gal</option>
                        <option value="ml">ml</option>
                        <option value="oz">oz</option>
                        <option value="pcs">pcs</option>
                      </select>
                    </div>
                  </div>

                  {/* Initial Stock */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                      Initial Stock Level (Packs)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={newInitialStock}
                      onChange={e => setNewInitialStock(e.target.value)}
                      placeholder="0"
                      className="w-full text-sm border border-neutral-300 rounded-xl px-4 py-3 bg-[#fafaf9] focus:bg-white focus:border-amber-500 focus:outline-none transition-all font-semibold font-mono text-neutral-800"
                    />
                  </div>

                  {/* Min Stock Warning */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                      Minimum Stock Limit (Alert)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={newMinStock}
                      onChange={e => setNewMinStock(e.target.value)}
                      placeholder="0"
                      className="w-full text-sm border border-neutral-300 rounded-xl px-4 py-3 bg-[#fafaf9] focus:bg-white focus:border-amber-500 focus:outline-none transition-all font-semibold font-mono text-neutral-800"
                    />
                  </div>

                </div>

                <div className="pt-4 flex gap-3 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => setPosMode("receive")}
                    className="flex-1 py-3 border border-neutral-300 rounded-xl hover:bg-neutral-50 text-xs font-bold transition-all text-neutral-700 text-center cursor-pointer"
                  >
                    Cancel & Go Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold py-3 rounded-xl transition-all border border-amber-700 shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <PlusCircle className="h-4 w-4" />
                    {submitting ? "Creating Item..." : "Create Inventory Item"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {message && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-max max-w-[500px] z-50">
            <div className={`px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 font-bold ${
              message.type === "success" 
                ? "bg-emerald-900 text-emerald-50" 
                : "bg-red-900 text-red-50"
            }`}>
              {message.type === "success" ? <CheckCircle className="h-5 w-5" /> : <X className="h-5 w-5" />}
              {message.text}
            </div>
          </div>
        )}

        {showCameraScanner && (
          <CameraScanner
            onCapture={handleCameraCapture}
            onClose={() => setShowCameraScanner(false)}
            isProcessing={isProcessingCamera}
            language={language}
          />
        )}

        {/* Automatic Department Selection Modal on POS Entry */}
        {showDeptModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-lg overflow-hidden flex flex-col"
            >
              <div className="bg-emerald-700 text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <MapPin className="h-6 w-6 text-emerald-300" />
                  <div>
                    <h2 className="text-base font-bold font-mono text-white">
                      {language === "es" ? "Seleccionar Departamento de POS" : "Select Operating Department"}
                    </h2>
                    <p className="text-[10px] text-emerald-200 uppercase tracking-wider font-semibold">
                      {language === "es" ? "Requerido para registro de consumo POS" : "Required for POS Consumption Audit Ledger"}
                    </p>
                  </div>
                </div>
                {department && (
                  <button
                    type="button"
                    onClick={() => setShowDeptModal(false)}
                    className="p-1 text-emerald-200 hover:text-white rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>

              <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
                <div>
                  <label className="text-xs font-bold text-neutral-700 block mb-3">
                    {language === "es" ? "Seleccione un Departamento Registrado:" : "Select Registered Operating Department:"}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {deptOptions.map(deptName => {
                      const isSelected = department === deptName;
                      return (
                        <button
                          key={deptName}
                          type="button"
                          onClick={() => {
                            setDepartment(deptName);
                            setShowDeptModal(false);
                          }}
                          className={`px-3.5 py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? "bg-emerald-600 text-white shadow-md border-2 border-emerald-700"
                              : "bg-neutral-100 hover:bg-emerald-50 hover:text-emerald-700 text-neutral-800 border border-neutral-200"
                          }`}
                        >
                          <span className="truncate">{deptName}</span>
                          {isSelected && <Check className="h-4 w-4 shrink-0 ml-1 text-white" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!department) {
                      alert("Please select a registered department.");
                      return;
                    }
                    setShowDeptModal(false);
                  }}
                  disabled={!department}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  {language === "es" ? "Confirmar Departamento" : "Confirm Department & Enter POS"}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Unit Visibility Pop-Up Modal */}
        {showHideUnitSelector && selectedIngredient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[85vh] text-left"
            >
              {/* Header */}
              <div className="px-6 py-4 bg-neutral-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <SlidersHorizontal className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold font-mono text-white">
                      {language === "es" ? "Elegir Unidades de Medida" : "Choose Units of Measure"}
                    </h3>
                    <p className="text-xs text-neutral-300">
                      {language === "es"
                        ? `Seleccionar unidades para ${selectedIngredient.name}`
                        : `Select visible units for ${selectedIngredient.name}`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHideUnitSelector(false)}
                  className="p-1.5 text-neutral-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Status & Quick Actions Bar */}
              <div className="px-6 py-3 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
                <div className="text-xs text-neutral-600 font-semibold flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>
                    {allAvailableUnits.filter(u => !hiddenUnits.some(hu => hu.toLowerCase() === u.toLowerCase())).length} of {allAvailableUnits.length} {language === "es" ? "unidades visibles" : "units visible"}
                  </span>
                </div>
                {hiddenUnits.some(hu => allAvailableUnits.some(u => u.toLowerCase() === hu.toLowerCase())) && (
                  <button
                    type="button"
                    onClick={unhideAllUnits}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    {language === "es" ? "Mostrar todas" : "Show All Units"}
                  </button>
                )}
              </div>

              {/* Unit Choice List */}
              <div className="p-6 overflow-y-auto space-y-2.5 flex-1">
                <p className="text-xs text-neutral-500 font-medium mb-1">
                  {language === "es"
                    ? "Haga clic en una unidad para mostrarla u ocultarla del teclado numérico:"
                    : "Tap any unit below to toggle between visible and hidden:"}
                </p>

                {allAvailableUnits.map((u) => {
                  const isHidden = hiddenUnits.some(hu => hu.toLowerCase() === u.toLowerCase());
                  const isNative = u.toLowerCase() === (selectedIngredient.unit || "lb").toLowerCase();
                  const isPkg = selectedIngredient.packagingUnit && u.toLowerCase() === selectedIngredient.packagingUnit.toLowerCase();
                  const isConv = selectedIngredient.conversions?.some(c => c.targetUnit?.toLowerCase() === u.toLowerCase());

                  return (
                    <div
                      key={u}
                      onClick={() => toggleHideUnit(u)}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer select-none ${
                        isHidden
                          ? "bg-neutral-50 border-neutral-200 opacity-60 text-neutral-400"
                          : "bg-white border-neutral-300 text-neutral-900 shadow-xs hover:border-emerald-500"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-lg flex items-center justify-center border text-xs font-bold transition-colors ${
                            !isHidden
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : "border-neutral-300 bg-neutral-200 text-transparent"
                          }`}
                        >
                          {!isHidden && <Check className="h-3.5 w-3.5 text-white stroke-[3]" />}
                        </div>
                        <div>
                          <div className="font-mono text-sm font-bold capitalize flex items-center gap-2">
                            <span>{u}</span>
                            {selectedUnit.toLowerCase() === u.toLowerCase() && !isHidden && (
                              <span className="text-[9px] font-sans font-bold bg-neutral-800 text-white px-1.5 py-0.2 rounded">
                                {language === "es" ? "Seleccionada" : "Active"}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-neutral-500">
                            {isNative
                              ? (language === "es" ? "Unidad Base / Nativa" : "Base / Native Unit")
                              : isPkg
                              ? (language === "es" ? "Unidad de Empaque (Caja)" : "Packaging Unit (Case)")
                              : isConv
                              ? (language === "es" ? "Unidad de Conversión" : "Conversion Unit")
                              : (language === "es" ? "Unidad Estándar" : "Standard Unit")}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isHidden ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-500 bg-neutral-200/80 px-2.5 py-1 rounded-lg">
                            <EyeOff className="h-3 w-3" />
                            <span>{language === "es" ? "Oculta" : "Hidden"}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                            <Eye className="h-3 w-3" />
                            <span>{language === "es" ? "Visible" : "Visible"}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={unhideAllUnits}
                  className="text-xs font-bold text-neutral-600 hover:text-neutral-900 px-3 py-2 rounded-xl hover:bg-neutral-200 transition-colors cursor-pointer"
                >
                  {language === "es" ? "Restablecer todas" : "Reset all"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowHideUnitSelector(false)}
                  className="bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  <span>{language === "es" ? "Listo" : "Done"}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {showSwitchOperatorModal && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-4xl my-auto">
            <TabletPinKeypad
              allStaff={allStaff}
              user={user}
              onLogin={(op) => {
                setActiveOperator(op);
                setShowSwitchOperatorModal(false);
              }}
              onClose={() => setShowSwitchOperatorModal(false)}
              isModal={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
