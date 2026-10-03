import * as THREE from '../vendor/three.module.js';
export const COLORS=['#65e8cf','#ff739d','#ffce75','#b29aff','#65bcff','#c4e780'];
export const SYMBOLS=['◆','⬟','⬢','▲','■','●'];
const pos=i=>({x:i%8-3.5,y:3.5-(i/8|0)});
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
export function createView(container,isPaused){
 let renderer,scene,camera,group,rocksGroup,meshes=[],dust=[],bursts=[],board=[],rockState=[],clock=0,last=0,stopped=false,frameId=0;
 const canvas=document.createElement('canvas');canvas.className='orb-canvas';canvas.setAttribute('aria-hidden','true');container.prepend(canvas);
 const geos=[],mats=[],materials=[],objects=[];let ctx;
 try{
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setClearColor(0x071624,0);
  scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-4.4,4.4,4.4,-4.4,.1,80);camera.position.set(0,0,18);scene.add(new THREE.AmbientLight(0xb6dcff,2.1));
  const light=new THREE.DirectionalLight(0xffffff,4.4);light.position.set(-3,6,9);scene.add(light);const rim=new THREE.DirectionalLight(0x71dfc7,2);rim.position.set(5,-3,3);scene.add(rim);
  group=new THREE.Group();rocksGroup=new THREE.Group();scene.add(rocksGroup,group);
  geos.push(new THREE.OctahedronGeometry(.39),new THREE.IcosahedronGeometry(.39,0),new THREE.DodecahedronGeometry(.38),new THREE.ConeGeometry(.4,.69,3),new THREE.BoxGeometry(.57,.57,.57),new THREE.SphereGeometry(.37,7,5));
  COLORS.forEach(c=>mats.push(new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:.12,roughness:.25,metalness:.26,flatShading:true})));
  const tileGeo=new THREE.BoxGeometry(.9,.9,.065),tileMat=new THREE.MeshStandardMaterial({color:0x1d3547,roughness:.68,metalness:.15});geos.push(tileGeo);materials.push(tileMat);
  for(let i=0;i<64;i++){const t=new THREE.Mesh(tileGeo,tileMat),p=pos(i);t.position.set(p.x,p.y,-.55);scene.add(t);}
  const orbGeo=new THREE.TorusGeometry(.36,.021,6,28),sparkGeo=new THREE.OctahedronGeometry(.065),rockGeo=new THREE.BoxGeometry(.87,.87,.06),bandGeo=new THREE.BoxGeometry(.68,.055,.04);
  geos.push(orbGeo,sparkGeo,rockGeo,bandGeo);objects.push({orbGeo,sparkGeo,rockGeo,bandGeo});
  materials.push(new THREE.MeshBasicMaterial({color:0xfaffd0}),new THREE.MeshStandardMaterial({color:0x967859,roughness:.9,metalness:.15}),...COLORS.map(color=>new THREE.MeshBasicMaterial({color})));
  container.dataset.renderer='webgl';
 }catch(e){renderer?.dispose();renderer=null;canvas.remove();const fallback=document.createElement('canvas');fallback.className='orb-canvas';fallback.setAttribute('aria-hidden','true');container.prepend(fallback);ctx=fallback.getContext('2d');container.dataset.renderer='canvas';}
 const targetCanvas=ctx?.canvas||canvas;
 function resize(){const width=Math.max(1,container.clientWidth);if(renderer)renderer.setSize(width,width,false);else{const ratio=Math.min(devicePixelRatio||1,1.5);targetCanvas.width=targetCanvas.height=width*ratio;}}
 const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(container);resize();
 function makeGem(tile,index,from=null,gravity=0){
  const m=new THREE.Group(),crystal=new THREE.Mesh(geos[tile.kind],mats[tile.kind]);crystal.rotation.set(.25,.38+tile.kind*.55,.08);m.add(crystal);
  if(tile.special){const {orbGeo,bandGeo}=objects[0];const spec=new THREE.Mesh(orbGeo,materials[1]);spec.position.z=.25;if(tile.special==='row'||tile.special==='column'){const band=new THREE.Mesh(bandGeo,materials[1]);band.position.z=.48;if(tile.special==='column')band.rotation.z=Math.PI/2;m.add(band);}else{spec.rotation.x=.3;m.add(spec);if(tile.special==='prism'){const other=spec.clone();other.rotation.set(.8,1.2,0);m.add(other);crystal.scale.setScalar(1.1);}}}
  const p=pos(index);m.position.set(p.x,p.y,.03);m.userData={id:tile.id,index,kind:tile.kind,crystal,from:{...p},to:{...p},at:clock,duration:0,scaleFrom:1,scaleTo:1};
  if(from!==null){m.userData.from=typeof from==='number'?pos(from):{x:p.x+(gravity===1?8:gravity===3?-8:0),y:p.y+(gravity===0?8:gravity===2?-8:0)};m.userData.duration=reduced()?0:300;}
  group.add(m);return m;
 }
 function set(s,options={}){
  board=s.board;rockState=s.rocks;
  if(!renderer)return;
  group.clear();rocksGroup.clear();const from=options.motion?new Map(options.motion.map(m=>[m.id,m.from])):null;
  meshes=s.board.map((tile,i)=>tile?makeGem(tile,i,from?(from.get(tile.id)??'new'):null,s.gravity):null);
  s.rocks.forEach((hp,i)=>{if(!hp)return;const r=new THREE.Mesh(objects[0].rockGeo,materials[2]),p=pos(i);r.position.set(p.x,p.y,-.37);if(hp===2)r.scale.setScalar(1.04);rocksGroup.add(r);});
 }
 function particles(indices){
  if(!renderer||reduced())return;
  for(const i of indices){const p=pos(i),tile=board[i];for(let j=0;j<5&&dust.length<220;j++){const m=new THREE.Mesh(objects[0].sparkGeo,materials[3+(tile?.kind||0)]);m.position.set(p.x,p.y,.5);scene.add(m);dust.push({m,at:clock,vx:(Math.random()-.5)*.007,vy:(Math.random()-.4)*.007,vr:(Math.random()-.5)*.01});}}
 }
 function burst(index,type){if(!renderer||reduced())return;const p=pos(index),material=materials[1].clone();material.transparent=true;material.opacity=.8;const m=new THREE.Group(),ring=new THREE.Mesh(objects[0].orbGeo,material);m.position.set(p.x,p.y,.7);m.add(ring);
  if(['row','column','pulse','prism'].includes(type))for(const axis of type==='row'?['row']:type==='column'?['column']:['row','column']){const beam=new THREE.Mesh(objects[0].bandGeo,material);beam.scale.x=12;if(axis==='column')beam.rotation.z=Math.PI/2;m.add(beam);}
  scene.add(m);bursts.push({m,ring,material,at:clock,type});}
 function render2d(){
  const w=targetCanvas.width,u=w/8.8;ctx.clearRect(0,0,w,w);
  for(let i=0;i<64;i++){const x=(i%8+.9)*u,y=((i/8|0)+.9)*u,t=board[i];ctx.fillStyle=rockState[i]?'#68594a':'#1b3347';ctx.beginPath();ctx.roundRect(x-u*.44,y-u*.44,u*.88,u*.88,u*.1);ctx.fill();if(!t)continue;
   const color=COLORS[t.kind],g=ctx.createLinearGradient(x-u*.3,y-u*.4,x+u*.3,y+u*.4);g.addColorStop(0,'#edfff9');g.addColorStop(.3,color);g.addColorStop(1,color+'99');ctx.fillStyle=g;ctx.strokeStyle=color;ctx.lineWidth=u*.026;const sides=[4,5,6,3,4,8][t.kind];ctx.beginPath();for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2-Math.PI/2+(t.kind===4?Math.PI/4:0);const px=x+Math.cos(a)*u*.34,py=y+Math.sin(a)*u*.34;j?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(x-u*.2,y);ctx.lineTo(x,y-u*.19);ctx.lineTo(x+u*.2,y);ctx.lineTo(x,y+u*.25);ctx.closePath();ctx.strokeStyle='#ffffff55';ctx.stroke();
   if(t.special){ctx.fillStyle='#fffbd1';ctx.font=`bold ${u*.43}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='#08111c';ctx.shadowBlur=3;ctx.fillText({row:'↔',column:'↕',nova:'✺',prism:'✦'}[t.special],x,y);ctx.shadowBlur=0;}
  }
 }
 function tick(t){
  if(stopped)return;const dt=last?Math.min(40,t-last):0;last=t;
  if(!document.hidden&&!isPaused()){
   clock+=dt;
   if(renderer){for(const m of meshes){if(!m)continue;const d=m.userData,k=d.duration?Math.min(1,(clock-d.at)/d.duration):1,ease=1-(1-k)**3;m.position.x=d.from.x+(d.to.x-d.from.x)*ease;m.position.y=d.from.y+(d.to.y-d.from.y)*ease;m.position.z=.04+(reduced()?0:Math.sin(clock*.0016+d.index*.35)*.035);const z=d.scaleFrom+(d.scaleTo-d.scaleFrom)*ease;m.scale.setScalar(z);if(!reduced())d.crystal.rotation.y+=dt*.00022;}
    dust=dust.filter(p=>{const age=clock-p.at;if(age>550){scene.remove(p.m);return false;}p.m.position.x+=p.vx*dt;p.m.position.y+=p.vy*dt;p.vy-=dt*.000012;p.m.rotation.z+=p.vr*dt;p.m.scale.setScalar(1-age/550);return true;});
    bursts=bursts.filter(p=>{const age=clock-p.at;if(age>430){scene.remove(p.m);p.material.dispose();return false;}p.ring.scale.setScalar(1+age*.015);p.material.opacity=.8*(1-age/430);return true;});renderer.render(scene,camera);
   }else render2d();
  }frameId=requestAnimationFrame(tick);
 }frameId=requestAnimationFrame(tick);
 function wait(ms){if(reduced())return Promise.resolve();const start=clock;return new Promise(resolve=>{const check=()=>{if(stopped||clock-start>=ms)resolve();else requestAnimationFrame(check);};requestAnimationFrame(check);});}
 async function play(frame){
  if(frame.type==='swap'){
   if(renderer){for(const [from,to]of [[frame.a,frame.b],[frame.b,frame.a]]){const m=meshes[from];if(m){m.userData={...m.userData,from:pos(from),to:pos(to),at:clock,duration:155};}}}
   await wait(155);set(frame.state);return;
  }
  if(frame.type==='clear'){
   particles(frame.cleared);frame.effects.filter(e=>!e.created).forEach(e=>burst(e.index,e.special));
   if(renderer)for(const i of frame.cleared){const m=meshes[i];if(m)m.userData={...m.userData,from:pos(i),to:pos(i),at:clock,duration:180,scaleFrom:1,scaleTo:0};}
   else{board=frame.clearState.board;}
   await wait(180);set(frame.state,{motion:frame.motion});await wait(300);return;
  }set(frame.state);await wait(170);
 }
 function dispose(){stopped=true;cancelAnimationFrame(frameId);resizeObserver.disconnect();renderer?.dispose();for(const o of [...geos,...mats,...materials,...bursts.map(p=>p.material)])o.dispose?.();}
 targetCanvas.addEventListener('webglcontextlost',e=>e.preventDefault());
 return {set,play,wait,burst,dispose,get renderer(){return renderer?'webgl':'canvas';}};
}
