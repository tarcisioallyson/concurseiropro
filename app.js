/* app.js */
'use strict';

/* ===== STATE ===== */
const S = {
  materias: [], sessoes: [],
  metaHoras: 20, darkMode: false,
  sessaoDisc: null, sessaoAss: null,
  materiaAberta: null, sugestao: null,
  timer: { elapsed: 0, running: false, interval: null, start: null },
  pwaPrompt: null,
};

/* ===== TOAST ===== */
const Toast = {
  _t: null,
  show(msg, type = '') {
    clearTimeout(this._t);
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast ${type}`;
    requestAnimationFrame(() => el.classList.add('show'));
    this._t = setTimeout(() => el.classList.remove('show'), 3000);
  },
};

/* ===== MODAL ===== */
const Modal = {
  _resolve: null,
  show({ title, fields = [], message = '', confirmText = 'Confirmar', danger = false }) {
    return new Promise(resolve => {
      this._resolve = resolve;
      document.getElementById('modal-title').textContent = title;
      const body = document.getElementById('modal-body');

      if (message) {
        body.innerHTML = `<p class="modal-msg">${message}</p>`;
      } else {
        body.innerHTML = fields.map(f => {
          let ctrl = '';
          if (f.type === 'select') {
            ctrl = `<select id="mf-${f.id}">${f.options.map(o =>
              `<option value="${o.value}"${o.selected ? ' selected' : ''}>${o.label}</option>`
            ).join('')}</select>`;
          } else {
            ctrl = `<input type="${f.type || 'text'}" id="mf-${f.id}" value="${(f.value || '').replace(/"/g, '&quot;')}" placeholder="${f.placeholder || ''}">`;
          }
          return `<div class="form-group"><label>${f.label}</label>${ctrl}</div>`;
        }).join('');
      }

      const btn = document.getElementById('modal-ok');
      btn.textContent = confirmText;
      btn.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;

      const overlay = document.getElementById('modal-overlay');
      overlay.classList.add('show');
      setTimeout(() => { const first = body.querySelector('input, select'); if (first) first.focus(); }, 250);
    });
  },
  getData() {
    const out = {};
    document.querySelectorAll('#modal-body input, #modal-body select').forEach(el => {
      out[el.id.replace('mf-', '')] = el.value;
    });
    return out;
  },
  confirm() { this._close(true); },
  cancel()  { this._close(false); },
  _close(ok) {
    const data = ok ? this.getData() : {};
    document.getElementById('modal-overlay').classList.remove('show');
    if (this._resolve) { this._resolve({ ok, data }); this._resolve = null; }
  },
};

/* ===== DB HELPERS ===== */
async function saveMaterias()  { for (const m of S.materias) await DB.materias.put(m); }
async function saveConfig()    {
  await DB.config.set('metaHoras', S.metaHoras);
  await DB.config.set('darkMode',  S.darkMode);
  await DB.config.set('sessaoDisc', S.sessaoDisc);
  await DB.config.set('sessaoAss',  S.sessaoAss);
}

/* ===== NAVIGATION ===== */
function nav(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('sec-' + id).classList.add('active');
  document.getElementById('nb-' + id).classList.add('active');
  window.scrollTo(0, 0);
  ({ dashboard: renderDashboard, revisao: renderRevisao, edital: renderEdital,
     ciclo: renderCiclo, historico: renderHistorico, registro: renderRegistro,
     config: () => {} })[id]?.();
}

/* ===== PRIORITIES ===== */
function calcPrioridades() {
  const now = Date.now();
  return S.materias.flatMap(d =>
    (d.assuntos || []).map(a => {
      const ss = S.sessoes.filter(q => q.discId === d.id && q.assunto === a.nome);
      let qT = 0, aT = 0, ultima = 0;
      ss.forEach(s => { qT += +s.q || 0; aT += +s.a || 0; if (s.data > ultima) ultima = s.data; });
      const taxa  = qT > 0 ? aT / qT : 0;
      const dias  = ultima > 0 ? (now - ultima) / 86400000 : 100;
      const score = (dias * (a.peso || 1)) / (taxa + 0.1);
      return { disc: d.nome, discId: d.id, ass: a.nome, score,
               taxa: Math.round(taxa * 100), novo: qT === 0,
               link: a.link || null, pesoA: a.peso || 1 };
    })
  ).sort((a, b) => b.score - a.score);
}

/* ===== STREAK ===== */
function calcStreak() {
  const days = [...new Set(S.sessoes.map(s => new Date(s.data).toDateString()))];
  if (!days.length) return 0;
  let streak = 0, cur = new Date();
  for (const d of days.sort((a, b) => new Date(b) - new Date(a))) {
    const diff = Math.round((cur - new Date(d)) / 86400000);
    if (diff <= 1) { streak++; cur = new Date(d); } else break;
  }
  return streak;
}

/* ===== DASHBOARD ===== */
function renderDashboard() {
  const q  = S.sessoes.reduce((a, b) => a + (+b.q || 0), 0);
  const ac = S.sessoes.reduce((a, b) => a + (+b.a || 0), 0);
  const t  = S.sessoes.reduce((a, b) => a + (b.tempo || 0), 0);

  document.getElementById('d-q').textContent = q;
  document.getElementById('d-h').textContent = (t / 3600000).toFixed(1) + 'h';
  document.getElementById('d-p').textContent = q > 0 ? Math.round(ac / q * 100) + '%' : '0%';

  const streak = calcStreak();
  document.getElementById('d-streak').innerHTML = streak > 0
    ? `<span class="streak-badge"><i class="fas fa-fire"></i> ${streak} dia${streak > 1 ? 's' : ''}</span>` : '';

  const totalP = S.materias.reduce((a, b) => a + b.peso, 0);
  let prog = 0;
  S.materias.forEach(d => {
    const conc = (d.assuntos || []).filter(a => a.concluido).length;
    const tot  = (d.assuntos || []).length;
    if (totalP > 0 && tot > 0) prog += (conc / tot) * (d.peso / totalP);
  });
  const pct = Math.round(prog * 100);
  document.getElementById('bar-geral').style.width = pct + '%';
  document.getElementById('txt-geral').textContent = pct + '%';

  const prio = calcPrioridades();
  S.sugestao = prio[0] || null;
  if (S.sugestao) {
    document.getElementById('sug-ass').textContent  = S.sugestao.ass;
    document.getElementById('sug-disc').textContent = S.sugestao.disc;
    document.getElementById('hero-btn').disabled = false;
  } else {
    document.getElementById('sug-ass').textContent  = 'Nenhum assunto cadastrado';
    document.getElementById('sug-disc').textContent = 'Adicione matérias no Edital';
    document.getElementById('hero-btn').disabled = true;
  }

  const semana = Date.now() - 7 * 86400000;
  const dist   = {};
  S.sessoes.filter(x => x.data > semana).forEach(s => {
    const m = S.materias.find(e => e.id === s.discId);
    const nome = m ? m.nome : 'Outros';
    dist[nome] = (dist[nome] || 0) + s.tempo;
  });
  const distEl = document.getElementById('d-dist');
  const entries = Object.entries(dist).sort((a, b) => b[1] - a[1]);
  distEl.innerHTML = entries.length
    ? entries.map(([k, v]) => `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;border-bottom:1px solid var(--border)"><span>${k}</span><span style="font-weight:600">${(v/3600000).toFixed(1)}h</span></div>`).join('')
    : '<span style="font-size:12px;color:var(--text-3)">Sem sessões esta semana</span>';

  const urgEl = document.getElementById('d-urg');
  urgEl.innerHTML = prio.slice(0, 4).length
    ? prio.slice(0, 4).map(x => `<div style="padding:4px 0;font-size:12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:6px"><i class="fas fa-circle" style="font-size:6px;color:var(--danger)"></i>${x.ass}</div>`).join('')
    : '<span style="font-size:12px;color:var(--success)">✓ Tudo em dia!</span>';
}

function aceitarSugestao() {
  if (!S.sugestao) return;
  S.sessaoDisc = String(S.sugestao.discId);
  S.sessaoAss  = S.sugestao.ass;
  nav('registro');
}

/* ===== REVISÃO ===== */
function renderRevisao() {
  const prio = calcPrioridades();
  const el   = document.getElementById('lista-revisao');
  if (!prio.length) {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-brain"></i>Nenhum assunto cadastrado</div>';
    return;
  }
  const borderColor = x => x.novo ? 'var(--accent)' : x.score > 40 ? 'var(--danger)' : 'var(--warning)';
  const badgeClass  = x => x.novo ? 'badge-new' : x.taxa < 70 ? 'badge-red' : 'badge-green';
  const badgeText   = x => x.novo ? 'NOVO' : x.taxa + '%';

  el.innerHTML = prio.map(x => `
    <div class="rev-item" style="border-left-color:${borderColor(x)}">
      <div style="flex:1;min-width:0">
        <div class="name">${x.ass} <small style="color:var(--text-3);font-weight:400">(P${x.pesoA})</small></div>
        <div class="disc">${x.disc}</div>
        ${x.link ? `<a href="${x.link}" target="_blank" class="link"><i class="fas fa-external-link-alt" style="font-size:10px"></i> Caderno</a>` : ''}
      </div>
      <span class="badge ${badgeClass(x)}">${badgeText(x)}</span>
    </div>`).join('');
}

/* ===== EDITAL ===== */
function renderEdital() {
  const el = document.getElementById('lista-edital');
  if (!S.materias.length) {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-list-alt"></i>Adicione sua primeira matéria acima</div>';
    return;
  }
  el.innerHTML = S.materias.map(d => {
    const conc = (d.assuntos || []).filter(a => a.concluido).length;
    const tot  = (d.assuntos || []).length;
    const pct  = tot > 0 ? Math.round(conc / tot * 100) : 0;
    const open = d.id === S.materiaAberta;
    return `
      <div class="accord-item" id="acc-${d.id}">
        <div class="accord-head" onclick="toggleMateria(${d.id})">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <span class="accord-head .name" style="font-weight:600;font-size:15px">${d.nome}</span>
              <span class="badge badge-blue">P${d.peso}</span>
              <span style="font-size:11px;color:var(--text-3);margin-left:auto">${conc}/${tot}</span>
            </div>
            <div class="progress-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>
          </div>
          <i class="fas fa-chevron-${open ? 'up' : 'down'}" style="color:var(--text-3);margin-left:10px"></i>
        </div>
        <div class="accord-body${open ? ' open' : ''}">
          <button class="btn btn-full" style="background:var(--accent);color:white;margin-top:12px" onclick="addAssunto(${d.id})">
            <i class="fas fa-plus"></i> Novo tópico
          </button>
          ${(d.assuntos || []).map(a => `
            <div class="topico-row">
              <i class="topico-check ${a.concluido ? 'fas fa-check-circle' : 'far fa-circle'}" onclick="toggleCheck(${d.id},${a.id})"></i>
              <span class="topico-name${a.concluido ? ' done' : ''}" onclick="toggleCheck(${d.id},${a.id})">${a.nome}</span>
              <div class="topico-actions">
                <button class="btn-icon edit" onclick="editAssunto(${d.id},${a.id})" title="Editar"><i class="fas fa-pen" style="font-size:11px"></i></button>
                <button class="btn-icon danger" onclick="delAssunto(${d.id},${a.id})" title="Excluir"><i class="fas fa-trash" style="font-size:11px"></i></button>
              </div>
            </div>`).join('')}
          <button onclick="delMateria(${d.id})" style="width:100%;background:none;border:none;color:var(--danger);font-size:12px;font-weight:600;margin-top:14px;cursor:pointer;padding:8px">
            <i class="fas fa-trash"></i> EXCLUIR MATÉRIA
          </button>
        </div>
      </div>`;
  }).join('');
}

function toggleMateria(id) {
  S.materiaAberta = S.materiaAberta === id ? null : id;
  renderEdital();
}

async function addDisciplina() {
  const { ok, data } = await Modal.show({
    title: 'Nova Matéria',
    fields: [
      { id: 'nome', label: 'Nome', placeholder: 'Ex: Direito Civil' },
      { id: 'peso', label: 'Peso', type: 'select', options: [
        { value: 1, label: 'Peso 1 — baixa relevância' },
        { value: 3, label: 'Peso 3 — média relevância', selected: true },
        { value: 5, label: 'Peso 5 — alta relevância' },
      ]},
    ],
    confirmText: 'Criar',
  });
  if (!ok || !data.nome.trim()) return;
  const m = { id: Date.now(), nome: data.nome.trim(), peso: +data.peso, assuntos: [] };
  S.materias.push(m);
  await DB.materias.put(m);
  renderEdital();
  Toast.show('Matéria criada!', 'success');
}

async function addAssunto(discId) {
  const { ok, data } = await Modal.show({
    title: 'Novo Tópico',
    fields: [
      { id: 'nome',  label: 'Nome do tópico', placeholder: 'Ex: Contratos' },
      { id: 'peso',  label: 'Importância', type: 'select', options: [1,2,3,4,5].map(v => ({ value: v, label: `${v} — ${['muito baixa','baixa','média','alta','muito alta'][v-1]}`, selected: v === 3 })) },
      { id: 'link',  label: 'Link do caderno (opcional)', type: 'url', placeholder: 'https://' },
    ],
    confirmText: 'Adicionar',
  });
  if (!ok || !data.nome.trim()) return;
  const d = S.materias.find(x => x.id === discId);
  d.assuntos.push({ id: Date.now(), nome: data.nome.trim(), peso: +data.peso, link: (data.link && data.link !== 'https://') ? data.link : null, concluido: false });
  await DB.materias.put(d);
  renderEdital();
  Toast.show('Tópico adicionado!', 'success');
}

async function editAssunto(discId, assId) {
  const d = S.materias.find(x => x.id === discId);
  const a = d.assuntos.find(x => x.id === assId);
  const { ok, data } = await Modal.show({
    title: 'Editar Tópico',
    fields: [
      { id: 'nome', label: 'Nome', value: a.nome },
      { id: 'peso', label: 'Importância', type: 'select', options: [1,2,3,4,5].map(v => ({ value: v, label: `${v}`, selected: v === (a.peso || 1) })) },
      { id: 'link', label: 'Link do caderno (opcional)', type: 'url', value: a.link || '' },
    ],
    confirmText: 'Salvar',
  });
  if (!ok) return;
  a.nome = data.nome.trim() || a.nome;
  a.peso = +data.peso;
  a.link = (data.link && data.link !== 'https://') ? data.link : null;
  await DB.materias.put(d);
  renderEdital();
  Toast.show('Tópico atualizado!', 'success');
}

async function toggleCheck(discId, assId) {
  const d = S.materias.find(x => x.id === discId);
  const a = d.assuntos.find(x => x.id === assId);
  a.concluido = !a.concluido;
  await DB.materias.put(d);
  renderEdital();
}

async function delAssunto(discId, assId) {
  const { ok } = await Modal.show({ title: 'Excluir tópico?', message: 'Esta ação não pode ser desfeita.', confirmText: 'Excluir', danger: true });
  if (!ok) return;
  const d = S.materias.find(x => x.id === discId);
  d.assuntos = d.assuntos.filter(a => a.id !== assId);
  await DB.materias.put(d);
  renderEdital();
  Toast.show('Tópico removido.');
}

async function delMateria(id) {
  const m = S.materias.find(x => x.id === id);
  const { ok } = await Modal.show({ title: `Excluir "${m.nome}"?`, message: 'Todos os tópicos desta matéria serão perdidos.', confirmText: 'Excluir', danger: true });
  if (!ok) return;
  S.materias = S.materias.filter(x => x.id !== id);
  await DB.materias.delete(id);
  if (S.materiaAberta === id) S.materiaAberta = null;
  renderEdital();
  Toast.show('Matéria excluída.');
}

/* ===== REGISTRO / ESTUDAR ===== */
function renderRegistro() {
  const sel = document.getElementById('reg-disc');
  sel.innerHTML = S.materias.map(d => `<option value="${d.id}">${d.nome}</option>`).join('') || '<option value="">Crie uma matéria no Edital</option>';
  if (S.sessaoDisc && S.materias.some(d => String(d.id) === String(S.sessaoDisc))) sel.value = String(S.sessaoDisc);
  else if (S.materias.length) { S.sessaoDisc = String(S.materias[0].id); sel.value = S.sessaoDisc; }
  populateAssuntos();
}

function populateAssuntos() {
  const d = S.materias.find(x => String(x.id) === String(S.sessaoDisc));
  const sel = document.getElementById('reg-ass');
  const linkEl = document.getElementById('reg-link');
  if (d && d.assuntos && d.assuntos.length) {
    sel.innerHTML = d.assuntos.map(a => `<option value="${a.nome}">${a.nome}</option>`).join('');
    if (S.sessaoAss && d.assuntos.some(a => a.nome === S.sessaoAss)) sel.value = S.sessaoAss;
    else { S.sessaoAss = sel.value; }
    const cur = d.assuntos.find(a => a.nome === sel.value);
    linkEl.innerHTML = cur && cur.link ? `<a href="${cur.link}" target="_blank" class="link-btn"><i class="fas fa-external-link-alt" style="font-size:11px"></i> Abrir caderno</a>` : `<small style="color:var(--text-3)">Sem link de caderno</small>`;
  } else {
    sel.innerHTML = '<option value="Geral">Geral</option>';
    S.sessaoAss = 'Geral';
    linkEl.innerHTML = '';
  }
}

function onDiscChange(v) { S.sessaoDisc = v; saveConfig(); populateAssuntos(); }
function onAssChange(v)  { S.sessaoAss  = v; saveConfig(); populateAssuntos(); }

/* ===== TIMER ===== */
function fmtTime(ms) {
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
  return `${String(h).padStart(2,'0')}:${String(m%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}

function toggleTimer() {
  const btn = document.getElementById('timer-btn');
  if (!S.timer.running) {
    S.timer.start = Date.now() - S.timer.elapsed;
    S.timer.interval = setInterval(() => {
      S.timer.elapsed = Date.now() - S.timer.start;
      document.getElementById('timer-display').textContent = fmtTime(S.timer.elapsed);
      const pomo = document.getElementById('pomo-toggle').checked;
      const badge = document.getElementById('pomo-badge');
      if (pomo) {
        badge.style.display = 'block';
        const mins = Math.floor(S.timer.elapsed / 60000);
        if (mins % 30 < 25) { badge.textContent = '🍅 FOCO'; badge.style.background = 'var(--primary)'; }
        else                 { badge.textContent = '☕ PAUSA'; badge.style.background = 'var(--warning)'; }
      } else { badge.style.display = 'none'; }
    }, 500);
    btn.innerHTML = '<i class="fas fa-pause"></i> PAUSAR'; btn.className = 'btn btn-warning btn-full';
    document.getElementById('timer-reset').style.display = 'none';
    S.timer.running = true;
  } else {
    clearInterval(S.timer.interval);
    btn.innerHTML = '<i class="fas fa-play"></i> RETOMAR'; btn.className = 'btn btn-success btn-full';
    document.getElementById('timer-reset').style.display = 'inline-flex';
    S.timer.running = false;
  }
}

function resetTimer() {
  clearInterval(S.timer.interval);
  S.timer = { elapsed: 0, running: false, interval: null, start: null };
  document.getElementById('timer-display').textContent = '00:00:00';
  document.getElementById('timer-btn').innerHTML = '<i class="fas fa-play"></i> INICIAR';
  document.getElementById('timer-btn').className = 'btn btn-success btn-full';
  document.getElementById('timer-reset').style.display = 'none';
  document.getElementById('pomo-badge').style.display = 'none';
}

async function salvarSessao() {
  if (!S.sessaoDisc || S.sessoes.length === 0 && S.timer.elapsed < 1000) {
    if (S.timer.elapsed < 1000) { Toast.show('Inicie o cronômetro primeiro!', 'error'); return; }
  }
  if (S.timer.elapsed < 1000) { Toast.show('Inicie o cronômetro primeiro!', 'error'); return; }
  if (S.timer.running) toggleTimer();

  const q = parseInt(document.getElementById('reg-q').value) || 0;
  const a = parseInt(document.getElementById('reg-a').value) || 0;

  const sessao = {
    discId: parseInt(S.sessaoDisc), assunto: S.sessaoAss,
    q, a, tempo: S.timer.elapsed, data: Date.now(),
  };
  const id = await DB.sessoes.add(sessao);
  S.sessoes.push({ ...sessao, id });

  document.getElementById('reg-q').value = '';
  document.getElementById('reg-a').value = '';
  resetTimer();
  Toast.show('Sessão salva! 🎉', 'success');
  nav('dashboard');
}

/* ===== CICLO ===== */
function renderCiclo() {
  const el = document.getElementById('meta-horas');
  el.value = S.metaHoras;
  const totP = S.materias.reduce((a, b) => a + b.peso, 0);
  const listEl = document.getElementById('lista-ciclo');
  if (!S.materias.length) {
    listEl.innerHTML = '<div class="empty-state"><i class="fas fa-sync"></i>Adicione matérias no Edital</div>';
    return;
  }
  listEl.innerHTML = S.materias.map(d => {
    const metaS = totP > 0 ? (d.peso / totP) * S.metaHoras * 3600 : 0;
    const estS  = S.sessoes.filter(q => q.discId === d.id).reduce((a, b) => a + (b.tempo / 1000), 0);
    const pct   = metaS > 0 ? Math.min(estS / metaS * 100, 100) : 0;
    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-weight:600">${d.nome}</span>
          <small style="color:var(--text-3)">${(estS/3600).toFixed(1)}h / ${(metaS/3600).toFixed(1)}h</small>
        </div>
        <div class="progress-wrap"><div class="progress-bar${pct >= 100 ? ' green' : ''}" style="width:${pct}%"></div></div>
        <small style="color:var(--text-3)">${Math.round(pct)}% da meta semanal</small>
      </div>`;
  }).join('');
}

async function saveMeta() {
  S.metaHoras = parseFloat(document.getElementById('meta-horas').value) || 20;
  await DB.config.set('metaHoras', S.metaHoras);
  renderCiclo();
}

/* ===== HISTÓRICO ===== */
function renderHistorico() {
  const el   = document.getElementById('lista-hist');
  const list = [...S.sessoes].sort((a, b) => b.data - a.data).slice(0, 50);
  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-history"></i>Nenhuma sessão registrada</div>';
    return;
  }
  el.innerHTML = list.map(s => {
    const d    = S.materias.find(x => x.id === s.discId);
    const taxa = s.q > 0 ? Math.round(s.a / s.q * 100) : 0;
    const bdg  = s.q > 0 ? `<span class="badge ${taxa >= 70 ? 'badge-green' : 'badge-red'}">${taxa}%</span>` : '';
    return `
      <div class="hist-item">
        <div style="flex:1;min-width:0">
          <div class="hist-disc">${d ? d.nome : 'Excluída'}</div>
          <div class="hist-meta">${s.assunto} · ${new Date(s.data).toLocaleDateString('pt-BR')} · ${fmtTime(s.tempo)} ${bdg}</div>
        </div>
        <div class="hist-actions">
          <button class="btn-icon edit" onclick="editSessao(${s.id})" title="Editar"><i class="fas fa-pen" style="font-size:11px"></i></button>
          <button class="btn-icon danger" onclick="delSessao(${s.id})" title="Excluir"><i class="fas fa-trash" style="font-size:11px"></i></button>
        </div>
      </div>`;
  }).join('');
}

/* ===== EDIT SESSION — DEDICATED PANEL ===== */
let _editSessaoId = null;   // id da sessão sendo editada

function msToHHMMSS(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function hhmmssToMs(str) {
  const parts = (str || '').split(':').map(Number);
  if (parts.length === 3) return ((parts[0] * 3600) + (parts[1] * 60) + parts[2]) * 1000;
  if (parts.length === 2) return ((parts[0] * 60) + parts[1]) * 1000;
  return 0;
}

function esOnDiscChange(discId) {
  const d = S.materias.find(m => String(m.id) === String(discId));
  const sel = document.getElementById('es-ass');
  if (d && d.assuntos && d.assuntos.length) {
    sel.innerHTML = d.assuntos.map(a => `<option value="${a.nome}">${a.nome}</option>`).join('');
  } else {
    sel.innerHTML = '<option value="Geral">Geral</option>';
  }
}

function editSessao(id) {
  const numId = Number(id);
  const s = S.sessoes.find(x => Number(x.id) === numId);
  if (!s) { Toast.show('Sessão não encontrada.', 'error'); return; }

  _editSessaoId = numId;

  // Populate matéria select
  const discSel = document.getElementById('es-disc');
  discSel.innerHTML = S.materias.length
    ? S.materias.map(m => `<option value="${m.id}">${m.nome}</option>`).join('')
    : '<option value="">Nenhuma matéria</option>';
  discSel.value = String(s.discId);

  // Populate assunto select for the current matéria
  esOnDiscChange(s.discId);
  const assSel = document.getElementById('es-ass');
  assSel.value = s.assunto;
  // If assunto not found in list (matéria excluída), add it as option
  if (assSel.value !== s.assunto) {
    const opt = document.createElement('option');
    opt.value = s.assunto; opt.textContent = s.assunto;
    assSel.prepend(opt);
    assSel.value = s.assunto;
  }

  document.getElementById('es-q').value     = s.q || 0;
  document.getElementById('es-a').value     = s.a || 0;
  document.getElementById('es-tempo').value = msToHHMMSS(s.tempo || 0);

  document.getElementById('edit-sess-overlay').classList.add('show');
}

function closeEditSessao() {
  document.getElementById('edit-sess-overlay').classList.remove('show');
  _editSessaoId = null;
}

async function saveEditSessao() {
  if (_editSessaoId === null) return;
  const s = S.sessoes.find(x => Number(x.id) === _editSessaoId);
  if (!s) { Toast.show('Sessão não encontrada.', 'error'); closeEditSessao(); return; }

  const novoDiscId  = parseInt(document.getElementById('es-disc').value);
  const novoAssunto = document.getElementById('es-ass').value.trim();
  const novoQ       = parseInt(document.getElementById('es-q').value)     || 0;
  const novoA       = parseInt(document.getElementById('es-a').value)     || 0;
  const novoTempo   = hhmmssToMs(document.getElementById('es-tempo').value);

  if (novoA > novoQ && novoQ > 0) { Toast.show('Acertos não pode ser maior que questões.', 'error'); return; }

  s.discId  = novoDiscId  || s.discId;
  s.assunto = novoAssunto || s.assunto;
  s.q       = novoQ;
  s.a       = novoA;
  s.tempo   = novoTempo   || s.tempo;

  try {
    await DB.sessoes.put(s);
    closeEditSessao();
    renderHistorico();
    Toast.show('Sessão atualizada!', 'success');
  } catch (err) {
    Toast.show('Erro ao salvar. Tente novamente.', 'error');
    console.error('saveEditSessao:', err);
  }
}

async function delSessao(id) {
  const { ok } = await Modal.show({ title: 'Excluir sessão?', message: 'Esta ação não pode ser desfeita.', confirmText: 'Excluir', danger: true });
  if (!ok) return;
  S.sessoes = S.sessoes.filter(x => x.id !== id);
  await DB.sessoes.delete(id);
  renderHistorico();
  Toast.show('Sessão removida.');
}

/* ===== DARK MODE ===== */
async function toggleDark() {
  S.darkMode = !S.darkMode;
  document.documentElement.classList.toggle('dark', S.darkMode);
  document.getElementById('dark-icon').className = S.darkMode ? 'fas fa-sun' : 'fas fa-moon';
  await DB.config.set('darkMode', S.darkMode);
}

/* ===== EXPORT / IMPORT ===== */
async function exportar() {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${now.getHours()}h${String(now.getMinutes()).padStart(2,'0')}`;
  const payload = JSON.stringify({ version: 2, exportDate: now.toISOString(), materias: S.materias, sessoes: S.sessoes, metaHoras: S.metaHoras });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  a.download = `backup_concurseiro_${stamp}.json`;
  a.click();
  Toast.show('Backup exportado!', 'success');
}

function importar() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
  inp.onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const text = await file.text();
      const d    = JSON.parse(text);
      const mats = d.materias || d.e || [];
      const sess = d.sessoes  || d.q || [];
      const meta = d.metaHoras || d.m || 20;
      await DB.materias.clear();
      await DB.sessoes.clear();
      for (const m of mats) await DB.materias.put(m);
      for (const s of sess) { const { id, ...rest } = s; await DB.sessoes.add(rest); }
      await DB.config.set('metaHoras', meta);
      S.materias  = await DB.materias.getAll();
      S.sessoes   = await DB.sessoes.getAll();
      S.metaHoras = meta;
      Toast.show('Backup importado com sucesso!', 'success');
      nav('dashboard');
    } catch (_) { Toast.show('Erro ao importar arquivo.', 'error'); }
  };
  inp.click();
}

async function zerarTudo() {
  const { ok } = await Modal.show({ title: 'Apagar tudo?', message: 'Todos os seus dados (matérias, sessões, histórico) serão permanentemente apagados.', confirmText: 'Apagar tudo', danger: true });
  if (!ok) return;
  await DB.materias.clear();
  await DB.sessoes.clear();
  await DB.config.set('metaHoras', 20);
  S.materias = []; S.sessoes = []; S.metaHoras = 20;
  Toast.show('Dados apagados.');
  nav('dashboard');
}

/* ===== PWA INSTALL ===== */
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); S.pwaPrompt = e;
  document.getElementById('install-hint').style.display = 'block';
});
window.addEventListener('appinstalled', () => {
  document.getElementById('install-hint').style.display = 'none';
  S.pwaPrompt = null;
  Toast.show('App instalado! 🎉', 'success');
});

async function installApp() {
  if (!S.pwaPrompt) return;
  S.pwaPrompt.prompt();
  await S.pwaPrompt.userChoice;
  S.pwaPrompt = null;
}

/* ===== INIT ===== */
async function init() {
  await DB.migrate();
  S.materias  = await DB.materias.getAll();
  S.sessoes   = await DB.sessoes.getAll();
  S.metaHoras = (await DB.config.get('metaHoras')) || 20;
  S.darkMode  = (await DB.config.get('darkMode'))  || false;
  S.sessaoDisc = await DB.config.get('sessaoDisc') || null;
  S.sessaoAss  = await DB.config.get('sessaoAss')  || null;

  if (S.darkMode) {
    document.documentElement.classList.add('dark');
    document.getElementById('dark-icon').className = 'fas fa-sun';
  }

  if ('serviceWorker' in navigator)
    navigator.serviceWorker.register('./sw.js').catch(() => {});

  nav('dashboard');
}

document.addEventListener('DOMContentLoaded', init);
