import { useState, useEffect } from 'react'
import { 
  Play, 
  Pause, 
  Trash2, 
  RefreshCw,
  Filter,
  Search,
  ArrowUp,
  ArrowDown,
  Clock,
  AlertTriangle
} from 'lucide-react'
import { useQueueStatus, useQueueMetrics } from '../hooks/useApi'
import apiService from '../services/api'

const QueueMonitor = () => {
  const { data: queueStatus, loading: statusLoading, refetch: refetchStatus } = useQueueStatus(5000);
  const { data: queueMetrics, loading: metricsLoading } = useQueueMetrics(24, 60000);
  
  const [queueItems, setQueueItems] = useState([])
  const [isProcessing, setIsProcessing] = useState(true)
  const [filterType, setFilterType] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('priority')
  const [sortOrder, setSortOrder] = useState('desc')
  const [loading, setLoading] = useState(false)

  // Load queue items from API
  useEffect(() => {
    const loadQueueItems = async () => {
      try {
        setLoading(true);
        const events = await apiService.getRecentEvents(100);
        const formattedItems = events.map(event => ({
          id: event.id,
          type: event.event_type?.replace('tiktok:', '') || 'unknown',
          user: event.event_data?.user?.username || 'Unknown',
          data: event.event_data,
          priority: getPriorityFromType(event.event_type),
          status: event.status || 'pending',
          timestamp: new Date(event.created_at),
          retryCount: event.attempts || 0
        }));
        setQueueItems(formattedItems);
      } catch (error) {
        console.error('Failed to load queue items:', error);
      } finally {
        setLoading(false);
      }
    };

    loadQueueItems();
    const interval = setInterval(loadQueueItems, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const getPriorityFromType = (eventType) => {
    switch (eventType) {
      case 'tiktok:gift':
      case 'tiktok:donation':
        return 100;
      case 'tiktok:follow':
        return 50;
      case 'tiktok:share':
        return 15;
      case 'tiktok:chat':
        return 10;
      case 'tiktok:like':
        return 5;
      case 'tiktok:viewerCount':
        return 1;
      default:
        return 0;
    }
  };

  const handleClearQueue = async () => {
    try {
      await apiService.clearQueue();
      setQueueItems([]);
      refetchStatus();
    } catch (error) {
      console.error('Failed to clear queue:', error);
    }
  };

  const handleOptimizeQueue = async () => {
    try {
      await apiService.optimizeQueue();
      refetchStatus();
    } catch (error) {
      console.error('Failed to optimize queue:', error);
    }
  };

  const handleRetryItem = async (itemId) => {
    try {
      // This would be implemented in the backend
      console.log('Retrying item:', itemId);
    } catch (error) {
      console.error('Failed to retry item:', error);
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      // This would be implemented in the backend
      console.log('Deleting item:', itemId);
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const mockQueueItems = [
    {
      id: 1,
      type: 'gift',
      user: 'user123',
      data: { giftName: 'Rose', giftCount: 5, giftValue: 50 },
      priority: 100,
      status: 'pending',
      timestamp: new Date(Date.now() - 30000),
      retryCount: 0
    },
    {
      id: 2,
      type: 'follow',
      user: 'newuser456',
      data: { username: 'newuser456' },
      priority: 50,
      status: 'pending',
      timestamp: new Date(Date.now() - 45000),
      retryCount: 0
    },
    {
      id: 3,
      type: 'chat',
      user: 'chatter789',
      data: { message: 'Hello from TikTok!' },
      priority: 10,
      status: 'processing',
      timestamp: new Date(Date.now() - 60000),
      retryCount: 0
    },
    {
      id: 4,
      type: 'gift',
      user: 'giftgiver',
      data: { giftName: 'Heart', giftCount: 10, giftValue: 100 },
      priority: 100,
      status: 'failed',
      timestamp: new Date(Date.now() - 120000),
      retryCount: 2
    }
  ]

  useEffect(() => {
    setQueueItems(mockQueueItems)
  }, [])

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'processing': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeColor = (type) => {
    switch (type) {
      case 'gift': return 'text-tiktok-red'
      case 'follow': return 'text-green-600'
      case 'chat': return 'text-blue-600'
      case 'share': return 'text-purple-600'
      case 'like': return 'text-pink-600'
      default: return 'text-gray-600'
    }
  }

  const getPriorityLabel = (priority) => {
    if (priority >= 100) return 'Critical'
    if (priority >= 50) return 'High'
    if (priority >= 20) return 'Medium'
    return 'Low'
  }

  const filteredItems = queueItems
    .filter(item => filterType === 'all' || item.type === filterType)
    .filter(item => 
      searchTerm === '' || 
      item.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.type.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const multiplier = sortOrder === 'asc' ? 1 : -1
      if (sortBy === 'priority') return (b.priority - a.priority) * multiplier
      if (sortBy === 'timestamp') return (b.timestamp - a.timestamp) * multiplier
      return 0
    })

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Queue Monitor</h1>
          <p className="mt-1 text-sm text-gray-600">
            Monitor and manage event queue processing
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-3">
          <button
            onClick={handleOptimizeQueue}
            className="btn btn-primary"
          >
            <RefreshCw size={16} className="mr-2" />
            Optimize Queue
          </button>
          <button
            onClick={handleClearQueue}
            className="btn btn-warning"
          >
            <Trash2 size={16} className="mr-2" />
            Clear Queue
          </button>
          <button 
            onClick={refetchStatus}
            className="btn btn-secondary"
          >
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Queue</p>
                <p className="text-2xl font-bold text-gray-900">
                  {queueStatus?.currentSize || queueItems.length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-blue-500" />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Processing</p>
                <p className="text-2xl font-bold text-blue-600">
                  {queueStatus?.stats?.processing || queueItems.filter(item => item.status === 'processing').length}
                </p>
              </div>
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-red-600">
                  {queueStatus?.stats?.failed || queueItems.filter(item => item.status === 'failed').length}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {queueMetrics?.processingStats?.successRate?.success_rate ? 
                    `${Math.round(queueMetrics.processingStats.successRate.success_rate)}%` : 
                    '94%'
                  }
                </p>
              </div>
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search by user or event type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-10"
                />
              </div>
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="input"
            >
              <option value="all">All Types</option>
              <option value="gift">Gifts</option>
              <option value="follow">Follows</option>
              <option value="chat">Chat</option>
              <option value="share">Shares</option>
              <option value="like">Likes</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input"
            >
              <option value="priority">Sort by Priority</option>
              <option value="timestamp">Sort by Time</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="btn btn-secondary"
            >
              {sortOrder === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Queue Items */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Queue Items</h3>
          <p className="text-sm text-gray-600">
            Showing {filteredItems.length} of {queueItems.length} items
          </p>
        </div>
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-2 h-2 rounded-full mr-3 ${getTypeColor(item.type)}`} 
                             style={{backgroundColor: 'currentColor'}} />
                        <div>
                          <div className="text-sm font-medium text-gray-900 capitalize">
                            {item.type}
                          </div>
                          <div className="text-sm text-gray-500">
                            {item.type === 'gift' && `${item.data.giftName} x${item.data.giftCount}`}
                            {item.type === 'chat' && item.data.message}
                            {item.type === 'follow' && 'New follower'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.user}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-900 mr-2">
                          {item.priority}
                        </span>
                        <span className={`badge ${
                          item.priority >= 100 ? 'badge-danger' :
                          item.priority >= 50 ? 'badge-warning' :
                          item.priority >= 20 ? 'badge-info' : 'badge-success'
                        }`}>
                          {getPriorityLabel(item.priority)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`badge ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                      {item.retryCount > 0 && (
                        <span className="ml-2 text-xs text-gray-500">
                          ({item.retryCount} retries)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {item.status === 'failed' && (
                          <button 
                            onClick={() => handleRetryItem(item.id)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Retry
                          </button>
                        )}
                        <button 
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default QueueMonitor