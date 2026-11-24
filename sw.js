const CACHE_NAME = "cajajun-v5";
const ARCHIVOS_A_GUARDAR = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        ARCHIVOS_A_GUARDAR.map((url) =>
          fetch(url, { cache: "no-cache" }).then((resp) => {
            if (resp.ok) {
              return cache.put(url, resp);
            }
            return null;
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(
        claves
          .filter((clave) => clave !== CACHE_NAME)
          .map((clave) => caches.delete(clave))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((respuestaRed) => {
          if (respuestaRed && respuestaRed.status === 200) {
            const copia = respuestaRed.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copia));
          }
          return respuestaRed;
        })
        .catch(() =>
          caches.match(event.request).then((res) => res || caches.match("./index.html"))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((respuestaGuardada) => {
      if (respuestaGuardada) {
        return respuestaGuardada;
      }

      return fetch(event.request)
        .then((respuestaRed) => {
          if (
            !respuestaRed ||
            respuestaRed.status !== 200 ||
            respuestaRed.type !== "basic"
          ) {
            return respuestaRed;
          }

          const copiaRespuesta = respuestaRed.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, copiaRespuesta);
          });

          return respuestaRed;
        })
        .catch(() => new Response("", { status: 503, statusText: "Sin conexión" }));
    })
  );
});