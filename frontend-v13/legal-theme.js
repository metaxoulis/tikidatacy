/* Tiki-Data legal pages: apply the theme saved by mobile-ui.js (key td-theme, dark by default)
   and add the same light / dark toggle to the page header. Loaded in <head> so there is no flash. */
(function () {
  var KEY = 'td-theme';
  var root = document.documentElement;

  function saved() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function apply(theme) {
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#06080d' : '#ffffff');
    var btn = document.querySelector('.td-theme-toggle');
    if (btn) {
      var english = root.lang !== 'el';
      var label = theme === 'dark'
        ? (english ? 'Switch to light mode' : 'Φωτεινό θέμα')
        : (english ? 'Switch to dark mode' : 'Σκοτεινό θέμα');
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      btn.setAttribute('aria-label', label);
      btn.title = label;
    }
  }

  apply(saved() || 'dark');

  var ICON =
    '<svg class="td-icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z"/></svg>' +
    '<svg class="td-icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"/></svg>';

  function mount() {
    var back = document.querySelector('header .back');
    if (!back || document.querySelector('.td-theme-toggle')) return;
    var actions = document.createElement('div');
    actions.className = 'legal-actions';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'td-theme-toggle';
    btn.innerHTML = ICON;
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch (e) {}
      apply(next);
    });
    back.parentNode.insertBefore(actions, back);
    actions.appendChild(btn);
    actions.appendChild(back);
    apply(root.getAttribute('data-theme'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
