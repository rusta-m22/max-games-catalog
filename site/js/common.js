import {afterRound,adsPaused} from './ads.js';
export const $=(s,root=document)=>root.querySelector(s);
export const shuffle=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;};
export const copy=x=>JSON.parse(JSON.stringify(x));
export const load=(key,fallback=null)=>{try{return JSON.parse(localStorage.getItem('jarvis-'+key))??fallback;}catch{return fallback;}};
export const save=(key,value)=>{try{localStorage.setItem('jarvis-'+key,JSON.stringify(value));}catch{}};
export function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2400);}
let audio;
export function tone(win=false){if(adsPaused||!load('sound',true))return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const t=audio.currentTime;for(let i=0;i<(win?3:1);i++){const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=[523,659,784][i];g.gain.setValueAtTime(.055,t+i*.08);g.gain.exponentialRampToValueAtTime(.001,t+i*.08+.13);o.connect(g);g.connect(audio.destination);o.start(t+i*.08);o.stop(t+i*.08+.14);}}catch{}}
export function modal(title,text,actions=[['Понятно',()=>{}]]){const d=$('#modal');d.replaceChildren();const h=document.createElement('h2');h.textContent=title;const p=document.createElement('p');p.textContent=text;const bar=document.createElement('div');bar.className='actions';actions.forEach(([label,fn])=>{const b=document.createElement('button');b.textContent=label;b.onclick=()=>{d.close();fn?.();};bar.append(b);});d.append(h,p,bar);if(!d.open)d.showModal();}
export function ui(root,rules,onNew){root.innerHTML=`<div class="game-tools"><div class="actions" id="game-options"></div><div class="actions"><button id="rules">Правила</button><button id="sound" aria-label="Звук">♪</button><button id="new-game">Новая игра</button></div></div><div id="stats" class="stats"></div><p id="status" class="status" role="status" aria-live="polite"></p><div id="stage" class="stage"></div><div id="game-bottom" class="game-bottom"></div>`;$('#rules').onclick=()=>modal('Как играть',rules);$('#new-game').onclick=()=>modal('Новая партия?','Текущая партия будет заменена.',[['Отмена'],['Начать',onNew]]);const sound=$('#sound');const sync=()=>{sound.setAttribute('aria-pressed',String(load('sound',true)));sound.textContent=load('sound',true)?'♪':'♪ выкл.';};sound.onclick=()=>{save('sound',!load('sound',true));sync();tone();};sync();return {stage:$('#stage'),options:$('#game-options'),bottom:$('#game-bottom'),status(text){$('#status').textContent=text;},stats(html){$('#stats').innerHTML=html;},async win(text='Отличная игра!'){tone(true);await afterRound(new URLSearchParams(location.search).get('game'));modal('Победа!',text,[['Ещё раз',onNew],['Посмотреть поле']]);}};}
export const stat=(label,value)=>`<span><small>${label}</small><b>${value}</b></span>`;
export function button(text,fn,cls=''){const b=document.createElement('button');b.textContent=text;b.className=cls;b.onclick=fn;return b;}
export function select(options,fn,value){const s=document.createElement('select');for(const [v,t]of options){const o=document.createElement('option');o.value=v;o.textContent=t;s.append(o);}s.value=value;s.onchange=()=>fn(s.value);return s;}
export function formatTime(n){return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;}
export function endMessage(won){return won?'Вы победили!':'Победил соперник. Попробуем ещё?';}

window.addEventListener('jarvis-ad-unavailable',()=>toast('Реклама сейчас недоступна. Попробуйте позже.'));
window.addEventListener('jarvis-ads-pause',()=>{if(audio?.state==='running')audio.suspend().catch(()=>{});});
window.addEventListener('jarvis-ads-resume',()=>{if(!document.hidden&&load('sound',true))audio?.resume().catch(()=>{});});
