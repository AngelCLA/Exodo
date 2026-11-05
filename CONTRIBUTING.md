# Contribuir

Gracias por tu interés en mejorar Éxodo. Este repositorio contiene un prototipo
abierto para interactuar con servicios SOAP de SEP/MET; las contribuciones deben
mantener ese alcance y evitar efectos reales durante las pruebas.

## Flujo rápido

1. Crea una rama a partir de la versión actual.
2. Haz un cambio enfocado y explica su propósito en el pull request.
3. Ejecuta las comprobaciones locales:

   ```bash
   node --check app.js
   node --test tests/*.test.cjs
   ```

   No hay dependencias de npm ni proceso de compilación en el repositorio.
4. Describe las pruebas realizadas y cualquier limitación conocida.

## Reglas para cambios

- No incluyas credenciales, contraseñas, tokens, datos personales ni XML de
  estudiantes en commits, issues, fixtures o capturas.
- No realices llamadas en vivo a SEP/MET desde las pruebas automatizadas.
  Usa los dobles de navegador, almacenamiento y respuestas ya presentes en
  `tests/`.
- Mantén las pruebas deterministas y centradas en el comportamiento que cambia.
- Conserva la separación entre la interfaz, el service worker y la documentación.
- No presentes el prototipo como un producto oficial de SEP ni como software
  auditado.
- Para cambios que puedan cargar o cancelar títulos, documenta claramente el
  riesgo y evita ejecutarlos contra datos reales.

## Pull requests

Incluye un resumen breve, los archivos afectados, los comandos ejecutados y
los riesgos o pasos manuales pendientes. Los cambios pequeños y revisables son
preferibles a una refactorización amplia sin relación con el objetivo.

## Licencia

Al contribuir, aceptas que tu aporte se distribuya bajo la [Licencia MIT](LICENSE).
