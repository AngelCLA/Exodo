# Notas de diseño UI/UX — Éxodo

Documento de referencia para mantener y evolucionar la interfaz sin romper la lógica de la extensión.

## Objetivo y alcance

La interfaz persigue tres cosas:

1. **Identidad institucional sobria:** un único acento azul sobre neutros.
2. **Claridad operativa:** que el usuario identifique rápido la operación, el estado de la bóveda y el resultado del servicio.
3. **Accesibilidad y consistencia:** foco visible, contraste razonable, componentes reutilizables y comportamiento responsive.

El lenguaje es **minimalista**: superficies planas, bordes de 1 px, sin degradados ni sombras, jerarquía por tipografía y espacio, y un solo color de acento.

Los cambios son de presentación y de retroalimentación de interfaz. No se modificó la construcción de solicitudes SOAP, el envío, la lectura de ZIP/XLSX ni la criptografía de la bóveda.

## Principios

- Un solo acento (`--blue`); el resto son neutros con un tinte azul muy leve.
- La acción principal siempre es visible y tiene un único estilo primario.
- La jerarquía se construye con tamaño, peso y espacio, no con cajas ni sombras.
- Las acciones destructivas o reales (cancelaciones) se confirman antes de enviarse y muestran un aviso persistente.
- El estado de la bóveda se comunica con texto y un punto de color, no solo con color.
- Los formularios muestran etiquetas visibles; los placeholders son complementarios.
- El XML se presenta en un bloque oscuro de alto contraste, separado de la interfaz clara.
- La interfaz no depende de librerías, fuentes externas ni iconos remotos.
- Debe funcionar en ventanas angostas, aunque la extensión sea de escritorio.

## Paleta

| Token | Hex | Uso principal | Nota |
| --- | --- | --- | --- |
| `--dark-blue` | `#061856` | Texto principal, logo, fondo del visor XML. | Blanco sobre este azul: ≈16.5:1. |
| `--bold-blue` | `#134074` | Hover del botón primario. | Blanco: ≈10.4:1. |
| `--blue` | `#0054A2` | Único acento: botón primario, operación activa, estatus correcto. | Blanco: ≈7.5:1. |
| `--light-blue` | `#5590FF` | Anillo de foco y borde del resumen. | Solo acento o gráfico grande. |
| `--light` | `#F6F8FB` | Fondo de página, hover y tarjeta de credenciales. | Texto oscuro con contraste alto. |
| `--surface` | `#FFFFFF` | Paneles, header y campos. | — |
| `--border` | `#E4E9F0` | Bordes de paneles, tarjetas y separadores. | No aplica a texto. |
| `--border-strong` | `#CFD8E4` | Hover de bordes y zonas punteadas. | No aplica a texto. |
| `--input-border` | `#D6DDE7` | Bordes de inputs y botones secundarios. | No aplica a texto. |
| `--text-body` | `#374151` | Párrafos y tablas. | ≈9.7:1 |
| `--text-muted` | `#4B5563` | Etiquetas y navegación inactiva. | ≈7.0:1 |
| `--text-subtle` | `#64748B` | Hints, metadatos y placeholders. | ≈4.8:1 |
| `--error` | `#A02C22` | Errores y acciones destructivas. | ≈7.3:1 |

No hay gradientes, brillos, sombras ni una segunda identidad cromática.

### Tokens CSS

```css
:root {
  color-scheme: light;

  --dark-blue: #061856;
  --bold-blue: #134074;
  --blue: #0054a2;
  --light-blue: #5590ff;
  --light: #f6f8fb;

  --surface: #ffffff;
  --border: #e4e9f0;
  --border-strong: #cfd8e4;
  --input-border: #d6dde7;
  --text: var(--dark-blue);
  --text-body: #374151;
  --text-muted: #4b5563;
  --text-subtle: #64748b;
  --focus: rgba(0, 84, 162, 0.18);
  --error: #a02c22;

  --radius-lg: 10px;
  --radius-md: 8px;
  --radius-sm: 6px;

  --header-h: 60px;
}
```

## Estructura de la interfaz

```text
header.topbar
├─ title-block (título de operación + subtítulo)
├─ header-tools (● usuario · Bloquear)
└─ #vaultPanel.credentials (desplegable de acceso institucional)

.shell
├─ aside.sidebar
│  ├─ section-label (oculta)
│  ├─ nav (6 botones con icono SVG)
│  └─ aside-note (endpoint + crédito Éxodo by CLA Tech)
└─ main
   └─ .columns
      ├─ section.panel.main-panel
      │  ├─ heading (#title, #subtitle)
      │  ├─ #fields (formulario dinámico)
      │  ├─ #formAlert (aviso de validación)
      │  └─ .actions (preview + submit)
      └─ section.panel.response-panel
         ├─ heading (#status)
         ├─ #summary
         ├─ #results (zona flexible; placeholder .results-empty)
         └─ .response-footer
            ├─ details (XML de respuesta)
            ├─ details (XML de solicitud)
            └─ .downloads
```

### Header

- 60 px (`--header-h`), sticky.
- Fondo blanco, borde inferior de 1 px y sin sombra.
- Logo de 32 px, cuadrado sólido `--dark-blue` y radio de 8 px.
- Título de 15 px en `--dark-blue`; subtítulo de 11 px en `--text-subtle`.

### Barra lateral

- 216 px en escritorio; 200 px entre 821 y 1050 px. En ambos rangos la barra queda fija al viewport, mientras header y contenido reservan el mismo ancho.
- Fija al viewport en escritorio, con borde derecho de 1 px y desplazamiento interno solo si su contenido no cabe.
- La etiqueta de sección está oculta para reducir ruido.
- El logo de la cabecera lateral tiene 28 px de alto y conserva su ancho proporcional.
- Botones de operación de 13 px, con icono SVG de 16 px, padding `9px 10px` y radio de 6 px.
- Estado activo: fondo `#EEF4FB`, texto e icono en `--blue`, peso 600. Sin barra interior.
- Nota inferior discreta, separada por un borde superior, sin caja ni fondo. Incluye el crédito «Éxodo by CLA Tech», fuera de la topbar; se oculta con la nota cuando la barra está plegada o en modo compacto.

#### Plegado

- La cabecera `.sidebar-head` contiene un botón `.sidebar-toggle` de 28 px con el icono Tabler `layout-sidebar`.
- Al plegar, la barra pasa a 60 px: se ocultan las etiquetas, la nota lateral y el padding horizontal se reduce.
- Los botones conservan `aria-label` y `title`, así que el icono sigue teniendo nombre accesible y tooltip.
- El botón usa `aria-expanded` y `aria-controls="sidebar"`, y su etiqueta cambia entre **Contraer barra lateral** y **Expandir barra lateral**.
- El icono rota 180° cuando la barra está plegada.
- El estado se guarda en `localStorage` con la clave `sepSidebarCollapsed` y se restaura al abrir la extensión.
- En ≤ 820 px la barra conserva visible la cabecera institucional y el botón. Al cerrarse oculta toda la navegación sin reservar espacio; el botón la abre temporalmente y seleccionar una opción la cierra. Este estado compacto no modifica la preferencia guardada del escritorio.

### Paneles

- Fondo blanco, borde de 1 px, radio de 10 px y padding de 20 px.
- Sin sombra.
- Grid de dos columnas en escritorio: `minmax(360px, 1fr)` y `minmax(320px, 1fr)`, con un máximo de 1520 px.

#### Área de trabajo a altura completa (≥ 1051 px)

- `main` es una columna flex con `min-height: calc(100vh - var(--header-h))`; `.columns` crece para ocuparla.
- Ambos paneles se estiran a la misma altura, de modo que no queda una tarjeta corta junto a una columna vacía.
- **Panel principal:** en la operación de carga, `#fields.fields-grow` ocupa el espacio libre y la zona de arrastre crece con él; las acciones quedan después del formulario (no flotan al fondo).
- **Panel de respuesta:** es una columna flex. `#results` es la zona flexible y `.response-footer` agrupa los XML y las descargas, que quedan al fondo del panel.
- El contenido crece si hace falta y la página desplaza; no se recorta contenido.

#### Panel de respuesta

- `#results` contiene un placeholder `.results-empty` mientras no hay tabla. Al llegar resultados, `showResults()` lo reemplaza.
- `.response-footer` evita que los detalles y las descargas se separen del borde inferior en pantallas altas.
- Si la tabla es más alta que el área disponible, la página desplaza; el pie permanece después del contenido.

## Componentes y estados

### Bóveda

El acceso vive en la cabecera. El botón `#vaultToggle` muestra un punto y el usuario; **Bloquear** aparece a su lado únicamente con la sesión abierta. El desplegable `#vaultPanel` usa fondo `--surface`, borde de 1 px, radio de 8 px y padding de 14 px, sin reservar espacio en los formularios de operación. Tiene ancho máximo de 480 px y desplazamiento vertical en ventanas bajas.

Se expande automáticamente al configurar o bloquear y se cierra al guardar o desbloquear. Pulsar el usuario permite abrir las acciones **Cambiar credenciales** y **Olvidé la contraseña maestra / borrar credenciales**. `aria-expanded` y `aria-controls` comunican el estado; al cerrar se devuelve el foco al botón si estaba dentro del desplegable. Solo aquí aparece el aviso de cifrado, sin duplicarlo en sidebar ni hints.

| Estado | `data-state` | Color | Texto |
| --- | --- | --- | --- |
| Sin configurar | `setup` | `--text-muted` | Configurar acceso |
| Bloqueado | `locked` | `--text-subtle` | Desbloquear |
| Desbloqueado | `ready` | `--blue` | Usuario activo |

El texto siempre acompaña al color.

### Formularios

- Etiqueta visible de 12 px, peso 600, color `--text-muted`.
- Input de 13 px, padding `9px 10px`, borde `--input-border`, radio de 6 px.
- Hover: borde `--border-strong`.
- Foco: borde `--blue` y anillo `--focus` de 3 px.
- `textarea` redimensionable verticalmente, mínimo 84 px.
- Los placeholders son complementarios; no sustituyen a la etiqueta.
- El color del placeholder es `#64748B` (≈4.8:1 sobre blanco) para cumplir WCAG AA.
- En los campos de operación, `Enter` ejecuta el envío; en la bóveda, `Enter` guarda o desbloquea según el formulario visible.

### Aviso de operación irreversible

En **Cancelar título** y **Cancelar por institución**, sobre el formulario aparece un bloque `.danger-notice` con borde izquierdo de 2 px en `--error`:

- Texto: “Operación irreversible. Al enviar se ejecuta una cancelación real en la SEP. Revisa el folio antes de continuar.”
- Se mantiene la confirmación nativa antes de enviar; el aviso persistente evita llegar al diálogo sin contexto.

### Retroalimentación y estados de envío

- Los errores de validación se muestran junto al formulario en `#formAlert` (`.form-alert`, `role="alert"`) y además se conservan en el resumen del panel derecho.
- Mientras se espera la respuesta, el botón primario recibe la clase `.loading` (spinner CSS) y el panel de respuesta se marca con `aria-busy="true"`.
- Una bandera `sending` evita envíos duplicados.
- `#summary`, `#status` y `#vaultFeedback` son regiones `aria-live="polite"`.
- La navegación activa usa `aria-current="page"`.

### Botones

| Tipo | Fondo | Texto | Borde | Uso |
| --- | --- | --- | --- | --- |
| Primario | `--blue` | Blanco | `--blue` | Enviar, guardar y desbloquear. |
| Primario hover | `--bold-blue` | Blanco | `--bold-blue` | — |
| Primario activo | `--dark-blue` | Blanco | `--dark-blue` | — |
| Secundario | Blanco | `--text-muted` | `--input-border` | Vista previa, descargas, acciones de bóveda. |
| Secundario hover | `--light` | `--text` | `--border-strong` | — |
| Deshabilitado | — | — | — | Opacidad 0.5, cursor `not-allowed`. |

- Padding `9px 14px`, radio de 6 px, peso 600. Sin sombras.
- Todos los botones tienen `:focus-visible` con contorno de 2 px en `--light-blue`.

### Resumen de respuesta

- Fondo `--light`, borde de 1 px, borde izquierdo de 2 px en `--light-blue`, radio de 8 px.
- Texto de 13 px con `white-space: pre-wrap` para conservar los saltos que genera `app.js`.

### XML

- `details` con borde de 1 px, radio de 8 px y chevron CSS que rota al abrir.
- `summary` con fondo `--light` cuando está abierto.
- `pre` con fondo `#0B1B33`, texto `#DBE6F5`, monoespaciado de 11 px y scroll interno.

### Tabla de resultados

- Header sticky con fondo `--light` y texto `--text-muted`.
- Filas con borde inferior claro y zebra `#FAFBFD`.
- Hover de fila en `--light`.
- Estatus correcto en `--blue`; estatus de error en `--error`.
- `min-width: 480px` solo por debajo de 650 px, para evitar que la columna **Folio control** se corte. En ventanas angostas la tabla hace scroll horizontal dentro de `#results`.

### Zona de archivo

- Implementa la propuesta `design/title-upload/01-zona-con-icono.html` con los tokens vigentes de `style.css` (referencia: `design/system.md`).
- Borde discontinuo de 1 px, fondo transparente, radio de 8 px; conserva el crecimiento en escritorio y el apilado responsive.
- Hover y foco interior: borde `--accent`; al arrastrar se añade fondo `--accent-subtle`.
- SVG inline de 28 px en `--accent`: subir/seleccionar sin archivo y documento con check cuando existe una selección real. Son decorativos (`aria-hidden`), con etiqueta y texto de estado visibles.
- El check significa **archivo seleccionado**, nunca validado ni enviado a SEP; el texto lo aclara explícitamente. La validación XML y el envío mantienen su flujo existente.
- Se conserva el input nativo accesible por teclado y `accept=".xml,text/xml,application/xml"`, además del arrastre. Está oculto solo visualmente (no deshabilitado ni retirado del orden de foco); una etiqueta `<label for="file">` con texto **Seleccionar archivo**, borde y texto `--accent` abre el selector con clic. Al llegar al input con Tab, Enter o Espacio abre el selector nativo y el foco se dibuja sobre la etiqueta visible.
- El selector aparece arriba y, directamente debajo, `#fileinfo` con `role="status"` muestra **Ningún archivo seleccionado** o el nombre y tamaño del archivo como texto; los nombres largos pueden partirse sin desbordar. Las ayudas y el aviso de que no se ha validado ni enviado aparecen después.
- El input usa `aria-describedby="filehelp fileinfo filestate"`. Al reemplazar o vaciar la selección, o volver a la pestaña de carga, se actualizan el icono y los textos.

### Historial

- Filas con borde de 1 px, radio de 8 px, hover con borde más fuerte.
- Título en `--dark-blue`, metadatos en `--text-subtle`.
- Los tipos se muestran con nombres legibles (Carga, Consulta, Descarga, Cancelación, Cancelación por institución).
- Si el registro tiene resultados parseados, se muestra un resumen (total, correctos, con error).
- Barra superior `.history-toolbar` con el conteo y el botón **Vaciar historial**, que pide confirmación y se deshabilita cuando no hay movimientos.

### Estados vacíos

- Respuesta: “Los resultados aparecerán aquí…”.
- Resultados: placeholder `.results-empty` con “Aquí aparecerá la tabla de resultados del lote.”.
- Resultados sin filas: “El Excel no contiene registros.” cuando el XLSX no tiene filas.
- Historial: bloque `.empty-state` con “Sin movimientos todavía.” y una explicación de dónde se guardan.

## Responsive

| Rango | Comportamiento |
| --- | --- |
| > 1050 px | Dos columnas, sidebar fija al viewport de 216 px (60 px plegada), header y contenido reservan ese ancho. Área de trabajo a altura completa y paneles igualados; en carga, la zona de arrastre crece. |
| 821–1050 px | Las columnas se apilan; sidebar fija al viewport de 200 px (60 px plegada), header y contenido reservan ese ancho. |
| ≤ 820 px | Header y sidebar estáticos; la barra muestra su cabecera y botón, y oculta la navegación completa hasta abrirla; al seleccionar una opción vuelve a cerrarse; se oculta la nota lateral y `main` reduce padding. |
| ≤ 650 px | Formularios a una columna; acciones en columna invertida y ancho completo; paneles con padding de 16 px; tabla con `min-width: 480px`; encabezado de bóveda apilado. |

La extensión es de escritorio; el diseño responsive cubre ventanas angostas y monitores pequeños.

## Accesibilidad

### Implementado

- Landmarks semánticos: `header`, `aside`, `main`, `section`, `nav`.
- Jerarquía de encabezados `h1`, `h2`, `h3`.
- `aria-label="Operaciones"` en la navegación y `aria-labelledby` en los paneles.
- `aria-live="polite"` en `#results`, `#summary`, `#status` y `#vaultFeedback`.
- `role="alert"` en `#formAlert`.
- `aria-current="page"` en la operación activa.
- `:focus-visible` en botones; anillo de foco en inputs.
- Contraste alto para texto y acciones; placeholder en `#64748B`.
- `prefers-reduced-motion` desactiva transiciones y animaciones.
- El input de archivo conserva la activación nativa por teclado y el nombre accesible **Seleccionar archivo**; está oculto visualmente y su foco se refleja en la etiqueta visible.
- Todos los campos tienen etiqueta visible.

### Brechas conocidas

- No se ejecutó una auditoría WCAG formal ni pruebas con lectores de pantalla.
- La tabla de resultados mantiene desplazamiento horizontal en paneles angostos en lugar de priorizar columnas.

### Contraste de referencia

Calculado con la fórmula WCAG sobre los colores base:

- Blanco sobre `#061856`: ≈16.5:1.
- Blanco sobre `#134074`: ≈10.4:1.
- Blanco sobre `#0054A2`: ≈7.5:1.
- `#374151` sobre blanco: ≈9.7:1.
- `#4B5563` sobre blanco: ≈7.0:1.
- `#64748B` sobre blanco: ≈4.8:1.
- `#5590FF` sobre blanco: ≈3.1:1 (solo acentos).
- `#A02C22` sobre blanco: ≈7.3:1.

## Implementación y mantenimiento

- No hay framework, build ni dependencias de UI. Todo el estilo vive en `style.css`.
- Los IDs que consume `app.js` se conservan; `file`, `fileinfo`, `drop`, `history`, `historyCount`, `clearHistory` y `numeroLote` se generan en `setTab`.
- Cambios de `app.js` relacionados con la interfaz:
  - `#vaultBadge.dataset.state` con `ready`, `locked` o `setup`.
  - Clases `cell-ok` y `cell-error` en la segunda celda de la tabla de resultados.
  - Aviso de validación inline (`#formAlert`), aviso de operación irreversible, arrastrar y soltar, clase `.loading`, barra del historial y plegado de la barra lateral.
  - `setTab()` alterna `#fields.fields-grow` solo en la operación de carga y oculta el contenedor `.actions` en el historial.
  - `resetDownloads()` vuelve a pintar el placeholder `.results-empty`.
  - La lógica SOAP, la criptografía y el formato de los registros del historial no cambian.
- La preferencia de plegado se guarda en `localStorage` (`sepSidebarCollapsed`), separada de la bóveda y del historial de `chrome.storage.local`.
- Si cambia la altura del header, actualiza `--header-h`; el sidebar de escritorio permanece fijo al viewport y no depende de ese offset.
- La tipografía usa la pila del sistema; no se cargan fuentes externas.
- Los iconos son SVG inline de 16 px, con `stroke: currentColor`.
- No se usan imágenes ni recursos remotos.

## Verificación

- `node --check app.js` sin errores.
- Auditoría de IDs entre `index.html` y `app.js`.
- Renderizado con Chrome headless en 1440, 760 y 540 px, con `chrome.storage` simulado, para los estados:
  - Bóveda bloqueada y desbloqueada.
  - Carga con zona de arrastre.
  - Cancelación con aviso irreversible.
  - Historial vacío con barra superior.
  - Error de validación inline y botón en estado de carga.
- En headless, las capturas se tomaron con `--force-prefers-reduced-motion`: sin eso, las transiciones CSS quedan congeladas en el primer frame y el estado activo de la navegación puede verse desfasado aunque el DOM sea correcto.
- Chrome headless en Windows impone un ancho mínimo de 500 px.
- La verificación visual no sustituye cargar la extensión en Chrome/Edge ni probar el flujo SOAP real.

## Limitaciones y mejoras futuras

Ideas para una siguiente iteración, no implementadas:

- Icono de extensión y favicon con la identidad institucional.
- Tema oscuro opcional.
- Prioridad de columnas en tablas angostas.
- Auditoría WCAG formal y pruebas con lectores de pantalla.
- Pruebas automatizadas de UI y regresión visual.
- Internacionalización; actualmente la interfaz está en español.
- Preferencias de densidad o tipografía.

## Referencias

- [README técnico](../README.md)
- [Manual de usuario](MANUAL_DE_USUARIO.md)
- `index.html`, `style.css`, `app.js`
