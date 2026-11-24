# CodeWalk

Extensión de VS Code + servidor MCP local para que tu agente de IA (como Antigravity) te explique proyectos grandes de forma interactiva directamente en tu editor — **sin usar ninguna API externa de LLM**.

## Qué incluye

- **Efecto Spotlight**: resalta el bloque de código explicado y atenúa el resto del archivo.
- **Notas línea a línea (`lineNotes`)**: muestra explicaciones breves directamente al final de las líneas relevantes del bloque, con explicación detallada debajo para las líneas más importantes.
- **Tarjetas explicativas inline (`CommentController`)**: muestran explicaciones en Markdown justo debajo del bloque, con botones **Anterior / Siguiente** y caja de texto para escribir preguntas en cada paso.
- **Panel lateral (Sidebar)**: muestra el índice del recorrido, progreso, dudas pendientes y botón **`+`** para pedir un nuevo tour.
- **Clic derecho en el editor (`Explain with CodeWalk`)**: pide una explicación de cualquier archivo o selección directamente desde VS Code.
- **Modo Híbrido + Escucha activa (sin gastar tokens en reposo)**: navega a tu ritmo en modo manual, o activa la escucha en tu agente vía `GET /events/next` para que reciba tus preguntas y peticiones de nuevos tours al instante y responda directamente en VS Code. Puedes detener la escucha en cualquier momento desde la barra de estado o el panel lateral.

## Compilar el proyecto

```bash
npm install
npm run build
```

## 1. Ejecutar o instalar la extensión en VS Code

### Opción A — Probar rápido en modo desarrollo (F5)
1. Abre la carpeta del proyecto en VS Code.
2. Pulsa **F5** (`Run CodeWalk Extension`) o **`Run > Run Without Debugging`**.
3. Abre en la nueva ventana el proyecto que quieras entender.

### Opción B — Instalarla de forma permanente (`.vsix`)
```bash
npx @vscode/vsce package
code --install-extension codewalk-0.1.0.vsix
```

Al arrancar, la extensión levanta un puente HTTP local en `http://127.0.0.1:47321` (configurable con `codewalk.port`). Puedes comprobar su estado con el comando **`CodeWalk: Show MCP Bridge Status`**.

## 2. Conectar el servidor MCP en Antigravity

Añade `codewalk` a `~/.gemini/config/mcp_config.json`:

```json
{
  "mcpServers": {
    "codewalk": {
      "command": "node",
      "args": ["/path/to/codewalk/dist/mcpServer.js"],
      "env": {
        "CODEWALK_PORT": "47321"
      }
    }
  }
}
```

> Si ya tienes otros servidores en `mcpServers`, añade solo el bloque `"codewalk": { ... }` dentro de `mcpServers`.

## 3. Cómo usarlo

1. Abre tu proyecto en VS Code (con la extensión `CodeWalk` activa).
2. Pídele a Antigravity algo como:
   > *"Explícame el flujo de autenticación de este proyecto usando codewalk"*
3. Antigravity creará el recorrido con `codewalk_create_tour` y VS Code abrirá el primer paso automáticamente.
4. Navega con los botones de la tarjeta inline, el panel lateral o los atajos **`Alt+→`** (siguiente) y **`Alt+←`** (anterior).
5. Si tienes una duda en cualquier paso, escríbela en la caja de respuesta inline y pulsa **Ask Question**.

## Herramientas MCP disponibles

| Herramienta | Descripción |
| --- | --- |
| `codewalk_status` | Comprueba la conexión con VS Code, workspace abierto y dudas pendientes |
| `codewalk_create_tour` | Crea un recorrido paso a paso con notas línea a línea y abre el primer paso en VS Code |
| `codewalk_add_steps` | Añade más pasos al recorrido activo |
| `codewalk_focus_step` | Salta a un paso concreto por índice o `stepId` |
| `codewalk_highlight_code` | Resalta un bloque puntual con una nota inline sin reemplazar el tour |
| `codewalk_get_questions` | Lee las preguntas pendientes (o todas) escritas por el usuario en VS Code |
| `codewalk_reply` | Publica la respuesta directamente en el hilo inline del paso en VS Code |
| `codewalk_clear_tour` | Limpia resaltados y cierra el recorrido activo |
