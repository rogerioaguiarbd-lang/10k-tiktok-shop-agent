import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import {fileURLToPath} from 'url';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const app=express(), port=Number(process.env.PORT||3000);
const model=process.env.OPENAI_MODEL||'gpt-5.6-luna';
const password=process.env.ADMIN_PASSWORD||'10kprompt';
const secret=process.env.APP_SECRET||'change-me';
const dataDir=path.join(__dirname,'data'), storeFile=path.join(dataDir,'store.json');
await fs.mkdir(dataDir,{recursive:true});
try{await fs.access(storeFile)}catch{await fs.writeFile(storeFile,JSON.stringify({products:[],creatives:[]}))}
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:12*1024*1024}});
app.use(express.json({limit:'5mb'}));app.use(express.static(path.join(__dirname,'public')));
const read=async()=>JSON.parse(await fs.readFile(storeFile,'utf8'));const write=d=>fs.writeFile(storeFile,JSON.stringify(d,null,2));
const cookies=r=>Object.fromEntries((r.headers.cookie||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>{let i=x.indexOf('=');return[x.slice(0,i),decodeURIComponent(x.slice(i+1))]}));
function token(exp){let p=`admin.${exp}`,s=crypto.createHmac('sha256',secret).update(p).digest('hex');return `${p}.${s}`};
function valid(t=''){let a=t.split('.');if(a.length!==3||a[0]!=='admin'||Date.now()>Number(a[1]))return false;let e=crypto.createHmac('sha256',secret).update(`admin.${a[1]}`).digest('hex');return a[2]===e};
const auth=(r,s,n)=>valid(cookies(r).session)?n():s.status(401).json({error:'Faça login para continuar.'});
app.post('/api/login',(r,s)=>{if(String(r.body?.password||'')!==password)return s.status(401).json({error:'Senha inválida.'});let exp=Date.now()+604800000;s.setHeader('Set-Cookie',`session=${encodeURIComponent(token(exp))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.NODE_ENV==='production'?'; Secure':''}`);s.json({ok:true})});
app.post('/api/logout',(_,s)=>{s.setHeader('Set-Cookie','session=; Path=/; Max-Age=0');s.json({ok:true})});app.get('/api/me',(r,s)=>s.json({authenticated:valid(cookies(r).session)}));
function client(){if(!process.env.OPENAI_API_KEY)throw Error('OPENAI_API_KEY não configurada no servidor.');return new OpenAI({apiKey:process.env.OPENAI_API_KEY})}
async function ask(instructions,input){let r=await client().responses.create({model,store:false,instructions,input});if(!r.output_text)throw Error('A IA não retornou conteúdo.');let t=r.output_text.trim().replace(/^```json\s*/,'').replace(/```$/,'');return JSON.parse(t)}
app.post('/api/analyze',auth,upload.single('image'),async(r,s)=>{try{if(!r.file)return s.status(400).json({error:'Envie um print.'});let data=`data:${r.file.mimetype};base64,${r.file.buffer.toString('base64')}`;let instructions='Você é especialista em TikTok Shop. Analise somente informações visíveis no print e inferências conservadoras. Não invente preço, desconto, estoque, avaliações, certificações, material, especificações ou alegações. Responda SOMENTE JSON válido, sem markdown, com: produto,categoria,marca,descricao_visual,caracteristicas(array),beneficios(array),diferenciais(array),publico,problema,beneficio_principal,demonstracao_visual,angulo,ambiente_recomendado,tipo_hook_recomendado,confianca,observacoes. Português BR.';let a=await ask(instructions,[{role:'user',content:[{type:'input_text',text:'Analise este print do TikTok Shop.'},{type:'input_image',image_url:data,detail:'high'}]}]);let st=await read(),id=crypto.randomUUID();st.products.unshift({id,createdAt:new Date().toISOString(),analysis:a});await write(st);s.json({...a,_productId:id})}catch(e){console.error(e);s.status(500).json({error:e.message||'Falha na análise.'})}});
app.post('/api/generate',auth,async(r,s)=>{try{let {analysis,format,duration=15,generator='Genérico',avatar='Automático',environment='Automático',variation=1,productId=null}=r.body||{};if(!analysis||!['UGC','POV'].includes(format))return s.status(400).json({error:'Escolha UGC ou POV.'});let instructions=`Você é diretor criativo de TikTok Shop. Crie anúncio vertical 9:16 de ${duration}s, formato ${format}, gerador ${generator}, avatar ${avatar}, ambiente ${environment}. Exatamente 3 takes: 1 hook fortíssimo; 2 demonstração/benefícios; 3 CTA natural indicando o carrinho laranja, sem pressão. Mantenha produto/personagem/ambiente consistentes. Não invente fatos. Crie 1 hook principal e exatamente 3 alternativas. Cada prompt deve estar pronto para gerador de vídeo e incluir cena, ação, câmera, iluminação, fala exata PT-BR e texto na tela. Responda SOMENTE JSON válido sem markdown: {formato,duracao_total,gerador,avatar,ambiente,conceito,hook_escolhido,hooks_alternativos:[3],takes:[{take,titulo,duracao_segundos,objetivo,cena,acao,enquadramento,fala,texto_tela,prompt_video} x3]}. Variação ${variation}.`;let c=await ask(instructions,`ANÁLISE:\n${JSON.stringify(analysis)}`);let st=await read(),id=crypto.randomUUID();st.creatives.unshift({id,createdAt:new Date().toISOString(),productId,productName:analysis.produto||'Produto',creative:c,analysisSnapshot:analysis});await write(st);s.json({...c,_creativeId:id})}catch(e){console.error(e);s.status(500).json({error:e.message||'Falha ao gerar.'})}});
app.get('/api/products',auth,async(_,s)=>s.json((await read()).products.slice(0,100)));app.get('/api/history',auth,async(_,s)=>s.json((await read()).creatives.slice(0,100)));app.get('/api/health',(_,s)=>s.json({ok:true,model,apiConfigured:!!process.env.OPENAI_API_KEY}));
app.listen(port,()=>console.log(`10K Prompt rodando na porta ${port}`));
