import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

// ============================================================================
// 1. USERS (Firebase Auth Link)
// ============================================================================
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  restaurants: many(restaurants),
  departments: many(departments),
  employees: many(employees),
  activeShifts: many(activeShifts),
  timecards: many(timecards),
  vendors: many(vendors),
  ingredients: many(ingredients),
  invoices: many(invoices),
  recipes: many(recipes),
  dailySales: many(dailySales),
}));

// ============================================================================
// 2. RESTAURANTS & DEPARTMENTS
// ============================================================================
export const restaurants = pgTable('restaurants', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address'),
  contactName: varchar('contact_name', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const departments = pgTable('departments', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  restaurantId: text('restaurant_id'),
  name: varchar('name', { length: 120 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// 3. EMPLOYEES & TIME MANAGEMENT (CHECK-IN / CHECK-OUT / SHIFTS)
// ============================================================================
export const employees = pgTable('employees', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  departmentId: text('department_id'),
  employeeCode: varchar('employee_code', { length: 50 }),
  pinCode: varchar('pin_code', { length: 12 }),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 120 }).default('Staff'),
  deptName: varchar('dept_name', { length: 120 }).default('Kitchen'),
  hourlyRate: numeric('hourly_rate', { precision: 10, scale: 2 }).notNull().default('18.00'),
  otRate: numeric('ot_rate', { precision: 10, scale: 2 }),
  isSalary: boolean('is_salary').notNull().default(false),
  salaryAmount: numeric('salary_amount', { precision: 12, scale: 2 }).default('0'),
  mbExempt: boolean('mb_exempt').notNull().default(false),
  tipped: boolean('tipped').notNull().default(false),
  sickDayEligible: boolean('sick_day_eligible').notNull().default(false),
  taxStatus: varchar('tax_status', { length: 50 }),
  phoneNo: varchar('phone_no', { length: 50 }),
  address: text('address'),
  dateHired: text('date_hired'),
  dateTerminated: text('date_terminated'),
  note: text('note'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const activeShifts = pgTable('active_shifts', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  employeeId: text('employee_id').notNull(),
  employeeName: varchar('employee_name', { length: 255 }).notNull(),
  employeeCode: varchar('employee_code', { length: 50 }),
  role: varchar('role', { length: 120 }).notNull(),
  dept: varchar('dept', { length: 120 }),
  hourlyRate: numeric('hourly_rate', { precision: 10, scale: 2 }).notNull(),
  shiftDate: text('shift_date').notNull(),
  clockInAt: timestamp('clock_in_at').notNull().defaultNow(),
  status: varchar('status', { length: 30 }).notNull().default('clocked_in'),
  currentBreakStartAt: timestamp('current_break_start_at'),
  currentBreakType: varchar('current_break_type', { length: 30 }),
  accumulatedUnpaidBreakMinutes: integer('accumulated_unpaid_break_minutes').notNull().default(0),
  accumulatedPaidBreakMinutes: integer('accumulated_paid_break_minutes').notNull().default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const timecards = pgTable('timecards', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  employeeId: text('employee_id'),
  employeeName: varchar('employee_name', { length: 255 }).notNull(),
  employeeCode: varchar('employee_code', { length: 50 }),
  job: varchar('job', { length: 120 }),
  shiftDate: text('shift_date').notNull(),
  clockInFormatted: varchar('clock_in_formatted', { length: 30 }).notNull(),
  clockOutFormatted: varchar('clock_out_formatted', { length: 30 }).notNull(),
  clockInAt: timestamp('clock_in_at'),
  clockOutAt: timestamp('clock_out_at'),
  totalHours: numeric('total_hours', { precision: 8, scale: 2 }).notNull().default('0'),
  unpaidBreakMinutes: integer('unpaid_break_minutes').notNull().default(0),
  paidHours: numeric('paid_hours', { precision: 8, scale: 2 }).notNull().default('0'),
  regularHours: numeric('regular_hours', { precision: 8, scale: 2 }).notNull().default('0'),
  overtimeHours: numeric('overtime_hours', { precision: 8, scale: 2 }).notNull().default('0'),
  hourlyRateSnapshot: numeric('hourly_rate_snapshot', { precision: 10, scale: 2 }),
  isAutoClockOut: boolean('is_auto_clock_out').notNull().default(false),
  isOver8pm: boolean('is_over_8pm').notNull().default(false),
  anomalies: text('anomalies'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const shiftBreaks = pgTable('shift_breaks', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  activeShiftId: text('active_shift_id'),
  timecardId: text('timecard_id'),
  employeeId: text('employee_id').notNull(),
  breakType: varchar('break_type', { length: 30 }).notNull(),
  startedAt: timestamp('started_at').notNull(),
  endedAt: timestamp('ended_at'),
  durationMinutes: integer('duration_minutes').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// 4. VENDORS & MASTER INGREDIENTS
// ============================================================================
export const vendors = pgTable('vendors', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  normalizedKey: varchar('normalized_key', { length: 255 }).notNull(),
  contactName: varchar('contact_name', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  address: text('address'),
  note: text('note'),
  isRegistered: boolean('is_registered').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const ingredients = pgTable('ingredients', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  vendorId: text('vendor_id'),
  vendorName: varchar('vendor_name', { length: 255 }),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }).default('General'),
  packagingUnit: varchar('packaging_unit', { length: 50 }),
  baseUnit: varchar('base_unit', { length: 20 }).default('lb'),
  price: numeric('price', { precision: 12, scale: 4 }).notNull().default('0'),
  quantity: numeric('quantity', { precision: 12, scale: 4 }).notNull().default('1'),
  unit: varchar('unit', { length: 50 }).notNull(),
  pricePerGram: numeric('price_per_gram', { precision: 14, scale: 6 }).notNull().default('0'),
  weightPerCase: numeric('weight_per_case', { precision: 12, scale: 4 }),
  weightPerCaseUnit: varchar('weight_per_case_unit', { length: 50 }),
  pcsPerPound: numeric('pcs_per_pound', { precision: 12, scale: 4 }),
  conversions: text('conversions'),
  invoiceAliases: text('invoice_aliases'),
  usabilityPercentage: numeric('usability_percentage', { precision: 5, scale: 2 }).notNull().default('100.00'),
  inStock: numeric('in_stock', { precision: 12, scale: 4 }).notNull().default('0'),
  minStock: numeric('min_stock', { precision: 12, scale: 4 }).notNull().default('0'),
  location: varchar('location', { length: 120 }),
  source: varchar('source', { length: 255 }),
  isHiddenFromInventory: boolean('is_hidden_from_inventory').notNull().default(false),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// 5. INVOICES & INVOICE ITEMS
// ============================================================================
export const invoices = pgTable('invoices', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  vendorId: text('vendor_id'),
  vendorName: varchar('vendor_name', { length: 255 }),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  invoiceNumber: varchar('invoice_number', { length: 100 }),
  issueDate: text('issue_date'),
  dueDate: text('due_date'),
  type: varchar('type', { length: 50 }).default('standard_invoice'),
  status: varchar('status', { length: 50 }).notNull().default('pending_review'),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).default('0'),
  notes: text('notes'),
  fileUrl: text('file_url'),
  fileType: varchar('file_type', { length: 100 }),
  fileSize: integer('file_size'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const invoiceItems = pgTable('invoice_items', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull(),
  ownerId: text('owner_id').notNull(),
  targetIngredientId: text('target_ingredient_id'),
  name: varchar('name', { length: 255 }).notNull(),
  quantity: numeric('quantity', { precision: 12, scale: 4 }).notNull().default('1'),
  unit: varchar('unit', { length: 50 }).notNull(),
  baseUnit: varchar('base_unit', { length: 20 }).default('lb'),
  packagingUnit: varchar('packaging_unit', { length: 50 }),
  originalDocUnit: varchar('original_doc_unit', { length: 50 }),
  registeredPackSize: varchar('registered_pack_size', { length: 50 }),
  unitMatchedToPackSize: boolean('unit_matched_to_pack_size').notNull().default(false),
  pricePerUnit: numeric('price_per_unit', { precision: 12, scale: 4 }).notNull().default('0'),
  totalPrice: numeric('total_price', { precision: 12, scale: 2 }).notNull().default('0'),
  matchAction: varchar('match_action', { length: 20 }).default('create'),
  weightPerCase: numeric('weight_per_case', { precision: 12, scale: 4 }),
  weightPerCaseUnit: varchar('weight_per_case_unit', { length: 50 }),
  pcsPerPound: numeric('pcs_per_pound', { precision: 12, scale: 4 }),
  conversions: text('conversions'),
  usabilityPercentage: numeric('usability_percentage', { precision: 5, scale: 2 }).default('100.00'),
});

// ============================================================================
// 6. INVENTORY COUNTS (Historical Stocktakes)
// ============================================================================
export const inventoryCounts = pgTable('inventory_counts', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  date: text('date').notNull(),
  totalValue: numeric('total_value', { precision: 12, scale: 2 }).default('0'),
  totalPounds: numeric('total_pounds', { precision: 12, scale: 2 }).default('0'),
  totalItemsCount: integer('total_items_count').default(0),
  lowStockCount: integer('low_stock_count').default(0),
  vendorFilter: varchar('vendor_filter', { length: 255 }),
  itemsJson: text('items_json').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// 7. CONSUMPTION LOGS, RECIPES & SALES
// ============================================================================
export const consumptionLogs = pgTable('consumption_logs', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  ingredientId: text('ingredient_id'),
  ingredientName: varchar('ingredient_name', { length: 255 }).notNull(),
  vendorName: varchar('vendor_name', { length: 255 }),
  consumptionDate: text('consumption_date').notNull(),
  quantity: numeric('quantity', { precision: 12, scale: 4 }).notNull(),
  unit: varchar('unit', { length: 50 }).notNull(),
  pricePerPack: numeric('price_per_pack', { precision: 12, scale: 4 }).notNull().default('0'),
  totalCost: numeric('total_cost', { precision: 12, scale: 2 }).notNull().default('0'),
  recordedBy: varchar('recorded_by', { length: 255 }),
  operatorName: varchar('operator_name', { length: 255 }),
  signatureBase64: text('signature_base64'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const recipes = pgTable('recipes', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  departmentId: text('department_id'),
  departmentName: varchar('department_name', { length: 120 }),
  name: varchar('name', { length: 255 }).notNull(),
  sellingPrice: numeric('selling_price', { precision: 12, scale: 2 }).notNull().default('0'),
  expectedYield: numeric('expected_yield', { precision: 10, scale: 2 }).notNull().default('1'),
  costPerPortion: numeric('cost_per_portion', { precision: 12, scale: 4 }).notNull().default('0'),
  totalCost: numeric('total_cost', { precision: 12, scale: 4 }).notNull().default('0'),
  profitMargin: numeric('profit_margin', { precision: 6, scale: 2 }).notNull().default('0'),
  displayOrder: integer('display_order').default(0),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const recipeIngredients = pgTable('recipe_ingredients', {
  id: text('id').primaryKey(),
  recipeId: text('recipe_id').notNull(),
  ingredientId: text('ingredient_id'),
  subRecipeId: text('sub_recipe_id'),
  isSubRecipe: boolean('is_sub_recipe').notNull().default(false),
  name: varchar('name', { length: 255 }).notNull(),
  gramsOrPortions: numeric('grams_or_portions', { precision: 12, scale: 4 }).notNull().default('0'),
});

export const dailySales = pgTable('daily_sales', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  recipeId: text('recipe_id'),
  recipeName: varchar('recipe_name', { length: 255 }).notNull(),
  saleDate: text('sale_date').notNull(),
  quantitySold: numeric('quantity_sold', { precision: 10, scale: 2 }).notNull().default('0'),
  sellingPrice: numeric('selling_price', { precision: 12, scale: 2 }).notNull().default('0'),
  costPerPortion: numeric('cost_per_portion', { precision: 12, scale: 4 }).notNull().default('0'),
  totalRevenue: numeric('total_revenue', { precision: 12, scale: 2 }).notNull().default('0'),
  totalCost: numeric('total_cost', { precision: 12, scale: 2 }).notNull().default('0'),
  margin: numeric('margin', { precision: 6, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// 7. COMPLETE COLLECTION RECORDS LEDGER (Zero-Data-Loss Relational Sync)
// ============================================================================
export const appDocuments = pgTable('app_documents', {
  id: text('id').primaryKey(), // Format: `${collectionName}:${docId}`
  collectionName: varchar('collection_name', { length: 100 }).notNull(),
  docId: text('doc_id').notNull(),
  ownerId: text('owner_id').notNull(),
  invitedEmail: text('invited_email'),
  payloadJson: text('payload_json').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

