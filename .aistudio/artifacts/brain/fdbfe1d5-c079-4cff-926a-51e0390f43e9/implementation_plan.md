# Codebase Optimization, Relational Database (Supabase / PostgreSQL) Migration & Real-Time Employee Time Clock Suite

A unified engineering blueprint to refactor and optimize application state, introduce a **Dedicated Employee Check-In / Check-Out PIN Terminal** and **Live Shift Manager Dashboard**, and design a normalized **PostgreSQL / Supabase Relational Database Schema** with a clean repository layer and zero-data-loss migration pipeline.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> All core architectural, time-clock, and relational database decisions below reflect your confirmed preferences.

- **Confirmed Access Architecture**: Dedicated **PIN Pad Time Clock Terminal** (kiosk-ready for kitchen/front-of-house tablets or desktop) paired with a **Live Manager Shift Dashboard** integrated into the Time Management workspace.
- **Confirmed Identity Verification**: Fast **4-digit Employee PIN or Employee Code** lookup (linked to `employees.pin_code` and `employees.employee_code`, with instant fallback matching for existing staff).
- **Confirmed Shift Management Capabilities**:
  - **Start & End Meal / Rest Breaks**: Real-time break timers with paid vs. unpaid break classification stored in a normalized `shift_breaks` relational structure.
  - **Live "Who is Clocked In" Status Board**: Instant visibility into active staff on the floor, current shift duration, accumulated labor cost, and break status.
  - **Automated Overtime & Break Compliance Engine**: Live alerts and automatic calculation of meal-break penalties (shifts $>5\text{h}$ or $>6\text{h}$ without a break), daily overtime ($>8\text{h}$), and late check-out ($>8:00\text{ PM}$) anomalies when generating completed timecards.
- **Confirmed Optimization & Relational Database Strategy**:
  - **Normalized PostgreSQL / Supabase Schema**: Replaces flat, denormalized NoSQL documents and embedded JSON arrays with strict relational tables, foreign key constraints (`ON DELETE RESTRICT` / `CASCADE`), composite indexes, and Row-Level Security (RLS) policies.
  - **Repository & Domain Hook Modularization**: Decouples UI views from direct database calls via domain hooks (`useTimeclock`, `useRelationalMigration`) and memoized selectors, plus a built-in **Supabase SQL Schema & Data Migration Center** that exports your live data into ready-to-run PostgreSQL `INSERT` statements or connects via relational API endpoints.

---

## 1. Overview & Core Concept

### What It Does
1. **Real-Time Employee Check-In / Check-Out & Break Tracking**:
   - Provides a touch-friendly **Time Clock Terminal** where employees enter their 4-digit PIN or Employee Code (e.g., `101` or `EMP-101`) to immediately view their shift state and perform context-aware actions: **Clock In**, **Start Meal/Rest Break**, **End Break**, or **Clock Out**.
   - Provides managers with a **Live Shift Status Board** showing every clocked-in employee, live elapsed hours, real-time labor cost burn rate, active break timers, and approaching break-compliance or overtime thresholds.
   - Atomically closes active shifts upon Clock Out, computing net paid hours, regular vs. overtime pay, and break deductions to create a verified `Timecard` record.
2. **Normalized Relational Database Architecture (Supabase / PostgreSQL)**:
   - Normalizes all 12 application domains into a cohesive relational schema where **Employees $\rightarrow$ Active Shifts $\rightarrow$ Shift Breaks $\rightarrow$ Timecards**, **Vendors $\rightarrow$ Ingredients $\rightarrow$ Invoices $\rightarrow$ Invoice Line Items**, and **Recipes $\rightarrow$ Recipe Ingredients $\rightarrow$ Daily Sales** enforce referential integrity at the database level.
   - Includes a dedicated **Database Architecture & Supabase Migration Utility** view where you can inspect the ER diagram, copy the complete Supabase DDL + RLS SQL script, and export all existing Firestore workspace data as relational SQL seed statements or JSON batches.
3. **Codebase Architecture & Performance Optimization**:
   - Extracts domain-isolated state hooks and memoized lookup maps ($O(1)$ employee PIN lookup, $O(1)$ ingredient ID lookup) so high-frequency events (like the 1-second shift timer or POS entries) never trigger full-application re-renders.

---

## 2. User Experience & Visual Design

### Key User Flows

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 1. Employee Self-Service PIN Terminal Flow                                   │
│    Enter 4-Digit PIN / Code ──► Identity Verified ──► Context Action Pad     │
│                                                       ├─► Clock In (Shift)   │
│                                                       ├─► Start / End Break  │
│                                                       └─► Clock Out & Summary│
│                                                                              │
│ 2. Live Manager Shift & Compliance Board Flow                                │
│    View Active Roster ──► Monitor Live Timers / Break Alerts ──► Force Out / │
│                           & Real-Time Labor Cost Burn            Edit Shift  │
│                                                                              │
│ 3. Relational Database & Supabase Migration Flow                             │
│    Inspect Relational Schema ──► Copy Supabase DDL + RLS ──► Export Live Data│
│                                                              as SQL / Sync   │
└──────────────────────────────────────────────────────────────────────────────┘
```

1. **Dedicated Time Clock PIN Terminal**:
   - **Split Kiosk Layout**: Left pane displays a live digital clock (`tabular-nums`), active workspace header, and live floor summary (count of staff currently clocked in and on break). Right pane houses the high-contrast **Tactile Keypad** (`0–9`, `Clear`, `Verify`) with physical keyboard support.
   - **Verified Employee Action Drawer**: Once a valid 4-digit PIN or Employee Code is entered, displays the employee's name, role, department, and current shift state:
     - *Off the Clock*: Primary **Clock In Now** button (with station/department selector).
     - *Clocked In*: Live shift duration timer, **Start Meal Break (Unpaid 30m)**, **Start Rest Break (Paid 15m)**, and **Clock Out** buttons.
     - *On Break*: Live break timer and primary **End Break & Resume Shift** button.
   - **Auto-Reset Security**: Automatically resets to the neutral PIN pad 4 seconds after a punch action completes.

2. **Live Manager Shift Dashboard ("Who is Clocked In")**:
   - **Real-Time Telemetry Strip**: Displays Active Staff Count, Staff on Break, Live Shift Labor Cost (`$`), and Compliance Warnings (e.g., approaching 5-hour meal break deadline or $>8\text{-hour}$ daily overtime).
   - **High-Density Active Shift Table**: Compact $40\text{px}$ rows with monospace tabular numerals (`font-mono tabular-nums`) showing Employee Name & Code, Role/Department, Clock-In Time, Break Status & Accumulated Break Minutes, Live Elapsed Duration, Accrued Shift Cost, and Manager Quick Actions (**Start/End Break**, **Clock Out**, or **Assign PIN**).

### Visual Identity & Theme
- **Aesthetic Direction**: Utilitarian, high-contrast SaaS & Hospitality Operations aesthetic following the **SaaS & Dashboard Design Guidelines**.
- **Color Palette & 60-30-10 Discipline**:
  - **60% Neutral Canvas**: Crisp `#F8FAFC` slate workspace background on desktop; deep carbon `#0F172A` surface for the PIN pad terminal.
  - **30% Structural Surfaces**: Pure `#FFFFFF` single-elevation containers with `1px solid #E2E8F0` hairline borders (zero nested cards-within-cards, zero thick left accent borders).
  - **10% Semantic Accents**:
    - Emerald (`#16A34A`): Clocked In / Active Shift
    - Amber (`#D97706`): On Meal/Rest Break or Approaching 5h Break Threshold
    - Crimson (`#DC2626`): Overtime ($>8\text{h}$) or Missed Break Compliance Alert
    - Indigo (`#4F46E5`): Primary Terminal Verification & Manager Controls
- **Typography & Tabular Discipline**:
  - **Display & Navigation**: `Plus Jakarta Sans` (600/700 weight, tight tracking).
  - **Timers, PIN Display, Hours & Currency**: `JetBrains Mono` / `font-mono tabular-nums` for vertical alignment and zero horizontal jitter.
  - **Zero-Pill Metadata**: Static employee metadata (`Role · Department · Code`) rendered as clean unboxed inline text separated by `·`.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Normalized Relational Schema vs. Document Arrays
- **Chosen Approach**: Normalize embedded document arrays (`invoice.items`, `recipe.ingredients`, `grocery.items`, `shift.breaks`) into dedicated child tables (`invoice_items`, `recipe_ingredients`, `grocery_purchase_items`, `shift_breaks`) with strict foreign keys.
- **Why**: In a relational database (Supabase / PostgreSQL), normalized child tables allow instant SQL aggregations (e.g., `SUM(total_price) GROUP BY ingredient_id` to track historical price creep across all invoices, or `JOIN recipe_ingredients` to instantly recalculate all recipe margins when a single ingredient's price changes).
- **Alternatives Considered**: Storing `JSONB` arrays inside parent tables (sacrifices foreign-key integrity and makes cross-invoice or cross-recipe SQL analytics slow and brittle).

### Decision 2: Dedicated `active_shifts` Table + Atomic Promotion to `timecards`
- **Chosen Approach**: Store open shifts in `active_shifts` (with normalized `shift_breaks` records) and promote them atomically into `timecards` upon Clock Out.
- **Why**: Prevents incomplete open shifts from distorting historical payroll sums while enabling real-time subscriptions (`supabase.channel('active_shifts')` or snapshot listeners) on a lightweight table containing only currently working staff.

### Decision 3: Repository Adapter & Live SQL Migration Generator
- **Chosen Approach**: Centralize state operations behind modular domain hooks and provide an interactive **Supabase SQL & Data Migration Generator** that produces both the DDL schema (tables, indexes, triggers, RLS policies) and `INSERT` migration scripts from your live data.
- **Why**: Lets you immediately use the new Employee Check-In / Check-Out system today while giving you a 100% turnkey SQL migration path into Supabase PostgreSQL without any manual data re-entry.

---

## 4. Technical Architecture & Relational Database Design

### System Architecture & Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        APPLICATION WORKSPACE SHELL                           │
│  - Top Header Bar & Collapsible Navigation Sidebar                           │
│  - Memoized Domain Selectors ($O(1)$ Lookup Maps for Staff, Catalog, Vendors)│
└───────────────────┬──────────────────────────────────────┬───────────────────┘
                    │                                      │
                    ▼                                      ▼
┌───────────────────────────────────────┐┌─────────────────────────────────────┐
│     TIME MANAGEMENT & LABOR SUITE     ││   CORE OPERATIONS & COSTING SUITE   │
│                                       ││                                     │
│  ┌─────────────────────────────────┐  ││  - Dashboard & Food Cost Intel      │
│  │ 1. Live Time Clock Terminal     │  ││  - AI Invoice Parser & Verification │
│  │    - Tactile 4-Digit PIN Keypad │  ││  - Master Ingredients & Pack Sizes  │
│  │    - Clock In / Break / Out Pad │  ││  - Inventory Count & Kitchen POS    │
│  └───────────────┬─────────────────┘  ││  - Relational DB & Supabase Exporter│
│                  │                    │└─────────────────┬───────────────────┘
│                  ▼                    │                  │
│  ┌─────────────────────────────────┐  │                  │
│  │ 2. Live Shift Manager Board     │  │                  │
│  │    - "Who is Clocked In" Roster │  │                  │
│  │    - Break & Overtime Alerts    │  │                  │
│  └───────────────┬─────────────────┘  │                  │
│                  │Atomic Clock-Out    │                  │
│                  ▼                    │                  │
│  ┌─────────────────────────────────┐  │                  │
│  │ 3. Timesheet Auditor & Staff    │  │                  │
│  │    - Completed Timecards & PINs │  │                  │
│  └───────────────┬─────────────────┘  │                  │
└──────────────────┼────────────────────┘                  │
                   └───────────────────┬───────────────────┘
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│               RELATIONAL DATA MODEL (SUPABASE / POSTGRESQL)                  │
│                                                                              │
│  [Time & Payroll Domain]               [Catalog, Inventory & Costing Domain] │
│  departments ◄── employees             vendors ◄── ingredients               │
│                    ├──► active_shifts                ├──► invoice_items      │
│                    │      └──► shift_breaks          ├──► consumption_logs   │
│                    └──► timecards                    └──► recipe_ingredients │
│                                                             └──► daily_sales │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Complete PostgreSQL / Supabase Relational Schema (DDL)

Below is the normalized relational schema designed for **Supabase (PostgreSQL 15+)** with UUID primary keys, strict foreign key constraints, generated columns/indexes, and Supabase Row-Level Security (`auth.uid()`):

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. WORKSPACES, RESTAURANTS & DEPARTMENTS
-- ============================================================================
CREATE TABLE restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL, -- Links to Supabase auth.users(id)
    name VARCHAR(255) NOT NULL,
    address TEXT,
    contact_name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (owner_id, name)
);

-- ============================================================================
-- 2. STAFF REGISTRY & REAL-TIME TIME MANAGEMENT (CHECK-IN / CHECK-OUT)
-- ============================================================================
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    employee_code VARCHAR(50),          -- e.g. 'EMP-101'
    pin_code VARCHAR(12),               -- 4-digit terminal PIN (e.g. '1014')
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
    date_hired DATE,
    date_terminated DATE,
    note TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_employees_owner_pin ON employees(owner_id, pin_code);
CREATE INDEX idx_employees_owner_code ON employees(owner_id, employee_code);

-- Live Open Shifts (Active Check-Ins)
CREATE TABLE active_shifts (
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
    status VARCHAR(30) NOT NULL DEFAULT 'clocked_in'
        CHECK (status IN ('clocked_in', 'on_break')),
    current_break_start_at TIMESTAMPTZ,
    current_break_type VARCHAR(30)
        CHECK (current_break_type IN ('meal_unpaid', 'rest_paid') OR current_break_type IS NULL),
    accumulated_unpaid_break_minutes INTEGER NOT NULL DEFAULT 0,
    accumulated_paid_break_minutes INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (owner_id, employee_id) -- Guarantees an employee cannot double clock-in
);

-- Completed Historical Timecards (Payroll & Compliance Ledger)
CREATE TABLE timecards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    employee_name VARCHAR(255) NOT NULL,
    employee_code VARCHAR(50),
    job VARCHAR(120),
    shift_date DATE NOT NULL,
    clock_in_formatted VARCHAR(30) NOT NULL,
    clock_out_formatted VARCHAR(30) NOT NULL,
    clock_in_at TIMESTAMPTZ,
    clock_out_at TIMESTAMPTZ,
    total_hours NUMERIC(8, 2) NOT NULL DEFAULT 0,
    unpaid_break_minutes INTEGER NOT NULL DEFAULT 0,
    paid_hours NUMERIC(8, 2) NOT NULL DEFAULT 0,
    regular_hours NUMERIC(8, 2) NOT NULL DEFAULT 0,
    overtime_hours NUMERIC(8, 2) NOT NULL DEFAULT 0,
    hourly_rate_snapshot NUMERIC(10, 2),
    is_auto_clock_out BOOLEAN NOT NULL DEFAULT FALSE,
    is_over_8pm BOOLEAN NOT NULL DEFAULT FALSE,
    anomalies TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_timecards_owner_date ON timecards(owner_id, shift_date DESC);
CREATE INDEX idx_timecards_employee ON timecards(employee_id, shift_date DESC);

-- Normalized Shift Break Intervals
CREATE TABLE shift_breaks (
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

-- ============================================================================
-- 3. VENDORS, MASTER INGREDIENTS & INVENTORY LEDGER
-- ============================================================================
CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    normalized_key VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    note TEXT,
    is_registered BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (owner_id, normalized_key)
);

CREATE TABLE ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    vendor_name VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'General',
    packaging_unit VARCHAR(50),         -- Registered Pack Size (e.g. 'Box', 'Case', 'Bag')
    price NUMERIC(12, 4) NOT NULL DEFAULT 0,
    quantity NUMERIC(12, 4) NOT NULL DEFAULT 1,
    unit VARCHAR(50) NOT NULL,          -- Package unit
    price_per_gram NUMERIC(14, 6) NOT NULL DEFAULT 0,
    weight_per_case NUMERIC(12, 4),
    weight_per_case_unit VARCHAR(50),
    pcs_per_pound NUMERIC(12, 4),
    usability_percentage NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    in_stock NUMERIC(12, 4) NOT NULL DEFAULT 0,
    min_stock NUMERIC(12, 4) NOT NULL DEFAULT 0,
    location VARCHAR(120),
    source VARCHAR(255),
    is_hidden_from_inventory BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ingredients_owner_name ON ingredients(owner_id, name);
CREATE INDEX idx_ingredients_vendor ON ingredients(vendor_id);

-- ============================================================================
-- 4. INVOICES & NORMALIZED INVOICE LINE ITEMS
-- ============================================================================
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    vendor_name VARCHAR(255),
    file_name VARCHAR(255) NOT NULL,
    invoice_number VARCHAR(100),
    issue_date DATE,
    due_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending_review'
        CHECK (status IN ('pending_review', 'applied', 'paid', 'unpaid', 'overdue', 'void')),
    total_amount NUMERIC(12, 2) DEFAULT 0,
    notes TEXT,
    file_url TEXT,
    file_type VARCHAR(100),
    file_size INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL,
    target_ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    quantity NUMERIC(12, 4) NOT NULL DEFAULT 1,
    unit VARCHAR(50) NOT NULL,
    original_doc_unit VARCHAR(50),
    registered_pack_size VARCHAR(50),
    unit_matched_to_pack_size BOOLEAN NOT NULL DEFAULT FALSE,
    price_per_unit NUMERIC(12, 4) NOT NULL DEFAULT 0,
    total_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    match_action VARCHAR(20) DEFAULT 'create'
        CHECK (match_action IN ('create', 'map', 'skip')),
    weight_per_case NUMERIC(12, 4),
    weight_per_case_unit VARCHAR(50),
    pcs_per_pound NUMERIC(12, 4),
    usability_percentage NUMERIC(5, 2) DEFAULT 100.00
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_ingredient ON invoice_items(target_ingredient_id);

-- ============================================================================
-- 5. CONSUMPTION LEDGER, RECIPES & DAILY SALES
-- ============================================================================
CREATE TABLE consumption_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
    ingredient_name VARCHAR(255) NOT NULL,
    vendor_name VARCHAR(255),
    consumption_date DATE NOT NULL,
    quantity NUMERIC(12, 4) NOT NULL, -- Negative = restock inflow, Positive = consumption outflow
    unit VARCHAR(50) NOT NULL,
    price_per_pack NUMERIC(12, 4) NOT NULL DEFAULT 0,
    total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
    recorded_by VARCHAR(255),
    operator_name VARCHAR(255),
    signature_base64 TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consumption_owner_date ON consumption_logs(owner_id, consumption_date DESC);

CREATE TABLE recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    department_name VARCHAR(120),
    name VARCHAR(255) NOT NULL,
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    expected_yield NUMERIC(10, 2) NOT NULL DEFAULT 1,
    cost_per_portion NUMERIC(12, 4) NOT NULL DEFAULT 0,
    total_cost NUMERIC(12, 4) NOT NULL DEFAULT 0,
    profit_margin NUMERIC(6, 2) NOT NULL DEFAULT 0,
    display_order INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE RESTRICT,
    sub_recipe_id UUID REFERENCES recipes(id) ON DELETE RESTRICT,
    is_sub_recipe BOOLEAN NOT NULL DEFAULT FALSE,
    name VARCHAR(255) NOT NULL,
    grams_or_portions NUMERIC(12, 4) NOT NULL DEFAULT 0
);

CREATE TABLE daily_sales (
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
```

### Interactive Component & State Mapping
1. **PIN Verification & Terminal Flow**:
   - Validates 4-digit PIN (`pin`) or `employeeCode` in $O(1)$ using a memoized lookup map over `employees`.
   - Renders context-specific shift controls (**Clock In**, **Start Meal Break**, **Start Rest Break**, **End Break**, **Clock Out**) with instant state transition and toast confirmation.
2. **Live Shift Manager Board**:
   - Displays all active shifts from `active_shifts` with a local 1-second ticker isolated inside the Time Clock component so the rest of the application never re-renders on timer ticks.
   - Highlights shifts approaching 5 hours without a meal break (`Amber`) or exceeding 8 hours (`Crimson`), and provides one-click **Force Clock-Out**, **Start/End Break**, and **Quick PIN Assignment** for staff members.
3. **Supabase Relational Migration & Schema Exporter**:
   - Provides an interactive **Relational Database & Supabase Migration** drawer/tab where you can copy the full PostgreSQL DDL + Supabase RLS script above, inspect table row counts across your live workspace (`employees`, `active_shifts`, `timecards`, `ingredients`, `invoices`, `recipes`, `consumption_logs`), and download a complete `.sql` seed file containing `INSERT INTO ...` statements generated from all of your existing records.
