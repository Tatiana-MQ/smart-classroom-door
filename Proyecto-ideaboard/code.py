import os
import time

import board
import socketpool
import wifi
from ideaboard import IdeaBoard
from adafruit_httpserver import JSONResponse, Request, Server

# ---------- Ajustes (se calibran con la maqueta armada) ----------
ANGULO_CERRADA = 160       
ANGULO_ABIERTA = 40    

PASO_GRADOS = 1
PAUSA_SEGUNDOS = 0.03


def ajuste(nombre, defecto):
    valor = os.getenv(nombre)
    return defecto if valor is None else valor


AULA = str(ajuste("AULA", "Aula 101"))
PIN_PROFESOR = str(ajuste("PIN_PROFESOR", "1234"))
MINUTOS_CLASE = int(ajuste("MINUTOS_CLASE", 260))
MINUTOS_EXTRA = int(ajuste("MINUTOS_EXTRA", 30))

# Carpeta de la app web dentro de CIRCUITPY.
CARPETA_APP = str(ajuste("CARPETA_APP", "/www"))

# Colores del LED de la placa
COLOR_CONECTANDO = (20, 20, 20)   # blanco
COLOR_LIBRE = (0, 40, 0)          # verde
COLOR_OCUPADA = (0, 0, 40)        # azul
COLOR_MANTENIMIENTO = (40, 20, 0) # amarillo
COLOR_ERROR = (40, 0, 0)          # rojo

LIBRE = "libre"
OCUPADA = "ocupada"
MANTENIMIENTO = "mantenimiento"

# ---------- Componentes ----------
ib = IdeaBoard()
ib.pixel = COLOR_CONECTANDO

servo = ib.Servo(board.IO4)
angulo_actual = ANGULO_CERRADA
servo.angle = ANGULO_CERRADA

# ---------- Estado del aula ----------
estado = LIBRE
fin_clase = 0
puerta_abierta = False
aviso = ""

def poner_color():
    if estado == OCUPADA:
        ib.pixel = COLOR_OCUPADA
    elif estado == MANTENIMIENTO:
        ib.pixel = COLOR_MANTENIMIENTO
    else:
        ib.pixel = COLOR_LIBRE

def mover_puerta(abrir):
    """Mueve el servo despacio, con PASO_GRADOS y PAUSA_SEGUNDOS."""
    global angulo_actual, puerta_abierta
    destino = ANGULO_ABIERTA if abrir else ANGULO_CERRADA
    paso = PASO_GRADOS if destino > angulo_actual else -PASO_GRADOS
    for angulo in range(angulo_actual, destino, paso):
        servo.angle = angulo
        time.sleep(PAUSA_SEGUNDOS)
    servo.angle = destino
    angulo_actual = destino
    puerta_abierta = abrir


def liberar_aula(motivo):
    global estado, aviso
    estado = LIBRE
    aviso = motivo
    mover_puerta(False)
    poner_color()
    print(motivo)

# ---------- Acciones del profesor ----------
def usar(pin):
    global estado, fin_clase, aviso
    if estado == MANTENIMIENTO:
        return False, "No es posible: el aula está en mantenimiento."
    if estado == OCUPADA:
        return False, "No es posible: el aula ya está ocupada."
    if pin != PIN_PROFESOR:
        return False, "PIN incorrecto."
    ahora = time.monotonic()
    estado = OCUPADA
    fin_clase = ahora + MINUTOS_CLASE * 60
    aviso = ""
    mover_puerta(True)
    poner_color()
    return True, "Aula ocupada. La puerta quedó abierta."

def aumentar(pin):
    global fin_clase
    if estado != OCUPADA:
        return False, "No es posible: el aula no está ocupada."
    if pin != PIN_PROFESOR:
        return False, "PIN incorrecto."
    fin_clase += MINUTOS_EXTRA * 60
    return True, "Se agregaron %d minutos." % MINUTOS_EXTRA

def liberar(pin):
    if estado != OCUPADA:
        return False, "No es posible: el aula no está ocupada."
    if pin != PIN_PROFESOR:
        return False, "PIN incorrecto."
    liberar_aula("Aula liberada por el profesor.")
    return True, "Aula liberada. La puerta se cerró."

def reportar(pin):
    global estado, aviso
    if estado == MANTENIMIENTO:
        return False, "El aula ya está en mantenimiento."
    if pin != PIN_PROFESOR:
        return False, "PIN incorrecto."
    if puerta_abierta:
        mover_puerta(False)
    estado = MANTENIMIENTO
    aviso = "Aula en mantenimiento: se reportó un problema."
    poner_color()
    return True, "Problema reportado. El aula quedó en mantenimiento."

def resuelto(pin):
    global estado, aviso
    if estado != MANTENIMIENTO:
        return False, "No es posible: el aula no está en mantenimiento."
    if pin != PIN_PROFESOR:
        return False, "PIN incorrecto."
    estado = LIBRE
    aviso = "Problema resuelto: el aula vuelve a estar libre."
    poner_color()
    return True, "Listo. El aula está libre."


ACCIONES = {"usar": usar, "aumentar": aumentar, "liberar": liberar,
            "reportar": reportar, "resuelto": resuelto}


# ---------- Reglas automaticas ----------
def revisar_reglas(ahora):
    if estado == OCUPADA and ahora >= fin_clase:
        liberar_aula("Se terminó el tiempo de la clase: aula liberada.")


def datos():
    ahora = time.monotonic()
    segundos_restantes = 0
    if estado == OCUPADA:
        segundos_restantes = max(0, int(fin_clase - ahora + 0.999))
    return {
        "aula": AULA,
        "estado": estado,
        "minutos_restantes": (segundos_restantes + 59) // 60,
        "segundos_restantes": segundos_restantes,
        "minutos_extra": MINUTOS_EXTRA,
        "puerta_abierta": puerta_abierta,
        "aviso": aviso,
    }


# ---------- Wi-Fi y servidor ----------
RED = os.getenv("WIFI_SSID") or os.getenv("CIRCUITPY_WIFI_SSID")
CLAVE = os.getenv("WIFI_PASSWORD") or os.getenv("CIRCUITPY_WIFI_PASSWORD")
def esta_conectado():
    # CircuitPython 8.0.x no tiene wifi.radio.connected; se usa la IP
    return wifi.radio.ipv4_address is not None


def conectar_wifi():
    ib.pixel = COLOR_CONECTANDO
    while not esta_conectado():
        try:
            print("Conectando a", RED, "...")
            wifi.radio.connect(RED, CLAVE)
        except Exception as error:
            print("No se pudo conectar:", error)
            ib.pixel = COLOR_ERROR
            time.sleep(3)
            ib.pixel = COLOR_CONECTANDO
    print("Conectado a la red. IP de la placa:", wifi.radio.ipv4_address)
    poner_color()


conectar_wifi()
pool = socketpool.SocketPool(wifi.radio)
server = Server(pool, CARPETA_APP, debug=False)

# Encabezados para todas las respuestas:
# - no-cache: la app siempre pide el estado mas reciente
# - CORS: permite publicar la app aparte y consultar la placa por Wi-Fi
server.headers = {
    "Cache-Control": "no-cache",
    "Access-Control-Allow-Origin": "*",
}


@server.route("/estado")
def ver_estado(request: Request):
    return JSONResponse(request, datos())


@server.route("/accion")
def accion(request: Request):
    nombre = request.query_params.get("accion") or ""
    pin = request.query_params.get("pin") or ""
    funcion = ACCIONES.get(nombre)
    if funcion is None:
        ok, mensaje = False, "Acción desconocida."
    else:
        ok, mensaje = funcion(pin)
    print(nombre, "->", mensaje)
    respuesta = datos()
    respuesta["ok"] = ok
    respuesta["mensaje"] = mensaje
    return JSONResponse(request, respuesta)


# Puerto 80; si esta ocupado (por el "web workflow" de CircuitPython) se usa 8080
try:
    server.start(str(wifi.radio.ipv4_address), 80)
    DIRECCION = "http://%s" % wifi.radio.ipv4_address
except OSError:
    server.start(str(wifi.radio.ipv4_address), 8080)
    DIRECCION = "http://%s:8080" % wifi.radio.ipv4_address
print("==============================================")
print("App lista. Abrir en el celular:", DIRECCION)
print("Archivos de la app:", CARPETA_APP)
print("==============================================")

while True:
    ahora = time.monotonic()

    revisar_reglas(ahora)

    try:
        server.poll()
    except OSError as error:
        print("Error del servidor:", error)

    time.sleep(0.01)

    if not esta_conectado():
        conectar_wifi()