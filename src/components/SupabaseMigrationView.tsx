import React, { useState, useMemo, useEffect } from "react";
import {
  Database,
  Copy,
  Check,
  Download,
  Code2,
  Layers,
  ShieldCheck,
  ArrowRight,
  Table2,
  FileCode,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import {
  Ingredient,
  Recipe,
  Timecard,
  Employee,
  ActiveShift,
  DailySale,
  Vendor,
  Department,
  Invoice,
} from "../types";
import { getEffectiveEmployeePin } from "../hooks/useTimeclock";
import { fetchCloudSqlCounts, migrateCollectionsToCloudSql } from "../lib/firebase";

interface SupabaseMigrationViewProps {
  workspaceOwnerId: string | null;
  employees: Employee[];
  activeShifts: ActiveShift[];
  timecards: Timecard[];
  ingredients: Ingredient[];
  recipes: Recipe[];
  invoices: Invoice[];
  vendors: Vendor[];
  dailySales: DailySale[];
  departments: Department[];
}

/**
 * Generates a deterministic UUID-formatted string from any arbitrary string ID
 * so foreign key relationships remain 100% consistent when migrating Firestore IDs to PostgreSQL UUIDs.
 */
function toDeterministicUuid(input: string): string {
  const str = input || "default";
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  let h3 = 0x9e3779b9 ^ str.length;
  let h4 = 0x85ebca6b ^ str.length;

  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 2246822507);
    h4 = Math.imul(h4 ^ ch, 3266489909);
  }

  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  h3 =
    Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^
    Math.imul(h4 ^ (h4 >>> 13), 3266489909);
  h4 =
    Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^
    Math.imul(h3 ^ (h3 >>> 13), 3266489909);

  const hex = (
    (h1 >>> 0).toString(16).padStart(8, "0") +
    (h2 >>> 0).toString(16).padStart(8, "0") +
    (h3 >>> 0).toString(16).padStart(8, "0") +
    (h4 >>> 0).toString(16).padStart(8, "0")
  ).slice(0, 32);

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(
    13,
    16
  )}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function sqlEscape(val: string | undefined | null): string {
  if (val === undefined || val === null) return "NULL";
  return `'${String(val).replace(/'/g, "''")}'`;
}

export const SUPABASE_DDL_SCHEMA = `-- ============================================================================
-- SUPABASE / POSTGRESQL 15+ NORMALIZED RELATIONAL SCHEMA & RLS POLICIES
-- Designed for Multi-Store Restaurant Inventory, Costing & Employee Time Clock
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. DEPARTMENTS
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (owner_id, name)
);

-- 2. EMPLOYEES (STAFF REGISTRY + 4-DIGIT TERMINAL PIN)
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    employee_code VARCHAR(50),
    pin_code VARCHAR(12),
    name VARCHAR(255) NOT NULL,
    role VARCHAR(120) NOT NULL DEFAULT 'Staff',
    dept_name VARCHAR(120) DEFAULT 'Kitchen',
    hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 18.00,
    ot_rate NUMERIC(10, 2),
    is_salary BOOLEAN NOT NULL DEFAULT FALSE,
    salary_amount NUMERIC(12, 2) DEFAULT 0,
    mb_exempt BOOLEAN NOT NULL DEFAULT FALSE,
    tipped BOOLEAN NOT NULL DEFAULT FALSE,
    sick_day_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    tax_status VARCHAR(50),
    phone_no VARCHAR(50),
    address TEXT,
    note TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_owner_pin ON employees(owner_id, pin_code);
CREATE INDEX IF NOT EXISTS idx_employees_owner_code ON employees(owner_id, employee_code);

-- 3. ACTIVE SHIFTS (REAL-TIME EMPLOYEE CHECK-IN / CHECK-OUT)
CREATE TABLE IF NOT EXISTS active_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    employee_name VARCHAR(255) NOT NULL,
    employee_code VARCHAR(50),
    role VARCHAR(120) NOT NULL,
    dept VARCHAR(120),
    hourly_rate NUMERIC(10, 2) NOT NULL,
    shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
    clock_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    clock_in_formatted VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'clocked_in'
        CHECK (status IN ('clocked_in', 'on_break')),
    current_break_start_at TIMESTAMPTZ,
    current_break_type VARCHAR(30)
        CHECK (current_break_type IN ('meal_unpaid', 'rest_paid') OR current_break_type IS NULL),
    accumulated_unpaid_break_minutes INTEGER NOT NULL DEFAULT 0,
    accumulated_paid_break_minutes INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (owner_id, employee_id)
);

-- 4. COMPLETED TIMECARDS (PAYROLL & COMPLIANCE LEDGER)
CREATE TABLE IF NOT EXISTS timecards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    employee_name VARCHAR(255) NOT NULL,
    employee_code VARCHAR(50),
    job VARCHAR(120),
    shift_date DATE NOT NULL,
    clock_in_formatted VARCHAR(30) NOT NULL,
    clock_out_formatted VARCHAR(30) NOT NULL,
    total_hours NUMERIC(8, 2) NOT NULL DEFAULT 0,
    unpaid_break_minutes INTEGER NOT NULL DEFAULT 0,
    paid_hours NUMERIC(8, 2) NOT NULL DEFAULT 0,
    is_auto_clock_out BOOLEAN NOT NULL DEFAULT FALSE,
    is_over_8pm BOOLEAN NOT NULL DEFAULT FALSE,
    anomalies TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timecards_owner_date ON timecards(owner_id, shift_date DESC);

-- 5. NORMALIZED SHIFT BREAKS
CREATE TABLE IF NOT EXISTS shift_breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    active_shift_id UUID REFERENCES active_shifts(id) ON DELETE SET NULL,
    timecard_id UUID REFERENCES timecards(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    break_type VARCHAR(30) NOT NULL CHECK (break_type IN ('meal_unpaid', 'rest_paid')),
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. VENDORS (SUPPLIER REGISTRY)
CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    note TEXT,
    is_registered BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. MASTER INGREDIENTS & REGISTERED PACK SIZES
CREATE TABLE IF NOT EXISTS ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    vendor_name VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'General',
    packaging_unit VARCHAR(50),
    price NUMERIC(12, 4) NOT NULL DEFAULT 0,
    quantity NUMERIC(12, 4) NOT NULL DEFAULT 1,
    unit VARCHAR(50) NOT NULL,
    price_per_gram NUMERIC(14, 6) NOT NULL DEFAULT 0,
    weight_per_case NUMERIC(12, 4),
    weight_per_case_unit VARCHAR(50),
    pcs_per_pound NUMERIC(12, 4),
    usability_percentage NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    in_stock NUMERIC(12, 4) NOT NULL DEFAULT 0,
    min_stock NUMERIC(12, 4) NOT NULL DEFAULT 0,
    location VARCHAR(120),
    source VARCHAR(255),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingredients_owner_name ON ingredients(owner_id, name);

-- 8. INVOICES & NORMALIZED INVOICE LINE ITEMS
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    vendor_name VARCHAR(255),
    file_name VARCHAR(255) NOT NULL,
    invoice_number VARCHAR(100),
    issue_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'applied',
    total_amount NUMERIC(12, 2) DEFAULT 0,
    file_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL,
    target_ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    quantity NUMERIC(12, 4) NOT NULL DEFAULT 1,
    unit VARCHAR(50) NOT NULL,
    price_per_unit NUMERIC(12, 4) NOT NULL DEFAULT 0,
    total_price NUMERIC(12, 2) NOT NULL DEFAULT 0
);

-- 9. RECIPES & NORMALIZED RECIPE INGREDIENTS
CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    department_name VARCHAR(120),
    name VARCHAR(255) NOT NULL,
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    expected_yield NUMERIC(10, 2) NOT NULL DEFAULT 1,
    cost_per_portion NUMERIC(12, 4) NOT NULL DEFAULT 0,
    total_cost NUMERIC(12, 4) NOT NULL DEFAULT 0,
    profit_margin NUMERIC(6, 2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
    sub_recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
    is_sub_recipe BOOLEAN NOT NULL DEFAULT FALSE,
    name VARCHAR(255) NOT NULL,
    grams_or_portions NUMERIC(12, 4) NOT NULL DEFAULT 0
);

-- 10. DAILY SALES LEDGER
CREATE TABLE IF NOT EXISTS daily_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
    recipe_name VARCHAR(255) NOT NULL,
    sale_date DATE NOT NULL,
    quantity_sold NUMERIC(10, 2) NOT NULL DEFAULT 0,
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    cost_per_portion NUMERIC(12, 4) NOT NULL DEFAULT 0,
    total_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
    margin NUMERIC(6, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SUPABASE ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE timecards ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on employees" ON employees
    FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Owner full access on active_shifts" ON active_shifts
    FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Owner full access on timecards" ON timecards
    FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Owner full access on ingredients" ON ingredients
    FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Owner full access on invoices" ON invoices
    FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Owner full access on recipes" ON recipes
    FOR ALL USING (auth.uid() = owner_id);
`;

export default function SupabaseMigrationView({
  workspaceOwnerId,
  employees,
  activeShifts,
  timecards,
  ingredients,
  recipes,
  invoices,
  vendors,
  dailySales,
  departments,
}: SupabaseMigrationViewProps) {
  const [activeTab, setActiveTab] = useState<"schema" | "migration" | "erd">(
    "schema"
  );
  const [copiedDdl, setCopiedDdl] = useState(false);
  const [copiedDataSql, setCopiedDataSql] = useState(false);
  const [cloudSqlCounts, setCloudSqlCounts] = useState<Record<string, number> | null>(null);
  const [isMigratingToSql, setIsMigratingToSql] = useState(false);
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceOwnerId) return;
    fetchCloudSqlCounts(workspaceOwnerId).then((counts) => {
      if (counts) setCloudSqlCounts(counts);
    });
  }, [workspaceOwnerId]);

  const handleDirectCloudSqlMigration = async () => {
    if (!workspaceOwnerId || isMigratingToSql) return;
    setIsMigratingToSql(true);
    setMigrationMessage(null);
    try {
      const result = await migrateCollectionsToCloudSql(workspaceOwnerId, {
        departments,
        employees,
        active_shifts: activeShifts,
        timecards,
        vendors,
        ingredients,
        invoices,
        recipes,
        dailySales,
      });
      if (result?.tableCounts) {
        setCloudSqlCounts(result.tableCounts);
      } else {
        const refreshed = await fetchCloudSqlCounts(workspaceOwnerId);
        if (refreshed) setCloudSqlCounts(refreshed);
      }
      setMigrationMessage(
        "Successfully migrated and synchronized all workspace collections into Cloud SQL (us-west1)!"
      );
    } catch (err: any) {
      setMigrationMessage(err?.message || "Failed to migrate to Cloud SQL.");
    } finally {
      setIsMigratingToSql(false);
    }
  };

  const ownerUuid = useMemo(
    () => toDeterministicUuid(workspaceOwnerId || "primary_owner"),
    [workspaceOwnerId]
  );

  // Normalized child counts
  const invoiceLineItemsCount = useMemo(
    () =>
      invoices.reduce(
        (sum, inv) => sum + (Array.isArray(inv.items) ? inv.items.length : 0),
        0
      ),
    [invoices]
  );

  const recipeIngredientsCount = useMemo(
    () =>
      recipes.reduce(
        (sum, rec) =>
          sum + (Array.isArray(rec.ingredients) ? rec.ingredients.length : 0),
        0
      ),
    [recipes]
  );

  // Generate Live PostgreSQL INSERT Migration Script from Workspace Data
  const liveDataMigrationSql = useMemo(() => {
    const lines: string[] = [
      `-- ============================================================================`,
      `-- LIVE WORKSPACE DATA MIGRATION SCRIPT FOR SUPABASE / POSTGRESQL`,
      `-- Generated at: ${new Date().toISOString()}`,
      `-- Target Workspace Owner UUID: ${ownerUuid}`,
      `-- ============================================================================`,
      `BEGIN;`,
      ``,
    ];

    // 1. Departments
    if (departments.length > 0) {
      lines.push(`-- 1. DEPARTMENTS (${departments.length} rows)`);
      departments.forEach((dept) => {
        const id = toDeterministicUuid(`dept_${dept.id || dept.name}`);
        lines.push(
          `INSERT INTO departments (id, owner_id, name, description) VALUES ('${id}', '${ownerUuid}', ${sqlEscape(
            dept.name
          )}, ${sqlEscape(
            dept.description || ""
          )}) ON CONFLICT (owner_id, name) DO NOTHING;`
        );
      });
      lines.push(``);
    }

    // 2. Employees
    if (employees.length > 0) {
      lines.push(`-- 2. EMPLOYEES (${employees.length} rows)`);
      employees.forEach((emp, idx) => {
        const id = toDeterministicUuid(`emp_${emp.id || emp.name}`);
        const pin = getEffectiveEmployeePin(emp, idx);
        lines.push(
          `INSERT INTO employees (id, owner_id, employee_code, pin_code, name, role, dept_name, hourly_rate, ot_rate, is_salary, salary_amount, mb_exempt, tipped) VALUES ('${id}', '${ownerUuid}', ${sqlEscape(
            emp.employeeCode || ""
          )}, ${sqlEscape(pin)}, ${sqlEscape(emp.name)}, ${sqlEscape(
            emp.role || "Staff"
          )}, ${sqlEscape(emp.dept || "Kitchen")}, ${
            Number(emp.hourlyRate) || 18
          }, ${Number(emp.otRate) || (Number(emp.hourlyRate) || 18) * 1.5}, ${
            emp.isSalary ? "TRUE" : "FALSE"
          }, ${Number(emp.salaryAmount) || 0}, ${
            emp.mbExempt ? "TRUE" : "FALSE"
          }, ${
            emp.tipped ? "TRUE" : "FALSE"
          }) ON CONFLICT (id) DO UPDATE SET pin_code = EXCLUDED.pin_code, hourly_rate = EXCLUDED.hourly_rate;`
        );
      });
      lines.push(``);
    }

    // 3. Active Shifts
    if (activeShifts.length > 0) {
      lines.push(`-- 3. ACTIVE SHIFTS (${activeShifts.length} rows)`);
      activeShifts.forEach((shift) => {
        const id = toDeterministicUuid(`shift_${shift.id || shift.employeeId}`);
        const empId = toDeterministicUuid(
          `emp_${shift.employeeId || shift.employeeName}`
        );
        lines.push(
          `INSERT INTO active_shifts (id, owner_id, employee_id, employee_name, employee_code, role, dept, hourly_rate, shift_date, clock_in_at, clock_in_formatted, status, accumulated_unpaid_break_minutes, accumulated_paid_break_minutes) VALUES ('${id}', '${ownerUuid}', '${empId}', ${sqlEscape(
            shift.employeeName
          )}, ${sqlEscape(shift.employeeCode || "")}, ${sqlEscape(
            shift.role
          )}, ${sqlEscape(shift.dept || "Kitchen")}, ${
            Number(shift.hourlyRate) || 18
          }, ${sqlEscape(shift.date)}, ${sqlEscape(
            shift.clockInIso
          )}, ${sqlEscape(shift.clockInFormatted)}, ${sqlEscape(
            shift.status
          )}, ${Number(shift.accumulatedUnpaidBreakMinutes) || 0}, ${
            Number(shift.accumulatedPaidBreakMinutes) || 0
          }) ON CONFLICT (id) DO NOTHING;`
        );
      });
      lines.push(``);
    }

    // 4. Timecards
    if (timecards.length > 0) {
      lines.push(`-- 4. COMPLETED TIMECARDS (${timecards.length} rows)`);
      timecards.forEach((tc, idx) => {
        const id = toDeterministicUuid(
          `tc_${tc.id || `${tc.employeeName}_${tc.date}_${idx}`}`
        );
        const matchedEmp = employees.find(
          (e) =>
            e.name.toLowerCase().trim() === tc.employeeName.toLowerCase().trim()
        );
        const empIdSql = matchedEmp
          ? `'${toDeterministicUuid(`emp_${matchedEmp.id || matchedEmp.name}`)}'`
          : "NULL";
        const anomaliesSql =
          tc.anomalies && tc.anomalies.length > 0
            ? `ARRAY[${tc.anomalies.map((a) => sqlEscape(a)).join(", ")}]`
            : `'{}'`;

        lines.push(
          `INSERT INTO timecards (id, owner_id, employee_id, employee_name, employee_code, job, shift_date, clock_in_formatted, clock_out_formatted, total_hours, unpaid_break_minutes, paid_hours, is_auto_clock_out, is_over_8pm, anomalies) VALUES ('${id}', '${ownerUuid}', ${empIdSql}, ${sqlEscape(
            tc.employeeName
          )}, ${sqlEscape(tc.employeeCode || "")}, ${sqlEscape(
            tc.job || "Staff"
          )}, ${sqlEscape(tc.date)}, ${sqlEscape(tc.clockIn)}, ${sqlEscape(
            tc.clockOut
          )}, ${Number(tc.totalHours) || 0}, ${
            Number(tc.unpaidBreakMinutes) || 0
          }, ${Number(tc.paidHours) || 0}, ${
            tc.isAutoClockOut ? "TRUE" : "FALSE"
          }, ${
            tc.isOver8PM ? "TRUE" : "FALSE"
          }, ${anomaliesSql}) ON CONFLICT (id) DO NOTHING;`
        );
      });
      lines.push(``);
    }

    // 5. Vendors
    if (vendors.length > 0) {
      lines.push(`-- 5. VENDORS (${vendors.length} rows)`);
      vendors.forEach((v) => {
        const id = toDeterministicUuid(`vendor_${v.id || v.name}`);
        lines.push(
          `INSERT INTO vendors (id, owner_id, name, contact_name, phone, email, address) VALUES ('${id}', '${ownerUuid}', ${sqlEscape(
            v.name
          )}, ${sqlEscape(v.contactName || "")}, ${sqlEscape(
            v.phone || ""
          )}, ${sqlEscape(v.email || "")}, ${sqlEscape(
            v.address || ""
          )}) ON CONFLICT (id) DO NOTHING;`
        );
      });
      lines.push(``);
    }

    // 6. Ingredients
    if (ingredients.length > 0) {
      lines.push(`-- 6. MASTER INGREDIENTS (${ingredients.length} rows)`);
      ingredients.forEach((ing) => {
        const id = toDeterministicUuid(`ing_${ing.id || ing.name}`);
        const matchedVendor = vendors.find(
          (v) =>
            v.name.toLowerCase().trim() === (ing.vendor || "").toLowerCase().trim()
        );
        const vendorIdSql = matchedVendor
          ? `'${toDeterministicUuid(
              `vendor_${matchedVendor.id || matchedVendor.name}`
            )}'`
          : "NULL";

        lines.push(
          `INSERT INTO ingredients (id, owner_id, vendor_id, vendor_name, name, category, packaging_unit, price, quantity, unit, price_per_gram, usability_percentage, in_stock, min_stock) VALUES ('${id}', '${ownerUuid}', ${vendorIdSql}, ${sqlEscape(
            ing.vendor || ""
          )}, ${sqlEscape(ing.name)}, ${sqlEscape(
            ing.category || "General"
          )}, ${sqlEscape(ing.packagingUnit || ing.unit)}, ${
            Number(ing.price) || 0
          }, ${Number(ing.quantity) || 1}, ${sqlEscape(ing.unit)}, ${
            Number(ing.pricePerGram) || 0
          }, ${Number(ing.usabilityPercentage) || 100}, ${
            Number(ing.inStock) || 0
          }, ${Number(ing.minStock) || 0}) ON CONFLICT (id) DO NOTHING;`
        );
      });
      lines.push(``);
    }

    // 7. Recipes & Normalized Recipe Ingredients
    if (recipes.length > 0) {
      lines.push(
        `-- 7. RECIPES (${recipes.length} rows) & RECIPE INGREDIENTS (${recipeIngredientsCount} rows)`
      );
      recipes.forEach((rec) => {
        const recUuid = toDeterministicUuid(`rec_${rec.id || rec.name}`);
        lines.push(
          `INSERT INTO recipes (id, owner_id, department_name, name, selling_price, expected_yield, cost_per_portion, total_cost, profit_margin) VALUES ('${recUuid}', '${ownerUuid}', ${sqlEscape(
            rec.department || "Kitchen"
          )}, ${sqlEscape(rec.name)}, ${Number(rec.sellingPrice) || 0}, ${
            Number(rec.expectedYield) || 1
          }, ${Number(rec.costPerPortion) || 0}, ${
            Number(rec.totalCost) || 0
          }, ${Number(rec.profitMargin) || 0}) ON CONFLICT (id) DO NOTHING;`
        );

        (rec.ingredients || []).forEach((refItem, refIdx) => {
          const refUuid = toDeterministicUuid(
            `rec_ing_${rec.id || rec.name}_${refItem.ingredientId || refIdx}`
          );
          const ingUuidSql =
            !refItem.isSubRecipe && refItem.ingredientId
              ? `'${toDeterministicUuid(`ing_${refItem.ingredientId}`)}'`
              : "NULL";
          lines.push(
            `INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, is_sub_recipe, name, grams_or_portions) VALUES ('${refUuid}', '${recUuid}', ${ingUuidSql}, ${
              refItem.isSubRecipe ? "TRUE" : "FALSE"
            }, ${sqlEscape(refItem.name)}, ${
              Number(refItem.grams) || 0
            }) ON CONFLICT (id) DO NOTHING;`
          );
        });
      });
      lines.push(``);
    }

    lines.push(`COMMIT;`);
    return lines.join("\n");
  }, [
    ownerUuid,
    departments,
    employees,
    activeShifts,
    timecards,
    vendors,
    ingredients,
    recipes,
    recipeIngredientsCount,
  ]);

  const handleCopyDdl = () => {
    navigator.clipboard.writeText(SUPABASE_DDL_SCHEMA);
    setCopiedDdl(true);
    setTimeout(() => setCopiedDdl(false), 2500);
  };

  const handleCopyDataSql = () => {
    navigator.clipboard.writeText(liveDataMigrationSql);
    setCopiedDataSql(true);
    setTimeout(() => setCopiedDataSql(false), 2500);
  };

  const handleDownloadFullBundle = () => {
    const fullSql = `${SUPABASE_DDL_SCHEMA}\n\n${liveDataMigrationSql}`;
    const blob = new Blob([fullSql], { type: "application/sql;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `supabase_relational_migration_${new Date()
      .toISOString()
      .slice(0, 10)}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const relationalTables = [
    {
      table: "employees",
      domain: "Time & Payroll",
      pk: "id (UUID)",
      fks: "department_id → departments(id)",
      indexes: "idx_employees_owner_pin, idx_employees_owner_code",
      liveCount: employees.length,
    },
    {
      table: "active_shifts",
      domain: "Time & Payroll",
      pk: "id (UUID)",
      fks: "employee_id → employees(id) ON DELETE CASCADE",
      indexes: "UNIQUE (owner_id, employee_id)",
      liveCount: activeShifts.length,
    },
    {
      table: "shift_breaks",
      domain: "Time & Payroll",
      pk: "id (UUID)",
      fks: "active_shift_id → active_shifts(id), timecard_id → timecards(id)",
      indexes: "idx_shift_breaks_employee",
      liveCount: activeShifts.reduce(
        (acc, s) => acc + (s.breakHistory?.length || 0),
        0
      ),
    },
    {
      table: "timecards",
      domain: "Time & Payroll",
      pk: "id (UUID)",
      fks: "employee_id → employees(id) ON DELETE SET NULL",
      indexes: "idx_timecards_owner_date",
      liveCount: timecards.length,
    },
    {
      table: "vendors",
      domain: "Supply Chain",
      pk: "id (UUID)",
      fks: "—",
      indexes: "UNIQUE (owner_id, normalized_key)",
      liveCount: vendors.length,
    },
    {
      table: "ingredients",
      domain: "Master Catalog",
      pk: "id (UUID)",
      fks: "vendor_id → vendors(id) ON DELETE SET NULL",
      indexes: "idx_ingredients_owner_name",
      liveCount: ingredients.length,
    },
    {
      table: "invoices",
      domain: "Accounts Payable",
      pk: "id (UUID)",
      fks: "vendor_id → vendors(id)",
      indexes: "idx_invoices_owner_date",
      liveCount: invoices.length,
    },
    {
      table: "invoice_items",
      domain: "Accounts Payable (Normalized)",
      pk: "id (UUID)",
      fks: "invoice_id → invoices(id), target_ingredient_id → ingredients(id)",
      indexes: "idx_invoice_items_invoice",
      liveCount: invoiceLineItemsCount,
    },
    {
      table: "recipes",
      domain: "Culinary Costing",
      pk: "id (UUID)",
      fks: "department_id → departments(id)",
      indexes: "idx_recipes_owner",
      liveCount: recipes.length,
    },
    {
      table: "recipe_ingredients",
      domain: "Culinary Costing (Normalized)",
      pk: "id (UUID)",
      fks: "recipe_id → recipes(id), ingredient_id → ingredients(id)",
      indexes: "idx_recipe_ingredients_recipe",
      liveCount: recipeIngredientsCount,
    },
    {
      table: "daily_sales",
      domain: "POS Revenue",
      pk: "id (UUID)",
      fks: "recipe_id → recipes(id)",
      indexes: "idx_daily_sales_date",
      liveCount: dailySales.length,
    },
  ];

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto">
      {/* Header Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Relational Database Architecture</span>
            <span aria-hidden="true">·</span>
            <span>PostgreSQL 15+ & Supabase RLS</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {relationalTables.length} Normalized Tables
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Supabase Relational Database Schema & Live SQL Exporter
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab("schema")}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === "schema"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Relational Tables & DDL
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("migration")}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === "migration"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Live Data SQL Export
            </button>
          </div>

          <button
            type="button"
            onClick={handleDirectCloudSqlMigration}
            disabled={isMigratingToSql}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isMigratingToSql ? "animate-spin" : ""}`} />
            <span>
              {isMigratingToSql
                ? "Migrating to Cloud SQL..."
                : "1-Click Migrate & Sync to Cloud SQL (us-west1)"}
            </span>
          </button>

          <button
            type="button"
            onClick={handleDownloadFullBundle}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Full .SQL Bundle</span>
          </button>
        </div>
      </div>

      {migrationMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-3 text-xs text-emerald-900">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{migrationMessage}</span>
          </div>
          <span className="font-mono text-[11px] text-emerald-700">
            Region: us-west1 · PostgreSQL
          </span>
        </div>
      )}

      {activeTab === "schema" && (
        <div className="space-y-6">
          {/* Normalized Relational Tables Overview */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Normalized PostgreSQL Table Catalog & Foreign Keys
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Replaces nested NoSQL arrays with relational foreign-key tables for Supabase
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-600">
                UUID v4 / v5 Deterministic Keys
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                    <th className="py-2.5 px-4">PostgreSQL Table</th>
                    <th className="py-2.5 px-4">Domain</th>
                    <th className="py-2.5 px-4">Primary Key</th>
                    <th className="py-2.5 px-4">Foreign Key Constraints</th>
                    <th className="py-2.5 px-4">Indexes / Uniqueness</th>
                    <th className="py-2.5 px-4 text-right">Workspace Rows</th>
                    <th className="py-2.5 px-4 text-right">Cloud SQL Rows</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {relationalTables.map((t) => (
                    <tr key={t.table} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono font-bold text-indigo-700">
                        {t.table}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700">{t.domain}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">
                        {t.pk}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600">
                        {t.fks}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                        {t.indexes}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                        {t.liveCount}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-emerald-700">
                        {cloudSqlCounts && cloudSqlCounts[t.table] !== undefined
                          ? cloudSqlCounts[t.table]
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Copyable Supabase DDL & RLS SQL */}
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl overflow-hidden text-white">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold">
                  supabase_schema_and_rls.sql (Ready for Supabase SQL Editor)
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyDdl}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
              >
                {copiedDdl ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied DDL to Clipboard</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Supabase DDL</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-5 text-xs font-mono text-slate-200 overflow-x-auto max-h-[520px] leading-relaxed">
              {SUPABASE_DDL_SCHEMA}
            </pre>
          </div>
        </div>
      )}

      {activeTab === "migration" && (
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl overflow-hidden text-white">
          <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-white">
                Live Workspace Relational Data Seed (INSERT Statements)
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Automatically converts your {employees.length} employees,{" "}
                {activeShifts.length} active shifts, {timecards.length}{" "}
                timecards, {ingredients.length} ingredients, and{" "}
                {recipes.length} recipes into foreign-key-linked PostgreSQL
                INSERT statements.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopyDataSql}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedDataSql ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied Data INSERTs</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Live Data SQL</span>
                </>
              )}
            </button>
          </div>

          <pre className="p-5 text-xs font-mono text-emerald-200 overflow-x-auto max-h-[600px] leading-relaxed">
            {liveDataMigrationSql}
          </pre>
        </div>
      )}
    </div>
  );
}
