const posData = { openOrders: [], closedOrders: [], irregularOrders: [] };

const MENU = {
  Food: [{name:"Burger", price:5},{name:"Pizza", price:8},{name:"Salad", price:4},{name:"Pasta", price:7}],
  Drinks: [{name:"Water", price:1},{name:"Soda", price:2},{name:"Coffee", price:3},{name:"Juice", price:3}]
};

function populateItems(section){
  const sel=$('item'); sel.innerHTML='';
  MENU[section].forEach(it=>{ 
    let o=document.createElement('option'); 
    o.value=it.name; 
    o.textContent=`${it.name} - ${formatPrice(it.price)}`; 
    sel.appendChild(o); 
  });
}
populateItems($('section').value);
$('section').addEventListener('change', e=>populateItems(e.target.value));

function getItemPrice(section,item){ return MENU[section].find(i=>i.name===item)?.price || 0; }
function updateSnapshot(){ $('snapshot').textContent = JSON.stringify(posData,null,2); }

function placeOrder({tableDescription,orderTag,section,item,qty}){
  let table=posData.openOrders.find(t=>t.tableDescription===tableDescription);
  const timestamp=new Date().toISOString();
  if(!table){ table={tableId:uid(),tableDescription,status:'occupied',createdAt:timestamp,orders:[]}; posData.openOrders.push(table);}
  let tag=table.orders.find(x=>x.orderTag===orderTag);
  if(!tag){ tag={orderTagId:uid(),orderTag,items:[]}; table.orders.push(tag);}
  let existing=tag.items.find(i=>i.item===item);
  if(existing) existing.qty+=Number(qty); else tag.items.push({ item, qty:Number(qty), price:getItemPrice(section,item), timestampCreated:timestamp });
  renderTables(); updateSnapshot();
}

// PAY POPUP
let payContext=null;
const payPopup=$('payPopup'), payDetails=$('payDetails');
function openPayPopup(table,tag,fromDebt=null){
  payContext={table,tag,fromDebt};
  payDetails.innerHTML = tag.items.map(i=>`${i.item} x ${i.qty}`).join('<br>');
  payPopup.style.display='flex';
}
$('cancelPaymentBtn').onclick=()=>{payPopup.style.display='none';payContext=null;};
$('confirmPaymentBtn').onclick=()=>{
  if(!payContext) return;
  const {table,tag,fromDebt}=payContext;
  const method=$('paymentMethodSelect').value;
  tag.items.forEach(i=>{ posData.closedOrders.push({ item:i.item, qty:i.qty, price:i.price, timestampCreated:i.timestampCreated, paymentMethod:method }); });
  if(fromDebt){ posData.irregularOrders=posData.irregularOrders.filter(o=>o.orderTagId!==tag.orderTagId); }
  else{ table.orders=table.orders.filter(o=>o.orderTagId!==tag.orderTagId); if(table.orders.length===0) posData.openOrders=posData.openOrders.filter(t=>t.tableId!==table.tableId); }
  payPopup.style.display='none'; payContext=null; renderTables(); updateSnapshot();
};

// IRREGULAR ORDERS
const irregularPopup=$('irregularPopup'), irregularInputDiv=$('irregularInputDiv'), irregularDesc=$('irregularDesc');
let irregularContext=null;
function addIrregularButton(btns,table,tag){
  const irrBtn=document.createElement('button');
  irrBtn.className='btn-irregular'; irrBtn.textContent='Irregular';
  irrBtn.onclick=()=>{ irregularContext={table,tag}; irregularInputDiv.style.display='none'; irregularDesc.value=''; irregularPopup.style.display='flex'; };
  btns.appendChild(irrBtn);
}
document.querySelectorAll('#irregularOptions .option-btn').forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll('#irregularOptions .option-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    const type=b.dataset.type;
    if(type==='Debt'||type==='Other'){ irregularInputDiv.style.display='block'; }
    else{ storeIrregular(type,''); irregularPopup.style.display='none'; }
  };
});
$('irregularConfirmBtn').onclick=()=>{ const type=document.querySelector('#irregularOptions .option-btn.active')?.dataset.type || 'Debt'; storeIrregular(type, irregularDesc.value.trim()); irregularPopup.style.display='none'; };
$('irregularCancelBtn').onclick=()=>{ irregularPopup.style.display='none'; irregularContext=null; };

function storeIrregular(type,desc){
  if(!irregularContext) return;
  const {table,tag}=irregularContext;
  const total=tag.items.reduce((s,i)=>s+i.qty*i.price,0);
  posData.irregularOrders.push({ orderTagId:tag.orderTagId, tableDescription:table.tableDescription, orderTag:tag.orderTag, items:tag.items, type, description:desc, total });
  table.orders=table.orders.filter(o=>o.orderTagId!==tag.orderTagId);
  if(table.orders.length===0) posData.openOrders=posData.openOrders.filter(t=>t.tableId!==table.tableId);
  renderTables(); updateSnapshot();
}

// RENDER TABLES + DEBTS + EDITABLE TABLE/ORDER NAMES
function renderTables(){
  const container=$('tables'); container.innerHTML='';
  const debtsDiv=$('debts'); debtsDiv.innerHTML='';

  posData.openOrders.forEach(table=>{
    const box=document.createElement('div'); box.className='table-box';
    const title=document.createElement('div'); title.className='table-title'; title.textContent=table.tableDescription;
    title.onclick=()=>{ const newDesc=prompt('Edit Table Description:',table.tableDescription); if(newDesc){ table.tableDescription=newDesc; renderTables(); updateSnapshot(); }};
    box.appendChild(title);

    table.orders.forEach(tag=>{
      const tbox=document.createElement('div'); tbox.className='order-tag-box';
      const head=document.createElement('div'); head.className='tag-header';
      const span=document.createElement('span'); span.textContent=tag.orderTag;
      span.onclick=()=>{ const newTag=prompt('Edit Order Tag:',tag.orderTag); if(newTag){ tag.orderTag=newTag; renderTables(); updateSnapshot(); }};
      const btns=document.createElement('div'); btns.className='tag-buttons';
      const moveBtn=document.createElement('button'); moveBtn.className='btn-move'; moveBtn.textContent='Move';
      moveBtn.onclick=()=>{ const newDesc=prompt('Move to which Table Description?'); if(!newDesc)return; table.orders=table.orders.filter(o=>o.orderTagId!==tag.orderTagId); if(table.orders.length===0) posData.openOrders=posData.openOrders.filter(t=>t.tableId!==table.tableId); let target=posData.openOrders.find(t=>t.tableDescription===newDesc); if(!target){ target={tableId:uid(),tableDescription:newDesc,status:'occupied',createdAt:new Date().toISOString(),orders:[]}; posData.openOrders.push(target); } target.orders.push(tag); renderTables(); updateSnapshot(); };
      const cancelBtn=document.createElement('button'); cancelBtn.className='btn-cancel'; cancelBtn.textContent='Cancel'; cancelBtn.onclick=()=>{ table.orders=table.orders.filter(o=>o.orderTagId!==tag.orderTagId); if(table.orders.length===0) posData.openOrders=posData.openOrders.filter(t=>t.tableId!==table.tableId); renderTables(); updateSnapshot(); };
      const payBtn=document.createElement('button'); payBtn.className='btn-pay'; payBtn.textContent='Pay'; payBtn.onclick=()=>openPayPopup(table,tag,null);
      btns.append(moveBtn,cancelBtn,payBtn); addIrregularButton(btns,table,tag); head.append(span,btns); tbox.appendChild(head);

      tag.items.forEach(i=>{
        const d=document.createElement('div'); d.className='order-box'; d.textContent=`${i.item} x ${i.qty} - ${formatPrice(i.price)}`;
        d.onclick=()=>{ const newQty=prompt(`Adjust quantity for ${i.item} (0 to remove):`, i.qty); if(newQty===null)return; const n=Number(newQty); if(n<=0) tag.items=tag.items.filter(it=>it.item!==i.item); else i.qty=n; if(tag.items.length===0) table.orders=table.orders.filter(o=>o.orderTagId!==tag.orderTagId); if(table.orders.length===0) posData.openOrders=posData.openOrders.filter(t=>t.tableId!==table.tableId); renderTables(); updateSnapshot(); };
        tbox.appendChild(d);
      });

      const total=tag.items.reduce((s,i)=>s+i.qty*i.price,0); const tot=document.createElement('div'); tot.className='order-total'; tot.textContent=`Total: ${formatPrice(total)}`; tbox.appendChild(tot);
      box.appendChild(tbox);
    });
    container.appendChild(box);
  });

  posData.irregularOrders.filter(o=>o.type==='Debt').forEach(debt=>{
    const dbox=document.createElement('div'); dbox.className='order-tag-box';
    const desc=document.createElement('div'); desc.textContent=`${debt.description} - ${formatPrice(debt.total)}`;
    const payBtn=document.createElement('button'); payBtn.className='btn-pay'; payBtn.textContent='Paid'; payBtn.onclick=()=>openPayPopup(null,debt,true);
    dbox.append(desc,payBtn); debtsDiv.appendChild(dbox);
  });
}

$('placeOrderBtn').onclick=()=>{ const t=$('tableDesc').value.trim(); if(!t){alert('Table Description required');return;} placeOrder({ tableDescription:t, orderTag:$('orderTag').value.trim(), section:$('section').value, item:$('item').value, qty:$('qty').value }); };

updateSnapshot();
renderTables();
snapshot()
