import fs from 'fs/promises';

const file = new URL('./server.mjs', import.meta.url);
let source = await fs.readFile(file, 'utf8');

const oldRule = "Estrutura-base adaptativa: pacote lacrado → abertura natural do pacote → produto(s) revelado(s)/organizado(s) → produto principal segurado e demonstrado → transição natural por movimento/oclusão → demonstração final em uso.";

const newRule = `TAKE 1 — COMPOSIÇÃO VISUAL OBRIGATÓRIA: comece com uma fotografia/vídeo ultra-realista vertical 9:16, estética UGC espontânea para TikTok Shop, usando fielmente o(s) produto(s) analisado(s). A cena acontece em um quarto feminino, moderno e aconchegante. A câmera representa exatamente o ponto de vista dos olhos de uma influenciadora adulta sentada no centro de uma cama de casal, inclinada para baixo em POV verdadeiro. Ela está sentada ereta de pernas cruzadas em posição confortável: joelhos baixos direcionados para os lados, canelas convergindo ao centro e tornozelos cruzados próximos ao corpo. Ela usa meias curtas caneladas brancas. Somente as duas pernas e os dois pés aparecem na parte inferior do quadro, formando moldura natural. Os pés aparecem parcialmente de lado e próximos ao centro inferior. NÃO elevar os joelhos em direção à câmera; NÃO abrir as pernas em V; NÃO deixar pés separados, estendidos para frente ou apontados para os produtos; NÃO mostrar a influenciadora deitada nem com pernas esticadas. À frente das pernas cruzadas, organize TODOS e SOMENTE os produtos sustentados pela imagem/análise sobre os lençóis. Cada produto deve aparecer inteiro, separado e totalmente visível, preservando fielmente forma, estampa, desenhos, textos, materiais, texturas, acabamentos e demais características visíveis; não inventar, duplicar, substituir ou omitir produtos. Para roupas, dispor abertas na cama, frente voltada para a câmera e pequenas dobras naturais; peça principal centralizada e mais próxima da influenciadora, demais peças equilibradas na área superior e laterais. As pernas nunca cobrem os produtos e deve existir pequena distância visual entre os pés cruzados e a peça principal. Cama com lençóis claros de algodão levemente amassados; nas bordas, manta texturizada em tom rosado, pequeno buquê de flores em tons neutros e óculos de sol discretos. Luz natural suave lateral de janela, sombras delicadas, exposição de smartphone e perspectiva equivalente a 26 mm sem distorção exagerada. Anatomia fisicamente possível: exatamente duas pernas e dois pés. NÃO mostrar braços, mãos, rosto, cabeça, cabelo, torso, reflexos ou outras pessoas. Sem captions, preços, interface, watermark, ilustração ou CGI. IMPORTANTE: esta regra do TAKE 1 substitui a antiga obrigação de começar pelo pacote fechado. Não mostrar pacote no TAKE 1, salvo se o próprio pacote for o produto analisado. Depois do TAKE 1, desenvolva Takes 2 e 3 com demonstração/transição/uso natural do produto, mantendo continuidade visual e factual.`;

if (!source.includes(oldRule)) {
  throw new Error('Regra-base de Unboxing POV não encontrada; abortando sem alterar o servidor.');
}

source = source.replace(oldRule, newRule);
await fs.writeFile(file, source);
await import('./server.mjs');
