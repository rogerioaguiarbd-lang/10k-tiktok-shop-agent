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
const dataDir=path.join(dir,'data');
const storeFile=path.join(dataDir,'store.json');
await fs.mkdir(dataDir,{recursive:true});
try{await fs.access(storeFile)}catch{await fs.writeFile(storeFile,JSON.stringify({products:[],creatives:[]}))}

const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:12*1024*1024}});
app.use(express.json({limit:'5mb'}));
app.use(express.static(path.join(dir,'public')));
const read=async()=>JSON.parse(await fs.readFile(storeFile,'utf8'));
const write=d=>fs.writeFile(storeFile,JSON.stringify(d,null,2));
const cookies=r=>Object.fromEntries((r.headers.cookie||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return[x.slice(0,i),decodeURIComponent(x.slice(i+1))]}));
function token(exp){const p=`admin.${exp}`;return `${p}.${crypto.createHmac('sha256',secret).update(p).digest('hex')}`}
function valid(t=''){const a=t.split('.');if(a.length!==3||a[0]!=='admin'||Date.now()>Number(a[1]))return false;return a[2]===crypto.createHmac('sha256',secret).update(`admin.${a[1]}`).digest('hex')}
const auth=(r,s,n)=>valid(cookies(r).session)?n():s.status(401).json({error:'Faça login para continuar.'});

app.post('/api/login',(r,s)=>{if(String(r.body?.password||'')!==password)return s.status(401).json({error:'Senha inválida.'});const exp=Date.now()+604800000;s.setHeader('Set-Cookie',`session=${encodeURIComponent(token(exp))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.NODE_ENV==='production'?'; Secure':''}`);s.json({ok:true})});
app.post('/api/logout',(_,s)=>{s.setHeader('Set-Cookie','session=; Path=/; Max-Age=0');s.json({ok:true})});
app.get('/api/me',(r,s)=>s.json({authenticated:valid(cookies(r).session)}));

async function gemini(prompt,extraParts=[]){
  if(!process.env.GEMINI_API_KEY)throw Error('GEMINI_API_KEY não configurada no servidor.');
  const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt},...extraParts]}],generationConfig:{responseMimeType:'application/json'}})});
  const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data?.error?.message||`Erro Gemini ${res.status}`);
  const text=(data?.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim();if(!text)throw Error('A IA não retornou conteúdo.');
  try{return JSON.parse(text.replace(/^```json\s*/i,'').replace(/```$/,'').trim())}catch{throw Error('Resposta inválida da IA. Tente novamente.')}
}

app.post('/api/analyze',auth,upload.single('image'),async(r,s)=>{try{if(!r.file)return s.status(400).json({error:'Envie um print.'});const prompt='Você é especialista em TikTok Shop. Analise somente o PRODUTO e as informações comerciais visíveis no print, usando inferências conservadoras. Ignore características físicas de qualquer pessoa que apareça na imagem. Não invente preço, desconto, estoque, avaliações, certificações, material, especificações ou alegações. Responda SOMENTE JSON válido e escreva TODO o conteúdo exclusivamente em português do Brasil. Campos: produto,categoria,marca,descricao_visual,caracteristicas(array),beneficios(array),diferenciais(array),publico,problema,beneficio_principal,demonstracao_visual,angulo,ambiente_recomendado,tipo_hook_recomendado,confianca,observacoes.';const a=await gemini(prompt,[{inline_data:{mime_type:r.file.mimetype,data:r.file.buffer.toString('base64')}}]);const st=await read(),id=crypto.randomUUID();st.products.unshift({id,createdAt:new Date().toISOString(),analysis:a});await write(st);s.json({...a,_productId:id})}catch(e){console.error(e);s.status(500).json({error:e.message||'Falha na análise.'})}});

app.post('/api/product-prompt',auth,async(r,s)=>{try{const {analysis}=r.body||{};if(!analysis)return s.status(400).json({error:'Analise um produto primeiro.'});const prompt=`Você é especialista em fotografia publicitária de produtos para TikTok Shop. Com base SOMENTE na análise abaixo, crie UM prompt de imagem em português do Brasil para gerar APENAS O PRODUTO, sem pessoas, avatar, mãos ou partes do corpo. Preserve somente atributos sustentados pela análise, MAS NÃO DESCREVA NEM MENCIONE NENHUMA COR DO PRODUTO. Não invente características, materiais, textos, logos, preço, desconto ou acessórios inexistentes. Composição vertical 9:16, produto protagonista, realista, iluminação profissional natural, fotografia de e-commerce premium e cenário coerente. Não adicione texto gráfico, exceto textos já presentes na embalagem original. Responda SOMENTE JSON válido no formato {prompt_imagem_produto}. ANÁLISE: ${JSON.stringify(analysis)}`;s.json(await gemini(prompt))}catch(e){console.error(e);s.status(500).json({error:e.message||'Falha ao gerar prompt do produto.'})}});

app.post('/api/generate',auth,async(r,s)=>{try{
 const {analysis,format,duration=15,generator='Genérico',avatar='Automático',environment='Automático',copyStyle='Natural',optimizeSales=true,intensity='Equilibrado',variation=1,productId=null}=r.body||{};
 if(!analysis||!['UGC','POV'].includes(format))return s.status(400).json({error:'Escolha UGC ou POV.'});
 const estilos=['Natural','Autoridade','Amigável','Urgente / Oferta','Curiosidade / Desconto','Mix inteligente'];const estilo=estilos.includes(copyStyle)?copyStyle:'Natural';
 const intensidades=['Suave','Equilibrado','Agressivo'];const intensidade=intensidades.includes(intensity)?intensity:'Equilibrado';
 const styleRule=estilo==='Mix inteligente'?`MIX INTELIGENTE: combine estilos de forma coerente entre os takes, mantendo UMA ÚNICA narrativa contínua. Take 1 deve usar o tipo de hook que melhor maximize retenção para este produto, podendo privilegiar curiosidade. Take 2 deve privilegiar clareza, demonstração e autoridade/benefício. Take 3 deve soar como recomendação natural e conduzir ao CTA. Isto é orientação, não sequência rígida: adapte ao produto e ao contexto.`:`ESTILO DA COPY: ${estilo}. Natural=espontâneo e crível; Autoridade=seguro e objetivo; Amigável=próximo e leve; Urgente / Oferta=direto para ação sem inventar preço, desconto, estoque, prazo ou promoção; Curiosidade / Desconto=abrir com curiosidade e só citar desconto, preço ou promoção se estiver sustentado pela análise. Adapte o hook principal, as aberturas A/B/C e TODAS as falas dos 3 takes ao estilo.`;
 const optimizeRule=optimizeSales?'OTIMIZAÇÃO PARA VENDAS: priorize hook forte, benefício principal fiel à análise, demonstração visual clara, ritmo adequado ao TikTok e CTA natural e coerente.':'OTIMIZAÇÃO PARA VENDAS DESLIGADA: mantenha copy neutra, sem ênfase extra em conversão.';
 const prompt=`Você é um diretor criativo e copywriter especialista em TikTok Shop Brasil. Usando SOMENTE a análise do produto abaixo, crie UM ÚNICO anúncio vertical 9:16 de ${duration}s, no formato ${format}, gerador ${generator}, avatar ${avatar}, ambiente ${environment}.
${styleRule}\n${optimizeRule}\nINTENSIDADE: ${intensidade}. Suave=leve e sem pressão; Equilibrado=persuasivo sem exageros; Agressivo=mais direto e energético. Em qualquer intensidade, NUNCA invente preço, desconto, urgência, escassez, benefício, resultado ou promessa não sustentados pela análise.
REGRA PRINCIPAL: os 3 takes são partes consecutivas da MESMA copy. Take 1=HOOK forte; Take 2=CORPO/demonstração/benefícios; Take 3=CTA natural ao carrinho laranja. O fim de cada take conecta naturalmente ao próximo.
ABERTURAS A/B/C: gere exatamente 3 alternativas de abertura para substituir apenas a fala/hook inicial do Take 1. Todas compatíveis com o MESMO Take 2 e Take 3 e com ângulos criativos distintos.
IDIOMA: todo conteúdo em português do Brasil. NÃO descreva características físicas/faciais/identidade do avatar. NÃO descreva nem mencione cor do produto. Mantenha mesmo cenário, avatar, produto, iluminação e continuidade nos três takes.
REGRA DE ÁUDIO/FALA: SOMENTE o campo fala pode ser pronunciado. Cena, ação, enquadramento, objetivo, texto_tela e instruções são direção visual silenciosa. prompt_video deve dizer: “ÁUDIO: pronunciar exclusivamente esta fala: [fala exata]. Não narrar nem pronunciar nenhuma outra instrução deste prompt.” fala contém somente palavras exatas a serem ditas, sem rótulos/instruções/marcadores/reticências no início/fim.
A soma das durações deve ser ${duration}s. Não invente fatos, benefícios, preço, desconto, urgência, avaliações, materiais, especificações ou resultados.
DIAGNÓSTICO CRIATIVO — OBRIGATÓRIO: depois de criar o anúncio, avalie o próprio criativo de 0 a 100. Isto NÃO é previsão nem garantia de vendas. Dê notas inteiras de 0 a 100 para hook, clareza, demonstracao, retencao e cta. Calcule potencial_venda como a média inteira dessas cinco notas. Seja criterioso: 90+ somente para criativos excepcionalmente fortes. Gere também uma única sugestao_melhoria curta, concreta e acionável que indique a melhoria de maior impacto. Não altere as notas para agradar o usuário.
Responda SOMENTE JSON válido: {formato,duracao_total,gerador,avatar,ambiente,conceito,hook_escolhido,hooks_alternativos:[3],takes:[{take,titulo,duracao_segundos,objetivo,cena,acao,enquadramento,fala,texto_tela,prompt_video},{take,titulo,duracao_segundos,objetivo,cena,acao,enquadramento,fala,texto_tela,prompt_video},{take,titulo,duracao_segundos,objetivo,cena,acao,enquadramento,fala,texto_tela,prompt_video}],diagnostico:{potencial_venda,hook,clareza,demonstracao,retencao,cta,sugestao_melhoria}}. Variação ${variation}. ANÁLISE: ${JSON.stringify(analysis)}`;
 const c=await gemini(prompt);c.estilo_copy=estilo;c.otimizar_vendas=!!optimizeSales;c.intensidade=intensidade;c.aberturas_abc=(c.hooks_alternativos||[]).slice(0,3).map((hook,i)=>({letra:['A','B','C'][i],hook}));
 if(Array.isArray(c.takes))c.takes=c.takes.map(t=>({...t,fala:String(t.fala||'').replace(/^\s*\.{2,}\s*/,'').replace(/\s*\.{2,}\s*$/,'').trim()}));
 if(c.diagnostico){const keys=['hook','clareza','demonstracao','retencao','cta'];for(const k of keys)c.diagnostico[k]=Math.max(0,Math.min(100,Math.round(Number(c.diagnostico[k])||0)));c.diagnostico.potencial_venda=Math.round(keys.reduce((n,k)=>n+c.diagnostico[k],0)/keys.length);c.diagnostico.aviso='Diagnóstico criativo, não é previsão nem garantia de vendas.'}
 const st=await read(),id=crypto.randomUUID();st.creatives.unshift({id,createdAt:new Date().toISOString(),productId,productName:analysis.produto||'Produto',creative:c,analysisSnapshot:analysis});await write(st);s.json({...c,_creativeId:id})
}catch(e){console.error(e);s.status(500).json({error:e.message||'Falha ao gerar.'})}});

app.get('/api/products',auth,async(_,s)=>s.json((await read()).products.slice(0,100)));
app.get('/api/history',auth,async(_,s)=>s.json((await read()).creatives.slice(0,100)));
app.get('/api/health',(_,s)=>s.json({ok:true,provider:'google-gemini',model,apiConfigured:!!process.env.GEMINI_API_KEY}));
app.listen(port,()=>console.log(`10K Prompt na porta ${port} com Gemini ${model}`));
