// server.js
//
// Proxy de seguimiento de Blue Express.
//
// La página de seguimiento de blue.cl es una aplicación Next.js que pinta el
// resultado en el cliente, así que no sirve pedirla con fetch: hay que
// renderizarla. De ahí Puppeteer.
//
// Dos decisiones que explican casi todo el archivo:
//
//   1. El navegador se levanta UNA vez y se reutiliza entre peticiones. Un
//      Chromium por petición tarda entre uno y dos segundos solo en arrancar
//      y se come la memoria del contenedor. Si el proceso se muere, la
//      siguiente petición lo vuelve a levantar.
//   2. Nada de credenciales en el código. El token entra por variable de
//      entorno y, si falta, el servidor no arranca: es preferible que falle
//      al desplegar y no que quede abierto a todo el mundo sin que se note.

import express from "express";
import puppeteer from "puppeteer-core";

const app = express();
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.API_TOKEN;
const CHROME = process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/google-chrome-stable";
const TIMEOUT = Number(process.env.NAV_TIMEOUT_MS || 25000);

if (!TOKEN) {
  console.error("Falta API_TOKEN. Defínelo antes de arrancar.");
  process.exit(1);
}

/* ------------------------------------------------------------ Navegador */

let navegador = null;
let arrancando = null;

async function obtenerNavegador() {
  if (navegador && navegador.connected) return navegador;
  // Si dos peticiones llegan a la vez con el navegador caído, comparten el
  // mismo arranque en vez de levantar dos Chromium.
  if (!arrancando) {
    arrancando = puppeteer
      .launch({
        headless: true,
        executablePath: CHROME,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage", // sin esto Chromium se cae en contenedores con /dev/shm pequeño
          "--disable-gpu",
        ],
      })
      .then((b) => {
        navegador = b;
        b.on("disconnected", () => { navegador = null; });
        return b;
      })
      .finally(() => { arrancando = null; });
  }
  return arrancando;
}

/* -------------------------------------------------------------- Rutas */

// El HEALTHCHECK del Dockerfile pide 200 en la raíz. Sin esta ruta el
// contenedor se marcaría como no saludable aunque funcionara.
app.get("/", (_req, res) => res.json({ ok: true, servicio: "bluex-proxy" }));

app.get("/track", async (req, res) => {
  const { tracking, token } = req.query;

  if (token !== TOKEN) {
    return res.status(403).json({ error: "Token inválido" });
  }
  // Solo dígitos: el número va directo a una URL, así que se valida antes de
  // construirla.
  if (!tracking || !/^[0-9]{6,20}$/.test(String(tracking))) {
    return res.status(400).json({ error: "Número de seguimiento inválido" });
  }

  let pagina;
  try {
    const b = await obtenerNavegador();
    pagina = await b.newPage();

    // Se bloquean imágenes, fuentes y hojas de estilo: no aportan nada al
    // dato que se busca y son la mayor parte del peso de la página.
    await pagina.setRequestInterception(true);
    pagina.on("request", (r) => {
      const t = r.resourceType();
      if (t === "image" || t === "font" || t === "stylesheet" || t === "media") r.abort();
      else r.continue();
    });

    await pagina.goto(
      `https://www.blue.cl/enviar/seguimiento?n_seguimiento=${encodeURIComponent(tracking)}`,
      { waitUntil: "networkidle2", timeout: TIMEOUT }
    );

    // No basta con networkidle2. Es una condición laxa (dos conexiones o
    // menos durante medio segundo) y dispara ANTES de que la aplicación
    // pinte el resultado: medido, devolvía la página con el formulario aún
    // vacío y un envío inexistente se reportaba como encontrado.
    // Se espera a que el <main> deje de estar en blanco.
    await pagina
      .waitForFunction(
        () => {
          const m = document.querySelector("main");
          if (!m) return false;
          const t = m.innerText || "";
          // Mientras la aplicación consulta, el panel dice «Buscando…» y
          // «Cargando…». Sin descartar ese estado, la espera se daba por
          // cumplida al instante y se leía la página a medio pintar: un envío
          // inexistente salía como encontrado.
          if (/Buscando\s*\.{2,}|Cargando\s*\.{2,}/i.test(t)) return false;
          return /No encontramos el env[íi]o/i.test(t) || t.trim().length > 120;
        },
        { timeout: 12000 }
      )
      .catch(() => {}); // si expira se sigue: mejor devolver lo que haya que un 502

    const datos = await pagina.evaluate(() => {
      // Se acota al <main>: el body entero arrastra menú, pie y banners de
      // marketing, que no son el dato que se pide.
      const m = document.querySelector("main");
      const texto = ((m && m.innerText) || document.body.innerText || "").trim();
      return {
        texto,
        noExiste: /No encontramos el env[íi]o/i.test(texto),
      };
    });

    if (datos.noExiste) {
      return res.status(404).json({ encontrado: false, tracking, error: "Envío no encontrado" });
    }

    return res.json({ encontrado: true, tracking, detalle: datos.texto });
  } catch (e) {
    // El detalle va al registro; al cliente solo el motivo genérico.
    console.error("track:", e.message);
    return res.status(502).json({ error: "No se pudo consultar el seguimiento" });
  } finally {
    if (pagina) await pagina.close().catch(() => {});
  }
});

/* -------------------------------------------------------------- Cierre */

const servidor = app.listen(PORT, () => {
  console.log(`bluex-proxy escuchando en :${PORT}`);
});

// Sin esto el contenedor tarda diez segundos en morir y deja Chromium huérfano.
for (const s of ["SIGTERM", "SIGINT"]) {
  process.on(s, async () => {
    servidor.close();
    if (navegador) await navegador.close().catch(() => {});
    process.exit(0);
  });
}
