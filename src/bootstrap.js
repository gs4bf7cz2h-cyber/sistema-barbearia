// Keep this entry point readable by older Safari versions, even if a module fails.
(function () {
  var status = document.getElementById('loadStatus');
  var error = document.getElementById('appError');
  var ready = false;
  var failed = false;
  var timer;

  function fail() {
    if (ready || failed) return;
    failed = true;
    window.clearTimeout(timer);
    status.hidden = true;
    error.hidden = false;
  }

  window.barbeariaBoot = {
    ready: function () {
      ready = true;
      window.clearTimeout(timer);
      status.hidden = true;
      error.hidden = true;
      document.querySelector('#bookingForm button[type="submit"]').disabled = false;
    }
  };

  document.getElementById('reloadApp').addEventListener('click', function (event) {
    event.preventDefault();
    window.location.reload();
  });
  window.addEventListener('error', fail);
  window.addEventListener('unhandledrejection', fail);
  timer = window.setTimeout(fail, 15000);

  var app = document.createElement('script');
  app.type = 'module';
  app.src = 'src/app.js';
  app.onerror = fail;
  app.onload = function () { if (!ready) fail(); };
  document.body.appendChild(app);
}());
