import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

const app = initializeApp({ projectId: "ai-studio-fdbfe1d5-c079-4cff-926a-51e0390f43e9" });
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, "ingredients"), where("name", "in", ["HASS AVOCADO", "RASPBERRY", "SHIRMP TEMPURA", "SHRIMP TEMPURA"]));
  const snap = await getDocs(q);
  const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
