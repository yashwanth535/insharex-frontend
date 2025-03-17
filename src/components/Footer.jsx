import { motion } from 'framer-motion'
import { Github, Twitter, Heart, Share2 } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

const Footer = () => {
  const { isDark } = useTheme()

  return (
    <motion.footer 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      className={`relative mt-16 ${isDark ? 'bg-gray-900' : 'bg-gray-50'} transition-colors duration-200`}
    >
      <div className={`w-full border-t ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
            <div className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start space-x-2 mb-4">
                <Share2 className={`h-6 w-6 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  ShareX
                </h3>
              </div>
              <p className={`${isDark ? 'text-gray-300' : 'text-gray-600'} leading-relaxed`}>
                The simplest way to share files securely. No registration required, just upload and share with a 6-digit code.
              </p>
            </div>
            
            <div className="text-center">
              <h3 className={`text-lg font-semibold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Connect
              </h3>
              <div className="flex justify-center space-x-8">
                <motion.a
                  whileHover={{ y: -4, scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${isDark ? 'text-gray-400 hover:text-blue-400' : 'text-gray-600 hover:text-blue-500'} transition-colors`}
                >
                  <Github className="h-6 w-6" />
                </motion.a>
                <motion.a
                  whileHover={{ y: -4, scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${isDark ? 'text-gray-400 hover:text-blue-400' : 'text-gray-600 hover:text-blue-500'} transition-colors`}
                >
                  <Twitter className="h-6 w-6" />
                </motion.a>
              </div>
            </div>

            <div className="text-center md:text-right">
              <h3 className={`text-lg font-semibold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Features
              </h3>
              <ul className="space-y-3">
                {['Secure File Transfer', '24-hour Storage', 'Any File Type'].map((feature, index) => (
                  <motion.li 
                    key={index}
                    whileHover={{ x: -4 }}
                    className={`${
                      isDark 
                        ? 'text-gray-300 hover:text-blue-400' 
                        : 'text-gray-600 hover:text-blue-500'
                    } transition-colors cursor-default`}
                  >
                    {feature}
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className={`mt-12 pt-8 border-t ${isDark ? 'border-gray-800' : 'border-gray-200'}`}
          >
            <div className="flex flex-col md:flex-row items-center justify-between">
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                © {new Date().getFullYear()} ShareX. All rights reserved.
              </p>
              <div className="flex items-center mt-4 md:mt-0">
                <span className={`text-sm flex items-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Made with <Heart className="h-4 w-4 mx-2 text-red-500" /> by ShareX Team
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.footer>
  )
}

export default Footer 