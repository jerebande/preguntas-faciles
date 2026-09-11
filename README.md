# preguntas.faciles — App de trivia y ranking

App web para el juego de preguntas de @tomimunaretto / @preguntas.faciles. Registro por
nickname, preguntas aleatorias de opción múltiple, puntaje, ranking por temporada y panel
de administrador para cargar preguntas y reiniciar el ranking.

## Stack

- Node.js + Express
- EJS (vistas del lado del servidor)
- MySQL (mysql2)
- express-session (sesión del jugador y del admin)
- Diseño mobile-first en negro/blanco/lima, inspirado en el logo

## Estructura de carpetas

```
database/     -> conexión a MySQL (pool + diagnóstico de .env)
models/       -> una función por tabla, todo el SQL vive acá
controllers/  -> lógica de cada ruta (llaman a los models, arman la respuesta)
  api/        -> controllers de las rutas /api (usadas por el juego vía fetch)
  admin/      -> controllers de las rutas /admin
routes/       -> solo conectan URL -> controller, sin lógica propia
middleware/   -> auth de admin y carga del jugador en sesión
views/        -> plantillas EJS (juego, ranking, panel admin)
public/       -> CSS y JS del lado del cliente
db/           -> schema.sql y seed.sql
```

## Instalación

1. Instalar dependencias:
   ```
   npm install
   ```

2. Crear la base de datos y las tablas:
   ```
   mysql -u root -p < db/schema.sql
   ```

3. (Opcional) Cargar preguntas de ejemplo:
   ```
   mysql -u root -p < db/seed.sql
   ```

4. Copiar `.env.example` a `.env` y completar los datos de conexión a MySQL y el usuario/
   contraseña del admin inicial:
   ```
   cp .env.example .env
   ```

5. Arrancar el servidor:
   ```
   npm start
   ```
   La app queda en `http://localhost:3000`. El admin se crea automáticamente la primera
   vez con el usuario/contraseña que hayas puesto en `.env` (después cambiá la contraseña
   creando un nuevo hash o agregando una pantalla de "cambiar contraseña" si la necesitás).

6. Panel de administrador: `http://localhost:3000/admin`

## Cargar preguntas: a mano o con IA

Todo se guarda en la misma tabla `questions` de la misma base de datos — no hay una
segunda base ni un sistema paralelo.

- **A mano:** `/admin/questions/new`, como siempre.
- **Con IA:** `/admin/questions/generate-ai` — el admin pone un tema, cantidad y
  dificultad, y Claude genera las preguntas. Se guardan automáticamente como
  **inactivas** (borrador) y no aparecen en el juego hasta que las revisás y las
  activás desde `/admin/questions` (podés editarlas antes de activarlas, igual que
  cualquier otra pregunta). Esto evita que algo mal generado llegue directo a
  producción.
- Para usar esta función necesitás una API key de Anthropic en `.env`
  (`ANTHROPIC_API_KEY`). Si no la configurás, el resto de la app funciona igual —
  solo ese botón va a mostrar un error pidiendo la key.

## Cómo funciona el juego

- El jugador entra, pone un nickname (sin contraseña) y ese nickname queda guardado en su
  sesión por 90 días.
- Cada temporada (semanal por defecto) el jugador puede responder cada pregunta activa una
  sola vez. Las respuestas correctas suman los puntos configurados en esa pregunta.
- El ranking (`/ranking`) muestra el top 50 de la temporada activa.
- Desde `/admin/seasons` el administrador cierra la temporada activa y abre una nueva,
  reiniciando el ranking sin perder el historial (queda guardado en la tabla `seasons`).

## Pensado para crecer

- `categories`: ya existe la tabla, su modelo y el campo `category_id` en preguntas.
- `prizes`: la tabla ya está modelada para asociar premios a un puesto del ranking por
  temporada; todavía falta agregar su modelo y sus pantallas cuando se implemente esa
  función.
- Espacios `<div class="ad-slot">` ya ubicados en el juego y el ranking, listos para
  reemplazar por el código de Google AdSense cuando tengan la cuenta aprobada.
- La lógica de puntaje y rachas (`best_streak`, `current_streak`) ya está en la base,
  por si más adelante quieren mostrar rachas o dar puntos extra por rachas largas.

## Regla para agregar nuevas funciones

Cada función nueva debe vivir en su propio módulo y comunicarse con el resto mediante
modelos o servicios, no mediante consultas SQL dentro de las vistas o controladores.
Para una función de administración nueva, por ejemplo `prizes`, la estructura esperada
es:

```
models/prizeModel.js                 -> consultas y persistencia de premios
controllers/admin/prizesController.js -> validación y respuestas HTTP
routes/admin/prizes.js               -> URLs protegidas del panel
views/admin/prizes.ejs               -> interfaz del panel
services/prizeService.js             -> reglas que involucren ranking, temporadas y premios
```

Después se registra el router en `routes/admin.js`. Si una regla afecta varios dominios
(por ejemplo, cerrar una temporada y asignar premios), debe vivir en un servicio y usar
una transacción de MySQL. Las vistas solo renderizan datos; los modelos solo conocen la
base de datos; los controladores coordinan la petición.

Para categorías se mantiene el mismo criterio: `categoryModel` administra las categorías
y `questionModel` solo guarda la relación `category_id`. Para nuevas entidades se agrega
una tabla y su modelo, evitando reutilizar tablas genéricas o llenar `server.js` de lógica
de negocio.

## Notas de seguridad para producción

- Usar `NODE_ENV=production` y cambiar `SESSION_SECRET` por un valor aleatorio de al
  menos 32 caracteres. La aplicación ahora se niega a arrancar si falta ese secreto.
- Mantener `TRUST_PROXY=0` salvo que la aplicación esté detrás de un proxy inverso
  confiable. Si está detrás de Nginx, Cloudflare o similar, configurar `TRUST_PROXY=1`
  para que las cookies seguras y los límites por IP funcionen correctamente.
- La aplicación agrega cabeceras HTTP de seguridad y el login admin/jugador tiene un
  límite de solicitudes por IP para dificultar ataques de fuerza bruta.
- Poner la aplicación detrás de un WAF/firewall como Cloudflare: permitir solo HTTP/HTTPS,
  ocultar el puerto de Node y limitar tráfico por IP antes de que llegue a Express.
- Agregar Cloudflare Turnstile o hCaptcha al registro y al login si aparecen bots. El
  CAPTCHA debe verificarse en el servidor con la API del proveedor; ocultarlo solo en el
  navegador no protege la aplicación.
- Cambiar la contraseña del admin inicial apenas entren por primera vez.
- Servir la app detrás de HTTPS (Hostinger, Railway, Render, etc.) antes de lanzarla
  públicamente, para que las cookies de sesión viajen seguras.
