export function detectPlatform(env=globalThis,config={}){
 const loc=env.location||{},params=new URLSearchParams((loc.search||'')+'&'+String(loc.hash||'').replace(/^#/,''));
 const max=!!env.WebApp?.initData||params.has('WebAppData')||params.has('WebAppPlatform')||params.has('WebAppStartParam')||/(^|\.)max\.ru$/i.test(loc.hostname||'');
 // MAX always wins over a build hint, SDK global or launch parameters.
 if(max||config.platform==='max')return 'max';
 if(['yandex','vk','web'].includes(config.platform))return config.platform;
 if(env.__JARVIS_REAL_YANDEX__||env.YaGames&&!env.YaGames.__jarvisCompat||env.__JARVIS_YSDK__||/(^|\.)(yandex\.(ru|com|net)|games\.s3\.yandex\.net)$/i.test(loc.hostname||''))return 'yandex';
 if(params.has('vk_app_id')&&params.has('vk_user_id')||params.has('vk_platform')||env.vkBridge?.isWebView?.())return 'vk';
 return 'web';
}
