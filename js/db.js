let db;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('WinstonTechDB', 1);

        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains('products')) {
                database.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
            }
            if (!database.objectStoreNames.contains('sales')) {
                database.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };

        request.onerror = (e) => reject(e);
    });
}

function getAllProducts() {
    return new Promise((resolve) => {
        const tx = db.transaction(['products'], 'readonly');
        const store = tx.objectStore('products');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
    });
}

function saveProduct(product) {
    return new Promise((resolve) => {
        const tx = db.transaction(['products'], 'readwrite');
        const store = tx.objectStore('products');
        store.put(product);
        tx.oncomplete = () => resolve();
    });
}

function deleteProduct(id) {
    return new Promise((resolve) => {
        const tx = db.transaction(['products'], 'readwrite');
        const store = tx.objectStore('products');
        store.delete(id);
        tx.oncomplete = () => resolve();
    });
}

function getAllSales() {
    return new Promise((resolve) => {
        const tx = db.transaction(['sales'], 'readonly');
        const store = tx.objectStore('sales');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
    });
}

function recordSale(sale) {
    return new Promise((resolve) => {
        const tx = db.transaction(['sales'], 'readwrite');
        const store = tx.objectStore('sales');
        store.add(sale);
        tx.oncomplete = () => resolve();
    });
}