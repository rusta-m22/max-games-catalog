'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('Native',Object.freeze({bootstrap:()=>ipcRenderer.sendSync('nono:bootstrap'),save:value=>ipcRenderer.sendSync('nono:save',value),api:(route,payload)=>ipcRenderer.invoke('nono:api',route,payload),quit:()=>ipcRenderer.invoke('nono:quit'),checkPurchase:(product,requestId)=>ipcRenderer.invoke('nono:check-purchase',product,requestId),purchase:(product,requestId)=>ipcRenderer.invoke('nono:purchase',product,requestId)}));

