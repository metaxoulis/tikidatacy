/* Tiki-Data cookie information panel. Advertising consent is handled ONLY by Google's certified CMP. */
(function () {
  'use strict';
  var KEY = 'tiki.cookie.notice.seen.v1';
  var words = {
    el: {
      toggle: 'Cookies', title: 'Cookies και απόρρητο',
      info: 'Το Tiki-Data χρησιμοποιεί απαραίτητη αποθήκευση για τη λειτουργία του. Οι επιλογές για cookies διαφήμισης γίνονται αποκλειστικά στο πιστοποιημένο μήνυμα συναίνεσης της Google.',
      manage: 'Ρυθμίσεις συναίνεσης', close: 'Κλείσιμο',
      unavailable: 'Οι ρυθμίσεις συναίνεσης της Google δεν είναι διαθέσιμες αυτή τη στιγμή. Δείτε την Πολιτική Cookies ή δοκιμάστε ξανά αργότερα.',
      cookies: 'Πολιτική Cookies', privacy: 'Απόρρητο'
    },
    en: {
      toggle: 'Cookies', title: 'Cookies and privacy',
      info: 'Tiki-Data uses essential browser storage to operate. Advertising-cookie choices are managed only through Google’s certified consent message.',
      manage: 'Consent preferences', close: 'Close',
      unavailable: 'Google consent settings are currently unavailable. See our Cookie Policy or try again later.',
      cookies: 'Cookie Policy', privacy: 'Privacy'
    }
  };
  function language() {
    try {
      var saved = localStorage.getItem('tiki.interface.language.v1');
      if (saved === 'el' || saved === 'en') return saved;
    } catch (_) {}
    return (document.documentElement.lang || '').toLowerCase().indexOf('el') === 0 ? 'el' : 'en';
  }
  function seen() { try { return sessionStorage.getItem(KEY) === '1'; } catch (_) { return false; } }
  function markSeen() { try { sessionStorage.setItem(KEY, '1'); } catch (_) {} }
  function create(tag, className, textValue) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (textValue !== undefined) el.textContent = textValue;
    return el;
  }
  function boot() {
    if (document.getElementById('td-cookie-control')) return;
    var tr = words[language()];
    var style = create('style');
    style.textContent = '#td-cookie-control{position:fixed;bottom:16px;left:16px;z-index:2147483000;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#eef7ff}' +
      '#td-cookie-control *{box-sizing:border-box}' +
      '#td-cookie-control .tdc-toggle{border:1px solid #426c86;background:#10263a;color:#f3ffff;border-radius:99px;padding:10px 15px;cursor:pointer;box-shadow:0 7px 24px #0005;font-size:13px;font-weight:700}' +
      '#td-cookie-control .tdc-panel{position:absolute;left:0;bottom:50px;width:min(360px,calc(100vw - 32px));background:#101c2b;color:#f0f6fb;border:1px solid #355368;border-radius:16px;padding:20px;box-shadow:0 16px 60px #0009;line-height:1.5}' +
      '#td-cookie-control .tdc-panel[hidden]{display:none}' +
      '#td-cookie-control h2{font-size:19px;color:#fff;margin:0 0 10px;line-height:1.25}' +
      '#td-cookie-control p{font-size:13px;margin:0 0 13px;color:#d0dce7}' +
      '#td-cookie-control a{color:#7de8de;font-size:12px;text-decoration:underline}' +
      '#td-cookie-control .tdc-links{display:flex;gap:14px;flex-wrap:wrap;margin:4px 0 18px}' +
      '#td-cookie-control .tdc-actions{display:flex;gap:8px;flex-wrap:wrap}' +
      '#td-cookie-control .tdc-actions button{border-radius:8px;padding:10px 12px;font:700 13px Arial,Helvetica,sans-serif;cursor:pointer}' +
      '#td-cookie-control .tdc-manage{background:#6be3d6;color:#052333;border:0}' +
      '#td-cookie-control .tdc-close{background:transparent;color:#eef7ff;border:1px solid #637586}' +
      '#td-cookie-control .tdc-status{color:#ffd3a5;margin-top:13px}' +
      'html[data-theme="light"] #td-cookie-control .tdc-panel{background:#fff;color:#173049;border-color:#c8d6e0;box-shadow:0 16px 55px #253c522b}' +
      'html[data-theme="light"] #td-cookie-control h2{color:#10243a}' +
      'html[data-theme="light"] #td-cookie-control p{color:#415a70}' +
      'html[data-theme="light"] #td-cookie-control .tdc-close{color:#173049;border-color:#a6bbcb}' +
      'html[data-theme="light"] #td-cookie-control .tdc-status{color:#8e4d11}' +
      '@media(max-width:768px){#td-cookie-control{position:relative;bottom:auto;left:auto;width:auto;max-width:100%;display:flex;justify-content:flex-end;margin:12px 0 22px;padding:0 12px}' +
      '#td-cookie-control .tdc-toggle{background:transparent;color:inherit;border:1px solid currentColor;box-shadow:none;border-radius:8px;padding:7px 10px;font-size:12px}' +
      '#td-cookie-control .tdc-panel{position:fixed;top:calc((100dvh - 104px)/2);bottom:auto;left:50%;transform:translate(-50%,-50%);width:min(360px,calc(100vw - 24px));max-height:calc(100dvh - 128px - env(safe-area-inset-bottom,0px));overflow-y:auto;overscroll-behavior:contain;z-index:2147483000}' +
      'html[data-theme="light"] #td-cookie-control .tdc-toggle{color:#21405a;border-color:#b2c3d2}}';
    document.head.appendChild(style);
    var root = create('div');
    root.id = 'td-cookie-control';
    var toggle = create('button','tdc-toggle',tr.toggle);
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded','false');
    toggle.setAttribute('aria-controls','td-cookie-panel');
    var panel = create('section','tdc-panel');
    panel.id = 'td-cookie-panel';
    panel.hidden = true;
    panel.setAttribute('role','dialog');
    panel.setAttribute('aria-modal','false');
    panel.setAttribute('aria-labelledby','td-cookie-title');
    var heading = create('h2','',tr.title); heading.id = 'td-cookie-title';
    var info = create('p','',tr.info);
    var links = create('div','tdc-links');
    var cookieLink = create('a','',tr.cookies);cookieLink.href='/cookies';
    var privacyLink = create('a','',tr.privacy);privacyLink.href='/privacy';
    links.appendChild(cookieLink);links.appendChild(privacyLink);
    var actions = create('div','tdc-actions');
    var manage = create('button','tdc-manage',tr.manage);manage.type='button';
    var close = create('button','tdc-close',tr.close);close.type='button';
    actions.appendChild(manage);actions.appendChild(close);
    var status = create('p','tdc-status');status.hidden=true;status.setAttribute('role','status');
    panel.appendChild(heading);panel.appendChild(info);panel.appendChild(links);
    panel.appendChild(actions);panel.appendChild(status);
    root.appendChild(toggle);root.appendChild(panel);
    // Mobile: keep the cookie shortcut in the page footer, never over the bottom navigation.
    var mobileQuery=window.matchMedia&&window.matchMedia('(max-width: 768px)');
    function placeControl(){
      var target=mobileQuery&&mobileQuery.matches?(document.querySelector('footer')||document.querySelector('main')||document.body):document.body;
      if(root.parentNode!==target)target.appendChild(root);
    }
    placeControl();
    if(mobileQuery){
      if(typeof mobileQuery.addEventListener==='function')mobileQuery.addEventListener('change',placeControl);
      else if(typeof mobileQuery.addListener==='function')mobileQuery.addListener(placeControl);
    }
    function show() { panel.hidden=false;toggle.setAttribute('aria-expanded','true');status.hidden=true;manage.focus(); }
    function hide() { panel.hidden=true;toggle.setAttribute('aria-expanded','false');markSeen();try{toggle.focus({preventScroll:true});}catch(_){toggle.focus();} }
    toggle.addEventListener('click',function(){ if(panel.hidden)show();else hide(); });
    close.addEventListener('click',hide);
    manage.addEventListener('click',function(){
      var fc=window.googlefc;
      if(fc && typeof fc.showRevocationMessage==='function'){
        fc.callbackQueue=fc.callbackQueue||[];
        fc.callbackQueue.push(fc.showRevocationMessage);
        hide();
      }else{status.textContent=tr.unavailable;status.hidden=false;}
    });
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!panel.hidden)hide();});
    document.addEventListener('click',function(e){if(!panel.hidden&&!root.contains(e.target))hide();});
    // If Google's CMP is present, let its certified first-visit message take precedence.
    window.setTimeout(function(){
      if(!seen() && typeof window.__tcfapi!=='function' && !(window.googlefc && typeof window.googlefc.showRevocationMessage==='function'))show();
    },3500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();