// Si alguien mete la app dentro de otra página (un marco), no se muestra: evita que te hagan
// dar clic en botones de LilieVET escondidos bajo otra página.
(function () {
  try {
    if (window.top !== window.self) {
      document.documentElement.style.display = 'none';
      window.top.location = window.self.location.href;
    }
  } catch (e) {
    document.documentElement.style.display = 'none';
  }
})();
