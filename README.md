# Acceso a aulas con IdeaBoard

Maqueta de control de acceso a un aula. Una **IdeaBoard** (ESP32 con CircuitPython) se conecta al Wi-Fi, mueve un **servo** que hace de puerta y muestra una **página web** desde la que el profesor controla el aula con su celular.

## Qué hace

Desde el celular, conectado a la misma red Wi-Fi que la placa, el profesor puede:

| Acción | Resultado |
|---|---|
| **Usar aula** | La puerta se abre y el aula queda ocupada. |
| **Aumentar tiempo** | Suma minutos a la clase. |
| **Liberar aula** | La puerta se cierra y el aula queda libre. |
| **Reportar mantenimiento** | La puerta se cierra y el aula no se puede usar. |
| **Problema resuelto** | El aula vuelve a estar libre. |

Todas las acciones piden el **PIN del profesor**.

**Automático:** cuando se acaba el tiempo de la clase, el aula se libera y la puerta se cierra.

**LED de la placa:**

| Color | Significado |
|---|---|
| Blanco | Conectando al Wi-Fi |
| Verde | Aula libre |
| Azul | Aula ocupada |
| Amarillo | Aula en mantenimiento |
| Rojo | No se pudo conectar al Wi-Fi |

## Materiales

- IdeaBoard de CRCibernética (ESP32, CircuitPython).
- Servo MG90S.
- Adaptador de **5 V** (en este proyecto, 5 V / 3 A con conector tipo barril, positivo al centro).
- Cable USB-C (para programar y ver la consola).
- Maqueta de la puerta (impresa en 3D en este proyecto).
- Red Wi-Fi de **2,4 GHz** y un celular.

## Conexiones

1. **Servo** en el conector de **IO04**, en el lado izquierdo de la placa. El cable marrón o negro (GND) queda hacia el borde de la placa, el rojo (V+) en el medio y el naranja (señal) junto a la etiqueta IO04.
2. **Alimentación del servo:** adaptador de 5 V en el conector redondo de la placa (o en el borne verde, respetando V+ y G).
3. **Jumper SELECT en Vin.** Si queda en +3.3v, el servo no recibe la energía del adaptador.

> No uses una fuente de más de 5 V. Puede dañar el servo y la placa.

## Estructura del proyecto

```
acceso-aulas-ideaboard/
├── code.py                  # Programa principal de la placa
├── calibrar.py              # Programa auxiliar para medir los ángulos del servo
├── settings.example.toml    # Ejemplo de configuración (sin datos reales)
├── .gitignore
├── README.md
└── www/                     # Página web que sirve la placa
    ├── index.html
    ├── app.css
    ├── app.js
    ├── manifest.json        # Opcional (instalar como app)
    ├── icono.svg            # Opcional
    └── icono-180.png        # Opcional
```

## Instalación

Se usa **IdeaCode**, el editor web de CRCibernética: <https://ideacode.crcibernetica.com>. Funciona en Chrome, Edge y Brave.

1. Conecta la IdeaBoard a la computadora por USB-C.
2. Abre IdeaCode, pulsa **Connect** y elige el puerto de la placa.
3. Comprueba que en la carpeta `lib` de la placa esté **`adafruit_httpserver`** (y `ideaboard.py`, `neopixel.mpy`). Si falta, cópiala desde el [bundle de CircuitPython](https://circuitpython.org/libraries) que coincida con tu versión.
4. Crea `settings.toml` en la placa a partir de `settings.example.toml` (ver la sección siguiente).
5. Crea la carpeta **`www`** en la placa y copia ahí los archivos de la carpeta `www` de este repositorio.
6. Abre `code.py` en la placa, pega el contenido de este repositorio, pulsa **Save** y luego **Run**.
7. Mira la consola. Debe aparecer algo así:

   ```
   Conectado a la red. IP de la placa: 192.168.x.x
   App lista. Abrir en el celular: http://192.168.x.x
   ```

8. En el celular, conectado a la **misma red**, abre esa dirección en el navegador. Si termina en `:8080`, inclúyelo.

## Configuración (`settings.toml`)

Crea un archivo `settings.toml` en la placa con este contenido, cambiando los valores:

```toml
WIFI_SSID = "NOMBRE_DE_TU_RED"
WIFI_PASSWORD = "CLAVE_DE_TU_RED"

AULA = "Aula 101"
PIN_PROFESOR = "1234"

# Para la demostración conviene poner valores cortos, por ejemplo 2 y 1
MINUTOS_CLASE = 260
MINUTOS_EXTRA = 30
```

- El nombre de la red debe ser **exacto**: mayúsculas, espacios y signos como un punto final cuentan.
- La red debe ser de **2,4 GHz**. El ESP32 no se conecta a 5 GHz.
- **Cambia el PIN** por uno propio.
- **No subas tu `settings.toml` real al repositorio.** Está en el `.gitignore`.

## Calibrar la puerta

Los ángulos del servo dependen de cómo quedó armada la maqueta, así que hay que medirlos. En `code.py`:

```python
ANGULO_CERRADA = 0     # ángulo con la puerta cerrada
ANGULO_ABIERTA = 90    # ángulo con la puerta abierta
```

Estos son valores de ejemplo. Para encontrar los tuyos:

1. Deja la puerta libre y la fuente de 5 V conectada.
2. Copia `code.py` aparte como respaldo y pega temporalmente el contenido de `calibrar.py` en su lugar.
3. Pulsa **Run**. El servo recorre de 10° a 180°, de 10 en 10, y espera 3 segundos en cada uno.
4. Anota el ángulo donde la puerta queda **cerrada** y el ángulo donde queda **abierta** sin chocar.
5. Si el servo zumba o se atora, pulsa **Stop** de inmediato: está forzando contra un tope.
6. Vuelve a poner el `code.py` original y escribe los dos valores.

Deja un margen de 2 a 5 grados antes del tope para que el servo no empuje cuando la puerta esté cerrada. Si la puerta no llega a cerrar en ningún ángulo, el problema es mecánico: saca el brazo del servo, ponlo a 90° y vuelve a montarlo con la puerta a mitad de camino.

**Suavidad del movimiento:** en `code.py`, `PASO_GRADOS` y `PAUSA_SEGUNDOS` controlan la velocidad. Con `1` y `0.03`, 90° tardan unos 2,7 segundos. Sube la pausa para ir más lento.

**Al encender**, el servo siempre salta al ángulo de cerrada, porque el programa no sabe en qué posición estaba. Con los ángulos bien calibrados, eso solo cierra la puerta.

## Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `No network with that ssid` | El nombre de la red no coincide o es de 5 GHz | Escanea las redes (abajo) y copia el nombre exacto. |
| LED blanco que no cambia | No logra conectarse al Wi-Fi | Revisa nombre, clave y que la red sea de 2,4 GHz. |
| `'Radio' object has no attribute 'connected'` | Firmware antiguo (8.0.x) | Ya está resuelto en `code.py`: usa la dirección IP para saber si hay conexión. |
| El celular no abre la página | Redes distintas o aislamiento de clientes | Usa la misma red y evita redes de invitados. |
| Error 404 o página vacía | Falta la carpeta `www` en la placa | Crea `www` y sube ahí `index.html` y los demás archivos. |
| Error en `Server(...)` o `server.headers` | Versión vieja de `adafruit_httpserver` | Actualiza la librería (o el firmware). |
| El servo tiembla o la placa se reinicia | Falta energía | Usa el adaptador de 5 V con SELECT en **Vin**. |
| La puerta se abre al encender | Ángulos sin calibrar | Mide los ángulos con `calibrar.py`. |

**Escanear las redes que ve la placa** (en la consola de IdeaCode):

```python
import wifi
[print(repr(r.ssid), r.channel, r.rssi) for r in wifi.radio.start_scanning_networks()]
```

Canales del 1 al 13 son 2,4 GHz. Un `rssi` de −70 o peor indica señal débil.

## Limitaciones

- Es una **maqueta educativa**, no un sistema de seguridad real.
- La página usa HTTP sin cifrar y envía el PIN en la dirección de la consulta, así que cualquiera en la misma red podría verlo. Úsalo solo en una red de confianza.
- El tiempo de la clase se pierde si la placa se reinicia o se desconecta de la corriente.
- Mientras la puerta se mueve, la placa no atiende peticiones web (unos 3 segundos).

## Créditos

- Placa: [IdeaBoard de CRCibernética](https://crcibernetica.com).
- Librería: [`adafruit_httpserver`](https://github.com/adafruit/Adafruit_CircuitPython_HTTPServer).


