import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.wasm':'application/wasm','.pck':'application/octet-stream','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.ttf':'font/ttf','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.gz':'application/gzip','.zip':'application/zip'};
const root=await realpath(fileURLToPath(new URL('./site/',import.meta.url)));
export const server=http.createServer(async(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
 try{
  let requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(requested.includes('\0')||requested.includes('\\'))throw Error('Invalid path');
  let target=path.resolve(root,'.'+requested);
  if(target!==root&&!target.startsWith(root+path.sep))throw Error('Invalid path');
  let info=await stat(target);if(info.isDirectory()){target=path.join(target,'index.html');info=await stat(target);}
  target=await realpath(target);if(!target.startsWith(root+path.sep)||!info.isFile())throw Error('Not found');
  const headers={'Content-Type':mime[path.extname(target)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'};
  if(requested.startsWith('/shared/ads/'))headers['Access-Control-Allow-Origin']='*';
  res.writeHead(200,headers);if(req.method==='HEAD')res.end();else createReadStream(target).on('error',()=>res.destroy()).pipe(res);
 }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Файл не найден');}
});
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))server.listen(Number(process.env.PORT)||8080,'127.0.0.1',()=>console.log(`Откройте http://127.0.0.1:${server.address().port}/ — Ctrl+C для остановки`));
