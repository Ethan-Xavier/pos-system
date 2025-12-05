// --- POS Data Structure ---
const posData = { openOrders: [], closedOrders: [], irregularOrders: [] };

// --- Menu Definition ---
const MENU = {
  Food: [{name:"Burger", price:5},{name:"Pizza", price:8},{name:"Salad", price:4},{name:"Pasta", price:7}],
  Drinks: [{name:"Water", price:1},{name:"Soda", price:2},{name:"Coffee", price:3},{name:"Juice", price:3}]
};

/* --- Functions --- */

// Populate items into a select element based on section
function populateItems(section, selectId='item'){
  const sel=$(selectId); sel.innerHTML='';
  MENU[section].forEach(it=>{
    let o=document.createElement('option'); 
    o.value=it.name; 
    o.textContent=`${it.name} - ${formatPrice(it.price)}`; 
    sel.appendChild(o);
  });
}

// Get item price from MENU
function getItemPrice(section,item){ return MENU[section].find(i=>i.name===item)?.price || 0; }

// Update JSON snapshot for debugging
function updateSnapshot(){ $('snapshot').textContent = JSON.stringify(posData,null,2); }

// Place order function
function placeOrder({tableDescription,orderTag,section,item,qty}){
  const timestamp = new Date().toISOString();
  let table=posData.openOrders.find(t=>t.tableDescription===tableDescription);
  if(!table){ 
    table={tableId:uid(),tableDescription,status:'occupied',createdAt:timestamp,orders:[]}; 
    posData.openOrders.push(table);
  }
  let tag=table.orders.find(x=>x.orderTag===orderTag);
  if(!tag){ tag={orderTagId:uid(),orderTag,items:[],createdAt:timestamp}; table.orders.push(tag);}
  let existing=tag.items.find(i=>i.item===item);
  if(existing) existing.qty+=Number(qty);
  else tag.items.push({ item, qty:Number(qty), price:getItemPrice(section,item), timestampCreated:timestamp });
  renderTables(); updateSnapshot();
}

/* --- Render Function --- */
function renderTables(){
  const container=$('tables'); container.innerHTML='';

  // Sort tables: newest first
  const sortedTables = posData.openOrders.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

  sortedTables.forEach(table=>{
    const tableDiv=document.createElement('div'); 
    tableDiv.className='table-box';

    // Table title with timestamp
    const tableTitle=document.createElement('div');
    tableTitle.className='table-title';
    tableTitle.textContent=`${table.tableDescription} (${new Date(table.createdAt).toLocaleTimeString()})`;
    tableDiv.appendChild(tableTitle);

    table.orders.forEach(tag=>{
      const tagBox=document.createElement('div'); tagBox.className='order-tag-box';
      const tagHeader=document.createElement('div'); tagHeader.className='tag-header';
      tagHeader.textContent=`${tag.orderTag} (${new Date(tag.createdAt).toLocaleTimeString()})`;
      tagBox.appendChild(tagHeader);

      tag.items.forEach(item=>{
        const itemDiv=document.createElement('div'); itemDiv.className='order-box';
        itemDiv.textContent=`${item.qty} x ${item.item} - ${formatPrice(item.price)}`;
        tagBox.appendChild(itemDiv);
      });

      tableDiv.appendChild(tagBox);
    });

    container.appendChild(tableDiv);
  });
}

/* --- Notes ---
- Tables now sorted newest first by createdAt.
- Table and order tag timestamps are displayed (HH:MM:SS format).
- Future edits: any additional info can be added inside renderTables with minimal changes.
*/
