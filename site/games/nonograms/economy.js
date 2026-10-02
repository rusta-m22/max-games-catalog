'use strict';
(() => {
const E = window.Economy = {}, D = ECONOMY_DATA;
const items = Object.fromEntries(D.items.map(x => [x.id, x]));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tr = (ru,en) => Game.lang === 'ru' ? ru : en;
const name = x => x.name[Game.lang === 'ru' ? 0 : 1];
const id = () => crypto.randomUUID?.() || Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const base = String(window.ECONOMY_CONFIG?.apiBase || '').replace(/\/$/,'');
let token='', userId='', epoch=0, connecting=null, payments=null, catalog=[], wallet=null;
let busy=false, flushing=null, purchaseBusy=false, adBusy=false, rankKind='daily', category='hint', lastBoard=null;
const G=()=>window.Game, B=(text,action,attrs='',cls='primary')=>Game.button(text,action,cls,attrs);
function data(){const s=Game.state; s.economy ??= {}; const e=s.economy;
 e.version=2;e.owned??={};e.hintCredits??={cell:s.hints||0,empty:0,fix:0,row:0,column:0};e.outbox??=[];e.localOps??=[];e.cosmetics??={};e.questClaims??={};e.pendingHints??=[];return e;}
function durable(){if(!Game.save(true))throw new Error('STORAGE_UNAVAILABLE');}
E.remote=()=>!!(base&&data().userId);
function applyWallet(w){if(!w)return;const e=data();if(w.revision<(e.revision||0))return;
 wallet=w;e.revision=w.revision;e.owned=w.owned;e.hintCredits=w.hintCredits;e.lastDailyPrize=w.lastDailyPrize;e.lastWeeklyPrize=w.lastWeeklyPrize;
 Game.state.coins=w.coins;Game.state.hints=w.hintCredits.cell;Game.state.claimed={...Game.state.claimed,...w.claimed};Game.state.megaRewards={...Game.state.megaRewards,...w.megaRewards};
 Game.save(true);Game.updateWallet();Game.applySettings();}
async function request(path,payload,anonymous=false){const currentEpoch=epoch;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
 try {const r=await fetch(base+path,{method:payload===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(!anonymous?{Authorization:'Bearer '+token}:{})},body:payload===undefined?undefined:JSON.stringify(payload),signal:controller.signal});
 const value=await r.json();if(currentEpoch!==epoch)throw new Error('ACCOUNT_CHANGED');if(!r.ok){if(r.status===401)token='';const e=new Error(value.error||'NETWORK');e.status=r.status;throw e;}return value;
 }finally{clearTimeout(timer);}}
function message(error){const c=error?.message;console.warn('[Economy]',c||'NETWORK');return ({NOT_ENOUGH_COINS:tr('Не хватает монет. Можно получить 25 монет за просмотр рекламы.','Not enough coins. Watch an ad to earn 25 coins.'),STORAGE_UNAVAILABLE:tr('Не удалось сохранить награду. Разреши сохранение данных браузера.','Could not save the reward. Allow browser storage.'),PERIOD_ENDED:tr('Период завершён. Начни новую зачётную головоломку.','This period has ended. Start a new ranked puzzle.'),ATTEMPT_CANCELED:tr('Эта попытка заменена новой.','A newer attempt replaced this one.'),AUTH_REQUIRED:tr('Войди в Яндекс, чтобы открыть покупки и рейтинг.','Sign in to Yandex to access purchases and rankings.'),AD_BUSY:tr('Подожди несколько секунд и попробуй снова.','Wait a few seconds and try again.'),ACCOUNT_CHANGED:tr('Аккаунт изменился. Повтори действие.','Your account changed. Please try again.'),NOT_COMPLETED:tr('Задание ещё не выполнено.','This task is not complete yet.')})[c]||tr('Нет связи с сервисом. Сохранённые награды отправятся при восстановлении связи.','The service is unavailable. Saved rewards will sync when the connection returns.');}
async function loadCatalog(){if(!Platform.sdk?.getPayments)return;try{payments=await Platform.sdk.getPayments({signed:true});catalog=await payments.getCatalog();}catch(_){payments=null;catalog=[];}}
E.connect = async function(interactive=false){if(connecting)return connecting;
 const run=async()=>{if(!Platform.sdk)return false;if(!Platform.cloudLoaded&&!(await Platform.loadAccount(!!Platform.accountLoadFailed)))throw new Error('NETWORK');let player=Platform.player;
 if(interactive&&!player?.isAuthorized?.()){const guest=JSON.parse(JSON.stringify(Game.state));await Platform.sdk.auth.openAuthDialog();await Platform.loadAccount(true,guest);player=Platform.player;}
 await loadCatalog();if(!base||!player?.isAuthorized?.())return false;
 const currentEpoch=epoch;player=await Platform.sdk.getPlayer({signed:true});if(currentEpoch!==epoch)return false;
 if(!player.signature)throw new Error('AUTH_REQUIRED');
 const result=await request('/api/auth',{signature:player.signature,legacy:Game.state,profile:{name:player.getName?.()||'',avatar:player.getPhoto?.('small')||''}},true);
 token=result.token;userId=result.userId;const e=data();if(e.userId&&e.userId!==userId){e.outbox=[];e.pendingHints=[];}
 e.userId=userId;e.revision=0;applyWallet(result.wallet);await E.flush();await E.restore();if(data().rankPending)await submitRanked(data().rankPending);return true;};
 connecting=run().catch(e=>{if(interactive)Game.toast(message(e));return false;}).finally(()=>connecting=null);return connecting;};
async function requireOnline(){if(!token&&!(await E.connect(false)))throw new Error('AUTH_REQUIRED');}
function queue(kind,payload,meta={},operationId=id()){const e=data();const row={operationId,kind,payload,meta,uid:e.userId};e.outbox.push(row);try{durable();}catch(error){e.outbox.pop();throw error;}return row;}
function applyHintReceipt(row){if(row.kind!=='hint_use')return;const e=data();const meta=row.meta;
 if(!e.pendingHints.some(x=>x.operationId===row.operationId))e.pendingHints.push({operationId:row.operationId,...meta});E.applyPendingHints();}
E.applyPendingHints=function(){const e=data();const b=Game.board,p=Game.current;if(!b||b.won)return;
 const pending=e.pendingHints.filter(x=>x.puzzle===p.id);if(!pending.length)return;
 e.pendingHints=e.pendingHints.filter(x=>x.puzzle!==p.id);
 for(const receipt of pending)b.applyHint(receipt.indices,true);Game.packDraft();durable();Game.updatePuzzle();};
async function sendRow(row){await requireOnline();if(row.uid!==userId)throw new Error('ACCOUNT_CHANGED');const result=await request('/api/action',row);applyWallet(result.wallet);data().outbox=data().outbox.filter(x=>x.operationId!==row.operationId);applyHintReceipt(row);durable();return result;}
E.flush=async function(){if(flushing||!token)return flushing;flushing=(async()=>{while(data().outbox.length){const row=data().outbox[0];
 try{await sendRow(row);}catch(e){if(e.status>=400&&e.status<500&&![401,429].includes(e.status)){data().outbox=data().outbox.filter(x=>x.operationId!==row.operationId);durable();Game.toast(message(e));continue;}break;}
 }} )().finally(()=>flushing=null);return flushing;};
async function action(kind,payload,meta={}){await requireOnline();await E.flush();if(data().outbox.length)throw new Error('NETWORK');const row=queue(kind,payload,meta);try{return await sendRow(row);}catch(e){if(e.status>=400&&e.status<500&&e.status!==401&&e.status!==429){data().outbox=data().outbox.filter(x=>x!==row);durable();}throw e;}}
function localChange(operation,fn){const e=data();if(e.localOps.includes(operation))return false;const before=JSON.stringify(Game.state);
 try{fn();e.localOps.push(operation);e.localOps=e.localOps.slice(-500);durable();Game.updateWallet();return true;}catch(error){Game.replaceState(JSON.parse(before));throw error;}}
E.restore=async function(){if(!payments||!token||purchaseBusy)return;purchaseBusy=true;
 try{const list=await payments.getPurchases();if(!list.signature)throw new Error('PURCHASE_SIGNATURE_REQUIRED');
 const result=await request('/api/purchases',{signature:list.signature});applyWallet(result.wallet);
 // Server committed every token before it is consumed. Retrying an acknowledged token never re-credits it.
 for(const purchaseToken of result.consumeTokens){try{await payments.consumePurchase(purchaseToken);}catch(_){/* recovered at the next launch or via Restore */}}
 if(result.granted)Game.toast('+'+result.granted+' '+tr('монет','coins'));
 }finally{purchaseBusy=false;}};
async function buyProduct(product){if(purchaseBusy)return;await requireOnline();if(!payments||!catalog.some(p=>p.id===product))throw new Error('NETWORK');
 purchaseBusy=true;let purchased=false;
 try {const intent=await request('/api/purchase-intent',{product});Platform.pause('payment',true);await payments.purchase({id:product,developerPayload:intent.developerPayload});purchased=true;}
 catch(_){Game.toast(tr('Покупка не завершена. Баланс обновится после подтверждения оплаты.','Purchase not completed. Your balance updates after payment confirmation.'));}
 finally{Platform.pause('payment',false);purchaseBusy=false;}
 // A cancelled window can still leave an earlier paid purchase pending recovery.
 await E.restore();if(purchased)refresh();}
E.watchAd=async function(reward='coins'){if(adBusy||Platform.adBusy||!Platform.sdk?.adv)return false;adBusy=true;const currentEpoch=epoch;
 try{let ticket=id();if(E.remote()){await requireOnline();ticket=(await request('/api/ad/start',{reward})).ticket;}durable();let saved=false,error=null;
 const watched=await Platform.ad(true,()=>{if(currentEpoch!==epoch)return;try{
 if(E.remote())queue('ad_reward',{ticket},{},'ad:'+ticket);
 else localChange('ad:'+ticket,()=>{if(reward==='coins')Game.state.coins+=25;else{data().hintCredits.cell++;Game.state.hints=data().hintCredits.cell;}});
 saved=true;
 }catch(e){error=e;}});
 if(error)throw error;
 if(saved){await E.flush();Game.toast(E.remote()&&data().outbox.some(x=>x.operationId==='ad:'+ticket)?tr('Награда сохранена и будет начислена после подключения.','Reward saved. It will be credited after reconnecting.'):(reward==='coins'?'+25 '+tr('монет','coins'):tr('Подсказка получена','Hint received')));refresh();return true;}
 if(!watched)Game.toast(tr('Награда не получена: просмотр не завершён или реклама недоступна.','No reward: the ad was not completed or is unavailable.'));return false;
 }finally{adBusy=false;}};
E.owned=id=>!!data().owned[id];
E.worldOpen=w=>NonoCore.worldOpen(Game.state,w)||E.owned('world_'+w)||D.items.some(i=>i.world===w&&E.owned(i.id));
E.unlock=p=>p.type==='ranked'||p.type==='bonus'&&E.owned(p.pack)||p.type==='mega'&&E.owned('mega_'+p.mega)||p.type==='secret'&&E.owned('secret_'+p.world+'_'+(p.index-24))||p.type==='normal'&&(E.owned('size_'+p.n)||E.owned('world_'+p.world)||E.owned('chapter_'+p.world+'_'+Math.floor(p.index/6)));
function already(item){if(item.kind==='hint')return false;if(E.owned(item.id))return true;
 if(item.kind==='world')return NONO_DATA.levels.filter(p=>p.world===item.world&&p.type==='normal').every(p=>Game.unlocked(p));
 if(item.kind==='chapter')return NONO_DATA.levels.filter(p=>p.world===item.world&&p.type==='normal'&&Math.floor(p.index/6)===item.chapter).every(p=>Game.unlocked(p));
 if(item.kind==='size')return NONO_DATA.levels.filter(p=>p.n===item.size&&p.type==='normal').every(p=>Game.unlocked(p));
 if(item.kind==='secret')return Game.unlocked(NONO_DATA.levels.find(p=>p.id===item.level));
 if(item.kind==='mega')return Game.megaOpen(NONO_DATA.megas[item.mega]);return false;}
async function buyItem(key){const item=items[key];if(!item||already(item))return;
 if(E.remote())await action('shop',{id:key});else localChange(id(),()=>{if(Game.state.coins<item.cost)throw new Error('NOT_ENOUGH_COINS');Game.state.coins-=item.cost;if(item.kind==='hint'){data().hintCredits[item.hint]++;Game.state.hints=data().hintCredits.cell;}else data().owned[key]=true;});
 Game.toast(tr('Покупка сохранена','Purchase saved'));refresh();}
E.hints=function(){const p=Game.current,b=Game.board;if(!p||!b||b.won||['pure','ranked'].includes(p.type))return;
 Game.showModal(`<p class="eyebrow">${tr('ИСКРА ИДЕИ','A SPARK OF AN IDEA')}</p><h2>${tr('Выбери подсказку','Choose a hint')}</h2><div class="hint-options">${D.items.filter(x=>x.kind==='hint').map(item=>{const indices=b.hintTargets(item.hint);return B(`${esc(name(item))}<small>${data().hintCredits[item.hint]||0} ${tr('в запасе','available')} · ${item.cost} ◈</small>`,'eco-hint',`data-id="${item.hint}" ${indices.length?'':'disabled'}`,'secondary');}).join('')}</div><p class="small">${tr('Строка и столбец: до 5 клеток выбранной линии. Сначала используется запас подсказок.','Row and column: up to 5 cells in the selected line. Stored hints are used first.')}</p>`);};
async function useHint(kind){const b=Game.board,p=Game.current;if(!b||b.won||['pure','ranked'].includes(p.type))return;const indices=b.hintTargets(kind);if(!indices.length)return;
 Game.closeModal();Platform.pause('economy',true);
 try{if(E.remote())await action('hint_use',{hint:kind,puzzle:p.id},{puzzle:p.id,indices});
 else{localChange(id(),()=>{const e=data();if(e.hintCredits[kind]>0)e.hintCredits[kind]--;else{const price=items['hint_'+kind].cost;if(Game.state.coins<price)throw new Error('NOT_ENOUGH_COINS');Game.state.coins-=price;}Game.state.hints=e.hintCredits.cell;e.pendingHints.push({operationId:id(),puzzle:p.id,indices});});E.applyPendingHints();}
 Game.updatePuzzle();}finally{Platform.pause('economy',false);}}
E.rewardHint=async function(){const b=Game.board;if(await E.watchAd('hint')&&Game.board===b)await useHint('cell');};
E.recordWin=function(p,b){const day=Platform.date(),rec=Game.state.daily[day]??={ids:[],perfect:0,colour:0,claimed:[]};rec.pure??=0;rec.pureIds??=[];if(!b.hints&&!rec.pureIds.includes(p.id)){rec.pure++;rec.pureIds.push(p.id);}
 if(E.remote()){queue('solve',{id:p.id,cells:b.values.map(v=>v<0?'x':v).join(''),errors:b.errors,hints:b.hints});E.flush();}}
E.claimAchievement=async function(key){if(E.remote())await action('achievement',{id:key});else{const row=Game.achievementList().find(r=>r[0]===key);if(!row||row[4]<row[5]||Game.state.claimed[key])return;localChange('achievement:'+key,()=>{Game.state.claimed[key]=true;Game.state.coins+=row[6];});}Game.renderAchievements();};
function daily(){if(wallet&&E.remote()&&wallet.daily.day===Platform.date())return wallet.daily;const day=Platform.date(),r=Game.state.daily[day]||{},counts=[r.ids?.length||0,r.colour||0,r.perfect||0,r.pure||0,0],old={three:0,perfect:1,colour:2};
 return {day,tasks:['three','colour','perfect','pure','ranked'].map((key,i)=>({id:key,count:Math.min(counts[i],[3,1,1,1,3][i]),target:[3,1,1,1,3][i],coins:[60,40,40,40,80][i],claimed:!!data().questClaims[day+':'+key]||r.claimed?.includes(old[key])}))};}
async function claimQuest(key){const d=daily(),task=d.tasks.find(x=>x.id===key);if(!task||task.claimed||task.count<task.target)return;
 if(E.remote())await action('quest',{day:d.day,id:key});else localChange('quest:'+d.day+':'+key,()=>{Game.state.coins+=task.coins;data().questClaims[d.day+':'+key]=true;});refresh();}
function status(){return !Platform.sdk?tr('Покупки, реклама и рейтинг доступны в Яндекс Играх.','Purchases, ads and rankings are available in Yandex Games.'):!base?tr('Магазин монет и рейтинг готовятся к открытию. Приключение уже доступно.','Coin purchases and rankings are coming soon. Enjoy the adventure now.'):!token?tr('Войди, чтобы сохранять покупки и участвовать в рейтинге.','Sign in to save purchases and join the rankings.'):tr('Баланс и покупки сохранены в аккаунте.','Balance and purchases are saved to your account.');}
function notice(){return `<div class="economy-status"><p>${status()}</p>${base&&Platform.sdk?B(tr(token?'Обновить':'Войти в Яндекс',token?'Refresh':'Sign in to Yandex'),'eco-connect','','ghost'):''}</div>`;}
function cardDesc(item){return ({hint:tr('Запас подсказок для обычных головоломок.','Stored hints for casual puzzles.'),size:tr('Ранний доступ к обычным полям этого размера.','Early access to regular puzzles of this size.'),world:tr('Открывает 24 обычные головоломки мира.','Unlocks this world’s 24 regular puzzles.'),chapter:tr('Открывает 6 обычных головоломок главы.','Unlocks 6 regular puzzles in this chapter.'),secret:tr('Открывает секретную головоломку.','Unlocks a secret puzzle.'),mega:tr('Открывает все фрагменты мега-картины.','Unlocks every fragment of a mega picture.'),pack:tr('Новая коллекция: ','New collection: ')+(item.count||NONO_DATA.levels.filter(p=>p.pack===item.id).length)+tr(' головоломок.',' puzzles.'),cosmetic:tr('Украшение игры. Не влияет на очки рейтинга.','A decoration. Does not affect ranking points.')})[item.kind]||'';}
E.renderShop=function(){const categories=[['hint','Подсказки','Hints'],['size','Размеры','Sizes'],['world','Миры','Worlds'],['chapter','Главы','Chapters'],['pack','Коллекции','Collections'],['secret','Секреты','Secrets'],['mega','Мега','Mega'],['cosmetic','Оформление','Decorations']];
 Game.shell(`${Game.title(tr('ТВОИ МАЛЕНЬКИЕ СОКРОВИЩА','YOUR LITTLE TREASURES'),tr('Магазин <em>открытий.</em>','A shop of <em>discoveries.</em>'),tr('Монеты из уровней, заданий, призов и рекламы тратятся так же, как купленные.','Coins from puzzles, tasks, prizes and ads work just like purchased coins.'))}${notice()}<section class="ad-reward panel"><div><p class="eyebrow">${tr('БЕСПЛАТНЫЕ МОНЕТЫ','FREE COINS')}</p><h2>+25 ◈</h2><p>${tr('Посмотри видео и получи 25 монет.','Watch a video to earn 25 coins.')}</p></div>${B(Visuals.icon('play')+tr('Смотреть рекламу · +25','Watch ad · +25'),'eco-ad',Platform.sdk?.adv?'':'disabled')}</section><div class="section-heading"><h2>${tr('Купить монеты','Buy coins')}</h2>${B(tr('Восстановить покупки','Restore purchases'),'eco-restore',base&&Platform.sdk?'':'disabled','ghost')}</div><div class="coin-packs">${D.products.filter(product=>!Platform.sdk||catalog.some(x=>x.id===product.id)).map((product,i)=>{const offer=catalog.find(x=>x.id===product.id);let currency='';try{currency=offer?.getPriceCurrencyImage?.('small')||'';}catch(_){}return `<article class="coin-pack"><div class="coin-art">${['◈','◈ ◈','✦ ◈','◈ ✦ ◈','✦ ◈ ✦','✦ ◈ ✦'][i]}</div><h3>${product.coins.toLocaleString(Game.lang)} ◈</h3><p>${tr('Монеты для открытий','Coins for discoveries')}</p>${B(offer?esc(offer.price)+(currency&&/^https:\/\//.test(currency)?` <img class="currency-icon" src="${esc(currency)}" alt="">`:''):tr('Недоступно','Unavailable'),'eco-product',`data-id="${product.id}" ${offer&&base?'':'disabled'}`)}</article>`;}).join('')}</div><div class="section-heading"><h2>${tr('Потратить монеты','Spend coins')}</h2>${B(tr('Мои покупки','My purchases'),'nav','data-target="extras"','ghost')}</div><p class="small">${tr('300 основных уровней и 5 мега-картин можно открыть прохождением. Монеты позволяют открыть их раньше.','All 300 campaign puzzles and 5 mega pictures unlock through play. Coins can unlock them earlier.')}</p><div class="shop-tabs" role="group" aria-label="${tr('Категории магазина','Shop categories')}">${categories.map(([key,ru,en])=>B(tr(ru,en),'eco-category',`data-id="${key}" aria-pressed="${category===key}"`,category===key?'primary':'ghost')).join('')}</div><div class="shop-grid">${D.items.filter(item=>item.kind===category).map(item=>{const owned=already(item),stored=item.kind==='hint'?data().hintCredits[item.hint]||0:null;return `<article class="shop-item"><span class="shop-symbol">${Visuals.icon(item.kind==='hint'?'bolt':item.kind==='cosmetic'?'theme':item.kind==='mega'?'mega':'album')}</span><h3>${esc(name(item))}</h3><p>${esc(cardDesc(item))}</p>${stored!==null?`<small>${tr('В запасе','Available')}: ${stored}</small>`:''}${B(owned?(E.owned(item.id)?tr('Куплено','Purchased'):tr('Открыто','Unlocked')):item.cost+' ◈','eco-buy',`data-id="${item.id}" ${owned?'disabled':''}`,owned?'ghost':'secondary')}</article>`;}).join('')}</div>`,'shop');};
E.renderExtras=function(){const packs=D.items.filter(x=>x.kind==='pack'&&E.owned(x.id));const cosmetics=D.items.filter(x=>x.kind==='cosmetic'&&E.owned(x.id));
 Game.shell(`${Game.title(tr('ТВОЯ КОЛЛЕКЦИЯ','YOUR COLLECTION'),tr('Мои <em>покупки.</em>','My <em>purchases.</em>'),tr('Дополнительные истории и украшения.','Extra stories and decorations.'),B(tr('В магазин','Shop'),'nav','data-target="shop"','ghost'))}<div class="shop-grid">${cosmetics.map(item=>`<article class="shop-item"><h3>${esc(name(item))}</h3>${B(tr(data().cosmetics[item.id]?'Выключить':'Применить',data().cosmetics[item.id]?'Turn off':'Apply'),'eco-cosmetic',`data-id="${item.id}"`,'secondary')}</article>`).join('')}</div>${packs.length?packs.map(pack=>`<div class="section-heading"><h2>${esc(name(pack))}</h2><span>${NONO_DATA.levels.filter(p=>p.pack===pack.id&&Game.state.done[p.id]).length} / ${pack.count||NONO_DATA.levels.filter(p=>p.pack===pack.id).length}</span></div><div class="level-grid">${NONO_DATA.levels.filter(p=>p.pack===pack.id).map(Game.levelTile).join('')}</div>`).join(''):`<div class="panel"><p>${tr('Здесь появятся купленные дополнительные коллекции.','Your purchased extra collections will appear here.')}</p></div>`}`,'extras');};
E.renderDaily=function(){const p=Game.dailyPuzzle(),d=daily();const labels={three:['Реши 3 разные головоломки','Solve 3 different puzzles'],colour:['Реши цветную головоломку','Solve a colour puzzle'],perfect:['Реши без ошибок','Solve without mistakes'],pure:['Реши без подсказок','Solve without hints'],ranked:['Реши 3 зачётные головоломки','Solve 3 ranked puzzles']};
 Game.shell(`${Game.title(tr('МАЛЕНЬКИЙ РИТУАЛ','A LITTLE RITUAL'),tr('Твоё открытие <em>сегодня.</em>','Your discovery <em>today.</em>'),d.day+' · '+tr('Обновление в 00:00 UTC','Refresh at 00:00 UTC'))}<div class="daily-layout"><section class="daily-feature">${Visuals.scene(p.world)}<div><h2>${tr('Головоломка дня','Daily puzzle')}</h2><p>${p.n} × ${p.n} · +80 ◈</p>${B(tr('Играть','Play'),'daily-start')}</div></section><section class="panel"><p class="eyebrow">${tr('ЕЖЕДНЕВНЫЕ ЗАДАНИЯ','DAILY TASKS')}</p>${d.tasks.map(task=>`<div class="quest"><div><h3>${tr(...labels[task.id])}</h3><p>${task.count} / ${task.target} · +${task.coins} ◈${task.id==='ranked'?' · +100 '+tr('очков и эффект «Звёзды»','points and Stars effect'):''}</p></div>${B(tr(task.claimed?'Получено':'Забрать',task.claimed?'Claimed':'Claim'),'eco-quest',`data-id="${task.id}" ${task.claimed||task.count<task.target?'disabled':''}`,'small-btn')}</div>`).join('')}${B(tr('Играть в зачёт','Play ranked'),'nav','data-target="ranking"','ghost')}</section></div>`,'daily');};
E.renderRanking=function(){Game.shell(`${Game.title(tr('ОБЩЕЕ ИСПЫТАНИЕ','A SHARED CHALLENGE'),tr('Таблица <em>лидеров.</em>','The <em>leaderboard.</em>'),tr('Три бесплатных поля в день, одинаковых для всех. Подсказки отключены.','Three free puzzles a day, identical for everyone. Hints are disabled.'))}${notice()}<div class="shop-tabs">${B(tr('День','Day'),'eco-period','data-id="daily"',rankKind==='daily'?'primary':'ghost')}${B(tr('Неделя','Week'),'eco-period','data-id="weekly"',rankKind==='weekly'?'primary':'ghost')}</div><div id="ranking-content"><div class="panel">${tr('Загрузка рейтинга…','Loading rankings…')}</div></div>`,'ranking');loadRanking();};
function rowHtml(row,own=false){const avatar=/^https:\/\//.test(row.avatar||'')?`<img src="${esc(row.avatar)}" alt="" referrerpolicy="no-referrer">`:'<span class="avatar-fallback">✦</span>';return `<tr class="${own?'own-row':''}"><td>${row.rank}</td><td><div class="rank-player">${avatar}<span>${esc(row.name||tr('Игрок','Player'))}${own?' · '+tr('ты','you'):''}</span></div></td><td>${row.score.toLocaleString(Game.lang)}</td></tr>`;}
async function loadRanking(){const kind=rankKind,el=document.getElementById('ranking-content');if(!el)return;
 if(!token){el.innerHTML=`<div class="panel"><p>${tr('Войди в Яндекс, чтобы участвовать в рейтинге и получать призы.','Sign in to Yandex to join rankings and win prizes.')}</p>${base&&Platform.sdk?B(tr('Войти в Яндекс','Sign in to Yandex'),'eco-connect'):''}</div>`;return;}
 try{await E.flush();const result=await request('/api/rank?kind='+kind);if(!el.isConnected||kind!==rankKind)return;lastBoard=result;applyWallet(result.wallet);
 const rules=kind==='daily'?D.dailyRewards:D.weeklyRewards;let prev=0;const schedule=rules.map(([max,coins])=>{const r=`${prev+1===max?max:(prev+1)+'–'+max}: ${coins} ◈`;prev=max;return r;}).join(' · ');
 el.innerHTML=`<div class="ranking-summary panel"><p class="eyebrow">${esc(result.period)} · UTC</p><h2>${result.own?tr('Твоё место: ','Your rank: ')+result.own.rank:tr('Начни с первого поля','Start with the first puzzle')}</h2><p>${tr('До конца периода','Period ends')}: ${new Date(result.endsAt).toLocaleString(Game.lang,{timeZone:'UTC'})} UTC</p><div class="rank-puzzles">${result.puzzles.map(p=>B(`${p.n} × ${p.n} · ${tr('Играть','Play')}`,'eco-ranked',`data-slot="${p.slot}"`,'secondary')).join('')}</div><p class="small">${tr('Очки: N² + 100, до 100 за скорость, 100 без ошибок. Лучший результат каждого поля. Все 3 поля: ещё 100 очков. Неделя — сумма дней; при равенстве выше более ранний результат. Пауза не останавливает зачётное время.','Points: N² + 100, up to 100 for speed, 100 without mistakes. Best result per puzzle. All 3: 100 extra points. Weekly score is the daily total; earlier scores win ties. Pausing does not stop ranked time.')}</p></div><div class="rank-table-wrap"><table class="rank-table"><thead><tr><th>${tr('Место','Rank')}</th><th>${tr('Игрок','Player')}</th><th>${tr('Очки','Score')}</th></tr></thead><tbody>${result.entries.map(row=>rowHtml(row,row.userId===userId)).join('')||`<tr><td colspan="3">${tr('Пока нет результатов','No scores yet')}</td></tr>`}${result.own&&!result.entries.some(x=>x.userId===userId)?rowHtml(result.own,true):''}</tbody></table></div><section class="panel rank-prizes"><h3>${tr('Призы за завершённый период','Prizes for the completed period')}</h3><p>${schedule}</p>${result.wallet.prizes.map(p=>`<div class="quest"><div><h3>${tr(p.kind==='daily'?'День':'Неделя',p.kind==='daily'?'Day':'Week')} · ${p.period}</h3><p>${tr('Место','Rank')} ${p.rank} · +${p.coins} ◈</p></div>${B(tr('Забрать','Claim'),'eco-prize',`data-kind="${p.kind}" data-period="${p.period}"`,'small-btn')}</div>`).join('')||`<p class="small">${tr('Награды появляются после завершения периода. День — 00:00 UTC, неделя — понедельник 00:00 UTC.','Prizes appear after the period ends. Days end at 00:00 UTC, weeks on Monday at 00:00 UTC.')}</p>`}</section>`;
 }catch(e){if(el.isConnected)el.innerHTML=`<div class="panel"><p>${esc(message(e))}</p>${B(tr('Повторить','Retry'),'eco-period',`data-id="${kind}"`,'ghost')}</div>`;}}
async function startRanked(slot){await requireOnline();await E.flush();const r=await request('/api/rank/start',{slot});const p=r.puzzle;p.rankSlot=slot;Game.start(p,true);}
E.restartRanked=slot=>startRanked(slot).catch(e=>Game.toast(message(e)));
E.rankedWin=async function(p,b){Platform.setPlaying(false);const row={ticket:p.ticket,cells:b.values.map(x=>x<0?'x':x).join(''),errors:b.errors,hints:b.hints};data().rankPending=row;durable();await submitRanked(row,p);};
async function submitRanked(row,p){let text;
 try{await requireOnline();const r=await request('/api/rank/finish',row);applyWallet(r.wallet);delete data().rankPending;durable();text='+'+r.points+' '+tr('очков','points');
 const native=window.ECONOMY_CONFIG?.lifetimeLeaderboard;if(native&&Platform.sdk.leaderboards){const info=await request('/api/rank?kind=weekly');/* Optional SDK mirror of the all-time ranked total. */try{await Platform.sdk.leaderboards.setScore(native,info.lifetimeScore||r.points);}catch(_){}}
 }catch(e){if(e.status===409){delete data().rankPending;durable();}text=message(e);}
 if(Game.current?.id===p?.id)Game.showModal(`<p class="eyebrow">${tr('ЗАЧЁТНОЕ ПОЛЕ','RANKED PUZZLE')}</p><div class="victory-art">${Visuals.photo(p,280,!document.body.classList.contains('reduced'))}</div><h2>${esc(text)}</h2><p>${tr('Монеты и платные открытия не влияют на результат.','Coins and paid unlocks do not affect your score.')}</p>${B(tr('К рейтингу','View rankings'),'nav','data-target="ranking"')}`,false);}
E.cosmetics=function(){if(!window.Game)return;const c=data().cosmetics;for(const key of ['background_stars','frame_gold','cells_round','effect_stars'])document.body.classList.toggle(key,!!c[key]&&E.owned(key));if(c.theme_ocean&&E.owned('theme_ocean'))document.body.dataset.theme='ocean';if(c.theme_lavender&&E.owned('theme_lavender'))document.body.dataset.theme='lavender';};
function refresh(){if(['shop','extras','daily','ranking'].includes(Game.screen))Game.navigate(Game.screen);Game.updateWallet();}
E.attach=function(){data();window.addEventListener('online',()=>E.connect().then(()=>E.flush()));
 window.addEventListener('account-changing',()=>{epoch++;token='';userId='';wallet=null;payments=null;catalog=[];connecting=null;});
 window.addEventListener('cloud-data',()=>E.connect());window.addEventListener('account-data',()=>E.connect());
 setInterval(()=>{if(base&&Platform.sdk&&!token&&!document.hidden)E.connect();if(token&&!document.hidden&&!Platform.adBusy){E.flush();if(['daily','ranking'].includes(Game.screen))request('/api/wallet').then(r=>{applyWallet(r.wallet);refresh();}).catch(()=>{});}},60000);
};
E.init=function(){data();if(Platform.cloudLoaded)E.connect();else if(!base)loadCatalog();};
document.addEventListener('click',async event=>{const el=event.target.closest('[data-action^="eco-"]');if(!el||el.disabled||busy)return;busy=true;el.disabled=true;
 try{const actionName=el.dataset.action,key=el.dataset.id;
 if(actionName==='eco-category'){category=key;E.renderShop();}
 else if(actionName==='eco-connect'){await E.connect(true);if(data().rankPending)await submitRanked(data().rankPending);refresh();}
 else if(actionName==='eco-product')await buyProduct(key);
 else if(actionName==='eco-restore'){await requireOnline();await E.restore();Game.toast(tr('Покупки проверены','Purchases checked'));refresh();}
 else if(actionName==='eco-buy')await buyItem(key);
 else if(actionName==='eco-hint')await useHint(key);
 else if(actionName==='eco-ad')await E.watchAd('coins');
 else if(actionName==='eco-quest')await claimQuest(key);
 else if(actionName==='eco-period'){rankKind=key;E.renderRanking();}
 else if(actionName==='eco-ranked')await startRanked(+el.dataset.slot);
 else if(actionName==='eco-prize'){await action('prize',{kind:el.dataset.kind,period:el.dataset.period});refresh();}
 else if(actionName==='eco-cosmetic'&&E.owned(key)){const c=data().cosmetics;if(key.startsWith('theme_')){const next=!c[key];c.theme_ocean=false;c.theme_lavender=false;c[key]=next;}else c[key]=!c[key];Game.applySettings();durable();refresh();}
 }catch(error){Game.toast(message(error));if(error.message==='NOT_ENOUGH_COINS')Game.showModal(`<h2>${tr('Нужно немного монет','A few more coins')}</h2><p>${esc(message(error))}</p>${B(tr('Реклама · +25 монет','Watch ad · +25 coins'),'eco-ad',Platform.sdk?.adv?'':'disabled')}${B(tr('Купить монеты','Buy coins'),'nav','data-target="shop"','ghost')}`);}
 finally{busy=false;if(el.isConnected)el.disabled=false;}
});
})();
