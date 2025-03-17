import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Copy, Check } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useTheme } from '../context/ThemeContext';
import UploadFile from '../components/UploadFile';

const backendUrl = import.meta.env.VITE_BACKEND_URL;

const Landing = () => {
  const { isDark } = useTheme();
  const [downloadCode, setDownloadCode] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopyCode = (shareCode) => {
    navigator.clipboard.writeText(shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Header />
      <motion.main initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="container mx-auto px-4 pt-28 pb-16">
        <motion.div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className={`text-6xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Share Files <span className={isDark ? 'text-blue-400' : 'text-blue-500'}>Instantly</span></h1>
          <p className={`text-xl ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Secure file sharing with a simple 6-digit code. No registration required.</p>
        </motion.div>

        <motion.div className="max-w-5xl mx-auto">
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl overflow-hidden grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
            <UploadFile onCopy={handleCopyCode} />

            <div className="p-8 md:p-10 space-y-6">
              <div className="flex items-center space-x-3">
                <Download className={`h-7 w-7 ${isDark ? 'text-green-400' : 'text-green-500'}`} />
                <h2 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Download File</h2>
              </div>

              <div className="flex space-x-3">
                <input type="text" value={downloadCode} onChange={(e) => setDownloadCode(e.target.value)} placeholder="Enter 6-digit code" maxLength={6} className={`flex-1 p-4 border-2 rounded-xl ${isDark ? 'border-gray-700 bg-gray-900 text-white' : 'border-gray-200 bg-gray-50 text-gray-900'}`} />
                <button onClick={handleDownload} className="px-8 rounded-xl text-white font-medium bg-green-500 hover:bg-green-600 shadow-lg">Download</button>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className={`mt-6 p-4 rounded-xl border ${isDark ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'}`}>
                <p className={isDark ? 'text-red-400' : 'text-red-600'}>{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.main>
      <Footer />
    </div>
  );
};

export default Landing;
