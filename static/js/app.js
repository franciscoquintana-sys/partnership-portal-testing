// Global app JS - minimal, no framework
document.addEventListener('DOMContentLoaded', function () {
  // Highlight active nav item based on current path
  const path = window.location.pathname.replace('/', '');
  document.querySelectorAll('.nav-item').forEach(function (a) {
    const href = a.getAttribute('href').replace('/', '');
    if (href === path) {
      a.classList.add('active');
    }
  });
});
