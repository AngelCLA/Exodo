# Seguridad

Éxodo es una herramienta gratuita e independiente, desarrollada por CLA Tech.
No está afiliada ni certificada por la SEP, ni es un servicio operado por SEP.
Requiere credenciales institucionales autorizadas. No se ha realizado una
auditoría de seguridad formal.
El alcance de este documento es el código de este repositorio y su uso local
como extensión de Chrome/Edge.

## Reportar un problema

- No publiques credenciales, contraseñas, tokens, XML de estudiantes, folios,
  respuestas SOAP, capturas con datos reales ni otros datos sensibles en un
  issue o pull request.
- Si este repositorio muestra habilitada la opción de **Private vulnerability
  reporting** en GitHub, úsala para enviar los detalles de forma privada.
- Si esa opción no está disponible, abre únicamente un issue público sin
  detalles sensibles para solicitar un canal privado; no incluyas el problema,
  pruebas de explotación ni datos reales en ese issue.
- Para problemas no sensibles, puedes abrir un issue con pasos mínimos para
  reproducirlos y una descripción del impacto.

Incluye, cuando sea seguro, la versión o commit afectado, el entorno, pasos de
reproducción con datos ficticios y una posible mitigación. No pruebes contra
sistemas de SEP/MET sin autorización.

## Privacidad y límites

- La bóveda, los archivos seleccionados y el historial se procesan o guardan localmente; esos datos pueden seguir siendo sensibles.
- No hay analítica ni backend propio. En una operación autorizada, las credenciales y el XML necesario se transmiten al endpoint oficial de SEP/MET.
- La configuración del nombre institucional es una preferencia local, no una credencial y no modifica el flujo SOAP.

## Límites y precauciones

- Las operaciones de carga y cancelación pueden tener efectos reales; prueba
  primero con datos y entornos autorizados.
- Las pruebas automatizadas del repositorio no deben conectarse en vivo a SEP.
- La existencia de este documento no implica soporte, garantía de respuesta ni
  una certificación de seguridad del prototipo.
