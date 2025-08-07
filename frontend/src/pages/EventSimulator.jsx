import { useState, useEffect } from 'react'
import { 
  Send, 
  Gift, 
  MessageSquare, 
  UserPlus, 
  Heart,
  Share2,
  Users,
  Play,
  Pause,
  Settings,
  CheckCircle
} from 'lucide-react'
import apiService from '../services/api'

const EventSimulator = () => {
  const [activeTab, setActiveTab] = useState('manual')
  const [isAutoMode, setIsAutoMode] = useState(false)
  const [autoInterval, setAutoInterval] = useState(5)
  const [selectedEventType, setSelectedEventType] = useState('chat')
  const [loading, setLoading] = useState(false)
  const [lastSent, setLastSent] = useState(null)
  const [formData, setFormData] = useState({
    username: 'test_user',
    message: 'Hello from simulator!',
    giftName: 'Rose',
    giftCount: 1,
    giftValue: 10,
    giftId: 8913,
    giftType: 1
  })

  // Auto mode interval
  useEffect(() => {
    let interval;
    if (isAutoMode) {
      interval = setInterval(() => {
        sendRandomEvent();
      }, autoInterval * 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAutoMode, autoInterval]);

  const eventTypes = [
    { id: 'chat', name: 'Chat Message', icon: MessageSquare, color: 'bg-blue-500' },
    { id: 'gift', name: 'Gift', icon: Gift, color: 'bg-tiktok-red' },
    { id: 'follow', name: 'Follow', icon: UserPlus, color: 'bg-green-500' },
    { id: 'like', name: 'Like', icon: Heart, color: 'bg-pink-500' },
    { id: 'share', name: 'Share', icon: Share2, color: 'bg-purple-500' },
    { id: 'viewer', name: 'Viewer Count', icon: Users, color: 'bg-orange-500' }
  ]

  const presetEvents = [
    { name: 'Popular Chat', type: 'chat', data: { message: 'This is amazing!' } },
    { name: 'Rose Gift', type: 'gift', data: { 
      user: 'preset_user',
      giftName: 'Rose', 
      giftId: 8913,
      repeatCount: 5, 
      cost: 1,
      giftType: 1,
      repeatEnd: true,
      timestamp: new Date().toISOString()
    } },
    { name: 'New Follower', type: 'follow', data: { username: 'new_follower' } },
    { name: 'Like Spam', type: 'like', data: { count: 10 } },
    { name: 'Share Event', type: 'share', data: { platform: 'tiktok' } }
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    await sendEvent(selectedEventType, getEventData(selectedEventType))
  }

  const sendEvent = async (eventType, eventData) => {
    try {
      setLoading(true)
      const result = await apiService.simulateEvent(eventType, eventData)
      setLastSent({ type: eventType, data: eventData, timestamp: new Date() })
      console.log('Event sent successfully:', result)
    } catch (error) {
      console.error('Failed to send event:', error)
    } finally {
      setLoading(false)
    }
  }

  const sendRandomEvent = async () => {
    const randomType = eventTypes[Math.floor(Math.random() * eventTypes.length)].id
    const randomData = getRandomEventData(randomType)
    await sendEvent(randomType, randomData)
  }

  const getEventData = (eventType) => {
    switch (eventType) {
      case 'chat':
        return {
          user: { username: formData.username },
          comment: formData.message
        }
      case 'gift':
        return {
          user: formData.username,
          giftName: formData.giftName,
          giftId: formData.giftId,
          repeatCount: formData.giftCount,
          cost: formData.giftValue,
          giftType: formData.giftType,
          repeatEnd: true,
          timestamp: new Date().toISOString()
        }
      case 'follow':
        return {
          user: { username: formData.username }
        }
      case 'like':
        return {
          user: { username: formData.username }
        }
      case 'share':
        return {
          user: { username: formData.username }
        }
      case 'viewerCount':
        return {
          viewerCount: Math.floor(Math.random() * 1000) + 100
        }
      default:
        return {}
    }
  }

  const getRandomEventData = (eventType) => {
    const randomUsers = ['user1', 'user2', 'user3', 'cooluser', 'gamer123', 'tiktoker']
    const randomMessages = ['Hello!', 'Amazing!', 'Love this!', 'So cool!', 'Nice!']
    const randomGifts = ['Rose', 'Heart', 'Star', 'Diamond', 'Crown']
    
    const randomUser = randomUsers[Math.floor(Math.random() * randomUsers.length)]
    
    switch (eventType) {
      case 'chat':
        return {
          user: { username: randomUser },
          comment: randomMessages[Math.floor(Math.random() * randomMessages.length)]
        }
      case 'gift':
        return {
          user: randomUser,
          giftName: randomGifts[Math.floor(Math.random() * randomGifts.length)],
          giftId: Math.floor(Math.random() * 9999) + 1000,
          repeatCount: Math.floor(Math.random() * 5) + 1,
          cost: Math.floor(Math.random() * 100) + 10,
          giftType: Math.floor(Math.random() * 3) + 1,
          repeatEnd: true,
          timestamp: new Date().toISOString()
        }
      default:
        return {
          user: { username: randomUser }
        }
    }
  }

  const sendPresetEvent = async (preset) => {
    await sendEvent(preset.type, preset.data)
  }

  const toggleAutoMode = () => {
    setIsAutoMode(!isAutoMode)
    if (!isAutoMode) {
      // Start auto mode
      console.log('Starting auto mode')
    } else {
      // Stop auto mode
      console.log('Stopping auto mode')
    }
  }

  const renderManualForm = () => {
    switch (selectedEventType) {
      case 'chat':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="input"
                placeholder="Enter username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message
              </label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="input"
                rows={3}
                placeholder="Enter chat message"
              />
            </div>
          </div>
        )
      case 'gift':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="input"
                placeholder="Enter username"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gift Name
                </label>
                <input
                  type="text"
                  value={formData.giftName}
                  onChange={(e) => setFormData({ ...formData, giftName: e.target.value })}
                  className="input"
                  placeholder="Enter gift name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gift ID
                </label>
                <input
                  type="number"
                  value={formData.giftId}
                  onChange={(e) => setFormData({ ...formData, giftId: parseInt(e.target.value) })}
                  className="input"
                  placeholder="Gift ID"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Count
                </label>
                <input
                  type="number"
                  value={formData.giftCount}
                  onChange={(e) => setFormData({ ...formData, giftCount: parseInt(e.target.value) })}
                  className="input"
                  min="1"
                  max="99"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cost (coins)
                </label>
                <input
                  type="number"
                  value={formData.giftValue}
                  onChange={(e) => setFormData({ ...formData, giftValue: parseInt(e.target.value) })}
                  className="input"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gift Type
                </label>
                <input
                  type="number"
                  value={formData.giftType}
                  onChange={(e) => setFormData({ ...formData, giftType: parseInt(e.target.value) })}
                  className="input"
                  min="1"
                  max="5"
                />
              </div>
            </div>
          </div>
        )
      case 'follow':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="input"
                placeholder="Enter new follower username"
              />
            </div>
          </div>
        )
      default:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="input"
                placeholder="Enter username"
              />
            </div>
          </div>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Event Simulator</h1>
          <p className="mt-1 text-sm text-gray-600">
            Test TikTok events without a live stream
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-3">
          <button
            onClick={toggleAutoMode}
            className={`btn ${isAutoMode ? 'btn-warning' : 'btn-success'}`}
          >
            {isAutoMode ? (
              <>
                <Pause size={16} className="mr-2" />
                Stop Auto Mode
              </>
            ) : (
              <>
                <Play size={16} className="mr-2" />
                Start Auto Mode
              </>
            )}
          </button>
        </div>
      </div>

      {/* Last Sent Event Status */}
      {lastSent && (
        <div className="card bg-green-50 border-green-200">
          <div className="card-body">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              <span className="text-sm text-green-800">
                Last sent: <strong>{lastSent.type}</strong> event at {lastSent.timestamp.toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('manual')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'manual'
                ? 'border-tiktok-red text-tiktok-red'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Manual Events
          </button>
          <button
            onClick={() => setActiveTab('presets')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'presets'
                ? 'border-tiktok-red text-tiktok-red'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Preset Events
          </button>
          <button
            onClick={() => setActiveTab('auto')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'auto'
                ? 'border-tiktok-red text-tiktok-red'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Auto Mode
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'manual' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Event Type Selection */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Event Type</h3>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-2 gap-3">
                {eventTypes.map((type) => {
                  const Icon = type.icon
                  return (
                    <button
                      key={type.id}
                      onClick={() => setSelectedEventType(type.id)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        selectedEventType === type.id
                          ? 'border-tiktok-red bg-red-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex flex-col items-center text-center">
                        <div className={`w-12 h-12 rounded-full ${type.color} flex items-center justify-center mb-2`}>
                          <Icon size={24} className="text-white" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {type.name}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Event Form */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Event Details</h3>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit} className="space-y-4">
                {renderManualForm()}
                <button 
                  type="submit" 
                  disabled={loading}
                  className="btn btn-primary w-full"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send size={16} className="mr-2" />
                      Send Event
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'presets' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {presetEvents.map((preset, index) => {
            const eventType = eventTypes.find(type => type.id === preset.type)
            const Icon = eventType?.icon || MessageSquare
            return (
              <div key={index} className="card">
                <div className="card-body">
                  <div className="flex items-center mb-3">
                    <div className={`w-10 h-10 rounded-full ${eventType?.color} flex items-center justify-center mr-3`}>
                      <Icon size={20} className="text-white" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{preset.name}</h4>
                      <p className="text-sm text-gray-500 capitalize">{preset.type}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => sendPresetEvent(preset)}
                    disabled={loading}
                    className="btn btn-secondary w-full"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send size={16} className="mr-2" />
                        Send
                      </>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {activeTab === 'auto' && (
        <div className="max-w-2xl mx-auto">
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Auto Mode Settings</h3>
            </div>
            <div className="card-body space-y-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">Auto Mode Status</h4>
                  <p className="text-sm text-gray-600">
                    {isAutoMode ? 'Automatically generating events' : 'Manual mode active'}
                  </p>
                </div>
                <div className={`w-4 h-4 rounded-full ${isAutoMode ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Event Interval (seconds)
                </label>
                <input
                  type="number"
                  value={autoInterval}
                  onChange={(e) => setAutoInterval(parseInt(e.target.value))}
                  className="input"
                  min="1"
                  max="60"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Events will be generated every {autoInterval} seconds
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Event Types
                </label>
                <div className="space-y-2">
                  {eventTypes.map((type) => (
                    <label key={type.id} className="flex items-center">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="rounded border-gray-300 text-tiktok-red focus:ring-tiktok-red"
                      />
                      <span className="ml-2 text-sm text-gray-700">{type.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={toggleAutoMode}
                className={`btn w-full ${isAutoMode ? 'btn-warning' : 'btn-primary'}`}
              >
                {isAutoMode ? (
                  <>
                    <Pause size={16} className="mr-2" />
                    Stop Auto Mode
                  </>
                ) : (
                  <>
                    <Play size={16} className="mr-2" />
                    Start Auto Mode
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EventSimulator