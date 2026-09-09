function initOwner() {
    const authBtn = document.getElementById('auth-toggle-btn');
    const pinModal = document.getElementById('pin-modal');
    const pinInput = document.getElementById('owner-pin-input');

    // FIX: Click Owner Login opens PIN Popup
    if (authBtn) {
        authBtn.onclick = () => {
            pinInput.value = '';
            pinModal.classList.remove('hidden');
            pinInput.focus();
        };
    }

    document.getElementById('btn-cancel-pin').onclick = () => pinModal.classList.add('hidden');
    document.getElementById('btn-submit-pin').onclick = verifyAndUnlockDashboard;

    pinInput.onkeyup = (e) => {
        if (e.key === 'Enter') verifyAndUnlockDashboard();
    };

    document.getElementById('btn-lock-till').onclick = () => {
        document.getElementById('owner-modal').classList.add('hidden');
    };

    setupDashboardTabs();

    document.getElementById('add-product-form').onsubmit = handleAddProduct;
    document.getElementById('btn-save-settings').onclick = saveSettings;
    document.getElementById('btn-update-pin').onclick = handlePinUpdate;
    document.getElementById('btn-wipe-data').onclick = wipeAllData;
    document.getElementById('btn-gen-report').onclick = generateDailySalesReport;

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('sales-summary-title').innerText = `End-of-day summary — ${today}`;
}

function verifyAndUnlockDashboard() {
    const inputPin = document.getElementById('owner-pin-input').value;
    const activePin = localStorage.getItem('owner_pin') || '1234';

    if (inputPin === activePin) {
        document.getElementById('pin-modal').classList.add('hidden');
        document.getElementById('owner-modal').classList.remove('hidden');
        refreshInventoryTab();
    } else {
        alert('Invalid PIN!');
    }
}

function setupDashboardTabs() {
    const tabs = ['inventory', 'sales', 'settings'];
    tabs.forEach(tab => {
        document.getElementById(`tab-${tab}`).onclick = () => {
            tabs.forEach(t => {
                document.getElementById(`tab-${t}`).classList.remove('active');
                document.getElementById(`panel-${t}`).classList.add('hidden');
            });
            document.getElementById(`tab-${tab}`).classList.add('active');
            document.getElementById(`panel-${tab}`).classList.remove('hidden');

            if (tab === 'inventory') refreshInventoryTab();
        };
    });
}

async function handleAddProduct(e) {
    e.preventDefault();
    const prod = {
        name: document.getElementById('prod-name').value,
        cost: parseFloat(document.getElementById('prod-cost').value),
        price: parseFloat(document.getElementById('prod-price').value),
        stock: parseInt(document.getElementById('prod-stock').value)
    };

    await saveProduct(prod);
    document.getElementById('add-product-form').reset();
    refreshInventoryTab();
    if (typeof loadProducts === 'function') loadProducts();
}

async function refreshInventoryTab() {
    const products = await getAllProducts();
    let totalUnits = 0, totalCostVal = 0, lowStockCount = 0, outOfStockCount = 0;
    const threshold = parseInt(localStorage.getItem('low_stock_threshold') || '5');

    products.forEach(p => {
        totalUnits += p.stock;
        totalCostVal += (p.cost * p.stock);
        if (p.stock === 0) outOfStockCount++;
        else if (p.stock <= threshold) lowStockCount++;
    });

    document.getElementById('stat-products').innerText = products.length;
    document.getElementById('stat-units').innerText = totalUnits;
    document.getElementById('stat-cost-val').innerText = `$${totalCostVal.toFixed(2)}`;
    document.getElementById('stat-low-stock').innerText = `${lowStockCount} / ${outOfStockCount}`;

    renderProductRows(products);
}

function renderProductRows(products) {
    const container = document.getElementById('owner-inventory-list');
    container.innerHTML = '';

    products.forEach(p => {
        const row = document.createElement('div');
        row.className = 'product-row';
        row.innerHTML = `
            <span><strong>${p.name}</strong></span>
            <input type="number" step="0.01" value="${p.cost}" id="cost-${p.id}">
            <input type="number" step="0.01" value="${p.price}" id="price-${p.id}">
            <input type="number" value="${p.stock}" id="stock-${p.id}">
            <div>
                <button type="button" class="btn btn-outline-dark" onclick="saveRow(${p.id})">Save</button>
                <button type="button" class="btn btn-danger-outline" onclick="deleteRow(${p.id})">Del</button>
            </div>
        `;
        container.appendChild(row);
    });
}

window.saveRow = async function(id) {
    const products = await getAllProducts();
    const prod = products.find(p => p.id === id);
    if (prod) {
        prod.cost = parseFloat(document.getElementById(`cost-${id}`).value);
        prod.price = parseFloat(document.getElementById(`price-${id}`).value);
        prod.stock = parseInt(document.getElementById(`stock-${id}`).value);
        await saveProduct(prod);
        refreshInventoryTab();
        if (typeof loadProducts === 'function') loadProducts();
    }
};

window.deleteRow = async function(id) {
    await deleteProduct(id);
    refreshInventoryTab();
    if (typeof loadProducts === 'function') loadProducts();
};

async function generateDailySalesReport() {
    const sales = await getAllSales();
    const todayStr = new Date().toISOString().split('T')[0];
    const todaysSales = sales.filter(s => s.timestamp && s.timestamp.startsWith(todayStr));

    let totalRevenue = 0, totalItemsSold = 0, breakdown = {};

    todaysSales.forEach(s => {
        totalRevenue += s.total;
        s.items.forEach(item => {
            totalItemsSold += item.qty;
            if (!breakdown[item.name]) breakdown[item.name] = { qty: 0, revenue: 0 };
            breakdown[item.name].qty += item.qty;
            breakdown[item.name].revenue += (item.price * item.qty);
        });
    });

    let reportText = `📊 *DAILY SALES REPORT — ${todayStr}*\n\n`;
    reportText += `Total Sales: $${totalRevenue.toFixed(2)}\n`;
    reportText += `Total Orders: ${todaysSales.length}\n`;
    reportText += `Items Sold: ${totalItemsSold}\n\n`;
    reportText += `*Item Breakdown:*\n`;

    if (Object.keys(breakdown).length === 0) {
        reportText += `No sales recorded today yet.\n`;
    } else {
        for (const [name, data] of Object.entries(breakdown)) {
            reportText += `• ${name}: ${data.qty}x ($${data.revenue.toFixed(2)})\n`;
        }
    }

    const container = document.getElementById('report-output-container');
    container.classList.remove('hidden');

    const ownerPhone = localStorage.getItem('owner_phone') || '';
    const whatsappUrl = `https://wa.me/${ownerPhone}?text=${encodeURIComponent(reportText)}`;

    container.innerHTML = `
        <div class="report-summary-box">${reportText}</div>
        ${ownerPhone 
            ? `<a href="${whatsappUrl}" target="_blank" class="whatsapp-btn">Send Report via WhatsApp</a>`
            : `<p class="help-text text-danger">Save your WhatsApp number under Settings tab to enable 1-click dispatch.</p>`
        }
    `;
}

function saveSettings() {
    localStorage.setItem('owner_phone', document.getElementById('owner-phone').value.trim());
    localStorage.setItem('low_stock_threshold', document.getElementById('low-stock-input').value);
    alert('Settings saved successfully!');
}

function handlePinUpdate() {
    const current = document.getElementById('pin-current').value;
    const next = document.getElementById('pin-new').value;
    const confirm = document.getElementById('pin-confirm').value;

    if (next !== confirm) return alert("New PINs do not match!");
    localStorage.setItem('owner_pin', next);
    alert("PIN updated successfully!");
}

function wipeAllData() {
    if (confirm("Wipe all local inventory and sales data?")) {
        indexedDB.deleteDatabase('WinstonTechDB');
        localStorage.clear();
        location.reload();
    }
}