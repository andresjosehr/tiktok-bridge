import { useState, useEffect, useCallback } from 'react';
import apiService from '../services/api';

export const useApi = (apiCall, dependencies = [], options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const {
    refreshInterval = null,
    initialData = null,
    onSuccess = null,
    onError = null,
    enabled = true
  } = options;

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const result = await apiCall();
      setData(result);
      
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      setError(err);
      if (onError) {
        onError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [enabled, onSuccess, onError]);

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
    }
  }, [initialData]);

  useEffect(() => {
    if (!enabled) return;
    
    const execute = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const result = await apiCall();
        setData(result);
        
        if (onSuccess) {
          onSuccess(result);
        }
      } catch (err) {
        setError(err);
        if (onError) {
          onError(err);
        }
      } finally {
        setLoading(false);
      }
    };
    
    execute();
  }, [enabled, onSuccess, onError, ...dependencies]);

  useEffect(() => {
    if (refreshInterval && enabled) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval, enabled]);

  return { data, loading, error, refetch: fetchData };
};

export const useSystemStats = (refreshInterval = 30000) => {
  return useApi(
    () => apiService.getSystemStats(),
    [],
    { refreshInterval }
  );
};

export const useQueueStatus = (refreshInterval = 10000) => {
  return useApi(
    () => apiService.getQueueStatus(),
    [],
    { refreshInterval }
  );
};

export const useTikTokStatus = (refreshInterval = 15000) => {
  return useApi(
    () => apiService.getTikTokStatus(),
    [],
    { refreshInterval }
  );
};

export const useSystemHealth = (refreshInterval = 30000) => {
  return useApi(
    () => apiService.getSystemHealth(),
    [],
    { refreshInterval }
  );
};

export const useRecentEvents = (limit = 50, refreshInterval = 5000) => {
  return useApi(
    () => apiService.getRecentEvents(limit),
    [limit],
    { refreshInterval }
  );
};

export const useQueueMetrics = (hours = 24, refreshInterval = 60000) => {
  return useApi(
    () => apiService.getQueueStats(hours),
    [hours],
    { refreshInterval }
  );
};

export const useTikTokMetrics = (hours = 24, refreshInterval = 60000) => {
  return useApi(
    () => apiService.getTikTokMetrics(hours),
    [hours],
    { refreshInterval }
  );
};

export const useConfig = () => {
  return useApi(() => apiService.getConfig());
};