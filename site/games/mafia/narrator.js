/* Public host announcements only. Private role data and chat are never narrated. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MafiaNarrator=factory();})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const choose=(lang,ru,en)=>lang==='ru'?ru:en;
const clamp=(value,min,max,fallback)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;
function normalizeSettings(value={}){return {enabled:value.enabled!==false&&value.nearbyVoice!==false,volume:clamp(value.volume,0,1,.85),rate:clamp(value.rate,.8,1.2,.96),voices:{ru:typeof value.voices?.ru==='string'?value.voices.ru:'',en:typeof value.voices?.en==='string'?value.voices.en:''}};}
function publicAnnouncement(view,language='ru'){
 if(!view||view.phase==='lobby')return '';
 const lang=language==='ru'?'ru':'en',t=(ru,en)=>choose(lang,ru,en);
 // Deliberately do not access view.me.role, notes, targets, actions, or private chat.
 const name=id=>{const p=view.players?.find(p=>p.id===id);return String(p?.name||t('игрок','player')).replace(/[\u0000-\u001f\u202a-\u202e\u2066-\u2069]/g,' ').slice(0,24);};
 const result=(key,round)=>[...(view.log||[])].reverse().find(e=>e.scope==='all'&&e.key===key&&e.round===round);
 const nightResult=()=>{const out=result('nightResult',view.round)?.data?.out;if(Array.isArray(out)&&out.length)return t('Этой ночью выбыли: ','Eliminated tonight: ')+out.map(name).join(', ')+'. ';if(result('quietNight',view.round))return t('Эта ночь прошла спокойно. Все остались за столом. ','A quiet night. Everyone is still at the table. ');return '';};
 const voteResult=round=>{const e=result('voteResult',round);if(!e)return '';return e.data?.out?t('По решению города выбывает ','The city voted out ')+name(e.data.out)+'. ':t('Голоса разделились. Никто не выбывает. ','The vote was tied. Nobody is eliminated. ');};
 switch(view.phase){
 case 'role':return t('Ведущий на связи. Роли розданы. Посмотрите свои карточки и сохраните их в тайне.','Your host is here. Roles have been dealt. Check your cards and keep them secret.');
 case 'night':return voteResult(view.round-1)+t('Город засыпает. Активные роли делают свои ночные ходы. Мирные жители отдыхают.','The city falls asleep. Active roles, make your night actions. Citizens, rest until morning.');
 case 'day':{if(view.speech){const first=view.speech.index===0,bot=view.players?.find(p=>p.id===view.speech.player)?.bot;return (first?t('Город просыпается. ','The city wakes up. ')+nightResult():'')+t('Слово получает ','The floor goes to ')+name(view.speech.player)+'. '+(bot?t('Выслушаем его версию.','Let’s hear their theory.'):t('У вас две минуты на рассуждения. Когда закончите, нажмите «Следующий».','You have two minutes to share your thoughts. When finished, press Next.'));}return t('Город просыпается. ','The city wakes up. ')+nightResult()+t('Начинаем обсуждение. Поделитесь подозрениями и выслушайте других.','Discussion begins. Share your suspicions and listen to the others.');}
 case 'vote':return t('Обсуждение завершено. Начинается голосование. Выберите игрока и подтвердите голос.','Discussion is over. Voting begins. Choose a player and confirm your vote.');
 case 'ended':{const last=[...(view.log||[])].reverse().find(e=>e.scope==='all'&&e.round===view.round&&['nightResult','quietNight','voteResult'].includes(e.key));const intro=last?.key==='voteResult'?voteResult(view.round):nightResult();const ending={town:t('Победили мирные жители. Город в безопасности.','The citizens win. The city is safe.'),mafia:t('Победила мафия. Сегодня город принадлежит ей.','The mafia wins. The city belongs to them tonight.'),maniac:t('Победил маньяк. Он переиграл весь город.','The maniac wins. One player outsmarted the entire city.'),draw:t('Партия завершилась вничью.','The game ends in a draw.')}[view.winner]||t('Партия завершена.','The game is over.');return intro+ending;}
 default:return '';
 }
}
class HostNarrator{
 constructor(options={}){
  this.fallback=options.fallback||null;this.synth=options.synth||null;this.Utterance=options.Utterance||null;this.settings=normalizeSettings(options.settings);this.onStatus=options.onStatus||(()=>{});this.onVoices=options.onVoices||(()=>{});this.schedule=options.setTimeout||((...args)=>globalThis.setTimeout(...args));this.unschedule=options.clearTimeout||(id=>globalThis.clearTimeout(id));
  this.nativeSupported=!!(this.synth&&typeof this.synth.speak==='function'&&typeof this.synth.cancel==='function'&&this.Utterance);this.supported=this.nativeSupported||!!this.fallback?.supported;this.unlocked=false;this.master=true;this.blocked=false;this.hardBlocked=false;this.allowed=true;this.current=null;this.lastKey='';this.warningKey='';this.pending=null;this.waitTimer=null;this.utterance=null;this.generation=0;this.status=this.supported?'ready':'unsupported';
  this.voicesChanged=()=>{this.onVoices();if(this.status==='no-voice'&&this.current&&this.voices(this.current.lang).length)this.lastKey='';this.flush();};if(this.nativeSupported)this.synth.addEventListener?.('voiceschanged',this.voicesChanged);
 }
 statusChanged(status){this.status=status;if(['needs-click','error'].includes(status)){this.lastKey='';this.retryBlocked=true;}else if(['speaking','ready','ready-builtin'].includes(status))this.retryBlocked=false;this.onStatus(status);}
 voices(lang){let voices=[];if(this.nativeSupported)try{voices=this.synth.getVoices()||[];}catch{}voices=voices.filter(v=>String(v.lang).toLowerCase().replace('_','-').split('-')[0]===lang);if(lang==='ru'&&this.fallback?.supported)voices.push({voiceURI:'builtin-ru',lang:'ru-RU',name:'Встроенный русский — Елена',builtin:true,localService:true});return voices;}
 selectVoice(lang){const list=this.voices(lang),saved=this.settings.voices[lang];return list.find(v=>v.voiceURI===saved)||list.find(v=>v.localService&&v.default)||list.find(v=>v.localService)||list.find(v=>v.default)||list[0]||null;}
 cancel(){this.generation++;if(this.waitTimer!==null){this.unschedule(this.waitTimer);this.waitTimer=null;}this.pending=null;this.utterance=null;this.fallback?.cancel();if(this.nativeSupported)try{this.synth.cancel();}catch{}if(['speaking','loading','loading-builtin'].includes(this.status))this.statusChanged('ready');}
 unlock(){if(this.settings.enabled&&this.master&&!this.hardBlocked)this.fallback?.unlock();if(!this.supported)return;const retry=this.retryBlocked||!this.unlocked;this.unlocked=true;if(!retry)return;this.retryBlocked=false;
  // A silent utterance inside a user click allows later network-triggered announcements.
  if(this.nativeSupported&&this.settings.enabled&&this.master&&!this.hardBlocked)try{const primer=new this.Utterance(' ');primer.volume=0;this.synth.speak(primer);}catch{}
  this.statusChanged('ready');this.flush();
 }
 configure(patch){this.settings=normalizeSettings({...this.settings,...patch,voices:{...this.settings.voices,...patch.voices}});this.cancel();this.lastKey='';if(this.settings.enabled)this.flush();}
 setMaster(value){const next=!!value;if(this.master===next)return;this.master=next;this.cancel();if(next){this.lastKey='';this.flush();}}
 setBlocked(value,hard=false){const next=!!value,hardNext=!!hard;if(this.blocked===next&&this.hardBlocked===hardNext)return;this.blocked=next;this.hardBlocked=hardNext;if(next||hardNext)this.cancel();else this.flush();}
 observe(view,lang='ru',context={}){
  const language=lang==='ru'?'ru':'en';const text=publicAnnouncement(view,language);
  const allowed=true;
  const current=text?{key:view.id+':'+view.seq+':'+language,text,lang:language,phase:view.phase}:null;
  if(this.current?.key!==current?.key||this.allowed!==allowed){this.cancel();if(!this.allowed&&allowed)this.lastKey='';}
  this.allowed=allowed;this.current=current;if(!this.allowed)this.statusChanged('host-only');else this.flush();
 }
 canSpeak(preview=false){return this.supported&&this.settings.enabled&&this.settings.volume>0&&this.master&&this.unlocked&&!this.hardBlocked&&(preview||(!this.blocked&&this.allowed));}
 flush(){if(this.retryBlocked)return;if(this.pending){if(this.canSpeak(this.pending.preview)&&this.voices(this.pending.lang).length)this.emit(this.pending);return;}if(this.current&&this.current.key!==this.lastKey&&this.canSpeak())this.request({...this.current,preview:false});}
 request(item){if(!this.canSpeak(item.preview))return false;this.cancel();
  if(this.selectVoice(item.lang))return this.emit(item);
  let all=[];try{all=this.synth?.getVoices()||[];}catch{}
  if(this.nativeSupported&&!all.length){this.pending=item;this.statusChanged('loading');this.waitTimer=this.schedule(()=>{this.waitTimer=null;if(this.pending===item&&this.canSpeak(item.preview))this.emit(item);},1800);return true;}
  return this.emit(item);
 }
 fallbackSpeak(item){if(item.lang!=='ru'||!this.fallback?.supported)return false;const generation=this.generation;if(item.key)this.lastKey=item.key;return this.fallback.speak(item.text,{rate:this.settings.rate,volume:this.settings.volume,onStatus:status=>{if(generation!==this.generation)return;if(status==='needs-click')this.unlocked=false;this.statusChanged(status);}});}
 emit(item){if(!this.canSpeak(item.preview))return false;if(this.waitTimer!==null){this.unschedule(this.waitTimer);this.waitTimer=null;}this.pending=null;
  const voice=this.selectVoice(item.lang);if(!voice){this.lastKey=item.key||this.lastKey;this.statusChanged('no-voice');return false;}if(voice.builtin)return this.fallbackSpeak(item);
  const generation=this.generation,utterance=new this.Utterance(item.text);utterance.lang=item.lang==='ru'?'ru-RU':'en-US';utterance.voice=voice;utterance.volume=this.settings.volume;utterance.rate=this.settings.rate;utterance.pitch=1;this.utterance=utterance;
  const clear=()=>{if(this.waitTimer!==null){this.unschedule(this.waitTimer);this.waitTimer=null;}};
  utterance.onstart=()=>{if(generation===this.generation){clear();this.statusChanged('speaking');}};
  utterance.onend=()=>{if(generation===this.generation){clear();this.utterance=null;this.statusChanged('ready');}};
  utterance.onerror=e=>{if(generation!==this.generation||['canceled','interrupted'].includes(e.error))return;clear();this.utterance=null;if(this.fallbackSpeak(item))return;if(e.error==='not-allowed'){this.unlocked=false;this.statusChanged('needs-click');}else this.statusChanged(['voice-unavailable','language-unavailable'].includes(e.error)?'no-voice':'error');};
  if(item.key)this.lastKey=item.key;
  // Some desktop engines list a voice but never start it. Recover without a silent turn.
  if(item.lang==='ru'&&this.fallback?.supported)this.waitTimer=this.schedule(()=>{this.waitTimer=null;if(generation!==this.generation||!this.canSpeak(item.preview))return;utterance.onerror=null;utterance.onend=null;this.synth.cancel();this.utterance=null;this.fallbackSpeak(item);},5000);
  try{this.synth.speak(utterance);return true;}catch{clear();if(this.fallbackSpeak(item))return true;this.statusChanged('error');return false;}
 }
 repeat(){if(!this.current||!this.canSpeak())return false;return this.request({...this.current,preview:false});}
 preview(lang='ru'){const language=lang==='ru'?'ru':'en';return this.request({text:choose(language,'Ведущий на связи. Город засыпает. Пусть эта ночь раскроет новые тайны.','Your host is here. The city falls asleep. Let tonight reveal new secrets.'),lang:language,preview:true});}
 countdown(seconds){if(!this.current||!['night','day','vote'].includes(this.current.phase)||seconds>10||seconds<=3||this.warningKey===this.current.key||!this.canSpeak()||this.pending||this.synth?.speaking||this.synth?.pending||this.fallback?.speaking)return false;this.warningKey=this.current.key;return this.request({text:choose(this.current.lang,'Время заканчивается. Завершайте ход.','Time is running out. Finish your action.'),lang:this.current.lang,preview:false});}
 stop(){this.cancel();this.current=null;this.lastKey='';this.warningKey='';}
 destroy(){this.stop();this.fallback?.destroy();if(this.nativeSupported)this.synth.removeEventListener?.('voiceschanged',this.voicesChanged);}
}
return {HostNarrator,publicAnnouncement,normalizeSettings};
});
