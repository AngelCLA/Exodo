# Manual de usuario — Éxodo

Guía práctica para instalar y usar la extensión. Está pensada para personal operativo con credenciales SEP/MET y archivos XML generados por SATE.

> **Importante:** El usuario reportó que pudo enviar varios XML, recibir identificadores/folios, consultar y descargar resultados con ellos, y operar todas las funciones en el entorno disponible. Este reporte no identifica el entorno ni sustituye una validación formal de producción o del WSDL. La carga y la cancelación pueden tener efectos reales en la SEP.

## Contenido

1. [Antes de empezar](#antes-de-empezar)
2. [Instalación](#instalación)
3. [Primer uso: crear la bóveda](#primer-uso-crear-la-bóveda)
4. [Abrir y desbloquear](#abrir-y-desbloquear)
5. [Recorrido de la interfaz](#recorrido-de-la-interfaz)
6. [Operaciones](#operaciones)
7. [Resultados y descargas](#resultados-y-descargas)
8. [Historial](#historial)
9. [Bloquear, cambiar o borrar credenciales](#bloquear-cambiar-o-borrar-credenciales)
10. [Seguridad y buenas prácticas](#seguridad-y-buenas-prácticas)
11. [Mensajes frecuentes](#mensajes-frecuentes)
12. [Limitaciones conocidas](#limitaciones-conocidas)
13. [Preguntas frecuentes](#preguntas-frecuentes)
14. [Glosario](#glosario)
15. [Documentación relacionada](#documentación-relacionada)

## Antes de empezar

Necesitas:

- Chrome o Edge de escritorio con soporte para extensiones Manifest V3.
- Acceso a `https://met.sep.gob.mx/*`.
- Credenciales SEP/MET válidas.
- Un archivo XML generado por SATE para la operación de carga.

La extensión no incluye datos de prueba ni un entorno simulado. Si vas a probar con títulos reales, hazlo en un entorno autorizado y con las precauciones de tu institución.

## Instalación

1. Descomprime la carpeta del proyecto.
2. Abre `chrome://extensions` o `edge://extensions`.
3. Activa **Modo desarrollador**.
4. Pulsa **Cargar descomprimida**.
5. Selecciona la carpeta que contiene `manifest.json`.
6. Pulsa el icono de la extensión. Se abre la interfaz en una pestaña nueva.

Para actualizar la extensión, reemplaza los archivos y pulsa **Recargar** en la página de extensiones.

## Primer uso: crear la bóveda

La primera vez que abras la extensión se abrirá el desplegable **Acceso institucional MET** desde **Configurar acceso**, en la cabecera.

1. Escribe tu **Usuario SEP**.
2. Escribe tu **Contraseña SEP**.
3. Crea una **Contraseña maestra** de al menos 12 caracteres.
4. Repite la contraseña maestra en **Confirmar contraseña maestra**.
5. Pulsa **Guardar y desbloquear**.

La extensión cifra el usuario y la contraseña SEP y los guarda en el perfil del navegador. La contraseña maestra **no se guarda**.

> **No olvides tu contraseña maestra.** No existe recuperación. Si la pierdes, tendrás que borrar la bóveda y configurar credenciales nuevas.

## Abrir y desbloquear

Cuando vuelvas a abrir la extensión, o después de reiniciar el navegador, se abrirá el formulario desde **Desbloquear**, en la cabecera.

1. Escribe tu contraseña maestra.
2. Pulsa **Desbloquear** o presiona `Enter`.

El desplegable se cierra y la cabecera muestra **● usuario · Bloquear**. Mientras la sesión esté desbloqueada, las operaciones usan automáticamente las credenciales guardadas. Pulsa el usuario para desplegar las acciones secundarias; pulsa de nuevo para cerrarlas.

Si ves **Configurar acceso**, sigue los pasos de la sección anterior.

## Recorrido de la interfaz

- **Header:** muestra la marca, el título y el acceso institucional desplegable.
- **Barra lateral:** contiene las seis operaciones, incluida **Configuración**. La operación activa se resalta en azul. En escritorio, la barra permanece fija mientras desplazas el panel principal; el botón de la esquina superior la pliega a iconos (con tooltip) y recuerda la preferencia. En ventanas de hasta 820 px muestra solo la cabecera y el botón al cerrarse; pulsa el botón para abrir las opciones, que se cierran automáticamente al seleccionar una.
- **Panel principal:** muestra el título de la operación, los campos y los botones de acción, sin tarjeta de credenciales.
- **Configuración:** permite personalizar el nombre de la institución que se muestra localmente. El valor tiene un límite de 120 caracteres, se guarda solo en este navegador y no es una credencial ni cambia las solicitudes SOAP.
- **Panel de respuesta:** muestra el estado HTTP, el resumen, la tabla de resultados, los XML y las descargas.

### Configuración e identidad institucional

1. Selecciona **Configuración** en la barra lateral.
2. Escribe el nombre de la institución (hasta 120 caracteres).
3. Pulsa **Guardar nombre** para conservarlo localmente, o **Usar identidad genérica** para quitarlo y volver a mostrar **Éxodo**.

Esta preferencia solo cambia el nombre visible en la interfaz. No modifica la bóveda, el historial, las credenciales ni el contenido de las solicitudes SOAP.

Botones principales:

- **Ver solicitud SOAP:** construye la solicitud localmente y la muestra con la contraseña y el Base64 ocultos. **No envía nada.**
- **Enviar a SEP:** envía la solicitud real al servicio.
- **Guardar respuesta XML:** descarga el XML de respuesta cuando existe.
- **Descargar ZIP de resultados:** descarga el ZIP detectado en la respuesta, cuando existe.

## Operaciones

### Cargar título

1. Selecciona **Cargar título** en la barra lateral.
2. En **Archivo XML generado por SATE**, pulsa **Seleccionar archivo** o arrastra el archivo a la zona punteada. Puedes elegir un `.xml` o un `.zip` con varios XML.
3. Verifica lo que aparece bajo el selector: el nombre y el tamaño del XML, o el nombre del ZIP y cuántos XML contiene.
4. Opcionalmente, pulsa **Ver solicitud SOAP** para revisar la solicitud enmascarada. Con un ZIP, la vista previa corresponde al primer XML y se avisa de que cada archivo se enviará por separado.
5. Pulsa **Enviar a SEP** (o presiona `Enter` en un campo del formulario).
6. Revisa el resumen, la tabla de cada archivo con su lote, el XML de respuesta y el número de lote si el servicio lo devuelve.

Si falta un dato o el archivo no es válido, el mensaje aparece justo debajo del formulario y también en el resumen del panel derecho.

La extensión comprueba que cada XML sea parseable, que la raíz sea `TituloElectronico` y que tenga `folioControl`. También rechaza localmente los XML mayores de 1 MiB (1.048.576 bytes), antes de leerlos o enviarlos. No valida contra XSD.

### Cargar varios títulos desde un ZIP

Un ZIP con varios XML permite cargar un lote de títulos sin elegir los archivos uno por uno.

1. Prepara un `.zip` con los XML generados por SATE. Puede tener subcarpetas; cada XML debe estar en formato `.xml` y no superar 1 MiB. El ZIP completo no debe superar 50 MiB.
2. Selecciónalo o arrástralo en **Cargar título**. La extensión lo descomprime **solo en este navegador**, ignora los archivos que no son `.xml` y las carpetas internas del sistema (`__MACOSX`), y muestra cuántos XML encontró.
3. Pulsa **Enviar a SEP**. Aparece una confirmación con el número de XML que se enviarán.
4. Al confirmar, la extensión envía **un XML a la vez**, cada uno en su propia solicitud SOAP. La tabla del panel derecho se actualiza con el archivo, su lote y el resultado de cada envío.
5. Al terminar, revisa el resumen: XML procesados, enviados, con error y los números de lote obtenidos. Cada envío correcto queda también en el historial.

El **ZIP no se envía a la SEP** en ningún momento: solo viaja cada XML por separado. Si un XML es inválido o la respuesta de ese envío es incierta, se marca en la tabla y el resto continúa. La selección se limpia al terminar para evitar reenvíos accidentales: para corregir archivos, prepara un ZIP nuevo.

### Consultar lote

1. Selecciona **Consultar lote**.
2. Escribe el número de lote. Debe ser un entero positivo.
3. Pulsa **Ver solicitud SOAP** si quieres revisar la solicitud.
4. Pulsa **Enviar a SEP**.
5. Revisa el estado, el resumen y el XML.

Si la respuesta contiene un ZIP en Base64, la extensión intentará leer el XLSX y mostrar la tabla de resultados.

### Descargar lote

1. Selecciona **Descargar lote**.
2. Escribe el número de lote.
3. Pulsa **Enviar a SEP**.
4. Si se detecta un ZIP, aparecerá **Descargar ZIP de resultados**.
5. Si el ZIP contiene un XLSX reconocible, se mostrará la tabla.

### Cancelar título

> Esta operación ejecuta una **cancelación real**. No tiene deshacer. La interfaz muestra un aviso rojo sobre el formulario y pide confirmación antes de enviar.

1. Selecciona **Cancelar título**.
2. Escribe el **Folio de control**.
3. Escribe el **Motivo de cancelación**.
4. Pulsa **Enviar a SEP**.
5. Confirma el diálogo, que muestra el folio afectado.
6. Revisa el XML de respuesta para confirmar el resultado.

### Cancelar por institución

> Esta operación ejecuta una **cancelación real**. No tiene deshacer. La interfaz muestra un aviso rojo sobre el formulario y pide confirmación antes de enviar.

1. Selecciona **Cancelar por institución**.
2. Escribe el **Folio de control**.
3. Escribe la **Clave de institución**.
4. Escribe el **Motivo de cancelación**.
5. Pulsa **Enviar a SEP** y confirma el diálogo.
6. Revisa el XML de respuesta.

### Historial de lotes

1. Selecciona **Historial de lotes**.
2. La tabla agrupa los movimientos por **número de lote** y muestra la fecha de creación (primera carga), la última consulta y la última descarga.
3. Usa las acciones de cada fila:
   - **Consultar**: consulta ese lote de inmediato y actualiza la fecha de consulta. La respuesta aparece en el panel derecho.
   - **Descargar**: solicita la descarga del lote y actualiza su fecha. Si la respuesta trae un ZIP/XLSX, la tabla de resultados aparece en el panel derecho y puedes descargar el ZIP.
   - **Cancelar**: abre un formulario en el mismo panel con folio y motivo. Si el lote tiene un solo folio registrado, se rellena automáticamente; si tiene varios, debes capturarlo. Después pide la confirmación habitual de cancelación real.
4. Las operaciones sin número de lote, como las cancelaciones iniciadas desde su propio panel, aparecen en **Otras operaciones**, debajo de la tabla.

Las acciones del historial no sustituyen los paneles de la barra lateral: si solo necesitas una operación, o prefieres capturarla a mano o previsualizar el XML antes de enviarlo, puedes seguir usando **Consultar lote**, **Descargar lote** y **Cancelar título** desde sus paneles.

El historial se guarda solo en este navegador y conserva hasta 250 movimientos. Al borrar los datos de la extensión o desinstalarla también se elimina.

## Resultados y descargas

### Resumen

El panel de respuesta muestra:

- Estado HTTP y tiempo de respuesta.
- Si la solicitud HTTP fue aceptada. **Esto no implica que el trámite haya tenido éxito.**
- Número de lote, estado/código, mensaje y, si existe, el SOAP Fault.
- La recomendación de revisar siempre el XML completo.

### Estados del envío

- **No se envió:** una validación local rechazó los datos antes de despachar la solicitud.
- **Estado HTTP:** aparece cuando se recibió una respuesta HTTP; se conserva el XML aunque HTTP sea un error o contenga un SOAP Fault. Revisa el XML y el mensaje del servicio.
- Si rechazas la confirmación de cualquiera de las cancelaciones, la operación termina sin red ni historial y el estado visible permanece sin cambios; no se muestra un nuevo mensaje literal de estado.
- **Resultado incierto:** un timeout o la pérdida de la respuesta ocurre después del despacho posible. Consulta la SEP con los datos disponibles antes de reintentar; no hay reintento automático. Un timeout no demuestra que SEP no haya procesado la solicitud.
- **Aviso de historial:** si la respuesta llegó pero falla el guardado local, la respuesta y sus resultados permanecen visibles en pantalla; vuelve a guardarlos si necesitas conservarlos.

### Tabla de resultados

Cuando la respuesta contiene un ZIP con un XLSX reconocible, se muestra una tabla con:

| Columna | Contenido |
| --- | --- |
| Archivo | Nombre del archivo del título. |
| Estatus | `1 · Correcto` o `2 · Error`. |
| Descripción | Mensaje del servicio. |
| Folio control | Folio del título. |

La tabla muestra hasta 2000 filas. En ventanas angostas puede requerir desplazamiento horizontal. Si el XLSX no tiene las columnas esperadas, se muestra un mensaje y puedes descargar el ZIP original.

### XML

- **XML de respuesta:** respuesta completa del servicio.
- **XML de solicitud (credenciales ocultas):** solicitud construida localmente, con la contraseña y el Base64 enmascarados.

### Descargas

- **Guardar respuesta XML:** descarga el XML de respuesta.
- **Descargar ZIP de resultados:** descarga el ZIP detectado en la respuesta.

## Bloquear, cambiar o borrar credenciales

- **Bloquear** (en la cabecera): borra las credenciales de la memoria de la pestaña. Debes desbloquear de nuevo para operar.
- **Cambiar credenciales** (pulsa el usuario en la cabecera para desplegarlo): requiere la sesión desbloqueada. Pide confirmación, borra la bóveda y muestra el formulario para configurar credenciales nuevas. El historial se conserva.
- **Olvidé la contraseña maestra / borrar credenciales** (dentro del desplegable): borra la bóveda y permite configurarla de nuevo. El historial se conserva.

Estados del badge:

| Estado | Significado |
| --- | --- |
| **Configurar acceso** | No existe una bóveda en este navegador. |
| **Desbloquear** | La bóveda existe, pero las credenciales están cifradas. |
| **● usuario · Bloquear** | Las credenciales están disponibles en memoria para esta pestaña. |

## Seguridad y buenas prácticas

- Usa un perfil institucional controlado. Evita equipos compartidos.
- No compartas tu contraseña maestra.
- Bloquea la sesión cuando te alejes del equipo.
- El historial **no está cifrado** a nivel de aplicación y puede contener datos personales.
- No compartas capturas, XML ni ZIP con credenciales o datos reales.
- La carga y la cancelación pueden tener efectos reales. Prueba primero en un entorno autorizado.
- Al desinstalar la extensión o borrar sus datos, se eliminan la bóveda y el historial.
- No hay analítica ni backend propio. Los archivos, resultados y el historial se procesan o guardan localmente; el historial puede contener datos personales y sigue siendo sensible.
- En una operación autorizada, las credenciales y el XML necesario se transmiten al endpoint oficial de SEP/MET. No se envían a proveedores externos.

## Mensajes frecuentes

| Mensaje o síntoma | Causa probable | Qué hacer |
| --- | --- | --- |
| `Desbloquea las credenciales institucionales antes de continuar.` | La bóveda está bloqueada o sin configurar. | Desbloquea o configura la bóveda. |
| `Selecciona un XML generado por SATE.` | No hay archivo seleccionado. | Selecciona el XML. |
| `Este prototipo acepta archivos .xml.` | El archivo no tiene extensión `.xml`. | Usa el XML generado por SATE. |
| `El XML supera el límite de 1 MiB (1.048.576 bytes). No se leyó ni se envió el archivo.` | El XML supera el límite local inclusivo de 1 MiB. | Selecciona un XML más pequeño. Este límite no representa una política oficial de SEP. |
| `El ZIP no contiene archivos .xml.` | El ZIP no incluye XML o solo contiene otros formatos. | Prepara un ZIP con los XML generados por SATE. |
| `El ZIP supera el límite local de 50 MiB (52.428.800 bytes). No se leyó ni se envió.` | El ZIP es demasiado grande. | Divide el contenido en varios ZIP más pequeños. |
| `El XML <archivo> supera el límite de 1 MiB (1.048.576 bytes). No se leyó ni se envió.` | Un XML dentro del ZIP supera el límite por archivo. | Revisa o reduce ese XML antes de volver a comprimir. |
| `Archivo ZIP sin directorio central válido.` | El ZIP está dañado o se generó de forma incompleta. | Vuelve a comprimir los XML y selecciona el ZIP nuevo. |
| `El XML no tiene el elemento TituloElectronico y su folioControl.` | El XML no es el esperado o está incompleto. | Verifica el archivo de SATE. |
| `El número de lote debe ser un entero positivo.` | Se escribió texto o un valor inválido. | Escribe solo dígitos. |
| `Captura folio y motivo de cancelación.` | Faltan campos de cancelación. | Completa folio y motivo. |
| `Captura la clave de institución.` | Falta la clave de institución. | Completa el campo. |
| `Contraseña maestra incorrecta o datos cifrados dañados.` | Contraseña incorrecta o bóveda dañada. | Reintenta; si olvidaste la contraseña, borra la bóveda. |
| `La contraseña maestra debe tener al menos 12 caracteres.` | La contraseña es demasiado corta. | Usa 12 caracteres o más. |
| `Las contraseñas maestras no coinciden.` | La confirmación es distinta. | Repite la misma contraseña. |
| `Completa usuario y contraseña de SEP.` | Campos vacíos al configurar. | Completa ambos campos. |
| `No hay credenciales guardadas.` | No existe una bóveda. | Configura la bóveda. |
| `El ZIP no contiene un libro Excel XLSX reconocible.` | El ZIP no incluye un XLSX o usa otro formato. | Descarga el ZIP y revísalo. |
| `Se encontró Excel, pero no las columnas Archivo, Estatus, Descripción y Folio control.` | El XLSX usa otros nombres u orden. | Revisa el archivo; la tabla no se puede mostrar. |
| `Error de conexión` o `Error HTTP o SOAP` | Red, endpoint, credenciales o servicio. | Revisa la conexión, las credenciales y el XML completo. Si hay XML, la respuesta se conserva. |
| `La respuesta no es XML válido` | El servicio devolvió HTML u otro formato. | Revisa el estado HTTP y el XML de respuesta. |
| `No se envió` | Falló una validación local antes del despacho. | Corrige los datos. Si rechazas una cancelación, la interfaz conserva el estado visible anterior y no envía la operación. |
| `Resultado incierto` | Timeout o pérdida de respuesta después del despacho posible. | Consulta SEP antes de reintentar. La extensión no reintenta automáticamente. |
| `La respuesta se recibió, pero no se pudo guardar el historial` | Falló el almacenamiento local después de la respuesta. | Conserva o descarga la respuesta visible y revisa el almacenamiento del navegador. |
| Los botones de envío están deshabilitados. | La bóveda está bloqueada. | Desbloquea la sesión. |
| `Hay una operación en curso; espera a que termine.` | Se intentó ejecutar otra acción del historial mientras la anterior seguía en curso. | Espera el resultado de la operación actual y vuelve a intentarlo. |
| `Sin movimientos todavía.` | El historial está vacío. | Realiza una operación. |
| No aparece la tabla de resultados. | La respuesta no contiene un ZIP/XLSX reconocible. | Descarga el XML o el ZIP y revísalo. |

## Limitaciones conocidas

- No se documentó una validación formal en producción ni contra el WSDL completo; el usuario sí reportó pruebas reales exitosas de las operaciones descritas al inicio.
- `SOAPAction`, namespaces y campos de respuesta están pendientes de validar contra el WSDL.
- No se valida el XML contra XSD; solo se comprueba su sintaxis.
- La detección de ZIP/XLSX es heurística y puede no funcionar con todos los lotes.
- No hay consulta automática por lotes; la consulta es manual.
- Un ZIP se envía XML por XML, de forma secuencial. No hay envío en paralelo ni reanudación: si interrumpes el proceso, los XML restantes no se envían.
- El límite local de 50 MiB para el ZIP y de 1 MiB por XML no representan políticas oficiales de SEP.
- El historial agrupa por lote al mostrarse. Si un lote tiene varios folios registrados, la cancelación desde el historial exige capturar el folio.
- No hay eliminación de registros desde la interfaz: el historial se conserva. Solo se pierde al borrar los datos de la extensión o desinstalarla.
- El historial no está cifrado y no tiene política de retención.
- No hay soporte para móviles; es una extensión de escritorio.
- Las pruebas automatizadas cubren bóveda, carga y estados de envío con runtime y almacenamiento simulados; no sustituyen llamadas reales a SEP ni una auditoría WCAG formal.

## Preguntas frecuentes

**¿Dónde se guardan mis credenciales?**
En `chrome.storage.local`, cifradas con AES-256-GCM. La contraseña maestra y la clave derivada no se guardan. Al desbloquear, las credenciales viven en memoria de la pestaña.

**¿Qué pasa si olvido la contraseña maestra?**
No se puede recuperar. Usa **Olvidé la contraseña maestra / borrar credenciales** y configura la bóveda de nuevo. El historial se conserva.

**¿El historial está cifrado?**
No. Se guarda en el perfil del navegador y puede contener datos personales.

**¿La extensión envía datos a terceros?**
No hay analítica ni backend propio. En una operación autorizada, las credenciales y el XML necesario se envían al endpoint oficial de SEP/MET; el ZIP/XLSX, la bóveda y el historial se procesan o guardan localmente.

**¿Puedo usarla en el celular?**
No. Es una extensión de Chrome/Edge de escritorio.

**¿Qué significan los estatus 1 y 2?**
`1` se muestra como correcto y `2` como error, según el flujo operativo descrito. No se asume que todos los lotes usen el mismo formato.

**¿Puedo cancelar un título?**
Sí, pero es una cancelación real. La extensión pide confirmación y no tiene deshacer.

**¿Cómo borro el historial?**
La extensión no incluye una acción para borrarlo: el historial se conserva para no perder información. Solo se elimina al borrar los datos de la extensión o desinstalarla.

## Glosario

- **Bóveda:** almacén cifrado de las credenciales SEP dentro del navegador.
- **Folio de control:** identificador del título dentro del XML.
- **Lote:** número que agrupa un envío o procesamiento.
- **SOAP:** protocolo de mensajería basado en XML.
- **XML:** formato de datos usado en la solicitud y la respuesta.
- **XLSX:** libro de Excel que puede venir dentro del ZIP de resultados.
- **ZIP:** archivo comprimido que puede contener los resultados del lote.
- **SATE:** sistema que genera el XML de entrada.
- **SEP:** Secretaría de Educación Pública.
- **MET:** servicio de la SEP al que apunta la extensión.
- **Título electrónico:** documento digital que se carga, consulta, descarga o cancela.

## Documentación relacionada

- [README técnico](../README.md)
- [Notas de diseño UI/UX](DISENO_UI.md)
