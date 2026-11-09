/** Browser handoff for Google sign-in, which does not support embedded WebViews. */
(function () {
  'use strict';

  function detect(userAgent) {
    const apps = [
      ['Instagram', /\bInstagram\b/i],
      ['LINE', /\bLine\/[\d.]+/i],
      ['Messenger', /FB_IAB\/MESSENGER/i],
      ['Facebook', /\bFBAN\/|\bFBAV\//i],
      ['TikTok', /TikTok|BytedanceWebview|musical_ly|\btrill\//i],
      ['WeChat', /MicroMessenger/i],
      ['Snapchat', /Snapchat/i]
    ];
    const app = apps.find(([, pattern]) => pattern.test(userAgent))?.[0] || '';
    const android = /Android/i.test(userAgent);
    const ios = /iPhone|iPad|iPod/i.test(userAgent);
    const webview = (android && /;\s*wv\b/i.test(userAgent)) ||
      (ios && /AppleWebKit/i.test(userAgent) && !/Safari\/|CriOS\/|FxiOS\/|EdgiOS\/|OPiOS\/|OPT\/|DuckDuckGo\//i.test(userAgent));
    return { embedded: Boolean(app || webview), app, android, ios };
  }

  function signInUrl(pageUrl, selection) {
    // Carry only public navigation choices, never account data or credentials.
    const url = new URL(pageUrl);
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    url.searchParams.set('login', '1');
    if (selection?.packageId) {
      url.searchParams.set('package', selection.packageId);
      url.searchParams.set('color', selection.color === 'beige' ? 'beige' : 'brown');
      url.searchParams.set('size', ['S', 'M', 'L', 'XL', '2XL'].includes(selection.size) ? selection.size : 'L');
    }
    return url.href;
  }

  function externalUrl(signInLink, browser) {
    const url = new URL(signInLink);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    // LINE documents this parameter for opening ordinary links externally.
    if (browser.app === 'LINE') {
      url.searchParams.set('openExternalBrowser', '1');
      return url.href;
    }
    if (browser.android) {
      // A real anchor keeps the launch tied to the user's tap. If Chrome is not
      // installed, return to the help screen, which also supports manual copying.
      return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.slice(0, -1)};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url.href)};end`;
    }
    // iOS app WebViews can prevent external launches; show menu/copy steps.
    return null;
  }

  function readSignIn(pageUrl, packageIds) {
    const url = new URL(pageUrl);
    if (url.searchParams.get('login') !== '1') return null;
    const packageId = url.searchParams.get('package');
    const selection = packageIds.includes(packageId) ? {
      packageId,
      color: url.searchParams.get('color') === 'beige' ? 'beige' : 'brown',
      size: ['S', 'M', 'L', 'XL', '2XL'].includes(url.searchParams.get('size')) ? url.searchParams.get('size') : 'L'
    } : null;
    for (const key of ['login', 'package', 'color', 'size', 'openExternalBrowser']) url.searchParams.delete(key);
    return { pageUrl: url.href, selection };
  }

  window.TD_AuthBrowser = { detect, signInUrl, externalUrl, readSignIn };
})();
