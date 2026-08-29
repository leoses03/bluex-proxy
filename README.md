# bluex-proxy

Proxy HTTP que devuelve el estado de un envío de **Blue Express** como JSON.

La página de seguimiento de `blue.cl` es una aplicación Next.js que pinta el resultado en el cliente, así que pedirla con `fetch` devuelve el formulario vacío. Este servicio la renderiza con Puppeteer y expone el resultado en un endpoint.

## Uso

```
GET /track?tracking=<numero>&token=<API_TOKEN>
```

**Envío encontrado**

```json
{ "encontrado": true, "tracking": "123456789", "detalle": "..." }
```

**Envío inexistente** (HTTP 404)

```json
{ "encontrado": false, "tracking": "123456789", "error": "Envío no encontrado" }
```

Otras respuestas: `400` número inválido, `403` token incorrecto, `502` la consulta falló.

`GET /` responde `200` y sirve de healthcheck.

## Configuración

| Variable | Obligatoria | Por defecto | Para qué |
|---|---|---|---|
| `API_TOKEN` | sí | — | Token que exige el endpoint. Sin él el servidor no arranca. |
| `PORT` | no | `3000` | Puerto de escucha. |
| `PUPPETEER_EXECUTABLE_PATH` | no | `/usr/bin/google-chrome-stable` | Ruta al binario de Chrome. |
| `NAV_TIMEOUT_MS` | no | `25000` | Tiempo máximo de navegación. |

## Ejecutar

```bash
docker build -t bluex-proxy .
docker run -p 3000:3000 -e API_TOKEN=tu-token-secreto bluex-proxy
```

En local, con Node 18 o superior:

```bash
npm install
API_TOKEN=tu-token PUPPETEER_EXECUTABLE_PATH=/ruta/a/chrome npm start
```

## Notas de implementación

**El navegador se reutiliza.** Levantar un Chromium por petición cuesta entre uno y dos segundos y bastante memoria. Aquí se abre una sola vez y se comparte; si el proceso muere, la siguiente petición lo vuelve a levantar. Dos peticiones simultáneas con el navegador caído comparten el mismo arranque en vez de abrir dos.

**`networkidle2` no es suficiente.** Es una condición laxa y dispara antes de que la aplicación pinte el resultado. Sin una espera explícita, la página se leía todavía en estado «Buscando…» y un envío inexistente se reportaba como encontrado. Por eso hay un `waitForFunction` que descarta el estado de carga antes de extraer.

**Se bloquean imágenes, fuentes, hojas de estilo y vídeo** en la interceptación de peticiones: son la mayor parte del peso de la página y no aportan nada al dato que se busca.

**El token va por variable de entorno.** Si falta, el proceso termina al arrancar: es preferible fallar en el despliegue a quedar abierto sin que nadie lo note.

## Limitaciones conocidas

- El campo `detalle` devuelve el texto del `<main>` sin estructurar. Convertirlo en campos (estado, fecha, historial) requiere un número de seguimiento válido con el que confirmar el marcado de la página; el camino de «encontrado» no está verificado contra un envío real.
- Depende del HTML de un tercero. Si Blue Express rediseña su seguimiento, la extracción hay que revisarla.

## Licencia

MIT
