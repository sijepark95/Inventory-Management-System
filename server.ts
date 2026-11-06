import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc } from "firebase/firestore";

// Load environment variables
dotenv.config();

import firebaseConfig from "./firebase-applet-config.json";
import { requireAuth, AuthRequest } from "./src/middleware/auth.ts";
import { getUsers, getOrCreateUser } from "./src/db/users.ts";
import {
  upsertCloudSqlDoc,
  deleteCloudSqlDoc,
  bulkDeleteCloudSqlDocs,
  listCloudSqlCollection,
  migrateWorkspaceBatchToCloudSql,
  getCloudSqlTableCounts,
  clearWorkspaceTestData,
} from "./src/db/repository.ts";

const app = express();
const PORT = 3000;

// Top-level Process Error Handling to prevent silent container exits
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception in server:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection in server:", reason);
});

// Health check endpoints FIRST - needed for dev server liveness checks
app.get("/api/health", (req: express.Request, res: express.Response) => {
  res.json({ status: "ok" });
});
app.get("/health", (req: express.Request, res: express.Response) => {
  res.json({ status: "ok" });
});

// Initialize Firebase for backend API routes lazily
let backendDbInstance: any = null;
function getBackendDb() {
  if (!backendDbInstance) {
    try {
      const backendFirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
      backendDbInstance = getFirestore(backendFirebaseApp, firebaseConfig.firestoreDatabaseId);
    } catch (e) {
      console.warn("Could not initialize backend Firebase instance on demand:", e);
    }
  }
  return backendDbInstance;
}

// Set up large JSON payload limit so that images and PDFs can be sent in base64
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Enable CORS and OPTIONS handling for Public API endpoints
app.use("/api/public", (req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

// -----------------------------------------------------------------------------
// PUBLIC REST API ENDPOINTS
// -----------------------------------------------------------------------------

// 1. Public API Summary Index
app.get("/api/public", (req: express.Request, res: express.Response) => {
  res.json({
    name: "Restaurant Food Cost Intel Public API",
    status: "online",
    endpoints: {
      recipes: "/api/public/recipes",
      stockTakeCounts: "/api/public/inventory-counts",
      consumptionLedger: "/api/public/consumption-ledger",
      ingredients: "/api/public/ingredients"
    }
  });
});

// Helper to fetch public collection from Cloud SQL first with Firestore fallback
async function getPublicCollectionItems(collectionName: string, ownerId?: string): Promise<any[]> {
  try {
    const sqlItems = await listCloudSqlCollection(collectionName, ownerId);
    if (sqlItems && sqlItems.length > 0) {
      return sqlItems;
    }
  } catch (err) {
    console.warn(`Cloud SQL read warning for ${collectionName}:`, err);
  }
  const db = getBackendDb();
  if (!db) return [];
  const snap = await getDocs(collection(db, collectionName));
  const items: any[] = [];
  snap.forEach((d) => {
    items.push({ id: d.id, ...d.data() });
  });
  return items;
}

// 2. Public Recipe Info API Endpoint
app.get("/api/public/recipes", async (req: express.Request, res: express.Response) => {
  try {
    const ownerId = typeof req.query.ownerId === "string" ? req.query.ownerId : undefined;
    const recipes = await getPublicCollectionItems("recipes", ownerId);
    res.json({
      success: true,
      count: recipes.length,
      data: recipes
    });
  } catch (err: any) {
    console.error("Error fetching public recipes:", err);
    res.status(500).json({ success: false, error: err?.message || "Failed to fetch recipes" });
  }
});

// 3. Public Stock Take Count Sheet API Endpoint
app.get("/api/public/inventory-counts", async (req: express.Request, res: express.Response) => {
  try {
    const ownerId = typeof req.query.ownerId === "string" ? req.query.ownerId : undefined;
    const counts = await getPublicCollectionItems("inventory_counts", ownerId);
    res.json({
      success: true,
      count: counts.length,
      data: counts
    });
  } catch (err: any) {
    console.error("Error fetching public inventory counts:", err);
    res.status(500).json({ success: false, error: err?.message || "Failed to fetch inventory counts" });
  }
});

// 4. Public Consumption Ledger Logs API Endpoint
app.get("/api/public/consumption-ledger", async (req: express.Request, res: express.Response) => {
  try {
    const ownerId = typeof req.query.ownerId === "string" ? req.query.ownerId : undefined;
    const targetDate = req.query.date as string | undefined;
    const rawItems = await getPublicCollectionItems("inventory_consumptions", ownerId);
    const consumptions: any[] = [];

    rawItems.forEach((item) => {
      const data = { ...item };
      delete data.signatureBase64;

      if (targetDate) {
        if (data.date === targetDate || (data.createdAt && String(data.createdAt).startsWith(targetDate))) {
          consumptions.push(data);
        }
      } else {
        consumptions.push(data);
      }
    });
    res.json({
      success: true,
      count: consumptions.length,
      data: consumptions
    });
  } catch (err: any) {
    console.error("Error fetching public consumption ledger:", err);
    res.status(500).json({ success: false, error: err?.message || "Failed to fetch consumption ledger" });
  }
});

// 5. Public Master Ingredients API Endpoint
app.get("/api/public/ingredients", async (req: express.Request, res: express.Response) => {
  try {
    const ownerId = typeof req.query.ownerId === "string" ? req.query.ownerId : undefined;
    const ingredients = await getPublicCollectionItems("ingredients", ownerId);
    res.json({
      success: true,
      count: ingredients.length,
      data: ingredients
    });
  } catch (err: any) {
    console.error("Error fetching public ingredients:", err);
    res.status(500).json({ success: false, error: err?.message || "Failed to fetch ingredients" });
  }
});

let aiClient: GoogleGenAI | null = null;
function getAIClient() {
  if (!aiClient) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured in environment");
    }
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

/**
 * Resilient wrapper to call generateContent with retry backoff and fallback models
 */
async function generateContentWithRetryAndFallback(params: any, options?: { maxRetries?: number; initialDelayMs?: number }) {
  const maxRetries = options?.maxRetries ?? 3;
  const initialDelayMs = options?.initialDelayMs ?? 1000;
  
  const ai = getAIClient();
  
  // Valid, supported models according to Gemini API guidance:
  // Primary: gemini-3.8-flash (fast, state-of-the-art text and multimodal extraction)
  // Fallbacks: gemini-flash-latest, gemini-3.1-flash-lite (high availability / lite)
  const primaryModel = params.model || "gemini-3.8-flash";
  const supportedFallbacks = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
  const modelsToTry = Array.from(new Set([primaryModel, ...supportedFallbacks]));
  let lastError: any = null;
  
  for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
    const model = modelsToTry[mIdx];
    if (!model) continue;
    let delay = initialDelayMs;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[AI Parser] Calling Gemini API using model: "${model}" (attempt ${attempt}/${maxRetries})`);
        const response = await ai.models.generateContent({
          ...params,
          model: model,
        });
        console.log(`[AI Parser] Successfully obtained response from model "${model}"`);
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = err.message || "";
        const errStr = errMsg + " " + JSON.stringify(err);
        const errStatus = err.status || err.statusCode || err.code || err.error?.code || (err.error?.status === "UNAVAILABLE" ? 503 : undefined);
        
        const cleanMsg = errMsg || (typeof err === "object" && err ? err.message : "") || "Model service limit notice";
        console.warn(`[AI Parser] Notice: "${model}" (attempt ${attempt}/${maxRetries}) experienced error: ${cleanMsg}`);
        
        // Match 503 Overloaded/Unavailable / High demand specifically 
        const isModelOverloaded = 
          errStatus === 503 || 
          errStr.includes("503") || 
          errStr.includes("UNAVAILABLE") ||
          errStr.includes("overloaded") ||
          errStr.includes("high demand") ||
          errStr.includes("temporary");

        // Match 429 Quota Exceeded and Resource Exhaustion specifically
        const isQuotaExceeded =
          errStatus === 429 ||
          errStr.includes("429") ||
          errStr.includes("ResourceExhausted") ||
          errStr.includes("exhausted") ||
          errStr.includes("quota") ||
          errStr.includes("Limit exceeded") ||
          errStr.includes("exceeded your current quota");

        const isNotFoundOrUnsupported =
          errStatus === 404 ||
          errStatus === 400 ||
          errStr.includes("404") ||
          errStr.includes("not found") ||
          errStr.includes("not supported");
          
        const hasMoreFallbackModels = mIdx < modelsToTry.length - 1;
        
        if (isNotFoundOrUnsupported) {
          if (hasMoreFallbackModels) {
            console.warn(`[AI Parser] Model "${model}" is not found or unsupported. Switching to fallback model "${modelsToTry[mIdx + 1]}".`);
            break; // break attempt loop to try next model
          }
        }

        // If non-transient and no fallbacks left, fail
        const isRateLimitOrTransient = 
          isModelOverloaded ||
          isQuotaExceeded ||
          errStatus >= 500 || 
          !errStatus;

        if (!isRateLimitOrTransient && !hasMoreFallbackModels) {
          console.warn("[AI Parser] Non-transient error and no further fallbacks available. Failing immediately.");
          throw err;
        }
        
        if (attempt < maxRetries) {
          const jitter = Math.random() * 300;
          let waitTime = delay + jitter;
          if (isModelOverloaded) {
            waitTime += 2000; // Add extra delay for overloaded spikes
          }
          console.log(`[AI Parser] Backing off for ${Math.round(waitTime)}ms before next retry...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          delay *= 2; // double backoff delay for exponential curve
        } else if (hasMoreFallbackModels) {
          console.warn(`[AI Parser] Exhausted ${maxRetries} retries for model "${model}". Switching to fallback model "${modelsToTry[mIdx + 1]}".`);
          break; // Break the attempt loop to try the next model
        }
      }
    }
  }
  
  throw lastError || new Error("Failed to parse document. No responsive Gemini models available at this time.");
}

// AI Parser Endpoint
app.post("/api/parse-document", async (req: express.Request, res: express.Response) => {
  try {
    const { fileData, mimeType, fileName } = req.body;

    if (!fileData || !mimeType) {
      res.status(400).json({ error: "Missing fileData or mimeType" });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: "GEMINI_API_KEY is not configured in environment" });
      return;
    }

    const systemPrompt = `You are a professional restaurant food cost auditor, invoice OCR parser, and price catalog sync specialist.
Your job is to accurately extract and parse food ingredient invoices, supplier price correction notices, receipts, spreadsheets, delivery manifests, or vendor catalogs.
Extract all ingredients and food line items with their item name, package quantity, total cost, and unit types.

CRITICAL RULES FOR ITEM NAMES:
- Extract the complete, clean, and descriptive item name as shown in the document (e.g., 'Organic Bread Flour 50lb', 'Unsalted Butter 1lb blocks', 'Boneless Skinless Chicken Breast', 'USDA Choice Ribeye Subprimal', 'Whole Milk 1 Gallon', 'Yukon Gold Potatoes', 'Yellow Onions 50lb', 'Extra Virgin Olive Oil 5L').
- Clean up any vendor barcodes, SKU numbers, or machine codes from the name, while preserving the full ingredient/product description.
- Do NOT convert item names to 'Unknown'. Always extract the real descriptive food item name from each row.
- If an item has a brand name, include it (e.g. 'King Arthur Flour', 'Sysco Imperial Olive Oil').

Units & Registered Package Size rules:
- Extract the actual purchase packaging or pack size unit (e.g., 'box', 'case', 'bag', 'pack', 'lb', 'lbs', 'kg', 'g', 'oz', 'ml', 'L', 'can', 'bottle', 'pcs', 'each', 'bucket', 'tub').
- In this system, every ingredient unit MUST correspond to a registered package size (such as Box, Case, Bag, Tub, Pack, Bottle, Can).
- If the item specifies a container or box (e.g., 'Shrimp Tempura Box', '4x5lb Box', 'Tempura 10# Box'), extract 'box' as the unit.
- If the document specifies a container packaging with a physical weight or volume (e.g., '50 lb bag', '12x500ml case', '4x5lb box', '6x1 Gal'), extract the total physical package weight into 'weightPerCase' and the weight unit into 'weightPerCaseUnit' (lb, kg, oz, g, L, ml).
- Provide exact purchase numeric package quantities and total cost per line item. If unit price is given instead of total cost, calculate totalPrice = unitPrice * quantity.
- If no packaging unit is stated in the document row, leave unit as empty string '' rather than guessing, so the restaurant manager will be prompted to register the package size before saving.
- Food Category Recommendation: For every extracted item, classify and recommend its food category into 'category' using strictly one of: 'Meat', 'Seafood', 'Vegetables', 'Fruit', 'Dairy', 'Bread', 'Dry Goods', 'Sauces & Condiments', 'Beverages', 'Packaging & Supplies', or 'Other'.

Return Only a structured JSON conforming to the requested schema. Do not write markdown blocks or text wrapper outside the JSON.`;

    let cleanFileData = fileData;
    if (cleanFileData.includes(",")) {
      cleanFileData = cleanFileData.split(",")[1];
    }

    let effectiveMime = mimeType;
    if (fileName) {
      const ext = fileName.split('.').pop()?.toLowerCase();
      if (ext === "csv") effectiveMime = "text/csv";
      else if (ext === "txt" || ext === "tsv") effectiveMime = "text/plain";
      else if (ext === "pdf") effectiveMime = "application/pdf";
      else if (ext === "png") effectiveMime = "image/png";
      else if (ext === "jpg" || ext === "jpeg") effectiveMime = "image/jpeg";
      else if (ext === "webp") effectiveMime = "image/webp";
      else if (ext === "svg") effectiveMime = "image/svg+xml";
    }

    const isSvg = effectiveMime === "image/svg+xml" || (fileName && fileName.toLowerCase().endsWith(".svg"));
    const isTxt = effectiveMime === "text/plain" || effectiveMime === "text/csv" || isSvg || effectiveMime.startsWith("text/");
    const isExcel = 
      effectiveMime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
      effectiveMime === "application/vnd.ms-excel" ||
      (fileName && (fileName.toLowerCase().endsWith(".xlsx") || fileName.toLowerCase().endsWith(".xls")));

    if (isExcel) {
      res.status(400).json({ 
        error: "Excel spreadsheets (.xlsx / .xls) are not supported directly by the AI Document visual reader. Please save your spreadsheet as a PDF or CSV and upload it, take a screenshot of your spreadsheet and upload the image, or copy and paste the rows as text." 
      });
      return;
    }

    if (!isTxt && (!effectiveMime || effectiveMime === "application/octet-stream")) {
      if (cleanFileData.startsWith("/9j/")) {
        effectiveMime = "image/jpeg";
      } else if (cleanFileData.startsWith("iVBORw0KGgo")) {
        effectiveMime = "image/png";
      } else if (cleanFileData.startsWith("JVBERi0")) {
        effectiveMime = "application/pdf";
      } else if (cleanFileData.startsWith("UklGR")) {
        effectiveMime = "image/webp";
      } else {
        effectiveMime = "image/jpeg";
      }
    }

    const contents: any[] = [];
    if (isTxt) {
      const decodedText = Buffer.from(cleanFileData, 'base64').toString('utf-8');
      const textPrompt = `Parse the attached spreadsheet, CSV, SVG invoice, or price sheet text data: "${fileName || 'invoice'}".
Extract vendor details, invoice reference or invoice number (or spreadsheet title), issue date, and all individual line items including item name, recommended food category, price, unit, package quantity, and any package weight detail if present.

Raw text material:
"""
${decodedText}
"""`;
      contents.push({ text: textPrompt });
    } else {
      const promptText = `Parse the attached document image or PDF file: "${fileName || 'invoice'}" of type: "${effectiveMime}".
Extract vendor details, invoice number (or document title), issue date, and all individual line items with their item name, recommended food category, package quantity, total cost, purchase unit, and any package weight detail if present.`;
      
      contents.push({
        inlineData: {
          mimeType: effectiveMime,
          data: cleanFileData,
        }
      });
      contents.push({ text: promptText });
    }

    const response = await generateContentWithRetryAndFallback({
      model: "gemini-3.8-flash",
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            invoiceNumber: { type: Type.STRING, description: "Invoice reference number or sheet code" },
            vendor: { type: Type.STRING, description: "Name of the supplier or vendor" },
            issueDate: { type: Type.STRING, description: "Issue date or creation date extracted from the document" },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Clean ingredient or item name" },
                  category: { type: Type.STRING, description: "AI-recommended food category: 'Meat', 'Seafood', 'Vegetables', 'Fruit', 'Dairy', 'Bread', 'Dry Goods', 'Sauces & Condiments', 'Beverages', 'Packaging & Supplies', or 'Other'" },
                  unit: { type: Type.STRING, description: "Purchase unit (e.g., kg, g, ml, L, oz, lb, pcs, case, pack)" },
                  quantity: { type: Type.NUMBER, description: "The count of units in the purchased package (e.g. 5 for a 5kg bag, 12 for a carton of milk)" },
                  totalPrice: { type: Type.NUMBER, description: "The total cost of this line item charged on invoice" },
                  pricePerUnit: { type: Type.NUMBER, description: "Unit price (totalPrice / quantity)" },
                  weightPerCase: { type: Type.NUMBER, description: "Optional. The physical weight or volume per unit/case if listed (e.g., 500 for a 12x500g carton, 2.5 for a 2.5kg bag, 1 for a 1L container)" },
                  weightPerCaseUnit: { type: Type.STRING, description: "Optional. The standardized weight/volume unit (g, kg, ml, L, oz, lb) corresponding to the weightPerCase" }
                },
                required: ["name", "category", "unit", "quantity", "totalPrice", "pricePerUnit"]
              },
              description: "Array of extracted food ingredients with parsed prices and AI-recommended food categories"
            }
          },
          required: ["items"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      res.status(500).json({ error: "Gemini did not return any parse content" });
      return;
    }

    try {
      const cleanResult = resultText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsedData = JSON.parse(cleanResult);
      res.json(parsedData);
    } catch (parseErr) {
      console.error("Failed to parse response JSON from Gemini:", resultText);
      res.status(500).json({ error: "Invalid JSON structure returned from AI", details: resultText });
    }

  } catch (error: any) {
    console.error("Error in AI Doc Parsing:", error);
    const errMsg = error.message || "";
    const errStr = (errMsg + " " + JSON.stringify(error)).toLowerCase();
    const isQuotaExceeded = 
      errStr.includes("429") || 
      errStr.includes("quota") || 
      errStr.includes("exhausted") || 
      errStr.includes("resource_exhausted") ||
      errStr.includes("limit exceeded");

    if (isQuotaExceeded) {
      res.status(429).json({
        error: "AI Quota Exhausted (429)",
        message: "You have exceeded your Gemini free-tier quota (maximum 20 requests per day). To continue parsing invoices, please add/link a Paid API Key in Google AI Studio via 'Settings > Secrets' and activate pay-as-you-go, or try again tomorrow."
      });
    } else {
      res.status(500).json({ error: error.message || "An unexpected error occurred during document parsing" });
    }
  }
});

// AI Employee Parser Endpoint
app.post("/api/parse-employee", async (req: express.Request, res: express.Response) => {
  try {
    const { fileData, mimeType, fileName, textInput } = req.body;

    if (!fileData && !textInput) {
      res.status(400).json({ error: "Missing either fileData or textInput" });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: "GEMINI_API_KEY is not configured in environment" });
      return;
    }

    const systemPrompt = `You are an expert HR and Restaurant Operations assistant.
Your job is to parse employee records, resumes, cover bios, job application documents, text notes, or email contracts.
Extract all relevant employee information with precise details.

Strictly adhere to the following data-formatting rules:
- Name: E.g., 'Eleanor Vance' (standard name capitalization).
- HourlyRate: If not declared or impossible to infer, provide a solid standard rate (e.g., 18.00). Keep it as a positive floating number.
- OtRate: Standard is 1.5x of hourlyRate (e.g., 27.00 for 18.00). Call this out or calculate it if missing.
- Role: Extract roles like 'Line Cook', 'Server', 'Dishwasher', 'Prep Cook', 'Manager', 'Bartender', etc. Default to "Staff" if unmentioned.
- TaxStatus: Must be one of: "Single", "Married", or "Head of Household".
- DateHired: Format as YYYY-MM-DD (e.g. "2026-06-11"). If missing, default to the current year/months or leave undefined.
- PhoneNo: Clean and standardize to standard formatting (e.g., "555-019-2831").
- Note: A brief 2-3 sentence overview summary of their background/experience.

Return Only a single structured JSON object conforming to the requested schema. No wrap text, markdown, or chat explanations outside the JSON structure.`;

    const contents: any[] = [];
    if (fileData && mimeType) {
      contents.push({
        inlineData: {
          mimeType: mimeType,
          data: fileData, // Base64 raw string
        }
      });
    }

    let userPromptText = "Analyze this employee material and extract their HR and compensation dossier.";
    if (textInput) {
      userPromptText += `\n\nEmployee Material Information:\n"""\n${textInput}\n"""`;
    }
    contents.push({ text: userPromptText });

    const response = await generateContentWithRetryAndFallback({
      model: "gemini-3.8-flash",
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Full legal name of the employee" },
            employeeCode: { type: Type.STRING, description: "Unique Employee ID or designation code if present" },
            dept: { type: Type.STRING, description: "Department name (e.g., Kitchen, Service, Management, Bar)" },
            role: { type: Type.STRING, description: "Assigned job role title" },
            hourlyRate: { type: Type.NUMBER, description: "Wages per hour (Reg Rate)" },
            otRate: { type: Type.NUMBER, description: "Overtime premium hourly wage rate" },
            taxStatus: { type: Type.STRING, description: "Tax filing status ('Single', 'Married', 'Head of Household')" },
            phoneNo: { type: Type.STRING, description: "Contact phone number" },
            address: { type: Type.STRING, description: "Residential home address" },
            note: { type: Type.STRING, description: "A brief summary biography of experience or remarks" },
            dateHired: { type: Type.STRING, description: "Date of hiring YYYY-MM-DD" },
            mbExempt: { type: Type.BOOLEAN, description: "Whether the employee is Meals & Beverage tax exempt" },
            tipped: { type: Type.BOOLEAN, description: "Whether this is a tipped payroll employee" },
            isSalary: { type: Type.BOOLEAN, description: "Whether employee is paid on salaried/basis" },
            sickDayEligible: { type: Type.BOOLEAN, description: "Whether the employee is eligible for sick day leaves" }
          },
          required: ["name", "hourlyRate", "role"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      res.status(500).json({ error: "Gemini did not return any parse content" });
      return;
    }

    try {
      const parsedData = JSON.parse(resultText);
      res.json(parsedData);
    } catch (parseErr) {
      console.error("Failed to parse response JSON from Gemini:", resultText);
      res.status(500).json({ error: "Invalid JSON structure returned from AI", details: resultText });
    }

  } catch (error: any) {
    console.error("Error in AI Employee Parsing:", error);
    const errMsg = error.message || "";
    const errStr = (errMsg + " " + JSON.stringify(error)).toLowerCase();
    const isQuotaExceeded = 
      errStr.includes("429") || 
      errStr.includes("quota") || 
      errStr.includes("exhausted") || 
      errStr.includes("resource_exhausted") ||
      errStr.includes("limit exceeded");

    if (isQuotaExceeded) {
      res.status(429).json({
        error: "AI Quota Exhausted (429)",
        message: "You have exceeded your Gemini free-tier quota. To continue parsing employee documents, please check your Paid API Key in Google AI Studio via 'Settings > Secrets', or try again tomorrow."
      });
    } else {
      res.status(500).json({ error: error.message || "An unexpected error occurred during employee parsing" });
    }
  }
});

// AI Daily Sales Parser Endpoint
app.post("/api/parse-sales", async (req: express.Request, res: express.Response) => {
  try {
    const { fileData, mimeType, fileName, textInput } = req.body;

    if (!fileData && !textInput) {
      res.status(400).json({ error: "Missing either fileData or textInput for sales items parsing" });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: "GEMINI_API_KEY is not configured in environment" });
      return;
    }

    const systemPrompt = `You are an expert restaurant financial controller and POS data parser.
Your job is to read records of daily sales, portion outputs, dish tallies, till-tapes, or register printouts.
Extract the date of sales, individual menu items sold, quantities sold (portions), and any pricing details.

Guidelines:
- Sales Date: Look for date in the text (format YYYY-MM-DD). If no clear year is found but month/day is, assume the current or most reasonable year (standard is YYYY-MM-DD). Default to the current date if not found.
- Menu Item Name: E.g., 'Wagyu Burger' instead of 'WAG BRG #4'. Clean up non-food indicators.
- Quantity Sold: Total number of portions, pieces, or orders sold. Must be an integer >= 1.
- Selling Price: Look for unit price or gross sales divided by portions. If unknown/unstated, omit or estimate, but leave mapped if possible.
- Cost Per Portion: Look for unstated/explicit ingredient costs or COGS for this item if mentioned.
- Total Revenue: If unstated but Selling Price and Quantity are known, multiply them.
- Total Cost: If unstated but Cost Per Portion and Quantity are known, multiply them.

Return ONLY a structured JSON conforming to the requested schema. No conversational preamble, markdown headers, or footnotes.`;

    const isTxt = mimeType === "text/plain" || mimeType === "text/csv" || (mimeType && mimeType.startsWith("text/"));
    const isExcel = 
      mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
      mimeType === "application/vnd.ms-excel" ||
      (fileName && (fileName.toLowerCase().endsWith(".xlsx") || fileName.toLowerCase().endsWith(".xls")));

    if (isExcel) {
      res.status(400).json({ 
        error: "Excel spreadsheets (.xlsx / .xls) are not supported directly by the AI daily sales visual reader. Please save your spreadsheet as a PDF and upload the PDF, take a screenshot of your spreadsheet and upload the image, or copy and paste the rows as text." 
      });
      return;
    }

    const contents: any[] = [];
    if (fileData) {
      if (isTxt) {
        const decodedText = Buffer.from(fileData, 'base64').toString('utf-8');
        let userPromptText = `Analyze this daily sales statement, and reconstruct the structured items database.

Raw sales text document to decode:
"""
${decodedText}
"""`;
        if (textInput) {
          userPromptText += `\n\nAdditional text input reference:\n"""\n${textInput}\n"""`;
        }
        contents.push({ text: userPromptText });
      } else {
        contents.push({
          inlineData: {
            mimeType: mimeType,
            data: fileData,
          }
        });
        let userPromptText = "Analyze this daily sales statement or screen extract, and reconstruct the structured items database.";
        if (textInput) {
          userPromptText += `\n\nSales material to decode:\n"""\n${textInput}\n"""`;
        }
        contents.push({ text: userPromptText });
      }
    } else {
      let userPromptText = "Analyze this daily sales statement or screen extract, and reconstruct the structured items database.";
      if (textInput) {
        userPromptText += `\n\nSales material to decode:\n"""\n${textInput}\n"""`;
      }
      contents.push({ text: userPromptText });
    }

    const response = await generateContentWithRetryAndFallback({
      model: "gemini-3.8-flash",
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING, description: "Sales log date in format YYYY-MM-DD" },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  recipeName: { type: Type.STRING, description: "The standardized name/description of the dish or food item" },
                  quantitySold: { type: Type.NUMBER, description: "Total quantity/portions sold" },
                  sellingPrice: { type: Type.NUMBER, description: "Optional. Single portion selling price" },
                  costPerPortion: { type: Type.NUMBER, description: "Optional. Indicated ingredient cost per portion" },
                  totalRevenue: { type: Type.NUMBER, description: "Optional. Total gross revenue from this item" },
                  totalCost: { type: Type.NUMBER, description: "Optional. Total ingredient cost of goods sold" }
                },
                required: ["recipeName", "quantitySold"]
              },
              description: "Parsed list of daily sales per menu item"
            }
          },
          required: ["items"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      res.status(500).json({ error: "Gemini did not return any parse content" });
      return;
    }

    try {
      const parsedData = JSON.parse(resultText);
      res.json(parsedData);
    } catch (parseErr) {
      console.error("Failed to parse response JSON from Gemini:", resultText);
      res.status(500).json({ error: "Invalid JSON structure returned from AI", details: resultText });
    }

  } catch (error: any) {
    console.error("Error in AI Sales Parsing:", error);
    const errMsg = error.message || "";
    const errStr = (errMsg + " " + JSON.stringify(error)).toLowerCase();
    const isQuotaExceeded = 
      errStr.includes("429") || 
      errStr.includes("quota") || 
      errStr.includes("exhausted") || 
      errStr.includes("resource_exhausted") ||
      errStr.includes("limit exceeded");

    if (isQuotaExceeded) {
      res.status(429).json({
        error: "AI Quota Exhausted (429)",
        message: "You have exceeded your Gemini free-tier quota. Please try parsing text directly, configure a Paid API Key in 'Settings > Secrets', or try again tomorrow."
      });
    } else {
      res.status(500).json({ error: error.message || "An unexpected error occurred during sales parsing" });
    }
  }
});

// AI Inventory Batch Parser Endpoint
app.post("/api/parse-inventory-batch", async (req: express.Request, res: express.Response) => {
  try {
    const { documentText, departments, targetDepartment, targetVendor } = req.body;

    if (!documentText) {
      res.status(400).json({ error: "Missing documentText" });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: "GEMINI_API_KEY is not configured in environment" });
      return;
    }

    const registeredDepts = Array.isArray(departments) && departments.length > 0
      ? departments
      : ["Meat", "Produce", "Seafood", "Dairy", "Dry Goods", "Beverages", "Alcohol", "Packaging", "Cleaning"];
    
    const registeredDeptsStr = registeredDepts.join(", ");
    const defaultDept = targetDepartment && targetDepartment !== "AUTO" ? targetDepartment : (registeredDepts[0] || "Dry Goods");

    const systemPrompt = `You are an expert restaurant inventory manager and data entry specialist.
Your job is to read and parse one or more raw invoices, supplier lists, or inventory prep sheets.
Identify and extract all inventory items described in the text.

For each item, extract:
1. name: Standardized clean name of the ingredient or supply.
2. department: MUST match one of the user's registered departments if possible: [${registeredDeptsStr}]. ${targetDepartment && targetDepartment !== "AUTO" ? `The user specifically selected target department "${targetDepartment}". Assign all items to "${targetDepartment}".` : `Assign the item to the closest registered department based on context and type. If unstated or unclear, default to "${defaultDept}".`}
3. vendor: The supplier or vendor name. ${targetVendor ? `Default to "${targetVendor}" if not explicitly mentioned.` : 'Extract if mentioned, otherwise leave empty.'}
4. quantity: The numeric quantity extracted (e.g. 5, 10.5). If not stated, default to 0.
5. unit: The packaging or base unit (e.g. "case", "lb", "kg", "gal", "ea"). If unstated, default to "ea".
6. price: The total price or unit price (if clearly stated).
7. rawText: The raw line item text for auditing purposes.

Make intelligent assumptions for categories based on standard restaurant conventions.

Return ONLY a structured JSON conforming to the requested schema. No conversational preamble, markdown blocks, or footnotes.`;

    const userPrompt = `Parse this inventory document text:
"""
${documentText}
"""
Registered Departments in system:
[${registeredDeptsStr}]`;

    const response = await generateContentWithRetryAndFallback({
      model: "gemini-3.8-flash",
      contents: [{ text: userPrompt }],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              description: "Array of parsed inventory items extracted from raw text input",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Standard clean item name" },
                  department: { type: Type.STRING, description: "The restaurant department" },
                  vendor: { type: Type.STRING, description: "The supplier or vendor" },
                  quantity: { type: Type.NUMBER, description: "The numeric quantity parsed" },
                  unit: { type: Type.STRING, description: "The raw unit used (e.g. case, lb, ea)" },
                  price: { type: Type.NUMBER, description: "The price extracted" },
                  rawText: { type: Type.STRING, description: "Raw line item text from document" }
                },
                required: ["name", "department", "vendor", "quantity", "unit", "price", "rawText"]
              }
            }
          },
          required: ["items"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      res.status(500).json({ error: "Gemini did not return any inventory parsed content" });
      return;
    }

    try {
      const parsedData = JSON.parse(resultText);
      res.json(parsedData);
    } catch (parseErr) {
      console.error("Failed to parse response JSON from Gemini:", resultText);
      res.status(500).json({ error: "Invalid JSON structure returned from AI", details: resultText });
    }

  } catch (error: any) {
    console.error("Error in AI Inventory Parsing:", error);
    const errMsg = error.message || "";
    const errStr = (errMsg + " " + JSON.stringify(error)).toLowerCase();
    const isQuotaExceeded = 
      errStr.includes("429") || 
      errStr.includes("quota") || 
      errStr.includes("exhausted") || 
      errStr.includes("resource_exhausted") ||
      errStr.includes("limit exceeded");

    if (isQuotaExceeded) {
      res.status(429).json({
        error: "AI Quota Exhausted (429)",
        message: "You have exceeded your Gemini free-tier quota. Please try a shorter recipe description or copy-paste simpler text, configure a Paid API Key in 'Settings > Secrets', or try again tomorrow."
      });
    } else {
      res.status(500).json({ error: error.message || "An unexpected error occurred during recipe parsing" });
    }
  }
});

// Endpoint to send email invitation
app.post("/api/send-invite-email", async (req: express.Request, res: express.Response) => {
  try {
    const { invitedEmail, role, ownerEmail, appUrl } = req.body;
    if (!invitedEmail || !role || !ownerEmail) {
      res.status(400).json({ error: "Missing invitedEmail, role, or ownerEmail" });
      return;
    }

    console.log(`[Email Service] Attempting to send workspace invitation to ${invitedEmail} as role: "${role}"...`);

    const hasSmtpConfig = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

    let transporter;
    if (hasSmtpConfig) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false // Ignore certificate validation errors (very common for custom SMTP relays)
        },
        connectionTimeout: 6000, // 6 seconds timeout
        greetingTimeout: 6000,   // 6 seconds timeout
        socketTimeout: 8000      // 8 seconds timeout
      });
    } else {
      console.warn("[Email Service] SMTP configuration is incomplete. Falling back to development mock log sending...");
    }

    const invitationLink = appUrl || process.env.APP_URL || "https://supplypilot.space/";
    const mailSubject = `Invitation to collaborate on SupplyPilot Store Workspace`;
    const mailHtml = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; border: 1px solid #141414; color: #141414; background-color: #ffffff;">
        <h2 style="font-size: 18px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 2px solid #141414; padding-bottom: 15px; margin-top: 0; color: #1d4ed8;">
          SUPPLYPILOT - SMA MANAGEMENT SYSTEM
        </h2>
        <p style="font-size: 14px; line-height: 1.6; margin-top: 25px;">
          Hello,
        </p>
        <p style="font-size: 14px; line-height: 1.6;">
          <strong>${ownerEmail}</strong> has invited you to join their food operations & inventory workspace on SupplyPilot as an <strong>${role.toUpperCase()}</strong>.
        </p>
        <p style="font-size: 14px; line-height: 1.6;">
          As an <strong>${role}</strong>, you will have specific permissions to audit, analyze, or modify culinary recipes, ingredient costs, inventory sheets, store rosters, and timesheets.
        </p>
        <div style="margin: 35px 0; text-align: left;">
          <a href="${invitationLink}" style="display: inline-block; background-color: #1d4ed8; color: #ffffff; text-decoration: none; padding: 12px 24px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; border-radius: 8px;">
            Accept Invitation & Access Workspace
          </a>
        </div>
        <p style="font-size: 11px; color: #737373; line-height: 1.6; border-top: 1px dashed #e5e5e5; padding-top: 20px; margin-top: 35px;">
          Access your workspace at <a href="https://supplypilot.space/" style="color: #1d4ed8;">https://supplypilot.space/</a>. If you did not expect this invitation, you can safely ignore this email.
        </p>
      </div>
    `;

    if (transporter) {
      const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
      try {
        await transporter.sendMail({
          from: `"SupplyPilot Workspace" <${fromEmail}>`,
          to: invitedEmail,
          subject: mailSubject,
          html: mailHtml,
        });
        console.log(`[Email Service] Live email sent successfully to ${invitedEmail}`);
        res.json({ success: true, mode: "smtp" });
      } catch (smtpErr: any) {
        console.warn(`[Email Service] Live email sending failed via SMTP (${smtpErr.message}). Falling back to logging simulated email to console...`);
        console.log("==================== SIMULATED EMAIL INVITATION (FALLBACK) ====================");
        console.log(`To: ${invitedEmail}`);
        console.log(`Subject: ${mailSubject}`);
        console.log(`Body (HTML length): ${mailHtml.length} characters`);
        console.log("SMTP Error details:", smtpErr);
        console.log("===============================================================================");
        res.json({
          success: true,
          mode: "simulated_fallback",
          message: `The collaboration invitation has been set up successfully in the database. However, the direct email notification could not be dispatched because the SMTP connection failed: "${smtpErr.message}". The notification details have been logged to the server console.`
        });
      }
    } else {
      console.log("==================== SIMULATED EMAIL INVITATION ====================");
      console.log(`To: ${invitedEmail}`);
      console.log(`Subject: ${mailSubject}`);
      console.log(`Body (HTML length): ${mailHtml.length} characters`);
      console.log("====================================================================");
      res.json({ 
        success: true, 
        mode: "simulated",
        message: "SMTP is not configured in .env. Falling back to local logging. The email content has been printed to the container server log." 
      });
    }

  } catch (error: any) {
    console.error("[Email Service] Failure during invitation email dispatch:", error);
    res.status(500).json({ error: error.message || "Failed to process invitation email" });
  }
});

// Global error handler for API routes
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path.startsWith('/api/')) {
    console.error("API Error encountered:", err);
    res.status(err.status || 500).json({ error: err.message || "Internal server error" });
  } else {
    next(err);
  }
});

  app.post("/api/auto-categorize-items", async (req: express.Request, res: express.Response) => {
    // Local Heuristic Categorization Fallback function
    function heuristicCategorize(itemsToCat: { id: string, name: string }[]) {
      return itemsToCat.map(item => {
        const name = item.name.toLowerCase();
        let category = "Other";
        
        if (/\b(beef|pork|chicken|poultry|turkey|bacon|sausage|meat|ham|pepperoni|steak|lamb|veal|salami|prosciutto|chorizo|rib|wing|breast|thigh|drumstick|meatball|mutton|patty|bologna|frankfurter|hot dog|wagyu|ribeye|tenderloin|sirloin)\b/i.test(name)) {
          category = "Meat";
        }
        else if (/\b(salmon|shrimp|prawn|tuna|fish|clam|octopus|crab|lobster|cod|trout|halibut|seafood|snapper|sardine|anchovy|scallop|oyster|mussel|calamari|squid)\b/i.test(name)) {
          category = "Seafood";
        }
        else if (/\b(onion|garlic|tomato|potato|lettuce|salad|spinach|carrot|celery|cucumber|pepper|mushroom|broccoli|cabbage|ginger|lemon|lime|fruit|berry|apple|avocado|basil|cilantro|parsley|herb|mint|rosemary|thyme|dill|oregano|greens|kale|cauliflower|squash|zucchini|leek|scallion|chive|corn|pea|bean|sprout|radish|beet|turnip|parsnip|sweet potato|yam|pumpkin|banana|orange|grape|strawberry|blueberry|raspberry|blackberry|peach|pear|plum|cherry|mango|pineapple|melon|watermelon)\b/i.test(name)) {
          category = "Vegetables";
        }
        else if (/\b(milk|cream|heavy cream|cheese|butter|yogurt|egg|cheddar|mozzarella|parmesan|ricotta|provolone|swiss|brie|gouda|feta|cottage|whey|margarine|mayo|mayonnaise)\b/i.test(name)) {
          category = "Dairy";
        }
        else if (/\b(roll|baguette|bagel|bun|bread|croissant|tortilla|pita|muffin|toast|dough|crust|loaf|flatbread|brioche|naan)\b/i.test(name)) {
          category = "Bread";
        }
        else if (/\b(water|soda|juice|coffee|tea|syrup|puree|beer|wine|liquor|coke|sprite|fanta|beverage|drink|cider|ale|lager|whiskey|vodka|rum|tequila|gin|espresso|latte|capuccino|lemonade|tonic|club soda)\b/i.test(name)) {
          category = "Beverages";
        }
        else if (/\b(flour|sugar|salt|pepper|spice|rice|grain|pasta|oil|sauce|dressing|condiment|vinegar|noodle|canned|seed|nut|powder|vanilla|yeast|honey|mustard|ketchup|broth|stock|bouillon|marinade|soy sauce|teriyaki|pesto|salsa|seasoning|cinnamon|cumin|paprika|turmeric|chili|cocoa|chocolate|oat|cereal|bean|lentil|pea|almond|walnut|peanut|cashew|pecan)\b/i.test(name)) {
          category = "Dry Goods";
        }
        else if (/\b(box|container|bag|glove|chemical|cleaner|soap|paper|foil|wrap|napkin|fork|knife|spoon|plate|cup|lid|straw|detergent|bleach|sanitizer|sponge|towel|trash|bin|insert|pan|rack|tray|label|tape|marker)\b/i.test(name)) {
          category = "Other";
        }

        return { id: item.id, category };
      });
    }

    try {
      const { items } = req.body;
      if (!items || !Array.isArray(items)) {
        res.status(400).json({ error: "Missing or invalid items array" });
        return;
      }

      // Ensure every item has a valid, non-empty string ID and name
      const cleanItems = items.map((i, index) => ({
        id: String(i.id || `item-${index}`),
        name: String(i.name || "Unknown Item").trim()
      }));

      // If GEMINI_API_KEY is not configured or is a dummy placeholder, fall back immediately to heuristic categorization
      const apiKey = process.env.GEMINI_API_KEY;
      const isDummyKey = !apiKey || 
                         apiKey.trim() === "" || 
                         apiKey.includes("MY_GEMINI_API_KEY") || 
                         apiKey.includes("YOUR_API_KEY") ||
                         apiKey === "undefined";

      if (isDummyKey) {
        console.warn("[AI Parser] GEMINI_API_KEY is not configured or is a dummy placeholder. Falling back to local heuristic categorization.");
        res.json({ categories: heuristicCategorize(cleanItems) });
        return;
      }

      const systemPrompt = `You are an expert restaurant management assistant.
Your job is to categorize restaurant raw food ingredients and item names.
For each item, classify its name into exactly one of these categories:
- Meat (for beef, pork, chicken, turkey, bacon, sausages, meatballs, ham, etc.)
- Vegetables (for all fresh/frozen produce, onions, garlic, herbs, potatoes, salads, lettuce, fruits, etc.)
- Bread (for rolls, baguettes, bagels, hamburger buns, sliced bread, croissants, flour-based bakery, tortillas, etc.)
- Seafood (for salmon, shrimp, clams, tuna, fish, octopus, crab, etc.)
- Dairy (for milk, heavy cream, cheeses, butter, yogurt, sour cream, eggs, egg yolks, etc.)
- Dry Goods (for dry flour, sugar, salt, pepper, spices, rice, grains, pasta, oils, sauces, dressings, condiments, vinegar, noodles, canned goods, etc.)
- Beverages (for water, sodas, juices, coffee, tea, syrups, purees, beers, liquors, etc.)
- Other (for containers, boxes, paper goods, gloves, chemicals, non-food items, or anything that doesn't fit the above)

You must return a JSON object with a single property "categories" which is an array of objects. Each object in the array must have:
- "id": The item's unique id (as provided in the input)
- "category": One of the exact strings: "Meat", "Vegetables", "Bread", "Seafood", "Dairy", "Dry Goods", "Beverages", "Other"

Do not include any text outside the JSON output.`;

      const userPrompt = `Categorize these ingredients:
${JSON.stringify(cleanItems)}`;

      let resultText = "";
      try {
        console.log("[AI Parser] Attempting auto-categorize with responseSchema...");
        const response = await generateContentWithRetryAndFallback({
          model: "gemini-3.7-flash",
          contents: [{ text: userPrompt }],
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                categories: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      category: { type: Type.STRING }
                    },
                    required: ["id", "category"]
                  }
                }
              },
              required: ["categories"]
            }
          }
        });
        resultText = response.text || "";
      } catch (schemaErr: any) {
        console.warn("[AI Parser] responseSchema call failed, falling back to prompt-guided JSON...", schemaErr);
        // Fallback: Ask for raw JSON inside the prompt, without schema validation
        const fallbackPrompt = `${systemPrompt}\n\nCategorize these ingredients and return a pure JSON string with the specified structure. Do not use markdown backticks.\n\nIngredients:\n${JSON.stringify(cleanItems)}`;
        const response = await generateContentWithRetryAndFallback({
          model: "gemini-3.7-flash",
          contents: [{ text: fallbackPrompt }]
        });
        resultText = response.text || "";
      }

      if (!resultText) {
        throw new Error("Gemini did not return any category content");
      }

      try {
        // Clean markdown backticks if any were returned in fallback
        let cleaned = resultText.trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        }
        const parsed = JSON.parse(cleaned);
        res.json(parsed);
      } catch (parseErr) {
        console.error("Failed to parse response JSON from Gemini:", resultText);
        throw new Error("Invalid JSON structure returned from AI");
      }
    } catch (error: any) {
      console.error("AI Auto-categorization error, falling back to heuristic local parser:", error);
      try {
        // Local heuristic fallback on error
        const cleanItems = (req.body.items || []).map((i: any, index: number) => ({
          id: String(i.id || `item-${index}`),
          name: String(i.name || "Unknown Item").trim()
        }));
        res.json({ categories: heuristicCategorize(cleanItems) });
      } catch (fallbackErr) {
        res.status(500).json({ error: "Failed to auto-categorize items" });
      }
    }
  });

  app.post("/api/translate-ingredients", async (req: express.Request, res: express.Response) => {
    // Local Heuristic Translation Fallback function
    function heuristicTranslate(itemsToTranslate: { id: string, name: string }[]) {
      const dictionary: { [key: string]: string } = {
        "beef": "carne de res",
        "ground beef": "carne molida",
        "chicken": "pollo",
        "chicken breast": "pechuga de pollo",
        "chicken thigh": "muslo de pollo",
        "chicken wing": "ala de pollo",
        "pork": "puerco",
        "pork loin": "lomo de cerdo",
        "pork butt": "bondiola de cerdo",
        "bacon": "tocino",
        "diced bacon": "tocino en dados",
        "turkey": "pavo",
        "ham": "jamón",
        "sausage": "salchicha",
        "meatball": "albóndiga",
        "pepperoni": "pepperoni",
        "steak": "filete",
        "chorizo": "chorizo",
        "rib": "costilla",
        "salmon": "salmón",
        "shrimp": "camarón",
        "tuna": "atún",
        "fish": "pescado",
        "clam": "almeja",
        "crab": "cangrejo",
        "lobster": "langosta",
        "onion": "cebolla",
        "red onion": "cebolla roja",
        "garlic": "ajo",
        "tomato": "tomate",
        "potato": "papa",
        "lettuce": "lechuga",
        "salad": "ensalada",
        "spinach": "espinaca",
        "carrot": "zanahoria",
        "celery": "apio",
        "cucumber": "pepino",
        "pepper": "pimiento",
        "mushroom": "champiñón",
        "broccoli": "brócoli",
        "cabbage": "repollo",
        "ginger": "jengibre",
        "lemon": "limón amarillo",
        "lime": "limón verde",
        "avocado": "aguacate",
        "basil": "albahaca",
        "cilantro": "cilantro",
        "parsley": "perejil",
        "mint": "menta",
        "rosemary": "romero",
        "thyme": "tomillo",
        "milk": "leche",
        "cream": "crema",
        "heavy cream": "crema espesa",
        "cheese": "queso",
        "cheddar": "cheddar",
        "mozzarella": "mozzarella",
        "parmesan": "parmesano",
        "butter": "mantequilla",
        "yogurt": "yogur",
        "egg": "huevo",
        "eggs": "huevos",
        "roll": "pan de rollo",
        "baguette": "baguette",
        "bagel": "bagel",
        "bun": "pan de hamburguesa",
        "bread": "pan",
        "croissant": "cruasán",
        "tortilla": "tortilla",
        "flour": "harina",
        "sugar": "azúcar",
        "salt": "sal",
        "black pepper": "pimienta negra",
        "spice": "especia",
        "rice": "arroz",
        "pasta": "pasta",
        "oil": "aceite",
        "olive oil": "aceite de oliva",
        "sauce": "salsa",
        "dressing": "aderezo",
        "vinegar": "vinagre",
        "noodle": "fideo",
        "water": "agua",
        "soda": "refresco",
        "juice": "jugo",
        "orange juice": "jugo de naranja",
        "coffee": "café",
        "tea": "té",
        "beer": "cerveza",
        "wine": "vino",
        "liquor": "licor"
      };

      return itemsToTranslate.map(item => {
        const clean = item.name.toLowerCase().trim();
        let translation = "";
        
        if (dictionary[clean]) {
          translation = dictionary[clean];
        } else {
          const words = clean.split(/\s+/);
          const translatedWords = words.map(w => dictionary[w] || w);
          const combined = translatedWords.join(" ");
          translation = combined.charAt(0).toUpperCase() + combined.slice(1);
        }
        translation = translation.charAt(0).toUpperCase() + translation.slice(1);
        return { id: item.id, translation };
      });
    }

    try {
      const { items } = req.body;
      if (!items || !Array.isArray(items)) {
        res.status(400).json({ error: "Missing or invalid items array" });
        return;
      }

      // Ensure every item has a valid, non-empty string ID and name
      const cleanItems = items.map((i, index) => ({
        id: String(i.id || `item-${index}`),
        name: String(i.name || "Unknown Item").trim()
      }));

      // If GEMINI_API_KEY is not configured or is a dummy placeholder, fall back immediately to heuristic translation
      const apiKey = process.env.GEMINI_API_KEY;
      const isDummyKey = !apiKey || 
                         apiKey.trim() === "" || 
                         apiKey.includes("MY_GEMINI_API_KEY") || 
                         apiKey.includes("YOUR_API_KEY") ||
                         apiKey === "undefined";

      if (isDummyKey) {
        console.warn("[AI Parser] GEMINI_API_KEY is not configured or is a dummy placeholder. Falling back to local heuristic translation.");
        res.json({ translations: heuristicTranslate(cleanItems) });
        return;
      }

      const systemPrompt = `You are an expert culinary translation assistant.
Your job is to translate restaurant raw food ingredients, supplies, or culinary items from English to Spanish.
Provide natural, commonly used Spanish terms in commercial kitchens (e.g. translate "Diced Bacon 1/4" to "Tocino en dados 1/4", "Ground Beef" to "Carne molida", etc.).
Do not change brand names, size measurements (like 1/4, 10lb, etc.), or codes if they are part of the name.

You must return a JSON object with a single property "translations" which is an array of objects. Each object in the array must have:
- "id": The item's unique id (as provided in the input)
- "translation": The Spanish translation of the ingredient name

Do not include any text outside the JSON output.`;

      const userPrompt = `Translate these ingredient names:
${JSON.stringify(cleanItems)}`;

      let resultText = "";
      try {
        console.log("[AI Parser] Attempting translation with responseSchema...");
        const response = await generateContentWithRetryAndFallback({
          model: "gemini-3.8-flash",
          contents: [{ text: userPrompt }],
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                translations: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      translation: { type: Type.STRING }
                    },
                    required: ["id", "translation"]
                  }
                }
              },
              required: ["translations"]
            }
          }
        });
        resultText = response.text || "";
      } catch (schemaErr: any) {
        console.warn("[AI Parser] responseSchema call failed, falling back to prompt-guided JSON...", schemaErr);
        // Fallback: Ask for raw JSON inside the prompt, without schema validation
        const fallbackPrompt = `${systemPrompt}\n\nTranslate these ingredients and return a pure JSON string with the specified structure. Do not use markdown backticks.\n\nIngredients:\n${JSON.stringify(cleanItems)}`;
        const response = await generateContentWithRetryAndFallback({
          model: "gemini-3.8-flash",
          contents: [{ text: fallbackPrompt }]
        });
        resultText = response.text || "";
      }

      if (!resultText) {
        throw new Error("Gemini did not return any translation content");
      }

      try {
        // Clean markdown backticks if any were returned in fallback
        let cleaned = resultText.trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        }
        const parsed = JSON.parse(cleaned);
        res.json(parsed);
      } catch (parseErr) {
        console.error("Failed to parse response JSON from Gemini:", resultText);
        throw new Error("Invalid JSON structure returned from AI");
      }
    } catch (error: any) {
      console.error("AI Translation error, falling back to heuristic local parser:", error);
      try {
        // Local heuristic fallback on error
        const cleanItems = (req.body.items || []).map((i: any, index: number) => ({
          id: String(i.id || `item-${index}`),
          name: String(i.name || "Unknown Item").trim()
        }));
        res.json({ translations: heuristicTranslate(cleanItems) });
      } catch (fallbackErr) {
        res.status(500).json({ error: "Failed to translate items" });
      }
    }
  });

  app.post("/api/ai/recognize-item", async (req: express.Request, res: express.Response) => {
    try {
      const { imageBase64, itemNames } = req.body;
      if (!imageBase64) {
        res.status(400).json({ error: "Missing imageBase64" });
        return;
      }
      
      const apiKey = process.env.GEMINI_API_KEY;
      const isDummyKey = !apiKey || apiKey.trim() === "" || apiKey.includes("MY_GEMINI_API_KEY") || apiKey === "undefined";
      if (isDummyKey) {
        res.status(400).json({ error: "Gemini API key is not configured" });
        return;
      }

      const systemPrompt = `You are an AI assistant that recognizes culinary items, ingredients, and restaurant supplies from images.
The user will provide an image of an item.
You also have the following list of known items in the system's catalog:
${JSON.stringify(itemNames)}

Your task:
1. Identify the primary item in the image.
2. Check if the identified item closely matches any item from the provided catalog list.
3. If there is a match, return the exact name from the catalog list.
4. If there is no good match in the catalog, return a concise generic name for the item.

Return a JSON object matching this schema:
{
  "recognizedName": "Exact name from catalog or generic name if not found",
  "matchedCatalog": true | false
}
Return ONLY valid JSON.`;

      const ai = getAIClient();
      const response = await generateContentWithRetryAndFallback({
        model: "gemini-3.8-flash",
        contents: [
          { text: "Please recognize the item in this image." },
          { inlineData: { data: imageBase64, mimeType: "image/jpeg" } }
        ],
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          temperature: 0.1,
        }
      });
      
      const text = response.text;
      if (text) {
        const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanText);
        res.json(parsed);
      } else {
        res.status(500).json({ error: "Failed to recognize item" });
      }
    } catch (error: any) {
      console.error("AI recognize item error:", error);
      res.status(500).json({ error: error.message || "Failed to process AI request" });
    }
  });

  app.post("/api/parse-recipe-text", async (req: express.Request, res: express.Response) => {
    try {
      const { text, department, targetFoodCostMargin, masterIngredients, existingRecipes } = req.body;
      
      if (!text || typeof text !== "string" || !text.trim()) {
        res.status(400).json({ error: "Missing required recipe text content." });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({ error: "GEMINI_API_KEY is not configured in environment." });
        return;
      }

      // Catalog overview for context
      const catalogSummary = Array.isArray(masterIngredients)
        ? masterIngredients.slice(0, 250).map((ing: any) => ({
            id: ing.id,
            name: ing.name,
            unit: ing.unit,
            price: ing.price,
            quantity: ing.quantity,
            pricePerGram: ing.pricePerGram
          }))
        : [];

      const subRecipeSummary = Array.isArray(existingRecipes)
        ? existingRecipes.slice(0, 100).map((rec: any) => ({
            id: rec.id,
            name: rec.name,
            department: rec.department,
            sellingPrice: rec.sellingPrice
          }))
        : [];

      const systemPrompt = `You are an executive master chef, certified culinary arts director, and professional restaurant food cost accountant.
Your task is to analyze raw culinary text, handwritten kitchen notes, menu descriptions, prep lists, or ingredient rosters, and construct one or more complete, standardized Culinary Recipe Cost Sheets.

Rules & Guidelines:
1. Multi-Recipe Support: If the input text contains multiple recipes or a full menu breakdown, parse each one as an individual recipe object inside the "recipes" array. If it is a single recipe, return an array with 1 recipe object.
2. Recipe Attributes:
   - "recipeName": Clean, professional culinary dish name (e.g., 'Artisan Margherita Pizza', 'Pan-Seared Ribeye with Herb Butter', 'Valrhona Chocolate Lava Cake', 'San Marzano Pizza Sauce Base').
   - "isSubRecipe": Boolean. Set to true if this recipe is a sub-recipe / prep batch / sauce base / dressing / dough / stock rather than a finished customer-facing menu item.
   - "department": Categorize into kitchen departments such as 'Kitchen', 'Bakery', 'Bar', 'Pastry', 'Grill', 'Prep', 'Pantry'. If a target department was specified ('${department || "AUTO"}' !== 'AUTO'), prefer using that or appropriately aligning it.
   - "expectedYield": Number of finished portions/servings made by this batch (integer or decimal >= 1). If not stated in text, infer a standard portion size (default 1).
   - "sellingPrice": Recommended or explicit menu sale price ($ per portion). If this is a sub-recipe or prep batch with no direct customer sale price, set sellingPrice to 0. If it's a finished menu dish and specified in text, preserve it; otherwise estimate a realistic price based on target food cost margin (~${targetFoodCostMargin || 30}%).
   - "instructions": Structured summary of prep and cooking method steps if provided in text.
   - "notes": Chef guidance, allergen declarations (e.g. 'Contains Dairy, Tree Nuts, Gluten'), holding temperatures, or yield notes.
3. Ingredient Line Items & Weight Units:
   - "name": Clean, standard ingredient name without brand codes or messy prep descriptions (e.g. 'Unsalted Butter' instead of '1lb LAND O LAKES BUTTER MELTED').
   - "rawText": Exact snippet or line from the user input (e.g. '2 cups all-purpose flour, sifted').
   - "unit": Standard culinary unit of measure.
   - **MANDATORY POUNDS (lbs) RULE FOR WEIGHTS**: If the item in the text is measured in weight/mass (such as grams 'g', kilograms 'kg', ounces 'oz', or pounds 'lb'/'lbs'), ALWAYS convert and standardize the unit to 'lbs' and provide the quantity converted to decimal pounds (e.g., 500g -> ~1.102 lbs; 24 oz -> 1.5 lbs; 800g -> 1.764 lbs; 200g -> 0.441 lbs; 10g -> 0.022 lbs). For liquid volumes (ml, L, fl oz, cup, tbsp, tsp, qt, gal) or piece counts / discrete units (pcs, slice, clove, bunch, egg, can, bottle, portion), preserve their natural culinary unit.
   - "quantity": Parsed numeric quantity required for the recipe. For weight items, this must be in 'lbs' (e.g. 1.5, 0.25, 1.102).
   - "grams": Estimated standardized mass in grams, volume in mL, or piece count (e.g., 1 cup flour ~ 125g, 1 lb ~ 453.6g, 1 tbsp olive oil ~ 14g, 1 tsp salt ~ 5.7g, 1 egg ~ 1 pcs).
   - "matchedIngredientName": If this item matches or is equivalent to one of the Master Catalog Ingredients listed below, provide the EXACT matched catalog ingredient name.
   - "matchedIngredientId": If matched to catalog, provide the matched catalog ingredient ID.
   - "isSubRecipe": Boolean. True if this component is a pre-made sub-recipe (e.g. 'Pizza Sauce Base', 'Hollandaise Sauce', 'Caesar Dressing') matching existing sub-recipes or culinary prep batches.
   - "matchedSubRecipeId": If matched to an existing sub-recipe, provide its ID.

Master Ingredients Catalog for Exact Matching:
${JSON.stringify(catalogSummary, null, 2)}

Existing Sub-Recipes for Matching:
${JSON.stringify(subRecipeSummary, null, 2)}

Return ONLY a valid JSON object matching the requested schema.`;

      const response = await generateContentWithRetryAndFallback({
        model: "gemini-3.8-flash",
        contents: [
          {
            text: `Analyze and convert the following culinary text into structured Recipe Cost Sheet(s):\n\n"""\n${text.trim()}\n"""`
          }
        ],
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recipes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    recipeName: { type: Type.STRING, description: "Culinary name of the dish or recipe" },
                    isSubRecipe: { type: Type.BOOLEAN, description: "Whether this recipe is a sub-recipe / prep batch / sauce base" },
                    department: { type: Type.STRING, description: "Department or category (Kitchen, Bakery, Bar, Pastry, etc.)" },
                    expectedYield: { type: Type.NUMBER, description: "Portions or servings yielded (>= 1)" },
                    sellingPrice: { type: Type.NUMBER, description: "Estimated or stated menu sale price per portion ($)" },
                    instructions: { type: Type.STRING, description: "Cooking, prep, or assembly instructions" },
                    notes: { type: Type.STRING, description: "Chef notes, allergen flags, or prep tips" },
                    items: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING, description: "Standard ingredient name" },
                          rawText: { type: Type.STRING, description: "Original text segment from user input" },
                          quantity: { type: Type.NUMBER, description: "Quantity required" },
                          unit: { type: Type.STRING, description: "Unit of measure (g, oz, lb, cup, tbsp, tsp, ml, etc.)" },
                          grams: { type: Type.NUMBER, description: "Estimated base weight in grams, volume in ml, or unit count" },
                          matchedIngredientName: { type: Type.STRING, description: "Name of matched catalog ingredient if found" },
                          matchedIngredientId: { type: Type.STRING, description: "ID of matched catalog ingredient if found" },
                          isSubRecipe: { type: Type.BOOLEAN, description: "Whether this item is a sub-recipe" },
                          matchedSubRecipeId: { type: Type.STRING, description: "ID of matched sub-recipe if found" }
                        },
                        required: ["name", "quantity", "unit", "grams"]
                      },
                      description: "List of recipe ingredients and components"
                    }
                  },
                  required: ["recipeName", "expectedYield", "sellingPrice", "items"]
                },
                description: "Array of parsed culinary recipes"
              }
            },
            required: ["recipes"]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        res.status(500).json({ error: "Gemini did not return any parse content" });
        return;
      }

      try {
        const parsed = JSON.parse(responseText);
        res.json(parsed);
      } catch (parseErr) {
        console.error("Failed to parse recipe JSON from Gemini response:", responseText);
        res.status(500).json({ error: "Invalid JSON response from AI model", details: responseText });
      }
    } catch (error: any) {
      console.error("AI Recipe Parser error:", error);
      res.status(500).json({ error: error.message || "Failed to parse recipe from text." });
    }
  });

  app.post("/api/ai-assistant", async (req: express.Request, res: express.Response) => {
  try {
    const { prompt, context, itemNames } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const systemPrompt = `You are an AI assistant for a restaurant management system.
The user is currently in the "${context}" view.
They provided a natural language prompt: "${prompt}"
Existing items in their database (names only): ${JSON.stringify(itemNames)}

Decide if the user wants to SEARCH/FILTER the existing items, or ADD new items based on their prompt.
If they want to search, identify the relevant keywords or item names they are looking for (e.g. if they say "dairy", you might return ["milk", "cheese", "cream"] based on the existing items).
If they want to add, parse the details into the 'newItems' array.

Return a JSON object matching this schema:
{
  "action": "search" | "add",
  "searchTerms": ["term1", "term2"], // if action is search. Return a list of strings to populate the search bar.
  "newItems": [ // if action is add. Best-effort extraction.
    {
      "name": "Item Name",
      "quantity": 10, // number
      "price": 50.0, // number, total price
      "unit": "case", // string
      "weightPerCase": 5, // number
      "weightPerCaseUnit": "lb" // string
    }
  ]
}
Return ONLY valid JSON.`;

    const ai = getAIClient();
    const response = await generateContentWithRetryAndFallback({
      model: "gemini-3.8-flash",
      contents: [{ text: "Please process this request." }],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        temperature: 0.1,
      }
    });

    const text = response.text;
    if (text) {
      const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanText);
      return res.json(parsed);
    }

  } catch (error: any) {
    console.error("AI Assistant error:", error);
    res.status(500).json({ error: error.message || "Failed to process AI request" });
  }
});

  app.post("/api/chatbot-query", async (req: express.Request, res: express.Response) => {
    try {
      const { message, history, workspaceOwnerId, dataContext } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Missing message" });
      }

      const enrichedContext: Record<string, any> = { ...(dataContext || {}) };

      // Ensure backend Cloud SQL transactions for consumption and stock inventory are always included
      if (workspaceOwnerId) {
        try {
          const [sqlConsumptions, sqlCountSheets, sqlIngredients] = await Promise.all([
            listCloudSqlCollection("inventory_consumptions", workspaceOwnerId),
            listCloudSqlCollection("inventory_counts", workspaceOwnerId),
            listCloudSqlCollection("ingredients", workspaceOwnerId),
          ]);

          if (
            sqlConsumptions.length > 0 &&
            (!Array.isArray(enrichedContext.consumptionTransactions) ||
              enrichedContext.consumptionTransactions.length < sqlConsumptions.length)
          ) {
            enrichedContext.consumptionTransactions = sqlConsumptions.map((log: any) => ({
              id: log.id,
              date: log.date,
              createdAt: log.createdAt,
              itemType: log.itemType,
              itemName: log.itemName,
              quantity: log.quantity,
              unit: log.unit || (log.itemType === "recipe" ? "servings" : "unit"),
              foodCostTotal: Number((Number(log.totalCost) || 0).toFixed(2)),
              costPerUnit: log.costPerUnit ? Number(Number(log.costPerUnit).toFixed(2)) : null,
              staffName: log.staffName || null,
              notes: log.notes || null,
              ingredientDeductions: (log.deductions || []).map((d: any) => ({
                ingredientName: d.ingredientName,
                deductedQuantity: d.deductedQuantity,
                unit: d.unit,
              })),
            }));
          }

          if (
            sqlCountSheets.length > 0 &&
            (!Array.isArray(enrichedContext.stocktakeCountSheets) ||
              enrichedContext.stocktakeCountSheets.length < sqlCountSheets.length)
          ) {
            enrichedContext.stocktakeCountSheets = sqlCountSheets.map((sheet: any) => ({
              id: sheet.id,
              date: sheet.date,
              notes: sheet.notes || null,
              totalSheetValue: Number((Number(sheet.totalValue) || 0).toFixed(2)),
              itemsCounted: (sheet.items || []).map((it: any) => ({
                ingredientName: it.ingredientName,
                vendor: it.vendor || null,
                countedQty: it.countedQty,
                unit: it.unit,
                pricePerUnit: it.pricePerUnit,
                totalValue: it.totalValue,
              })),
            }));
          }

          if (
            sqlIngredients.length > 0 &&
            (!Array.isArray(enrichedContext.stockInventory) ||
              enrichedContext.stockInventory.length === 0)
          ) {
            enrichedContext.stockInventory = sqlIngredients;
          }
        } catch (sqlErr) {
          console.warn("Chatbot Cloud SQL context enrichment warning:", sqlErr);
        }
      }

      const systemPrompt = `You are an expert Restaurant Financial & Inventory AI Assistant built directly into a Restaurant Management System.
You have complete, real-time access to every transaction in the restaurant's database, including:
1. **Food Cost Summary Metrics (\`foodCostSummaryMetrics\`)**:
   - \`totalConsumptionFoodCost\`: Total dollar food cost of all logged consumption transactions.
   - \`totalOnHandInventoryValue\`: Current dollar valuation of all on-hand stock inventory.
   - \`latestStocktakeSheetValue\` & \`latestStocktakeDate\`: Most recent physical stocktake count sheet valuation.
   - \`totalInvoicePurchasesSpend\`, \`totalGroceryPurchasesSpend\`, \`totalCombinedPurchasesSpend\`: Total spend on vendor invoices and grocery runs.
   - \`totalRecordedSalesRevenue\`: Total daily sales revenue.
   - \`consumptionFoodCostPercentageOfSales\`: Actual food cost % calculated from consumption transactions divided by sales.
   - \`purchasesFoodCostPercentageOfSales\`: Purchases food cost % calculated from total invoice + grocery spend divided by sales.
2. **Consumption Ledger Transactions (\`consumptionTransactions\`)**:
   - Every single consumption/depletion transaction logged (both menu \`recipe\` portions sold/prepped and raw \`ingredient\` usage/waste).
   - Includes \`date\`, \`itemName\`, \`itemType\`, \`quantity\`, \`unit\`, \`foodCostTotal\` (exact dollar food cost of that transaction), \`costPerUnit\`, \`staffName\`, \`notes\`, and \`ingredientDeductions\` (exact raw ingredients deducted from stock).
3. **Stock Inventory (\`stockInventory\`) & Stocktake Count Sheets (\`stocktakeCountSheets\`)**:
   - Current \`inStock\` quantity, \`unit\`, \`registeredPackSize\`, \`inStockLbsEquivalent\`, \`pricePerPurchaseUnit\`, \`usabilityYieldPercent\`, and \`estimatedOnHandValue\` for every master ingredient.
   - Historical physical stocktake count sheets (\`stocktakeCountSheets\`) with \`date\`, \`totalSheetValue\`, and itemized \`itemsCounted\`.
4. **Recipe Food Cost Sheets (\`recipeFoodCostSheets\`)**:
   - Complete recipe costing including \`totalBatchCost\`, \`foodCostPerServing\`, \`sellingPrice\`, \`foodCostPercentage\`, \`profitMarginPercentage\`, and line-by-line ingredient cost breakdown.
5. **Vendor Invoices (\`invoices\`), Grocery Purchases (\`groceryPurchases\`), and Daily Sales (\`dailySales\`)**.

Here is the live snapshot of the restaurant's data (formatted as JSON):
---
${JSON.stringify(enrichedContext, null, 2)}
---

Guidelines for answering:
- When asked about **consumption**, **stock inventory**, or **food cost**, cite specific transactions, dates, quantities, registered pack sizes, dollar food costs, and food cost percentages from the data above.
- Clearly distinguish between **Recipe Theoretical Food Cost** (cost per serving & food cost % on menu price), **Consumption Ledger Food Cost** (exact dollar food cost of logged consumption transactions), **On-Hand Stock Inventory Value**, and **Purchase Spend Food Cost** (invoices + grocery purchases).
- Always be concise, accurate, and actionable. Do not hallucinate numbers that are not in the data.`;

      const ai = getAIClient();

      const contents = history ? [...history] : [];
      contents.push({ role: "user", parts: [{ text: message }] });

      const response = await generateContentWithRetryAndFallback({
        model: "gemini-3.8-flash",
        contents: contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.2,
        },
      });

      const text = response.text;
      if (text) {
        return res.json({ reply: text });
      }
      return res.status(500).json({ error: "Failed to generate reply" });
    } catch (error: any) {
      console.error("Chatbot query error:", error);
      res.status(500).json({ error: error.message || "Failed to process chat request" });
    }
  });

  // Cloud SQL Database User endpoints
  app.get("/api/users", requireAuth, async (req: AuthRequest, res) => {
    try {
      const users = await getUsers();
      res.json(users);
    } catch (error: any) {
      console.error("Failed to fetch users from Cloud SQL:", error);
      res.status(500).json({ error: error.message || "Failed to fetch users" });
    }
  });

  app.post("/api/users/sync", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user || !req.user.uid) {
        return res.status(401).json({ error: "Unauthorized: Missing user token details" });
      }
      const user = await getOrCreateUser(req.user.uid, req.user.email || "");
      res.json(user);
    } catch (error: any) {
      console.error("Failed to sync user to Cloud SQL:", error);
      res.status(500).json({ error: error.message || "Failed to sync user" });
    }
  });

  // Cloud SQL Relational Table Counts & Migration Endpoints
  app.get("/api/sql/counts", requireAuth, async (req: AuthRequest, res) => {
    try {
      const ownerId = String(req.query.ownerId || req.user?.uid || "default");
      const counts = await getCloudSqlTableCounts(ownerId);
      res.json({ counts });
    } catch (error: any) {
      console.error("Failed to fetch Cloud SQL counts:", error);
      res.status(500).json({ error: error.message || "Failed to fetch Cloud SQL counts" });
    }
  });

  app.post("/api/sql/migrate", requireAuth, async (req: AuthRequest, res) => {
    try {
      const ownerId = String(req.body.ownerId || req.user?.uid || "default");
      const collections = req.body.collections || {};
      const migratedCounts = await migrateWorkspaceBatchToCloudSql(ownerId, collections);
      const tableCounts = await getCloudSqlTableCounts(ownerId);
      res.json({
        success: true,
        migratedCounts,
        tableCounts,
      });
    } catch (error: any) {
      console.error("Failed to migrate data to Cloud SQL:", error);
      res.status(500).json({ error: error.message || "Failed to migrate data to Cloud SQL" });
    }
  });

  // Cloud SQL Collection CRUD Endpoints
  app.get("/api/sql/collection/:name", requireAuth, async (req: AuthRequest, res) => {
    try {
      const collectionName = req.params.name;
      const ownerId = req.query.ownerId ? String(req.query.ownerId) : undefined;
      const invitedEmail = req.query.invitedEmail ? String(req.query.invitedEmail) : undefined;
      const items = await listCloudSqlCollection(collectionName, ownerId, invitedEmail);
      res.json({ items });
    } catch (error: any) {
      console.error(`Failed to list Cloud SQL collection ${req.params.name}:`, error);
      res.status(500).json({ error: error.message || "Failed to list records from Cloud SQL" });
    }
  });

  app.post("/api/sql/collection/:name", requireAuth, async (req: AuthRequest, res) => {
    try {
      const collectionName = req.params.name;
      const data = req.body.data || req.body || {};
      const docId = String(
        req.body.id ||
          data.id ||
          `sql_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      );
      const saved = await upsertCloudSqlDoc(
        collectionName,
        docId,
        data,
        Boolean(req.body.merge),
        req.user?.uid
      );
      res.json({ id: docId, data: saved });
    } catch (error: any) {
      console.error(`Failed to create/upsert Cloud SQL record in ${req.params.name}:`, error);
      res.status(500).json({ error: error.message || "Failed to save record to Cloud SQL" });
    }
  });

  app.put("/api/sql/collection/:name/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const collectionName = req.params.name;
      const docId = req.params.id;
      const data = req.body.data || req.body || {};
      const updated = await upsertCloudSqlDoc(
        collectionName,
        docId,
        data,
        true,
        req.user?.uid
      );
      res.json({ id: docId, data: updated });
    } catch (error: any) {
      console.error(`Failed to update Cloud SQL record in ${req.params.name}/${req.params.id}:`, error);
      res.status(500).json({ error: error.message || "Failed to update record in Cloud SQL" });
    }
  });

  app.delete("/api/sql/collection/:name/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const collectionName = req.params.name;
      const docId = req.params.id;
      const result = await deleteCloudSqlDoc(collectionName, docId);
      res.json(result);
    } catch (error: any) {
      console.error(`Failed to delete Cloud SQL record in ${req.params.name}/${req.params.id}:`, error);
      res.status(500).json({ error: error.message || "Failed to delete record from Cloud SQL" });
    }
  });

  app.post("/api/sql/collection/:name/bulk-delete", requireAuth, async (req: AuthRequest, res) => {
    try {
      const collectionName = req.params.name;
      const docIds = Array.isArray(req.body.ids) ? req.body.ids : [];
      const result = await bulkDeleteCloudSqlDocs(collectionName, docIds);
      res.json(result);
    } catch (error: any) {
      console.error(`Failed to bulk delete Cloud SQL records in ${req.params.name}:`, error);
      res.status(500).json({ error: error.message || "Failed to bulk delete records from Cloud SQL" });
    }
  });

  app.post("/api/dev/reset-all-data", requireAuth, async (req: AuthRequest, res) => {
    try {
      const ownerId = req.body?.ownerId || req.user?.uid;
      await clearWorkspaceTestData(ownerId);

      // Run optional legacy Firestore cleanup in background so it never blocks or hangs
      (async () => {
        const db = getBackendDb();
        if (!db) return;
        const collectionsToClear = [
          "ingredients",
          "recipes",
          "invoices",
          "inventory_counts",
          "inventory_consumptions",
          "dailySales",
          "groceryPurchases",
          "groceryShoppingList",
          "salesUploads"
        ];
        for (const colName of collectionsToClear) {
          try {
            const snap = await getDocs(collection(db, colName));
            for (const docSnap of snap.docs) {
              const data = docSnap.data();
              if (!ownerId || data.ownerId === ownerId) {
                deleteDoc(docSnap.ref).catch(() => {});
              }
            }
          } catch {
            // Non-fatal
          }
        }
      })();

      res.json({ success: true, message: "All test data successfully deleted." });
    } catch (error: any) {
      console.error("Failed to reset test data:", error);
      res.status(500).json({ error: error.message || "Failed to reset test data" });
    }
  });

// Vite Development or Static Production integration
async function startServer() {
  try {
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Food Cost Calculator Server running on: http://localhost:${PORT}`);
    });

    server.on("error", (err: any) => {
      console.error("Server listen error:", err);
      process.exit(1);
    });

    const shutdown = () => {
      server.close(() => {
        process.exit(0);
      });
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (err) {
    console.error("Critical error starting Express + Vite server:", err);
  }
}

startServer().catch((err) => {
  console.error("Unhandled error during startServer execution:", err);
});
