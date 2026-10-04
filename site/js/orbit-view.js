import * as THREE from '../vendor/three.module.js';
export const COLORS=['#19efcc','#ff3974','#ffbd24','#b556ff','#339dff','#9bf52c'];
export const SYMBOLS=['◆','⬟','⬢','▲','■','●'];
const pos=i=>({x:i%8-3.5,y:3.5-(i/8|0)});
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

// Independent facet normals, crown, girdle and pavilion: these are solid gems, not sprites.
function jewel(sides,radius,turn=0,stretch=1){
 const rings=[[.49,.31],[.86,.15],[1,.015],[.96,-.08],[.08,-.40]],v=[],colors=[];
 const p=(r,j)=>{const a=j/sides*Math.PI*2+turn;return [Math.cos(a)*radius*rings[r][0],Math.sin(a)*radius*rings[r][0]*stretch,rings[r][1]];};
 const tri=(a,b,c,s)=>{v.push(...a,...b,...c);for(let i=0;i<3;i++)colors.push(s,s,s);};
 for(let j=0;j<sides;j++){tri([0,0,.31],p(0,j),p(0,j+1),1);for(let r=0;r<rings.length-1;r++){const a=p(r,j),b=p(r+1,j),c=p(r+1,j+1),d=p(r,j+1),s=r===1?.72+j%3*.09:.84+j%2*.16;tri(a,b,c,s);tri(a,c,d,s);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}
function slab(w,h,depth,r){
 const s=new THREE.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
 return new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.035,bevelThickness:.035,curveSegments:3});
}
export function createView(container,isPaused){
 let renderer,scene,camera,gems,geology,highlights,planet,halo,engineGlow,stars,ctx,environment;
 let meshes=[],dust=[],bursts=[],board=[],rockState=[],clock=0,last=0,stopped=false,frameId,selection=-1,hinted=[],pausedLast=false,qualityFrames=0,slowFrames=0;
 const geos=[],materials=[],textures=[],gemMats=[],colorMats=[];
 const canvas=document.createElement('canvas');canvas.className='orb-canvas';canvas.setAttribute('aria-hidden','true');container.prepend(canvas);
 const geo=g=>(geos.push(g),g),mat=m=>(materials.push(m),m),basic=(color,extra={})=>mat(new THREE.MeshBasicMaterial({color,...extra})),physical=(color,extra={})=>mat(new THREE.MeshStandardMaterial({color,roughness:.28,metalness:.3,...extra}));
 let gemGeos,sparkGeo,ringGeo,bandGeo,rockGeo,whiteMat,rockMat,goldMat,selectedMat,hintMat;
 function mesh(g,m,x=0,y=0,z=0,parent=scene){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);parent.add(o);return o;}
 function glowTexture(){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),f=g.createRadialGradient(32,32,0,32,32,32);f.addColorStop(0,'#ffffffff');f.addColorStop(.12,'#ffffffcc');f.addColorStop(.45,'#ffffff35');f.addColorStop(1,'#ffffff00');g.fillStyle=f;g.fillRect(0,0,64,64);const t=new THREE.CanvasTexture(c);textures.push(t);return t;}
 try{
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));renderer.setClearColor(0x081443,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.localClippingEnabled=true;
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(33,1,.1,150);camera.position.set(0,-5.2,18);camera.lookAt(0,-.35,0);scene.add(new THREE.HemisphereLight(0xb2e9ff,0x341664,2.5));
  const light=new THREE.DirectionalLight(0xfff0d4,4.8);light.position.set(-5,6,12);scene.add(light);const rim=new THREE.DirectionalLight(0x75baff,3);rim.position.set(6,-2,4);scene.add(rim);
  // A tiny studio supplies reflections without external texture downloads.
  const studio=new THREE.Scene();studio.background=new THREE.Color('#555780');const temporary=[];
  for(const [x,y,z,w,h,color]of [[-5,7,5,8,8,'#ffffff'],[6,3,2,3,9,'#d9ffff'],[0,-6,3,7,2,'#a9bcff']]){const g=new THREE.PlaneGeometry(w,h),m=new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}),p=new THREE.Mesh(g,m);p.position.set(x,y,z);p.lookAt(0,0,0);studio.add(p);temporary.push(g,m);}
  const pmrem=new THREE.PMREMGenerator(renderer);environment=pmrem.fromScene(studio,.08);scene.environment=environment.texture;pmrem.dispose();temporary.forEach(o=>o.dispose());
  gems=new THREE.Group();geology=new THREE.Group();highlights=new THREE.Group();scene.add(geology,gems,highlights);
  gemGeos=[jewel(4,.45,0,1.08),jewel(6,.435,Math.PI/6),jewel(8,.435,Math.PI/8),jewel(3,.49,Math.PI/2,1.03),jewel(4,.45,Math.PI/4),jewel(10,.43)].map(geo);
  const clippingPlanes=[new THREE.Plane(new THREE.Vector3(1,0,0),4.15),new THREE.Plane(new THREE.Vector3(-1,0,0),4.15),new THREE.Plane(new THREE.Vector3(0,1,0),4.15),new THREE.Plane(new THREE.Vector3(0,-1,0),4.15)];
  COLORS.forEach(color=>{gemMats.push(mat(new THREE.MeshPhysicalMaterial({color,vertexColors:true,roughness:.075,metalness:.22,clearcoat:1,clearcoatRoughness:.08,emissive:color,emissiveIntensity:.055,envMapIntensity:.85,clippingPlanes})));colorMats.push(basic(color));});
  sparkGeo=geo(new THREE.OctahedronGeometry(.085));ringGeo=geo(new THREE.TorusGeometry(.37,.028,6,32));bandGeo=geo(new THREE.BoxGeometry(.7,.055,.06));rockGeo=geo(slab(.84,.84,.14,.11));
  whiteMat=basic('#fff9d3');goldMat=physical('#ffc85b',{metalness:.7,roughness:.23});rockMat=physical('#996044',{roughness:.85});selectedMat=basic('#fff59b');hintMat=basic('#5bfff2',{transparent:true,opacity:.8});
  // Thick floating chassis, gold bevel and recessed tiled deck.
  mesh(geo(slab(8.55,8.55,.40,.36)),physical('#273876'),0,0,-.64);mesh(geo(slab(8.61,8.61,.07,.35)),goldMat,0,0,-.22);mesh(geo(slab(8.36,8.36,.11,.25)),physical('#076e91',{metalness:.55}),0,0,-.14);mesh(geo(slab(8.13,8.13,.05,.18)),physical('#111f58',{roughness:.8}),0,0,.005);
  const tiles=new THREE.InstancedMesh(geo(slab(.916,.916,.055,.075)),physical('#183669',{roughness:.52,metalness:.12}),64);scene.add(tiles);const matrix=new THREE.Matrix4(),tint=new THREE.Color();
  for(let i=0;i<64;i++){const p=pos(i);matrix.makeTranslation(p.x,p.y,.065);tiles.setMatrixAt(i,matrix);tint.set((i+(i/8|0))%2?'#afc7ff':'#7d9edc');tiles.setColorAt(i,tint);}
  const shadows=new THREE.InstancedMesh(geo(new THREE.CircleGeometry(.32,20)),basic('#03042b',{transparent:true,opacity:.35,depthWrite:false}),64);scene.add(shadows);for(let i=0;i<64;i++){const p=pos(i);matrix.makeTranslation(p.x+.04,p.y-.09,.177);shadows.setMatrixAt(i,matrix);}
  const rail=geo(new THREE.BoxGeometry(.035,7.8,.05)),cyan=basic('#72ffef');mesh(rail,cyan,-4.23,0,-.30);mesh(rail,cyan,4.23,0,-.30);
  for(const x of [-3.5,3.5]){const pod=mesh(geo(new THREE.CylinderGeometry(.20,.28,.56,12)),goldMat,x,-4.3,-.42);pod.rotation.x=Math.PI/2;const fire=mesh(geo(new THREE.ConeGeometry(.19,.75,12)),basic('#43e7ff',{transparent:true,opacity:.7}),x,-4.75,-.48);fire.rotation.z=Math.PI;}
  engineGlow=new THREE.Group();scene.add(engineGlow);const texture=glowTexture(),glowMat=mat(new THREE.SpriteMaterial({map:texture,color:'#32cfff',blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:.5}));for(const x of [-3.5,3.5]){const glow=new THREE.Sprite(glowMat);glow.position.set(x,-4.45,-.2);glow.scale.set(2,1.4,1);engineGlow.add(glow);}
  halo=mesh(geo(new THREE.TorusGeometry(5,.025,4,100)),basic('#47caff',{transparent:true,opacity:.20}),0,.1,-1.2);halo.scale.y=.90;
  planet=new THREE.Group();scene.add(planet);planet.position.set(4.1,9.2,-9);mesh(geo(new THREE.SphereGeometry(2.1,32,20)),physical('#6871ef',{roughness:.9,metalness:.08}),0,0,0,planet);const ring=mesh(geo(new THREE.RingGeometry(2.65,3.7,80)),basic('#e6beff',{side:THREE.DoubleSide,transparent:true,opacity:.5}),0,0,0,planet);ring.rotation.set(-.72,.25,.4);const ring2=mesh(geo(new THREE.RingGeometry(3.8,3.88,80)),basic('#b4f4ff',{side:THREE.DoubleSide,transparent:true,opacity:.7}),0,0,0,planet);ring2.rotation.copy(ring.rotation);
  const starPositions=[];let seed=39;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);for(let i=0;i<130;i++)starPositions.push((random()-.5)*38,(random()-.5)*35,-3-random()*20);const starGeo=geo(new THREE.BufferGeometry());starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));stars=new THREE.Points(starGeo,mat(new THREE.PointsMaterial({color:'#b8eaff',size:.06,transparent:true,opacity:.8,sizeAttenuation:true})));scene.add(stars);
  container.dataset.renderer='webgl';container.dataset.projection='perspective';
 }catch(e){renderer?.dispose();renderer=null;canvas.remove();const fallback=document.createElement('canvas');fallback.className='orb-canvas';fallback.setAttribute('aria-hidden','true');container.prepend(fallback);ctx=fallback.getContext('2d');container.dataset.renderer='canvas';container.dataset.projection='flat';}
 const targetCanvas=ctx?.canvas||canvas;
 function projectXY(x,y,z=.45){if(!renderer){const w=container.clientWidth,h=container.clientHeight,size=Math.min(w,h)*.97;return {x:(w/2+x*size/8.8)/w,y:(h/2-y*size/8.8)/h};}const p=new THREE.Vector3(x,y,z).project(camera);return {x:(p.x+1)/2,y:(1-p.y)/2};}
 function project(i){const p=pos(i);return projectXY(p.x,p.y);}
 function layoutTargets(){container.querySelectorAll('[data-index]').forEach((el,i)=>{const p=pos(i),corners=[[-.49,.49],[.49,.49],[.49,-.49],[-.49,-.49]].map(([x,y])=>projectXY(p.x+x,p.y+y)),x=Math.min(...corners.map(p=>p.x)),y=Math.min(...corners.map(p=>p.y)),w=Math.max(...corners.map(p=>p.x))-x,h=Math.max(...corners.map(p=>p.y))-y;Object.assign(el.style,{left:x*100+'%',top:y*100+'%',width:w*100+'%',height:h*100+'%',clipPath:`polygon(${corners.map(p=>`${(p.x-x)/w*100}% ${(p.y-y)/h*100}%`).join(',')})`});});}
 function resize(){const w=Math.max(1,container.clientWidth),h=Math.max(1,container.clientHeight);if(renderer){renderer.setSize(w,h,false);camera.aspect=w/h;camera.zoom=1;camera.updateProjectionMatrix();camera.updateMatrixWorld();const corners=[[-4.45,-5.2],[4.45,-5.2],[-4.45,4.45],[4.45,4.45]].map(([x,y])=>new THREE.Vector3(x,y,.3).project(camera));const extent=Math.max(...corners.flatMap(p=>[Math.abs(p.x),Math.abs(p.y)]));camera.zoom=.97/extent;camera.updateProjectionMatrix();}else{const ratio=Math.min(devicePixelRatio||1,1.5);targetCanvas.width=w*ratio;targetCanvas.height=h*ratio;}layoutTargets();}
 const observer=new ResizeObserver(resize);observer.observe(container);resize();
 function makeGem(tile,index,from=null,gravity=0){
  const m=new THREE.Group(),crystal=mesh(gemGeos[tile.kind],gemMats[tile.kind],0,0,0,m);crystal.rotation.z=tile.kind===3?-.04:.03;
  if(tile.special){const ring=mesh(ringGeo,goldMat,0,0,.04,m);ring.scale.setScalar(1.18);if(tile.special==='row'||tile.special==='column'){const band=mesh(bandGeo,whiteMat,0,0,.37,m);if(tile.special==='column')band.rotation.z=Math.PI/2;ring.rotation.x=.4;}else{ring.rotation.x=.7;const other=mesh(ringGeo,whiteMat,0,0,.06,m);other.rotation.y=1;other.scale.setScalar(1.18);if(tile.special==='prism'){crystal.material=goldMat;mesh(sparkGeo,whiteMat,0,0,.4,m).scale.setScalar(1.7);}}}
  const p=pos(index);m.position.set(p.x,p.y,.54);m.userData={id:tile.id,index,kind:tile.kind,crystal,special:tile.special,from:{...p},to:{...p},at:clock,duration:0,scaleFrom:1,scaleTo:1,arc:0};
  if(from!==null){m.userData.from=typeof from==='number'?pos(from):{x:p.x+(gravity===1?6:gravity===3?-6:0),y:p.y+(gravity===0?6:gravity===2?-6:0)};m.userData.duration=reduced()?0:320;if(m.userData.duration)m.position.set(m.userData.from.x,m.userData.from.y,.54);}gems.add(m);return m;
 }
 function set(s,options={}){board=s.board;rockState=s.rocks;if(!renderer){render2d();return;}gems.clear();geology.clear();const from=options.motion?new Map(options.motion.map(m=>[m.id,m.from])):null;meshes=s.board.map((tile,i)=>tile?makeGem(tile,i,from?(from.get(tile.id)??'new'):null,s.gravity):null);
  s.rocks.forEach((hp,i)=>{if(!hp)return;const p=pos(i);mesh(rockGeo,hp===2?goldMat:rockMat,p.x,p.y,.15,geology);if(hp===2){const stripe=mesh(bandGeo,rockMat,p.x,p.y,.33,geology);stripe.rotation.z=-.7;stripe.scale.set(1.35,1.2,1);}});
  const sector=Math.floor((s.level-1)/8);planet.children[0].material.color.set(['#6871ef','#ff9261','#c951ee'][sector]);halo.material.color.set(['#47e5ff','#ffc45f','#e298ff'][sector]);renderScene();
 }
 function highlight(index,hints=[]){selection=index;hinted=hints;if(!renderer)return;highlights.clear();for(const i of [...new Set([index,...hints])]){if(i<0)continue;const p=pos(i);mesh(ringGeo,i===index?selectedMat:hintMat,p.x,p.y,.25,highlights).scale.setScalar(1.25);}}
 function particles(indices,rocks=false){if(!renderer||reduced())return;for(const i of indices){const p=pos(i),tile=board[i];for(let j=0;j<(rocks?4:7)&&dust.length<210;j++){const m=mesh(sparkGeo,rocks?goldMat:colorMats[tile?.kind||0],p.x,p.y,.6);dust.push({m,at:clock,vx:(Math.random()-.5)*.007,vy:(Math.random()-.4)*.008,vz:.002+Math.random()*.005,spin:(Math.random()-.5)*.02});}}}
 function burst(index,type){if(!renderer||reduced())return;const p=pos(index),material=new THREE.MeshBasicMaterial({color:type==='nova'?'#ffb45e':'#b4fff5',transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}),m=new THREE.Group(),ring=new THREE.Mesh(ringGeo,material);m.position.set(p.x,p.y,.85);m.add(ring);if(['row','column','pulse','prism'].includes(type))for(const axis of type==='row'?['row']:type==='column'?['column']:['row','column']){const beam=new THREE.Mesh(bandGeo,material);beam.scale.set(15,2.8,1);if(axis==='column')beam.rotation.z=Math.PI/2;m.add(beam);}scene.add(m);bursts.push({m,ring,material,at:clock,type});}
 function render2d(){if(!ctx)return;const w=targetCanvas.width,h=targetCanvas.height,size=Math.min(w,h)*.97,u=size/8.8,v=u;ctx.clearRect(0,0,w,h);ctx.save();ctx.translate((w-size)/2,(h-size)/2);ctx.fillStyle='#243a79';ctx.strokeStyle='#e7bd6f';ctx.lineWidth=u*.07;ctx.beginPath();ctx.roundRect(u*.3,v*.3,u*8.2,v*8.2,u*.22);ctx.fill();ctx.stroke();
  for(let i=0;i<64;i++){const x=(i%8+.9)*u,y=((i/8|0)+.9)*v,t=board[i];ctx.fillStyle=rockState[i]?'#986540':(i+(i/8|0))%2?'#34578f':'#2b497e';ctx.beginPath();ctx.roundRect(x-u*.45,y-v*.45,u*.9,v*.9,u*.08);ctx.fill();if(!t)continue;const color=COLORS[t.kind],g=ctx.createLinearGradient(x-u*.3,y-v*.4,x+u*.3,y+v*.4);g.addColorStop(0,'#faffff');g.addColorStop(.28,color);g.addColorStop(1,'#172248');ctx.fillStyle=g;ctx.strokeStyle=color;ctx.lineWidth=u*.025;const sides=[4,6,8,3,4,10][t.kind],turn=[0,Math.PI/6,Math.PI/8,-Math.PI/2,Math.PI/4,0][t.kind];ctx.beginPath();for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2+turn,px=x+Math.cos(a)*u*.36,py=y+Math.sin(a)*v*.36;j?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle='#ffffff88';ctx.beginPath();for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2+turn,px=x+Math.cos(a)*u*.21,py=y+Math.sin(a)*v*.21;j?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.stroke();
   if(t.special){ctx.fillStyle='#fff5bd';ctx.font=`bold ${u*.45}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='#07112f';ctx.shadowBlur=3;ctx.fillText({row:'↔',column:'↕',nova:'✺',prism:'✦'}[t.special],x,y);ctx.shadowBlur=0;}if(i===selection||hinted.includes(i)){ctx.strokeStyle=i===selection?'#fff595':'#65ffdf';ctx.lineWidth=u*.055;ctx.strokeRect(x-u*.43,y-v*.43,u*.86,v*.86);}
  }ctx.restore();
 }
 function renderScene(){if(renderer)renderer.render(scene,camera);else render2d();}
 function tick(t){if(stopped)return;const raw=last?t-last:0,dt=Math.min(40,raw);last=t;const paused=document.hidden||isPaused(),noMotion=reduced();if(!paused){clock+=Math.min(250,raw);if(renderer){
   if(qualityFrames<150&&raw>0){qualityFrames++;if(raw>34)slowFrames++;if(qualityFrames===150&&slowFrames>65){renderer.setPixelRatio(1);resize();container.dataset.quality='balanced';}}
   for(const m of meshes){if(!m)continue;const d=m.userData,k=d.duration?Math.min(1,(clock-d.at)/d.duration):1,ease=1-(1-k)**3;m.position.x=d.from.x+(d.to.x-d.from.x)*ease;m.position.y=d.from.y+(d.to.y-d.from.y)*ease;m.position.z=.54+(noMotion?0:Math.sin(clock*.0017+d.index*.6)*.025)+Math.sin(k*Math.PI)*d.arc;m.scale.setScalar(d.scaleFrom+(d.scaleTo-d.scaleFrom)*ease);if(!noMotion){d.crystal.rotation.x=Math.sin(clock*.0012+d.index)*.09;d.crystal.rotation.y=Math.sin(clock*.0008+d.index*.7)*.12;if(d.special&&m.children[1])m.children[1].rotation.z=clock*.0006;}}
   dust=dust.filter(p=>{const age=clock-p.at;if(age>720){scene.remove(p.m);return false;}p.m.position.x+=p.vx*dt;p.m.position.y+=p.vy*dt;p.m.position.z+=p.vz*dt;p.vz-=dt*.000016;p.m.rotation.x+=p.spin*dt;p.m.rotation.y+=.003*dt;p.m.scale.setScalar(1-age/720);return true;});bursts=bursts.filter(p=>{const age=clock-p.at;if(age>580){scene.remove(p.m);p.material.dispose();return false;}p.ring.scale.setScalar(1+age*.020);p.material.opacity=.9*(1-age/580);return true;});
   if(!noMotion){planet.rotation.z=Math.sin(clock*.00012)*.09;stars.rotation.z=clock*.000005;engineGlow.children.forEach((g,i)=>g.material.opacity=.45+Math.sin(clock*.006+i)*.08);hintMat.opacity=.55+Math.sin(clock*.006)*.25;}renderScene();
  }else render2d();}else if(!pausedLast)renderScene();pausedLast=paused;frameId=requestAnimationFrame(tick);
 }frameId=requestAnimationFrame(tick);
 function wait(ms){if(reduced())return Promise.resolve();const start=clock;return new Promise(resolve=>{const check=()=>{if(stopped||clock-start>=ms)resolve();else requestAnimationFrame(check);};requestAnimationFrame(check);});}
 async function play(frame){
  if(frame.type==='swap'){if(renderer)for(const [from,to,arc]of [[frame.a,frame.b,.4],[frame.b,frame.a,.1]]){const m=meshes[from];if(m)m.userData={...m.userData,from:pos(from),to:pos(to),at:clock,duration:180,arc};}await wait(180);set(frame.state);return;}
  if(frame.type==='clear'){particles(frame.cleared);particles(frame.hit.filter(i=>frame.rockBefore[i]>0),true);frame.effects.filter(e=>!e.created).forEach(e=>burst(e.index,e.special));if(renderer)for(const i of frame.cleared){const m=meshes[i];if(m)m.userData={...m.userData,from:pos(i),to:pos(i),at:clock,duration:190,scaleFrom:1.15,scaleTo:0,arc:.35};}else board=frame.clearState.board;await wait(190);set(frame.state,{motion:frame.motion});await wait(330);frame.effects.filter(e=>e.created).forEach(e=>burst(e.index,'created'));return;}
  set(frame.state);await wait(180);
 }
 function celebrate(){particles([9,14,25,30,41,46,57,62]);for(const i of [18,27,36,45])burst(i,'nova');}
 function dispose(){stopped=true;cancelAnimationFrame(frameId);observer.disconnect();renderer?.dispose();environment?.dispose();[...geos,...materials,...textures,...bursts.map(p=>p.material)].forEach(o=>o.dispose?.());}
 targetCanvas.addEventListener('webglcontextlost',e=>e.preventDefault());
 return {set,play,wait,burst,highlight,project,celebrate,dispose,get renderer(){return renderer?'webgl':'canvas';}};
}
