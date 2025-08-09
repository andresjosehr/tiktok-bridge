const express = require('express');
const router = express.Router();
const tiktokEventsTracker = require('../../services/tiktokEventsTracker');
const logger = require('../../utils/logger');

/**
 * GET /api/events/stats/session/:sessionId
 * Obtiene estadísticas de eventos para una sesión específica
 */
router.get('/stats/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const stats = await tiktokEventsTracker.getSessionStats(sessionId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting session stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session stats'
    });
  }
});

/**
 * GET /api/events/stats/gifts/:sessionId
 * Obtiene estadísticas de gifts para una sesión específica
 */
router.get('/stats/gifts/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const stats = await tiktokEventsTracker.getGiftStats(sessionId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting gift stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get gift stats'
    });
  }
});

/**
 * GET /api/events/stats/users/:sessionId
 * Obtiene los usuarios más activos para una sesión específica
 */
router.get('/stats/users/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 10 } = req.query;
    const stats = await tiktokEventsTracker.getTopUsers(sessionId, parseInt(limit));
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting top users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get top users'
    });
  }
});

/**
 * GET /api/events/current/metrics
 * Obtiene métricas en tiempo real de la sesión actual
 */
router.get('/current/metrics', async (req, res) => {
  try {
    const metrics = await tiktokEventsTracker.getCurrentSessionMetrics();
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Error getting current session metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get current session metrics'
    });
  }
});

/**
 * GET /api/events/tracker/status
 * Obtiene el estado del tracker de eventos
 */
router.get('/tracker/status', async (req, res) => {
  try {
    const status = tiktokEventsTracker.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Error getting tracker status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get tracker status'
    });
  }
});

/**
 * GET /api/events/visitors/unique/:sessionId
 * Obtiene estadísticas de visitantes únicos para una sesión
 */
router.get('/visitors/unique/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const stats = await tiktokEventsTracker.getUniqueVisitorStats(sessionId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting unique visitor stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get unique visitor stats'
    });
  }
});

/**
 * GET /api/events/visitors/timeline/:sessionId
 * Obtiene timeline de actividad de visitantes
 */
router.get('/visitors/timeline/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const timeline = await tiktokEventsTracker.getVisitorTimeline(sessionId);
    
    res.json({
      success: true,
      data: timeline
    });
  } catch (error) {
    logger.error('Error getting visitor timeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get visitor timeline'
    });
  }
});

/**
 * GET /api/events/retention/:username
 * Obtiene análisis de retención de usuarios
 */
router.get('/retention/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { days = 7 } = req.query;
    const retention = await tiktokEventsTracker.getUserRetentionAnalysis(username, parseInt(days));
    
    res.json({
      success: true,
      data: retention
    });
  } catch (error) {
    logger.error('Error getting user retention analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user retention analysis'
    });
  }
});

/**
 * GET /api/events/engagement/:sessionId
 * Obtiene estadísticas de engagement por usuario
 */
router.get('/engagement/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const engagement = await tiktokEventsTracker.getUserEngagementStats(sessionId);
    
    res.json({
      success: true,
      data: engagement
    });
  } catch (error) {
    logger.error('Error getting user engagement stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user engagement stats'
    });
  }
});

/**
 * GET /api/events/duration/:sessionId
 * Obtiene análisis de duración de sesión
 */
router.get('/duration/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const duration = await tiktokEventsTracker.getSessionDurationAnalysis(sessionId);
    
    res.json({
      success: true,
      data: duration
    });
  } catch (error) {
    logger.error('Error getting session duration analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session duration analysis'
    });
  }
});

/**
 * GET /api/events/flow/:sessionId
 * Obtiene análisis de flujo de usuarios (entradas/salidas estimadas)
 */
router.get('/flow/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const flow = await tiktokEventsTracker.getUserFlowAnalysis(sessionId);
    
    res.json({
      success: true,
      data: flow
    });
  } catch (error) {
    logger.error('Error getting user flow analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user flow analysis'
    });
  }
});

/**
 * GET /api/events/current/advanced
 * Obtiene métricas avanzadas de la sesión actual
 */
router.get('/current/advanced', async (req, res) => {
  try {
    const metrics = await tiktokEventsTracker.getAdvancedCurrentMetrics();
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Error getting advanced current metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get advanced current metrics'
    });
  }
});

module.exports = router;