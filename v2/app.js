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
      '<p class="dimmed" style="padding:60px 0">Nenhuma season encontrada.</p>';
    return;
  }
  state.atual = state.seasons[0];
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
      const meu = l.time==='canada' ? m.rounds_canada : m.rounds_sm;
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
  t.kpr=t.k/r; t.dpr=t.d/r; t.apr=t.a/r; t.spr=(r-t.d)/r;
  t.mvpr=t.mvps/r;
  t.kd = t.d>0 ? t.k/t.d : t.k;
  t.kda = t.d>0 ? (t.k+t.a)/t.d : (t.k+t.a);
  t.hs = t.hsN ? t.hsSoma/t.hsN : null;
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
  const temMvp = med.mvpr > 0 && t.mvpr >= 0;
  const base = 0.55*(t.kpr/med.kpr) + 0.30*(t.spr/med.spr) + 0.15*(t.apr/med.apr);
  if (!temMvp || !med.mvpr) return base;
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

/** MVP de cada semana */
function mvpsSemanais(sea){
  const med = mediasDaLiga(sea);
  return sea.partidas.filter(p=>p.mapas.length).map(p=>{
    const cand = sea.jogadores.map(j=>{
      const linhas = linhasDoJogador(sea, j.id, p.semana);
      if (!linhas.length) return null;
      const t = agrega(linhas);
      return {j, t, r: rating(t, med)};
    }).filter(Boolean).sort((a,b)=>b.r-a.r);
    return {partida:p, mvp:cand[0], top:cand.slice(0,3)};
  }).reverse();
}

/* ============ helpers de tela ============ */
const esc = s => String(s==null?'':s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function time(sea, id){ return sea.times.find(t=>t.id===id) || {nome:id, cor:'#888'}; }
function abbr(n){
  const p = String(n||'?').trim().split(/\s+/);
  return ((p[0][0]||'') + (p.length>1 ? (p[p.length-1][0]||'') : '')).toUpperCase();
}
function avatar(j, cls='av'){
  return j.foto
    ? `<img class="${cls}" src="${esc(j.foto)}" alt="${esc(j.nome)}">`
    : `<div class="${cls}">${esc(abbr(j.nome))}</div>`;
}
function chipJogador(sea, j){
  const t = j.time==='canada' ? 'ca' : 'sm';
  return `<div class="ply"><span class="tag ${t}"></span>${avatar(j)}
          <span class="nm">${esc(j.nome)}</span></div>`;
}

/* ============ radar ============ */
function radarSVG(eixos){
  const S=440, C=S/2, R=128, N=eixos.length;   // folga nas bordas pros rotulos nao cortarem
  const ponto=(i,raio)=>{
    const ang = -Math.PI/2 + i*2*Math.PI/N;
    return [C+Math.cos(ang)*raio, C+Math.sin(ang)*raio];
  };
  let g='';
  [.25,.5,.75,1].forEach(f=>{
    const pts = eixos.map((_,i)=>ponto(i,R*f).map(n=>n.toFixed(1)).join(',')).join(' ');
    g += `<polygon points="${pts}" fill="none" stroke="#242d3d" stroke-width="1"/>`;
  });
  eixos.forEach((_,i)=>{
    const [x,y]=ponto(i,R);
    g += `<line x1="${C}" y1="${C}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#1c2432" stroke-width="1"/>`;
  });
  const pts = eixos.map((e,i)=>ponto(i, R*Math.max(.06, e.p)).map(n=>n.toFixed(1)).join(',')).join(' ');
  g += `<polygon points="${pts}" fill="rgba(195,245,60,.16)" stroke="#c3f53c" stroke-width="2"
         stroke-linejoin="round"/>`;
  eixos.forEach((e,i)=>{
    const [x,y]=ponto(i, R*Math.max(.06, e.p));
    g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="#c3f53c"/>`;
  });
  eixos.forEach((e,i)=>{
    const [x,y]=ponto(i, R+30);
    const anc = x<C-8 ? 'end' : (x>C+8 ? 'start' : 'middle');
    g += `<text x="${x.toFixed(1)}" y="${(y-3).toFixed(1)}" text-anchor="${anc}"
           font-size="16" font-weight="700" fill="#eef3fa"
           font-family="Barlow Condensed,sans-serif">${esc(e.v)}</text>
          <text x="${x.toFixed(1)}" y="${(y+11).toFixed(1)}" text-anchor="${anc}"
           font-size="9.5" fill="#61708a" letter-spacing=".8"
           font-family="Inter,sans-serif">${esc(e.nome.toUpperCase())}</text>`;
  });
  return `<svg class="radar" viewBox="0 0 ${S} ${S}" role="img">${g}</svg>`;
}

/* ============ telas ============ */
function rota(){
  const h = location.hash.replace(/^#\/?/,'');
  const [tela, arg] = h.split('/');
  window.scrollTo(0,0);
  if (tela==='jogador' && arg) telaJogador(decodeURIComponent(arg));
  else if (tela==='jogadores') telaJogadores();
  else if (tela==='partidas') telaPartidas();
  else telaHub();
  document.querySelectorAll('.nav-links a').forEach(a=>{
    a.classList.toggle('on', a.getAttribute('href') === '#/' + (tela||''));
  });
}

function telaHub(){
  const sea = state.atual, T = tabela(sea), F = fichas(sea);
  const ca = time(sea,'canada'), sm = time(sea,'sm');
  const mvps = mvpsSemanais(sea);
  const totRounds = T.canada.rp + T.canada.rc;

  const hero = `
   <div class="hero"><div class="hero-in">
     <div class="hero-team ca">
       ${ca.logo?`<img src="${esc(ca.logo)}" alt="">`:''}
       <div class="tn">${esc(ca.nome)}</div>
       <div class="sub">${T.canada.series}V ${T.canada.serieL}D em séries</div>
     </div>
     <div class="hero-score">
       <span class="n ca num">${T.canada.series}</span>
       <span class="x">×</span>
       <span class="n sm num">${T.sm.series}</span>
     </div>
     <div class="hero-team sm">
       ${sm.logo?`<img src="${esc(sm.logo)}" alt="">`:''}
       <div class="tn">${esc(sm.nome)}</div>
       <div class="sub">${T.sm.series}V ${T.sm.serieL}D em séries</div>
     </div>
   </div>
   <div class="hero-label">Season ${sea.season} ${sea.encerrada?'encerrada':'em andamento'}
     · ${sea.partidas.filter(p=>p.mapas.length).length} semanas
     · ${sea.partidas.reduce((s,p)=>s+p.mapas.length,0)} mapas
     · ${totRounds} rounds</div>
   </div>`;

  const linhaTabela = (id,t)=>{
    const tm = time(sea,id);
    return `<tr><td><div class="ply"><span class="tag ${id==='canada'?'ca':'sm'}"></span>
        ${tm.logo?`<img class="av" src="${esc(tm.logo)}" alt="">`:''}
        <span class="nm">${esc(tm.nome)}</span></div></td>
      <td class="strong">${t.series}${t.serieE?'-'+t.serieE:''}-${t.serieL}</td>
      <td>${t.mapas}-${t.mapaE?t.mapaE+'-':''}${t.mapaL}</td>
      <td class="hide-sm dimmed">${t.rp}:${t.rc}</td>
      <td class="strong" style="color:${t.rp-t.rc>0?'var(--win)':(t.rp-t.rc<0?'var(--loss)':'var(--txt-2)')}">
        ${t.rp-t.rc>0?'+':''}${t.rp-t.rc}</td></tr>`;
  };

  const classificacao = `
   <div class="sec"><div class="sec-h"><h2>Classificação</h2>
     <span class="hint">séries, mapas e saldo de rounds</span></div>
     <div class="card pad"><table>
       <thead><tr><th>Time</th><th>Séries</th><th>Mapas</th>
         <th class="hide-sm">Rounds</th><th>Saldo</th></tr></thead>
       <tbody>${linhaTabela('canada',T.canada)}${linhaTabela('sm',T.sm)}</tbody>
     </table></div></div>`;

  const poolList = mapPool(sea);
  const maxN = Math.max(...poolList.map(([,e])=>e.n), 1);
  const mp = poolList.map(([nome,e])=>{
    const w = x => (x/e.n*100).toFixed(1)+'%';
    return `<div class="bar-row">
      <span class="lbl">${esc(nome)}</span>
      <span class="bar-wrap"><span class="bar-track" style="width:${(e.n/maxN*100).toFixed(1)}%">
        <i class="w" style="width:${w(e.v)}"></i>
        <i class="e" style="width:${w(e.e)}"></i>
        <i class="l" style="width:${w(e.d)}"></i></span></span>
      <span class="rec num" style="margin-left:auto">${e.v}V ${e.e?e.e+'E ':''}${e.d}D</span>
      <span class="dimmed num mp-n" style="width:62px;flex:none;text-align:right;font-size:11.5px">${e.n} mapa${e.n>1?'s':''}</span></div>`;
  }).join('');

  const mapPoolSec = `
   <div class="sec"><div class="sec-h"><h2>Map pool</h2>
     <span class="hint">verde = vitória do ${esc(ca.nome)}, azul = ${esc(sm.nome)}. Barra mais curta significa mapa menos jogado</span></div>
     <div class="card pad">${mp}</div></div>`;

  const top = F.filter(f=>f.apto).slice(0,12).map((f,i)=>`
    <tr class="link" onclick="location.hash='#/jogador/${f.id}'">
      <td class="dimmed num" style="width:26px">${i+1}</td>
      <td>${chipJogador(sea,f)}</td>
      <td class="strong">${f2(f.rating)}</td>
      <td>${f2(f.t.kd)}</td>
      <td class="hide-sm">${f2(f.t.kpr)}</td>
      <td class="hide-sm">${f2(f.t.dpr)}</td>
      <td class="hide-sm dimmed num">${f.t.k}</td>
      <td class="dimmed num">${f.t.maps}</td></tr>`).join('');

  const leaderboard = `
   <div class="sec"><div class="sec-h"><h2>Ranking</h2>
     <span class="hint">Rating KND: 1.00 é o jogador médio da liga. Entram os que jogaram ${minRounds(sea)}+ rounds</span></div>
     <div class="card pad"><table>
       <thead><tr><th></th><th>Jogador</th><th>Rating</th><th>K/D</th>
         <th class="hide-sm">K/round</th><th class="hide-sm">Mortes/round</th>
         <th class="hide-sm">Kills</th><th>Mapas</th></tr></thead>
       <tbody>${top}</tbody></table></div></div>`;

  const m0 = mvps[0];
  const mvpSec = m0 ? `
   <div class="sec"><div class="sec-h"><h2>MVP da semana</h2>
     <span class="hint">${esc(m0.partida.nome)}</span></div>
     <div class="card pad"><div class="mvp">
       ${m0.mvp.j.foto ? `<img class="mvp-photo" src="${esc(m0.mvp.j.foto)}" alt="">`
                       : `<div class="mvp-photo">${esc(abbr(m0.mvp.j.nome))}</div>`}
       <div>
         <span class="mvp-badge">✦ MVP</span>
         <div class="mvp-name">${esc(m0.mvp.j.nome)}</div>
         <div class="dimmed" style="font-size:13px;margin-top:5px">
           ${esc(time(sea,m0.mvp.j.time).nome)} · ${m0.mvp.t.maps} mapas na semana</div>
         <div class="mvp-stats">
           <div class="stat"><div class="v">${f2(m0.mvp.r)}</div><div class="k">Rating</div></div>
           <div class="stat"><div class="v">${m0.mvp.t.k}</div><div class="k">Kills</div></div>
           <div class="stat"><div class="v">${f2(m0.mvp.t.kd)}</div><div class="k">K/D</div></div>
           <div class="stat"><div class="v">${f2(m0.mvp.t.kpr)}</div><div class="k">K/round</div></div>
           ${m0.mvp.t.hs!=null?`<div class="stat"><div class="v">${Math.round(m0.mvp.t.hs)}%</div><div class="k">HS</div></div>`:''}
         </div>
         <div class="dimmed" style="font-size:12px;margin-top:14px">
           Logo atrás: ${m0.top.slice(1).map(c=>esc(c.j.nome)+' ('+f2(c.r)+')').join(', ')}</div>
       </div>
     </div></div></div>` : '';

  const semanas = sea.partidas.filter(p=>p.mapas.length).slice().reverse().map(p=>{
    let c=0,s=0; p.mapas.forEach(m=>{ if(m.vencedor==='canada')c++; else if(m.vencedor==='sm')s++; });
    const maps = p.mapas.map((m,i)=>{
      const r = m.vencedor==='canada' ? 'w' : (m.vencedor==='sm' ? 'l' : 'e');
      return `<div class="wk-map" onclick="abrirMapa(${p.semana},${i})">
        <span class="dot ${r}"></span><span class="mn">${esc(m.mapa)}</span>
        <span class="ms num">${m.rounds_canada}:${m.rounds_sm}</span></div>`;
    }).join('');
    return `<div class="wk">
      <div class="wk-h"><span class="t">${esc(p.nome)}</span>
        <span class="s num"><span style="color:var(--canada)">${c}</span>
        <span style="color:var(--txt-3);font-weight:400">:</span>
        <span style="color:var(--sm)">${s}</span></span></div>
      <div class="wk-maps">${maps}</div></div>`;
  }).join('');

  const semanasSec = `
   <div class="sec"><div class="sec-h"><h2>Semanas</h2>
     <span class="hint">clique num mapa pra ver o placar completo</span></div>
     <div class="weeks">${semanas}</div></div>`;

  const patro = sea.patrocinador && sea.patrocinador.img ? `
   <div class="sec">${sea.patrocinador.link
     ? `<a class="sponsor" href="${esc(sea.patrocinador.link)}" target="_blank" rel="noopener">
          <img src="${esc(sea.patrocinador.img)}" alt="Patrocinador"></a>`
     : `<div class="sponsor"><img src="${esc(sea.patrocinador.img)}" alt="Patrocinador"></div>`}
   </div>` : '';

  document.getElementById('app').innerHTML =
    hero + classificacao + mvpSec + leaderboard + mapPoolSec + semanasSec + patro;
}

function telaJogadores(){
  const sea = state.atual, F = fichas(sea);
  const grupo = tid => F.filter(f=>f.time===tid).map(f=>`
    <tr class="link" onclick="location.hash='#/jogador/${f.id}'">
      <td>${chipJogador(sea,f)}</td>
      <td class="strong">${f.apto?f2(f.rating):'<span class="dimmed">-</span>'}</td>
      <td>${f2(f.t.kd)}</td>
      <td class="hide-sm">${f2(f.t.kpr)}</td>
      <td class="hide-sm dimmed num">${f.t.k}/${f.t.a}/${f.t.d}</td>
      <td class="dimmed num">${f.t.maps}</td></tr>`).join('');

  const bloco = tid => {
    const t = time(sea,tid);
    return `<div class="card pad">
      <h3 style="font-size:17px;color:${t.cor};margin-bottom:10px">${esc(t.nome)}</h3>
      <table><thead><tr><th>Jogador</th><th>Rating</th><th>K/D</th>
        <th class="hide-sm">K/round</th><th class="hide-sm">K/A/D</th><th>Mapas</th></tr></thead>
        <tbody>${grupo(tid)}</tbody></table></div>`;
  };

  document.getElementById('app').innerHTML = `
    <div class="sec"><div class="sec-h"><h2>Jogadores</h2>
      <span class="hint">clique em alguém pra abrir a ficha</span></div>
      <div class="grid2">${bloco('canada')}${bloco('sm')}</div></div>`;
}

function telaJogador(id){
  const sea = state.atual, F = fichas(sea);
  const f = F.find(x=>x.id===id);
  if (!f){ location.hash='#/jogadores'; return; }
  const t = f.t, tm = time(sea, f.time), med = mediasDaLiga(sea);
  const aptos = F.filter(x=>x.apto);

  const eixo = (nome, valor, chave, inverso=false) => {
    const lista = aptos.map(x=>chave(x));
    let p = percentil(chave(f), lista);
    if (inverso) p = 1-p;
    return {nome, v:valor, p};
  };
  const eixos = [
    eixo('Rating', f2(f.rating), x=>x.rating),
    eixo('K/rnd', f2(t.kpr), x=>x.t.kpr),
    eixo('K/D', f2(t.kd), x=>x.t.kd),
    eixo('Sobrevida', pct(t.spr), x=>x.t.spr),
    eixo('Assist', f2(t.apr), x=>x.t.apr),
  ];
  if (f.cons!=null) eixos.push(eixo('Regular.', pct(f.cons), x=>x.cons||0));
  if (t.hs!=null)   eixos.push(eixo('HS', Math.round(t.hs)+'%', x=>x.t.hs||0));
  if (t.mvps>0)     eixos.push(eixo('MVP/rnd', f2(t.mvpr), x=>x.t.mvpr||0));

  const pos = aptos.findIndex(x=>x.id===f.id)+1;

  const ultimos = f.linhas.slice().reverse().slice(0,12).map(l=>{
    const cor = l.res==='w' ? 'var(--win)' : (l.res==='l' ? 'var(--loss)' : 'var(--draw)');
    const rl = rating(agrega([l]), med);
    return `<tr>
      <td><span style="color:${cor};font-weight:700">${l.placar}</span></td>
      <td class="dimmed" style="text-align:left">${esc(l.mapa)}</td>
      <td class="hide-sm dimmed" style="text-align:left">Semana ${l.semana}</td>
      <td class="num">${l.k}-${l.d}</td>
      <td class="hide-sm num">${l.a}</td>
      <td class="strong">${f2(rl)}</td></tr>`;
  }).join('');

  document.getElementById('app').innerHTML = `
    <div class="back" onclick="location.hash='#/jogadores'">← todos os jogadores</div>
    <div class="sec" style="margin-top:12px">
      <div class="pl-head">
        ${f.foto ? `<img class="pl-photo" src="${esc(f.foto)}" alt="">`
                 : `<div class="pl-photo">${esc(abbr(f.nome))}</div>`}
        <div class="pl-id" style="display:flex;flex-direction:column;justify-content:center">
          <div class="nm">${esc(f.nome)}</div>
          <div class="tm" style="color:${tm.cor}">${esc(tm.nome)}</div>
          <div class="mvp-stats" style="margin-top:20px">
            <div class="stat"><div class="v">${f2(f.rating)}</div><div class="k">Rating</div></div>
            <div class="stat"><div class="v">${f.apto?('#'+pos):'-'}</div><div class="k">na liga</div></div>
            <div class="stat"><div class="v">${f2(t.kd)}</div><div class="k">K/D</div></div>
            <div class="stat"><div class="v">${t.k}</div><div class="k">Kills</div></div>
            <div class="stat"><div class="v">${t.maps}</div><div class="k">Mapas</div></div>
            <div class="stat"><div class="v">${t.rounds}</div><div class="k">Rounds</div></div>
          </div>
        </div>
      </div>
    </div>

    <div class="sec"><div class="sec-h"><h2>Perfil</h2>
      <span class="hint">o desenho mostra a posição dele contra todos os outros da liga</span></div>
      <div class="card pad"><div class="radar-box">
        ${radarSVG(eixos)}
        <div class="radar-legend">
          <p>O número em cada ponta é o valor real. A distância até a borda é o quanto ele está
             acima dos outros jogadores da liga.</p>
          <p style="margin-top:12px"><b>Rating KND</b> combina kills por round, sobrevivência
             e assistências. 1.00 é exatamente a média da liga${med.mvpr>0?', e entra MVP de round no cálculo':''}.</p>
          <p style="margin-top:12px"><b>Regularidade</b> é o quanto ele repete o mesmo nível
             mapa após mapa. Alto quer dizer que entrega sempre.</p>
        </div>
      </div></div></div>

    <div class="sec"><div class="sec-h"><h2>Últimos mapas</h2></div>
      <div class="card pad"><table>
        <thead><tr><th style="text-align:left">Placar</th><th style="text-align:left">Mapa</th>
          <th class="hide-sm" style="text-align:left">Rodada</th>
          <th>K-D</th><th class="hide-sm">A</th><th>Rating</th></tr></thead>
        <tbody>${ultimos}</tbody></table></div></div>`;
}

function telaPartidas(){
  const sea = state.atual;
  const blocos = sea.partidas.filter(p=>p.mapas.length).slice().reverse().map(p=>{
    const mapas = p.mapas.map((m,i)=>{
      const cor = m.vencedor==='canada' ? 'var(--canada)'
                : (m.vencedor==='sm' ? 'var(--sm)' : 'var(--txt-2)');
      return `<tr class="link" onclick="abrirMapa(${p.semana},${i})">
        <td style="text-align:left">${esc(m.mapa)}</td>
        <td class="strong" style="color:${cor}">${m.rounds_canada} : ${m.rounds_sm}</td>
        <td class="dimmed">${roundsDoMapa(m)} rounds</td></tr>`;
    }).join('');
    return `<div class="card pad" style="margin-bottom:14px">
      <h3 style="font-size:17px;margin-bottom:9px">${esc(p.nome)}</h3>
      <table><thead><tr><th style="text-align:left">Mapa</th>
        <th>${esc(time(sea,'canada').nome)} : ${esc(time(sea,'sm').nome)}</th>
        <th>Duração</th></tr></thead><tbody>${mapas}</tbody></table></div>`;
  }).join('');
  document.getElementById('app').innerHTML =
    `<div class="sec"><div class="sec-h"><h2>Partidas</h2>
      <span class="hint">clique num mapa pra ver o placar jogador a jogador</span></div>
      ${blocos}</div>`;
}

/* ============ modal do mapa ============ */
function abrirMapa(semana, idx){
  const sea = state.atual;
  const p = sea.partidas.find(x=>x.semana===semana);
  const m = p.mapas[idx], med = mediasDaLiga(sea);
  const rounds = roundsDoMapa(m);

  const lado = tid => {
    const tm = time(sea,tid);
    const linhas = m.stats.filter(s=>s.time===tid)
      .map(s=>{
        const j = sea.jogadores.find(x=>x.id===s.jogador) || {nome:s.jogador, time:tid};
        const r = rating(agrega([{rounds, k:s.k, a:s.a, d:s.d, mvps:s.mvps, hs:s.hs, score:s.score}]), med);
        return {j, s, r};
      })
      .sort((a,b)=>b.r-a.r)
      .map(({j,s,r})=>`<tr class="link" onclick="fecharMapa();location.hash='#/jogador/${j.id}'">
        <td>${chipJogador(sea,j)}</td>
        <td class="num">${s.k}</td><td class="num">${s.a}</td><td class="num">${s.d}</td>
        ${s.mvps!=null?`<td class="num">${s.mvps}</td>`:''}
        ${s.hs!=null?`<td class="num dimmed">${s.hs}%</td>`:''}
        <td class="strong">${f2(r)}</td></tr>`).join('');
    const temMvp = m.stats.some(s=>s.mvps!=null), temHs = m.stats.some(s=>s.hs!=null);
    return `<div><h4 style="color:${tm.cor};font-size:15px;margin-bottom:7px">${esc(tm.nome)}</h4>
      <table><thead><tr><th>Jogador</th><th>K</th><th>A</th><th>D</th>
        ${temMvp?'<th>★</th>':''}${temHs?'<th>HS</th>':''}<th>Rating</th></tr></thead>
        <tbody>${linhas}</tbody></table></div>`;
  };

  document.getElementById('modalPanel').innerHTML = `
    <div class="modal-h"><h3>${esc(m.mapa)}
      <span style="color:var(--canada)">${m.rounds_canada}</span>
      <span class="dimmed" style="font-weight:300"> : </span>
      <span style="color:var(--sm)">${m.rounds_sm}</span></h3>
      <span class="modal-x" onclick="fecharMapa()">✕</span></div>
    <p class="dimmed" style="font-size:12px;margin:0 0 18px;letter-spacing:.08em;text-transform:uppercase">
      ${esc(p.nome)} · ${rounds} rounds</p>
    <div class="grid2">${lado('canada')}${lado('sm')}</div>`;
  document.getElementById('modal').hidden = false;
}
function fecharMapa(){ document.getElementById('modal').hidden = true; }
document.addEventListener('keydown', e=>{ if(e.key==='Escape') fecharMapa(); });

boot();
