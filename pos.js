const posData={openOrders:[]}

const MENU={
  Food:[{name:"Burger",price:5},{name:"Pizza",price:8}],
  Drinks:[{name:"Water",price:1},{name:"Soda",price:2}]
}

function populateItems(sec){
  $('item').innerHTML=""
  MENU[sec].forEach(i=>{
    const o=document.createElement("option")
    o.value=i.name
    o.textContent=i.name
    $('item').appendChild(o)
  })
}
populateItems($('section').value)
$('section').onchange=e=>populateItems(e.target.value)

let addContext=null

// OPEN ADD ITEM POPUP
function openAddPopup(table,tag){
  addContext={table,tag}
  $('addItemPopup').style.display="flex"

  const sec=$('addSection')
  sec.innerHTML=""
  Object.keys(MENU).forEach(s=>{
    const o=document.createElement("option")
    o.value=s
    o.textContent=s
    sec.appendChild(o)
  })
  sec.onchange=()=>populateAdd(sec.value)
  populateAdd(sec.value)
}

function populateAdd(sec){
  const sel=$('addItem')
  sel.innerHTML=""
  MENU[sec].forEach(i=>{
    const o=document.createElement("option")
    o.value=i.name
    o.textContent=i.name
    sel.appendChild(o)
  })
}

$('addCancel').onclick=()=> $('addItemPopup').style.display="none"

$('addConfirm').onclick=()=>{
  const {table,tag}=addContext
  placeOrder({
    tableDescription:table.tableDescription,
    orderTag:tag.orderTag,
    section:$('addSection').value,
    item:$('addItem').value,
    qty:$('addQty').value
  })
  $('addItemPopup').style.display="none"
}

// CORE ORDER
function placeOrder({tableDescription,orderTag,section,item,qty}){
  let table=posData.openOrders.find(t=>t.tableDescription===tableDescription)
  if(!table){ table={id:uid(),tableDescription,orders:[]}; posData.openOrders.push(table)}

  let tag=table.orders.find(o=>o.orderTag===orderTag)
  if(!tag){ tag={orderTag,items:[]}; table.orders.push(tag)}

  let e=tag.items.find(i=>i.item===item)
  if(e)e.qty+=Number(qty)
  else tag.items.push({item,qty:Number(qty),price:MENU[section].find(x=>x.name===item).price})

  render(); snapshot()
}

function render(){
  $('tables').innerHTML=""
  posData.openOrders.forEach(table=>{
    const box=document.createElement("div")
    box.className="table-box"
    box.textContent=table.tableDescription

    table.orders.forEach(tag=>{
      const ob=document.createElement("div")
      ob.className="order-tag-box"

      const head=document.createElement("div")
      head.className="tag-header"

      const title=document.createElement("span")
      title.textContent=tag.orderTag

      const btns=document.createElement("div")
      btns.className="tag-buttons"

      const add=document.createElement("button")
      add.textContent="+"
      add.className="btn-add"
      add.onclick=()=>openAddPopup(table,tag)

      btns.appendChild(add)
      head.append(title,btns)
      ob.appendChild(head)

      tag.items.forEach(i=>{
        const d=document.createElement("div")
        d.className="order-box"
        d.textContent=`${i.item} x${i.qty}`
        ob.appendChild(d)
      })

      box.appendChild(ob)
    })

    $('tables').appendChild(box)
  })
}

function snapshot(){
  $('snapshot').textContent=JSON.stringify(posData,null,2)
}

$('placeOrderBtn').onclick=()=>{
  placeOrder({
    tableDescription:$('tableDesc').value,
    orderTag:$('orderTag').value,
    section:$('section').value,
    item:$('item').value,
    qty:$('qty').value
  })
}

render()
snapshot()
