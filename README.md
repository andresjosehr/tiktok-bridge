# 🎮 Garrys TikTok - TikTok Live Bridge para Garry's Mod

Un puente de eventos en tiempo real entre TikTok Live y servidores de Garry's Mod, diseñado con arquitectura modular y sistema de colas inteligente con prioridades.

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

### 🗄️ Base de Datos y Migraciones
- **Sistema de migraciones** similar a Laravel
- **ORM integrado** para consultas type-safe
- **Logs detallados** de todos los eventos procesados
- **Estadísticas de rendimiento** y métricas de cola
- **Limpieza automática** de eventos antiguos

### 🎮 Servicios de Juegos Soportados
- **Garry's Mod**: WebSocket/HTTP para comunicación en tiempo real
- **GTAV/FiveM**: Preparado para integración futura
- **Arquitectura extensible** para agregar nuevos juegos
- **Reconexión automática** cuando se pierde la conexión
- **Formato de mensajes estandarizado** entre servicios

### 🌐 Frontend React
- **Simulador de eventos** de TikTok para testing
- **Dashboard en tiempo real** del estado del sistema
- **Monitor de cola** con métricas visuales
- **Panel de control** para gestión de eventos

### 🤖 Servicios Externos (Preparado para futuro)
- **TTS (Text-to-Speech)**: ElevenLabs, OpenAI, Azure, Google
- **IA Conversacional**: OpenAI, Anthropic, Google, Local
- **Webhooks**: Discord, Custom endpoints
- **Moderación de contenido** automática

## 📋 Requisitos

- **Node.js** 16+ 
- **MySQL** 5.7+ o 8.0+
- **NPM** o **Yarn**
- **Garry's Mod Server** (para producción)

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

### 5. Configurar Garry's Mod
```bash
# En .env, configurar conexión con GMod
GMOD_HOST=localhost
GMOD_WS_PORT=27015
GMOD_HTTP_PORT=27016
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

## 🎮 Integración con Garry's Mod

### Formato de Mensajes WebSocket
```lua
-- Ejemplo de mensaje recibido en GMod
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

### Endpoints HTTP para GMod
```lua
-- POST /tiktok/chat
-- POST /tiktok/gift  
-- POST /tiktok/follow
-- POST /command (ejecutar comandos en GMod)
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
QUEUE_ACTIVE_SERVICE=gmod

# TikTok
TIKTOK_USERNAME=tu_usuario
TIKTOK_MAX_RECONNECT_ATTEMPTS=5

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log
```

### Configuración de Prioridades
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

### Agregar Nuevo Servicio (ej. FiveM, CS2)
1. Crear nuevo servicio extendiendo `ServiceBase`
2. Implementar todos los métodos requeridos (`handleTikTokChat`, `handleTikTokGift`, etc.)
3. Registrar servicio en `QueueProcessorManager.initializeServices()`
4. Configurar mediante `QUEUE_ACTIVE_SERVICE` environment variable

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

### Problemas con Garry's Mod
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
- Comunidad de Garry's Mod por el soporte y feedback
- Contribuidores del proyecto

---

**🎮 ¡Conecta tu stream de TikTok con Garry's Mod y crea experiencias interactivas únicas! 🎮**