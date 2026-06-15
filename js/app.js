/**
 * app.js - 菜农记账 App 主逻辑
 */
(function() {
'use strict';

// ==================== 数据 ====================
const PRESET_VEGGIES = [];

let currentItems = [];
let editingIndex = -1; // -1 means not editing, >=0 means editing item at this index

// ==================== DOM 引用 ====================
const $ = id => document.getElementById(id);
const dom = {
  headerTitle: $('header-title'),
  pages: {
    order: $('page-order'),
    history: $('page-history'),
    stats: $('page-stats')
  },
  navItems: document.querySelectorAll('.nav-item'),
  inputCustomer: $('input-customer'),
  inputDate: $('input-date'),
  itemsList: $('items-list'),
  itemCount: $('item-count'),
  grandTotal: $('grand-total'),
  btnAddItem: $('btn-add-item'),
  btnSaveOrder: $('btn-save-order'),
  modal: $('modal-add-item'),
  modalClose: $('modal-close'),
  btnCancelAdd: $('btn-cancel-add'),
  btnConfirmAdd: $('btn-confirm-add'),
  inputVegName: $('input-veg-name'),
  presetVeggies: $('preset-veggies'),
  inputWeight: $('input-weight'),
  inputPrice: $('input-price'),
  calcSubtotal: $('calc-subtotal'),
  historyList: $('history-list'),
  historySearch: $('history-search'),
  detailModal: $('modal-order-detail'),
  detailBody: $('detail-body'),
  detailClose: $('modal-detail-close'),
  statOrderCount: $('stat-order-count'),
 statTotalAmount: $('stat-total-amount'),
 rankingsList: $('rankings-list'),
  loadSuggestion: $('load-suggestion'),
  suggestionText: $('suggestion-text'),
  btnLoadItems: $('btn-load-items'),
  btnDismissSuggestion: $('btn-dismiss-suggestion'),
  btnExport: $('btn-export-data'),
  btnImport: $('btn-import-data'),
  syncUrl: $('sync-server-url'),
  syncStatus: $('sync-status'),
  syncInfo: $('sync-info'),
  btnTestSync: $('btn-test-sync'),
  fileInput: $('file-input'),
};

// ==================== 工具函数 ====================
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

function fmtNum(n) {
  return Number(n || 0).toFixed(2);
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

async function copyToClipboard(text){try{await navigator.clipboard.writeText(text);return true;}catch(e){}try{var ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.left='0';ta.style.top='0';document.body.appendChild(ta);ta.focus();ta.select();var ok=document.execCommand('copy');document.body.removeChild(ta);if(ok)return true;}catch(e){}try{var tv=document.createElement('textarea');tv.value=text;tv.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:300px;height:200px;font-size:14px;z-index:20000;padding:8px;border:2px solid #2E7D32;border-radius:8px;background:#fff;resize:none;';tv.readOnly=true;document.body.appendChild(tv);tv.focus();tv.select();showToast('文字已显示，请手动选择复制');return false;}catch(e){}showToast('复制失败');return false;}
function showToast(msg) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

function showModal(el) {
  el.style.display = 'flex';
}

function hideModal(el) {
  el.style.display = 'none';
}

// ==================== 打开编辑模态框 ====================
function openEditModal(index) {
  const item = currentItems[index];
  if (!item) return;
  editingIndex = index;
  dom.inputVegName.value = item.name;
  dom.inputWeight.value = item.weight || '';
  dom.inputPrice.value = item.unitPrice || '';
  dom.calcSubtotal.textContent = fmtNum((item.weight || 0) * (item.unitPrice || 0));
  // Highlight matching preset
  document.querySelectorAll('.preset-chip').forEach(c => {
    c.classList.toggle('selected', c.textContent === item.name);
  });
  dom.btnConfirmAdd.textContent = '确认修改';
  showModal(dom.modal);
  setTimeout(() => dom.inputWeight.focus(), 200);
}

// ==================== 当前订单 ====================
function renderItems() {
  const list = dom.itemsList;
  if (currentItems.length === 0) {
    list.innerHTML =
      '<div class="empty-state">' +
        '<div class="empty-icon">📋</div>' +
        '<p>还没有添加蔬菜</p>' +
        '<p class="empty-hint">点击下方按钮添加</p>' +
      '</div>';
    dom.itemCount.textContent = '0 项';
    dom.grandTotal.textContent = '0.00';
    return;
  }

  let html = '';
  let grandTotal = 0;
  currentItems.forEach((item, index) => {
    const total = (item.weight || 0) * (item.unitPrice || 0);
    item.total = total;
    grandTotal += total;
    html +=
      '<div class="item-card" data-index="' + index + '">' +
        '<div class="item-name">' + escHtml(item.name) + '</div>' +
        '<div class="item-details">' +
          '<div class="item-sub">' + fmtNum(item.weight) + ' 斤 × ' + fmtNum(item.unitPrice) + ' 元/斤</div>' +
        '</div>' +
        '<div class="item-total">' + fmtNum(total) + ' <span class="item-unit">元</span></div>' +
        '<div class="item-actions">' +
          '<button class="btn-edit-item" data-index="' + index + '">✏️</button>' +
          '<button class="btn-delete-item" data-index="' + index + '">✕</button>' +
        '</div>' +
      '</div>';
  });

  list.innerHTML = html;
  dom.itemCount.textContent = currentItems.length + ' 项';
  dom.grandTotal.textContent = fmtNum(grandTotal);

  // 编辑按钮
  list.querySelectorAll('.btn-edit-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(e.currentTarget.dataset.index);
      openEditModal(idx);
    });
  });

  // 删除按钮
  list.querySelectorAll('.btn-delete-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(e.currentTarget.dataset.index);
      currentItems.splice(idx, 1);
            renderItems();
    });
  });
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ==================== 添加蔬菜模态框 ====================
function populatePresetVeggies() {
  const container = dom.presetVeggies;
  container.innerHTML = '';
  PRESET_VEGGIES.forEach(name => {
    const chip = document.createElement('button');
    chip.className = 'preset-chip';
    chip.textContent = name;
    chip.type = 'button';
    chip.addEventListener('click', () => {
      dom.inputVegName.value = name;
      document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
    });
    container.appendChild(chip);
  });
}

function resetAddForm() {
  dom.inputVegName.value = '';
  dom.inputWeight.value = '';
  dom.inputPrice.value = '';
  dom.calcSubtotal.textContent = '0.00';
  document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('selected'));
}

function openAddModal() {
  resetAddForm();
  showModal(dom.modal);
  setTimeout(() => dom.inputVegName.focus(), 200);
}

function confirmAddItem() {
  const name = dom.inputVegName.value.trim();
  const weight = parseFloat(dom.inputWeight.value) || 0;
  const price = parseFloat(dom.inputPrice.value) || 0;

  if (!name) { showToast('请输入蔬菜名称'); return; }
  if (weight <= 0) { showToast('请输入有效重量'); return; }
  if (price <= 0) { showToast('请输入有效单价'); return; }

  const item = { id: genId(), name: name, weight: weight, unitPrice: price, total: weight * price };

  if (editingIndex >= 0) {
    // Update existing
    item.id = currentItems[editingIndex].id;
    currentItems[editingIndex] = item;
    editingIndex = -1;
    dom.btnConfirmAdd.textContent = '确认添加';
    showToast('已修改: ' + name);
  } else {
    currentItems.push(item);
    showToast('已添加: ' + name);
  }
  renderItems();
  hideModal(dom.modal);
}

// ==================== 保存订单 ====================
async function saveCurrentOrder() {
  if (currentItems.length === 0) {
    showToast('请先添加蔬菜');
    return;
  }

  const customer = dom.inputCustomer.value.trim() || '酒店';
  const date = dom.inputDate.value || todayStr();
  const grandTotal = currentItems.reduce((sum, item) => sum + (item.total || 0), 0);

  const order = {
    customer: customer,
    date: date,
    items: currentItems.map(item => ({ ...item })),
    grandTotal: grandTotal,
    createdAt: Date.now()
  };

  try {
    await DB.saveOrder(order);
    showToast('订单已保存');
    currentItems = [];
    renderItems();
  } catch (err) {
    showToast('保存失败，请重试');
    console.error('Save order error:', err);
  }
}

// ==================== 页面切换 ====================
function switchPage(pageName) {
  // 隐藏所有页面
  Object.values(dom.pages).forEach(p => p.classList.remove('active'));
  // 显示目标页面
  const target = dom.pages[pageName];
  if (target) target.classList.add('active');
  // 更新导航
  dom.navItems.forEach(item => {
    item.classList.toggle('active', item.dataset.page === pageName);
  });
  // 更新标题
  const titles = { order: '当前订单', history: '历史记录', stats: '统计' };
  dom.headerTitle.textContent = titles[pageName] || '菜农记账';
  // 加载数据
  if (pageName === 'history') loadHistory();
  if (pageName === 'stats') loadStats();
}

// ==================== 历史记录 ====================
async function loadHistory(query) {
  try {
    let orders = query ? await DB.searchOrders(query) : await DB.getAllOrders();
    const list = dom.historyList;

    if (orders.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">📜</div><p>还没有历史记录</p><p class="empty-hint">保存订单后将在这里显示</p></div>';
      return;
    }

    // Group by customer
    var groups = {};
    orders.forEach(function(order) {
      var customer = order.customer || '未知客户';
      if (!groups[customer]) groups[customer] = { customer: customer, orders: [], totalAmount: 0, count: 0 };
      groups[customer].orders.push(order);
      groups[customer].totalAmount += order.grandTotal || 0;
      groups[customer].count += 1;
    });

    // Sort groups by latest order
    var groupList = Object.keys(groups).map(function(k) { return groups[k]; });
    groupList.sort(function(a, b) {
      var aLatest = Math.max.apply(null, a.orders.map(function(o) { return o.createdAt || 0; }));
      var bLatest = Math.max.apply(null, b.orders.map(function(o) { return o.createdAt || 0; }));
      return bLatest - aLatest;
    });

    var html = '';
    groupList.forEach(function(group) {
      var gid = 'g-' + group.customer.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
      html += '<div class="history-group">' +
        '<div class="history-group-header" data-group="' + escHtml(gid) + '">' +
          '<span class="group-toggle">\u25b6</span>' +
          '<span class="group-customer">' + escHtml(group.customer) + '</span>' +
          '<span class="group-stats">' + group.count + '\u6b21 ' + fmtNum(group.totalAmount) + '\u5143</span>' +
        '</div>' +
        '<div class="history-group-body" id="' + escHtml(gid) + '">';

      var monthGrps = {};
      group.orders.forEach(function(order) {
        var ym = (order.date || '').substring(0,7);
        if (!monthGrps[ym]) monthGrps[ym] = { orders: [], total: 0 };
        monthGrps[ym].orders.push(order);
        monthGrps[ym].total += order.grandTotal || 0;
      });
      Object.keys(monthGrps).sort().reverse().forEach(function(ym) {
        var mg = monthGrps[ym];
        var d = new Date(ym+'-01');
        var label = d.getFullYear()+'年'+(d.getMonth()+1)+'月';
        html += '<div class="month-group"><div class="month-header"><span class="month-label">'+label+'</span><span class="month-total">'+fmtNum(mg.total)+'元</span><button class="btn btn-sm btn-success month-share-btn" data-customer="'+escHtml(group.customer)+'" data-month="'+ym+'">复制本月</button></div>';
        mg.orders.forEach(function(order) {
          var itemCount = (order.items || []).length;
        html += '<div class="history-card" data-id="' + order.id + '">' +
          '<div class="history-card-header">' +
            '<div>' +
              '<div class="history-card-date">' + (order.date || '') + '</div>' +
              '<div class="history-card-customer">' + escHtml(order.customer || '') + '</div>' +
            '</div>' +
            '<div class="history-card-total">' + fmtNum(order.grandTotal) + ' <small>元</small></div>' +
          '</div>' +
          '<div class="history-card-body" id="detail-' + order.id + '">' +
            '<div class="history-item-row" style="font-weight:600;color:var(--text-secondary);font-size:13px;">' +
              '<span>蔬菜</span><span>明细</span><span>小计</span>' +
            '</div>';
        (order.items || []).forEach(function(item) {
          html += '<div class="history-item-row">' +
            '<span class="history-item-name">' + escHtml(item.name) + '</span>' +
            '<span class="history-item-detail">' + fmtNum(item.weight) + '斤x' + fmtNum(item.unitPrice) + '元</span>' +
            '<span class="history-item-subtotal">' + fmtNum(item.total) + '元</span>' +
          '</div>';
        });
        html += '<div class="history-item-row" style="border-top:1px solid var(--border);padding-top:8px;font-weight:700;color:var(--green-800);">' +
          '<span>合计</span><span></span><span>' + fmtNum(order.grandTotal) + '元</span>' +
        '</div>' +
        '</div>' +
        '<div class="history-card-actions">' +
        '<button class="btn btn-success share-btn" data-customer="' + encodeURIComponent(order.customer) + '" data-date="' + order.date + '">复制</button>' +
                  '<button class="btn btn-primary detail-btn" data-id="' + order.id + '">展开详情</button>' +
          '<button class="btn btn-danger delete-btn" data-id="' + order.id + '">删除</button>' +
        '</div>' +
      '</div>';
      });
      html += '</div></div>';
      });
    });

    list.innerHTML = html;

    // Group toggle
    list.querySelectorAll('.history-group-header').forEach(function(h) {
      h.addEventListener('click', function() {
        var gid = h.dataset.group;
        var body = document.getElementById(gid);
        if (body) {
          var open = body.style.display !== 'none';
          body.style.display = open ? 'none' : 'block';
          h.querySelector('.group-toggle').textContent = open ? '\u25b6' : '\u25bc';
        }
      });
    });

    // Detail toggle
    list.querySelectorAll('.detail-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = e.currentTarget.dataset.id;
        var body = document.getElementById('detail-' + id);
        var open = body.classList.toggle('open');
        e.currentTarget.textContent = open ? '收起' : '展开详情';
      });
    });

    // Delete
    list.querySelectorAll('.share-btn').forEach(function(btn){btn.addEventListener('click',async function(e){e.stopPropagation();var c=decodeURIComponent(e.currentTarget.dataset.customer);var d=e.currentTarget.dataset.date;try{var os=await DB.getCustomerDateOrders(c,d);var blob=await genImg(os);if(await copyImg(blob)){showToast('已复制');}else{copyToClipboard(fmtShare(os));showToast('已复制(文字)');}}catch(e){showToast('失败')};});});
list.querySelectorAll('.month-share-btn').forEach(function(btn){btn.addEventListener('click',async function(e){e.stopPropagation();var c=decodeURIComponent(e.currentTarget.dataset.customer);var m=e.currentTarget.dataset.month;try{var os=await DB.getCustomerMonthOrders(c,m);var blob=await genImg(os);if(await copyImg(blob)){showToast('已复制');}else{copyToClipboard(fmtMonth(os,m));showToast('已复制(文字)');}}catch(e){showToast('失败')};});});

list.querySelectorAll('.delete-btn').forEach(function(btn) {
      btn.addEventListener('click', async function(e) {
        e.stopPropagation();
        var id = parseInt(e.currentTarget.dataset.id);
        if (confirm('确定删除此订单？')) {
          await DB.deleteOrder(id);
          showToast('已删除');
          loadHistory(dom.historySearch.value);
        }
      });
    });

  } catch (err) {
    console.error('Load history error:', err);
    dom.historyList.innerHTML = '<div class="empty-state"><p>加载失败</p></div>';
  }
}

// ==================== 统计 ====================
async function loadStats() {
  try {
    const stats = await DB.getStats();
    dom.statOrderCount.textContent = stats.totalOrders;
    dom.statTotalAmount.textContent = fmtNum(stats.totalAmount);

    const list = dom.rankingsList;
    if (stats.veggieRankings.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p>暂无数据</p></div>';
      return;
    }

    let html = '';
    stats.veggieRankings.slice(0, 20).forEach((item, idx) => {
      let posClass = 'normal';
      let posText = String(idx + 1);
      if (idx === 0) { posClass = 'gold'; posText = '🥇'; }
      else if (idx === 1) { posClass = 'silver'; posText = '🥈'; }
      else if (idx === 2) { posClass = 'bronze'; posText = '🥉'; }

      html +=
        '<div class="ranking-item">' +
          '<div class="ranking-pos ' + posClass + '">' + posText + '</div>' +
          '<span class="ranking-name">' + escHtml(item.name) + '</span>' +
          '<span class="ranking-weight">' + fmtNum(item.totalWeight) + '</span>' +
          '<span class="ranking-unit">斤</span>' +
          '<span class="ranking-amount">' + fmtNum(item.totalAmount) + '元</span>' +
        '</div>';
    });

    list.innerHTML = html;
  } catch (err) {
    console.error('Load stats error:', err);
  }
}

// ==================== 初始化 ====================

// ==================== 客户自动补全与加载上次订单 ====================

// ==================== 数据导出/导入 ====================
async function exportData() {
  try {
    const orders = await DB.getAllOrders();
    if (orders.length === 0) { showToast('没有数据可导出'); return; }
    const data = { version: 1, exportedAt: new Date().toISOString(), totalOrders: orders.length, orders: orders };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '菜农记账_备份_' + todayStr() + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('导出成功：' + orders.length + '条订单');
  } catch(e) { console.error('Export error:', e); showToast('导出失败'); }
}

async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.orders || !Array.isArray(data.orders)) { showToast('文件格式不正确'); return; }
    var imported = 0;
    for (var order of data.orders) {
      delete order.id;
      await DB.saveOrder(order);
      imported++;
    }
    showToast('导入成功：' + imported + '条订单');
    if (document.getElementById('page-history').classList.contains('active')) loadHistory();
    if (document.getElementById('page-stats').classList.contains('active')) loadStats();
  } catch(e) { console.error('Import error:', e); showToast('导入失败，文件格式有误'); }
  event.target.value = '';
}

// ==================== 数据导出/导入 ====================
async function exportData() {
  try {
    const orders = await DB.getAllOrders();
    if (orders.length === 0) { showToast("没有数据可导出"); return; }
    const data = { version: 1, exportedAt: new Date().toISOString(), totalOrders: orders.length, orders: orders };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "菜农记账_备份_" + todayStr() + ".json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("导出成功：" + orders.length + "条订单");
  } catch(e) { console.error("Export error:", e); showToast("导出失败"); }
}

async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.orders || !Array.isArray(data.orders)) { showToast("文件格式不正确"); return; }
    var imported = 0;
    for (var order of data.orders) {
      delete order.id;
      await DB.saveOrder(order);
      imported++;
    }
    showToast("导入成功：" + imported + "条订单");
    if (document.getElementById("page-history").classList.contains("active")) loadHistory();
    if (document.getElementById("page-stats").classList.contains("active")) loadStats();
  } catch(e) { console.error("Import error:", e); showToast("导入失败，文件格式有误"); }
  event.target.value = "";
}
async function loadCustomerAutocomplete() {
  try {
    const names = await DB.getCustomerNames();
    const datalist = document.getElementById('customer-list');
    if (datalist) {
      datalist.innerHTML = names.map(function(n) { return '<option value="' + escHtml(n) + '">'; }).join('');
    }
  } catch(e) { console.error('loadCustomerAutocomplete error:', e); }
}

async function onCustomerChanged() {
  const name = dom.inputCustomer.value.trim();
  if (!name) { hideLoadSuggestion(); return; }
  if (currentItems.length > 0) return;
  try {
    const lastOrder = await DB.getLastOrderByCustomer(name);
    if (lastOrder && lastOrder.items && lastOrder.items.length > 0) {
      const date = lastOrder.date || '未知日期';
      const count = lastOrder.items.length;
      dom.suggestionText.textContent = '上次订单(' + date + ')有' + count + '种蔬菜，是否沿用品种和单价？';
      dom.loadSuggestion.style.display = '';
      dom.loadSuggestion.dataset.orderId = lastOrder.id;
    } else {
      hideLoadSuggestion();
    }
  } catch(e) { console.error('onCustomerChanged error:', e); }
}

function showLoadSuggestion(order) {
  dom.loadSuggestion.style.display = 'flex';
}

function hideLoadSuggestion() {
  dom.loadSuggestion.style.display = 'none';
}

async function loadPreviousItemsFromOrder(orderId) {
  try {
    hideLoadSuggestion();
    const all = await DB.getAllOrders();
    const order = all.find(function(o) { return String(o.id) === String(orderId); });
    if (!order || !order.items) return;
    currentItems = order.items.map(function(item) {
      return {
        id: genId(),
        name: item.name,
        weight: 0,
        unitPrice: item.unitPrice || 0,
        total: 0
      };
    });
    renderItems();
    showToast('已沿用上次的蔬菜品种和单价');
  } catch(e) { console.error('loadPreviousItemsFromOrder error:', e); }
}

async function loadShareView(c,d){try{document.querySelectorAll(".page").forEach(function(p){p.classList.remove("active");});document.getElementById("page-share").classList.add("active");document.getElementById("bottom-nav").style.display="none";var os=await((d+'').length>7?DB.getCustomerDateOrders(c,d):DB.getCustomerMonthOrders(c,d));var ai=[];var gt=0;os.forEach(function(o){o.items.forEach(function(i){ai.push(i);});gt+=o.grandTotal||0;});document.getElementById('share-customer').textContent=c;document.getElementById('share-date').textContent=d;if(!os||os.length===0){document.getElementById('share-items-body').innerHTML='<tr><td colspan=4 style=text-align:center;color:#999>无数据</td></tr>';document.getElementById('share-total').textContent='0.00';return;}var h='';if((d+'').length>7){ai.forEach(function(i){h+='<tr><td>'+(i.name||'')+'</td><td>'+fmtNum(i.weight)+'</td><td>'+fmtNum(i.unitPrice)+'</td><td>'+fmtNum(i.total)+'</td></tr>';});}else{var dg={};os.forEach(function(o){var dt=o.date||'';if(!dg[dt])dg[dt]={items:[],total:0};(o.items||[]).forEach(function(it){dg[dt].items.push(it);dg[dt].total+=it.total||0;});});Object.keys(dg).sort().forEach(function(dt){h+='<tr class=x-date-h><td colspan=4>'+dt+'</td></tr>';dg[dt].items.forEach(function(it){h+='<tr><td>'+(it.name||'')+'</td><td>'+fmtNum(it.weight)+'</td><td>'+fmtNum(it.unitPrice)+'</td><td>'+fmtNum(it.total)+'</td></tr>';});h+='<tr class=x-date-sub><td colspan=3>小计</td><td>'+fmtNum(dg[dt].total)+'</td></tr>';});}document.getElementById('share-items-body').innerHTML=h||'<tr><td colspan=4>-</td></tr>';document.getElementById('share-total').textContent=gt.toFixed(2);}catch(e){document.getElementById('share-date').textContent='错误:'+e.message;}}

function padR(s,n){s=String(s);while(s.length<n)s+=' ';return s;}
function padL(s,n){s=String(s);while(s.length<n)s=' '+s;return s;}
function fmtShare(os){if(!os||!os.length)return'';var o=os[0],c=o.customer||'',d=o.date||'';var ls=['\u2501\u2501 '+c+'  '+d+' \u2501\u2501',''];var gt=0;os.forEach(function(od){(od.items||[]).forEach(function(it){var t=it.total||0;ls.push(padR(it.name||'',10)+'  '+padL(fmtNum(it.weight),5)+'\u65a4  '+padL(fmtNum(it.unitPrice),5)+'\u5143  '+padL(fmtNum(t),6)+'\u5143');gt+=t;});});ls.push('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');ls.push('\u5408\u8ba1\uff1a'+fmtNum(gt)+'\u5143');ls.push('');ls.push('\u2500\u2500 \u83dc\u519c\u8bb0\u8d26 \u2500\u2500');return ls.join('\n');}
function fmtMonth(os,m){if(!os||!os.length)return'';var c=os[0].customer||'',y=m.substring(0,4),mm=parseInt(m.substring(5,7));var ls=['\u2501\u2501 '+c+'  '+y+'\u5e74'+mm+'\u6708 \u2501\u2501',''];var gt=0;os.forEach(function(od){var dt=od.date||'';ls.push('\u25c6 '+dt);var ot=0;(od.items||[]).forEach(function(it){var t=it.total||0;ls.push('  '+padR(it.name||'',8)+'  '+padL(fmtNum(it.weight),4)+'\u65a4  '+padL(fmtNum(it.unitPrice),4)+'\u5143  '+padL(fmtNum(t),5)+'\u5143');ot+=t;});ls.push('  \u2500\u2500 \u5c0f\u8ba1 '+fmtNum(ot)+'\u5143');gt+=ot;});ls.push('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');ls.push('\u5408\u8ba1\uff1a'+fmtNum(gt)+'\u5143');ls.push('');ls.push('\u2500\u2500 \u83dc\u519c\u8bb0\u8d26 \u2500\u2500');return ls.join('\n');}

function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
async function genImg(os){var dpr=window.devicePixelRatio||1;var W=440,pd=20,lh=28,nl=32,cl=160,pc=275,tr=W-pd-8;var items=[];var gt=0;os.forEach(function(o){(o.items||[]).forEach(function(it){items.push(it);gt+=it.total||0;});});var hh=78;var ch=30+items.length*lh+35;var H=hh+ch+pd*2;var ca=document.createElement('canvas');ca.width=W*dpr;ca.height=H*dpr;ca.style.width=W+'px';ca.style.height=H+'px';var x=ca.getContext('2d');x.scale(dpr,dpr);x.fillStyle='#f5f5f5';x.fillRect(0,0,W,H);x.fillStyle='#fff';roundRect(x,pd,pd,W-pd*2,H-pd*2,10);x.fill();x.fillStyle='#2E7D32';x.font='bold 18px sans-serif';x.textAlign='center';x.fillText(os[0].customer||'',W/2,pd+24);x.font='13px sans-serif';x.fillStyle='#888';x.fillText(os[0].date||'',W/2,pd+46);x.strokeStyle='#2E7D32';x.lineWidth=2;x.beginPath();x.moveTo(pd+8,pd+60);x.lineTo(W-pd-8,pd+60);x.stroke();x.fillStyle='#333';x.font='13px sans-serif';x.textAlign='left';x.fillText('品名',nl,pd+80);x.textAlign='center';x.fillText('重量',cl,pd+80);x.fillText('单价',pc,pd+80);x.textAlign='right';x.fillText('金额',tr,pd+80);var cy=pd+100;x.font='14px sans-serif';x.fillStyle='#333';items.forEach(function(it){x.textAlign='left';x.fillText(it.name||'',nl,cy);x.textAlign='center';x.fillText(fmtNum(it.weight)+'斤',cl,cy);x.fillText(fmtNum(it.unitPrice)+'元',pc,cy);x.textAlign='right';x.fillText(fmtNum(it.total)+'元',tr,cy);cy+=lh;});x.strokeStyle='#ddd';x.lineWidth=1;x.beginPath();x.moveTo(pd+8,cy);x.lineTo(W-pd-8,cy);x.stroke();x.fillStyle='#2E7D32';x.font='bold 16px sans-serif';x.textAlign='right';x.fillText('合计：'+fmtNum(gt)+'元',tr,cy+26);x.fillStyle='#bbb';x.font='12px sans-serif';x.textAlign='center';x.fillText('── 菜农记账 ──',W/2,H-pd-6);return new Promise(function(r){ca.toBlob(function(b){r(b);},'image/png');});}
async function copyImg(blob){try{await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);return true;}catch(e){return false;}}
function init(){var _p=new URLSearchParams(location.search);if(_p.get('v')&&_p.get('d')){loadShareView(_p.get('v'),_p.get('d'));return;}
  // 设置日期
  dom.inputDate.value = todayStr();
  loadCustomerAutocomplete();

  // 预设蔬菜
  populatePresetVeggies();

  // 底部导航切换
  dom.navItems.forEach(item => {
    item.addEventListener('click', () => {
      switchPage(item.dataset.page);
    });
  });

  // 添加蔬菜
  dom.btnAddItem.addEventListener('click', openAddModal);
  dom.modalClose.addEventListener('click', () => { editingIndex = -1; dom.btnConfirmAdd.textContent = '确认添加'; hideModal(dom.modal); });
  dom.btnCancelAdd.addEventListener('click', () => { editingIndex = -1; dom.btnConfirmAdd.textContent = '确认添加'; hideModal(dom.modal); });
  dom.modal.addEventListener('click', (e) => {
    if (e.target === dom.modal) hideModal(dom.modal);
  });

  // 实时计算小计
  dom.inputWeight.addEventListener('input', updateCalc);
  dom.inputPrice.addEventListener('input', updateCalc);
  function updateCalc() {
    const w = parseFloat(dom.inputWeight.value) || 0;
    const p = parseFloat(dom.inputPrice.value) || 0;
    dom.calcSubtotal.textContent = fmtNum(w * p);
  }

  // 确认添加 (回车或按钮)
  dom.btnConfirmAdd.addEventListener('click', confirmAddItem);
  dom.inputPrice.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmAddItem();
  });

  // 保存订单
  dom.btnSaveOrder.addEventListener('click', saveCurrentOrder);

  // 搜索历史
  let searchTimer;
  dom.historySearch.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadHistory(dom.historySearch.value), 300);
  });

  // 关闭详情
  dom.detailClose.addEventListener('click', () => hideModal(dom.detailModal));
  dom.detailModal.addEventListener('click', (e) => {
    if (e.target === dom.detailModal) hideModal(dom.detailModal);
  });

  // 客户名称变更时加载上次订单
  dom.inputCustomer.addEventListener('blur', onCustomerChanged);
  dom.inputCustomer.addEventListener('change', onCustomerChanged);

  // 沿用上次订单按钮
  dom.btnLoadItems.addEventListener('click', function() {
    const orderId = dom.loadSuggestion.dataset.orderId;
    if (orderId) loadPreviousItemsFromOrder(orderId);
  });
  dom.btnDismissSuggestion.addEventListener('click', hideLoadSuggestion);
  // 导出导入
  dom.btnExport.addEventListener('click', exportData);
  dom.btnImport.addEventListener('click', function() { dom.fileInput.click(); });
  dom.fileInput.addEventListener('change', importData);



  // 云端同步
  Sync.supabaseTest().then(function(ok) { if (ok) { dom.syncStatus.textContent = "已连接"; dom.syncStatus.className = "sync-badge sync-active"; dom.syncInfo.textContent = "Supabase 云端就绪"; } else { dom.syncStatus.textContent = "未连接"; dom.syncInfo.textContent = "Supabase 不可用，仅本地模式"; } });
  dom.btnTestSync.addEventListener("click", async function() {
    var url = dom.syncUrl.value.trim();
    Sync.setCloudServer(url);
    dom.syncInfo.textContent = "正在测试...";
    var ok = await Sync.testCloudConnection();
    if (ok) { dom.syncInfo.textContent = "连接成功！"; updateSyncStatus(); }
    else { dom.syncInfo.textContent = "连接失败，请检查地址"; dom.syncStatus.textContent = "未连接"; dom.syncStatus.className = "sync-badge"; }
  });
  function updateSyncStatus() {
    var url = Sync.getCloudServer();
    if (url) { dom.syncStatus.textContent = "已配置"; dom.syncStatus.className = "sync-badge sync-active"; dom.syncInfo.textContent = "服务器: " + url; }
    else { dom.syncStatus.textContent = "未连接"; dom.syncStatus.className = "sync-badge"; dom.syncInfo.textContent = "配置服务器后数据自动同步到云端"; }
  }

  // 渲染订单
  renderItems();
}

// 等 DOM 加载完成
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
