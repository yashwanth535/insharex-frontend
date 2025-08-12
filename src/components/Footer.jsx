import { motion } from 'framer-motion'
import { Heart, Share2, Wifi, Globe } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

const Footer = () => {
  const { isDark } = useTheme()

  return (
    <motion.footer 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      className={`relative mt-16 ${isDark ? 'bg-black' : 'bg-gray-50'} transition-colors duration-200`}
    >
      <div className={`w-full border-t ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
            <div className="flex items-center space-x-3">
              <Share2 className={`h-5 w-5 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
              <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                InShareX
              </span>
            </div>
            
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <Wifi className={`h-4 w-4 ${isDark ? 'text-green-400' : 'text-green-500'}`} />
                <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                  P2P via WebRTC
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Globe className={`h-4 w-4 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
                <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                  Communication via WebSocket
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Share2 className={`h-4 w-4 ${isDark ? 'text-orange-400' : 'text-orange-500'}`} />
                <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                  P2P via WebTorrents
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                © {new Date().getFullYear()} InShareX
              </p>
              <span className={`text-xs flex items-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Made with <Heart className="h-3 w-3 mx-1 text-red-500" /> by Yashwanth
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.footer>
  )
}

export default Footer 