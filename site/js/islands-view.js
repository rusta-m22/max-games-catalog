import * as THREE from '../vendor/three.module.js';
import {COLORS,cellsOf,completeLines} from './islands-engine.js';
const position=i=>({x:i%8-3.5,y:3.5-Math.floor(i/8)});
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function rounded(w,h,d,r=.12){const s=new THREE.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelThickness:.055,bevelSize:.045,bevelSegments:2,steps:1,curveSegments:3});}
// A hollow outline highlights a completed line without painting over its blocks.
function previewRing(){const s=new THREE.Shape();s.moveTo(-.49,-.49);s.lineTo(.49,-.49);s.lineTo(.49,.49);s.lineTo(-.49,.49);s.closePath();const hole=new THREE.Path();hole.moveTo(-.40,-.40);hole.lineTo(-.40,.40);hole.lineTo(.40,.40);hole.lineTo(.40,-.40);hole.closePath();s.holes.push(hole);return new THREE.ShapeGeometry(s);}
export function createView(container,isPaused){
 const canvas=document.createElement('canvas');canvas.className='isl-canvas';canvas.setAttribute('aria-hidden','true');container.prepend(canvas);
 let renderer,ctx,camera,scene,blocks,ghosts,decor,board=Array(64).fill(null),preview=null,meshes=[],particles=[],clock=0,last=0,stopped=false,raf=0,qualityFrames=0,slowFrames=0;
 const geometries=[],materials=[],waiters=[],g=x=>(geometries.push(x),x),m=x=>(materials.push(x),x);
 const mesh=(geo,mat,x,y,z,parent=scene)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);parent.add(o);return o;};
 let blockGeo,blockMats,ghostMat,clearMat,sparkGeo,previewBase,previewOutline,previewCross,crossMat,lineRing;
 try{
  renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-5,5,5,-5,.1,80);camera.position.set(0,-7.5,19);camera.lookAt(0,0,0);scene.add(new THREE.HemisphereLight(0xe9ffff,0x729690,1.8));const sun=new THREE.DirectionalLight(0xfff4d0,2.5);sun.position.set(-4,6,13);scene.add(sun);const rim=new THREE.DirectionalLight(0x82e8ff,.7);rim.position.set(7,-1,5);scene.add(rim);
  const std=(color,extra={})=>m(new THREE.MeshStandardMaterial({color,roughness:.36,metalness:.03,...extra}));
  blockGeo=g(rounded(.84,.84,.36,.14));blockMats=COLORS.map(c=>std(c));sparkGeo=g(new THREE.OctahedronGeometry(.08));
  mesh(g(rounded(9.35,9.35,.42,.8)),std('#d5a974'),0,0,-.90);mesh(g(rounded(9.5,9.5,.17,.85)),std('#ffe3a4'),0,0,-.5);mesh(g(rounded(9.07,9.07,.16,.65)),std('#93d7a0'),0,0,-.32);mesh(g(rounded(8.48,8.48,.13,.28)),std('#277d7d'),0,0,-.12);
  const tileGeo=g(rounded(.93,.93,.07,.09)),tileMats=[std('#b3ddcc'),std('#c2e5d2')];for(let i=0;i<64;i++){const p=position(i);mesh(tileGeo,tileMats[(i%8+Math.floor(i/8))%2],p.x,p.y,.035);}
  const ringMat=m(new THREE.MeshBasicMaterial({color:'#f1ffff',transparent:true,opacity:.2,side:THREE.DoubleSide}));for(let i=0;i<3;i++){const o=mesh(g(new THREE.RingGeometry(5.2+i*.5,5.24+i*.5,64)),ringMat,0,0,-1.05);o.scale.y=.97;}
  decor=new THREE.Group();scene.add(decor);const bark=std('#b38862'),leaf=std('#3eb79c'),leaf2=std('#79ce77'),stone=std('#faf0cc');
  function palm(x,y,scale=1){const group=new THREE.Group();group.position.set(x,y,-.3);group.scale.setScalar(scale);decor.add(group);const trunk=mesh(g(new THREE.CylinderGeometry(.075,.13,.9,6)),bark,0,0,.4,group);trunk.rotation.x=Math.PI/2;for(let j=0;j<6;j++){const a=j/6*Math.PI*2,o=mesh(g(new THREE.ConeGeometry(.2,.7,4)),j%2?leaf:leaf2,Math.cos(a)*.25,Math.sin(a)*.25,.85,group);o.rotation.set(Math.PI/2,.25,a-Math.PI/2);}mesh(g(new THREE.IcosahedronGeometry(.13,0)),stone,.08,0,.83,group);}
  palm(-4.38,4.21,1);palm(4.34,-4.05,.78);palm(4.32,4.28,.64);
  blocks=new THREE.Group();ghosts=new THREE.Group();scene.add(blocks,ghosts);
  ghostMat=m(new THREE.MeshStandardMaterial({color:COLORS[0],roughness:.36,metalness:.03}));
  previewOutline=m(new THREE.MeshBasicMaterial({color:'#173a51',toneMapped:false}));previewBase=g(rounded(.98,.98,.045,.15));
  clearMat=m(new THREE.MeshBasicMaterial({color:'#ffe36b',toneMapped:false,side:THREE.DoubleSide}));lineRing=g(previewRing());
  crossMat=m(new THREE.MeshBasicMaterial({color:'#ffffff',toneMapped:false}));previewCross=g(new THREE.PlaneGeometry(.48,.075));
  container.dataset.renderer='webgl';
 }catch{renderer?.dispose();renderer=null;const replacement=document.createElement('canvas');replacement.className='isl-canvas';replacement.setAttribute('aria-hidden','true');canvas.replaceWith(replacement);ctx=replacement.getContext('2d');container.dataset.renderer='canvas';}
 const target=renderer?canvas:ctx.canvas;
 function resize(){const w=Math.max(1,container.clientWidth),h=Math.max(1,container.clientHeight);if(renderer){renderer.setSize(w,h,false);const aspect=w/h,sy=Math.max(10.3,10.5/aspect);camera.left=-sy*aspect/2;camera.right=sy*aspect/2;camera.top=sy/2;camera.bottom=-sy/2;camera.updateProjectionMatrix();camera.updateMatrixWorld();}else{target.width=w*Math.min(devicePixelRatio||1,1.5);target.height=h*Math.min(devicePixelRatio||1,1.5);}layoutTargets();}
 function project(i){const p=position(i);if(renderer){const v=new THREE.Vector3(p.x,p.y,.23).project(camera);return {x:(v.x+1)/2,y:(1-v.y)/2};}const w=container.clientWidth,h=container.clientHeight,size=Math.min(w*.86,h*.86);return {x:(w/2+p.x*size/8)/w,y:(h/2-p.y*size/8)/h};}
 function layoutTargets(){const w=container.clientWidth,h=container.clientHeight,a=project(0),b=project(1),c=project(8),cw=(b.x-a.x)*w,ch=(c.y-a.y)*h;container.querySelectorAll('[data-cell]').forEach(el=>{const p=project(Number(el.dataset.cell));Object.assign(el.style,{left:(p.x*w-cw/2)+'px',top:(p.y*h-ch/2)+'px',width:cw+'px',height:ch+'px'});});}
 function cellAt(clientX,clientY){const r=container.getBoundingClientRect(),a=project(0),b=project(1),c=project(8),x=Math.floor(((clientX-r.x)/r.width-a.x)/(b.x-a.x)+.5),y=Math.floor(((clientY-r.y)/r.height-a.y)/(c.y-a.y)+.5);return {x,y,index:x>=0&&x<8&&y>=0&&y<8?y*8+x:-1};}
 function set(state){board=state.board.map(p=>p&&({...p}));if(!renderer)return;blocks.clear();meshes=[];for(let i=0;i<64;i++)if(board[i]){const p=position(i),o=mesh(blockGeo,blockMats[board[i].color],p.x,p.y,.15,blocks);o.userData.index=i;meshes.push(o);}decor.rotation.z=0;}
 function previewAt(piece,x,y,valid){preview=piece?{piece,x,y,valid}:null;if(!renderer)return;ghosts.clear();if(!piece)return;
  ghostMat.color.set(valid?COLORS[piece.color]:'#ee3155');const copy=board.slice(),footprint=new Set();
  for(const [dx,dy]of cellsOf(piece)){const xx=x+dx,yy=y+dy;if(xx<0||xx>7||yy<0||yy>7)continue;const i=yy*8+xx,p=position(i);footprint.add(i);
   mesh(previewBase,previewOutline,p.x,p.y,.56,ghosts);mesh(blockGeo,ghostMat,p.x,p.y,.63,ghosts);copy[i]={color:piece.color};
   if(!valid)for(const angle of [-Math.PI/4,Math.PI/4])mesh(previewCross,crossMat,p.x,p.y,1.055,ghosts).rotation.z=angle;
  }
  if(valid)for(const i of completeLines(copy).indices){if(footprint.has(i))continue;const p=position(i);mesh(lineRing,clearMat,p.x,p.y,.63,ghosts);}
 }
 function burst(indices){if(!renderer||reduced())return;for(const i of indices.slice(0,24)){const p=position(i);for(let k=0;k<5&&particles.length<180;k++){const o=mesh(sparkGeo,blockMats[board[i]?.color??i%6],p.x,p.y,.6);particles.push({o,life:.6+Math.random()*.35,vx:(Math.random()-.5)*4,vy:(Math.random()-.5)*4,vz:1+Math.random()*4});}}}
 function wait(ms){return new Promise(resolve=>waiters.push({until:clock+(reduced()?Math.min(ms,65):ms),resolve}));}
 async function play(frame){previewAt(null);if(frame.placedBoard){set({board:frame.placedBoard});for(const o of meshes)if(frame.placed.includes(o.userData.index)){o.userData.pop=clock;o.scale.setScalar(.45);}await wait(120);}if(frame.cleared.length){burst(frame.cleared);for(const o of meshes)if(frame.cleared.includes(o.userData.index))o.userData.clear=clock;await wait(240);}set(frame.state);}
 function fallback(){const w=target.width,h=target.height,sz=Math.min(w*.86,h*.86),cell=sz/8,ox=(w-sz)/2,oy=(h-sz)/2;ctx.clearRect(0,0,w,h);ctx.fillStyle='#e9c485';ctx.fillRect(ox-cell*.5,oy-cell*.4,sz+cell,sz+cell*.95);for(let i=0;i<64;i++){const x=ox+i%8*cell,y=oy+Math.floor(i/8)*cell;ctx.fillStyle='#b6ddcc';ctx.fillRect(x+1,y+1,cell-2,cell-2);if(board[i])drawBlock(x,y,COLORS[board[i].color]);}function drawBlock(x,y,color){ctx.fillStyle=color;ctx.fillRect(x+cell*.08,y+cell*.02,cell*.84,cell*.86);ctx.fillStyle='#ffffff66';ctx.fillRect(x+cell*.14,y+cell*.07,cell*.69,cell*.13);ctx.fillStyle='#0002';ctx.fillRect(x+cell*.08,y+cell*.73,cell*.84,cell*.15);}
  if(preview){const copy=board.slice(),footprint=new Set();for(const [dx,dy]of cellsOf(preview.piece)){const x=preview.x+dx,y=preview.y+dy;if(x<0||x>7||y<0||y>7)continue;const i=y*8+x,px=ox+x*cell,py=oy+y*cell;footprint.add(i);copy[i]={color:preview.piece.color};ctx.fillStyle='#173a51';ctx.fillRect(px+cell*.025,py-cell*.035,cell*.95,cell*.97);drawBlock(px,py,preview.valid?COLORS[preview.piece.color]:'#ee3155');if(!preview.valid){ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(2,cell*.075);ctx.beginPath();ctx.moveTo(px+cell*.32,py+cell*.25);ctx.lineTo(px+cell*.68,py+cell*.61);ctx.moveTo(px+cell*.68,py+cell*.25);ctx.lineTo(px+cell*.32,py+cell*.61);ctx.stroke();}}
   if(preview.valid){ctx.strokeStyle='#ffe36b';ctx.lineWidth=Math.max(2,cell*.065);for(const i of completeLines(copy).indices)if(!footprint.has(i))ctx.strokeRect(ox+i%8*cell+cell*.06,oy+Math.floor(i/8)*cell+cell*.06,cell*.88,cell*.88);}
  }
 }
 function tick(time){if(stopped)return;raf=requestAnimationFrame(tick);const raw=last?time-last:16;last=time;if(document.hidden||isPaused())return;const dt=Math.min(40,raw)/1000;clock+=Math.min(100,raw);for(let i=waiters.length-1;i>=0;i--)if(clock>=waiters[i].until){waiters[i].resolve();waiters.splice(i,1);}if(renderer){for(const o of meshes){if(o.userData.pop!==undefined){const t=Math.min(1,(clock-o.userData.pop)/200);o.scale.setScalar(1+(1-t)*Math.sin(t*5.5)*.25);if(t===1)delete o.userData.pop;}if(o.userData.clear!==undefined){const t=Math.min(1,(clock-o.userData.clear)/230);o.scale.setScalar(Math.max(.01,1-t*t));o.position.z=.15+t*.8;}}for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.vz-=8*dt;p.o.position.x+=p.vx*dt;p.o.position.y+=p.vy*dt;p.o.position.z+=p.vz*dt;p.o.rotation.x+=dt*5;p.o.scale.setScalar(Math.min(1,p.life*3));if(p.life<=0){scene.remove(p.o);particles.splice(i,1);}}if(qualityFrames<150){qualityFrames++;if(raw>35)slowFrames++;if(qualityFrames===150&&slowFrames>65){renderer.setPixelRatio(1);resize();}}renderer.render(scene,camera);}else fallback();}
 const observer=new ResizeObserver(resize);observer.observe(container);resize();raf=requestAnimationFrame(tick);
 return {set,project,cellAt,preview:previewAt,play,wait,celebrate:()=>burst(Array.from({length:20},(_,i)=>(i*13)%64)),dispose(){stopped=true;cancelAnimationFrame(raf);observer.disconnect();waiters.splice(0).forEach(w=>w.resolve());geometries.forEach(x=>x.dispose());materials.forEach(x=>x.dispose());renderer?.dispose();target.remove();}};
}
