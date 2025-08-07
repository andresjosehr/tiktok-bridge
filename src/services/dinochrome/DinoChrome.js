const ServiceBase = require('../ServiceBase');
const logger = require('../../utils/logger');
const puppeteer = require('puppeteer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const config = require('../../config/config');

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
    this.activeAudioProcesses = new Map(); // Rastrear procesos con más detalles
    this.currentAudioProcess = null; // Solo UN proceso activo a la vez
    this.audioCleanupInterval = null; // Limpieza periódica
    this.highScore = 0; // Récord máximo de la sesión
    this.currentScore = 0; // Puntuación actual
    this.isRestartingGame = false; // Flag para evitar solapamiento de reinicio de juego
    
    // Índices para reproducción secuencial de audios
    this.roseAudioIndex = 0; // Índice actual para audios de rose
    this.rosaAudioIndex = 0; // Índice actual para audios de rosa
    
    // Configurar DinoChrome para procesar solo eventos finales de rachas de gifts
    this.setProcessOnlyFinalGifts(true);
    
    // Configurar prioridades personalizadas para DinoChrome
    // DinoChrome prioriza gifts y donations muy alto ya que reproduce audio y reinicia el juego
    this.setEventPriorities({
      'tiktok:gift': 150,     // Muy alta prioridad para gifts (reproduce audio)
      'tiktok:donation': 150, // Muy alta prioridad para donations
      'tiktok:follow': 20,    // Baja prioridad para follows (solo logging)
      'tiktok:chat': 5,       // Muy baja prioridad para chat (solo logging)
      'tiktok:like': 1,       // Prioridad mínima para likes
      'tiktok:share': 10,     // Baja prioridad para shares
      'tiktok:viewerCount': 1 // Prioridad mínima para viewer count
    });
    
    // Configurar prioridades específicas por tipo de regalo
    // DinoChrome necesita diferentes prioridades según el regalo para manejar audio y reinicio de juego
    this.setGiftPriorities({
      // Prioridades por nombre específico de regalo
      byName: {
        'rose': 200,        // Rose de 1 moneda - Muy alta prioridad (reproduce audio inmediato)
        'rosa': 250,        // Rosa - Máxima prioridad (audio + reinicia juego)
        'gg': 250,          // GG en modo TEST - Máxima prioridad
        'perfume': 180,     // Perfume - Alta prioridad
        'confetti': 160,    // Confetti - Alta prioridad
        'finger heart': 140, // Finger Heart - Prioridad media-alta
        'tiktok': 120,      // TikTok logo - Prioridad media
        'thumbs up': 100,   // Thumbs Up - Prioridad media
      },
      
      // Prioridades por rango de costo (fallback cuando no hay coincidencia por nombre)
      byCostRange: [
        {
          minCost: 100,     // 100+ monedas
          maxCost: 999999,  // Sin límite superior
          priority: 300,    // Prioridad ultra alta para regalos muy caros
          description: 'Regalos premium (100+ monedas)'
        },
        {
          minCost: 50,      // 50-99 monedas
          maxCost: 99,
          priority: 220,    // Prioridad muy alta
          description: 'Regalos costosos (50-99 monedas)'
        },
        {
          minCost: 10,      // 10-49 monedas
          maxCost: 49,
          priority: 180,    // Prioridad alta
          description: 'Regalos medios (10-49 monedas)'
        },
        {
          minCost: 5,       // 5-9 monedas
          maxCost: 9,
          priority: 160,    // Prioridad media-alta
          description: 'Regalos baratos (5-9 monedas)'
        },
        {
          minCost: 1,       // 1-4 monedas
          maxCost: 4,
          priority: 150,    // Prioridad media (por defecto para gifts normales)
          description: 'Regalos básicos (1-4 monedas)'
        }
      ]
    });
    
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
      const debugInfo = await this.page.evaluate(() => {
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
          
          // INVESTIGACIÓN PROFUNDA del sistema de récord
          console.log('🔍 DEEP DEBUGGING Runner and record system:');
          console.log('Runner.instance_ keys:', Object.keys(Runner.instance_));
          
          // Investigar todas las propiedades relacionadas con récord
          console.log('🔍 ALL Runner.instance_ properties:');
          for (const [key, value] of Object.entries(Runner.instance_)) {
            if (typeof value === 'number' || key.toLowerCase().includes('score') || key.toLowerCase().includes('high')) {
              console.log(`  ${key}: ${value} (${typeof value})`);
            }
          }
          
          if (Runner.instance_.distanceMeter) {
            console.log('🔍 distanceMeter ALL properties:');
            for (const [key, value] of Object.entries(Runner.instance_.distanceMeter)) {
              console.log(`  distanceMeter.${key}: ${value} (${typeof value})`);
            }
            
            // Investigar el constructor/prototype para encontrar propiedades ocultas
            console.log('🔍 distanceMeter prototype properties:');
            const proto = Runner.instance_.distanceMeter.__proto__;
            console.log('Prototype keys:', Object.getOwnPropertyNames(proto));
            
            // Buscar propiedades específicas que podrían controlar el récord
            const possibleProps = ['maxScore', 'highScore', 'hi', 'record', 'best', 'top'];
            possibleProps.forEach(prop => {
              if (prop in Runner.instance_.distanceMeter) {
                console.log(`  FOUND ${prop}: ${Runner.instance_.distanceMeter[prop]}`);
              }
            });
          }
          
          // Investigar el objeto Runner en general
          console.log('🔍 Runner (not instance) properties:');
          if (typeof Runner === 'function') {
            console.log('Runner constructor properties:', Object.getOwnPropertyNames(Runner));
            if (Runner.prototype) {
              console.log('Runner.prototype properties:', Object.getOwnPropertyNames(Runner.prototype));
            }
          }
          
          // Intentar acceder a localStorage de forma segura
          console.log('🔍 Checking localStorage for dino game data:');
          try {
            if (typeof localStorage !== 'undefined' && localStorage) {
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.toLowerCase().includes('dino') || key.toLowerCase().includes('runner') || key.toLowerCase().includes('high'))) {
                  console.log(`localStorage[${key}] = ${localStorage.getItem(key)}`);
                }
              }
            }
          } catch (localStorageError) {
            console.log('🔍 localStorage access denied:', localStorageError.message);
            console.log('🔍 Using alternative storage method...');
          }
          
          // SOLUCIÓN DIRECTA: Forzar inicialización del récord en el juego
          try {
            // Establecer un récord inicial de prueba para activar la visualización
            const initialHighScore = 50; // Récord inicial para que aparezcan los números
            
            console.log('🏆 Forcing high score display initialization...');
            
            if (Runner.instance_.distanceMeter) {
              // Método 1: Establecer directamente las propiedades con el formato correcto
              Runner.instance_.distanceMeter.maxScore = initialHighScore;
              // EL FORMATO CORRECTO: highScore debe ser un string formateado
              const formattedScore = String(initialHighScore).padStart(5, '0');
              Runner.instance_.distanceMeter.highScore = `HI ${formattedScore}`;
              
              console.log(`🏆 Set highScore to: "${Runner.instance_.distanceMeter.highScore}"`);
              
              // Método 2: NO usar setHighScore ya que lo sobrescribe - usar solo después de interceptar
              console.log(`🏆 Skipping setHighScore method to avoid override`);
              console.log(`🏆 Current highScore after manual set: "${Runner.instance_.distanceMeter.highScore}"`);
              
              // Verificar que nuestro formato se mantuvo
              if (!Runner.instance_.distanceMeter.highScore.includes('00050')) {
                // Si se cambió, forzarlo de nuevo
                Runner.instance_.distanceMeter.highScore = `HI 00050`;
                console.log(`🏆 FORCED RESET to HI 00050`);
              }
              
              // Método 3: Forzar re-renderizado llamando al método de actualización
              if (typeof Runner.instance_.distanceMeter.update === 'function') {
                Runner.instance_.distanceMeter.update(0, initialHighScore);
                console.log('🏆 Forced distanceMeter update');
              }
              
              // Método 4: Forzar el dibujado del récord
              if (typeof Runner.instance_.distanceMeter.draw === 'function') {
                Runner.instance_.distanceMeter.draw();
                console.log('🏆 Forced distanceMeter draw');
              }
            }
            
            // Establecer en la instancia principal también
            Runner.instance_.highestScore = initialHighScore;
            
            // Crear función para manejar récords dinámicamente
            window.dinoHighScore = initialHighScore;
            window.updateDinoRecord = function(inputScore) {
              // Si no se proporciona score, usar la puntuación oficial actual
              let newScore = inputScore;
              if (newScore === undefined && Runner.instance_ && Runner.instance_.distanceMeter) {
                newScore = Runner.instance_.distanceMeter.getActualDistance(Runner.instance_.distanceRan);
              }
              
              if (newScore > window.dinoHighScore) {
                window.dinoHighScore = newScore;
                console.log(`🏆 NEW HIGH SCORE (official): ${newScore} points`);
                
                // Actualizar en todas las propiedades con formato correcto
                if (Runner.instance_) {
                  Runner.instance_.highestScore = newScore;
                  
                  if (Runner.instance_.distanceMeter) {
                    Runner.instance_.distanceMeter.maxScore = newScore;
                    
                    // FORMATO CORRECTO: highScore como string formateado
                    const formattedScore = String(newScore).padStart(5, '0');
                    Runner.instance_.distanceMeter.highScore = `HI ${formattedScore}`;
                    
                    console.log(`🏆 Updated highScore display to: "${Runner.instance_.distanceMeter.highScore}"`);
                  }
                }
                return true;
              }
              return false;
            };
            
            // Método 5: Interceptación COMPLETA del sistema de récord
            if (Runner.instance_.distanceMeter) {
              // Interceptar TODOS los métodos que podrían afectar el récord
              const methods = ['update', 'draw', 'drawHighScore', 'setHighScore', 'getActualSize'];
              
              methods.forEach(methodName => {
                if (typeof Runner.instance_.distanceMeter[methodName] === 'function') {
                  const originalMethod = Runner.instance_.distanceMeter[methodName];
                  Runner.instance_.distanceMeter[methodName] = function(...args) {
                    // Para el método update, forzar nuestro récord
                    if (methodName === 'update' && args.length >= 2) {
                      const ourHighScore = window.dinoHighScore || initialHighScore;
                      args[1] = Math.max(args[1] || 0, ourHighScore);
                      console.log(`🔍 Intercepted ${methodName}: distance=${args[0]}, highScore=${args[1]}`);
                    }
                    
                    // INTERCEPTAR setHighScore para evitar que cambie nuestro valor
                    if (methodName === 'setHighScore') {
                      const inputScore = args[0] || 0;
                      const ourScore = window.dinoHighScore || initialHighScore;
                      if (inputScore < ourScore) {
                        console.log(`🚫 Blocked setHighScore(${inputScore}) - keeping our score: ${ourScore}`);
                        // Mantener nuestro récord
                        const formattedScore = String(ourScore).padStart(5, '0');
                        this.highScore = `HI ${formattedScore}`;
                        return; // No llamar al método original
                      }
                    }
                    
                    // Llamar al método original
                    const result = originalMethod.apply(this, args);
                    
                    // Después de cualquier actualización, forzar nuestras propiedades
                    if (methodName === 'update' || methodName === 'draw') {
                      this.maxScore = Math.max(this.maxScore || 0, window.dinoHighScore || initialHighScore);
                      // Mantener formato correcto del highScore
                      const ourScore = window.dinoHighScore || initialHighScore;
                      const formattedScore = String(ourScore).padStart(5, '0');
                      this.highScore = `HI ${formattedScore}`;
                    }
                    
                    return result;
                  };
                  console.log(`🏆 Intercepted ${methodName} method`);
                }
              });
              
              // Rastreador de información de récord que podemos acceder desde fuera
              window.getRecordInfo = () => {
                if (Runner.instance_ && Runner.instance_.distanceMeter) {
                  // Usar el método oficial del juego para obtener la puntuación actual
                  const officialScore = Runner.instance_.distanceMeter.getActualDistance(Runner.instance_.distanceRan);
                  
                  return {
                    currentScore: officialScore, // Puntuación oficial del juego
                    currentScoreOld: Math.floor((Runner.instance_.distanceRan || 0) / 10), // Nuestro cálculo anterior
                    maxScore: Runner.instance_.distanceMeter.maxScore,
                    highScore: Runner.instance_.distanceMeter.highScore,
                    dinoHighScore: window.dinoHighScore,
                    distance: Runner.instance_.distanceRan
                  };
                }
                return null;
              };
              
              // Forzar propiedades directamente cada frame con formato correcto
              // Limpiar interval anterior si existe
              if (window.recordUpdateInterval) {
                clearInterval(window.recordUpdateInterval);
              }
              
              window.recordUpdateInterval = setInterval(() => {
                if (Runner.instance_ && Runner.instance_.distanceMeter && window.dinoHighScore) {
                  // Usar la puntuación oficial del juego
                  const currentScore = Runner.instance_.distanceMeter.getActualDistance(Runner.instance_.distanceRan);
                  
                  if (currentScore > window.dinoHighScore) {
                    window.dinoHighScore = currentScore;
                    Runner.instance_.distanceMeter.maxScore = currentScore;
                    
                    // FORMATO CORRECTO para el récord
                    const formattedScore = String(currentScore).padStart(5, '0');
                    Runner.instance_.distanceMeter.highScore = `HI ${formattedScore}`;
                    
                    console.log(`🏆 NEW OFFICIAL RECORD: ${currentScore} -> "${Runner.instance_.distanceMeter.highScore}"`);
                  }
                }
              }, 100); // Cada 100ms
            }
            
            console.log(`🏆 High score display initialized with ${initialHighScore} points`);
            
          } catch (error) {
            console.log('🏆 Error initializing high score display:', error.message);
          }
          
          console.log('🦖 FOCUS LOSS PROTECTION ACTIVATED!');
          
          // Retornar información de debugging
          return {
            runnerKeys: Object.keys(Runner.instance_),
            distanceMeterKeys: Runner.instance_.distanceMeter ? Object.keys(Runner.instance_.distanceMeter) : [],
            distanceMeterProps: Runner.instance_.distanceMeter ? {
              maxScore: Runner.instance_.distanceMeter.maxScore,
              highScore: Runner.instance_.distanceMeter.highScore
            } : {},
            initialHighScore: window.dinoHighScore,
            interceptedMethods: window.interceptedMethods || []
          };
        }
        return { error: 'Runner not available' };
      });
      // Mostrar información de debugging
      if (debugInfo) {
        logger.info(`${this.emoji} DEBUG INFO:`);
        logger.info(`${this.emoji} Runner keys: ${debugInfo.runnerKeys?.join(', ')}`);
        logger.info(`${this.emoji} DistanceMeter keys: ${debugInfo.distanceMeterKeys?.join(', ')}`);
        logger.info(`${this.emoji} DistanceMeter props: ${JSON.stringify(debugInfo.distanceMeterProps)}`);
        logger.info(`${this.emoji} Initial high score: ${debugInfo.initialHighScore}`);
        if (debugInfo.error) {
          logger.error(`${this.emoji} Debug error: ${debugInfo.error}`);
        }
      }
      
      logger.info(`${this.emoji} Immortality hack and focus protection applied - Dino is now invincible and won't pause!`);
      
      // Iniciar el auto-jumping
      await this.startAutoJumping();
      
      // Iniciar limpieza periódica de audio cada 30 segundos
      this.audioCleanupInterval = setInterval(() => {
        this.performPeriodicAudioCleanup();
      }, 30000);
      
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
      
      if (this.audioCleanupInterval) {
        clearInterval(this.audioCleanupInterval);
        this.audioCleanupInterval = null;
      }
      
      // Limpiar cola de audio y estado de reproducción
      this.isPlayingAudio = false;
      this.audioQueue = [];
      
      // Forzar limpieza COMPLETA de procesos de audio
      await this.forceAudioCleanup();
      
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
    
    // console.log('\n' + '='.repeat(60));
    // console.log(`${this.emoji} DinoChrome - CHAT EVENT`);
    // console.log('='.repeat(60));
    // console.log(`👤 Usuario: ${data.uniqueId || 'Anónimo'}`);
    // console.log(`💬 Mensaje: ${data.comment || 'Sin mensaje'}`);
    // console.log(`🕐 Timestamp: ${new Date().toLocaleString()}`);
    // console.log(`📊 Likes del mensaje: ${data.likeCount || 0}`);
    // if (data.profilePictureUrl) {
    //   console.log(`🖼️  Avatar: ${data.profilePictureUrl}`);
    // }
    // console.log('='.repeat(60) + '\n');
    
    // logger.info(`${this.emoji} DinoChrome processed chat from ${data.uniqueId}: "${data.comment}"`);
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
    const timestamp = new Date().toISOString();
    
    // Verificar si estamos en modo TEST
    const isTestMode = config.TEST === 'true' || config.TEST === true;
    
    // GG para pruebas (checkeamos primero para que tenga prioridad)
    const isGG = (giftName === 'gg' || giftName.includes('GG') || giftName.includes('gg'));
    const isRosa = (giftName === 'rosa' || giftName.includes('Rosa'));
    // Rose de 1 moneda (solo si NO es rosa y el costo es 1)
    const isRose = (!isRosa && giftName === 'rose' && giftCost === 1);
    
    logger.info(`${this.emoji} [${timestamp}] Gift analysis - Name: "${giftName}", Cost: ${giftCost}, isRosa: ${isRosa}, isRose: ${isRose}, isGG: ${isGG}, TEST_MODE: ${isTestMode}`);
    
    // En modo TEST, GG activa overlay como Rose
   if ((!isTestMode && isRosa) || (isTestMode && isGG)) {
      console.log(`🎮 ¡ROSA DETECTADA! Reiniciando juego y reproduciendo audio especial... 🎮`);
      logger.info(`${this.emoji} [${timestamp}] Rosa detected! Cost: ${giftCost} coins, restarting game and playing audio...`);
      
      // Reiniciar el juego primero
      await this.restartGame();
      
      // Reproducir audio aleatorio de la carpeta rosa/ Y ESPERAR a que termine
      await this.playGiftAudio('rosa', data);
      
    } else {
      console.log(`🌹 ¡ROSE DE 1 MONEDA DETECTADA! Reproduciendo audio especial... 🌹`);
      logger.info(`${this.emoji} [${timestamp}] Rose gift detected! Cost: ${giftCost} coins, playing audio...`);
      
      // Reproducir audio aleatorio de la carpeta rose/ Y ESPERAR a que termine
      await this.playGiftAudio('rose', data);
    }
    
    logger.info(`${this.emoji} DinoChrome processed gift from ${data.uniqueId}: ${data.giftName} x${data.repeatCount}`);
  }

  async handleTikTokFollow(data) {
    this.updateLastActivity();
    
    // console.log('\n' + '👥'.repeat(18));
    // console.log(`${this.emoji} DinoChrome - NEW FOLLOWER EVENT`);
    // console.log('👥'.repeat(18));
    // console.log(`🆕 Nuevo seguidor: ${data.uniqueId || 'Usuario anónimo'}`);
    // console.log(`📈 Total seguidores: ${data.followersCount || 'Desconocido'}`);
    // console.log(`🕐 Timestamp: ${new Date().toLocaleString()}`);
    // console.log(`🎊 ¡Bienvenido a la familia!`);
    // console.log('👥'.repeat(18) + '\n');
    
    // logger.info(`${this.emoji} DinoChrome processed new follower: ${data.uniqueId}`);
  }

  async handleTikTokLike(data) {
    this.updateLastActivity();
    
    // console.log('\n' + '👍'.repeat(15));
    // console.log(`${this.emoji} DinoChrome - LIKE EVENT`);
    // console.log('👍'.repeat(15));
    // console.log(`❤️  Usuario: ${data.uniqueId || 'Anónimo'}`);
    // console.log(`📊 Likes totales: ${data.totalLikes || 'Desconocido'}`);
    // console.log(`🕐 Timestamp: ${new Date().toLocaleString()}`);
    // console.log('👍'.repeat(15) + '\n');
    
    // logger.debug(`${this.emoji} DinoChrome processed like from ${data.uniqueId}`);
  }

  async handleTikTokShare(data) {
    this.updateLastActivity();
    
    // console.log('\n' + '📤'.repeat(15));
    // console.log(`${this.emoji} DinoChrome - SHARE EVENT`);
    // console.log('📤'.repeat(15));
    // console.log(`🔄 Usuario: ${data.uniqueId || 'Anónimo'}`);
    // console.log(`📢 ¡Compartió el stream!`);
    // console.log(`🕐 Timestamp: ${new Date().toLocaleString()}`);
    // console.log(`🚀 ¡Ayudando a crecer el canal!`);
    // console.log('📤'.repeat(15) + '\n');
    
    // logger.info(`${this.emoji} DinoChrome processed share from ${data.uniqueId}`);
  }

  async handleViewerCount(data) {
    // this.updateLastActivity();
    
    // // Solo mostrar cada 10 cambios para no saturar la consola
    // if (!this.lastViewerCount || Math.abs(data.viewerCount - this.lastViewerCount) >= 10) {
    //   console.log('\n' + '👀'.repeat(12));
    //   console.log(`${this.emoji} DinoChrome - VIEWER COUNT UPDATE`);
    //   console.log('👀'.repeat(12));
    //   console.log(`👥 Espectadores actuales: ${data.viewerCount || 0}`);
    //   console.log(`📈 Cambio: ${this.lastViewerCount ? (data.viewerCount - this.lastViewerCount > 0 ? '+' : '') + (data.viewerCount - this.lastViewerCount) : 'Primer registro'}`);
    //   console.log(`🕐 Timestamp: ${new Date().toLocaleString()}`);
    //   console.log('👀'.repeat(12) + '\n');
      
    //   this.lastViewerCount = data.viewerCount;
    //   logger.debug(`${this.emoji} DinoChrome updated viewer count: ${data.viewerCount}`);
    // }
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
      
      // Evitar solapamiento de reinicios de juego
      if (this.isRestartingGame) {
        logger.info(`${this.emoji} Game restart already in progress, skipping this request`);
        return false;
      }
      
      this.isRestartingGame = true;
      logger.info(`${this.emoji} Restarting Chrome Dino game by navigating to chrome://dino/...`);
      
      // Guardar el récord actual antes de reiniciar usando puntuación oficial
      const currentGameScore = await this.page.evaluate(() => {
        if (typeof Runner !== 'undefined' && Runner.instance_ && Runner.instance_.distanceMeter) {
          const game = Runner.instance_;
          return game.distanceMeter.getActualDistance(game.distanceRan) || 0;
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
      
      // Limpiar cualquier interval de actualización de récord que pueda estar corriendo
      await this.page.evaluate(() => {
        // Limpiar intervals de actualización de récord
        if (window.recordUpdateInterval) {
          clearInterval(window.recordUpdateInterval);
          window.recordUpdateInterval = null;
        }
        console.log('🧹 Cleaned up record update intervals before restart');
      });
      
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
          
          // Restaurar el récord usando nuestro sistema alternativo
          if (preservedHighScore > 0) {
            try {
              // Usar nuestro sistema de almacenamiento alternativo
              window.dinoHighScore = preservedHighScore;
              
              // Establecer el récord en todas las propiedades posibles
              if (Runner.instance_) {
                Runner.instance_.highestScore = preservedHighScore;
                
                if (Runner.instance_.distanceMeter) {
                  Runner.instance_.distanceMeter.maxScore = preservedHighScore;
                  
                  // FORMATO CORRECTO: highScore como string formateado
                  const formattedScore = String(preservedHighScore).padStart(5, '0');
                  Runner.instance_.distanceMeter.highScore = `HI ${formattedScore}`;
                  
                  console.log(`🏆 Récord restaurado: ${preservedHighScore} -> "${Runner.instance_.distanceMeter.highScore}"`);
                }
                
                // Recrear la función de actualización de récord
                window.updateDinoRecord = function(newScore) {
                  if (newScore > window.dinoHighScore) {
                    window.dinoHighScore = newScore;
                    if (Runner.instance_ && Runner.instance_.distanceMeter) {
                      Runner.instance_.distanceMeter.maxScore = newScore;
                      
                      // FORMATO CORRECTO: highScore como string formateado
                      const formattedScore = String(newScore).padStart(5, '0');
                      Runner.instance_.distanceMeter.highScore = `HI ${formattedScore}`;
                    }
                    Runner.instance_.highestScore = newScore;
                    console.log(`🏆 NUEVO RÉCORD: ${newScore} -> "${Runner.instance_.distanceMeter.highScore}"`);
                    return true;
                  }
                  return false;
                };
                
                // Recrear todo el sistema de interceptación después del reinicio
                if (Runner.instance_.distanceMeter) {
                  const methods = ['update', 'draw', 'drawHighScore', 'setHighScore'];
                  
                  methods.forEach(methodName => {
                    if (typeof Runner.instance_.distanceMeter[methodName] === 'function') {
                      const originalMethod = Runner.instance_.distanceMeter[methodName];
                      Runner.instance_.distanceMeter[methodName] = function(...args) {
                        // Para el método update, forzar nuestro récord
                        if (methodName === 'update' && args.length >= 2) {
                          const ourHighScore = window.dinoHighScore || preservedHighScore;
                          args[1] = Math.max(args[1] || 0, ourHighScore);
                        }
                        
                        // INTERCEPTAR setHighScore para evitar que cambie nuestro valor
                        if (methodName === 'setHighScore') {
                          const inputScore = args[0] || 0;
                          const ourScore = window.dinoHighScore || preservedHighScore;
                          if (inputScore < ourScore) {
                            console.log(`🚫 Blocked setHighScore(${inputScore}) after restart - keeping: ${ourScore}`);
                            const formattedScore = String(ourScore).padStart(5, '0');
                            this.highScore = `HI ${formattedScore}`;
                            return;
                          }
                        }
                        
                        const result = originalMethod.apply(this, args);
                        
                        // Mantener formato después de cualquier actualización
                        if (methodName === 'update' || methodName === 'draw') {
                          this.maxScore = Math.max(this.maxScore || 0, window.dinoHighScore || preservedHighScore);
                          const ourScore = window.dinoHighScore || preservedHighScore;
                          const formattedScore = String(ourScore).padStart(5, '0');
                          this.highScore = `HI ${formattedScore}`;
                        }
                        
                        return result;
                      };
                      console.log(`🏆 Re-intercepted ${methodName} method after restart`);
                    }
                  });
                  
                  // Recrear el interval de actualización de récord
                  if (window.recordUpdateInterval) {
                    clearInterval(window.recordUpdateInterval);
                  }
                  
                  window.recordUpdateInterval = setInterval(() => {
                    if (Runner.instance_ && Runner.instance_.distanceMeter && window.dinoHighScore) {
                      const currentScore = Runner.instance_.distanceMeter.getActualDistance(Runner.instance_.distanceRan);
                      if (currentScore > window.dinoHighScore) {
                        window.dinoHighScore = currentScore;
                        Runner.instance_.distanceMeter.maxScore = currentScore;
                        const formattedScore = String(currentScore).padStart(5, '0');
                        Runner.instance_.distanceMeter.highScore = `HI ${formattedScore}`;
                        console.log(`🏆 RECORD UPDATED AFTER RESTART: ${currentScore}`);
                      }
                    }
                  }, 100);
                }
                
                console.log(`🏆 Récord completamente restaurado: ${preservedHighScore} puntos`);
              }
            } catch (error) {
              console.log(`🏆 Error restaurando récord: ${error.message}`);
              // Fallback mínimo
              if (typeof window !== 'undefined') {
                window.dinoHighScore = preservedHighScore;
              }
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
    } finally {
      // Siempre liberar el flag de reinicio, incluso si hay error
      this.isRestartingGame = false;
    }
  }

  // Método SIMPLIFICADO para reproducir audio de regalo 
  async playGiftAudio(giftType, data) {
    const audioPath = this.getRandomGiftAudio(giftType);
    if (!audioPath) {
      logger.warn(`${this.emoji} No ${giftType} audio file found`);
      return;
    }

    // Crear una promesa que se resuelve cuando el audio específico termine
    return new Promise((resolve) => {
      const audioId = `${giftType}_${Date.now()}_${Math.random()}`;
      
      // Agregar a la cola con callback de resolución
      this.audioQueue.push({
        path: audioPath,
        type: giftType,
        timestamp: Date.now(),
        showOverlay: giftType === 'rose', // Solo mostrar overlay para roses (1 moneda)
        id: audioId,
        onComplete: resolve // Callback para resolver la promesa cuando termine
      });
      
      logger.info(`${this.emoji} Queued ${giftType} audio: ${path.basename(audioPath)} (queue size: ${this.audioQueue.length})${giftType === 'rose' ? ' [WITH OVERLAY]' : ''}`);
      
      // Procesar la cola si no se está reproduciendo audio
      if (!this.isPlayingAudio) {
        this.processAudioQueue();
      }
    });
  }

  // Método para obtener un audio secuencial de regalos (rose o rosa)
  getRandomGiftAudio(giftType) {
    const timestamp = new Date().toISOString();
    
    try {
      const audiosDir = path.join(__dirname, 'audios', giftType);
      logger.info(`${this.emoji} [${timestamp}] Looking for ${giftType} audio files in: ${audiosDir}`);
      
      // Verificar si el directorio existe
      if (!fs.existsSync(audiosDir)) {
        logger.error(`${this.emoji} [${timestamp}] Audio directory does not exist: ${audiosDir}`);
        return null;
      }
      
      const files = fs.readdirSync(audiosDir)
        .filter(file => file.endsWith('.mp3'))
        .sort(); // Ordenar archivos para reproducción secuencial consistente
      
      logger.info(`${this.emoji} [${timestamp}] Found ${files.length} MP3 files in ${giftType} directory: [${files.join(', ')}]`);
      
      if (files.length === 0) {
        logger.warn(`${this.emoji} [${timestamp}] No ${giftType} audio files found in ${audiosDir}`);
        return null;
      }
      
      // Seleccionar archivo basado en índice secuencial según el tipo
      let currentIndex;
      if (giftType === 'rose') {
        currentIndex = this.roseAudioIndex;
        // Avanzar al siguiente índice, reiniciar si llega al final
        this.roseAudioIndex = (this.roseAudioIndex + 1) % files.length;
      } else if (giftType === 'rosa') {
        currentIndex = this.rosaAudioIndex;
        // Avanzar al siguiente índice, reiniciar si llega al final
        this.rosaAudioIndex = (this.rosaAudioIndex + 1) % files.length;
      } else {
        // Fallback a aleatorio para tipos desconocidos
        currentIndex = Math.floor(Math.random() * files.length);
      }
      
      const selectedFile = files[currentIndex];
      const fullPath = path.join(audiosDir, selectedFile);
      
      // Verificar que el archivo existe
      if (!fs.existsSync(fullPath)) {
        logger.error(`${this.emoji} [${timestamp}] Selected audio file does not exist: ${fullPath}`);
        return null;
      }
      
      const nextIndex = giftType === 'rose' ? this.roseAudioIndex : (giftType === 'rosa' ? this.rosaAudioIndex : 'N/A');
      logger.info(`${this.emoji} [${timestamp}] Selected sequential ${giftType} audio: ${selectedFile} (index: ${currentIndex}/${files.length-1}, next: ${nextIndex}) - ${fullPath}`);
      return fullPath;
    } catch (error) {
      logger.error(`${this.emoji} [${timestamp}] Error getting sequential ${giftType} audio: ${error.message}`);
      return null;
    }
  }

  // Método para obtener un audio aleatorio de rosas (compatibilidad hacia atrás)
  getRandomRoseAudio() {
    return this.getRandomGiftAudio('rosa');
  }


  // Método para limpieza periódica de procesos de audio
  async performPeriodicAudioCleanup() {
    try {
      const now = Date.now();
      let killedProcesses = 0;
      
      // Verificar procesos registrados que lleven más de 2 minutos (muy generoso)
      for (const [pid, info] of this.activeAudioProcesses.entries()) {
        const age = now - info.startTime;
        if (age > 120000) { // 2 minutos - solo para casos extremos
          try {
            process.kill(pid, 'SIGKILL');
            killedProcesses++;
            logger.warn(`${this.emoji} Killed extremely old audio process: ${info.filePath} (${Math.round(age/1000)}s old)`);
          } catch (e) {
            // Proceso ya no existe
          }
          this.activeAudioProcesses.delete(pid);
        }
      }
      
      // Si hay procesos muy viejos o demasiados procesos acumulados
      if (killedProcesses > 0 || this.activeAudioProcesses.size > 5) {
        await this.forceAudioCleanup();
        logger.info(`${this.emoji} Performed emergency audio cleanup (killed ${killedProcesses} old processes)`);
      }
      
    } catch (error) {
      logger.debug(`${this.emoji} Periodic cleanup error: ${error.message}`);
    }
  }

  // Método para limpiar TODOS los procesos de audio del sistema
  async forceAudioCleanup() {
    try {
      const platform = os.platform();
      const { exec } = require('child_process');
      
      if (platform === 'linux') {
        // Matar TODOS los procesos de audio que puedan estar corriendo
        await new Promise(resolve => {
          exec('pkill -9 -f "ffplay|mpg123|paplay|aplay"', () => resolve());
        });
        // También limpiar cualquier proceso zombie
        await new Promise(resolve => {
          exec('ps aux | grep -E "ffplay|mpg123" | grep -v grep | awk \'{print $2}\' | xargs -r kill -9', () => resolve());
        });
      } else if (platform === 'darwin') {
        await new Promise(resolve => {
          exec('pkill -9 afplay', () => resolve());
        });
      } else if (platform === 'win32') {
        // Limpieza para Windows
        await new Promise(resolve => {
          exec('taskkill /F /IM ffplay.exe 2>nul', () => resolve());
        });
        await new Promise(resolve => {
          exec('taskkill /F /IM wmplayer.exe 2>nul', () => resolve());
        });
        await new Promise(resolve => {
          exec('taskkill /F /IM powershell.exe /FI "WINDOWTITLE eq Windows PowerShell" 2>nul', () => resolve());
        });
      }
      
      // Limpiar registros internos
      this.activeAudioProcesses.clear();
      this.currentAudioProcess = null;
      this.isPlayingAudio = false;
      
      logger.debug(`${this.emoji} FORCE AUDIO CLEANUP - All audio processes terminated`);
    } catch (error) {
      logger.debug(`${this.emoji} Force cleanup completed: ${error.message}`);
    }
  }

  // Método para detectar la mejor opción de audio en Windows
  async detectWindowsAudioPlayer() {
    const { execSync } = require('child_process');
    
    // Prioridad: VLC > ffplay > wmplayer > powershell
    try {
      // Verificar si existe el archivo VLC sin ejecutarlo
      const fs = require('fs');
      if (fs.existsSync('C:\\Program Files\\VideoLAN\\VLC\\vlc.exe')) {
        logger.info(`${this.emoji} Windows audio: Using VLC (best option)`);
        return { 
          command: 'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe', 
          args: ['--play-and-exit', '--intf', 'dummy', '--no-video', '--quiet'] 
        };
      }
      throw new Error('VLC not found in Program Files');
    } catch (e) {
      try {
        // Intentar VLC en Program Files (x86)
        const fs = require('fs');
        if (fs.existsSync('C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe')) {
          logger.info(`${this.emoji} Windows audio: Using VLC x86 (best option)`);
          return { 
            command: 'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe', 
            args: ['--play-and-exit', '--intf', 'dummy', '--no-video', '--quiet'] 
          };
        }
        throw new Error('VLC not found in Program Files (x86)');
      } catch (e) {
        try {
          // Intentar vlc en PATH usando where command
          execSync('where vlc', { stdio: 'ignore' });
          logger.info(`${this.emoji} Windows audio: Using VLC from PATH`);
          return { 
            command: 'vlc', 
            args: ['--play-and-exit', '--intf', 'dummy', '--no-video', '--quiet'] 
          };
        } catch (e) {
          try {
            execSync('ffplay -version', { stdio: 'ignore' });
            logger.info(`${this.emoji} Windows audio: Using ffplay`);
            return { command: 'ffplay', args: ['-nodisp', '-autoexit', '-loglevel', 'panic', '-volume', '100'] };
          } catch (e) {
            try {
              execSync('wmplayer /?', { stdio: 'ignore' });
              logger.info(`${this.emoji} Windows audio: Using Windows Media Player`);
              return { command: 'wmplayer', args: ['/close'] };
            } catch (e) {
              logger.warn(`${this.emoji} Windows audio: Fallback to PowerShell (may have issues). Consider installing VLC.`);
              return { 
                command: 'powershell', 
                args: ['-ExecutionPolicy', 'Bypass', '-NoProfile', '-Command'] 
              };
            }
          }
        }
      }
    }
  }

  // Método SIMPLIFICADO para reproducir audio esperando la finalización real del proceso
  async playAudio(filePath, shouldHideOverlay = false) {
    return new Promise(async (resolve) => {
      const startTimestamp = new Date().toISOString();
      const fileName = path.basename(filePath);
      
      try {
        logger.info(`${this.emoji} [${startTimestamp}] Starting audio playback: ${fileName}`);
        
        // Solo limpiar procesos muertos, no matar audio en progreso
        this.cleanupDeadProcesses();
        
        // Marcar como ocupado
        this.isPlayingAudio = true;
        
        const platform = os.platform();
        let command, args = [];
        
        if (platform === 'linux') {
          command = 'ffplay';
          args = ['-nodisp', '-autoexit', '-loglevel', 'quiet', '-volume', '100', filePath];
        } else if (platform === 'darwin') {
          command = 'afplay';
          args = [filePath];
        } else if (platform === 'win32') {
          const windowsPlayer = await this.detectWindowsAudioPlayer();
          command = windowsPlayer.command;
          
          if (command.includes('vlc')) {
            // VLC comando con argumentos específicos
            args = [...windowsPlayer.args, filePath];
            logger.info(`${this.emoji} [${startTimestamp}] Using VLC for Windows audio playback`);
          } else if (command === 'ffplay') {
            args = [...windowsPlayer.args, filePath];
            logger.info(`${this.emoji} [${startTimestamp}] Using ffplay for Windows audio playback`);
          } else if (command === 'wmplayer') {
            args = [...windowsPlayer.args, filePath];
            logger.info(`${this.emoji} [${startTimestamp}] Using wmplayer for Windows audio playback`);
          } else {
            // PowerShell script mejorado con SoundPlayer (más confiable)
            const escapedPath = filePath.replace(/\\/g, '\\\\').replace(/'/g, "''");
            const powershellScript = `
              try {
                Add-Type -AssemblyName System.Windows.Forms;
                $player = New-Object System.Media.SoundPlayer('${escapedPath}');
                $player.PlaySync();
                $player.Dispose();
                Write-Host 'Audio completed successfully';
              } catch {
                try {
                  Add-Type -AssemblyName presentationCore;
                  $mediaPlayer = New-Object System.Windows.Media.MediaPlayer;
                  $mediaPlayer.Open([System.Uri]::new('file:///${escapedPath}'));
                  $mediaPlayer.Volume = 1.0;
                  $mediaPlayer.Play();
                  while ($mediaPlayer.Position -lt $mediaPlayer.NaturalDuration -and $mediaPlayer.NaturalDuration.HasTimeSpan) {
                    Start-Sleep -Milliseconds 200;
                  }
                  $mediaPlayer.Stop();
                  $mediaPlayer.Close();
                  Write-Host 'MediaPlayer audio completed';
                } catch {
                  Write-Error 'Failed to play audio with both methods';
                  exit 1;
                }
              }
            `.replace(/\s+/g, ' ').trim();
            
            args = [...windowsPlayer.args, powershellScript];
            logger.info(`${this.emoji} [${startTimestamp}] Using PowerShell SoundPlayer/MediaPlayer for Windows audio playback`);
          }
        } else {
          logger.warn(`${this.emoji} [${startTimestamp}] Unsupported platform: ${platform}`);
          this.isPlayingAudio = false;
          resolve();
          return;
        }
        
        const { spawn } = require('child_process');
        
        // Crear proceso con logging detallado
        this.currentAudioProcess = spawn(command, args, {
          stdio: ['ignore', 'pipe', 'pipe'], // Capturar stdout y stderr para debugging
          detached: false,
          windowsHide: true // Ocultar ventanas en Windows
        });
        
        const pid = this.currentAudioProcess.pid;
        const processInfo = {
          startTime: Date.now(),
          filePath: fileName,
          process: this.currentAudioProcess
        };
        
        this.activeAudioProcesses.set(pid, processInfo);
        
        // Capturar output para debugging
        this.currentAudioProcess.stdout?.on('data', (data) => {
          logger.debug(`${this.emoji} [${new Date().toISOString()}] Audio stdout: ${data.toString().trim()}`);
        });
        
        this.currentAudioProcess.stderr?.on('data', (data) => {
          logger.debug(`${this.emoji} [${new Date().toISOString()}] Audio stderr: ${data.toString().trim()}`);
        });
        
        let resolved = false;
        const finish = async (reason) => {
          if (!resolved) {
            resolved = true;
            const endTimestamp = new Date().toISOString();
            const playTime = Date.now() - processInfo.startTime;
            
            logger.info(`${this.emoji} [${endTimestamp}] Audio finished: ${fileName} after ${playTime}ms (${reason})${shouldHideOverlay ? ' [HIDING OVERLAY]' : ''}`);
            
            this.isPlayingAudio = false;
            this.currentAudioProcess = null;
            this.activeAudioProcesses.delete(pid);
            
            // Ocultar overlay si es necesario DESPUÉS de terminar el audio
            // Agregar pausa para que el overlay se mantenga visible por un tiempo
            if (shouldHideOverlay) {
              setTimeout(async () => {
                await this.hideOverlay();
              }, 1500); // 1.5 segundos adicionales para mostrar el overlay
            }
            
            // Procesar siguiente audio en la cola después de una pausa breve
            this.processAudioQueue();
            
            resolve();
          }
        };
        
        // Eventos del proceso - SOLO escuchamos cuando el proceso realmente termina
        this.currentAudioProcess.on('close', (code) => {
          logger.info(`${this.emoji} [${new Date().toISOString()}] Audio process closed with code: ${code}`);
          finish('process closed');
        });
        
        this.currentAudioProcess.on('error', (error) => {
          logger.error(`${this.emoji} [${new Date().toISOString()}] Audio process error: ${error.message}`);
          finish('process error');
        });
        
        this.currentAudioProcess.on('exit', (code, signal) => {
          logger.info(`${this.emoji} [${new Date().toISOString()}] Audio process exited with code: ${code}, signal: ${signal}`);
          finish('process exit');
        });
        
        // Timeout de seguridad MUY generoso (solo para casos extremos)
        const safetyTimeoutDuration = 60000; // 60 segundos máximo para cualquier audio
        const safetyTimeout = setTimeout(() => {
          if (!resolved && this.currentAudioProcess && !this.currentAudioProcess.killed) {
            logger.warn(`${this.emoji} [${new Date().toISOString()}] Safety timeout after ${safetyTimeoutDuration}ms, killing process: ${fileName}`);
            this.currentAudioProcess.kill('SIGTERM');
            
            // Si no termina en 2 segundos, usar SIGKILL
            setTimeout(() => {
              if (!resolved && this.currentAudioProcess && !this.currentAudioProcess.killed) {
                logger.warn(`${this.emoji} [${new Date().toISOString()}] Force killing audio process: ${fileName}`);
                this.currentAudioProcess.kill('SIGKILL');
              }
            }, 2000);
            
            finish('safety timeout');
          }
        }, safetyTimeoutDuration);
        
        logger.info(`${this.emoji} [${startTimestamp}] Audio process started: ${fileName} (PID: ${pid}, waiting for natural completion)`);
        
      } catch (error) {
        const errorTimestamp = new Date().toISOString();
        logger.error(`${this.emoji} [${errorTimestamp}] Audio playback error for ${fileName}: ${error.message}`);
        this.isPlayingAudio = false;
        this.currentAudioProcess = null;
        resolve();
      }
    });
  }

  // Método para procesar la cola de audios con timestamps
  async processAudioQueue() {
    const timestamp = new Date().toISOString();
    
    if (this.isPlayingAudio) {
      logger.debug(`${this.emoji} [${timestamp}] Audio still playing, queue processing delayed (queue size: ${this.audioQueue.length})`);
      return;
    }
    
    if (this.audioQueue.length === 0) {
      logger.debug(`${this.emoji} [${timestamp}] Audio queue empty`);
      return;
    }
    
    const nextAudio = this.audioQueue.shift();
    const queueAge = Date.now() - nextAudio.timestamp;
    
    logger.info(`${this.emoji} [${timestamp}] Processing queued audio: ${path.basename(nextAudio.path)} (age: ${queueAge}ms, remaining in queue: ${this.audioQueue.length})${nextAudio.showOverlay ? ' [WITH OVERLAY]' : ''}`);
    
    try {
      // Mostrar overlay si es necesario ANTES de reproducir el audio
      if (nextAudio.showOverlay) {
        await this.showOverlay();
        // Agregar pequeña pausa para que la animación de entrada se complete
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      await this.playAudio(nextAudio.path, nextAudio.showOverlay);
      
      // Llamar al callback de finalización si existe
      if (nextAudio.onComplete && typeof nextAudio.onComplete === 'function') {
        logger.debug(`${this.emoji} [${timestamp}] Calling onComplete callback for audio ${nextAudio.id || 'unknown'}`);
        nextAudio.onComplete();
      }
      
    } catch (error) {
      logger.error(`${this.emoji} [${timestamp}] Error playing queued audio: ${error.message}`);
      
      // Si hay error y se mostró overlay, ocultarlo
      if (nextAudio.showOverlay) {
        await this.hideOverlay();
      }
      
      // Llamar al callback de error también para resolver la promesa
      if (nextAudio.onComplete && typeof nextAudio.onComplete === 'function') {
        logger.debug(`${this.emoji} [${timestamp}] Calling onComplete callback after error for audio ${nextAudio.id || 'unknown'}`);
        nextAudio.onComplete();
      }
      
      // Continuar con el siguiente audio después de una pausa
      setTimeout(() => {
        this.processAudioQueue();
      }, 500);
    }
  }

  // Método para mostrar el overlay
  async showOverlay() {
    return new Promise((resolve) => {
      const postData = JSON.stringify({});
      
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/overlay/show',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.success) {
              logger.info(`${this.emoji} Overlay shown successfully`);
              resolve(true);
            } else {
              logger.warn(`${this.emoji} Failed to show overlay: ${result.message}`);
              resolve(false);
            }
          } catch (error) {
            logger.error(`${this.emoji} Error parsing overlay response: ${error.message}`);
            resolve(false);
          }
        });
      });

      req.on('error', (error) => {
        logger.error(`${this.emoji} Error showing overlay: ${error.message}`);
        resolve(false);
      });

      req.write(postData);
      req.end();
    });
  }

  // Método para ocultar el overlay
  async hideOverlay() {
    return new Promise((resolve) => {
      const postData = JSON.stringify({});
      
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/overlay/hide',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.success) {
              logger.info(`${this.emoji} Overlay hidden successfully`);
              resolve(true);
            } else {
              logger.warn(`${this.emoji} Failed to hide overlay: ${result.message}`);
              resolve(false);
            }
          } catch (error) {
            logger.error(`${this.emoji} Error parsing overlay response: ${error.message}`);
            resolve(false);
          }
        });
      });

      req.on('error', (error) => {
        logger.error(`${this.emoji} Error hiding overlay: ${error.message}`);
        resolve(false);
      });

      req.write(postData);
      req.end();
    });
  }

  // Método para limpiar solo procesos muertos sin interrumpir audio activo
  cleanupDeadProcesses() {
    const timestamp = new Date().toISOString();
    let cleanedCount = 0;
    
    for (const [pid, info] of this.activeAudioProcesses.entries()) {
      try {
        // Verificar si el proceso aún existe sin matarlo
        process.kill(pid, 0); // Signal 0 solo verifica existencia
      } catch (error) {
        // Si falla, el proceso ya no existe
        this.activeAudioProcesses.delete(pid);
        cleanedCount++;
        logger.debug(`${this.emoji} [${timestamp}] Cleaned dead audio process: ${info.filePath} (PID: ${pid})`);
      }
    }
    
    if (cleanedCount > 0) {
      logger.info(`${this.emoji} [${timestamp}] Cleaned ${cleanedCount} dead audio processes`);
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
            
            // Usar la puntuación oficial del juego
            const currentScore = game.distanceMeter ? game.distanceMeter.getActualDistance(game.distanceRan) : 0;
            let debugInfo = {
              playing: game.playing,
              crashed: game.crashed,
              score: currentScore,
              speed: game.currentSpeed || 0
            };
            
            // Añadir información de debugging del récord
            if (currentScore > 0 && currentScore <= 50) { // Solo mostrar en las primeras 50 puntos para no saturar
              debugInfo.debug = {
                highestScore: game.highestScore,
                distanceMeterMaxScore: game.distanceMeter ? game.distanceMeter.maxScore : 'undefined',
                distanceMeterHighScore: game.distanceMeter ? game.distanceMeter.highScore : 'undefined',
                localStorage: localStorage.getItem('runner-hi') || localStorage.getItem('highScore') || 'not found'
              };
              
              // Usar nuestro sistema de récord alternativo
              try {
                // Llamar a la función de actualización de récord
                if (typeof window.updateDinoRecord === 'function') {
                  const wasUpdated = window.updateDinoRecord(currentScore);
                  if (wasUpdated) {
                    debugInfo.recordUpdated = true;
                  }
                }
                
                // Reportar estado actual del récord
                debugInfo.currentHighScore = window.dinoHighScore || 0;
                debugInfo.maxScoreInMeter = game.distanceMeter ? game.distanceMeter.maxScore : 0;
                
              } catch (error) {
                console.log(`Error updating record: ${error.message}`);
              }
            }
            
            return debugInfo;
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
            logger.info(`${this.emoji} New session high score: ${this.highScore}`);
          }
          
          // Obtener información adicional del récord del juego cada 5 segundos
          if (this.currentScore > 0 && this.currentScore % 10 === 0) {
            this.page.evaluate(() => {
              if (typeof window.getRecordInfo === 'function') {
                const info = window.getRecordInfo();
                console.log('🔍 RECORD INFO:', JSON.stringify(info));
                return info;
              }
              return null;
            }).then(recordInfo => {
              if (recordInfo) {
                logger.info(`${this.emoji} RECORD STATUS: Current=${recordInfo.currentScore}, maxScore=${recordInfo.maxScore}, highScore=${recordInfo.highScore}, dinoHighScore=${recordInfo.dinoHighScore}`);
              }
            }).catch(err => {
              logger.debug(`${this.emoji} Error getting record info: ${err.message}`);
            });
          }
          
          if (gameStatus.crashed && this.isGameRunning) {
            logger.info(`${this.emoji} Crash detected but immortality is active - Score: ${gameStatus.score}. Session Record: ${this.highScore}`);
            // Ya no reiniciamos porque el dino es inmortal
          } else if (gameStatus.playing) {
            // Mostrar debug info si está disponible
            if (gameStatus.debug) {
              logger.info(`${this.emoji} RECORD DEBUG - Score: ${gameStatus.score}, Speed: ${gameStatus.speed.toFixed(1)}, Session Record: ${this.highScore}`);
              logger.info(`${this.emoji} Game highestScore: ${gameStatus.debug.highestScore}, distanceMeter.maxScore: ${gameStatus.debug.distanceMeterMaxScore}, localStorage: ${gameStatus.debug.localStorage}`);
            } else {
              logger.debug(`${this.emoji} Game running - Score: ${gameStatus.score}, Speed: ${gameStatus.speed.toFixed(1)}, Session Record: ${this.highScore}`);
            }
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