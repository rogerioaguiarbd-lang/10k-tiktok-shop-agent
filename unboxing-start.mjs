import fs from 'fs/promises';

const serverFile = new URL('./server.mjs', import.meta.url);
const frontFile = new URL('./public/index.html', import.meta.url);
let source = await fs.readFile(serverFile, 'utf8');
let front = await fs.readFile(frontFile, 'utf8');

const oldRule = "Estrutura-base adaptativa: pacote lacrado → abertura natural do pacote → produto(s) revelado(s)/organizado(s) → produto principal segurado e demonstrado → transição natural por movimento/oclusão → demonstração final em uso.";

const newRule = `TAKE 1 — COMPOSIÇÃO VISUAL OBRIGATÓRIA: comece com uma fotografia/vídeo ultra-realista vertical 9:16, estética UGC espontânea para TikTok Shop, usando fielmente o(s) produto(s) analisado(s). A cena acontece em um quarto feminino, moderno e aconchegante. A câmera representa exatamente o ponto de vista dos olhos de uma influenciadora adulta sentada no centro de uma cama de casal, inclinada para baixo em POV verdadeiro. Ela está sentada ereta de pernas cruzadas em posição confortável: joelhos baixos direcionados para os lados, canelas convergindo ao centro e tornozelos cruzados próximos ao corpo. Ela usa meias curtas caneladas brancas. Somente as duas pernas e os dois pés aparecem na parte inferior do quadro, formando moldura natural. Os pés aparecem parcialmente de lado e próximos ao centro inferior. NÃO elevar os joelhos em direção à câmera; NÃO abrir as pernas em V; NÃO deixar pés separados, estendidos para frente ou apontados para os produtos; NÃO mostrar a influenciadora deitada nem com pernas esticadas. À frente das pernas cruzadas, organize TODOS e SOMENTE os produtos sustentados pela imagem/análise sobre os lençóis. Cada produto deve aparecer inteiro, separado e totalmente visível, preservando fielmente forma, estampa, desenhos, textos, materiais, texturas, acabamentos e demais características visíveis; não inventar, duplicar, substituir ou omitir produtos. Para roupas, dispor abertas na cama, frente voltada para a câmera e pequenas dobras naturais; peça principal centralizada e mais próxima da influenciadora, demais peças equilibradas na área superior e laterais. As pernas nunca cobrem os produtos e deve existir pequena distância visual entre os pés cruzados e a peça principal. Cama com lençóis claros de algodão levemente amassados; nas bordas, manta texturizada em tom rosado, pequeno buquê de flores em tons neutros e óculos de sol discretos. Luz natural suave lateral de janela, sombras delicadas, exposição de smartphone e perspectiva equivalente a 26 mm sem distorção exagerada. Anatomia fisicamente possível: exatamente duas pernas e dois pés. NÃO mostrar braços, mãos, rosto, cabeça, cabelo, torso, reflexos ou outras pessoas. Sem captions, preços, interface, watermark, ilustração ou CGI. IMPORTANTE: esta regra do TAKE 1 substitui a antiga obrigação de começar pelo pacote fechado. Não mostrar pacote no TAKE 1, salvo se o próprio pacote for o produto analisado. Depois do TAKE 1, desenvolva Takes 2 e 3 com demonstração/transição/uso natural do produto, mantendo continuidade visual e factual.`;

if (!source.includes(oldRule)) {
  throw new Error('Regra-base de Unboxing POV não encontrada; abortando sem alterar o servidor.');
}
source = source.replace(oldRule, newRule);

const oldHistoryApi = "app.get('/api/history',auth,async(_,s)=>s.json((await read()).creatives.slice(0,150)));";
const newHistoryApi = `${oldHistoryApi}app.delete('/api/history',auth,async(r,s)=>{try{const ids=[...new Set((Array.isArray(r.body?.ids)?r.body.ids:[]).map(String).filter(Boolean))];if(!ids.length)return s.status(400).json({error:'Selecione pelo menos um item do histórico.'});const st=await read(),before=st.creatives.length,idset=new Set(ids);st.creatives=st.creatives.filter(x=>!idset.has(String(x.id)));const deleted=before-st.creatives.length;await write(st);s.json({ok:true,deleted})}catch(e){s.status(500).json({error:e.message})}});`;
if (!source.includes(oldHistoryApi)) {
  throw new Error('Endpoint de histórico não encontrado; abortando sem alterar o servidor.');
}
source = source.replace(oldHistoryApi, newHistoryApi);

const oldHistoryMain = '<main id="history" class="hidden"><div class="hero"><h1>Histórico</h1></div><div id="historyList"></div></main>';
const newHistoryMain = '<main id="history" class="hidden"><div class="hero"><h1>Histórico</h1></div><div id="historyTools" class="card"><div class="actions"><div><b id="historySelectedCount">0 selecionados</b><div class="status">Marque os anúncios que deseja apagar.</div></div><div class="actions"><button id="historySelectAll" class="nav" type="button">Selecionar todos</button><button id="historyDeleteSelected" class="nav" type="button" disabled>Apagar selecionados</button></div></div></div><div id="historyList"></div></main>';
if (!front.includes(oldHistoryMain)) {
  throw new Error('Área de histórico da interface não encontrada; abortando sem alterar a interface.');
}
front = front.replace(oldHistoryMain, newHistoryMain);

const oldHistoryFunction = "async function loadHistory(){history=await api('/api/history');$('#historyList').innerHTML=history.map(x=>`<div class=\"card\"><b>${esc(x.productName)}</b><p>${esc(x.creative?.hook_escolhido)}</p></div>`).join('')}";
const newHistoryFunction = `let selectedHistory=new Set();function updateHistorySelection(){const n=selectedHistory.size,$count=$('#historySelectedCount'),$del=$('#historyDeleteSelected'),$all=$('#historySelectAll');if($count)$count.textContent=n+' selecionado'+(n===1?'':'s');if($del)$del.disabled=n===0;if($all)$all.textContent=history.length&&n===history.length?'Desmarcar todos':'Selecionar todos'}async function loadHistory(){history=await api('/api/history');selectedHistory=new Set();$('#historyList').innerHTML=history.length?history.map(x=>\`<div class="card"><label style="display:flex;align-items:center;gap:10px;text-transform:none;font-size:14px;cursor:pointer"><input type="checkbox" data-history-id="\${esc(x.id)}" style="width:20px;height:20px;accent-color:#ff6900"><span><b>\${esc(x.productName)}</b><br><span class="status">\${esc(x.creative?.hook_escolhido||'Sem hook registrado')}</span></span></label></div>\`).join(''):'<div class="status">O histórico está vazio.</div>';document.querySelectorAll('[data-history-id]').forEach(c=>c.onchange=()=>{c.checked?selectedHistory.add(c.dataset.historyId):selectedHistory.delete(c.dataset.historyId);updateHistorySelection()});updateHistorySelection()}document.addEventListener('click',async e=>{if(e.target?.id==='historySelectAll'){if(selectedHistory.size===history.length)selectedHistory.clear();else selectedHistory=new Set(history.map(x=>String(x.id)));document.querySelectorAll('[data-history-id]').forEach(c=>c.checked=selectedHistory.has(c.dataset.historyId));updateHistorySelection()}if(e.target?.id==='historyDeleteSelected'){if(!selectedHistory.size)return;const total=selectedHistory.size;if(!confirm('Apagar '+total+' item'+(total===1?'':'s')+' selecionado'+(total===1?'':'s')+' do histórico?'))return;const b=e.target,old=b.textContent;b.disabled=true;b.textContent='Apagando...';try{const d=await api('/api/history',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:[...selectedHistory]})});await loadHistory();b.textContent=(d.deleted||0)+' apagado'+((d.deleted||0)===1?'':'s')}catch(err){alert(err.message);b.textContent=old}setTimeout(()=>{if($('#historyDeleteSelected'))$('#historyDeleteSelected').textContent='Apagar selecionados'},1200)}});`;
if (!front.includes(oldHistoryFunction)) {
  throw new Error('Função de histórico da interface não encontrada; abortando sem alterar a interface.');
}
front = front.replace(oldHistoryFunction, newHistoryFunction);

await fs.writeFile(serverFile, source);
await fs.writeFile(frontFile, front);
await import('./server.mjs');
