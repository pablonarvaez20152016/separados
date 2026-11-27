'use strict';
const $ = id => document.getElementById(id), storageKey = 'separados.v1', enc = new TextEncoder(), dec = new TextDecoder();
let data = [], contacts = [], notifications = [], activity = [], seller = '', key = null, salt = null, recoveryKey = null, paymentId = null, extensionId = null;
function b64(value) {
  let binary = '';
  for (let offset = 0; offset < value.length; offset += 16384) {
    binary += String.fromCharCode(...value.subarray(offset, offset + 16384));
  }
  return btoa(binary);
}
const bytes = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));
async function derive(password, s) { const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']); return crypto.subtle.deriveKey({name:'PBKDF2', salt:s, iterations:600000, hash:'SHA-256'}, base, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']); }
async function seal(value, k, s, rk=null) { const iv=crypto.getRandomValues(new Uint8Array(12)); const recoveryBytes=rk?new Uint8Array(await crypto.subtle.exportKey('raw',rk)):null;const inner={...value,...(recoveryBytes?{recoverySecret:b64(recoveryBytes)}:{})};const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},k,enc.encode(JSON.stringify(inner)));const result={version:1,salt:b64(s),iv:b64(iv),ciphertext:b64(new Uint8Array(ciphertext))};if(rk){const recoveryIv=crypto.getRandomValues(new Uint8Array(12));const recoveryCiphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv:recoveryIv},rk,enc.encode(JSON.stringify(value)));result.recovery={iv:b64(recoveryIv),ciphertext:b64(new Uint8Array(recoveryCiphertext))};}return JSON.stringify(result); }
async function openVault(raw, password) { const v=JSON.parse(raw); if(v.version!==1) throw Error('Formato desconocido'); const s=bytes(v.salt), k=await derive(password,s); const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(v.iv)},k,bytes(v.ciphertext)); const result=JSON.parse(dec.decode(plaintext)); if(Array.isArray(result)) return {result,contacts:[],notifications:[],activity:[],k,s,recoveryKey:null}; if(!result||!Array.isArray(result.records)||!Array.isArray(result.contacts)) throw Error('Datos inválidos'); return {result:result.records,contacts:result.contacts,notifications:Array.isArray(result.notifications)?result.notifications:[],activity:Array.isArray(result.activity)?result.activity:[],k,s,recoveryKey:result.recoverySecret?await crypto.subtle.importKey('raw',bytes(result.recoverySecret),'AES-GCM',true,['encrypt','decrypt']):null}; }
let saveQueue = Promise.resolve();
function activityItem(action, detail = '', actor = seller) {
  return {action, detail, seller: actor, date: new Date().toISOString()};
}

function save(action, detail) {
  const event = action ? activityItem(action, detail) : null;
  const snapshot = {records: data, contacts, notifications};
  const credentials = [key, salt, recoveryKey];
  const operation = saveQueue.then(async () => {
    const nextActivity = event ? [...activity, event] : activity;
    const raw = await seal({...snapshot, activity: nextActivity}, ...credentials);
    localStorage.setItem(storageKey, raw);
    activity = nextActivity;
  });
  saveQueue = operation.catch(() => {});
  return operation;
}
const money = n => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n);
const balance = r => Math.max(0,r.total-r.payments.reduce((a,p)=>a+p.amount,0));
const escapeHTML = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dayNumber = d => Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000);
function dateString(d) { return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-'); }
function addMonth(date) { const [y,m,d]=date.split('-').map(Number); const last=new Date(y,m+1,0).getDate(); return dateString(new Date(y,m,Math.min(d,last))); }
function addDays(date, days) { const [y,m,d]=date.split('-').map(Number); return dateString(new Date(y,m-1,d+days)); }
function remaining(date) { const [y,m,d]=date.split('-').map(Number); return Math.floor(Date.UTC(y,m-1,d)/86400000)-dayNumber(new Date()); }
function status(r){ if(balance(r)===0)return ['Pagado','']; const n=remaining(r.due); return n<0?[`Vencido hace ${-n} día(s)`,'late']:n===0?['Vence hoy','late']:n<=Number($('days').value)?[`Vence en ${n} día(s)`,'warn']:[`Vence en ${n} días`,'']; }
function formatPesos(digits) {
  return digits.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function pesoDigits(value) {
  const match = value.trim().match(/^(?:COP\s*)?\$?\s*(\d+|\d{1,3}(?:\.\d{3})+)(?:,00)?(?:\s*COP)?$/i);
  return match ? match[1].replaceAll('.', '') : null;
}

function readPesos(id) {
  const digits = pesoDigits($(id).value);
  return digits === null ? NaN : Number(digits);
}

document.querySelectorAll('[data-money]').forEach(input => {
  input.addEventListener('input', event => {
    const value = input.value;
    let digits = pesoDigits(value);
    if (digits === null) {
      if (/^insertFrom/.test(event.inputType || '') || !/^[\d.]*$/.test(value)) return;
      digits = value.replaceAll('.', '');
    }
    const digitsAfterCaret = value.slice(input.selectionStart).replace(/\D/g, '').length;
    input.value = formatPesos(digits);
    let caret = input.value.length;
    let remaining = digitsAfterCaret;
    while (caret > 0 && remaining > 0) {
      if (/\d/.test(input.value[--caret])) remaining--;
    }
    input.setSelectionRange(caret, caret);
  });
});

const notificationDate = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Bogota',
});

function renderActivity() {
  $('activityList').innerHTML = [...activity].reverse().map(entry =>
    '<tr><td>' + escapeHTML(notificationDate.format(new Date(entry.date))) +
    '</td><td>' + escapeHTML(entry.seller) + '</td><td>' + escapeHTML(entry.action) +
    '</td><td>' + escapeHTML(entry.detail || '—') + '</td></tr>'
  ).join('') || '<tr><td class="empty" colspan="4">Aún no hay actividad registrada.</td></tr>';
}

function reservationLabel(record) {
  return record.client + ' · ' + record.description;
}

function renderNotifications() {
  $('notificationsList').innerHTML = [...notifications].reverse().map(entry =>
    '<tr><th scope="row">' + escapeHTML(entry.client) + '</th><td>' + escapeHTML(entry.phone) +
    '</td><td>' + escapeHTML(entry.description) + '</td><td>' + escapeHTML(entry.due) +
    '</td><td>' + escapeHTML(entry.channel) + '</td><td>' + escapeHTML(entry.seller || '—') + '</td><td>' +
    escapeHTML(notificationDate.format(new Date(entry.sentAt))) + '</td></tr>'
  ).join('') || '<tr><td class="empty" colspan="7">Aún no has registrado envíos.</td></tr>';
}

let pendingReminder = null;
const confirmReminder = $('confirmReminder');

function openReminder(record) {
  const phone = phoneKey(record.phone);
  if (!/^\+?\d{7,15}$/.test(phone)) {
    alert('Revisa el teléfono e incluye el indicativo del país.');
    return;
  }
  const rawPhone = phone.replace(/^\+/, '');
  const international = phone.startsWith('+') || /^57\d{10}$/.test(phone);
  const expired = remaining(record.due) < 0;
  const dueText = expired ? 'venció el' : 'vence el';
  const message = 'Hola ' + record.client + ', somos Koquetas Boutique. Tu separado de ' +
    record.description + ' ' + dueText + ' ' + record.due + '. Tu saldo pendiente es ' +
    money(balance(record)) + '. Si necesitas ayuda, puedes responder a este mensaje. Gracias.';
  const body = encodeURIComponent(message);

  pendingReminder = {record, expired};
  $('reminderTitle').textContent = expired ? 'Notificar separado vencido' : 'Enviar recordatorio';
  $('reminderTo').textContent = record.client + ' · ' + phone;
  $('reminderMessage').textContent = message;
  $('reminderSms').href = 'sms:' + phone + '?body=' + body;
  $('reminderWhatsApp').hidden = !international;
  if (international) $('reminderWhatsApp').href = 'https://wa.me/' + rawPhone + '?text=' + body;
  else $('reminderWhatsApp').removeAttribute('href');
  $('reminderStatus').textContent = international ? '' : 'Para WhatsApp, edita el teléfono e incluye el indicativo.';
  confirmReminder.hidden = true;
  confirmReminder.disabled = true;
  $('reminderDialog').showModal();
}

$('reminderSms').addEventListener('click', () => {
  if (!pendingReminder?.expired) return;
  $('reminderStatus').textContent = 'Cuando envíes el SMS, registra el envío aquí.';
  confirmReminder.hidden = false;
  confirmReminder.disabled = false;
});

const whatsappConfirmation = $('whatsappConfirmation');
const confirmWhatsApp = $('confirmWhatsApp');
$('reminderWhatsApp').addEventListener('click', () => {
  if (!pendingReminder) return;
  $('whatsappConfirmationClient').textContent = pendingReminder.record.client;
  $('whatsappConfirmationError').textContent = '';
  whatsappConfirmation.showModal();
});

async function saveReminder(channel) {
  const {record} = pendingReminder;
  const entry = {
    client: record.client, phone: record.phone, description: record.description,
    due: record.due, channel, seller, sentAt: new Date().toISOString(),
  };
  notifications.push(entry);
  try {
    await save('Notificación confirmada', reservationLabel(record) + ' · ' + channel);
  } catch (error) {
    notifications = notifications.filter(item => item !== entry);
    throw error;
  }
  renderNotifications();
  $('reminderStatus').textContent = 'Envío registrado por ' + channel + '.';
}

confirmWhatsApp.onclick = async () => {
  if (!pendingReminder || confirmWhatsApp.disabled) return;
  confirmWhatsApp.disabled = true;
  try {
    await saveReminder('WhatsApp');
    whatsappConfirmation.close();
  } catch {
    $('whatsappConfirmationError').textContent = 'No se pudo guardar el envío. Inténtalo de nuevo.';
  } finally {
    confirmWhatsApp.disabled = false;
  }
};

confirmReminder.onclick = async () => {
  if (!pendingReminder?.expired || confirmReminder.disabled) return;
  confirmReminder.disabled = true;
  try {
    await saveReminder('SMS');
    confirmReminder.hidden = true;
  } catch {
    $('reminderStatus').textContent = 'No se pudo guardar el envío. Inténtalo de nuevo.';
    confirmReminder.disabled = false;
  }
};

function render() {
  const active = data.filter(record => balance(record) > 0);
  renderInsights(active);
  const alertDays = Number($('days').value);
  $('activeCount').textContent = active.length;
  $('dueCount').textContent = active.filter(record => remaining(record.due) <= alertDays).length;
  $('balance').textContent = money(active.reduce((sum, record) => sum + balance(record), 0));
  const query = $('search').value.trim().toLocaleLowerCase();
  const rows = data.filter(record => (
    [record.client, record.phone, record.description, record.brand].join(' ').toLocaleLowerCase().includes(query)
  )).sort((a, b) => (balance(a) === 0) - (balance(b) === 0) || a.due.localeCompare(b.due));

  $('list').innerHTML = rows.map(record => {
    const [label, cls] = status(record);
    const pending = balance(record);
    const id = escapeHTML(record.id);
    const action = (name, text) => '<button type="button" class="secondary" data-action="' +
      name + '" data-id="' + id + '">' + text + '</button>';
    const pay = pending > 0 ? '<button type="button" data-action="pay" data-id="' + id + '">Abonar</button>' : '';
    const details = '<button type="button" class="secondary" data-action="details" data-id="' + id +
      '" aria-label="Ver abonos" title="Ver abonos"><svg aria-hidden="true" width="18" height="18" ' +
      'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button>';
    const activeActions = pending > 0 ? [
      action('reminder', remaining(record.due) < 0 ? 'Notificar vencimiento' : 'Enviar recordatorio'),
      action('extend', 'Extender por excepción'),
    ].join('') : '';
    return '<tr><th scope="row">' + escapeHTML(record.client) + '<small>' +
      escapeHTML(record.phone) + '</small></th><td><div class="quick-actions">' + pay + details + '</div>' +
      '<details class="row-actions"><summary>Más</summary><div class="buttons">' +
      activeActions + action('social', 'Invitar a redes') + action('edit', 'Editar') +
      action('delete', 'Eliminar') + '</div></details></td><td>' + escapeHTML(record.description) +
      (record.brand ? '<small>' + escapeHTML(record.brand) + '</small>' : '') +
      '</td><td class="date">' + escapeHTML(record.createdDate || '—') + '</td><td class="date">' +
      escapeHTML(record.due) + '<small class="tag ' + cls + '">' + label +
      '</small></td><td class="amount">' + money(record.total) + '</td><td class="amount">' +
      money(record.total - pending) + '</td><td class="amount pending-amount">' + money(pending) +
      '</td></tr>';
  }).join('') || '<tr><td class="empty" colspan="8">No hay separados que coincidan.</td></tr>';
}

function renderInsights(active) {
  const upcoming = active.filter(record => remaining(record.due) >= 0)
    .sort((a, b) => a.due.localeCompare(b.due)).slice(0, 5);
  $('upcomingList').innerHTML = upcoming.map(record =>
    '<li><span><strong>' + escapeHTML(record.client) + '</strong><small>' +
    escapeHTML(record.description) + '</small></span><time datetime="' +
    escapeHTML(record.due) + '">' + escapeHTML(record.due) + '</time></li>'
  ).join('') || '<li class="insight-empty">Sin vencimientos próximos</li>';

  const references = new Map();
  for (const record of data) {
    const counted = new Set();
    for (const item of recordGarments(record)) {
      const name = item.description?.trim().replace(/\s+/g, ' ');
      if (!name) continue;
      const normalized = name.toLocaleLowerCase();
      if (counted.has(normalized)) continue;
      counted.add(normalized);
      if (!references.has(normalized)) references.set(normalized, {name, count: 0});
      references.get(normalized).count++;
    }
  }
  const ranking = [...references.values()].sort((a, b) =>
    b.count - a.count || a.name.localeCompare(b.name, 'es')
  ).slice(0, 5);
  $('popularList').innerHTML = ranking.map(({name, count}) =>
    '<li><strong>' + escapeHTML(name) + '</strong><span class="tag">' + count + '</span></li>'
  ).join('') || '<li class="insight-empty">Sin referencias registradas</li>';
}

const viewButtons = document.querySelectorAll('[data-view]');
const menuToggle = $('menuToggle');
menuToggle.onclick = () => {
  const collapsed = $('app').classList.toggle('sidebar-collapsed');
  menuToggle.setAttribute('aria-expanded', String(!collapsed));
  menuToggle.setAttribute('aria-label', collapsed ? 'Expandir menú' : 'Comprimir menú');
};

const settingsToggle = $('settingsToggle');
function setSettingsOpen(open) {
  $('settingsItems').hidden = !open;
  settingsToggle.setAttribute('aria-expanded', String(open));
}
settingsToggle.onclick = () => setSettingsOpen($('settingsItems').hidden);
$('sidebarCreate').onclick = () => {
  showView('reservationsView');
  $('newBtn').click();
};

function showView(id) {
  $('newBtn').hidden = id !== 'reservationsView';
  if (id === 'notificationsView') renderNotifications();
  if (id === 'activityView') renderActivity();
  window.scrollTo(0, 0);
  document.querySelectorAll('.app-view').forEach(view => { view.hidden = view.id !== id; });
  viewButtons.forEach(button => {
    if (button.dataset.view === id) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}
viewButtons.forEach(button => { button.onclick = () => showView(button.dataset.view); });
$('sidebarImport').onclick = () => {
  showView('contactsView');
  $('contactsImport').click();
};
document.querySelectorAll('[data-file]').forEach(button => {
  button.onclick = () => $(button.dataset.file).click();
});
$('sidebarExport').onclick = () => {
  showView('contactsView');
  $('contactsExport').click();
};

function phoneKey(value) {
  const phone = String(value ?? '').trim().replace(/[\s().-]/g, '');
  if (/^(?:(?:\+|00)?57)?3\d{9}$/.test(phone)) return '+57' + phone.slice(-10);
  if (!/^\+?\d{7,15}$/.test(phone)) return '';
  return phone.startsWith('00') ? '+' + phone.slice(2) : phone;
}

let filledClient = '';
function resetClientMatch() {
  filledClient = '';
  $('clientMatch').textContent = '';

}
$('client').oninput = resetClientMatch;
$('phone').oninput = () => {
  if ($('editId').value) return;
  const client = $('client');
  if (filledClient && client.value === filledClient) client.value = '';
  resetClientMatch();
  if (client.value.trim()) return;

  const phone = phoneKey($('phone').value);
  if (!phone) return;
  const names = new Map();
  for (const {name, phone: savedPhone} of contacts) {
    if (phoneKey(savedPhone) === phone && name?.trim()) names.set(name.trim().toLocaleLowerCase(), name.trim());
  }
  for (const record of data) {
    if (phoneKey(record.phone) !== phone || !record.client?.trim()) continue;
    const name = record.client.trim();
    if (!names.has(name.toLocaleLowerCase())) names.set(name.toLocaleLowerCase(), name);
  }
  if (names.size === 1) {
    client.value = filledClient = names.values().next().value;
    $('clientMatch').textContent = 'Nombre completado con el teléfono guardado.';
  } else if (names.size > 1) {
    $('clientMatch').textContent = 'Este teléfono coincide con varios nombres. Escribe el nombre de la clienta.';
  }
};

function downloadFile(content, type, filename) {
  const url = URL.createObjectURL(new Blob([content], {type}));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value, isPhone = false) {
  const text = String(value);
  const formula = /^[\s\uFEFF]*[=+@-]|^[\t\r\n]/.test(text);
  const safeValue = formula && !(isPhone && phoneKey(text)) ? "'" + text : text;
  return '"' + safeValue.replace(/"/g, '""') + '"';
}
$('contactsExport').onclick = async () => {
  if (!contacts.length) {
    $('contactsStatus').textContent = 'No hay contactos guardados para exportar.';
    return;
  }
  const rows = contacts.map(contact => [csvCell(contact.name), csvCell(contact.phone, true)].join(','));
  try {
    await save('Contactos exportados', String(rows.length));
  } catch {
    $('contactsStatus').textContent = 'No se pudo registrar la exportación.';
    return;
  }
  downloadFile('\uFEFF' + ['Name,Phone 1 - Value', ...rows].join('\r\n'), 'text/csv;charset=utf-8', 'separados-contactos.csv');
};

function locked(){setSettingsOpen(false);showView('reservationsView');document.querySelectorAll('[data-password]').forEach(button=>{const input=$(button.dataset.password);input.type='password';button.setAttribute('aria-pressed','false');button.setAttribute('aria-label',input.id==='passwordConfirm'?'Mostrar contraseña de confirmación':'Mostrar contraseña');});key=null;salt=null;recoveryKey=null;data=[];contacts=[];notifications=[];activity=[];seller='';$('sellerName').value='';$('activityList').textContent='';$('app').hidden=true;$('auth').hidden=false;$('lock').hidden=true;$('password').value='';$('passwordConfirm').value=''; const exists=!!localStorage.getItem(storageKey);$('authTitle').textContent=exists?'Abrir tu información':'Crea tu contraseña';$('authHelp').textContent=exists?'Ingresa la contraseña de este dispositivo.':'Usa al menos 12 caracteres. Si la olvidas, no podrás recuperar los datos.';$('confirmLabel').hidden=exists;$('passwordConfirm').required=!exists;}
$('authForm').onsubmit=async e=>{e.preventDefault();$('authError').textContent='';try{const name=$('sellerName').value.trim();if(!name)throw Error('Escribe el nombre del vendedor o vendedora.');if(!window.isSecureContext||!crypto.subtle)throw Error('Abre la aplicación en HTTPS o localhost.');const pass=$('password').value, raw=localStorage.getItem(storageKey);if(raw){const v=await openVault(raw,pass);data=v.result;contacts=v.contacts;notifications=v.notifications;activity=v.activity;key=v.k;salt=v.s;recoveryKey=v.recoveryKey;}else{if(pass!==$('passwordConfirm').value)throw Error('Las contraseñas no coinciden.');salt=crypto.getRandomValues(new Uint8Array(16));key=await derive(pass,salt);data=[];contacts=[];notifications=[];activity=[];await save();}seller=name;$('password').value='';$('passwordConfirm').value='';$('auth').hidden=true;$('app').hidden=false;$('lock').hidden=false;render();renderContacts();}catch(err){$('authError').textContent=err.name==='OperationError'?'Contraseña incorrecta o copia dañada.':err.message;}};
$('lock').onclick=async()=>{const raw=localStorage.getItem(storageKey);if(!raw){locked();return;}try{if(window.showSaveFilePicker){const handle=await window.showSaveFilePicker({suggestedName:'separados-copia-cifrada.json',types:[{description:'Copia cifrada',accept:{'application/json':['.json']}}]});const writer=await handle.createWritable();await writer.write(raw);await writer.close();}else{const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='separados-copia-cifrada.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);alert('Se inició la descarga. Comprueba que la copia se guardó; el navegador puede añadir un número al nombre.');}locked();}catch(err){if(err.name!=='AbortError')alert('No se pudo guardar la copia. La aplicación permanece abierta: '+err.message);}}; $('search').oninput=render; $('days').onchange=render;
let garments = [];
let editingGarment = null;
const defaultGarmentColor = 'Sin definir';
const garmentFields = ['description', 'brand', 'garmentColor', 'quantity', 'unitPrice'];

function recordGarments(record) {
  return record.garments || [{
    description: record.description, brand: record.brand || '', quantity: 1, unitPrice: record.total,
  }];
}

function garmentDraft() {
  const value = $('quantity').value.trim();
  return {
    description: $('description').value.trim(),
    brand: $('brand').value.trim(),
    color: $('garmentColor').value.trim() || defaultGarmentColor,
    quantity: /^\d+$/.test(value) ? Number(value) : NaN,
    unitPrice: readPesos('unitPrice'),
  };
}

const garmentValue = item => item.quantity * item.unitPrice;
const garmentTotal = () => garments.reduce((sum, item) => sum + garmentValue(item), 0);

function refreshGarmentSubtotal() {
  const item = garmentDraft();
  const subtotal = $('garmentSubtotal');
  subtotal.hidden = !(item.quantity > 1 && item.unitPrice > 0 && Number.isSafeInteger(garmentValue(item)));
  subtotal.textContent = subtotal.hidden ? '' : 'Subtotal de esta prenda: ' + money(garmentValue(item));
  $('garmentError').textContent = '';
}

function loadGarmentDraft(item = null) {
  editingGarment = item;
  $('description').value = item?.description || '';
  $('brand').value = item?.brand || '';
  $('garmentColor').value = item?.color || defaultGarmentColor;
  $('quantity').value = item?.quantity ?? 1;
  $('unitPrice').value = item ? formatPesos(String(item.unitPrice)) : '';
  const add = $('addGarment');
  const label = item ? 'Actualizar prenda' : 'Agregar prenda';
  add.textContent = item ? '✓' : '+';
  add.title = label;
  add.setAttribute('aria-label', label);
  refreshGarmentSubtotal();
}

function renderGarments() {
  $('garmentList').innerHTML = garments.map((item, index) =>
    '<tr><th scope="row">' + escapeHTML(item.description) + '</th><td>' +
    escapeHTML(item.brand || '—') + '</td><td>' + escapeHTML(item.color || defaultGarmentColor) +
    '</td><td class="amount">' + item.quantity +
    '</td><td class="amount">' + money(item.unitPrice) + '</td><td class="amount">' +
    money(garmentValue(item)) + '</td><td><div class="garment-actions">' +
    '<button type="button" class="secondary" data-edit-garment="' + index + '">Editar</button>' +
    '<button type="button" class="secondary" data-remove-garment="' + index + '">Quitar</button>' +
    '</div></td></tr>'
  ).join('') || '<tr><td colspan="7" class="empty">Agrega una prenda para comenzar.</td></tr>';
  $('total').value = money(garmentTotal());
}

function addGarment() {
  const item = garmentDraft();
  const subtotal = garmentValue(item);
  const previous = editingGarment ? garmentValue(editingGarment) : 0;
  if (!item.description || item.quantity < 1 || item.unitPrice < 1 ||
      !Number.isSafeInteger(item.quantity) || !Number.isSafeInteger(item.unitPrice) ||
      !Number.isSafeInteger(subtotal) || !Number.isSafeInteger(garmentTotal() - previous + subtotal)) {
    $('garmentError').textContent = 'Ingresa la prenda, una cantidad entera y un valor unitario mayor que cero.';
    return false;
  }
  if (editingGarment) garments = garments.map(current => current === editingGarment ? item : current);
  else garments.push(item);
  loadGarmentDraft();
  renderGarments();
  return true;
}

for (const id of garmentFields) $(id).addEventListener('input', refreshGarmentSubtotal);
$('addGarment').onclick = () => {
  if (addGarment()) $('description').focus();
};
$('garmentList').onclick = event => {
  const edit = event.target.closest('[data-edit-garment]');
  const remove = event.target.closest('[data-remove-garment]');
  if (edit) {
    loadGarmentDraft(garments[Number(edit.dataset.editGarment)]);
    $('description').focus();
  } else if (remove) {
    const [item] = garments.splice(Number(remove.dataset.removeGarment), 1);
    if (editingGarment === item) loadGarmentDraft();
    renderGarments();
    $('description').focus();
  }
};

function clearInitialError() {
  $('initialError').textContent = '';
  $('initial').removeAttribute('aria-invalid');
}
$('initial').addEventListener('input', clearInitialError);

function openEditor(record = null) {
  $('editForm').reset();
  resetClientMatch();
  clearInitialError();
  $('editId').value = record?.id || '';
  $('client').value = record?.client || '';
  $('phone').value = record?.phone || '';
  const dateLocked = Boolean(record?.extensions?.length);
  $('startDate').value = record ? record.createdDate || '' : dateString(new Date());
  $('startDate').disabled = dateLocked;
  $('startDate').required = !dateLocked && (!record || Boolean(record.createdDate));
  $('startDateHelp').textContent = dateLocked ? 'La fecha de inicio no se puede cambiar porque este separado tiene una excepción de plazo registrada.' : '';
  $('due').value = record?.due || '';
  if ($('startDate').value) updateDueFromStart();
  $('initial').disabled = Boolean(record);
  $('editTitle').textContent = record ? 'Editar separado' : 'Nuevo separado';
  $('editError').textContent = '';
  garments = record ? [...recordGarments(record)] : [];
  loadGarmentDraft();
  renderGarments();
  $('editor').showModal();
}
$('newBtn').onclick = () => openEditor();
function updateDueFromStart(){if(!$('startDate').disabled)$('due').value=$('startDate').value?addMonth($('startDate').value):'';}
$('startDate').addEventListener('input',updateDueFromStart);
$('startDate').addEventListener('change',updateDueFromStart);
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
$('editForm').onsubmit = async event => {
  event.preventDefault();
  const error = $('editError');
  error.textContent = '';
  clearInitialError();
  const draft = garmentDraft();
  const hasDraft = editingGarment || draft.description || draft.brand || draft.color !== defaultGarmentColor ||
    $('unitPrice').value.trim() || $('quantity').value.trim() !== '1';
  if (hasDraft && !addGarment()) return;
  if (!garments.length) {
    $('garmentError').textContent = 'Agrega al menos una prenda.';
    $('description').focus();
    return;
  }

  const old = data.find(record => record.id === $('editId').value);
  const total = garmentTotal();
  const initial = $('initial').value.trim() === '' ? 0 : readPesos('initial');
  const paid = old ? old.payments.reduce((sum, payment) => sum + payment.amount, 0) : initial;
  if (!old && (!Number.isSafeInteger(initial) || initial < 0 || initial > total)) {
    $('initialError').textContent = 'Ingresa $0 o un valor que no supere el total del separado.';
    $('initial').setAttribute('aria-invalid', 'true');
    $('initial').focus();
    return;
  }
  if (!Number.isSafeInteger(total) || total < 1 || paid > total) {
    error.textContent = 'El total debe ser mayor que cero y cubrir los abonos.';
    return;
  }

  const startDate = $('startDate').value;
  const startDateLocked = $('startDate').disabled;
  const row = {
    id: old?.id || crypto.randomUUID(),
    client: $('client').value.trim(),
    phone: $('phone').value.trim(),
    description: [...new Set(garments.map(item => item.description))].join(', '),
    brand: [...new Set(garments.map(item => item.brand).filter(Boolean))].join(', '),
    garments: [...garments],
    createdBy: old ? old.createdBy : seller,
    updatedBy: seller,
    due: old && (startDateLocked || !startDate) ? old.due : addMonth(startDate),
    createdDate: startDateLocked ? old.createdDate : startDate,
    extensions: old?.extensions || [],
    total,
    payments: old ? old.payments : paid ? [{amount: paid, note: 'Abono inicial', seller, date: new Date().toISOString()}] : [],
  };
  if (!row.client || !row.phone) {
    error.textContent = 'Completa el nombre y el teléfono.';
    return;
  }

  const previous = data;
  const previousContacts = contacts;
  if (!old) {
    const phone = phoneKey(row.phone) || row.phone;
    const known = contacts.some(contact => (phoneKey(contact.phone) || contact.phone) === phone);
    if (!known) contacts = [...contacts, {name: row.client, phone: row.phone, isClient: true, createdBy: seller}];
  }
  data = old ? data.map(record => record === old ? row : record) : [...data, row];
  const submit = event.currentTarget.querySelector('button[type="submit"], .actions button:not([type])');
  submit.disabled = true;
  try {
    await save(old ? 'Separado editado' : 'Separado creado', reservationLabel(row));
  } catch {
    data = previous;
    contacts = previousContacts;
    error.textContent = 'No se pudo guardar el separado. Inténtalo de nuevo.';
    return;
  } finally {
    submit.disabled = false;
  }
  $('editor').close();
  render();
  if (contacts !== previousContacts) renderContacts();
};
$('list').onclick=async e=>{const b=e.target.closest('button[data-action]');if(!b)return;const r=data.find(x=>x.id===b.dataset.id);if(!r)return;switch(b.dataset.action){case 'pay':paymentId=r.id;$('paymentForm').reset();$('paymentInfo').textContent=`${r.client} · Saldo: ${money(balance(r))}`;$('paymentError').textContent='';$('paymentDialog').showModal();break;case 'extend':extensionId=r.id;$('extensionDate').value=addDays(r.due,15);$('extensionDate').min=addDays(r.due,1);$('extensionReason').value='';$('extensionInfo').textContent=`${r.client} · Vencimiento actual: ${r.due}. Se sugieren 15 días más.`;$('extensionError').textContent='';$('extensionDialog').showModal();break;case 'details':$('detailContent').innerHTML=`<h2>Abonos de ${escapeHTML(r.client)}</h2><p>${escapeHTML(r.description)} · Saldo ${money(balance(r))}</p><p>Vendedor/a al crear: ${escapeHTML(r.createdBy||'—')}</p>`+(r.payments.length?`<ul class="history">${r.payments.map(p=>`<li><b>${money(p.amount)}</b> · ${new Date(p.date).toLocaleDateString('es-CO')} · ${escapeHTML(p.note||'Abono')}${p.seller?' · '+escapeHTML(p.seller):''}</li>`).join('')}</ul>`:'<p>Aún no hay abonos.</p>')+`<h3>Historial de excepciones</h3>`+((r.extensions||[]).length?`<ul class="history">${r.extensions.map(x=>`<li>${escapeHTML(x.previousDue)} → <b>${escapeHTML(x.newDue)}</b> · ${escapeHTML(x.reason)} · ${new Date(x.date).toLocaleDateString('es-CO')}${x.seller?' · '+escapeHTML(x.seller):''}</li>`).join('')}</ul>`:'<p>Sin excepciones registradas.</p>');$('detailDialog').showModal();break;case 'reminder':openReminder(r);break;case 'social':{const phone=r.phone.replace(/[\s()-]/g,'');if(!/^\+?\d{7,15}$/.test(phone)){alert('Revisa el teléfono; incluye el indicativo del país si es necesario.');return;}const msg=`Hola ${r.client}, te invitamos a seguir a Koquetas Boutique en nuestras redes: TikTok https://www.tiktok.com/@koquetas_boutique4 e Instagram https://www.instagram.com/koquetas_boutique_/ ¡Te esperamos!`;if(confirm(`¿Deseas preparar este SMS para ${r.phone}?\n\n${msg}\n\nSe abrirá tu aplicación de mensajes para que lo revises y envíes.`))location.href=`sms:${phone}?body=${encodeURIComponent(msg)}`;break;}case 'edit':openEditor(r);break;case 'delete':if(confirm(`¿Eliminar el separado de ${r.client} y todos sus abonos?`)){const previous=data;data=data.filter(x=>x.id!==r.id);try{await save('Separado eliminado',reservationLabel(r));}catch{data=previous;alert('No se pudo eliminar el separado.');return;}render();} }};
$('extensionForm').onsubmit = async event => {
  event.preventDefault();
  const record = data.find(item => item.id === extensionId);
  const nextDue = $('extensionDate').value;
  const reason = $('extensionReason').value.trim();
  const error = $('extensionError');
  if (!record || balance(record) <= 0 || !reason || !nextDue || nextDue <= record.due) {
    error.textContent = 'Indica un motivo y una fecha posterior al vencimiento actual.';
    return;
  }
  const previousDue = record.due;
  const previousExtensions = record.extensions;
  record.extensions = [...(previousExtensions || []), {
    previousDue, newDue: nextDue, reason, seller, date: new Date().toISOString(),
  }];
  record.due = nextDue;
  try {
    await save('Plazo extendido', reservationLabel(record) + ' · ' + nextDue);
  } catch {
    record.due = previousDue;
    record.extensions = previousExtensions;
    error.textContent = 'No se pudo guardar la extensión.';
    return;
  }
  $('extensionDialog').close();
  render();
};

$('paymentForm').onsubmit = async event => {
  event.preventDefault();
  const record = data.find(item => item.id === paymentId);
  const amount = readPesos('paymentAmount');
  const error = $('paymentError');
  if (!record || !Number.isSafeInteger(amount) || amount <= 0 || amount > balance(record)) {
    error.textContent = 'Ingresa un valor positivo que no supere el saldo.';
    return;
  }
  const previousPayments = record.payments;
  record.payments = [...previousPayments, {
    amount, note: $('paymentNote').value.trim(), seller, date: new Date().toISOString(),
  }];
  try {
    await save('Abono registrado', reservationLabel(record) + ' · ' + money(amount));
  } catch {
    record.payments = previousPayments;
    error.textContent = 'No se pudo guardar el abono.';
    return;
  }
  $('paymentDialog').close();
  render();
};
$('export').onclick = async () => {
  try {
    await save('Copia de seguridad exportada');
    downloadFile(localStorage.getItem(storageKey), 'application/json', 'separados-copia-cifrada.json');
  } catch {
    alert('No se pudo preparar la copia de seguridad.');
  }
};
$('import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>5000000)throw Error('La copia es demasiado grande.');const raw=await file.text(),pass=prompt('Contraseña con la que se cifró la copia:');if(pass===null)return;const v=await openVault(raw,pass);if(!confirm('La copia reemplazará todos los datos de este navegador. ¿Continuar?'))return;await saveQueue;const restoredActivity=[...v.activity,activityItem('Copia de seguridad importada')];const restored=await seal({records:v.result,contacts:v.contacts,notifications:v.notifications,activity:restoredActivity},v.k,v.s,v.recoveryKey);localStorage.setItem(storageKey,restored);data=v.result;contacts=v.contacts;notifications=v.notifications;activity=restoredActivity;key=v.k;salt=v.s;recoveryKey=v.recoveryKey;render();renderContacts();alert('Copia importada. Se usará la contraseña de la copia.');}catch(err){alert('No se pudo importar. Verifica el archivo y su contraseña.');}finally{e.target.value='';}};

function parseContactsCsv(text){const rows=[];let row=[],field='',quoted=false;text=text.replace(/^\uFEFF/,'');for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}else if(c==='"')quoted=true;else if(c===','){row.push(field);field='';}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field='';}else field+=c;}if(quoted)throw Error('El CSV tiene comillas sin cerrar.');if(field||row.length){row.push(field);rows.push(row);}if(rows.length<2)throw Error('El archivo no contiene contactos.');const headers=rows.shift().map(x=>x.trim().toLowerCase());const find=(r,names)=>{for(const name of names){const i=headers.indexOf(name);if(i>=0&&r[i]?.trim())return r[i].trim();}return '';};const cols=headers.map((h,i)=>/^(phone|teléfono|telefono)\s*\d*\s*-\s*(value|valor)$/.test(h)||/^(phone|teléfono|telefono)\s*\d*$/.test(h)?i:-1).filter(i=>i>=0);if(!cols.length)throw Error('No se encontraron teléfonos. Exporta en formato CSV de Google.');return rows.map(r=>({name:find(r,['name','nombre'])||[find(r,['first name','given name','nombre de pila']),find(r,['last name','family name','apellidos'])].filter(Boolean).join(' '),phone:cols.map(i=>(r[i]||'').trim()).find(Boolean)||''})).filter(c=>c.name&&c.phone);}
const contactDisplayName = contact => contact.isClient ? 'Clienta ' + contact.name : contact.name;
function renderContacts(){const q=$('contactSearch').value.trim().toLocaleLowerCase();const visible=contacts.map((c,i)=>({c,i})).filter(({c})=>`${contactDisplayName(c)} ${c.phone}`.toLocaleLowerCase().includes(q));$('contactsList').innerHTML=visible.length?visible.map(({c,i})=>`<div class="contact-row"><span><b>${escapeHTML(contactDisplayName(c))}</b> · ${escapeHTML(c.phone)} <span class="tag ${c.socialSentAt?"social-sent":"social-pending"}">${c.socialSentAt?"Mensaje de redes marcado como enviado":"Envío sin confirmar"}</span></span><span class="buttons"><button class="secondary" data-contact="${i}" type="button">Invitar a redes</button><button class="secondary" data-social-status="${i}" type="button">${c.socialSentAt?"Desmarcar enviado":"Marcar como enviado"}</button></span></div>`).join(''):'<p>No hay contactos que mostrar.</p>';$('contactsStatus').textContent=`${contacts.length} contacto(s) guardados.`;}
$('contactSearch').oninput=renderContacts;
$('contactsImport').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>5000000)throw Error('El archivo supera 5 MB.');const imported=parseContactsCsv(await file.text());const known=new Set(contacts.map(c=>c.name.toLocaleLowerCase()+'|'+(phoneKey(c.phone)||c.phone)));let count=0;for(const c of imported){const id=c.name.toLocaleLowerCase()+'|'+(phoneKey(c.phone)||c.phone);if(!known.has(id)){contacts.push({...c,createdBy:seller});known.add(id);count++;}}await save('Contactos importados',String(count));renderContacts();$('contactsStatus').textContent=`Se importaron ${count} contacto(s). Total: ${contacts.length}.`;}catch(err){$('contactsStatus').textContent=err.message;}finally{e.target.value='';}};
$('contactsList').onclick=async e=>{const statusButton=e.target.closest('[data-social-status]');if(statusButton){const c=contacts[Number(statusButton.dataset.socialStatus)];if(!c)return;if(c.socialSentAt){if(!confirm('¿Quitar la marca de mensaje enviado?'))return;delete c.socialSentAt;delete c.socialSentBy;}else{if(!confirm('¿Confirmas que ya enviaste el mensaje de redes a '+c.name+'?'))return;c.socialSentAt=new Date().toISOString();c.socialSentBy=seller;}await save(c.socialSentAt?'Invitación a redes confirmada':'Marca de invitación retirada',c.name);renderContacts();return;}const button=e.target.closest('[data-contact]');if(!button)return;const c=contacts[Number(button.dataset.contact)];if(!c)return;const phone=c.phone.replace(/[\s()-]/g,'');if(!/^\+?\d{7,15}$/.test(phone)){alert('Revisa el teléfono del contacto en Google; usa el indicativo del país si es necesario.');return;}const msg=`Hola ${c.name}, te invitamos a seguir a Koquetas Boutique en nuestras redes: TikTok https://www.tiktok.com/@koquetas_boutique4 e Instagram https://www.instagram.com/koquetas_boutique_/ ¡Te esperamos!`;if(confirm(`¿Deseas preparar este SMS para ${c.phone}?\n\n${msg}\n\nSe abrirá tu aplicación de mensajes para que lo revises y envíes.`))location.href=`sms:${phone}?body=${encodeURIComponent(msg)}`;};

document.querySelectorAll('[data-password]').forEach(button=>button.addEventListener('click',()=>{const input=$(button.dataset.password),show=input.type==='password';input.type=show?'text':'password';button.setAttribute('aria-pressed',String(show));button.setAttribute('aria-label',(show?'Ocultar':'Mostrar')+' '+(button.dataset.passwordLabel||(input.id==='passwordConfirm'?'contraseña de confirmación':'contraseña')));}));

let pendingRecoveryCode=null;
const normalizeRecoveryCode=value=>value.trim().replace(/\s|-/g,'').toUpperCase();
$('setupRecovery').onclick=()=>{const bytes=crypto.getRandomValues(new Uint8Array(32));const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();pendingRecoveryCode=hex;$('recoveryGenerated').textContent=hex.match(/.{1,8}/g).join('-');$('recoveryConfirm').value='';$('recoverySetupError').textContent='';$('recoverySetupDialog').showModal();};
$('recoverySetupDialog').addEventListener('close',()=>{pendingRecoveryCode=null;$('recoveryGenerated').textContent='';$('recoveryConfirm').value='';});
$('recoverySetupForm').onsubmit=async e=>{e.preventDefault();if(!pendingRecoveryCode||normalizeRecoveryCode($('recoveryConfirm').value)!==pendingRecoveryCode){$('recoverySetupError').textContent='El código no coincide. Compruébalo e inténtalo de nuevo.';return;}const raw=new Uint8Array(pendingRecoveryCode.match(/../g).map(x=>parseInt(x,16)));const previous=recoveryKey;try{recoveryKey=await crypto.subtle.importKey('raw',raw,'AES-GCM',true,['encrypt','decrypt']);await save('Código de recuperación actualizado');$('recoverySetupDialog').close();$('recoveryStatus').textContent='Código activado. Crea una nueva copia de seguridad para incluirlo.';}catch(err){recoveryKey=previous;$('recoverySetupError').textContent='No se pudo activar el código. Inténtalo de nuevo.';}};
function clearRecoverErrors(){for(const id of ['recoverCode','recoverPasswordConfirm'])$(id).removeAttribute('aria-invalid');$('recoverCodeError').textContent='';$('recoverPasswordError').textContent='';$('recoverError').textContent='';}
function markRecoverError(id,errorId,message){$(id).setAttribute('aria-invalid','true');$(errorId).textContent=message;$(id).focus();}
for(const id of ['recoverCode','recoverPasswordConfirm'])$(id).addEventListener('input',()=>{$(id).removeAttribute('aria-invalid');$(id==='recoverCode'?'recoverCodeError':'recoverPasswordError').textContent='';});
$('recoverOpen').onclick=()=>{$('recoverForm').reset();$('recoverSeller').value=$('sellerName').value;clearRecoverErrors();$('recoverDialog').showModal();};
$('recoverDialog').addEventListener('close',()=>{$('recoverForm').reset();clearRecoverErrors();$('recoverDialog').querySelectorAll('[data-password]').forEach(button=>{const input=$(button.dataset.password);input.type='password';button.setAttribute('aria-pressed','false');button.setAttribute('aria-label','Mostrar '+button.dataset.passwordLabel);});});
$('recoverForm').onsubmit=async e=>{e.preventDefault();clearRecoverErrors();try{const name=$('recoverSeller').value.trim();if(!name){$('recoverSeller').focus();throw Error('Escribe el nombre del vendedor o vendedora.');}const pass=$('recoverPassword').value;if(pass!==$('recoverPasswordConfirm').value){markRecoverError('recoverPasswordConfirm','recoverPasswordError','Las contraseñas no coinciden.');return;}const code=normalizeRecoveryCode($('recoverCode').value);if(!/^[0-9A-F]{64}$/.test(code)){markRecoverError('recoverCode','recoverCodeError','El código de recuperación debe tener 64 caracteres: números del 0 al 9 y letras de la A a la F.');return;}const file=$('recoverFile').files[0];if(file&&file.size>5000000)throw Error('La copia supera 5 MB.');const raw=file?await file.text():localStorage.getItem(storageKey);if(!raw)throw Error('No hay datos en este navegador. Selecciona una copia.');const vault=JSON.parse(raw);if(!vault.recovery)throw Error('Esta copia no tiene recuperación activada. Necesitas su contraseña original.');const rk=await crypto.subtle.importKey('raw',new Uint8Array(code.match(/../g).map(x=>parseInt(x,16))),'AES-GCM',true,['encrypt','decrypt']);const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(vault.recovery.iv)},rk,bytes(vault.recovery.ciphertext));const result=JSON.parse(dec.decode(plaintext));if(!result||!Array.isArray(result.records)||!Array.isArray(result.contacts))throw Error('La copia no contiene datos válidos.');if(file&&localStorage.getItem(storageKey)&&!confirm('La copia recuperada reemplazará los datos de este navegador. ¿Continuar?'))return;const nextSalt=crypto.getRandomValues(new Uint8Array(16)),nextKey=await derive(pass,nextSalt);await saveQueue;const recoveredActivity=[...(Array.isArray(result.activity)?result.activity:[]),activityItem('Acceso recuperado','',name)];const newVault=await seal({...result,activity:recoveredActivity},nextKey,nextSalt,rk);localStorage.setItem(storageKey,newVault);data=result.records;contacts=result.contacts;notifications=Array.isArray(result.notifications)?result.notifications:[];activity=recoveredActivity;seller=name;salt=nextSalt;key=nextKey;recoveryKey=rk;$('recoverDialog').close();$('auth').hidden=true;$('app').hidden=false;$('lock').hidden=false;render();renderContacts();$('recoveryStatus').textContent='Acceso recuperado. Guarda una copia actualizada al salir.';}catch(err){$('recoverError').textContent=err.name==='OperationError'?'Código incorrecto o copia dañada.':err.message;}};

locked();

