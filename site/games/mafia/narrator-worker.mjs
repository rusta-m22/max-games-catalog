/* Isolated synthesis: names and public host phrases stay on this device. */
import RHVoiceModule from './vendor/rhvoice/rhvoice.js';
let ready;
export async function loadVoice(fetcher=fetch){
 if(!ready)ready=(async()=>{
  const [engine,response]=await Promise.all([RHVoiceModule(),fetcher(new URL('./vendor/rhvoice/voice-data.bin.gz',import.meta.url))]);
  if(!response.ok)throw Error('voice-download');
  const packed=new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  const headerBytes=new DataView(packed.buffer).getUint32(0,true),files=JSON.parse(new TextDecoder().decode(packed.subarray(4,4+headerBytes)));let offset=4+headerBytes;
  for(const [name,size]of files){const path='/data/'+name;engine.FS.mkdirTree(path.slice(0,path.lastIndexOf('/')));engine.FS.writeFile(path,packed.subarray(offset,offset+size));offset+=size;}
  engine.FS.mkdirTree('/config');engine.FS.writeFile('/config/RHVoice.conf','languages.Russian.use_pseudo_english=true\n');
  if(engine.ccall('rhv_init','number',['string','string'],['/data','/config'])!==0)throw Error('voice-init');
  return engine;
 })().catch(e=>{ready=null;throw e;});return ready;
}
export function synthesize(engine,text,rate=1){
 const count=engine.ccall('rhv_speak','number',['string','string','number','number','number','number'],[String(text).slice(0,1400),'Elena',rate,1,1,0]);
 if(count<=0)throw Error('voice-synthesis');const start=engine._rhv_samples_ptr()/2;return {pcm:engine.HEAP16.slice(start,start+count),sampleRate:engine._rhv_sample_rate()};
}
// Latest announcement wins. Cancelled/old phases never build an unbounded queue.
if(typeof WorkerGlobalScope!=='undefined'&&globalThis instanceof WorkerGlobalScope){
 let latest=null,busy=false;
 self.onmessage=async e=>{latest=e.data;if(busy)return;busy=true;try{while(latest){const task=latest;latest=null;try{const engine=await loadVoice();if(latest)continue;const out=synthesize(engine,task.text,task.rate);self.postMessage({id:task.id,...out},[out.pcm.buffer]);}catch(error){self.postMessage({id:task.id,error:String(error.message)});}}}finally{busy=false;}};
}
