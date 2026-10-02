import * as THREE from '../vendor/three.module.js';
import {FIELD} from './merge-engine.js';

const palette=['#fb6589','#588fec','#25bfa9','#aa81e9','#f6b344','#89bf50','#de68b7','#f47f56','#39b5d4','#707feb','#f1b62f','#42bd91'];
export const colorOf=value=>palette[(Math.max(1,Math.round(Math.log2(value||2)))-1)%palette.length];
export const labelOf=value=>value>=1048576?(value/1048576).toFixed(value%1048576?1:0)+'M':value>=16384?(value/1024).toFixed(value%1024?1:0)+'K':String(value);

function roundedCube(){
  const g=new THREE.BoxGeometry(.98,.98,.98,5,5,5),p=g.attributes.position,inner=.405,r=.085;
  for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i),core=v.clone().clampScalar(-inner,inner),normal=v.clone().sub(core).normalize();v.copy(core).addScaledVector(normal,r);p.setXYZ(i,v.x,v.y,v.z);}
  g.computeVertexNormals();return g;
}

export function createMergeView(wrap){
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,.1,100);
  camera.position.set(0,25.5,19.5);camera.lookAt(0,0,1.2);
  let renderer,canvas,fallback=false;
  try{
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));renderer.setClearColor(0,0);
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.96;
    canvas=renderer.domElement;
  }catch{
    fallback=true;canvas=document.createElement('canvas');
  }
  canvas.className='merge-canvas';canvas.tabIndex=0;canvas.setAttribute('aria-label','Дорожка с кубиками. Передвигайте прицел влево и вправо, отпустите палец или мышь для броска. На клавиатуре: стрелки и пробел.');wrap.prepend(canvas);
  const geometries=[],materials=[],textures=[],pieces=new Map(),effects=[],labels=[];
  const cubeGeo=roundedCube();geometries.push(cubeGeo);
  const materialCache=new Map();
  const mat=(color,options={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.56,metalness:.03,...options});materials.push(m);return m;};
  const box=(w,h,d,color,x,y,z)=>{const g=new THREE.BoxGeometry(w,h,d);geometries.push(g);const m=new THREE.Mesh(g,mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;};
  if(!fallback){
    scene.add(new THREE.HemisphereLight(0xffffff,0x6985a3,2.0));
    const light=new THREE.DirectionalLight(0xfff3df,2.4);light.position.set(-5,13,6);light.castShadow=true;
    light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-7,right:7,top:13,bottom:-13,near:.5,far:42});light.shadow.bias=-.001;light.shadow.normalBias=.028;scene.add(light);
    const fill=new THREE.DirectionalLight(0xb2d7ff,1.4);fill.position.set(7,4,-8);scene.add(fill);
    box(8.22,.45,18.35,0x527f82,0,-.4,1.6);
    box(7.6,.18,17.9,0xd5e7e5,0,-.095,1.6);
    for(let i=0;i<4;i++)box(.018,.008,17.9,0xb8d1d0,-2.85+i*1.9,.004,1.6);
    for(const x of [-3.97,3.97]){box(.3,.5,18.2,0x659c99,x,.14,1.55);box(.11,.032,18.2,0xb6f3dc,x,.41,1.55);}
    box(8.2,.55,.25,0x659c99,0,.15,-7.34);
    for(let x=-3.6;x<3.7;x+=.57)box(.3,.018,.058,0xe17687,x,.016,FIELD.line);
    // Launching zone, kept on the board so it also teaches the input direction.
    const ringGeo=new THREE.RingGeometry(.66,.70,48),ring=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:0x648e91,transparent:true,opacity:.6,side:THREE.DoubleSide}));
    geometries.push(ringGeo);materials.push(ring.material);ring.rotation.x=-Math.PI/2;ring.position.set(0,.008,FIELD.launch);scene.add(ring);
    box(3.1,.014,.028,0x759f9f,0,.012,9.62);
  }

  function cubeMaterial(value,kind='normal'){
    const key=kind==='normal'?String(value):kind;if(materialCache.has(key))return materialCache.get(key);
    const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');
    if(kind==='wild'){const g=ctx.createLinearGradient(0,0,256,256);['#f57aa5','#aa82ed','#61a9ee','#55d4b1','#f6d06f'].forEach((c,i)=>g.addColorStop(i/4,c));ctx.fillStyle=g;}
    else ctx.fillStyle=kind==='bomb'?'#344356':colorOf(value);
    ctx.fillRect(0,0,256,256);
    const gradient=ctx.createLinearGradient(0,0,0,256);gradient.addColorStop(0,'#ffffff2b');gradient.addColorStop(1,'#0000000c');ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);
    ctx.strokeStyle='#ffffff28';ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(14,14,228,228,24);ctx.stroke();
    const text=kind==='wild'?'★':kind==='bomb'?'✹':labelOf(value);ctx.font=`900 ${text.length>4?72:text.length>3?83:text.length>2?104:144}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#ffffff';ctx.shadowColor='#15304638';ctx.shadowOffsetY=5;ctx.shadowBlur=0;ctx.fillText(text,128,131);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer?Math.min(4,renderer.capabilities.getMaxAnisotropy()):1;textures.push(texture);
    const m=new THREE.MeshStandardMaterial({map:texture,roughness:.34,metalness:.015});materials.push(m);materialCache.set(key,m);return m;
  }
  const ghost=fallback?null:new THREE.Mesh(cubeGeo,cubeMaterial(2));
  if(ghost){ghost.castShadow=true;scene.add(ghost);}
  let aim=0,aimValue=2,aimKind='normal',showAim=true,w=1,h=1;
  const dots=[];
  if(!fallback){const geo=new THREE.SphereGeometry(.049,7,5),m=new THREE.MeshBasicMaterial({color:0x436d78,transparent:true,opacity:.55});geometries.push(geo);materials.push(m);for(let i=0;i<31;i++){const dot=new THREE.Mesh(geo,m);scene.add(dot);dots.push(dot);}}

  const point=(x,y,z)=>{const p=new THREE.Vector3(x,y,z).project(camera);return {x:(p.x+1)*w/2,y:(1-p.y)*h/2};};
  function resize(){
    w=Math.max(1,wrap.clientWidth);h=Math.max(1,wrap.clientHeight);camera.aspect=w/h;camera.zoom=1;camera.updateProjectionMatrix();
    const corners=[[-4.2,0,-7.6],[4.2,0,-7.6],[-4.2,0,10.8],[4.2,0,10.8],[0,2.5,-6.5]].map(p=>new THREE.Vector3(...p).project(camera));
    const boundX=Math.max(...corners.map(p=>Math.abs(p.x))),spanY=Math.max(...corners.map(p=>p.y))-Math.min(...corners.map(p=>p.y));
    camera.zoom=Math.min(.93/boundX,1.66/spanY);camera.updateProjectionMatrix();
    const vertical=corners.map(p=>p.y*camera.zoom),center=(Math.min(...vertical)+Math.max(...vertical))*.5;
    camera.projectionMatrix.elements[9]+=center+.035;camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    if(renderer)renderer.setSize(w,h,false);else{const d=Math.min(window.devicePixelRatio||1,1.7);canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);}
  }
  const observer=new ResizeObserver(resize);observer.observe(wrap);resize();
  const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-FIELD.half),hit=new THREE.Vector3();
  function aimFromScreen(clientX){
    const rect=canvas.getBoundingClientRect(),launchScreen=new THREE.Vector3(0,FIELD.half,FIELD.launch).project(camera);
    ray.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,launchScreen.y),camera);
    if(!ray.ray.intersectPlane(plane,hit))return aim;
    return Math.max(-FIELD.halfWidth+.73,Math.min(FIELD.halfWidth-.73,hit.x));
  }
  function setAim(x,value,kind,visible){aim=x;aimValue=value;aimKind=kind;showAim=visible;if(ghost){ghost.visible=visible;ghost.position.set(aim,FIELD.half+.06,FIELD.launch);ghost.material=cubeMaterial(value,kind);ghost.rotation.set(0,.07,0);}}
  const particleGeo=new THREE.OctahedronGeometry(.065),particleMaterials=new Map();geometries.push(particleGeo);
  function effect(e){
    if(['merge','blast','milestone'].includes(e.type)){
      const n=e.type==='milestone'?56:e.type==='blast'?30:17;
      const color=e.type==='blast'?'#f4cd77':colorOf(e.value||64);
      let m=particleMaterials.get(color);if(!m){m=new THREE.MeshBasicMaterial({color});materials.push(m);particleMaterials.set(color,m);}
      for(let i=0;i<n;i++){
        const a=Math.random()*Math.PI*2,speed=1.1+Math.random()*2.3,mesh=fallback?null:new THREE.Mesh(particleGeo,m),p={x:e.x||0,y:e.y||.7,z:e.z||-3,vx:Math.cos(a)*speed,vy:2.5+Math.random()*4,vz:Math.sin(a)*speed,life:.55+Math.random()*.5,mesh,color:colorOf(e.value||32)};
        if(mesh)scene.add(mesh);effects.push(p);
      }
      const el=document.createElement('div');el.className='merge-float'+(e.combo>1?' is-combo':'');el.textContent=e.type==='blast'?'БА-БАХ!':e.type==='milestone'?labelOf(e.value)+'!':e.combo>1?`КОМБО ×${e.combo}`:`+${e.value}`;wrap.append(el);labels.push({el,x:e.x||0,y:(e.y||.5)+.6,z:e.z||-3,life:1.15});
    }
  }

  function guideEnd(s){const candidates=s.bodies.filter(b=>Math.abs(b.x-aim)<.95&&b.z<FIELD.launch&&b.y<1.9);return candidates.length?Math.max(...candidates.map(b=>b.z+1.1)):FIELD.back+.6;}
  function render(s,dt){
    const end=guideEnd(s);
    if(!fallback){
      const ids=new Set(s.bodies.map(b=>b.id));for(const [id,m]of pieces)if(!ids.has(id)){scene.remove(m);pieces.delete(id);}
      for(const b of s.bodies){let mesh=pieces.get(b.id);if(!mesh){mesh=new THREE.Mesh(cubeGeo,cubeMaterial(b.value,b.kind));mesh.castShadow=true;mesh.receiveShadow=true;pieces.set(b.id,mesh);scene.add(mesh);}
        mesh.position.set(b.x,b.y,b.z);const hop=Math.min(1,Math.max(0,b.y-FIELD.half));mesh.rotation.set(Math.sin(b.age*9)*hop*.2,b.angle,Math.sin(b.age*11)*hop*.18);
        const pop=b.age<.28&&!b.projectile?1+Math.sin(b.age/.28*Math.PI)*.16:1;mesh.scale.setScalar(pop);
      }
      dots.forEach((d,i)=>{const z=FIELD.launch-.72-i*.51;d.visible=showAim&&z>end;d.position.set(aim,.055,z);});
    }
    for(let i=effects.length-1;i>=0;i--){const p=effects[i];p.life-=dt;p.vy-=12*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.mesh){p.mesh.position.set(p.x,p.y,p.z);p.mesh.rotation.x+=dt*5;p.mesh.scale.setScalar(Math.min(1,p.life*3));}if(p.life<=0||p.y<-.2){if(p.mesh)scene.remove(p.mesh);effects.splice(i,1);}}
    for(let i=labels.length-1;i>=0;i--){const l=labels[i];l.life-=dt;l.y+=dt*.7;const p=point(l.x,l.y,l.z);l.el.style.left=p.x+'px';l.el.style.top=p.y+'px';l.el.style.opacity=Math.min(1,l.life*3);if(l.life<=0){l.el.remove();labels.splice(i,1);}}
    if(renderer)renderer.render(scene,camera);else renderCanvas(s,end);
  }

  // Software projection keeps the same gameplay usable when WebGL is unavailable.
  function renderCanvas(s,end){
    const c=canvas.getContext('2d'),ratio=canvas.width/w;c.setTransform(ratio,0,0,ratio,0,0);c.clearRect(0,0,w,h);
    const poly=(vertices,color,stroke)=>{c.beginPath();vertices.forEach(([x,y,z],i)=>{const p=point(x,y,z);i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);});c.closePath();c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}};
    poly([[-4.07,-.3,-7.45],[4.07,-.3,-7.45],[4.07,-.3,10.65],[-4.07,-.3,10.65]],'#527f82');
    poly([[-3.8,0,-7.2],[3.8,0,-7.2],[3.8,0,10.4],[-3.8,0,10.4]],'#d5e7e5');
    for(const x of [-3.96,3.96])poly([[x-.13,.3,-7.4],[x+.13,.3,-7.4],[x+.13,.3,10.5],[x-.13,.3,10.5]],'#8ccdb8');
    for(let x=-3.6;x<3.6;x+=.55)poly([[x,.02,FIELD.line-.028],[x+.3,.02,FIELD.line-.028],[x+.3,.02,FIELD.line+.028],[x,.02,FIELD.line+.028]],'#da7488');
    if(showAim)for(let z=FIELD.launch-.7;z>end;z-=.51){const p=point(aim,.04,z);c.fillStyle='#668b92';c.beginPath();c.arc(p.x,p.y,2,0,Math.PI*2);c.fill();}
    const bodies=[...s.bodies];if(showAim)bodies.push({x:aim,y:.52,z:FIELD.launch,value:aimValue,kind:aimKind,angle:.07});
    for(const b of bodies.sort((a,b)=>a.z-b.z)){
      const f=(x,y,z)=>[b.x+x*Math.cos(b.angle)-z*Math.sin(b.angle),b.y+y,b.z+x*Math.sin(b.angle)+z*Math.cos(b.angle)],color=b.kind==='bomb'?'#344356':b.kind==='wild'?'#a381e8':colorOf(b.value),k=.48;
      const p=point(b.x,.015,b.z);c.fillStyle='#24445230';c.beginPath();c.ellipse(p.x+3,p.y+4,Math.max(3,(point(b.x+k,.015,b.z).x-p.x)*1.4),6,0,0,Math.PI*2);c.fill();
      poly([f(-k,-k,k),f(k,-k,k),f(k,k,k),f(-k,k,k)],color,'#ffffff65');
      poly([f(-k,k,-k),f(k,k,-k),f(k,k,k),f(-k,k,k)],color,'#ffffff90');
      poly([f(k,-k,-k),f(k,-k,k),f(k,k,k),f(k,k,-k)],color,'#00000010');
      const top=point(...f(0,k+.005,0)),front=point(...f(0,0,k+.005)),size=Math.max(9,Math.abs(point(...f(k,k,0)).x-point(...f(-k,k,0)).x)*.57),text=b.kind==='bomb'?'✹':b.kind==='wild'?'★':labelOf(b.value);
      c.font=`900 ${size*(text.length>3?.62:text.length>2?.8:1)}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillStyle='#fff';c.fillText(text,top.x,top.y);c.fillText(text,front.x,front.y);
    }
    for(const e of effects){const p=point(e.x,e.y,e.z);c.fillStyle=e.color;c.fillRect(p.x,p.y,3,3);}
  }
  function clearEffects(){effects.forEach(e=>e.mesh&&scene.remove(e.mesh));effects.length=0;labels.forEach(l=>l.el.remove());labels.length=0;}
  function dispose(){observer.disconnect();clearEffects();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer?.dispose();}
  return {canvas,aimFromScreen,setAim,render,effect,clearEffects,dispose,point,mode:fallback?'canvas':'webgl',resize};
}
