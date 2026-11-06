import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc,
  updateDoc, 
  deleteDoc, 
  query,
  where,
  onSnapshot,
  writeBatch
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth();
export const storage = getStorage(app);

// Sign-in with Google provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
let isGoogleSignInInProgress = false;

export async function signInWithGoogle(preferRedirect = false) {
  if (isGoogleSignInInProgress) {
    return null;
  }
  isGoogleSignInInProgress = true;
  try {
    if (preferRedirect) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    const result = await signInWithPopup(auth, googleProvider);
    return result;
  } catch (error: any) {
    const code = error?.code || "";
    // User intentionally closed the popup or rapid-click superseded a prior popup request
    if (
      code === "auth/popup-closed-by-user" ||
      code === "auth/cancelled-popup-request" ||
      code === "auth/user-cancelled"
    ) {
      return null;
    }
    console.warn("Google sign in issue: ", code || error?.message);
    throw error;
  } finally {
    isGoogleSignInInProgress = false;
  }
}

export async function checkRedirectAuthResult() {
  try {
    const result = await getRedirectResult(auth);
    return result;
  } catch (error: any) {
    console.warn("Redirect auth check issue:", error?.code || error?.message);
    return null;
  }
}

// Sign-in with Email
export async function signInWithEmail(email: string, password: string) {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (error: any) {
    console.warn("Email sign in issue: ", error?.code || error?.message);
    throw error;
  }
}

// Sign-up with Email
export async function signUpWithEmail(email: string, password: string) {
  try {
    return await createUserWithEmailAndPassword(auth, email, password);
  } catch (error: any) {
    console.warn("Email sign up issue: ", error?.code || error?.message);
    throw error;
  }
}

// Send Password Reset Email
export async function sendPasswordReset(email: string) {
  try {
    return await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    console.warn("Password reset issue: ", error?.code || error?.message);
    throw error;
  }
}

// Sign-out
export async function handleSignOut() {
  await signOut(auth);
}

// Error Handling block as forced by firebase-integration skill
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error("Firestore Error Audit JSON: ", JSON.stringify(errInfo));

  // Throw structured JSON error for permission failures or critical write errors,
  // while allowing transient offline/connection errors to be logged without crashing UI listeners
  if (
    errMessage.includes("permission-denied") ||
    errMessage.includes("Missing or insufficient permissions") ||
    errMessage.includes("PERMISSION_DENIED") ||
    operationType === OperationType.CREATE ||
    operationType === OperationType.UPDATE ||
    operationType === OperationType.DELETE ||
    operationType === OperationType.WRITE
  ) {
    throw new Error(JSON.stringify(errInfo));
  }
}

// Safe CRUD abstractions matching error requirements
export async function safeGetDocs(collectionName: string, queryConstraints: any[] = []) {
  try {
    const colRef = collection(db, collectionName);
    const q = queryConstraints.length > 0 ? query(colRef, ...queryConstraints) : colRef;
    return await getDocs(q);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, collectionName);
    throw err;
  }
}

export async function safeGetDoc(collectionName: string, docId: string) {
  try {
    const docRef = doc(db, collectionName, docId);
    return await getDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `${collectionName}/${docId}`);
    throw err;
  }
}

// Helper to recursively remove undefined properties before they are submitted to Firestore
export function removeUndefinedFields(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedFields(item));
  }
  const cleaned: any = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      cleaned[key] = removeUndefinedFields(obj[key]);
    }
  }
  return cleaned;
}

async function syncToCloudSqlBackend(
  method: "POST" | "PUT" | "DELETE",
  endpoint: string,
  body?: any
) {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    const token = await currentUser.getIdToken();
    const res = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn("Cloud SQL sync warning:", err);
    return null;
  }
}

export async function fetchCloudSqlCounts(ownerId: string): Promise<Record<string, number> | null> {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    const token = await currentUser.getIdToken();
    const res = await fetch(`/api/sql/counts?ownerId=${encodeURIComponent(ownerId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.counts || null;
  } catch {
    return null;
  }
}

export async function migrateCollectionsToCloudSql(
  ownerId: string,
  collections: Record<string, any[]>
): Promise<{ migratedCounts?: Record<string, number>; tableCounts?: Record<string, number> } | null> {
  const result = await syncToCloudSqlBackend("POST", "/api/sql/migrate", {
    ownerId,
    collections,
  });
  return result;
}

type CloudSqlCollectionListener = () => void;
const cloudSqlListeners = new Map<string, Set<CloudSqlCollectionListener>>();

export function notifyCloudSqlListeners(collectionName: string) {
  const listeners = cloudSqlListeners.get(collectionName);
  if (listeners) {
    listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.warn("Cloud SQL listener error:", e);
      }
    });
  }
}

export function onCloudSqlCollectionChange(
  collectionName: string,
  listener: CloudSqlCollectionListener
): () => void {
  if (!cloudSqlListeners.has(collectionName)) {
    cloudSqlListeners.set(collectionName, new Set());
  }
  cloudSqlListeners.get(collectionName)!.add(listener);
  return () => {
    cloudSqlListeners.get(collectionName)?.delete(listener);
  };
}

export async function fetchCloudSqlCollection(
  collectionName: string,
  params: { ownerId?: string; invitedEmail?: string }
): Promise<any[] | null> {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    const token = await currentUser.getIdToken();
    const qs = new URLSearchParams();
    if (params.ownerId) qs.set("ownerId", params.ownerId);
    if (params.invitedEmail) qs.set("invitedEmail", params.invitedEmail);
    const res = await fetch(
      `/api/sql/collection/${encodeURIComponent(collectionName)}?${qs.toString()}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return Array.isArray(json.items) ? json.items : null;
  } catch {
    return null;
  }
}

export function subscribeWorkspaceCollection<T = any>(
  collectionName: string,
  params: { ownerId?: string; invitedEmail?: string },
  onData: (items: T[]) => void,
  onError?: (error: any) => void
): () => void {
  let isMounted = true;
  let lastSqlItems: T[] = [];

  const loadFromSql = async (): Promise<boolean> => {
    try {
      const sqlItems = await fetchCloudSqlCollection(collectionName, params);
      if (!isMounted || sqlItems === null) return false;
      lastSqlItems = sqlItems as T[];
      onData(lastSqlItems);
      return true;
    } catch (err) {
      if (onError) onError(err);
      return false;
    }
  };

  loadFromSql();

  const unsubSqlListener = onCloudSqlCollectionChange(collectionName, () => {
    loadFromSql();
  });

  return () => {
    isMounted = false;
    unsubSqlListener();
  };
}

export async function safeSetDoc(
  collectionName: string,
  docId: string,
  data: any,
  options?: { silent?: boolean }
) {
  const cleanData = removeUndefinedFields(data);
  const sqlRes = await syncToCloudSqlBackend(
    "POST",
    `/api/sql/collection/${encodeURIComponent(collectionName)}`,
    {
      id: docId,
      data: cleanData,
      merge: true,
    }
  );
  if (!options?.silent) {
    notifyCloudSqlListeners(collectionName);
  }

  if (!sqlRes) {
    throw new Error(`Failed to save record to Cloud SQL database for ${collectionName}/${docId}`);
  }
}

export async function safeAddDoc(
  collectionName: string,
  data: any,
  options?: { silent?: boolean }
) {
  const cleanData = removeUndefinedFields(data);
  const generatedId =
    cleanData.id ||
    `sql_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const sqlRes = await syncToCloudSqlBackend(
    "POST",
    `/api/sql/collection/${encodeURIComponent(collectionName)}`,
    {
      id: generatedId,
      data: { ...cleanData, id: generatedId },
      merge: false,
    }
  );
  if (!options?.silent) {
    notifyCloudSqlListeners(collectionName);
  }

  if (!sqlRes) {
    throw new Error(`Failed to create record in Cloud SQL database for ${collectionName}`);
  }

  return { id: generatedId };
}

export async function safeUpdateDoc(
  collectionName: string,
  docId: string,
  data: any,
  options?: { silent?: boolean }
) {
  const cleanData = removeUndefinedFields(data);
  const sqlRes = await syncToCloudSqlBackend(
    "PUT",
    `/api/sql/collection/${encodeURIComponent(collectionName)}/${encodeURIComponent(docId)}`,
    { data: cleanData }
  );
  if (!options?.silent) {
    notifyCloudSqlListeners(collectionName);
  }

  if (!sqlRes) {
    throw new Error(`Failed to update record in Cloud SQL database for ${collectionName}/${docId}`);
  }
}

export async function safeDeleteDoc(collectionName: string, docId: string) {
  const sqlRes = await syncToCloudSqlBackend(
    "DELETE",
    `/api/sql/collection/${encodeURIComponent(collectionName)}/${encodeURIComponent(docId)}`
  );
  notifyCloudSqlListeners(collectionName);

  if (!sqlRes) {
    throw new Error(`Failed to delete record from Cloud SQL database for ${collectionName}/${docId}`);
  }
}

export async function safeBulkDeleteDocs(collectionName: string, docIds: string[]) {
  const sqlRes = await syncToCloudSqlBackend(
    "POST",
    `/api/sql/collection/${encodeURIComponent(collectionName)}/bulk-delete`,
    { ids: docIds }
  );
  notifyCloudSqlListeners(collectionName);

  if (!sqlRes) {
    throw new Error(`Failed to bulk delete records from Cloud SQL database for ${collectionName}`);
  }
}


