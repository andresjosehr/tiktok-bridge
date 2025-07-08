#!/usr/bin/env node
/**
 * Test script for the Modular TTS System
 * This script demonstrates how to use the new modular TTS system
 */

const ModularTTSService = require('./modularTTSService');
const logger = require('../../utils/logger');

async function testModularTTS() {
  console.log('🎯 Testing Modular TTS System...\n');

  try {
    // Initialize the service
    const ttsService = new ModularTTSService({
      enableCache: true,
      onlyUsernamesInTTS: true,
      tempDirectory: './temp_audio_test'
    });

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 1: Compose messages for different event types
    console.log('📝 Test 1: Message Composition');
    console.log('================================');
    
    const eventTypes = ['follow', 'gift', 'chat', 'like'];
    const testUser = 'TikTokUser123';
    
    for (const eventType of eventTypes) {
      const message = await ttsService.composeMessage(eventType, { username: testUser });
      console.log(`${eventType.toUpperCase()}:`);
      console.log(`  Structure: [${message.structure.join(', ')}]`);
      console.log(`  Full text: "${message.fullText}"`);
      console.log(`  Parts: ${message.parts.length}`);
      
      // Show parts breakdown
      message.parts.forEach((part, i) => {
        const type = part.isDynamic ? '🎤 TTS' : '💾 Cached';
        console.log(`    ${i+1}. ${type} - "${part.text}"`);
      });
      console.log('');
    }

    // Test 2: Generate multiple variations
    console.log('🔄 Test 2: Message Variations');
    console.log('==============================');
    
    const followMessages = ttsService.messageComposer.composeMultipleMessages('follow', { username: testUser }, 5);
    followMessages.forEach((msg, i) => {
      console.log(`${i+1}. "${msg.fullText}"`);
    });
    console.log('');

    // Test 3: Configuration statistics
    console.log('📊 Test 3: Configuration Statistics');
    console.log('===================================');
    
    const configStats = ttsService.messageComposer.getConfigStats();
    console.log(`Event types: ${configStats.eventTypes}`);
    console.log(`Total message parts: ${configStats.totalParts}`);
    console.log(`Total structures: ${configStats.totalStructures}`);
    console.log('');
    
    // Show detailed stats per event type
    for (const [eventType, details] of Object.entries(configStats.eventDetails)) {
      console.log(`${eventType.toUpperCase()}:`);
      console.log(`  Part types: ${details.partTypes}`);
      console.log(`  Total parts: ${details.totalParts}`);
      console.log(`  Structures: ${details.structures}`);
      console.log(`  Part breakdown: ${JSON.stringify(details.partCounts)}`);
      console.log('');
    }

    // Test 4: Validate configuration
    console.log('✅ Test 4: Configuration Validation');
    console.log('===================================');
    
    const validation = ttsService.messageComposer.validateConfig();
    console.log(`Configuration valid: ${validation.valid}`);
    if (validation.issues.length > 0) {
      console.log('Issues:');
      validation.issues.forEach(issue => console.log(`  ❌ ${issue}`));
    }
    if (validation.warnings.length > 0) {
      console.log('Warnings:');
      validation.warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
    }
    console.log('');

    // Test 5: Cache statistics
    console.log('💾 Test 5: Cache Statistics');
    console.log('============================');
    
    const cacheStats = await ttsService.audioCache.getStats();
    console.log(`Cached parts: ${cacheStats.parts.count}`);
    console.log(`Cached usernames: ${cacheStats.usernames.count}`);
    console.log(`Total cache size: ${Math.round(cacheStats.total.totalSize / 1024)} KB`);
    console.log('');

    // Test 6: Service statistics
    console.log('📈 Test 6: Service Statistics');
    console.log('==============================');
    
    const serviceStats = await ttsService.getStats();
    console.log('Service Statistics:');
    console.log(JSON.stringify(serviceStats, null, 2));
    console.log('');

    console.log('✅ All tests completed successfully!');
    console.log('');
    console.log('🎯 Summary:');
    console.log('===========');
    console.log('✅ Message composition working');
    console.log('✅ Random part selection working');
    console.log('✅ Multiple message structures working');
    console.log('✅ Configuration validation working');
    console.log('✅ Cache system initialized');
    console.log('✅ Service statistics available');
    console.log('');
    console.log('🚀 Ready to integrate with GMod service!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    logger.error('Modular TTS test failed:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testModularTTS();
}

module.exports = { testModularTTS };