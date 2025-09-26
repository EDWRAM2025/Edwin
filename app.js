// ====== AOS ======
AOS.init({ duration: 700, once: true });
document.getElementById('year').textContent = new Date().getFullYear();

// ====== Supabase config ======
const SUPABASE_URL = "https://lvpqlvsnczsibmjgecnq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2cHFsdnNuY3pzaWJtamdlY25xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NzE5MDMsImV4cCI6MjA3NDM0NzkwM30.zAdIc9T5UORqNvaEyd9DoaJTPI5fWr2Aixi6T5rrpnA";
const BUCKET = "portafolio";
const { createClient } = supabase;
const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

// ====== DOM refs ======
const weeksList = document.getElementById("weeksList");
const filesList = document.getElementById("filesList");
const currentWeekTitle = document.getElementById("currentWeekTitle");

const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const userBox = document.getElementById("userBox");
const userEmail = document.getElementById("userEmail");

const adminActions = document.getElementById("adminActions");
const fileInput = document.getElementById("fileInput");
const btnRefresh = document.getElementById("btnRefresh");

const authModalEl = document.getElementById('authModal');
const authModal = new bootstrap.Modal(authModalEl);
const authEmail = document.getElementById("authEmail");
const authPass = document.getElementById("authPass");
const authMsg  = document.getElementById("authMsg");
const btnDoLogin = document.getElementById("btnDoLogin");
const btnDoRegister = document.getElementById("btnDoRegister");

const previewModalEl = document.getElementById('previewModal');
const previewModal = new bootstrap.Modal(previewModalEl);
const previewBody = document.getElementById('previewBody');
const previewDownload = document.getElementById('previewDownload');

const WEEKS = Array.from({ length: 16 }, (_, i) => ({ label:`Semana ${String(i+1).padStart(2,'0')}`, folder:`week-${String(i+1).padStart(2,'0')}` }));
let state = { session:null, currentWeek: WEEKS[0] };

// ====== Auth ======
btnLogin.addEventListener('click', ()=> authModal.show());
btnLogout.addEventListener('click', async ()=> { await supa.auth.signOut(); });

btnDoLogin.addEventListener("click", async (e) => {
  e.preventDefault(); authMsg.textContent = "Ingresando...";
  const { error } = await supa.auth.signInWithPassword({ email: authEmail.value.trim(), password: authPass.value });
  if (error) authMsg.textContent = "Error: " + error.message; else authModal.hide();
});
btnDoRegister.addEventListener("click", async (e) => {
  e.preventDefault(); authMsg.textContent = "Creando cuenta...";
  const { error } = await supa.auth.signUp({ email: authEmail.value.trim(), password: authPass.value });
  authMsg.textContent = error ? ("Error: " + error.message) : "Cuenta creada. Revisa tu correo si pide confirmación.";
});

supa.auth.onAuthStateChange((_evt, session)=>{
  state.session = session;
  const logged = !!session?.user;
  adminActions.classList.toggle("d-none", !logged);
  btnLogin.classList.toggle("d-none", logged);
  userBox.classList.toggle("d-none", !logged);
  userEmail.textContent = logged ? session.user.email : "";
  renderFiles();
});

// ====== Weeks UI ======
function renderWeeks(){
  weeksList.innerHTML = "";
  WEEKS.forEach((w, idx)=>{
    const btn = document.createElement("button");
    btn.className = "week-btn";
    btn.innerHTML = `
      <span class="week-num">${String(idx+1).padStart(2,'0')}</span>
      <div class="flex-1 text-start">
        <div class="week-title">${w.label}</div>
        <div class="week-sub">Materiales y evidencias</div>
      </div>
      <i class="bi bi-chevron-right ms-auto text-secondary"></i>
    `;
    btn.onclick = ()=> selectWeek(w.folder);
    if(idx===0) btn.classList.add("active");
    weeksList.appendChild(btn);
  });
}
function highlightWeek(folder){
  [...weeksList.querySelectorAll('.week-btn')].forEach((b, i)=>{
    const tag = `week-${String(i+1).padStart(2,'0')}`;
    b.classList.toggle('active', tag === folder);
  });
}

// ====== Helpers ======
function isFileEntry(e){ return e?.metadata && typeof e.metadata.size === "number"; }
function publicUrl(path){ return supa.storage.from(BUCKET).getPublicUrl(path).data.publicUrl; }
function extFromName(name){ return (name.split('.').pop() || '').toLowerCase(); }
function isImageExt(ext){ return ['png','jpg','jpeg','gif','webp','bmp','svg'].includes(ext); }
function isPdfExt(ext){ return ext === 'pdf'; }
function forceDownloadUrl(url, fileName){
  return url + (url.includes('?') ? '&' : '?') + 'download=' + encodeURIComponent(fileName);
}

// ====== Listar (1 nivel recursivo) ======
async function listWeekFilesRecursive(prefix){
  const { data, error } = await supa.storage.from(BUCKET).list(prefix, { limit:100, sortBy:{column:"name", order:"asc"} });
  if(error){ console.error(error); return []; }

  const filesLv0 = (data||[]).filter(isFileEntry).map(it=>({ name: it.name, path:`${prefix}/${it.name}`, size: it.metadata?.size||0 }));
  const folders = (data||[]).filter(e=>!isFileEntry(e));

  const nestedArrays = await Promise.all(folders.map(async fd=>{
    const subPath = `${prefix}/${fd.name}`;
    const { data: sub, error: errSub } = await supa.storage.from(BUCKET).list(subPath, { limit:100, sortBy:{column:"name", order:"asc"} });
    if(errSub){ console.error(errSub); return []; }
    return (sub||[]).filter(isFileEntry).map(it=>({ name:`${fd.name}/${it.name}`, path:`${subPath}/${it.name}`, size: it.metadata?.size||0 }));
  }));

  return filesLv0.concat(...nestedArrays);
}

// ====== Preview modal ======
function openPreview(url, fileName){
  const ext = extFromName(fileName || url);
  previewBody.innerHTML = "";
  if (isPdfExt(ext)){
    const iframe = document.createElement('iframe');
    iframe.src = url; iframe.style.width = "100%"; iframe.style.height = "70vh"; iframe.loading = "lazy";
    previewBody.appendChild(iframe);
  } else if (isImageExt(ext)){
    const img = document.createElement('img');
    img.src = url; img.style.width = "100%"; img.style.height = "auto"; img.className="d-block";
    previewBody.appendChild(img);
  } else {
    previewBody.innerHTML = `
      <div class="p-4">
        <p class="text-secondary mb-2">No hay vista previa para <strong>${fileName}</strong>.</p>
        <a class="btn btn-accent" href="${url}" target="_blank"><i class="bi bi-box-arrow-up-right"></i> Abrir</a>
      </div>`;
  }
  previewDownload.href = forceDownloadUrl(url, fileName);
  previewModal.show();
}

// ====== Render archivos ======
async function renderFiles(){
  const w = state.currentWeek;
  currentWeekTitle.textContent = `Archivos — ${w.label}`;
  highlightWeek(w.folder);

  const items = await listWeekFilesRecursive(w.folder);
  filesList.innerHTML = "";
  if(items.length===0){
    filesList.innerHTML = `<div class="text-secondary p-2">Sin archivos aún</div>`;
    return;
  }

  const logged = !!state.session?.user;
  items.forEach(it=>{
    const row = document.createElement("div");
    row.className = "table-row";
    const url = publicUrl(it.path);
    const sizeKB = Math.round((it.size||0)/1024);
    const fileName = it.name.includes('/') ? it.name.split('/').pop() : it.name;
    const downloadHref = forceDownloadUrl(url, fileName);

    row.innerHTML = `
      <div class="name"><strong>${fileName}</strong><br><span class="badge badge-muted">${sizeKB} KB</span></div>
      <div>
        <button class="btn btn-sm btn-accent me-1" data-open><i class="bi bi-eye"></i> Ver</button>
        <a class="btn btn-sm btn-outline-accent" href="${downloadHref}" download><i class="bi bi-download"></i> Descargar</a>
      </div>
      <div class="actions"></div>
    `;
    row.querySelector('[data-open]').onclick = () => openPreview(url, fileName);

    if(logged){
      const actions = row.querySelector(".actions");
      const del = document.createElement("button");
      del.className = "btn btn-sm btn-danger";
      del.innerHTML = '<i class="bi bi-trash"></i> Eliminar';
      del.onclick = async ()=> {
        if(!confirm("¿Eliminar este archivo?")) return;
        const { error } = await supa.storage.from(BUCKET).remove([it.path]);
        if(error) alert("Error: " + error.message); else renderFiles();
      };
      actions.appendChild(del);
    }
    filesList.appendChild(row);
  });
}

// ====== Interacción ======
async function selectWeek(folder){
  state.currentWeek = WEEKS.find(x=>x.folder===folder) || WEEKS[0];
  await renderFiles();
}
fileInput?.addEventListener("change", async (e)=>{
  const files = [...(e.target.files||[])];
  if(files.length===0) return;
  if(!state.session?.user){ alert("Debes iniciar sesión para subir."); return; }
  const folder = state.currentWeek.folder;
  for(const f of files){
    const filePath = `${folder}/${Date.now()}_${f.name}`;
    const { error } = await supa.storage.from(BUCKET).upload(filePath, f, { upsert:false, contentType: f.type || "application/octet-stream" });
    if(error) alert(`Error subiendo ${f.name}: ${error.message}`);
  }
  e.target.value = "";
  renderFiles();
});
btnRefresh.addEventListener("click", ()=> renderFiles());

// ====== Init ======
(function init(){
  renderWeeks();
  selectWeek(WEEKS[0].folder);
  supa.auth.getSession().then(({data})=>{
    state.session = data.session || null;
    const logged = !!state.session?.user;
    adminActions.classList.toggle("d-none", !logged);
    btnLogin.classList.toggle("d-none", logged);
    userBox.classList.toggle("d-none", !logged);
    userEmail.textContent = logged ? state.session.user.email : "";
  });
})();
