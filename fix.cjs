const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
`    // orderLists listener
    const olQuery = query(collection(db, "orderLists"), where("ownerId", "==", targetOwnerId));
    const unsubOrderLists = onSnapshot(olQuery, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setOrderLists(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "orderLists");
    });`, ''
);

code = code.replace(
`    // timecards listener`,
`    // orderLists listener
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

    // timecards listener`
);

fs.writeFileSync('src/App.tsx', code);
