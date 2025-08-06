const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../../utils/logger');

const router = express.Router();

// Get list of assets
router.get('/', async (req, res) => {
  try {
    const assetsPath = path.join(process.cwd(), 'public', 'assets');
    
    // Check if assets directory exists
    try {
      await fs.access(assetsPath);
    } catch (error) {
      return res.json({ assets: [] });
    }
    
    const files = await fs.readdir(assetsPath);
    const assets = files.map(file => ({
      name: file,
      url: `/assets/${file}`,
      path: path.join(assetsPath, file)
    }));
    
    res.json({ assets });
  } catch (error) {
    logger.error('Failed to list assets:', error);
    res.status(500).json({ error: 'Failed to list assets' });
  }
});

// Get asset info
router.get('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const assetPath = path.join(process.cwd(), 'public', 'assets', filename);
    
    // Check if file exists
    try {
      const stats = await fs.stat(assetPath);
      res.json({
        name: filename,
        url: `/assets/${filename}`,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      });
    } catch (error) {
      res.status(404).json({ error: 'Asset not found' });
    }
  } catch (error) {
    logger.error('Failed to get asset info:', error);
    res.status(500).json({ error: 'Failed to get asset info' });
  }
});

module.exports = router;