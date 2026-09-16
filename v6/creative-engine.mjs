export const ENGINE_VERSION='10K-6.0';

export const CREATIVE_MODES={
 UGC:{label:'UGC',silent:false,outputs:3},
 POV:{label:'POV',silent:false,outputs:3},
 PROVADOR_UGC:{label:'Provador UGC',silent:true,outputs:3,fashion:true},
 DIRETOR_UGC:{label:'Diretor UGC',auto:true,outputs:3},
 STORYBOARD:{label:'Storyboard',storyboard:true,outputs:1},
 CAMPANHA:{label:'Campanha',campaign:true,outputs:10},
 LAB_AB:{label:'Laboratório A/B',ab:true,outputs:5},
 FULL_AUTO:{label:'10K Full Auto',auto:true,outputs:3}
};

const fashionRx=/roupa|vestido|conjunto|calça|short|saia|blusa|camisa|camiseta|top|legging|jaqueta|casaco|moda|fashion|fitness|tênis|sapato|bolsa|acessório/i;

export function classifyProduct(analysis={}){
 const text=[analysis.produto,analysis.categoria,analysis.descricao_visual,...(analysis.caracteristicas||[])].filter(Boolean).join(' ');
 return {fashion:fashionRx.test(text),category:analysis.categoria||'Não identificada'};
}

export function routeCreative({mode='FULL_AUTO',analysis={},audioMode='auto'}={}){
 const product=classifyProduct(analysis),requested=CREATIVE_MODES[mode]||CREATIVE_MODES.FULL_AUTO;
 let resolved=mode;
 if(mode==='FULL_AUTO'||mode==='DIRETOR_UGC') resolved=product.fashion?'PROVADOR_UGC':'UGC';
 const profile=CREATIVE_MODES[resolved]||requested;
 return {engineVersion:ENGINE_VERSION,requestedMode:mode,resolvedMode:resolved,product,silent:audioMode==='silent'||profile.silent===true,outputs:requested.outputs||profile.outputs||3};
}

export function referenceLock({analysis={},level='auto'}={}){
 return {level,product:{active:true,rule:'Preserve exactly all observable product design, colors, proportions, labels, logos, seams, prints, parts and details. Never invent or redesign.'},identity:{active:['LOCK_TOTAL','FACE_LOCK'].includes(String(level).toUpperCase()),rule:'When a person reference exists, preserve recognizable face, hair, skin tone, apparent age, body proportions and identity.'},scene:{active:String(level).toUpperCase()==='LOCK_TOTAL',rule:'Preserve environment, lighting and spatial continuity between connected scenes.'},unknowns:'Never invent material, price, discount, specifications, certification, results, reviews, stock, warranty or unsupported benefits.',productName:analysis.produto||null};
}

export function motionPlan({duration=8,fashion=false,motion='AUTO_MOTION'}={}){
 const d=Number(duration)||8,budget=d<=5?'1 main action + 1-2 micro-actions':d<=8?'2 main actions + 2-3 micro-actions':d<=16?'3-5 main actions + natural micro-actions':'split into connected scenes';
 const actions=fashion?['natural stance / two small steps','show fit with a soft 30-45 degree turn','briefly show a real garment detail','finish in a relaxed full-look pose']:['natural product reveal','demonstrate one confirmed use or visible feature','show a useful close detail','finish with product clearly visible'];
 return {preset:motion,budget,actions,physics:'Natural balance, gravity, contact and inertia. No robotic motion, teleporting, sliding feet, limb morphing, fused hands or product deformation.',microBehavior:'Natural blinking, breathing, subtle gaze changes and small posture adjustments. Silent mode must not contain lip movement suggesting speech.'};
}

export function buildEngineContext(input={}){
 const route=routeCreative(input),lock=referenceLock({analysis:input.analysis,level:input.referenceLock}),motion=motionPlan({duration:input.duration,fashion:route.product.fashion,motion:input.motionEngine});
 return {route,lock,motion,rules:{aspectRatio:'9:16 vertical portrait',screenText:input.screenText||'none',audio:route.silent?'No dialogue, narration or speaking; relaxed mouth with no speech-like lip movement.':input.audioMode||'auto',ugc:'Natural smartphone UGC; human timing and small imperfections; avoid TV-commercial or robotic choreography.'}};
}
