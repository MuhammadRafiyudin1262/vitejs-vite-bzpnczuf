import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';

const supabaseUrl = 'https://hywxxciwropklyjvwlph.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5d3h4Y2l3cm9wa2x5anZ3bHBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NDEwMTQsImV4cCI6MjA5OTIxNzAxNH0.BMBqJJ3_3wnE05PwKigqdS3YUbxc47SYP14HshPhO7k';

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

export default function App() {
  const [currentView, setCurrentView] = useState('login');
  const [activeTeam, setActiveTeam] = useState(null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4">
      <div className="max-w-md mx-auto">
        {currentView === 'login' && <LoginScreen setActiveTeam={setActiveTeam} setCurrentView={setCurrentView} />}
        {currentView === 'admin' && <AdminDashboard setCurrentView={setCurrentView} />}
        {currentView === 'team_dashboard' && activeTeam && <TeamDashboard team={activeTeam} setCurrentView={setCurrentView} />}
      </div>
    </div>
  );
}

function LoginScreen({ setActiveTeam, setCurrentView }) {
  const handleLogin = async (e) => {
    e.preventDefault();
    const { code, pass } = e.target.elements;
    if (code.value.toUpperCase() === 'ADMIN') { setCurrentView('admin'); return; }
    const data = await supabaseRequest(`teams?team_code=eq.${code.value.toUpperCase()}&select=*`);
    if (data?.length > 0 && data[0].password_hash === pass.value) { setActiveTeam(data[0]); setCurrentView('team_dashboard'); }
    else alert("Kode atau Password salah!");
  };
  return (
    <form onSubmit={handleLogin} className="mt-20 p-8 bg-slate-900 rounded-2xl shadow-xl">
      <h1 className="text-2xl font-bold mb-6 text-center text-emerald-400">OMC Mencari Wahana</h1>
      <input name="code" className="w-full bg-slate-950 p-3 mb-4 rounded border border-slate-700" placeholder="Kode Tim" required />
      <input name="pass" type="password" className="w-full bg-slate-950 p-3 mb-6 rounded border border-slate-700" placeholder="Password" required />
      <button className="w-full bg-emerald-600 py-3 rounded font-bold">MASUK</button>
    </form>
  );
}

function AdminDashboard({ setCurrentView }) {
  const [teams, setTeams] = useState([]);
  useEffect(() => { supabaseRequest('teams?select=*').then(setTeams); }, []);
  return (
    <div className="p-4 bg-slate-900 rounded-2xl shadow-xl">
      <h1 className="text-2xl font-bold mb-4">Dashboard Admin</h1>
      {teams.map(t => <div key={t.id} className="bg-slate-800 p-3 mb-2 rounded">{t.name} - Misi ke-{t.progress_index + 1}</div>)}
      <button onClick={() => setCurrentView('login')} className="w-full bg-slate-800 py-3 mt-4 rounded">Logout</button>
    </div>
  );
}

function TeamDashboard({ team, setCurrentView }) {
  const [mission, setMission] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    supabaseRequest(`missions?team_id=eq.${team.id}&select=*`).then(m => {
        setMission(m.find(mi => mi.order_index === team.progress_index) || null);
    });
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
        await uploadPhoto(file, team.id);
        await supabaseRequest(`teams?id=eq.${team.id}`, 'PATCH', { progress_index: team.progress_index + 1 });
        confetti();
        alert("Foto terupload!");
    } catch (e) { alert("Error upload"); } finally { setUploading(false); }
  };

  return (
    <div className="bg-slate-900 p-6 rounded-2xl shadow-xl">
      <h2 className="text-xl font-bold mb-4">{team.name}</h2>
      {mission ? (
        <div>
          <p className="mb-4">{mission.question}</p>
          <input className="w-full p-2 mb-2 bg-slate-800 rounded" value={userAnswer} onChange={e => setUserAnswer(e.target.value)} />
          <button onClick={() => userAnswer.toLowerCase() === mission.answer.toLowerCase() ? alert("Benar!") : alert("Salah!")} className="w-full bg-emerald-600 py-2 mb-2 rounded font-bold">CEK</button>
          <label className="block w-full text-center py-2 bg-blue-600 rounded cursor-pointer">
             {uploading ? '...' : 'UPLOAD FOTO BUKTI'}
             <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleUpload} />
          </label>
        </div>
      ) : <p>Menunggu misi...</p>}
      <button onClick={() => setCurrentView('login')} className="w-full bg-slate-800 py-3 mt-8 rounded">Logout</button>
    </div>
  );
    }
