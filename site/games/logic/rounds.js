'use strict';
window.EXTRA_ROUNDS=(()=>{
const B=window.EXTRA_BANKS, D=window.LOGIC_DATA;
const meta=[
['common','Найди общее','Common ground','Три картинки — одна идея.','Three pictures, one idea.','Что объединяет картинки?','What connects these pictures?','Выбери общую связь.','Choose the connection.','lightbulb'],
['blend','Два в одном','Two in one','Узнай обе половинки.','Recognise both halves.','Какие два объекта здесь?','Which two objects are combined?','Слева один предмет, справа — другой.','One object on the left, another on the right.','scissors'],
['childhood','Секреты детства','Early beginnings','Узнай, кто вырастет.','Who will it grow into?','Кем или чем это станет?','What will this grow into?','Рассмотри малыша или семя и выбери взрослую форму.','Look at the baby or seed and choose its adult form.','sprout'],
['shadow','Бой с тенью','Shadow detective','Угадай по силуэту.','Recognise the silhouette.','Чья это тень?','Whose shadow is this?','Узнай предмет по тёмному контуру.','Recognise the object from its dark outline.','moon'],
['wisdom','Продолжи мудрость','Finish the saying','Закончи известную фразу.','Complete a familiar saying.','Как заканчивается фраза?','How does the saying end?','Выбери верное продолжение.','Choose the correct ending.','book-open'],
['formula','Формула всего','Picture formula','Сложи две идеи.','Add two ideas together.','Что получится вместе?','What do these ideas make?','Сложи смысл картинок, а не числа.','Combine the ideas, not numbers.','flask'],
['link','Потерянное звено','Missing link','Построй мостик между картинками.','Connect two different pictures.','Какое звено их соединяет?','What links these pictures?','Выбери промежуточную связь.','Choose the connecting idea.','key-round'],
['fourth','Четвёртый элемент','Fourth element','Открывай подсказки по одной.','Reveal clues one at a time.','На что указывают подсказки?','What do the clues point to?','Две подсказки видны. Нажми на карточки 3 и 4, если нужно.','Two clues are visible. Tap cards 3 and 4 if needed.','gem'],
['room','Кто здесь живёт?','Mystery room','Исследуй комнату с уликами.','Explore a room full of clues.','Кто работает в этой комнате?','Who works in this room?','Открывай отмеченные места и изучай найденные вещи.','Tap the marked places and examine the objects you find.','door-open'],
['cinema','Киноребусы','Story on screen','Узнай сказку по трём уликам.','Three clues to a screen story.','Какая сказка здесь зашифрована?','Which story is hidden here?','Вспомни сказку и её экранизации.','Think of the fairy tale and its screen adaptations.','clapperboard'],
['animated','Назови меня','Name the scene','Разгадай движущуюся сценку.','Decode an animated scene.','Какое название показывает сценка?','Which title does the scene show?','Предметы буквально изображают название истории.','The objects illustrate a story title literally.','film'],
['missing','Чего не хватает?','Something is missing','Найди пропавшую деталь.','Find the missing part.','Что забыли нарисовать?','What is missing from the drawing?','Выбери деталь, которая вернёт рисунку привычный вид.','Choose the part that completes the picture.','pencil'],
['absurd','Что за нелепица?','Spot the absurdity','Найди чужой предмет.','Spot the odd addition.','Что здесь явно лишнее?','What does not belong here?','В предмет добавили деталь от другой вещи.','An unrelated object has been added to this picture.','glasses'],
['idiom','Классика жанра','Picture phrases','Прочитай выражение по картинкам.','Read a phrase in pictures.','Какое выражение здесь спрятано?','Which expression is pictured?','Подумай о переносном смысле.','Think of a familiar expression.','message'],
['secret','Секретный объект','Secret object','Загляни под окошки.','Peek behind the tiles.','Что спрятано под маской?','What is behind the mask?','Можно открыть ещё три окошка.','You may open three more windows.','lock-keyhole'],
['sequence','Что дальше?','What comes next?','Продолжи числовой ряд.','Complete the number sequence.','Какое число будет следующим?','Which number comes next?','Найди правило и продолжи ряд.','Find the rule and continue the sequence.','number']
].map(([id,ru,en,dr,de,qr,qe,ir,ie,icon])=>({id,name:{ru,en},desc:{ru:dr,en:de},question:{ru:qr,en:qe},instruction:{ru:ir,en:ie},icon}));
// Additional native SVG symbols use simple colourful forms; no external asset requests.
const symbols={
caterpillar:['Гусеница','Caterpillar','🐛'],tadpole:['Головастик','Tadpole','tadpole'],acorn:['Жёлудь','Acorn','acorn'],chick:['Цыплёнок','Chick','🐤'],duckling:['Утёнок','Duckling','🦆'],kitten:['Котёнок','Kitten','🐱'],puppy:['Щенок домашней собаки','Domestic puppy','🐶'],calf:['Телёнок на ферме','Farm calf','🐮'],foal:['Жеребёнок','Foal','🐴'],lamb:['Ягнёнок','Lamb','🐑'],piglet:['Поросёнок','Piglet','🐷'],pinecone:['Сосновая шишка','Pine cone','pinecone'],bicycle:['Велосипед','Bicycle','🚲'],motor:['Мотор','Engine','⚙️'],honey:['Мёд','Honey','🍯'],sheep:['Овца','Sheep','🐑'],scarf:['Шарф','Scarf','🧣'],cow:['Корова','Cow','🐄'],cheese:['Сыр','Cheese','🧀'],grain:['Зерно','Grain','🌾'],bread:['Хлеб','Bread','🍞'],album:['Альбом','Album','📒'],frame:['Рамка','Frame','🖼️'],school:['Школа','School','🏫'],watering:['Лейка','Watering can','watering'],tripod:['Штатив','Tripod','tripod'],stethoscope:['Стетоскоп','Stethoscope','🩺'],bandage:['Бинт','Bandage','🩹'],hospital:['Больница','Hospital','🏥'],brick:['Кирпич','Brick','🧱'],thread:['Нитки','Thread','🧵'],shirt:['Рубашка','Shirt','👕'],bee:['Пчела','Bee','🐝'],hive:['Улей','Beehive','hive'],ticket:['Билет','Ticket','🎫'],suitcase:['Чемодан','Suitcase','🧳'],passport:['Паспорт','Passport','passport'],microphone:['Микрофон','Microphone','🎤'],shell:['Ракушка','Shell','🐚'],seed:['Семя','Seed','seed'],helmet:['Шлем','Helmet','⛑️'],flag:['Флаг','Flag','🏁'],ball:['Мяч','Ball','⚽'],trophy:['Кубок','Trophy','🏆'],pumpkin:['Тыква','Pumpkin','🎃'],shoe:['Туфелька','Slipper','👠'],hood:['Красный капюшон','Red hood','hood'],basket:['Корзинка','Basket','🧺'],wolf:['Волк','Wolf','🐺'],mirror:['Зеркало','Mirror','🪞'],boots:['Сапоги','Boots','👢'],bag:['Мешок','Bag','bag'],lake:['Озеро','Lake','lake'],swan:['Лебедь','Swan','🦢'],tower:['Башня','Tower','🏰'],hair:['Длинные волосы','Long hair','hair'],spindle:['Веретено','Spindle','spindle'],wood:['Дерево','Wood','🪵'],puppet:['Деревянная кукла','Wooden puppet','puppet'],nose:['Нос','Nose','nose'],sled:['Сани','Sled','🛷'],gold:['Золото','Gold','gold'],bear:['Медведь','Bear','🐻'],tin:['Олово','Tin','tin'],soldier:['Солдатик','Soldier','soldier'],prince:['Маленький принц','Little prince','🤴'],hand:['Рука','Hand','✋'],rope:['Верёвка','Rope','rope'],bucket:['Ведро','Bucket','🪣'],head:['Голова','Head','🙂'],elephant:['Слон','Elephant','🐘'],ear:['Ухо','Ear','👂'],noodle:['Лапша','Noodles','🍜'],ice:['Лёд','Ice','🧊'],water:['Вода','Water','💧'],mouth:['Рот','Mouth','👄'],number:['Числа','Numbers','🔢'],storm:['Буря','Storm','⛈️'],mole:['Крот','Mole','mole'],eye:['Глаз','Eye','👁️'],flask:['Колба','Flask','🧪'],message:['Фраза','Phrase','💬']};
const special={
tadpole:'<ellipse cx="10" cy="10" rx="5" ry="6" fill="#61cdbb"/><path d="M11 15q12 7 8-6q-2 9-8 6" fill="#57adcc"/><circle cx="8" cy="8" r=".7" fill="#162c56"/>',
acorn:'<path d="M6 10q0 11 6 12q6-1 6-12" fill="#cf8844"/><path d="M4 11q0-7 8-7t8 7Z" fill="#83502d"/><path d="M12 4q0-3 3-3"/>',
pinecone:'<ellipse cx="12" cy="13" rx="7" ry="9" fill="#ad713e"/><path d="m6 7 6 4 6-4M5 12l7 4 7-4M7 18l5 3 5-3"/>',
watering:'<path d="M4 10h10v11H4Zm10 3 6-5 2 2-8 8M4 11C-2 1 12 1 12 10" fill="#69c4e0"/>',
tripod:'<rect x="5" y="3" width="14" height="8" rx="2" fill="#9983e5"/><circle cx="12" cy="7" r="2"/><path d="M12 11v11m0-11-7 11m7-11 7 11"/>',
hive:'<path d="M5 19h14M4 16h16M5 12h14M7 8h10M10 4h4" stroke="#db941d" stroke-width="5"/><circle cx="12" cy="17" r="2" fill="#513819"/>',
passport:'<rect x="4" y="2" width="16" height="20" rx="2" fill="#579bc7"/><circle cx="12" cy="10" r="4"/><path d="M8 18h8m-8-8h8m-4-4v8"/>',
seed:'<ellipse cx="12" cy="14" rx="5" ry="7" fill="#b28240"/><path d="M12 8q0-5 5-6q0 6-5 6" fill="#6abc73"/>',
hood:'<path d="M3 22V12C3 0 21 0 21 12v10l-9-5Z" fill="#f34d71"/><path d="M7 14V11c0-7 10-7 10 0v3" fill="#fccfac"/>',
bag:'<path d="m8 7-3-5h14l-3 5q14 16-4 16Q-6 23 8 7" fill="#d5a675"/><path d="M7 8h10"/>',
lake:'<ellipse cx="12" cy="16" rx="11" ry="6" fill="#4ebfe0"/><path d="m3 7 5-5 4 7m0-2 4-5 6 7M5 15h5m3 4h6"/>',
hair:'<path d="M6 22V9C6-1 18-1 18 9v13h-5V9h-2v13Z" fill="#f9d566"/>',
spindle:'<path d="M12 1v22"/><path d="m12 5 6 6-6 8-6-8Z" fill="#cd91df"/><path d="m8 10 8 3m-7-6 7 3m-6 4 4 2"/>',
puppet:'<circle cx="12" cy="5" r="3" fill="#dbab70"/><path d="M9 10h6v7H9Zm3 7-4 6m4-6 4 6m-7-13-6 5m12-5 6 5" fill="#cd885f"/>',
nose:'<path d="M10 3q0 9-5 13q0 5 10 2l4-3" fill="#ffc49e"/>',
gold:'<path d="m5 8 14 0 4 12H1Z" fill="#ffcd36"/><path d="m5 8 3-4h9l2 4" fill="#ffe991"/>',
tin:'<rect x="5" y="4" width="14" height="18" rx="3" fill="#a4bdcb"/><path d="M5 8h14M8 12h8M8 16h8"/>',
soldier:'<rect x="8" y="1" width="8" height="4" fill="#283975"/><circle cx="12" cy="7" r="3" fill="#ffc6a2"/><path d="M8 11h8v7H8Zm2 7v5m4-5v5m-6-12-4 5m12-5 4 5" fill="#f26675"/>',
rope:'<path d="M3 5c15-11 21 6 9 9S0 25 20 19" stroke="#b27d42" stroke-width="3"/>',
mole:'<ellipse cx="12" cy="17" rx="9" ry="6" fill="#ac7f66"/><circle cx="12" cy="11" r="5" fill="#856054"/><circle cx="10" cy="10" r=".7"/><path d="m14 11 4 1-4 2" fill="#f1a0ae"/>'
};
for(const [id,[ru,en,art]]of Object.entries(symbols)){D.objects[id]={id,ru,en};window.LOGIC_ICONS[id]=special[art]||`<text x="12" y="18.5" text-anchor="middle" font-size="19" stroke="none" fill="currentColor" font-family="'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji',sans-serif">${art}</text>`;}
const shadowPool=['umbrella','guitar','plane','rocket','car','bike','ship','scissors','key-round','flower-2','tree-pine','glasses','lamp','hammer','camera','anchor','armchair','tent','magnet','snowman','crown','heart','star','dog','cat','rabbit','squirrel','turtle'];
const absurdBases=['car','bike','ship','guitar','umbrella','snowman','armchair','lamp','camera','tree-pine','plane','coffee'];
const absurdExtras=['carrot','fish','flower-2','banana','crown','ice-cream-cone','butterfly','star'];
// Added butterfly uses an existing native shape, not a network image.
D.objects.butterfly={id:'butterfly',ru:'Бабочка',en:'Butterfly'};window.LOGIC_ICONS.butterfly='<path d="M12 12C-4-6-2 21 10 16c-8 13 10 9 2-4C28-6 26 21 14 16c8 13-10 9-2-4" fill="#b38aef"/><path d="M12 6v14m0-14-3-3m3 3 3-3"/>';
function drawMissing(id,complete=false){
 const shapes={
 bike:['<path d="m7 15 4-9 6 9H7l-3-9h4m3 0h4m1-3h3l-2 12"/>','<circle cx="5" cy="17" r="4"/><circle cx="19" cy="17" r="4"/>'],
 clock:['<circle cx="12" cy="12" r="10" fill="#ffe6a0"/><path d="M12 3v1m9 8h-1m-8 9v-1m-9-8h1"/>','<path d="M12 6v6l4 3"/>'],
 flower:['<path d="M12 11v12m0-3q-8-1-7-6q6 0 7 6m0-2q8-1 7-6q-6 0-7 6" fill="#69d39e"/><circle cx="12" cy="8" r="3" fill="#ffd443"/>','<path d="M9 6C1 0 1 12 9 10C1 18 16 18 14 11C23 16 24 2 15 6C18-3 6-3 9 6Z" fill="#f682b1"/>'],
 umbrella:['<path d="M2 13C3-1 21-1 22 13q-3-3-6 0q-4-3-8 0q-3-3-6 0" fill="#a9a2ff"/>','<path d="M12 12v8q0 5 5 0"/>'],
 guitar:['<path d="m15 1 3 1-5 12c7 2 4 10-3 9S0 17 5 14q-1-7 5-6Z" fill="#ffcf79"/><circle cx="9" cy="16" r="2"/>','<path d="m16 3-7 17m8-17-7 17m-3 0h5"/>'],
 car:['<path d="m2 17 1-7 4-1 3-5h7l4 7h2v6Z" fill="#7ebfee"/><path d="M7 10h13M12 5v5"/>','<circle cx="6" cy="18" r="3" fill="#384b78"/><circle cx="19" cy="18" r="3" fill="#384b78"/>'],
 face:['<circle cx="12" cy="12" r="10" fill="#ffe480"/><circle cx="8" cy="9" r="1"/><circle cx="16" cy="9" r="1"/>','<path d="M7 15q5 7 10 0" fill="#fa8797"/>'],
 snowman:['<circle cx="12" cy="17" r="6" fill="#ddf5ff"/><circle cx="12" cy="7" r="4" fill="#ddf5ff"/><circle cx="11" cy="6" r=".5"/><path d="m6 16-4-4m16 4 4-4M12 14v1m0 3v1"/>','<path d="m12 8 9 1-9 2Z" fill="#ff983f"/>'],
 house:['<path d="M4 10h16v12H4Z" fill="#e5a2e9"/><path d="M10 22v-8h4v8M6 12h2v3H6Z"/>','<path d="m1 10 11-9 11 9Z" fill="#896ee6"/>'],
 mug:['<path d="M3 7h13v13H3Z" fill="#86ded0"/><path d="M6 2v2m4-3v3"/>','<path d="M16 9h3q7 4 0 8h-3"/>'],
 fish:['<ellipse cx="10" cy="12" rx="8" ry="6" fill="#ffbf7f"/><circle cx="6" cy="10" r="1"/><path d="m8 6 4-4 2 4m-6 12 4 4 2-4" fill="#fa9876"/>','<path d="m18 12 5-6v12Z" fill="#f98576"/>'],
 sailboat:['<path d="M2 17h20l-5 6H7Z" fill="#9d95ef"/><path d="M12 2v15"/>','<path d="M10 3 3 15h7Zm4 1 7 11h-7Z" fill="#ffdf8d"/>']
 }; const [body,part]=shapes[id];return `<svg class="missing-art" viewBox="-2 -2 28 28" fill="none" stroke="#26385e" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${complete&&id==='flower'?part:''}${body}${complete&&id!=='flower'?`<g class="restored-part">${part}</g>`:''}</svg>`;
}
function take(type,ctx){const s=ctx.state;s.extraDecks ||= {};if(!s.extraDecks[type]?.length)s.extraDecks[type]=ctx.shuffle(B[type].map((_,i)=>i));return s.extraDecks[type].pop();}
function make(type,ctx){const {shuffle,pick}=ctx;let p={type,uid:Date.now()+'-'+Math.random()};if(B[type]){p.bank=take(type,ctx);p.correct='0';p.options=shuffle(['0','1','2','3']);return p;}
if(type==='shadow'){ctx.state.shadowDeck ||= [];if(!ctx.state.shadowDeck.length)ctx.state.shadowDeck=shuffle(shadowPool);p.item=ctx.state.shadowDeck.pop();p.correct=p.item;p.options=shuffle([p.item,...shuffle(shadowPool.filter(x=>x!==p.item)).slice(0,3)]);return p;}
if(type==='absurd'){p.base=pick(absurdBases);const extras=absurdExtras.filter(x=>!(p.base==='snowman'&&x==='carrot')&&!(p.base==='tree-pine'&&x==='star'));p.extra=pick(extras);p.correct=p.extra;p.options=shuffle([p.extra,...shuffle(extras.filter(x=>x!==p.extra)).slice(0,3)]);return p;}
return null;}
function bank(p){return B[p.type]?.[p.bank];}
function option(p,v,lang,label){return B[p.type]?bank(p).answers[lang][+v]:label(v);}
function explanation(p,lang,label){if(B[p.type])return bank(p).explain[lang];return p.type==='shadow'?(lang==='ru'?'Это тень предмета: ':'This is the shadow of: ')+label(p.item)+'.':(lang==='ru'?'В предмет «':'The object “')+label(p.base)+(lang==='ru'?'» добавили «':'” has an extra “')+label(p.extra)+'”.';}
function stage(p,ctx){const {lang,svg,label,esc,state}=ctx,b=bank(p),reveal=state.phase==='result',opened=state.clues||[];const card=(id,i=0,caption=true)=>`<div class="object clue-card" style="--i:${i}">${svg(id)}${caption?`<span>${esc(label(id))}</span>`:''}</div>`;
if(p.type==='shadow')return `<div class="shadow-card ${reveal?'unmasked':''}"><div class="shadow-orbit"></div>${svg(p.item)}<span>${reveal?esc(label(p.item)):'?'}</span></div>`;
if(p.type==='absurd')return `<div class="absurd-scene">${svg(p.base)}<div class="alien-object">${svg(p.extra)}</div><span class="scene-sticker">!?</span></div>`;
if(p.type==='missing')return `<div class="drawing-card">${drawMissing(b.drawing,reveal)}<span>${reveal?(lang==='ru'?'Деталь вернулась!':'The part is back!'):'?'}</span></div>`;
const items=lang==='en'&&b.itemsEn?b.itemsEn:b.items;
if(p.type==='wisdom')return `<div class="quote-card"><span class="quote-mark">“</span><strong>${esc(b.prompt[lang])}</strong><div>${svg(items[0])}</div></div>`;
if(p.type==='room')return `<div class="room-scene"><div class="room-window"></div><div class="room-rug"></div><div class="room-shelf"></div>${items.map((id,i)=>`<button class="room-clue spot-${i} ${opened.includes(i)||reveal?'found':''}" data-clue="${i}" aria-label="${lang==='ru'?'Исследовать место':'Explore spot'} ${i+1}">${opened.includes(i)||reveal?svg(id):`<b>${i+1}</b><span>✦</span>`}</button>`).join('')}<div class="room-findings">${items.map((id,i)=>`<span>${opened.includes(i)||reveal?esc(label(id)):'? ? ?'}</span>`).join('')}</div></div>`;
if(p.type==='fourth')return `<div class="four-clues">${items.map((id,i)=>i<2||opened.includes(i)||reveal?card(id,i):`<button class="object locked-clue" data-clue="${i}" aria-label="${lang==='ru'?'Открыть подсказку':'Reveal clue'} ${i+1}"><b>${i+1}</b><span>${lang==='ru'?'Открыть':'Reveal'} ✦</span></button>`).join('')}</div>`;
if(p.type==='animated')return `<div class="animated-scene motion-${b.motion}"><span class="scene-glow"></span>${items.map((id,i)=>`<div class="actor actor-${i}">${svg(id)}</div>`).join('')}<div class="scene-floor"></div></div>`;
if(p.type==='formula'||p.type==='link')return `<div class="formula-scene">${card(items[0],0)}<div class="operator">${p.type==='formula'?'+':'?'}<small>${p.type==='formula'?'= ?':'↔'}</small></div>${card(items[1],1)}</div>`;
if(p.type==='childhood')return `<div class="growing-scene">${card(items[0],0)}<div class="growth-arrow">➜</div><div class="future-card">?<span>${lang==='ru'?'Когда вырастет':'Grown up'}</span></div></div>`;
return `<div class="picture-row">${items.map((id,i)=>card(id,i)).join('')}</div>`;
}
return {meta,types:meta.map(x=>x.id),make,option,explanation,stage,banks:B,drawMissing};
})();
