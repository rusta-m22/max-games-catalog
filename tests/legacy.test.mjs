import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source=readFileSync(new URL('../site/legacy-platform.js',import.meta.url),'utf8');
test('Legacy facade hides unavailable offers and never invents a reward',async()=>{
 const dom=new JSDOM('<html><head></head><body><button data-action="reward-hint">Video</button></body></html>',{url:'https://example.test/games/quiz/',runScripts:'outside-only'});
 const w=dom.window;w.JarvisAdsReady=Promise.resolve({info:()=>({capabilities:{rewarded:false}}),rewarded:async()=>({shown:false,rewarded:false,reason:'max-disabled'}),afterRound:async()=>({shown:false}),getPlatformSdk:()=>null});w.matchMedia=()=>({matches:false});w.eval(source);const api=await w.JarvisLegacyPlatform.init();let granted=0,closed=0,errors=0;
 await api.adv.showRewardedVideo({callbacks:{onRewarded(){granted++;},onClose(){closed++;},onError(){errors++;}}});assert.equal(granted,0);assert.equal(closed,1);assert.equal(errors,1);assert.equal(w.getComputedStyle(w.document.querySelector('button')).display,'none');
 const player=await api.getPlayer();await player.setData({score:10});assert.equal((await player.getData()).score,10);dom.window.close();
});
test('Legacy reward callback fires exactly once after confirmed success',async()=>{
 const dom=new JSDOM('<html><head></head><body></body></html>',{url:'https://example.test/games/quiz/',runScripts:'outside-only'});const w=dom.window;
 w.JarvisAdsReady=Promise.resolve({info:()=>({capabilities:{rewarded:true}}),rewarded:async()=>({shown:true,rewarded:true})});w.eval(source);const api=await w.JarvisLegacyPlatform.init(),events=[];
 await api.adv.showRewardedVideo({callbacks:{onRewarded(){events.push('reward');},onClose(){events.push('close');}}});assert.deepEqual(events,['reward','close']);assert(!w.document.documentElement.classList.contains('jarvis-no-rewarded'));dom.window.close();
});
