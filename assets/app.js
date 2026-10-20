// 媒体折叠：展开时才加载 src（默认折叠状态下不下载任何媒体）+ 图片灯箱 + 目录高亮
(function () {
  'use strict';

  /* ---------------- 折叠时懒加载媒体 ---------------- */
  // <img>/<video> 用 data-src 而非 src，展开（toggle）时才真正加载
  var lazyTargets = [].slice.call(document.querySelectorAll('[data-src]'));

  function loadNow(el) {
    var src = el.getAttribute('data-src');
    if (!src) return;
    el.setAttribute('src', src);
    el.removeAttribute('data-src');
  }

  // 收起时停止播放：暂停并把进度归零，避免折叠后仍在后台出声/占带宽
  function stopPlayback(box) {
    [].slice.call(box.querySelectorAll('video')).forEach(function (v) {
      if (!v.paused) v.pause();
      try {
        v.currentTime = 0;
      } catch (err) {
        /* 尚未加载完成时设置 currentTime 可能抛错，忽略 */
      }
    });
  }

  // 已展开的直接加载
  lazyTargets.forEach(function (el) {
    var box = el.closest('details');
    if (box && box.open) loadNow(el);
  });

  // 监听展开 / 收起
  document.addEventListener('toggle', function (e) {
    var t = e.target;
    if (t.tagName !== 'DETAILS') return;
    if (!t.open) {
      stopPlayback(t);
      updateToggleText(t);
      return;
    }
    [].slice.call(t.querySelectorAll('[data-src]')).forEach(loadNow);
    updateToggleText(t);
  }, true);

  // 「点击展开 / 点击收起」文案随状态切换
  function updateToggleText(box) {
    var el = box.querySelector('.fold-toggle');
    if (el) el.textContent = box.open ? '点击收起' : '点击展开';
  }
  [].slice.call(document.querySelectorAll('details.cell-fold')).forEach(updateToggleText);

  /* ---------------- 全部展开 / 收起 ---------------- */
  var bar = document.getElementById('foldAll');
  if (bar) {
    var boxes = [].slice.call(document.querySelectorAll('details.cell-fold'));
    var btnAll = bar.querySelector('[data-act="all"]');
    var btnNone = bar.querySelector('[data-act="none"]');

    function syncBar() {
      var opened = boxes.filter(function (b) { return b.open; }).length;
      bar.querySelector('.fold-count').textContent = opened + ' / ' + boxes.length;
    }
    btnAll.addEventListener('click', function () {
      boxes.forEach(function (b) {
        b.open = true;
        [].slice.call(b.querySelectorAll('[data-src]')).forEach(loadNow);
        updateToggleText(b);
      });
      syncBar();
    });
    btnNone.addEventListener('click', function () {
      boxes.forEach(function (b) {
        b.open = false;
        // 立即暂停：批量设 open=false 时，toggle 事件是异步派发的，
        // 不能只依赖 toggle 监听，否则收起后仍会继续播放
        stopPlayback(b);
        updateToggleText(b);
      });
      syncBar();
    });
    boxes.forEach(function (b) { b.addEventListener('toggle', syncBar); });
    syncBar();
  }

  /* ---------------- 图片灯箱 ---------------- */
  var box = document.getElementById('lightbox');
  var big = box.querySelector('img');
  var idx = 0;
  var imgs = [];

  // 灯箱只在图片「已加载且可见」时参与，避免拉到未展开的图
  function collectImages() {
    imgs = [].slice.call(document.querySelectorAll('.fold-body img'))
      .filter(function (im) { return im.getAttribute('src'); });
  }

  document.addEventListener('click', function (e) {
    var im = e.target;
    if (im.tagName !== 'IMG' || !im.closest('.fold-body')) return;
    collectImages();
    idx = imgs.indexOf(im);
    if (idx < 0) return;
    big.src = im.currentSrc || im.src;
    big.alt = im.alt || '';
    box.hidden = false;
  });

  function show(i) {
    idx = (i + imgs.length) % imgs.length;
    big.src = imgs[idx].currentSrc || imgs[idx].src;
    big.alt = imgs[idx].alt || '';
  }
  box.addEventListener('click', function (e) {
    if (e.target === box) box.hidden = true;
  });
  box.querySelector('.lb-close').addEventListener('click', function () { box.hidden = true; });
  box.querySelector('.lb-prev').addEventListener('click', function (e) {
    e.stopPropagation(); collectImages(); show(idx - 1);
  });
  box.querySelector('.lb-next').addEventListener('click', function (e) {
    e.stopPropagation(); collectImages(); show(idx + 1);
  });
  document.addEventListener('keydown', function (e) {
    if (box.hidden) return;
    if (e.key === 'Escape') box.hidden = true;
    else if (e.key === 'ArrowLeft') { collectImages(); show(idx - 1); }
    else if (e.key === 'ArrowRight') { collectImages(); show(idx + 1); }
  });

  /* ---------------- 目录高亮 ---------------- */
  var links = [].slice.call(document.querySelectorAll('.nav-i'));
  if (!links.length) return;
  var map = {};
  links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });

  var sections = links
    .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
    .filter(Boolean);
  if (!sections.length || !('IntersectionObserver' in window)) return;

  var visible = new Set();
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) visible.add(en.target.id);
        else visible.delete(en.target.id);
      });
      var active = sections.filter(function (s) { return visible.has(s.id); })[0];
      links.forEach(function (a) { a.classList.remove('active'); });
      if (active && map[active.id]) map[active.id].classList.add('active');
    },
    { rootMargin: '-10% 0px -75% 0px', threshold: 0 }
  );
  sections.forEach(function (s) { io.observe(s); });
})();
