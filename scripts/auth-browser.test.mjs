import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const window = {};
runInNewContext(readFileSync(new URL('../js/auth-browser.js', import.meta.url), 'utf8'), { window, URL });
const browser = window.TD_AuthBrowser;
const androidChrome = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const iosBase = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)';
const packageIds = ['1', '2', '3', '4', '5'];

for (const [name, userAgent] of [
  ['Android Chrome', androidChrome],
  ['iOS Safari', `${iosBase} Version/18.6 Mobile/15E148 Safari/604.1`],
  ['iOS Chrome', `${iosBase} CriOS/141.0.0.0 Mobile/15E148 Safari/604.1`],
  ['iOS Firefox', `${iosBase} FxiOS/143.0 Mobile/15E148`],
  ['iOS Edge', `${iosBase} EdgiOS/141.0 Mobile/15E148`],
  ['iOS Opera', `${iosBase} OPT/5.2 Mobile/15E148`],
  ['Samsung Internet', `${androidChrome} SamsungBrowser/28.0`],
  ['desktop Chrome', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'],
  ['desktop Firefox', 'Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0']
]) {
  test(`${name} keeps the normal Google sign-in flow`, () => {
    assert.equal(browser.detect(userAgent).embedded, false);
  });
}

for (const [app, userAgent] of [
  ['Instagram', `${iosBase} Mobile/15E148 Instagram 400.0.0.0`],
  ['Instagram', `${androidChrome} Instagram 400.0.0.0 Android`],
  ['LINE', `${iosBase} Version/18.6 Mobile/15E148 Safari/604.1 Line/15.10.0`],
  ['LINE', `${androidChrome} Line/15.10.0`],
  ['Facebook', `${iosBase} Mobile/15E148 [FBAN/FBIOS;FBAV/500.0.0.0]`],
  ['Messenger', `${androidChrome} [FB_IAB/MESSENGER;FBAV/500.0.0.0]`],
  ['TikTok', `${iosBase} Mobile/15E148 BytedanceWebview/1.0 musical_ly_202510`],
  ['WeChat', `${androidChrome} MicroMessenger/8.0.0`],
  ['Snapchat', `${iosBase} Snapchat/13.0.0`]
]) {
  test(`${app} embedded browser offers the handoff`, () => {
    const detected = browser.detect(userAgent);
    assert.equal(detected.embedded, true);
    assert.equal(detected.app, app);
  });
}

test('unbranded Android and iOS WebViews offer browser help', () => {
  assert.equal(browser.detect(androidChrome.replace('Pixel 9)', 'Pixel 9; wv)')).embedded, true);
  assert.equal(browser.detect(`${iosBase} Mobile/15E148`).embedded, true);
});

test('the handoff keeps the same origin and path and strips account data and tokens', () => {
  const url = new URL(browser.signInUrl('https://user:password@triamdod.com/index.html?credential=secret&email=buyer@example.com#private'));
  assert.equal(url.origin, 'https://triamdod.com');
  assert.equal(url.pathname, '/index.html');
  assert.equal(url.username, '');
  assert.equal(url.password, '');
  assert.equal(url.search, '?login=1');
  assert.equal(url.hash, '');
  assert.equal(new URL(browser.signInUrl('https://triamdod.com//other.example/path')).origin, 'https://triamdod.com');
});

test('LINE offers its documented external-browser link on Android and iOS', () => {
  for (const userAgent of [`${iosBase} Line/15.10.0`, `${androidChrome} Line/15.10.0`]) {
    const external = new URL(browser.externalUrl('https://triamdod.com/?login=1', browser.detect(userAgent)));
    assert.equal(external.protocol, 'https:');
    assert.equal(external.searchParams.get('login'), '1');
    assert.equal(external.searchParams.get('openExternalBrowser'), '1');
  }
});

test('Android intent and its fallback both retain the requested package, color and size', () => {
  const signInLink = browser.signInUrl('https://triamdod.com/', { packageId: '3', color: 'beige', size: '2XL' });
  const intent = browser.externalUrl(signInLink, browser.detect(`${androidChrome} Instagram`));
  assert.ok(intent.startsWith('intent://triamdod.com/?login=1&package=3&color=beige&size=2XL#Intent;scheme=https;'));
  assert.ok(intent.includes('package=com.android.chrome;'));
  const fallback = intent.match(/S\.browser_fallback_url=([^;]+);end$/)?.[1];
  assert.equal(decodeURIComponent(fallback), signInLink);
  assert.equal(browser.externalUrl('http://localhost:3000/?login=1', { android: true }).includes('scheme=http;'), true);
});

test('iOS Instagram uses menu and copying instructions without an unsupported launch link', () => {
  assert.equal(browser.externalUrl('https://triamdod.com/?login=1', browser.detect(`${iosBase} Instagram`)), null);
});

test('external-browser links reject executable schemes', () => {
  assert.equal(browser.externalUrl('javascript:alert(1)', { android: true }), null);
});

test('continuation restores public choices once and cleans up the launch flags', () => {
  const resumed = browser.readSignIn('https://triamdod.com/?login=1&package=4&color=beige&size=XL&openExternalBrowser=1&utm_source=line', packageIds);
  assert.deepEqual({ ...resumed.selection }, { packageId: '4', color: 'beige', size: 'XL' });
  assert.equal(resumed.pageUrl, 'https://triamdod.com/?utm_source=line');
  assert.equal(browser.readSignIn(resumed.pageUrl, packageIds), null);
});

test('invalid URL choices cannot create a package or inject color and size', () => {
  assert.equal(browser.readSignIn('https://triamdod.com/?login=1&package=99', packageIds).selection, null);
  const resumed = browser.readSignIn('https://triamdod.com/?login=1&package=3&color=red&size=invalid', packageIds);
  assert.deepEqual({ ...resumed.selection }, { packageId: '3', color: 'brown', size: 'L' });
});

test('opening an ordinary shared LINE link does not automatically open sign-in', () => {
  assert.equal(browser.readSignIn('https://triamdod.com/?openExternalBrowser=1', packageIds), null);
});
