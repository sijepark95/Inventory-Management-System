const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const listener = `
    // orderLists listener
    const olQuery = query(collection(db, "orderLists"), where("ownerId", "==", targetOwnerId));
    const unsubOrderLists = onSnapshot(olQuery, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setOrderLists(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "orderLists");
    });
`;

code = code.replace(
  /const unsubInvoices.*?\}\);\n/s, 
  match => match + listener
);

code = code.replace(
  /unsubInvoices\(\);\n/,
  match => match + "      unsubOrderLists();\n"
);

fs.writeFileSync('src/App.tsx', code);
