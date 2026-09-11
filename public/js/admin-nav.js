(function () {
  const toggle = document.getElementById('adminMenuToggle');
  const nav = document.getElementById('adminNav');
  if (!toggle || !nav) return;

  function setOpen(open) {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    document.body.classList.toggle('admin-menu-open', open);
  }

  toggle.addEventListener('click', () => {
    setOpen(!nav.classList.contains('open'));
  });

  // Cerrar al tocar un link (para que no quede abierto después de navegar)
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });

  // Cerrar al tocar afuera del menú
  document.addEventListener('click', (event) => {
    if (!nav.classList.contains('open')) return;
    if (nav.contains(event.target) || toggle.contains(event.target)) return;
    setOpen(false);
  });

  // Cerrar con Escape
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('open')) setOpen(false);
  });

  // Si la pantalla pasa a desktop, asegurarse de que no quede el estado "open"
  const media = window.matchMedia('(min-width: 861px)');
  const handleMedia = () => {
    if (media.matches) setOpen(false);
  };
  media.addEventListener('change', handleMedia);
  handleMedia();
})();