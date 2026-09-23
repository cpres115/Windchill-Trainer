(function () {
  'use strict';

  // ---- Confirm dialogs for destructive forms --------------------------------
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.confirm(form.dataset.confirm)) e.preventDefault();
    });
  });

  // ---- Search-as-you-type suggestions ---------------------------------------
  document.querySelectorAll('input[data-suggest]').forEach(function (input) {
    var box = input.parentElement.querySelector('.suggest');
    var timer, controller, active = -1;

    function hide() { box.hidden = true; active = -1; }
    function links() { return box.querySelectorAll('a'); }
    function setActive(i) {
      var items = links();
      items.forEach(function (a) { a.classList.remove('active'); });
      if (i >= 0 && i < items.length) items[i].classList.add('active');
      active = i;
    }

    input.addEventListener('input', function () {
      clearTimeout(timer);
      var q = input.value.trim();
      if (q.length < 2) return hide();
      timer = setTimeout(function () {
        if (controller) controller.abort();
        controller = new AbortController();
        fetch('/api/search?q=' + encodeURIComponent(q), { signal: controller.signal, headers: { Accept: 'application/json' } })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            box.replaceChildren();
            (data.results || []).forEach(function (r) {
              var a = document.createElement('a');
              a.href = '/pages/' + r.slug;
              a.textContent = r.title;
              var small = document.createElement('small');
              small.textContent = r.category + (r.summary ? ' — ' + r.summary : '');
              a.appendChild(small);
              box.appendChild(a);
            });
            box.hidden = !box.children.length;
            active = -1;
          })
          .catch(function () {});
      }, 150);
    });

    input.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      var items = links();
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(active + 1, items.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(active - 1, -1)); }
      else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); window.location = items[active].href; }
      else if (e.key === 'Escape') hide();
    });
    input.addEventListener('blur', function () { setTimeout(hide, 150); });
  });

  // ---- Home page: instant filter of the full page list ----------------------
  var list = document.querySelector('[data-page-list]');
  if (list) {
    var filter = list.querySelector('[data-filter]');
    var noMatch = list.querySelector('[data-no-match]');
    var show = 'all';

    var apply = function () {
      var words = filter.value.toLowerCase().split(/\s+/).filter(Boolean);
      var visibleTotal = 0;
      list.querySelectorAll('[data-group]').forEach(function (group) {
        var visible = 0;
        group.querySelectorAll('.page-row').forEach(function (row) {
          var ok = (show === 'all' || row.dataset.status !== 'read') &&
            words.every(function (w) { return row.dataset.text.indexOf(w) !== -1; });
          row.hidden = !ok;
          if (ok) visible++;
        });
        group.hidden = !visible;
        visibleTotal += visible;
      });
      noMatch.hidden = visibleTotal > 0;
      noMatch.querySelector('[data-search-link]').href = '/search?q=' + encodeURIComponent(filter.value);
    };

    filter.addEventListener('input', apply);
    list.querySelectorAll('[data-show]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        show = btn.dataset.show;
        list.querySelectorAll('[data-show]').forEach(function (b) { b.setAttribute('aria-selected', String(b === btn)); });
        apply();
      });
    });
  }

  // ---- Page editor ----------------------------------------------------------
  var form = document.querySelector('form[data-editor]');
  if (!form) return;

  var csrf = form.dataset.csrf;
  var textarea = form.querySelector('[data-body]');
  var preview = form.querySelector('[data-preview]');
  var panes = form.querySelector('.editor-panes');
  var dirty = false;
  var previewTimer;

  function refreshPreview() {
    fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, Accept: 'application/json' },
      body: JSON.stringify({ body: textarea.value }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) { preview.innerHTML = data.html || '<p class="muted">Nothing to preview yet.</p>'; })
      .catch(function () {});
  }

  function changed() {
    dirty = true;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(refreshPreview, 300);
  }

  textarea.addEventListener('input', changed);
  form.querySelectorAll('input').forEach(function (el) { el.addEventListener('input', function () { dirty = true; }); });
  form.addEventListener('submit', function () { dirty = false; });
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  refreshPreview();

  // View tabs
  form.querySelectorAll('[data-view]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      panes.dataset.paneView = btn.dataset.view;
      form.querySelectorAll('[data-view]').forEach(function (b) { b.setAttribute('aria-selected', String(b === btn)); });
    });
  });

  // Insert text at the cursor, optionally wrapping the current selection.
  function insert(before, after, placeholder) {
    var start = textarea.selectionStart, end = textarea.selectionEnd;
    var hadSelection = end > start;
    var selected = textarea.value.slice(start, end) || placeholder || '';
    textarea.focus();
    textarea.setRangeText(before + selected + (after || ''), start, end, 'end');
    if (!hadSelection && placeholder) {
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    }
    changed();
  }

  function atLineStart() {
    var pos = textarea.selectionStart;
    return pos === 0 || textarea.value[pos - 1] === '\n' ? '' : '\n';
  }

  var actions = {
    heading: function () { insert(atLineStart() + '## ', '', 'Section heading'); },
    bold: function () { insert('**', '**', 'bold text'); },
    italic: function () { insert('_', '_', 'italic text'); },
    ol: function () { insert(atLineStart() + '1. ', '\n2. \n3. ', 'First step'); },
    ul: function () { insert(atLineStart() + '- ', '', 'List item'); },
    link: function () { insert('[', '](/pages/page-name)', 'link text'); },
    code: function () { insert('`', '`', 'code'); },
    tip: function () { insert(atLineStart() + '> **Tip:** ', '', 'Helpful hint for the reader.'); },
    table: function () { insert(atLineStart() + '| Column | Description |\n| --- | --- |\n| ', ' | |\n', 'Value'); },
  };
  form.querySelectorAll('[data-md]').forEach(function (btn) {
    btn.addEventListener('click', function () { actions[btn.dataset.md](); });
  });

  // Image upload: toolbar button, paste, or drag & drop into the text box.
  function uploadImage(file) {
    if (!file || !/^image\/(png|jpeg|gif|webp)$/.test(file.type)) return;
    var marker = '![Uploading ' + (file.name || 'image') + '…]()';
    insert(atLineStart() + marker + '\n', '', '');
    var data = new FormData();
    data.append('image', file, file.name || 'screenshot.png');
    fetch('/api/images', { method: 'POST', headers: { 'X-CSRF-Token': csrf, Accept: 'application/json' }, body: data })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        textarea.value = textarea.value.replace(marker, res.markdown || '');
        if (res.error) window.alert(res.error);
        changed();
      })
      .catch(function () {
        textarea.value = textarea.value.replace(marker, '');
        window.alert('Image upload failed.');
      });
  }

  form.querySelector('[data-upload]').addEventListener('change', function (e) {
    uploadImage(e.target.files[0]);
    e.target.value = '';
  });
  textarea.addEventListener('paste', function (e) {
    var item = Array.prototype.find.call(e.clipboardData.items || [], function (i) { return i.type.indexOf('image/') === 0; });
    if (item) { e.preventDefault(); uploadImage(item.getAsFile()); }
  });
  textarea.addEventListener('dragover', function (e) { e.preventDefault(); textarea.classList.add('dragover'); });
  textarea.addEventListener('dragleave', function () { textarea.classList.remove('dragover'); });
  textarea.addEventListener('drop', function (e) {
    textarea.classList.remove('dragover');
    var files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) { e.preventDefault(); Array.prototype.forEach.call(files, uploadImage); }
  });
})();
