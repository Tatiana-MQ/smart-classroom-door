# Aula · IdeaBoard

App web (PWA) para consultar y controlar el estado del aula desde el celular.
La sirve la propia IdeaBoard de CRCibernética (ESP32-S3 con CircuitPython), así
que no hace falta internet ni un servidor aparte.

## Qué incluye

```
Proyecto-ideaboard/
├── code.py                  Firmware: Wi-Fi, servo, LED, API y servidor web
├── LEEME.md                 Este archivo
└── www/                     Interfaz de la app
    ├── index.html
    ├── app.css
    ├── app.js
    ├── manifest.json
    ├── sw.js
    ├── icono.svg
    ├── icono-180.png
    ├── icono-192.png
    ├── icono-512.png
    └── icono-maskable-512.png
```

`code.py` sirve la carpeta `www/` como archivos estáticos. Al abrir la dirección
de la placa, `adafruit_httpserver` entrega `www/index.html` automáticamente.

## Instalación en la placa

1. Conecta la IdeaBoard por USB. Debe aparecer la unidad `CIRCUITPY`.
2. Copia `code.py` en la raíz de `CIRCUITPY`.
3. Copia la carpeta `www` completa dentro de `CIRCUITPY` (debe quedar
   `CIRCUITPY/www/index.html`, etc.).
4. Comprueba que en `CIRCUITPY/lib` estén las librerías del proyecto:
   `adafruit_httpserver`, `adafruit_requests`, `adafruit_connection_manager`
   y las que use `ideaboard`.
5. Crea o edita `CIRCUITPY/settings.toml` con los datos de tu red y del aula.

### settings.toml de ejemplo

```toml
WIFI_SSID = "NombreDeLaRed"
WIFI_PASSWORD = "ClaveDeLaRed"

AULA = "Aula 101"
PIN_PROFESOR = "1234"
MINUTOS_CLASE = 260
MINUTOS_EXTRA = 30

# Carpeta de la app dentro de CIRCUITPY. Normalmente no hay que cambiarla.
CARPETA_APP = "/www"
```

También se aceptan los nombres `CIRCUITPY_WIFI_SSID` y
`CIRCUITPY_WIFI_PASSWORD`.

### Abrir la app

Al terminar de arrancar, la placa imprime en la consola algo así:

```
Conectado a la red. IP de la placa: 192.168.1.50
App lista. Abrir en el celular: http://192.168.1.50
```

Abre esa dirección en el celular, conectado a la misma red Wi-Fi. Si el puerto
80 está ocupado (por el *web workflow* de CircuitPython), el servidor usa el
8080 y la consola muestra la dirección con `:8080`.

## Cómo se usa

1. Escribe el **PIN del profesor**.
2. Toca la acción que corresponda. Los botones cambian según el estado:
   - **Libre:** *Usar aula* y *Reportar mantenimiento*.
   - **Ocupada:** *Aumentar N min*, *Liberar aula* y *Reportar mantenimiento*.
   - **Mantenimiento:** *Marcar resuelto*.
3. Al usar el aula, la puerta se abre y empieza el cronómetro. Al liberar, se
   cierra. *Liberar* y *Reportar* piden confirmación.

El LED de la placa repite el estado: verde libre, azul ocupada y ámbar
mantenimiento.

La app consulta el estado cada 2,5 segundos y muestra "Sin conexión" si la placa
no responde. El cronómetro sigue avanzando en pantalla entre consultas.

## API

La app usa la misma API del proyecto, así que también puedes consultarla con
cualquier navegador o con `curl`.

### `GET /estado`

```json
{
  "aula": "Aula 101",
  "estado": "libre",
  "minutos_restantes": 0,
  "segundos_restantes": 0,
  "minutos_extra": 30,
  "puerta_abierta": false,
  "aviso": ""
}
```

`estado` puede ser `libre`, `ocupada` o `mantenimiento`. `segundos_restantes`
permite un cronómetro preciso; las versiones anteriores del firmware solo
envían `minutos_restantes` y la app lo usa como respaldo.

### `GET /accion?accion=NOMBRE&pin=PIN`

Devuelve el estado actualizado más `ok` y `mensaje`:

```json
{
  "ok": true,
  "mensaje": "Aula ocupada. La puerta quedó abierta.",
  "estado": "ocupada",
  "...": "resto de campos de /estado"
}
```

Acciones disponibles:

| Acción      | Cuándo aplica            | Qué hace                                        |
|-------------|--------------------------|-------------------------------------------------|
| `usar`      | aula libre               | Abre la puerta e inicia el tiempo de clase      |
| `aumentar`  | aula ocupada             | Suma `MINUTOS_EXTRA` al tiempo restante         |
| `liberar`   | aula ocupada             | Cierra la puerta y deja el aula libre           |
| `reportar`  | libre u ocupada          | Cierra la puerta y pasa a mantenimiento         |
| `resuelto`  | en mantenimiento         | Devuelve el aula a libre                        |

Todas las acciones requieren el PIN correcto. Si el PIN es incorrecto,
`ok` es `false` y `mensaje` explica el motivo.

Las respuestas llevan `Cache-Control: no-cache` y
`Access-Control-Allow-Origin: *`, para que la app siempre vea el estado real y
pueda publicarse en otro dominio.

## Instalar como app en el celular

- **iPhone/iPad (Safari):** toca *Compartir* → *Añadir a pantalla de inicio*.
- **Android (Chrome):** menú → *Instalar app* o *Añadir a pantalla de inicio*.
  Si aparece el botón *Instalar en el celular* dentro de la app, úsalo.

La app tiene manifest, iconos y service worker, pero los navegadores solo
registran service workers en **HTTPS** o en `localhost`. Como la placa sirve por
`http://192.168.x.x`, en la red local la app funciona igual pero sin caché
offline; el service worker se activa solo si la publicas en un servidor con
HTTPS. En iPhone, *Añadir a pantalla de inicio* funciona igual por HTTP.

## Publicar la app aparte de la placa

La carpeta `www/` es independiente: puedes subirla a GitHub Pages, Netlify,
un servidor del colegio, etc. Solo hay que indicarle dónde está la placa.

1. Abre `www/app.js` y edita la primera constante:

   ```js
   const PLACA = "http://192.168.1.50"; // dirección de tu IdeaBoard
   ```

   Déjala vacía (`""`) si la app la sirve la propia placa.

2. Sube el contenido de `www/` al servidor. La placa debe ser accesible desde
   los celulares que usen la app (misma red Wi-Fi o VPN).
3. Si publicas con HTTPS, el service worker se registrará y la interfaz abrirá
   incluso sin red; el estado y las acciones siempre necesitan la placa.

## Actualizar la app

Si cambias `index.html`, `app.css`, `app.js` o los iconos, sube también el
número de versión en `www/sw.js`:

```js
const VERSION = "aula-ideaboard-v2";
```

Así los celulares descartan la copia vieja en caché. Después copia de nuevo la
carpeta `www/` a `CIRCUITPY`.

## Ajustes del firmware

En `code.py` puedes cambiar:

- `ANGULO_CERRADA` y `ANGULO_ABIERTA`: posición del servo.
- `PASO_GRADOS` y `PAUSA_SEGUNDOS`: velocidad de la puerta.
- Los colores del LED (`COLOR_LIBRE`, `COLOR_OCUPADA`,
  `COLOR_MANTENIMIENTO`, `COLOR_ERROR`).
- El pin del servo (`board.IO4`).

El resto (nombre del aula, PIN, duración de clase y tiempo extra) se configura
desde `settings.toml`.

## Problemas frecuentes

- **No aparece la IP en la consola:** revisa `WIFI_SSID` y `WIFI_PASSWORD`, y
  que la red sea de 2,4 GHz.
- **La página no carga:** confirma que existe `CIRCUITPY/www/index.html` y que
  `CARPETA_APP` apunta a `/www`.
- **Error 404 en la API:** actualiza `code.py`; las rutas `/estado` y `/accion`
  viven en el firmware, no en `www/`.
- **El navegador muestra una versión vieja:** sube `VERSION` en `sw.js` o
  recarga sin caché.
- **No se puede instalar como PWA en Android:** es normal por HTTP en la red
  local; usa *Añadir a pantalla de inicio* o publica la app con HTTPS.
