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

/* sigla de 3 letras do mapa, pro chip compacto */
const SIGLAS = {
  'mirage':'MIR', 'inferno':'INF', 'nuke':'NUK', 'ancient':'ANC', 'anubis':'ANU',
  'overpass':'OVP', 'vertigo':'VTG', 'train':'TRN', 'cache':'CCH', 'office':'OFF',
  'italy':'ITA', 'cobblestone':'CBL', 'dust ii':'DU2', 'dust2':'DU2', 'dust 2':'DU2',
};
function sigla(nome){
  const k = String(nome||'').trim().toLowerCase();
  if (SIGLAS[k]) return SIGLAS[k];
  const limpo = k.replace(/[^a-z0-9]/g,'');
  return (limpo.slice(0,3) || '?').toUpperCase();
}
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

/** elenco oficial do time, na ordem e com os totais gravados no site original */
function elenco(tid){
  return D.jogadores
    .filter(j=>j.time===tid && j.elenco != null && j.total)
    .sort((x,y)=>x.elenco-y.elenco)
    .map(j=>({...j, ...j.total}));
}

/* ---------- topo e confronto ---------- */
function renderTopo(){
  document.getElementById('brandLogo').src = D.liga.logo || 'assets/liga.png';
  document.getElementById('comp').textContent = D.comp || D.liga.nome;

  [['A','canada'],['B','sm']].forEach(([letra,tid])=>{
    const t = timeDe(tid);
    const el = document.getElementById('logo'+letra);
    if (t.logo) el.style.backgroundImage = `url('${t.logo}')`;
    document.getElementById('name'+letra).textContent  = t.nome;
    document.getElementById('score'+letra).textContent = t.placar;
    document.getElementById('stTitle'+letra).textContent = t.nome;
  });
}

/* ---------- semanas ---------- */
function renderWeeks(){
  const box = document.getElementById('weeks');
  box.innerHTML = D.partidas.map(p=>{
    // os mapas da semana ficam lado a lado, em chip compacto com a sigla do mapa
    const maps = p.mapas.map((m,i)=>`
      <button class="mp" onclick="openMapModal(${p.semana},${i})"
              title="${esc(m.mapa)} ${m.rounds_canada}x${m.rounds_sm} · ver stats do mapa">
        <span class="mp-ab">${sigla(m.mapa)}</span>
        <span class="mp-sc">${m.rounds_canada}x${m.rounds_sm}</span>
      </button>`).join('');
    // semana com menos de 3 mapas mantem o espaco vazio, como no original
    const vazios = Array.from({length: p.mapas_vazios||0}, ()=>`
      <span class="mp vazio"><span class="mp-ab">-</span><span class="mp-sc">-</span></span>`).join('');
    return `<div class="week"><div class="bar"></div><div class="body">
        <div class="wk-name">${esc(p.nome)}</div>
        <div class="wk-score">${esc(p.serie||'')}</div>
        <div class="maps"><span class="maps-lbl">Mapas</span>
          <div class="mp-row">${maps}${vazios}</div></div>
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
  // mesma base do original: o elenco oficial com os totais gravados
  const todos = D.jogadores.filter(j=>j.elenco != null && j.total).map(j=>({j, p:j.total}));
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

/* ============================================================
   Blocos novos: MVP da semana, faixa semana a semana e ranking.
   Usam metrica por round (o placar do mapa diz quantos rounds teve),
   diferente do MVP da serie, que segue a conta do site original.
   ============================================================ */

const CORTE = 0.30;   // so entra no ranking quem jogou 30% dos rounds da season

function roundsDoMapa(m){ return m.rounds_canada + m.rounds_sm; }
function roundsDaSeason(){
  return D.partidas.reduce((s,p)=>s+p.mapas.reduce((x,m)=>x+roundsDoMapa(m),0),0);
}
function minRounds(){ return Math.max(30, Math.round(roundsDaSeason()*CORTE)); }

/** totais de um jogador, opcionalmente so de uma semana, ja com rounds */
function totalComRounds(id, semana){
  const t = {k:0,a:0,d:0,rounds:0,mapas:0};
  D.partidas.forEach(p=>{
    if (semana != null && p.semana !== semana) return;
    p.mapas.forEach(m=>{
      const l = m.stats.find(s=>s.jogador===id);
      if (!l) return;
      t.k+=l.k; t.a+=l.a; t.d+=l.d; t.rounds+=roundsDoMapa(m); t.mapas++;
    });
  });
  const r = Math.max(t.rounds,1);
  t.kpr=t.k/r; t.dpr=t.d/r; t.apr=t.a/r; t.spr=(r-t.d)/r;
  t.kd = t.d>0 ? t.k/t.d : t.k;
  return t;
}

/** medias da liga entre quem bateu o corte, pra ancorar o Rating KND em 1.00 */
let _medias = null;
function medias(){
  if (_medias) return _medias;
  const aptos = D.jogadores.map(j=>totalComRounds(j.id)).filter(t=>t.rounds>=minRounds());
  const m = k => aptos.reduce((s,t)=>s+t[k],0)/Math.max(aptos.length,1);
  _medias = {kpr:m('kpr')||1, spr:m('spr')||1, apr:m('apr')||1};
  return _medias;
}

/** Rating KND: 1.00 = jogador medio da liga */
function ratingKND(t){
  const md = medias();
  return 0.55*(t.kpr/md.kpr) + 0.30*(t.spr/md.spr) + 0.15*(t.apr/md.apr);
}

/** melhores de uma semana (ou da season, sem argumento) */
function melhores(semana){
  return D.jogadores.map(j=>{
    const t = totalComRounds(j.id, semana);
    if (!t.mapas) return null;
    return {j, t, r: ratingKND(t)};
  }).filter(Boolean).sort((x,y)=>y.r-x.r);
}

function avatarDe(j){
  return j.foto ? `<img class="av" src="${esc(j.foto)}" alt="">`
                : `<div class="av">${esc(initials(j.nome))}</div>`;
}

function renderMVPSemana(){
  const semanas = D.partidas.filter(p=>p.mapas.length);
  if (!semanas.length) return;
  const ultima = semanas[semanas.length-1];
  const lista = melhores(ultima.semana);
  const c = lista[0], j = c.j;

  document.getElementById('mvpWeekHint').textContent = ultima.nome;
  document.getElementById('mvpWeek').innerHTML =
    `<div class="mvpweek ${j.time==='sm'?'b':'a'}">
       ${j.foto ? `<div class="foto" style="background-image:url('${esc(j.foto)}')"></div>`
                : `<div class="foto">${esc(initials(j.nome))}</div>`}
       <div>
         <span class="badge">✦ MVP</span>
         <div class="nome">${esc(j.nome)}</div>
         <div class="sub">${esc(timeDe(j.time).nome)} · ${c.t.mapas} mapas na semana</div>
         <div class="boxes">
           <div class="box"><div class="v">${f2(c.r)}</div><div class="k">Rating</div></div>
           <div class="box"><div class="v">${c.t.k}</div><div class="k">Kills</div></div>
           <div class="box"><div class="v">${f2(c.t.kd)}</div><div class="k">K/D</div></div>
           <div class="box"><div class="v">${f2(c.t.kpr)}</div><div class="k">K/round</div></div>
         </div>
         <div class="atras">Logo atrás: ${
           lista.slice(1,3).map(x=>`${esc(x.j.nome)} (${f2(x.r)})`).join(', ')}</div>
       </div>
     </div>`;
}

function renderStrip(){
  document.getElementById('mvpStrip').innerHTML =
    D.partidas.filter(p=>p.mapas.length).map(p=>{
      const c = melhores(p.semana)[0];
      return `<div class="mvp-chip">${avatarDe(c.j)}
        <div><div class="wk">${esc(p.nome)}</div><div class="nm">${esc(c.j.nome)}</div></div>
        <span class="rt">${f2(c.r)}</span></div>`;
    }).join('');
}

function renderRanking(){
  const corte = minRounds();
  const linhas = melhores().filter(c=>c.t.rounds>=corte).map((c,i)=>`
    <tr><td class="pos">${i+1}</td>
      <td><div class="ply"><span class="tag ${c.j.time==='sm'?'b':'a'}"></span>
        ${avatarDe(c.j)}<span class="nm">${esc(c.j.nome)}</span></div></td>
      <td class="forte">${f2(c.r)}</td>
      <td>${f2(c.t.kd)}</td>
      <td>${f2(c.t.kpr)}</td>
      <td>${Math.round(c.t.spr*100)}%</td>
      <td class="dim">${c.t.k}</td>
      <td class="dim">${c.t.mapas}</td></tr>`).join('');
  document.getElementById('ranking').innerHTML =
    `<table><thead><tr><th></th><th>Jogador</th><th>Rating</th><th>K/D</th>
      <th>K/round</th><th>Sobrevida</th><th>Kills</th><th>Mapas</th></tr></thead>
      <tbody>${linhas}</tbody></table>`;
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
    document.getElementById('statsLabel').textContent = D.statsLabel || '';
    renderTopo();
    renderWeeks();
    renderStats('A','canada');
    renderStats('B','sm');
    renderMVPSemana();
    renderStrip();
    renderRanking();
    renderMVP();
    renderSponsor();
  })
  .catch(()=>{
    document.querySelector('.wrap').insertAdjacentHTML('beforeend',
      '<p style="color:#8a93a3;text-align:center;padding:40px 0">Não consegui carregar os dados.</p>');
  });
