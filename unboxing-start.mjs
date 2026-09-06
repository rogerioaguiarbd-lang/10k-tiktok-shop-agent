import fs from 'fs/promises';

const serverFile = new URL('./server.mjs', import.meta.url);
const frontFile = new URL('./public/index.html', import.meta.url);
let source = await fs.readFile(serverFile, 'utf8');
let front = await fs.readFile(frontFile, 'utf8');

function mustReplace(text, from, to, label){
  if(!text.includes(from)) throw new Error(`${label} não encontrado; abortando para evitar alteração parcial.`);
  return text.replace(from,to);
}

const oldRule = "Estrutura-base adaptativa: pacote lacrado → abertura natural do pacote → produto(s) revelado(s)/organizado(s) → produto principal segurado e demonstrado → transição natural por movimento/oclusão → demonstração final em uso.";
const newRule = `TAKE 1 — COMPOSIÇÃO VISUAL OBRIGATÓRIA: comece com uma fotografia/vídeo ultra-realista vertical 9:16, estética UGC espontânea para TikTok Shop, usando fielmente o(s) produto(s) analisado(s). A cena acontece em um quarto feminino, moderno e aconchegante. A câmera representa exatamente o ponto de vista dos olhos de uma influenciadora adulta sentada no centro de uma cama de casal, inclinada para baixo em POV verdadeiro. Ela está sentada ereta de pernas cruzadas em posição confortável: joelhos baixos direcionados para os lados, canelas convergindo ao centro e tornozelos cruzados próximos ao corpo. Ela usa meias curtas caneladas brancas. Somente as duas pernas e os dois pés aparecem na parte inferior do quadro, formando moldura natural. Os pés aparecem parcialmente de lado e próximos ao centro inferior. NÃO elevar os joelhos em direção à câmera; NÃO abrir as pernas em V; NÃO deixar pés separados, estendidos para frente ou apontados para os produtos; NÃO mostrar a influenciadora deitada nem com pernas esticadas. À frente das pernas cruzadas, organize TODOS e SOMENTE os produtos sustentados pela imagem/análise sobre os lençóis. Cada produto deve aparecer inteiro, separado e totalmente visível, preservando fielmente forma, estampa, desenhos, textos, materiais, texturas, acabamentos e demais características visíveis; não inventar, duplicar, substituir ou omitir produtos. Para roupas, dispor abertas na cama, frente voltada para a câmera e pequenas dobras naturais; peça principal centralizada e mais próxima da influenciadora, demais peças equilibradas na área superior e laterais. As pernas nunca cobrem os produtos e deve existir pequena distância visual entre os pés cruzados e a peça principal. Cama com lençóis claros de algodão levemente amassados; nas bordas, manta texturizada em tom rosado, pequeno buquê de flores em tons neutros e óculos de sol discretos. Luz natural suave lateral de janela, sombras delicadas, exposição de smartphone e perspectiva equivalente a 26 mm sem distorção exagerada. Anatomia fisicamente possível: exatamente duas pernas e dois pés. NÃO mostrar braços, mãos, rosto, cabeça, cabelo, torso, reflexos ou outras pessoas. Sem captions, preços, interface, watermark, ilustração ou CGI. IMPORTANTE: esta regra do TAKE 1 substitui a antiga obrigação de começar pelo pacote fechado. Não mostrar pacote no TAKE 1, salvo se o próprio pacote for o produto analisado. Se a quantidade escolhida for 1 TAKE, complete hook, corpo, demonstração e CTA dentro deste único take, podendo usar múltiplos momentos visuais rápidos e cortes internos naturais. Se forem 2 TAKES, use o TAKE 1 para hook + início do corpo e o TAKE 2 para continuação da demonstração/corpo + CTA, mantendo continuidade visual e factual.`;
source=mustReplace(source,oldRule,newRule,'Regra Unboxing POV');

source=mustReplace(source,
"ESTRATÉGIA: escolha a melhor entre problema→solução, demonstração→prova, curiosidade→revelação, descoberta pessoal, comparação, erro comum, benefício direto, objeção→resposta e CONVERSÃO DIRETA 3 TAKES.",
"ESTRATÉGIA: escolha a melhor entre problema→solução, demonstração→prova, curiosidade→revelação, descoberta pessoal, comparação, erro comum, benefício direto, objeção→resposta e CONVERSÃO DIRETA. QUANTIDADE DE TAKES=${o.takesCount}. Gere EXATAMENTE essa quantidade: se 1 TAKE, una hook + corpo + CTA no mesmo take; se 2 TAKES, TAKE 1 = hook + início do corpo e TAKE 2 = continuação do corpo/demonstração + CTA.",
'Estratégia de takes');

source=mustReplace(source,
"Não use Conversão Direta mecanicamente: selecione-a quando demonstração rápida, dor visual, transformação observável ou decisão de compra simples tornarem a estrutura superior. Se escolhida, aplique: TAKE 1 = quebra de padrão + curiosidade/validação somente se sustentada; produto/problema visível imediatamente. TAKE 2 = demonstração em uso real + prova visual imediata; concentre a maior parte do tempo aqui e deixe a imagem provar o benefício. TAKE 3 = CTA de baixa fricção, recomendação natural ao carrinho laranja.",
"Não use Conversão Direta mecanicamente: selecione-a quando demonstração rápida, dor visual, transformação observável ou decisão de compra simples tornarem a estrutura superior. Com 1 TAKE: comece com quebra de padrão/hook extremamente rápido, emende imediatamente o corpo com demonstração/prova visual e finalize no mesmo take com CTA de baixa fricção ao carrinho laranja. Com 2 TAKES: TAKE 1 = quebra de padrão/hook + início do corpo; produto/problema visível imediatamente. TAKE 2 = continuação do corpo com demonstração/prova visual dominante + CTA de baixa fricção ao carrinho laranja. O hook nunca deve ocupar sozinho um take inteiro.",
'Regra Conversão Direta');

source=mustReplace(source,
"A fala do Take 2 pode entrar quase colada ao final do Take 1 e o Take 3 deve começar antes de a atenção cair, sem sobrepor falas de modo ininteligível. Preserve naturalidade UGC. Distribua a duração proporcionalmente: Take 1 curto (aprox. 20%), Take 2 dominante (aprox. 55%), Take 3 curto (aprox. 25%), adaptando a 8/15/30s e ao conteúdo real. Para 20s, referência 0-4 / 4-14 / 14-20.",
"Preserve naturalidade UGC e elimine pausas mortas. Se houver 1 TAKE, use 100% da duração nele e faça hook → corpo/demonstração → CTA como uma sequência contínua e dinâmica, com cortes internos quando úteis. Se houver 2 TAKES, use aproximadamente 45% da duração no TAKE 1 (hook + início do corpo) e 55% no TAKE 2 (corpo/demonstração + CTA); a fala do TAKE 2 pode entrar quase colada ao final do TAKE 1, sem sobreposição ininteligível. Adapte a 8/15/30s e ao conteúdo real.",
'Ritmo de takes');

source=mustReplace(source,
"3 TAKES são uma copy contínua. No Unboxing POV, podem conter múltiplos momentos visuais rápidos para completar a progressão.",
"A copy deve usar EXATAMENTE ${o.takesCount} take(s), conforme seleção do usuário. Em 1 TAKE: hook + corpo + CTA no mesmo take. Em 2 TAKES: TAKE 1 = hook + início do corpo; TAKE 2 = continuação do corpo + CTA. No Unboxing POV, cada take pode conter múltiplos momentos visuais rápidos para completar a progressão.",
'Quantidade final de takes');

source=mustReplace(source,
"takes:[{take,titulo,duracao_segundos,objetivo,cena,acao,enquadramento,fala,texto_tela,continuity_key,prompt_video},{take,titulo,duracao_segundos,objetivo,cena,acao,enquadramento,fala,texto_tela,continuity_key,prompt_video},{take,titulo,duracao_segundos,objetivo,cena,acao,enquadramento,fala,texto_tela,continuity_key,prompt_video}]",
"takes:[{take,titulo,duracao_segundos,objetivo,cena,acao,enquadramento,fala,texto_tela,continuity_key,prompt_video}]",
'JSON takes');

const oldOpts="o={analysis,mode:b.mode||'Automático',format:b.format||'UGC',duration:+b.duration||15,generator:b.generator||'Genérico',avatar:b.avatar||'Automático',environment:b.environment||'Automático',copyStyle:b.copyStyle||'Mix inteligente',intensity:b.intensity||'Equilibrado',angleMode:b.angleMode||'Automático'}";
const newOpts="o={analysis,mode:b.mode||'Automático',format:b.format||'UGC',duration:+b.duration||15,generator:b.generator||'Genérico',avatar:b.avatar||'Automático',environment:b.environment||'Automático',copyStyle:b.copyStyle||'Mix inteligente',intensity:b.intensity||'Equilibrado',angleMode:b.angleMode||'Automático',takesCount:[1,2].includes(+b.takesCount)?+b.takesCount:2}";
source=mustReplace(source,oldOpts,newOpts,'Opção takesCount');

source=mustReplace(source,
"Otimize corrigindo falhas, saturação, hook tardio, demonstração fraca, objeção não tratada e CTA genérico. Preserve fatos, 3 takes, continuidade, formato visual e regra de áudio. Preserve Conversão Direta 3 Takes quando escolhida: hook curto/quebra de padrão → demonstração visual dominante → CTA natural de baixa fricção; cortes secos, falas encadeadas",
"Otimize corrigindo falhas, saturação, hook tardio, demonstração fraca, objeção não tratada e CTA genérico. Preserve fatos e preserve EXATAMENTE a quantidade de takes já existente no criativo (1 ou 2), continuidade, formato visual e regra de áudio. Se houver 1 TAKE: hook curto + corpo/demonstração + CTA no mesmo take. Se houver 2 TAKES: TAKE 1 = hook + início do corpo; TAKE 2 = corpo/demonstração dominante + CTA; cortes secos, falas encadeadas",
'Melhoria de takes');
source=source.replace("Se formato Unboxing POV, preserve pacote → abertura → revelação → produto em destaque → demonstração final adaptada à categoria", "Se formato Unboxing POV, preserve a composição POV sentada obrigatória no TAKE 1; com 1 take, complete demonstração e CTA no mesmo take; com 2 takes, continue demonstração e uso final no TAKE 2");
source=source.replace("cta:cr?.creative?.takes?.[2]?.fala||''", "cta:cr?.creative?.takes?.at?.(-1)?.fala||''");
source=source.replace("engine:'creation-optimization-unboxing-direct-conversion'", "engine:'creation-optimization-unboxing-direct-conversion-1or2takes'");

const oldHistoryApi="app.get('/api/history',auth,async(_,s)=>s.json((await read()).creatives.slice(0,150)));";
const newHistoryApi=`${oldHistoryApi}app.delete('/api/history',auth,async(r,s)=>{try{const ids=[...new Set((Array.isArray(r.body?.ids)?r.body.ids:[]).map(String).filter(Boolean))];if(!ids.length)return s.status(400).json({error:'Selecione pelo menos um item do histórico.'});const st=await read(),before=st.creatives.length,idset=new Set(ids);st.creatives=st.creatives.filter(x=>!idset.has(String(x.id)));const deleted=before-st.creatives.length;await write(st);s.json({ok:true,deleted})}catch(e){s.status(500).json({error:e.message})}});`;
source=mustReplace(source,oldHistoryApi,newHistoryApi,'Endpoint apagar histórico');

const durationBlock='<div><label>Duração</label><select id="duration"><option>8</option><option selected>15</option><option>30</option></select></div>';
const takesBlock=durationBlock+'<div><label>Takes</label><select id="takesCount"><option value="1">1 take</option><option value="2" selected>2 takes</option></select></div>';
front=mustReplace(front,durationBlock,takesBlock,'Seletor de takes');
front=mustReplace(front,
"angleMode:$('#angleMode').value,batchCount:+$('#batch').value",
"angleMode:$('#angleMode').value,takesCount:+$('#takesCount').value,batchCount:+$('#batch').value",
'Payload takesCount');

const oldHistoryMain='<main id="history" class="hidden"><div class="hero"><h1>Histórico</h1></div><div id="historyList"></div></main>';
const newHistoryMain='<main id="history" class="hidden"><div class="hero"><h1>Histórico</h1></div><div id="historyTools" class="card"><div class="actions"><div><b id="historySelectedCount">0 selecionados</b><div class="status">Marque os anúncios que deseja apagar.</div></div><div class="actions"><button id="historySelectAll" class="nav" type="button">Selecionar todos</button><button id="historyDeleteSelected" class="nav" type="button" disabled>Apagar selecionados</button></div></div></div><div id="historyList"></div></main>';
front=mustReplace(front,oldHistoryMain,newHistoryMain,'Área de histórico');

const oldHistoryFunction="async function loadHistory(){history=await api('/api/history');$('#historyList').innerHTML=history.map(x=>`<div class=\"card\"><b>${esc(x.productName)}</b><p>${esc(x.creative?.hook_escolhido)}</p></div>`).join('')}";
const newHistoryFunction=`let selectedHistory=new Set();function updateHistorySelection(){const n=selectedHistory.size,$count=$('#historySelectedCount'),$del=$('#historyDeleteSelected'),$all=$('#historySelectAll');if($count)$count.textContent=n+' selecionado'+(n===1?'':'s');if($del)$del.disabled=n===0;if($all)$all.textContent=history.length&&n===history.length?'Desmarcar todos':'Selecionar todos'}async function loadHistory(){history=await api('/api/history');selectedHistory=new Set();$('#historyList').innerHTML=history.length?history.map(x=>\`<div class="card"><label style="display:flex;align-items:center;gap:10px;text-transform:none;font-size:14px;cursor:pointer"><input type="checkbox" data-history-id="\${esc(x.id)}" style="width:20px;height:20px;accent-color:#ff6900"><span><b>\${esc(x.productName)}</b><br><span class="status">\${esc(x.creative?.hook_escolhido||'Sem hook registrado')}</span></span></label></div>\`).join(''):'<div class="status">O histórico está vazio.</div>';document.querySelectorAll('[data-history-id]').forEach(c=>c.onchange=()=>{c.checked?selectedHistory.add(c.dataset.historyId):selectedHistory.delete(c.dataset.historyId);updateHistorySelection()});updateHistorySelection()}document.addEventListener('click',async e=>{if(e.target?.id==='historySelectAll'){if(selectedHistory.size===history.length)selectedHistory.clear();else selectedHistory=new Set(history.map(x=>String(x.id)));document.querySelectorAll('[data-history-id]').forEach(c=>c.checked=selectedHistory.has(c.dataset.historyId));updateHistorySelection()}if(e.target?.id==='historyDeleteSelected'){if(!selectedHistory.size)return;const total=selectedHistory.size;if(!confirm('Apagar '+total+' item'+(total===1?'':'s')+' selecionado'+(total===1?'':'s')+' do histórico?'))return;const b=e.target,old=b.textContent;b.disabled=true;b.textContent='Apagando...';try{const d=await api('/api/history',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:[...selectedHistory]})});await loadHistory();b.textContent=(d.deleted||0)+' apagado'+((d.deleted||0)===1?'':'s')}catch(err){alert(err.message);b.textContent=old}setTimeout(()=>{if($('#historyDeleteSelected'))$('#historyDeleteSelected').textContent='Apagar selecionados'},1200)}});`;
front=mustReplace(front,oldHistoryFunction,newHistoryFunction,'Função de histórico');

await fs.writeFile(serverFile,source);
await fs.writeFile(frontFile,front);
await import('./server.mjs');
