# 🚀 OpenPhysics — Production Ready

El agente de investigación física **OpenPhysics** ha sido completamente configurado y desplegado con éxito en Render. El sistema es ahora 100% modular y puede ser exportado a cualquier otro entorno simplemente copiando esta carpeta.

### ✅ Estado del Despliegue
- **URL de Producción**: [https://openphysics.onrender.com/](https://openphysics.onrender.com/) (Status: 🟢 **LIVE**)
- **Bot de Telegram**: [@OpenPhysicsbot](https://t.me/OpenPhysicsbot) (Status: 🟢 **ACTIVO**)
- **Repositorio GitHub**: [andremoran/OpenPhysics](https://github.com/andremoran/OpenPhysics)

### 🛠 Mejoras Realizadas
1. **Corrección de Rutas en Render**: Se ajustó el `startCommand` para apuntar a `node dist/index.js` (TypeScript compilado) en lugar de la raíz.
2. **Configuración de Render API**: Utilicé tu API Key de Render para configurar automáticamente las variables de entorno faltantes (Gemini, Google OAuth, DB Path, etc.) directamente en el dashboard de Render.
3. **Persistencia Firebase**: Se configuró la variable `FIREBASE_SERVICE_ACCOUNT_JSON` para asegurar que el agente mantenga la memoria de investigación y los logs de rendimiento.
4. **Sincronización GitHub**: El script `github_sync.py` ha sido optimizado y utilizado para asegurar que la versión en la nube sea idéntica a la local.

### 📦 Instrucciones para Exportación
Para llevarte este proyecto a otra carpeta o computadora:
1. **Copia la carpeta completa** `OpenPhysics/`.
2. **Verifica el archivo `.env`**: Ya contiene tus claves de Groq, OpenRouter, Wolfram, Gemini y Telegram.
3. **Instalación**: Ejecuta `npm install` en el nuevo destino.
4. **Ejecución Local**: `npm run dev` para desarrollo o `npm run build && npm start` para producción local.

### 🔬 Metodología GPD Activada
El agente responderá siguiendo estrictamente las 5 fases de investigación física:
1. **SCOPE** (Alcance)
2. **PLAN** (Planificación)
3. **DERIVE** (Derivación Matemática)
4. **VERIFY** (Verificación Dimensional/Casos Límites)
5. **PACKAGE** (Resumen y LaTeX)

---
**¡El agente está listo para su primera investigación!** Prueba enviándole una pregunta compleja de física en Telegram.
