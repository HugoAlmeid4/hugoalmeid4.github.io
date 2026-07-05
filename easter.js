// easter.js — Konami code easter egg, shared across all pages.
// Loaded with <script src="easter.js" defer></script> so it runs after parsing.
//
// Sequence: ↑ ↑ ↓ ↓ ← → ← → B A
// Effect:    brief color inversion + "Code Monkey Mode unlocked" toast.
(function () {
  var SEQUENCE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
                  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
                  'b', 'a'];
  var progress = 0;

  document.addEventListener('keydown', function (e) {
    var raw = e.key;
    var key = (raw.length === 1) ? raw.toLowerCase() : raw;
    if (key === SEQUENCE[progress]) {
      progress++;
      if (progress === SEQUENCE.length) {
        progress = 0;
        triggerEaster();
      }
    } else {
      // Allow overlapping sequences: if they re-press the first key, count it.
      progress = (key === SEQUENCE[0]) ? 1 : 0;
    }
  });

  function triggerEaster() {
    document.body.classList.add('konami-active');
    showToast('🎮  Code Monkey Mode unlocked');
    setTimeout(function () {
      document.body.classList.remove('konami-active');
    }, 1200);
  }

  function showToast(message) {
    var toast = document.createElement('div');
    toast.className = 'konami-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(function () {
      toast.classList.add('visible');
    });
    setTimeout(function () {
      toast.classList.remove('visible');
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 400);
    }, 1800);
  }
})();
