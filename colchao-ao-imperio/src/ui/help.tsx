import type { ReactNode } from 'react';

/** Textos de ajuda de cada painel (botão "?"). */
export const HELP: Record<string, { title: string; body: ReactNode }> = {
  finance: { title: 'Como funcionam as finanças', body: <>
    <p><b>Aqui é dinheiro de verdade.</b> O jogo nunca gasta nada daqui.</p>
    <ul>
      <li><b>Contas:</b> corrente, carteira, poupança, reserva, investimentos. Cartões e dívidas são <b>passivos</b> (o que você deve).</li>
      <li><b>Patrimônio líquido</b> = tudo que você tem − tudo que você deve.</li>
      <li><b>Transferência</b> move dinheiro entre suas contas: pagar fatura, pagar dívida, guardar na reserva. Não muda o patrimônio.</li>
      <li><b>Compra parcelada</b> no cartão entra inteira como dívida hoje e aparece dividida nas faturas.</li>
      <li><b>Recorrências e parcelas</b> aparecem no calendário e só viram lançamento quando você confirma que pagou.</li>
      <li><b>Simulador:</b> responde "quando chego na meta?" e "quanto economizo de juros antecipando?".</li>
      <li>Errou? Toque em ✎ para corrigir ou ✕ para excluir (dá para desfazer). Tudo fica no histórico.</li>
    </ul></> },
  coins: { title: 'Como ganho moedas', body: <>
    <ul>
      <li><b>Economizar:</b> quando seu patrimônio cresce acima do maior valor que já teve. Os primeiros reais rendem mais.</li>
      <li><b>Reduzir dívidas:</b> quando o <b>total</b> que você deve cai abaixo do menor valor já atingido.</li>
      <li><b>Constância:</b> 3 moedas por dia em que você registra algo.</li>
      <li><b>Conquistas e missões:</b> cada uma paga uma vez.</li>
    </ul>
    <p><b>Não rende moedas:</b> transferir entre contas, pegar empréstimo, trocar uma dívida por outra, ajustar saldo para cima, saldo inicial.</p>
    <p>As moedas são recalculadas a partir do seu histórico. Corrigir um lançamento ajusta o valor; nunca duplica.</p></> },
  shop: { title: 'Loja', body: <>
    <p>Tudo aqui é pago com <b>moedas virtuais</b>. Nenhum centavo do seu dinheiro real.</p>
    <ul><li>Toque num item para ver detalhes, comprar e posicionar.</li><li><b>☆ Quero este</b> coloca na lista de desejos: você vê quanto falta e é avisado quando der.</li><li>Itens com cadeado pedem um nível maior. Itens de evento só aparecem na temporada.</li><li>Pisos e papéis de parede ficam nas últimas abas.</li></ul></> },
  inventory: { title: 'Inventário', body: <ul><li><b>Colocar</b> escolhe o lugar tocando no ambiente; <b>Auto</b> coloca sozinho num lugar livre.</li><li><b>Guardar</b> tira do ambiente sem perder.</li><li><b>$</b> vende por metade do preço. Móveis que vieram com o imóvel não podem ser vendidos.</li></ul> },
  missions: { title: 'Missões', body: <ul><li><b>História:</b> guiam o começo do jogo.</li><li><b>Diárias e semanais:</b> hábitos saudáveis (registrar, revisar, pagar em dia, guardar). Ficar dias sem jogar não tira nada.</li><li>Quando completar, toque em <b>Resgatar</b> para receber as moedas.</li></ul> },
  achievements: { title: 'Conquistas', body: <ul><li>Mais de 200 marcos em 12 ramos. A aba <b>Árvore</b> mostra a ordem de cada ramo.</li><li><b>Coleções:</b> tenha todos os itens de um conjunto para ganhar um bônus.</li><li>Se você corrigir um lançamento que gerou uma conquista, ela pode ser revogada. Isso evita conquistas por engano.</li></ul> },
  properties: { title: 'Imóveis', body: <ul><li>Cada imóvel pede um <b>nível</b>, um <b>valor economizado</b> de verdade e moedas.</li><li>Os imóveis anteriores continuam seus, com a decoração.</li><li>Em <b>Este ambiente</b> você expande o espaço e troca a iluminação. Em <b>Layouts</b> salva e troca decorações inteiras.</li></ul> },
  avatar: { title: 'Personagem', body: <ul><li>Mude cabelo, rosto, roupa e acessórios a qualquer hora.</li><li>Acessórios premium custam moedas e pedem nível.</li><li><b>Títulos</b> aparecem embaixo do seu nome e são liberados por nível e conquistas.</li><li>Na aba <b>Bichinho</b> você escolhe seu pet quando ele for liberado.</li></ul> },
  settings: { title: 'Ajustes e backup', body: <ul><li>Seus dados ficam só neste navegador. Faça backup de vez em quando.</li><li><b>Levar para outro aparelho:</b> em Sincronizar, gere um código com senha e cole no outro aparelho. Os dados são somados, não substituídos.</li><li>Restaurar um backup substitui tudo, mas pode ser desfeito logo em seguida.</li></ul> },
};

export function HelpBody({ id }: { id: string }) {
  const h = HELP[id];
  return <div className="small help-body" style={{ lineHeight: 1.65 }}>{h?.body}</div>;
}
