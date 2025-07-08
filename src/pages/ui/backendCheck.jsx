import React, { useEffect, useState } from 'react';

const BackendStatusCheck = () => {
  const [status, setStatus] = useState('checking');
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);

  // Use your .env variable or hardcode for local testing
  const backendUrl = import.meta.env.VITE_WEBSOCKET_URL_HTTP;

  useEffect(() => {
    const checkBackend = async () => {
      console.log("called");
      try {
        const res = await fetch(`${backendUrl}/api/ping`);
        console.log("fetched");
        const data = await res.json();
        console.log(data);
        if (res.ok && data.status === 'ok') {
          setInfo(data);
          setStatus('connected');
        } else {
          setInfo(data);
          setStatus('offline');
        }
      } catch (err) {
        setError(err.message || 'Unknown error');
        setStatus('offline');
      }
    };

    checkBackend();
  }, [backendUrl]);

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <h1 className="text-2xl font-bold text-green-400 mb-4">🛰️ Kriya WebSocket Server Status</h1>

      <p className="mb-4 text-sm text-gray-400">Ping URL: <a href={`${backendUrl}/api/ping`} className="underline text-blue-400" target="_blank" rel="noreferrer">{`${backendUrl}/api/ping`}</a></p>

      {status === 'checking' && (
        <p className="text-gray-300">⏳ Checking server status...</p>
      )}

      {status === 'connected' && info && (
        <div className="text-green-300">
          <p className="font-semibold mb-2">✅ Server is live and responding!</p>
          <pre className="bg-gray-800 text-sm rounded p-4 text-green-200">
            {JSON.stringify(info, null, 2)}
          </pre>
        </div>
      )}

      {status === 'offline' && (
        <div className="text-red-400">
          <p className="font-semibold mb-2">❌ Server is offline or unreachable.</p>
          {info && (
            <pre className="bg-gray-800 text-sm rounded p-4 text-red-200">
              {JSON.stringify(info, null, 2)}
            </pre>
          )}
          {error && (
            <p className="text-sm mt-2">Error: <span className="bg-gray-900 px-2 py-1 rounded">{error}</span></p>
          )}
        </div>
      )}
    </div>
  );
};

export default BackendStatusCheck;
