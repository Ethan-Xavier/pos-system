// main app
import { loadMenu } from "./menu-loader.js";

const $ = id => document.getElementById(id);

let MENU = { Drinks: [], Food: [] };

// POS local data
const posData = { openOrders: [], closedOrders: [], irregularOrders: [] };

// UI refs
const sectionSel = $('section');
const itemSel = $('item');
const qtyInput = $('qty');
const snapshotEl = $('snapshot');
const pricePicker = $('pricePicker');
const priceOptions = $('priceOptions'); // note: will be set below after DOM load

// popups
const payPopup = $('payPopup');
const payDetails = $('payDetails');
const pricePickerOverlay = $('pricePicker');
const priceOptionsDiv = $('priceOptions');
const priceCancelBtn = $('priceCancelBtn');

const irregularPopup = $('irregularPopup');
const irregularInputDiv = $('irregularInputDiv');
const irregularDesc = $('irregularDesc');

// contexts
let pendingPriceResolve = null;
let payContext = null;
let irregularContext = null;

// init
window.addEventListener('load', async () => {
  MENU = await loadMenu();
  // populate section select
  sectionSel.innerHTML = '';
  const sections = Object.keys(MENU);
  sections.forEach(s => {
    const o = document.createElement('option'); o.value = s; o.textContent = s; sectionSel.appendChild(o);
  });
  sectionSel.onchange = () => populateItems(sectionSel.value);
  populateItems(sectionSel.value);
  attachUI();
  renderTables();
  updateSnapshot();
});

// populate items dropdown
function populateItems(section) {
  itemSel.innerHTML = '';
  (MENU[section] || []).forEach(it => {
    const o = document.createElement('option');
    o.value = it.name;
    const priceLabel = (typeof it.price === 'number') ? ` - ${it.price}` : ` - ${it.price}`;
    o.textContent = `${it.name}${priceLabel ? (' - ' + it.price) : ''}`;
    itemSel.appendChild(o);
  });
}

// helper: pick price when an item has multiple prices (string with '/')
function pickPriceFromString(priceStr) {
  return new Promise((resolve) => {
    // create options
    const opts = priceStr.split('/').map(s => s.replace(/[^\d]/g, ''));
    priceOptionsDiv = document.getElementById('priceOptions');
    priceOptionsDiv.innerHTML = '';
    opts.forEach(opt => {
      const b = document.createElement('button');
      b.className = 'option-btn';
      b.textContent = opt;
      b.onclick = () => {
        pricePickerOverlay.style.display = 'none';
        resolve(Number(opt));
      };
      priceOptionsDiv.appendChild(b);
    });
    // cancel
    document.getElementById('priceCancelBtn').onclick = () => {
      pricePickerOverlay.style.display = 'none';
      resolve(null);
    };
    pricePickerOverlay.style.display = 'flex';
  });
}

// place order - handles multi-price items by prompting the price picker
async function placeOrder({tableDescription, orderTag, section, item, qty}) {
  const menuItem = (MENU[section] || []).find(x => x.name === item);
  if(!menuItem) return;
  let priceToUse = menuItem.price;
  if (typeof priceToUse === 'string') {
    // multi-price - ask user to pick
    const chosen = await pickPriceFromString(priceToUse);
    if (chosen === null) return; // user cancelled
    priceToUse = chosen;
  }
  const timestamp = new Date().toISOString();
  let table = posData.openOrders.find(t => t.tableDescription === tableDescription);
  if(!table) {
    table = { tableId: uid(), tableDescription, status:'occupied', createdAt: timestamp, orders: [] };
    posData.openOrders.push(table);
  }
  let tag = (table.orders || []).find(t => t.orderTag === orderTag);
  if(!tag) {
    tag = { orderTagId: uid(), orderTag, items: [] };
    table.orders.push(tag);
  }
  let existing = tag.items.find(i => i.item === item && i.price === priceToUse);
  if(existing) existing.qty += Number(qty);
  else tag.items.push({ item, qty: Number(qty), price: priceToUse, timestampCreated: timestamp });
  renderTables(); updateSnapshot();
}

// tiny uid
function uid(){ return "ID-" + Math.random().toString(36).slice(2,9); }

// UI wiring for buttons
function attachUI() {
  $('placeOrderBtn').onclick = async () => {
    const t = $('tableDesc').value.trim();
    if(!t){ alert('Table Description required'); return; }
    await placeOrder({
      tableDescription: t,
      orderTag: $('orderTag').value.trim() || 'Single Order',
      section: $('section').value,
      item: $('item').value,
      qty: $('qty').value
    });
    $('qty').value = 1;
    $('orderTag').value = 'Single Order';
  };

  // price picker elements exist in DOM; already used in pickPriceFromString
  // irregular popup wiring
  document.querySelectorAll('#irregularOptions .option-btn').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('#irregularOptions .option-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      if (b.dataset.type === 'Debt' || b.dataset.type === 'Other') {
        $('irregularInputDiv').style.display = 'block';
      } else {
        $('irregularInputDiv').style.display = 'none';
      }
    };
  });

  $('irregularConfirmBtn').onclick = () => {
    const active = document.querySelector('#irregularOptions .option-btn.active');
    const type = active ? active.dataset.type : 'Debt';
    const desc = $('irregularDesc').value.trim();
    storeIrregular(type, desc);
    $('irregularPopup').style.display = 'none';
  };
  $('irregularCancelBtn').onclick = () => { $('irregularPopup').style.display = 'none'; };

  // payment popup handlers
  $('cancelPaymentBtn').onclick = () => { payPopup.style.display = 'none'; payContext = null; };
  $('confirmPaymentBtn').onclick = () => {
    if (!payContext) return;
    const { table, tag, fromDebt } = payContext;
    const method = $('paymentMethodSelect').value;
    if (fromDebt) {
      // debt is an irregular order stored in irregularOrders (tag is the irregular object)
      // store as closedOrders as aggregated (items grouped)
      tag.items.forEach(i => posData.closedOrders.push({
        item: i.item, qty: i.qty, price: i.price, timestampCreated: i.timestampCreated, paymentMethod: method
      }));
      posData.irregularOrders = posData.irregularOrders.filter(x => x.orderTagId !== tag.orderTagId);
    } else {
      // normal tag: store each item individually
      tag.items.forEach(i => posData.closedOrders.push({
        item: i.item, qty: i.qty, price: i.price, timestampCreated: i.timestampCreated, paymentMethod: method
      }));
      // remove tag from table
      table.orders = table.orders.filter(o => o.orderTagId !== tag.orderTagId);
      if (table.orders.length === 0) posData.openOrders = posData.openOrders.filter(t => t.tableId !== table.tableId);
    }
    payPopup.style.display = 'none';
    payContext = null;
    renderTables(); updateSnapshot();
  };
}

// store irregular order (debt/cooking/other)
function storeIrregular(type, desc) {
  if (!irregularContext) return;
  const { table, tag } = irregularContext;
  const total = tag.items.reduce((s,i) => s + i.qty * i.price, 0);
  posData.irregularOrders.push({
    orderTagId: tag.orderTagId,
    tableDescription: table.tableDescription,
    orderTag: tag.orderTag,
    items: tag.items,
    type,
    description: desc,
    total
  });
  // remove from openOrders
  table.orders = table.orders.filter(o => o.orderTagId !== tag.orderTagId);
  if (table.orders.length === 0) posData.openOrders = posData.openOrders.filter(t => t.tableId !== table.tableId);
  irregularContext = null;
  renderTables(); updateSnapshot();
}

// render tables & debts
function renderTables() {
  const container = $('tables');
  container.innerHTML = '';
  // tables
  posData.openOrders.forEach(table => {
    const box = document.createElement('div'); box.className = 'table-box';
    const title = document.createElement('div'); title.className = 'table-title'; title.textContent = table.tableDescription;
    title.onclick = () => {
      const newDesc = prompt('Edit Table Description', table.tableDescription);
      if (!newDesc) return;
      table.tableDescription = newDesc;
      renderTables(); updateSnapshot();
    };
    box.appendChild(title);

    (table.orders || []).forEach(tag => {
      const tbox = document.createElement('div'); tbox.className = 'order-tag-box';
      const head = document.createElement('div'); head.className = 'tag-header';

      const span = document.createElement('span'); span.textContent = tag.orderTag;
      span.onclick = () => {
        const newTag = prompt('Edit Order Tag', tag.orderTag);
        if (!newTag) return;
        tag.orderTag = newTag;
        renderTables(); updateSnapshot();
      };

      const btns = document.createElement('div'); btns.className = 'tag-buttons';
      // move
      const moveBtn = document.createElement('button'); moveBtn.className = 'btn-move'; moveBtn.textContent = 'Move';
      moveBtn.onclick = () => {
        const newDesc = prompt('Move to which Table Description?');
        if (!newDesc) return;
        // remove from source
        table.orders = table.orders.filter(o => o.orderTagId !== tag.orderTagId);
        if (table.orders.length === 0) posData.openOrders = posData.openOrders.filter(t => t.tableId !== table.tableId);
        // append to target (create if missing)
        let target = posData.openOrders.find(t => t.tableDescription === newDesc);
        if (!target) {
          target = { tableId: uid(), tableDescription: newDesc, status: 'occupied', createdAt: new Date().toISOString(), orders: [] };
          posData.openOrders.push(target);
        }
        target.orders.push(tag);
        renderTables(); updateSnapshot();
      };

      // cancel
      const cancelBtn = document.createElement('button'); cancelBtn.className = 'btn-cancel'; cancelBtn.textContent = 'Cancel';
      cancelBtn.onclick = () => {
        table.orders = table.orders.filter(o => o.orderTagId !== tag.orderTagId);
        if (table.orders.length === 0) posData.openOrders = posData.openOrders.filter(t => t.tableId !== table.tableId);
        renderTables(); updateSnapshot();
      };

      // pay
      const payBtn = document.createElement('button'); payBtn.className = 'btn-pay'; payBtn.textContent = 'Pay';
      payBtn.onclick = () => { payContext = { table, tag, fromDebt: false }; payDetails.innerHTML = tag.items.map(i => `${i.item} x ${i.qty} - ${i.price}`).join('<br>'); payPopup.style.display = 'flex'; };

      // irregular
      const irrBtn = document.createElement('button'); irrBtn.className = 'btn-irregular'; irrBtn.textContent = 'Irregular';
      irrBtn.onclick = () => { irregularContext = { table, tag }; $('irregularDesc').value = ''; document.querySelectorAll('#irregularOptions .option-btn').forEach(x => x.classList.remove('active')); document.querySelector('#irregularOptions .option-btn').classList.add('active'); $('irregularInputDiv').style.display = 'none'; $('irregularPopup').style.display = 'flex'; };

      btns.append(moveBtn, cancelBtn, payBtn, irrBtn);
      head.append(span, btns);
      tbox.appendChild(head);

      // items (click to edit qty/remove)
      tag.items.forEach(i => {
        const d = document.createElement('div'); d.className = 'order-box';
        d.textContent = `${i.item} x ${i.qty} - ${i.price}`;
        d.onclick = () => {
          const newQty = prompt(`Adjust quantity for ${i.item} (0 to remove):`, i.qty);
          if (newQty === null) return;
          const n = Number(newQty);
          if (isNaN(n)) return;
          if (n <= 0) tag.items = tag.items.filter(it => it.item !== i.item || it.price !== i.price);
          else i.qty = n;
          if (tag.items.length === 0) table.orders = table.orders.filter(o => o.orderTagId !== tag.orderTagId);
          if (table.orders.length === 0) posData.openOrders = posData.openOrders.filter(t => t.tableId !== table.tableId);
          renderTables(); updateSnapshot();
        };
        tbox.appendChild(d);
      });

      const total = (tag.items || []).reduce((s, i) => s + (i.qty * i.price), 0);
      const tot = document.createElement('div'); tot.className = 'order-total'; tot.textContent = `Total: ${total}`;
      tbox.appendChild(tot);

      box.appendChild(tbox);
    });

    container.appendChild(box);
  });

  // render debts
  const debtsDiv = $('debts');
  debtsDiv.innerHTML = '';
  posData.irregularOrders.filter(o => o.type === 'Debt').forEach(debt => {
    const dbox = document.createElement('div'); dbox.className = 'order-tag-box';
    const desc = document.createElement('div'); desc.textContent = `${debt.description || debt.orderTag} - ${debt.total}`;
    const payBtn = document.createElement('button'); payBtn.className = 'btn-pay'; payBtn.textContent = 'Paid';
    payBtn.onclick = () => {
      // set pay context to fromDebt true and tag = debt
      payContext = { table: null, tag: debt, fromDebt: true };
      payDetails.innerHTML = debt.items.map(i => `${i.item} x ${i.qty} - ${i.price}`).join('<br>');
      payPopup.style.display = 'flex';
    };
    dbox.append(desc, payBtn);
    debtsDiv.appendChild(dbox);
  });
}

// snapshot
function updateSnapshot() {
  snapshotEl.textContent = JSON.stringify(posData, null, 2);
}

// helper to open irregular popup externally
window.openIrregularPopup = (table, tag) => {
  irregularContext = { table, tag };
  $('irregularDesc').value = '';
  $('irregularPopup').style.display = 'flex';
};


