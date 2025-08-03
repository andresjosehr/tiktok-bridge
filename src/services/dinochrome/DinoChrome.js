const ServiceBase = require('../ServiceBase');
const logger = require('../../utils/logger');
const puppeteer = require('puppeteer');

class DinoChrome extends ServiceBase {
  constructor() {
    super('DinoChrome');
    this.emoji = '🦕';
    this.browser = null;
    this.page = null;
    this.isGameRunning = false;
    this.jumpInterval = null;
    this.gameMonitorInterval = null;
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
          '--disable-gpu'
        ]
      });

      // Crear nueva página y simular estar desconectado para activar el juego del dinosaurio
      this.page = await this.browser.newPage();
      
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
      // Detener intervalos
      if (this.jumpInterval) {
        clearInterval(this.jumpInterval);
        this.jumpInterval = null;
      }
      
      if (this.gameMonitorInterval) {
        clearInterval(this.gameMonitorInterval);
        this.gameMonitorInterval = null;
      }
      
      // Cerrar browser
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
      }
      
      this.isGameRunning = false;
      this.setConnected(false);
      logger.info(`${this.emoji} DinoChrome disconnected - Chrome browser closed`);
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
      description: 'Chrome Dino game automation with TikTok event logging',
      gameStatus: this.isGameRunning ? 'Playing automatically' : 'Not running',
      browserStatus: this.browser ? 'Connected' : 'Disconnected',
      eventsProcessed: this.lastActivity ? 'Active' : 'Waiting for events',
      capabilities: [
        'Chrome Dino automation',
        'Infinite auto-jumping',
        'Obstacle detection',
        'Auto-restart on game over',
        'TikTok event logging',
        'Real-time game monitoring'
      ]
    };
  }

  // Método para iniciar el auto-jumping con detección de obstáculos
  async startAutoJumping() {
    if (!this.page) return;
    
    this.isGameRunning = true;
    logger.info(`${this.emoji} Starting auto-jumping system...`);
    
    // Función para detectar obstáculos y saltar
    const autoJump = async () => {
      if (!this.page || !this.isGameRunning) return;
      
      try {
        // Evaluar en el contexto de la página para detectar obstáculos
        const shouldJump = await this.page.evaluate(() => {
          // Acceder al objeto del juego del dinosaurio
          if (typeof Runner !== 'undefined' && Runner.instance_) {
            const game = Runner.instance_;
            
            // Si el juego está corriendo
            if (game.playing) {
              // Obtener la posición del dinosaurio
              const dinoX = game.tRex.xPos;
              const dinoY = game.tRex.yPos;
              
              // Verificar obstáculos cercanos
              const obstacles = game.horizon.obstacles;
              
              for (let i = 0; i < obstacles.length; i++) {
                const obstacle = obstacles[i];
                const obstacleX = obstacle.xPos;
                const obstacleWidth = obstacle.width || 20;
                
                // Si hay un obstáculo cerca (distancia de detección)
                const detectionDistance = 100;
                if (obstacleX - dinoX < detectionDistance && obstacleX - dinoX > 0) {
                  return true; // Saltar
                }
              }
            }
          }
          return false;
        });
        
        // Si se detectó un obstáculo, saltar
        if (shouldJump) {
          await this.page.keyboard.press('Space');
          logger.debug(`${this.emoji} Obstacle detected - JUMPING!`);
        }
        
      } catch (error) {
        logger.debug(`${this.emoji} Auto-jump evaluation error: ${error.message}`);
      }
    };
    
    // Ejecutar la detección cada 50ms (muy responsivo)
    this.jumpInterval = setInterval(autoJump, 50);
    
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
          if (gameStatus.crashed && this.isGameRunning) {
            logger.info(`${this.emoji} Game Over! Score: ${gameStatus.score}. Restarting...`);
            // Reiniciar el juego presionando espacio
            await this.page.keyboard.press('Space');
          } else if (gameStatus.playing) {
            logger.debug(`${this.emoji} Game running - Score: ${gameStatus.score}, Speed: ${gameStatus.speed.toFixed(1)}`);
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