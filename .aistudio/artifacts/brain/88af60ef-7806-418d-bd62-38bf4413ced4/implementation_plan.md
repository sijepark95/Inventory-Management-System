# Industrial Products Hub & AI Document Parser Routing

This update transforms the **Grocery** tab under **Food Cost Overview** into a dedicated **Industrial Products** management hub (tracking catalog items, unit prices, on-hand stock, and purchase history for non-food supplies) and adds **Ingredient vs. Industrial Product** classification in the **AI Document Parser** while keeping all existing culinary ingredient workflows completely untouched.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Zero Modification to Existing Ingredient Logic**: All existing culinary ingredient parsing, package size registration, stock updates, and recipe cost calculations remain 100% unchanged. Items classified as **Ingredient** in AI Document Parser will continue to use the exact same pipeline as before.

- **Confirmed Decision 1 — AI Document Parser Selection**: **Document-level toggle with per-item override**. Each parsed invoice has a top-level switch (**Ingredient** vs. **Industrial Products**) that sets all rows at once, plus a per-row selector so mixed invoices (e.g., food + paper goods/cleaning supplies on the same Sysco or Restaurant Depot bill) can route each line item to its proper destination.
- **Confirmed Decision 2 — Industrial Products Tab Layout**: **Catalog table with price, stock, and purchase history**. The **Industrial Products** tab features a master catalog table (Item Name, Category, Vendor, Unit/Pack Size, Price, On-Hand Stock, Min Stock, Edit/Delete) alongside Purchase History logs and a Restock List.
- **Confirmed Decision 3 — Invoices & Report Center Sync**: **Store in Industrial Products and also log in Invoices and Report Center**. Applying an invoice with Industrial Products updates the Industrial Products catalog and purchase ledger while still recording the invoice document in **Invoices** and **Report Center**.

---

## 1. Overview & Core Concept

- **What It Does**: Separates non-food operational supplies (packaging, takeout containers, gloves, cleaning chemicals, paper goods, kitchen smallwares) from culinary ingredients. Users can classify documents or individual line items in the AI Document Parser as either **Ingredient** or **Industrial Product**, automatically routing them to the respective tab.
- **Target Audience / Persona**: Restaurant owners, kitchen managers, and purchasing operators auditing both food costs and industrial/operational supply costs.
- **Key Value**: Prevents non-food supplies from cluttering the culinary ingredient catalog and recipe cost sheets while providing full price tracking, stock management, and invoice auditing for industrial products.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Navigation**: Under **Food Cost Overview** (in the desktop sidebar, mobile drawer, and Food Cost horizontal tab bar), the tab previously labeled **Grocery** is now labeled **Industrial Products**.
  2. **AI Document Parser Classification**:
     - In the Active Document header bar, a clear segmented toggle lets the user choose the default classification for the invoice: **Ingredients (Culinary)** or **Industrial Products (Supplies)**. Switching the document toggle updates all line items in that document.
     - In the line-item review table, each row includes a compact **Item Type** selector (**Ingredient** | **Industrial**) so the user can override individual lines on mixed invoices.
     - For rows set to **Industrial**, the target match dropdown searches existing **Industrial Products** (instead of culinary ingredients) and offersindustrial categories (`Packaging & Containers`, `Paper & Disposables`, `Cleaning & Chemicals`, `Gloves & Safety`, `Kitchen Smallwares`, `Equipment & Maintenance`, `Other Industrial`).
  3. **Applying the Document**:
     - Line items marked **Ingredient** execute the existing, untouched ingredient creation/mapping and stock intake logic.
     - Line items marked **Industrial** create or update entries in the **Industrial Products** catalog (updating unit price, vendor, and on-hand stock) and append a purchase log entry in the Industrial Products Purchase History.
     - The invoice document itself is saved to the **Invoices** collection and appears in **Report Center**.
  4. **Industrial Products Tab (`Food Cost -> Industrial Products`)**:
     - **Summary KPI Strip**: Total Industrial Catalog Items, Total On-Hand Stock Value ($), Cumulative Industrial Spend ($), and Low Stock Alerts.
     - **Sub-Tab 1: Product Catalog & Stock Ledger (Default)**: Searchable, filterable table displaying each industrial product's Name, Category, Supplier/Vendor, Pack/Unit, Latest Price ($), Unit Rate, On-Hand Stock, Status, and quick actions to Add, Edit, Adjust Stock, or Delete.
     - **Sub-Tab 2: Purchase History & Invoices**: Chronological log of all industrial product purchases and invoices applied via AI Document Parser or manual entry.
     - **Sub-Tab 3: Restock & Shopping List**: Checklist for flagging low-stock industrial supplies to reorder.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: High-density enterprise SaaS ledger matching the existing application design system.
  - *Color Palette & Mood*: Crisp white (`#FFFFFF`) and warm neutral (`#F8F7F4`) surfaces, structural hairline borders (`border-neutral-200`), emerald (`#059669`) for culinary ingredients, and slate/blue (`#2563EB` / `#0F172A`) accents to visually distinguish **Industrial Products** from culinary ingredients.
  - *Typography & Hierarchy*: Clean sans-serif UI headings paired with strict monospace tabular numerals (`font-mono tabular-nums`) for all quantities, unit prices, stock counts, and invoice totals.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Strict Isolation of Ingredient Pipeline**
  - *Chosen Approach*: Keep the existing `ingredients` collection and `handleApplyParsedItems` culinary loop untouched for `itemType === "ingredient"`, and branch `itemType === "industrial"` items into a dedicated handler that writes to the Industrial Products state/storage and `groceryPurchases` / industrial catalog records.
  - *Why*: Guarantees zero regressions in culinary inventory, pack size conversions, and recipe cost sheets.
- **Decision 2: Dual-Level Classification (Document Toggle + Row Override)**
  - *Chosen Approach*: Add `targetCatalogType?: "ingredient" | "industrial"` on both `QueueItem` (document-level) and `ParsedInvoiceItem` (row-level).
  - *Why*: Dedicated supply invoices (e.g., Uline, WebstaurantStore) can be switched with a single click at the document level, while mixed wholesale invoices (e.g., Sysco, Restaurant Depot) can have individual paper/chemical rows flipped to Industrial without splitting the invoice.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AI Document Parser                              │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Document Header Toggle: [ Ingredients ] vs [ Industrial Products ]│  │
│  └───────────────┬───────────────────────────────────┬───────────────┘  │
│                  │ (Sets default for all items)      │                  │
│                  ▼                                   ▼                  │
│  ┌───────────────────────────────┐   ┌───────────────────────────────┐  │
│  │ Line Item: Type = Ingredient  │   │ Line Item: Type = Industrial  │  │
│  │ (Untouched Culinary Pipeline) │   │ (Industrial Supply Pipeline)  │  │
│  └───────────────┬───────────────┘   └───────────────┬───────────────┘  │
└──────────────────┼───────────────────────────────────┼──────────────────┘
                   │                                   │
                   ▼                                   ▼
   ┌───────────────────────────────┐   ┌───────────────────────────────┐
   │ Culinary Ingredients & Stock  │   │   Industrial Products Tab     │
   │  - Master Ingredient Prices   │   │  - Industrial Catalog & Stock │
   │  - Inventory Ledger           │   │  - Purchase History Log       │
   │  - Culinary Cost Sheets       │   │  - Restock Checklist          │
   └───────────────┬───────────────┘   └───────────────┬───────────────┘
                   │                                   │
                   └─────────────────┬─────────────────┘
                                     ▼
                   ┌───────────────────────────────────┐
                   │   Invoices & Report Center View   │
                   │  (Unified Invoice & Spend Audit)  │
                   └───────────────────────────────────┘
```

### Data Model & State
- **Industrial Product Item (`IndustrialProduct`)**:
  - Stored with fields: `id`, `name`, `category` (Packaging, Disposables, Cleaning & Chemicals, Smallwares, Safety, Other), `vendor`, `price` (latest pack price), `quantity` (pack quantity), `unit` (case, box, pack, roll, gallon, pcs, etc.), `inStock` (current stock count), `minStock` (reorder alert threshold), `source` (Invoice reference or manual), `invoiceAliases`, `ownerId`, and `updatedAt`.
- **Parsed Invoice Item Extension**:
  - Adds optional `itemTargetType?: "ingredient" | "industrial"` and `targetIndustrialId?: string` on `ParsedInvoiceItem`, plus `defaultTargetType?: "ingredient" | "industrial"` on `QueueItem`.
- **Interactive Component & State Mapping**:
  - Toggling the document-level switch in `AIParserView` updates `defaultTargetType` on the active `QueueItem` and sets `itemTargetType` across all its `items`, automatically re-matching each item against either `existingIngredients` or `industrialProducts`.
  - Changing a single row's type selector updates only that row's `itemTargetType` and re-runs catalog matching for that row.
  - Clicking **Apply Document** partitions selected items by `itemTargetType`:
    - `ingredient` items run through the existing ingredient handler untouched.
    - `industrial` items create or update catalog items in the Industrial Products store (incrementing `inStock` unless price-correction-only mode is active) and record a purchase entry in the Industrial Products Purchase History, while all applied items are recorded on the saved `Invoice` for `Invoices` and `Report Center`.
