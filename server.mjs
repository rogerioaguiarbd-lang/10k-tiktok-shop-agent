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
  const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
    method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},
    body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt},...extraParts]}],generationConfig:{responseMimeType:'application/json'}})
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data?.error?.message||`Erro Gemini ${res.status}`);
  const text=(data?.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim();
  if(!text)throw Error('A IA não retornou conteúdo.');
  try{return JSON.parse(text.replace(/^```json\s*/i,'').replace(/```$/,'').trim())}catch{throw Error('Resposta inválida da IA. Tente novamente.')}
}

app.post('/api/analyze',auth,upload.single('image'),async(r,s)=>{try{
  if(!r.file)return s.status(400).json({error:'Envie um print.'});
  const prompt='Você é especialista em TikTok Shop. Analise somente o PRODUTO e as informações comerciais visíveis no print, usando inferências conservadoras. Ignore características físicas de qualquer pessoa que apareça na imagem. Não invente preço, desconto, estoque, avaliações, certificações, material, especificações ou alegações. Responda SOMENTE JSON válido e escreva TODO o conteúdo exclusivamente em português do Brasil. Campos: produto,categoria,marca,descricao_visual,caracteristicas(array),beneficios(array),diferenciais(array),publico,problema,beneficio_principal,demonstracao_visual,angulo,ambiente_recomendado,tipo_hook_recomendado,confianca,observacoes.';
  const a=await gemini(prompt,[{inline_data:{mime_type:r.file.mimetype,data:r.file.buffer.toString('base64')}}]);
  const st=await read(),id=crypto.randomUUID();st.products.unshift({id,createdAt:new Date().toISOString(),analysis:a});await write(st);s.json({...a,_productId:id});
}catch(e){console.error(e);s.status(500).json({error:e.message||'Falha na análise.'})}});

app.post('/api/product-prompt',auth,async(r,s)=>{try{
  const {analysis}=r.body||{};
  if(!analysis)return s.status(400).json({error:'Analise um produto primeiro.'});
  const prompt=`Você é especialista em fotografia publicitária de produtos para TikTok Shop. Com base SOMENTE na análise abaixo, crie UM prompt de imagem em português do Brasil para gerar APENAS O PRODUTO, sem pessoas, avatar, mãos ou partes do corpo. Preserve somente atributos sustentados pela análise, MAS NÃO DESCREVA NEM MENCIONE NENHUMA COR DO PRODUTO. Não invente características, materiais, textos, logos, preço, desconto ou acessórios inexistentes. Composição vertical 9:16, produto protagonista, realista, iluminação profissional natural, fotografia de e-commerce premium e cenário coerente. Não adicione texto gráfico, exceto textos já presentes na embalagem original. Responda SOMENTE JSON válido no formato {prompt_imagem_produto}. ANÁLISE: ${JSON.stringify(analysis)}`;
  s.json(await gemini(prompt));
}catch(e){console.error(e);s.status(500).json({error:e.message||'Falha ao gerar prompt do produto.'})}});

app.post('/api/generate',auth,async(r,s)=>{try{
  const {analysis,format,duration=15,generator='Genérico',avatar='Automático',environment='Automático',copyStyle='Natural',optimizeSales=true,intensity='Equilibrado',variation=1,productId=null}=r.body||{};
  if(!analysis||!['UGC','POV'].includes(format))return s.status(400).json({error:'Escolha UGC ou POV.'});
  const estilos=['Natural','Autoridade','Amigável','Urgente / Oferta','Curiosidade / Desconto','Mix inteligente'];
  const estilo=estilos.includes(copyStyle)?copyStyle:'Natural';
  const intensidades=['Suave','Equilibrado','Agressivo'];
  const intensidade=intensidades.includes(intensity)?intensity:'Equilibrado';
  const styleRule=estilo==='Mix inteligente'
    ? `MIX INTELIGENTE: combine estilos de forma coerente entre os takes, mantendo UMA ÚNICA narrativa contínua. Take 1 deve usar o tipo de hook que melhor maximize retenção para este produto, podendo privilegiar curiosidade. Take 2 deve privilegiar clareza, demonstração e autoridade/benefício. Take 3 deve soar como recomendação natural e conduzir ao CTA. Isto é orientação, não sequência rígida: adapte ao produto e ao contexto.`
    : `ESTILO DA COPY: ${estilo}. Natural=espontâneo e crível; Autoridade=seguro e objetivo; Amigável=próximo e leve; Urgente / Oferta=direto para ação sem inventar preço, desconto, estoque, prazo ou promoção; Curiosidade / Desconto=abrir com curiosidade e só citar desconto, preço ou promoção se estiver sustentado pela análise. Adapte o hook principal, as aberturas A/B/C e TODAS as falas dos 3 takes ao estilo.`;
  const optimizeRule=optimizeSales
    ? 'OTIMIZAÇÃO PARA VENDAS: priorize hook forte, benefício principal fiel à análise, demonstração visual clara, ritmo adequado ao TikTok e CTA natural e coerente.'
    : 'OTIMIZAÇÃO PARA VENDAS DESLIGADA: mantenha copy neutra, sem ênfase extra em conversão.';

  const prompt=`Você é um diretor criativo e copywriter especialista em TikTok Shop Brasil. Usando SOMENTE a análise do produto abaixo, crie UM ÚNICO anúncio vertical 9:16 de ${duration}s, no formato ${format}, gerador ${generator}, avatar ${avatar}, ambiente ${environment}.

${styleRule}
${optimizeRule}
INTENSIDADE: ${intensidade}. Suave=leve e sem pressão; Equilibrado=persuasivo sem exageros; Agressivo=mais direto e energético. Em qualquer intensidade, NUNCA invente preço, desconto, urgência, escassez, benefício, resultado ou promessa não sustentados pela análise.

REGRA PRINCIPAL: os 3 takes NÃO são três anúncios independentes. São partes consecutivas da MESMA copy, formando uma fala contínua. O fim de um take deve conectar naturalmente ao próximo, sem reiniciar a apresentação nem repetir o hook.

ESTRUTURA:
TAKE 1 — HOOK: abrir forte, interromper o scroll e introduzir produto ou problema/desejo. Não concluir a mensagem.
TAKE 2 — CORPO: continuar diretamente o Take 1, demonstrar o produto e explicar benefícios/diferenciais permitidos pela análise. Terminar preparando o CTA.
TAKE 3 — CTA: continuar o Take 2 e concluir a mesma copy com recomendação natural e condução ao carrinho laranja.

ABERTURAS A/B/C — OBRIGATÓRIO: gere exatamente 3 alternativas de abertura para substituir apenas a fala/hook inicial do Take 1. Rotule mentalmente como A, B e C. Todas devem ser compatíveis com o MESMO Take 2 e Take 3, sem exigir mudanças no corpo ou CTA. Elas devem variar o ângulo criativo, não apenas trocar sinônimos.

IDIOMA: absolutamente todo conteúdo em português do Brasil, natural para TikTok.

REGRA DO AVATAR: NÃO descreva características físicas, faciais ou identidade do avatar. Refira-se apenas como “o avatar”, “a pessoa” ou “o apresentador”. Foque atuação, gestos, interação com produto, câmera, cenário e iluminação.

REGRA DE COR DO PRODUTO: NÃO descreva, mencione ou repita cor do produto em nenhum campo. Ignore qualquer cor presente na análise.

CONSISTÊNCIA DE CENÁRIO: os três takes devem acontecer no MESMO cenário físico, mantendo elementos, iluminação e atmosfera. Se o ambiente for ${environment}, mantenha-o do início ao fim; se Automático, escolha um único cenário coerente.

CONTINUIDADE VISUAL: mesmo avatar, produto, roupa/referência, iluminação e identidade nos três takes. O Take 2 começa imediatamente após o Take 1 e o Take 3 imediatamente após o Take 2.

CONTINUIDADE DE CÂMERA: mudanças de enquadramento apenas como movimentos ou cortes naturais no mesmo ambiente.

REGRA DE ÁUDIO/FALA — PRIORITÁRIA: em cada take, SOMENTE o conteúdo do campo fala pode ser pronunciado. cena, ação, enquadramento, objetivo, texto_tela e instruções do prompt_video são DIREÇÃO VISUAL SILENCIOSA e nunca devem ser narrados. O campo prompt_video deve incluir explicitamente: “ÁUDIO: pronunciar exclusivamente esta fala: [fala exata]. Não narrar nem pronunciar nenhuma outra instrução deste prompt.” O campo fala deve conter apenas as palavras exatas a serem ditas, sem rótulos, instruções, parênteses de direção, marcadores ou reticências no início/fim.

A soma das durações deve ser ${duration}s e as falas devem caber naturalmente no tempo.

Não invente fatos, benefícios, preço, desconto, urgência, avaliações, materiais, especificações ou resultados não sustentados pela análise.

Responda SOMENTE JSON válido neste formato: {formato,duracao_total,gerador,avatar,ambiente,conceito,hook_escolhido,hooks_alternativos:[3],takes:[{take,titulo,duracao_segundos,objetivo,cena,acao,enquadramento,fala,texto_tela,prompt_video},{take,titulo,duracao_segundos,objetivo,cena,acao,enquadramento,fala,texto_tela,prompt_video},{take,titulo,duracao_segundos,objetivo,cena,acao,enquadramento,fala,texto_tela,prompt_video}]}. Variação ${variation}. ANÁLISE: ${JSON.stringify(analysis)}`;

  const c=await gemini(prompt);
  c.estilo_copy=estilo;
  c.otimizar_vendas=!!optimizeSales;
  c.intensidade=intensidade;
  c.aberturas_abc=(c.hooks_alternativos||[]).slice(0,3).map((hook,i)=>({letra:['A','B','C'][i],hook}));
  if(Array.isArray(c.takes))c.takes=c.takes.map(t=>({...t,fala:String(t.fala||'').replace(/^\s*\.{2,}\s*/,'').replace(/\s*\.{2,}\s*$/,'').trim()}));
  const st=await read(),id=crypto.randomUUID();
  st.creatives.unshift({id,createdAt:new Date().toISOString(),productId,productName:analysis.produto||'Produto',creative:c,analysisSnapshot:analysis});
  await write(st);s.json({...c,_creativeId:id});
}catch(e){console.error(e);s.status(500).json({error:e.message||'Falha ao gerar.'})}});

app.get('/api/products',auth,async(_,s)=>s.json((await read()).products.slice(0,100)));
app.get('/api/history',auth,async(_,s)=>s.json((await read()).creatives.slice(0,100)));
app.get('/api/health',(_,s)=>s.json({ok:true,provider:'google-gemini',model,apiConfigured:!!process.env.GEMINI_API_KEY}));
app.listen(port,()=>console.log(`10K Prompt na porta ${port} com Gemini ${model}`));
