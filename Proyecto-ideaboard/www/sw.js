/* ------------------------------------------------------------------
   Aula · IdeaBoard
   Service worker de la PWA. Guarda la interfaz para que abra rápido
   y funcione sin red. El estado y las acciones siempre van a la placa.

   Importante: sube VERSION cuando cambies index.html, app.css o app.js.
   ------------------------------------------------------------------ */

const VERSION = "aula-ideaboard-v2";
const CACHE = VERSION;

const ARCHIVOS = [
  "./",
  "index.html",
  "app.css",
  "app.js",
  "manifest.json",
  "icono.svg",
  "icono-180.png",
  "icono-192.png",
  "icono-512.png",
  "icono-maskable-512.png",
];

self.addEventListener("install", function (evento) {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then(function (cache) {
        return cache.addAll(ARCHIVOS);
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener("activate", function (evento) {
  evento.waitUntil(
    caches
      .keys()
      .then(function (claves) {
        return Promise.all(
          claves.map(function (clave) {
            return clave === CACHE ? null : caches.delete(clave);
          })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", function (evento) {
  const solicitud = evento.request;

  if (solicitud.method !== "GET") {
    return;
  }

  const url = new URL(solicitud.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  // El estado y las acciones nunca se guardan en caché.
  if (
    url.pathname.endsWith("/estado") ||
    url.pathname.endsWith("/accion")
  ) {
    return;
  }

  evento.respondWith(
    caches.match(solicitud).then(function (guardada) {
      if (guardada) {
        return guardada;
      }

      return fetch(solicitud)
        .then(function (respuesta) {
          if (respuesta && respuesta.ok && respuesta.type === "basic") {
            const copia = respuesta.clone();
            caches.open(CACHE).then(function (cache) {
              cache.put(solicitud, copia);
            });
          }
          return respuesta;
        })
        .catch(function () {
          if (solicitud.mode === "navigate") {
            return caches.match("index.html");
          }
          return new Response("Sin conexión", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        });
    })
  );
});
