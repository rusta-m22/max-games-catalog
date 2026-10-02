/* Shared connection and invitation rules. No network scanning. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MafiaConnection=factory();})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const VERSION='1.7.0';
function ipv4(host){return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)&&host.split('.').every(n=>Number(n)<=255);}
function loopback(host){return host==='localhost'||host==='[::1]'||host==='::1'||(ipv4(host)&&host.startsWith('127.'));}
function serverFor(mode,location,config,session){if(session?.server)return session.server.replace(/\/$/,'');return config.server.replace(/\/$/,'');}
function invitations(base,code){if(!/^\d{6}$/.test(code))return [];try{const u=new URL('/',base);if(!['http:','https:'].includes(u.protocol)||loopback(u.hostname))return [];u.searchParams.set('room',code);u.searchParams.set('mode','online');return [u.href];}catch{return [];}}
class Diagnostics{
 constructor(target,onChange=()=>{}){this.blocked=new Set();this.listener=e=>{if(e.disposition==='report'||!['connect-src','default-src'].includes(e.effectiveDirective))return;try{const origin=new URL(e.blockedURI).origin;this.blocked.add(origin);onChange(origin);}catch{}};target?.addEventListener?.('securitypolicyviolation',this.listener);}
 blockedFor(base){try{return this.blocked.has(new URL(base).origin);}catch{return false;}}
 classify(error,base){if(this.blockedFor(base))return 'networkBlocked';if(error?.name==='AbortError')return 'serverTimeout';return 'network';}
}
return {VERSION,serverFor,invitations,Diagnostics};
});
