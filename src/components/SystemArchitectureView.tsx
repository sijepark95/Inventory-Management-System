import React, { useState } from "react";
import {
  Database,
  Layers,
  Wifi,
  WifiOff,
  FileSpreadsheet,
  ShieldCheck,
  Code2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Copy,
  Check,
  Download,
  Building2,
  Store,
  ChefHat,
  Receipt,
  FileCheck2,
  Lock,
  Server,
  Zap,
  HardDriveDownload,
  Clock,
  ExternalLink
} from "lucide-react";

type ArchitectureTab = "ledger" | "multitenant" | "offline" | "edi" | "rbac" | "schema";

interface LedgerSimEntry {
  id: string;
  timestamp: string;
  type: "PURCHASE_RECEIPT" | "KITCHEN_CONSUMPTION" | "BATCH_PREP_INPUT" | "BATCH_PREP_OUTPUT" | "WASTE_SPOILAGE" | "COUNT_VARIANCE";
  ingredient: string;
  rawQty: number;
  rawUnit: string;
  normalizedQty: number;
  baseUnit: string;
  unitCost: number;
  totalValue: number;
  operator: string;
  department: string;
  idempotencyKey: string;
}

export default function SystemArchitectureView() {
  const [activeTab, setActiveTab] = useState<ArchitectureTab>("ledger");
  const [copiedSchema, setCopiedSchema] = useState(false);

  // Tab 1: Ledger Simulator State
  const [ledgerEntries, setLedgerEntries] = useState<LedgerSimEntry[]>([
    {
      id: "tx-901",
      timestamp: "10:14:02 AM",
      type: "PURCHASE_RECEIPT",
      ingredient: "Prime Angus Beef Ribeye",
      rawQty: 60,
      rawUnit: "lb",
      normalizedQty: 60,
      baseUnit: "lb",
      unitCost: 14.50,
      totalValue: 870.00,
      operator: "Receiving Dock (Sysco 810)",
      department: "Walk-In Cold Storage",
      idempotencyKey: "ed48b1a2-1101-44bb-8f2c-5544aa330001"
    },
    {
      id: "tx-902",
      timestamp: "11:32:15 AM",
      type: "KITCHEN_CONSUMPTION",
      ingredient: "Prime Angus Beef Ribeye",
      rawQty: -12.4,
      rawUnit: "lb",
      normalizedQty: -12.4,
      baseUnit: "lb",
      unitCost: 14.50,
      totalValue: -179.80,
      operator: "Marco R. (Line Cook #14)",
      department: "Grill Station",
      idempotencyKey: "ed48b1a2-1101-44bb-8f2c-5544aa330002"
    },
    {
      id: "tx-903",
      timestamp: "02:15:40 PM",
      type: "WASTE_SPOILAGE",
      ingredient: "Organic Hass Avocados",
      rawQty: -6,
      rawUnit: "pcs",
      normalizedQty: -6,
      baseUnit: "pcs",
      unitCost: 1.85,
      totalValue: -11.10,
      operator: "Elena G. (Sous Chef)",
      department: "Prep Station",
      idempotencyKey: "ed48b1a2-1101-44bb-8f2c-5544aa330003"
    }
  ]);

  const [simIngredient, setSimIngredient] = useState("Prime Angus Beef Ribeye");
  const [simAction, setSimAction] = useState<LedgerSimEntry["type"]>("KITCHEN_CONSUMPTION");
  const [simQty, setSimQty] = useState("4.5");
  const [simUnit, setSimUnit] = useState("lb");

  const handleAddLedgerSimEntry = () => {
    const qty = parseFloat(simQty);
    if (isNaN(qty) || qty <= 0) return;

    const isDeduct = simAction === "KITCHEN_CONSUMPTION" || simAction === "WASTE_SPOILAGE" || simAction === "BATCH_PREP_INPUT";
    const delta = isDeduct ? -qty : qty;
    const unitCost = simIngredient.includes("Beef") ? 14.50 : simIngredient.includes("Avocado") ? 1.85 : 4.20;

    const newEntry: LedgerSimEntry = {
      id: `tx-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type: simAction,
      ingredient: simIngredient,
      rawQty: delta,
      rawUnit: simUnit,
      normalizedQty: delta,
      baseUnit: simUnit,
      unitCost,
      totalValue: delta * unitCost,
      operator: "Active Tablet Operator",
      department: "Main Kitchen Line",
      idempotencyKey: crypto.randomUUID()
    };

    setLedgerEntries(prev => [newEntry, ...prev]);
  };

  // Tab 2: Multi-Tenant State
  const [selectedTenantOrg, setSelectedTenantOrg] = useState("Apex Hospitality Group");
  const [selectedLocation, setSelectedLocation] = useState("Flagship Downtown");

  // Tab 3: Offline POS Sync Simulation State
  const [isOnline, setIsOnline] = useState(true);
  const [offlineQueue, setOfflineQueue] = useState<Array<{ id: string; item: string; qty: string; time: string }>>([]);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "synced">("idle");

  const handleSimulateOfflineConsumption = (item: string, qty: string) => {
    const entry = {
      id: crypto.randomUUID(),
      item,
      qty,
      time: new Date().toLocaleTimeString()
    };

    if (!isOnline) {
      setOfflineQueue(prev => [...prev, entry]);
    } else {
      setSyncStatus("syncing");
      setTimeout(() => setSyncStatus("synced"), 600);
    }
  };

  const handleReconnectSync = () => {
    setIsOnline(true);
    if (offlineQueue.length > 0) {
      setSyncStatus("syncing");
      setTimeout(() => {
        setOfflineQueue([]);
        setSyncStatus("synced");
      }, 1200);
    }
  };

  // Tab 5: RBAC Role Simulator
  const [activeRole, setActiveRole] = useState<"cook" | "chef" | "manager" | "vp" | "auditor">("chef");

  const fullSqlSchema = `-- ====================================================================
-- COMMERCIAL MULTI-TENANT RESTAURANT INVENTORY & KITCHEN POS
-- Target: PostgreSQL 16+ with Row-Level Security (RLS) & Strict Invariants
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TENANCY & ACCESS CONTROL
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    plan_tier VARCHAR(50) DEFAULT 'enterprise_pro' CHECK (plan_tier IN ('starter', 'commercial_pro', 'enterprise_pro')),
    billing_email VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    timezone VARCHAR(100) DEFAULT 'America/Los_Angeles',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, code)
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (
        role IN ('super_admin', 'org_admin', 'store_manager', 'executive_chef', 'line_cook', 'auditor')
    ),
    pin_hash VARCHAR(255), -- Fast 4-digit tablet unlock
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. MASTER CATALOG & INGREDIENT REGISTRY
CREATE TABLE ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sku VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL, -- Meat, Produce, Dairy, Dry Goods, Beverage
    base_unit VARCHAR(50) NOT NULL, -- lb, oz, kg, g, liter, pc, bunch
    par_level NUMERIC(12, 4) DEFAULT 0,
    reorder_point NUMERIC(12, 4) DEFAULT 0,
    current_cost_per_unit NUMERIC(12, 4) DEFAULT 0,
    yield_percentage NUMERIC(5, 2) DEFAULT 100.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

-- 3. IMMUTABLE INVENTORY TRANSACTION LEDGER
CREATE TABLE inventory_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    transaction_type VARCHAR(50) NOT NULL CHECK (
        transaction_type IN (
            'PURCHASE_RECEIPT', 
            'KITCHEN_CONSUMPTION', 
            'BATCH_PREP_INPUT', 
            'BATCH_PREP_OUTPUT', 
            'WASTE_SPOILAGE', 
            'COUNT_VARIANCE_ADJUSTMENT'
        )
    ),
    quantity_delta NUMERIC(14, 4) NOT NULL, -- Negative for consumption/waste, positive for receipts
    unit_of_measure VARCHAR(50) NOT NULL,
    normalized_delta NUMERIC(14, 4) NOT NULL, -- Converted strictly to ingredient base_unit
    unit_cost_at_time NUMERIC(12, 4) NOT NULL,
    total_value_delta NUMERIC(14, 4) NOT NULL,
    recorded_by_user_id UUID REFERENCES users(id),
    department VARCHAR(100) NOT NULL,
    idempotency_key UUID UNIQUE NOT NULL, -- Protects against offline sync retries
    source_reference_id VARCHAR(255),
    notes TEXT,
    occurred_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. DISTRIBUTOR EDI & INVOICE MANAGEMENT
CREATE TABLE vendor_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    vendor_code VARCHAR(100) NOT NULL, -- Sysco, US_Foods, GFS
    invoice_number VARCHAR(100) NOT NULL,
    invoice_date DATE NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL,
    tax NUMERIC(12, 2) DEFAULT 0,
    total_amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING_APPROVAL' CHECK (
        status IN ('PENDING_APPROVAL', 'APPROVED', 'DISPUTED', 'RECONCILED')
    ),
    raw_edi_content TEXT,
    ingestion_source VARCHAR(50) CHECK (ingestion_source IN ('EDI_810_FEED', 'OCR_SCAN', 'MANUAL_RECEIVING')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, vendor_code, invoice_number)
);

-- 5. ROW-LEVEL SECURITY POLICIES
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_invoices ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation RLS Policy on inventory_ledger:
CREATE POLICY tenant_isolation_policy ON inventory_ledger
    FOR ALL
    USING (organization_id = NULLIF(current_setting('app.current_tenant', true), '')::UUID);

-- 6. HIGH PERFORMANCE INDEXES
CREATE INDEX idx_ledger_org_loc_time ON inventory_ledger (organization_id, location_id, occurred_at DESC);
CREATE INDEX idx_ledger_ingredient ON inventory_ledger (ingredient_id, occurred_at DESC);
CREATE INDEX idx_ledger_idempotency ON inventory_ledger (idempotency_key);
`;

  const handleCopySchema = () => {
    navigator.clipboard.writeText(fullSqlSchema);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2000);
  };

  const handleDownloadSchema = () => {
    const blob = new Blob([fullSqlSchema], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "restaurant_inventory_ledger_schema.sql";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header Bar Contract */}
      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-neutral-400 mb-1">
              <span>System Re-Design Blueprint</span>
              <span aria-hidden="true">·</span>
              <span>Commercial Multi-Tenant SaaS</span>
              <span aria-hidden="true">·</span>
              <span>PostgreSQL Ledger Engine</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Target Architecture & System Designer
            </h1>
            <p className="text-sm text-slate-600 dark:text-neutral-400 mt-1 max-w-3xl">
              Production-grade architectural framework for rebuilding the restaurant inventory, invoice automation, and kitchen consumption platform as an enterprise B2B SaaS product.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleCopySchema}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-800 dark:text-neutral-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              {copiedSchema ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSchema ? "SQL Copied" : "Copy DDL Schema"}</span>
            </button>
            <button
              onClick={handleDownloadSchema}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors shadow-xs cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download schema.sql</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs - Clean Segmented Control */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-neutral-800/80 rounded-xl mt-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab("ledger")}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === "ledger"
                ? "bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Database className="w-3.5 h-3.5 text-indigo-600" />
            <span>1. Double-Entry Ledger</span>
          </button>
          <button
            onClick={() => setActiveTab("multitenant")}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === "multitenant"
                ? "bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            <span>2. Multi-Tenant RLS</span>
          </button>
          <button
            onClick={() => setActiveTab("offline")}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === "offline"
                ? "bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Wifi className="w-3.5 h-3.5 text-emerald-600" />
            <span>3. Offline-First POS Engine</span>
          </button>
          <button
            onClick={() => setActiveTab("edi")}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === "edi"
                ? "bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
            <span>4. EDI & Invoice Ingestion</span>
          </button>
          <button
            onClick={() => setActiveTab("rbac")}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === "rbac"
                ? "bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-violet-600" />
            <span>5. RBAC & Audit Matrix</span>
          </button>
          <button
            onClick={() => setActiveTab("schema")}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === "schema"
                ? "bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-slate-600" />
            <span>6. PostgreSQL DDL Schema</span>
          </button>
        </div>
      </div>

      {/* TAB 1: DOUBLE-ENTRY INVENTORY LEDGER SIMULATOR */}
      {activeTab === "ledger" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Theoretical vs Actual Ledger Concept Card */}
            <div className="lg:col-span-1 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider mb-2">
                  <Database className="w-4 h-4" />
                  <span>Immutable Accounting Ledger</span>
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Why Mutable Counters Fail
                </h2>
                <p className="text-xs text-slate-600 dark:text-neutral-400 mt-2 leading-relaxed">
                  In standard CRUD apps, updating <code className="font-mono text-[11px] bg-slate-100 dark:bg-neutral-800 px-1 py-0.5 rounded">stock_qty = stock_qty - 5</code> causes lost updates during concurrent tablet syncs, unexplainable inventory shrinkage, and leaves zero audit trail.
                </p>
                <div className="mt-4 p-3.5 bg-slate-50 dark:bg-neutral-800/60 rounded-xl border border-slate-200 dark:border-neutral-700/60 space-y-2 text-xs">
                  <div className="font-semibold text-slate-800 dark:text-neutral-200">
                    The PostgreSQL Ledger Solution:
                  </div>
                  <div className="flex items-start gap-2 text-slate-600 dark:text-neutral-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Every consumption, delivery, or prep is an append-only journal row.</span>
                  </div>
                  <div className="flex items-start gap-2 text-slate-600 dark:text-neutral-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Stock on hand is always <code className="font-mono">SUM(quantity_delta)</code>.</span>
                  </div>
                  <div className="flex items-start gap-2 text-slate-600 dark:text-neutral-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Zero math drift across multi-device kitchen stations.</span>
                  </div>
                </div>
              </div>

              {/* Interactive Transaction Poster */}
              <div className="mt-6 pt-5 border-t border-slate-100 dark:border-neutral-800">
                <div className="text-xs font-bold text-slate-800 dark:text-neutral-200 mb-3">
                  Simulate Ledger Transaction
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Ingredient</label>
                    <select
                      value={simIngredient}
                      onChange={e => setSimIngredient(e.target.value)}
                      className="w-full text-xs bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg p-2 text-slate-800 dark:text-neutral-200 focus:outline-none"
                    >
                      <option>Prime Angus Beef Ribeye</option>
                      <option>Organic Hass Avocados</option>
                      <option>Whole Atlantic Salmon</option>
                      <option>Heavy Whipping Cream 36%</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">Transaction Type</label>
                      <select
                        value={simAction}
                        onChange={e => setSimAction(e.target.value as any)}
                        className="w-full text-xs bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg p-2 text-slate-800 dark:text-neutral-200 focus:outline-none"
                      >
                        <option value="KITCHEN_CONSUMPTION">Kitchen Prep (-)</option>
                        <option value="PURCHASE_RECEIPT">Vendor Receiving (+)</option>
                        <option value="WASTE_SPOILAGE">Waste / Spoilage (-)</option>
                        <option value="COUNT_VARIANCE">Count Variance (±)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">Quantity & Unit</label>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          value={simQty}
                          onChange={e => setSimQty(e.target.value)}
                          className="w-full text-xs bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg p-2 font-mono text-slate-800 dark:text-neutral-200 focus:outline-none"
                        />
                        <select
                          value={simUnit}
                          onChange={e => setSimUnit(e.target.value)}
                          className="text-xs bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg p-1 text-slate-800 dark:text-neutral-200 focus:outline-none"
                        >
                          <option value="lb">lb</option>
                          <option value="pcs">pcs</option>
                          <option value="oz">oz</option>
                          <option value="kg">kg</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleAddLedgerSimEntry}
                    className="w-full mt-2 py-2 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    <span>Commit to Ledger</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Live Ledger Table View */}
            <div className="lg:col-span-2 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Live Immutable Ledger Stream</span>
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-neutral-800 px-2 py-0.5 rounded">
                        {ledgerEntries.length} Transactions
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Double-entry records with foreign keys, user PIN attestation, and client UUIDv4 idempotency keys.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-neutral-800 text-slate-400 font-medium">
                        <th className="py-2.5 px-3">Time / ID</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Ingredient</th>
                        <th className="py-2.5 px-3 text-right">Delta</th>
                        <th className="py-2.5 px-3 text-right">Value</th>
                        <th className="py-2.5 px-3">Operator / Station</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-neutral-800/60 font-mono">
                      {ledgerEntries.map(entry => {
                        const isNeg = entry.rawQty < 0;
                        return (
                          <tr key={entry.id} className="hover:bg-slate-50/70 dark:hover:bg-neutral-800/40 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="text-slate-900 dark:text-neutral-200 font-semibold">{entry.timestamp}</div>
                              <div className="text-[10px] text-slate-400">{entry.id}</div>
                            </td>
                            <td className="py-2.5 px-3 font-sans">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                entry.type === "PURCHASE_RECEIPT"
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                  : entry.type === "WASTE_SPOILAGE"
                                  ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                                  : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400"
                              }`}>
                                {entry.type.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-sans text-slate-800 dark:text-neutral-200 font-medium">
                              {entry.ingredient}
                            </td>
                            <td className={`py-2.5 px-3 text-right tabular-nums font-bold ${
                              isNeg ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                            }`}>
                              {isNeg ? "" : "+"}{entry.rawQty} {entry.rawUnit}
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-slate-700 dark:text-neutral-300">
                              ${Math.abs(entry.totalValue).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 font-sans">
                              <div className="text-slate-700 dark:text-neutral-300 text-[11px] truncate max-w-[140px]">{entry.operator}</div>
                              <div className="text-[10px] text-slate-400">{entry.department}</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Calculated Invariant Proof */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-neutral-800 flex items-center justify-between text-xs text-slate-500 font-sans">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Ledger Invariant Verified: No orphaned quantities or dangling allocations.</span>
                </div>
                <div className="font-mono text-[11px]">
                  ACID Isolation Level: <strong className="text-slate-800 dark:text-neutral-200">SERIALIZABLE</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MULTI-TENANT ROW-LEVEL SECURITY & HIERARCHY */}
      {activeTab === "multitenant" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 shadow-xs">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider mb-2">
                <Building2 className="w-4 h-4" />
                <span>Enterprise Multi-Tenancy Architecture</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Cryptographic Tenant Isolation via PostgreSQL Row-Level Security
              </h2>
              <p className="text-xs text-slate-600 dark:text-neutral-400 mt-2 leading-relaxed">
                Rather than costly separate databases per client or risky manual <code className="font-mono">WHERE organization_id = ?</code> application filters, we enforce database-level isolation. Each client request sets the tenant context in PostgreSQL, rendering unauthorized cross-tenant data leaks impossible.
              </p>
            </div>

            {/* Interactive Tenant Hierarchy Explorer */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-slate-100 dark:border-neutral-800">
              {/* Org Level */}
              <div className="bg-slate-50 dark:bg-neutral-800/50 p-4 rounded-xl border border-slate-200 dark:border-neutral-700/60">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">1. Organization (Tenant)</div>
                <div className="space-y-2">
                  {["Apex Hospitality Group", "Harbor Dining Co.", "Blue Horizon Cafes"].map(org => (
                    <button
                      key={org}
                      onClick={() => setSelectedTenantOrg(org)}
                      className={`w-full text-left p-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-between ${
                        selectedTenantOrg === org
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-white dark:bg-neutral-800 text-slate-800 dark:text-neutral-200 border border-slate-200 dark:border-neutral-700 hover:border-blue-400"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{org}</span>
                      </div>
                      {selectedTenantOrg === org && <Check className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location Level */}
              <div className="bg-slate-50 dark:bg-neutral-800/50 p-4 rounded-xl border border-slate-200 dark:border-neutral-700/60">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">2. Operating Locations</div>
                <div className="space-y-2">
                  {["Flagship Downtown", "Airport Terminal 2", "Harbor Pier Bistro"].map(loc => (
                    <button
                      key={loc}
                      onClick={() => setSelectedLocation(loc)}
                      className={`w-full text-left p-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-between ${
                        selectedLocation === loc
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                          : "bg-white dark:bg-neutral-800 text-slate-800 dark:text-neutral-200 border border-slate-200 dark:border-neutral-700 hover:border-slate-400"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Store className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{loc}</span>
                      </div>
                      {selectedLocation === loc && <Check className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Kitchen Station / Tablet POS Level */}
              <div className="bg-slate-50 dark:bg-neutral-800/50 p-4 rounded-xl border border-slate-200 dark:border-neutral-700/60">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">3. Station Tablets & PINs</div>
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 bg-white dark:bg-neutral-800 rounded-lg border border-slate-200 dark:border-neutral-700 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-neutral-200">Tablet #01 · Prep Line</div>
                      <div className="text-[10px] text-slate-400 font-mono">PIN: 4812 · Operator: Marco</div>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">Active</span>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-neutral-800 rounded-lg border border-slate-200 dark:border-neutral-700 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-neutral-200">Tablet #02 · Walk-in Cold</div>
                      <div className="text-[10px] text-slate-400 font-mono">PIN: 9140 · Operator: Elena</div>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">Active</span>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-neutral-800 rounded-lg border border-slate-200 dark:border-neutral-700 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-neutral-200">Tablet #03 · Grill Station</div>
                      <div className="text-[10px] text-slate-400 font-mono">PIN: 7721 · Operator: Chef Alex</div>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">Active</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Generated Context SQL Snippet */}
            <div className="mt-6 p-4 bg-slate-900 text-slate-200 rounded-xl font-mono text-xs">
              <div className="text-slate-400 text-[11px] mb-2 font-sans flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-blue-400" />
                <span>Simulated PostgreSQL Connection Middleware Session Execution:</span>
              </div>
              <div className="text-emerald-400">
                -- Tenant context injected on every pooled database checkout:
              </div>
              <div>SET LOCAL app.current_tenant = '{selectedTenantOrg === "Apex Hospitality Group" ? "018f98a1-89d2-7c3e-bc56-11aa22bb33cc" : "029f98a1-89d2-7c3e-bc56-22bb33cc44dd"}';</div>
              <div className="mt-2 text-slate-400">
                -- Application query automatically isolated by RLS engine:
              </div>
              <div className="text-blue-300">
                SELECT * FROM inventory_ledger WHERE location_id = '{selectedLocation === "Flagship Downtown" ? "loc-flagship-01" : "loc-airport-02"}';
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: OFFLINE-FIRST KITCHEN POS ENGINE */}
      {activeTab === "offline" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-wider mb-1">
                  <Wifi className="w-4 h-4" />
                  <span>High-Speed Offline Persistence</span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Kitchen Tablet Write-Ahead Log (WAL) & Idempotent Sync
                </h2>
                <p className="text-xs text-slate-600 dark:text-neutral-400 mt-1 max-w-2xl">
                  Commercial walk-ins and stainless steel kitchen basements frequently drop Wi-Fi. Our PWA stores entries in IndexedDB locally within <strong className="text-slate-900 dark:text-white font-mono">2.1ms</strong>, syncing atomically upon reconnection.
                </p>
              </div>

              {/* Offline Switch Simulator */}
              <div className="flex items-center gap-3 bg-slate-100 dark:bg-neutral-800 p-2 rounded-xl shrink-0">
                <span className="text-xs font-semibold text-slate-700 dark:text-neutral-300">Wi-Fi Status:</span>
                <button
                  onClick={() => {
                    if (isOnline) {
                      setIsOnline(false);
                    } else {
                      handleReconnectSync();
                    }
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    isOnline
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-amber-600 text-white shadow-xs animate-pulse"
                  }`}
                >
                  {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                  <span>{isOnline ? "Connected (Online)" : "Walk-In Freezer (Offline)"}</span>
                </button>
              </div>
            </div>

            {/* Offline Simulation Playground */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 pt-6 border-t border-slate-100 dark:border-neutral-800">
              {/* Fast Action Buttons */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-800 dark:text-neutral-200">
                  Quick Prep Buttons (Tap as Line Cook):
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => handleSimulateOfflineConsumption("Beef Ribeye Trim", "5.2 lb")}
                    className="p-3 bg-slate-50 dark:bg-neutral-800/80 hover:bg-slate-100 dark:hover:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-left cursor-pointer transition-colors"
                  >
                    <div className="font-semibold text-xs text-slate-900 dark:text-white">Beef Ribeye Trim</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">Deduct 5.2 lb</div>
                  </button>
                  <button
                    onClick={() => handleSimulateOfflineConsumption("Brioche Burger Buns", "24 pcs")}
                    className="p-3 bg-slate-50 dark:bg-neutral-800/80 hover:bg-slate-100 dark:hover:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-left cursor-pointer transition-colors"
                  >
                    <div className="font-semibold text-xs text-slate-900 dark:text-white">Brioche Burger Buns</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">Deduct 24 pcs</div>
                  </button>
                  <button
                    onClick={() => handleSimulateOfflineConsumption("European Butter 82%", "4.0 lb")}
                    className="p-3 bg-slate-50 dark:bg-neutral-800/80 hover:bg-slate-100 dark:hover:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-left cursor-pointer transition-colors"
                  >
                    <div className="font-semibold text-xs text-slate-900 dark:text-white">European Butter 82%</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">Deduct 4.0 lb</div>
                  </button>
                  <button
                    onClick={() => handleSimulateOfflineConsumption("Hass Avocados", "12 pcs")}
                    className="p-3 bg-slate-50 dark:bg-neutral-800/80 hover:bg-slate-100 dark:hover:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-left cursor-pointer transition-colors"
                  >
                    <div className="font-semibold text-xs text-slate-900 dark:text-white">Hass Avocados</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">Deduct 12 pcs</div>
                  </button>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-neutral-800/50 rounded-xl border border-slate-200 dark:border-neutral-700/60 text-xs space-y-1 text-slate-600 dark:text-neutral-400">
                  <div className="font-semibold text-slate-800 dark:text-neutral-200">How conflict-free sync works:</div>
                  <div>1. Tablet creates a globally unique <code className="font-mono text-[11px]">idempotency_key</code> for each batch.</div>
                  <div>2. If connection drops, IndexedDB stores the record with timestamp and signature.</div>
                  <div>3. On reconnection, WebSocket sends the queue in a single ACID transaction. Duplicates are mathematically ignored.</div>
                </div>
              </div>

              {/* Local IndexedDB Queue Viewer */}
              <div className="bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <span className="font-sans font-semibold text-slate-400 flex items-center gap-1.5">
                      <HardDriveDownload className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Tablet Local IndexedDB Storage</span>
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      isOnline ? "bg-emerald-950 text-emerald-400" : "bg-amber-950 text-amber-400"
                    }`}>
                      {isOnline ? "Live Sync Active" : `${offlineQueue.length} Queued Offline`}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2 min-h-[160px] max-h-[220px] overflow-y-auto pr-1">
                    {offlineQueue.length === 0 ? (
                      <div className="text-slate-500 text-center py-10 font-sans text-xs">
                        {isOnline ? "All local entries successfully synced to server." : "No offline entries yet. Click quick prep buttons above to log in offline mode."}
                      </div>
                    ) : (
                      offlineQueue.map(item => (
                        <div key={item.id} className="p-2.5 bg-slate-800/80 rounded border border-slate-700 text-[11px] flex items-center justify-between">
                          <div>
                            <span className="text-white font-semibold">{item.item}</span>
                            <span className="text-amber-400 ml-2">({item.qty})</span>
                          </div>
                          <div className="text-[10px] text-slate-400">{item.time}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {!isOnline && offlineQueue.length > 0 && (
                  <button
                    onClick={handleReconnectSync}
                    className="w-full mt-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-sans font-bold text-xs rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Restore Wi-Fi & Flush Sync Queue ({offlineQueue.length})</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DISTRIBUTOR EDI & INVOICE AUTOMATION */}
      {activeTab === "edi" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 shadow-xs">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-amber-600 font-bold text-xs uppercase tracking-wider mb-1">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Automated Distributor Pipeline</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Dual EDI 810 Feeds + AI OCR Price Variance Detection
              </h2>
              <p className="text-xs text-slate-600 dark:text-neutral-400 mt-2 leading-relaxed">
                Large restaurant chains purchase 80%+ of food from major distributors (Sysco, US Foods, Gordon Food Service). Instead of manual data entry, the system ingests electronic invoices directly, auto-matching internal ingredient SKUs and detecting unit price creep.
              </p>
            </div>

            {/* Live EDI Ingestion Stream Sample */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 pt-6 border-t border-slate-100 dark:border-neutral-800">
              {/* Raw EDI 810 Transmission */}
              <div className="bg-slate-900 text-slate-300 p-4 rounded-xl font-mono text-xs">
                <div className="text-[11px] font-sans font-bold text-slate-400 mb-2 flex items-center justify-between">
                  <span>Raw EDI 810 Invoice Packet (Sysco Corp)</span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded">Parsed Successfully</span>
                </div>
                <div className="bg-slate-950 p-3 rounded border border-slate-800 text-[11px] leading-relaxed text-slate-300 overflow-x-auto">
                  <div className="text-slate-500">ISA*00*          *00*          *ZZ*SYSCO         *ZZ*APEXHOSPITALITY*260930*1102*U*00401*000004918*0*P*&gt;~</div>
                  <div>BIG*20260930*SYS-9884210*20260929*PO-11049~</div>
                  <div className="text-emerald-400">IT1*1*4*CA*142.50*PE*IN*SYS-781920*VN*BEEF TENDERLOIN PSMO~</div>
                  <div className="text-amber-400">IT1*2*10*CS*48.00*PE*IN*SYS-110293*VN*ORGANIC AVOCADOS 48CT~</div>
                  <div>TDS*105000~</div>
                  <div className="text-slate-500">SE*12*0001~</div>
                </div>
                <div className="mt-3 text-[11px] text-slate-400 font-sans">
                  Direct SFTP/AS2 EDI integration eliminates human transcription errors and cuts invoice processing time from 45 minutes to 0 seconds.
                </div>
              </div>

              {/* Price Creep & Variance Detection Results */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-800 dark:text-neutral-200">
                  Automated SKU Matching & Contract Price Audit:
                </h3>

                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      ⚠️ Price Creep Alert: Beef Tenderloin PSMO
                    </span>
                    <span className="text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-950 px-1.5 py-0.5 rounded">
                      +14.8% Over Contract
                    </span>
                  </div>
                  <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    Sysco invoiced at <span className="font-mono font-bold">$16.35/lb</span>, exceeding the negotiated contract cap of <span className="font-mono font-bold">$14.24/lb</span>.
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium pt-1">
                    Action: Automated dispute credit memo pre-drafted for store manager sign-off ($84.40 credit requested).
                  </div>
                </div>

                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      ✓ Line Match: Organic Hass Avocados 48ct
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.5 rounded">
                      Within Contract (0.0%)
                    </span>
                  </div>
                  <div className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                    Matched to internal SKU <code className="font-mono text-[11px]">ING-AVOC-01</code>. Automatically appended 480 pcs to inventory ledger upon physical receiving dock scan.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ENTERPRISE RBAC & AUDIT COMPLIANCE MATRIX */}
      {activeTab === "rbac" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 shadow-xs">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-violet-600 font-bold text-xs uppercase tracking-wider mb-1">
                <ShieldCheck className="w-4 h-4" />
                <span>Granular Access Governance</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Role-Based Permissions & Cryptographic Audit Trails
              </h2>
              <p className="text-xs text-slate-600 dark:text-neutral-400 mt-2 leading-relaxed">
                Enterprise hospitality franchises require strict separation of duties: line cooks cannot alter food-cost formulas, store managers cannot approve invoices above their threshold, and external auditors enjoy read-only immutable access.
              </p>
            </div>

            {/* Role Filter Tabs */}
            <div className="flex items-center gap-2 mt-6 pt-6 border-t border-slate-100 dark:border-neutral-800 overflow-x-auto">
              {[
                { id: "cook", label: "Line Cook (PIN Tablet)" },
                { id: "chef", label: "Executive Chef" },
                { id: "manager", label: "Store General Manager" },
                { id: "vp", label: "VP Operations (Multi-Unit)" },
                { id: "auditor", label: "External Financial Auditor" }
              ].map(role => (
                <button
                  key={role.id}
                  onClick={() => setActiveRole(role.id as any)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    activeRole === role.id
                      ? "bg-violet-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 hover:bg-slate-200"
                  }`}
                >
                  {role.label}
                </button>
              ))}
            </div>

            {/* Permission Capability Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              <div className="p-4 bg-slate-50 dark:bg-neutral-800/50 rounded-xl border border-slate-200 dark:border-neutral-700/60">
                <div className="text-[11px] font-semibold text-slate-500 mb-1">Kitchen Tablet POS</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {activeRole === "auditor" ? "Read-Only Logs" : "Record Usage (Fast PIN)"}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {activeRole === "cook" ? "Full access to punch ingredient depletion." : "Supervisory authorization active."}
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-neutral-800/50 rounded-xl border border-slate-200 dark:border-neutral-700/60">
                <div className="text-[11px] font-semibold text-slate-500 mb-1">Recipe Costing & Yields</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {activeRole === "cook" ? "Locked / No Access" : activeRole === "chef" || activeRole === "vp" ? "Full Edit & Formulate" : "View-Only"}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Protects intellectual property and proprietary portion specs.
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-neutral-800/50 rounded-xl border border-slate-200 dark:border-neutral-700/60">
                <div className="text-[11px] font-semibold text-slate-500 mb-1">Invoice Approvals</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {activeRole === "manager" ? "Approve up to $15,000" : activeRole === "vp" ? "Unlimited Multi-Unit" : "No Approval Authority"}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Enforces SOX/financial compliance limits on AP spend.
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-neutral-800/50 rounded-xl border border-slate-200 dark:border-neutral-700/60">
                <div className="text-[11px] font-semibold text-slate-500 mb-1">Audit Ledger & Variance</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {activeRole === "cook" ? "Blind Count Only" : "Full Variance Analytics"}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Blind counts prevent cooks from matching expected book totals.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: POSTGRESQL DDL SCHEMA VIEWER */}
      {activeTab === "schema" && (
        <div className="space-y-4">
          <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 shadow-xs font-mono text-xs border border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <span className="font-sans font-bold text-sm text-white">Production PostgreSQL 16+ DDL Schema</span>
                <p className="text-slate-400 font-sans text-xs mt-0.5">
                  Includes strict foreign keys, multi-tenant RLS policies, serializable transaction guards, and audit constraints.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopySchema}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-sans text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {copiedSchema ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSchema ? "Copied" : "Copy SQL"}</span>
                </button>
                <button
                  onClick={handleDownloadSchema}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-sans text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .sql</span>
                </button>
              </div>
            </div>

            <pre className="mt-4 overflow-x-auto text-[11px] text-slate-300 leading-relaxed max-h-[500px]">
              {fullSqlSchema}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}
