// Shortcut to select element by id
const $ = id => document.getElementById(id);

// Generate unique ID
function uid(){ return "ID-" + Math.random().toString(36).slice(2,9); }

// Format price
function formatPrice(p){ return typeof p==='string'?p:`$${p}`; }

