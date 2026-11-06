export interface Department {
  id?: string;
  name: string;
  description?: string;
  restaurantId?: string;
  ownerId: string;
  createdAt?: string;
}

export interface Restaurant {
  id?: string;
  name: string;
  address?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  ownerId: string;
  createdAt?: string;
}

export interface Vendor {
  id?: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  note?: string;
  ownerId: string;
  createdAt?: string;
  isRegistered?: boolean;
  itemsSupplied?: number;
  orderTemplate?: OrderListItem[];
}

export interface Ingredient {
  id?: string;
  name: string;
  price: number;       // total package price (e.g. $15.50)
  quantity: number;    // package quantity amount (e.g. 1000)
  unit: string;        // package unit (g, kg, ml, L, oz, lb, pcs etc.)
  pricePerGram: number; // calculated standard cost per unit mass/volume (usually per gram or per ml/pcs)
  source: string;      // e.g. "Invoice #1023", "Manual", "Excel parsed"
  ownerId: string;
  updatedAt: string;
  weightPerCase?: number;       // Weight/volume per single unit/case (optional)
  weightPerCaseUnit?: string;   // Unit for weight/volume per unit/case (optional)
  pcsPerPound?: number;
  packagingUnit?: string;         // Pieces per pound for piece-to-pound conversion (optional)
  conversions?: { ratio: number; targetUnit: string }[];
  usabilityPercentage?: number; // Usability / yield percentage (1-100, scale 1-100, defaults to 100 if undefined)
  vendor?: string;              // explicit vendor name (e.g., "Sysco")
  inStock?: number;             // current physical stock quantity (in packages/units)
  minStock?: number;            // minimum stock quantity alerts (in packages/units)
  location?: string;            // storage location (e.g. "Walk-In Cooler", "Dry Storage")
  isHiddenFromInventory?: boolean; // soft-delete flag for inventory ledger
  category?: string;            // e.g. "Beef", "Pork", "Vegetables", "Dairy & Eggs", etc.
  type?: string;                // Specific food type (Beef, Pork, Poultry, Seafood, Vegetables, etc.)
  foodType?: string;            // Alias for type
  invoiceAliases?: string[];    // Invoice item names mapped to this ingredient in the Naming Match Table
  baseUnit?: string;            // Standard base unit ("lb", "oz", "pc", etc.)
}

export type { IngredientType } from "./lib/foodTypeUtils";
export { INGREDIENT_TYPES } from "./lib/foodTypeUtils";

export interface RecipeIngredientRef {
  ingredientId: string;
  name: string;
  grams: number;       // amount of ingredient required in grams/ml/units, or portion count if sub-recipe
  isSubRecipe?: boolean; // flag indicating if this item is a sub-recipe / nested menu
  subRecipeId?: string;  // reference ID to sub-recipe if applicable
  currentRate?: number;  // unit cost rate for instant calculation
}

export interface Recipe {
  id?: string;
  name: string;
  ingredients: RecipeIngredientRef[];
  sellingPrice: number;   // selling price of complete recipe or portion
  expectedYield: number; // expected portions/servings made
  costPerPortion: number; // dynamically calculated standard portion cost
  costPerServing?: number; // alias for costPerPortion
  totalCost: number;      // total raw ingredient cost
  profitMargin: number;   // calculated margin %
  department?: string;    // department (e.g. Kitchen, Bar, Bakery, Pastry)
  order?: number;         // custom display order
  ownerId: string;
  updatedAt: string;
}

export interface ParsedInvoiceItem {
  name: string;
  unit: string;
  baseUnit?: "lb" | "pc" | "oz"; // Strictly "lb", "pc", or "oz"
  quantity: number;
  totalPrice: number;
  pricePerUnit: number;
  // UI interaction mapping fields
  matchAction?: "create" | "map" | "skip";
  targetIngredientId?: string; // If mapping to existing
  weightPerCase?: number;
  weightPerCaseUnit?: string;
  pcsPerPound?: number;
  packagingUnit?: string;
  conversions?: { ratio: number; targetUnit: string }[];
  usabilityPercentage?: number; // Usability / yield percentage (1-100, scale 1-100)
  originalDocUnit?: string; // Document unit as read from invoice/file (e.g. "case" or "")
  unitMatchedToPackSize?: boolean; // True if unit was auto-synced to registered pack size
  needsPackSizeRegistration?: boolean; // True if ingredient or line item has no pack size registered
  registeredPackSize?: string; // The registered pack size name (e.g. "Box")
  matchedViaAlias?: boolean; // True if matched via the Invoice Naming Match Table
  category?: string; // Selected food category (e.g. "Meat", "Seafood", "Vegetables", "Fruit", "Dairy", "Bread", "Dry Goods", "Sauces & Condiments", "Beverages", "Packaging & Supplies", "Other")
  aiRecommendedCategory?: string; // AI-recommended food category for this item
  itemTargetType?: "ingredient" | "industrial"; // Target destination: culinary ingredient vs industrial product
  targetIndustrialId?: string; // If mapping to an existing industrial product
}

export interface IndustrialProduct {
  id?: string;
  name: string;
  category: string;     // e.g. "Packaging & Containers", "Paper & Disposables", "Cleaning & Chemicals", "Gloves & Safety", "Kitchen Smallwares", "Equipment & Maintenance", "Other Industrial"
  vendor?: string;
  price: number;        // Pack / purchase price ($)
  quantity: number;     // Total base units (pc) or pack quantity
  unit: string;         // Base unit ("pc" by default) or pack unit
  baseUnit?: "pc" | "lb" | "oz"; // Default "pc" for industrial products
  packagingUnit?: string;        // e.g. "Case", "Box", "Pack", "Bag", "Roll"
  pcsPerPack?: number;           // e.g. 1000 pc per Case
  pcsPerPound?: number;          // Compatibility alias for pc ratio
  registeredPackSize?: string;   // e.g. "1000pc per case"
  conversions?: { ratio: number; targetUnit: string }[]; // Additional pack sizes
  unitPrice?: number;   // Calculated price per base unit (pc) or pack
  inStock?: number;     // Current physical stock count (in pc or pack)
  minStock?: number;    // Minimum stock alert threshold
  location?: string;    // Storage location (e.g. "Supply Closet", "Dry Storage", "Packaging Station")
  source?: string;      // e.g. "Invoice #1023", "Manual Entry"
  notes?: string;
  ownerId: string;
  updatedAt: string;
}

export interface Invoice {
  id?: string;
  fileName: string;
  invoiceNumber?: string;
  vendor?: string;
  vendorName?: string;
  issueDate?: string;
  dueDate?: string;
  items: ParsedInvoiceItem[];
  status: "pending_review" | "applied" | "paid" | "unpaid" | "overdue" | "void";
  totalAmount?: number;
  notes?: string;
  fileUrl?: string;     // Base64 data URL or storage link to the saved document/image
  fileType?: string;    // MIME type (image/jpeg, application/pdf, etc.)
  fileSize?: number;    // File size in bytes
  ownerId: string;
  createdAt: string;
  type?: string;
  invoiceType?: "ingredient" | "industrial" | "mixed";
}

export interface Timecard {
  id?: string;
  employeeName: string;
  employeeCode?: string;
  date: string;
  clockIn: string;
  clockOut: string;
  totalHours: number;
  unpaidBreakMinutes: number;
  paidHours: number;
  isAutoClockOut: boolean;
  isOver8PM: boolean;
  anomalies: string[];
  ownerId: string;
  createdAt?: string;
  job?: string;              // parsed or manual job department
}

export interface ShiftBreakInterval {
  id: string;
  type: "meal_unpaid" | "rest_paid";
  startedAtIso: string;
  endedAtIso: string;
  durationMinutes: number;
}

export interface ActiveShift {
  id?: string;
  employeeId: string;
  employeeName: string;
  employeeCode?: string;
  pin?: string;
  role: string;
  dept?: string;
  hourlyRate: number;
  date: string; // YYYY-MM-DD
  clockInIso: string;
  clockInFormatted: string;
  status: "clocked_in" | "on_break";
  currentBreakStartIso?: string | null;
  currentBreakType?: "meal_unpaid" | "rest_paid" | null;
  accumulatedUnpaidBreakMinutes: number;
  accumulatedPaidBreakMinutes: number;
  breakHistory?: ShiftBreakInterval[];
  notes?: string;
  ownerId: string;
  createdAt?: string;
}

export interface Employee {
  id?: string;
  name: string;
  employeeCode?: string;      // custom employee ID (Employee ID)
  pin?: string;               // 4-digit PIN for Time Clock check-in/out
  dept?: string;              // Dept
  dateHired?: string;         // Date Hired
  dateTerminated?: string;    // Date Terminated
  hourlyRate: number;         // standard hourly rate (Reg Rate)
  otRate?: number;            // OT Rate
  taxStatus?: string;         // Tax Status (e.g. "Single", "Married")
  taxableIncome?: number;     // Taxable Income
  taxesWithheld?: number;     // Taxes Withheld
  insuranceDeduction?: number; // Insurance Deduction
  taxesWithheld2?: number;    // Taxes Withheld 2
  checkAmount?: number;       // Check Amount
  mbExempt?: boolean;         // M & B Exempt / Meals & Beverage Exempt
  tipped?: boolean;           // Tipped
  isSalary?: boolean;         // Is salaried employee
  salaryAmount?: number;      // Salary amount (if applicable)
  payAmount?: number;         // Pay Amount
  actualCashPay?: number;     // Actual Cash Pay
  sickDayEligible?: boolean;  // Sick day eligible
  phoneNo?: string;           // Phone No
  address?: string;           // Address
  note?: string;              // Note
  role: string;               // e.g., "Line Cook", "Server"
  ownerId: string;
  createdAt?: string;
}

export interface DailySale {
  id?: string;
  date: string;          // format: YYYY-MM-DD
  recipeId: string;
  recipeName: string;
  quantitySold: number;
  sellingPrice: number;
  costPerPortion: number;
  totalRevenue: number;
  totalCost: number;
  margin: number;
  ownerId: string;
  createdAt?: string;
}

export interface ConsumptionLog {
  id?: string;
  date: string;          // consumption date
  vendorName: string;    // selected or custom vendor
  ingredientId: string;  // ID of ingredient
  ingredientName: string;// name of ingredient
  quantity: number;      // quantity consumed
  unit: string;          // unit
  pricePerPack: number;  // cost per pack
  totalCost: number;     // total consumption cost
  recordedBy: string;    // recorded by name
  ownerId: string;       // workspace identifier
  createdAt: string;     // ISO timestamp
  signatureBase64?: string; // canvas draw signature image in base64 string
  operatorName?: string;   // typed operator name for sign-off
}

export type InventoryConsumptionLog = ConsumptionLog;

export interface InventoryCountSheet {
  id?: string;
  date: string;
  totalValue?: number;
  totalPounds?: number;
  totalItemsCount?: number;
  lowStockCount?: number;
  vendorFilter?: string;
  items?: Array<{
    id?: string;
    name?: string;
    currentCount?: number;
    unit?: string;
    price?: number;
    totalValue?: number;
  }>;
  itemsJson?: string;
  ownerId: string;
  createdAt?: string;
}

export interface GroceryPurchaseItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  price: number;              // total line cost
  unitPrice?: number;         // unit cost (price / quantity)
  category?: string;          // Produce, Dairy, Meat, Dry Goods, Beverages, Bakery, Supplies, Other
  linkedIngredientId?: string;// ID of matching master ingredient
  notes?: string;
}

export interface GroceryPurchase {
  id?: string;
  date: string;               // YYYY-MM-DD
  storeName: string;          // e.g., Costco, Trader Joe's, Local Market, Whole Foods, H Mart, Restaurant Depot
  totalAmount: number;
  paymentMethod: "Company Card" | "Petty Cash" | "Personal Reimbursement" | "Debit / Cash" | "Other";
  purchaserName?: string;
  receiptNumber?: string;
  notes?: string;
  items: GroceryPurchaseItem[];
  ownerId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GroceryShoppingItem {
  id?: string;
  name: string;
  quantity: number;
  unit: string;
  category?: string;
  storePreferred?: string;
  estimatedCost?: number;
  isChecked?: boolean;
  linkedIngredientId?: string;
  notes?: string;
  ownerId: string;
  createdAt?: string;
}

export interface OrderListItem {
  ingredientId?: string;
  name: string;
  quantity: number;
  unit: string;
  estimatedPrice?: number;
  notes?: string;
}

export interface OrderList {
  id?: string;
  vendorId?: string;
  vendorName: string;
  status: "draft" | "ordered" | "received" | "cancelled";
  items: OrderListItem[];
  totalEstimatedCost?: number;
  expectedDeliveryDate?: string;
  notes?: string;
  ownerId: string;
  createdAt?: string;
  updatedAt?: string;
}
