let currentCart = [];
let selectedPaymentMethod = 'CASH';
let numpadBuffer = '1';
let bluetoothDevice = null;
let printerCharacteristic = null;

function initPOS() {
    loadProducts();
    setupPOSListeners();
    updateCartUI();
}

async function loadProducts(filterQuery = '') {
    const products = await getAllProducts();
    const grid = document.getElementById('product-grid');
    grid.innerHTML = '';

    const filtered = products.filter(p => 
        p.name.toLowerCase().includes(filterQuery.toLowerCase().trim())
    );

    if (filtered.length === 0) {
        grid.innerHTML = '<div style="color: #64748b;">No items found</div>';
        return;
    }

    filtered.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="prod-title">${product.name}</div>
            <div class="prod-details">
                <span class="prod-price">$${product.price.toFixed(2)}</span>
                <span>Stock: ${product.stock}</span>
            </div>
        `;
        card.onclick = () => addToCart(product);
        grid.appendChild(card);
    });
}

function addToCart(product) {
    if (product.stock <= 0) return alert('Out of stock!');

    const addQty = parseInt(numpadBuffer, 10) || 1;
    const existingIndex = currentCart.findIndex(i => i.id === product.id);

    if (existingIndex > -1) {
        if (currentCart[existingIndex].qty + addQty > product.stock) {
            return alert(`Cannot exceed available stock (${product.stock})`);
        }
        currentCart[existingIndex].qty += addQty;
    } else {
        if (addQty > product.stock) return alert(`Cannot exceed stock (${product.stock})`);
        currentCart.push({ id: product.id, name: product.name, price: product.price, qty: addQty });
    }

    resetNumpad();
    updateCartUI();
}

function updateCartUI() {
    const cartContainer = document.getElementById('cart-items');
    const totalElement = document.getElementById('cart-total');
    cartContainer.innerHTML = '';

    let grandTotal = 0;
    currentCart.forEach((item, index) => {
        const lineTotal = item.price * item.qty;
        grandTotal += lineTotal;

        const row = document.createElement('div');
        row.className = 'cart-item-row';
        row.innerHTML = `
            <span>${item.name}</span>
            <div class="cart-qty-ctrl">
                <button onclick="adjustQty(${index}, -1)">-</button>
                <span>${item.qty}</span>
                <button onclick="adjustQty(${index}, 1)">+</button>
            </div>
            <span>$${item.price.toFixed(2)}</span>
            <span>$${lineTotal.toFixed(2)}</span>
        `;
        cartContainer.appendChild(row);
    });

    totalElement.innerText = `$${grandTotal.toFixed(2)}`;
    document.getElementById('receipt-date').innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

window.adjustQty = function(index, delta) {
    currentCart[index].qty += delta;
    if (currentCart[index].qty <= 0) currentCart.splice(index, 1);
    updateCartUI();
};

function setupPOSListeners() {
    document.getElementById('product-search').oninput = (e) => loadProducts(e.target.value);

    document.querySelectorAll('.num-btn[data-val]').forEach(btn => {
        btn.onclick = () => {
            const val = btn.getAttribute('data-val');
            if (numpadBuffer === '1' || numpadBuffer === '0') {
                numpadBuffer = val;
            } else {
                numpadBuffer += val;
            }
            updateNumpadDisplay();
        };
    });

    document.getElementById('num-clear').onclick = resetNumpad;
    document.getElementById('num-back').onclick = () => {
        numpadBuffer = numpadBuffer.length > 1 ? numpadBuffer.slice(0, -1) : '1';
        updateNumpadDisplay();
    };

    document.querySelectorAll('.btn-pay').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.btn-pay').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedPaymentMethod = btn.getAttribute('data-method');
        };
    });

    const connectBtn = document.getElementById('btn-connect-printer');
    if (connectBtn) {
        connectBtn.onclick = connectBluetoothPrinter;
    }

    document.getElementById('btn-complete-sale').onclick = handleCompleteSale;
}

function updateNumpadDisplay() {
    document.getElementById('numpad-input').innerText = numpadBuffer;
}

function resetNumpad() {
    numpadBuffer = '1';
    updateNumpadDisplay();
}

async function connectBluetoothPrinter() {
    try {
        if (!navigator.bluetooth) {
            alert('Web Bluetooth is not supported on this browser. Use Chrome or Edge.');
            return;
        }

        bluetoothDevice = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: ['00001101-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455']
        });

        const server = await bluetoothDevice.gatt.connect();
        const services = await server.getPrimaryServices();
        const characteristics = await services[0].getCharacteristics();
        printerCharacteristic = characteristics[0];

        const printBtn = document.getElementById('btn-connect-printer');
        if (printBtn) {
            printBtn.innerText = `Connected: ${bluetoothDevice.name || 'Printer'}`;
            printBtn.style.borderColor = '#047857';
            printBtn.style.color = '#047857';
        }

        alert('Bluetooth printer connected!');
    } catch (error) {
        // Silently ignore if you cancel or close the Bluetooth window
        if (error.name === 'NotFoundError' || error.message.includes('User cancelled')) {
            console.log('User cancelled Bluetooth pairing window.');
            return;
        }
        
        console.error('Bluetooth error:', error);
        alert(`Bluetooth Error: ${error.message}`);
    }
}

async function printThermalReceipt(sale) {
    if (!printerCharacteristic) return;

    try {
        const encoder = new TextEncoder();
        const ESC = '\x1B', GS = '\x1D';
        const INIT = ESC + '@', CENTER = ESC + 'a' + '\x01', LEFT = ESC + 'a' + '\x00';
        const BOLD_ON = ESC + 'E' + '\x01', BOLD_OFF = ESC + 'E' + '\x00';
        const CUT = '\n\n\n' + GS + 'V' + '\x41' + '\x03';

        let r = INIT + CENTER + BOLD_ON + "WINSTON TECH POS\n" + BOLD_OFF;
        r += `Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n--------------------------------\n` + LEFT;

        sale.items.forEach(i => {
            r += `${i.name}\n  ${i.qty} x $${i.price.toFixed(2)} = $${(i.price * i.qty).toFixed(2)}\n`;
        });

        r += "--------------------------------\n" + CENTER + BOLD_ON + `TOTAL: $${sale.total.toFixed(2)}\n` + BOLD_OFF;
        r += `Payment: ${sale.paymentMethod}\n\nThank you!\n` + CUT;

        const data = encoder.encode(r);
        const chunkSize = 512;
        for (let i = 0; i < data.length; i += chunkSize) {
            await printerCharacteristic.writeValue(data.slice(i, i + chunkSize));
        }
    } catch (err) {
        console.error('Print failed:', err);
    }
}

async function handleCompleteSale() {
    if (currentCart.length === 0) return alert('Cart is empty!');

    const total = currentCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const products = await getAllProducts();

    for (const item of currentCart) {
        const prod = products.find(p => p.id === item.id);
        if (prod) {
            prod.stock -= item.qty;
            await saveProduct(prod);
        }
    }

    const sale = {
        items: [...currentCart],
        total: total,
        paymentMethod: selectedPaymentMethod,
        timestamp: new Date().toISOString()
    };

    await recordSale(sale);
    await printThermalReceipt(sale);

    currentCart = [];
    updateCartUI();
    loadProducts();
    alert('Sale completed successfully!');
}