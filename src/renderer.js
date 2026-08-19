const api = window.packsmith || {
  getState: async () => JSON.parse(localStorage.getItem('packsmith') || '{"accounts":[],"instances":[],"selectedAccountId":null}'),
  saveState: async state => localStorage.setItem('packsmith', JSON.stringify(state)),
  startMicrosoftLogin: async () => ({ demo: true, userCode: 'PACK-SMITH', verificationUri: 'https://microsoft.com/devicelogin' }),
  getVersions: async () => ({Vanilla:['1.21.8'],Fabric:['1.21.8'],Forge:['1.21.8'],NeoForge:['1.21.8']}), getDiscover: async()=>[], installInstance:async()=>{},
  openExternal: url => window.open(url), copy: text => navigator.clipboard.writeText(text),
  createShareCode: async () => `PS-${Math.random().toString(16).slice(2, 8).toUpperCase()}`
};
let state = { accounts: [], instances: [], selectedAccountId: null };
let versionCatalog = null;
const loaders = ['Vanilla', 'Fabric', 'Forge', 'NeoForge'];
const mods = [
  { name: 'Sodium', author: 'CaffeineMC', versions: ['0.6.13 · 1.21.5', '0.6.9 · 1.21.4'] },
  { name: 'Lithium', author: 'CaffeineMC', versions: ['0.15.0 · 1.21.5', '0.14.8 · 1.21.4'] },
  { name: 'Iris Shaders', author: 'IrisShaders', versions: ['1.8.8 · 1.21.5', '1.8.5 · 1.21.4'] },
  { name: 'JourneyMap', author: 'techbrew', versions: ['6.0.0 · 1.21.5', '5.10.3 · 1.21.1'] },
  { name: 'JEI', author: 'mezz', versions: ['19.21.0 · 1.21.1', '18.0.0 · 1.20.6'] }
];
const $ = selector => document.querySelector(selector);
function toast(message) { const node = $('#toast'); node.textContent = message; node.classList.add('show'); setTimeout(() => node.classList.remove('show'), 2300); }
function modal(content, wide = false) { $('#modal-root').innerHTML = `<div class="modal-backdrop"><section class="modal ${wide ? 'wide' : ''}">${content}</section></div>`; document.querySelectorAll('[data-close]').forEach(x => x.onclick = closeModal); }
function closeModal() { $('#modal-root').innerHTML = ''; }
function selectedAccount() { return state.accounts.find(a => a.id === state.selectedAccountId); }
async function persist() { await api.saveState(state); render(); }
function render() {
  const account = selectedAccount();
  $('#account-button strong').textContent = account?.name || 'No account';
  $('.account-button .avatar').textContent = account?.name?.[0]?.toUpperCase() || '?';
  $('#instance-count').textContent = `${state.instances.length} build${state.instances.length === 1 ? '' : 's'}`;
  const query = $('#instance-search').value.toLowerCase();
  const list = state.instances.filter(item => item.name.toLowerCase().includes(query));
  $('#instance-grid').innerHTML = list.map(item => `<article class="instance-card" data-id="${item.id}"><div class="card-top"><span class="loader-tag">${item.loader.toUpperCase()}</span><button class="menu-button" data-menu="${item.id}" title="Instance actions">•••</button></div><h3>${escapeHtml(item.name)}</h3><p>Minecraft ${item.version} · Java ${item.java}</p><div class="card-bottom"><span class="mod-count">${item.status==='ready'?'✓ Ready':item.status==='error'?'⚠ Failed':'↓ Installing'} · ${item.mods?.length || 0} mods</span><button class="play" data-play="${item.id}" ${item.status!=='ready'?'disabled':''}>▶ Play</button></div></article>`).join('');
  $('#empty-state').classList.toggle('hidden', state.instances.length > 0);
  document.querySelectorAll('[data-menu]').forEach(button => button.onclick = () => instanceMenu(button.dataset.menu));
  document.querySelectorAll('[data-play]').forEach(button => button.onclick = () => account ? toast(`Preparing ${state.instances.find(x=>x.id===button.dataset.play).name}…`) : manageAccounts());
}
function escapeHtml(value) { const div = document.createElement('div'); div.textContent = value; return div.innerHTML; }

function manageAccounts() {
  modal(`<div class="modal-head"><div><h2>Microsoft accounts</h2><p>Select the identity used to launch Minecraft.</p></div><button class="close" data-close>×</button></div><div id="account-list">${state.accounts.map(a => `<div class="account-row"><span class="avatar">${a.name[0]}</span><div class="grow"><strong>${escapeHtml(a.name)}</strong><small>Microsoft · Minecraft Java</small></div><button class="${a.id === state.selectedAccountId ? 'primary' : 'secondary'}" data-select-account="${a.id}">${a.id === state.selectedAccountId ? 'Selected' : 'Select'}</button></div>`).join('') || '<p class="notice">No accounts yet. Microsoft device sign-in supports accounts protected by two-factor authentication.</p>'}</div><div class="modal-actions"><button class="primary" id="add-account">＋ Add Microsoft account</button></div>`);
  document.querySelectorAll('[data-select-account]').forEach(b => b.onclick = async () => { state.selectedAccountId = b.dataset.selectAccount; await persist(); manageAccounts(); });
  $('#add-account').onclick = beginLogin;
}
async function beginLogin() {
  let auth; try { auth = await api.startMicrosoftLogin(); } catch(error) { toast(error.message); return; }
  modal(`<div class="modal-head"><div><h2>Sign in with Microsoft</h2><p>Complete the secure sign-in in your browser.</p></div><button class="close" data-close>×</button></div><div class="stepper"><span class="on"></span><span class="on"></span><span></span></div><p>Your browser will return to Packsmith's authentication server after Microsoft confirms your account.</p><p class="notice">🔒 Your password and second factor are entered only on Microsoft's site. The callback uses a one-time PKCE session.</p><div class="modal-actions"><button class="primary" id="open-login">Open Microsoft sign-in</button></div><p class="notice">Waiting for Microsoft to confirm sign-in…</p>`);
  $('#open-login').onclick = () => api.openExternal(auth.authorizationUrl);
  api.openExternal(auth.authorizationUrl);
}

async function newInstance() {
  if (!selectedAccount()) { manageAccounts(); toast('Connect an account before creating an instance'); return; }
  try { versionCatalog ||= await api.getVersions(); } catch(error) { toast(`Version catalog unavailable: ${error.message}`); return; }
  modal(`<div class="modal-head"><div><h2>Create an instance</h2><p>Choose the foundation for your new build.</p></div><button class="close" data-close>×</button></div><form id="instance-form"><div class="form-grid"><label class="field full">Instance name<input name="name" required maxlength="50"></label><label class="field">Minecraft version<select name="version"></select></label><label class="field">Mod loader<select name="loader">${loaders.map(x=>`<option>${x}</option>`).join('')}</select></label><label class="field">Java runtime<select name="java"><option>21 (recommended)</option><option>17</option><option>8</option></select></label><label class="field">Memory minimum (GB)<input name="xms" type="number" min="1" value="2"></label><label class="field">Memory maximum (GB)<input name="xmx" type="number" min="2" value="8"></label><label class="field full">JVM arguments<input name="jvm" value="-XX:+UseG1GC"></label></div><div class="modal-actions"><button type="button" class="secondary" data-close>Cancel</button><button class="primary">Create & install</button></div></form>`);
  const updateVersions=()=>{$('[name=version]').innerHTML=versionCatalog[$('[name=loader]').value].map(v=>`<option>${escapeHtml(v)}</option>`).join('')}; $('[name=loader]').onchange=updateVersions; updateVersions();
  $('#instance-form').onsubmit=async event=>{event.preventDefault();const values=Object.fromEntries(new FormData(event.target));const instance={id:crypto.randomUUID(),name:values.name,version:values.version,loader:values.loader,java:values.java.split(' ')[0],memory:{xms:+values.xms,xmx:+values.xmx},jvmArgs:values.jvm,mods:[],status:'installing',createdAt:Date.now()};state.instances.push(instance);await persist();await api.installInstance(instance);closeModal();toast('Installation started');};
}
function askForMods(instance) { modal(`<div class="modal-head"><div><h2>Add mods now?</h2><p>${escapeHtml(instance.name)} is ready for the workbench.</p></div><button class="close" data-close>×</button></div><p class="notice">Browse compatible releases and choose an exact mod version. You can always do this later.</p><div class="modal-actions"><button class="secondary" data-close>Not now</button><button class="primary" id="browse-mods">Browse mods</button></div>`); $('#browse-mods').onclick = () => modBrowser(instance.id); }
function modBrowser(id) {
  const instance = state.instances.find(x => x.id === id);
  modal(`<div class="modal-head"><div><h2>Choose mods</h2><p>${escapeHtml(instance.name)} · ${instance.loader} ${instance.version}</p></div><button class="close" data-close>×</button></div><label class="search" style="width:100%">⌕<input id="mod-search" placeholder="Search compatible mods…"></label><div class="mod-browser"></div><div class="modal-actions"><button class="primary" data-close>Done</button></div>`, true);
  const draw = () => { const query = $('#mod-search').value.toLowerCase(); $('.mod-browser').innerHTML = mods.filter(m => m.name.toLowerCase().includes(query)).map((m,i) => { const installed=instance.mods.some(x=>x.name===m.name); return `<div class="mod-row"><div class="grow"><strong>${m.name}</strong><small>by ${m.author} · compatible</small></div><select data-version="${m.name}">${m.versions.map(v=>`<option>${v}</option>`).join('')}</select><button class="${installed?'secondary':'primary'}" data-add-mod="${m.name}">${installed?'Remove':'Add'}</button></div>`; }).join(''); document.querySelectorAll('[data-add-mod]').forEach(b => b.onclick = async () => { const index=instance.mods.findIndex(x=>x.name===b.dataset.addMod); if(index>=0) instance.mods.splice(index,1); else instance.mods.push({name:b.dataset.addMod,version:document.querySelector(`[data-version="${b.dataset.addMod}"]`).value}); await api.saveState(state); draw(); }); };
  draw(); $('#mod-search').oninput = draw;
}
function instanceMenu(id) { const item=state.instances.find(x=>x.id===id); modal(`<div class="modal-head"><div><h2>${escapeHtml(item.name)}</h2><p>Instance actions</p></div><button class="close" data-close>×</button></div><div class="account-row"><div class="grow"><strong>Mods</strong><small>Add, remove, or pin versions</small></div><button class="secondary" id="edit-mods">Manage</button></div><div class="account-row"><div class="grow"><strong>Share & sync</strong><small>Create a code followers can join</small></div><button class="primary" id="share-instance">Generate code</button></div><div class="modal-actions"><button class="text-button" id="delete-instance" style="color:var(--danger)">Delete instance</button></div>`); $('#edit-mods').onclick=()=>modBrowser(id); $('#share-instance').onclick=async()=>{const code=await api.createShareCode(id); item.shareCode=code; await api.copy(code); modal(`<div class="modal-head"><div><h2>Pack code created</h2><p>Share this code with your friends.</p></div><button class="close" data-close>×</button></div><div class="auth-code">${code}</div><p class="notice">Followers receive mod and config updates on their next launch, while retaining local override controls.</p><div class="modal-actions"><button class="primary" data-close>Code copied</button></div>`)}; $('#delete-instance').onclick=async()=>{state.instances=state.instances.filter(x=>x.id!==id);await persist();closeModal();toast('Instance removed')}; }
function joinCode() { modal(`<div class="modal-head"><div><h2>Join a shared pack</h2><p>Enter the code sent by the pack creator.</p></div><button class="close" data-close>×</button></div><form id="join-form"><label class="field">Packsmith share code<input name="code" required placeholder="PS-12AB34" style="text-transform:uppercase"></label><p class="notice">Packsmith checks for an existing match before creating a synchronized instance.</p><div class="modal-actions"><button class="secondary" data-close type="button">Cancel</button><button class="primary">Find pack</button></div></form>`); $('#join-form').onsubmit=e=>{e.preventDefault();toast('Share server connection is not configured');closeModal();}; }
document.querySelectorAll('[data-view]').forEach(button => button.onclick=()=>{document.querySelectorAll('.view,.nav-item').forEach(x=>x.classList.remove('active'));$(`#${button.dataset.view}-view`).classList.add('active');document.querySelector(`.nav-item[data-view="${button.dataset.view}"]`)?.classList.add('active')});
$('#manage-accounts').onclick=manageAccounts; $('#account-button').onclick=manageAccounts; $('#new-instance').onclick=newInstance; $('#empty-new').onclick=newInstance; $('#join-code').onclick=joinCode; document.querySelector('[data-join]').onclick=joinCode; $('#instance-search').oninput=render;
api.getState().then(data => { state = { ...state, ...data }; render(); });

api.onAuthResult?.(async result => { if(result.error){toast(result.error);return;} state=await api.getState();closeModal();render();toast(`Signed in as ${result.account.name}`); });
api.onInstanceProgress?.(job => { const item=state.instances.find(x=>x.id===job.id);if(item)item.status=job.status;let node=document.querySelector(`[data-job="${job.id}"]`);if(!node){node=document.createElement('div');node.className='job';node.dataset.job=job.id;$('#jobs').append(node);}node.innerHTML=`<div><strong>${escapeHtml(item?.name||'Instance')}</strong><span>${escapeHtml(job.message)}</span></div><progress max="1" value="${job.value}"></progress>`;render();if(job.status==='ready')setTimeout(()=>node.remove(),3500);});
api.getDiscover().then(packs=>{$('#discover-grid').innerHTML=packs.map(p=>`<article class="pack-card">${p.artwork?`<img src="${escapeHtml(p.artwork)}" alt="">`:''}<div><small>${p.provider}</small><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.summary)}</p><button class="secondary" data-pack-url="${escapeHtml(p.url)}">View pack</button></div></article>`).join('');document.querySelectorAll('[data-pack-url]').forEach(b=>b.onclick=()=>api.openExternal(b.dataset.packUrl));}).catch(e=>$('#discover-grid').innerHTML=`<p>Catalog unavailable: ${escapeHtml(e.message)}</p>`);
