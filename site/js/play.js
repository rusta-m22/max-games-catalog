import {games} from './data.js';
const id=new URLSearchParams(location.search).get('game'),g=games.find(x=>x.id===id),root=document.querySelector('#game');
if(!g){root.innerHTML='<p class="empty">Игра не найдена. <a href="index.html">Открыть каталог</a></p>';}else{
 document.title=g.name+' · ИГРЫ №1 В MAX';document.querySelector('#game-title').textContent=g.name;try{localStorage.setItem('jarvis-last',g.id);}catch{}
 if(g.legacy){root.classList.add('legacy-root');const iframe=document.createElement('iframe');iframe.src=`games/${g.id}/index.html`;iframe.title=g.name;iframe.allow='autoplay; fullscreen; gamepad';iframe.allowFullscreen=true;root.replaceChildren(iframe);}
 else{const modules={chess:'boards',checkers:'boards',corners:'boards',durak:'cards',klondike:'cards',spider:'cards',sudoku:'puzzles',words:'puzzles',mahjong:'puzzles',merge:'merge',tricks:'tricks',orbit:'spatial',cubes:'cubes',islands:'islands'};import(`./${modules[g.id]}.js`).then(m=>m.start(g.id,root)).catch(e=>{console.error(e);root.innerHTML='<p class="empty">Не удалось запустить игру. Обновите страницу или вернитесь в каталог.</p>';});}
}
window.addEventListener('load',()=>{try{const b=window.WebApp?.BackButton;b?.show();b?.onClick(()=>{location.href='index.html';});}catch{}},{once:true});
