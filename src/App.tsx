import React, { useState, useEffect } from 'react';

const supabaseUrl = 'https://hywxxciwropklyjvwlph.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5d3h4Y2l3cm9wa2x5anZ3bHBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NDEwMTQsImV4cCI6MjA5OTIxNzAxNH0.BMBqJJ3_3wnE05PwKigqdS3YUbxc47SYP14HshPhO7k';

const playSound = (type) => {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const playNote = (freq, duration, start, type = 'sine', volume = 0.3) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = freq;
    osc.start(start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.stop(start + duration);
  };
  const now = audioCtx.currentTime;

  if (type === 'correct') {
    playNote(523.25, 0.15, now, 'sine', 0.4);
    playNote(659.25, 0.15, now + 0.15, 'sine', 0.4);
    playNote(783.99, 0.15, now + 0.3, 'sine', 0.4);
    playNote(1046.50, 0.5, now + 0.45, 'triangle', 0.5);
  } else if (type === 'wrong') {
    playNote(150, 0.5, now, 'sawtooth', 0.5);
    playNote(120, 0.5, now + 0.1, 'sawtooth', 0.5);
  } else if (type === 'start') {
    playNote(440, 0.3, now);
    playNote(554.37, 0.3, now + 0.3);
    playNote(659.25, 0.5, now + 0.6);
  }
};

const supabaseRequest = async (path, method = 'GET', body = null) => {
  const options = {
    method,
    headers: { 'apikey': supabaseAnonKey, 'Authorization': `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' }
  };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, options);
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
};

const uploadPhoto = async (file, teamId) => {
  const fileName = `${teamId}-${Date.now()}.jpg`;
  const response = await fetch(`${supabaseUrl}/storage/v1/object/mission-photos/${fileName}`, {
    method: 'POST',
    headers: { 'apikey': supabaseAnonKey, 'Authorization': `Bearer ${supabaseAnonKey}`, 'Content-Type': file.type },
    body: file
  });
  if (!response.ok) throw new Error("Gagal upload");
  const url = `${supabaseUrl}/storage/v1/object/public/mission-photos/${fileName}`;
  await supabaseRequest('photos', 'POST', { team_id: teamId, url });
  return url;
};

const Timer = ({ startTime, status, endTime }) => {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (endTime) {
      setSeconds(Math.floor((new Date(endTime) - new Date(startTime)) / 1000));
      return;
    }
    if (status !== 'playing' || !startTime) return;
    const interval = setInterval(() => {
      setSeconds(Math.floor((new Date() - new Date(startTime)) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, status, endTime]);
  return <span className="text-emerald-400 font-mono font-bold text-lg">{endTime ? `${seconds}s (STOP)` : status === 'waiting' ? 'WAITING' : `${seconds}s`}</span>;
};

const PhotoGrid = ({ photos }) => (
  <div className="grid grid-cols-3 gap-2">
    {photos.map(p => (
      <div key={p.id} className="aspect-square overflow-hidden rounded-lg bg-slate-800 border border-slate-700">
        <img src={p.url} className="w-full h-full object-cover" alt="Foto Misi" />
      </div>
    ))}
  </div>
);

const renderContent = (text) => {
  if (typeof text !== 'string') return null;
  const isImage = text.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) || text.includes('supabase.co/storage');
  if (isImage) {
    return <img src={text} alt="Misi" className="w-full h-auto max-h-[400px] object-contain rounded-lg border border-slate-700 bg-black" />;
  }
  return <p className="text-lg bg-slate-800 p-4 rounded-lg">{text}</p>;
};

export default function App() {
  const [currentView, setCurrentView] = useState('login');
  const [activeTeam, setActiveTeam] = useState(null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 font-sans">
      <div className="max-w-md mx-auto">
        {currentView === 'login' && <LoginScreen setActiveTeam={setActiveTeam} setCurrentView={setCurrentView} />}
        {currentView === 'admin' && <AdminDashboard setCurrentView={setCurrentView} />}
        {currentView === 'team_dashboard' && activeTeam && <TeamDashboard team={activeTeam} setCurrentView={setCurrentView} />}
      </div>
    </div>
  );
}

function AdminDashboard({ setCurrentView }) {
  const [teams, setTeams] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [message, setMessage] = useState('');

  const refreshData = async () => {
    try {
      const t = await supabaseRequest('teams?select=*');
      const p = await supabaseRequest('photos?select=*');
      const sortedTeams = t.sort((a, b) => {
        if (a.status === 'finished' && b.status !== 'finished') return -1;
        if (a.status !== 'finished' && b.status === 'finished') return 1;
        if (b.progress_index !== a.progress_index) return b.progress_index - a.progress_index;
        return (a.end_time ? new Date(a.end_time) - new Date(a.start_time) : 0) - (b.end_time ? new Date(b.end_time) - new Date(b.start_time) : 0);
      });
      setTeams(sortedTeams);
      setPhotos(p);
    } catch (err) { console.error(err); }
  };

  const startAll = async () => {
    const now = new Date().toISOString();
    for (let t of teams) {
      await supabaseRequest(`teams?id=eq.${t.id}`, 'PATCH', { status: 'playing', start_time: now, progress_index: 0, end_time: null });
    }
    playSound('start');
    refreshData();
    setMessage("Permainan dimulai!");
    setTimeout(() => setMessage(''), 3000);
  };

  const stopAll = async () => {
    const now = new Date().toISOString();
    for (let t of teams) {
      if (t.status === 'playing') {
        await supabaseRequest(`teams?id=eq.${t.id}`, 'PATCH', { end_time: now });
      }
    }
    refreshData();
    setMessage("Permainan dihentikan untuk semua tim.");
    setTimeout(() => setMessage(''), 3000);
  };

  const resetAll = async () => {
    for (let t of teams) {
      await supabaseRequest(`teams?id=eq.${t.id}`, 'PATCH', { status: 'waiting', start_time: null, end_time: null, progress_index: 0 });
    }
    refreshData();
    setMessage("Semua tim direset!");
    setTimeout(() => setMessage(''), 3000);
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 bg-slate-900 rounded-2xl shadow-xl">
      <h1 className="text-2xl font-bold mb-1 text-emerald-400">OMC Mencari Wahana</h1>
      <p className="text-slate-400 mb-6 font-medium">Dashboard Admin</p>
      {message && <div className="bg-emerald-900 text-emerald-200 p-3 rounded mb-4 text-center">{message}</div>}
      
      <div className="grid grid-cols-2 gap-2 mb-8">
        <button onClick={startAll} className="bg-red-600 py-4 rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg">MULAI</button>
        <button onClick={stopAll} className="bg-rose-600 py-4 rounded-xl font-bold hover:bg-rose-700 transition-colors shadow-lg">STOP</button>
        <button onClick={resetAll} className="col-span-2 bg-amber-600 py-4 rounded-xl font-bold hover:bg-amber-700 transition-colors shadow-lg">RESET TIM</button>
      </div>
      
      <div className="space-y-3 mb-8">
        {teams.map(t => {
            const duration = t.end_time ? Math.floor((new Date(t.end_time) - new Date(t.start_time)) / 1000) : null;
            return (
              <div key={t.id} className={`bg-slate-800 p-4 rounded-lg ${t.status === 'finished' ? 'border-2 border-emerald-500' : t.end_time ? 'border border-rose-500' : ''}`}>
                <div className="flex justify-between items-center mb-1">
                    <p className="font-bold">{t.name}</p>
                    <Timer startTime={t.start_time} status={t.status} endTime={t.end_time} />
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                    <span>{t.status === 'finished' ? `✅ Selesai (Misi ke-${t.progress_index + 1})` : t.end_time ? `🛑 Berhenti (Misi ke-${t.progress_index + 1})` : `Progres: Misi ke-${t.progress_index + 1}`}</span>
                    {duration !== null && !isNaN(duration) && <span>Waktu: {duration} detik</span>}
                </div>
              </div>
            );
        })}
      </div>
      <h2 className="text-xl font-bold mb-4">Galeri Global</h2>
      <PhotoGrid photos={photos} />
      <button onClick={() => setCurrentView('login')} className="mt-8 bg-slate-800 w-full py-3 rounded font-bold hover:bg-slate-700">Logout</button>
    </div>
  );
}

function TeamDashboard({ team, setCurrentView }) {
  const [mission, setMission] = useState(null);
  const [localTeam, setLocalTeam] = useState(team);
  const [userAnswer, setUserAnswer] = useState('');
  const [isCorrect, setIsCorrect] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [allTeams, setAllTeams] = useState([]);

  const triggerCelebration = () => {
    if (!document.getElementById('confetti-script')) {
      const s = document.createElement('script');
      s.id = 'confetti-script';
      s.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js';
      document.head.appendChild(s);
    }
    
    const audio = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
    audio.loop = true;
    audio.play().catch(e => console.log('Audio blocked', e));
    
    const duration = 180 * 1000;
    const end = Date.now() + duration;
    
    const frame = () => {
      if (Date.now() > end) {
        audio.pause();
        return;
      }
      if (window.confetti) {
        window.confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 } });
        window.confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 } });
      }
      requestAnimationFrame(frame);
    };
    frame();
  };

  const fetchData = async () => {
    try {
        const tData = await supabaseRequest(`teams?id=eq.${team.id}&select=*`);
        const mData = await supabaseRequest(`missions?team_id=eq.${team.id}&select=*`);
        const pData = await supabaseRequest('photos?select=*');
        const allT = await supabaseRequest(`teams?select=*`);
        
        if (tData.length > 0) setLocalTeam(tData[0]);
        setGalleryPhotos(pData);
        setAllTeams(allT);
        
        const active = mData.find(m => m.order_index === tData[0].progress_index);
        setMission(active || null);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchData(); const interval = setInterval(fetchData, 3000); return () => clearInterval(interval); }, []);

  const getRank = () => {
    const finished = allTeams.filter(t => t.status === 'finished' && t.start_time && t.end_time);
    const sorted = finished.sort((a,b) => (new Date(a.end_time) - new Date(a.start_time)) - (new Date(b.end_time) - new Date(b.start_time)));
    const idx = sorted.findIndex(t => t.id === localTeam.id);
    return idx !== -1 ? idx + 1 : null;
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
        await uploadPhoto(file, team.id);
        const nextIndex = (localTeam.progress_index || 0) + 1;
        const mData = await supabaseRequest(`missions?team_id=eq.${team.id}&select=*`);
        
        if (nextIndex >= mData.length) {
            triggerCelebration(); 
            await supabaseRequest(`teams?id=eq.${team.id}`, 'PATCH', { status: 'finished', end_time: new Date().toISOString() });
        } else {
            playSound('correct');
            await supabaseRequest(`teams?id=eq.${team.id}`, 'PATCH', { progress_index: nextIndex });
        }
        setIsCorrect(false);
        setUserAnswer('');
        fetchData();
    } catch (err) {
        setErrorMsg("Gagal mengunggah foto.");
    } finally {
        setUploading(false);
    }
  };

  const handleCheck = () => {
      if (userAnswer.toLowerCase() === mission.answer.toLowerCase()) {
          playSound('correct');
          setIsCorrect(true);
          setErrorMsg('');
      } else {
          playSound('wrong');
          setErrorMsg("❌ Jawaban Salah!");
      }
  };

  const rank = getRank();

  return (
    <div className="bg-slate-900 p-6 rounded-2xl shadow-2xl">
      <h1 className="text-xl font-bold text-emerald-400 mb-1">OMC Mencari Wahana</h1>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">{localTeam.name}</h2>
        <Timer startTime={localTeam.start_time} status={localTeam.status} endTime={localTeam.end_time} />
      </div>
      
      {localTeam.end_time ? (
        <div className="text-center py-10 bg-slate-800 rounded-xl space-y-2">
          <h2 className="text-3xl font-bold text-emerald-400 mb-2">{localTeam.status === 'finished' ? 'MENANG!' : 'WAKTU HABIS'}</h2>
          <p className="text-slate-300">Selamat! Misi selesai.</p>
          {rank && <div className="text-xl font-bold bg-emerald-900 text-emerald-100 p-3 rounded-lg mx-auto inline-block">Peringkat: #{rank}</div>}
        </div>
      ) : localTeam.status === 'waiting' ? (
         <div className="text-center py-10 bg-slate-800 rounded-xl">
            <p className="text-slate-400">⏳ Menunggu instruksi admin...</p>
         </div>
      ) : mission ? (
        <div className="space-y-4">
          {renderContent(mission.question)}
          {!isCorrect ? (
            <div className="flex flex-col gap-3">
              <input className="w-full p-3 bg-slate-950 rounded border border-slate-700" value={userAnswer} onChange={e => setUserAnswer(e.target.value)} placeholder="Jawaban..." />
              {errorMsg && <p className="text-red-500 font-bold text-center text-sm">{errorMsg}</p>}
              <button onClick={handleCheck} className="w-full bg-emerald-600 py-3 rounded font-bold">CEK</button>
            </div>
          ) : (
            <label className="block w-full py-3 text-center rounded bg-blue-600 cursor-pointer font-bold">
                {uploading ? '...' : 'UPLOAD FOTO BUKTI'}
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  className="hidden" 
                  onChange={handleUpload} 
                  disabled={uploading} 
                />
            </label>
          )}
        </div>
      ) : <p className="text-center italic text-slate-500">Menunggu Misi...</p>}

      <div className="mt-8 border-t border-slate-700 pt-6">
        <h3 className="text-lg font-bold mb-4">Galeri Misi Publik</h3>
        <PhotoGrid photos={galleryPhotos} />
      </div>
      
      <button onClick={() => setCurrentView('login')} className="mt-8 bg-slate-800 w-full py-3 rounded font-bold">Logout</button>
    </div>
  );
}

function LoginScreen({ setActiveTeam, setCurrentView }) {
  const [error, setError] = useState('');
  const handleLogin = async (e) => {
    e.preventDefault();
    const { code, pass } = e.target.elements;
    if (code.value.toUpperCase() === 'ADMIN') { setCurrentView('admin'); return; }
    const data = await supabaseRequest(`teams?team_code=eq.${code.value.toUpperCase()}&select=*`);
    if (data?.length > 0 && data[0].password_hash === pass.value) { setActiveTeam(data[0]); setCurrentView('team_dashboard'); }
    else setError("Kode atau Password salah!");
  };
  return (
    <form onSubmit={handleLogin} className="mt-20 p-8 bg-slate-900 rounded-2xl shadow-xl">
      <h1 className="text-2xl font-bold mb-6 text-center text-emerald-400">OMC Mencari Wahana</h1>
      {error && <div className="text-red-500 mb-4 text-center">{error}</div>}
      <input name="code" className="w-full bg-slate-950 p-3 mb-4 rounded border border-slate-700" placeholder="Kode Tim" required />
      <input name="pass" type="password" className="w-full bg-slate-950 p-3 mb-6 rounded border border-slate-700" placeholder="Password" required />
      <button className="w-full bg-emerald-600 py-3 rounded font-bold">MASUK</button>
    </form>
  );
  }  if (!response.ok) throw new Error("Gagal upload");
  const url = `${supabaseUrl}/storage/v1/object/public/mission-photos/${fileName}`;
  await supabaseRequest('photos', 'POST', { team_id: teamId, url });
  return url;
};

const Timer = ({ startTime, status, endTime }) => {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (endTime) {
      setSeconds(Math.floor((new Date(endTime) - new Date(startTime)) / 1000));
      return;
    }
    if (status !== 'playing' || !startTime) return;
    const interval = setInterval(() => {
      setSeconds(Math.floor((new Date() - new Date(startTime)) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, status, endTime]);
  return <span className="text-emerald-400 font-mono font-bold text-lg">{endTime ? `${seconds}s (STOP)` : status === 'waiting' ? 'WAITING' : `${seconds}s`}</span>;
};

const PhotoGrid = ({ photos }) => (
  <div className="grid grid-cols-3 gap-2">
    {photos.map(p => (
      <div key={p.id} className="aspect-square overflow-hidden rounded-lg bg-slate-800 border border-slate-700">
        <img src={p.url} className="w-full h-full object-cover" alt="Foto Misi" />
      </div>
    ))}
  </div>
);

const renderContent = (text) => {
  if (typeof text !== 'string') return null;
  const isImage = text.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) || text.includes('supabase.co/storage');
  if (isImage) {
    return <img src={text} alt="Misi" className="w-full h-auto max-h-[400px] object-contain rounded-lg border border-slate-700 bg-black" />;
  }
  return <p className="text-lg bg-slate-800 p-4 rounded-lg">{text}</p>;
};

export default function App() {
  const [currentView, setCurrentView] = useState('login');
  const [activeTeam, setActiveTeam] = useState(null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 font-sans">
      <div className="max-w-md mx-auto">
        {currentView === 'login' && <LoginScreen setActiveTeam={setActiveTeam} setCurrentView={setCurrentView} />}
        {currentView === 'admin' && <AdminDashboard setCurrentView={setCurrentView} />}
        {currentView === 'team_dashboard' && activeTeam && <TeamDashboard team={activeTeam} setCurrentView={setCurrentView} />}
      </div>
    </div>
  );
}

function AdminDashboard({ setCurrentView }) {
  const [teams, setTeams] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [message, setMessage] = useState('');

  const refreshData = async () => {
    try {
      const t = await supabaseRequest('teams?select=*');
      const p = await supabaseRequest('photos?select=*');
      const sortedTeams = t.sort((a, b) => {
        if (a.status === 'finished' && b.status !== 'finished') return -1;
        if (a.status !== 'finished' && b.status === 'finished') return 1;
        if (b.progress_index !== a.progress_index) return b.progress_index - a.progress_index;
        return (a.end_time ? new Date(a.end_time) - new Date(a.start_time) : 0) - (b.end_time ? new Date(b.end_time) - new Date(b.start_time) : 0);
      });
      setTeams(sortedTeams);
      setPhotos(p);
    } catch (err) { console.error(err); }
  };

  const startAll = async () => {
    const now = new Date().toISOString();
    for (let t of teams) {
      await supabaseRequest(`teams?id=eq.${t.id}`, 'PATCH', { status: 'playing', start_time: now, progress_index: 0, end_time: null });
    }
    playSound('start');
    refreshData();
    setMessage("Permainan dimulai!");
    setTimeout(() => setMessage(''), 3000);
  };

  const stopAll = async () => {
    const now = new Date().toISOString();
    for (let t of teams) {
      if (t.status === 'playing') {
        await supabaseRequest(`teams?id=eq.${t.id}`, 'PATCH', { end_time: now });
      }
    }
    refreshData();
    setMessage("Permainan dihentikan untuk semua tim.");
    setTimeout(() => setMessage(''), 3000);
  };

  const resetAll = async () => {
    for (let t of teams) {
      await supabaseRequest(`teams?id=eq.${t.id}`, 'PATCH', { status: 'waiting', start_time: null, end_time: null, progress_index: 0 });
    }
    refreshData();
    setMessage("Semua tim direset!");
    setTimeout(() => setMessage(''), 3000);
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 bg-slate-900 rounded-2xl shadow-xl">
      <h1 className="text-2xl font-bold mb-1 text-emerald-400">OMC Mencari Wahana</h1>
      <p className="text-slate-400 mb-6 font-medium">Dashboard Admin</p>
      {message && <div className="bg-emerald-900 text-emerald-200 p-3 rounded mb-4 text-center">{message}</div>}
      
      <div className="grid grid-cols-2 gap-2 mb-8">
        <button onClick={startAll} className="bg-red-600 py-4 rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg">MULAI</button>
        <button onClick={stopAll} className="bg-rose-600 py-4 rounded-xl font-bold hover:bg-rose-700 transition-colors shadow-lg">STOP</button>
        <button onClick={resetAll} className="col-span-2 bg-amber-600 py-4 rounded-xl font-bold hover:bg-amber-700 transition-colors shadow-lg">RESET TIM</button>
      </div>
      
      <div className="space-y-3 mb-8">
        {teams.map(t => {
            const duration = t.end_time ? Math.floor((new Date(t.end_time) - new Date(t.start_time)) / 1000) : null;
            return (
              <div key={t.id} className={`bg-slate-800 p-4 rounded-lg ${t.status === 'finished' ? 'border-2 border-emerald-500' : t.end_time ? 'border border-rose-500' : ''}`}>
                <div className="flex justify-between items-center mb-1">
                    <p className="font-bold">{t.name}</p>
                    <Timer startTime={t.start_time} status={t.status} endTime={t.end_time} />
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                    <span>{t.status === 'finished' ? `✅ Selesai (Misi ke-${t.progress_index + 1})` : t.end_time ? `🛑 Berhenti (Misi ke-${t.progress_index + 1})` : `Progres: Misi ke-${t.progress_index + 1}`}</span>
                    {duration !== null && !isNaN(duration) && <span>Waktu: {duration} detik</span>}
                </div>
              </div>
            );
        })}
      </div>
      <h2 className="text-xl font-bold mb-4">Galeri Global</h2>
      <PhotoGrid photos={photos} />
      <button onClick={() => setCurrentView('login')} className="mt-8 bg-slate-800 w-full py-3 rounded font-bold hover:bg-slate-700">Logout</button>
    </div>
  );
}

function TeamDashboard({ team, setCurrentView }) {
  const [mission, setMission] = useState(null);
  const [localTeam, setLocalTeam] = useState(team);
  const [userAnswer, setUserAnswer] = useState('');
  const [isCorrect, setIsCorrect] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [allTeams, setAllTeams] = useState([]);

  const triggerCelebration = () => {
    if (!document.getElementById('confetti-script')) {
      const s = document.createElement('script');
      s.id = 'confetti-script';
      s.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js';
      document.head.appendChild(s);
    }
    
    const audio = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
    audio.loop = true;
    audio.play().catch(e => console.log('Audio blocked', e));
    
    const duration = 180 * 1000;
    const end = Date.now() + duration;
    
    const frame = () => {
      if (Date.now() > end) {
        audio.pause();
        return;
      }
      if (window.confetti) {
        window.confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 } });
        window.confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 } });
      }
      requestAnimationFrame(frame);
    };
    frame();
  };

  const fetchData = async () => {
    try {
        const tData = await supabaseRequest(`teams?id=eq.${team.id}&select=*`);
        const mData = await supabaseRequest(`missions?team_id=eq.${team.id}&select=*`);
        const pData = await supabaseRequest('photos?select=*');
        const allT = await supabaseRequest(`teams?select=*`);
        
        if (tData.length > 0) setLocalTeam(tData[0]);
        setGalleryPhotos(pData);
        setAllTeams(allT);
        
        const active = mData.find(m => m.order_index === tData[0].progress_index);
        setMission(active || null);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchData(); const interval = setInterval(fetchData, 3000); return () => clearInterval(interval); }, []);

  const getRank = () => {
    const finished = allTeams.filter(t => t.status === 'finished' && t.start_time && t.end_time);
    const sorted = finished.sort((a,b) => (new Date(a.end_time) - new Date(a.start_time)) - (new Date(b.end_time) - new Date(b.start_time)));
    const idx = sorted.findIndex(t => t.id === localTeam.id);
    return idx !== -1 ? idx + 1 : null;
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
        await uploadPhoto(file, team.id);
        const nextIndex = (localTeam.progress_index || 0) + 1;
        const mData = await supabaseRequest(`missions?team_id=eq.${team.id}&select=*`);
        
        if (nextIndex >= mData.length) {
            triggerCelebration(); 
            await supabaseRequest(`teams?id=eq.${team.id}`, 'PATCH', { status: 'finished', end_time: new Date().toISOString() });
        } else {
            playSound('correct');
            await supabaseRequest(`teams?id=eq.${team.id}`, 'PATCH', { progress_index: nextIndex });
        }
        setIsCorrect(false);
        setUserAnswer('');
        fetchData();
    } catch (err) {
        setErrorMsg("Gagal mengunggah foto.");
    } finally {
        setUploading(false);
    }
  };

  const handleCheck = () => {
      if (userAnswer.toLowerCase() === mission.answer.toLowerCase()) {
          playSound('correct');
          setIsCorrect(true);
          setErrorMsg('');
      } else {
          playSound('wrong');
          setErrorMsg("❌ Jawaban Salah!");
      }
  };

  const rank = getRank();

  return (
    <div className="bg-slate-900 p-6 rounded-2xl shadow-2xl">
      <h1 className="text-xl font-bold text-emerald-400 mb-1">OMC Mencari Wahana</h1>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">{localTeam.name}</h2>
        <Timer startTime={localTeam.start_time} status={localTeam.status} endTime={localTeam.end_time} />
      </div>
      
      {localTeam.end_time ? (
        <div className="text-center py-10 bg-slate-800 rounded-xl space-y-2">
          <h2 className="text-3xl font-bold text-emerald-400 mb-2">{localTeam.status === 'finished' ? 'MENANG!' : 'WAKTU HABIS'}</h2>
          <p className="text-slate-300">Selamat! Misi selesai.</p>
          {rank && <div className="text-xl font-bold bg-emerald-900 text-emerald-100 p-3 rounded-lg mx-auto inline-block">Peringkat: #{rank}</div>}
        </div>
      ) : localTeam.status === 'waiting' ? (
         <div className="text-center py-10 bg-slate-800 rounded-xl">
            <p className="text-slate-400">⏳ Menunggu instruksi admin...</p>
         </div>
      ) : mission ? (
        <div className="space-y-4">
          {renderContent(mission.question)}
          {!isCorrect ? (
            <div className="flex flex-col gap-3">
              <input className="w-full p-3 bg-slate-950 rounded border border-slate-700" value={userAnswer} onChange={e => setUserAnswer(e.target.value)} placeholder="Jawaban..." />
              {errorMsg && <p className="text-red-500 font-bold text-center text-sm">{errorMsg}</p>}
              <button onClick={handleCheck} className="w-full bg-emerald-600 py-3 rounded font-bold">CEK</button>
            </div>
          ) : (
            <label className="block w-full py-3 text-center rounded bg-blue-600 cursor-pointer font-bold">
                {uploading ? '...' : 'UPLOAD FOTO BUKTI'}
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  className="hidden" 
                  onChange={handleUpload} 
                  disabled={uploading} 
                />
            </label>
          )}
        </div>
      ) : <p className="text-center italic text-slate-500">Menunggu Misi...</p>}

      <div className="mt-8 border-t border-slate-700 pt-6">
        <h3 className="text-lg font-bold mb-4">Galeri Misi Publik</h3>
        <PhotoGrid photos={galleryPhotos} />
      </div>
      
      <button onClick={() => setCurrentView('login')} className="mt-8 bg-slate-800 w-full py-3 rounded font-bold">Logout</button>
    </div>
  );
}

function LoginScreen({ setActiveTeam, setCurrentView }) {
  const [error, setError] = useState('');
  const handleLogin = async (e) => {
    e.preventDefault();
    const { code, pass } = e.target.elements;
    if (code.value.toUpperCase() === 'ADMIN') { setCurrentView('admin'); return; }
    const data = await supabaseRequest(`teams?team_code=eq.${code.value.toUpperCase()}&select=*`);
    if (data?.length > 0 && data[0].password_hash === pass.value) { setActiveTeam(data[0]); setCurrentView('team_dashboard'); }
    else setError("Kode atau Password salah!");
  };
  return (
    <form onSubmit={handleLogin} className="mt-20 p-8 bg-slate-900 rounded-2xl shadow-xl">
      <h1 className="text-2xl font-bold mb-6 text-center text-emerald-400">OMC Mencari Wahana</h1>
      {error && <div className="text-red-500 mb-4 text-center">{error}</div>}
      <input name="code" className="w-full bg-slate-950 p-3 mb-4 rounded border border-slate-700" placeholder="Kode Tim" required />
      <input name="pass" type="password" className="w-full bg-slate-950 p-3 mb-6 rounded border border-slate-700" placeholder="Password" required />
      <button className="w-full bg-emerald-600 py-3 rounded font-bold">MASUK</button>
    </form>
  );
}
