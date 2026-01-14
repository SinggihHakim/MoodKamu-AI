import { useState, useEffect, useRef } from 'react';

export default function Home() {
  // --- UI & THEME STATE ---
  const [darkMode, setDarkMode] = useState(true);
  const [status, setStatus] = useState('Disconnected');
  
  // --- DATA STATE ---
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  
  // --- CAMERA & CALIBRATION STATE ---
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [isCalibrating, setIsCalibrating] = useState(false);

  // --- REFS ---
  const videoRef = useRef(null);
  const wsRef = useRef(null);
  const workerRef = useRef(null);
  const intervalRef = useRef(null);
  const streamRef = useRef(null);

  // 1. SETUP DARK MODE
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.background = 'radial-linear(circle at top right, #0f172a, #020617)';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.background = 'radial-linear(circle at top right, #f8fafc, #e2e8f0)';
    }
  }, [darkMode]);

  // 2. INIT SYSTEM
  useEffect(() => {
    workerRef.current = new Worker('/worker.js');
    workerRef.current.onmessage = (e) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(e.data);
      }
    };

    getObtainCameras();
    connectWebSocket();

    return () => {
      clearInterval(intervalRef.current);
      stopCameraStream();
      if (wsRef.current) wsRef.current.close();
      if (workerRef.current) workerRef.current.terminate();
    };
  }, []);

  // 3. CAMERA LOGIC
  const getObtainCameras = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);
      if (videoDevices.length > 0) {
         setSelectedDeviceId(videoDevices[0].deviceId);
         startCamera(videoDevices[0].deviceId);
      }
    } catch (err) { console.error("Camera Error:", err); }
  };

  const stopCameraStream = () => { 
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop()); 
  };
  
  const startCamera = async (deviceId) => {
    stopCameraStream();
    try {
      const constraints = { 
        video: { 
          deviceId: deviceId ? { exact: deviceId } : undefined, 
          width: 640, 
          height: 480 
        } 
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => { 
          videoRef.current.play(); 
          clearInterval(intervalRef.current); 
          startSendingFrames(); 
        };
      }
    } catch (err) { 
      alert("Tidak dapat mengakses kamera. Pastikan izin kamera sudah diberikan."); 
    }
  };
  
  const handleDeviceChange = (e) => { 
    setSelectedDeviceId(e.target.value); 
    startCamera(e.target.value); 
  };

  // 4. WEBSOCKET LOGIC
  const connectWebSocket = () => {
    const socket = new WebSocket("ws://127.0.0.1:8001/ws");
    wsRef.current = socket;
    wsRef.current.onopen = () => setStatus('Connected');
    wsRef.current.onclose = () => { 
      setStatus('Reconnecting...'); 
      setTimeout(connectWebSocket, 3000); 
    };
    wsRef.current.onmessage = (event) => {
      const jsonData = JSON.parse(event.data);
      setData(jsonData);
      
      if (jsonData.mood === "Calibrating...") setIsCalibrating(true);
      else {
        setIsCalibrating(false);
        if(jsonData.mood && jsonData.mood !== "Searching..." && jsonData.mood !== "Calibrating...") {
          setHistory(prev => {
            if (prev.length > 0 && prev[prev.length - 1].mood === jsonData.mood && prev.length < 15) return prev;
            
            const newHist = [...prev, { 
              mood: jsonData.mood, 
              score: jsonData.score, 
              time: new Date().toLocaleTimeString('id-ID', {
                hour: '2-digit', 
                minute:'2-digit', 
                second:'2-digit'
              }) 
            }];
            return newHist.slice(-8);
          });
        }
      }
    };
  };

  const startSendingFrames = () => {
    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.paused) return;
      const imageBitmap = await createImageBitmap(videoRef.current);
      workerRef.current.postMessage({ imageBitmap: imageBitmap, width: 320, height: 240 }, [imageBitmap]);
    }, 200);
  };

  const handleCalibrate = () => { 
    if (wsRef.current) wsRef.current.send(JSON.stringify({ action: 'calibrate' })); 
  };

  // --- UI HELPERS ---
  const getMoodColor = (mood) => {
    const colors = {
      'Happy': 'from-emerald-400 to-green-500',
      'Sad': 'from-blue-400 to-cyan-500',
      'Angry / Serious': 'from-rose-500 to-red-600',
      'Surprised': 'from-purple-400 to-pink-500',
      'Focused': 'from-teal-400 to-emerald-500',
      'Distracted': 'from-amber-400 to-orange-500',
      'Exhausted': 'from-gray-500 to-slate-600',
      'Calibrating...': 'from-violet-500 to-purple-600',
      'default': 'from-slate-400 to-gray-500'
    };
    return colors[mood] || colors['default'];
  };

  const getMoodIcon = (mood) => {
    const icons = {
      'Happy': '💫',
      'Sad': '🌧️',
      'Angry / Serious': '⚡',
      'Surprised': '🎯',
      'Focused': '🎯',
      'Distracted': '🌀',
      'Exhausted': '🌙',
      'default': '✨'
    };
    return icons[mood] || icons['default'];
  };

  const getStatusColor = (status) => {
    return status === 'Connected' 
      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
      : 'bg-rose-500/20 text-rose-400 border-rose-500/30';
  };

  return (
    <div className="min-h-screen p-6 font-sans bg-linear-to-br from-slate-50 via-blue-50/30 to-cyan-50/20 dark:from-slate-900 dark:via-blue-900/20 dark:to-cyan-900/10">
      
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 bg-linear-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <div className="w-6 h-6 border-2 border-white/80 rounded-lg transform rotate-12" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-500 to-purple-600">
                MoodKamu 
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Analisis Emosi Real-time dengan Kecerdasan Buatan
              </p>
            </div>
          </div>

          {/* USER PROFILE BADGE */}
          {data?.user_profile && (
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="inline-flex items-center gap-2 bg-white/80 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl text-sm text-gray-700 dark:text-gray-300 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                {data.user_profile.gender === 'Male' ? 'Pria' : data.user_profile.gender === 'Female' ? 'Wanita' : 'Mendeteksi...'}
              </span>
              <span className="inline-flex items-center gap-2 bg-white/80 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl text-sm text-gray-700 dark:text-gray-300 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Usia: {data.user_profile.age || '...'}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white/80 dark:bg-slate-800/80 p-4 rounded-2xl shadow-lg backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50">
          <select 
            value={selectedDeviceId} 
            onChange={handleDeviceChange} 
            className="text-sm p-2 rounded-xl bg-gray-100/50 dark:bg-slate-700/50 border-none outline-none text-gray-700 dark:text-gray-200 max-w-[180px] truncate focus:ring-2 focus:ring-blue-500/50"
          >
            {devices.map((device, key) => (
              <option key={key} value={device.deviceId}>
                {device.label || `Kamera ${key + 1}`}
              </option>
            ))}
          </select>
          
          <button 
            onClick={handleCalibrate} 
            disabled={isCalibrating}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all transform hover:scale-105 ${
              isCalibrating 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-linear-to-r from-blue-500 to-purple-600 hover:shadow-lg shadow-blue-500/25'
            }`}
          >
            {isCalibrating ? '🔄 Memindai...' : '🎯 Kalibrasi'}
          </button>
          
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border backdrop-blur-sm ${getStatusColor(status)}`}>
            <div className={`w-2 h-2 rounded-full ${status === 'Connected' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            <span className="text-sm font-medium">{status}</span>
          </div>
          
          <button 
            onClick={() => setDarkMode(!darkMode)} 
            className="p-2.5 bg-gray-200/70 dark:bg-slate-700/70 rounded-xl hover:bg-gray-300/70 dark:hover:bg-slate-600/70 transition-all duration-300"
          >
            {darkMode ? (
              <div className="w-5 h-5 bg-linear-to-br from-amber-400 to-orange-500 rounded-full" />
            ) : (
              <div className="w-5 h-5 bg-linear-to-br from-slate-600 to-gray-800 rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* KOLOM KIRI (2/3): VIDEO & METRICS UTAMA */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* VIDEO CONTAINER */}
          <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white/20 dark:border-slate-700/50 aspect-video bg-black group backdrop-blur-lg">
            <video 
              ref={videoRef} 
              className="w-full h-full object-cover transform scale-x-[-1]" 
              muted 
              playsInline 
            />
            
            {/* OVERLAYS PERINGATAN */}
            {data?.features?.blink_dur > 0.4 && (
              <div className="absolute inset-0 bg-rose-500/40 flex items-center justify-center z-30 animate-pulse pointer-events-none backdrop-blur-sm">
                <div className="text-center">
                  <div className="text-6xl mb-4">⚠️</div>
                  <h1 className="text-white font-black text-3xl drop-shadow-lg">MICROSLEEP TERDETEKSI!</h1>
                  <p className="text-white/90 text-lg mt-2">Istirahat sejenak disarankan</p>
                </div>
              </div>
            )}
            
            {(data?.features?.gaze_ratio < 0.35 || data?.features?.gaze_ratio > 0.65) && (
              <div className="absolute bottom-4 right-4 bg-amber-500/90 text-white px-4 py-2 rounded-xl text-sm font-bold animate-pulse z-10 shadow-lg border border-amber-400/50">
                ⚠️ KONSENTRASI TURUN
              </div>
            )}

            {/* OVERLAY KALIBRASI */}
            {isCalibrating && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white z-20 backdrop-blur-sm">
                <div className="relative mb-6">
                  <div className="w-20 h-20 border-4 border-blue-400/50 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 border-4 border-blue-400 rounded-full animate-ping" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-2">Kalibrasi Wajah</h3>
                <p className="text-gray-300 mb-4 text-center max-w-md">
                  Tatap kamera dengan ekspresi netral dan tetap diam selama proses kalibrasi
                </p>
                <div className="w-2/3 bg-gray-700 h-3 rounded-full overflow-hidden border border-gray-600">
                  <div 
                    className="bg-linear-to-r from-blue-500 to-purple-500 h-full transition-all duration-300 ease-out" 
                    style={{width: `${data?.score || 0}%`}}
                  />
                </div>
              </div>
            )}
            
            <div className="absolute bottom-4 left-4 bg-black/60 text-white px-3 py-1.5 rounded-xl backdrop-blur-md text-xs font-mono border border-white/10">
              FPS: 5 | Resolusi: 320x240
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* MOOD BOOSTER CARD */}
            <div className={`rounded-3xl p-6 text-white border-none shadow-xl transform transition duration-500 hover:scale-[1.02] bg-linear-to-br ${getMoodColor(data?.mood)}`}>
              <div className="flex justify-between items-start mb-6">
                <h3 className="font-bold text-lg opacity-90 drop-shadow-md">Status Emosi</h3>
                <div className="bg-white/20 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm border border-white/10">
                  AI Analysis
                </div>
              </div>
              
              <div className="text-center py-4">
                <div className="text-6xl mb-4 filter drop-shadow-lg animate-float">
                  {getMoodIcon(data?.mood)}
                </div>
                <p className="text-2xl font-bold drop-shadow-md mb-2">
                  {data?.mood === 'Happy' ? "Tetap Bersinar! ✨" :
                   data?.mood === 'Sad' ? "Semangat! 💪" :
                   data?.mood === 'Angry / Serious' ? "Tenang dulu... 🌊" :
                   data?.mood === 'Exhausted' ? "Waktu istirahat 😴" :
                   data?.mood === 'Surprised' ? "Wah! Terkejut? 🎉" :
                   data?.mood === 'Focused' ? "Fokus Mantap! 🎯" :
                   "Tetap Semangat! 💫"}
                </p>
                <p className="text-white/80 text-sm">
                  {data?.conclusion || "Sistem sedang menganalisis ekspresi Anda..."}
                </p>
              </div>
            </div>

            {/* ADVANCED METRICS CARD */}
            <div className="bg-white/80 dark:bg-slate-800/80 rounded-3xl p-6 border border-gray-200/50 dark:border-slate-700/50 shadow-xl backdrop-blur-sm">
              <h3 className="text-lg font-semibold mb-6 text-gray-800 dark:text-gray-200 flex justify-between items-center">
                <span>Metrik Lanjutan</span>
                <span className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full border border-blue-500/20">
                  Real-time
                </span>
              </h3>
              
              <div className="space-y-5">
                 {/* GAZE VISUALIZER */}
                 <div className="bg-linear-to-br from-gray-50 to-gray-100 dark:from-slate-700/50 dark:to-slate-800/50 p-4 rounded-2xl border border-gray-200/50 dark:border-slate-600/50 relative h-16 flex items-center justify-between px-4">
                    <p className="text-xs text-gray-600 dark:text-gray-400 uppercase font-bold tracking-wider w-16">Pandangan</p>
                    
                    <div className="flex gap-6">
                      <div className="w-10 h-6 bg-linear-to-b from-gray-300 to-gray-400 dark:from-slate-600 dark:to-slate-700 rounded-full relative overflow-hidden border border-gray-300 dark:border-slate-600">
                        <div 
                          className="w-4 h-4 bg-linear-to-br from-blue-500 to-purple-600 rounded-full absolute top-1/2 transition-all duration-200 ease-out shadow-lg"
                          style={{ 
                            left: `${(data?.features?.gaze_ratio || 0.5) * 100}%`,
                            transform: 'translate(-50%, -50%)' 
                          }}
                        />
                      </div>
                      <div className="w-10 h-6 bg-linear-to-b from-gray-300 to-gray-400 dark:from-slate-600 dark:to-slate-700 rounded-full relative overflow-hidden border border-gray-300 dark:border-slate-600">
                        <div 
                          className="w-4 h-4 bg-linear-to-br from-blue-500 to-purple-600 rounded-full absolute top-1/2 transition-all duration-200 ease-out shadow-lg"
                          style={{ 
                            left: `${(data?.features?.gaze_ratio || 0.5) * 100}%`,
                            transform: 'translate(-50%, -50%)' 
                          }}
                        />
                      </div>
                    </div>
                    
                    <div className={`text-sm font-bold px-3 py-1.5 rounded-lg ${
                      data?.features?.gaze_ratio < 0.35 || data?.features?.gaze_ratio > 0.65 
                        ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30" 
                        : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                    }`}>
                      {data?.features?.gaze_ratio < 0.35 || data?.features?.gaze_ratio > 0.65 ? "TERALIHKAN" : "TERFOKUS"}
                    </div>
                 </div>

                 {/* METRIC GRID */}
                 <div className="grid grid-cols-2 gap-3">
                    <div className="bg-linear-to-br from-gray-50 to-gray-100 dark:from-slate-700/50 dark:to-slate-800/50 p-4 rounded-2xl text-center border border-gray-200/50 dark:border-slate-600/50">
                      <p className="text-xs text-gray-600 dark:text-gray-400 uppercase mb-2 tracking-wider">Durasi Kedip</p>
                      <p className={`font-mono font-bold text-xl ${
                        data?.features?.blink_dur > 0.4 
                          ? 'text-rose-500 animate-pulse' 
                          : 'text-emerald-500'
                      }`}>
                        {(data?.features?.blink_dur || 0).toFixed(1)}s
                      </p>
                      {data?.features?.blink_dur > 0.4 && (
                        <p className="text-[10px] text-rose-500 font-bold mt-1">MICROSLEEP!</p>
                      )}
                    </div>
                    
                    <div className="bg-linear-to-br from-gray-50 to-gray-100 dark:from-slate-700/50 dark:to-slate-800/50 p-4 rounded-2xl text-center border border-gray-200/50 dark:border-slate-600/50">
                      <p className="text-xs text-gray-600 dark:text-gray-400 uppercase mb-2 tracking-wider">Kelelahan Mata</p>
                      <p className={`font-bold text-xl ${
                        data?.features?.relative_drop > 0.2 
                          ? 'text-amber-500' 
                          : 'text-blue-500'
                      }`}>
                        {Math.round((data?.features?.relative_drop || 0) * 100)}%
                      </p>
                    </div>
                 </div>

                 {/* DISTANCE INDICATOR */}
                 <div>
                   <div className="flex justify-between text-sm mb-2 text-gray-600 dark:text-gray-400">
                     <span>Jarak Optimal</span>
                     <span className={`font-semibold ${
                       data?.features?.face_width > 210 
                         ? 'text-rose-500' 
                         : 'text-emerald-500'
                     }`}>
                       {data?.features?.face_width > 210 ? 'TERLALU DEKAT' : 'IDEAL'}
                     </span>
                   </div>
                   <div className="w-full bg-linear-to-r from-gray-200 to-gray-300 dark:from-slate-700 dark:to-slate-600 rounded-full h-2.5 overflow-hidden">
                     <div 
                       className={`h-2.5 rounded-full transition-all duration-500 ${
                         data?.features?.face_width > 210 
                           ? 'bg-linear-to-r from-rose-500 to-pink-600' 
                           : 'bg-linear-to-r from-emerald-500 to-cyan-600'
                       }`} 
                       style={{width: `${Math.min((data?.features?.face_width / 320) * 100, 100)}%`}}
                     />
                   </div>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* KOLOM KANAN (1/3): STATUS UTAMA */}
        <div className="space-y-6">
          
          {/* BIG STATUS CARD */}
          <div className="bg-linear-to-br from-slate-800 to-gray-900 rounded-3xl p-8 text-center border border-slate-700/50 shadow-2xl min-h-[280px] flex flex-col justify-center items-center">
            <h2 className="text-gray-400 uppercase tracking-widest text-xs mb-4 font-medium">Emosi Terdeteksi</h2>
            <div className={`text-5xl font-black mb-6 transition-all duration-500 bg-linear-to-r ${getMoodColor(data?.mood)} bg-clip-text text-transparent`}>
              {data?.mood || "Menganalisis..."}
            </div>
            <p className="text-gray-400 text-sm px-4 mb-6 leading-relaxed italic">
              "{data?.conclusion || "Menunggu deteksi wajah..."}"
            </p>
            
            {/* SCORE BAR */}
            {data?.score !== undefined && !isCalibrating && (
              <div className="w-4/5 bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-linear-to-r from-blue-500 to-purple-500 h-2.5 rounded-full transition-all duration-700 ease-out" 
                  style={{ width: `${data.score}%` }} 
                />
              </div>
            )}
          </div>
          
          {/* RECOMMENDATIONS LIST */}
          <div className="bg-linear-to-br from-blue-50 to-cyan-50 dark:from-blue-900/10 dark:to-cyan-900/10 rounded-3xl p-6 border border-blue-200/50 dark:border-blue-700/30 shadow-xl">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-3 text-blue-700 dark:text-blue-400">
              <div className="w-8 h-8 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full" />
              </div>
              Saran AI
            </h3>
            <ul className="space-y-3">
              {data?.recommendations?.map((rec, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-blue-800 dark:text-blue-300">
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  </div>
                  <span className="leading-relaxed">{rec}</span>
                </li>
              ))}
              {!data?.recommendations && (
                <li className="text-blue-600/70 dark:text-blue-400/70 text-sm italic py-2 text-center">
                  Menunggu analisis untuk saran...
                </li>
              )}
            </ul>
          </div>
          
          {/* HISTORY LIST */}
          <div className="bg-white/80 dark:bg-slate-800/80 rounded-3xl p-6 border border-gray-200/50 dark:border-slate-700/50 shadow-xl max-h-80 overflow-hidden flex flex-col backdrop-blur-sm">
            <h3 className="text-xs font-semibold mb-4 text-gray-500 dark:text-gray-400 uppercase tracking-wider flex justify-between items-center sticky top-0 bg-white/80 dark:bg-slate-800/80 pb-2 z-10 backdrop-blur-sm">
              <span>Riwayat Emosi</span>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            </h3>
            
            <div className="space-y-3 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-slate-600 flex-grow pr-2">
              {history.slice().reverse().map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-slate-700/50 pb-3 last:border-0 last:pb-0 group hover:bg-gray-50/50 dark:hover:bg-slate-700/50 p-2 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full bg-linear-to-r ${getMoodColor(item.mood)}`} />
                    <span className={`font-semibold ${getMoodColor(item.mood).replace('from-', 'text-').split(' ')[0]}`}>
                      {item.mood}
                    </span>
                  </div>
                  <span className="text-gray-400 dark:text-gray-500 font-mono text-xs bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded">
                    {item.time}
                  </span>
                </div>
              ))}
              
              {history.length === 0 && (
                <div className="text-center text-gray-400 dark:text-gray-500 text-sm py-8">
                  Belum ada riwayat emosi
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}