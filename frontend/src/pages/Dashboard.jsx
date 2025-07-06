import { useState, useEffect } from 'react'
import { 
  Activity, 
  Users, 
  MessageSquare, 
  Gift, 
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react'
import StatsCard from '../components/ui/StatsCard'
import EventChart from '../components/ui/EventChart'
import RecentEvents from '../components/ui/RecentEvents'
import SystemStatus from '../components/ui/SystemStatus'
import { useSystemStats, useQueueStatus, useTikTokStatus, useSystemHealth, useRecentEvents } from '../hooks/useApi'

const Dashboard = () => {
  const { data: systemStats, loading: statsLoading } = useSystemStats(30000);
  const { data: queueStatus, loading: queueLoading } = useQueueStatus(10000);
  const { data: tiktokStatus, loading: tiktokLoading } = useTikTokStatus(15000);
  const { data: systemHealth, loading: healthLoading } = useSystemHealth(30000);
  const { data: recentEventsData, loading: eventsLoading } = useRecentEvents(10, 5000);

  const [stats, setStats] = useState({
    totalEvents: 0,
    queueSize: 0,
    viewers: 0,
    giftsToday: 0
  })

  const [systemStatus, setSystemStatus] = useState({
    tiktokConnection: 'disconnected',
    gmodConnection: 'disconnected',
    queueProcessor: 'stopped',
    lastUpdate: new Date()
  })

  // Update stats when data is loaded
  useEffect(() => {
    if (systemStats && queueStatus) {
      const totalEvents = systemStats.events ? Object.values(systemStats.events).reduce((sum, event) => sum + event.count, 0) : 0;
      const giftsToday = systemStats.events && systemStats.events['tiktok:gift'] ? systemStats.events['tiktok:gift'].count : 0;
      
      setStats({
        totalEvents,
        queueSize: queueStatus.currentSize || 0,
        viewers: 0, // This would come from TikTok live viewer count
        giftsToday
      });
    }
  }, [systemStats, queueStatus]);

  // Update system status
  useEffect(() => {
    if (systemHealth && tiktokStatus) {
      setSystemStatus({
        tiktokConnection: tiktokStatus.isConnected ? 'connected' : 'disconnected',
        gmodConnection: systemHealth.services?.gmod?.status || 'disconnected',
        queueProcessor: systemHealth.services?.queue?.status === 'healthy' ? 'running' : 'stopped',
        lastUpdate: new Date()
      });
    }
  }, [systemHealth, tiktokStatus]);

  const statsData = [
    {
      title: 'Total Events',
      value: stats.totalEvents.toLocaleString(),
      icon: Activity,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      change: '+12%',
      changeType: 'positive'
    },
    {
      title: 'Queue Size',
      value: stats.queueSize.toString(),
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      change: '-8%',
      changeType: 'negative'
    },
    {
      title: 'Live Viewers',
      value: stats.viewers.toLocaleString(),
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      change: '+24%',
      changeType: 'positive'
    },
    {
      title: 'Gifts Today',
      value: stats.giftsToday.toString(),
      icon: Gift,
      color: 'text-tiktok-red',
      bgColor: 'bg-red-50',
      change: '+45%',
      changeType: 'positive'
    }
  ]

  // Generate chart data from system stats
  const chartData = systemStats?.processing?.throughput?.hourly || [
    { time: '12:00', events: 45, gifts: 12 },
    { time: '13:00', events: 52, gifts: 15 },
    { time: '14:00', events: 48, gifts: 8 },
    { time: '15:00', events: 61, gifts: 22 },
    { time: '16:00', events: 55, gifts: 18 },
    { time: '17:00', events: 67, gifts: 25 }
  ];

  // Helper functions (definidas antes de usarlas)
  const getEventIcon = (eventType) => {
    switch (eventType) {
      case 'tiktok:gift': return Gift;
      case 'tiktok:follow': return TrendingUp;
      case 'tiktok:chat': return MessageSquare;
      case 'tiktok:like': return Activity;
      default: return Activity;
    }
  };

  const getEventColor = (eventType) => {
    switch (eventType) {
      case 'tiktok:gift': return 'text-tiktok-red';
      case 'tiktok:follow': return 'text-green-600';
      case 'tiktok:chat': return 'text-blue-600';
      case 'tiktok:like': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  const getEventMessage = (event) => {
    switch (event.event_type) {
      case 'tiktok:gift':
        return event.event_data?.gift?.name ? `Sent ${event.event_data.gift.name} x${event.event_data.gift.count || 1}` : 'Sent a gift';
      case 'tiktok:follow':
        return 'Started following';
      case 'tiktok:chat':
        return event.event_data?.comment || 'Sent a message';
      case 'tiktok:like':
        return 'Liked the stream';
      default:
        return 'Unknown event';
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hr ago`;
    return `${Math.floor(diffMins / 1440)} day ago`;
  };

  // Transform recent events data
  const recentEvents = recentEventsData?.map(event => ({
    id: event.id,
    type: event.event_type?.replace('tiktok:', ''),
    user: event.event_data?.user?.username || 'Unknown',
    message: event.event_data?.message || getEventMessage(event),
    timestamp: formatTimestamp(event.created_at),
    icon: getEventIcon(event.event_type),
    color: getEventColor(event.event_type)
  })) || [
    { id: 1, type: 'gift', user: 'user123', message: 'Sent Rose x5', timestamp: '2 min ago', icon: Gift, color: 'text-tiktok-red' },
    { id: 2, type: 'follow', user: 'newuser456', message: 'Started following', timestamp: '3 min ago', icon: TrendingUp, color: 'text-green-600' },
    { id: 3, type: 'chat', user: 'chatter789', message: 'Hello from TikTok!', timestamp: '4 min ago', icon: MessageSquare, color: 'text-blue-600' },
    { id: 4, type: 'gift', user: 'giftgiver', message: 'Sent Heart x10', timestamp: '5 min ago', icon: Gift, color: 'text-tiktok-red' }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Monitor your TikTok Live events and system status
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-sm font-medium text-gray-900">All Systems Operational</span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsData.map((stat, index) => (
          <StatsCard key={index} {...stat} />
        ))}
      </div>

      {/* Charts and Recent Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Event Activity</h3>
            <p className="text-sm text-gray-600">Events and gifts over time</p>
          </div>
          <div className="card-body">
            <EventChart data={chartData} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Recent Events</h3>
            <p className="text-sm text-gray-600">Live activity from TikTok</p>
          </div>
          <div className="card-body">
            <RecentEvents events={recentEvents} />
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SystemStatus 
          title="TikTok Connection"
          status={systemStatus.tiktokConnection}
          lastUpdate={systemStatus.lastUpdate}
        />
        <SystemStatus 
          title="GMod Connection"
          status={systemStatus.gmodConnection}
          lastUpdate={systemStatus.lastUpdate}
        />
        <SystemStatus 
          title="Queue Processor"
          status={systemStatus.queueProcessor}
          lastUpdate={systemStatus.lastUpdate}
        />
      </div>
    </div>
  )
}

export default Dashboard