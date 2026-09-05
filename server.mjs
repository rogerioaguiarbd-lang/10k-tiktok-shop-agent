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
  const prompt='Você é especialista em TikTok Shop. Analise somente o PRODUTO e as informações comerciais visíveis no print, usando inferências conservadoras. Ignore características físicas de qualquer pessoa que apareça na imagem: não descreva rosto, cabelo, pele, olhos, idade aparente, corpo, etnia ou identidade visual humana. Não invente preço, desconto, estoque, avaliações, certificações, material, especificações ou alegações. Responda SOMENTE JSON válido e escreva TODO o conteúdo exclusivamente em português do Brasil (pt-BR), com linguagem natural brasileira. Campos: produto,categoria,marca,descricao_visual,caracteristicas(array),beneficios(array),diferenciais(array),publico,problema,beneficio_principal,demonstracao_visual,angulo,ambiente_recomendado,tipo_hook_recomendado,confianca,observacoes.';
  const a=await gemini(prompt,[{inline_data:{mime_type:r.file.mimetype,data:r.file.buffer.toString('base64')}}]);
  const st=await read(),id=crypto.randomUUID();st.products.unshift({id,createdAt:new Date().toISOString(),analysis:a});await write(st);s.json({...a,_productId:id});
}catch(e){console.error(e);s.status(500).json({error:e.message||'Falha na análise.'})}});

app.post('/api/product-prompt',auth,async(r,s)=>{try{
  const {analysis}=r.body||{};
  if(!analysis)return s.status(400).json({error:'Analise um produto primeiro.'});
  const prompt=`Você é especialista em fotografia publicitária de produtos para TikTok Shop. Com base SOMENTE na análise abaixo, crie UM prompt de imagem em português do Brasil para gerar APENAS O PRODUTO, sem pessoas, sem avatar, sem mãos e sem partes do corpo. Preserve fielmente somente os atributos sustentados pela análise, como formato, cor, embalagem, acabamento, marca e detalhes visíveis. Não invente características, materiais, textos, logos, preço, desconto ou acessórios inexistentes. Composição vertical 9:16, produto como protagonista absoluto, aparência realista, iluminação profissional natural, fotografia de e-commerce premium e fundo/cenário coerente com a categoria. Não adicione texto gráfico à imagem, exceto textos que já façam parte da embalagem original. Responda SOMENTE JSON válido no formato {prompt_imagem_produto}. ANÁLISE: ${JSON.stringify(analysis)}`;
  const out=await gemini(prompt);
  s.json(out);
}catch(e){console.error(e);s.status(500).json({error:e.message||'Falha ao gerar prompt do produto.'})}});

app.post('/api/generate',auth,async(r,s)=>{try{
  const {analysis,format,duration=15,generator='Genérico',avatar='Automático',environment='Automático',variation=1,productId=null}=r.body||{};
  if(!analysis||!['UGC','POV'].includes(format))return s.status(400).json({error:'Escolha UGC ou POV.'});
  const prompt=`Você é um diretor criativo e copywriter especialista em TikTok Shop Brasil. Usando SOMENTE a análise do produto abaixo, crie UM ÚNICO anúncio vertical 9:16 de ${duration}s, no formato ${format}, gerador ${generator}, avatar ${avatar}, ambiente ${environment}.

REGRA PRINCIPAL: os 3 takes NÃO são três anúncios independentes. Eles são três partes consecutivas da MESMA copy, formando uma única fala contínua, coerente e natural. A última ideia/frase de um take deve preparar ou conectar naturalmente com o próximo, sem reiniciar a apresentação, sem repetir o hook e sem parecer que mudou de vídeo.

ESTRUTURA OBRIGATÓRIA:
TAKE 1 — HOOK: abrir com um gancho muito forte que interrompa o scroll e imediatamente introduza/apresente o produto ou o problema/desejo que ele resolve. Não concluir a mensagem; deixar a fala pronta para continuar no Take 2.
TAKE 2 — CORPO: continuar diretamente a ideia e a fala do Take 1. Mostrar/apresentar o produto em uso e explicar os benefícios/diferenciais mais relevantes permitidos pela análise. Não criar um novo hook e não recomeçar a apresentação. Terminar preparando naturalmente o CTA.
TAKE 3 — CTA: continuar diretamente o Take 2 e concluir a mesma copy. Fazer uma recomendação natural, como alguém que realmente gostou/indicaria o produto, conduzindo ao carrinho laranja sem pressão, sem linguagem agressiva de venda.

IDIOMA OBRIGATÓRIO: absolutamente TODO o conteúdo textual deve estar em português do Brasil (pt-BR), incluindo conceito, hook, hooks alternativos, títulos, objetivos, cenas, ações, enquadramentos, falas, textos na tela e prompts de vídeo. Use português brasileiro natural, coloquial quando adequado ao TikTok, e nunca responda em inglês.

REGRA DO AVATAR — OBRIGATÓRIA: o usuário utilizará o próprio avatar na ferramenta de geração de vídeo. Portanto, NÃO descreva, invente ou especifique nenhuma característica física, facial ou de identidade da pessoa/avatar em nenhum campo e especialmente em prompt_video. Não mencionar formato do rosto, olhos, nariz, boca, lábios, sobrancelhas, cabelo, cor de cabelo, pele, tom de pele, idade, etnia, altura, peso, tipo corporal, barba, maquiagem ou qualquer detalhe de aparência pessoal. Não tente criar uma identidade visual para o avatar. Refira-se somente como “o avatar”, “a pessoa” ou “o apresentador”, conforme necessário. O prompt deve se concentrar em atuação, gestos, posição, interação com o produto, câmera, cenário e iluminação. Preserve a identidade do avatar fornecido pelo usuário sem descrevê-la nem alterá-la.

CONSISTÊNCIA DE CENÁRIO — REGRA RÍGIDA: os três takes devem acontecer no MESMO cenário físico. Não mude de cômodo, local, loja, rua, fundo ou ambiente entre os takes. Preserve exatamente os mesmos elementos principais do cenário, decoração, móveis, objetos visíveis, posição relativa dos elementos, horário aparente, direção e qualidade da luz, paleta visual e atmosfera. Se o ambiente selecionado for ${environment}, ele deve ser mantido do início ao fim. Caso seja Automático, escolha um único cenário coerente com o produto e mantenha-o idêntico nos três takes.

CONTINUIDADE VISUAL — REGRA RÍGIDA: mantenha o mesmo avatar fornecido pelo usuário, sem descrever sua aparência, e mantenha o mesmo produto, roupa já estabelecida pelo avatar/referência, acessórios já existentes, iluminação, estilo visual e identidade em todos os takes. O produto deve manter exatamente a mesma cor, formato, tamanho aparente, embalagem e detalhes visuais. Não introduza novos objetos importantes nem remova objetos principais do cenário sem uma ação explícita da pessoa. A posição da pessoa e do produto pode evoluir naturalmente, mas o Take 2 deve parecer começar imediatamente após o Take 1 e o Take 3 imediatamente após o Take 2.

CONTINUIDADE DE CÂMERA: mudanças de enquadramento são permitidas somente como movimentos ou cortes naturais dentro do mesmo ambiente, por exemplo aproximação, leve pan, mudança de plano ou detalhe do produto. Nunca faça uma transição que pareça mudar de locação. Descreva cada prompt_video de forma que reforce explicitamente a continuidade do take anterior.

A soma das durações dos três takes deve ser ${duration}s. As falas devem caber naturalmente no tempo de cada take.

Crie 1 hook principal e exatamente 3 hooks alternativos. Os hooks alternativos são opções apenas para substituir a abertura do Take 1; o corpo e CTA continuam pertencendo ao mesmo anúncio. Não invente fatos, benefícios, preço, desconto, urgência, avaliações, materiais, especificações ou resultados que não estejam sustentados pela análise.

Responda SOMENTE JSON válido neste formato: {formato,duracao_total,gerador,avatar,ambiente,conceito,hook_escolhido,hooks_alternativos:[3],takes:[{take,titulo,duracao_segundos,objetivo,cena,acao,enquadramento,fala,texto_tela,prompt_video},{take,titulo,duracao_segundos,objetivo,cena,acao,enquadramento,fala,texto_tela,prompt_video},{take,titulo,duracao_segundos,objetivo,cena,acao,enquadramento,fala,texto_tela,prompt_video}]}. Variação ${variation}. ANÁLISE: ${JSON.stringify(analysis)}`;
  const c=await gemini(prompt);const st=await read(),id=crypto.randomUUID();st.creatives.unshift({id,createdAt:new Date().toISOString(),productId,productName:analysis.produto||'Produto',creative:c,analysisSnapshot:analysis});await write(st);s.json({...c,_creativeId:id});
}catch(e){console.error(e);s.status(500).json({error:e.message||'Falha ao gerar.'})}});

app.get('/api/products',auth,async(_,s)=>s.json((await read()).products.slice(0,100)));
app.get('/api/history',auth,async(_,s)=>s.json((await read()).creatives.slice(0,100)));
app.get('/api/health',(_,s)=>s.json({ok:true,provider:'google-gemini',model,apiConfigured:!!process.env.GEMINI_API_KEY}));
app.listen(port,()=>console.log(`10K Prompt na porta ${port} com Gemini ${model}`));
