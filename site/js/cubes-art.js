import {COLORS} from './cubes-engine.js';
// Original vector marks. They are rendered identically on every cube face and in the HUD.
const INKS=['#c73579','#087e72','#bb7c09','#6c48b7','#3b63b1','#d9582b','#1389a5','#47832e'];
export function drawSymbol(c,kind,size=128){c.save();c.translate(size/2,size/2);c.scale(size/128,size/128);c.strokeStyle=INKS[kind];c.fillStyle=INKS[kind];c.lineWidth=7;c.lineCap='round';c.lineJoin='round';
 const ellipse=(x,y,rx,ry,a=0)=>{c.beginPath();c.ellipse(x,y,rx,ry,a,0,Math.PI*2);c.fill();};
 const line=(x,y,x2,y2)=>{c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();};
 if(kind===0){for(const a of [-.7,0,.7]){c.save();c.rotate(a);ellipse(0,-8,12,29);c.restore();}c.strokeStyle='#a72869';c.lineWidth=4;c.beginPath();c.arc(0,6,30,.12,Math.PI-.12);c.stroke();}
 if(kind===1){for(const x of [-17,15]){line(x,-36,x,34);for(const y of [-20,2,24]){c.fillStyle='#e6fff4';c.fillRect(x-4,y,8,3);}c.fillStyle=INKS[kind];ellipse(x+9,-20,14,5,-.65);ellipse(x-9,8,14,5,.65);}}
 if(kind===2){ellipse(0,0,22,22);for(let i=0;i<8;i++){const a=i*Math.PI/4;line(Math.cos(a)*31,Math.sin(a)*31,Math.cos(a)*41,Math.sin(a)*41);}c.fillStyle='#fff4bb';ellipse(-6,-7,7,7);}
 if(kind===3){c.beginPath();c.moveTo(0,-39);c.lineTo(32,0);c.lineTo(0,39);c.lineTo(-32,0);c.closePath();c.fill();c.strokeStyle='#eee4ff';c.lineWidth=3;line(0,-29,0,29);line(-22,0,22,0);line(0,-29,14,0);line(14,0,0,29);}
 if(kind===4){c.beginPath();c.arc(0,0,34,.9,5.38);c.quadraticCurveTo(-4,-8,21,27);c.closePath();c.fill();c.fillStyle='#f9cc63';star(c,21,-20,12,5);}
 if(kind===5){for(let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2;ellipse(Math.cos(a)*20,Math.sin(a)*20,15,15);}c.fillStyle='#fff5c5';ellipse(0,0,11,11);c.fillStyle='#af573f';ellipse(0,0,5,5);}
 if(kind===6){c.lineWidth=9;for(let y=-21;y<=21;y+=21){c.beginPath();c.moveTo(-36,y);c.bezierCurveTo(-20,y-20,-2,y+20,12,y);c.bezierCurveTo(24,y-14,30,y-12,38,y-8);c.stroke();}}
 if(kind===7){for(const [x,y]of[[-14,-14],[14,-14],[-14,14],[14,14]])ellipse(x,y,17,17);c.strokeStyle='#377536';c.lineWidth=4;line(0,0,23,36);}
 c.restore();}
export function star(c,x,y,r,points=4){c.beginPath();for(let i=0;i<points*2;i++){const a=i*Math.PI/points-Math.PI/2,rr=i%2?r*.36:r;c.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}c.closePath();c.fill();}
export function tileCanvas(kind,skin=0){const el=document.createElement('canvas');el.width=el.height=192;const c=el.getContext('2d'),color=COLORS[kind];c.fillStyle=color;c.fillRect(0,0,192,192);const g=c.createLinearGradient(0,0,180,192);g.addColorStop(0,'#ffffff');g.addColorStop(.5,'#fffcf1');g.addColorStop(1,skin===1?'#e9e6fa':'#e9edec');c.fillStyle=g;c.beginPath();c.roundRect(12,12,168,168,skin===2?38:17);c.fill();c.strokeStyle=color+'77';c.lineWidth=3;c.beginPath();c.roundRect(19,19,154,154,skin===2?32:13);c.stroke();c.save();c.translate(25,25);drawSymbol(c,kind,142);c.restore();c.fillStyle='#ffffffb0';star(c,30,31,7);star(c,164,160,5);return el;}
