import {FIELD,createGame,restoreGame,copyGame,launch,stepGame,revive} from './merge-engine.js';
import {createMergeView,colorOf,labelOf} from './merge-view.js';
import {load,save,modal,toast} from './common.js';
import {afterRound,rewardedButton,adsPaused} from './ads.js';

export function start(id,root){
  document.body.classList.add('merge-page');root.classList.add('merge-game');
  if(!document.querySelector('link[data-merge-style]')&&!document.querySelector('style[data-merge-style]')){const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('../merge.css',import.meta.url).href;css.dataset.mergeStyle='';document.head.append(css);}
  const stored=load('merge-3d'),restored=restoreGame(stored?.state);let state=restored||createGame(),undo=restored?restoreGame(stored.undo):null;
  let best=Math.max(Number(load('merge-best',0))||0,state.score),aim=0,power='normal',pointer=null,accumulator=0,last=0,raf=0,disposed=false,epoch=0,saveClock=0,overHandled=false,audio;
  const dialog=document.querySelector('#modal'),fmt=n=>Math.round(n).toLocaleString('ru-RU');
  root.innerHTML=`<div class="merge-hud"><div class="merge-scores"><div class="merge-score main"><span>СЧЁТ</span><b id="merge-score">0</b></div><div class="merge-score"><span>РЕКОРД</span><b id="merge-best">0</b></div><div class="merge-score"><span>ЛУЧШИЙ КУБ</span><b id="merge-max">16</b></div></div><div class="merge-tools"><button id="merge-help" aria-label="Правила игры" title="Правила">?</button><button id="merge-sound" aria-label="Звук" title="Звук">♪</button><button id="merge-pause" aria-label="Пауза" title="Пауза">Ⅱ</button><button id="merge-new" aria-label="Новая игра" title="Новая игра">↻</button></div></div>
  <div class="merge-layout"><section class="merge-arena" aria-label="Игровое поле"><div class="merge-target"><span>СОБЕРИ <b id="merge-target">2 048</b></span><div class="merge-progress"><i id="merge-progress"></i></div></div><div class="merge-board-note">2 + 2 = 4 <span>·</span> 4 + 4 = 8</div><div id="merge-banner" class="merge-banner" aria-live="polite"></div><div class="merge-hint" id="merge-hint">Двигай кубик и отпускай</div><div class="merge-paused" id="merge-paused" hidden>Пауза</div></section>
  <aside class="merge-side"><div class="merge-next-panel"><div><span class="merge-kicker">СЕЙЧАС</span><div id="merge-current" class="merge-chip large">2</div></div><div class="merge-queue"><span class="merge-kicker">ДАЛЬШЕ</span><div id="merge-next"></div></div></div><div class="merge-divider"></div><p class="merge-side-title">Сделай красивую цепочку</p><p class="merge-side-copy">Одинаковые кубики сливаются при касании. Один точный бросок может запустить целое комбо.</p>
  <div class="merge-boosters"><button id="merge-bomb" class="merge-booster" aria-pressed="false"><span class="merge-booster-symbol bomb">✹</span><span><b>Бомба</b><small>Освободит место</small></span><em id="merge-bomb-count">2</em></button><button id="merge-wild" class="merge-booster" aria-pressed="false"><span class="merge-booster-symbol wild">★</span><span><b>Радужный</b><small>Удвоит первый кубик</small></span><em id="merge-wild-count">1</em></button><button id="merge-undo" class="merge-booster"><span class="merge-booster-symbol undo">↶</span><span><b>Отменить</b><small>Последний бросок</small></span></button></div><div id="merge-rewards" class="merge-rewards"></div><p class="merge-bonus-note">Собери новый кубик от 256 — получи бомбу.</p><div class="merge-keyboard"><span>← →</span> прицел <span>Пробел</span> бросок</div></aside></div><p id="merge-status" class="merge-live" role="status" aria-live="polite"></p>`;
  const q=id=>root.querySelector('#'+id),arena=root.querySelector('.merge-arena'),view=createMergeView(arena);arena.dataset.renderer=view.mode;
  const persist=()=>save('merge-3d',{state:copyGame(state),undo:undo?copyGame(undo):null});
  const paused=()=>adsPaused||document.hidden||dialog.open;
  function sound(type,combo=1){
    if(!load('sound',true)||paused())return;
    try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});const t=audio.currentTime,n=type==='merge'?2:1;
      for(let i=0;i<n;i++){const o=audio.createOscillator(),g=audio.createGain();o.type=type==='blast'?'triangle':'sine';const frequency=type==='shot'?180:type==='blast'?80:392*2**((Math.min(combo,9)-1)/7+i*.25);o.frequency.setValueAtTime(frequency,t+i*.055);o.frequency.exponentialRampToValueAtTime(frequency*(type==='shot'?.5:1.05),t+i*.055+.12);g.gain.setValueAtTime(.035,t+i*.055);g.gain.exponentialRampToValueAtTime(.001,t+i*.055+.18);o.connect(g);g.connect(audio.destination);o.start(t+i*.055);o.stop(t+i*.055+.19);}
    }catch{}
  }
  function banner(text){q('merge-banner').textContent=text;q('merge-banner').classList.remove('show');void q('merge-banner').offsetWidth;q('merge-banner').classList.add('show');}
  function drawUI(){
    best=Math.max(best,state.score);save('merge-best',best);q('merge-score').textContent=fmt(state.score);q('merge-best').textContent=fmt(best);q('merge-max').textContent=labelOf(state.maxValue);
    const target=state.maxValue<2048?2048:2**(Math.floor(Math.log2(state.maxValue))+1);q('merge-target').textContent=fmt(target);q('merge-progress').style.width=Math.min(100,Math.log2(state.maxValue)/Math.log2(target)*100)+'%';
    const current=q('merge-current');current.textContent=power==='bomb'?'✹':power==='wild'?'★':labelOf(state.queue[0]);current.style.setProperty('--cube-color',power==='normal'?colorOf(state.queue[0]):power==='bomb'?'#344356':'#aa80e7');current.classList.toggle('rainbow',power==='wild');
    q('merge-next').innerHTML=state.queue.slice(1).map(n=>`<span class="merge-chip" style="--cube-color:${colorOf(n)}">${labelOf(n)}</span>`).join('');
    q('merge-bomb-count').textContent=state.bombs;q('merge-wild-count').textContent=state.wilds;
    q('merge-bomb').disabled=state.phase!=='ready'||state.bombs<1;q('merge-wild').disabled=state.phase!=='ready'||state.wilds<1;q('merge-undo').disabled=!undo;
    const rewardButton=q('merge-rewards').querySelector('button');if(rewardButton)rewardButton.disabled=state.phase!=='ready'||state.bombs>=3;
    for(const name of ['bomb','wild'])q('merge-'+name).setAttribute('aria-pressed',String(power===name));
    q('merge-sound').setAttribute('aria-pressed',String(load('sound',true)));q('merge-sound').textContent=load('sound',true)?'♪':'♪̸';
    q('merge-hint').textContent=state.phase==='flying'?'Смотрим, что получится…':state.phase==='over'?'Линия пересечена. Можно отменить бросок.':power==='bomb'?'Прицелься бомбой в скопление кубиков':power==='wild'?'Радужный удвоит первый кубик на пути':state.moves===0?'Двигай кубик и отпускай':'Прицелься • отпусти • соедини';
    arena.dataset.phase=state.phase;view.setAim(aim,state.queue[0],power,state.phase==='ready');
  }
  function restart(){epoch++;state=createGame();undo=null;power='normal';aim=0;pointer=null;overHandled=false;accumulator=0;view.clearEffects();drawUI();persist();q('merge-status').textContent='Новая партия. Бросайте кубики к одинаковым числам.';}
  function undoShot(){if(!undo||adsPaused)return;epoch++;state=copyGame(undo);undo=null;power='normal';pointer=null;overHandled=false;accumulator=0;view.clearEffects();if(dialog.open)dialog.close();drawUI();persist();banner('Бросок отменён');}
  function shoot(){if(paused()||state.phase!=='ready')return;const before=copyGame(state);if(!launch(state,aim,power))return;undo=before;power='normal';overHandled=false;sound('shot');drawUI();persist();}
  function choosePower(name){if(paused()||state.phase!=='ready')return;power=power===name?'normal':name;drawUI();}
  q('merge-bomb').onclick=()=>choosePower('bomb');q('merge-wild').onclick=()=>choosePower('wild');q('merge-undo').onclick=undoShot;
  q('merge-help').onclick=()=>modal('Как играть',
    'Передвигайте кубик влево и вправо мышью или пальцем. Отпустите, чтобы бросить его вперёд. На компьютере также работают стрелки ← → и пробел.\n\nДва одинаковых числа при касании превращаются в одно вдвое больше: 2 + 2 = 4, 4 + 4 = 8. Кубики толкаются, отскакивают и могут запустить цепочку слияний. Соберите 2048 и продолжайте к новым числам!\n\nПосле остановки кубики должны оставаться за розовой линией. Если линия пересечена, партия завершается.\n\nБомба убирает кубики рядом с местом удара. Радужный кубик удваивает первый кубик, которого коснётся. Нажмите на бонус ещё раз, чтобы снять его. Отмена возвращает весь последний бросок, включая потраченный бонус.\n\nВ начале партии есть 2 бомбы и 1 радужный кубик. За каждое новое максимальное число от 256 начисляется бомба (до 3 в запасе). Прогресс и рекорд сохраняются на этом устройстве.');
  q('merge-pause').onclick=()=>modal('Пауза','Кубики подождут. Продолжим, когда будете готовы.',[['Продолжить']]);
  q('merge-new').onclick=()=>modal('Начать заново?','Текущая партия будет заменена. Рекорд останется.',[['Продолжить игру'],['Новая игра',restart]]);
  q('merge-sound').onclick=()=>{save('sound',!load('sound',true));if(!load('sound',true))audio?.suspend().catch(()=>{});drawUI();sound('merge');};

  const reward=rewardedButton('+1 бомба',()=>{state.bombs=Math.min(3,state.bombs+1);undo=null;drawUI();persist();},'merge','bomb');
  q('merge-rewards').append(reward);
  function reviveRound(){epoch++;if(revive(state)){undo=null;overHandled=false;power='normal';drawUI();persist();banner('Ещё один шанс!');}}
  async function gameOver(){
    if(overHandled||state.phase!=='over')return;overHandled=true;persist();const token=epoch;
    await afterRound('merge',state.roundId+'-'+state.moves);
    if(token!==epoch||state.phase!=='over'||disposed)return;
    const actions=[['Новая игра',restart]];if(undo)actions.unshift(['Отменить бросок',undoShot]);actions.push(['Посмотреть поле']);
    modal('Дорожка заполнена',`Счёт: ${fmt(state.score)}. Лучший кубик: ${fmt(state.maxValue)}. Самая длинная цепочка: ${state.bestCombo}.`,actions);
    if(!state.revived){const continueButton=rewardedButton('Продолжить',()=>{dialog.close();reviveRound();},'merge','continue');dialog.querySelector('.actions').prepend(continueButton);}
  }

  const canvas=view.canvas;
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0||pointer!==null||paused()||state.phase!=='ready')return;e.preventDefault();pointer=e.pointerId;aim=view.aimFromScreen(e.clientX);canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});view.setAim(aim,state.queue[0],power,true);});
  canvas.addEventListener('pointermove',e=>{if(paused()||state.phase!=='ready'||pointer!==null&&e.pointerId!==pointer)return;if(pointer===null&&e.pointerType!=='mouse')return;aim=view.aimFromScreen(e.clientX);view.setAim(aim,state.queue[0],power,true);});
  canvas.addEventListener('pointerup',e=>{if(pointer!==e.pointerId)return;e.preventDefault();pointer=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);shoot();});
  const cancelPointer=()=>{pointer=null;};canvas.addEventListener('pointercancel',cancelPointer);canvas.addEventListener('lostpointercapture',cancelPointer);canvas.addEventListener('contextmenu',e=>e.preventDefault());
  function keydown(e){
    if(paused()||['INPUT','SELECT','TEXTAREA','BUTTON'].includes(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;
    if(['ArrowLeft','ArrowRight',' ','Enter'].includes(e.key))e.preventDefault();
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){if(state.phase==='ready'){aim=Math.max(-3.07,Math.min(3.07,aim+(e.key==='ArrowLeft'?-.24:.24)));view.setAim(aim,state.queue[0],power,true);}}
    else if((e.key===' '||e.key==='Enter')&&!e.repeat)shoot();else if(e.key.toLowerCase()==='z')undoShot();else if(e.key==='Escape'){power='normal';drawUI();}
  }
  document.addEventListener('keydown',keydown);
  let lastPaused=false;
  function frame(t){
    if(disposed)return;raf=requestAnimationFrame(frame);const dt=last?Math.min(.05,(t-last)/1000):0;last=t;
    const stopped=paused();
    if(stopped!==lastPaused){lastPaused=stopped;pointer=null;accumulator=0;if(stopped)audio?.suspend().catch(()=>{});else if(load('sound',true))audio?.resume().catch(()=>{});}
    q('merge-paused').hidden=!stopped||dialog.open||adsPaused;
    if(stopped)return;
    accumulator+=dt;saveClock+=dt;let changed=false;
    while(accumulator>=FIELD.step){
      accumulator-=FIELD.step;
      for(const e of stepGame(state,FIELD.step)){
        if(e.type==='merge'){view.effect(e);sound('merge',e.combo);changed=true;q('merge-status').textContent=`Получился кубик ${e.value}. ${e.combo>1?'Комбо '+e.combo+'. ':''}Счёт ${state.score}.`;}
        else if(e.type==='blast'){view.effect(e);sound('blast');changed=true;}
        else if(e.type==='bonus'){banner(`Кубик ${fmt(e.value)}! ${e.gained?'+1 бомба':'Новый максимум'}`);changed=true;}
        else if(e.type==='milestone'){view.effect(e);banner(`${fmt(e.value)}! Продолжаем к новому рекорду`);}
        else if(e.type==='settled'){changed=true;persist();}
        else if(e.type==='over'){changed=true;void gameOver();}
      }
    }
    if(changed)drawUI();
    if(saveClock>1){saveClock=0;persist();}
    view.render(state,dt);
  }
  const hidden=()=>{pointer=null;last=0;accumulator=0;persist();if(document.hidden)audio?.suspend().catch(()=>{});};document.addEventListener('visibilitychange',hidden);
  const adsPause=()=>{pointer=null;accumulator=0;audio?.suspend().catch(()=>{});persist();};window.addEventListener('jarvis-ads-pause',adsPause);
  const pagehide=e=>{persist();if(!e.persisted){disposed=true;cancelAnimationFrame(raf);view.dispose();audio?.close().catch(()=>{});document.removeEventListener('keydown',keydown);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('jarvis-ads-pause',adsPause);}};window.addEventListener('pagehide',pagehide,{once:true});
  drawUI();persist();view.render(state,0);raf=requestAnimationFrame(frame);if(state.phase==='over')void gameOver();
  if(!restored&&load('merge'))toast('Новая 3D-механика готова. Ваш прежний рекорд сохранён.');
}
