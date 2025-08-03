# 🎮 TikTok Live Bridge - Plataforma Modular de Eventos

Una plataforma modular Node.js que conecta streams de TikTok Live con cualquier servidor de juego o servicio, diseñada con arquitectura modular y sistema de colas inteligente con prioridades.

## 🌟 Características Principales

### 🔴 Integración TikTok Live
- **Conexión en tiempo real** con streams de TikTok usando `tiktok-live-connector`
- **Eventos soportados**: Chat, Donaciones/Gifts, Follows, Likes, Shares, Viewer Count
- **Reconexión automática** con backoff exponencial
- **Manejo robusto de errores** y logging detallado

### 🚦 Sistema de Colas Inteligente
- **Cola única con servicios intercambiables** (GMod, GTAV, y más)
- **Arquitectura modular** con `ServiceBase` para fácil extensión
- **Cola con prioridades** configurables por tipo de evento
- **Límite de tamaño** configurable (default: 1000 eventos)
- **Prioridad especial para donaciones**: Nunca se excluyen y van al frente
- **Filtrado automático** de eventos de baja prioridad cuando hay saturación
- **Persistencia en MySQL** con sistema de reintentos

### 🎯 Prioridades de Eventos
```
🎁 Donaciones/Gifts:    Prioridad 100 (Máxima - Nunca se filtran)
👥 Follows:            Prioridad 50
📤 Shares:             Prioridad 15  
💬 Chat:               Prioridad 10
👍 Likes:              Prioridad 5
👀 Viewer Count:       Prioridad 1
```
**Sistema de TTS Modular**: Prioridad especial para usernames con cache inteligente

### 🗄️ Base de Datos y Persistencia
- **Sistema de migraciones** estilo Laravel con up/down methods
- **ORM dual**: Custom ORM + Sequelize para máxima flexibilidad
- **Logs detallados** de todos los eventos con timestamps
- **Estadísticas de rendimiento** en tiempo real
- **Cache de audio inteligente** con cleanup automático
- **Limpieza automática** de eventos y archivos temporales

### 🎮 Servicios de Juegos Soportados
- **Garry's Mod**: WebSocket/HTTP para comunicación en tiempo real (implementado)
- **GTAV/FiveM**: Preparado para integración futura
- **Arquitectura extensible** para agregar cualquier juego o servicio
- **Reconexión automática** cuando se pierde la conexión
- **Formato de mensajes estandarizado** entre servicios

### 🌐 Frontend React
- **Simulador de eventos** de TikTok para testing
- **Dashboard en tiempo real** del estado del sistema
- **Monitor de cola** con métricas visuales
- **Panel de control** para gestión de eventos

### 🤖 Servicios Externos Implementados
- **TTS (Text-to-Speech)**: ElevenLabs, OpenAI TTS, Azure Cognitive Services, Google Cloud TTS
- **TTS Modular**: Sistema avanzado con cache, composición de mensajes y combinación de audio
- **IA Conversacional**: OpenAI GPT, Anthropic Claude, Google Gemini, Modelos Locales
- **Webhooks**: Discord, Custom endpoints con reintentos automáticos
- **Moderación de contenido** configurable por flags de funcionalidades

## 📋 Requisitos

- **Node.js** 16+ 
- **MySQL** 5.7+ o 8.0+
- **NPM** o **Yarn**
- **Servidor de juego compatible** (GMod, FiveM, etc.) para producción

## 🚀 Instalación y Configuración

### 1. Clonar e Instalar Dependencias
```bash
git clone <tu-repo>
cd garrys-tiktok
npm install
```

### 2. Configurar Base de Datos
```bash
# Copiar archivo de configuración
cp .env.example .env

# Editar configuración de MySQL en .env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_password
DB_DATABASE=garrys_tiktok
```

### 3. Ejecutar Migraciones
```bash
# Crear base de datos y ejecutar migraciones
npm run migrate
```

### 4. Configurar TikTok
```bash
# En .env, configurar usuario de TikTok
TIKTOK_USERNAME=nombre_usuario_tiktok
```

### 5. Configurar Servicio de Juego
```bash
# En .env, configurar conexión (ejemplo con GMod)
GMOD_HOST=localhost
GMOD_WS_PORT=27015
GMOD_HTTP_PORT=27016

# Habilitar servicios específicos
QUEUE_ENABLED_PROCESSORS=gmod,gtav
```

## 🎯 Uso

### Iniciar Aplicación Principal
```bash
# Desarrollo
npm run dev

# Producción
npm start
```

### Gestión de Cola
```bash
# Iniciar procesador de cola
npm run queue:work

# Ver estado de la cola
npm run queue:work --status

# Verificar salud del sistema
npm run queue:work --health

# Limpiar eventos completados
npm run queue:clear --completed

# Limpiar todos los eventos (¡CUIDADO!)
npm run queue:clear --all
```

### Gestión de Migraciones
```bash
# Ejecutar migraciones pendientes
npm run migrate

# Ver estado de migraciones
npm run migrate:status

# Revertir última migración
npm run migrate:rollback

# Crear nueva migración
npm run make:migration nombre_migracion

# Reinstalación completa (¡CUIDADO!)
npm run migrate:fresh
```

### Frontend React
```bash
# Iniciar frontend en desarrollo
npm run frontend:dev

# Build de producción
npm run frontend:build
```

## 🏗️ Arquitectura

```
garrys-tiktok/
├── src/
│   ├── app.js                          # Aplicación Express principal
│   ├── config/
│   │   └── config.js                   # Configuración centralizada
│   ├── database/
│   │   ├── connection.js               # Conexión MySQL
│   │   ├── migrationManager.js         # Gestor de migraciones
│   │   ├── orm/                        # ORM y modelos
│   │   └── migrations/                 # Archivos de migración
│   ├── services/
│   │   ├── eventManager.js             # Gestor de eventos interno
│   │   ├── tiktok/
│   │   │   └── tiktokService.js        # Servicio TikTok Live
│   │   ├── gmod/
│   │   │   └── gmodService.js          # Comunicación GMod
│   │   └── external/                   # Servicios externos
│   ├── queue/
│   │   ├── queueManager.js             # Gestor de cola
│   │   └── queueProcessor.js           # Procesador único con servicios intercambiables
│   ├── api/                            # Endpoints REST API
│   ├── cli/                            # Comandos CLI
│   └── utils/                          # Utilidades
├── frontend/                           # Aplicación React
│   ├── src/
│   │   ├── components/                 # Componentes React
│   │   ├── pages/                      # Páginas principales
│   │   ├── hooks/                      # React hooks
│   │   └── services/                   # Servicios API
│   └── public/
└── logs/                               # Archivos de log
```

## 📊 API Endpoints

### Estados del Sistema
- `GET /health` - Estado general del servidor
- `GET /status` - Estado detallado (TikTok, Cola, GMod)
- `GET /api/queue/status` - Estado de la cola
- `GET /api/queue/stats` - Estadísticas detalladas

### Gestión de Cola
- `POST /api/queue/clear` - Limpiar cola
- `POST /api/queue/optimize` - Optimizar cola
- `GET /api/logs` - Logs de eventos recientes

### Simulación (Desarrollo)
- `POST /api/simulate/chat` - Simular mensaje de chat
- `POST /api/simulate/gift` - Simular donación
- `POST /api/simulate/follow` - Simular seguidor

## 🎮 Integración con Servicios de Juegos

### Formato de Mensajes WebSocket
```lua
-- Ejemplo de mensaje recibido en servicio de juego
{
    "type": "tiktok_gift",
    "data": {
        "user": "usuario123",
        "giftName": "Rose",
        "giftId": 5655,
        "repeatCount": 1,
        "cost": 1,
        "timestamp": "2025-01-01T12:00:00.000Z"
    },
    "timestamp": "2025-01-01T12:00:00.000Z"
}
```

### Endpoints HTTP para Servicios
```lua
-- POST /tiktok/chat
-- POST /tiktok/gift  
-- POST /tiktok/follow
-- POST /command (ejecutar comandos en servicio)
```

## ⚙️ Configuración Avanzada

### Variables de Entorno Principales
```bash
# Servidor
PORT=3000
NODE_ENV=production

# Base de Datos
DB_HOST=localhost
DB_USER=garrys_tiktok
DB_PASSWORD=password_seguro
DB_DATABASE=garrys_tiktok

# Cola
QUEUE_MAX_SIZE=1000
QUEUE_BATCH_SIZE=1
QUEUE_MAX_ATTEMPTS=3
QUEUE_ENABLED_PROCESSORS=gmod,gtav
QUEUE_PROCESSING_DELAY=100
QUEUE_AUTO_START=true
QUEUE_CLEANUP_INTERVAL=3600000
QUEUE_OPTIMIZATION_INTERVAL=1800000

# TikTok
TIKTOK_USERNAME=tu_usuario
TIKTOK_SESSION_ID=optional_session_id
TIKTOK_MAX_RECONNECT_ATTEMPTS=5
TIKTOK_RECONNECT_DELAY=5000

# Servicios de Juegos (ejemplo: Garry's Mod)
GMOD_HOST=localhost
GMOD_RCON_PORT=27015
GMOD_RCON_PASSWORD=password
GMOD_WS_PORT=27015
GMOD_HTTP_PORT=27016
GMOD_ENABLED=true
GMOD_RECONNECT_INTERVAL=30000

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5

# TTS Configuration
TTS_ENABLED=true
TTS_DEFAULT_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=your_api_key
ELEVENLABS_VOICE_ID=voice_id
ELEVENLABS_STABILITY=0.5
ELEVENLABS_SPEED=1.0

# AI Configuration
AI_ENABLED=true
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_AI_API_KEY=your_google_key

# Webhooks
WEBHOOKS_ENABLED=true
DISCORD_WEBHOOK_URL=your_discord_webhook

# Feature Flags
FEATURE_AI_CHAT_RESPONSES=true
FEATURE_TTS_ANNOUNCEMENTS=true
FEATURE_CONTENT_MODERATION=true
FEATURE_GIFT_NOTIFICATIONS=true
```

### Configuración de Prioridades y TTS
```javascript
// En src/queue/queueManager.js
this.eventPriorities = {
  'tiktok:gift': 100,        // Máxima prioridad
  'tiktok:donation': 100,    // Máxima prioridad  
  'tiktok:follow': 50,       // Alta prioridad
  'tiktok:share': 15,        // Media prioridad
  'tiktok:chat': 10,         // Baja prioridad
  'tiktok:like': 5,          // Muy baja prioridad
  'tiktok:viewerCount': 1,   // Mínima prioridad
  'default': 0
};

// Sistema TTS Modular
// - Cache inteligente para partes estáticas
// - Generación dinámica para usernames
// - Combinación automática de audio con FFmpeg
// - Pre-generación de mensajes comunes
// - Limpieza automática de archivos temporales
```

## 🔧 Desarrollo

### Estructura de Desarrollo
```bash
# Iniciar desarrollo completo
npm run dev:full

# Solo backend
npm run dev

# Solo frontend  
npm run frontend:dev

# Solo worker de cola
npm run queue:work

# Tests
npm test

# Linting
npm run lint
```

### Crear Nueva Migración
```bash
npm run make:migration create_new_table

# Editar archivo generado en src/database/migrations/
# Ejecutar migración
npm run migrate
```

### Agregar Nuevo Tipo de Evento
1. Definir prioridad en `queueManager.js`
2. Implementar método handler en `ServiceBase` y servicios específicos
3. Integrar en `eventManager.js`
4. Actualizar frontend si es necesario

### Agregar Nuevo Servicio (ej. FiveM, CS2, Minecraft)
1. Crear nuevo servicio extendiendo `ServiceBase` en `src/services/nuevo_juego/`
2. Implementar todos los métodos requeridos:
   - `handleTikTokChat`, `handleTikTokGift`, `handleTikTokFollow`
   - `handleTikTokShare`, `handleTikTokLike`, `handleTikTokViewerCount`
   - `connect`, `disconnect`, `isConnected`, `getStatus`
3. Registrar servicio en `src/queue/queueProcessor.js`
4. Agregar al array `QUEUE_ENABLED_PROCESSORS` en configuración
5. Configurar variables de entorno específicas del juego

### Sistema TTS Modular
- **Configuración**: `src/services/gmod/gmod-tts-modular.json`
- **Cache**: Audio estático en `audio_cache/parts/`
- **Dinámico**: Usernames en `audio_cache/usernames/`
- **Combinación**: FFmpeg para concatenar audio
- **Proveedores**: ElevenLabs, OpenAI, Azure, Google TTS

## 📈 Monitoreo y Métricas

### Logs del Sistema
```bash
# Ver logs en tiempo real
tail -f logs/app.log

# Logs por nivel
grep "ERROR" logs/app.log
grep "WARN" logs/app.log
```

### Métricas de Cola
- **Tamaño actual** vs límite máximo
- **Tasa de éxito/fallo** por tipo de evento
- **Tiempo promedio** de procesamiento
- **Eventos filtrados** por saturación
- **Throughput** por hora/día

### Dashboard Web
- **Monitor en tiempo real** del estado de la cola
- **Gráficos de rendimiento** históricos
- **Alertas** cuando la cola está llena
- **Simulador de eventos** para testing

## 🚨 Solución de Problemas

### Cola Saturada
```bash
# Ver estado actual
npm run queue:work --status

# Optimizar cola
npm run queue:work --optimize

# Limpiar eventos antiguos
npm run queue:clear --completed --hours 1
```

### Problemas de Conexión TikTok
- Verificar que el usuario esté en vivo
- Comprobar conectividad de red
- Revisar logs para errores específicos
- Reiniciar servicio si es necesario

### Problemas de Base de Datos
```bash
# Verificar conexión
npm run migrate:status

# Reparar migraciones
npm run migrate:rollback
npm run migrate
```

### Problemas con Servicios de Juegos
- Verificar que el servidor esté ejecutándose
- Comprobar puertos WebSocket/HTTP
- Revisar firewall y conectividad de red

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 🙏 Agradecimientos

- [tiktok-live-connector](https://github.com/zerodytrash/TikTok-Live-Connector) por la integración con TikTok
- Comunidades de desarrolladores de juegos por el soporte y feedback
- Contribuidores del proyecto

---

**🎮 ¡Conecta tu stream de TikTok con cualquier juego y crea experiencias interactivas únicas! 🎮**