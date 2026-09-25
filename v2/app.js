/* KND League - Season 1
   Recriacao da pagina original. Mesma estrutura e mesmas contas,
   so que lendo de data/season1.json em vez de localStorage. */

const ARQUIVO = 'data/season1.json';
let D = null;

/* ---------- contas ---------- */
const f2  = n => (Math.round(n*100)/100).toFixed(2);
const kd  = p => p.d > 0 ? p.k/p.d : p.k;
const kda = p => p.d > 0 ? (p.k+p.a)/p.d : (p.k+p.a);
const ratingOf = p => kd(p)*0.7 + kda(p)*0.3;

const esc = s => String(s==null?'':s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function initials(n){
  const p = String(n||'?').trim().split(/\s+/);
  return ((p[0][0]||'') + (p.length>1 ? (p[p.length-1][0]||'') : '')).toUpperCase();
}

function timeDe(id){ return D.times.find(t=>t.id===id) || {nome:id}; }
function jogadorDe(id){ return D.jogadores.find(j=>j.id===id) || {id, nome:id}; }

/** total acumulado de um jogador na season, somando os mapas */
function totalDoJogador(id){
  const t = {k:0, a:0, d:0, mapas:0};
  D.partidas.forEach(p=>p.mapas.forEach(m=>{
    const l = m.stats.find(s=>s.jogador===id);
    if (!l) return;
    t.k+=l.k; t.a+=l.a; t.d+=l.d; t.mapas++;
  }));
  return t;
}

/** elenco de um time com os totais, do maior pro menor em kills */
function elenco(tid){
  return D.jogadores.filter(j=>j.time===tid)
    .map(j=>({...j, ...totalDoJogador(j.id)}))
    .filter(j=>j.mapas > 0)
    .sort((x,y)=>y.k-x.k);
}

/* ---------- topo e confronto ---------- */
function renderTopo(){
  document.getElementById('brandLogo').src = D.liga.logo || 'assets/liga.png';
  document.getElementById('comp').innerHTML =
    esc(D.liga.nome) + `<span>Season ${D.season}</span>`;

  let sa = 0, sb = 0;
  D.partidas.forEach(p=>{
    let c=0, s=0;
    p.mapas.forEach(m=>{ if(m.vencedor==='canada')c++; else if(m.vencedor==='sm')s++; });
    if (!p.mapas.length) return;
    if (c>s) sa++; else if (s>c) sb++;
  });

  [['A','canada',sa],['B','sm',sb]].forEach(([letra,tid,pts])=>{
    const t = timeDe(tid);
    const el = document.getElementById('logo'+letra);
    if (t.logo) el.style.backgroundImage = `url('${t.logo}')`;
    document.getElementById('name'+letra).textContent  = t.nome;
    document.getElementById('score'+letra).textContent = pts;
    document.getElementById('stTitle'+letra).textContent = t.nome;
  });
}

/* ---------- semanas ---------- */
function renderWeeks(){
  const box = document.getElementById('weeks');
  box.innerHTML = D.partidas.filter(p=>p.mapas.length).map(p=>{
    let c=0, s=0;
    p.mapas.forEach(m=>{ if(m.vencedor==='canada')c++; else if(m.vencedor==='sm')s++; });
    const maps = p.mapas.map((m,i)=>`
      <div class="map" onclick="openMapModal(${p.semana},${i})" title="ver stats do mapa">
        <span class="mp-i">${i+1}</span>
        <span class="mp-name">${esc(m.mapa)}</span>
        <span class="mp-score">${m.rounds_canada}x${m.rounds_sm}</span>
      </div>`).join('');
    return `<div class="week"><div class="bar"></div><div class="body">
        <div class="wk-name">${esc(p.nome)}</div>
        <div class="wk-score">${c}x${s}</div>
        <div class="maps"><span class="maps-lbl">Mapas</span>${maps}</div>
      </div></div>`;
  }).join('');
}

/* ---------- tabelas de estatistica ---------- */
function renderStats(letra, tid){
  const rows = elenco(tid).map(p=>`
    <tr><td class="name">${esc(p.nome)}</td>
      <td>${p.k}</td><td>${p.a}</td><td>${p.d}</td>
      <td class="der"><b>${f2(kd(p))}</b></td>
      <td class="der">${f2(kda(p))}</td></tr>`).join('');
  document.getElementById('stats'+letra).innerHTML =
    `<table><thead><tr><th>Jogador</th><th>K</th><th>A</th><th>D</th>
      <th>K/D</th><th>KDA</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/* ---------- MVP da serie ---------- */
const MVP_ORDER = ['K','A','D','K/D','KDA','Rating'];

function renderMVP(){
  const box = document.getElementById('mvp');
  const todos = D.jogadores.map(j=>({j, p:totalDoJogador(j.id)})).filter(e=>e.p.mapas>0);
  if (!todos.length){ box.innerHTML = ''; return; }

  todos.forEach(e=>{
    e.m = {K:e.p.k, A:e.p.a, D:e.p.d, 'K/D':kd(e.p), KDA:kda(e.p), Rating:ratingOf(e.p)};
  });
  const mvp = todos.slice().sort((x,y)=> (y.m.Rating-x.m.Rating) || (y.p.k-x.p.k))[0];

  const avg = {};
  MVP_ORDER.forEach(k=> avg[k] = (todos.reduce((s,e)=>s+e.m[k],0)/todos.length) || 0.0001);

  const BASEp=46, CAPp=94, MINp=7;   // BASEp = altura da linha da media
  const isInt = k => (k==='K'||k==='A'||k==='D');
  const bars = MVP_ORDER.map(k=>{
    const v = mvp.m[k], ratio = avg[k]>0 ? v/avg[k] : 1;
    const h = Math.max(MINp, Math.min(CAPp, ratio*BASEp));
    return `<div class="mvp-bar${k==='Rating'?' hl':''}">
      <div class="val">${isInt(k) ? Math.round(v) : f2(v)}</div>
      <div class="col" style="height:${h.toFixed(1)}%"></div></div>`;
  }).join('');
  const labels = MVP_ORDER.map(k=>`<div class="mvp-lbl">${k}</div>`).join('');

  box.className = 'mvpcard ' + (mvp.j.time==='sm' ? 'b' : 'a');
  box.innerHTML =
    `<div class="mvp-top">
       <div class="mvp-title">
         <span class="mvp-dot"></span>
         <span class="mvp-name">${esc(mvp.j.nome)}</span>
         <span class="mvp-teaminline">${esc(timeDe(mvp.j.time).nome)}</span>
       </div>
       <div class="mvp-tag">✦ MVP DA SÉRIE</div>
     </div>
     <div class="mvp-body">
       ${mvp.j.foto
         ? `<div class="mvp-photo" style="background-image:url('${esc(mvp.j.foto)}')"></div>`
         : `<div class="mvp-photo"><span class="ini">${esc(initials(mvp.j.nome))}</span></div>`}
       <div class="mvp-chart">
         <div class="mvp-plot">
           <div class="mvp-avg" style="bottom:${BASEp}%"><span>Méd</span></div>
           <div class="mvp-bars">${bars}</div>
         </div>
         <div class="mvp-labels">${labels}</div>
       </div>
     </div>`;
}

/* ---------- patrocinador ---------- */
function renderSponsor(){
  const box = document.getElementById('sponsor');
  const label = document.getElementById('sponsorLabel');
  const sp = D.patrocinador || {};
  if (!sp.img){ box.style.display='none'; label.style.display='none'; return; }
  const inner = `<div class="sp-box" style="background-image:url('${esc(sp.img)}')"></div>`;
  box.innerHTML = sp.link
    ? `<a href="${esc(sp.link)}" target="_blank" rel="noopener">${inner}</a>`
    : inner;
}

/* ---------- modal de stats por mapa ---------- */
function openMapModal(semana, idx){
  const p = D.partidas.find(x=>x.semana===semana);
  const m = p.mapas[idx];

  const tabela = (letra, tid) => {
    const linhas = m.stats.filter(s=>s.time===tid)
      .slice().sort((x,y)=>y.k-x.k)
      .map(s=>{
        const j = jogadorDe(s.jogador);
        return `<tr><td class="name">${esc(j.nome)}</td>
          <td>${s.k}</td><td>${s.a}</td><td>${s.d}</td>
          <td class="der"><b>${f2(kd(s))}</b></td>
          <td class="der">${f2(kda(s))}</td></tr>`;
      }).join('');
    return `<div class="mm-team ${letra.toLowerCase()}"><h4>${esc(timeDe(tid).nome)}</h4>
      <table><thead><tr><th>Jogador</th><th>K</th><th>A</th><th>D</th>
        <th>K/D</th><th>KDA</th></tr></thead><tbody>${linhas}</tbody></table></div>`;
  };

  document.getElementById('mmPanel').innerHTML =
    `<div class="mm-head">
       <div class="mm-title">${esc(m.mapa)}
         <span class="mm-score">
           <span style="color:var(--a)">${m.rounds_canada}</span>
           <span style="color:var(--mut);font-weight:400">x</span>
           <span style="color:var(--b)">${m.rounds_sm}</span></span>
       </div>
       <span class="mm-close" onclick="closeMapModal()" title="fechar">✕</span>
     </div>
     <div class="mm-sub">${esc(p.nome)}</div>
     <div class="mm-grid">${tabela('A','canada')}${tabela('B','sm')}</div>`;
  document.getElementById('mapModal').hidden = false;
}
function closeMapModal(){ document.getElementById('mapModal').hidden = true; }
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeMapModal(); });

/* ---------- start ---------- */
fetch(ARQUIVO, {cache:'no-store'})
  .then(r=>r.json())
  .then(dados=>{
    D = dados;
    document.getElementById('statsLabel').textContent = 'Estatísticas da season';
    renderTopo();
    renderWeeks();
    renderStats('A','canada');
    renderStats('B','sm');
    renderMVP();
    renderSponsor();
  })
  .catch(()=>{
    document.querySelector('.wrap').insertAdjacentHTML('beforeend',
      '<p style="color:#8a93a3;text-align:center;padding:40px 0">Não consegui carregar os dados.</p>');
  });
