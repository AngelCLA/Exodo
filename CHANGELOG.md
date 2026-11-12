# Changelog

Cambios relevantes de Éxodo. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el versionado [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

### Añadido

- **Vista previa de resultados en formato XLS.** Si el ZIP de resultados contiene un libro de Excel 97-2003 (`.xls`), la extensión lo lee localmente y muestra en pantalla la tabla con **Archivo**, **Estatus**, **Descripción** y **Folio control**, igual que con `.xlsx`. Ya no hace falta descargar el ZIP para ver el resultado; la descarga sigue disponible para conservar el archivo original.
- Pruebas con libros `.xls` y `.xlsx` reales (`tests/xls-results.test.cjs`) que cubren la lectura local y la descarga de un lote.

### Cambiado

- El lector de Excel comparte la detección de columnas entre XLS y XLSX y valida el formato del libro para no mostrar datos incorrectos.
- README, manual de usuario y mensajes de error actualizados para mencionar ambos formatos.

## [1.1.0] - 2026-11-11

### Añadido

- **Carga de varios títulos en una sola selección.** En la operación de carga se acepta un `.zip` (hasta 50 MiB) además de un `.xml`. El ZIP se descomprime localmente en el navegador y **nunca se transmite**; se filtran sus `.xml` y se envía una solicitud SOAP independiente por cada uno, con su nombre y contenido en Base64. Los XML inválidos se reportan sin bloquear al resto de los archivos.
- **Historial de lotes en tabla.** Agrupa los movimientos por número de lote y muestra fecha de creación, última consulta y última descarga, con acciones **Consultar**, **Descargar** y **Cancelar** ejecutables en el mismo panel. Conserva hasta 250 movimientos locales y lista aparte las operaciones sin lote.
- Pruebas automatizadas para la carga por ZIP (`tests/zip-upload.test.cjs`) y el historial en tabla (`tests/history-table.test.cjs`).

### Cambiado

- Cada XML se valida por separado contra el límite local inclusivo de 1 MiB (1.048.576 bytes) antes de leerse o enviarse, tanto en archivo único como dentro del ZIP.
- Estilos de la zona de carga, del historial y de la tabla de resultados.
- README, manual de usuario y notas de diseño actualizados para la carga por ZIP y el historial por lote.
- La verificación documentada usa `node --test "tests/*.test.cjs"` para toda la batería de pruebas.

### Notas

- Los paneles individuales por operación siguen disponibles para el trabajo manual.
- El límite de 1 MiB por XML y el de 50 MiB para el ZIP son locales y no representan una política oficial de SEP.
- Cargar y cancelar títulos siguen teniendo efectos reales ante el servicio de SEP/MET.

## [1.0.0] - 2026-11-04

### Añadido

- Versión inicial de la extensión Manifest V3: carga, consulta, descarga, cancelación de títulos y cancelación por institución mediante las cinco solicitudes SOAP de SEP/MET.
- Bóveda de credenciales cifrada con AES-256-GCM y PBKDF2-SHA256 en `chrome.storage.local`, contraseña maestra y bloqueo de sesión.
- Vista previa de la solicitud SOAP con credenciales enmascaradas, resumen de respuesta, tabla de resultados, detección de ZIP/XLSX y descargas locales.
- Historial local de hasta 250 movimientos e identidad institucional configurable.
- Envío a través del service worker con endpoint permitido, timeout de 45 s y manejo de resultados inciertos.
- Documentación (`README.md`, manual de usuario, notas de diseño, contribución y seguridad) y pruebas con dobles locales de `chrome.*`.

[1.1.0]: https://github.com/AngelCLA/Exodo/compare/1.0.0...1.1.0
[1.0.0]: https://github.com/AngelCLA/Exodo/releases/tag/1.0.0
