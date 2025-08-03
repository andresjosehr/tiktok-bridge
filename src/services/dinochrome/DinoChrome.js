const ServiceBase = require('../ServiceBase');
const logger = require('../../utils/logger');
const puppeteer = require('puppeteer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class DinoChrome extends ServiceBase {
  constructor() {
    super('DinoChrome');
    this.emoji = '🦕';
    this.browser = null;
    this.page = null;
    this.isGameRunning = false;
    this.jumpInterval = null;
    this.gameMonitorInterval = null;
    this.lastJumpTime = 0;
    this.consecutiveObstacles = 0;
    this.currentSpeed = 6;
    this.isPlayingAudio = false;
    this.audioQueue = [];
    this.activeAudioProcesses = new Set(); // Rastrear procesos de audio activos
    this.highScore = 0; // Récord máximo de la sesión
    this.currentScore = 0; // Puntuación actual
    logger.info(`${this.emoji} DinoChrome service initialized - Ready to control Chrome Dino game!`);
  }

  async connect() {
    try {
      logger.info(`${this.emoji} DinoChrome connecting - Launching Chrome browser...`);
      
      // Lanzar navegador Chrome
      this.browser = await puppeteer.launch({
        headless: false, // Mostrar el navegador para ver el juego
        defaultViewport: { width: 1200, height: 800 },
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--no-default-browser-check',
          '--disable-hang-monitor',
          '--disable-prompt-on-repost',
          '--disable-sync',
          '--metrics-recording-only',
          '--safebrowsing-disable-auto-update',
          '--disable-background-networking',
          '--aggressive-cache-discard',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-default-apps',
          '--disable-web-security',
          '--allow-running-insecure-content',
          '--disable-features=VizDisplayCompositor'
        ]
      });

      // Crear nueva página y simular estar desconectado para activar el juego del dinosaurio
      this.page = await this.browser.newPage();
      
      // Prevenir que la página se pause cuando pierde el foco
      await this.page.evaluateOnNewDocument(() => {
        // Interceptar y anular eventos de visibilidad
        Object.defineProperty(document, 'hidden', {
          get: function() { return false; },
          configurable: true
        });
        
        Object.defineProperty(document, 'visibilityState', {
          get: function() { return 'visible'; },
          configurable: true
        });
        
        // Prevenir que se disparen eventos de cambio de visibilidad
        document.addEventListener = new Proxy(document.addEventListener, {
          apply: function(target, thisArg, argumentsList) {
            if (argumentsList[0] === 'visibilitychange') {
              return; // No agregar listeners de visibilitychange
            }
            return target.apply(thisArg, argumentsList);
          }
        });
        
        // Mantener el foco simulado
        Object.defineProperty(document, 'hasFocus', {
          get: function() { return true; },
          configurable: true
        });
        
        // Prevenir pause del juego por blur/focus
        window.addEventListener = new Proxy(window.addEventListener, {
          apply: function(target, thisArg, argumentsList) {
            if (argumentsList[0] === 'blur' || argumentsList[0] === 'focus') {
              return; // No agregar listeners de blur/focus
            }
            return target.apply(thisArg, argumentsList);
          }
        });
        
        console.log('🦖 Background execution protection enabled!');
      });
      
      // Simular estar offline
      await this.page.setOfflineMode(true);
      
      // Navegar a cualquier página para activar el juego del dinosaurio
      await this.page.goto('http://google.com').catch(() => {
        // Esperamos que falle por estar offline
      });
      
      // Esperar un poco para que aparezca el dinosaurio
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verificar que el juego esté disponible
      const gameAvailable = await this.page.evaluate(() => {
        return typeof Runner !== 'undefined';
      });
      
      if (!gameAvailable) {
        throw new Error('Chrome Dino game not available');
      }
      
      // Iniciar el juego presionando espacio
      await this.page.keyboard.press('Space');
      logger.info(`${this.emoji} Chrome Dino game started!`);
      
      // Aplicar hack de inmortalidad y prevención de pausa
      await this.page.evaluate(() => {
        // Guardar la función original y reemplazarla con una función vacía
        if (typeof Runner !== 'undefined' && Runner.instance_) {
          Runner.prototype.gameOver = function(){};
          console.log('🦖 DINO IMMORTALITY ACTIVATED - Game Over disabled!');
          
          // Prevenir que el juego se pause por pérdida de foco
          const originalStop = Runner.instance_.stop;
          const originalPause = Runner.instance_.pause;
          
          Runner.instance_.stop = function() {
            console.log('🦖 STOP BLOCKED - Game continues running!');
            // No ejecutar stop
          };
          
          Runner.instance_.pause = function() {
            console.log('🦖 PAUSE BLOCKED - Game continues running!');
            // No ejecutar pause
          };
          
          // Forzar que el juego siempre esté en estado "playing"
          Object.defineProperty(Runner.instance_, 'playing', {
            get: function() { return true; },
            set: function(value) { 
              console.log(`🦖 Attempted to set playing to ${value}, keeping it true`);
              // No cambiar el valor
            },
            configurable: true
          });
          
          console.log('🦖 FOCUS LOSS PROTECTION ACTIVATED!');
        }
      });
      logger.info(`${this.emoji} Immortality hack and focus protection applied - Dino is now invincible and won't pause!`);
      
      // Iniciar el auto-jumping
      await this.startAutoJumping();
      
      this.setConnected(true);
      logger.info(`${this.emoji} DinoChrome connected - Chrome Dino automation activated!`);
      return true;
    } catch (error) {
      logger.error(`${this.emoji} Failed to connect DinoChrome: ${error.message}`);
      this.setConnected(false);
      return false;
    }
  }

  async disconnect() {
    try {
      // Detener intervalos (tanto setInterval como setTimeout)
      if (this.jumpInterval) {
        clearTimeout(this.jumpInterval);
        clearInterval(this.jumpInterval);
        this.jumpInterval = null;
      }
      
      if (this.gameMonitorInterval) {
        clearInterval(this.gameMonitorInterval);
        this.gameMonitorInterval = null;
      }
      
      // Limpiar cola de audio y estado de reproducción
      this.isPlayingAudio = false;
      this.audioQueue = [];
      
      // Forzar limpieza de procesos de audio pendientes
      try {
        // Primero terminar procesos rastreados
        for (const pid of this.activeAudioProcesses) {
          try {
            process.kill(pid, 'SIGTERM');
            logger.debug(`${this.emoji} Killed tracked audio process: ${pid}`);
          } catch (e) {
            // Proceso ya terminado
          }
        }
        this.activeAudioProcesses.clear();
        
        // Backup cleanup con pkill
        const { exec } = require('child_process');
        const platform = os.platform();
        
        if (platform === 'linux') {
          // Matar procesos de ffplay que puedan haber quedado
          exec('pkill -f ffplay 2>/dev/null', () => {});
        } else if (platform === 'darwin') {
          // Matar procesos de afplay en macOS
          exec('pkill afplay 2>/dev/null', () => {});
        }
      } catch (cleanupError) {
        logger.debug(`${this.emoji} Audio cleanup completed: ${cleanupError.message}`);
      }
      
      // Cerrar browser
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
      }
      
      this.isGameRunning = false;
      this.setConnected(false);
      logger.info(`${this.emoji} DinoChrome disconnected - Chrome browser closed and audio processes cleaned`);
      return true;
    } catch (error) {
      logger.error(`${this.emoji} Error disconnecting DinoChrome: ${error.message}`);
      return false;
    }
  }

  async handleTikTokChat(data) {
    this.updateLastActivity();
    
    console.log('\n' + '='.repeat(60));
    console.log(`${this.emoji} DinoChrome - CHAT EVENT`);
    console.log('='.repeat(60));
    console.log(`👤 Usuario: ${data.uniqueId || 'Anónimo'}`);
    console.log(`💬 Mensaje: ${data.comment || 'Sin mensaje'}`);
    console.log(`🕐 Timestamp: ${new Date().toLocaleString()}`);
    console.log(`📊 Likes del mensaje: ${data.likeCount || 0}`);
    if (data.profilePictureUrl) {
      console.log(`🖼️  Avatar: ${data.profilePictureUrl}`);
    }
    console.log('='.repeat(60) + '\n');
    
    logger.info(`${this.emoji} DinoChrome processed chat from ${data.uniqueId}: "${data.comment}"`);
  }

  async handleTikTokGift(data) {
    this.updateLastActivity();
    
    console.log('\n' + '🎁'.repeat(20));
    console.log(`${this.emoji} DinoChrome - GIFT/DONATION EVENT`);
    console.log('🎁'.repeat(20));
    console.log(`🎯 Usuario: ${data.uniqueId || 'Anónimo'}`);
    console.log(`🎁 Regalo: ${data.giftName || 'Regalo desconocido'}`);
    console.log(`🔢 Cantidad: ${data.repeatCount || 1}`);
    console.log(`💰 Costo total: ${(data.cost || 0) * (data.repeatCount || 1)} monedas`);
    console.log(`🏆 ID del regalo: ${data.giftId || 'N/A'}`);
    console.log(`🕐 Timestamp: ${new Date().toLocaleString()}`);
    
    // Extra emoji celebration for gifts!
    const celebration = ['🎉', '🎊', '✨', '🌟', '💫', '🎆'];
    const randomCelebration = celebration[Math.floor(Math.random() * celebration.length)];
    console.log(`${randomCelebration} ¡GRACIAS POR EL REGALO! ${randomCelebration}`);
    console.log('🎁'.repeat(20) + '\n');
    
    // Detectar si el regalo es un Rose o Rosa
    const giftCost = data.cost || 0;
    const giftName = data.giftName ? data.giftName.toLowerCase() : '';
    
    // GG para pruebas (checkeamos primero para que tenga prioridad)
    const isRosa = (giftName === 'gg' || giftName.includes('gg'));
    // Rose de 1 moneda (solo si NO es rosa y el costo es 1)
    const isRose = (!isRosa && giftName === 'rose' && giftCost === 1);
    
    if (isRosa) {
      console.log(`🎮 ¡GG DETECTADO! Reiniciando juego y reproduciendo audio especial... 🎮`);
      logger.info(`${this.emoji} GG detected! Cost: ${giftCost} coins, restarting game...`);
      
      // Reiniciar el juego primero
      await this.restartGame();
      
      // Reproducir audio aleatorio de la carpeta rosa/
      this.playGiftAudio('rosa', data);
      
    } else if (isRose) {
      console.log(`🌹 ¡ROSE DE 1 MONEDA DETECTADA! Reproduciendo audio especial... 🌹`);
      logger.info(`${this.emoji} Rose gift detected! Cost: ${giftCost} coins, playing audio...`);
      
      // Reproducir audio aleatorio de la carpeta rose/
      this.playGiftAudio('rose', data);
    }
    
    logger.info(`${this.emoji} DinoChrome processed gift from ${data.uniqueId}: ${data.giftName} x${data.repeatCount}`);
  }

  async handleTikTokFollow(data) {
    this.updateLastActivity();
    
    console.log('\n' + '👥'.repeat(18));
    console.log(`${this.emoji} DinoChrome - NEW FOLLOWER EVENT`);
    console.log('👥'.repeat(18));
    console.log(`🆕 Nuevo seguidor: ${data.uniqueId || 'Usuario anónimo'}`);
    console.log(`📈 Total seguidores: ${data.followersCount || 'Desconocido'}`);
    console.log(`🕐 Timestamp: ${new Date().toLocaleString()}`);
    console.log(`🎊 ¡Bienvenido a la familia!`);
    console.log('👥'.repeat(18) + '\n');
    
    logger.info(`${this.emoji} DinoChrome processed new follower: ${data.uniqueId}`);
  }

  async handleTikTokLike(data) {
    this.updateLastActivity();
    
    console.log('\n' + '👍'.repeat(15));
    console.log(`${this.emoji} DinoChrome - LIKE EVENT`);
    console.log('👍'.repeat(15));
    console.log(`❤️  Usuario: ${data.uniqueId || 'Anónimo'}`);
    console.log(`📊 Likes totales: ${data.totalLikes || 'Desconocido'}`);
    console.log(`🕐 Timestamp: ${new Date().toLocaleString()}`);
    console.log('👍'.repeat(15) + '\n');
    
    logger.debug(`${this.emoji} DinoChrome processed like from ${data.uniqueId}`);
  }

  async handleTikTokShare(data) {
    this.updateLastActivity();
    
    console.log('\n' + '📤'.repeat(15));
    console.log(`${this.emoji} DinoChrome - SHARE EVENT`);
    console.log('📤'.repeat(15));
    console.log(`🔄 Usuario: ${data.uniqueId || 'Anónimo'}`);
    console.log(`📢 ¡Compartió el stream!`);
    console.log(`🕐 Timestamp: ${new Date().toLocaleString()}`);
    console.log(`🚀 ¡Ayudando a crecer el canal!`);
    console.log('📤'.repeat(15) + '\n');
    
    logger.info(`${this.emoji} DinoChrome processed share from ${data.uniqueId}`);
  }

  async handleViewerCount(data) {
    this.updateLastActivity();
    
    // Solo mostrar cada 10 cambios para no saturar la consola
    if (!this.lastViewerCount || Math.abs(data.viewerCount - this.lastViewerCount) >= 10) {
      console.log('\n' + '👀'.repeat(12));
      console.log(`${this.emoji} DinoChrome - VIEWER COUNT UPDATE`);
      console.log('👀'.repeat(12));
      console.log(`👥 Espectadores actuales: ${data.viewerCount || 0}`);
      console.log(`📈 Cambio: ${this.lastViewerCount ? (data.viewerCount - this.lastViewerCount > 0 ? '+' : '') + (data.viewerCount - this.lastViewerCount) : 'Primer registro'}`);
      console.log(`🕐 Timestamp: ${new Date().toLocaleString()}`);
      console.log('👀'.repeat(12) + '\n');
      
      this.lastViewerCount = data.viewerCount;
      logger.debug(`${this.emoji} DinoChrome updated viewer count: ${data.viewerCount}`);
    }
  }

  // Método extra para obtener estadísticas del servicio
  getServiceStatus() {
    const baseStatus = super.getServiceStatus();
    return {
      ...baseStatus,
      emoji: this.emoji,
      description: 'Chrome Dino game automation with TikTok event logging and audio playback',
      gameStatus: this.isGameRunning ? 'Playing automatically' : 'Not running',
      browserStatus: this.browser ? 'Connected' : 'Disconnected',
      audioStatus: this.isPlayingAudio ? 'Playing audio' : 'Audio idle',
      audioQueueSize: this.audioQueue.length,
      eventsProcessed: this.lastActivity ? 'Active' : 'Waiting for events',
      currentScore: this.currentScore,
      sessionHighScore: this.highScore,
      capabilities: [
        'Chrome Dino automation',
        'Infinite auto-jumping',
        'Obstacle detection',
        'Immortality hack (never game over)',
        'TikTok event logging',
        'Real-time game monitoring',
        'Rose gift audio playback (1 coin)',
        'Rosa gift audio playback + game restart (10+ coins)',
        'Sequential audio queue management'
      ]
    };
  }

  // Método para reiniciar el juego del dinosaurio navegando a chrome://dino/
  async restartGame() {
    try {
      if (!this.page) {
        logger.warn(`${this.emoji} Cannot restart game - no page available`);
        return false;
      }
      
      logger.info(`${this.emoji} Restarting Chrome Dino game by navigating to chrome://dino/...`);
      
      // Guardar el récord actual antes de reiniciar
      const currentGameScore = await this.page.evaluate(() => {
        if (typeof Runner !== 'undefined' && Runner.instance_) {
          const game = Runner.instance_;
          return Math.floor(game.distanceRan / 10) || 0;
        }
        return 0;
      });
      
      // Actualizar el récord si es necesario
      if (currentGameScore > this.highScore) {
        this.highScore = currentGameScore;
        logger.info(`${this.emoji} New high score! ${this.highScore}`);
      }
      
      this.currentScore = currentGameScore;
      console.log(`🏆 Récord actual de la sesión: ${this.highScore} puntos`);
      
      // Detener el auto-jumping temporalmente
      const wasRunning = this.isGameRunning;
      this.isGameRunning = false;
      
      if (this.jumpInterval) {
        clearTimeout(this.jumpInterval);
        clearInterval(this.jumpInterval);
        this.jumpInterval = null;
      }
      
      // Primero salir del modo offline temporalmente
      await this.page.setOfflineMode(false);
      
      try {
        // Navegar a chrome://dino/ para empezar completamente desde cero
        await this.page.goto('chrome://dino/');
        logger.info(`${this.emoji} Successfully navigated to chrome://dino/`);
      } catch (error) {
        logger.warn(`${this.emoji} Could not navigate to chrome://dino/, using offline fallback: ${error.message}`);
        // Fallback: volver al modo offline y usar el método tradicional
        await this.page.setOfflineMode(true);
        await this.page.goto('http://google.com').catch(() => {});
      }
      
      // Esperar un momento para que la página cargue
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verificar que el juego esté disponible y reiniciarlo
      const gameRestarted = await this.page.evaluate(() => {
        if (typeof Runner !== 'undefined') {
          // Si hay una instancia, reiniciarla
          if (Runner.instance_) {
            Runner.instance_.restart();
            console.log('🦖 GAME RESTARTED using Runner.restart()');
          } else {
            // Si no hay instancia, inicializar el juego
            console.log('🦖 No Runner instance found, starting new game');
          }
          return true;
        }
        return false;
      });
      
      if (!gameRestarted) {
        logger.warn(`${this.emoji} Game not available, ensuring offline mode and reloading`);
        // Asegurar modo offline y recargar
        await this.page.setOfflineMode(true);
        await this.page.goto('http://google.com').catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Intentar iniciar el juego
        await this.page.keyboard.press('Space');
      } else {
        // Si el juego se reinició correctamente, simplemente presionar espacio para asegurar que esté corriendo
        await this.page.keyboard.press('Space');
      }
      
      logger.info(`${this.emoji} Game restarted and started!`);
      
      // Aplicar hack de inmortalidad y restaurar récord
      const highScore = this.highScore;
      await this.page.evaluate((preservedHighScore) => {
        if (typeof Runner !== 'undefined' && Runner.instance_) {
          // Aplicar hack de inmortalidad
          Runner.prototype.gameOver = function(){};
          console.log('🦖 IMMORTALITY ACTIVATED after restart!');
          
          // Restaurar el récord máximo (intento seguro con fallback)
          if (preservedHighScore > 0) {
            try {
              // Intentar usar localStorage si está disponible
              if (typeof localStorage !== 'undefined' && localStorage) {
                localStorage.setItem('highScore', preservedHighScore.toString());
                console.log(`🏆 Récord guardado en localStorage: ${preservedHighScore} puntos`);
              }
            } catch (localStorageError) {
              console.log(`🏆 localStorage no disponible, preservando récord internamente: ${preservedHighScore} puntos`);
              // Fallback: guardar el high score directamente en una variable global
              if (typeof window !== 'undefined') {
                window.dinoHighScore = preservedHighScore;
              }
            }
            
            // También actualizar la variable del juego si existe
            if (Runner.instance_.distanceRan !== undefined) {
              // Mostrar el récord preservado en la consola del navegador
              console.log(`🏆 Récord preservado: ${preservedHighScore} puntos`);
            }
          }
        }
      }, highScore);
      
      // Reiniciar el auto-jumping si estaba corriendo
      if (wasRunning) {
        await this.startAutoJumping();
      }
      
      logger.info(`${this.emoji} Game restarted successfully from chrome://dino/!`);
      return true;
    } catch (error) {
      logger.error(`${this.emoji} Error restarting game: ${error.message}`);
      return false;
    }
  }

  // Método para reproducir audio de regalo (rose o rosa)
  playGiftAudio(giftType, data) {
    const audioPath = this.getRandomGiftAudio(giftType);
    if (!audioPath) {
      logger.warn(`${this.emoji} No ${giftType} audio file found`);
      return;
    }

    // Si ya hay un audio reproduciéndose, agregarlo a la cola
    if (this.isPlayingAudio) {
      this.audioQueue.push({
        path: audioPath,
        giftData: data,
        giftType: giftType
      });
      logger.info(`${this.emoji} ${giftType} audio queued: ${path.basename(audioPath)} (Queue size: ${this.audioQueue.length})`);
    } else {
      // Reproducir inmediatamente sin bloquear el procesamiento de eventos
      logger.info(`${this.emoji} Playing ${giftType} audio: ${path.basename(audioPath)}`);
      // Ejecutar de forma asíncrona sin await para no bloquear
      this.playAudio(audioPath).then(() => {
        // Procesar la cola después de terminar
        this.processAudioQueue();
      }).catch(error => {
        logger.error(`${this.emoji} Error playing audio: ${error.message}`);
        this.isPlayingAudio = false;
        this.processAudioQueue();
      });
    }
  }

  // Método para obtener un audio aleatorio de regalos (rose o rosa)
  getRandomGiftAudio(giftType) {
    try {
      const audiosDir = path.join(__dirname, 'audios', giftType);
      const files = fs.readdirSync(audiosDir)
        .filter(file => file.endsWith('.mp3'));
      
      if (files.length === 0) {
        logger.warn(`${this.emoji} No ${giftType} audio files found in ${audiosDir}`);
        return null;
      }
      
      const randomFile = files[Math.floor(Math.random() * files.length)];
      return path.join(audiosDir, randomFile);
    } catch (error) {
      logger.error(`${this.emoji} Error getting random ${giftType} audio: ${error.message}`);
      return null;
    }
  }

  // Método para obtener un audio aleatorio de rosas (compatibilidad hacia atrás)
  getRandomRoseAudio() {
    return this.getRandomGiftAudio('rosa');
  }

  // Método para obtener la duración del audio (estimada por tamaño de archivo)
  async getAudioDuration(filePath) {
    return new Promise((resolve) => {
      try {
        const stats = fs.statSync(filePath);
        const fileSizeBytes = stats.size;
        
        // Estimación más precisa basada en archivos de audio cortos
        // Aproximadamente 16KB por segundo para archivos MP3 cortos de calidad media
        const estimatedDuration = (fileSizeBytes / 16000) * 1000; // En milisegundos
        
        // Para archivos pequeños, ajustar mínimo más realista
        const duration = Math.max(1500, Math.min(estimatedDuration, 8000)); // Entre 1.5-8 segundos
        
        logger.debug(`${this.emoji} Audio duration estimated: ${Math.round(duration)}ms for ${path.basename(filePath)} (${fileSizeBytes} bytes)`);
        resolve(duration);
      } catch (error) {
        logger.warn(`${this.emoji} Failed to get audio duration, using default:`, error.message);
        resolve(3000); // 3 segundos por defecto
      }
    });
  }

  // Método para reproducir audio con gestión de estado mejorada
  async playAudio(filePath) {
    return new Promise(async (resolve) => {
      let audioProcess = null;
      let timeoutId = null;
      
      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (audioProcess && !audioProcess.killed) {
          try {
            audioProcess.kill('SIGTERM');
            this.activeAudioProcesses.delete(audioProcess.pid);
          } catch (e) {
            // Proceso ya terminado
          }
        }
        this.isPlayingAudio = false;
      };

      try {
        this.isPlayingAudio = true;
        const platform = os.platform();
        let command;
        let args = [];
        
        if (platform === 'linux') {
          // Usar solo ffplay con argumentos separados para mejor control
          command = 'ffplay';
          args = ['-nodisp', '-autoexit', '-loglevel', 'quiet', filePath];
        } else if (platform === 'darwin') {
          // macOS
          command = 'afplay';
          args = [filePath];
        } else if (platform === 'win32') {
          // Windows - usar powershell con timeout
          command = 'powershell';
          args = ['-c', `$player = New-Object Media.SoundPlayer '${filePath}'; $player.PlaySync()`];
        } else {
          logger.warn(`${this.emoji} Unsupported platform for audio playback: ${platform}`);
          cleanup();
          resolve();
          return;
        }
        
        // Obtener duración del audio
        const duration = await this.getAudioDuration(filePath);
        
        // Usar spawn para mejor control del proceso
        const { spawn } = require('child_process');
        audioProcess = spawn(command, args, {
          stdio: ['ignore', 'ignore', 'pipe']
        });
        
        // Registrar el proceso activo
        this.activeAudioProcesses.add(audioProcess.pid);
        
        let hasResolved = false;
        
        audioProcess.on('close', (code) => {
          if (!hasResolved) {
            hasResolved = true;
            if (code === 0) {
              logger.info(`${this.emoji} Audio playback completed: ${path.basename(filePath)}`);
            } else {
              logger.warn(`${this.emoji} Audio process exited with code ${code}: ${path.basename(filePath)}`);
            }
            cleanup();
            resolve();
          }
        });
        
        audioProcess.on('error', (error) => {
          if (!hasResolved) {
            hasResolved = true;
            logger.warn(`${this.emoji} Failed to play audio: ${error.message}`);
            cleanup();
            resolve();
          }
        });
        
        // Timeout de seguridad basado en duración estimada + margen
        const safetyTimeout = duration + 2000; // 2 segundos extra de margen
        timeoutId = setTimeout(() => {
          if (!hasResolved) {
            hasResolved = true;
            logger.warn(`${this.emoji} Audio playback timeout after ${safetyTimeout}ms: ${path.basename(filePath)}`);
            cleanup();
            resolve();
          }
        }, safetyTimeout);
        
        logger.info(`${this.emoji} Audio playback started: ${path.basename(filePath)} (estimated ${Math.round(duration)}ms)`);
        
      } catch (error) {
        logger.error(`${this.emoji} Error in audio playback: ${error.message}`);
        cleanup();
        resolve();
      }
    });
  }

  // Método para procesar la cola de audios
  async processAudioQueue() {
    if (this.audioQueue.length > 0 && !this.isPlayingAudio) {
      const nextAudio = this.audioQueue.shift();
      const audioType = nextAudio.giftType || 'gift';
      logger.info(`${this.emoji} Processing queued ${audioType} audio: ${path.basename(nextAudio.path)} (${this.audioQueue.length} remaining)`);
      
      try {
        await this.playAudio(nextAudio.path);
        // Recursivamente procesar el siguiente en la cola
        this.processAudioQueue();
      } catch (error) {
        logger.error(`${this.emoji} Error processing queued audio: ${error.message}`);
        this.isPlayingAudio = false;
        // Continuar con el siguiente en la cola incluso si falló
        this.processAudioQueue();
      }
    }
  }

  // Método para iniciar el auto-jumping con detección de obstáculos
  async startAutoJumping() {
    if (!this.page) return;
    
    this.isGameRunning = true;
    logger.info(`${this.emoji} Starting auto-jumping system...`);
    
    // Declarar scheduleDynamicJump en el scope de la clase para reutilización
    let scheduleDynamicJump;
    
    // Función para detectar obstáculos y saltar
    const autoJump = async () => {
      if (!this.page || !this.isGameRunning) return;
      
      try {
        // Evaluar en el contexto de la página para detectar obstáculos
        const jumpInfo = await this.page.evaluate(() => {
          // Acceder al objeto del juego del dinosaurio
          if (typeof Runner !== 'undefined' && Runner.instance_) {
            const game = Runner.instance_;
            
            // Si el juego está corriendo
            if (game.playing) {
              // Obtener la posición del dinosaurio
              const dinoX = game.tRex.xPos;
              const dinoY = game.tRex.yPos;
              const dinoJumping = game.tRex.jumping;
              const dinoSpeedY = game.tRex.speedY || 0; // Velocidad vertical
              const speed = game.currentSpeed || 6;
              
              // CONSTANTES FÍSICAS DEL JUEGO (valores reales del Chrome Dino)
              const JUMP_VELOCITY = -10; // Velocidad inicial del salto (negativa = hacia arriba)
              const GRAVITY = 0.6; // Gravedad del juego
              const JUMP_DURATION_FRAMES = Math.abs(2 * JUMP_VELOCITY / GRAVITY); // ~33 frames
              const JUMP_DURATION_MS = JUMP_DURATION_FRAMES * 16.67; // ~550ms a 60fps
              
              // Calcular distancia que viaja el dino durante un salto completo
              const HORIZONTAL_DISTANCE_PER_JUMP = (speed * JUMP_DURATION_MS) / 16.67;
              
              // Calcular punto de aterrizaje proyectado
              const landingX = dinoX + HORIZONTAL_DISTANCE_PER_JUMP;
              
              // Verificar obstáculos cercanos
              const obstacles = game.horizon.obstacles;
              
              // Distancia de detección más agresiva para obstáculos consecutivos
              const reactionTime = 120; // 120ms tiempo de reacción
              const speedFactor = Math.min(speed * 10, 100); // Factor de velocidad limitado
              const detectionDistance = 80 + speedFactor; // Base 80px + factor de velocidad
              
              // Distancia extendida para detectar secuencias problemáticas temprano
              const sequenceDetectionDistance = detectionDistance + 120;
              
              // Detectar obstáculos para análisis completo
              let obstaclesInRange = [];
              
              for (let i = 0; i < obstacles.length; i++) {
                const obstacle = obstacles[i];
                const obstacleX = obstacle.xPos;
                const obstacleY = obstacle.yPos;
                const obstacleWidth = obstacle.width || 20;
                const obstacleHeight = obstacle.height || 20;
                const obstacleType = obstacle.typeConfig?.type || 'CACTUS';
                
                // ANÁLISIS DETALLADO DE TIPOS Y TAMAÑOS DE OBSTÁCULOS
                let obstacleCategory = 'unknown';
                let safetyMargin = 25; // Margen base de seguridad
                
                if (obstacleType === 'PTERODACTYL') {
                  obstacleCategory = 'pterodactyl';
                  safetyMargin = 15; // Menos margen para pájaros
                } else {
                  // Categorizar cactus por ancho
                  if (obstacleWidth <= 20) {
                    obstacleCategory = 'small_cactus'; // Cactus simple
                    safetyMargin = 20;
                  } else if (obstacleWidth <= 35) {
                    obstacleCategory = 'medium_cactus'; // Cactus doble
                    safetyMargin = 30;
                  } else if (obstacleWidth <= 50) {
                    obstacleCategory = 'large_cactus'; // Cactus triple
                    safetyMargin = 40;
                  } else {
                    obstacleCategory = 'extra_large_cactus'; // Cactus muy grande
                    safetyMargin = 50;
                  }
                }
                
                const distance = obstacleX - dinoX;
                const obstacleEndX = obstacleX + obstacleWidth;
                const safeLandingPoint = obstacleEndX + safetyMargin;
                
                // Solo considerar obstáculos relevantes (usar distancia extendida para secuencias)
                if (distance > -20 && distance < sequenceDetectionDistance) {
                  const isPtero = obstacleType === 'PTERODACTYL' || obstacle.gap > 0;
                  const isHighBird = isPtero && obstacleY < 75;
                  const isLowBird = isPtero && obstacleY >= 75;
                  
                  // Verificar si el punto de aterrizaje colisionaría con este obstáculo
                  const wouldLandOnObstacle = landingX >= obstacleX && landingX <= obstacleEndX;
                  
                  obstaclesInRange.push({
                    distance,
                    x: obstacleX,
                    endX: obstacleEndX,
                    y: obstacleY,
                    width: obstacleWidth,
                    height: obstacleHeight,
                    type: isHighBird ? 'high_bird' : (isLowBird ? 'low_bird' : 'cactus'),
                    category: obstacleCategory,
                    safetyMargin: safetyMargin,
                    safeLandingPoint: safeLandingPoint,
                    needsJump: !isHighBird,
                    wouldLandOnObstacle: wouldLandOnObstacle && !isHighBird
                  });
                }
              }
              
              // Ordenar por distancia
              obstaclesInRange.sort((a, b) => a.distance - b.distance);
              
              // ANÁLISIS CRÍTICO: Verificar obstáculos en zona de aterrizaje Y próximos
              const obstaclesInLandingZone = obstaclesInRange.filter(obs => 
                obs.wouldLandOnObstacle && obs.needsJump
              );
              
              // ANÁLISIS ADICIONAL: Detectar secuencias problemáticas
              const proximityThreshold = 80; // Distancia mínima entre obstáculos para ser "seguidos"
              let obstacleSequences = [];
              
              for (let i = 0; i < obstaclesInRange.length - 1; i++) {
                const current = obstaclesInRange[i];
                const next = obstaclesInRange[i + 1];
                
                if (current.needsJump && next.needsJump) {
                  const gap = next.x - current.endX;
                  if (gap < proximityThreshold) {
                    obstacleSequences.push({
                      start: current,
                      end: next,
                      gap: gap,
                      totalWidth: next.endX - current.x,
                      isProblematic: gap < 50 // Gaps menores a 50px son problemáticos
                    });
                  }
                }
              }
              
              // LÓGICA MEJORADA PARA OBSTÁCULOS CONSECUTIVOS
              if (obstaclesInRange.length > 0) {
                const firstObstacle = obstaclesInRange[0];
                
                // LÓGICA ESPECIAL: Si ya está saltando pero viene otro obstáculo muy cerca
                if (dinoJumping && firstObstacle.distance < 60 && firstObstacle.needsJump) {
                  // Calcular si puede hacer un segundo salto (salto doble)
                  const isDescending = dinoSpeedY > 0; // Velocidad positiva = cayendo
                  const canDoubleJump = !isDescending && dinoSpeedY < -2; // Solo si aún está subiendo
                  
                  if (canDoubleJump) {
                    return {
                      shouldJump: true,
                      type: 'double_jump',
                      distance: firstObstacle.distance,
                      speed: speed,
                      isHighSpeed: speed > 10,
                      consecutiveObstacles: 1,
                      inAir: true,
                      shortJump: true
                    };
                  }
                }
                
                // Verificar obstáculos inmediatos (solo si no está saltando)
                if (firstObstacle.distance < detectionDistance && firstObstacle.needsJump) {
                  
                  // CASO CRÍTICO: Detectar secuencias problemáticas primero
                  const problematicSequence = obstacleSequences.find(seq => seq.isProblematic && seq.start.distance < detectionDistance);
                  
                  // NUEVA ESTRATEGIA: En lugar de saltos extendidos, usar saltos rápidos y precisos
                  if (obstaclesInLandingZone.length > 0 || problematicSequence) {
                    
                    // Para obstáculos consecutivos, usar salto CORTO y preciso para pasar solo el primer obstáculo
                    if (!dinoJumping) {
                      // USAR PUNTO DE ATERRIZAJE SEGURO CALCULADO basado en ancho real del obstáculo
                      const safeLandingX = firstObstacle.safeLandingPoint;
                      const shortJumpDistance = safeLandingX - dinoX;
                      
                      // Calcular ratio de salto basado en distancia real necesaria
                      const shortJumpRatio = shortJumpDistance / HORIZONTAL_DISTANCE_PER_JUMP;
                      
                      // Ajustar duración basada en el tipo de obstáculo
                      let durationMultiplier = 1.0;
                      if (firstObstacle.category === 'large_cactus' || firstObstacle.category === 'extra_large_cactus') {
                        durationMultiplier = 1.2; // 20% más duración para cactus grandes
                      } else if (firstObstacle.category === 'medium_cactus') {
                        durationMultiplier = 1.1; // 10% más duración para cactus medianos
                      }
                      
                      return {
                        shouldJump: true,
                        type: 'width_aware_jump',
                        distance: firstObstacle.distance,
                        speed: speed,
                        isHighSpeed: speed > 10,
                        consecutiveObstacles: obstaclesInLandingZone.length + (problematicSequence ? 1 : 0),
                        shortJump: true,
                        jumpRatio: Math.min(shortJumpRatio, 1.3), // Permitir hasta 30% más de salto normal
                        targetClearanceX: safeLandingX,
                        obstacleWidth: firstObstacle.width,
                        obstacleCategory: firstObstacle.category,
                        durationMultiplier: durationMultiplier,
                        isSequenceStart: true
                      };
                    }
                  }
                  // CASO NORMAL: No hay obstáculos en zona de aterrizaje
                  else if (!dinoJumping) {
                    // Contar obstáculos consecutivos próximos
                    let consecutiveCount = 0;
                    for (let i = 0; i < Math.min(4, obstaclesInRange.length); i++) {
                      if (obstaclesInRange[i].needsJump && obstaclesInRange[i].distance < detectionDistance + 60) {
                        consecutiveCount++;
                      }
                    }
                    
                    return {
                      shouldJump: true,
                      type: firstObstacle.type,
                      distance: firstObstacle.distance,
                      speed: speed,
                      isHighSpeed: speed > 10,
                      consecutiveObstacles: consecutiveCount,
                      extendedJump: false,
                      landingIssue: false,
                      obstacleWidth: firstObstacle.width,
                      obstacleCategory: firstObstacle.category,
                      targetClearanceX: firstObstacle.safeLandingPoint
                    };
                  }
                }
                // Pájaros altos - agacharse
                else if (firstObstacle.type === 'high_bird' && firstObstacle.distance < detectionDistance) {
                  return { shouldJump: false, type: 'high_bird', distance: firstObstacle.distance, speed };
                }
              }
            }
          }
          return { shouldJump: false, type: 'none', distance: 0, speed: 6 };
        });
        
        // Si se detectó un obstáculo, ejecutar acción apropiada con salto dinámico
        if (jumpInfo.shouldJump) {
          const currentTime = Date.now();
          const timeSinceLastJump = currentTime - this.lastJumpTime;
          
          // NUEVO: Manejar saltos dobles para obstáculos muy consecutivos
          if (jumpInfo.type === 'double_jump' && jumpInfo.inAir) {
            // SALTO DOBLE: Pulso rápido de espacio mientras está en el aire
            await this.page.keyboard.press('Space');
            logger.warn(`${this.emoji} DOUBLE JUMP while in air! Distance to next obstacle: ${jumpInfo.distance}`);
          }
          // NUEVO: Manejar saltos conscientes del ancho de obstáculos
          else if ((jumpInfo.shortJump && jumpInfo.isSequenceStart) || jumpInfo.type === 'width_aware_jump') {
            // SALTO AJUSTADO POR ANCHO: Duración calculada basada en el ancho real del obstáculo
            const baseDuration = 100; // Duración mínima
            const jumpRatio = jumpInfo.jumpRatio || 0.8;
            const durationMultiplier = jumpInfo.durationMultiplier || 1.0;
            
            // Calcular duración final considerando ancho del obstáculo
            const rawDuration = baseDuration + (jumpRatio * 60); // 100-160ms base
            const finalDuration = Math.floor(rawDuration * durationMultiplier);
            
            await this.page.keyboard.down('Space');
            await new Promise(resolve => setTimeout(resolve, finalDuration));
            await this.page.keyboard.up('Space');
            
            const obstacleInfo = jumpInfo.obstacleCategory ? `${jumpInfo.obstacleCategory}(${jumpInfo.obstacleWidth}px)` : 'unknown';
            logger.info(`${this.emoji} WIDTH-AWARE JUMP! Duration: ${finalDuration}ms (${durationMultiplier}x), Obstacle: ${obstacleInfo}, Target: ${jumpInfo.targetClearanceX}, Ratio: ${jumpRatio.toFixed(2)}`);
          }
          // Salto de alta velocidad y múltiples obstáculos
          else if (jumpInfo.isHighSpeed && jumpInfo.consecutiveObstacles > 1) {
            // Salto más potente para alta velocidad y obstáculos consecutivos
            const powerDuration = 160 + Math.min(jumpInfo.speed * 4, 80); // Máximo 240ms
            await this.page.keyboard.down('Space');
            await new Promise(resolve => setTimeout(resolve, powerDuration));
            await this.page.keyboard.up('Space');
            logger.debug(`${this.emoji} HIGH-SPEED POWER JUMP! Speed: ${jumpInfo.speed}, Duration: ${powerDuration}ms, Consecutive: ${jumpInfo.consecutiveObstacles}`);
          }
          // Salto para múltiples obstáculos a velocidad media
          else if (jumpInfo.consecutiveObstacles > 1 && jumpInfo.speed > 7) {
            // Salto medio-potente para secuencias de obstáculos
            const mediumDuration = 130 + (jumpInfo.speed * 3);
            await this.page.keyboard.down('Space');
            await new Promise(resolve => setTimeout(resolve, mediumDuration));
            await this.page.keyboard.up('Space');
            logger.debug(`${this.emoji} MEDIUM POWER JUMP! Speed: ${jumpInfo.speed}, Duration: ${mediumDuration}ms, Consecutive: ${jumpInfo.consecutiveObstacles}`);
          }
          // Salto rápido para obstáculos muy seguidos (menos de 600ms desde último salto)
          else if (timeSinceLastJump < 600 && jumpInfo.consecutiveObstacles > 0) {
            // Salto rápido optimizado
            const quickDuration = 90 + (jumpInfo.speed * 2);
            await this.page.keyboard.down('Space');
            await new Promise(resolve => setTimeout(resolve, quickDuration));
            await this.page.keyboard.up('Space');
            logger.debug(`${this.emoji} QUICK CONSECUTIVE JUMP! Gap: ${timeSinceLastJump}ms, Duration: ${quickDuration}ms`);
          }
          // Salto estándar (ahora consciente del ancho)
          else {
            // Salto estándar con duración optimizada por velocidad Y ancho del obstáculo
            let baseDuration = 110 + Math.min(jumpInfo.speed * 2, 40);
            
            // Ajustar duración basada en ancho del obstáculo
            if (jumpInfo.obstacleCategory) {
              if (jumpInfo.obstacleCategory === 'large_cactus' || jumpInfo.obstacleCategory === 'extra_large_cactus') {
                baseDuration *= 1.15; // 15% más para cactus grandes
              } else if (jumpInfo.obstacleCategory === 'medium_cactus') {
                baseDuration *= 1.08; // 8% más para cactus medianos
              }
            }
            
            const standardDuration = Math.floor(baseDuration);
            
            await this.page.keyboard.down('Space');
            await new Promise(resolve => setTimeout(resolve, standardDuration));
            await this.page.keyboard.up('Space');
            
            const obstacleInfo = jumpInfo.obstacleCategory ? `${jumpInfo.obstacleCategory}(${jumpInfo.obstacleWidth}px)` : jumpInfo.type;
            logger.debug(`${this.emoji} STANDARD WIDTH-AWARE JUMP - ${obstacleInfo} at distance ${jumpInfo.distance}, Duration: ${standardDuration}ms`);
          }
          
          this.lastJumpTime = currentTime;
          this.consecutiveObstacles = jumpInfo.consecutiveObstacles || 0;
          
        } else if (jumpInfo.type === 'high_bird') {
          // Para pájaros altos, simplemente agacharse (no hacer nada, dejar que pase)
          logger.debug(`${this.emoji} High bird detected - DUCKING (letting it pass)`);
        }
        
      } catch (error) {
        logger.debug(`${this.emoji} Auto-jump evaluation error: ${error.message}`);
      }
    };
    
    // Ejecutar la detección con intervalo más agresivo para obstáculos consecutivos
    const getDynamicInterval = () => {
      // Intervalo más frecuente para velocidades altas, pero nunca menos de 20ms
      const baseInterval = 35;
      const speedReduction = Math.floor((this.currentSpeed || 6) * 1.5);
      return Math.max(20, baseInterval - speedReduction);
    };
    
    // Función recursiva para mantener intervalo dinámico
    scheduleDynamicJump = () => {
      if (!this.isGameRunning) return;
      
      autoJump().then(() => {
        if (this.isGameRunning) {
          this.jumpInterval = setTimeout(scheduleDynamicJump, getDynamicInterval());
        }
      }).catch(error => {
        logger.debug(`${this.emoji} Jump scheduling error: ${error.message}`);
        if (this.isGameRunning) {
          this.jumpInterval = setTimeout(scheduleDynamicJump, 40); // Fallback interval
        }
      });
    };
    
    // Iniciar el ciclo dinámico
    scheduleDynamicJump();
    
    // Monitor del estado del juego cada 2 segundos
    this.gameMonitorInterval = setInterval(async () => {
      if (!this.page) return;
      
      try {
        const gameStatus = await this.page.evaluate(() => {
          if (typeof Runner !== 'undefined' && Runner.instance_) {
            const game = Runner.instance_;
            return {
              playing: game.playing,
              crashed: game.crashed,
              score: Math.floor(game.distanceRan / 10) || 0,
              speed: game.currentSpeed || 0
            };
          }
          return null;
        });
        
        if (gameStatus) {
          // Actualizar velocidad actual para el intervalo dinámico
          this.currentSpeed = gameStatus.speed || 6;
          this.currentScore = gameStatus.score || 0;
          
          // Actualizar récord si es necesario
          if (this.currentScore > this.highScore) {
            this.highScore = this.currentScore;
            console.log(`🏆 ¡NUEVO RÉCORD! ${this.highScore} puntos`);
            logger.info(`${this.emoji} New session high score: ${this.highScore}`);
          }
          
          if (gameStatus.crashed && this.isGameRunning) {
            logger.info(`${this.emoji} Crash detected but immortality is active - Score: ${gameStatus.score}. Session Record: ${this.highScore}`);
            // Ya no reiniciamos porque el dino es inmortal
          } else if (gameStatus.playing) {
            logger.debug(`${this.emoji} Game running - Score: ${gameStatus.score}, Speed: ${gameStatus.speed.toFixed(1)}, Session Record: ${this.highScore}`);
          }
        }
      } catch (error) {
        logger.debug(`${this.emoji} Game monitor error: ${error.message}`);
      }
    }, 2000);
  }


  // Método para mostrar información del servicio
  showServiceInfo() {
    console.log('\n' + '🦕'.repeat(25));
    console.log('        DinoChrome Chrome Dino Controller        ');
    console.log('🦕'.repeat(25));
    console.log('📋 Capacidades:');
    console.log('   🎮 Chrome Dino game automation');
    console.log('   🦘 Infinite auto-jumping');
    console.log('   👁️  Obstacle detection');
    console.log('   🔄 Auto-restart on game over');
    console.log('   💬 TikTok event logging');
    console.log('   🎁 Gift & donation tracking');
    console.log('\n🎯 Estado: ' + (this.isGameRunning ? 'Jugando automáticamente' : 'Esperando conexión'));
    console.log('🦕'.repeat(25) + '\n');
  }
}

module.exports = DinoChrome;