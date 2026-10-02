/* Keep existing controls connected while room polls update text and attributes. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MafiaDOM=factory();})(globalThis,function(){
'use strict';
function key(node){
 if(node.nodeType!==1)return '';
 if(node.id)return '#'+node.id;
 const action=node.getAttribute('data-do');
 return action?node.nodeName+':'+action+':'+['data-target','data-clip','data-code','data-mode','data-channel','data-text'].map(k=>node.getAttribute(k)||'').join('|'):'';
}
function same(a,b){return a&&a.nodeType===b.nodeType&&a.nodeName===b.nodeName&&key(a)===key(b);}
function patch(current,next){
 if(current.nodeType!==1){if(current.nodeValue!==next.nodeValue)current.nodeValue=next.nodeValue;return;}
 for(const attr of [...current.attributes])if(!next.hasAttribute(attr.name))current.removeAttribute(attr.name);
 for(const attr of [...next.attributes])if(current.getAttribute(attr.name)!==attr.value)current.setAttribute(attr.name,attr.value);
 children(current,next);
}
function children(current,next){
 let cursor=current.firstChild;
 for(const fresh of [...next.childNodes]){
  let existing=cursor;
  if(!same(existing,fresh)){
   const wanted=key(fresh);
   existing=wanted?[...current.childNodes].find(n=>key(n)===wanted&&same(n,fresh)):null;
   if(existing)current.insertBefore(existing,cursor);
   else{existing=fresh.cloneNode(true);current.insertBefore(existing,cursor);}
  }
  patch(existing,fresh);cursor=existing.nextSibling;
 }
 while(cursor){const next=cursor.nextSibling;current.removeChild(cursor);cursor=next;}
}
function render(container,html){const next=container.ownerDocument.createElement('div');next.innerHTML=html;children(container,next);}
return {render};
});
