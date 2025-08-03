import { useState, useEffect } from 'react'
import { 
  Save, 
  RefreshCw, 
  AlertCircle, 
  Check,
  Server,
  Database,
  Settings as SettingsIcon,
  Bell,
  Shield,
  Zap
} from 'lucide-react'
import { useConfig } from '../hooks/useApi'
import apiService from '../services/api'

const Settings = () => {
  const [activeTab, setActiveTab] = useState('general')
  const { data: configData, loading: configLoading, refetch: refetchConfig } = useConfig();
  
  const [settings, setSettings] = useState({
    // General settings
    tiktokUsername: '',
    maxQueueSize: 1000,
    eventProcessingDelay: 100,
    
    // Connection settings
    gmodHost: 'localhost',
    gmodWsPort: 8080,
    gmodHttpPort: 8081,
    
    // Feature flags
    enableNotifications: true,
    enableCaching: true,
    rateLimitEnabled: true
  })

  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  // Update settings when config data is loaded
  useEffect(() => {
    if (configData) {
      setSettings({
        tiktokUsername: configData.tiktok?.username || '',
        maxQueueSize: configData.queue?.maxSize || 1000,
        eventProcessingDelay: configData.queue?.processingDelay || 100,
        gmodHost: configData.gmod?.host || 'localhost',
        gmodWsPort: configData.gmod?.wsPort || 8080,
        gmodHttpPort: configData.gmod?.httpPort || 8081,
        enableNotifications: configData.features?.notifications || false,
        enableCaching: configData.features?.caching || false,
        rateLimitEnabled: configData.features?.rateLimit || false
      });
    }
  }, [configData]);

  const handleInputChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      // Update TikTok config
      await apiService.updateTikTokConfig({
        username: settings.tiktokUsername
      });

      // Update Queue config
      await apiService.updateQueueConfig({
        maxSize: settings.maxQueueSize,
        processingDelay: settings.eventProcessingDelay
      });

      // Update GMod config
      await apiService.updateGModConfig({
        host: settings.gmodHost,
        wsPort: settings.gmodWsPort,
        httpPort: settings.gmodHttpPort
      });

      // Update feature flags
      await apiService.updateFeatureFlags({
        notifications: settings.enableNotifications,
        caching: settings.enableCaching,
        rateLimit: settings.rateLimitEnabled
      });

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      refetchConfig()
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTestConnection = async (type) => {
    try {
      switch (type) {
        case 'tiktok':
          await apiService.connectTikTok(settings.tiktokUsername);
          break;
        case 'gmod':
          // This would test GMod connection
          console.log('Testing GMod connection');
          break;
        default:
          console.log('Testing connection:', type);
      }
    } catch (error) {
      console.error('Connection test failed:', error);
    }
  }

  const tabs = [
    { id: 'general', name: 'General', icon: SettingsIcon },
    { id: 'connection', name: 'Connection', icon: Server },
    { id: 'features', name: 'Features', icon: Zap }
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-600">
            Configure your TikTok Live bridge settings
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-3">
          {saved && (
            <div className="flex items-center text-green-600">
              <Check size={16} className="mr-1" />
              <span className="text-sm">Settings saved</span>
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} className="mr-2" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-tiktok-red text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon size={16} className="mr-3" />
                  {tab.name}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="card">
            <div className="card-body">
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">General Settings</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          TikTok Username
                        </label>
                        <input
                          type="text"
                          value={settings.tiktokUsername}
                          onChange={(e) => handleInputChange('tiktokUsername', e.target.value)}
                          className="input"
                          placeholder="Enter TikTok username to connect to"
                        />
                        <p className="text-sm text-gray-500 mt-1">
                          The TikTok user whose live stream you want to monitor
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Max Queue Size
                        </label>
                        <input
                          type="number"
                          value={settings.maxQueueSize}
                          onChange={(e) => handleInputChange('maxQueueSize', parseInt(e.target.value))}
                          className="input"
                          min="100"
                          max="10000"
                        />
                        <p className="text-sm text-gray-500 mt-1">
                          Maximum number of events to queue before dropping old ones
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Event Processing Delay (ms)
                        </label>
                        <input
                          type="number"
                          value={settings.eventProcessingDelay}
                          onChange={(e) => handleInputChange('eventProcessingDelay', parseInt(e.target.value))}
                          className="input"
                          min="0"
                          max="5000"
                        />
                        <p className="text-sm text-gray-500 mt-1">
                          Delay between processing events to prevent overwhelming GMod
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'connection' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Connection Settings</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          GMod Server Host
                        </label>
                        <input
                          type="text"
                          value={settings.gmodHost}
                          onChange={(e) => handleInputChange('gmodHost', e.target.value)}
                          className="input"
                          placeholder="localhost"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            WebSocket Port
                          </label>
                          <input
                            type="number"
                            value={settings.gmodWsPort}
                            onChange={(e) => handleInputChange('gmodWsPort', parseInt(e.target.value))}
                            className="input"
                            min="1"
                            max="65535"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            HTTP Port
                          </label>
                          <input
                            type="number"
                            value={settings.gmodHttpPort}
                            onChange={(e) => handleInputChange('gmodHttpPort', parseInt(e.target.value))}
                            className="input"
                            min="1"
                            max="65535"
                          />
                        </div>
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={() => handleTestConnection('gmod')}
                          className="btn btn-secondary"
                        >
                          Test GMod Connection
                        </button>
                        <button
                          onClick={() => handleTestConnection('tiktok')}
                          className="btn btn-secondary"
                        >
                          Test TikTok Connection
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'features' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Settings</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-gray-700">
                            Enable Notifications
                          </label>
                          <p className="text-sm text-gray-500">
                            Receive notifications for various events
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.enableNotifications}
                          onChange={(e) => handleInputChange('enableNotifications', e.target.checked)}
                          className="rounded border-gray-300 text-tiktok-red focus:ring-tiktok-red"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-gray-700">
                            Enable Caching
                          </label>
                          <p className="text-sm text-gray-500">
                            Cache frequently accessed data for better performance
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.enableCaching}
                          onChange={(e) => handleInputChange('enableCaching', e.target.checked)}
                          className="rounded border-gray-300 text-tiktok-red focus:ring-tiktok-red"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-gray-700">
                            Rate Limiting
                          </label>
                          <p className="text-sm text-gray-500">
                            Limit the rate of API requests to prevent overload
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.rateLimitEnabled}
                          onChange={(e) => handleInputChange('rateLimitEnabled', e.target.checked)}
                          className="rounded border-gray-300 text-tiktok-red focus:ring-tiktok-red"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings