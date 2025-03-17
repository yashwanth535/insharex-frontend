import { useState, useEffect, useRef } from 'react';
import { Upload, Download, FileUp, Users, Send, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const wsurl= import.meta.env.VITE_WEBSOCKET_URL;
const ws = new WebSocket(wsurl);

const FileShare = () => {
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
  const receivedChunksRef = useRef([]);
  const receivedFileSizeRef = useRef(0);
  const totalChunksRef = useRef(0);
  const receivedChunksCountRef = useRef(0);
  const receivedMimeTypeRef = useRef('application/octet-stream');
  const wsRef = useRef(null);
  const fileInputRef = useRef(null);

  // Constants for chunking
  const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

  // Store WebSocket in a ref to ensure it's the same instance throughout
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
    console.log('Creating room...');
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'create-room' }));
      setIsReceiver(false); // Creator is not receiver by default
      setFileReady(false);
      resetFileState();
    } else {
      console.error('WebSocket not connected');
      setStatus('Error: WebSocket not connected. Please refresh the page.');
    }
  };

  const joinRoom = () => {
    console.log('Joining room:', roomId);
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'join-room', roomId }));
      setIsReceiver(true); // Joiner is receiver by default
      setFileReady(false);
      resetFileState();
    } else {
      console.error('WebSocket not connected');
      setStatus('Error: WebSocket not connected. Please refresh the page.');
    }
  };

  const resetFileState = () => {
    setReceiveProgress(0);
    setSendProgress(0);
    setStatus('');
    receivedChunksRef.current = [];
    receivedChunksCountRef.current = 0;
    totalChunksRef.current = 0;
    receivedFileSizeRef.current = 0;
    setFileReady(false);
    console.log('File state reset');
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
      setSendProgress(0);
      setStatus('');
      console.log('File selected:', e.target.files[0].name);
    }
  };

  const sendFile = async () => {
    if (!file || !peerConnected) return;
    console.log('Starting to send file:', file.name);

    // Reset any download state that might be present
    setIsReceiver(false);
    
    // Send file metadata first
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    wsRef.current.send(JSON.stringify({ 
      type: 'file-meta', 
      roomId, 
      fileName: file.name, 
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      totalChunks
    }));
    console.log('Sent file metadata:', file.name, 'totalChunks:', totalChunks);

    // Read and send file in chunks
    const totalSize = file.size;
    let start = 0;
    let chunkIndex = 0;

    while (start < totalSize) {
      const end = Math.min(start + CHUNK_SIZE, totalSize);
      const chunk = file.slice(start, end);
      
      // Read chunk as array buffer
      const buffer = await chunk.arrayBuffer();
      const byteArray = Array.from(new Uint8Array(buffer));
      
      // Send chunk with index
      wsRef.current.send(JSON.stringify({ 
        type: 'file-chunk', 
        roomId, 
        chunk: byteArray,
        chunkIndex,
        totalChunks
      }));
      
      // Update progress
      start = end;
      chunkIndex++;
      const progress = Math.floor((start / totalSize) * 100);
      setSendProgress(progress);
      console.log('Sending chunk', chunkIndex, 'of', totalChunks, 'Progress:', progress + '%');
      
      // Small delay to prevent flooding the connection
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Send completion message
    wsRef.current.send(JSON.stringify({ 
      type: 'file-complete', 
      roomId
    }));
    console.log('File transfer complete, sent completion message');
    
    setStatus('File sent successfully!');
  };

  const downloadReceivedFile = () => {
    console.log('Starting download process...');
    setIsDownloading(true);
    
    // Estimate processing time based on file size (1MB ~ 100ms processing)
    const estimatedTime = Math.max(1, Math.ceil(receivedFileSizeRef.current / (1024 * 1024) * 0.1));
    setProcessingTime(estimatedTime);
    
    setTimeout(() => {
      try {
        console.log('Processing received chunks for download...');
        // Combine all chunks into one Uint8Array
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
        
        // Create blob with the proper MIME type
        const fileBlob = new Blob([combinedArray], { type: receivedMimeTypeRef.current });
        console.log('Created blob of size:', fileBlob.size, 'bytes with type:', receivedMimeTypeRef.current);
        
        // Create download link
        const element = document.createElement('a');
        element.href = URL.createObjectURL(fileBlob);
        element.download = receivingFileName || 'downloaded_file';
        document.body.appendChild(element);
        element.click();
        console.log('Triggered download for file:', element.download);
        
        // Clean up
        setTimeout(() => {
          URL.revokeObjectURL(element.href);
          document.body.removeChild(element);
          console.log('Cleaned up download resources');
        }, 100);
        
        setIsDownloading(false);
        setStatus('File downloaded successfully!');
      } catch (error) {
        console.error('Download error:', error);
        setStatus('Error downloading file: ' + error.message);
        setIsDownloading(false);
      }
    }, estimatedTime * 1000); // Convert seconds to milliseconds
  };

  // Set up WebSocket message handler
  useEffect(() => {
    const handleWebSocketMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WS message received:', data.type, 'isReceiver:', isReceiver);

        if (data.type === 'room-created') {
          setRoomId(data.roomId);
          setStatus('Room created. Share this code with others to join.');
          console.log('Room created with ID:', data.roomId);
        }
        
        if (data.type === 'peer-joined') {
          setPeerConnected(true);
          setStatus('Peer connected! You can now share files.');
          console.log('Peer joined the room');
        }
        
        if (data.type === 'file-meta') {
          console.log('Received file metadata:', data.fileName, 'size:', data.fileSize);
          // Reset for new file
          receivedChunksRef.current = [];
          receivedFileSizeRef.current = data.fileSize;
          totalChunksRef.current = data.totalChunks;
          receivedChunksCountRef.current = 0;
          receivedMimeTypeRef.current = data.mimeType || 'application/octet-stream';
          setReceivingFileName(data.fileName);
          setStatus(`Receiving: ${data.fileName}`);
          setReceiveProgress(0);
          setIsReceiver(true);
          setFileReady(false);
        }
        
        if (data.type === 'file-chunk') {
          // Convert array back to Uint8Array and store in order
          const chunk = new Uint8Array(data.chunk);
          
          // Ensure we have space for this chunk
          while (receivedChunksRef.current.length <= data.chunkIndex) {
            receivedChunksRef.current.push(null);
          }
          
          // Store chunk at its correct position
          receivedChunksRef.current[data.chunkIndex] = chunk;
          
          // Update progress
          receivedChunksCountRef.current++;
          const progress = Math.floor((receivedChunksCountRef.current / data.totalChunks) * 100);
          setReceiveProgress(progress);
          
          // Log occasionally to avoid console flood
          if (data.chunkIndex % 10 === 0 || progress === 100) {
            console.log('Received chunk', data.chunkIndex, 'of', data.totalChunks, 'Progress:', progress + '%');
          }
          
          // If this is the last chunk, mark as ready
          if (progress === 100) {
            console.log('All chunks received, preparing file for download');
            // Remove any null chunks
            receivedChunksRef.current = receivedChunksRef.current.filter(chunk => chunk !== null);
            setStatus('File received successfully! Click to download.');
            setFileReady(true);
          }
        }
        
        if (data.type === 'file-complete') {
          console.log('File complete message received, isReceiver:', isReceiver);
          // Additional check to ensure file is marked as ready
          if (isReceiver) {
            // Remove any null chunks
            receivedChunksRef.current = receivedChunksRef.current.filter(chunk => chunk !== null);
            setStatus('File received successfully! Click to download.');
            setFileReady(true);
            console.log('File marked as ready for download');
          }
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    if (wsRef.current) {
      wsRef.current.onmessage = handleWebSocketMessage;
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.onmessage = null;
      }
    };
  }, [isReceiver]); // Keep isReceiver in the dependency array

  // Debug state changes
  useEffect(() => {
    console.log('State updated - isReceiver:', isReceiver, 'fileReady:', fileReady);
  }, [isReceiver, fileReady]);

  // Helper function to format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    else if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    else return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  // Force the UI to render the download button when all chunks are received
  useEffect(() => {
    if (receiveProgress === 100 && isReceiver) {
      console.log('100% progress detected, ensuring file is marked as ready');
      setFileReady(true);
    }
  }, [receiveProgress, isReceiver]);

  return (
    <div className="max-w-xl mx-auto p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">P2P File Sharing</h2>
        <p className="text-gray-600 dark:text-gray-300 mt-2">Transfer files directly to another device</p>
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
            className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl shadow-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="flex items-center space-x-3 mb-4">
              <Users className="h-6 w-6 text-blue-500 dark:text-blue-400" />
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Create or Join Room</h3>
            </div>
            
            <button 
              onClick={createRoom} 
              className="w-full mb-4 bg-blue-500 hover:bg-blue-600 text-white font-medium py-4 px-6 rounded-xl transition duration-200 flex items-center justify-center space-x-2"
            >
              <Users className="h-5 w-5" />
              <span>Create New Room</span>
            </button>
            
            {roomId && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-4 bg-white dark:bg-gray-700 rounded-xl border border-blue-200 dark:border-blue-800"
              >
                <p className="text-gray-600 dark:text-gray-300 mb-1 text-sm">Share this code with others:</p>
                <div className="text-lg font-mono font-bold text-blue-600 dark:text-blue-400">{roomId}</div>
              </motion.div>
            )}
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Join Existing Room</label>
              <div className="flex space-x-3">
                <input 
                  type="text" 
                  placeholder="Enter Room Code" 
                  value={roomId} 
                  onChange={(e) => setRoomId(e.target.value)} 
                  className="flex-1 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button 
                  onClick={joinRoom} 
                  className="bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-6 rounded-xl transition duration-200"
                >
                  Join
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {peerConnected && !isReceiver && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl shadow-sm"
        >
          <div className="flex items-center space-x-3 mb-4">
            <Upload className="h-6 w-6 text-blue-500 dark:text-blue-400" />
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Send File</h3>
          </div>
          
          <div className="space-y-4">
            <div 
              onClick={() => fileInputRef.current.click()}
              className="relative border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-xl p-6 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-800/20 transition duration-200 flex flex-col items-center justify-center"
            >
              <FileUp className="h-10 w-10 text-blue-400 dark:text-blue-500 mb-2" />
              <p className="text-blue-600 dark:text-blue-400 font-medium">Select a file to share</p>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Click to browse your files</p>
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
                className="flex items-center p-4 bg-white dark:bg-gray-700 rounded-xl border border-blue-200 dark:border-blue-800"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-800 dark:text-white">{file.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{formatFileSize(file.size)}</p>
                </div>
              </motion.div>
            )}
            
            <motion.button 
              onClick={sendFile} 
              disabled={!file || (sendProgress > 0 && sendProgress < 100)}
              className={`w-full py-4 px-6 rounded-xl font-medium flex items-center justify-center space-x-2 transition-all
                ${file && !(sendProgress > 0 && sendProgress < 100) 
                  ? "bg-blue-500 hover:bg-blue-600 text-white" 
                  : "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"}`}
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
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
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
          className="mt-6 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl shadow-sm"
        >
          <div className="flex items-center space-x-3 mb-4">
            <Download className="h-6 w-6 text-green-500 dark:text-green-400" />
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Receive File</h3>
          </div>
          
          {receiveProgress > 0 && !fileReady && (
            <motion.div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-700 dark:text-gray-300">Receiving: {receivingFileName}</span>
                <span className="font-medium text-blue-600 dark:text-blue-400">{receiveProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${receiveProgress}%` }}
                ></div>
              </div>
            </motion.div>
          )}
          
          {(fileReady || receiveProgress === 100) && !isDownloading && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 bg-green-100 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 mb-4"
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
              className="p-4 bg-yellow-100 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800"
            >
              <div className="flex items-center space-x-2 mb-2">
                <RefreshCw className="h-5 w-5 text-yellow-600 dark:text-yellow-400 animate-spin" />
                <p className="font-medium text-yellow-800 dark:text-yellow-400">Processing file for download...</p>
              </div>
              <p className="text-sm text-yellow-700 dark:text-yellow-500 mb-2">
                Estimated time: {processingTime} seconds
              </p>
              <div className="w-full bg-yellow-200 dark:bg-yellow-800 rounded-full h-2">
                <div className="bg-yellow-500 h-2 rounded-full animate-pulse" style={{ width: '100%' }}></div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
      
      {!isReceiver && sendProgress === 100 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-4 bg-green-100 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800"
        >
          <p className="text-green-800 dark:text-green-400 font-medium flex items-center">
            <span className="mr-2">✓</span> File sent successfully!
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default FileShare;