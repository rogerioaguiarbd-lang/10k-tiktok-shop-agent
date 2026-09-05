import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import {fileURLToPath} from 'url';

const dir=path.dirname(fileURLToPath(import.meta.url));
const app=express();
const port=Number(process.env.PORT||3000);
const model=process.env.GEMINI_MODEL||'gemini-2.5-flash';
const password=process.env.ADMIN_PASSWORD||'10kprompt';
const secret=process.env.APP_SECRET||'change-me';
const dataDir=process.env.DATA_DIR||path.join(dir,'data');
const storeFile=path.join(dataDir,'store.json');
await fs.mkdir(dataDir,{recursive:true});
try{await fs.access(storeFile)}catch{await fs.writeFile(storeFile,JSON.stringify({products:[],creatives:[]}))}

const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:12*1024*1024}});
app.use(express.json({limit:'8mb'}));
app.use(express.static(path.join(dir,'public')));
const read=async()=>JSON.parse(await fs.readFile(storeFile,'utf8'));
const write=async d=>{const tmp=storeFile+'.tmp';await fs.writeFile(tmp,JSON.stringify(d,null,2));await fs.rename(tmp,storeFile)};
const clamp=n=>Math.max(0,Math.min(100,Math.round(Number(n)||0)));
const cookies=r=>Object.fromEntries((r.headers.cookie||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return[x.slice(0,i),decodeURIComponent(x.slice(i+1))]}));
function token(exp){const p=`admin.${exp}`;return `${p}.${crypto.createHmac('sha256',secret).update(p).digest('hex')}`}
function valid(t=''){const a=t.split('.');if(a.length!==3||a[0]!=='admin'||Date.now()>Number(a[1]))return false;return a[2]===crypto.createHmac('sha256',secret).update(`admin.${a[1]}`).digest('hex')}
const auth=(r,s,n)=>valid(cookies(r).session)?n():s.status(401).json({error:'Faça login para continuar.'});

app.post('/api/login',(r,s)=>{if(String(r.body?.password||'')!==password)return s.status(401).json({error:'Senha inválida.'});const exp=Date.now()+604800000;s.setHeader('Set-Cookie',`session=${encodeURIComponent(token(exp))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.NODE_ENV==='production'?'; Secure':''}`);s.json({ok:true})});
app.post('/api/logout',(_,s)=>{s.setHeader('Set-Cookie','session=; Path=/; Max-Age=0');s.json({ok:true})});
app.get('/api/me',(r,s)=>s.json({authenticated:valid(cookies(r).session)}));

async function gemini(prompt,extraParts=[],maxOutputTokens=6500){
  if(!process.env.GEMINI_API_KEY)throw Error('GEMINI_API_KEY não configurada no servidor.');
  const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt},...extraParts]}],generationConfig:{responseMimeType:'application/json',temperature:.55,maxOutputTokens}})});
  const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data?.error?.message||`Erro Gemini ${res.status}`);
  const text=(data?.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim();if(!text)throw Error('A IA não retornou conteúdo.');
  try{return JSON.parse(text.replace(/^```json\s*/i,'').replace(/```$/,'').trim())}catch{throw Error('Resposta inválida da IA. Tente novamente.')}
}

app.post('/api/analyze',auth,upload.single('image'),async(r,s)=>{try{
  if(!r.file)return s.status(400).json({error:'Envie um print.'});
  const imageHash=crypto.createHash('sha256').update(r.file.buffer).digest('hex'),st=await read(),cached=st.products.find(p=>p.sourceImageHash===imageHash&&p.analysis);
  if(cached)return s.json({...cached.analysis,_productId:cached.id,_cached:true});
  const prompt='Analise SOMENTE produto e informações comerciais visíveis no print de TikTok Shop. Use inferências conservadoras. Ignore características humanas. Não invente preço, desconto, estoque, avaliações, certificações, material, especificações ou alegações. Responda JSON pt-BR: produto,categoria,marca,descricao_visual,caracteristicas(array),beneficios(array),diferenciais(array),publico,problema,beneficio_principal,demonstracao_visual,angulo,ambiente_recomendado,tipo_hook_recomendado,confianca,observacoes.';
  const a=await gemini(prompt,[{inline_data:{mime_type:r.file.mimetype,data:r.file.buffer.toString('base64')}}],2200),id=crypto.randomUUID();
  st.products.unshift({id,createdAt:new Date().toISOString(),sourceImageHash:imageHash,analysis:a});await write(st);s.json({...a,_productId:id,_cached:false});
}catch(e){console.error(e);s.status(500).json({error:e.message||'Falha na análise.'})}});

app.post('/api/product-prompt',auth,async(r,s)=>{try{const {analysis}=r.body||{};if(!analysis)return s.status(400).json({error:'Analise um produto primeiro.'});const p=`Crie UM prompt de fotografia publicitária TikTok Shop em pt-BR usando SOMENTE a análise. APENAS produto, sem pessoas/avatar/mãos e SEM mencionar cor do produto. Não invente atributos, material, texto, logo, preço, desconto ou acessórios. Vertical 9:16, realista, produto protagonista, cenário coerente. JSON:{prompt_imagem_produto}. ANÁLISE:${JSON.stringify(analysis)}`;s.json(await gemini(p,[],1500))}catch(e){s.status(500).json({error:e.message})}});

function normalizeCreative(c){
 c.aberturas_abc=(c.hooks_alternativos||[]).slice(0,3).map((hook,i)=>({letra:['A','B','C'][i],hook}));
 if(Array.isArray(c.takes))c.takes=c.takes.map(t=>({...t,fala:String(t.fala||'').replace(/^\s*\.{2,}\s*/,'').replace(/\s*\.{2,}\s*$/,'').trim()}));
 if(c.diagnostico){for(const k of ['hook','clareza','demonstracao','retencao','cta'])c.diagnostico[k]=clamp(c.diagnostico[k]);c.diagnostico.potencial_venda=Math.round(['hook','clareza','demonstracao','retencao','cta'].reduce((n,k)=>n+c.diagnostico[k],0)/5);c.diagnostico.aviso='Diagnóstico criativo; não é previsão nem garantia de vendas.'}
 if(c.saturacao_copy){c.saturacao_copy.nota=clamp(c.saturacao_copy.nota)}
 return c;
}

function buildPrompt(opts){
 const {analysis,duration,generator,avatar,environment,copyStyle,intensity,optimizeSales,creativeDirector,ugcRealism,continuityLock,productFirst,angleMode,variantLabel}=opts;
 const auto=creativeDirector?'CREATIVE DIRECTOR AUTOMÁTICO: escolha internamente formato UGC ou POV, estilo de copy, intensidade, avatar funcional, ambiente, estrutura, hook, demonstração e CTA mais coerentes para este produto. Preencha decisoes_diretor com as escolhas e motivos curtos.':'Respeite exatamente as configurações fornecidas.';
 const structure='Escolha UMA estrutura principal entre: problema→solução, demonstração→prova, curiosidade→revelação, descoberta pessoal, comparação, erro comum, benefício direto, antes/depois somente se sustentado, objeção→resposta. Informe estrutura_escolhida.';
 const realism=ugcRealism?'UGC REALISTA AVANÇADO: linguagem coloquial crível, micro-pausas naturais, pequenos gestos, leve movimento de smartphone, olhar alternando produto/lente, sem estética de comercial de TV e sem exagerar imperfeições.':'';
 const continuity=continuityLock?'CONTINUITY LOCK: fixe mesmo cenário, iluminação, produto, avatar/roupa quando houver, posição espacial e continuidade temporal. Cada take deve trazer continuity_key idêntica e instrução de início/fim compatível com o take anterior.':'';
 const productFirstRule=productFirst?'PRODUTO PRIMEIRO: produto deve aparecer claramente nos primeiros 1,5s sem sacrificar naturalidade.':'';
 return `Você é o Creative Director do 10K Prompt, especialista em anúncios TikTok Shop Brasil orientados a retenção, clareza, demonstração e conversão ética. Use SOMENTE fatos sustentados pela análise.
${auto}\n${structure}\n${realism}\n${continuity}\n${productFirstRule}
CONFIGURAÇÕES quando não automáticas: duração=${duration}s; gerador=${generator}; avatar=${avatar}; ambiente=${environment}; estilo=${copyStyle}; intensidade=${intensity}; otimizar_vendas=${!!optimizeSales}; ângulo solicitado=${angleMode||'Automático'}; variante=${variantLabel||'principal'}.

GERADOR DE ÂNGULOS: crie exatamente 5 angulos_venda diferentes e específicos para o produto (ex.: praticidade, dor, desejo, demonstração, descoberta/economia somente se sustentada). Cada item: nome,ideia,promessa_permitida,melhor_visual. Escolha um em angulo_escolhido.
HOOK LAB: gere 7 hooks, um por tipo quando aplicável: curiosidade, benefício direto, identificação, demonstração, contrarian/erro comum, problema oculto, descoberta pessoal. Cada item: tipo,hook,forca_0_100. Selecione hook_escolhido e 3 hooks_alternativos realmente diferentes e compatíveis com o mesmo corpo.
CTA INTELIGENTE: adapte o CTA à categoria e intenção. Não use escassez, desconto, preço ou urgência se não estiverem explicitamente sustentados. CTA deve soar como recomendação natural ao carrinho laranja.
ROTEIRO VISUAL POR SEGUNDOS: crie timeline_visual cobrindo todo o vídeo em blocos curtos com inicio_seg,fim_seg,objetivo_visual,acao,camera,produto_em_foco. O vídeo deve ser compreensível mesmo sem áudio.
DETECTOR DE FALHAS: após criar, liste falhas_criativo com no máximo 5 itens: area,severidade(baixa/media/alta),problema,correcao. Avalie hook tardio, produto demorando, fala longa, pouca demonstração, repetição, CTA genérico, linguagem artificial e quebra de continuidade.
SATURAÇÃO DA COPY: saturacao_copy={nota 0-100 onde 100=copy muito genérica/saturada,frases_genericas:[...],ajuste}. Penalize clichês como “você precisa disso”, “corre aproveitar”, “produto perfeito”, “melhor compra” quando não houver contexto específico.
DIAGNÓSTICO: notas 0-100 hook,clareza,demonstracao,retencao,cta e sugestao_melhoria. potencial_venda será calculado pelo sistema; é diagnóstico criativo, não previsão.

3 TAKES = UMA ÚNICA COPY contínua: T1 hook/introdução; T2 demonstração+benefício; T3 conclusão+CTA. Falas devem caber em ${duration}s no total. Mesmo contexto visual. Não repetir apresentação.
ÁUDIO: SOMENTE campo fala é pronunciado. Cena/ação/objetivo/enquadramento/texto_tela/prompt são silenciosos. Cada prompt_video DEVE conter exatamente a regra: “ÁUDIO: pronunciar exclusivamente esta fala: [fala exata]. Não narrar nem pronunciar nenhuma outra instrução deste prompt.”
PROIBIDO: mencionar cor do produto; inventar preço/desconto/estoque/urgência/escassez/material/especificação/resultado; descrever identidade/aparência facial do avatar.

Responda SOMENTE JSON válido com:
{formato,duracao_total,gerador,avatar,ambiente,estilo_copy,intensidade,estrutura_escolhida,decisoes_diretor:{formato,estilo,intensidade,ambiente,avatar,motivo},conceito,angulo_escolhido,angulos_venda:[{nome,ideia,promessa_permitida,melhor_visual}],hook_escolhido,hook_lab:[{tipo,hook,forca_0_100}],hooks_alternativos:[3],timeline_visual:[{inicio_seg,fim_seg,objetivo_visual,acao,camera,produto_em_foco}],takes:[{take,titulo,duracao_segundos,objetivo,cena,acao,enquadramento,fala,texto_tela,continuity_key,prompt_video},{take,titulo,duracao_segundos,objetivo,cena,acao,enquadramento,fala,texto_tela,continuity_key,prompt_video},{take,titulo,duracao_segundos,objetivo,cena,acao,enquadramento,fala,texto_tela,continuity_key,prompt_video}],falhas_criativo:[{area,severidade,problema,correcao}],saturacao_copy:{nota,frases_genericas,ajuste},diagnostico:{hook,clareza,demonstracao,retencao,cta,sugestao_melhoria}}.
ANÁLISE:${JSON.stringify(analysis)}`;
}

app.post('/api/generate',auth,async(r,s)=>{try{
 const b=r.body||{},analysis=b.analysis;if(!analysis)return s.status(400).json({error:'Analise um produto primeiro.'});
 const count=[1,3,5].includes(Number(b.batchCount))?Number(b.batchCount):1;
 const base={analysis,duration:Number(b.duration)||15,generator:b.generator||'Genérico',avatar:b.avatar||'Automático',environment:b.environment||'Automático',copyStyle:b.copyStyle||'Natural',intensity:b.intensity||'Equilibrado',optimizeSales:b.optimizeSales!==false,creativeDirector:!!b.creativeDirector,ugcRealism:b.ugcRealism!==false,continuityLock:b.continuityLock!==false,productFirst:b.productFirst!==false,angleMode:b.angleMode||'Automático'};
 if(!base.creativeDirector&&!['UGC','POV'].includes(b.format))return s.status(400).json({error:'Escolha UGC ou POV, ou ative Creative Director.'});
 const results=[];
 for(let i=0;i<count;i++){
   const p=buildPrompt({...base,format:b.format,variantLabel:`${(Number(b.variation)||1)+i}`});
   let c=normalizeCreative(await gemini(p,[],7600));
   c.formato=c.formato||b.format||c.decisoes_diretor?.formato||'UGC';c.estilo_copy=c.estilo_copy||base.copyStyle;c.intensidade=c.intensidade||base.intensity;
   c.recursos={creativeDirector:base.creativeDirector,ugcRealism:base.ugcRealism,continuityLock:base.continuityLock,productFirst:base.productFirst};
   results.push(c);
 }
 const st=await read(),ids=[];for(const c of results){const id=crypto.randomUUID();ids.push(id);st.creatives.unshift({id,createdAt:new Date().toISOString(),productId:b.productId||null,productName:analysis.produto||'Produto',creative:c,analysisSnapshot:analysis})}await write(st);
 s.json(count===1?{...results[0],_creativeId:ids[0]}:{batch:true,creatives:results.map((x,i)=>({...x,_creativeId:ids[i]}))});
}catch(e){console.error(e);s.status(500).json({error:e.message||'Falha ao gerar.'})}});

app.post('/api/improve',auth,async(r,s)=>{try{
 const {analysis,creative}=r.body||{};if(!analysis||!creative)return s.status(400).json({error:'Criativo e análise são obrigatórios.'});
 const prompt=`Você é editor de performance. Corrija automaticamente SOMENTE os pontos fracos deste criativo, preservando produto, fatos, conceito que já funciona, duração e continuidade. Priorize falhas_criativo de severidade alta/média, sugestao_melhoria do diagnóstico e saturacao_copy. Fortaleça hook, demonstração, clareza, retenção e CTA sem inventar fatos, preço, desconto, urgência, escassez ou cor do produto. SOMENTE campo fala pode ser pronunciado; preserve a regra explícita de áudio em cada prompt_video. Gere timeline_visual, hook_lab, angulos_venda, falhas_criativo, saturacao_copy e diagnostico novamente. Responda no MESMO formato JSON do criativo recebido, sem comentários. ANÁLISE:${JSON.stringify(analysis)} CRIATIVO:${JSON.stringify(creative)}`;
 let c=normalizeCreative(await gemini(prompt,[],7600));
 const st=await read(),id=crypto.randomUUID();st.creatives.unshift({id,createdAt:new Date().toISOString(),productId:null,productName:analysis.produto||'Produto',creative:c,analysisSnapshot:analysis,improvedFrom:true});await write(st);s.json({...c,_creativeId:id,_improved:true});
}catch(e){console.error(e);s.status(500).json({error:e.message||'Falha ao corrigir criativo.'})}});

app.get('/api/products',auth,async(_,s)=>s.json((await read()).products.slice(0,200)));
app.get('/api/history',auth,async(_,s)=>s.json((await read()).creatives.slice(0,200)));
app.get('/api/health',(_,s)=>s.json({ok:true,provider:'google-gemini',model,apiConfigured:!!process.env.GEMINI_API_KEY,dataDirConfigured:!!process.env.DATA_DIR}));
app.listen(port,()=>console.log(`10K Prompt na porta ${port} com Gemini ${model}`));
