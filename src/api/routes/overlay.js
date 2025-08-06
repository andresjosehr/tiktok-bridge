const express = require('express');
const logger = require('../../utils/logger');

const router = express.Router();

// Estado de visibilidad del overlay (en memoria por simplicidad)
let overlayState = {
  visible: false,
  lastUpdated: new Date().toISOString()
};

// Get overlay status
router.get('/status', (req, res) => {
  res.json(overlayState);
});

// Show overlay
router.post('/show', (req, res) => {
  overlayState.visible = true;
  overlayState.lastUpdated = new Date().toISOString();
  
  logger.info('Overlay shown');
  res.json({ 
    success: true, 
    message: 'Overlay is now visible',
    state: overlayState 
  });
});

// Hide overlay
router.post('/hide', (req, res) => {
  overlayState.visible = false;
  overlayState.lastUpdated = new Date().toISOString();
  
  logger.info('Overlay hidden');
  res.json({ 
    success: true, 
    message: 'Overlay is now hidden',
    state: overlayState 
  });
});

// Toggle overlay
router.post('/toggle', (req, res) => {
  overlayState.visible = !overlayState.visible;
  overlayState.lastUpdated = new Date().toISOString();
  
  const action = overlayState.visible ? 'shown' : 'hidden';
  logger.info(`Overlay ${action}`);
  
  res.json({ 
    success: true, 
    message: `Overlay is now ${overlayState.visible ? 'visible' : 'hidden'}`,
    state: overlayState 
  });
});

module.exports = router;