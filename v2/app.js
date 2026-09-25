/* KND League - motor de estatistica e telas
   Tudo aqui e derivado do JSON da season. Nada de numero digitado na mao. */

const SEASONS = ['season2', 'season1'];   // mais nova primeiro

/* Corte de participacao: so entra em ranking e radar quem jogou pelo menos 30% dos rounds
   da season. Acompanha o crescimento da season sozinho, em vez de numero fixo que
   deixaria o ranking vazio nas primeiras semanas. */
const CORTE = 0.30;
function minRounds(sea){
  const tot = sea.partidas.reduce((s,p)=>s+p.mapas.reduce((x,m)=>x+roundsDoMapa(m),0),0);
  return Math.max(30, Math.round(tot*CORTE));
}

const state = { seasons: [], atual: null };

/* ============ carregamento ============ */
async function boot(){
  for (const s of SEASONS){
    try{
      const r = await fetch(`data/${s}.json`, {cache:'no-store'});
      if (r.ok) state.seasons.push(await r.json());
    }catch(e){ /* season ainda nao existe, segue o jogo */ }
  }
  if (!state.seasons.length){
    document.getElementById('app').innerHTML =
      '<p class="dim" style="padding:60px 0;text-align:center">Nenhuma season encontrada.</p>';
    return;
  }
  state.atual = state.seasons[0];
  const sea = state.atual;
  document.getElementById('comp').innerHTML =
    esc(sea.liga.nome) + `<small>Season ${sea.season} · ${sea.encerrada?'encerrada':'em andamento'}</small>`;
  window.addEventListener('hashchange', rota);
  rota();
}

/* ============ calculo ============ */
const soma = (a,b)=>a+b;
const f2 = n => (Math.round(n*100)/100).toFixed(2);
const pct = n => Math.round(n*100) + '%';

function roundsDoMapa(m){ return m.rounds_canada + m.rounds_sm; }

/** linhas de um jogador, mapa a mapa */
function linhasDoJogador(sea, id, filtroSemana){
  const out = [];
  sea.partidas.forEach(p=>{
    if (filtroSemana != null && p.semana !== filtroSemana) return;
    p.mapas.forEach(m=>{
      const l = m.stats.find(s=>s.jogador===id);
      if (!l) return;
      const meu  = l.time==='canada' ? m.rounds_canada : m.rounds_sm;
      const dele = l.time==='canada' ? m.rounds_sm : m.rounds_canada;
      out.push({semana:p.semana, mapa:m.mapa, rounds:roundsDoMapa(m),
                placar:`${meu}x${dele}`,
                res: meu>dele ? 'w' : (dele>meu ? 'l' : 'e'),
                k:l.k, a:l.a, d:l.d, mvps:l.mvps, hs:l.hs, score:l.score});
    });
  });
  return out;
}

/** agregado bruto de um conjunto de linhas */
function agrega(linhas){
  const t = {maps:linhas.length, rounds:0, k:0, a:0, d:0, mvps:0, hsSoma:0, hsN:0, score:0};
  linhas.forEach(l=>{
    t.rounds+=l.rounds; t.k+=l.k; t.a+=l.a; t.d+=l.d;
    if (l.mvps!=null) t.mvps+=l.mvps;
    if (l.hs!=null){ t.hsSoma+=l.hs*l.rounds; t.hsN+=l.rounds; }
    if (l.score!=null) t.score+=l.score;
  });
  const r = Math.max(t.rounds,1);
  t.kpr=t.k/r; t.dpr=t.d/r; t.apr=t.a/r; t.spr=(r-t.d)/r; t.mvpr=t.mvps/r;
  t.kd  = t.d>0 ? t.k/t.d : t.k;
  t.kda = t.d>0 ? (t.k+t.a)/t.d : (t.k+t.a);
  t.hs  = t.hsN ? t.hsSoma/t.hsN : null;
  return t;
}

/** medias da liga, usadas pra normalizar o Rating em 1.00 */
function mediasDaLiga(sea){
  if (sea._medias) return sea._medias;
  const aptos = sea.jogadores.map(j=>agrega(linhasDoJogador(sea,j.id)))
                             .filter(t=>t.rounds>=minRounds(sea));
  const m = k => aptos.map(t=>t[k]).reduce(soma,0)/Math.max(aptos.length,1);
  sea._medias = {kpr:m('kpr')||1, spr:m('spr')||1, apr:m('apr')||1, mvpr:m('mvpr')||0};
  return sea._medias;
}

/** Rating KND: 1.00 = jogador medio da liga */
function rating(t, med){
  if (!med.mvpr)
    return 0.55*(t.kpr/med.kpr) + 0.30*(t.spr/med.spr) + 0.15*(t.apr/med.apr);
  return 0.48*(t.kpr/med.kpr) + 0.26*(t.spr/med.spr) + 0.12*(t.apr/med.apr)
       + 0.14*(t.mvpr/med.mvpr);
}

/** consistencia: quanto o rating dele oscila de mapa pra mapa */
function consistencia(linhas, med){
  if (linhas.length < 3) return null;
  const rs = linhas.map(l=>rating(agrega([l]), med));
  const mu = rs.reduce(soma,0)/rs.length;
  if (mu <= 0) return null;
  const dp = Math.sqrt(rs.map(r=>(r-mu)**2).reduce(soma,0)/rs.length);
  return Math.max(0, Math.min(1, 1 - dp/mu));
}

/** ficha completa de todos os jogadores da season */
function fichas(sea){
  if (sea._fichas) return sea._fichas;
  const med = mediasDaLiga(sea);
  sea._fichas = sea.jogadores.map(j=>{
    const linhas = linhasDoJogador(sea, j.id);
    const t = agrega(linhas);
    return {...j, t, linhas, rating: rating(t, med),
            cons: consistencia(linhas, med), apto: t.rounds >= minRounds(sea)};
  }).sort((a,b)=>b.rating-a.rating);
  return sea._fichas;
}

function percentil(valor, lista){
  const abaixo = lista.filter(v=>v<valor).length;
  return lista.length>1 ? abaixo/(lista.length-1) : .5;
}

/** retrospecto dos times: series, mapas, rounds */
function tabela(sea){
  const z = ()=>({series:0,serieL:0,serieE:0,mapas:0,mapaL:0,mapaE:0,rp:0,rc:0});
  const T = {canada:z(), sm:z()};
  sea.partidas.forEach(p=>{
    let c=0,s=0;
    p.mapas.forEach(m=>{
      T.canada.rp+=m.rounds_canada; T.canada.rc+=m.rounds_sm;
      T.sm.rp+=m.rounds_sm;         T.sm.rc+=m.rounds_canada;
      if (m.vencedor==='canada'){ c++; T.canada.mapas++; T.sm.mapaL++; }
      else if (m.vencedor==='sm'){ s++; T.sm.mapas++; T.canada.mapaL++; }
      else { T.canada.mapaE++; T.sm.mapaE++; }
    });
    if (!p.mapas.length) return;
    if (c>s){ T.canada.series++; T.sm.serieL++; }
    else if (s>c){ T.sm.series++; T.canada.serieL++; }
    else { T.canada.serieE++; T.sm.serieE++; }
  });
  return T;
}

/** aproveitamento por mapa */
function mapPool(sea){
  const M = {};
  sea.partidas.forEach(p=>p.mapas.forEach(m=>{
    const e = M[m.mapa] || (M[m.mapa]={v:0,d:0,e:0,n:0});
    e.n++;
    if (m.vencedor==='canada') e.v++; else if (m.vencedor==='sm') e.d++; else e.e++;
  }));
  return Object.entries(M).sort((a,b)=>b[1].n-a[1].n);
}

/** candidatos a MVP de uma semana (sem filtro = season inteira) */
function candidatos(sea, semana){
  const med = mediasDaLiga(sea);
  return sea.jogadores.map(j=>{
    const linhas = linhasDoJogador(sea, j.id, semana);
    if (!linhas.length) return null;
    const t = agrega(linhas);
    return {j, t, r: rating(t, med)};
  }).filter(Boolean).sort((a,b)=>b.r-a.r);
}

/** MVP de cada semana, da mais recente pra mais antiga */
function mvpsSemanais(sea){
  return sea.partidas.filter(p=>p.mapas.length)
    .map(p=>({partida:p, lista:candidatos(sea, p.semana)})).reverse();
}

/** MVP da season: melhor rating entre quem bateu o corte de participacao */
function mvpDaSeason(sea){
  const corte = minRounds(sea);
  const lista = candidatos(sea).filter(c=>c.t.rounds>=corte);
  if (!lista.length) return null;
  const trofeus = {};
  mvpsSemanais(sea).forEach(w=>{
    const id = w.lista[0] && w.lista[0].j.id;
    if (id) trofeus[id] = (trofeus[id]||0) + 1;
  });
  return {lista, semanas: trofeus[lista[0].j.id] || 0,
          totalSemanas: sea.partidas.filter(p=>p.mapas.length).length};
}

/* ============ helpers de tela ============ */
const esc = s => String(s==null?'':s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function time(sea, id){ return sea.times.find(t=>t.id===id) || {nome:id, cor:'#888'}; }
function lado(id){ return id==='canada' ? 'a' : 'b'; }
function abbr(n){
  const p = String(n||'?').trim().split(/\s+/);
  return ((p[0][0]||'') + (p.length>1 ? (p[p.length-1][0]||'') : '')).toUpperCase();
}
function avatar(j, cls='av'){
  return j.foto ? `<img class="${cls}" src="${esc(j.foto)}" alt="">`
                : `<div class="${cls}">${esc(abbr(j.nome))}</div>`;
}
function chipJogador(j){
  return `<div class="ply"><span class="tag ${lado(j.time)}"></span>${avatar(j)}
          <span class="nm">${esc(j.nome)}</span></div>`;
}

/* ============ card de MVP (barras, igual ao original) ============ */
const MVP_ORDER = [
  {k:'K',         get:c=>c.t.k,   fmt:v=>Math.round(v)},
  {k:'A',         get:c=>c.t.a,   fmt:v=>Math.round(v)},
  {k:'K/D',       get:c=>c.t.kd,  fmt:f2},
  {k:'KDA',       get:c=>c.t.kda, fmt:f2},
  {k:'Sobrevida', get:c=>c.t.spr, fmt:pct},
  {k:'Rating',    get:c=>c.r,     fmt:f2},
];

function mvpCard(sea, lista, opts){
  if (!lista || !lista.length) return '';
  const mvp = lista[0], j = mvp.j, tm = time(sea, j.time);
  const BASE=46, CAP=94, MIN=7;   // BASE = altura da linha da media
  const bars = MVP_ORDER.map(m=>{
    const v = m.get(mvp);
    const media = lista.map(m.get).reduce(soma,0)/lista.length || 0.0001;
    const h = Math.max(MIN, Math.min(CAP, (media>0 ? v/media : 1)*BASE));
    return `<div class="mvp-bar${m.k==='Rating'?' hl':''}">
      <div class="val">${m.fmt(v)}</div>
      <div class="col" style="height:${h.toFixed(1)}%"></div></div>`;
  }).join('');
  const labels = MVP_ORDER.map(m=>`<div class="mvp-lbl">${m.k}</div>`).join('');
  const vice = lista.slice(1,3).map(c=>`${esc(c.j.nome)} (${f2(c.r)})`).join(', ');

  return `<div class="mvpcard ${lado(j.time)}${opts.season?' season':''}">
    <div class="mvp-top">
      <div class="mvp-title">
        <span class="mvp-dot"></span>
        <span class="mvp-name" onclick="location.hash='#/jogador/${j.id}'">${esc(j.nome)}</span>
        <span class="mvp-teaminline">${esc(tm.nome)}</span>
      </div>
      <div class="mvp-tag">${esc(opts.tag)}</div>
    </div>
    <div class="mvp-body">
      ${j.foto ? `<div class="mvp-photo" style="background-image:url('${esc(j.foto)}')"></div>`
               : `<div class="mvp-photo"><span class="ini">${esc(abbr(j.nome))}</span></div>`}
      <div class="mvp-chart">
        <div class="mvp-plot">
          <div class="mvp-avg" style="bottom:${BASE}%"><span>Méd</span></div>
          <div class="mvp-bars">${bars}</div>
        </div>
        <div class="mvp-labels">${labels}</div>
      </div>
    </div>
    <div class="mvp-foot">${opts.rodape||''}${vice?` Logo atrás: ${vice}.`:''}</div>
  </div>`;
}

/* ============ radar ============ */
function radarSVG(eixos){
  const S=440, C=S/2, R=128, N=eixos.length;
  const ponto=(i,raio)=>{
    const ang = -Math.PI/2 + i*2*Math.PI/N;
    return [C+Math.cos(ang)*raio, C+Math.sin(ang)*raio];
  };
  let g='';
  [.25,.5,.75,1].forEach(f=>{
    g += `<polygon points="${eixos.map((_,i)=>ponto(i,R*f).map(n=>n.toFixed(1)).join(',')).join(' ')}"
           fill="none" stroke="#2b3441" stroke-width="1"/>`;
  });
  eixos.forEach((_,i)=>{
    const [x,y]=ponto(i,R);
    g += `<line x1="${C}" y1="${C}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"
           stroke="#222a36" stroke-width="1"/>`;
  });
  g += `<polygon points="${eixos.map((e,i)=>ponto(i,R*Math.max(.06,e.p)).map(n=>n.toFixed(1)).join(',')).join(' ')}"
         fill="rgba(195,245,60,.16)" stroke="#c3f53c" stroke-width="2" stroke-linejoin="round"/>`;
  eixos.forEach((e,i)=>{
    const [x,y]=ponto(i,R*Math.max(.06,e.p));
    g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="#c3f53c"/>`;
  });
  eixos.forEach((e,i)=>{
    const [x,y]=ponto(i,R+30);
    const anc = x<C-8 ? 'end' : (x>C+8 ? 'start' : 'middle');
    g += `<text x="${x.toFixed(1)}" y="${(y-3).toFixed(1)}" text-anchor="${anc}" font-size="16"
           font-weight="800" fill="#eaf0f7" font-family="Segoe UI,sans-serif">${esc(e.v)}</text>
          <text x="${x.toFixed(1)}" y="${(y+12).toFixed(1)}" text-anchor="${anc}" font-size="9.5"
           fill="#5d6779" letter-spacing=".8" font-weight="700"
           font-family="Segoe UI,sans-serif">${esc(e.nome.toUpperCase())}</text>`;
  });
  return `<svg class="radar" viewBox="0 0 ${S} ${S}" role="img">${g}</svg>`;
}

/* ============ telas ============ */
function rota(){
  const [tela, arg] = location.hash.replace(/^#\/?/,'').split('/');
  window.scrollTo(0,0);
  if (tela==='jogador' && arg) telaJogador(decodeURIComponent(arg));
  else if (tela==='jogadores') telaJogadores();
  else if (tela==='partidas') telaPartidas();
  else telaHub();
}

function telaHub(){
  const sea = state.atual, T = tabela(sea), F = fichas(sea);
  const ca = time(sea,'canada'), sm = time(sea,'sm');
  const semanasJogadas = sea.partidas.filter(p=>p.mapas.length);

  /* confronto */
  const boxTime = (id, t) => {
    const tm = time(sea,id);
    return `<div class="team ${lado(id)}">
      <div class="logo" style="background-image:url('${esc(tm.logo||'')}')"></div>
      <div class="tname">${esc(tm.nome)}</div>
      <div class="rec">${t.mapas}-${t.mapaE?t.mapaE+'-':''}${t.mapaL} em mapas ·
        ${t.rp-t.rc>0?'+':''}${t.rp-t.rc} rounds</div>
    </div>`;
  };
  const match = `<div class="match">
      ${boxTime('canada',T.canada)}
      <div class="score">
        <div class="n a num">${T.canada.series}</div>
        <div class="x">&times;</div>
        <div class="n b num">${T.sm.series}</div>
      </div>
      ${boxTime('sm',T.sm)}
    </div>
    <div class="resumo">${semanasJogadas.length} semanas ·
      ${sea.partidas.reduce((s,p)=>s+p.mapas.length,0)} mapas ·
      ${T.canada.rp+T.canada.rc} rounds</div>`;

  /* semanas */
  const semanas = semanasJogadas.slice().reverse().map(p=>{
    let c=0,s=0; p.mapas.forEach(m=>{ if(m.vencedor==='canada')c++; else if(m.vencedor==='sm')s++; });
    const maps = p.mapas.map((m,i)=>{
      const r = m.vencedor==='canada' ? 'w' : (m.vencedor==='sm' ? 'l' : 'e');
      return `<div class="map" onclick="abrirMapa(${p.semana},${i})">
        <span class="dot ${r}"></span>
        <span class="mp-name">${esc(m.mapa)}</span>
        <span class="mp-score">${m.rounds_canada}x${m.rounds_sm}</span></div>`;
    }).join('');
    return `<div class="week"><div class="bar"></div><div class="body">
        <div class="wk-name">${esc(p.nome)}</div>
        <div class="wk-score"><span style="color:var(--a)">${c}</span>x<span style="color:var(--b)">${s}</span></div>
        <div class="maps"><span class="maps-lbl">Mapas</span>${maps}</div>
      </div></div>`;
  }).join('');

  /* MVPs */
  const porSemana = mvpsSemanais(sea);
  const ultima = porSemana[0];
  const season = mvpDaSeason(sea);

  const cardSemana = ultima ? `
    <div class="sec-label">MVP da semana <span class="hint">${esc(ultima.partida.nome)}</span></div>
    ${mvpCard(sea, ultima.lista, {tag:'✦ MVP DA SEMANA',
      rodape:'Barras comparadas com a média de quem jogou essa semana.'})}` : '';

  const cardSeason = season ? `
    <div class="sec-label">MVP da season
      <span class="hint">melhor rating entre quem jogou ${minRounds(sea)}+ rounds</span></div>
    ${mvpCard(sea, season.lista, {tag:'★ MVP DA SEASON', season:true,
      rodape:`<b>${esc(season.lista[0].j.nome)}</b> foi MVP em
              <b>${season.semanas} de ${season.totalSemanas}</b> semanas.`})}` : '';

  const strip = porSemana.length > 1 ? `
    <div class="sec-label">MVP semana a semana</div>
    <div class="mvp-strip">${porSemana.slice().reverse().map(w=>{
      const c = w.lista[0];
      return `<div class="mvp-chip" onclick="location.hash='#/jogador/${c.j.id}'">
        ${avatar(c.j)}
        <div><div class="wk">${esc(w.partida.nome)}</div><div class="nm">${esc(c.j.nome)}</div></div>
        <span class="rt">${f2(c.r)}</span></div>`;
    }).join('')}</div>` : '';

  /* estatisticas da season: dois paineis lado a lado, igual ao original */
  const painelTime = tid => {
    const tm = time(sea,tid);
    const rows = F.filter(f=>f.time===tid)
      // quem nao bateu o corte de participacao vai pro fim, senao lidera uma lista
      // ordenada por um rating que nem chega a ser mostrado
      .sort((a,b)=> (b.apto-a.apto) || (b.apto ? b.rating-a.rating : b.t.k-a.t.k))
      .map(f=>`
      <tr class="link" onclick="location.hash='#/jogador/${f.id}'">
        <td class="name">${esc(f.nome)}${f.apto?'':' <span class="dim" style="font-size:10.5px">(pouco jogo)</span>'}</td>
        <td class="num">${f.t.k}</td>
        <td class="num">${f.t.a}</td>
        <td class="num">${f.t.d}</td>
        <td class="strong">${f2(f.t.kd)}</td>
        <td class="dim">${f2(f.t.kda)}</td>
        <td class="strong">${f.apto?f2(f.rating):'<span class="dim">-</span>'}</td></tr>`).join('');
    return `<div class="tpanel ${lado(tid)}"><h3>${esc(tm.nome)}</h3>
      <table><thead><tr><th>Jogador</th><th>K</th><th>A</th><th>D</th>
        <th>K/D</th><th>KDA</th><th>Rating</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`;
  };
  const estatisticas = `
    <div class="sec-label">Estatísticas da season
      <span class="hint">acumulado dos ${sea.partidas.reduce((s,p)=>s+p.mapas.length,0)} mapas · clique num jogador pra abrir a ficha</span></div>
    <div class="panels">${painelTime('canada')}${painelTime('sm')}</div>`;

  /* ranking */
  const temHs = F.some(x=>x.t.hs!=null);
  const linhas = F.filter(f=>f.apto).map((f,i)=>`
    <tr class="link" onclick="location.hash='#/jogador/${f.id}'">
      <td class="dim num" style="width:22px">${i+1}</td>
      <td>${chipJogador(f)}</td>
      <td class="strong">${f2(f.rating)}</td>
      <td>${f2(f.t.kd)}</td>
      <td class="hide-sm">${f2(f.t.kpr)}</td>
      <td class="hide-sm">${pct(f.t.spr)}</td>
      ${temHs?`<td class="hide-sm">${f.t.hs!=null?Math.round(f.t.hs)+'%':'-'}</td>`:''}
      <td class="hide-sm dim num">${f.t.k}</td>
      <td class="dim num">${f.t.maps}</td></tr>`).join('');

  const ranking = `
    <div class="sec-label">Ranking da season
      <span class="hint">Rating KND: 1.00 é o jogador médio da liga</span></div>
    <div class="tpanel"><table>
      <thead><tr><th></th><th>Jogador</th><th>Rating</th><th>K/D</th>
        <th class="hide-sm">K/round</th><th class="hide-sm">Sobrevida</th>
        ${temHs?'<th class="hide-sm">HS</th>':''}
        <th class="hide-sm">Kills</th><th>Mapas</th></tr></thead>
      <tbody>${linhas}</tbody></table></div>`;

  /* map pool */
  const pool = mapPool(sea);
  const maxN = Math.max(...pool.map(([,e])=>e.n), 1);
  const poolHtml = pool.map(([nome,e])=>{
    const w = x => (x/e.n*100).toFixed(1)+'%';
    return `<div class="bar-row">
      <span class="lbl">${esc(nome)}</span>
      <span class="bar-wrap"><span class="bar-track" style="width:${(e.n/maxN*100).toFixed(1)}%">
        <i class="w" style="width:${w(e.v)}"></i>
        <i class="e" style="width:${w(e.e)}"></i>
        <i class="l" style="width:${w(e.d)}"></i></span></span>
      <span class="rec num">${e.v}V ${e.e?e.e+'E ':''}${e.d}D</span>
      <span class="mp-n num">${e.n} mapa${e.n>1?'s':''}</span></div>`;
  }).join('');

  const patro = sea.patrocinador && sea.patrocinador.img ? `
    <div class="sec-label">Patrocinador</div>
    ${sea.patrocinador.link
      ? `<a class="sponsor" href="${esc(sea.patrocinador.link)}" target="_blank" rel="noopener">
           <img src="${esc(sea.patrocinador.img)}" alt="Patrocinador"></a>`
      : `<div class="sponsor"><img src="${esc(sea.patrocinador.img)}" alt="Patrocinador"></div>`}` : '';

  /* ordem dos blocos: a mesma do site original (confronto > semanas > estatisticas > MVP >
     patrocinador). O que e novo entra depois do MVP, sem mexer no esqueleto. */
  document.getElementById('app').innerHTML =
    match +
    `<div class="sec-label">Semanas <span class="hint">clique num mapa pra ver o placar completo</span></div>
     <div class="weeks">${semanas}</div>` +
    estatisticas +
    cardSemana + cardSeason + strip + ranking +
    `<div class="sec-label">Map pool
       <span class="hint">verde = vitória do ${esc(ca.nome)}, azul = ${esc(sm.nome)}. Barra mais curta significa mapa menos jogado</span></div>
     <div class="pool">${poolHtml}</div>` +
    patro;
}

function telaJogadores(){
  const sea = state.atual, F = fichas(sea);
  const bloco = tid => {
    const tm = time(sea,tid);
    const rows = F.filter(f=>f.time===tid).map(f=>`
      <tr class="link" onclick="location.hash='#/jogador/${f.id}'">
        <td>${chipJogador(f)}</td>
        <td class="strong">${f.apto?f2(f.rating):'<span class="dim">-</span>'}</td>
        <td>${f2(f.t.kd)}</td>
        <td class="hide-sm">${f2(f.t.kpr)}</td>
        <td class="hide-sm dim num">${f.t.k}/${f.t.a}/${f.t.d}</td>
        <td class="dim num">${f.t.maps}</td></tr>`).join('');
    return `<div class="tpanel ${lado(tid)}"><h3>${esc(tm.nome)}</h3>
      <table><thead><tr><th>Jogador</th><th>Rating</th><th>K/D</th>
        <th class="hide-sm">K/round</th><th class="hide-sm">K/A/D</th><th>Mapas</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`;
  };
  document.getElementById('app').innerHTML =
    `<div class="sec-label">Jogadores <span class="hint">clique em alguém pra abrir a ficha</span></div>
     <div class="panels">${bloco('canada')}${bloco('sm')}</div>`;
}

function telaJogador(id){
  const sea = state.atual, F = fichas(sea);
  const f = F.find(x=>x.id===id);
  if (!f){ location.hash='#/jogadores'; return; }
  const t = f.t, tm = time(sea, f.time), med = mediasDaLiga(sea);
  const aptos = F.filter(x=>x.apto);

  const eixo = (nome, valor, chave) => ({nome, v:valor, p:percentil(chave(f), aptos.map(chave))});
  const eixos = [
    eixo('Rating',    f2(f.rating), x=>x.rating),
    eixo('K/rnd',     f2(t.kpr),    x=>x.t.kpr),
    eixo('K/D',       f2(t.kd),     x=>x.t.kd),
    eixo('Sobrevida', pct(t.spr),   x=>x.t.spr),
    eixo('Assist',    f2(t.apr),    x=>x.t.apr),
  ];
  if (f.cons!=null) eixos.push(eixo('Regular.', pct(f.cons), x=>x.cons||0));
  if (t.hs!=null)   eixos.push(eixo('HS', Math.round(t.hs)+'%', x=>x.t.hs||0));
  if (t.mvps>0)     eixos.push(eixo('MVP/rnd', f2(t.mvpr), x=>x.t.mvpr||0));

  const pos = aptos.findIndex(x=>x.id===f.id)+1;
  const ultimos = f.linhas.slice().reverse().slice(0,14).map(l=>{
    const cor = l.res==='w' ? 'var(--win)' : (l.res==='l' ? 'var(--loss)' : 'var(--draw)');
    return `<tr>
      <td style="color:${cor};font-weight:800">${l.placar}</td>
      <td>${esc(l.mapa)}</td>
      <td class="hide-sm dim">Semana ${l.semana}</td>
      <td class="num">${l.k}-${l.d}</td>
      <td class="hide-sm num">${l.a}</td>
      <td class="strong">${f2(rating(agrega([l]), med))}</td></tr>`;
  }).join('');

  document.getElementById('app').innerHTML = `
    <div class="back" onclick="location.hash='#/jogadores'">← todos os jogadores</div>
    <div class="pl-head">
      ${f.foto ? `<img class="pl-photo" src="${esc(f.foto)}" alt="">`
               : `<div class="pl-photo">${esc(abbr(f.nome))}</div>`}
      <div class="pl-id">
        <div class="nm">${esc(f.nome)}</div>
        <div class="tm" style="color:${tm.cor}">${esc(tm.nome)}</div>
        <div class="stats-row">
          <div class="stat"><div class="v">${f2(f.rating)}</div><div class="k">Rating</div></div>
          <div class="stat"><div class="v">${f.apto?('#'+pos):'-'}</div><div class="k">na liga</div></div>
          <div class="stat"><div class="v">${f2(t.kd)}</div><div class="k">K/D</div></div>
          <div class="stat"><div class="v">${t.k}</div><div class="k">Kills</div></div>
          <div class="stat"><div class="v">${t.maps}</div><div class="k">Mapas</div></div>
          <div class="stat"><div class="v">${t.rounds}</div><div class="k">Rounds</div></div>
        </div>
      </div>
    </div>

    <div class="sec-label">Perfil
      <span class="hint">a distância até a borda é a posição dele contra os outros da liga</span></div>
    <div class="radar-box">
      ${radarSVG(eixos)}
      <div class="radar-legend">
        <p>O número em cada ponta é o valor real. A distância até a borda mostra o quanto
           ele está acima dos outros jogadores da liga.</p>
        <p><b>Rating KND</b> combina kills por round, sobrevivência e assistências.
           1.00 é exatamente a média da liga${med.mvpr>0?', e o MVP de round entra na conta':''}.</p>
        <p><b>Regularidade</b> é o quanto ele repete o mesmo nível mapa após mapa.</p>
      </div>
    </div>

    <div class="sec-label">Últimos mapas</div>
    <div class="tpanel"><table>
      <thead><tr><th>Placar</th><th>Mapa</th><th class="hide-sm">Rodada</th>
        <th>K-D</th><th class="hide-sm">A</th><th>Rating</th></tr></thead>
      <tbody>${ultimos}</tbody></table></div>`;
}

function telaPartidas(){
  const sea = state.atual;
  const blocos = sea.partidas.filter(p=>p.mapas.length).slice().reverse().map(p=>{
    const mapas = p.mapas.map((m,i)=>{
      const cor = m.vencedor==='canada' ? 'var(--a)' : (m.vencedor==='sm' ? 'var(--b)' : 'var(--mut)');
      return `<tr class="link" onclick="abrirMapa(${p.semana},${i})">
        <td>${esc(m.mapa)}</td>
        <td class="strong" style="color:${cor}">${m.rounds_canada} : ${m.rounds_sm}</td>
        <td class="dim">${roundsDoMapa(m)} rounds</td></tr>`;
    }).join('');
    return `<div class="tpanel" style="margin-bottom:14px"><h3>${esc(p.nome)}</h3>
      <table><thead><tr><th>Mapa</th>
        <th>${esc(time(sea,'canada').nome)} : ${esc(time(sea,'sm').nome)}</th>
        <th>Duração</th></tr></thead><tbody>${mapas}</tbody></table></div>`;
  }).join('');
  document.getElementById('app').innerHTML =
    `<div class="sec-label">Partidas <span class="hint">clique num mapa pra ver o placar jogador a jogador</span></div>
     ${blocos}`;
}

/* ============ modal do mapa ============ */
function abrirMapa(semana, idx){
  const sea = state.atual;
  const p = sea.partidas.find(x=>x.semana===semana);
  const m = p.mapas[idx], med = mediasDaLiga(sea);
  const rounds = roundsDoMapa(m);
  const temMvp = m.stats.some(s=>s.mvps!=null), temHs = m.stats.some(s=>s.hs!=null);

  const painel = tid => {
    const tm = time(sea,tid);
    const rows = m.stats.filter(s=>s.time===tid).map(s=>{
        const j = sea.jogadores.find(x=>x.id===s.jogador) || {id:s.jogador, nome:s.jogador, time:tid};
        return {j, s, r: rating(agrega([{rounds, k:s.k, a:s.a, d:s.d,
                 mvps:s.mvps, hs:s.hs, score:s.score}]), med)};
      }).sort((a,b)=>b.r-a.r)
      .map(({j,s,r})=>`<tr class="link" onclick="fecharMapa();location.hash='#/jogador/${j.id}'">
        <td>${chipJogador(j)}</td>
        <td class="num">${s.k}</td><td class="num">${s.a}</td><td class="num">${s.d}</td>
        ${temMvp?`<td class="num">${s.mvps!=null?s.mvps:'-'}</td>`:''}
        ${temHs?`<td class="num dim">${s.hs!=null?s.hs+'%':'-'}</td>`:''}
        <td class="strong">${f2(r)}</td></tr>`).join('');
    return `<div><h4 style="color:${tm.cor}">${esc(tm.nome)}</h4>
      <table><thead><tr><th>Jogador</th><th>K</th><th>A</th><th>D</th>
        ${temMvp?'<th>★</th>':''}${temHs?'<th>HS</th>':''}<th>Rating</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`;
  };

  document.getElementById('modalPanel').innerHTML = `
    <div class="modal-h"><h3>${esc(m.mapa)}
      <span style="color:var(--a)">${m.rounds_canada}</span>
      <span style="color:var(--mut);font-weight:400"> : </span>
      <span style="color:var(--b)">${m.rounds_sm}</span></h3>
      <span class="modal-x" onclick="fecharMapa()">✕</span></div>
    <div class="modal-sub">${esc(p.nome)} · ${rounds} rounds</div>
    <div class="modal-grid">${painel('canada')}${painel('sm')}</div>`;
  document.getElementById('modal').hidden = false;
}
function fecharMapa(){ document.getElementById('modal').hidden = true; }
document.addEventListener('keydown', e=>{ if(e.key==='Escape') fecharMapa(); });

boot();
