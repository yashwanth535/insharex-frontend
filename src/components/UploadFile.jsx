import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileUp, ArrowRight } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import axios from 'axios';

const UploadFile = ({ setShareCode }) => {
  const { isDark } = useTheme();
  const API_URL = import.meta.env.VITE_BACKEND_URL;
  const [pdf, setPdf] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdf(file);
      setUploadStatus('');
    } else {
      setUploadStatus('Please select a valid PDF file');
      setPdf(null);
    }
  };

  const handleUpload = async () => {
    if (!pdf) {
      setUploadStatus('Please select a file first');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('pdf', pdf);

    try {
      const response = await axios.post(`${API_URL}/api/upload-pdf`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true,
      });

      setUploadStatus('File uploaded successfully!');
      setPdf(null);
      fileInputRef.current.value = null; // Clear file input
    } catch (error) {
      setUploadStatus('Error uploading file. Please try again.');
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <motion.div className="p-8 space-y-6">
      <motion.div className="flex items-center space-x-3">
        <Upload className={`h-7 w-7 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
        <h2 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Upload PDF File
        </h2>
      </motion.div>

      <motion.div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          className={`w-full p-4 border-2 border-dashed rounded-xl transition-all ${
            isDark ? 'border-gray-700 bg-gray-900 text-white' : 'border-gray-300 bg-gray-50 text-gray-900'
          }`}
        />
        <FileUp className="absolute right-4 top-4 h-5 w-5 text-gray-400" />
      </motion.div>

      <AnimatePresence>
        {pdf && (
          <motion.p className="text-sm text-gray-600">Selected: {pdf.name}</motion.p>
        )}
      </AnimatePresence>

      <motion.button
        onClick={handleUpload}
        disabled={isUploading || !pdf}
        className={`w-full py-4 px-6 rounded-xl text-white font-medium flex items-center justify-center space-x-2 transition-all
          ${isUploading || !pdf ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
      >
        <span>{isUploading ? 'Uploading...' : 'Upload PDF'}</span>
        {!isUploading && <ArrowRight className="h-5 w-5" />}
      </motion.button>

      {uploadStatus && (
        <motion.p
          className={`text-center p-3 rounded-xl text-sm ${
            uploadStatus.includes('successfully') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {uploadStatus}
        </motion.p>
      )}
    </motion.div>
  );
};

export default UploadFile;
