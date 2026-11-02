"use strict";

/* ------------------------------------------------------------------
   Aula · IdeaBoard
   App web (PWA) que habla con la IdeaBoard por Wi-Fi usando la misma
   API del proyecto: /estado y /accion.

   Si publicas esta carpeta aparte (por ejemplo en otro servidor),
   escribe aqui la direccion de la placa. Si la app la sirve la propia
   IdeaBoard, deja el valor vacio.
   ------------------------------------------------------------------ */

const PLACA = ""; // por ejemplo: "http://192.168.1.50"
const BASE = PLACA.replace(/\/+$/, "");

const INTERVALO_EN_LINEA = 2500;
const INTERVALO_SIN_CONEXION = 5000;
const TIEMPO_ESTADO = 7000;
const TIEMPO_ACCION = 15000;

const ICONOS = {
  libre:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>',
  ocupada:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  mantenimiento:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  desconocido:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 2 20 20"/><path d="M8.5 8.5a10.5 10.5 0 0 1 13 3.5"/><path d="M5 12a10.5 10.5 0 0 1 3-2.2"/><path d="M8.5 15.5a5 5 0 0 1 7 0"/><path d="M12 19h.01"/></svg>',
};

const ESTADOS = {
  libre: { texto: "Libre", color: "#1f7a3f" },
  ocupada: { texto: "Ocupada", color: "#1f4fb8" },
  mantenimiento: { texto: "Mantenimiento", color: "#a85a07" },
  desconocido: { texto: "Sin conexión", color: "#18212b" },
};

const ACCIONES = {
  usar: {
    titulo: "Usar el aula",
    texto: "La puerta se abrirá y el aula quedará ocupada durante el tiempo de clase.",
    etiqueta: "Usar aula",
  },
  aumentar: {
    titulo: "Aumentar tiempo",
    texto: "Se agregarán minutos extra al tiempo que queda de clase.",
    etiqueta: "Aumentar",
  },
  liberar: {
    titulo: "Liberar el aula",
    texto: "La puerta se cerrará y el aula quedará libre para el siguiente grupo.",
    etiqueta: "Liberar",
    confirmar: true,
  },
  reportar: {
    titulo: "Reportar mantenimiento",
    texto: "El aula quedará fuera de servicio hasta que el problema se marque como resuelto.",
    etiqueta: "Reportar",
    confirmar: true,
  },
  resuelto: {
    titulo: "Problema resuelto",
    texto: "El aula volverá a estar disponible.",
    etiqueta: "Marcar resuelto",
  },
};

const $ = (id) => document.getElementById(id);

const el = {
  aula: $("aula"),
  conexion: $("conexion"),
  conexionTexto: $("conexion-texto"),
  tarjeta: $("tarjeta"),
  estado: $("estado"),
  iconoEstado: $("icono-estado"),
  tiempo: $("tiempo"),
  tiempoValor: $("tiempo-valor"),
  aviso: $("aviso"),
  puerta: $("puerta"),
  extra: $("extra"),
  pin: $("pin"),
  verPin: $("ver-pin"),
  acciones: $("acciones"),
  mensaje: $("mensaje"),
  placa: $("placa"),
  instalar: $("instalar"),
  dialogo: $("dialogo"),
  dialogoTitulo: $("dialogo-titulo"),
  dialogoTexto: $("dialogo-texto"),
  dialogoConfirmar: $("dialogo-confirmar"),
};

let datos = null;
let conectado = false;
let cargandoEstado = false;
let finLocal = 0;
let temporizador = null;
let mensajeEsConexion = false;
let promesaInstalar = null;
let accionEnCurso = false;

/* ---------- Utilidades ---------- */

function ruta(nombre) {
  return BASE ? BASE + "/" + nombre : nombre;
}

function dosDigitos(numero) {
  return numero < 10 ? "0" + numero : String(numero);
}

function formatearTiempo(segundos) {
  const total = Math.max(0, Math.round(segundos));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const seg = total % 60;

  if (horas > 0) {
    return horas + ":" + dosDigitos(minutos) + ":" + dosDigitos(seg);
  }
  return dosDigitos(minutos) + ":" + dosDigitos(seg);
}

function esStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

/* ---------- Mensajes y conexión ---------- */

function marcarConexion(ok) {
  conectado = ok;
  el.conexion.dataset.estado = ok ? "en-linea" : "sin-conexion";
  el.conexionTexto.textContent = ok ? "En línea" : "Sin conexión";
  el.conexion.setAttribute(
    "aria-label",
    ok ? "Conectado a la placa" : "Sin conexión con la placa"
  );
  aplicarDisponibilidad();
}

function mostrarMensaje(texto, tipo, esConexion) {
  el.mensaje.textContent = texto;
  el.mensaje.className = "mensaje " + (tipo || "info");
  mensajeEsConexion = Boolean(esConexion);
}

function limpiarMensaje() {
  el.mensaje.textContent = "";
  el.mensaje.className = "mensaje";
  mensajeEsConexion = false;
}

/* ---------- Pintar el estado ---------- */

function actualizarTema(estado) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", (ESTADOS[estado] || ESTADOS.desconocido).color);
  }
}

function actualizarTiempo(d, estado) {
  let segundos = Number(d.segundos_restantes);

  if (!Number.isFinite(segundos)) {
    segundos = (Number(d.minutos_restantes) || 0) * 60;
  }

  if (estado === "ocupada" && segundos > 0) {
    finLocal = Date.now() + segundos * 1000;
    el.tiempo.hidden = false;
    el.tiempoValor.textContent = formatearTiempo(segundos);
  } else {
    finLocal = 0;
    el.tiempo.hidden = true;
  }
}

function actualizarAcciones(d, estado) {
  const visibles = {
    usar: estado === "libre",
    aumentar: estado === "ocupada",
    liberar: estado === "ocupada",
    reportar: estado === "libre" || estado === "ocupada",
    resuelto: estado === "mantenimiento",
  };

  Object.keys(visibles).forEach(function (accion) {
    const boton = el.acciones.querySelector('[data-accion="' + accion + '"]');
    if (boton) {
      boton.hidden = !visibles[accion];
    }
  });

  const aumentar = el.acciones.querySelector('[data-accion="aumentar"]');
  if (aumentar && !aumentar.disabled) {
    aumentar.textContent = "Aumentar " + (Number(d.minutos_extra) || 0) + " min";
  }
}

function pintar(d) {
  const estado = ESTADOS[d.estado] ? d.estado : "desconocido";

  el.aula.textContent = d.aula || "Aula";
  el.tarjeta.dataset.estado = estado;
  el.estado.textContent = ESTADOS[estado].texto;
  el.iconoEstado.innerHTML = ICONOS[estado] || ICONOS.desconocido;

  el.puerta.textContent = d.puerta_abierta ? "Abierta" : "Cerrada";
  el.puerta.dataset.abierta = d.puerta_abierta ? "true" : "false";

  el.extra.textContent = (Number(d.minutos_extra) || 0) + " min";
  el.aviso.textContent = d.aviso || "";
  el.aviso.hidden = !d.aviso;

  document.title = (d.aula || "Aula") + " · " + ESTADOS[estado].texto;
  actualizarTema(estado);
  actualizarTiempo(d, estado);
  actualizarAcciones(d, estado);
}

function actualizarReloj() {
  if (!finLocal) {
    return;
  }

  const segundos = Math.max(0, Math.ceil((finLocal - Date.now()) / 1000));
  el.tiempoValor.textContent = formatearTiempo(segundos);

  if (segundos === 0) {
    finLocal = 0;
    programar(1200);
  }
}

/* ---------- Ciclo de consulta ---------- */

function programar(milisegundos) {
  window.clearTimeout(temporizador);
  temporizador = window.setTimeout(ciclo, milisegundos);
}

async function ciclo() {
  if (document.hidden) {
    programar(INTERVALO_SIN_CONEXION);
    return;
  }

  await cargarEstado();
  programar(conectado ? INTERVALO_EN_LINEA : INTERVALO_SIN_CONEXION);
}

async function cargarEstado() {
  if (cargandoEstado) {
    return;
  }

  cargandoEstado = true;
  const control = new AbortController();
  const limite = window.setTimeout(function () {
    control.abort();
  }, TIEMPO_ESTADO);

  try {
    const respuesta = await fetch(ruta("estado") + "?t=" + Date.now(), {
      signal: control.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!respuesta.ok) {
      throw new Error("HTTP " + respuesta.status);
    }

    const nuevos = await respuesta.json();
    datos = nuevos;
    pintar(nuevos);
    marcarConexion(true);

    if (mensajeEsConexion) {
      limpiarMensaje();
    }
  } catch (error) {
    marcarConexion(false);

    if (!mensajeEsConexion && !accionEnCurso) {
      mostrarMensaje(
        "Sin conexión con la placa. Reintentando…",
        "error",
        true
      );
    }

    if (datos === null) {
      el.tarjeta.dataset.estado = "desconocido";
      el.estado.textContent = "Sin conexión";
      el.iconoEstado.innerHTML = ICONOS.desconocido;
    }
  } finally {
    window.clearTimeout(limite);
    cargandoEstado = false;
  }
}

/* ---------- Acciones ---------- */

function bloquearBotones(bloquear, activo) {
  const botones = el.acciones.querySelectorAll("button");

  Array.prototype.forEach.call(botones, function (boton) {
    if (bloquear) {
      boton.disabled = true;
      if (boton === activo) {
        boton.dataset.textoOriginal = boton.textContent;
        boton.textContent = "Un momento…";
      }
    } else {
      boton.disabled = false;
      if (boton.dataset.textoOriginal) {
        boton.textContent = boton.dataset.textoOriginal;
        delete boton.dataset.textoOriginal;
      }
    }
  });

  el.acciones.setAttribute("aria-busy", bloquear ? "true" : "false");
  aplicarDisponibilidad();
}

function aplicarDisponibilidad() {
  const deshabilitar = accionEnCurso || !conectado;
  const botones = el.acciones.querySelectorAll("button");

  Array.prototype.forEach.call(botones, function (boton) {
    boton.disabled = deshabilitar;
  });
}

function confirmar(titulo, texto, etiqueta) {
  return new Promise(function (resolver) {
    if (typeof el.dialogo.showModal !== "function") {
      resolver(window.confirm(titulo + "\n\n" + texto));
      return;
    }

    el.dialogoTitulo.textContent = titulo;
    el.dialogoTexto.textContent = texto;
    el.dialogoConfirmar.textContent = etiqueta || "Confirmar";
    el.dialogo.returnValue = "";
    el.dialogo.showModal();

    function alCerrar() {
      el.dialogo.removeEventListener("close", alCerrar);
      resolver(el.dialogo.returnValue === "confirmar");
    }

    el.dialogo.addEventListener("close", alCerrar);
  });
}

async function ejecutar(accion) {
  if (accionEnCurso) {
    return;
  }

  const meta = ACCIONES[accion];
  if (!meta) {
    return;
  }

  const pin = el.pin.value.trim();
  if (!pin) {
    mostrarMensaje("Escribe el PIN del profesor.", "error");
    el.pin.focus();
    return;
  }

  if (meta.confirmar) {
    const aceptado = await confirmar(meta.titulo, meta.texto, meta.etiqueta);
    if (!aceptado) {
      return;
    }
  }

  accionEnCurso = true;
  limpiarMensaje();

  const boton = el.acciones.querySelector('[data-accion="' + accion + '"]');
  bloquearBotones(true, boton);

  if (navigator.vibrate) {
    navigator.vibrate(10);
  }

  const control = new AbortController();
  const limite = window.setTimeout(function () {
    control.abort();
  }, TIEMPO_ACCION);

  try {
    const respuesta = await fetch(
      ruta("accion") +
        "?accion=" +
        encodeURIComponent(accion) +
        "&pin=" +
        encodeURIComponent(pin) +
        "&t=" +
        Date.now(),
      {
        signal: control.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      }
    );

    if (!respuesta.ok) {
      throw new Error("HTTP " + respuesta.status);
    }

    const nuevos = await respuesta.json();
    datos = nuevos;
    pintar(nuevos);
    marcarConexion(true);
    mostrarMensaje(nuevos.mensaje || "Listo.", nuevos.ok ? "ok" : "error");

    if (nuevos.ok && navigator.vibrate) {
      navigator.vibrate([12, 40, 12]);
    }
  } catch (error) {
    marcarConexion(false);
    mostrarMensaje(
      "No se pudo completar la acción. Revisa la conexión e intenta de nuevo.",
      "error"
    );
  } finally {
    window.clearTimeout(limite);
    accionEnCurso = false;
    bloquearBotones(false);
    programar(600);
  }
}

/* ---------- Instalar la app ---------- */

async function instalarApp() {
  if (promesaInstalar) {
    promesaInstalar.prompt();
    const eleccion = await promesaInstalar.userChoice;
    promesaInstalar = null;

    if (eleccion && eleccion.outcome === "accepted") {
      el.instalar.hidden = true;
      mostrarMensaje("Instalando la app…", "info");
    }
    return;
  }

  const esIOS =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  mostrarMensaje(
    esIOS
      ? "En Safari toca Compartir y elige “Añadir a pantalla de inicio”."
      : "Abre el menú del navegador y elige “Instalar app” o “Añadir a pantalla de inicio”.",
    "info"
  );
}

function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const seguro =
    location.protocol === "https:" ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname === "[::1]";

  if (!seguro) {
    return;
  }

  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function () {
      /* Sin service worker la app sigue funcionando. */
    });
  });
}

/* ---------- Eventos e inicio ---------- */

function conectarEventos() {
  el.acciones.addEventListener("click", function (evento) {
    const boton = evento.target.closest("button[data-accion]");
    if (boton) {
      ejecutar(boton.dataset.accion);
    }
  });

  el.pin.addEventListener("input", function () {
    el.pin.value = el.pin.value.replace(/\D/g, "").slice(0, 8);
  });

  el.pin.addEventListener("keydown", function (evento) {
    if (evento.key !== "Enter") {
      return;
    }

    evento.preventDefault();
    const visible = el.acciones.querySelector("button:not([hidden])");
    if (visible) {
      visible.click();
    }
  });

  el.verPin.addEventListener("click", function () {
    const mostrar = el.pin.type === "password";
    el.pin.type = mostrar ? "text" : "password";
    el.verPin.setAttribute("aria-pressed", mostrar ? "true" : "false");
    el.verPin.setAttribute(
      "aria-label",
      mostrar ? "Ocultar PIN" : "Mostrar PIN"
    );
  });

  el.instalar.addEventListener("click", instalarApp);

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      cargarEstado();
      programar(INTERVALO_EN_LINEA);
    }
  });
}

function iniciar() {
  el.placa.textContent =
    "Placa: " +
    (BASE ? BASE.replace(/^https?:\/\//, "") : location.host || "local");

  el.instalar.hidden = esStandalone();

  conectarEventos();
  actualizarReloj();
  window.setInterval(actualizarReloj, 1000);
  ciclo();
  registrarServiceWorker();
}

window.addEventListener("beforeinstallprompt", function (evento) {
  evento.preventDefault();
  promesaInstalar = evento;
  el.instalar.hidden = false;
});

window.addEventListener("appinstalled", function () {
  el.instalar.hidden = true;
  promesaInstalar = null;
  mostrarMensaje(
    "App instalada. Ábrela desde tu pantalla de inicio.",
    "ok"
  );
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciar);
} else {
  iniciar();
}
