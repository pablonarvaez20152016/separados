# Separados

Aplicación independiente para controlar separados y abonos. El proyecto original no se modifica ni se conecta automáticamente: los registros deben ingresarse o importarse desde una copia de esta aplicación. Los abonos aquí registrados **no actualizan caja, inventario ni el sistema existente**.

## Publicar en GitHub Pages

1. Crea un repositorio llamado `separados` y sube el contenido de esta carpeta a su raíz. No incluyas copias de seguridad ni contraseñas en el repositorio.
2. En GitHub, abre **Settings → Pages**, selecciona **Deploy from a branch**, rama `main` y carpeta `/ (root)`; guarda.
3. Abre la dirección HTTPS que muestra Pages y crea una contraseña de al menos 12 caracteres. Comparte la URL solo si lo deseas: GitHub Pages puede ser público, pero los datos se cifran localmente.

Para ejecutar localmente, sirve la carpeta desde `localhost`, por ejemplo `python -m http.server 8000`, y abre `http://localhost:8000`. No abras el archivo directamente.

## Seguridad y respaldo

Los registros se cifran en el navegador con AES-256-GCM y una clave derivada de la contraseña mediante PBKDF2-SHA-256 (600.000 iteraciones). La contraseña no se almacena ni existe recuperación. Cada navegador y dispositivo mantiene sus propios datos; cerrar sesión bloquea la pantalla, pero no sincroniza dispositivos ni elimina los datos. Exporta regularmente una copia cifrada y guárdala en un lugar seguro; para restaurar se necesita la contraseña usada al exportarla. Borrar datos del navegador también elimina los registros locales. El cifrado no protege frente a malware, extensiones maliciosas o una versión del sitio alterada; protege tu cuenta de GitHub con 2FA y controla quién puede publicar el sitio.

## Uso

Registra cliente, teléfono, descripción, valor, vencimiento y abono inicial. Agrega abonos desde la tarjeta; cuando el saldo llega a cero aparece como pagado. Las alertas de vencimiento se calculan al abrir o usar la página; no hay notificaciones automáticas con la página cerrada. El botón **Preparar SMS** pide confirmación y abre la aplicación de mensajes del dispositivo con un borrador. La entrega requiere que el dispositivo admita enlaces SMS y que confirmes el envío allí; el servicio puede generar cargos. No se envían mensajes automáticamente ni se registra su entrega.

## Relación con el sistema actual

En el proyecto existente, `SeparatedPage.tsx` agrupa prendas, registra abonos y presenta el saldo. El servidor maneja abonos, movimientos de caja, inventario y liberación al vencer; algunas consultas ejecutan la liberación. Esta aplicación conserva un control independiente para no provocar esos efectos. Si se requiere sincronización real, hace falta un servidor accesible por HTTPS con autenticación y autorización del propietario, y acordar cómo integrar de forma segura las operaciones existentes.
