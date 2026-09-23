# Tablero Finora · versión web

Tablero Kanban del equipo de Finora (proyecto final, Universidad ORT Uruguay).

- **Dónde vive:** en internet, con un link del tipo `https://tablero-finora.vercel.app`.
- **Quién entra:** cada integrante, con su email y contraseña.
- **Tiempo real:** todos ven los cambios al instante.

**Costo: $0.**

| Servicio | Plan | Para qué |
|---|---|---|
| GitHub | Free | Guarda el código |
| Vercel | Hobby (uso no comercial) | Publica la web y conecta la base |
| Supabase | Free (se crea desde Vercel) | Base de datos, login y tiempo real |

---

## Puesta en marcha (una sola vez, unos 20 minutos)

### 1. Subir el código a GitHub

1. Creá una cuenta en <https://github.com> si no tenés.
2. Tocá **New repository**.
   - Nombre: `tablero-finora`.
   - Marcalo como **Private**.
   - No agregues README.
3. En esta carpeta, abrí una terminal y corré:

```bash
git init
git add .
git commit -m "Tablero Finora"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/tablero-finora.git
git push -u origin main
```

### 2. Publicar la web en Vercel

1. Entrá a <https://vercel.com> y creá una cuenta con **Continue with GitHub**. Elegí el plan **Hobby**.
2. Tocá **Add New… → Project**, elegí `tablero-finora` y tocá **Import**.
3. No cambies nada: el archivo `vercel.json` ya dice cómo armarla. Tocá **Deploy**.
4. Anotá el link que te da (por ejemplo `https://tablero-finora.vercel.app`).
   Todavía funciona en **modo local**, porque falta la base de datos.

### 3. Crear la base de datos desde Vercel

1. En tu proyecto de Vercel, andá a **Storage → Create Database → Supabase**.
2. Elegí el plan **Free** y la región **South America (São Paulo)**, que es la más cercana.
3. Conectala al proyecto, marcando **todos los entornos**.
   Esto agrega solas las variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### 4. Crear las tablas

1. En **Storage**, tocá **Open in Supabase**.
2. En Supabase, abrí **SQL Editor → New query**.
3. Pegá todo el contenido de [`supabase/esquema.sql`](supabase/esquema.sql) y tocá **Run**.
   Tiene que decir *Success*.

### 5. Configurar el login en Supabase

1. Andá a **Authentication → URL Configuration**:
   - En **Site URL**, poné tu link de Vercel: `https://tablero-finora.vercel.app`.
   - En **Redirect URLs**, agregá `https://tablero-finora.vercel.app/**`.
2. Andá a **Authentication → Sign In / Providers → Email** y dejá activado **Confirm email**.
   Es importante: así nadie puede crear una cuenta con el email de otro.

### 6. Volver a publicar

En Vercel, andá a **Deployments**, abrí el menú **⋯** del último deploy y tocá **Redeploy**. Así la web toma las variables de la base de datos.

### 7. Entrar y sumar al equipo

1. Abrí tu link, tocá **Crear cuenta** y usá tu email.
2. Confirmá el email con el link que te llega y entrá.
   **La primera cuenta confirmada queda invitada automáticamente.**
3. Completá **Sumate al tablero** con tu apodo, rol y color.
4. Andá a **Equipo → Invitar al equipo**, cargá el email de cada amigo y pasales el link.
   Cada uno crea su cuenta con **ese mismo email**.

### 8. (Opcional) Traer lo que había en el tablero de Claude

1. En el Artifact de Claude, abrí el menú de tu perfil → **Exportar o importar** → **Respaldo completo (.json)**.
2. En la web, abrí el mismo menú → **Importar un respaldo** y elegí ese archivo.

---

## Cosas a saber

- **Si nadie entra en 7 días, Supabase pausa el proyecto.**
  - La web muestra "No pudimos conectar con la base de datos".
  - Se arregla entrando a Supabase y tocando **Restore project**. No se pierde nada.
- **Los emails de confirmación y recuperación los manda Supabase, y solo manda pocos por hora.**
  - Si a alguien no le llega, que espere unos minutos y revise spam.
  - Si molesta, se puede configurar un servicio de correo propio en **Authentication → Emails → SMTP** (por ejemplo, Resend tiene plan gratis).
- **Quitar a alguien:** en **Equipo → Invitar al equipo → Quitar**. Deja de poder entrar al instante.
- **Seguridad:**
  - La clave de Supabase que va en la web es la *anon*, que es pública por diseño.
  - Los datos los protegen las reglas del archivo `esquema.sql`: solo los emails invitados y confirmados leen o escriben.
  - Nunca pongas la clave *service_role* en Vercel ni en el código.

---

## Para el que programa

```
src/                    piezas del tablero (se unen en un solo HTML)
  1x-*.css              estilos (13-login.css es solo de la web)
  20-28-*.js            interfaz y lógica compartidas
  29-arranque-claude.js arranque del Artifact de Claude
  30-32-*.js            versión web: Supabase, login y arranque
supabase/esquema.sql    tablas, reglas de acceso y funciones
build.mjs               arma dist/index.html (lo corre Vercel)
armar.sh                arma finora-tablero.html (Artifact de Claude)
```

**Para probar en tu compu:**

1. Armá la web:

   ```bash
   node build.mjs
   ```

2. Levantá un servidor local:

   ```bash
   python -m http.server 4173 --directory dist
   ```

3. Abrí `http://localhost:4173`.

Sin variables, la web anda en **modo local**. Para conectarla a la base real, creá un archivo `.env.local` con `NEXT_PUBLIC_SUPABASE_URL=…` y `NEXT_PUBLIC_SUPABASE_ANON_KEY=…`. Ese archivo no se sube a GitHub.

Cada `git push` a `main` vuelve a publicar la web en Vercel.
