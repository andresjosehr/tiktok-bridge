import { CheckCircle, AlertCircle, XCircle, Clock } from 'lucide-react'

const SystemStatus = ({ title, status, lastUpdate }) => {
  const getStatusConfig = (status) => {
    switch (status) {
      case 'connected':
      case 'running':
        return {
          icon: CheckCircle,
          color: 'text-green-500',
          bgColor: 'bg-green-50',
          label: 'Connected',
          dotColor: 'bg-green-500'
        }
      case 'disconnected':
      case 'stopped':
        return {
          icon: XCircle,
          color: 'text-red-500',
          bgColor: 'bg-red-50',
          label: 'Disconnected',
          dotColor: 'bg-red-500'
        }
      case 'connecting':
      case 'starting':
        return {
          icon: Clock,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-50',
          label: 'Connecting',
          dotColor: 'bg-yellow-500'
        }
      default:
        return {
          icon: AlertCircle,
          color: 'text-gray-500',
          bgColor: 'bg-gray-50',
          label: 'Unknown',
          dotColor: 'bg-gray-500'
        }
    }
  }

  const config = getStatusConfig(status)
  const Icon = config.icon

  return (
    <div className="card">
      <div className="card-body">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-900">{title}</h4>
          <div className={`p-2 rounded-full ${config.bgColor}`}>
            <Icon className={`w-4 h-4 ${config.color}`} />
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${config.dotColor} ${
              status === 'connected' || status === 'running' ? 'animate-pulse' : ''
            }`} />
            <span className={`text-sm font-medium ${config.color}`}>
              {config.label}
            </span>
          </div>
          
          <div className="text-right">
            <p className="text-xs text-gray-500">
              Last update
            </p>
            <p className="text-xs font-medium text-gray-900">
              {lastUpdate.toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SystemStatus