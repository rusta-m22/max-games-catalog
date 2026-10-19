'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('Native',Object.freeze({bootstrap:()=>ipcRenderer.sendSync('nono:bootstrap'),save:value=>ipcRenderer.sendSync('nono:save',value),api:(route,payload)=>ipcRenderer.invoke('nono:api',route,payload),purchase:(product,requestId)=>ipcRenderer.invoke('nono:purchase',product,requestId)}));
