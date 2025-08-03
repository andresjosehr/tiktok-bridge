const RecentEvents = ({ events }) => {
  if (!events || events.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No recent events</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {events.map((event) => {
        const Icon = event.icon
        return (
          <div key={event.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
            <div className={`p-2 rounded-lg bg-gray-100`}>
              <Icon className={`w-4 h-4 ${event.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {event.user}
                </p>
                <p className="text-xs text-gray-500">
                  {event.timestamp}
                </p>
              </div>
              <p className="text-sm text-gray-600 truncate">
                {event.message}
              </p>
            </div>
          </div>
        )
      })}
      <div className="text-center pt-2">
        <button className="text-sm text-tiktok-red hover:text-tiktok-red/80 font-medium">
          View all events
        </button>
      </div>
    </div>
  )
}

export default RecentEvents