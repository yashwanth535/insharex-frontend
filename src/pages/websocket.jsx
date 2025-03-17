import { useState, useEffect, useRef } from 'react';

const ws = new WebSocket('ws://localhost:3000');

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
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">P2P File Sharing</h2>
      
      <div className="space-y-4">
        {!peerConnected && (
          <>
            <div className="flex flex-col space-y-2">
              <button 
                onClick={createRoom} 
                className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded transition duration-200"
              >
                Create Room
              </button>
              {roomId && (
                <div className="mt-2 text-sm text-gray-600 bg-gray-100 p-2 rounded border border-gray-200">
                  Room ID: <span className="font-medium">{roomId}</span>
                </div>
              )}
            </div>
            
            <div className="flex space-x-2">
              <input 
                type="text" 
                placeholder="Enter Room Code" 
                value={roomId} 
                onChange={(e) => setRoomId(e.target.value)} 
                className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button 
                onClick={joinRoom} 
                className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded transition duration-200"
              >
                Join Room
              </button>
            </div>
          </>
        )}

        {status && (
          <div className="text-sm p-2 bg-gray-50 rounded border border-gray-200">
            {status}
          </div>
        )}

        {peerConnected && !isReceiver && (
          <div className="mt-6 p-4 border border-gray-200 rounded bg-gray-50">
            <p className="text-sm text-gray-700 mb-2 font-medium">Connected to peer! Share a file:</p>
            <div className="flex flex-col space-y-3">
              <label className="flex items-center justify-center px-4 py-2 bg-white text-blue-500 rounded border border-blue-500 cursor-pointer hover:bg-blue-50 transition">
                <span>Select File</span>
                <input 
                  type="file" 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
              </label>
              {file && (
                <div className="text-sm text-gray-600 mb-2">
                  Selected: {file.name} ({formatFileSize(file.size)})
                </div>
              )}
              <button 
                onClick={sendFile} 
                disabled={!file || (sendProgress > 0 && sendProgress < 100)}
                className={`py-2 px-4 rounded font-medium ${
                  file && !(sendProgress > 0 && sendProgress < 100)
                    ? "bg-blue-500 hover:bg-blue-600 text-white" 
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                } transition duration-200`}
              >
                {sendProgress > 0 && sendProgress < 100 ? `Sending... ${sendProgress}%` : "Send File"}
              </button>
              
              {sendProgress > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${sendProgress}%` }}
                  ></div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {receiveProgress > 0 && isReceiver && (
          <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200">
            <p className="text-sm text-blue-700 mb-2">
              Receiving: {receivingFileName} ({receiveProgress}%)
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${receiveProgress}%` }}
              ></div>
            </div>
          </div>
        )}
        
        {/* Explicitly check multiple conditions to ensure button appears */}
        {(fileReady || receiveProgress === 100) && isReceiver && !isDownloading && (
          <div className="mt-4 p-4 bg-green-50 rounded border border-green-200">
            <p className="text-sm text-green-700 mb-2">
              File received successfully!
            </p>
            <p className="text-xs text-green-600 mb-2">
              {receivingFileName} ({formatFileSize(receivedFileSizeRef.current)})
            </p>
            <button
              onClick={downloadReceivedFile}
              className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded font-medium transition"
            >
              Download File
            </button>
          </div>
        )}
        
        {isDownloading && isReceiver && (
          <div className="mt-4 p-4 bg-yellow-50 rounded border border-yellow-200">
            <p className="text-sm text-yellow-700 mb-2">
              Processing file for download...
            </p>
            <p className="text-xs text-yellow-600">
              Estimated time: {processingTime} seconds
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
              <div className="bg-yellow-400 h-2.5 rounded-full animate-pulse" style={{ width: '100%' }}></div>
            </div>
          </div>
        )}

        {!isReceiver && sendProgress === 100 && (
          <div className="mt-4 p-4 bg-green-50 rounded border border-green-200">
            <p className="text-sm text-green-700 font-medium">
              File sent successfully!
            </p>
          </div>
        )}
        
        {/* Debug info at the bottom - you can remove this in production */}
        <div className="mt-4 p-2 text-xs text-gray-500 border-t border-gray-200">
          Debug: isReceiver: {isReceiver ? 'true' : 'false'}, 
          fileReady: {fileReady ? 'true' : 'false'}, 
          receiveProgress: {receiveProgress}%
        </div>
      </div>
    </div>
  );
};

export default FileShare;