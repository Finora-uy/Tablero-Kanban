# Plan: integración del tablero con GitHub

Para: SCM · Alcance: un solo repositorio, el del producto: [`IngSoft-ProyectoGrado/Finora`](https://github.com/IngSoft-ProyectoGrado/Finora). El tablero vive en otro repo (`Finora-uy/Tablero-Kanban`) y solo recibe los avisos. · Sin historial previo que importar (todavía no hay desarrollo).

## 0. Antes de empezar (bloqueante)

Confirmar con Nico que el repositorio permite crear webhooks. ORT ya nos bloqueó otras funciones, así que hay que verificarlo antes de construir nada. Si no se puede, el plan se replantea (por ejemplo, GitHub Actions que llamen al endpoint).

## 1. Convención de vínculo

| Dónde | Formato | Ejemplo |
|---|---|---|
| Rama | `tipo/fin-n-descripcion`. Se busca `fin-\d+` en **cualquier parte** del nombre, sin importar mayúsculas | `feature/fin-12-importar-csv` |
| Cuerpo del PR | una línea `Refs: FIN-n` | `Refs: FIN-12` |

- El vínculo se toma de la **rama** y del **cuerpo del PR**. No se usa el título del PR ni el mensaje del commit (con squash puede no venir).
- Si el número no existe en el tablero, el evento se guarda como "sin vincular".

## 2. Webhook

Endpoint nuevo: `api/github-webhook.js` (Vercel).

- **Repo:** solo se aceptan avisos de `IngSoft-ProyectoGrado/Finora`; los de cualquier otro repo se ignoran (se puede cambiar con la variable `GITHUB_REPO`).
- **Firma:** se valida `X-Hub-Signature-256` sobre el cuerpo **sin parsear**, con comparación de tiempo constante. El secreto vive solo en variables de entorno de Vercel (`GITHUB_WEBHOOK_SECRET`).
- **Supabase:** la clave de servicio se usa solo en el servidor. Los datos van en una **tabla** nueva (no en la colección `docs`).
- **Deduplicación** por `X-GitHub-Delivery`.
- **Respuesta rápida:** devolver 200 enseguida y procesar sin hacer esperar a GitHub.
- **create/delete:** revisar `ref_type` (rama vs tag) y procesar solo ramas.
- **Bots:** ignorar a Dependabot y similares.
- **Eventos:** `push`, `pull_request`, `pull_request_review`, `create`, `delete`, `workflow_run`.

## 3. Estados automáticos

| Evento | La tarea pasa a |
|---|---|
| Se crea la rama | En curso |
| Se abre el PR (listo para revisión) | En revisión |
| Se mergea el PR | **No cambia de columna.** Muestra la insignia "PR mergeado" |

**Hecho siempre lo da el responsable a mano**: cada responsable tiene que dar su OK. Además:
- Se configura qué columnas son "En curso" y "En revisión".
- No mueve tareas archivadas ni retrocede una que ya está más adelante.
- Cada movimiento automático queda en el historial de la tarea como "movida por GitHub".

## 4. Orden de prioridad

1. **Vínculo, webhook y pestaña "Código"** en la tarea: ramas, commits (autor, fecha, mensaje, enlace) y estado del PR.
2. ✅ **Mapeo de usuarios de GitHub por integrante** (campo nuevo en el perfil). Es la base de lo demás, para atribuir bien commits y reviews. Hecho: cada uno carga su usuario en **Equipo → editar** (o al sumarse); en la sección Código se ve el integrante en vez del @usuario, y los movimientos automáticos quedan como "Emi vía GitHub".
3. ✅ **Insignia de PR y panel "Pendientes de revisar"**, con alerta a las 48 h sin atender. Sin revisores fijos: lo puede revisar cualquiera. Hecho: la tarjeta muestra el estado de su PR; el panel *Requiere tu atención* lista los PRs sin revisar (sin los propios) y marca en rojo los de más de 48 h. El reloj se guarda en `github_prs.esperando_desde` y se reinicia al volver a pedir revisión o al subir commits después de un *cambios pedidos*.
4. ✅ **Alerta de ramas/PR sin vincular** (no siguen la convención). Hecho: sección *Sin vincular a una tarea* en el panel *Requiere tu atención*, con lo que falta corregir. Cada uno ve lo suyo; el rol SCM ve todo. Se excluyen las ramas fijas (`main`, `develop`, `release/…`) y las ramas que ya tienen PR.
5. ✅ **Estado del CI** en el PR, con el evento `workflow_run`. Hecho: tabla `github_ci` con la última corrida de cada workflow por rama (los avisos desordenados no pisan una corrida más nueva). Se ve en la sección Código; si falla el CI de un PR abierto, también en la tarjeta y en *Pendientes de revisar*. Requiere marcar **Workflow runs** en el webhook.
6. **Exportar la matriz** tarea → requisito → PR, para la documentación de la tesis.

Solo si sobra tiempo: releases y tags; alerta de tarea sin código (solo para tarjetas de tipo código).

## 5. Fuera de alcance

- Ramas viejas: el borrado automático del repo ya está activo.
- Conflictos de merge: GitHub ya los marca en el PR.
- Actividad por persona cruzada con horas registradas.

## 6. Qué tiene que hacer cada rol

**Desarrollo**: endpoint, tabla en Supabase, pestaña "Código", insignias, panel y estados automáticos.

**SCM (a mano)**
1. Confirmar con Nico que se puede crear el webhook (sección 0).
2. Crear el webhook en el repo `IngSoft-ProyectoGrado/Finora` (Settings → Webhooks) apuntando al endpoint, formato JSON, con los eventos de la sección 2.
3. Generar el secreto y cargarlo en Vercel (`GITHUB_WEBHOOK_SECRET`); el mismo valor va en el webhook.
4. Activar protección de `main` (PR obligatorio, CI en verde).
5. Hacer cumplir la convención de ramas y la línea `Refs: FIN-n` en el cuerpo del PR (conviene una plantilla de PR).

## 7. Pendientes de definir

- Nombre de las columnas "En curso" y "En revisión".
- Plantilla de PR con la línea `Refs:`.
