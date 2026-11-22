// Narrative director for Chapter I: Нулевой сигнал.
export function createStoryController({ onObjective = () => {}, notify = () => {}, onPrologueEnd = () => {} } = {}) {
  let phase = 0;
  let overlay = null;
  let cardIndex = 0;
  let cards = [];
  let finishCallback = null;

  const objectives = {
    0: 'ПРОЛОГ · СЕВЕР-7',
    1: 'НАЙТИ РАЦИЮ В ПРОХОДНОЙ',
    2: 'СОБРАТЬ ЗАПИСКУ И ФОТОГРАФИЮ В ОФИСЕ',
    3: 'ПРОВЕРИТЬ ЭЛЕКТРОЩИТ В КОРПУСЕ',
    4: 'НАЙТИ ЖУРНАЛ ЭВАКУАЦИИ У ВНЕШНИХ ВОРОТ',
    5: 'ГЛАВА I ЗАВЕРШЕНА · СИГНАЛ ИДЁТ СНИЗУ'
  };

  function setPhase(next) {
    phase = Math.max(0, Math.min(5, next));
    onObjective(objectives[phase]);
  }

  function removeOverlay() {
    if (overlay?.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
  }

  function renderCard() {
    if (!overlay) return;
    const card = cards[cardIndex];
    overlay.querySelector('[data-story-kicker]').textContent = card.kicker;
    overlay.querySelector('[data-story-title]').textContent = card.title;
    overlay.querySelector('[data-story-body]').textContent = card.body;
    overlay.querySelector('[data-story-count]').textContent = `${String(cardIndex + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
    overlay.querySelector('[data-story-next]').textContent = cardIndex === cards.length - 1 ? 'НАЧАТЬ СМЕНУ' : 'ПРОДОЛЖИТЬ';
  }

  function showCards(sequence, onFinish) {
    removeOverlay();
    cards = sequence; cardIndex = 0; finishCallback = onFinish;
    const style = document.createElement('style');
    style.textContent = `
      #tishinaStoryOverlay{position:fixed;inset:0;z-index:100;background:radial-gradient(ellipse at 50% 42%,rgba(43,55,48,.97),rgba(5,9,8,.99) 72%);display:flex;align-items:center;justify-content:center;padding:22px;color:#e3e8df;font-family:system-ui,-apple-system,sans-serif;}
      #tishinaStoryOverlay .storyPanel{width:min(620px,100%);padding:clamp(20px,5vw,48px);border:1px solid #aab7a333;background:linear-gradient(145deg,#17201ce8,#0a100eea);box-shadow:0 24px 90px #000c;animation:storyIn .65s ease both;}
      #tishinaStoryOverlay .storyKicker{font-size:10px;letter-spacing:.24em;color:#aab79f;text-transform:uppercase;}
      #tishinaStoryOverlay h2{font-size:clamp(27px,6vw,46px);line-height:1.1;letter-spacing:.09em;margin:20px 0 18px;font-weight:750;}
      #tishinaStoryOverlay .storyBody{font-size:clamp(14px,2.3vw,17px);line-height:1.85;white-space:pre-line;color:#cbd3c8;min-height:115px;}
      #tishinaStoryOverlay .storyBottom{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:28px;}
      #tishinaStoryOverlay .storyCount{font-size:10px;letter-spacing:.18em;color:#7f8c80;}
      #tishinaStoryOverlay button{min-height:46px;padding:0 22px;background:#d0d8cd;border:1px solid #d0d8cd;color:#18201b;font-size:10px;font-weight:800;letter-spacing:.14em;border-radius:4px;}
      @keyframes storyIn{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:translateY(0)}}
      @media(prefers-reduced-motion:reduce){#tishinaStoryOverlay .storyPanel{animation:none}}
    `;
    overlay = document.createElement('div'); overlay.id = 'tishinaStoryOverlay'; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
    const panel = document.createElement('section'); panel.className = 'storyPanel';
    const kicker = document.createElement('div'); kicker.className = 'storyKicker'; kicker.dataset.storyKicker = '';
    const title = document.createElement('h2'); title.dataset.storyTitle = '';
    const body = document.createElement('p'); body.className = 'storyBody'; body.dataset.storyBody = '';
    const bottom = document.createElement('div'); bottom.className = 'storyBottom';
    const count = document.createElement('span'); count.className = 'storyCount'; count.dataset.storyCount = '';
    const button = document.createElement('button'); button.type = 'button'; button.dataset.storyNext = '';
    button.addEventListener('click', () => {
      cardIndex++;
      if (cardIndex >= cards.length) {
        const done = finishCallback; removeOverlay(); finishCallback = null;
        if (done) done();
      } else renderCard();
    });
    bottom.append(count, button); panel.append(kicker, title, body, bottom); overlay.appendChild(style); overlay.appendChild(panel); document.body.appendChild(overlay);
    renderCard(); button.focus({ preventScroll: true });
  }

  function begin(onFinish) {
    setPhase(1);
    showCards([
      { kicker: 'СЕВЕРНЫЙ РЕГИОН · 18 НОЯБРЯ 2034', title: 'ЧЕТВЁРТЫЙ ДЕНЬ ТИШИНЫ', body: 'Комплекс «Север-7» официально эвакуирован. Связь с дежурной сменой оборвалась четыре дня назад. Дорога к объекту перекрыта, но ночью на аварийной частоте снова появился сигнал.' },
      { kicker: 'РАДИОПЕРЕХВАТ · 04:17', title: '«НЕ ОТВЕЧАЙТЕ»', body: 'Последний фрагмент сообщения диспетчера Лиса: «Если услышите вызов по каналу 04 — не отвечайте. Мы закрыли нижний шлюз. Повторяю: не открывайте его, даже если голос будет знакомым».' },
      { kicker: 'ЛИЧНОЕ ДЕЛО · ДОПУСК С-0714', title: 'ВОЗВРАТА НЕ БЫЛО', body: 'В списке эвакуации есть пропуск, который должен был остаться внутри комплекса. Ты приехал проверить записи смены и найти источник сигнала. На проходной ещё горит аварийное освещение.' },
      { kicker: 'ГЛАВА I · НУЛЕВОЙ СИГНАЛ', title: 'СНАЧАЛА — ФАКТЫ', body: 'Найди старую рацию, изучи документы в офисе и проверь электрощит. Затем доберись до внешнего КПП: в журнале эвакуации должна быть последняя запись дежурного.' }
    ], () => { setPhase(1); onPrologueEnd(); if (onFinish) onFinish(); });
  }

  function refresh(inventory = []) {
    const hasRadio = inventory.includes('Старая рация');
    const hasNote = inventory.includes('Служебная записка');
    const hasPhoto = inventory.includes('Фотография');
    if (phase === 1 && hasRadio) setPhase(2);
    if (phase === 2 && hasNote && hasPhoto) setPhase(3);
  }

  function markBreaker() {
    if (phase < 3) {
      notify('Сначала изучи рацию, записку и фотографию. В них может быть подсказка.');
      return false;
    }
    if (phase === 3) {
      setPhase(4);
      notify('Резервный контур проверен. В журнале КПП должна быть последняя запись дежурного.');
      return true;
    }
    notify('Электрощит уже проверен. Следующий след — у внешних ворот.');
    return true;
  }

  function markJournal() {
    if (phase < 4) {
      notify('В журнале слишком много пропусков. Сначала разберись с записями в офисе и электрощитом.');
      return false;
    }
    if (phase === 4) {
      setPhase(5);
      notify('ГЛАВА I ЗАВЕРШЕНА. Из-под бетонного пола доносится ответный сигнал.');
      return true;
    }
    notify('Последняя запись уже сохранена в журнале. Сигнал идёт из нижнего уровня.');
    return true;
  }

  function snapshot() { return { phase }; }
  function restore(data, inventory = []) {
    const savedPhase = Number(data?.phase);
    setPhase(Number.isInteger(savedPhase) ? savedPhase : 1);
    refresh(inventory);
  }
  function reset() { removeOverlay(); finishCallback = null; setPhase(0); }
  function objective() { return objectives[phase]; }

  return { begin, refresh, markBreaker, markJournal, snapshot, restore, reset, objective };
}
