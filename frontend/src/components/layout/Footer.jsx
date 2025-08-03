const Footer = () => {
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto ml-0 lg:ml-64">
      <div className="px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-center">
          <div className="text-sm text-gray-600">
            © 2024 Garry's TikTok Bridge. Built with React + Tailwind CSS.
          </div>
          <div className="flex items-center space-x-4 mt-2 sm:mt-0">
            <span className="text-sm text-gray-500">Version 1.0.0</span>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">System Healthy</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer