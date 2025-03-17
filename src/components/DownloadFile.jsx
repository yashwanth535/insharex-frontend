import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const backendUrl = import.meta.env.VITE_BACKEND_URL;

const DownloadFile = () => {
  const { isDark } = useTheme();
  const [downloadCode, setDownloadCode] = useState('');
  const [error, setError] = useState('');

  const handleDownload = async () => {
    if (!downloadCode || downloadCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    try {
      const response = await fetch(`${backendUrl}/api/download/${downloadCode}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Download failed');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1].replace(/["']/g, '')
        : 'downloaded-file';

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
      setDownloadCode('');
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to download file. Please check your code and try again.');
      console.error('Download error:', err);
    }
  };

  return (
    <div className="p-8 md:p-10 space-y-6">
      <div className="flex items-center space-x-3">
        <Download className={`h-7 w-7 ${isDark ? 'text-green-400' : 'text-green-500'}`} />
        <h2 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Download File
        </h2>
      </div>

      <div className="flex space-x-3">
        <input
          type="text"
          value={downloadCode}
          onChange={(e) => setDownloadCode(e.target.value)}
          placeholder="Enter 6-digit code"
          maxLength={6}
          className={`flex-1 p-4 border-2 rounded-xl ${
            isDark ? 'border-gray-700 bg-gray-900 text-white' : 'border-gray-200 bg-gray-50 text-gray-900'
          }`}
        />
        <button
          onClick={handleDownload}
          className="px-8 rounded-xl text-white font-medium bg-green-500 hover:bg-green-600 shadow-lg"
        >
          Download
        </button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`mt-6 p-4 rounded-xl border ${
              isDark ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'
            }`}
          >
            <p className={isDark ? 'text-red-400' : 'text-red-600'}>{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DownloadFile;
