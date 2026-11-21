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

Registra cliente, teléfono, descripción, valor y abono inicial. El vencimiento inicial se calcula a un mes calendario desde la creación (si el siguiente mes no tiene ese día, se usa su último día). Los abonos no cambian el plazo. Para un caso excepcional, usa **Extender por excepción**: se proponen 15 días desde el vencimiento actual, puedes elegir una fecha posterior y debes registrar un motivo. El historial aparece en **Ver abonos**. Los separados existentes conservan su vencimiento. Agrega abonos desde la tarjeta; cuando el saldo llega a cero aparece como pagado. Las alertas de vencimiento se calculan al abrir o usar la página; no hay notificaciones automáticas con la página cerrada. El botón **Preparar SMS** pide confirmación y abre la aplicación de mensajes del dispositivo con un borrador. La entrega requiere que el dispositivo admita enlaces SMS y que confirmes el envío allí; el servicio puede generar cargos. No se envían mensajes automáticamente ni se registra su entrega.

## Relación con el sistema actual

En el proyecto existente, `SeparatedPage.tsx` agrupa prendas, registra abonos y presenta el saldo. El servidor maneja abonos, movimientos de caja, inventario y liberación al vencer; algunas consultas ejecutan la liberación. Esta aplicación conserva un control independiente para no provocar esos efectos. Si se requiere sincronización real, hace falta un servidor accesible por HTTPS con autenticación y autorización del propietario, y acordar cómo integrar de forma segura las operaciones existentes.

## Sincronizar con Google Sheets

La sincronización requiere internet, una hoja privada exclusiva y configurar Google Cloud. Los datos en la hoja permanecen cifrados con la contraseña de Separados. La cuenta de Google controla el acceso al archivo; la contraseña de Separados descifra los registros. No se guarda la contraseña en Google. Usa la misma contraseña del archivo al abrirlo en otro dispositivo.

1. Crea una hoja vacía en Google Sheets y mantenla privada, accesible solo a tu cuenta. Copia el identificador de su URL: el texto entre `/d/` y `/edit`.
2. En Google Cloud Console crea un proyecto, activa **Google Sheets API** y configura la pantalla de consentimiento de OAuth. Si la aplicación está en modo de prueba externo, agrega tu cuenta como usuario de prueba. Google puede mostrar una advertencia de aplicación no verificada y limitar la duración de la autorización.
3. Crea un ID de cliente OAuth de tipo **Aplicación web**. Agrega a **Orígenes autorizados de JavaScript** el origen exacto de la aplicación, por ejemplo `http://localhost:8000` para pruebas y `https://TU-USUARIO.github.io` para GitHub Pages. No publiques secretos de cliente ni claves privadas. El ID de cliente no es un secreto.
4. En Separados, inicia sesión localmente, ingresa el ID de cliente y el ID de la hoja y pulsa **Conectar con Google**. Autoriza con la cuenta dueña de la hoja. La primera vez puedes subir los registros locales; en otro dispositivo, crea una contraseña local provisional, conecta la misma hoja y usa la contraseña de la copia remota para cargarla.
5. Mientras la conexión esté activa, los cambios se guardan en este navegador y se intentan sincronizar automáticamente; el estado muestra si falló. Al volver a abrir la aplicación debes conectar Google nuevamente. También puedes pulsar **Sincronizar ahora**.

La aplicación usa la pestaña `SeparadosCifrado` y la administra por completo: no edites sus celdas. Si detecta una versión remota distinta, detiene la subida para evitar reemplazarla. Exporta primero una copia local si deseas conservar ambos conjuntos; al reconectar puedes cargar la versión remota, que reemplaza la local. Evita editar simultáneamente desde dos dispositivos: la comprobación de versión no es un bloqueo transaccional y dos escrituras simultáneas podrían sobrescribirse. Mantén copias de seguridad cifradas. Si se interrumpe la conexión o caduca la autorización, reconecta y verifica el estado antes de cambiar de dispositivo. La autorización solicitada permite a la aplicación acceder a hojas disponibles para la cuenta; usa una cuenta dedicada si necesitas limitar ese alcance.
