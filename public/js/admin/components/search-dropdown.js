/**
 * SearchDropdown - Reusable search input + results list with optional avatar
 * Vanilla JS, no heavy deps. Use for customer/contact search with avatar/initials.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SearchDropdown = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function escapeHtml (str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function getInitials (name) {
    if (!name || !name.trim()) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2);
    }
    return name.slice(0, 2).toUpperCase();
  }

  function renderAvatar (item, size) {
    size = size || 24;
    const name = item.name || item.subtitle || '';
    const url = item.avatar_url || item.logo_url || null;
    if (url) {
      return '<img class="search-dropdown-avatar" src="' + escapeHtml(url) + '" alt="" width="' + size + '" height="' + size + '" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';" />' +
        '<span class="search-dropdown-initials" style="display:none;">' + escapeHtml(getInitials(name)) + '</span>';
    }
    return '<span class="search-dropdown-initials">' + escapeHtml(getInitials(name)) + '</span>';
  }

  function createSearchDropdown (opts) {
    const rootEl = opts.rootEl;
    const inputEl = opts.inputEl;
    const resultsEl = opts.resultsEl;
    const fetchResults = opts.fetchResults;
    const renderItem = opts.renderItem;
    const onSelect = opts.onSelect;
    const placeholder = opts.placeholder || 'Zoek…';
    const minChars = opts.minChars != null ? opts.minChars : 0;
    const debounceMs = opts.debounceMs != null ? opts.debounceMs : 250;
    const emptyStateText = opts.emptyStateText || 'Geen resultaten';
    const itemAvatarSize = opts.itemAvatarSize != null ? opts.itemAvatarSize : 24;

    if (!rootEl || !inputEl || !resultsEl || typeof fetchResults !== 'function' || typeof onSelect !== 'function') {
      console.warn('SearchDropdown: missing required opts');
      return { destroy: function () {} };
    }

    let debounceTimer = null;
    let loading = false;
    let selectedIndex = -1;
    let currentItems = [];

    inputEl.setAttribute('placeholder', placeholder);
    resultsEl.classList.add('search-dropdown-results');

    function showLoading () {
      loading = true;
      resultsEl.innerHTML = '<div class="search-dropdown-loading">Zoeken…</div>';
      resultsEl.style.display = 'block';
    }

    function hideLoading () {
      loading = false;
    }

    function showEmpty () {
      resultsEl.innerHTML = '<div class="search-dropdown-empty">' + escapeHtml(emptyStateText) + '</div>';
      resultsEl.style.display = 'block';
    }

    function renderDefaultItem (item) {
      const name = item.name || item.title || '';
      const sub = item.subtitle != null ? item.subtitle : '';
      return '<span class="search-dropdown-item-avatar">' + renderAvatar(item, itemAvatarSize) + '</span>' +
        '<span class="search-dropdown-item-text">' +
        '<span class="search-dropdown-item-name">' + escapeHtml(name) + '</span>' +
        (sub ? '<span class="search-dropdown-item-subtitle">' + escapeHtml(sub) + '</span>' : '') +
        '</span>';
    }

    function renderList (items) {
      currentItems = items;
      selectedIndex = -1;
      if (!items || items.length === 0) {
        showEmpty();
        return;
      }
      const itemHtml = items.map(function (item, i) {
        const content = typeof renderItem === 'function' ? renderItem(item) : renderDefaultItem(item);
        return '<div class="search-dropdown-item" data-index="' + i + '" role="option">' + content + '</div>';
      }).join('');
      resultsEl.innerHTML = itemHtml;
      resultsEl.style.display = 'block';

      resultsEl.querySelectorAll('.search-dropdown-item').forEach(function (el) {
        el.addEventListener('click', function () {
          const idx = parseInt(el.getAttribute('data-index'), 10);
          if (currentItems[idx]) {
            onSelect(currentItems[idx]);
            resultsEl.style.display = 'none';
          }
        });
      });
    }

    function doSearch () {
      const q = (inputEl.value || '').trim();
      if (q.length < minChars) {
        resultsEl.style.display = 'none';
        return;
      }
      showLoading();
      Promise.resolve(fetchResults(q))
        .then(function (items) {
          hideLoading();
          renderList(Array.isArray(items) ? items : []);
        })
        .catch(function (err) {
          hideLoading();
          resultsEl.innerHTML = '<div class="search-dropdown-error">Fout bij zoeken</div>';
          resultsEl.style.display = 'block';
        });
    }

    function onInput () {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(doSearch, debounceMs);
    }

    function moveSelection (delta) {
      if (currentItems.length === 0) return;
      selectedIndex += delta;
      if (selectedIndex < 0) selectedIndex = currentItems.length - 1;
      if (selectedIndex >= currentItems.length) selectedIndex = 0;
      const items = resultsEl.querySelectorAll('.search-dropdown-item');
      items.forEach(function (el, i) {
        el.classList.toggle('selected', i === selectedIndex);
      });
    }

    function confirmSelection () {
      if (selectedIndex >= 0 && currentItems[selectedIndex]) {
        onSelect(currentItems[selectedIndex]);
        resultsEl.style.display = 'none';
      }
    }

    function onKeydown (e) {
      if (resultsEl.style.display !== 'block') return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveSelection(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveSelection(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        confirmSelection();
      } else if (e.key === 'Escape') {
        resultsEl.style.display = 'none';
      }
    }

    function onDocClick (e) {
      if (!rootEl.contains(e.target)) {
        resultsEl.style.display = 'none';
      }
    }

    inputEl.addEventListener('input', onInput);
    inputEl.addEventListener('focus', function () {
      const q = (inputEl.value || '').trim();
      if (q.length >= minChars) doSearch();
    });
    inputEl.addEventListener('keydown', onKeydown);
    document.addEventListener('mousedown', onDocClick);

    return {
      destroy: function () {
        inputEl.removeEventListener('input', onInput);
        inputEl.removeEventListener('keydown', onKeydown);
        document.removeEventListener('mousedown', onDocClick);
        if (debounceTimer) clearTimeout(debounceTimer);
      },
      setResults: renderList,
      showLoading: showLoading,
      hide: function () { resultsEl.style.display = 'none'; }
    };
  }

  return {
    create: createSearchDropdown,
    getInitials: getInitials,
    renderAvatar: function (item, size) { return renderAvatar(item, size); }
  };
}));
