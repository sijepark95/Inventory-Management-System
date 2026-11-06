const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
`      await addDoc(collection(db, "orderLists"), payload);`,
`      await safeAddDoc("orderLists", payload);`
);

code = code.replace(
`      await updateDoc(doc(db, "orderLists", id), { ...updates, updatedAt: new Date().toISOString() });`,
`      await safeUpdateDoc("orderLists", id, { ...updates, updatedAt: new Date().toISOString() });`
);

code = code.replace(
`      await deleteDoc(doc(db, "orderLists", id));`,
`      await safeDeleteDoc("orderLists", id);`
);

fs.writeFileSync('src/App.tsx', code);
