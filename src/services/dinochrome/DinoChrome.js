const ServiceBase = require('../ServiceBase');
const logger = require('../../utils/logger');

class DinoChrome extends ServiceBase {
  constructor() {
    super('DinoChrome');
    this.emoji = '🦕';
    this.setConnected(true); // DinoChrome siempre está "conectado" ya que solo imprime
    logger.info(`${this.emoji} DinoChrome service initialized - Ready to print TikTok events!`);
  }

  async connect() {
    this.setConnected(true);
    logger.info(`${this.emoji} DinoChrome connected - Console logging activated!`);
    return true;
  }

  async disconnect() {
    this.setConnected(false);
    logger.info(`${this.emoji} DinoChrome disconnected - Console logging deactivated`);
    return true;
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
      description: 'Console logger for TikTok events',
      eventsProcessed: this.lastActivity ? 'Active' : 'Waiting for events',
      capabilities: [
        'Chat logging',
        'Gift logging', 
        'Follower logging',
        'Like logging',
        'Share logging',
        'Viewer count logging'
      ]
    };
  }

  // Método para mostrar información del servicio
  showServiceInfo() {
    console.log('\n' + '🦕'.repeat(25));
    console.log('        DinoChrome TikTok Event Logger        ');
    console.log('🦕'.repeat(25));
    console.log('📋 Capacidades:');
    console.log('   💬 Chat messages');
    console.log('   🎁 Gifts & donations');
    console.log('   👥 New followers');
    console.log('   👍 Likes');
    console.log('   📤 Shares');
    console.log('   👀 Viewer count updates');
    console.log('\n🎯 Estado: Activo y listo para eventos');
    console.log('🦕'.repeat(25) + '\n');
  }
}

module.exports = DinoChrome;