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
function irJogador(id){ location.hash = '#/jogador/' + id; }

/** troca a logo do topo. Na ficha do jogador entra a do time dele. */
function marcaDoTopo(tid){
  const img  = document.getElementById('brandLogo');
  const link = document.getElementById('brandLink');
  const t = tid ? timeDe(tid) : null;
  if (t && t.logo){
    img.src = t.logo;
    img.alt = t.nome;
    img.classList.add('logo-time');
    link.href = '#/time/' + tid;
  } else {
    img.src = (D && D.liga.logo) || 'assets/liga.png';
    img.alt = (D && D.liga.nome) || 'KND League';
    img.classList.remove('logo-time');
    link.href = '#/';
  }
}

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
    // logo e nome levam pra pagina do time
    el.onclick = () => location.hash = '#/time/' + tid;
    el.title = 'ver a página do ' + t.nome;
    const nm = document.getElementById('name'+letra);
    nm.onclick = el.onclick;
    nm.classList.add('clicavel');
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
    <tr class="link" onclick="irJogador('${p.id}')"><td class="name">${esc(p.nome)}</td>
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
         <span class="mvp-name link" onclick="irJogador('${mvp.j.id}')">${esc(mvp.j.nome)}</span>
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
         <div class="nome link" onclick="irJogador('${j.id}')">${esc(j.nome)}</div>
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
      return `<div class="mvp-chip link" onclick="irJogador('${c.j.id}')">${avatarDe(c.j)}
        <div><div class="wk">${esc(p.nome)}</div><div class="nm">${esc(c.j.nome)}</div></div>
        <span class="rt">${f2(c.r)}</span></div>`;
    }).join('');
}

/* ============================================================
   Comparativo: o melhor de cada time, lado a lado
   ============================================================ */

/** melhor jogador de um time por Rating KND, entre quem bateu o corte */
function melhorDoTime(tid){
  const corte = minRounds();
  return melhores().find(c => c.j.time === tid && c.t.rounds >= corte) || null;
}

/** nos mapas em que os dois jogaram, quem foi melhor mais vezes */
function confrontoDireto(idA, idB){
  const la = linhasDoJogador(idA), lb = linhasDoJogador(idB);
  const porMapa = l => l.semana + '|' + l.mapa;
  const mapaB = new Map(lb.map(l=>[porMapa(l), l]));
  let a=0, b=0, juntos=0;
  la.forEach(x=>{
    const y = mapaB.get(porMapa(x));
    if (!y) return;
    juntos++;
    const ra = ratingDaLinha(x), rb = ratingDaLinha(y);
    if (ra > rb) a++; else if (rb > ra) b++;
  });
  return {juntos, a, b};
}

function renderDuelo(){
  const A = melhorDoTime('canada'), B = melhorDoTime('sm');
  const box = document.getElementById('duelo');
  if (!A || !B){ box.innerHTML = ''; return; }

  document.getElementById('duelHint').textContent =
    `${A.j.nome} contra ${B.j.nome}, os melhores rating de cada lado`;

  const LINHAS = [
    {k:'Rating',        a:A.r,       b:B.r,       fmt:f2},
    {k:'K/D',           a:A.t.kd,    b:B.t.kd,    fmt:f2},
    {k:'Kills',         a:A.t.k,     b:B.t.k,     fmt:v=>Math.round(v)},
    {k:'Kills/round',   a:A.t.kpr,   b:B.t.kpr,   fmt:f2},
    {k:'Sobrevida',     a:A.t.spr,   b:B.t.spr,   fmt:v=>Math.round(v*100)+'%'},
    {k:'Assist/round',  a:A.t.apr,   b:B.t.apr,   fmt:f2},
  ];

  const linhas = LINHAS.map(l=>{
    const tot = l.a + l.b;
    const pa = tot > 0 ? l.a/tot*100 : 50;
    const venceA = l.a > l.b, venceB = l.b > l.a;
    return `<div class="du-linha">
      <span class="du-val esq ${venceA?'vence a':''}">${l.fmt(l.a)}</span>
      <span class="du-meio">
        <span class="du-barra">
          <i class="a" style="width:${pa.toFixed(1)}%"></i>
          <i class="b" style="width:${(100-pa).toFixed(1)}%"></i>
        </span>
        <span class="du-k">${l.k}</span>
      </span>
      <span class="du-val dir ${venceB?'vence b':''}">${l.fmt(l.b)}</span>
    </div>`;
  }).join('');

  const h2h = confrontoDireto(A.j.id, B.j.id);
  const rodape = h2h.juntos
    ? `Nos <b>${h2h.juntos} mapas</b> em que se enfrentaram,
       <b class="a">${esc(A.j.nome)}</b> foi melhor em <b>${h2h.a}</b> e
       <b class="b">${esc(B.j.nome)}</b> em <b>${h2h.b}</b>${
         h2h.juntos - h2h.a - h2h.b ? `, com ${h2h.juntos-h2h.a-h2h.b} empate(s)` : ''}.`
    : '';

  const cabeca = (c, lado) => `
    <div class="du-cara ${lado}" onclick="irJogador('${c.j.id}')">
      ${c.j.foto ? `<img src="${esc(c.j.foto)}" alt="">`
                 : `<div class="semfoto ${lado}">${esc(initials(c.j.nome))}</div>`}
      <div class="du-info">
        <div class="du-nome">${esc(c.j.nome)}</div>
        <div class="du-time">${esc(timeDe(c.j.time).nome)}</div>
      </div>
    </div>`;

  box.innerHTML = `<div class="duelo">
      <div class="du-topo">
        ${cabeca(A,'a')}
        <div class="du-vs">VS</div>
        ${cabeca(B,'b')}
      </div>
      <div class="du-linhas">${linhas}</div>
      ${rodape ? `<div class="du-rodape">${rodape}</div>` : ''}
    </div>`;
}

function renderRanking(){
  const corte = minRounds();
  const linhas = melhores().filter(c=>c.t.rounds>=corte).map((c,i)=>`
    <tr class="link" onclick="irJogador('${c.j.id}')"><td class="pos">${i+1}</td>
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

/* ============================================================
   Pagina do time: abre ao clicar na logo, em #/time/{id}
   ============================================================ */

/** retrospecto do time por mapa, com rounds a favor e contra */
function mapasDoTime(tid){
  const M = {};
  D.partidas.forEach(p=>p.mapas.forEach(m=>{
    const e = M[m.mapa] || (M[m.mapa] = {v:0, e:0, d:0, n:0, rp:0, rc:0});
    const meu  = tid==='canada' ? m.rounds_canada : m.rounds_sm;
    const dele = tid==='canada' ? m.rounds_sm : m.rounds_canada;
    e.n++; e.rp += meu; e.rc += dele;
    if (meu > dele) e.v++; else if (dele > meu) e.d++; else e.e++;
  }));
  // ordena pelo mesmo aproveitamento que aparece na tela (empate vale meio ponto)
  const aprov = e => e.n ? (e.v + e.e*0.5) / e.n : 0;
  return Object.entries(M).sort((x,y)=>
    aprov(y[1]) - aprov(x[1]) || y[1].n - x[1].n);
}

function renderTime(tid){
  const t = timeDe(tid);
  if (!t.id){ location.hash = '#/'; return; }
  const cor = tid==='canada' ? 'var(--a)' : 'var(--b)';
  const classe = tid==='canada' ? 'a' : 'b';

  /* elenco em cards de foto */
  const cards = elenco(tid).map(j=>`
    <div class="rcard ${classe}" onclick="irJogador('${j.id}')" title="ver a ficha de ${esc(j.nome)}">
      ${j.foto ? `<img src="${esc(j.foto)}" alt="${esc(j.nome)}">`
               : `<span class="ini">${esc(initials(j.nome))}</span>`}
      <span class="nick">${esc(j.nome)}</span>
    </div>`).join('');

  /* map pool do time */
  const mapas = mapasDoTime(tid);
  const linhasMapa = mapas.map(([nome,e])=>{
    const aprov = e.n ? (e.v + e.e*0.5) / e.n : 0;
    const saldo = e.rp - e.rc;
    return `<div class="bar-row">
      <span class="lbl">${esc(nome)}</span>
      <span class="bar-wrap"><span class="bar-track">
        <i class="w" style="width:${(aprov*100).toFixed(1)}%;background:${cor}"></i></span></span>
      <span class="ap num">${Math.round(aprov*100)}%</span>
      <span class="rec num">${e.v}V ${e.e?e.e+'E ':''}${e.d}D</span>
      <span class="mp-n num">${e.rp}:${e.rc}
        <b style="color:${saldo>0?'var(--win)':(saldo<0?'var(--loss)':'var(--mut)')}">
          ${saldo>0?'+':''}${saldo}</b></span></div>`;
  }).join('');

  /* tabela de K/D do time */
  const linhasStats = elenco(tid).map(j=>`
    <tr class="link" onclick="irJogador('${j.id}')"><td class="name">${esc(j.nome)}</td>
      <td>${j.k}</td><td>${j.a}</td><td>${j.d}</td>
      <td class="der"><b>${f2(kd(j))}</b></td>
      <td class="der">${f2(kda(j))}</td></tr>`).join('');

  /* resumo de series e mapas */
  let sv=0, sd=0, mv=0, md=0, me=0;
  D.partidas.forEach(p=>{
    let meu=0, dele=0;
    p.mapas.forEach(m=>{
      const a = tid==='canada' ? m.rounds_canada : m.rounds_sm;
      const b = tid==='canada' ? m.rounds_sm : m.rounds_canada;
      if (a>b){ meu++; mv++; } else if (b>a){ dele++; md++; } else me++;
    });
    if (!p.mapas.length) return;
    if (meu>dele) sv++; else if (dele>meu) sd++;
  });

  document.getElementById('timePage').innerHTML = `
    <div class="back" onclick="location.hash='#/'">← voltar pro campeonato</div>

    <div class="team-hero ${classe}">
      <div class="team-logo" style="background-image:url('${esc(t.logo||'')}')"></div>
      <div class="team-nome" style="color:${cor}">${esc(t.nome)}</div>
      <div class="team-resumo">${sv}V ${sd}D em séries ·
        ${mv}V ${me?me+'E ':''}${md}D em mapas</div>
    </div>

    <div class="sec-label">Elenco</div>
    <div class="roster">${cards}</div>

    <div class="sec-label">Map pool
      <span class="hint">aproveitamento do ${esc(t.nome)} em cada mapa, com rounds a favor e contra</span></div>
    <div class="pool">${linhasMapa}</div>

    <div class="sec-label">Estatísticas</div>
    <div class="tpanel ${classe}"><h3>${esc(t.nome)}</h3>
      <table><thead><tr><th>Jogador</th><th>K</th><th>A</th><th>D</th>
        <th>K/D</th><th>KDA</th></tr></thead><tbody>${linhasStats}</tbody></table></div>`;
}

/* ============================================================
   Pagina do jogador: #/jogador/{id}
   ============================================================ */

/** linhas do jogador, mapa a mapa */
function linhasDoJogador(id){
  const out = [];
  D.partidas.forEach(p=>p.mapas.forEach(m=>{
    const l = m.stats.find(s=>s.jogador===id);
    if (!l) return;
    const meu  = l.time==='canada' ? m.rounds_canada : m.rounds_sm;
    const dele = l.time==='canada' ? m.rounds_sm : m.rounds_canada;
    out.push({semana:p.semana, nomeSemana:p.nome, mapa:m.mapa, rounds:meu+dele,
              placar:`${meu}x${dele}`, res: meu>dele?'w':(dele>meu?'l':'e'),
              k:l.k, a:l.a, d:l.d});
  }));
  return out;
}

/** rating de um mapa isolado, pra tabela e pra regularidade */
function ratingDaLinha(l){
  const r = Math.max(l.rounds,1);
  return ratingKND({kpr:l.k/r, spr:(r-l.d)/r, apr:l.a/r});
}

/** regularidade: quanto o rating dele oscila de mapa pra mapa */
function regularidade(linhas){
  if (linhas.length < 3) return null;
  const rs = linhas.map(ratingDaLinha);
  const mu = rs.reduce((a,b)=>a+b,0)/rs.length;
  if (mu <= 0) return null;
  const dp = Math.sqrt(rs.reduce((s,r)=>s+(r-mu)**2,0)/rs.length);
  return Math.max(0, Math.min(1, 1 - dp/mu));
}

function percentil(valor, lista){
  const abaixo = lista.filter(v=>v<valor).length;
  return lista.length>1 ? abaixo/(lista.length-1) : .5;
}

function radarSVG(eixos, cor){
  cor = cor || '#ffffff';
  const S=440, C=S/2, R=128, N=eixos.length;
  const ponto=(i,raio)=>{
    const ang = -Math.PI/2 + i*2*Math.PI/N;
    return [C+Math.cos(ang)*raio, C+Math.sin(ang)*raio];
  };
  let g='';
  [.25,.5,.75,1].forEach(f=>{
    g += `<polygon points="${eixos.map((_,i)=>ponto(i,R*f).map(n=>n.toFixed(1)).join(',')).join(' ')}"
           fill="none" stroke="#1e1e1e" stroke-width="1"/>`;
  });
  eixos.forEach((_,i)=>{
    const [x,y]=ponto(i,R);
    g += `<line x1="${C}" y1="${C}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"
           stroke="#171717" stroke-width="1"/>`;
  });
  g += `<polygon points="${eixos.map((e,i)=>ponto(i,R*Math.max(.06,e.p)).map(n=>n.toFixed(1)).join(',')).join(' ')}"
         fill="${cor}22" stroke="${cor}" stroke-width="2" stroke-linejoin="round"/>`;
  eixos.forEach((e,i)=>{
    const [x,y]=ponto(i,R*Math.max(.06,e.p));
    g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.4" fill="${cor}"/>`;
  });
  eixos.forEach((e,i)=>{
    const [x,y]=ponto(i,R+30);
    const anc = x<C-8 ? 'end' : (x>C+8 ? 'start' : 'middle');
    g += `<text x="${x.toFixed(1)}" y="${(y-3).toFixed(1)}" text-anchor="${anc}" font-size="16"
           font-weight="400" fill="#ffffff" font-family="Anton,sans-serif">${esc(e.v)}</text>
          <text x="${x.toFixed(1)}" y="${(y+12).toFixed(1)}" text-anchor="${anc}" font-size="9.5"
           fill="#5a5a5a" letter-spacing="1.4" font-weight="700"
           font-family="Inter,sans-serif">${esc(e.nome.toUpperCase())}</text>`;
  });
  return `<svg class="radar" viewBox="0 0 ${S} ${S}" role="img">${g}</svg>`;
}

function renderJogador(id){
  const j = D.jogadores.find(x=>x.id===id);
  if (!j){ location.hash = '#/'; return; }
  const t = totalComRounds(id);
  if (!t.mapas){ location.hash = '#/'; return; }

  const tm = timeDe(j.time);
  const cor = j.time==='canada' ? 'var(--a)' : 'var(--b)';
  const linhas = linhasDoJogador(id);
  const corte = minRounds();
  const aptos = melhores().filter(c=>c.t.rounds>=corte);
  const apto = t.rounds >= corte;
  const pos = aptos.findIndex(c=>c.j.id===id) + 1;
  const reg = regularidade(linhas);
  const r = ratingKND(t);

  const eixo = (nome, valor, ler) =>
    ({nome, v:valor, p: percentil(ler({t, r, reg}), aptos.map(c=>ler({
      t:c.t, r:c.r, reg:regularidade(linhasDoJogador(c.j.id))})))});
  const eixos = [
    eixo('Rating',    f2(r),                    x=>x.r),
    eixo('K/rnd',     f2(t.kpr),                x=>x.t.kpr),
    eixo('K/D',       f2(t.kd),                 x=>x.t.kd),
    eixo('Sobrevida', Math.round(t.spr*100)+'%',x=>x.t.spr),
    eixo('Assist',    f2(t.apr),                x=>x.t.apr),
  ];
  if (reg != null) eixos.push(eixo('Regular.', Math.round(reg*100)+'%', x=>x.reg||0));

  const ultimos = linhas.slice().reverse().map(l=>{
    const c = l.res==='w' ? 'var(--win)' : (l.res==='l' ? 'var(--loss)' : 'var(--draw)');
    return `<tr><td style="color:${c};font-weight:800">${l.placar}</td>
      <td>${esc(l.mapa)}</td>
      <td class="dim hide-sm">${esc(l.nomeSemana)}</td>
      <td>${l.k}-${l.d}</td><td class="hide-sm">${l.a}</td>
      <td class="der"><b>${f2(ratingDaLinha(l))}</b></td></tr>`;
  }).join('');

  document.getElementById('jogPage').innerHTML = `
    <div class="back" onclick="location.hash='#/time/${j.time}'">← voltar pro ${esc(tm.nome)}</div>

    <div class="pl-head">
      ${j.foto ? `<img class="pl-photo" src="${esc(j.foto)}" alt="">`
               : `<div class="pl-photo ${j.time==='canada'?'a':'b'}">${esc(initials(j.nome))}</div>`}
      <div class="pl-id">
        <div class="nm">${esc(j.nome)}</div>
        <div class="tm" style="color:${cor}" onclick="location.hash='#/time/${j.time}'">${esc(tm.nome)}</div>
        <div class="stats-row">
          <div class="stat"><div class="v">${f2(r)}</div><div class="k">Rating</div></div>
          <div class="stat"><div class="v">${apto?('#'+pos):'-'}</div><div class="k">na liga</div></div>
          <div class="stat"><div class="v">${f2(t.kd)}</div><div class="k">K/D</div></div>
          <div class="stat"><div class="v">${t.k}</div><div class="k">Kills</div></div>
          <div class="stat"><div class="v">${t.mapas}</div><div class="k">Mapas</div></div>
          <div class="stat"><div class="v">${t.rounds}</div><div class="k">Rounds</div></div>
        </div>
      </div>
    </div>

    <div class="sec-label">Perfil
      <span class="hint">a distância até a borda é a posição dele contra os outros da liga</span></div>
    <div class="radar-box">
      ${radarSVG(eixos, j.time==='canada' ? '#c3f53c' : '#38bdf8')}
      <div class="radar-legend">
        <p>O número em cada ponta é o valor real. A distância até a borda mostra o quanto
           ele está acima dos outros jogadores da liga.</p>
        <p><b>Rating KND</b> junta kills por round, sobrevivência e assistências.
           1.00 é exatamente a média da liga.</p>
        <p><b>Regularidade</b> é o quanto ele repete o mesmo nível mapa após mapa.
           Alto quer dizer que entrega sempre.</p>
        ${apto ? '' : `<p style="color:var(--draw)">Jogou menos de ${corte} rounds na season,
           então fica fora do ranking e a comparação perde peso.</p>`}
      </div>
    </div>

    <div class="sec-label">Mapa a mapa</div>
    <div class="tpanel"><table>
      <thead><tr><th>Placar</th><th>Mapa</th><th class="hide-sm">Rodada</th>
        <th>K-D</th><th class="hide-sm">A</th><th>Rating</th></tr></thead>
      <tbody>${ultimos}</tbody></table></div>`;
}

/* ---------- roteador ---------- */
function rota(){
  const [tela, arg] = location.hash.replace(/^#\/?/,'').split('/');
  const telas = {home:document.getElementById('home'),
                 time:document.getElementById('timePage'),
                 jogador:document.getElementById('jogPage')};
  const alvo = (tela==='time' || tela==='jogador') && arg ? tela : 'home';
  Object.entries(telas).forEach(([k,el])=>{ el.hidden = k !== alvo; });
  window.scrollTo(0,0);
  if (alvo==='time'){ renderTime(decodeURIComponent(arg)); marcaDoTopo(null); }
  else if (alvo==='jogador'){
    const id = decodeURIComponent(arg);
    renderJogador(id);
    const j = D.jogadores.find(x=>x.id===id);
    marcaDoTopo(j ? j.time : null);
  }
  else marcaDoTopo(null);
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
        return `<tr class="link" onclick="closeMapModal();irJogador('${j.id}')"><td class="name">${esc(j.nome)}</td>
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
    renderDuelo();
    renderRanking();
    renderMVP();
    renderSponsor();
    window.addEventListener('hashchange', rota);
    rota();
  })
  .catch(()=>{
    document.querySelector('.wrap').insertAdjacentHTML('beforeend',
      '<p style="color:#8a93a3;text-align:center;padding:40px 0">Não consegui carregar os dados.</p>');
  });
