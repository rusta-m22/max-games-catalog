'use strict';
(() => {
  const canvas = document.getElementById('canvas');
  const status = document.getElementById('status');
  let sdk, readyRequested = false, readySent = false, readyScheduled = false, playing = false, adOpen = false;
  const pauses = new Set();
  window.__platform_paused = false;
  window.__yandex_sdk_ready = false;
  window.__yandex_rewarded = false;
  window.__yandex_ad_failed = false;
  window.__yandex_ad_closed = false;
  let roundNumber = 0;
  const launchId = Date.now().toString(36);
  window.JarvisGameRoundEnded = () => window.JarvisAdsReady?.then(ads => ads.afterRound({
    gameId: 'bumbila', roundId: `${launchId}-${++roundNumber}`, placement: 'round-end'
  }));
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  function syncGameplay() {
    if (!sdk || !readySent) return;
    const active = playing && !pauses.size;
    if (active === syncGameplay.active) return;
    syncGameplay.active = active;
    try { sdk.features.GameplayAPI?.[active ? 'start' : 'stop'](); } catch (e) { console.warn(e); }
  }
  function pause(reason, value) {
    if (value) pauses.add(reason); else pauses.delete(reason);
    window.__platform_paused = pauses.size > 0;
    if (value) releaseAll();
    syncGameplay();
  }
  window.yandexGameReady = () => {
    readyRequested = true;
    if (!sdk || readySent || readyScheduled) return;
    readyScheduled = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      status.hidden = true;
      sdk.features.LoadingAPI.ready();
      readySent = true;
      syncGameplay();
    }));
  };
  window.yandexGameplayStart = () => { playing = true; syncGameplay(); };
  window.yandexGameplayStop = () => { playing = false; syncGameplay(); };
  window.yandexShowRewarded = () => {
    if (adOpen) return;
    window.__yandex_rewarded = false;
    window.__yandex_ad_failed = false;
    window.__yandex_ad_closed = false;
    if (!sdk) { window.__yandex_ad_failed = true; return; }
    adOpen = true;
    pause('ad', true);
    const finish = () => { adOpen = false; pause('ad', false); };
    try {
      sdk.adv.showRewardedVideo({callbacks: {
        onOpen: () => pause('ad', true),
        onRewarded: () => { window.__yandex_rewarded = true; },
        onClose: () => { window.__yandex_ad_closed = true; finish(); },
        onError: e => { console.warn('Rewarded ad:', e); window.__yandex_ad_failed = true; finish(); }
      }});
    } catch (e) { window.__yandex_ad_failed = true; finish(); console.warn(e); }
  };
  const keys = {up:['ArrowUp','ArrowUp',38],down:['ArrowDown','ArrowDown',40],left:['ArrowLeft','ArrowLeft',37],right:['ArrowRight','ArrowRight',39],bomb:[' ','Space',32],restart:['r','KeyR',82]};
  const held = new Map();
  function emit(action, down) {
    const [key, code, keyCode] = keys[action];
    canvas.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', {key,code,keyCode,which:keyCode,bubbles:true,cancelable:true}));
  }
  function release(id) {
    const action = held.get(id);
    if (!action) return;
    held.delete(id);
    if (![...held.values()].includes(action)) {
      emit(action, false);
      document.querySelector(`[data-action="${action}"]`).classList.remove('pressed');
    }
  }
  function releaseAll() { for (const id of [...held.keys()]) release(id); }
  for (const button of document.querySelectorAll('[data-action]')) {
    button.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (window.__platform_paused || !status.hidden) return;
      const action = button.dataset.action;
      canvas.focus({preventScroll:true});
      button.setPointerCapture(e.pointerId);
      const already = [...held.values()].includes(action);
      held.set(e.pointerId, action);
      button.classList.add('pressed');
      if (!already) emit(action, true);
    });
    for (const event of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(event, e => release(e.pointerId));
    button.addEventListener('contextmenu', e => e.preventDefault());
  }
  document.addEventListener('visibilitychange', () => pause('hidden', document.hidden));
  window.addEventListener('blur', () => pause('blur', true));
  window.addEventListener('focus', () => pause('blur', false));
  window.addEventListener('pagehide', releaseAll);
  canvas.addEventListener('pointerdown', () => canvas.focus({preventScroll:true}));
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('keydown', e => { if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault(); });
  function layout() {
    const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 || sdk?.deviceInfo?.isMobile?.() || sdk?.deviceInfo?.isTablet?.();
    document.body.classList.toggle('touch', !!touch);
    const landscape = touch && innerWidth > innerHeight && innerWidth >= 600;
    document.body.classList.toggle('landscape', !!landscape);
    const controls = touch && !landscape ? 158 : 0;
    const scale = Math.max(0.1, Math.min((innerWidth - (landscape ? 320 : 0)) / 720, (innerHeight - controls) / 694));
    canvas.style.width = `${Math.floor(720 * scale)}px`;
    canvas.style.height = `${Math.floor(694 * scale)}px`;
  }
  window.addEventListener('resize', layout);
  layout();
  async function start() {
    try {
      if (typeof JarvisLegacyPlatform !== 'undefined') {
        const originalInit = JarvisLegacyPlatform.init.bind(JarvisLegacyPlatform);
        let initialization;
        JarvisLegacyPlatform.init = (...args) => initialization || (initialization = originalInit(...args));
        sdk = await JarvisLegacyPlatform.init();
        window.ysdk = window.__yandex_sdk = sdk;
        window.__yandex_sdk_ready = true;
        const lang = sdk.environment?.i18n?.lang || 'ru';
        document.documentElement.lang = lang;
        if (lang !== 'ru') {
          document.getElementById('bomb').textContent = 'BOMB';
          document.getElementById('restart').textContent = 'RESTART';
          status.textContent = 'Loading game…';
        }
        sdk.on?.('game_api_pause', () => pause('platform', true));
        sdk.on?.('game_api_resume', () => pause('platform', false));
      } else if (local) {
        window.__yandex_sdk_ready = true;
        console.warn('Local preview: Yandex SDK is unavailable.');
      } else throw new Error('Не удалось загрузить игровой модуль. Обновите страницу.');
      layout();
      const engine = new Engine({args:[],canvas,canvasResizePolicy:0,executable:'index',fileSizes:{'index.pck':106252,'index.wasm':39514754},focusCanvas:true,gdextensionLibs:[],onProgress:(current,total)=>{if(total)status.textContent=`Загрузка / Loading: ${Math.round(current/total*100)}%`;}});
      window.engine = engine;
      await engine.startGame();
      if (local && !sdk) status.hidden = true;
      if (readyRequested && sdk) window.yandexGameReady();
    } catch (e) {
      console.error(e);
      status.hidden = false;
      status.textContent = `Ошибка запуска / Launch error: ${e.message || e}`;
    }
  }
  start();
})();
