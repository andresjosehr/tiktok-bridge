# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TikTok Live events bridge for Garry's Mod - a Node.js application that connects TikTok Live streams to Garry's Mod servers with intelligent event queuing and priority management. The system captures TikTok Live events (chat, gifts, follows, etc.) and forwards them to Garry's Mod servers via WebSocket/HTTP.

## Key Architecture Components

### Backend (Node.js)
- **Event Manager**: Central hub for processing TikTok events with configurable priorities
- **Queue System**: Intelligent queue with priority-based filtering and MySQL persistence
- **TikTok Service**: Handles TikTok Live connection using `tiktok-live-connector`
- **GMod Service**: Manages WebSocket/HTTP communication with Garry's Mod servers
- **Migration System**: Laravel-style database migrations with up/down methods
- **ORM Layer**: Custom ORM in `src/database/orm/` for type-safe database operations

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
```

### Frontend Commands
```bash
npm run frontend:dev          # Start React dev server
npm run frontend:build        # Build for production
npm run frontend:install      # Install frontend dependencies
```

## Database Configuration

The system uses MySQL with a custom migration system. Database config is in `src/config/config.js` with environment variables:
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`
- Migrations are in `src/database/migrations/` with timestamp prefixes
- Models are in both `src/database/models/` and `src/database/orm/models/`

## Environment Configuration

Key environment variables (see `src/config/config.js` for all options):
- `TIKTOK_USERNAME`: TikTok user to connect to
- `GMOD_HOST`, `GMOD_WS_PORT`, `GMOD_HTTP_PORT`: Garry's Mod server connection
- `QUEUE_MAX_SIZE`: Queue size limit (default: 1000)
- `PORT`: Server port (default: 3000)

## External Service Integrations

The system is prepared for (but may not have implemented):
- **AI Services**: OpenAI, Anthropic, Google AI, Local models
- **TTS Services**: ElevenLabs, OpenAI TTS, Azure, Google TTS
- **Webhooks**: Discord, custom endpoints
- **Content Moderation**: Configurable through features flags

## File Structure Notes

- `src/app.js`: Main Express application entry point
- `src/services/`: Core business logic (TikTok, GMod, Event Manager)
- `src/queue/`: Queue management and processing
- `src/cli/`: Command-line utilities for migrations and queue management
- `frontend/src/`: React application with components, pages, hooks
- `logs/`: Application logs (check `logs/app.log` for debugging)

## Development Workflow

1. **Database Changes**: Always create migrations with `npm run make:migration`
2. **Queue Testing**: Use frontend simulator or API endpoints under `/api/simulate/`
3. **Service Integration**: Check service status via `/status` endpoint
4. **Logging**: Use Winston logger from `src/utils/logger.js`

## Testing Strategy

- Use Jest for unit tests
- Frontend has ESLint configuration for React
- Backend uses ESLint for code quality
- Health checks available at `/health` and `/status` endpoints
- Queue status monitoring at `/api/queue/status`

## GMod Integration

The system communicates with Garry's Mod via:
- **WebSocket**: Real-time event streaming
- **HTTP API**: Fallback communication and command execution
- **Message Format**: JSON with `type`, `data`, and `timestamp` fields

When making changes to event processing, ensure compatibility with the expected GMod message format documented in the README.