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

Para invitar a una clienta a seguir las redes de Koquetas Boutique, pulsa **Invitar a redes** en su tarjeta. La aplicación prepara un mensaje con los enlaces de TikTok e Instagram y abre la aplicación de SMS para revisarlo y enviarlo manualmente. La app no envía mensajes automáticamente ni comprueba su entrega.

## Importar contactos de Google

En contacts.google.com selecciona los contactos y usa Exportar → CSV de Google. En la aplicación usa **Importar contactos CSV**. Solo se importan nombre y primer teléfono, se omiten contactos sin esos datos y se evitan duplicados por nombre y teléfono. Puedes seleccionar un contacto al crear un separado o preparar una invitación desde la lista. Los contactos se cifran y se incluyen en la copia de seguridad; el archivo CSV exportado de Google no está cifrado por esta aplicación. No hay sincronización automática con Google.

En la lista de contactos, después de enviar el SMS desde el celular, usa **Marcar como enviado** para confirmar el envío; la marca se guarda cifrada y se incluye en la copia de seguridad. Puedes desmarcarla si fue un error. Abrir el borrador no confirma que el mensaje se haya enviado.

## Código de recuperación y copia al salir

Con la aplicación desbloqueada, usa **Crear código de recuperación**, guárdalo en un lugar seguro y escríbelo para confirmarlo. El código permite cambiar la contraseña si la olvidas. Solo funciona para los datos o copias que se hayan guardado después de activarlo. Un código nuevo invalida el anterior para copias posteriores; conserva el anterior si necesitas abrir copias antiguas. El código y la copia deben guardarse por separado.

Para salir, pulsa **Salir**. En navegadores compatibles elige un archivo de copia cifrada; selecciona el mismo y confirma su reemplazo para mantener una única copia. En otros navegadores se inicia una descarga y el sistema puede agregar números al nombre: debes reemplazar el archivo anterior manualmente. Cancelar el selector mantiene la aplicación abierta. Cerrar la pestaña o el navegador no garantiza una copia. Para recuperar, usa **Recuperar con código** en la pantalla de acceso y, si es necesario, selecciona una copia cifrada. La recuperación desde una copia reemplaza los datos locales tras confirmación.
