import { useState, useEffect, useRef } from 'react';
import { Upload, Download, FileUp, Users, Send, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

const wsurl = import.meta.env.VITE_WEBSOCKET_URL;
const ws = new WebSocket(wsurl);

const FileShare = () => {
  const { isDark } = useTheme();
  const [roomId, setRoomId] = useState('');
  const [peerConnected, setPeerConnected] = useState(false);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');
  const [sendProgress, setSendProgress] = useState(0);
  const [receiveProgress, setReceiveProgress] = useState(0);
  const [processingTime, setProcessingTime] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [receivingFileName, setReceivingFileName] = useState('');
  const [isReceiver, setIsReceiver] = useState(false);
  const [fileReady, setFileReady] = useState(false);
  const [isRoomCreator, setIsRoomCreator] = useState(false);
  
  // Use refs for data that doesn't need to trigger re-renders
  const receivedChunksRef = useRef([]);
  const receivedFileSizeRef = useRef(0);
  const totalChunksRef = useRef(0);
  const receivedChunksCountRef = useRef(0);
  const receivedMimeTypeRef = useRef('application/octet-stream');
  const wsRef = useRef(null);
  const fileInputRef = useRef(null);
  const chunkTimeoutRef = useRef(null);
  const pendingAcksRef = useRef({});

  // Constants
  const CHUNK_SIZE = 1024 * 256; // Reduced to 256KB for better performance
  const ACK_TIMEOUT = 3000; // 3 seconds timeout for acknowledgment
  const MAX_RETRY = 3;

  // Initialize WebSocket connection
  useEffect(() => {
    wsRef.current = ws;
    
    // Ensure connection is open
    if (ws.readyState !== 1) {
      ws.onopen = () => {
        console.log('WebSocket connection established');
      };
    }
    
    // Clean up on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.onmessage = null;
      }
    };
  }, []);


  const createRoom = () => {
    if (!wsRef.current || wsRef.current.readyState !== 1) {
      setStatus('Error: WebSocket not connected. Please refresh the page.');
      return;
    }
    
    wsRef.current.send(JSON.stringify({ type: 'create-room' }));
    setIsReceiver(false);
    setIsRoomCreator(true);
    resetFileState();
  };

  const joinRoom = () => {
    if (!roomId.trim()) {
      setStatus('Please enter a room code.');
      return;
    }
    
    if (!wsRef.current || wsRef.current.readyState !== 1) {
      setStatus('Error: WebSocket not connected. Please refresh the page.');
      return;
    }
    
    wsRef.current.send(JSON.stringify({ type: 'join-room', roomId }));
    setIsReceiver(true); 
    setIsRoomCreator(false);
    resetFileState();
  };

  const resetFileState = () => {
    setReceiveProgress(0);
    setSendProgress(0);
    setStatus('');
    setFileReady(false);
    receivedChunksRef.current = [];
    receivedChunksCountRef.current = 0;
    totalChunksRef.current = 0;
    receivedFileSizeRef.current = 0;
    pendingAcksRef.current = {};
    clearTimeout(chunkTimeoutRef.current);
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
      setSendProgress(0);
      setStatus('');
    }
  };

  // Improved sendFile function with retries and acknowledgment tracking
  const sendFile = async () => {
    if (!file || !peerConnected || !wsRef.current) return;
    
    setIsReceiver(false);
    
    // Send file metadata
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    wsRef.current.send(JSON.stringify({ 
      type: 'file-meta', 
      roomId, 
      fileName: file.name, 
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      totalChunks
    }));
    
    // Send chunks with acknowledgment tracking
    const totalSize = file.size;
    let start = 0;
    
    // Helper function to send a single chunk
    const sendChunk = async (start, chunkIndex, retryCount = 0) => {
      if (retryCount > MAX_RETRY) {
        setStatus(`Failed to send chunk ${chunkIndex} after multiple attempts.`);
        return;
      }
      
      const end = Math.min(start + CHUNK_SIZE, totalSize);
      const chunk = file.slice(start, end);
      const buffer = await chunk.arrayBuffer();
      const byteArray = Array.from(new Uint8Array(buffer));
      
      wsRef.current.send(JSON.stringify({ 
        type: 'file-chunk', 
        roomId, 
        chunk: byteArray,
        chunkIndex,
        totalChunks
      }));
      
      // Set timeout for acknowledgment
      pendingAcksRef.current[chunkIndex] = true;
      
      chunkTimeoutRef.current = setTimeout(() => {
        if (pendingAcksRef.current[chunkIndex]) {
          console.log(`Retrying chunk ${chunkIndex}, attempt ${retryCount + 1}`);
          sendChunk(start, chunkIndex, retryCount + 1);
        }
      }, ACK_TIMEOUT);
    };
    
    // Start sending chunks
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const chunkStart = chunkIndex * CHUNK_SIZE;
      
      // Wait for previous chunk to be acknowledged before sending next
      if (chunkIndex > 0) {
        await new Promise(resolve => {
          const checkPrevious = () => {
            if (!pendingAcksRef.current[chunkIndex - 1]) {
              resolve();
            } else {
              setTimeout(checkPrevious, 100);
            }
          };
          checkPrevious();
        });
      }
      
      await sendChunk(chunkStart, chunkIndex);
      
      // Update progress
      const progress = Math.floor(((chunkIndex + 1) / totalChunks) * 100);
      setSendProgress(progress);
    }
  };

  const downloadReceivedFile = () => {
    setIsDownloading(true);
    
    // Estimate processing time based on file size
    const estimatedTime = Math.max(1, Math.ceil(receivedFileSizeRef.current / (1024 * 1024) * 0.1));
    setProcessingTime(estimatedTime);
    
    setTimeout(() => {
      try {
        // Combine all chunks
        let totalLength = 0;
        receivedChunksRef.current.forEach(chunk => {
          if (chunk) totalLength += chunk.length;
        });
        
        const combinedArray = new Uint8Array(totalLength);
        let offset = 0;
        
        receivedChunksRef.current.forEach(chunk => {
          if (chunk) {
            combinedArray.set(chunk, offset);
            offset += chunk.length;
          }
        });
        
        // Create blob and download
        const fileBlob = new Blob([combinedArray], { type: receivedMimeTypeRef.current });
        const element = document.createElement('a');
        element.href = URL.createObjectURL(fileBlob);
        element.download = receivingFileName || 'downloaded_file';
        document.body.appendChild(element);
        element.click();
        
        // Clean up
        setTimeout(() => {
          URL.revokeObjectURL(element.href);
          document.body.removeChild(element);
        }, 100);
        
        setIsDownloading(false);
        setStatus('File downloaded successfully!');
      } catch (error) {
        console.error('Download error:', error);
        setStatus('Error downloading file: ' + error.message);
        setIsDownloading(false);
      }
    }, estimatedTime * 1000);
  };

  // WebSocket message handler
  useEffect(() => {
    if (!wsRef.current) return;
    
    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'room-created':
            setRoomId(data.roomId);
            setStatus('Room created. Share this code with others to join.');
            break;
            
          case 'peer-joined':
            setPeerConnected(true);
            setStatus('Peer connected! You can now share files.');
            break;
            
          case 'file-meta':
            receivedChunksRef.current = new Array(data.totalChunks).fill(null);
            receivedFileSizeRef.current = data.fileSize;
            totalChunksRef.current = data.totalChunks;
            receivedChunksCountRef.current = 0;
            receivedMimeTypeRef.current = data.mimeType || 'application/octet-stream';
            setReceivingFileName(data.fileName);
            setStatus(`Receiving: ${data.fileName}`);
            setReceiveProgress(0);
            setIsReceiver(true);
            setFileReady(false);
            break;
            
          case 'file-chunk':
            // Process chunk and send acknowledgment
            const chunk = new Uint8Array(data.chunk);
            receivedChunksRef.current[data.chunkIndex] = chunk;
            receivedChunksCountRef.current++;
            
            // Send acknowledgment
            wsRef.current.send(JSON.stringify({
              type: 'chunk-ack',
              roomId,
              chunkIndex: data.chunkIndex
            }));
            
            // Update progress
            const progress = Math.floor((receivedChunksCountRef.current / data.totalChunks) * 100);
            setReceiveProgress(progress);
            
            // Check if file is complete
            if (progress === 100) {
              receivedChunksRef.current = receivedChunksRef.current.filter(chunk => chunk !== null);
              setStatus('File received successfully! Click to download.');
              setFileReady(true);
              
              // Send final acknowledgment that all chunks were received
              wsRef.current.send(JSON.stringify({
                type: 'file-received',
                roomId
              }));
            }
            break;
            
          case 'chunk-ack':
            // Clear acknowledgment timeout and mark chunk as acknowledged
            if (pendingAcksRef.current[data.chunkIndex]) {
              pendingAcksRef.current[data.chunkIndex] = false;
              clearTimeout(chunkTimeoutRef.current);
            }
            break;
            
          case 'file-received':
            // Receiver has confirmed all chunks were received
            setStatus('File sent successfully!');
            break;
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };
    
    wsRef.current.onmessage = handleMessage;
    
    return () => {
      if (wsRef.current) {
        wsRef.current.onmessage = null;
      }
    };
  }, [roomId, isReceiver]);

  // Helper function to format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    else if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    else return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  return (
    <div className={`w-full p-8 ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-lg border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
      <div className="mb-8 text-center">
        <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>P2P File Sharing</h2>
        <p className={`${isDark ? 'text-gray-300' : 'text-gray-600'} mt-2`}>Transfer files directly to another device</p>
      </div>
      
      <AnimatePresence>
        {status && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mb-6 p-4 rounded-xl text-sm ${
              status.includes('successfully') 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                : status.includes('Error') 
                  ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
            }`}
          >
            {status}
          </motion.div>
        )}
      </AnimatePresence>

      {!peerConnected && (
        <div className="space-y-6">
          <motion.div 
            className={`p-6 ${isDark ? 'bg-blue-900/20' : 'bg-blue-50'} rounded-xl shadow-sm border ${isDark ? 'border-blue-800' : 'border-blue-200'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="flex items-center space-x-3 mb-4">
              <Users className="h-6 w-6 text-blue-500 dark:text-blue-400" />
              <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>Create or Join Room</h3>
            </div>
            
            <button 
              onClick={createRoom} 
              className="w-full mb-4 bg-blue-500 hover:bg-blue-600 text-white font-medium py-4 px-6 rounded-xl transition duration-200 flex items-center justify-center space-x-2"
            >
              <Users className="h-5 w-5" />
              <span>Create New Room</span>
            </button>
            
            {roomId && isRoomCreator && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mb-4 p-4 ${isDark ? 'bg-gray-700' : 'bg-white'} rounded-xl border ${isDark ? 'border-blue-800' : 'border-blue-200'}`}
              >
                <p className={`${isDark ? 'text-gray-300' : 'text-gray-600'} mb-1 text-sm`}>Share this code with others:</p>
                <div className="text-lg font-mono font-bold text-blue-600 dark:text-blue-400">{roomId}</div>
              </motion.div>
            )}
            
            {!isRoomCreator && (
              <div className="mt-4">
                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Join Existing Room</label>
                <div className="flex space-x-3">
                  <input 
                    type="text" 
                    placeholder="Enter Room Code" 
                    value={roomId} 
                    onChange={(e) => setRoomId(e.target.value)} 
                    className={`flex-1 border ${isDark ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'} rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                  <button 
                    onClick={joinRoom} 
                    className="bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-6 rounded-xl transition duration-200"
                  >
                    Join
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {peerConnected && !isReceiver && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-6 p-6 ${isDark ? 'bg-blue-900/20' : 'bg-blue-50'} rounded-xl shadow-sm border ${isDark ? 'border-blue-800' : 'border-blue-200'}`}
        >
          <div className="flex items-center space-x-3 mb-4">
            <Upload className="h-6 w-6 text-blue-500 dark:text-blue-400" />
            <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>Send File</h3>
          </div>
          
          <div className="space-y-4">
            <div 
              onClick={() => fileInputRef.current.click()}
              className={`relative border-2 border-dashed ${isDark ? 'border-blue-700' : 'border-blue-300'} rounded-xl p-6 cursor-pointer ${isDark ? 'hover:bg-blue-800/20' : 'hover:bg-blue-100'} transition duration-200 flex flex-col items-center justify-center`}
            >
              <FileUp className="h-10 w-10 text-blue-400 dark:text-blue-500 mb-2" />
              <p className="text-blue-600 dark:text-blue-400 font-medium">Select a file to share</p>
              <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'} text-sm mt-1`}>Click to browse your files</p>
              <input 
                ref={fileInputRef}
                type="file" 
                onChange={handleFileChange} 
                className="hidden" 
              />
            </div>
            
            {file && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center p-4 ${isDark ? 'bg-gray-700' : 'bg-white'} rounded-xl border ${isDark ? 'border-blue-800' : 'border-blue-200'}`}
              >
                <div className="flex-1">
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>{file.name}</p>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{formatFileSize(file.size)}</p>
                </div>
              </motion.div>
            )}
            
            <motion.button 
              onClick={sendFile} 
              disabled={!file || (sendProgress > 0 && sendProgress < 100)}
              className={`w-full py-4 px-6 rounded-xl font-medium flex items-center justify-center space-x-2 transition-all
                ${file && !(sendProgress > 0 && sendProgress < 100) 
                  ? "bg-blue-500 hover:bg-blue-600 text-white" 
                  : `${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-300 text-gray-500'} cursor-not-allowed`}`}
            >
              {sendProgress > 0 && sendProgress < 100 ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>Sending... {sendProgress}%</span>
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  <span>Send File</span>
                </>
              )}
            </motion.button>
            
            {sendProgress > 0 && (
              <div className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-2`}>
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${sendProgress}%` }}
                ></div>
              </div>
            )}
          </div>
        </motion.div>
      )}
      
      {isReceiver && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-6 p-6 ${isDark ? 'bg-blue-900/20' : 'bg-blue-50'} rounded-xl shadow-sm border ${isDark ? 'border-blue-800' : 'border-blue-200'}`}
        >
          <div className="flex items-center space-x-3 mb-4">
            <Download className="h-6 w-6 text-green-500 dark:text-green-400" />
            <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>Receive File</h3>
          </div>
          
          {receiveProgress > 0 && !fileReady && (
            <motion.div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Receiving: {receivingFileName}</span>
                <span className="font-medium text-blue-600 dark:text-blue-400">{receiveProgress}%</span>
              </div>
              <div className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-2`}>
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${receiveProgress}%` }}
                ></div>
              </div>
            </motion.div>
          )}
          
          {fileReady && !isDownloading && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`p-4 ${isDark ? 'bg-green-900/20' : 'bg-green-100'} rounded-xl border ${isDark ? 'border-green-800' : 'border-green-200'} mb-4`}
            >
              <div className="flex items-start">
                <div className="flex-1">
                  <p className="font-medium text-green-800 dark:text-green-400">File ready to download!</p>
                  <p className="text-sm text-green-700 dark:text-green-500 mt-1">{receivingFileName} ({formatFileSize(receivedFileSizeRef.current)})</p>
                </div>
              </div>
              <button
                onClick={downloadReceivedFile}
                className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-xl font-medium transition flex items-center justify-center space-x-2"
              >
                <Download className="h-5 w-5" />
                <span>Download File</span>
              </button>
            </motion.div>
          )}
          
          {isDownloading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`p-4 ${isDark ? 'bg-yellow-900/20' : 'bg-yellow-100'} rounded-xl border ${isDark ? 'border-yellow-800' : 'border-yellow-200'}`}
            >
              <div className="flex items-center space-x-2 mb-2">
                <RefreshCw className="h-5 w-5 text-yellow-600 dark:text-yellow-400 animate-spin" />
                <p className="font-medium text-yellow-800 dark:text-yellow-400">Processing file for download...</p>
              </div>
              <p className="text-sm text-yellow-700 dark:text-yellow-500 mb-2">
                Estimated time: {processingTime} seconds
              </p>
              <div className={`w-full ${isDark ? 'bg-yellow-800' : 'bg-yellow-200'} rounded-full h-2`}>
                <div className="bg-yellow-500 h-2 rounded-full animate-pulse" style={{ width: '100%' }}></div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default FileShare;