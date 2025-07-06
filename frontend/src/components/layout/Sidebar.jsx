import { NavLink, useLocation } from 'react-router-dom'
import { 
  Home, 
  BarChart3, 
  Play, 
  Settings, 
  Activity,
  List,
  TrendingUp,
  Users,
  MessageSquare,
  Gift,
  X
} from 'lucide-react'
import { clsx } from 'clsx'

const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
  const location = useLocation()

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home, current: location.pathname === '/' },
    { name: 'Queue Monitor', href: '/queue', icon: List, current: location.pathname === '/queue' },
    { name: 'Event Simulator', href: '/simulator', icon: Play, current: location.pathname === '/simulator' },
    { name: 'Settings', href: '/settings', icon: Settings, current: location.pathname === '/settings' }
  ]

  const stats = [
    { name: 'Active Events', value: '1,234', icon: Activity, color: 'text-green-600' },
    { name: 'Queue Size', value: '56', icon: BarChart3, color: 'text-blue-600' },
    { name: 'Viewers', value: '2,456', icon: Users, color: 'text-purple-600' },
    { name: 'Gifts Today', value: '89', icon: Gift, color: 'text-tiktok-red' }
  ]

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        'fixed top-0 left-0 z-40 w-64 h-screen pt-16 transition-transform duration-300 bg-white border-r border-gray-200',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="h-full px-3 py-4 overflow-y-auto bg-white">
          {/* Close button for mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute top-20 right-4 p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 lg:hidden"
          >
            <X size={20} />
          </button>

          {/* Navigation */}
          <nav className="space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => clsx(
                    'flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive 
                      ? 'bg-tiktok-red text-white' 
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <Icon size={20} className="mr-3" />
                  {item.name}
                </NavLink>
              )
            })}
          </nav>

          {/* Stats */}
          <div className="mt-8">
            <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Live Stats
            </h3>
            <div className="mt-3 space-y-2">
              {stats.map((stat) => {
                const Icon = stat.icon
                return (
                  <div key={stat.name} className="px-3 py-2 rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Icon size={16} className={clsx('mr-2', stat.color)} />
                        <span className="text-sm text-gray-700">{stat.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        {stat.value}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="mt-8">
            <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Recent Activity
            </h3>
            <div className="mt-3 space-y-2">
              <div className="px-3 py-2 text-sm">
                <div className="flex items-center">
                  <MessageSquare size={14} className="mr-2 text-blue-500" />
                  <span className="text-gray-700">New chat message</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">2 min ago</p>
              </div>
              <div className="px-3 py-2 text-sm">
                <div className="flex items-center">
                  <Gift size={14} className="mr-2 text-tiktok-red" />
                  <span className="text-gray-700">Gift received</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">5 min ago</p>
              </div>
              <div className="px-3 py-2 text-sm">
                <div className="flex items-center">
                  <TrendingUp size={14} className="mr-2 text-green-500" />
                  <span className="text-gray-700">New follower</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">8 min ago</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar