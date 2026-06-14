/**
 * db.js - IndexedDB 鏁版嵁搴撴搷浣? * 瀛樺偍璁㈠崟鏁版嵁锛屾敮鎸佸鍒犳敼鏌? */
const DB_NAME = 'veggieLedger';
const DB_VERSION = 1;
const STORE_NAME = 'orders';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

async function saveOrder(order) {
  try { await supabaseSaveOrder(order); } catch(e) { console.warn("Supabase:", e.message); }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(order);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function getAllOrders() {
  try { var co = await supabaseGetOrders(); if (co.length > 0) return co; } catch(e) { console.warn("Supabase:", e.message); }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const orders = req.result || [];
      orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      resolve(orders);
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function getOrdersByDateRange(dateFrom, dateTo) {
  const all = await getAllOrders();
  return all.filter(o => o.date >= dateFrom && o.date <= dateTo);
}

async function deleteOrder(id) {
  try { await supabaseDeleteOrder(id); } catch(e) { console.warn("Supabase:", e.message); }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function getStats() {
  const orders = await getAllOrders();
  const totalOrders = orders.length;
  const totalAmount = orders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
  const veggieMap = {};
  orders.forEach(order => {
    (order.items || []).forEach(item => {
      const name = item.name;
      if (!veggieMap[name]) veggieMap[name] = { totalWeight: 0, totalAmount: 0, count: 0 };
      veggieMap[name].totalWeight += item.weight || 0;
      veggieMap[name].totalAmount += item.total || 0;
      veggieMap[name].count += 1;
    });
  });
  const veggieRankings = Object.entries(veggieMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.totalWeight - a.totalWeight);
  return { totalOrders, totalAmount, veggieRankings };
}

async function searchOrders(query) {
  const all = await getAllOrders();
  if (!query.trim()) return all;
  const q = query.trim().toLowerCase();
  return all.filter(o =>
    (o.customer && o.customer.toLowerCase().includes(q)) ||
    (o.date && o.date.includes(q))
  );
}

window.DB = { saveOrder, getAllOrders, getOrdersByDateRange, deleteOrder, getStats, searchOrders };
async function getLastOrderByCustomer(customerName) {
  const all = await getAllOrders();
  const orders = all.filter(o => o.customer === customerName);
  if (orders.length === 0) return null;
  return orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
}

async function getCustomerNames() {
  const all = await getAllOrders();
  const names = [...new Set(all.map(o => o.customer).filter(Boolean))];
  return names.sort();
}


// ==================== Supabase 浜戝悓姝?====================
const SUPABASE_URL = "https://hsbktyabuotitcsyruwy.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzYmt0eWFidW90aXRjc3lydXd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MjY0MDcsImV4cCI6MjA5NzAwMjQwN30.VWYseQu-Nq_tLQE0zF4E_TeDYVXrgF44JESrf5f4vDA";

async function supabaseFetch(method, path, body) {
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    method,
    headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", "Prefer": "return=representation" },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok) throw new Error("Supabase " + r.status);
  return r.status === 204 ? null : await r.json();
}
function orderToRow(o) { return { customer: o.customer, date: o.date, items: o.items, grand_total: o.grandTotal, created_at: o.createdAt }; }
function rowToOrder(r) { return { id: r.id, customer: r.customer, date: r.date, items: r.items, grandTotal: r.grand_total, createdAt: r.created_at }; }
async function supabaseSaveOrder(order) { var rows = await supabaseFetch("POST", "orders", orderToRow(order)); if (rows && rows.length > 0) order.id = rows[0].id; }
async function supabaseGetOrders() { var rows = await supabaseFetch("GET", "orders?select=*&order=created_at.desc"); return (rows || []).map(rowToOrder); }
async function supabaseDeleteOrder(id) { await supabaseFetch("DELETE", "orders?id=eq." + id); }
async function supabaseTest() { try { await supabaseFetch("GET", "orders?select=count&limit=1"); return true; } catch(e) { return false; } }
window.Sync = { supabaseSaveOrder, supabaseGetOrders, supabaseDeleteOrder, supabaseTest };

window.DB = { saveOrder, getAllOrders, getOrdersByDateRange, deleteOrder, getStats, searchOrders, getLastOrderByCustomer, getCustomerNames };
