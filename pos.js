// --- POS Data Structure ---
const posData = { openOrders: [], closedOrders: [], irregularOrders: [] };

// --- Waiter Auth ---
const WAITERS = ["Nina", "Ethan", "Shakina"];
const WAITER_PASSWORD = "1234";
let currentWaiter = null;

// --- Login Logic ---
$('loginBtn').onclick = () => {
  const selected = $('waiterSelect').value;
  const pass = $('waiterPassword').value;

  if (pass !== WAITER_PASSWORD) {
    alert('Wrong password');
    return;
  }

  currentWaiter = selected;
  $('loginPopup').style.display = 'none';
};

// --- Menu ---
const MENU = {
  Food: [{name:"Burger",price:5},{name:"Pizza",price:8},{name:"Salad",price:4},{name:"Pasta",price:7}],
  Drinks: [{name:"Water",price:1},{name:"Soda",price:2},{name:"Coffee",price:3},{name:"Juice",price:3}]
};

// --- Populate Items ---
function populateItems(section, selectId='item'){
  const sel=$(selectId); sel.innerHTML='';
  MENU[section].forEach(it=>{
    let o=document.createElement('option');
    o.value=it.name;
    o.textContent=`${it.name} - ${formatPrice(it.price)}`;
    sel.appendChild(o);
  });
}
populateItems($('section').value);
$('section').addEventListener('change', e=>populateItems(e.target.value));

// --- Helpers ---
function getItemPrice(section,item){ return MENU[section].find(i=>i.name===item)?.price || 0; }
function updateSnapshot(){ $('snapshot').textContent = JSON.stringify(posData,null,2); }

// --- Place Order ---
function placeOrder({tableDescription,orderTag,section,item,qty}){
  const timestamp=new Date().toISOString();

  let table=posData.openOrders.find(t=>t.tableDescription===tableDescription);
  if(!table){
    table={
      tableId:uid(),
      tableDescription,
      waiter: currentWaiter, // NOTE: track waiter who opened table
      createdAt:timestamp,
      orders:[]
    };
    posData.openOrders.push(table);
  }

  let tag=table.orders.find(x=>x.orderTag===orderTag);
  if(!tag){ tag={orderTagId:uid(),orderTag,items:[]}; table.orders.push(tag);}

  let existing=tag.items.find(i=>i.item===item);
  if(existing) existing.qty+=Number(qty);
  else tag.items.push({ item, qty:Number(qty), price:getItemPrice(section,item), timestampCreated:timestamp });

  renderTables(); updateSnapshot();
}

// --- Render ---
function renderTables(){
  const container=$('tables'); container.innerHTML='';
  const debtsDiv=$('debts'); debtsDiv.innerHTML='';

  posData.openOrders.forEach(table=>{
    const box=document.createElement('div'); box.className='table-box';

    const title=document.createElement('div'); title.className='table-title';
    title.innerHTML = `
      ${table.tableDescription}
      <span class="waiter-name">[${table.waiter}]</span>
    `;

    // Edit table description
    title.onclick = e => {
      if (e.target.classList.contains('waiter-name')) {
        const newWaiter = prompt('Change waiter to:', table.waiter);
        if (WAITERS.includes(newWaiter)) table.waiter = newWaiter;
      } else {
        const newDesc = prompt('Edit Table Description:', table.tableDescription);
        if (newDesc) table.tableDescription = newDesc;
      }
      renderTables(); updateSnapshot();
    };

    box.appendChild(title);

    table.orders.forEach(tag=>{
      const tbox=document.createElement('div'); tbox.className='order-tag-box';
      tbox.innerHTML = `<strong>${tag.orderTag}</strong>`;
      box.appendChild(tbox);
    });

    container.appendChild(box);
  });

  updateSnapshot();
}

// --- Place Order Button ---
$('placeOrderBtn').onclick=()=>{
  const t=$('tableDesc').value.trim();
  if(!t){alert('Table Description required');return;}

  if(!currentWaiter){
    alert('Please login first');
    return;
  }

  placeOrder({
    tableDescription:t,
    orderTag:$('orderTag').value.trim(),
    section:$('section').value,
    item:$('item').value,
    qty:$('qty').value
  });
};

// --- Init ---
updateSnapshot();
renderTables();
