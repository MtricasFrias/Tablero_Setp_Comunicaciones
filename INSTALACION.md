# Encuesta Cultura SETP — Instalación

La página es un solo archivo (`index.html`). Guarda las respuestas en una **Hoja de Google**
a través de un script gratuito de **Google Apps Script**. No hay servidores ni costos.

La encuesta pide: **valoración (caritas 1–5)**, **nombre completo**, **correo electrónico** y un
**comentario opcional**. El correo se usa para no repetir registros.

> **¿Ya tenías la versión con "documento"?** Pega el nuevo `apps-script.gs`, borra las filas viejas
> de la pestaña **Respuestas** (deja solo la fila 1), corre `inicializar` y vuelve a implementar
> (Parte A, pasos 3–5). Las columnas nuevas son: `timestamp | fecha | equipo | nombre | correo | valoracion | comentario`.

- **Rol 1 — Encuestado:** entra por QR/NFC, responde en 10 segundos, no necesita cuenta.
- **Rol 2 — Análisis:** entra a `…/#/panel`, escribe la contraseña, ve gráficos y tablas. Tampoco necesita cuenta.
- **Editor (tú):** subes la página y editas metas/nombres/padrón en la Hoja de Google.

---

## Parte A — Backend (Hoja de Google + Apps Script) · ~10 min

1. **Crea la hoja.** Ve a <https://sheets.new>. Nómbrala `Cultura SETP - Respuestas`.

2. **Abre el editor de scripts.** Menú **Extensiones → Apps Script**.

3. **Pega el código.** Borra todo lo que haya en `Código.gs` y pega el contenido de
   `apps-script.gs` (el archivo que está en esta carpeta). Guarda con el disquete (Ctrl+S).

4. **Inicializa las pestañas.** Arriba, en el selector de función elige **`inicializar`** y pulsa
   **Ejecutar**. Google te pedirá permisos:
   - *Revisar permisos* → elige tu cuenta → *Configuración avanzada* → *Ir a (nombre) (no seguro)* → *Permitir*.
   - Esto crea en la hoja las pestañas **Respuestas**, **Config** y **Padron**.

5. **Publica el servicio web.** Botón azul **Implementar → Nueva implementación**.
   - Tipo (ícono engranaje): **Aplicación web**.
   - *Ejecutar como:* **Yo**.
   - *Quién tiene acceso:* **Cualquier usuario**  ← imprescindible, si no el QR no funciona.
   - **Implementar** → copia la **URL de la aplicación web** (termina en `/exec`).

> Si más adelante cambias `apps-script.gs`: **Implementar → Administrar implementaciones → ✏️ →
> Versión: Nueva versión → Implementar**. La URL no cambia.

---

## Parte B — Conectar la página · 2 min

Abre `index.html` con el Bloc de notas (o VS Code). Cerca del inicio del `<script>` hay 2 líneas:

```js
var API_URL   = "PEGAR_AQUI_LA_URL_DEL_APPS_SCRIPT";
var ADMIN_PASS = "SETP2026*";
```

- Reemplaza `API_URL` por la URL `/exec` que copiaste.
- Cambia `ADMIN_PASS` por la contraseña que le darás a la persona de análisis.

Guarda.

---

## Parte C — Publicar la página · 5 min

Necesitas que `index.html` viva en una URL pública. Cualquiera de estas sirve:

- **Netlify Drop** (lo más rápido): entra a <https://app.netlify.com/drop> y arrastra la carpeta.
  Te da una URL al instante.
- **GitHub Pages** (como tu Tablero SETP): sube `index.html` a un repositorio, Settings → Pages →
  Branch `main` → `/root`.

Sube **solo `index.html`**. Los archivos `apps-script.gs` e `INSTALACION.md` no van a la web.

---

## Parte D — Links, QR y NFC para los 3 equipos

Con la URL pública (ejemplo `https://culturasetp.netlify.app/`):

| Equipo | Link que se comparte |
|---|---|
| Equipo 1 | `https://culturasetp.netlify.app/#/e/1` |
| Equipo 2 | `https://culturasetp.netlify.app/#/e/2` |
| Equipo 3 | `https://culturasetp.netlify.app/#/e/3` |
| Panel de análisis | `https://culturasetp.netlify.app/#/panel` |

- **QR:** entra al `#/panel`, en la sección **Equipos** cada tarjeta tiene botón **QR** y **Copiar**.
  (O usa <https://www.qr-code-generator.com/> pegando el link.)
- **NFC:** con la app **NFC Tools** (Android/iOS) → *Escribir → Añadir un registro → URL* →
  pega el link del equipo → *Escribir*. Un tag por equipo.

Cada respuesta queda marcada con su equipo, así el panel separa el avance del Equipo 1, 2 y 3.

---

## Parte E — Ajustes (en la Hoja de Google, sin tocar código)

**Pestaña `Config`** (columna A = clave, columna B = valor):

| clave | valor | qué hace |
|---|---|---|
| `metaTotal` | `310000` | meta total: 50% de la población de Ibagué (~620.000) en 3 meses |
| `metaDiaria` | `5000` | meta por día = 310.000 ÷ ~62 días hábiles (lun-vie, menos festivos) |
| `equipo1` / `equipo2` / `equipo3` | `Equipo 1 · Territorio` | nombre visible de cada equipo |
| `fechaInicio` | `2026-09-15` | *(opcional)* inicio de la campaña, formato `AAAA-MM-DD`. Si no la pones, usa la primera respuesta. |
| `fechaFin` | `2026-12-15` | *(opcional)* fin de la campaña. Si no la pones, son 90 días desde el inicio. |

> La meta diaria de 5.000 asume recolección masiva por QR/NFC (vinilos en la ciudad), no 3 personas digitando. Ajusta `metaTotal` si el DANE reporta otra población, o `metaDiaria` si el rango de fechas cambia.

**Pestaña `Padron`** (opcional): pega en la columna A los **correos** habilitados, uno por fila.
Si tiene datos, la encuesta **rechaza** correos que no estén en la lista.
Si la dejas vacía, se acepta cualquier correo con formato válido.

Los cambios se ven en el panel al pulsar **Actualizar** (o solos, cada minuto).

---

## Cómo funciona / límites

- **Sin repetidos:** un mismo correo no puede responder dos veces (lo valida el backend).
- **Tiempo real:** el panel se actualiza solo cada 30 segundos (y al instante con el botón *Actualizar*).
- **Satisfacción:** % de respuestas con carita 4 (🙂) o 5 (😄), dividido entre el total de respuestas.
- **Datos:** la hoja `Respuestas` es la base de datos. Puedes borrar filas de prueba a mano
  antes de arrancar. El panel exporta todo a CSV.
- **Seguridad:** la contraseña del panel vive en el `index.html` (protege la *vista*, no cifra
  los datos). Sirve para una encuesta de satisfacción interna; no metas datos sensibles.
- **Capacidad:** cómodo hasta ~5.000 respuestas. Más que eso, se necesita paginar.
- **Modo demostración:** si `API_URL` queda sin configurar, la página funciona igual pero guarda
  las respuestas solo en ese dispositivo (útil para mostrarla antes de instalar el backend).
