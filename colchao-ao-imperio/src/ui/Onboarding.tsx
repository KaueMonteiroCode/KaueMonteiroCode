import { useState } from 'react';
import type { Cents } from '../core/money';
import { formatBRL } from '../core/money';
import * as A from '../state/actions';
import { getState } from '../state/store';
import type { SaveData } from '../state/types';
import { AvatarEditor } from './AvatarEditor';
import { act, Coins, Icon, MoneyInput } from './common';
import { sfx } from '../audio/sfx';

export const WELCOME_GIFT = 60;

export function Onboarding({ save, onFinish }: { save: SaveData; onFinish: () => void }) {
  const step = save.profile.onboardingStep;
  const go = (n: number) => { sfx.click(); A.setProfile({ onboardingStep: n }); };
  const [name, setName] = useState(save.profile.name);
  const [avatar, setAvatar] = useState(save.profile.avatar);
  const [checking, setChecking] = useState<Cents | null>(null);
  const [cash, setCash] = useState<Cents | null>(null);
  const [savings, setSavings] = useState<Cents | null>(null);
  const [debt, setDebt] = useState<Cents | null>(null);

  const box = (children: React.ReactNode, wide = false) => (
    <div className="modal-back" style={{ background: step === 1 ? 'rgba(8,6,12,0.15)' : undefined, alignItems: step === 1 ? 'end' : 'center' }}>
      <div className={`modal ${wide ? 'wide' : ''}`}>{children}</div>
    </div>
  );

  if (step === 0) return box(<>
    <h3>Capítulo 1: O Colchão</h3>
    <p style={{ lineHeight: 1.7 }}>Você acorda com uma mola do colchão cutucando suas costas. O teto tem uma mancha em formato de boleto. O computador amarelado faz barulho de turbina.</p>
    <p style={{ lineHeight: 1.7 }}>Mas hoje é diferente. Hoje você decidiu: <b className="gold">cada real economizado vai virar tijolo do seu império.</b></p>
    <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn gold" onClick={() => go(1)} autoFocus>Olhar em volta ▶</button></div>
  </>);

  if (step === 1) return box(<>
    <h3>Seu "lar doce lar"</h3>
    <p className="small" style={{ lineHeight: 1.6 }}>Parede descascada, colchão no chão, cadeira de plástico e uma lâmpada pendurada no fio. Clique no chão para andar, em móveis para usar. Arraste para mover a câmera e use a rodinha (ou pinça no celular) para zoom.</p>
    <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn gold" onClick={() => go(2)} autoFocus>Quem sou eu? ▶</button></div>
  </>);

  if (step === 2) return box(<>
    <h3>Crie seu personagem</h3>
    <label htmlFor="ob-name">Seu nome (ou apelido)</label>
    <input id="ob-name" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Kauê" />
    <div className="hr" />
    <AvatarEditor value={avatar} onChange={setAvatar} ownedCosmetics={[]} level={1} />
    <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
      <button className="btn gold" onClick={() => { act(() => { A.setAvatar(avatar); A.setProfile({ name: name.trim() }); }); go(3); }}>Esse sou eu ▶</button>
    </div>
  </>, true);

  if (step === 3) return box(<>
    <h3>Seu ponto de partida (opcional)</h3>
    <p className="small muted" style={{ lineHeight: 1.6 }}>Informe só os valores. <b>Nunca</b> pedimos banco, agência, senha ou CPF. Os dados ficam apenas neste navegador. Pode pular e cadastrar depois.</p>
    <div className="hint real" style={{ margin: '8px 0' }}>Saldo inicial é sua <b>linha de partida</b>: ele não gera moedas. O que conta é o quanto seu patrimônio <b>cresce</b> daqui pra frente.</div>
    <label>Conta corrente (saldo atual)</label><MoneyInput value={checking} onChange={setChecking} />
    <label>Dinheiro em espécie / carteira</label><MoneyInput value={cash} onChange={setCash} />
    <label>Poupança / reserva</label><MoneyInput value={savings} onChange={setSavings} />
    <label>Dívidas que você já tem (total devido)</label><MoneyInput value={debt} onChange={setDebt} />
    <div className="row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
      <button className="btn ghost" onClick={() => go(4)}>Pular</button>
      <button className="btn gold" onClick={() => {
        const ok = act(() => {
          if (checking != null) A.addAccount({ name: 'Conta corrente', type: 'checking', initialAmount: checking });
          if (cash != null) A.addAccount({ name: 'Carteira', type: 'cash', initialAmount: cash });
          if (savings != null) A.addAccount({ name: 'Reserva de emergência', type: 'reserve', initialAmount: savings });
          if (debt != null && debt > 0) A.addAccount({ name: 'Dívidas existentes', type: 'debt', initialAmount: debt });
          return true;
        });
        if (ok) go(4);
      }}>Salvar ▶</button>
    </div>
  </>);

  if (step === 4) return box(<>
    <h3>Duas moedas, dois mundos</h3>
    <div className="grid2" style={{ marginTop: 6 }}>
      <div className="card"><div className="row"><Icon name="money" size={22} /><b>R$ (real)</b></div><p className="small" style={{ lineHeight: 1.5 }}>Seu dinheiro de verdade. Você registra receitas, despesas, contas e dívidas. O jogo <b>nunca</b> mexe nele.</p></div>
      <div className="card"><div className="row"><Icon name="coin" size={22} /><b>Moedas</b></div><p className="small" style={{ lineHeight: 1.5 }}>Dinheiro do jogo. Você ganha ao <b>economizar</b>, quitar dívidas, cumprir missões e manter constância. Gasta na loja à vontade.</p></div>
    </div>
    <div className="hint" style={{ marginTop: 10 }}>Comprar um sofá virtual de 500 moedas <b>não tira nenhum centavo</b> do seu saldo. Transferir dinheiro entre contas, pegar empréstimo ou editar lançamentos <b>não gera moedas extras</b>: só crescimento real do patrimônio conta.</div>
    <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}><button className="btn gold" onClick={() => go(5)}>Entendi ▶</button></div>
  </>);

  if (step === 5) return box(<>
    <h3>Primeira missão</h3>
    <div className="card row"><Icon name="target" size={28} /><div><b>O primeiro passo</b><div className="small muted">Registre sua primeira economia (a partir de R$ 10) no botão verde <b>Economizei</b>.</div></div></div>
    <p className="small" style={{ lineHeight: 1.6 }}>Pequenas economias valem muito aqui: R$ 10 já desbloqueia conquista e moedas para a primeira compra.</p>
    <div className="card row" style={{ background: '#3b2a12' }}>
      <Icon name="box" size={28} />
      <div className="grow"><b>Presente de boas-vindas</b><div className="small muted">Para estrear a loja agora mesmo.</div></div>
      <Coins n={WELCOME_GIFT} className="gold" />
    </div>
    <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
      <button className="btn gold" autoFocus onClick={() => {
        if (!getState().game.claims['gift:welcome']) act(() => A.claim('gift:welcome', WELCOME_GIFT, 20, 'Presente de boas-vindas'));
        A.setProfile({ onboarded: true, onboardingStep: 6 });
        sfx.coin();
        onFinish();
      }}>Pegar presente e começar!</button>
    </div>
    <div className="tiny muted" style={{ marginTop: 8 }}>Dica: {formatBRL(1000)} = 20 moedas. As primeiras economias rendem mais.</div>
  </>);

  return null;
}
