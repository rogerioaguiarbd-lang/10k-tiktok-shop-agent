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
app.use(express.json({limit:'5mb'}));
app.use(express.static(path.join(dir,'public')));
const read=async()=>JSON.parse(await fs.readFile(storeFile,'utf8'));
const write=async d=>{const tmp=storeFile+'.tmp';await fs.writeFile(tmp,JSON.stringify(d,null,2));await fs.rename(tmp,storeFile)};
const cookies=r=>Object.fromEntries((r.headers.cookie||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return[x.slice(0,i),decodeURIComponent(x.slice(i+1))]}));
function token(exp){const p=`admin.${exp}`;return `${p}.${crypto.createHmac('sha256',secret).update(p).digest('hex')}`}
function valid(t=''){const a=t.split('.');if(a.length!==3||a[0]!=='admin'||Date.now()>Number(a[1]))return false;return a[2]===crypto.createHmac('sha256',secret).update(`admin.${a[1]}`).digest('hex')}
const auth=(r,s,n)=>valid(cookies(r).session)?n():s.status(401).json({error:'Faça login para continuar.'});

app.post('/api/login',(r,s)=>{if(String(r.body?.password||'')!==password)return s.status(401).json({error:'Senha inválida.'});const exp=Date.now()+604800000;s.setHeader('Set-Cookie',`session=${encodeURIComponent(token(exp))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.NODE_ENV==='production'?'; Secure':''}`);s.json({ok:true})});
app.post('/api/logout',(_,s)=>{s.setHeader('Set-Cookie','session=; Path=/; Max-Age=0');s.json({ok:true})});
app.get('/api/me',(r,s)=>s.json({authenticated:valid(cookies(r).session)}));

async function gemini(prompt,extraParts=[],maxOutputTokens=4096){
  if(!process.env.GEMINI_API_KEY)throw Error('GEMINI_API_KEY não configurada no servidor.');
  const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt},...extraParts]}],generationConfig:{responseMimeType:'application/json',temperature:.45,maxOutputTokens}})});
  const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data?.error?.message||`Erro Gemini ${res.status}`);
  const text=(data?.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim();if(!text)throw Error('A IA não retornou conteúdo.');
  try{return JSON.parse(text.replace(/^```json\s*/i,'').replace(/```$/,'').trim())}catch{throw Error('Resposta inválida da IA. Tente novamente.')}
}

app.post('/api/analyze',auth,upload.single('image'),async(r,s)=>{try{
  if(!r.file)return s.status(400).json({error:'Envie um print.'});
  const imageHash=crypto.createHash('sha256').update(r.file.buffer).digest('hex');
  const st=await read();
  const cached=st.products.find(p=>p.sourceImageHash===imageHash&&p.analysis);
  if(cached)return s.json({...cached.analysis,_productId:cached.id,_cached:true});
  const prompt='Você é especialista em TikTok Shop. Analise somente o PRODUTO e informações comerciais visíveis no print, com inferências conservadoras. Ignore características humanas. Não invente preço, desconto, estoque, avaliações, certificações, material, especificações ou alegações. Responda SOMENTE JSON válido em pt-BR com: produto,categoria,marca,descricao_visual,caracteristicas(array),beneficios(array),diferenciais(array),publico,problema,beneficio_principal,demonstracao_visual,angulo,ambiente_recomendado,tipo_hook_recomendado,confianca,observacoes.';
  const a=await gemini(prompt,[{inline_data:{mime_type:r.file.mimetype,data:r.file.buffer.toString('base64')}}],2048);
  const id=crypto.randomUUID();st.products.unshift({id,createdAt:new Date().toISOString(),sourceImageHash:imageHash,analysis:a});await write(st);s.json({...a,_productId:id,_cached:false})
}catch(e){console.error(e);s.status(500).json({error:e.message||'Falha na análise.'})}});

app.post('/api/product-prompt',auth,async(r,s)=>{try{const {analysis}=r.body||{};if(!analysis)return s.status(400).json({error:'Analise um produto primeiro.'});const prompt=`Crie UM prompt de fotografia publicitária para TikTok Shop em pt-BR usando SOMENTE esta análise. Gere APENAS O PRODUTO, sem pessoas/avatar/mãos/cor do produto. Não invente atributos, materiais, textos, logos, preço, desconto ou acessórios. Vertical 9:16, realista, iluminação natural profissional, produto protagonista, cenário coerente. JSON: {prompt_imagem_produto}. ANÁLISE:${JSON.stringify(analysis)}`;s.json(await gemini(prompt,[],1536))}catch(e){console.error(e);s.status(500).json({error:e.message||'Falha ao gerar prompt do produto.'})}});

app.post('/api/generate',auth,async(r,s)=>{try{
 const {analysis,format,duration=15,generator='Genérico',avatar='Automático',environment='Automático',copyStyle='Natural',optimizeSales=true,intensity='Equilibrado',variation=1,productId=null}=r.body||{};
 if(!analysis||!['UGC','POV'].includes(format))return s.status(400).json({error:'Escolha UGC ou POV.'});
 const estilos=['Natural','Autoridade','Amigável','Urgente / Oferta','Curiosidade / Desconto','Mix inteligente'];const estilo=estilos.includes(copyStyle)?copyStyle:'Natural';
 const intensidades=['Suave','Equilibrado','Agressivo'];const intensidade=intensidades.includes(intensity)?intensity:'Equilibrado';
 const styleRule=estilo==='Mix inteligente'?`MIX INTELIGENTE: combine estilos coerentemente. Take 1 prioriza retenção/hook; Take 2 clareza+demonstração+benefício; Take 3 recomendação natural+CTA. Adapte ao produto.`:`ESTILO ${estilo}: Natural=espontâneo; Autoridade=seguro/objetivo; Amigável=próximo; Urgente / Oferta=direto sem inventar oferta; Curiosidade / Desconto=curiosidade e só citar desconto/preço se sustentado. Aplique ao hook, A/B/C e 3 falas.`;
 const optimizeRule=optimizeSales?'OTIMIZE PARA VENDAS: hook forte, benefício fiel, demonstração clara, ritmo TikTok e CTA natural.':'Sem ênfase extra em conversão.';
 const prompt=`Diretor criativo/copywriter TikTok Shop Brasil. Crie UM anúncio vertical 9:16 de ${duration}s, ${format}, gerador ${generator}, avatar ${avatar}, ambiente ${environment}, usando SOMENTE a análise.
${styleRule}\n${optimizeRule}\nINTENSIDADE ${intensidade}: Suave=leve; Equilibrado=persuasivo sem exageros; Agressivo=mais direto/energético. Nunca invente preço, desconto, urgência, escassez, benefício, resultado ou promessa.
CONTINUIDADE: 3 takes são UMA copy contínua: T1 hook; T2 corpo/demonstração/benefícios; T3 CTA natural ao carrinho laranja. Mesmo cenário, avatar, produto e iluminação; cortes apenas naturais.
A/B/C: exatamente 3 aberturas diferentes para substituir apenas o início do T1, todas compatíveis com o MESMO T2/T3.
REGRAS: tudo em pt-BR; não descreva aparência/identidade do avatar; não mencione cor do produto. SOMENTE campo fala pode ser pronunciado. Cena/ação/enquadramento/objetivo/texto_tela/prompt são direção silenciosa. Cada prompt_video deve conter: “ÁUDIO: pronunciar exclusivamente esta fala: [fala exata]. Não narrar nem pronunciar nenhuma outra instrução deste prompt.” fala = só palavras exatas, sem rótulos/instruções/marcadores/reticências nas pontas. Durações somam ${duration}s.
DIAGNÓSTICO CRIATIVO: notas inteiras 0-100 para hook,clareza,demonstracao,retencao,cta; potencial_venda=média. 90+ só excepcional. Uma sugestao_melhoria curta/acionável. É diagnóstico criativo, não previsão/garantia.
JSON SOMENTE:{formato,duracao_total,gerador,avatar,ambiente,conceito,hook_escolhido,hooks_alternativos:[3],takes:[{take,titulo,duracao_segundos,objetivo,cena,acao,enquadramento,fala,texto_tela,prompt_video},{take,titulo,duracao_segundos,objetivo,cena,acao,enquadramento,fala,texto_tela,prompt_video},{take,titulo,duracao_segundos,objetivo,cena,acao,enquadramento,fala,texto_tela,prompt_video}],diagnostico:{potencial_venda,hook,clareza,demonstracao,retencao,cta,sugestao_melhoria}}. Variação ${variation}. ANÁLISE:${JSON.stringify(analysis)}`;
 const c=await gemini(prompt,[],4600);c.estilo_copy=estilo;c.otimizar_vendas=!!optimizeSales;c.intensidade=intensidade;c.aberturas_abc=(c.hooks_alternativos||[]).slice(0,3).map((hook,i)=>({letra:['A','B','C'][i],hook}));
 if(Array.isArray(c.takes))c.takes=c.takes.map(t=>({...t,fala:String(t.fala||'').replace(/^\s*\.{2,}\s*/,'').replace(/\s*\.{2,}\s*$/,'').trim()}));
 if(c.diagnostico){const keys=['hook','clareza','demonstracao','retencao','cta'];for(const k of keys)c.diagnostico[k]=Math.max(0,Math.min(100,Math.round(Number(c.diagnostico[k])||0)));c.diagnostico.potencial_venda=Math.round(keys.reduce((n,k)=>n+c.diagnostico[k],0)/keys.length);c.diagnostico.aviso='Diagnóstico criativo, não é previsão nem garantia de vendas.'}
 const st=await read(),id=crypto.randomUUID();st.creatives.unshift({id,createdAt:new Date().toISOString(),productId,productName:analysis.produto||'Produto',creative:c,analysisSnapshot:analysis});await write(st);s.json({...c,_creativeId:id})
}catch(e){console.error(e);s.status(500).json({error:e.message||'Falha ao gerar.'})}});

app.get('/api/products',auth,async(_,s)=>s.json((await read()).products.slice(0,100)));
app.get('/api/history',auth,async(_,s)=>s.json((await read()).creatives.slice(0,100)));
app.get('/api/health',(_,s)=>s.json({ok:true,provider:'google-gemini',model,apiConfigured:!!process.env.GEMINI_API_KEY,dataDirConfigured:!!process.env.DATA_DIR}));
app.listen(port,()=>console.log(`10K Prompt na porta ${port} com Gemini ${model}`));
