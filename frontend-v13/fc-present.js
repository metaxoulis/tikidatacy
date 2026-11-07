/* Google Privacy & messaging: tells the consent message script that the page carries it (Google's standard
   snippet, kept in a file so the Content-Security-Policy needs no inline scripts). */
(function () {
  function signalGooglefcPresent() {
    if (!window.frames['googlefcPresent']) {
      if (document.body) {
        var iframe = document.createElement('iframe');
        iframe.style = 'width: 0; height: 0; border: none; z-index: -1000; left: -1000px; top: -1000px;';
        iframe.style.display = 'none';
        iframe.name = 'googlefcPresent';
        document.body.appendChild(iframe);
      } else {
        setTimeout(signalGooglefcPresent, 0);
      }
    }
  }
  signalGooglefcPresent();
})();


// Wait for Google's CMP to resolve regional applicability and the visitor's choice.
(function () {
  var fc = window.googlefc = window.googlefc || {};
  fc.callbackQueue = fc.callbackQueue || [];
  var started = false;
  fc.callbackQueue.push({ CONSENT_API_READY: function () {
    if (typeof window.__tcfapi !== 'function') return;
    window.__tcfapi('addEventListener', 2, function (data, success) {
      if (!success || !data || data.cmpStatus !== 'loaded') return;
      if (data.eventStatus !== 'tcloaded' && data.eventStatus !== 'useractioncomplete') return;
      var allowed = data.gdprApplies === false || (data.gdprApplies === true &&
        data.purpose?.consents?.[1] === true && data.vendor?.consents?.[755] === true);
      if (started && !allowed) { window.location.reload(); return; }
      if (!allowed || started) return;
      var publisher = document.querySelector('meta[name="google-adsense-account"]');
      if (!publisher || !/^ca-pub-[0-9]+$/.test(publisher.content)) return;
      started = true;
      var script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + publisher.content;
      document.head.appendChild(script);
    });
  }});
})();
