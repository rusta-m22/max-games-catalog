import {$,load,save} from './common.js';
import {afterRound,adsPaused} from './ads.js';
import {CHARGE,LEVELS,SECTORS,KINDS,createRun,act,hint,objectives,stars,readProgress,record,adjacent} from './orbit-engine.js';
import {createView,SYMBOLS} from './orbit-view.js';
import {createAudio} from './orbit-audio.js';
const KEY='orbit-expedition-v2';
const RULES=[
 ['↔','Обмен и каскады','Меняйте соседние кристаллы нажатием или свайпом. Ряд из трёх исчезает. Неудачный обмен не тратит ход; каскады умножают очки.'],
 ['⇆','Особые кристаллы','Четыре в ряд создают луч. Пересечение рядов — сверхновую 3×3. Пять в ряд — призму: обменяйте её с любым цветом. Два особых кристалла можно объединить.'],
 ['◈','Астероиды и находки','Собирайте комбинации над золотистыми клетками. Усиленная кора требует двух попаданий. Под знаком ✧ спрятан артефакт. Бур полностью пробивает одну клетку.'],
 ['⊕','Орбитальный импульс','Каждый убранный кристалл заряжает реактор. При 36 единицах выберите клетку: импульс очистит её строку и столбец, не расходуя ход.'],
 ['↻','Живая экспедиция','В Поясе Титана каждые 5 ходов звёздный дождь бьёт по трём астероидам. В Туманности Эха каждые 4 хода меняется направление дальнейшего падения.'],
 ['✹','Резонанс','Три каскада за одно действие дают 8 дополнительных единиц заряда. Бонус срабатывает один раз за действие. Собирайте длинные цепочки, чтобы чаще запускать импульс.'],
 ['★','Звёзды и сохранения','Выполните все цели. Для 3 звёзд сохраните не меньше 32% ходов, для 2 — 12%. Прогресс сохраняется на этом устройстве. Повторные попытки без ограничений.']
];
const icons={score:'ϟ',rocks:'◈',relics:'✧'};
const goalHTML=s=>objectives(s).map(g=>`<div class="orb-goal ${g.value>=g.target?'complete':''}" data-goal="${g.type}"><span class="orb-goal-icon" ${g.kind!==undefined?`data-kind="${g.kind}"`:''}>${g.type==='color'?SYMBOLS[g.kind]:icons[g.type]}</span><span class="orb-goal-label">${g.label}</span><span class="orb-goal-count">${g.value>=g.target?'✓':Math.min(g.value,g.target).toLocaleString('ru-RU')+' / '+g.target.toLocaleString('ru-RU')}</span><span class="orb-meter"><i style="width:${Math.min(100,g.value/g.target*100)}%"></i></span></div>`).join('');
const starHTML=n=>Array.from({length:3},(_,i)=>`<span class="${i<n?'':'off'}">★</span>`).join('');
export function start(root){
 if(!document.querySelector('[data-orbit-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('../orbit.css',import.meta.url).href;link.dataset.orbitStyle='';document.head.append(link);}
 document.body.classList.add('orbit-page');root.classList.add('orbit-root');
 const progress=readProgress(load(KEY),load('orbit'));let s=progress.run||createRun(progress.unlocked),busy=false,aim='',selected=-1,highlights=[],focusIndex=0,epoch=0,idleTimer,eventTimer,comboTimer,down;
 const dialog=$('#modal');dialog.classList.add('orbit-dialog');
 root.innerHTML=`<div class="orb-cosmos" aria-hidden="true"><div class="orb-nebula"></div><div class="orb-distant-planet"></div><div class="orb-stardust"></div></div><div class="orb-top"><div><p class="orb-kicker">ЭКСПЕДИЦИЯ «ИСКРА» <span class="orb-3d-badge">3D</span></p><h2 id="orb-sector-title"></h2></div><div class="orb-toolbar"><button class="orb-btn" id="orb-map">Карта</button><button class="orb-btn" id="orb-rules" aria-label="Правила игры">?</button><button class="orb-btn orb-sound" id="orb-sound" aria-label="Звук">♪</button></div></div>
 <div class="orb-layout"><aside class="orb-side orb-left"><section class="orb-panel orb-sector-card"><span class="orb-label" id="orb-sector-count"></span><div class="orb-sector-art" id="orb-sector-art"><div class="orb-planet-stars"></div><div class="orb-planet"></div><div class="orb-probe"><i></i><span></span><i></i></div></div><h3 id="orb-sector-subtitle"></h3><p id="orb-story"></p><div class="orb-route-progress" id="orb-route-progress"></div><button class="orb-btn" id="orb-map-side">Маршрут экспедиции ↗</button><div class="orb-journal"><span>✧</span><div id="orb-artifacts"></div></div></section><div class="orb-side-note"><span>⌁</span><div><b>Сигнал навигатора</b><br><span id="orb-world-event"></span></div></div></aside>
 <section class="orb-center"><div class="orb-arena"><div class="orb-arena-head"><div><p class="orb-mission-id" id="orb-mission-id"></p><h3 class="orb-mission-name" id="orb-mission-name"></h3></div><div class="orb-moves" id="orb-moves"><strong>0</strong><span>ХОДОВ<br>ОСТАЛОСЬ</span></div></div><div class="orb-board" id="orb-board"><div class="orb-grid" id="orb-grid" role="grid" aria-label="Игровое поле: 8 строк и 8 столбцов"></div><div class="orb-fx" id="orb-fx" aria-hidden="true"></div><div class="orb-combo" id="orb-combo" aria-hidden="true"></div><div class="orb-event" id="orb-event" aria-hidden="true"></div></div><div class="orb-arena-foot"><span id="orb-sector-footer"></span><span class="orb-gravity" id="orb-gravity"></span></div></div>
 <div class="orb-tools"><button class="orb-tool pulse" id="orb-pulse"><span class="tool-icon">⊕</span><span class="tool-text"><b>Импульс</b><small id="orb-charge-label"></small></span><span class="orb-charge-fill" id="orb-charge-fill"></span></button><button class="orb-tool" id="orb-drill"><span class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="23" height="23" aria-hidden="true"><circle cx="12" cy="12" r="6"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/><circle cx="12" cy="12" r="1.5"/></svg></span><span class="tool-text"><b>Бур <span id="orb-drills"></span></b><small>Точный удар</small></span></button><button class="orb-tool" id="orb-hint"><span class="tool-icon">✦</span><span class="tool-text"><b>Подсказка</b><small>Найти пару</small></span></button></div>
 <p class="orb-live" id="orb-live" role="status" aria-live="polite"></p><button class="orb-btn accent orb-result-button" id="orb-result">Результат миссии</button></section>
 <aside class="orb-side orb-right"><section class="orb-panel orb-objectives-panel"><div class="orb-label">Цели полёта <span>✦</span></div><div class="orb-goals" id="orb-goals"></div><div class="orb-star-track" id="orb-star-track" aria-label="Звёзды миссии"></div><div class="orb-score-row"><span>Очки экспедиции</span><b id="orb-score">0</b></div></section><section class="orb-panel orb-legend"><h3>СИЛА КОМБИНАЦИЙ</h3><div class="orb-legend-row"><span class="orb-special-mark">⇆</span><div><strong>4 в ряд → луч</strong>Очищает целую линию</div></div><div class="orb-legend-row"><span class="orb-special-mark nova">✺</span><div><strong>Т / Г → сверхновая</strong>Взрыв в области 3×3</div></div><div class="orb-legend-row"><span class="orb-special-mark prism">✦</span><div><strong>5 в ряд → призма</strong>Собирает выбранный цвет</div></div><div class="orb-resonance-note"><span>✹</span><div><b>3 каскада → резонанс</b><small>+8 заряда для импульса</small></div></div><button class="orb-btn" id="orb-retry">Начать миссию заново</button></section></aside></div><p class="orb-page-foot">СОКРОВИЩА ОРБИТЫ · 3D-ЭКСПЕДИЦИЯ</p>`;
 // The game owns the available viewport; existing information stays in the map/rules.
 const flight=document.createElement('section');flight.className='orb-flight';
 const top=$('.orb-top');const back=document.createElement('a');back.className='orb-back';back.href='index.html';back.setAttribute('aria-label','В каталог');back.textContent='‹';top.prepend(back);
 const hud=document.createElement('div');hud.className='orb-flight-hud';hud.append($('.orb-arena-head'),$('#orb-goals'));
 const foot=document.createElement('div');foot.className='orb-flight-footer';foot.append($('.orb-arena-foot'),$('.orb-tools'),$('#orb-live'),$('#orb-result'));
 flight.append(top,hud,$('#orb-board'),foot);root.append(flight);
 const boardEl=$('#orb-board'),grid=$('#orb-grid');
 const cells=Array.from({length:64},(_,i)=>{const b=document.createElement('button');b.className='orb-cell';b.dataset.index=i;b.tabIndex=i===0?0:-1;b.setAttribute('role','gridcell');b.setAttribute('aria-rowindex',String((i/8|0)+1));b.setAttribute('aria-colindex',String(i%8+1));b.onclick=e=>{if(e.detail===0)choose(i);};grid.append(b);return b;});
 const view=createView(boardEl,()=>adsPaused||dialog.open);
 const audio=createAudio(()=>load('sound',true),()=>adsPaused||document.hidden);
 const fxTimers=new Set();
 function later(fn,ms){const id=setTimeout(()=>{fxTimers.delete(id);fn();},ms);fxTimers.add(id);return id;}
 function persist(){record(progress,s);save(KEY,progress);}
 function live(text){$('#orb-live').textContent=text;}
 function syncSound(){const enabled=load('sound',true);$('#orb-sound').textContent=enabled?'♪':'♪̸';$('#orb-sound').setAttribute('aria-pressed',String(enabled));$('#orb-sound').setAttribute('aria-label',enabled?'Выключить звук':'Включить звук');}
 function drawHUD(state=s){
  const l=LEVELS[state.level-1],sector=SECTORS[l.sector];root.style.setProperty('--orb-accent',sector.color);root.dataset.sector=l.sector;dialog.style.setProperty('--orb-accent',sector.color);
  $('#orb-sector-title').textContent=sector.name;$('#orb-sector-count').textContent=`СЕКТОР ${String(l.sector+1).padStart(2,'0')} / 03`;
  $('#orb-sector-art').dataset.sector=l.sector;$('#orb-sector-subtitle').textContent=sector.subtitle;$('#orb-story').textContent=sector.story;
  $('#orb-route-progress').innerHTML=Array.from({length:8},(_,i)=>`<i class="${progress.stars[l.sector*8+i]?'done':''}"></i>`).join('');
  $('#orb-artifacts').innerHTML=`${progress.stars.filter(Boolean).length} из 24 миссий<br>${[7,15,23].filter(i=>progress.stars[i]).length} из 3 реликвий атласа`;
  $('#orb-world-event').textContent=sector.event;$('#orb-mission-id').textContent=`МИССИЯ ${String(state.level).padStart(2,'0')} / 24`;
  $('#orb-mission-name').textContent=l.name;$('#orb-moves strong').textContent=state.moves;$('#orb-moves').classList.toggle('low',state.moves<=5);
  $('#orb-goals').innerHTML=goalHTML(state);
  const possible=state.moves>=Math.ceil(l.moves*.32)?3:state.moves>=Math.ceil(l.moves*.12)?2:1;$('#orb-star-track').innerHTML=`<span class="orb-track-stars">${starHTML(s.done?stars(s):possible)}</span><small>${s.done?'Звёзды миссии':'Завершите цели · сохраните ходы'}</small>`;$('#orb-score').textContent=state.score.toLocaleString('ru-RU');
  $('#orb-sector-footer').textContent=l.sector===1?`Звёздный дождь через ${5-state.turn%5} ход.`:l.sector===2?`Поворот через ${4-state.turn%4} ход.`:`Энергия: ${state.score.toLocaleString('ru-RU')}`;
  $('#orb-gravity').textContent=`${['↓','←','↑','→'][state.gravity]} Гравитация`;
  $('#orb-drills').textContent=`×${state.drills}`;$('#orb-charge-label').textContent=state.energy>=CHARGE?'Готов к запуску':`${state.energy} / ${CHARGE} заряда`;
  $('#orb-charge-fill').style.setProperty('--charge',state.energy/CHARGE*100+'%');$('#orb-pulse').classList.toggle('ready',state.energy>=CHARGE);$('#orb-pulse').classList.toggle('active',aim==='pulse');$('#orb-drill').classList.toggle('active',aim==='drill');
  $('#orb-pulse').setAttribute('aria-pressed',String(aim==='pulse'));$('#orb-drill').setAttribute('aria-pressed',String(aim==='drill'));
  for(const id of ['orb-hint','orb-retry'])$('#'+id).disabled=busy||s.done;$('#orb-pulse').disabled=busy||s.done||state.energy<CHARGE;$('#orb-drill').disabled=busy||s.done||state.drills<=0;
  $('#orb-map').disabled=$('#orb-map-side').disabled=busy;$('#orb-result').classList.toggle('show',s.done&&!busy);grid.setAttribute('aria-busy',String(busy));boardEl.dataset.aim=aim;
 }
 function drawCells(state=s){cells.forEach((b,i)=>{const t=state.board[i];b.classList.toggle('selected',i===selected);b.classList.toggle('hint',highlights.includes(i));b.setAttribute('aria-selected',String(i===selected));b.dataset.rock=state.rocks[i]||'';b.innerHTML=(state.rocks[i]?`<span class="orb-crust">${state.rocks[i]===2?'Ⅱ':'Ⅰ'}</span>`:'')+(state.relics[i]?'<span class="orb-relic">✧</span>':'');b.setAttribute('aria-label',`Строка ${(i/8|0)+1}, столбец ${i%8+1}: ${t?KINDS[t.kind]:'пусто'}${t?.special?', '+({row:'горизонтальный луч',column:'вертикальный луч',nova:'сверхновая',prism:'призма'}[t.special]):''}${state.rocks[i]?`, астероид ${state.rocks[i]} слоя`:''}${state.relics[i]?', скрытый артефакт':''}`);});view.highlight(selected,highlights);}
 function idle(){clearTimeout(idleTimer);if(s.done)return;idleTimer=setTimeout(()=>{if(busy||aim||dialog.open||document.hidden||adsPaused)return;highlights=hint(s)||[];drawCells();},8000);}
 function draw(){drawHUD();drawCells();view.set(s);syncSound();live(s.done?s.won?'Все цели выполнены. Новый маршрут открыт.':'Ходы закончились. Попробуйте другой маршрут комбинаций.':aim?aim==='pulse'?'Выберите центр импульса: строка + столбец. Ход не расходуется.':'Выберите клетку для бура. Он пробьёт оба слоя астероида.':'Соберите три кристалла · длинные цепочки создают особые');idle();}
 function flash(text){const el=$('#orb-event');el.textContent=text;el.classList.add('show');clearTimeout(eventTimer);eventTimer=setTimeout(()=>el.classList.remove('show'),2300);}
 function combo(n){const el=$('#orb-combo');el.innerHTML=`<small>${n>=3?'ЗВЁЗДНЫЙ РАЗГОН!':'ОТЛИЧНАЯ ЦЕПОЧКА!'}</small>КАСКАД ×${n}`;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');clearTimeout(comboTimer);comboTimer=setTimeout(()=>el.classList.remove('show'),850);}
 function waveFeedback(frame){
  if(!frame.cleared.length)return;const fx=$('#orb-fx'),center=frame.cleared[Math.floor(frame.cleared.length/2)],p=view.project(center);
  const score=document.createElement('span');score.className='orb-score-pop';score.textContent='+'+frame.gain.toLocaleString('ru-RU');score.style.left=p.x*100+'%';score.style.top=p.y*100+'%';fx.append(score);later(()=>score.remove(),900);
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){const rect=boardEl.getBoundingClientRect(),target=$('#orb-pulse').getBoundingClientRect();for(const [j,i]of frame.cleared.slice(0,6).entries()){const from=view.project(i),spark=document.createElement('i');spark.className='orb-energy-spark';spark.style.cssText=`left:${from.x*100}%;top:${from.y*100}%;--dx:${target.x+target.width/2-rect.x-from.x*rect.width}px;--dy:${target.y+target.height/2-rect.y-from.y*rect.height}px;animation-delay:${j*25}ms`;fx.append(spark);later(()=>spark.remove(),950);}}
 }
 function openDialog(html,actions){clearTimeout(idleTimer);dialog.innerHTML=`<button class="orb-dialog-close" aria-label="Закрыть">×</button>${html}<div class="actions"></div>`;dialog.querySelector('.orb-dialog-close').onclick=()=>dialog.close();for(const [label,fn,primary]of actions){const b=document.createElement('button');b.className='orb-btn'+(primary?' accent':'');b.textContent=label;b.onclick=()=>{dialog.close();fn?.();};dialog.querySelector('.actions').append(b);}if(!dialog.open)dialog.showModal();}
 function briefing(){const l=LEVELS[s.level-1],sector=SECTORS[l.sector],tips={1:'Начните с подсвеченной пары. Ошибка при обмене не тратит ход.',3:'Золотистая клетка — астероид. Соберите ряд над ней, чтобы пробить кору.',4:'Знак ✧ отмечает находку под астероидом. Очистите её клетку.',9:'Каждые пять ходов звёздный дождь помогает пробить астероиды.',11:'Клетки с отметкой Ⅱ нужно задеть дважды. Бур пробивает их сразу.',17:'После каждого четвёртого хода гравитация поворачивается. Кристаллы начинают падать с другой стороны.'};
  openDialog(`<p class="orb-kicker">${sector.name} · МИССИЯ ${s.level}</p><h2>${l.name}</h2><p>${tips[s.level]||'Выполните все цели, пока есть ходы. Лучи, сверхновые и импульс помогут добраться до сложных клеток.'}</p><div class="orb-brief-goals"><div class="orb-goals">${goalHTML(s)}</div></div><p class="orb-star-rule" style="margin:15px 0 0">${l.moves} ходов · 2 бура · без ограничения времени</p>`,[['Начать миссию',()=>{if(s.level===1){highlights=hint(s)||[];drawCells();}idle();},true]]);
 }
 function newLevel(n){epoch++;s=createRun(n);selected=-1;aim='';highlights=[];busy=false;persist();draw();briefing();}
 function showMap(sectorIndex=LEVELS[s.level-1].sector){
  const sector=SECTORS[sectorIndex];openDialog(`<p class="orb-kicker">ЗВЁЗДНЫЙ АТЛАС</p><h2>Маршрут экспедиции</h2><div class="orb-map-tabs">${SECTORS.map((sec,i)=>`<button class="${i===sectorIndex?'active':''}" data-sector="${i}">${String(i+1).padStart(2,'0')} · ${sec.name}</button>`).join('')}</div><p>${sector.story}</p><div class="orb-map-voyage"><div class="orb-map-orbit" aria-hidden="true"></div><div class="orb-map-nodes">${LEVELS.filter(l=>l.sector===sectorIndex).map(l=>`<button class="orb-node ${l.id===s.level?'current':''}" data-level="${l.id}" ${l.id>progress.unlocked?'disabled':''} aria-label="Миссия ${l.id}: ${l.name}${l.id>progress.unlocked?', закрыта':''}"><b>${l.id>progress.unlocked?'·':l.id}</b><small>${progress.stars[l.id-1]?'★'.repeat(progress.stars[l.id-1])+'☆'.repeat(3-progress.stars[l.id-1]):l.id>progress.unlocked?'ЗАКРЫТО':'СТАРТ'}</small></button>`).join('')}</div></div><div class="orb-map-artifacts">${SECTORS.map((sec,i)=>`<div class="${progress.stars[i*8+7]?'':'locked'}"><span>${['◈','✺','✧'][i]}</span>${sec.artifact}</div>`).join('')}</div>`,[['К текущей миссии',null,true],['Повторить текущую',()=>confirmRetry()]]);
  dialog.querySelectorAll('[data-sector]').forEach(b=>b.onclick=()=>showMap(Number(b.dataset.sector)));
  dialog.querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>{const n=Number(b.dataset.level);if(n>progress.unlocked)return;dialog.close();if(n===s.level&&!s.done){idle();return;}if(!s.done&&(s.turn>0||s.drills<2)){openDialog('<h2>Перейти к другой миссии?</h2><p>Текущая попытка начнётся заново при возвращении. Собранные звёзды сохранятся.</p>',[['Отмена',()=>showMap(sectorIndex)],['Перейти',()=>newLevel(n),true]]);}else newLevel(n);});
 }
 function confirmRetry(){openDialog('<h2>Новая попытка?</h2><p>Цели останутся прежними, кристаллы перемешаются. Звёзды и открытые миссии сохранятся.</p>',[['Продолжить игру'],['Начать заново',()=>newLevel(s.level),true]]);}
 function showResult(){
  if(!s.done)return;const won=s.won,n=stars(s),allDone=progress.stars.every(Boolean),sectorReward=won&&s.level%8===0;
  const message=won?(sectorReward?`Найдена реликвия «${SECTORS[LEVELS[s.level-1].sector].artifact}»! `:'')+(allDone?'Атлас собран. Возвращайтесь в миссии, чтобы улучшить звёзды.':'Все цели выполнены. Продолжайте исследование звёздного атласа.'):'Попробуйте собирать длинные комбинации и направлять импульс на оставшиеся цели.';
  const actions=[];if(won&&s.level<24)actions.push(['Следующая миссия',()=>newLevel(s.level+1),true]);else if(!won)actions.push(['Попробовать ещё',()=>newLevel(s.level),true]);actions.push(['Карта экспедиции',()=>showMap(),won&&s.level===24]);
  openDialog(`<p class="orb-kicker">${won?'МИССИЯ ВЫПОЛНЕНА':'НОВАЯ ПОПЫТКА — НОВЫЙ МАРШРУТ'}</p>${won?`<div class="orb-stars" aria-label="${n} из 3 звёзд">${starHTML(n)}</div>`:''}<h2>${won?(s.level===24?'Туманность раскрыта!':'Орбита исследована!'):'Сигнал ещё не найден'}</h2><p>${message}</p><div class="orb-result-meta"><div><b>${s.score.toLocaleString('ru-RU')}</b><small>ОЧКОВ</small></div><div><b>${s.moves}</b><small>ХОДОВ В ЗАПАСЕ</small></div><div><b>×${s.maxCombo}</b><small>ЛУЧШИЙ КАСКАД</small></div></div><div class="orb-brief-goals"><div class="orb-goals">${goalHTML(s)}</div></div>`,actions);
 }
 async function execute(action){
  const result=act(s,action);if(!result.ok){audio.play('invalid');selected=-1;drawCells();boardEl.classList.remove('rejected');void boardEl.offsetWidth;boardEl.classList.add('rejected');live('Обмен не создаёт ряд. Ход сохранён — выберите другую пару.');idle();return;}
  clearTimeout(idleTimer);busy=true;selected=-1;aim='';highlights=[];const token=++epoch;s=result.state;persist();drawHUD(result.frames[0]?.state||s);drawCells(result.frames[0]?.state||s);
  for(const e of result.events)if(e.type==='pulse'||e.type==='special'||e.type==='drill'){flash(e.label);if(e.index!==undefined)view.burst(e.index,e.type);audio.play('pulse');}
  for(const frame of result.frames){if(token!==epoch)return;if(frame.type==='clear'){if(frame.combo>1)combo(frame.combo);waveFeedback(frame);audio.play('clear',frame.combo);}if(frame.type==='resonance'){flash('Резонанс · +8 заряда');audio.play('resonance');view.burst(27,'nova');view.burst(36,'nova');}if(frame.type==='shuffle')flash('Новых ходов нет — поле перемешано');await view.play(frame);if(token!==epoch)return;drawHUD(frame.state);drawCells(frame.state);}
  if(token!==epoch)return;busy=false;draw();for(const e of result.events)if(['meteor','gravity','relic'].includes(e.type))flash(e.label||`Найдено артефактов: ${e.count}`);
  if(s.energy===CHARGE&&!s.done)live('Реактор заряжен! Нажмите «Импульс» и выберите центр удара.');
  if(s.done){if(s.won){audio.play('win');view.celebrate();await view.wait(650);}try{await afterRound('orbit',`${s.level}-${s.seed}-${s.turn}`);}catch{ /* A failed ad provider must never hide the result. */ }if(token===epoch)showResult();}
 }
 function choose(i){
  if(busy||s.done||adsPaused||dialog.open)return;idle();
  if(aim){execute({type:aim,index:i});return;}
  if(selected===i){selected=-1;drawCells();return;}
  if(selected<0){audio.play('select');selected=i;highlights=[];drawCells();live('Теперь выберите соседний кристалл.');return;}
  if(!adjacent(selected,i)){selected=i;drawCells();return;}
  execute({type:'swap',a:selected,b:i});
 }
 function setAim(type){if(busy||s.done||adsPaused||dialog.open)return;aim=aim===type?'':type;selected=-1;highlights=[];draw();}
 $('#orb-pulse').onclick=()=>setAim('pulse');$('#orb-drill').onclick=()=>setAim('drill');
 $('#orb-hint').onclick=()=>{if(busy||s.done||adsPaused)return;selected=-1;aim='';highlights=hint(s)||[];drawHUD();drawCells();live('Подсвеченная пара создаст комбинацию.');idle();};
 $('#orb-map').onclick=$('#orb-map-side').onclick=()=>showMap();$('#orb-retry').onclick=()=>confirmRetry();$('#orb-result').onclick=showResult;
 $('#orb-rules').onclick=()=>openDialog(`<p class="orb-kicker">БОРТОВОЙ СПРАВОЧНИК</p><h2>Как исследовать орбиту</h2>${RULES.map(([i,title,text])=>`<div class="orb-instructions"><span>${i}</span><p><b>${title}</b><br>${text}</p></div>`).join('')}`,[['К игре',null,true]]);
 $('#orb-sound').onclick=()=>{save('sound',!load('sound',true));syncSound();if(load('sound',true))audio.play('select');else audio.mute();};dialog.addEventListener('close',idle);
 grid.onpointerdown=e=>{if(busy||s.done||dialog.open||adsPaused)return;const cell=e.target.closest('[data-index]');if(!cell)return;e.preventDefault();audio.unlock();down={x:e.clientX,y:e.clientY,index:Number(cell.dataset.index),pointer:e.pointerId};grid.setPointerCapture(e.pointerId);};
 grid.onpointerup=e=>{if(!down||down.pointer!==e.pointerId)return;const d=down;down=null;const dx=e.clientX-d.x,dy=e.clientY-d.y;let i=d.index;
  if(Math.hypot(dx,dy)>Math.max(12,grid.clientWidth/8*.28)&&!aim){const next=d.index+(Math.abs(dx)>Math.abs(dy)?Math.sign(dx):8*Math.sign(dy));if(adjacent(d.index,next)){selected=d.index;i=next;}else return;}choose(i);
 };
 grid.onpointercancel=grid.onlostpointercapture=()=>down=null;
 grid.onkeydown=e=>{const i=Number(e.target.dataset.index);if(!Number.isInteger(i))return;if(e.key==='Escape'){aim='';selected=-1;drawHUD();drawCells();return;}let n=i;if(e.key==='ArrowLeft')n=i%8?i-1:i;if(e.key==='ArrowRight')n=i%8<7?i+1:i;if(e.key==='ArrowUp')n=i>=8?i-8:i;if(e.key==='ArrowDown')n=i<56?i+8:i;if(n!==i){e.preventDefault();cells[focusIndex].tabIndex=-1;focusIndex=n;cells[n].tabIndex=0;cells[n].focus();}};
 const dispose=()=>{epoch++;clearTimeout(idleTimer);clearTimeout(eventTimer);clearTimeout(comboTimer);view.dispose();audio.dispose();fxTimers.forEach(clearTimeout);};window.addEventListener('pagehide',e=>{if(!e.persisted)dispose();},{once:true});
 persist();draw();if(s.done)showResult();else if(s.turn===0&&s.drills===2)briefing();
 return {dispose};
}
