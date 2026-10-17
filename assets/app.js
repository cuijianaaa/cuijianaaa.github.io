// 图片灯箱 + 目录高亮
(function () {
  'use strict';

  /* ---------------- 灯箱 ---------------- */
  var imgs = Array.prototype.slice.call(document.querySelectorAll('.cell img'));
  if (imgs.length) {
    var box = document.getElementById('lightbox');
    var big = box.querySelector('img');
    var idx = 0;

    function show(i) {
      idx = (i + imgs.length) % imgs.length;
      big.src = imgs[idx].currentSrc || imgs[idx].src;
      big.alt = imgs[idx].alt || '';
    }
    imgs.forEach(function (im, i) {
      im.addEventListener('click', function () {
        box.hidden = false;
        show(i);
      });
    });
    box.addEventListener('click', function (e) {
      if (e.target === box) box.hidden = true;
    });
    box.querySelector('.lb-close').addEventListener('click', function () { box.hidden = true; });
    box.querySelector('.lb-prev').addEventListener('click', function (e) { e.stopPropagation(); show(idx - 1); });
    box.querySelector('.lb-next').addEventListener('click', function (e) { e.stopPropagation(); show(idx + 1); });
    document.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'Escape') box.hidden = true;
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'ArrowRight') show(idx + 1);
    });
  }

  /* ---------------- 目录高亮 ---------------- */
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav-i'));
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
