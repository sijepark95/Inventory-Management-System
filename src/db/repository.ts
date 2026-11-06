import { and, eq, inArray } from 'drizzle-orm';
import { db } from './index.ts';
import {
  activeShifts,
  appDocuments,
  consumptionLogs,
  dailySales,
  departments,
  employees,
  ingredients,
  inventoryCounts,
  invoiceItems,
  invoices,
  recipeIngredients,
  recipes,
  restaurants,
  shiftBreaks,
  timecards,
  vendors,
} from './schema.ts';

function toNumStr(val: any, fallback = '0', maxDecimals = 6): string {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return n.toFixed(maxDecimals).replace(/\.?0+$/, '') || '0';
}

function toInt(val: any, fallback = 0): number {
  const n = parseInt(String(val), 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Synchronizes a single collection document into the corresponding normalized relational PostgreSQL table(s)
 */
async function syncNormalizedRelationalTable(
  collectionName: string,
  docId: string,
  ownerId: string,
  data: any
) {
  switch (collectionName) {
    case 'ingredients': {
      const values = {
        id: docId,
        ownerId,
        vendorId: data.vendorId ? String(data.vendorId) : null,
        vendorName: data.vendor ? String(data.vendor).slice(0, 255) : null,
        name: String(data.name || 'Unnamed Ingredient').slice(0, 255),
        category: String(data.category || 'General').slice(0, 100),
        packagingUnit: data.packagingUnit ? String(data.packagingUnit).slice(0, 50) : null,
        baseUnit: String(data.baseUnit || data.unit || 'lb').slice(0, 20),
        price: toNumStr(data.price, '0'),
        quantity: toNumStr(data.quantity, '1'),
        unit: String(data.unit || data.packagingUnit || 'unit').slice(0, 50),
        pricePerGram: toNumStr(data.pricePerGram, '0'),
        weightPerCase: data.weightPerCase !== undefined && data.weightPerCase !== null ? toNumStr(data.weightPerCase) : null,
        weightPerCaseUnit: data.weightPerCaseUnit ? String(data.weightPerCaseUnit).slice(0, 50) : null,
        pcsPerPound: data.pcsPerPound !== undefined && data.pcsPerPound !== null ? toNumStr(data.pcsPerPound) : null,
        conversions: Array.isArray(data.conversions) ? JSON.stringify(data.conversions) : (typeof data.conversions === 'string' ? data.conversions : null),
        invoiceAliases: Array.isArray(data.invoiceAliases) ? JSON.stringify(data.invoiceAliases) : (typeof data.invoiceAliases === 'string' ? data.invoiceAliases : null),
        usabilityPercentage: toNumStr(data.usabilityPercentage ?? 100, '100.00'),
        inStock: toNumStr(data.inStock, '0'),
        minStock: toNumStr(data.minStock !== undefined && Number(data.minStock) > 0 ? data.minStock : 10, '10'),
        location: data.location ? String(data.location).slice(0, 120) : null,
        source: data.source ? String(data.source).slice(0, 255) : null,
        isHiddenFromInventory: Boolean(data.isHiddenFromInventory),
        updatedAt: new Date(),
      };
      await db
        .insert(ingredients)
        .values(values)
        .onConflictDoUpdate({ target: ingredients.id, set: values });
      break;
    }

    case 'vendors': {
      const nameStr = String(data.name || 'Vendor').slice(0, 255);
      const normKey = String(data.normalizedKey || nameStr.toLowerCase().trim()).slice(0, 255);
      const values = {
        id: docId,
        ownerId,
        name: nameStr,
        normalizedKey: normKey,
        contactName: data.contactName ? String(data.contactName).slice(0, 255) : null,
        phone: data.phone ? String(data.phone).slice(0, 50) : null,
        email: data.email ? String(data.email).slice(0, 255) : null,
        address: data.address ? String(data.address) : null,
        note: data.note ? String(data.note) : null,
        isRegistered: data.isRegistered !== false,
      };
      await db
        .insert(vendors)
        .values(values)
        .onConflictDoUpdate({ target: vendors.id, set: values });
      break;
    }

    case 'departments': {
      const values = {
        id: docId,
        ownerId,
        restaurantId: data.restaurantId ? String(data.restaurantId) : null,
        name: String(data.name || 'Department').slice(0, 120),
        description: data.description ? String(data.description) : null,
      };
      await db
        .insert(departments)
        .values(values)
        .onConflictDoUpdate({ target: departments.id, set: values });
      break;
    }

    case 'restaurants': {
      const values = {
        id: docId,
        ownerId,
        name: String(data.name || 'Restaurant').slice(0, 255),
        address: data.address ? String(data.address) : null,
        contactName: data.contactName ? String(data.contactName).slice(0, 255) : null,
        phone: data.phone ? String(data.phone).slice(0, 50) : null,
        email: data.email ? String(data.email).slice(0, 255) : null,
      };
      await db
        .insert(restaurants)
        .values(values)
        .onConflictDoUpdate({ target: restaurants.id, set: values });
      break;
    }

    case 'employees': {
      const values = {
        id: docId,
        ownerId,
        departmentId: data.departmentId ? String(data.departmentId) : null,
        employeeCode: data.employeeCode ? String(data.employeeCode).slice(0, 50) : null,
        pinCode: data.pin ? String(data.pin).slice(0, 12) : null,
        name: String(data.name || 'Staff Member').slice(0, 255),
        role: String(data.role || 'Staff').slice(0, 120),
        deptName: String(data.dept || 'Kitchen').slice(0, 120),
        hourlyRate: toNumStr(data.hourlyRate, '18.00'),
        otRate: data.otRate !== undefined ? toNumStr(data.otRate) : null,
        isSalary: Boolean(data.isSalary),
        salaryAmount: toNumStr(data.salaryAmount, '0'),
        mbExempt: Boolean(data.mbExempt),
        tipped: Boolean(data.tipped),
        sickDayEligible: Boolean(data.sickDayEligible),
        taxStatus: data.taxStatus ? String(data.taxStatus).slice(0, 50) : null,
        phoneNo: data.phoneNo ? String(data.phoneNo).slice(0, 50) : null,
        address: data.address ? String(data.address) : null,
        dateHired: data.dateHired ? String(data.dateHired) : null,
        dateTerminated: data.dateTerminated ? String(data.dateTerminated) : null,
        note: data.note ? String(data.note) : null,
        isActive: data.isActive !== false,
        updatedAt: new Date(),
      };
      await db
        .insert(employees)
        .values(values)
        .onConflictDoUpdate({ target: employees.id, set: values });
      break;
    }

    case 'active_shifts': {
      const values = {
        id: docId,
        ownerId,
        employeeId: String(data.employeeId || docId),
        employeeName: String(data.employeeName || 'Employee').slice(0, 255),
        employeeCode: data.employeeCode ? String(data.employeeCode).slice(0, 50) : null,
        role: String(data.role || 'Staff').slice(0, 120),
        dept: data.dept ? String(data.dept).slice(0, 120) : null,
        hourlyRate: toNumStr(data.hourlyRate, '18.00'),
        shiftDate: String(data.date || new Date().toISOString().slice(0, 10)),
        clockInAt: data.clockInIso ? new Date(data.clockInIso) : new Date(),
        status: String(data.status || 'clocked_in').slice(0, 30),
        currentBreakStartAt: data.currentBreakStartIso ? new Date(data.currentBreakStartIso) : null,
        currentBreakType: data.currentBreakType ? String(data.currentBreakType).slice(0, 30) : null,
        accumulatedUnpaidBreakMinutes: toInt(data.accumulatedUnpaidBreakMinutes, 0),
        accumulatedPaidBreakMinutes: toInt(data.accumulatedPaidBreakMinutes, 0),
        notes: data.notes ? String(data.notes) : null,
      };
      await db
        .insert(activeShifts)
        .values(values)
        .onConflictDoUpdate({ target: activeShifts.id, set: values });

      if (Array.isArray(data.breakHistory)) {
        for (let i = 0; i < data.breakHistory.length; i++) {
          const brk = data.breakHistory[i];
          const brkId = brk.id || `${docId}_brk_${i}`;
          const brkValues = {
            id: String(brkId),
            ownerId,
            activeShiftId: docId,
            timecardId: null,
            employeeId: String(data.employeeId || docId),
            breakType: String(brk.type || 'meal_unpaid').slice(0, 30),
            startedAt: brk.startIso ? new Date(brk.startIso) : new Date(),
            endedAt: brk.endIso ? new Date(brk.endIso) : null,
            durationMinutes: toInt(brk.durationMinutes, 0),
          };
          await db
            .insert(shiftBreaks)
            .values(brkValues)
            .onConflictDoUpdate({ target: shiftBreaks.id, set: brkValues });
        }
      }
      break;
    }

    case 'timecards': {
      const values = {
        id: docId,
        ownerId,
        employeeId: data.employeeId ? String(data.employeeId) : null,
        employeeName: String(data.employeeName || 'Employee').slice(0, 255),
        employeeCode: data.employeeCode ? String(data.employeeCode).slice(0, 50) : null,
        job: data.job ? String(data.job).slice(0, 120) : null,
        shiftDate: String(data.date || new Date().toISOString().slice(0, 10)),
        clockInFormatted: String(data.clockIn || '09:00 AM').slice(0, 30),
        clockOutFormatted: String(data.clockOut || '05:00 PM').slice(0, 30),
        totalHours: toNumStr(data.totalHours, '0'),
        unpaidBreakMinutes: toInt(data.unpaidBreakMinutes, 0),
        paidHours: toNumStr(data.paidHours ?? data.totalHours, '0'),
        regularHours: toNumStr(data.regularHours ?? Math.min(8, Number(data.paidHours || data.totalHours || 0)), '0'),
        overtimeHours: toNumStr(data.overtimeHours ?? Math.max(0, Number(data.paidHours || data.totalHours || 0) - 8), '0'),
        hourlyRateSnapshot: data.hourlyRate ? toNumStr(data.hourlyRate) : null,
        isAutoClockOut: Boolean(data.isAutoClockOut),
        isOver8pm: Boolean(data.isOver8pm),
        anomalies: Array.isArray(data.anomalies) ? JSON.stringify(data.anomalies) : null,
      };
      await db
        .insert(timecards)
        .values(values)
        .onConflictDoUpdate({ target: timecards.id, set: values });
      break;
    }

    case 'recipes': {
      const values = {
        id: docId,
        ownerId,
        departmentId: data.departmentId ? String(data.departmentId) : null,
        departmentName: data.department ? String(data.department).slice(0, 120) : null,
        name: String(data.name || 'Recipe').slice(0, 255),
        sellingPrice: toNumStr(data.sellingPrice, '0'),
        expectedYield: toNumStr(data.expectedYield ?? data.yield ?? 1, '1'),
        costPerPortion: toNumStr(data.costPerPortion ?? data.totalCost, '0'),
        totalCost: toNumStr(data.totalCost, '0'),
        profitMargin: toNumStr(data.profitMargin, '0'),
        displayOrder: toInt(data.order, 0),
        updatedAt: new Date(),
      };
      await db
        .insert(recipes)
        .values(values)
        .onConflictDoUpdate({ target: recipes.id, set: values });

      if (Array.isArray(data.ingredients)) {
        await db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, docId));
        for (let i = 0; i < data.ingredients.length; i++) {
          const ri = data.ingredients[i];
          const riId = `${docId}_ri_${i}`;
          await db.insert(recipeIngredients).values({
            id: riId,
            recipeId: docId,
            ingredientId: ri.isSubRecipe ? null : String(ri.ingredientId || ''),
            subRecipeId: ri.isSubRecipe ? String(ri.subRecipeId || ri.ingredientId || '') : null,
            isSubRecipe: Boolean(ri.isSubRecipe),
            name: String(ri.name || 'Ingredient').slice(0, 255),
            gramsOrPortions: toNumStr(ri.grams, '0'),
          });
        }
      }
      break;
    }

    case 'invoices': {
      const values = {
        id: docId,
        ownerId,
        vendorId: data.vendorId ? String(data.vendorId) : null,
        vendorName: data.vendor ? String(data.vendor).slice(0, 255) : null,
        fileName: String(data.fileName || 'invoice').slice(0, 255),
        invoiceNumber: data.invoiceNumber ? String(data.invoiceNumber).slice(0, 100) : null,
        issueDate: data.issueDate ? String(data.issueDate) : null,
        dueDate: data.dueDate ? String(data.dueDate) : null,
        type: String(data.type || 'standard_invoice').slice(0, 50),
        status: String(data.status || 'applied').slice(0, 50),
        totalAmount: toNumStr(data.totalAmount, '0'),
        notes: data.notes ? String(data.notes) : null,
        fileUrl: data.fileUrl ? String(data.fileUrl) : null,
        fileType: data.fileType ? String(data.fileType).slice(0, 100) : null,
        fileSize: data.fileSize ? toInt(data.fileSize, 0) : null,
      };
      await db
        .insert(invoices)
        .values(values)
        .onConflictDoUpdate({ target: invoices.id, set: values });

      if (Array.isArray(data.items)) {
        await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, docId));
        for (let i = 0; i < data.items.length; i++) {
          const item = data.items[i];
          const itemId = `${docId}_item_${i}`;
          await db.insert(invoiceItems).values({
            id: itemId,
            invoiceId: docId,
            ownerId,
            targetIngredientId: item.targetIngredientId ? String(item.targetIngredientId) : null,
            name: String(item.name || 'Line Item').slice(0, 255),
            quantity: toNumStr(item.quantity, '1'),
            unit: String(item.unit || item.registeredPackSize || 'unit').slice(0, 50),
            baseUnit: String(item.baseUnit || 'lb').slice(0, 20),
            packagingUnit: item.packagingUnit ? String(item.packagingUnit).slice(0, 50) : null,
            originalDocUnit: item.originalDocUnit ? String(item.originalDocUnit).slice(0, 50) : null,
            registeredPackSize: item.registeredPackSize ? String(item.registeredPackSize).slice(0, 50) : null,
            unitMatchedToPackSize: Boolean(item.unitMatchedToPackSize),
            pricePerUnit: toNumStr(item.pricePerUnit, '0'),
            totalPrice: toNumStr(item.totalPrice, '0'),
            matchAction: String(item.matchAction || 'map').slice(0, 20),
            weightPerCase: item.weightPerCase !== undefined && item.weightPerCase !== null ? toNumStr(item.weightPerCase) : null,
            weightPerCaseUnit: item.weightPerCaseUnit ? String(item.weightPerCaseUnit).slice(0, 50) : null,
            pcsPerPound: item.pcsPerPound !== undefined && item.pcsPerPound !== null ? toNumStr(item.pcsPerPound) : null,
            conversions: Array.isArray(item.conversions) ? JSON.stringify(item.conversions) : (typeof item.conversions === 'string' ? item.conversions : null),
            usabilityPercentage: toNumStr(item.usabilityPercentage ?? 100, '100.00'),
          });
        }
      }
      break;
    }

    case 'inventory_counts': {
      const values = {
        id: docId,
        ownerId,
        date: String(data.date || new Date().toISOString().slice(0, 10)),
        totalValue: toNumStr(data.totalValue, '0'),
        totalPounds: toNumStr(data.totalPounds, '0'),
        totalItemsCount: toInt(data.totalItemsCount ?? (Array.isArray(data.items) ? data.items.length : 0), 0),
        lowStockCount: toInt(data.lowStockCount, 0),
        vendorFilter: data.vendorFilter ? String(data.vendorFilter).slice(0, 255) : null,
        itemsJson: Array.isArray(data.items) ? JSON.stringify(data.items) : (typeof data.itemsJson === 'string' ? data.itemsJson : '[]'),
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      };
      await db
        .insert(inventoryCounts)
        .values(values)
        .onConflictDoUpdate({ target: inventoryCounts.id, set: values });
      break;
    }

    case 'dailySales': {
      const values = {
        id: docId,
        ownerId,
        recipeId: data.recipeId ? String(data.recipeId) : null,
        recipeName: String(data.recipeName || 'Menu Item').slice(0, 255),
        saleDate: String(data.date || new Date().toISOString().slice(0, 10)),
        quantitySold: toNumStr(data.quantitySold, '0'),
        sellingPrice: toNumStr(data.sellingPrice, '0'),
        costPerPortion: toNumStr(data.costPerPortion, '0'),
        totalRevenue: toNumStr(data.totalRevenue, '0'),
        totalCost: toNumStr(data.totalCost, '0'),
        margin: toNumStr(data.margin, '0'),
      };
      await db
        .insert(dailySales)
        .values(values)
        .onConflictDoUpdate({ target: dailySales.id, set: values });
      break;
    }

    case 'consumptionLogs':
    case 'inventory_consumptions': {
      const vendStr = data.vendorName || data.vendor;
      const values = {
        id: docId,
        ownerId,
        ingredientId: data.ingredientId ? String(data.ingredientId) : null,
        ingredientName: String(data.ingredientName || 'Ingredient').slice(0, 255),
        vendorName: vendStr ? String(vendStr).slice(0, 255) : null,
        consumptionDate: String(data.date || new Date().toISOString().slice(0, 10)),
        quantity: toNumStr(data.quantity, '0'),
        unit: String(data.unit || 'unit').slice(0, 50),
        pricePerPack: toNumStr(data.pricePerPack, '0'),
        totalCost: toNumStr(data.totalCost, '0'),
        recordedBy: data.recordedBy ? String(data.recordedBy).slice(0, 255) : null,
        operatorName: data.operatorName ? String(data.operatorName).slice(0, 255) : null,
        signatureBase64: data.signatureBase64 ? String(data.signatureBase64) : null,
      };
      await db
        .insert(consumptionLogs)
        .values(values)
        .onConflictDoUpdate({ target: consumptionLogs.id, set: values });
      break;
    }
  }
}

async function deleteNormalizedRelationalRow(collectionName: string, docId: string) {
  switch (collectionName) {
    case 'ingredients':
      await db.delete(ingredients).where(eq(ingredients.id, docId));
      break;
    case 'vendors':
      await db.delete(vendors).where(eq(vendors.id, docId));
      break;
    case 'departments':
      await db.delete(departments).where(eq(departments.id, docId));
      break;
    case 'restaurants':
      await db.delete(restaurants).where(eq(restaurants.id, docId));
      break;
    case 'employees':
      await db.delete(employees).where(eq(employees.id, docId));
      break;
    case 'active_shifts':
      await db.delete(shiftBreaks).where(eq(shiftBreaks.activeShiftId, docId));
      await db.delete(activeShifts).where(eq(activeShifts.id, docId));
      break;
    case 'timecards':
      await db.delete(timecards).where(eq(timecards.id, docId));
      break;
    case 'recipes':
      await db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, docId));
      await db.delete(recipes).where(eq(recipes.id, docId));
      break;
    case 'invoices':
      await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, docId));
      await db.delete(invoices).where(eq(invoices.id, docId));
      break;
    case 'dailySales':
      await db.delete(dailySales).where(eq(dailySales.id, docId));
      break;
    case 'consumptionLogs':
    case 'inventory_consumptions':
      await db.delete(consumptionLogs).where(eq(consumptionLogs.id, docId));
      break;
    case 'inventory_counts':
      await db.delete(inventoryCounts).where(eq(inventoryCounts.id, docId));
      break;
  }
}

/**
 * Upserts a document into Cloud SQL (both app_documents and the normalized relational table)
 */
export async function upsertCloudSqlDoc(
  collectionName: string,
  docId: string,
  data: any,
  merge = false,
  fallbackOwnerId?: string
) {
  try {
    const compositeId = `${collectionName}:${docId}`;
    let finalPayload = { ...data, id: docId };

    if (merge) {
      const existing = await db
        .select()
        .from(appDocuments)
        .where(eq(appDocuments.id, compositeId));
      if (existing.length > 0) {
        try {
          const prevData = JSON.parse(existing[0].payloadJson);
          finalPayload = {
            ...prevData,
            ...data,
            id: docId,
            ownerId: data.ownerId || prevData.ownerId || existing[0].ownerId || fallbackOwnerId || 'default',
          };
        } catch {
          // ignore parse error
        }
      }
    }

    const ownerId = String(finalPayload.ownerId || fallbackOwnerId || 'default');
    finalPayload.ownerId = ownerId;
    const invitedEmail = finalPayload.invitedEmail
      ? String(finalPayload.invitedEmail).toLowerCase()
      : null;

    const record = {
      id: compositeId,
      collectionName,
      docId,
      ownerId,
      invitedEmail,
      payloadJson: JSON.stringify(finalPayload),
      updatedAt: new Date(),
    };

    await db
      .insert(appDocuments)
      .values(record)
      .onConflictDoUpdate({
        target: appDocuments.id,
        set: record,
      });

    try {
      await syncNormalizedRelationalTable(collectionName, docId, ownerId, finalPayload);
    } catch (relErr) {
      console.warn(`Relational table sync warning for ${collectionName}/${docId}:`, relErr);
    }

    return finalPayload;
  } catch (error) {
    console.error(`Cloud SQL upsert failed for ${collectionName}/${docId}:`, error);
    throw new Error('Failed to save record to Cloud SQL database.', { cause: error });
  }
}

/**
 * Deletes a document from Cloud SQL
 */
export async function deleteCloudSqlDoc(collectionName: string, docId: string) {
  try {
    const compositeId = `${collectionName}:${docId}`;
    await db.delete(appDocuments).where(eq(appDocuments.id, compositeId));
    try {
      await deleteNormalizedRelationalRow(collectionName, docId);
    } catch (relErr) {
      console.warn(`Relational delete warning for ${collectionName}/${docId}:`, relErr);
    }
    return { deleted: true, id: docId };
  } catch (error) {
    console.error(`Cloud SQL delete failed for ${collectionName}/${docId}:`, error);
    throw new Error('Failed to delete record from Cloud SQL database.', { cause: error });
  }
}

/**
 * Bulk deletes documents from Cloud SQL
 */
export async function bulkDeleteCloudSqlDocs(collectionName: string, docIds: string[]) {
  try {
    if (!docIds || docIds.length === 0) return { deletedCount: 0 };
    const compositeIds = docIds.map((id) => `${collectionName}:${id}`);
    await db.delete(appDocuments).where(inArray(appDocuments.id, compositeIds));
    for (const id of docIds) {
      try {
        await deleteNormalizedRelationalRow(collectionName, id);
      } catch (relErr) {
        console.warn(`Relational bulk delete warning for ${collectionName}/${id}:`, relErr);
      }
    }
    return { deletedCount: docIds.length };
  } catch (error) {
    console.error(`Cloud SQL bulk delete failed for ${collectionName}:`, error);
    throw new Error('Failed to bulk delete records from Cloud SQL database.', { cause: error });
  }
}

/**
 * Queries documents for a collection by ownerId (or invitedEmail for shares)
 */
export async function listCloudSqlCollection(
  collectionName: string,
  ownerId?: string,
  invitedEmail?: string
) {
  try {
    let rows;
    if (invitedEmail) {
      rows = await db
        .select()
        .from(appDocuments)
        .where(
          and(
            eq(appDocuments.collectionName, collectionName),
            eq(appDocuments.invitedEmail, invitedEmail.toLowerCase())
          )
        );
    } else if (ownerId) {
      rows = await db
        .select()
        .from(appDocuments)
        .where(
          and(
            eq(appDocuments.collectionName, collectionName),
            eq(appDocuments.ownerId, ownerId)
          )
        );
    } else {
      rows = await db
        .select()
        .from(appDocuments)
        .where(eq(appDocuments.collectionName, collectionName));
    }

    if (rows.length === 0 && ownerId && (collectionName === 'departments' || collectionName === 'vendors' || collectionName === 'employees' || collectionName === 'invoices')) {
      if (collectionName === 'invoices') {
        const relInvoices = await db.select().from(invoices).where(eq(invoices.ownerId, ownerId));
        if (relInvoices.length > 0) {
          const allRelItems = await db.select().from(invoiceItems).where(eq(invoiceItems.ownerId, ownerId));
          return relInvoices.map((inv) => {
            const itemsForInv = allRelItems
              .filter((it) => it.invoiceId === inv.id)
              .map((it) => ({
                name: it.name,
                quantity: Number(it.quantity) || 1,
                unit: it.unit || 'ea',
                pricePerUnit: Number(it.pricePerUnit) || 0,
                totalPrice: Number(it.totalPrice) || 0,
                targetIngredientId: it.targetIngredientId || undefined,
                matchAction: it.matchAction || 'create',
                baseUnit: it.baseUnit || 'lb',
                packagingUnit: it.packagingUnit || undefined,
                weightPerCase: it.weightPerCase ? Number(it.weightPerCase) : undefined,
                weightPerCaseUnit: it.weightPerCaseUnit || undefined,
                usabilityPercentage: it.usabilityPercentage ? Number(it.usabilityPercentage) : 100,
              }));
            return {
              id: inv.id,
              ownerId: inv.ownerId,
              fileName: inv.fileName || '',
              invoiceNumber: inv.invoiceNumber || '',
              vendor: inv.vendorName || '',
              vendorName: inv.vendorName || '',
              issueDate: inv.issueDate || '',
              dueDate: inv.dueDate || '',
              type: inv.type || 'standard_invoice',
              status: inv.status || 'applied',
              totalAmount: Number(inv.totalAmount) || 0,
              fileUrl: inv.fileUrl || undefined,
              fileType: inv.fileType || undefined,
              fileSize: inv.fileSize || undefined,
              notes: inv.notes || '',
              items: itemsForInv,
              createdAt: inv.createdAt ? inv.createdAt.toISOString() : new Date().toISOString(),
            };
          });
        }
      } else if (collectionName === 'departments') {
        const relDepts = await db.select().from(departments).where(eq(departments.ownerId, ownerId));
        if (relDepts.length > 0) {
          return relDepts.map((d) => ({
            id: d.id,
            ownerId: d.ownerId,
            name: d.name,
            description: d.description || '',
          }));
        }
      } else if (collectionName === 'vendors') {
        const relVendors = await db.select().from(vendors).where(eq(vendors.ownerId, ownerId));
        if (relVendors.length > 0) {
          return relVendors.map((v) => ({
            id: v.id,
            ownerId: v.ownerId,
            name: v.name,
            normalizedKey: v.normalizedKey,
            isRegistered: v.isRegistered,
          }));
        }
      } else if (collectionName === 'employees') {
        const relEmps = await db.select().from(employees).where(eq(employees.ownerId, ownerId));
        if (relEmps.length > 0) {
          return relEmps.map((e) => ({
            id: e.id,
            ownerId: e.ownerId,
            name: e.name,
            employeeCode: e.employeeCode || '',
            pin: e.pinCode || '',
            role: e.role || 'Staff',
            dept: e.deptName || 'Kitchen',
            hourlyRate: Number(e.hourlyRate) || 0,
            rate: Number(e.hourlyRate) || 0,
            otRate: Number(e.otRate) || 0,
            isSalary: Boolean(e.isSalary),
            isSalaried: Boolean(e.isSalary),
            salaryAmount: Number(e.salaryAmount) || 0,
            taxStatus: e.taxStatus || 'Single',
            phoneNo: e.phoneNo || '',
            phone: e.phoneNo || '',
            address: e.address || '',
            dateHired: e.dateHired || '',
            dateTerminated: e.dateTerminated || '',
            sickDayEligible: Boolean(e.sickDayEligible),
            tipped: Boolean(e.tipped),
            mbExempt: Boolean(e.mbExempt),
            note: e.note || '',
            notes: e.note || '',
          }));
        }
      }
    }

    return rows.map((r) => {
      try {
        const parsed = JSON.parse(r.payloadJson);
        return { ...parsed, id: r.docId };
      } catch {
        return { id: r.docId, ownerId: r.ownerId };
      }
    });
  } catch (error) {
    console.error(`Cloud SQL list failed for ${collectionName}:`, error);
    throw new Error('Failed to query records from Cloud SQL database.', { cause: error });
  }
}

/**
 * Migrates an entire workspace batch of collections into Cloud SQL
 */
export async function migrateWorkspaceBatchToCloudSql(
  ownerId: string,
  collectionsMap: Record<string, any[]>
) {
  try {
    const counts: Record<string, number> = {};
    for (const [collectionName, items] of Object.entries(collectionsMap)) {
      if (!Array.isArray(items)) continue;
      let count = 0;
      for (const item of items) {
        if (!item) continue;
        const docId = String(item.id || `${collectionName}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
        await upsertCloudSqlDoc(
          collectionName,
          docId,
          { ...item, ownerId: item.ownerId || ownerId },
          true
        );
        count++;
      }
      counts[collectionName] = count;
    }
    return counts;
  } catch (error) {
    console.error('Cloud SQL workspace batch migration failed:', error);
    throw new Error('Failed to migrate workspace data to Cloud SQL.', { cause: error });
  }
}

/**
 * Returns row counts in Cloud SQL relational tables for a given workspace ownerId
 */
export async function getCloudSqlTableCounts(ownerId: string) {
  try {
    const [
      empRows,
      shiftRows,
      brkRows,
      tcRows,
      vendRows,
      ingRows,
      invRows,
      invItemRows,
      recRows,
      saleRows,
      deptRows,
      consRows,
    ] = await Promise.all([
      db.select().from(employees).where(eq(employees.ownerId, ownerId)),
      db.select().from(activeShifts).where(eq(activeShifts.ownerId, ownerId)),
      db.select().from(shiftBreaks).where(eq(shiftBreaks.ownerId, ownerId)),
      db.select().from(timecards).where(eq(timecards.ownerId, ownerId)),
      db.select().from(vendors).where(eq(vendors.ownerId, ownerId)),
      db.select().from(ingredients).where(eq(ingredients.ownerId, ownerId)),
      db.select().from(invoices).where(eq(invoices.ownerId, ownerId)),
      db.select().from(invoiceItems).where(eq(invoiceItems.ownerId, ownerId)),
      db.select().from(recipes).where(eq(recipes.ownerId, ownerId)),
      db.select().from(dailySales).where(eq(dailySales.ownerId, ownerId)),
      db.select().from(departments).where(eq(departments.ownerId, ownerId)),
      db.select().from(consumptionLogs).where(eq(consumptionLogs.ownerId, ownerId)),
    ]);

    return {
      employees: empRows.length,
      active_shifts: shiftRows.length,
      shift_breaks: brkRows.length,
      timecards: tcRows.length,
      vendors: vendRows.length,
      ingredients: ingRows.length,
      invoices: invRows.length,
      invoice_items: invItemRows.length,
      recipes: recRows.length,
      daily_sales: saleRows.length,
      departments: deptRows.length,
      consumption_logs: consRows.length,
    };
  } catch (error) {
    console.error('Failed to get Cloud SQL table counts:', error);
    throw new Error('Failed to query Cloud SQL table counts.', { cause: error });
  }
}

/**
 * Clears all test data (ingredients, recipes, invoices, consumptions, counts, sales)
 */
export async function clearWorkspaceTestData(ownerId?: string) {
  try {
    if (ownerId) {
      await db.delete(recipeIngredients);
      await db.delete(recipes).where(eq(recipes.ownerId, ownerId));
      await db.delete(invoiceItems).where(eq(invoiceItems.ownerId, ownerId));
      await db.delete(invoices).where(eq(invoices.ownerId, ownerId));
      await db.delete(ingredients).where(eq(ingredients.ownerId, ownerId));
      await db.delete(consumptionLogs).where(eq(consumptionLogs.ownerId, ownerId));
      await db.delete(inventoryCounts).where(eq(inventoryCounts.ownerId, ownerId));
      await db.delete(dailySales).where(eq(dailySales.ownerId, ownerId));
      await db.delete(appDocuments).where(
        and(
          eq(appDocuments.ownerId, ownerId),
          inArray(appDocuments.collectionName, [
            'ingredients',
            'recipes',
            'invoices',
            'inventory_counts',
            'inventory_consumptions',
            'consumption_logs',
            'dailySales',
            'industrialProducts',
            'groceryPurchases',
            'groceryShoppingList',
            'salesUploads',
          ])
        )
      );
    } else {
      await db.delete(recipeIngredients);
      await db.delete(recipes);
      await db.delete(invoiceItems);
      await db.delete(invoices);
      await db.delete(ingredients);
      await db.delete(consumptionLogs);
      await db.delete(inventoryCounts);
      await db.delete(dailySales);
      await db.delete(appDocuments).where(
        inArray(appDocuments.collectionName, [
          'ingredients',
          'recipes',
          'invoices',
          'inventory_counts',
          'inventory_consumptions',
          'consumption_logs',
          'dailySales',
          'industrialProducts',
          'groceryPurchases',
          'groceryShoppingList',
          'salesUploads',
        ])
      );
    }
    return { success: true };
  } catch (err) {
    console.error('Failed to clear workspace test data from Cloud SQL:', err);
    throw err;
  }
}

