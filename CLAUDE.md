# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TikTok Live events bridge for Garry's Mod - a sophisticated Node.js application that connects TikTok Live streams to game servers with intelligent event queuing, priority management, and advanced TTS capabilities. The system captures TikTok Live events (chat, gifts, follows, etc.) and forwards them to game servers via WebSocket/HTTP with modular TTS, AI integration, and comprehensive caching.

## Key Architecture Components

### Backend (Node.js)
- **Event Manager**: Central hub for processing TikTok events with configurable priorities
- **Queue System**: Single queue processor with interchangeable services architecture
- **Service Architecture**: `ServiceBase` class for modular service implementation
- **TikTok Service**: Handles TikTok Live connection using `tiktok-live-connector` with auto-reconnect
- **Game Services**: GMod service (active), GTAV service (prepared), extensible for more
- **Migration System**: Laravel-style database migrations with up/down methods
- **ORM Layer**: Dual system - Custom ORM + Sequelize for maximum flexibility
- **TTS System**: Advanced modular TTS with cache, message composition, and audio combining
- **AI Integration**: Multiple providers (OpenAI, Anthropic, Google, Local models)
- **Webhook System**: Discord and custom webhooks with retry mechanisms
- **Audio Cache**: Intelligent caching system for TTS with automatic cleanup

### Frontend (React + Vite)
- **Real-time Dashboard**: Monitor queue status, system health, and event flow
- **Event Simulator**: Test TikTok events without live stream
- **Queue Monitor**: Visual metrics and queue optimization controls

### Event Priority System
The queue manager uses configurable priorities where higher numbers = higher priority:
- Gifts/Donations: 100 (never filtered, always processed)
- Follows: 50
- Shares: 15
- Chat: 10
- Likes: 5
- Viewer Count: 1

## Development Commands

### Backend Commands
```bash
# Development
npm run dev                    # Start backend with nodemon
npm run dev:full              # Start both backend and frontend

# Production
npm start                     # Start backend in production mode

# Database
npm run migrate               # Run pending migrations
npm run migrate:status        # Check migration status
npm run migrate:rollback      # Rollback last batch
npm run migrate:fresh         # Drop all tables and re-run migrations
npm run make:migration <name> # Create new migration file

# Queue Management
npm run queue:work            # Start queue processor
npm run queue:clear           # Clear completed/failed events

# Testing & Quality
npm test                      # Run Jest tests
npm run lint                  # Run ESLint on src/
npm run test                  # Run Jest test suite
```

### Frontend Commands
```bash
npm run frontend:dev          # Start React dev server
npm run frontend:build        # Build for production
npm run frontend:install      # Install frontend dependencies
npm run frontend:preview      # Preview production build
```

## Database Configuration

The system uses MySQL with a custom migration system. Database config is in `src/config/config.js` with environment variables:
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`
- Migrations are in `src/database/migrations/` with timestamp prefixes
- Models are in both `src/database/models/` and `src/database/orm/models/`

## Environment Configuration

Key environment variables (see `src/config/config.js` for all options):

**Core System:**
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)

**TikTok Configuration:**
- `TIKTOK_USERNAME`: TikTok user to connect to
- `TIKTOK_SESSION_ID`: Optional session ID for better connection
- `TIKTOK_MAX_RECONNECT_ATTEMPTS`: Max reconnection attempts (default: 5)
- `TIKTOK_RECONNECT_DELAY`: Delay between reconnections (default: 5000ms)

**Game Server Configuration:**
- `GMOD_HOST`, `GMOD_WS_PORT`, `GMOD_HTTP_PORT`: Garry's Mod server connection
- `GMOD_RCON_PORT`, `GMOD_RCON_PASSWORD`: RCON configuration
- `GMOD_ENABLED`, `GMOD_RECONNECT_INTERVAL`: Service control

**Queue System:**
- `QUEUE_MAX_SIZE`: Queue size limit (default: 1000)
- `QUEUE_ENABLED_PROCESSORS`: Active services (comma-separated: gmod,gtav)
- `QUEUE_PROCESSING_DELAY`: Delay between event processing
- `QUEUE_AUTO_START`: Auto-start queue processor
- `QUEUE_CLEANUP_INTERVAL`: Automatic cleanup interval

**Database:**
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`: MySQL connection
- `DB_PORT`, `DB_CONNECTION_LIMIT`, `DB_SSL`: Additional DB settings

## External Service Integrations

The system has fully implemented:

**AI Services (src/services/external/aiService.js):**
- OpenAI GPT models with configurable prompts
- Anthropic Claude integration
- Google Gemini AI support
- Local AI endpoint support (Ollama, etc.)
- Configurable via `AI_ENABLED`, `AI_DEFAULT_PROVIDER`, and provider-specific keys

**TTS Services (src/services/external/ttsService.js & tts/modularTTSService.js):**
- ElevenLabs with voice cloning and multilingual support
- OpenAI TTS with multiple voice options
- Azure Cognitive Services TTS
- Google Cloud Text-to-Speech
- **Modular TTS System**: Advanced caching, message composition, audio combining
- FFmpeg-based audio concatenation for complex messages
- Intelligent cache management for static/dynamic content

**Webhook Integration (src/services/external/webhookService.js):**
- Discord webhook with rich embeds
- Custom webhook endpoints with headers and secrets
- Automatic retry mechanism with exponential backoff
- Event filtering and payload customization

**Content Moderation:**
- Feature flags for different moderation levels
- AI-powered content filtering (when enabled)
- Configurable through environment variables

## File Structure Notes

- `src/app.js`: Main Express application entry point
- `src/services/`: Core business logic with modular architecture
  - `ServiceBase.js`: Abstract base class defining interface for all game services
  - `eventManager.js`: Central event processing and distribution
  - `tiktok/tiktokService.js`: TikTok Live connection with auto-reconnect
  - `gmod/`: Garry's Mod integration
    - `gmodService.js`: Main GMod service implementation
    - `gmodServiceInstance.js`: Specific GMod instance handler
    - `gmod-tts-modular.json`: TTS message configuration
  - `gtav/GTAVService.js`: GTAV/FiveM service template
  - `external/`: External service integrations
    - `aiService.js`: Multi-provider AI integration
    - `ttsService.js`: Multi-provider TTS integration
    - `webhookService.js`: Webhook delivery system
    - `tts/`: Advanced TTS subsystem
      - `modularTTSService.js`: Core modular TTS service
      - `messageComposer.js`: Dynamic message composition
      - `ttsCache.js`: Intelligent audio caching
- `src/queue/`: Advanced queue management
  - `queueManager.js`: Priority-based queue with filtering
  - `queueProcessor.js`: Multi-service processor with switching
- `src/database/`: Dual persistence layer
  - `orm/`: Custom ORM with type safety
  - `models/`: Legacy Sequelize models
  - `migrations/`: Laravel-style migrations
- `src/cli/`: Comprehensive CLI tools
- `frontend/src/`: React dashboard with real-time monitoring
- `audio_cache/`: TTS cache with parts/ and usernames/ subdirectories
- `temp_audio_gmod/`: Temporary combined audio files
- `logs/`: Structured application logs

## Development Workflow

1. **Database Changes**: Always create migrations with `npm run make:migration <name>`
2. **Queue Testing**: Use frontend simulator or API endpoints under `/api/simulate/`
3. **Service Integration**: Check service status via `/status` and `/health` endpoints
4. **Logging**: Use Winston logger from `src/utils/logger.js` with structured logging
5. **TTS Development**: Test TTS using the modular system with cache management
6. **AI Integration**: Test AI responses through the multi-provider system
7. **Webhook Testing**: Use `/api/webhooks/test` endpoint for webhook validation
8. **Cache Management**: Monitor audio cache size and cleanup using built-in tools

## Testing Strategy

- **Unit Tests**: Jest framework for service and utility testing
- **Integration Tests**: API endpoint testing with real database
- **Frontend Testing**: ESLint + React testing utilities
- **Code Quality**: ESLint for backend with comprehensive rules
- **Health Monitoring**: Multiple endpoints for system health
  - `/health`: Basic server health check
  - `/status`: Detailed system status (TikTok, Queue, Services)
  - `/api/queue/status`: Real-time queue metrics
  - `/api/queue/stats`: Historical queue statistics
- **TTS Testing**: Built-in validation and audio generation testing
- **Service Testing**: Individual service health checks and reconnection testing
- **Performance Monitoring**: Queue optimization and processing metrics
- **Cache Testing**: Audio cache efficiency and cleanup validation

## Game Service Integration

The system uses a sophisticated modular service architecture:
- **ServiceBase**: Abstract base class defining the interface for all game services
- **Multiple Active Services**: Configured via `QUEUE_ENABLED_PROCESSORS` (comma-separated list)
- **Runtime Service Management**: Services can be enabled/disabled individually
- **Service Health Monitoring**: Automatic reconnection and status tracking

### Current Services:
- **GMod Service**: Full WebSocket/HTTP/RCON communication with Garry's Mod servers
  - TTS integration with modular message composition
  - Real-time event forwarding
  - Connection health monitoring
  - Custom addon support included in `garrys_mod_addons/`
- **GTAV Service**: Template for GTA V/FiveM integration (extensible)

### Service Implementation Requirements:

Each service must extend `ServiceBase` and implement:

**Core Methods:**
- `connect()`: Establish connection to game server
- `disconnect()`: Clean disconnection
- `isConnected()`: Connection status check
- `getStatus()`: Detailed service status
- `reconnect()`: Reconnection logic

**Event Handlers:**
- `handleTikTokChat(data)`: Process chat messages
- `handleTikTokGift(data)`: Process gifts/donations  
- `handleTikTokFollow(data)`: Process new followers
- `handleTikTokShare(data)`: Process shares
- `handleTikTokLike(data)`: Process likes
- `handleTikTokViewerCount(data)`: Process viewer count updates

**Optional Advanced Features:**
- TTS integration using `modularTTSService`
- AI-powered responses using `aiService`
- Custom message formatting
- Webhook notifications

### Adding New Services:
1. Create service directory: `src/services/newgame/`
2. Extend `ServiceBase` class with all required methods
3. Add service to `src/queue/queueProcessor.js` initialization
4. Add service name to `QUEUE_ENABLED_PROCESSORS` environment variable
5. Configure service-specific environment variables
6. Test service integration using frontend simulator

### TTS Integration:
Services can integrate with the modular TTS system:
```javascript
const modularTTS = new ModularTTSService({
  ttsService: this.ttsService,
  configPath: path.join(__dirname, 'game-tts-config.json')
});

const audioInfo = await modularTTS.generateMessageAudio('follow', {
  username: data.uniqueId
});
```

### Message Format Compatibility:
All services should handle the standardized message format:
```javascript
{
  type: 'tiktok_event_type',
  data: {
    user: 'username',
    // event-specific data
  },
  timestamp: '2025-01-01T12:00:00.000Z',
  priority: 100
}
```