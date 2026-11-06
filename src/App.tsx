import React, { useState, useEffect, Suspense } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage, signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset, handleSignOut, handleFirestoreError, OperationType, safeAddDoc, safeSetDoc, safeUpdateDoc, safeDeleteDoc, safeBulkDeleteDocs, migrateCollectionsToCloudSql, subscribeWorkspaceCollection, notifyCloudSqlListeners, checkRedirectAuthResult } from "./lib/firebase";
import { IndustrialProduct, Ingredient, Recipe, ParsedInvoiceItem, Timecard, Employee, DailySale, Vendor, Department, Restaurant, GroceryPurchase, GroceryShoppingItem, ConsumptionLog } from "./types";
import { getGramsOrMlEquivalent, calculateIngredientUnitPrice, calculatePoundData, extractWeightSpecFromName, convertFromGrams, getRegisteredPackSize, normalizeBaseUnit, isStrictBaseUnit, findIngredientMatchForInvoiceItem, saveNamingMatchToStorage } from "./lib/unitConverter";
import { getNormalizedVendorKey } from "./lib/vendorUtils";
import { uploadSourceDocumentToStorage, deleteSourceDocumentFromStorage } from "./lib/fileHelper";
import { STANDARD_DEPARTMENTS, STANDARD_DEPARTMENT_NAMES } from "./constants/departments";
import { STANDARD_VENDORS, STANDARD_VENDOR_NAMES } from "./constants/vendors";
import { STANDARD_EMPLOYEES } from "./constants/employees";
import MainHeader from "./components/MainHeader";
import type { QueueItem } from "./components/AIParserView";
const AIParserView = React.lazy(() => import("./components/AIParserView"));
const IngredientsView = React.lazy(() => import("./components/IngredientsView"));
const RecipesView = React.lazy(() => import("./components/RecipesView"));
const TimesheetView = React.lazy(() => import("./components/TimesheetView"));
const StaffRegistryView = React.lazy(() => import("./components/StaffRegistryView"));
const FoodCostIntelView = React.lazy(() => import("./components/FoodCostIntelView"));
const GroceryView = React.lazy(() => import("./components/GroceryView"));
const CollaboratorsView = React.lazy(() => import("./components/CollaboratorsView"));
const DashboardView = React.lazy(() => import("./components/DashboardView"));
const InventoryView = React.lazy(() => import("./components/InventoryView"));
const IndustrialInventoryView = React.lazy(() => import("./components/IndustrialInventoryView"));
const VendorsView = React.lazy(() => import("./components/VendorsView").then(module => ({ default: module.VendorsView })));
const DepartmentsView = React.lazy(() => import("./components/DepartmentsView").then(module => ({ default: module.DepartmentsView })));
const OrderTemplatesView = React.lazy(() => import("./components/OrderTemplatesView").then(module => ({ default: module.OrderTemplatesView })));
const OrderListView = React.lazy(() => import("./components/OrderListView").then(module => ({ default: module.OrderListView })));
const InvoiceManagementView = React.lazy(() => import("./components/InvoiceManagementView").then(module => ({ default: module.InvoiceManagementView })));
const ReportCenterView = React.lazy(() => import("./components/ReportCenterView").then(module => ({ default: module.ReportCenterView })));
const TimeClockView = React.lazy(() => import("./components/TimeClockView"));
const SupabaseMigrationView = React.lazy(() => import("./components/SupabaseMigrationView"));
import { useTimeclock } from "./hooks/useTimeclock";
import { AIChatbot } from "./components/AIChatbot";
const SalesDataView = React.lazy(() => import("./components/SalesDataView"));
import LandingPage from "./components/LandingPage";
import InvitationAlert from "./components/InvitationAlert";
import { 
  ChefHat, 
  Sparkles, 
  FileSpreadsheet, 
  DollarSign,
  TrendingUp,
  BarChart3,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Users,
  Menu,
  X,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  Package,
  Building2,
  Home,
  FileText,
  LayoutDashboard,
  Briefcase,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Loader2,
  ShoppingCart,
  Plus,
  Database,
  Trash2,
} from "lucide-react";


export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [activeSection, setActiveSection] = useState<string>("inventory");
  const [inventoryCategoryTab, setInventoryCategoryTab] = useState<"ingredient" | "industrial">("ingredient");
  const [showAuth, setShowAuth] = useState(false);

  // Email login / Sign-up / Forgot password States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [authError, setAuthError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleSigningIn, setGoogleSigningIn] = useState(false);

  const handleGoogleAuth = async (useRedirect = false) => {
    if (googleSigningIn) return;
    setGoogleSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGoogle(useRedirect);
    } catch (err: any) {
      const code = err?.code || "";
      const currentHost = typeof window !== "undefined" ? window.location.hostname : "supplypilot.space";
      if (code === "auth/popup-blocked") {
        setAuthError("POPUP_BLOCKED");
      } else if (
        code === "auth/unauthorized-domain" ||
        err?.message?.includes("unauthorized-domain") ||
        err?.message?.includes("authorized domain")
      ) {
        setAuthError(`UNAUTHORIZED_DOMAIN:${currentHost}`);
      } else if (code !== "auth/cancelled-popup-request" && code !== "auth/popup-closed-by-user") {
        setAuthError(err?.message || "Google sign-in could not be completed. Please try again.");
      }
    } finally {
      setGoogleSigningIn(false);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setAuthError("Please fill in both email and password fields.");
      return;
    }
    setAuthError(null);
    setResetSuccess(null);
    setAuthSubmitting(true);
    try {
      if (authMode === "signin") {
        await signInWithEmail(email.trim(), password);
      } else {
        await signUpWithEmail(email.trim(), password);
      }
    } catch (err: any) {
      const code = err?.code || "";
      const msgStr = err?.message || "";
      console.error("Firebase Auth Error:", code, msgStr);

      let msg = "An authentication error occurred. Please try again.";

      if (code === "auth/operation-not-allowed" || msgStr.includes("auth/operation-not-allowed")) {
        msg = "Email/Password sign-in is currently disabled in your Firebase project. Please sign in instantly using the Google button below, or enable Email/Password provider in your Firebase Authentication Console.";
      } else if (code === "auth/email-already-in-use" || msgStr.includes("auth/email-already-in-use")) {
        msg = "An account with this email address already exists. Please switch to 'Sign In' to log in, or sign in with Google.";
      } else if (
        code === "auth/invalid-credential" ||
        msgStr.includes("auth/invalid-credential") ||
        code === "auth/wrong-password" ||
        msgStr.includes("auth/wrong-password") ||
        code === "auth/user-not-found" ||
        msgStr.includes("auth/user-not-found")
      ) {
        if (authMode === "signin") {
          msg = "Invalid email or password. If you do not have an account yet, please click 'Create Account' above. If you forgot your password, click 'Forgot password?'.";
        } else {
          msg = "Unable to create account with these credentials. Please check your email and try again.";
        }
      } else if (code === "auth/weak-password" || msgStr.includes("auth/weak-password")) {
        msg = "Password is too weak. Please use at least 6 characters.";
      } else if (code === "auth/invalid-email" || msgStr.includes("auth/invalid-email")) {
        msg = "Please enter a valid email address.";
      } else if (code === "auth/too-many-requests" || msgStr.includes("auth/too-many-requests")) {
        msg = "Access temporarily disabled due to multiple failed attempts. You can reset your password or try again in a few moments.";
      } else {
        msg = err?.message || msg;
      }
      setAuthError(msg);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setAuthError("Please enter your email address to receive a password reset link.");
      return;
    }
    setAuthError(null);
    setResetSuccess(null);
    setAuthSubmitting(true);
    try {
      await sendPasswordReset(email.trim());
      setResetSuccess(`Password reset link sent to ${email.trim()}! Please check your inbox (and spam folder) for instructions to reset your password.`);
    } catch (err: any) {
      const code = err?.code || "";
      const msgStr = err?.message || "";
      console.error("Password Reset Error:", code, msgStr);

      let msg = "Failed to send password reset email. Please try again.";

      if (code === "auth/user-not-found" || msgStr.includes("auth/user-not-found")) {
        msg = "No registered account was found with this email address. Please check the spelling or create an account.";
      } else if (code === "auth/invalid-email" || msgStr.includes("auth/invalid-email")) {
        msg = "Please enter a valid email address.";
      } else if (code === "auth/too-many-requests" || msgStr.includes("auth/too-many-requests")) {
        msg = "Too many password reset attempts. Please wait a few moments before trying again.";
      } else {
        msg = err?.message || msg;
      }
      setAuthError(msg);
    } finally {
      setAuthSubmitting(false);
    }
  };

  React.useEffect(() => {
    document.title = "SMA Management System";
  }, []);
  
  // Background Parsing States
  const [parserQueue, setParserQueue] = useState<QueueItem[]>([]);
  const [parserActiveQueueId, setParserActiveQueueId] = useState<string | null>(null);
  const [parserParsingAll, setParserParsingAll] = useState(false);
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("sidebarCollapsed");
      return saved === "true";
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem("sidebarCollapsed", String(next));
      } catch (err) {
        console.warn("Storage item write blocked:", err);
      }
      return next;
    });
  };

  // Dynamic real-time collection state
  const [restaurants, setRestaurants] = useState<string[]>([]);
  const [viewTab, setViewTab] = useState("Inventory");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [orderLists, setOrderLists] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [timecards, setTimecards] = useState<Timecard[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoaded, setEmployeesLoaded] = useState(false);
  const [dailySales, setDailySales] = useState<DailySale[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorsLoaded, setVendorsLoaded] = useState(false);
  
  const [salesUploads, setSalesUploads] = useState<any[]>([]);
  const [industrialProducts, setIndustrialProducts] = useState<IndustrialProduct[]>([]);
  const [groceryPurchases, setGroceryPurchases] = useState<GroceryPurchase[]>([]);
  const [groceryShoppingList, setGroceryShoppingList] = useState<GroceryShoppingItem[]>([]);

  // Workspace Sharing & Department states
  const [workspaceOwnerId, setWorkspaceOwnerId] = useState<string | null>(() => localStorage.getItem("workspaceOwnerId"));
  const [workspaceOwnerEmail, setWorkspaceOwnerEmail] = useState<string | null>(() => localStorage.getItem("workspaceOwnerEmail"));
  const [myShares, setMyShares] = useState<any[]>([]); // people I invited
  const [incomingShares, setIncomingShares] = useState<any[]>([]); // people who invited me
  const [incomingSharesLoaded, setIncomingSharesLoaded] = useState(false);
  const [customDepartments, setCustomDepartments] = useState<Department[]>([]); // custom departments in active workspace
  const [deptsLoaded, setDeptsLoaded] = useState(false);
  const [deletedDeptNames, setDeletedDeptNames] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("deleted_departments");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Resolved list of flat department names including standard departments
  const resolvedDepts = React.useMemo(() => {
    const ignored = new Set(["unassigned", "uncategorized", "none", "", ...deletedDeptNames.map(d => d.toLowerCase())]);
    const fromDb = customDepartments
      .map(d => (d.name ? d.name.trim() : ""))
      .filter(n => n && !ignored.has(n.toLowerCase()));
    const fromRecipes = recipes
      .map(r => (r.department ? r.department.trim() : ""))
      .filter(n => n && !ignored.has(n.toLowerCase()));
    const fromIngredients = ingredients
      .map(i => (i.department ? i.department.trim() : ""))
      .filter(n => n && !ignored.has(n.toLowerCase()));
    const fromStandards = STANDARD_DEPARTMENT_NAMES.filter(n => !ignored.has(n.toLowerCase()));

    const seen = new Map<string, string>();
    [...fromStandards, ...fromDb, ...fromRecipes, ...fromIngredients].forEach(name => {
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, name);
      }
    });
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [customDepartments, recipes, ingredients, deletedDeptNames]);

  // Combined Department objects for DepartmentsView & InventoryView so sidebar badge count and table rows always match 100%
  const combinedDepartments = React.useMemo<Department[]>(() => {
    const byKey = new Map<string, Department>();
    const ignoredLower = new Set(deletedDeptNames.map(d => d.toLowerCase()));

    customDepartments.forEach(d => {
      const clean = (d.name || "").trim();
      if (clean && !ignoredLower.has(clean.toLowerCase())) {
        byKey.set(clean.toLowerCase(), d);
      }
    });

    STANDARD_DEPARTMENTS.forEach(std => {
      const key = std.name.toLowerCase();
      if (!ignoredLower.has(key) && !byKey.has(key)) {
        byKey.set(key, {
          id: `standard-${key.replace(/[^a-z0-9]/g, "-")}`,
          name: std.name,
          description: std.description || "",
          ownerId: workspaceOwnerId || user?.uid || "default",
          createdAt: new Date().toISOString(),
        });
      }
    });

    resolvedDepts.forEach(deptName => {
      const key = deptName.toLowerCase();
      if (!byKey.has(key)) {
        byKey.set(key, {
          id: `derived-${key.replace(/[^a-z0-9]/g, "-")}`,
          name: deptName,
          description: "Derived from assigned recipes/inventory",
          ownerId: workspaceOwnerId || user?.uid || "default",
          createdAt: new Date().toISOString(),
        });
      }
    });
    return Array.from(byKey.values()).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [customDepartments, resolvedDepts, workspaceOwnerId, user?.uid, deletedDeptNames]);

  // Combined Vendor objects so selectors, tabs, and filters always have the full 28 suppliers immediately
  const combinedVendors = React.useMemo<Vendor[]>(() => {
    let deletedKeys: string[] = [];
    try {
      const raw = localStorage.getItem("deleted_vendors");
      if (raw) deletedKeys = JSON.parse(raw);
    } catch {}
    const deletedLower = new Set(deletedKeys.map(k => k.toLowerCase()));

    const byKey = new Map<string, Vendor>();
    vendors.forEach(v => {
      const key = getNormalizedVendorKey(v.name);
      if (key && !deletedLower.has(key)) {
        byKey.set(key, v);
      }
    });

    STANDARD_VENDORS.forEach(sv => {
      const key = getNormalizedVendorKey(sv.name);
      if (key && !deletedLower.has(key) && !byKey.has(key)) {
        byKey.set(key, {
          id: `standard-${key.replace(/[^a-z0-9]/g, "-")}`,
          name: sv.name,
          contactName: sv.contactName || "",
          phone: sv.phone || "",
          email: sv.email || "",
          address: sv.address || "",
          note: sv.note || "",
          itemsSupplied: sv.itemsSupplied || 0,
          ownerId: workspaceOwnerId || user?.uid || "standard",
          createdAt: new Date().toISOString(),
        });
      }
    });

    return Array.from(byKey.values()).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [vendors, workspaceOwnerId, user?.uid]);

  // Combined Employee objects so staff registry, PIN terminal, timesheets, and inventory always have the full 37 staff members immediately
  const combinedEmployees = React.useMemo<Employee[]>(() => {
    let deletedKeys: string[] = [];
    try {
      const raw = localStorage.getItem("deleted_employees");
      if (raw) deletedKeys = JSON.parse(raw);
    } catch {}
    const deletedLower = new Set(deletedKeys.map(k => k.toLowerCase().trim()));

    const byKey = new Map<string, Employee>();
    employees.forEach(e => {
      const key = (e.name || "").toLowerCase().trim();
      if (key && !deletedLower.has(key)) {
        byKey.set(key, e);
      }
    });

    STANDARD_EMPLOYEES.forEach(se => {
      const key = (se.name || "").toLowerCase().trim();
      if (key && !deletedLower.has(key) && !byKey.has(key)) {
        byKey.set(key, {
          id: `standard-${key.replace(/[^a-z0-9]/g, "-")}`,
          ...se,
          ownerId: workspaceOwnerId || user?.uid || "standard",
          createdAt: new Date().toISOString(),
        });
      }
    });

    return Array.from(byKey.values()).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [employees, workspaceOwnerId, user?.uid]);

  // Pending & Accepted incoming shares for current user
  const pendingIncomingShares = React.useMemo(() => {
    return incomingShares.filter((s: any) => s.status === "pending");
  }, [incomingShares]);

  const acceptedIncomingShares = React.useMemo(() => {
    return incomingShares.filter((s: any) => s.status !== "pending" && s.status !== "declined");
  }, [incomingShares]);

  // Resolved user role in current active workspace context
  const userRole = React.useMemo(() => {
    if (!user) return "admin";
    if (!workspaceOwnerId || workspaceOwnerId === user.uid) return "admin";
    if (!incomingSharesLoaded) return "admin";
    const share = incomingShares.find((s: any) => s.ownerId === workspaceOwnerId);
    if (!share) return "admin";
    const role = share.role || "admin";
    if (role === "viewer") return "staff";
    if (role === "editor") return "manager";
    return role;
  }, [user, workspaceOwnerId, incomingShares, incomingSharesLoaded]);

  const isReadOnly = React.useMemo(() => {
    return userRole === "staff";
  }, [userRole]);

  React.useEffect(() => {
    if (
      incomingSharesLoaded &&
      workspaceOwnerId &&
      user &&
      workspaceOwnerId !== user.uid &&
      !incomingShares.some((s: any) => s.ownerId === workspaceOwnerId && s.status !== "declined")
    ) {
      setWorkspaceOwnerId(user.uid);
      setWorkspaceOwnerEmail(user.email || "");
      localStorage.setItem("workspaceOwnerId", user.uid);
      localStorage.setItem("workspaceOwnerEmail", user.email || "");
    }
  }, [incomingSharesLoaded, workspaceOwnerId, user, incomingShares]);

  React.useEffect(() => {
    if (incomingSharesLoaded && userRole === "staff" && ["dashboard", "intel", "food-cost", "ai-parser", "catalog", "recipes", "grocery", "staff", "employees", "collaborators", "vendors", "timesheet", "sales-data"].includes(activeSection)) {
      setActiveSection("inventory");
    }
  }, [incomingSharesLoaded, userRole, activeSection]);

  const uniqueVendorsCount = React.useMemo(() => {
    let deletedKeys: string[] = [];
    try {
      const raw = localStorage.getItem("deleted_vendors");
      if (raw) deletedKeys = JSON.parse(raw);
    } catch {}
    const deletedLower = new Set(deletedKeys.map(k => k.toLowerCase()));

    const combinedVendors = new Set<string>();
    vendors.forEach(v => {
      const key = getNormalizedVendorKey(v.name);
      if (key && !deletedLower.has(key)) combinedVendors.add(key);
    });
    STANDARD_VENDORS.forEach(sv => {
      const key = getNormalizedVendorKey(sv.name);
      if (key && !deletedLower.has(key)) combinedVendors.add(key);
    });
    ingredients.forEach(i => {
      let vendorName = "";
      if (i.vendor && i.vendor.trim() !== "") {
        vendorName = i.vendor.trim();
      } else if (i.source && i.source.includes("(")) {
        const parts = i.source.split("(");
        if (parts.length > 1) {
          vendorName = parts[1].replace(")", "").trim();
        }
      }
      if (vendorName) {
        const key = getNormalizedVendorKey(vendorName);
        if (key && !deletedLower.has(key)) combinedVendors.add(key);
      }
    });
    return combinedVendors.size;
  }, [vendors, ingredients]);

  // Monitor Auth Changes and Redirect Sign-ins
  useEffect(() => {
    checkRedirectAuthResult().catch((err) => {
      console.warn("Redirect auth check notice:", err);
    });
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // Monitor Auth Changes and initialize workspaceOwnerId
  useEffect(() => {
    if (user) {
      const savedOwnerId = localStorage.getItem("workspaceOwnerId");
      const savedOwnerEmail = localStorage.getItem("workspaceOwnerEmail");
      if (savedOwnerId && savedOwnerEmail) {
        setWorkspaceOwnerId(savedOwnerId);
        setWorkspaceOwnerEmail(savedOwnerEmail);
      } else {
        setWorkspaceOwnerId(user.uid);
        setWorkspaceOwnerEmail(user.email);
        localStorage.setItem("workspaceOwnerId", user.uid);
        localStorage.setItem("workspaceOwnerEmail", user.email || "");
      }
    } else {
      setWorkspaceOwnerId(null);
      setWorkspaceOwnerEmail(null);
    }
  }, [user]);

  // Synchronize user profile to Cloud SQL PostgreSQL database on sign-in
  useEffect(() => {
    if (user) {
      user.getIdToken().then((token) => {
        fetch("/api/users/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          }
        }).catch((err) => {
          console.warn("Could not sync user to database:", err);
        });
      }).catch(console.warn);
    }
  }, [user]);

  // Sync shares (Collaborators / Invitations)
  useEffect(() => {
    if (!user) {
      setMyShares([]);
      setIncomingShares([]);
      return;
    }

    const emailKey = (user.email || "").toLowerCase();
    const activeOwnerId = workspaceOwnerId || user.uid;

    const unsubOut = subscribeWorkspaceCollection<any>(
      "shares",
      { ownerId: activeOwnerId },
      (data) => setMyShares(data),
      (error) => console.warn("Error listening to outgoing shares:", error)
    );

    const unsubIn = subscribeWorkspaceCollection<any>(
      "shares",
      { invitedEmail: emailKey },
      (data) => {
        setIncomingShares(data);
        setIncomingSharesLoaded(true);
      },
      (error) => {
        console.warn("Error listening to incoming shares:", error);
        setIncomingSharesLoaded(true);
      }
    );

    return () => {
      unsubOut();
      unsubIn();
    };
  }, [user, workspaceOwnerId]);

  // Sync Master Inventory, Recipes, custom departments, and rest of data from Cloud SQL (with Firestore migration bridge)
  useEffect(() => {
    if (!user || !workspaceOwnerId) {
      setIngredients([]);
      setRecipes([]);
      setInvoices([]);
      setTimecards([]);
      setEmployees([]);
      setDailySales([]);
      setCustomDepartments([]);
      setVendors([]);
      setRestaurants([]);
      setSalesUploads([]);
      setIndustrialProducts([]);
      setGroceryPurchases([]);
      setGroceryShoppingList([]);
      return;
    }

    const targetOwnerId = workspaceOwnerId;

    const unsubIngs = subscribeWorkspaceCollection<Ingredient>(
      "ingredients",
      { ownerId: targetOwnerId },
      (items) => {
        const data: Ingredient[] = [];
        const hiddenIdsToDelete: string[] = [];
        items.forEach((itemData) => {
          if (itemData.isHiddenFromInventory && itemData.id) {
            hiddenIdsToDelete.push(itemData.id);
          } else {
            data.push(itemData);
          }
        });
        if (hiddenIdsToDelete.length > 0) {
          safeBulkDeleteDocs("ingredients", hiddenIdsToDelete);
        }
        data.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setIngredients(data);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "ingredients")
    );

    const unsubRecipes = subscribeWorkspaceCollection<Recipe>(
      "recipes",
      { ownerId: targetOwnerId },
      (items) => {
        const data = [...items];
        data.sort((a, b) => {
          if (a.order !== undefined && b.order !== undefined) {
            return a.order - b.order;
          }
          if (a.order !== undefined) return -1;
          if (b.order !== undefined) return 1;
          return (a.name || "").localeCompare(b.name || "");
        });
        setRecipes(data);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "recipes")
    );

    const unsubInvoices = subscribeWorkspaceCollection<any>(
      "invoices",
      { ownerId: targetOwnerId },
      (items) => setInvoices(items),
      (error) => handleFirestoreError(error, OperationType.LIST, "invoices")
    );

    const unsubOrderLists = subscribeWorkspaceCollection<any>(
      "orderLists",
      { ownerId: targetOwnerId },
      (items) => setOrderLists(items),
      (error) => handleFirestoreError(error, OperationType.LIST, "orderLists")
    );

    const unsubTimecards = subscribeWorkspaceCollection<Timecard>(
      "timecards",
      { ownerId: targetOwnerId },
      (items) => {
        const data = [...items];
        data.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        setTimecards(data);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "timecards")
    );

    const unsubEmployees = subscribeWorkspaceCollection<Employee>(
      "employees",
      { ownerId: targetOwnerId },
      (items) => {
        const data = [...items];
        data.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setEmployees(data);
        setEmployeesLoaded(true);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "employees");
        setEmployeesLoaded(true);
      }
    );

    const unsubSales = subscribeWorkspaceCollection<DailySale>(
      "dailySales",
      { ownerId: targetOwnerId },
      (items) => setDailySales(items),
      (error) => handleFirestoreError(error, OperationType.LIST, "dailySales")
    );

    const unsubDepts = subscribeWorkspaceCollection<Department>(
      "departments",
      { ownerId: targetOwnerId },
      (items) => {
        const data = [...items];
        data.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setCustomDepartments(data);
        setDeptsLoaded(true);
      },
      (error) => {
        console.warn("Error listening to custom departments:", error);
        setDeptsLoaded(true);
      }
    );

    const unsubRests = subscribeWorkspaceCollection<Restaurant>(
      "restaurants",
      { ownerId: targetOwnerId },
      (items) => {
        const data = [...items];
        data.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setRestaurants(data);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "restaurants")
    );

    const unsubVendors = subscribeWorkspaceCollection<Vendor>(
      "vendors",
      { ownerId: targetOwnerId },
      (items) => {
        const data = [...items];
        data.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setVendors(data);
        setVendorsLoaded(true);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "vendors");
        setVendorsLoaded(true);
      }
    );

    const unsubUploads = subscribeWorkspaceCollection<any>(
      "salesUploads",
      { ownerId: targetOwnerId },
      (items) => {
        const data = [...items];
        data.sort((a, b) => new Date(b.uploadedAt || "").getTime() - new Date(a.uploadedAt || "").getTime());
        setSalesUploads(data);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "salesUploads")
    );

    const unsubGrocery = subscribeWorkspaceCollection<GroceryPurchase>(
      "groceryPurchases",
      { ownerId: targetOwnerId },
      (items) => {
        const data = [...items];
        data.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        setGroceryPurchases(data);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "groceryPurchases")
    );

    const unsubShopping = subscribeWorkspaceCollection<GroceryShoppingItem>(
      "groceryShoppingList",
      { ownerId: targetOwnerId },
      (items) => setGroceryShoppingList(items),
      (error) => handleFirestoreError(error, OperationType.LIST, "groceryShoppingList")
    );

    const unsubIndustrial = subscribeWorkspaceCollection<IndustrialProduct>(
      "industrialProducts",
      { ownerId: targetOwnerId },
      (items) => {
        const data = [...items];
        data.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setIndustrialProducts(data);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "industrialProducts")
    );

    return () => {
      unsubIngs();
      unsubRecipes();
      unsubInvoices();
      unsubOrderLists();
      unsubTimecards();
      unsubEmployees();
      unsubSales();
      unsubDepts();
      unsubRests();
      unsubVendors();
      unsubUploads();
      unsubGrocery();
      unsubShopping();
      unsubIndustrial();
    };
  }, [user, workspaceOwnerId]);

  // Auto-seed standard departments if not already present in the workspace
  const autoSeededDeptsRef = React.useRef(false);
  React.useEffect(() => {
    if (!user || !workspaceOwnerId || isReadOnly || autoSeededDeptsRef.current || !deptsLoaded) return;
    const existingNames = new Set(customDepartments.map(d => (d.name || "").trim().toLowerCase()));
    const missing = STANDARD_DEPARTMENTS.filter(d => !existingNames.has(d.name.toLowerCase()) && !deletedDeptNames.map(x => x.toLowerCase()).includes(d.name.toLowerCase()));
    if (missing.length > 0) {
      autoSeededDeptsRef.current = true;
      missing.forEach(d => {
        safeAddDoc("departments", {
          name: d.name,
          description: d.description || "",
          ownerId: workspaceOwnerId,
          createdAt: new Date().toISOString()
        }).catch(err => console.warn("Could not auto-seed standard department:", d.name, err));
      });
    }
  }, [user, workspaceOwnerId, isReadOnly, customDepartments, deletedDeptNames, deptsLoaded]);

  // Auto-seed standard employees if not already present in the workspace
  const autoSeededEmployeesRef = React.useRef(false);
  React.useEffect(() => {
    if (!user || !workspaceOwnerId || isReadOnly || autoSeededEmployeesRef.current || !employeesLoaded) return;
    const existingNames = new Set(employees.map(e => (e.name || "").trim().toLowerCase()));
    let deletedKeys: string[] = [];
    try {
      const raw = localStorage.getItem("deleted_employees");
      if (raw) deletedKeys = JSON.parse(raw);
    } catch {}
    const deletedLower = new Set(deletedKeys.map(k => k.toLowerCase().trim()));

    const missing = STANDARD_EMPLOYEES.filter(e => 
      !existingNames.has(e.name.toLowerCase().trim()) && 
      !deletedLower.has(e.name.toLowerCase().trim())
    );

    if (missing.length > 0) {
      autoSeededEmployeesRef.current = true;
      missing.forEach(emp => {
        const slug = emp.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
        const docId = `emp_${workspaceOwnerId.slice(0, 8)}_${slug}`;
        safeSetDoc("employees", docId, {
          ...emp,
          id: docId,
          ownerId: workspaceOwnerId,
          createdAt: new Date().toISOString()
        }).catch(err => console.warn("Could not auto-seed standard employee:", emp.name, err));
      });
    }
  }, [user, workspaceOwnerId, isReadOnly, employees, employeesLoaded]);

  // Department Management Actions
  const handleAddDepartment = async (department: Omit<Department, "id" | "ownerId" | "createdAt">, oldName?: string) => {
    if (!user || !workspaceOwnerId) return;
    const cleanName = (department.name || "").trim();
    if (!cleanName) return;
    setDeletedDeptNames(prev => {
      const next = prev.filter(n => n.toLowerCase() !== cleanName.toLowerCase());
      try {
        localStorage.setItem("deleted_departments", JSON.stringify(next));
      } catch {}
      return next;
    });
    const existing = customDepartments.find(d => (d.name || "").toLowerCase().trim() === cleanName.toLowerCase());
    if (existing && existing.id) {
      await safeUpdateDoc("departments", existing.id, { ...department, name: cleanName });
    } else {
      const payload = {
        ...department,
        name: cleanName,
        ownerId: workspaceOwnerId,
        createdAt: new Date().toISOString()
      };
      await safeAddDoc("departments", payload);
    }
  };

  const handleEditDepartment = async (id: string, edits: Partial<Department>, oldName?: string) => {
    if (!user || !workspaceOwnerId) return;
    const prevDept = combinedDepartments.find(d => d.id === id);
    const effectiveOldName = (oldName || prevDept?.name || "").trim();
    const newName = (edits.name || effectiveOldName).trim();

    if (id.startsWith("derived-") || id.startsWith("standard-")) {
      await safeAddDoc("departments", {
        name: newName,
        description: edits.description || "",
        restaurantId: edits.restaurantId,
        ownerId: workspaceOwnerId,
        createdAt: new Date().toISOString(),
      });
    } else {
      await safeUpdateDoc("departments", id, { ...edits, name: newName });
    }

    if (effectiveOldName && newName && effectiveOldName.toLowerCase() !== newName.toLowerCase()) {
      const oldLower = effectiveOldName.toLowerCase();
      const updates: Promise<any>[] = [];
      recipes.forEach(r => {
        if (r.id && (r.department || "").toLowerCase().trim() === oldLower) {
          updates.push(safeUpdateDoc("recipes", r.id, { department: newName, updatedAt: new Date().toISOString() }));
        }
      });
      ingredients.forEach(ing => {
        if (ing.id && (ing.department || "").toLowerCase().trim() === oldLower) {
          updates.push(safeUpdateDoc("ingredients", ing.id, { department: newName, updatedAt: new Date().toISOString() }));
        }
      });
      employees.forEach(emp => {
        if (emp.id && (emp.dept || "").toLowerCase().trim() === oldLower) {
          updates.push(safeUpdateDoc("employees", emp.id, { dept: newName }));
        }
      });
      await Promise.all(updates);
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    if (!user) return;
    const targetDept = combinedDepartments.find(d => d.id === id);
    const deptName = (targetDept?.name || "").trim();
    const deptNameLower = deptName.toLowerCase();

    if (deptNameLower) {
      setDeletedDeptNames(prev => {
        const next = [...new Set([...prev, deptNameLower])];
        try {
          localStorage.setItem("deleted_departments", JSON.stringify(next));
        } catch {}
        return next;
      });
    }

    if (!id.startsWith("derived-") && !id.startsWith("standard-")) {
      await safeDeleteDoc("departments", id);
    }

    if (deptNameLower) {
      const updates: Promise<any>[] = [];
      recipes.forEach(r => {
        if (r.id && (r.department || "").toLowerCase().trim() === deptNameLower) {
          updates.push(safeUpdateDoc("recipes", r.id, { department: "", updatedAt: new Date().toISOString() }));
        }
      });
      ingredients.forEach(ing => {
        if (ing.id && (ing.department || "").toLowerCase().trim() === deptNameLower) {
          updates.push(safeUpdateDoc("ingredients", ing.id, { department: "", updatedAt: new Date().toISOString() }));
        }
      });
      await Promise.all(updates);
    }
  };

  // Restaurant Management Actions
  const handleAddRestaurant = async (restaurant: Omit<Restaurant, "id" | "ownerId" | "createdAt">, oldName?: string) => {
    if (!user || !workspaceOwnerId) return;
    const payload = {
      ...restaurant,
      ownerId: workspaceOwnerId,
      createdAt: new Date().toISOString()
    };
    await safeAddDoc("restaurants", payload);
  };

  const handleEditRestaurant = async (id: string, edits: Partial<Restaurant>, oldName?: string) => {
    if (!user) return;
    await safeUpdateDoc("restaurants", id, edits);
  };

  const handleDeleteRestaurant = async (id: string) => {
    if (!user) return;
    await safeDeleteDoc("restaurants", id);
  };

  const handleSeedRestaurants = async () => {
    if (!user) return;
    const defaults = ["Downtown Flagship", "Uptown Branch", "Westside Kiosk"];
    const promises = defaults.map(name => {
      const payload: Omit<Restaurant, "id"> = {
        name,
        address: "",
        contactName: "",
        phone: "",
        email: "",
        ownerId: workspaceOwnerId || user.uid,
        createdAt: new Date().toISOString()
      };
      return safeAddDoc("restaurants", payload);
    });
    try {
      await Promise.all(promises);
    } catch (err) {
      console.error("Failed to seed restaurants", err);
    }
  };

  // Invoice Management Actions
  const handleAddOrderList = async (orderList: Omit<any, "id" | "ownerId" | "createdAt" | "updatedAt">) => {
    if (isReadOnly || !user || !workspaceOwnerId) return;
    try {
      const payload = { 
        ...orderList, 
        ownerId: workspaceOwnerId, 
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await safeAddDoc("orderLists", payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "orderLists");
    }
  };

  const handleUpdateOrderList = async (id: string, updates: Partial<any>) => {
    if (isReadOnly) return;
    try {
      await safeUpdateDoc("orderLists", id, { ...updates, updatedAt: new Date().toISOString() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "orderLists");
    }
  };

  const handleDeleteOrderList = async (id: string) => {
    if (isReadOnly) return;
    try {
      await safeDeleteDoc("orderLists", id);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "orderLists");
    }
  };

  const handleAddInvoice = async (invoice: Omit<any, "id" | "ownerId" | "createdAt">) => {
    if (!user || !workspaceOwnerId) return;
    const payload = {
      ...invoice,
      ownerId: workspaceOwnerId,
      createdAt: new Date().toISOString()
    };
    await safeAddDoc("invoices", payload);
  };

  const handleUpdateInvoice = async (id: string, updates: Partial<any>) => {
    await safeUpdateDoc("invoices", id, updates);
  };

  const handleDeleteInvoice = async (id: string) => {
    try {
      const deletedInv = invoices.find((inv) => inv.id === id);
      const remainingInvoices = invoices.filter((inv) => inv.id !== id);
      setInvoices(remainingInvoices);
      await safeDeleteDoc("invoices", id);

      if (deletedInv?.fileUrl) {
        deleteSourceDocumentFromStorage(deletedInv.fileUrl).catch(() => {});
      }

      if (deletedInv) {
        const invNumClean = (deletedInv.invoiceNumber || "").trim();
        const invNumTag = invNumClean && invNumClean !== "N/A" ? `#${invNumClean}` : "";

        // Group all matched line items by ingredient ID so multiple lines for the same ingredient accumulate stock reduction
        const groupedDeductions = new Map<
          string,
          { matchedIng: Ingredient; totalDeductQty: number; lastLineItem?: any }
        >();

        const computeLineBaseQty = (matchedIng: Ingredient, lineItem?: any): number => {
          if (lineItem && Number((lineItem as any).appliedBaseQty) > 0) {
            return Number((lineItem as any).appliedBaseQty);
          }
          const rawQty = lineItem
            ? Number(lineItem.quantity) > 0
              ? Number(lineItem.quantity)
              : 1
            : Number(matchedIng.quantity) > 0
            ? Number(matchedIng.quantity)
            : 1;
          const packRatio =
            (Number(lineItem?.weightPerCase) > 0 ? Number(lineItem.weightPerCase) : 0) ||
            (Number(lineItem?.pcsPerPound) > 0 ? Number(lineItem.pcsPerPound) : 0) ||
            (Number(matchedIng.weightPerCase) > 0 ? Number(matchedIng.weightPerCase) : 0) ||
            (Number(matchedIng.pcsPerPound) > 0 ? Number(matchedIng.pcsPerPound) : 0);

          const itemUnitClean = (lineItem?.unit || matchedIng.unit || "").toLowerCase().trim();
          const isPkgQty =
            packRatio > 0 &&
            (!isStrictBaseUnit(itemUnitClean) || Boolean(lineItem?.packagingUnit || matchedIng.packagingUnit));

          return isPkgQty && packRatio > 0
            ? Number((rawQty * packRatio).toFixed(4))
            : rawQty;
        };

        if (Array.isArray(deletedInv.items)) {
          for (const item of deletedInv.items) {
            if (item?.matchAction === "skip") continue;
            const itemNormName = (item.name || "").toLowerCase().trim();
            const matchedIng =
              (item.targetIngredientId
                ? ingredients.find((ing) => ing.id === item.targetIngredientId)
                : undefined) ||
              ingredients.find(
                (ing) =>
                  (ing.name || "").toLowerCase().trim() === itemNormName ||
                  (Array.isArray(ing.invoiceAliases) &&
                    ing.invoiceAliases.some((a) => a.toLowerCase().trim() === itemNormName))
              ) ||
              findIngredientMatchForInvoiceItem(item.name || "", ingredients).match;

            if (matchedIng && matchedIng.id) {
              const deductQty = computeLineBaseQty(matchedIng, item);
              const existing = groupedDeductions.get(matchedIng.id);
              if (existing) {
                existing.totalDeductQty = Number((existing.totalDeductQty + deductQty).toFixed(4));
                existing.lastLineItem = item;
              } else {
                groupedDeductions.set(matchedIng.id, {
                  matchedIng,
                  totalDeductQty: deductQty,
                  lastLineItem: item,
                });
              }
            }
          }
        }

        // Also catch any ingredient in catalog whose source explicitly cites this invoice number
        if (invNumTag) {
          for (const ing of ingredients) {
            if (ing.id && !groupedDeductions.has(ing.id) && (ing.source || "").includes(invNumTag)) {
              groupedDeductions.set(ing.id, {
                matchedIng: ing,
                totalDeductQty: computeLineBaseQty(ing, undefined),
                lastLineItem: undefined,
              });
            }
          }
        }

        for (const { matchedIng, totalDeductQty, lastLineItem } of groupedDeductions.values()) {
          const itemNormName = (lastLineItem?.name || matchedIng.name || "").toLowerCase().trim();

          // Find any remaining invoices that still have line items for this ingredient
          const otherInvoiceMatches: Array<{ inv: any; lineItem: any }> = [];
          for (const remInv of remainingInvoices) {
            for (const remItem of remInv.items || []) {
              const remNorm = (remItem.name || "").toLowerCase().trim();
              const isMatch =
                (remItem.targetIngredientId && remItem.targetIngredientId === matchedIng.id) ||
                remNorm === (matchedIng.name || "").toLowerCase().trim() ||
                remNorm === itemNormName ||
                (Array.isArray(matchedIng.invoiceAliases) &&
                  matchedIng.invoiceAliases.some((a) => a.toLowerCase().trim() === remNorm));
              if (isMatch) {
                otherInvoiceMatches.push({ inv: remInv, lineItem: remItem });
              }
            }
          }

          // Do NOT delete the ingredient and do NOT delete inventory information; ALWAYS reduce the stock pound/unit
          const currentStock = Number(matchedIng.inStock) || 0;
          const reducedStock = Math.max(0, Number((currentStock - totalDeductQty).toFixed(4)));

          const updateData: Partial<Ingredient> = {
            inStock: reducedStock,
            updatedAt: new Date().toISOString(),
          };

          const packRatio =
            (Number(lastLineItem?.weightPerCase) > 0 ? Number(lastLineItem.weightPerCase) : 0) ||
            (Number(lastLineItem?.pcsPerPound) > 0 ? Number(lastLineItem.pcsPerPound) : 0) ||
            (Number(matchedIng.weightPerCase) > 0 ? Number(matchedIng.weightPerCase) : 0) ||
            (Number(matchedIng.pcsPerPound) > 0 ? Number(matchedIng.pcsPerPound) : 0);

          // If other invoices exist, update pricing to latest active invoice; otherwise preserve current inventory info & price
          if (otherInvoiceMatches.length > 0) {
            otherInvoiceMatches.sort((a, b) => {
              const dA = a.inv.issueDate || a.inv.createdAt || "";
              const dB = b.inv.issueDate || b.inv.createdAt || "";
              return dB.localeCompare(dA);
            });
            const latest = otherInvoiceMatches[0];
            const latestPrice = Number(latest.lineItem.totalPrice) || 0;
            const latestRawQty =
              Number(latest.lineItem.quantity) > 0 ? Number(latest.lineItem.quantity) : 1;
            const latestBaseQty =
              (latest.lineItem as any).appliedBaseQty !== undefined
                ? Number((latest.lineItem as any).appliedBaseQty)
                : packRatio > 0 && !isStrictBaseUnit((latest.lineItem.unit || "").toLowerCase().trim())
                ? Number((latestRawQty * packRatio).toFixed(4))
                : latestRawQty;

            const restoredPricePerGram = calculateIngredientUnitPrice({
              price: latestPrice,
              quantity: latestBaseQty,
              unit: matchedIng.unit || "lb",
              packagingUnit: matchedIng.packagingUnit,
              weightPerCase: matchedIng.weightPerCase,
              weightPerCaseUnit: matchedIng.weightPerCaseUnit,
              pcsPerPound: matchedIng.pcsPerPound,
              conversions: matchedIng.conversions,
            });

            updateData.price = latestPrice;
            updateData.quantity = latestBaseQty;
            updateData.pricePerGram = restoredPricePerGram;
            updateData.vendor = latest.inv.vendor || matchedIng.vendor;
            updateData.source = `Updated via Invoice #${latest.inv.invoiceNumber || "N/A"} (${latest.inv.vendor || "Vendor"})`;
          }

          setIngredients((prev) =>
            prev.map((ing) => (ing.id === matchedIng.id ? { ...ing, ...updateData } : ing))
          );
          await safeUpdateDoc("ingredients", matchedIng.id, updateData, { silent: true });
        }

        notifyCloudSqlListeners("ingredients");
        notifyCloudSqlListeners("invoices");
      }
    } catch (err) {
      console.error("Failed to delete invoice:", err);
      throw err;
    }
  };

  const handleClearReportCenter = async () => {
    if (isReadOnly) return;
    try {
      const currentInvoices = [...invoices];
      const currentGrocery = [...groceryPurchases];

      // Delete all invoices one by one so stock & ingredient data are accurately reversed
      for (const inv of currentInvoices) {
        if (inv.id) {
          await handleDeleteInvoice(inv.id);
        }
      }

      // Also clear grocery purchases if any exist
      if (currentGrocery.length > 0) {
        setGroceryPurchases([]);
        for (const gp of currentGrocery) {
          if (gp.id) {
            await safeDeleteDoc("groceryPurchases", gp.id);
          }
        }
        notifyCloudSqlListeners("groceryPurchases");
      }

      notifyCloudSqlListeners("invoices");
      notifyCloudSqlListeners("ingredients");
    } catch (err) {
      console.error("Failed to clear report center data:", err);
      throw err;
    }
  };

  // Auto-seed standard vendors if not present in the workspace
  const autoSeededVendorsRef = React.useRef(false);
  React.useEffect(() => {
    if (!user || !workspaceOwnerId || isReadOnly || autoSeededVendorsRef.current || !vendorsLoaded) return;
    const existingKeys = new Set(vendors.map(v => getNormalizedVendorKey(v.name)));
    let deletedKeys: string[] = [];
    try {
      const raw = localStorage.getItem("deleted_vendors");
      if (raw) deletedKeys = JSON.parse(raw);
    } catch {}
    const deletedLower = new Set(deletedKeys.map(k => k.toLowerCase()));
    const missing = STANDARD_VENDORS.filter(sv => {
      const k = getNormalizedVendorKey(sv.name);
      return !existingKeys.has(k) && !deletedLower.has(k);
    });
    if (missing.length > 0) {
      autoSeededVendorsRef.current = true;
      missing.forEach(sv => {
        safeAddDoc("vendors", {
          name: sv.name,
          contactName: sv.contactName || "",
          email: sv.email || "",
          phone: sv.phone || "",
          address: sv.address || "",
          note: sv.note || "",
          itemsSupplied: sv.itemsSupplied || 0,
          ownerId: workspaceOwnerId,
          createdAt: new Date().toISOString()
        }).catch(err => console.warn("Could not auto-seed standard vendor:", sv.name, err));
      });
    }
  }, [user, workspaceOwnerId, isReadOnly, vendors, vendorsLoaded]);

  // Vendor Management Actions
  const handleAddVendor = async (vendor: Omit<Vendor, "id" | "ownerId" | "createdAt">, oldName?: string) => {
    if (!user || !workspaceOwnerId) return;
    const vKey = getNormalizedVendorKey(vendor.name);
    if (vKey) {
      try {
        const raw = localStorage.getItem("deleted_vendors");
        if (raw) {
          const list = JSON.parse(raw).filter((k: string) => k !== vKey);
          localStorage.setItem("deleted_vendors", JSON.stringify(list));
        }
      } catch {}
    }

    const payload = {
      ...vendor,
      ownerId: workspaceOwnerId,
      createdAt: new Date().toISOString()
    };
    await safeAddDoc("vendors", payload);

    // Normalize any existing ingredients with matching vendor names (case-insensitive) to exact casing
    await updateIngredientsWithNewVendorName(vendor.name, vendor.name);

    if (oldName && oldName !== vendor.name) {
      await updateIngredientsWithNewVendorName(oldName, vendor.name);
    }
  };

  const handleSeedVendors = async () => {
    if (!user || !workspaceOwnerId) return;
    try {
      localStorage.removeItem("deleted_vendors");
    } catch {}
    const existingKeys = new Set(vendors.map(v => getNormalizedVendorKey(v.name)));
    const missing = STANDARD_VENDORS.filter(sv => !existingKeys.has(getNormalizedVendorKey(sv.name)));
    const promises = missing.map(sv => {
      const payload: Omit<Vendor, "id"> = {
        name: sv.name,
        contactName: sv.contactName || "",
        email: sv.email || "",
        phone: sv.phone || "",
        address: sv.address || "",
        note: sv.note || "",
        itemsSupplied: sv.itemsSupplied || 0,
        ownerId: workspaceOwnerId || user.uid,
        createdAt: new Date().toISOString()
      };
      return safeAddDoc("vendors", payload);
    });
    
    try {
      await Promise.all(promises);
    } catch (err) {
      console.error("Failed to seed vendors", err);
    }
  };

  const handleEditVendor = async (id: string, edits: Partial<Vendor>, oldName?: string) => {
    if (!user) return;
    await safeUpdateDoc("vendors", id, edits);

    if (edits.name && oldName && oldName !== edits.name) {
      await updateIngredientsWithNewVendorName(oldName, edits.name);
    }
  };

  const updateIngredientsWithNewVendorName = async (oldName: string, newName: string) => {
    const batchPromises = ingredients
      .filter(ing => {
        const hasVendor = ing.vendor?.toLowerCase() === oldName.toLowerCase();
        let hasSource = false;
        if (ing.source && ing.source.includes("(")) {
          const parts = ing.source.split("(");
          if (parts.length > 1) {
            const v = parts[1].replace(")", "").trim();
            if (v.toLowerCase() === oldName.toLowerCase()) hasSource = true;
          }
        }
        return hasVendor || hasSource;
      })
      .map(ing => {
        const updates: any = {};
        if (ing.vendor?.toLowerCase() === oldName.toLowerCase()) {
          updates.vendor = newName;
        }
        if (ing.source && ing.source.includes("(")) {
          const parts = ing.source.split("(");
          if (parts.length > 1) {
            const v = parts[1].replace(")", "").trim();
            if (v.toLowerCase() === oldName.toLowerCase()) {
              updates.source = `${parts[0].trim()} (${newName})`;
            }
          }
        }
        return safeUpdateDoc("ingredients", ing.id!, updates);
      });
      
    try {
      await Promise.all(batchPromises);
    } catch (err) {
      console.error("Failed to update ingredients with new vendor name", err);
    }
  };

  const handleDeleteVendor = async (id: string, name: string, isRegistered?: boolean) => {
    if (!user) return;
    
    console.log("Deleting vendor", { id, name, isRegistered });

    const vKey = getNormalizedVendorKey(name);
    if (vKey) {
      try {
        const raw = localStorage.getItem("deleted_vendors");
        const list = raw ? JSON.parse(raw) : [];
        if (!list.includes(vKey)) {
          list.push(vKey);
          localStorage.setItem("deleted_vendors", JSON.stringify(list));
        }
      } catch {}
    }

    // Clear association from ingredients
    const batchPromises = ingredients
      .filter(ing => {
        const hasVendor = ing.vendor?.toLowerCase() === name.toLowerCase();
        let hasSource = false;
        if (ing.source && ing.source.includes("(")) {
          const parts = ing.source.split("(");
          if (parts.length > 1) {
            const v = parts[1].replace(")", "").trim();
            if (v.toLowerCase() === name.toLowerCase()) hasSource = true;
          }
        }
        return hasVendor || hasSource;
      })
      .map(ing => {
        const updates: any = {};
        if (ing.vendor?.toLowerCase() === name.toLowerCase()) {
          updates.vendor = "";
        }
        if (ing.source && ing.source.includes("(")) {
          const parts = ing.source.split("(");
          if (parts.length > 1) {
            const v = parts[1].replace(")", "").trim();
            if (v.toLowerCase() === name.toLowerCase()) {
              updates.source = parts[0].trim(); // Remove the vendor part from source
            }
          }
        }
        console.log("Updating ingredient", ing.id, updates);
        return safeUpdateDoc("ingredients", ing.id!, updates);
      });
      
    try {
      await Promise.all(batchPromises);
      console.log("Updated ingredients successfully");
    } catch (err) {
      console.error("Failed to update ingredients", err);
    }

    if (isRegistered) {
      try {
        console.log("Deleting registered vendor", id);
        await safeDeleteDoc("vendors", id);
      } catch (err) {
        console.error("Failed to delete vendor", err);
      }
    }
  };

  // Actions for manual ingredient overrides
  const handleAddIngredient = async (item: Omit<Ingredient, "id" | "ownerId" | "updatedAt">) => {
    if (!user || !workspaceOwnerId) return;

    // Duplication Check: name, vendor, price, quantity, unit, and source
    const existingMatch = ingredients.find(ing => 
      (ing.name || "").toLowerCase().trim() === (item.name || "").toLowerCase().trim() &&
      (ing.vendor || "") === (item.vendor || "") &&
      (ing.source || "").toLowerCase().trim() === (item.source || "").toLowerCase().trim() &&
      ing.quantity === item.quantity &&
      ing.unit === item.unit &&
      Math.abs((ing.price || 0) - (item.price || 0)) < 0.001
    );

    if (existingMatch) {
      throw new Error("DUPLICATE_ENTRY");
    }

    const payload = {
      ...item,
      minStock: item.minStock !== undefined && item.minStock > 0 ? item.minStock : 10,
      ownerId: workspaceOwnerId,
      updatedAt: new Date().toISOString()
    };
    await safeAddDoc("ingredients", payload);
  };

  const handleEditIngredient = async (id: string, edits: Partial<Ingredient>) => {
    if (!user) return;
    await safeUpdateDoc("ingredients", id, edits);
  };

  const handleDeleteIngredient = async (id: string) => {
    if (!user) return;
    await safeDeleteDoc("ingredients", id);
  };

  const handleBulkDeleteIngredients = async (ids: string[]) => {
    if (!user) return;
    await safeBulkDeleteDocs("ingredients", ids);
  };

  const handleMatchAndMergeIngredients = async (masterId: string, mergeIds: string[]) => {
    if (!user || !masterId || mergeIds.length === 0) return;

    const masterIng = ingredients.find(i => i.id === masterId);
    if (!masterIng) return;

    let additionalStock = 0;
    // 1. Gather stock and delete merged items from database
    for (const mergeId of mergeIds) {
      const mergedIng = ingredients.find(i => i.id === mergeId);
      if (mergedIng) {
        additionalStock += mergedIng.inStock || 0;
        await safeDeleteDoc("ingredients", mergeId);
      }
    }

    // 2. Update master ingredient stock
    const currentStock = masterIng.inStock || 0;
    await safeUpdateDoc("ingredients", masterId, {
      inStock: currentStock + additionalStock,
      updatedAt: new Date().toISOString()
    });

    // 3. Update any recipe references
    for (const recipe of recipes) {
      let isRecipeUpdated = false;
      const updatedIngredients = recipe.ingredients.map(recIng => {
        if (mergeIds.includes(recIng.ingredientId)) {
          isRecipeUpdated = true;
          return {
            ...recIng,
            ingredientId: masterId,
            name: masterIng.name
          };
        }
        return recIng;
      });

      if (isRecipeUpdated && recipe.id) {
        // Combine duplicate ingredients if we merged multiple things into the same master
        const combinedIngredients: typeof recipe.ingredients = [];
        updatedIngredients.forEach(ing => {
          const existing = combinedIngredients.find(x => x.ingredientId === ing.ingredientId);
          if (existing) {
            existing.grams += ing.grams;
          } else {
            combinedIngredients.push({ ...ing });
          }
        });

        // Recalculate cost accounting for usabilityPercentage and sub-recipes
        let totalCost = 0;
        combinedIngredients.forEach(recIng => {
          if (recIng.isSubRecipe || recIng.subRecipeId) {
            const subRec = recipes.find(r => r.id === (recIng.subRecipeId || recIng.ingredientId));
            const subPortionCost = subRec ? (subRec.costPerPortion || (subRec.totalCost / (subRec.expectedYield || 1)) || 0) : 0;
            totalCost += recIng.grams * subPortionCost;
          } else {
            const ingDetail = ingredients.find(i => i.id === recIng.ingredientId) || (recIng.ingredientId === masterId ? masterIng : null);
            const rawRate = ingDetail ? (ingDetail.pricePerGram || calculateIngredientUnitPrice(ingDetail)) : 0;
            const yieldPct = ingDetail?.usabilityPercentage && ingDetail.usabilityPercentage > 0 ? ingDetail.usabilityPercentage : 100;
            const effectiveRate = rawRate / (yieldPct / 100);
            totalCost += recIng.grams * effectiveRate;
          }
        });

        const yieldValue = recipe.expectedYield || 1;
        const costPerServing = totalCost / yieldValue;
        const profitMargin = recipe.sellingPrice > 0 ? ((recipe.sellingPrice - costPerServing) / recipe.sellingPrice) * 100 : 0;

        await safeUpdateDoc("recipes", recipe.id, {
          ingredients: combinedIngredients,
          totalCost,
          costPerPortion: costPerServing,
          profitMargin,
          updatedAt: new Date().toISOString()
        });
      }
    }
  };

  // Actions for recipes overrides
  const handleAddRecipe = async (item: Omit<Recipe, "id" | "ownerId" | "updatedAt">) => {
    if (!user || !workspaceOwnerId) return;
    const payload = {
      ...item,
      ownerId: workspaceOwnerId,
      updatedAt: new Date().toISOString()
    };
    await safeAddDoc("recipes", payload);
  };

  const handleEditRecipe = async (id: string, edits: Partial<Recipe>) => {
    if (!user) return;
    await safeUpdateDoc("recipes", id, {
      ...edits,
      updatedAt: new Date().toISOString()
    });
  };

  const handleDeleteRecipe = async (id: string) => {
    if (!user) return;
    await safeDeleteDoc("recipes", id);
  };

  const handleReorderRecipes = async (reordered: Recipe[]) => {
    if (!user) return;
    setRecipes(reordered);
    const promises = reordered.map((rec, index) => {
      if (!rec.id) return Promise.resolve();
      return safeUpdateDoc("recipes", rec.id, {
        order: index,
        updatedAt: new Date().toISOString()
      });
    });
    try {
      await Promise.all(promises);
    } catch (err) {
      console.error("Failed to reorder recipes:", err);
    }
  };

  const handleResetAllTestData = async () => {
    if (!window.confirm("Are you sure you want to delete all test data (ingredients, stock inventory, invoices, recipes, and consumption logs)? This action cannot be undone.")) {
      return;
    }
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/dev/reset-all-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ownerId: workspaceOwnerId || user?.uid })
      });
      if (!res.ok) throw new Error("Failed to reset test data");
      setIngredients([]);
      setRecipes([]);
      setInvoices([]);
      setDailySales([]);
      setGroceryPurchases([]);
      [
        "ingredients",
        "recipes",
        "invoices",
        "inventory_counts",
        "inventory_consumptions",
        "dailySales",
        "industrialProducts",
        "groceryPurchases",
        "groceryShoppingList",
        "salesUploads"
      ].forEach((col) => notifyCloudSqlListeners(col));
      window.alert("All test data has been successfully deleted.");
    } catch (err: any) {
      window.alert("Error resetting test data: " + (err.message || String(err)));
    }
  };

  // Industrial Products & Purchase Management Handlers
  const handleAddIndustrialProduct = async (product: Omit<IndustrialProduct, "id" | "ownerId" | "updatedAt">) => {
    if (!user || !workspaceOwnerId) return;
    const payload = {
      ...product,
      ownerId: workspaceOwnerId,
      updatedAt: new Date().toISOString()
    };
    await safeAddDoc("industrialProducts", payload);
  };

  const handleUpdateIndustrialProduct = async (id: string, edits: Partial<IndustrialProduct>) => {
    if (!user) return;
    await safeUpdateDoc("industrialProducts", id, {
      ...edits,
      updatedAt: new Date().toISOString()
    });
  };

  const handleDeleteIndustrialProduct = async (id: string) => {
    if (!user) return;
    await safeDeleteDoc("industrialProducts", id);
  };

  const handleAddGroceryPurchase = async (purchase: Omit<GroceryPurchase, "id" | "ownerId" | "createdAt" | "updatedAt">) => {
    if (!user || !workspaceOwnerId) return;
    const payload = {
      ...purchase,
      ownerId: workspaceOwnerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await safeAddDoc("groceryPurchases", payload);
  };

  const handleUpdateGroceryPurchase = async (id: string, edits: Partial<GroceryPurchase>) => {
    if (!user) return;
    await safeUpdateDoc("groceryPurchases", id, {
      ...edits,
      updatedAt: new Date().toISOString()
    });
  };

  const handleDeleteGroceryPurchase = async (id: string) => {
    if (!user) return;
    await safeDeleteDoc("groceryPurchases", id);
  };

  const handleAddShoppingItem = async (item: Omit<GroceryShoppingItem, "id" | "ownerId" | "createdAt">) => {
    if (!user || !workspaceOwnerId) return;
    const payload = {
      ...item,
      ownerId: workspaceOwnerId,
      createdAt: new Date().toISOString()
    };
    await safeAddDoc("groceryShoppingList", payload);
  };

  const handleToggleShoppingItem = async (id: string, isChecked: boolean) => {
    if (!user) return;
    await safeUpdateDoc("groceryShoppingList", id, { isChecked });
  };

  const handleDeleteShoppingItem = async (id: string) => {
    if (!user) return;
    await safeDeleteDoc("groceryShoppingList", id);
  };

  const handleClearCheckedShoppingItems = async () => {
    if (!user) return;
    const checkedIds = groceryShoppingList.filter(s => s.isChecked && s.id).map(s => s.id!);
    if (checkedIds.length > 0) {
      await safeBulkDeleteDocs("groceryShoppingList", checkedIds);
    }
  };

  const handleSyncIngredientPriceFromGrocery = async (ingredientId: string, newUnitPrice: number, unit: string) => {
    if (!user || !ingredientId) return;
    const ing = ingredients.find(i => i.id === ingredientId);
    if (!ing) return;

    const factor = getGramsOrMlEquivalent(1, unit || ing.unit || "g");
    const pricePerGram = factor > 0 ? newUnitPrice / factor : newUnitPrice;

    await safeUpdateDoc("ingredients", ingredientId, {
      price: newUnitPrice,
      pricePerGram: pricePerGram,
      unit: unit || ing.unit,
      source: "Grocery Store Purchase",
      updatedAt: new Date().toISOString()
    });
  };

  // Actions for employee timecards (memoized for hook stability)
  const handleAddTimecard = React.useCallback(async (item: Omit<Timecard, "id" | "ownerId" | "createdAt">) => {
    if (!user || !workspaceOwnerId) return;
    const payload = {
      ...item,
      ownerId: workspaceOwnerId,
      createdAt: new Date().toISOString()
    };
    await safeAddDoc("timecards", payload);
  }, [user, workspaceOwnerId]);

  const handleBulkDeleteTimecards = React.useCallback(async (ids: string[]) => {
    if (!user) return;
    await safeBulkDeleteDocs("timecards", ids);
  }, [user]);

  // Actions for employees
  const handleAddEmployee = React.useCallback(async (item: Omit<Employee, "id" | "ownerId" | "createdAt">) => {
    if (!user || !workspaceOwnerId) return;
    const payload = {
      ...item,
      ownerId: workspaceOwnerId,
      createdAt: new Date().toISOString()
    };
    await safeAddDoc("employees", payload);

    // Automatically propagate employeeCode to existing timecards in Firestore
    if (item.employeeCode) {
      const matchingTimecards = timecards.filter(tc => 
        tc.employeeName.toLowerCase().trim() === item.name.toLowerCase().trim() &&
        tc.employeeCode !== item.employeeCode
      );
      for (const tc of matchingTimecards) {
        if (tc.id) {
          await safeUpdateDoc("timecards", tc.id, { employeeCode: item.employeeCode });
        }
      }
    }
  }, [user, workspaceOwnerId, timecards]);

  const handleEditEmployee = React.useCallback(async (id: string, edits: Partial<Employee>) => {
    if (!user || !workspaceOwnerId) return;
    if (id.startsWith("standard-")) {
      const std = combinedEmployees.find(e => e.id === id);
      if (std) {
        const { id: _ignore, ...rest } = std;
        await safeAddDoc("employees", {
          ...rest,
          ...edits,
          ownerId: workspaceOwnerId,
          createdAt: new Date().toISOString()
        });
      }
    } else {
      await safeUpdateDoc("employees", id, edits);
    }
  }, [user, workspaceOwnerId, combinedEmployees]);

  const handleDeleteEmployee = React.useCallback(async (id: string) => {
    if (!user) return;
    const targetEmp = combinedEmployees.find(e => e.id === id);
    const empName = (targetEmp?.name || "").trim();
    if (empName) {
      try {
        const raw = localStorage.getItem("deleted_employees");
        const list = raw ? JSON.parse(raw) : [];
        if (!list.includes(empName.toLowerCase())) {
          list.push(empName.toLowerCase());
          localStorage.setItem("deleted_employees", JSON.stringify(list));
        }
      } catch {}
    }
    if (!id.startsWith("standard-")) {
      await safeDeleteDoc("employees", id);
    }
  }, [user, combinedEmployees]);

  // Modular Time Clock & Live Shift Management Hook
  const {
    activeShifts,
    verifyEmployeeByPinOrCode,
    getActiveShiftForEmployee,
    clockIn: handleClockIn,
    startBreak: handleStartBreak,
    endBreak: handleEndBreak,
    clockOut: handleClockOut,
    assignEmployeePin: handleAssignEmployeePin,
  } = useTimeclock({
    workspaceOwnerId,
    employees: combinedEmployees,
    onAddTimecard: handleAddTimecard,
    onEditEmployee: handleEditEmployee,
  });

  const handleAddDailySale = async (item: Omit<DailySale, "id" | "ownerId" | "createdAt">) => {
    if (!user || !workspaceOwnerId) return;
    const payload = {
      ...item,
      ownerId: workspaceOwnerId,
      createdAt: new Date().toISOString()
    };
    await safeAddDoc("dailySales", payload);
  };

  const handleDeleteDailySale = async (id: string) => {
    if (!user) return;
    await safeDeleteDoc("dailySales", id);
  };

  const handleUpdateDailySale = async (id: string, edits: Partial<DailySale>) => {
    if (!user) return;
    await safeUpdateDoc("dailySales", id, edits);
  };

  const handleAddSalesUpload = async (upload: Omit<any, "id" | "ownerId">) => {
    if (!user || !workspaceOwnerId) return;
    const payload = {
      ...upload,
      ownerId: workspaceOwnerId
    };
    await safeAddDoc("salesUploads", payload);
  };

  const handleDeleteSalesUpload = async (id: string) => {
    if (!user) return;
    await safeDeleteDoc("salesUploads", id);
  };

  // Intelligent Invoice Mapping Apply callback
  const handleApplyParsedItems = async (
    itemsToApply: Array<{
      action: "create" | "map" | "skip";
      parsedItem: ParsedInvoiceItem;
      targetIngredientId?: string;
    }>,
    vendor: string,
    invoiceNumber: string,
    date: string,
    fileName?: string,
    isPriceCorrectionOnly: boolean = false,
    fileAttachment?: {
      fileUrl?: string;
      fileType?: string;
      fileSize?: number;
    }
  ) => {
    const targetOwnerId = workspaceOwnerId || user?.uid || "default-owner";

    // Helper to normalize invoice date string to ISO YYYY-MM-DD
    const normalizeDateToISO = (dateStr?: string): string => {
      if (!dateStr || !dateStr.trim()) {
        return new Date().toISOString().slice(0, 10);
      }
      const trimmed = dateStr.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
      }
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      return new Date().toISOString().slice(0, 10);
    };

    const consumptionDateIso = normalizeDateToISO(date);
    const invoiceRecordedBy = invoiceNumber ? `AI Document Parser (#${invoiceNumber})` : "AI Document Parser";
    const invoiceOperatorName = user?.displayName || user?.email || "AI Document Parser";

    // Auto-register vendor in suppliers list if not already present
    if (vendor && vendor.trim() && vendor !== "Unknown Vendor") {
      const cleanVendor = vendor.trim();
      const alreadyHas = vendors.some(v => v.name && v.name.toLowerCase().trim() === cleanVendor.toLowerCase());
      if (!alreadyHas) {
        try {
          await safeAddDoc("vendors", {
            name: cleanVendor,
            ownerId: targetOwnerId,
            createdAt: new Date().toISOString(),
            isRegistered: true
          });
        } catch (vErr) {
          console.warn("Could not register vendor:", vErr);
        }
      }
    }

    const localIngredientsMap = new Map<string, any>();
    const localIndustrialMap = new Map<string, IndustrialProduct>();
    const appliedIndustrialPurchaseItems: Array<{
      id: string;
      name: string;
      quantity: number;
      unit: string;
      price: number;
      unitPrice: number;
      category: string;
      linkedIngredientId?: string;
    }> = [];

    // Process items sequentially without mutating the array during iteration
    for (const rawItem of itemsToApply) {
      if (rawItem.action === "skip") continue;

      const { name, totalPrice, quantity, unit } = rawItem.parsedItem;
      const parsedUnit = (unit || "lb").trim();
      const rawQtyStr = String(quantity ?? "").replace(/[^0-9.]/g, "");
      const coercedQty = Number(rawQtyStr) > 0 ? Number(rawQtyStr) : 1;

      const rawPriceStr = String(totalPrice ?? "").replace(/[^0-9.]/g, "");
      const coercedPrice = Number(rawPriceStr) >= 0 ? Number(rawPriceStr) : 0;

      // Route Industrial Products strictly to the Industrial Products catalog & purchase history
      // without touching any culinary ingredients logic
      if (rawItem.parsedItem.itemTargetType === "industrial") {
        const indName = (name || "Industrial Item").trim();
        const rawPkgCandidate = (
          rawItem.parsedItem.packagingUnit ||
          unit ||
          rawItem.parsedItem.originalDocUnit ||
          "Case"
        ).trim();
        const indPackagingUnit =
          rawPkgCandidate.toLowerCase() === "pc" || rawPkgCandidate.toLowerCase() === "pcs"
            ? "Case"
            : rawPkgCandidate.charAt(0).toUpperCase() + rawPkgCandidate.slice(1);
        const indCategory = rawItem.parsedItem.category || "Packaging & Containers";
        const sourceLabel = isPriceCorrectionOnly
          ? `Price Correction #${invoiceNumber || "ADJ"} (${vendor || "Supplier"})`
          : `Invoice #${invoiceNumber || "INV"} (${vendor || "Supplier"})`;

        let targetIndId: string | undefined = rawItem.parsedItem.targetIndustrialId || undefined;
        let existingInd: IndustrialProduct | undefined;

        if (targetIndId) {
          existingInd =
            localIndustrialMap.get(targetIndId) ||
            industrialProducts.find((p) => p.id === targetIndId);
        }
        if (!existingInd) {
          for (const [id, locProd] of localIndustrialMap.entries()) {
            if (locProd.name.toLowerCase().trim() === indName.toLowerCase()) {
              targetIndId = id;
              existingInd = locProd;
              break;
            }
          }
        }
        if (!existingInd) {
          const catalogMatch = industrialProducts.find(
            (p) => (p.name || "").toLowerCase().trim() === indName.toLowerCase()
          );
          if (catalogMatch?.id) {
            targetIndId = catalogMatch.id;
            existingInd = catalogMatch;
          }
        }

        const indPackRatio = Number(
          rawItem.parsedItem.pcsPerPound ||
            existingInd?.pcsPerPack ||
            existingInd?.pcsPerPound ||
            0
        );
        const totalBasePcs =
          indPackRatio > 0
            ? Number((coercedQty * indPackRatio).toFixed(2))
            : coercedQty;
        const indUnitPricePerPc =
          totalBasePcs > 0
            ? Number((coercedPrice / totalBasePcs).toFixed(6))
            : coercedPrice;
        const indRegPack =
          rawItem.parsedItem.registeredPackSize ||
          existingInd?.registeredPackSize ||
          (indPackRatio > 0
            ? `${indPackRatio}pc per ${indPackagingUnit.toLowerCase()}`
            : undefined);
        const indConversions =
          rawItem.parsedItem.conversions || existingInd?.conversions || undefined;

        (rawItem.parsedItem as any).appliedBaseQty = totalBasePcs;

        if (existingInd && targetIndId) {
          const prevStock = Number(existingInd.inStock ?? 0);
          const nextStock = isPriceCorrectionOnly
            ? prevStock
            : Number((prevStock + totalBasePcs).toFixed(2));
          const updatedProd: IndustrialProduct = {
            ...existingInd,
            id: targetIndId,
            name: existingInd.name || indName,
            category: indCategory || existingInd.category || "Packaging & Containers",
            vendor: (vendor && vendor.trim()) || existingInd.vendor || "Supplier",
            price: coercedPrice,
            quantity: totalBasePcs,
            unit: "pc",
            baseUnit: "pc",
            packagingUnit: indPackagingUnit,
            ...(indPackRatio > 0
              ? { pcsPerPack: indPackRatio, pcsPerPound: indPackRatio }
              : {}),
            ...(indRegPack ? { registeredPackSize: indRegPack } : {}),
            ...(indConversions ? { conversions: indConversions } : {}),
            unitPrice: indUnitPricePerPc,
            inStock: nextStock,
            minStock: existingInd.minStock ?? (indPackRatio > 0 ? indPackRatio : 5),
            source: sourceLabel,
            ownerId: targetOwnerId,
            updatedAt: new Date().toISOString(),
          };
          await safeUpdateDoc("industrialProducts", targetIndId, updatedProd, { silent: true });
          localIndustrialMap.set(targetIndId, updatedProd);
          rawItem.parsedItem.targetIndustrialId = targetIndId;
        } else {
          const newProdPayload: Omit<IndustrialProduct, "id"> = {
            name: indName,
            category: indCategory,
            vendor: (vendor && vendor.trim()) || "Supplier",
            price: coercedPrice,
            quantity: totalBasePcs,
            unit: "pc",
            baseUnit: "pc",
            packagingUnit: indPackagingUnit,
            ...(indPackRatio > 0
              ? { pcsPerPack: indPackRatio, pcsPerPound: indPackRatio }
              : {}),
            ...(indRegPack ? { registeredPackSize: indRegPack } : {}),
            ...(indConversions ? { conversions: indConversions } : {}),
            unitPrice: indUnitPricePerPc,
            inStock: isPriceCorrectionOnly ? 0 : totalBasePcs,
            minStock: indPackRatio > 0 ? indPackRatio : 5,
            source: sourceLabel,
            ownerId: targetOwnerId,
            updatedAt: new Date().toISOString(),
          };
          const createdDoc = await safeAddDoc("industrialProducts", newProdPayload, { silent: true });
          const createdId = createdDoc?.id;
          if (createdId) {
            localIndustrialMap.set(createdId, { ...newProdPayload, id: createdId });
            rawItem.parsedItem.targetIndustrialId = createdId;
          }
        }

        appliedIndustrialPurchaseItems.push({
          id: `ind-item-${Date.now()}-${appliedIndustrialPurchaseItems.length + 1}`,
          name: indName,
          quantity: totalBasePcs,
          unit: "pc",
          price: coercedPrice,
          unitPrice: indUnitPricePerPc,
          category: indCategory,
          linkedIngredientId: rawItem.parsedItem.targetIndustrialId,
        });

        continue;
      }

      // Determine whether this item maps to an existing ingredient (or one created earlier in this batch)
      let effectiveAction: "create" | "map" = rawItem.action === "map" ? "map" : "create";
      let targetId: string | undefined = rawItem.targetIngredientId || undefined;

      if (!targetId) {
        for (const [id, localIng] of localIngredientsMap.entries()) {
          if (localIng.name && localIng.name.toLowerCase().trim() === (name || "").toLowerCase().trim()) {
            targetId = id;
            effectiveAction = "map";
            break;
          }
        }
      }

      if (!targetId) {
        const { match: matchedCatalogIng } = findIngredientMatchForInvoiceItem(name || "", ingredients);
        const exactNameMatch = ingredients.find(
          (ing) => (ing.name || "").toLowerCase().trim() === (name || "").toLowerCase().trim()
        );
        const resolvedMatch = exactNameMatch || matchedCatalogIng;
        if (resolvedMatch?.id) {
          targetId = resolvedMatch.id;
          effectiveAction = "map";
        } else {
          effectiveAction = "create";
        }
      }

      const baseIng = targetId ? ingredients.find((ing) => ing.id === targetId) : undefined;
      const targetIng = targetId ? (localIngredientsMap.get(targetId) || baseIng) : undefined;

      if (effectiveAction === "map" && !targetIng) {
        effectiveAction = "create";
      }

      // Infer pack specification and strict Base Unit ("lb" | "pc" | "oz")
      const inferredSpec =
        extractWeightSpecFromName(name) ||
        (targetIng ? extractWeightSpecFromName(targetIng.name) : null);

      const targetPackInfo = getRegisteredPackSize(targetIng);
      const strictBaseUnit =
        rawItem.parsedItem.baseUnit ||
        (targetIng ? normalizeBaseUnit(targetIng.unit, targetIng) : normalizeBaseUnit(parsedUnit, rawItem.parsedItem));

      const finalWeightPerCase =
        rawItem.parsedItem.weightPerCase !== undefined && Number(rawItem.parsedItem.weightPerCase) > 0
          ? Number(rawItem.parsedItem.weightPerCase)
          : targetIng?.weightPerCase && Number(targetIng.weightPerCase) > 0
          ? Number(targetIng.weightPerCase)
          : inferredSpec?.weight;

      const finalWeightPerCaseUnit =
        strictBaseUnit === "oz"
          ? "oz"
          : rawItem.parsedItem.weightPerCaseUnit || targetIng?.weightPerCaseUnit || inferredSpec?.unit || "lb";

      const finalPcsPerPound =
        rawItem.parsedItem.pcsPerPound !== undefined && Number(rawItem.parsedItem.pcsPerPound) > 0
          ? Number(rawItem.parsedItem.pcsPerPound)
          : targetIng?.pcsPerPound && Number(targetIng.pcsPerPound) > 0
          ? Number(targetIng.pcsPerPound)
          : undefined;

      const finalUsability =
        rawItem.parsedItem.usabilityPercentage !== undefined
          ? Number(rawItem.parsedItem.usabilityPercentage)
          : targetIng?.usabilityPercentage !== undefined
          ? targetIng.usabilityPercentage
          : 100;

      const rawPkgCandidate =
        rawItem.parsedItem.packagingUnit ||
        (targetPackInfo.hasRegisteredPackSize ? targetPackInfo.displayPackUnit : targetIng?.packagingUnit) ||
        (!isStrictBaseUnit(parsedUnit) && parsedUnit
          ? parsedUnit.charAt(0).toUpperCase() + parsedUnit.slice(1).toLowerCase()
          : undefined);

      const finalPackagingUnit =
        rawPkgCandidate && !isStrictBaseUnit(rawPkgCandidate) ? rawPkgCandidate : undefined;

      // Determine pack ratio (how many Base Units per 1 Package Unit, e.g. 40 lb per Box)
      const matchedConversionRatio =
        Array.isArray(targetIng?.conversions) && targetIng.conversions.length > 0
          ? Number(
              (
                targetIng.conversions.find(
                  (c: any) =>
                    c.targetUnit &&
                    (c.targetUnit.toLowerCase().trim() === parsedUnit.toLowerCase().trim() ||
                      c.targetUnit.toLowerCase().trim() === (finalPackagingUnit || "").toLowerCase().trim())
                ) || targetIng.conversions[0]
              )?.ratio
            ) || 0
          : 0;

      const packRatio =
        strictBaseUnit === "pc"
          ? (finalPcsPerPound && finalPcsPerPound > 0
              ? finalPcsPerPound
              : finalWeightPerCase && finalWeightPerCase > 0
              ? finalWeightPerCase
              : matchedConversionRatio > 0
              ? matchedConversionRatio
              : targetPackInfo.allPackSizes?.[0]?.ratio ||
                (targetIng?.packagingUnit && Number(targetIng?.quantity) > 1 ? Number(targetIng.quantity) : 0))
          : (finalWeightPerCase && finalWeightPerCase > 0
              ? finalWeightPerCase
              : finalPcsPerPound && finalPcsPerPound > 0
              ? finalPcsPerPound
              : matchedConversionRatio > 0
              ? matchedConversionRatio
              : targetPackInfo.allPackSizes?.[0]?.ratio ||
                (targetIng?.packagingUnit && Number(targetIng?.quantity) > 1 ? Number(targetIng.quantity) : 0));

      // Determine whether the invoice line quantity (`coercedQty`, e.g. 10 Boxes) is in Package Units or already in Base Units
      const rawDocUnitClean = (rawItem.parsedItem.originalDocUnit || "").toLowerCase().trim();
      const parsedUnitClean = parsedUnit.toLowerCase().trim();
      const isInvoiceQtyInPackages =
        packRatio > 0 &&
        (!isStrictBaseUnit(parsedUnitClean) ||
          Boolean(finalPackagingUnit) ||
          targetPackInfo.hasRegisteredPackSize ||
          (rawDocUnitClean !== "" &&
            rawDocUnitClean !== "no unit in document" &&
            !isStrictBaseUnit(rawDocUnitClean)));

      // Total Base Unit quantity for the invoice price (e.g. 10 Box * 40 lb/Box = 400 lb for $55.60)
      let totalBaseQty = coercedQty;
      if (isInvoiceQtyInPackages && packRatio > 0) {
        totalBaseQty = Number((coercedQty * packRatio).toFixed(4));
      } else if (strictBaseUnit === "lb" && ["oz", "ounce", "ounces"].includes(parsedUnitClean)) {
        totalBaseQty = Number((coercedQty / 16).toFixed(4));
      } else if (strictBaseUnit === "oz" && ["lb", "lbs", "pound", "pounds"].includes(parsedUnitClean)) {
        totalBaseQty = Number((coercedQty * 16).toFixed(4));
      }

      if (totalBaseQty <= 0 || isNaN(totalBaseQty)) {
        totalBaseQty = 1;
      }

      const finalConversions =
        (rawItem.parsedItem as any).conversions ||
        targetIng?.conversions ||
        undefined;

      let finalPricePerGram = calculateIngredientUnitPrice({
        price: coercedPrice,
        quantity: totalBaseQty,
        unit: strictBaseUnit,
        packagingUnit: finalPackagingUnit,
        weightPerCase: (strictBaseUnit === "lb" || strictBaseUnit === "oz") && packRatio > 0 ? packRatio : undefined,
        weightPerCaseUnit: strictBaseUnit === "oz" ? "oz" : "lb",
        pcsPerPound: strictBaseUnit === "pc" && packRatio > 0 ? packRatio : undefined,
        conversions: finalConversions,
      });

      if (isNaN(finalPricePerGram) || !isFinite(finalPricePerGram) || finalPricePerGram < 0) {
        finalPricePerGram = 0;
      }

      const resolvedCategory =
        rawItem.parsedItem.category ||
        targetIng?.category ||
        rawItem.parsedItem.aiRecommendedCategory ||
        "Dry Goods";

      if (effectiveAction === "create") {
        const itemSource = isPriceCorrectionOnly
          ? `Price correction (${vendor || fileName || "document"})`
          : `Invoice #${invoiceNumber || "N/A"} (${vendor})`;

        const createPayload: any = {
          name,
          price: coercedPrice,
          quantity: totalBaseQty,
          inStock: totalBaseQty,
          minStock: 10,
          unit: strictBaseUnit,
          baseUnit: strictBaseUnit,
          category: resolvedCategory,
          ...(finalPackagingUnit ? { packagingUnit: finalPackagingUnit } : {}),
          pricePerGram: finalPricePerGram,
          source: itemSource,
          vendor: vendor || undefined,
          ownerId: targetOwnerId,
          updatedAt: new Date().toISOString(),
          usabilityPercentage: finalUsability,
          ...((strictBaseUnit === "lb" || strictBaseUnit === "oz") && packRatio > 0
            ? {
                weightPerCase: packRatio,
                weightPerCaseUnit: strictBaseUnit === "oz" ? "oz" : "lb",
              }
            : {}),
          ...(strictBaseUnit === "pc" && packRatio > 0
            ? {
                pcsPerPound: packRatio,
              }
            : {}),
          ...(finalConversions ? { conversions: finalConversions } : {}),
        };
        const newDocRef = await safeAddDoc("ingredients", createPayload, { silent: true });

        // Store targetIngredientId on rawItem so the invoice record links to the created ingredient
        rawItem.targetIngredientId = newDocRef.id;
        (rawItem.parsedItem as any).appliedBaseQty = totalBaseQty;

        localIngredientsMap.set(newDocRef.id, {
          id: newDocRef.id,
          ...createPayload,
        });
      } else if (effectiveAction === "map" && targetId) {
        const currentStock = Number(targetIng?.inStock) || 0;
        const isStubFromPackSizeReg =
          targetIng?.source === "Pack Size Registration" && currentStock === 0;
        // Increase stock based on the corresponding item in inventory (unless explicit price-only adjustment on an already stocked item)
        const newStock =
          isPriceCorrectionOnly && !isStubFromPackSizeReg && currentStock > 0
            ? currentStock
            : Number((currentStock + totalBaseQty).toFixed(4));

        (rawItem.parsedItem as any).appliedBaseQty = totalBaseQty;

        // Also save invoice alias if invoice line name differs from master ingredient name
        const existingAliases: string[] = Array.isArray(targetIng?.invoiceAliases)
          ? [...targetIng.invoiceAliases]
          : [];
        if (
          name &&
          targetIng?.name &&
          name.trim().toLowerCase() !== targetIng.name.trim().toLowerCase()
        ) {
          const cleanAlias = name.trim();
          saveNamingMatchToStorage(cleanAlias, targetId, targetIng.name);
          if (!existingAliases.some((a) => a.toLowerCase().trim() === cleanAlias.toLowerCase())) {
            existingAliases.push(cleanAlias);
          }
        }

        const updatePayload: any = {
          price: coercedPrice,
          quantity: totalBaseQty,
          inStock: newStock,
          unit: strictBaseUnit,
          baseUnit: strictBaseUnit,
          category: resolvedCategory,
          pricePerGram: finalPricePerGram,
          source: isPriceCorrectionOnly
            ? `Price corrected via ${invoiceNumber ? "#" + invoiceNumber : ""} (${vendor || fileName || "document"})`
            : `Updated via Invoice #${invoiceNumber || "N/A"} (${vendor})`,
          updatedAt: new Date().toISOString(),
          usabilityPercentage: finalUsability,
          ...(finalPackagingUnit ? { packagingUnit: finalPackagingUnit } : {}),
          ...(vendor ? { vendor } : {}),
          ...((strictBaseUnit === "lb" || strictBaseUnit === "oz") && packRatio > 0
            ? {
                weightPerCase: packRatio,
                weightPerCaseUnit: strictBaseUnit === "oz" ? "oz" : "lb",
              }
            : {}),
          ...(strictBaseUnit === "pc" && packRatio > 0
            ? {
                pcsPerPound: packRatio,
              }
            : {}),
          ...(finalConversions ? { conversions: finalConversions } : {}),
          ...(existingAliases.length > 0 ? { invoiceAliases: existingAliases } : {}),
        };

        localIngredientsMap.set(targetId, {
          ...(targetIng || {}),
          ...updatePayload,
          id: targetId,
        });

        try {
          await safeUpdateDoc("ingredients", targetId, updatePayload, { silent: true });
        } catch (updErr) {
          console.warn("safeUpdateDoc failed, fallback to safeSetDoc:", updErr);
          try {
            await safeSetDoc("ingredients", targetId, {
              ...updatePayload,
              name: targetIng?.name || name,
              ownerId: targetOwnerId,
            }, { silent: true });
          } catch (setErr) {
            console.error("Failed to update or set ingredient doc:", setErr);
          }
        }
      }
    }

    // Immediately update local React ingredients state so Inventory & Catalog views reflect stock increases right away
    if (localIngredientsMap.size > 0) {
      setIngredients((prev) => {
        const existingIds = new Set(prev.map((i) => i.id));
        const updated = prev.map((ing) =>
          ing.id && localIngredientsMap.has(ing.id) ? { ...ing, ...localIngredientsMap.get(ing.id) } : ing
        );
        for (const [id, newIng] of localIngredientsMap.entries()) {
          if (!existingIds.has(id)) {
            updated.push(newIng);
          }
        }
        updated.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        return updated;
      });
    }

    // Recalculate and update dependent recipe summaries in parallel
    const recipeUpdatePromises = recipes.map(async (recipe) => {
      let totalCost = 0;
      let hasIngredientUpdates = false;

      recipe.ingredients.forEach((recIng) => {
        if (recIng.isSubRecipe || recIng.subRecipeId) {
          const subRec = recipes.find((r) => r.id === (recIng.subRecipeId || recIng.ingredientId));
          const subPortionCost = subRec
            ? subRec.costPerPortion || subRec.totalCost / (subRec.expectedYield || 1) || 0
            : 0;
          totalCost += recIng.grams * subPortionCost;
          return;
        }

        const updatedIng = localIngredientsMap.get(recIng.ingredientId);
        if (updatedIng) {
          hasIngredientUpdates = true;
        }
        const masterIng = updatedIng || ingredients.find((ing) => ing.id === recIng.ingredientId);
        const rawRate = masterIng
          ? typeof masterIng.pricePerGram === "number" && masterIng.pricePerGram > 0
            ? masterIng.pricePerGram
            : calculateIngredientUnitPrice(masterIng)
          : 0;
        const yieldPct =
          masterIng?.usabilityPercentage && masterIng.usabilityPercentage > 0
            ? masterIng.usabilityPercentage
            : 100;
        const effectiveRate = rawRate / (yieldPct / 100);
        totalCost += recIng.grams * effectiveRate;
      });

      if (hasIngredientUpdates && recipe.id) {
        const yieldValue = recipe.expectedYield || 1;
        const costPerServing = totalCost / yieldValue;
        const profitMargin =
          recipe.sellingPrice > 0
            ? ((recipe.sellingPrice - costPerServing) / recipe.sellingPrice) * 100
            : 0;

        try {
          await safeUpdateDoc("recipes", recipe.id, {
            totalCost,
            costPerPortion: costPerServing,
            profitMargin,
            updatedAt: new Date().toISOString(),
          }, { silent: true });
        } catch (recErr) {
          console.warn("Could not update recipe cost:", recErr);
        }
      }
    });
    await Promise.allSettled(recipeUpdatePromises);

    // Store processed invoice record to db so we can detect duplicates and audit line items in the future
    try {
      const cleanFileName = fileName && fileName.trim().length > 0 ? fileName.trim() : "invoice";
      const totalAmount = itemsToApply.reduce(
        (sum, item) => sum + (Number(item.parsedItem.totalPrice) || 0),
        0
      );

      const hasIndustrialItems = itemsToApply.some(
        (item) => item.parsedItem.itemTargetType === "industrial"
      );
      const hasIngredientItems = itemsToApply.some(
        (item) => item.parsedItem.itemTargetType !== "industrial"
      );
      const computedInvoiceType: "ingredient" | "industrial" | "mixed" =
        hasIndustrialItems && hasIngredientItems
          ? "mixed"
          : hasIndustrialItems
          ? "industrial"
          : "ingredient";

      const invoicePayload: any = {
        fileName: cleanFileName.slice(0, 200),
        invoiceNumber: invoiceNumber || (isPriceCorrectionOnly ? "PRICE-ADJ" : "N/A"),
        vendor: (vendor && vendor.trim()) || "Unknown Vendor",
        issueDate: consumptionDateIso || date || new Date().toISOString().slice(0, 10),
        type: isPriceCorrectionOnly ? "price_correction" : "standard_invoice",
        invoiceType: computedInvoiceType,
        items: itemsToApply.map((item) => ({
          name: item.parsedItem.name || "Item",
          unit: item.parsedItem.unit || item.parsedItem.packagingUnit?.toLowerCase() || "box",
          baseUnit: item.parsedItem.baseUnit || "lb",
          packagingUnit: item.parsedItem.packagingUnit,
          registeredPackSize: item.parsedItem.registeredPackSize,
          originalDocUnit: item.parsedItem.originalDocUnit,
          unitMatchedToPackSize: item.parsedItem.unitMatchedToPackSize,
          quantity: item.parsedItem.quantity ?? 1,
          appliedBaseQty: (item.parsedItem as any).appliedBaseQty,
          totalPrice: item.parsedItem.totalPrice ?? 0,
          pricePerUnit: item.parsedItem.pricePerUnit ?? 0,
          targetIngredientId: item.targetIngredientId,
          matchAction: item.action,
          category: item.parsedItem.category || item.parsedItem.aiRecommendedCategory,
          weightPerCase: item.parsedItem.weightPerCase,
          weightPerCaseUnit: item.parsedItem.weightPerCaseUnit,
          pcsPerPound: item.parsedItem.pcsPerPound,
          usabilityPercentage: item.parsedItem.usabilityPercentage,
          itemTargetType: item.parsedItem.itemTargetType || "ingredient",
          targetIndustrialId: item.parsedItem.targetIndustrialId,
        })),
        totalAmount,
        status: "applied",
        ownerId: targetOwnerId,
        createdAt: new Date().toISOString(),
      };

      if (fileAttachment?.fileUrl) {
        try {
          const uploaded = await uploadSourceDocumentToStorage(
            fileAttachment.fileUrl,
            cleanFileName,
            fileAttachment.fileType || "application/octet-stream",
            targetOwnerId
          );
          invoicePayload.fileUrl = uploaded.fileUrl;
          invoicePayload.fileType = uploaded.mimeType || fileAttachment.fileType || "application/octet-stream";
          invoicePayload.fileSize = uploaded.size || fileAttachment.fileSize || 0;
        } catch {
          invoicePayload.fileUrl = fileAttachment.fileUrl;
          invoicePayload.fileType = fileAttachment.fileType || "application/octet-stream";
          invoicePayload.fileSize = fileAttachment.fileSize || 0;
        }
      }

      await safeAddDoc("invoices", invoicePayload, { silent: true });

      // If any items in this document were marked as Industrial Products, also record a purchase entry in Industrial Purchase History
      if (appliedIndustrialPurchaseItems.length > 0 && !isPriceCorrectionOnly) {
        const indTotal = appliedIndustrialPurchaseItems.reduce(
          (s, it) => s + (Number(it.price) || 0),
          0
        );
        await safeAddDoc(
          "groceryPurchases",
          {
            storeName: (vendor && vendor.trim()) || "Unknown Supplier",
            date: consumptionDateIso || date || new Date().toISOString().slice(0, 10),
            paymentMethod: "Company Card",
            purchaserName: invoiceOperatorName,
            receiptNumber: invoiceNumber || undefined,
            notes: `Parsed via AI Document Parser (${cleanFileName})`,
            items: appliedIndustrialPurchaseItems,
            totalAmount: indTotal,
            ownerId: targetOwnerId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { silent: true }
        );
      }
    } catch (dbErr) {
      console.error("Failed to write invoice audit to database:", dbErr);
    }

    // Notify all modified collections once at the end of batch application
    notifyCloudSqlListeners("ingredients");
    notifyCloudSqlListeners("industrialProducts");
    notifyCloudSqlListeners("groceryPurchases");
    notifyCloudSqlListeners("inventory_consumptions");
    notifyCloudSqlListeners("recipes");
    notifyCloudSqlListeners("invoices");
  };

  // Collaborators & Shares actions
  const handleInviteCollaborator = async (invitedEmail: string, role: string) => {
    if (!user) return;
    const emailKey = invitedEmail.trim().toLowerCase();
    if (!emailKey) return;

    const activeOwnerId = workspaceOwnerId || user.uid;
    const activeOwnerEmail = workspaceOwnerEmail || user.email || "Unknown Owner";
    const shareId = `${activeOwnerId}_${emailKey}`;
    
    // Check duplication
    const isAlreadyInvited = myShares.some(s => s.invitedEmail === emailKey);
    if (isAlreadyInvited) {
      throw new Error("This user is already invited to this workspace.");
    }

    const payload = {
      ownerId: activeOwnerId,
      ownerEmail: activeOwnerEmail,
      invitedEmail: emailKey,
      role: role,
      status: "pending",
      createdAt: new Date().toISOString()
    };
    
    const { safeSetDoc } = await import("./lib/firebase");
    await safeSetDoc("shares", shareId, payload);

    return { success: true };
  };

  const handleAcceptInvitation = async (shareId: string, ownerId: string, ownerEmail: string) => {
    if (!user) return;
    try {
      const { safeUpdateDoc } = await import("./lib/firebase");
      await safeUpdateDoc("shares", shareId, {
        status: "accepted",
        acceptedAt: new Date().toISOString()
      });
      handleSwitchWorkspace(ownerId, ownerEmail);
    } catch (err: any) {
      console.error("Failed to accept invitation:", err);
      alert("Failed to accept invitation. Please try again.");
    }
  };

  const handleDeclineInvitation = async (shareId: string, ownerEmail?: string) => {
    if (!user) return;
    try {
      const { safeDeleteDoc } = await import("./lib/firebase");
      await safeDeleteDoc("shares", shareId);
    } catch (err: any) {
      console.error("Failed to decline invitation:", err);
    }
  };

  const handleUpdateCollaboratorRole = async (shareId: string, role: string) => {
    if (!user) return;
    try {
      const { safeUpdateDoc } = await import("./lib/firebase");
      await safeUpdateDoc("shares", shareId, { role: role });
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  };

  const handleRemoveCollaborator = async (shareId: string) => {
    if (!user) return;
    await safeDeleteDoc("shares", shareId);
  };

  const handleSwitchWorkspace = (ownerId: string | null, ownerEmail: string | null) => {
    setWorkspaceOwnerId(ownerId);
    setWorkspaceOwnerEmail(ownerEmail);
    if (ownerId) {
      localStorage.setItem("workspaceOwnerId", ownerId);
      localStorage.setItem("workspaceOwnerEmail", ownerEmail || "");
    } else {
      localStorage.removeItem("workspaceOwnerId");
      localStorage.removeItem("workspaceOwnerEmail");
    }
    // Default back to Food Cost tab when switching workspaces
    setActiveSection("intel");
  };

  React.useEffect(() => {
    if (!incomingSharesLoaded || !user) return;

    if (acceptedIncomingShares.length > 0 && !localStorage.getItem("workspaceOwnerId") && !localStorage.getItem("personalWorkspaceExplicitlySet")) {
      const firstShare = acceptedIncomingShares[0];
      handleSwitchWorkspace(firstShare.ownerId, firstShare.ownerEmail);
      localStorage.setItem("personalWorkspaceExplicitlySet", "true");
    } else if (workspaceOwnerId && workspaceOwnerId !== user.uid) {
      // Validate that current non-personal workspaceOwnerId exists in acceptedIncomingShares
      const hasAccess = acceptedIncomingShares.some((s: any) => s.ownerId === workspaceOwnerId);
      if (!hasAccess) {
        handleSwitchWorkspace(user.uid, user.email);
      }
    }
  }, [user, workspaceOwnerId, acceptedIncomingShares, incomingSharesLoaded]);

  // Custom Departments actions
  const handleAddDept = async (deptName: string) => {
    if (!user || !workspaceOwnerId) return;
    const cleanName = deptName.trim();
    if (!cleanName) return;

    const alreadyInDb = customDepartments.some(d => (d.name || "").toLowerCase().trim() === cleanName.toLowerCase());
    if (alreadyInDb) {
      return; // already exists in database
    }

    await safeAddDoc("departments", {
      name: cleanName,
      description: "",
      ownerId: workspaceOwnerId,
      createdAt: new Date().toISOString()
    });
  };

  const handleDeleteDept = async (deptName: string) => {
    if (!user || !workspaceOwnerId) return;
    const target = combinedDepartments.find(d => (d.name || "").toLowerCase().trim() === deptName.toLowerCase().trim());
    if (target && target.id) {
      await handleDeleteDepartment(target.id);
    }
  };

  // Helper stats summary for dashboard top rail
  const totalRawInventoryValue = ingredients.reduce((sum, ing) => sum + ing.price, 0);
  const averageRecipeMargin = recipes.length > 0 
    ? recipes.reduce((sum, rec) => sum + rec.profitMargin, 0) / recipes.length 
    : 0;
  const criticalMarginRecipesCount = recipes.filter(rec => rec.profitMargin < 50).length;

  return (
    <div className="min-h-screen bg-[#fafaf9] flex flex-col font-sans text-neutral-900 selection:bg-neutral-200" id="main-container">
      {/* App Header (Only shown for guest/onboarding flow) */}
      {!user && <MainHeader user={user} loadingAuth={loadingAuth} workspaceOwnerEmail={workspaceOwnerEmail} />}

      {/* Onboarding Login Wall in case not signed-in (Zero-Trust Security requirement) */}
      {!user && !loadingAuth && !showAuth ? (
        <LandingPage onAccessPortal={() => setShowAuth(true)} />
      ) : !user && !loadingAuth && showAuth ? (
        <main className="flex-1 max-w-md mx-auto flex items-center justify-center p-6 w-full">
          <div className="bg-white rounded-xl border border-neutral-200 p-8 shadow-sm text-center space-y-6 w-full" id="login-wall-container">
            <div className="w-14 h-14 bg-blue-700 text-white rounded-xl flex items-center justify-center mx-auto border border-neutral-200">
              <Building2 className="h-6 w-6" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-base font-bold text-neutral-900 font-sans font-medium tracking-tight">SMA Internal Portal</h2>
              <p className="text-neutral-900/60 font-serif italic text-xs max-w-xs mx-auto">
                Sign in to access unified multi-store analytics, timesheets, and inventory control.
              </p>
            </div>

            {/* SEGMENT CONTROL FOR SIGN IN / SIGN UP OR FORGOT PASSWORD HEADER */}
            {authMode === "forgot" ? (
              <div className="flex items-center justify-between bg-neutral-100 p-2 rounded-xl border border-neutral-200">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signin");
                    setAuthError(null);
                    setResetSuccess(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-700 hover:text-neutral-900 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Sign In</span>
                </button>
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Account Recovery</span>
              </div>
            ) : (
              <div className="flex bg-neutral-100 p-1 rounded-xl border border-neutral-200">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signin");
                    setAuthError(null);
                    setResetSuccess(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    authMode === "signin"
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signup");
                    setAuthError(null);
                    setResetSuccess(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    authMode === "signup"
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  Create Account
                </button>
              </div>
            )}

            {/* FORGOT PASSWORD FORM */}
            {authMode === "forgot" ? (
              <form onSubmit={handlePasswordResetSubmit} className="space-y-4 text-left">
                {resetSuccess ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-250 rounded-xl space-y-2 text-xs text-emerald-900 leading-relaxed">
                    <div className="flex items-center gap-2 font-bold text-emerald-850">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Password Reset Link Sent</span>
                    </div>
                    <p>{resetSuccess}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("signin");
                        setAuthError(null);
                        setResetSuccess(null);
                      }}
                      className="mt-2 text-xs font-bold text-emerald-800 underline hover:text-emerald-950 block cursor-pointer"
                    >
                      Return to Sign In &rarr;
                    </button>
                  </div>
                ) : (
                  <>
                    {authError && (
                      <div className="p-3 bg-red-50 border border-red-250 rounded-xl flex items-start gap-2 text-xs text-red-800 leading-normal">
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                        <span>{authError}</span>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                        Account Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@company.com"
                          className="w-full text-xs border border-neutral-200 rounded-xl pl-10 pr-3 py-2.5 bg-[#fafaf9] focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all text-neutral-850 font-medium"
                        />
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-1">
                        Enter your registered email and we'll send you a link to reset your password.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={authSubmitting}
                      className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs py-3 rounded-xl transition-colors border border-blue-700 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      {authSubmitting ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <span>Sending Reset Link...</span>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <KeyRound className="h-4 w-4" />
                          <span>Send Password Reset Link</span>
                        </div>
                      )}
                    </button>
                  </>
                )}
              </form>
            ) : (
              /* EMAIL & PASSWORD FORM (Sign In / Sign Up) */
              <form onSubmit={handleEmailAuthSubmit} className="space-y-4 text-left">
                {authError && (
                  authError.startsWith("UNAUTHORIZED_DOMAIN:") ? (
                    <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3 text-xs text-amber-900 leading-normal">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                        <div>
                          <p className="font-bold text-amber-950">Domain Not Yet Authorized in Firebase Console</p>
                          <p className="text-[11px] text-amber-800 mt-1">
                            Google Sign-In blocked this request because <strong className="font-mono bg-amber-100 px-1 py-0.5 rounded">{authError.replace("UNAUTHORIZED_DOMAIN:", "")}</strong> is not listed under <em>Authorized Domains</em> in your Firebase Console.
                          </p>
                        </div>
                      </div>
                      <div className="bg-white/90 p-3 rounded-lg border border-amber-200 space-y-2 text-[11px]">
                        <p className="font-bold text-neutral-900">How to authorize supplypilot.space (1-minute setup):</p>
                        <ol className="list-decimal pl-4 space-y-1.5 text-neutral-700">
                          <li>
                            Open Firebase Console:{" "}
                            <a 
                              href="https://console.firebase.google.com/project/gen-lang-client-0192508531/authentication/settings" 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-blue-700 font-bold underline hover:text-blue-900"
                            >
                              Firebase Authorized Domains &rarr;
                            </a>
                          </li>
                          <li>
                            Click <strong>Add domain</strong> and enter: <code className="font-bold bg-neutral-100 px-1 py-0.5 rounded text-neutral-800">supplypilot.space</code> (and <code className="font-bold bg-neutral-100 px-1 py-0.5 rounded text-neutral-800">www.supplypilot.space</code>).
                          </li>
                          <li>
                            In Google Cloud Console, add <code className="font-bold bg-neutral-100 px-1 py-0.5 rounded text-neutral-800">https://supplypilot.space</code> to <em>Authorized JavaScript origins</em> for your OAuth Web Client:{" "}
                            <a 
                              href="https://console.cloud.google.com/apis/credentials?project=gen-lang-client-0192508531" 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-blue-700 font-bold underline hover:text-blue-900"
                            >
                              Google Cloud Credentials &rarr;
                            </a>
                          </li>
                        </ol>
                      </div>
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleGoogleAuth(false)}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] cursor-pointer"
                        >
                          Retry Google Sign-In
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGoogleAuth(true)}
                          className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 rounded-lg font-bold text-[11px] cursor-pointer"
                        >
                          Try Redirect Mode
                        </button>
                        <button
                          type="button"
                          onClick={() => setAuthError(null)}
                          className="text-amber-700 hover:underline text-[11px] ml-auto cursor-pointer"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ) : authError === "POPUP_BLOCKED" ? (
                    <div className="p-3 bg-amber-50 border border-amber-250 rounded-xl space-y-2 text-xs text-amber-900 leading-normal">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                        <div>
                          <p className="font-bold">Popup blocked by browser</p>
                          <p className="text-[11px] text-amber-800">
                            Please allow popups for this site, or sign in using full-page Redirect Mode below.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleGoogleAuth(true)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] cursor-pointer"
                      >
                        Sign In via Redirect Mode
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 bg-red-50 border border-red-250 rounded-xl space-y-2 text-xs text-red-805 leading-normal">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                        <span>{authError}</span>
                      </div>
                      {authMode === "signin" && (
                        <div className="flex items-center gap-3 pt-1 border-t border-red-200/60 text-[11px]">
                          <button
                            type="button"
                            onClick={() => {
                              setAuthMode("signup");
                              setAuthError(null);
                            }}
                            className="font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer"
                          >
                            Need an account? Create one &rarr;
                          </button>
                          <span className="text-neutral-300">|</span>
                          <button
                            type="button"
                            onClick={() => {
                              setAuthMode("forgot");
                              setAuthError(null);
                            }}
                            className="font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer"
                          >
                            Forgot password?
                          </button>
                        </div>
                      )}
                      {authMode === "signup" && (
                        <div className="pt-1 border-t border-red-200/60 text-[11px]">
                          <button
                            type="button"
                            onClick={() => {
                              setAuthMode("signin");
                              setAuthError(null);
                            }}
                            className="font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer"
                          >
                            Already have an account? Sign In &rarr;
                          </button>
                        </div>
                      )}
                    </div>
                  )
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@restaurant.com"
                      className="w-full text-xs border border-neutral-200 rounded-xl pl-10 pr-3 py-2.5 bg-[#fafaf9] focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all text-neutral-850 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                      Password
                    </label>
                    {authMode === "signin" && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("forgot");
                          setAuthError(null);
                          setResetSuccess(null);
                        }}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={authMode === "signin" ? "••••••••" : "Choose a secure password"}
                      className="w-full text-xs border border-neutral-200 rounded-xl pl-10 pr-10 py-2.5 bg-[#fafaf9] focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all text-neutral-850 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="w-full bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs py-3 rounded-xl transition-colors border border-neutral-900 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  {authSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>{authMode === "signin" ? "Signing In..." : "Creating Account..."}</span>
                    </>
                  ) : (
                    <span>{authMode === "signin" ? "Sign In with Email" : "Create Account"}</span>
                  )}
                </button>
              </form>
            )}

            {/* SEPARATOR OR CONTINUATION */}
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-neutral-200"></div>
              <span className="flex-shrink mx-3 text-neutral-450 text-[10px] uppercase font-bold tracking-wider">or</span>
              <div className="flex-grow border-t border-neutral-200"></div>
            </div>

            {/* GOOGLE SIGN IN BUTTONS */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleGoogleAuth(false)}
                disabled={googleSigningIn || authSubmitting}
                className="w-full bg-white hover:bg-neutral-50 text-neutral-800 font-bold text-xs py-3 rounded-xl transition-colors border border-neutral-200 flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
                id="onboarding-login-btn"
              >
                {googleSigningIn ? (
                  <>
                    <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                    <span>Connecting to Google...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <span>Sign In with Google</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleGoogleAuth(true)}
                disabled={googleSigningIn || authSubmitting}
                className="w-full bg-neutral-50 hover:bg-neutral-100 text-neutral-600 font-medium text-[11px] py-2 rounded-xl transition-colors border border-dashed border-neutral-300 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                title="Bypasses popup blockers and cross-origin cookies on custom domains"
              >
                <span>Having trouble? Sign in with Google (Redirect Mode)</span>
              </button>
            </div>

            {/* CUSTOM DOMAIN & AUTHENTICATION GUARD HELP BOX */}
            <div className="text-left bg-emerald-50/50 border border-emerald-250 p-4 rounded-xl text-[11px] text-emerald-850 font-sans space-y-1.5 leading-relaxed">
              <div className="flex gap-2 items-center text-emerald-950 font-bold">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-[10px] uppercase tracking-wider">Custom Domain & Authentication</span>
              </div>
              <p>
                Connecting from <strong>supplypilot.space</strong>? Ensure <code>supplypilot.space</code> is added to <strong>Authorized Domains</strong> in your Firebase Console and <strong>Authorized JavaScript origins</strong> in Google Cloud Credentials. You can also sign in or create an account using Email &amp; Password above.
              </p>
            </div>
          </div>
        </main>
      ) : loadingAuth ? (
        <main className="flex-1 flex flex-col items-center justify-center py-24 space-y-3" id="app-initial-loader">
          <LoaderSpinner />
          <p className="text-[10px] text-neutral-900/65 font-mono ">Validating workspace tokens...</p>
        </main>
      ) : (
        /* Logged In Dashboard Core - FULL-SCREEN LEFT SIDEBAR SYSTEM */
        <div className="flex-1 flex flex-col md:flex-row min-h-screen relative" id="workspace-sidebar-layout">
          
          {/* MOBILE NAVIGATION HEADER */}
          <header className="md:hidden bg-white border-b border-neutral-200 px-4 py-3 sticky top-0 z-30 flex items-center justify-between shadow-sm" id="mobile-workspace-header">
            <div className="flex items-center space-x-2">
              <div className="bg-blue-700 text-white p-1.5 rounded-xl flex items-center justify-center border border-neutral-200">
                <Building2 className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-neutral-900 font-sans">
                SMA Management System
              </span>
            </div>
            
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1 px-1.5 border border-neutral-200 hover:bg-neutral-50 transition-colors flex items-center justify-center cursor-pointer"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </header>

          {/* MOBILE DRAWER OVERLAY */}
          {mobileMenuOpen && (
            <div className="fixed inset-0 z-40 md:hidden flex" id="mobile-sidebar-drawer">
              {/* Backdrop */}
              <div 
                className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs transition-opacity" 
                onClick={() => setMobileMenuOpen(false)}
              />
              
              {/* Menu Card */}
              <div className="relative flex-1 flex flex-col max-w-[280px] w-full bg-white border-r border-neutral-200 p-5 h-full z-50">
                <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
                  <div className="flex items-center space-x-2">
                    <div className="bg-blue-700 text-white p-1.5 rounded-xl flex items-center justify-center border border-neutral-200">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold text-neutral-900 font-sans">SMA Management System</span>
                  </div>
                  <button 
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1 border border-neutral-300 rounded-xl hover:bg-neutral-50"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Nav Links */}
                <nav className="flex-1 space-y-2.5 py-6 overflow-y-auto">

                  <button
                    onClick={() => {
                      setActiveSection("inventory");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between ${
                      activeSection === "inventory" || activeSection === "ai-parser"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      <span>Inventory</span>
                    </div>
                    <span className="text-[9px] font-mono opacity-80 font-bold bg-[#f3f4f6] text-neutral-900 px-1.5 py-0.5 rounded-xl">
                      {ingredients.length} list
                    </span>
                  </button>
                  
                  <div className="pl-6 flex flex-col gap-1 my-1">
                    <button
                      onClick={() => { setActiveSection("ai-parser"); setMobileMenuOpen(false); }}
                      className={`w-full text-left text-[11px] py-2 px-3 rounded-xl ${
                        activeSection === "ai-parser" ? "bg-emerald-100 text-emerald-800 font-bold" : "text-neutral-600 font-medium"
                      }`}
                    >
                      AI Document Parser
                    </button>
                  </div>

                  {userRole !== "staff" && (
                  <>
                  <button
                    onClick={() => {
                      setActiveSection("intel");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between ${
                      activeSection === "intel" || ["catalog", "recipes", "grocery"].includes(activeSection)
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-4 w-4" />
                      <span>Food Cost Overview</span>
                    </div>
                  </button>

                  <div className="pl-6 flex flex-col gap-1 my-1">
                    <button
                      onClick={() => { setActiveSection("catalog"); setMobileMenuOpen(false); }}
                      className={`w-full text-left text-[11px] py-2 px-3 rounded-xl ${
                        activeSection === "catalog" ? "bg-emerald-100 text-emerald-800 font-bold" : "text-neutral-600 font-medium"
                      }`}
                    >
                      Ingredient Prices
                    </button>
                    <button
                      onClick={() => { setActiveSection("recipes"); setMobileMenuOpen(false); }}
                      className={`w-full text-left text-[11px] py-2 px-3 rounded-xl ${
                        activeSection === "recipes" ? "bg-emerald-100 text-emerald-800 font-bold" : "text-neutral-600 font-medium"
                      }`}
                    >
                      Cost Sheets
                    </button>
                    <button
                      onClick={() => { setActiveSection("grocery"); setMobileMenuOpen(false); }}
                      className={`w-full text-left text-[11px] py-2 px-3 rounded-xl ${
                        activeSection === "grocery" ? "bg-emerald-100 text-emerald-800 font-bold" : "text-neutral-600 font-medium"
                      }`}
                    >
                      Industrial Products
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setActiveSection("sales-data");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between ${
                      activeSection === "sales-data"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>Sales Data</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveSection("timesheet");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between ${
                      activeSection === "timesheet"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>Timesheet Audit</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveSection("timeclock");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between ${
                      activeSection === "timeclock"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4" />
                      <span>Time Clock Terminal</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveSection("staff");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between ${
                      activeSection === "staff"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>Staff Registry ({combinedEmployees.length})</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveSection("vendors");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between ${
                      activeSection === "vendors"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      <span>Suppliers</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveSection("invoices");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between ${
                      activeSection === "invoices"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span>Invoices ({invoices.length})</span>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setActiveSection("make-order-list");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between ${
                      activeSection === "make-order-list"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2 ml-4">
                      <Plus className="h-4 w-4" />
                      <span>Make Order List</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveSection("order-templates");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between ${
                      activeSection === "order-templates"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2 ml-4">
                      <FileText className="h-4 w-4" />
                      <span>Order Templates</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveSection("reports");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between cursor-pointer ${
                      activeSection === "reports"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      <span>Report Center</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveSection("departments");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between ${
                      activeSection === "departments"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4" />
                      <span>Departments</span>
                    </div>
                  </button>
                  </>
                  )}

                  {userRole !== "staff" && (
                  <button
                    onClick={() => {
                      setActiveSection("collaborators");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between cursor-pointer ${
                      activeSection === "collaborators"
                        ? "bg-blue-700 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>Collaborators & Workspaces</span>
                    </div>
                  </button>
                  )}
</nav>

                {/* Profile Widget on Drawer bottom */}
                <div className="pt-4 border-t border-neutral-200/20 space-y-3">
                  <div className="flex items-center space-x-2.5 bg-neutral-50 p-2 border border-neutral-200">
                    {user?.photoURL ? (
                      <img
                        src={user.photoURL}
                        referrerPolicy="no-referrer"
                        alt={user.displayName || "User"}
                        className="w-7 h-7 border border-neutral-200"
                      />
                    ) : (
                      <div className="w-7 h-7 bg-emerald-600 text-white flex items-center justify-center text-xs font-mono font-bold">
                        {user?.displayName?.charAt(0) || "U"}
                      </div>
                    )}
                    <div className="text-left font-sans flex-1 overflow-hidden">
                      <div className="text-[10px] font-bold text-neutral-900 truncate">{user?.displayName}</div>
                      <div className="text-[8px] text-neutral-900/60 font-mono truncate">{user?.email}</div>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleSignOut}
                    className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-[10px] font-bold border border-neutral-300 transition-colors flex items-center justify-center gap-2 rounded-xl cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Access Out</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* DESKTOP LEFT SIDEBAR */}
          <aside className={`hidden md:flex flex-col justify-between shrink-0 h-screen sticky top-0 transition-all duration-300 ${sidebarCollapsed ? "w-16" : "w-64"} bg-[#fafaf9] border-r border-neutral-200/60`} id="desktop-app-sidebar">
            <div className={`p-4 flex-1 flex flex-col overflow-y-auto ${sidebarCollapsed ? "items-center" : ""}`}>
                
              {/* Brand Logo & Tag */}
              <div className={`flex items-center justify-between pb-4 mb-2 ${sidebarCollapsed ? "justify-center w-full" : "w-full"}`}>
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-700 text-white p-2 rounded-xl shrink-0 flex items-center justify-center shadow-xs">
                    <Building2 className="h-5 w-5" />
                  </div>
                  {!sidebarCollapsed && (
                    <div>
                      <h1 className="text-[14px] font-bold text-neutral-900 leading-tight">
                        SMA Management
                      </h1>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider font-mono">supplypilot.space</span>
                      </div>
                    </div>
                  )}
                </div>
                {!sidebarCollapsed && (
                  <button onClick={toggleSidebar} className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors shrink-0 border border-neutral-200/50 cursor-pointer">
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Sidebar Active Workspace indicator */}
              {!sidebarCollapsed && user && (
                <div className="mb-4 bg-white border border-neutral-200/80 p-2.5 rounded-xl text-left shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-neutral-400 uppercase font-mono tracking-wider">
                      Active Store
                    </span>
                    <span className={`text-[8px] font-bold px-1 py-0.2 rounded font-mono ${
                      userRole === "admin" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                    }`}>
                      {userRole}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-neutral-900 truncate mt-0.5">
                    {workspaceOwnerId === user.uid ? "My Primary Workspace" : (workspaceOwnerEmail || "Shared Workspace")}
                  </div>
                </div>
              )}

              {sidebarCollapsed && (
                <div className="flex justify-center w-full mt-2 mb-6">
                  <button onClick={toggleSidebar} className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors border border-neutral-200/50">
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Navigation Items */}
              <nav className="space-y-1 text-left flex-1 w-full" id="sidebar-vertical-nav">



                {userRole !== "staff" && (
                <>
                {/* Documents section - sets activeSection to "intel" which has the tabs */}
                <button
                  onClick={() => setActiveSection("intel")}
                  className={`w-full h-12 ${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[14px] font-medium transition-all rounded-lg flex items-center cursor-pointer ${
                    activeSection === "intel" || ["catalog", "recipes", "grocery"].includes(activeSection)
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-3 relative">
                    {(activeSection === "intel" || ["catalog", "recipes", "grocery"].includes(activeSection)) && !sidebarCollapsed && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />}
                    <FileText className={`h-4 w-4 shrink-0 ${(activeSection === "intel" || ["catalog", "recipes", "grocery"].includes(activeSection)) ? "text-emerald-600" : "text-neutral-500"}`} />
                    {!sidebarCollapsed && <span>Food Cost</span>}
                  </div>
                </button>
                
                {/* Nested items under Documents (only visible if not collapsed) */}
                {!sidebarCollapsed && (
                  <div className="pl-9 pr-3 py-1 flex flex-col gap-1">
                    <button
                      onClick={() => setActiveSection("catalog")}
                      className={`w-full text-left text-[13px] py-1.5 transition-colors ${
                        activeSection === "catalog" ? "text-emerald-700 font-medium" : "text-neutral-500 hover:text-neutral-900"
                      }`}
                    >
                      Ingredient Prices
                    </button>
                    <button
                      onClick={() => setActiveSection("recipes")}
                      className={`w-full text-left text-[13px] py-1.5 transition-colors ${
                        activeSection === "recipes" ? "text-emerald-700 font-medium" : "text-neutral-500 hover:text-neutral-900"
                      }`}
                    >
                      Cost Sheets
                    </button>
                    <button
                      onClick={() => setActiveSection("grocery")}
                      className={`w-full text-left text-[13px] py-1.5 transition-colors ${
                        activeSection === "grocery" ? "text-emerald-700 font-medium" : "text-neutral-500 hover:text-neutral-900"
                      }`}
                    >
                      Industrial Products
                    </button>
                  </div>
                )}
                </>
                )}

                {userRole !== "staff" && (
                <button
                  onClick={() => setActiveSection("sales-data")}
                  className={`w-full h-12 ${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[14px] font-medium transition-all rounded-lg flex items-center cursor-pointer ${
                    activeSection === "sales-data"
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-3 relative">
                    {activeSection === "sales-data" && !sidebarCollapsed && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />}
                    <FileSpreadsheet className={`h-4 w-4 shrink-0 ${activeSection === "sales-data" ? "text-emerald-600" : "text-neutral-500"}`} />
                    {!sidebarCollapsed && <span>Sales Data</span>}
                  </div>
                </button>
                )}

                {userRole !== "staff" && (
                <>
                <button
                  onClick={() => setActiveSection("timesheet")}
                  className={`w-full h-10 ${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-between"} text-[13px] font-medium transition-all rounded-lg flex items-center cursor-pointer ${
                    activeSection === "timesheet"
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-3 relative">
                    {activeSection === "timesheet" && !sidebarCollapsed && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />}
                    <Clock className={`h-4 w-4 shrink-0 ${activeSection === "timesheet" ? "text-emerald-600" : "text-neutral-500"}`} />
                    {!sidebarCollapsed && <span>Timesheet Audit</span>}
                  </div>
                  {!sidebarCollapsed && (
                    <span className="bg-neutral-100 text-neutral-600 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md">
                      {timecards.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveSection("staff")}
                  className={`w-full h-10 ${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-between"} text-[13px] font-medium transition-all rounded-lg flex items-center cursor-pointer ${
                    activeSection === "staff"
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-3 relative">
                    {activeSection === "staff" && !sidebarCollapsed && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />}
                    <Briefcase className={`h-4 w-4 shrink-0 ${activeSection === "staff" ? "text-emerald-600" : "text-neutral-500"}`} />
                    {!sidebarCollapsed && <span>Staff Registry</span>}
                  </div>
                  {!sidebarCollapsed && (
                    <span className="bg-neutral-100 text-neutral-600 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md">
                      {combinedEmployees.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveSection("timeclock")}
                  className={`w-full h-10 ${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-between"} text-[13px] font-medium transition-all rounded-lg flex items-center cursor-pointer ${
                    activeSection === "timeclock"
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-3 relative">
                    {activeSection === "timeclock" && !sidebarCollapsed && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />}
                    <KeyRound className={`h-4 w-4 shrink-0 ${activeSection === "timeclock" ? "text-emerald-600" : "text-neutral-500"}`} />
                    {!sidebarCollapsed && <span>Time Clock Terminal</span>}
                  </div>
                  {!sidebarCollapsed && activeShifts.length > 0 && (
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md">
                      {activeShifts.length} active
                    </span>
                  )}
                </button>
                </>
                )}


                {userRole !== "staff" && (
                <button
                  onClick={() => setActiveSection("collaborators")}
                  className={`w-full h-12 ${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[14px] font-medium transition-all rounded-lg flex items-center justify-between cursor-pointer ${
                    activeSection === "collaborators"
                      ? "bg-blue-50 text-blue-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-3 relative">
                    {activeSection === "collaborators" && !sidebarCollapsed && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-r-full" />}
                    <Users className={`h-4 w-4 shrink-0 ${activeSection === "collaborators" ? "text-blue-600" : "text-neutral-500"}`} />
                    {!sidebarCollapsed && <span>Collaborators & Stores</span>}
                  </div>
                </button>
                )}

                <button
                  onClick={() => setActiveSection("inventory")}
                  className={`w-full h-10 ${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[13px] font-medium transition-all rounded-lg flex items-center justify-between cursor-pointer ${
                    activeSection === "inventory" || activeSection === "ai-parser"
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-3 relative">
                    <Package className={`h-4 w-4 shrink-0 ${activeSection === "inventory" || activeSection === "ai-parser" ? "text-emerald-600" : "text-neutral-500"}`} />
                    {!sidebarCollapsed && <span>Inventory</span>}
                  </div>
                  {!sidebarCollapsed && (
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md">{ingredients.filter(i => i.inStock !== undefined).length} / {ingredients.length}</span>
                  )}
                </button>
                
                {!sidebarCollapsed && (
                  <div className="pl-9 pr-3 py-1 flex flex-col gap-1">
                    <button
                      onClick={() => setActiveSection("ai-parser")}
                      className={`w-full text-left text-[13px] py-1.5 transition-colors ${
                        activeSection === "ai-parser" ? "text-emerald-700 font-medium" : "text-neutral-500 hover:text-neutral-900"
                      }`}
                    >
                      AI Document Parser
                    </button>
                  </div>
                )}
                
                {userRole !== "staff" && (
                <button
                  onClick={() => setActiveSection("vendors")}
                  className={`w-full h-10 ${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[13px] font-medium transition-all rounded-lg flex items-center justify-between cursor-pointer ${
                    activeSection === "vendors"
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-3 relative">
                    {activeSection === "vendors" && !sidebarCollapsed && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />}
                    <Building2 className={`h-4 w-4 shrink-0 ${activeSection === "vendors" ? "text-emerald-600" : "text-neutral-500"}`} />
                    {!sidebarCollapsed && <span>Suppliers</span>}
                  </div>
                  {!sidebarCollapsed && (
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md">{uniqueVendorsCount}</span>
                  )}
                </button>
                )}

                <button
                  onClick={() => setActiveSection("invoices")}
                  className={`w-full h-10 ${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-between"} text-[13px] font-medium transition-all rounded-lg flex items-center cursor-pointer ${
                    activeSection === "invoices"
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-3 relative">
                    {activeSection === "invoices" && !sidebarCollapsed && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />}
                    <FileText className={`h-4 w-4 shrink-0 ${activeSection === "invoices" ? "text-emerald-600" : "text-neutral-500"}`} />
                    {!sidebarCollapsed && <span>Invoices</span>}
                  </div>
                  {!sidebarCollapsed && (
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md">{invoices.length}</span>
                  )}
                </button>
                <button
                  onClick={() => setActiveSection("make-order-list")}
                  className={`w-full h-10 ${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[13px] font-medium transition-all rounded-lg flex items-center justify-between cursor-pointer pl-6 ${
                    activeSection === "make-order-list"
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-3 relative">
                    {activeSection === "make-order-list" && !sidebarCollapsed && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />}
                    <Plus className={`h-4 w-4 shrink-0 ${activeSection === "make-order-list" ? "text-emerald-600" : "text-neutral-500"}`} />
                    {!sidebarCollapsed && <span>Make Order List</span>}
                  </div>
                </button>

                <button
                  onClick={() => setActiveSection("order-templates")}
                  className={`w-full h-10 ${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[13px] font-medium transition-all rounded-lg flex items-center justify-between cursor-pointer pl-6 ${
                    activeSection === "order-templates"
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-3 relative">
                    {activeSection === "order-templates" && !sidebarCollapsed && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />}
                    <FileText className={`h-4 w-4 shrink-0 ${activeSection === "order-templates" ? "text-emerald-600" : "text-neutral-500"}`} />
                    {!sidebarCollapsed && <span>Order Templates</span>}
                  </div>
                </button>


                <button
                  onClick={() => setActiveSection("reports")}
                  className={`w-full h-10 ${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[13px] font-medium transition-all rounded-lg flex items-center justify-between cursor-pointer ${
                    activeSection === "reports"
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-3 relative">
                    {activeSection === "reports" && !sidebarCollapsed && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />}
                    <BarChart3 className={`h-4 w-4 shrink-0 ${activeSection === "reports" ? "text-emerald-600" : "text-neutral-500"}`} />
                    {!sidebarCollapsed && <span>Report Center</span>}
                  </div>
                </button>

                {userRole !== "staff" && (
                <button
                  onClick={() => setActiveSection("departments")}
                  className={`w-full h-10 ${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[13px] font-medium transition-all rounded-lg flex items-center justify-between cursor-pointer ${
                    activeSection === "departments"
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-3 relative">
                    <LayoutDashboard className={`h-4 w-4 shrink-0 ${activeSection === "departments" ? "text-emerald-600" : "text-neutral-500"}`} />
                    {!sidebarCollapsed && <span>Departments</span>}
                  </div>
                  {!sidebarCollapsed && (
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md">{resolvedDepts.length}</span>
                  )}
                </button>
                )}
              </nav>
            </div>
            
            <div className="p-3 border-t border-neutral-200 space-y-2">
              {sidebarCollapsed ? (
                <button 
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center p-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors border border-transparent"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 font-bold bg-[#f3f4f6] px-3 py-2 rounded-lg">
                  <span className="truncate max-w-[120px]">{user?.email}</span>
                  <button onClick={handleSignOut} className="hover:text-red-600 p-1 rounded-md hover:bg-neutral-200" title="Sign Out">
                    <LogOut className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </aside>

          {/* MAIN CONTENT */}
          <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden bg-[#f0efeb] relative">
            <InvitationAlert
              pendingInvitations={pendingIncomingShares}
              onAccept={handleAcceptInvitation}
              onDecline={handleDeclineInvitation}
            />
            <MainHeader 
              user={user}
              loadingAuth={loadingAuth}
              workspaceOwnerId={workspaceOwnerId}
              workspaceOwnerEmail={workspaceOwnerEmail}
              incomingShares={incomingShares}
              pendingInvitations={pendingIncomingShares}
              onSwitchWorkspace={handleSwitchWorkspace}
              onAcceptInvitation={handleAcceptInvitation}
              onDeclineInvitation={handleDeclineInvitation}
              onResetTestData={handleResetAllTestData}
              userRole={userRole}
            />
            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-8 relative">
              <Suspense
                fallback={
                  <div className="py-20 flex flex-col items-center justify-center gap-3">
                    <LoaderSpinner />
                    <span className="text-xs font-mono text-neutral-500">Loading workspace module...</span>
                  </div>
                }
              >
              {/* Top Navigation / Dashboard Tabs */}
              {["catalog", "recipes", "intel", "grocery"].includes(activeSection) && (
                <div className="space-y-6">
                  {/* Real-time Business KPI Banner */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-6" id="business-kpi-banner">
                    <div className="bg-emerald-50/30 border border-emerald-100 rounded-2xl p-6 shadow-sm relative overflow-hidden flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Items Tracked</p>
                        <p className="text-3xl font-bold text-neutral-900 font-sans tracking-tight">{ingredients.length}</p>
                      </div>
                      <div className="bg-emerald-100 p-3 rounded-2xl">
                        <Package className="h-6 w-6 text-emerald-600" />
                      </div>
                    </div>
                    <div className="bg-amber-50/30 border border-amber-100 rounded-2xl p-6 shadow-sm relative overflow-hidden flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Active Recipes</p>
                        <p className="text-3xl font-bold text-neutral-900 font-sans tracking-tight">{recipes.length}</p>
                      </div>
                      <div className="bg-amber-100 p-3 rounded-2xl">
                        <ChefHat className="h-6 w-6 text-amber-600" />
                      </div>
                    </div>
                    <div className="bg-blue-50/30 border border-blue-100 rounded-2xl p-6 shadow-sm relative overflow-hidden flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Target Margin</p>
                        <p className="text-3xl font-bold text-neutral-900 font-sans tracking-tight">70<span className="text-xl">%</span></p>
                      </div>
                      <div className="bg-blue-100 p-3 rounded-2xl">
                        <TrendingUp className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                    <div className="bg-purple-50/30 border border-purple-100 rounded-2xl p-6 shadow-sm relative overflow-hidden flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Low Stock Alerts</p>
                        <p className="text-3xl font-bold text-neutral-900 font-sans tracking-tight">{ingredients.filter(i => (i.inStock !== undefined ? i.inStock : (i.quantity || 0)) <= (i.minStock || i.parLevel || 10)).length}</p>
                      </div>
                      <div className="bg-purple-100 p-3 rounded-2xl">
                        <AlertCircle className="h-6 w-6 text-purple-600" />
                      </div>
                    </div>
                  </div>

                  {/* Navigation Tabs */}
                  <div className="flex items-center gap-8 border-b border-neutral-200 px-4">
                    <button
                      onClick={() => setActiveSection("catalog")}
                      className={`pb-4 text-sm font-semibold transition-colors flex items-center gap-2 ${
                        activeSection === "catalog"
                          ? "text-emerald-700 border-b-2 border-emerald-600"
                          : "text-neutral-500 hover:text-neutral-800"
                      }`}
                    >
                      <FileSpreadsheet className="w-4 h-4" /> Master Ingredient Prices
                    </button>
                    <button
                      onClick={() => setActiveSection("recipes")}
                      className={`pb-4 text-sm font-semibold transition-colors flex items-center gap-2 ${
                        activeSection === "recipes"
                          ? "text-emerald-700 border-b-2 border-emerald-600"
                          : "text-neutral-500 hover:text-neutral-800"
                      }`}
                    >
                      <ChefHat className="w-4 h-4" /> Culinary Cost Sheets
                    </button>
                    <button
                      onClick={() => setActiveSection("intel")}
                      className={`pb-4 text-sm font-semibold transition-colors flex items-center gap-2 ${
                        activeSection === "intel"
                          ? "text-emerald-700 border-b-2 border-emerald-600"
                          : "text-neutral-500 hover:text-neutral-800"
                      }`}
                    >
                      <TrendingUp className="w-4 h-4" /> Food Cost Intel
                    </button>
                    <button
                      onClick={() => setActiveSection("grocery")}
                      className={`pb-4 text-sm font-semibold transition-colors flex items-center gap-2 ${
                        activeSection === "grocery"
                          ? "text-emerald-700 border-b-2 border-emerald-600"
                          : "text-neutral-500 hover:text-neutral-800"
                      }`}
                      id="foodcost-tab-grocery"
                    >
                      <Package className="w-4 h-4" /> Industrial Products
                    </button>
                  </div>

                  {/* Content for the selected tab */}
                  {activeSection === "catalog" && <IngredientsView 
                      ingredients={ingredients}
                      vendors={combinedVendors}
                      invoices={invoices}
                      groceryPurchases={groceryPurchases}
                      onAddIngredient={handleAddIngredient}
                      onEditIngredient={handleEditIngredient}
                      onDeleteIngredient={handleDeleteIngredient}
                      onBulkDeleteIngredients={handleBulkDeleteIngredients}
                      onMatchAndMergeIngredients={handleMatchAndMergeIngredients}
                      onResetAllTestData={handleResetAllTestData}
                      isReadOnly={isReadOnly}
                    />}
                  {activeSection === "recipes" && <RecipesView 
                      recipes={recipes}
                      ingredients={ingredients}
                      onAddRecipe={handleAddRecipe}
                      onEditRecipe={handleEditRecipe}
                      onDeleteRecipe={handleDeleteRecipe}
                      onReorderRecipes={handleReorderRecipes}
                      customDepts={resolvedDepts}
                      onAddDept={handleAddDept}
                      onDeleteDept={handleDeleteDept}
                      isReadOnly={isReadOnly}
                    />}
                  {activeSection === "intel" && (
                    <FoodCostIntelView
                      recipes={recipes}
                      dailySales={dailySales}
                      onAddDailySale={handleAddDailySale}
                      onDeleteDailySale={handleDeleteDailySale}
                      isReadOnly={isReadOnly}
                    />
                  )}
                  {activeSection === "grocery" && (
                    <GroceryView
                      ingredients={ingredients}
                      industrialProducts={industrialProducts}
                      vendors={combinedVendors}
                      groceryPurchases={groceryPurchases}
                      shoppingList={groceryShoppingList}
                      onAddIndustrialProduct={handleAddIndustrialProduct}
                      onUpdateIndustrialProduct={handleUpdateIndustrialProduct}
                      onDeleteIndustrialProduct={handleDeleteIndustrialProduct}
                      onAddGroceryPurchase={handleAddGroceryPurchase}
                      onUpdateGroceryPurchase={handleUpdateGroceryPurchase}
                      onDeleteGroceryPurchase={handleDeleteGroceryPurchase}
                      onAddShoppingItem={handleAddShoppingItem}
                      onToggleShoppingItem={handleToggleShoppingItem}
                      onDeleteShoppingItem={handleDeleteShoppingItem}
                      onClearCheckedShoppingItems={handleClearCheckedShoppingItems}
                      onSyncIngredientPrice={handleSyncIngredientPriceFromGrocery}
                      isReadOnly={isReadOnly}
                    />
                  )}
                </div>
              )}

              {activeSection === "ai-parser" && <AIParserView 
                  existingIngredients={ingredients}
                  industrialProducts={industrialProducts}
                  existingInvoices={invoices}
                  vendors={combinedVendors}
                  recipes={recipes}
                  onApplyParsedItems={handleApplyParsedItems}
                  onNavigateToCatalog={() => setActiveSection("inventory")}
                  onNavigateToIndustrial={() => setActiveSection("grocery")}
                  userId={workspaceOwnerId || user.uid}
                  isReadOnly={isReadOnly}
                  queue={parserQueue}
                  setQueue={setParserQueue}
                  activeQueueId={parserActiveQueueId}
                  setActiveQueueId={setParserActiveQueueId}
                  parsingAll={parserParsingAll}
                  setParsingAll={setParserParsingAll}
                />}

              {activeSection === "sales-data" && (
                <SalesDataView
                  recipes={recipes}
                  dailySales={dailySales}
                  salesUploads={salesUploads}
                  onAddDailySale={handleAddDailySale}
                  onDeleteDailySale={handleDeleteDailySale}
                  onUpdateDailySale={handleUpdateDailySale}
                  onAddSalesUpload={handleAddSalesUpload}
                  onDeleteSalesUpload={handleDeleteSalesUpload}
                  userRole={userRole}
                  currentUserEmail={user?.email || "Manager"}
                />
              )}

              {activeSection === "timesheet" && (
                <TimesheetView
                  userId={user?.uid}
                  timecards={timecards}
                  employees={combinedEmployees}
                  onAddTimecard={handleAddTimecard}
                  onAddEmployee={handleAddEmployee}
                  onBulkDeleteTimecards={handleBulkDeleteTimecards}
                  isReadOnly={isReadOnly}
                  activeShiftsCount={activeShifts.length}
                  onOpenTimeClock={() => setActiveSection("timeclock")}
                />
              )}
              {activeSection === "timeclock" && (
                <TimeClockView
                  employees={combinedEmployees}
                  activeShifts={activeShifts}
                  timecards={timecards}
                  verifyEmployeeByPinOrCode={verifyEmployeeByPinOrCode}
                  getActiveShiftForEmployee={getActiveShiftForEmployee}
                  onClockIn={handleClockIn}
                  onStartBreak={handleStartBreak}
                  onEndBreak={handleEndBreak}
                  onClockOut={handleClockOut}
                  onAssignEmployeePin={handleAssignEmployeePin}
                  onSwitchToTimesheets={() => setActiveSection("timesheet")}
                  departments={resolvedDepts}
                  isReadOnly={isReadOnly}
                />
              )}
              {activeSection === "staff" && (
                <StaffRegistryView
                  employees={combinedEmployees}
                  onAddEmployee={handleAddEmployee}
                  onEditEmployee={handleEditEmployee}
                  onDeleteEmployee={handleDeleteEmployee}
                  isReadOnly={isReadOnly}
                />
              )}
              {activeSection === "inventory" && (
                <div className="space-y-5">
                  {/* Inventory Category Switcher: Ingredient Inventory vs Industrial Products Inventory */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setInventoryCategoryTab("ingredient")}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        inventoryCategoryTab === "ingredient"
                          ? "bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                          : "bg-white border-neutral-200 hover:border-emerald-300 hover:bg-emerald-50/20"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            inventoryCategoryTab === "ingredient"
                              ? "bg-emerald-600 text-white"
                              : "bg-emerald-50 text-emerald-600"
                          }`}
                        >
                          <ChefHat className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-neutral-900">
                              Ingredient Inventory
                            </span>
                            <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded-full bg-emerald-100 text-emerald-800">
                              {ingredients.length}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            Culinary ingredients, recipes & food stocktake (Base: lb / pc / oz)
                          </p>
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setInventoryCategoryTab("industrial")}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        inventoryCategoryTab === "industrial"
                          ? "bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-xs"
                          : "bg-white border-neutral-200 hover:border-blue-300 hover:bg-blue-50/20"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            inventoryCategoryTab === "industrial"
                              ? "bg-blue-600 text-white"
                              : "bg-blue-50 text-blue-600"
                          }`}
                        >
                          <Package className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-neutral-900">
                              Industrial Products Inventory
                            </span>
                            <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded-full bg-blue-100 text-blue-800">
                              {industrialProducts.length}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            Packaging, disposables, chemicals & operational supplies (Base: pc)
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>

                  {inventoryCategoryTab === "ingredient" ? (
                    <InventoryView
                      ingredients={ingredients}
                      recipes={recipes}
                      onAddIngredient={handleAddIngredient}
                      onEditIngredient={handleEditIngredient}
                      onDeleteIngredient={handleDeleteIngredient}
                      vendors={combinedVendors}
                      departments={combinedDepartments}
                      isReadOnly={isReadOnly}
                      user={user}
                      workspaceOwnerId={workspaceOwnerId}
                      employees={combinedEmployees}
                    />
                  ) : (
                    <IndustrialInventoryView
                      industrialProducts={industrialProducts}
                      vendors={combinedVendors}
                      departments={combinedDepartments}
                      employees={combinedEmployees}
                      onAddIndustrialProduct={handleAddIndustrialProduct}
                      onUpdateIndustrialProduct={handleUpdateIndustrialProduct}
                      onDeleteIndustrialProduct={handleDeleteIndustrialProduct}
                      isReadOnly={isReadOnly}
                      user={user}
                      workspaceOwnerId={workspaceOwnerId}
                    />
                  )}
                </div>
              )}
              {activeSection === "vendors" && (
                <VendorsView
                  vendors={combinedVendors}
                  ingredients={ingredients}
                  onAddVendor={handleAddVendor}
                  onEditVendor={handleEditVendor}
                  onDeleteVendor={handleDeleteVendor}
                  onSeedVendors={handleSeedVendors}
                  isReadOnly={isReadOnly}
                />
              )}
              {activeSection === "invoices" && (
                <InvoiceManagementView
                  invoices={invoices}
                  vendors={combinedVendors}
                  onAddInvoice={handleAddInvoice}
                  onUpdateInvoice={handleUpdateInvoice}
                  onDeleteInvoice={handleDeleteInvoice}
                  isReadOnly={isReadOnly}
                />
              )}
              {activeSection === "make-order-list" && (
                <OrderListView
                  orderLists={orderLists}
                  vendors={combinedVendors}
                  ingredients={ingredients}
                  onAddOrderList={handleAddOrderList}
                  onUpdateOrderList={handleUpdateOrderList}
                  onDeleteOrderList={handleDeleteOrderList}
                  isReadOnly={isReadOnly}
                />
              )}

              {activeSection === "order-templates" && (
                <OrderTemplatesView
                  vendors={combinedVendors}
                  ingredients={ingredients}
                  onEditVendor={handleEditVendor}
                  isReadOnly={isReadOnly}
                />
              )}

              {activeSection === "reports" && (
                <ReportCenterView
                  invoices={invoices}
                  groceryPurchases={groceryPurchases}
                  ingredients={ingredients}
                  recipes={recipes}
                  dailySales={dailySales}
                  onSwitchSection={setActiveSection}
                  onDeleteInvoice={handleDeleteInvoice}
                  onUpdateInvoice={handleUpdateInvoice}
                  onClearReportCenter={handleClearReportCenter}
                  isReadOnly={isReadOnly}
                />
              )}
              {activeSection === "departments" && (
                <DepartmentsView
                  departments={combinedDepartments}
                  onAddDepartment={handleAddDepartment}
                  onEditDepartment={handleEditDepartment}
                  onDeleteDepartment={handleDeleteDepartment}
                  isReadOnly={isReadOnly}
                />
              )}
              {activeSection === "collaborators" && (
                <CollaboratorsView
                  user={user}
                  myShares={myShares}
                  incomingShares={incomingShares}
                  onInvite={handleInviteCollaborator}
                  onUpdateRole={handleUpdateCollaboratorRole}
                  onRemoveInvite={handleRemoveCollaborator}
                  onAcceptInvitation={handleAcceptInvitation}
                  onDeclineInvitation={handleDeclineInvitation}
                  onSwitchWorkspace={handleSwitchWorkspace}
                  workspaceOwnerId={user?.uid || ""}
                  workspaceOwnerEmail={user?.email || null}
                  userRole={userRole}
                />
              )}

              </Suspense>
            </div>
          </main>

          <AIChatbot 
            invoices={invoices}
            groceryPurchases={groceryPurchases}
            ingredients={ingredients}
            recipes={recipes}
            dailySales={dailySales}
            workspaceOwnerId={workspaceOwnerId || user.uid}
          />
        </div>
      )}
    </div>
  );
}

// Quick micro loading spinner
function LoaderSpinner() {
  return (
    <div className="w-8 h-8 border-2 border-t-[#141414] border-neutral-200/20 rounded-xl animate-spin"></div>
  );
}
