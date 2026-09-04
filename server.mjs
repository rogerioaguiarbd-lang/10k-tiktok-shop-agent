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
  const prompt='Você é especialista em TikTok Shop. Analise somente o que está visível no print e use inferências conservadoras. Não invente preço, desconto, estoque, avaliações, certificações, material, especificações ou alegações. Responda SOMENTE JSON válido em português BR com: produto,categoria,marca,descricao_visual,caracteristicas(array),beneficios(array),diferenciais(array),publico,problema,beneficio_principal,demonstracao_visual,angulo,ambiente_recomendado,tipo_hook_recomendado,confianca,observacoes.';
  const a=await gemini(prompt,[{inline_data:{mime_type:r.file.mimetype,data:r.file.buffer.toString('base64')}}]);
  const st=await read(),id=crypto.randomUUID();st.products.unshift({id,createdAt:new Date().toISOString(),analysis:a});await write(st);s.json({...a,_productId:id});
}catch(e){console.error(e);s.status(500).json({error:e.message||'Falha na análise.'})}});

app.post('/api/generate',auth,async(r,s)=>{try{
  const {analysis,format,duration=15,generator='Genérico',avatar='Automático',environment='Automático',variation=1,productId=null}=r.body||{};
  if(!analysis||!['UGC','POV'].includes(format))return s.status(400).json({error:'Escolha UGC ou POV.'});
  const prompt=`Você é diretor criativo de TikTok Shop. Usando somente a análise abaixo, crie anúncio vertical 9:16 de ${duration}s, formato ${format}, gerador ${generator}, avatar ${avatar}, ambiente ${environment}. Exatamente 3 takes: 1 hook fortíssimo; 2 demonstração e benefícios; 3 CTA natural indicando o carrinho laranja sem pressão. Não invente fatos. Crie 1 hook principal e exatamente 3 alternativas. Responda SOMENTE JSON válido: {formato,duracao_total,gerador,avatar,ambiente,conceito,hook_escolhido,hooks_alternativos:[3],takes:[{take,titulo,duracao_segundos,objetivo,cena,acao,enquadramento,fala,texto_tela,prompt_video} x3]}. Variação ${variation}. ANÁLISE: ${JSON.stringify(analysis)}`;
  const c=await gemini(prompt);const st=await read(),id=crypto.randomUUID();st.creatives.unshift({id,createdAt:new Date().toISOString(),productId,productName:analysis.produto||'Produto',creative:c,analysisSnapshot:analysis});await write(st);s.json({...c,_creativeId:id});
}catch(e){console.error(e);s.status(500).json({error:e.message||'Falha ao gerar.'})}});

app.get('/api/products',auth,async(_,s)=>s.json((await read()).products.slice(0,100)));
app.get('/api/history',auth,async(_,s)=>s.json((await read()).creatives.slice(0,100)));
app.get('/api/health',(_,s)=>s.json({ok:true,provider:'google-gemini',model,apiConfigured:!!process.env.GEMINI_API_KEY}));
app.listen(port,()=>console.log(`10K Prompt na porta ${port} com Gemini ${model}`));
