import './index.css'
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Heart, Sparkles, Search, Shield, ShieldOff, 
  TrendingUp, Users, LogOut, Info, AlertCircle, CheckCircle2, UserPlus, Lock
} from 'lucide-react';

// ============================================================================
// 🛠️ MOCK BACKEND & DATABASE SIMULATION
// Dans votre projet final, ceci correspondra à votre serveur Node.js + Base de données (ex: PostgreSQL/MongoDB)
// ============================================================================

const MOCK_DB = {
  users: [
    { id: 'u1', firstName: 'Alice', lastName: 'Dubois', pseudo: 'Lice', password: '123', isPublic: true, selfAura: 5000, finalAura: 5250 },
    { id: 'u2', firstName: 'Marc', lastName: 'Lefebvre', pseudo: 'Marco', password: '123', isPublic: false, selfAura: 500, finalAura: 450 },
    { id: 'u3', firstName: 'Sophie', lastName: 'Martin', pseudo: 'SoSo', password: '123', isPublic: true, selfAura: 15000, finalAura: 14800 },
  ],
  evaluations: [
    { from: 'u2', to: 'u1', value: 5500, timestamp: Date.now() - 100000 },
    { from: 'u1', to: 'u2', value: 400, timestamp: Date.now() - 100000 },
  ]
};

// Simulation d'une API asynchrone avec des délais
const api = {
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  async login(pseudo, password) {
    await this.delay(400);
    const user = MOCK_DB.users.find(u => u.pseudo.toLowerCase() === pseudo.toLowerCase() && u.password === password);
    if (!user) throw new Error("Pseudo ou mot de passe incorrect.");
    return { ...user };
  },

  async register(data) {
    await this.delay(500);
    if (MOCK_DB.users.some(u => u.pseudo.toLowerCase() === data.pseudo.toLowerCase())) {
      throw new Error("Ce pseudo est déjà pris.");
    }
    const newUser = {
      id: 'u' + Math.random().toString(36).substr(2, 9),
      firstName: data.firstName,
      lastName: data.lastName,
      pseudo: data.pseudo,
      password: data.password, // En prod: hasher avec bcrypt
      isPublic: data.isPublic,
      selfAura: data.selfAura,
      finalAura: data.selfAura, // Initialement égale à l'auto-évaluation
    };
    MOCK_DB.users.push(newUser);
    return { ...newUser };
  },

  async getLeaderboard() {
    await this.delay(200);
    return MOCK_DB.users
      .filter(u => u.isPublic) // Seulement les profils publics dans le classement global
      .sort((a, b) => b.finalAura - a.finalAura)
      .slice(0, 100);
  },

  async searchUsers(query) {
    await this.delay(100);
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return MOCK_DB.users.filter(u => 
      u.firstName.toLowerCase().includes(q) || 
      u.lastName.toLowerCase().includes(q) || 
      u.pseudo.toLowerCase().includes(q)
    ).map(u => ({
      id: u.id, firstName: u.firstName, lastName: u.lastName, pseudo: u.pseudo, isPublic: u.isPublic, finalAura: u.isPublic ? u.finalAura : null
    }));
  },

  async getUserProfile(userId, currentUserId) {
    await this.delay(200);
    const user = MOCK_DB.users.find(u => u.id === userId);
    if (!user) throw new Error("Utilisateur introuvable");
    
    const existingEval = MOCK_DB.evaluations.find(e => e.from === currentUserId && e.to === userId);
    
    // On ne renvoie pas selfAura et finalAura si privé (sauf si c'est moi-même)
    const isMe = userId === currentUserId;
    const canSeeAura = user.isPublic || isMe;

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      pseudo: user.pseudo,
      isPublic: user.isPublic,
      finalAura: canSeeAura ? user.finalAura : null,
      myEvaluation: existingEval ? existingEval.value : null,
      lastEvalTimestamp: existingEval ? existingEval.timestamp : null
    };
  },

  async evaluateUser(fromId, toId, value) {
    await this.delay(300);
    const clampedValue = Math.max(-500, Math.min(25000, value));
    
    const existingIndex = MOCK_DB.evaluations.findIndex(e => e.from === fromId && e.to === toId);
    const now = Date.now();

    if (existingIndex !== -1) {
      // SECUTIRY: Rate limiting simulation (ex: 1 modification par jour = 86400000ms)
      // Pour le test, on met la limite à 5 secondes.
      const timeSinceLast = now - MOCK_DB.evaluations[existingIndex].timestamp;
      if (timeSinceLast < 5000) {
         throw new Error(`Veuillez patienter avant de modifier à nouveau cette aura (Anti-spam).`);
      }
      MOCK_DB.evaluations[existingIndex] = { from: fromId, to: toId, value: clampedValue, timestamp: now };
    } else {
      MOCK_DB.evaluations.push({ from: fromId, to: toId, value: clampedValue, timestamp: now });
    }

    // Recalcul de l'Aura Finale
    const targetUser = MOCK_DB.users.find(u => u.id === toId);
    const allReceived = MOCK_DB.evaluations.filter(e => e.to === toId);
    
    let total = targetUser.selfAura;
    allReceived.forEach(e => total += e.value);
    
    const rawAverage = total / (1 + allReceived.length);
    targetUser.finalAura = Math.max(-500, Math.min(25000, Math.round(rawAverage)));

    return targetUser.finalAura;
  },

  async updatePrivacy(userId, isPublic) {
    await this.delay(200);
    const user = MOCK_DB.users.find(u => u.id === userId);
    if(user) user.isPublic = isPublic;
    return isPublic;
  }
};

// ============================================================================
// 🎨 COMPOSANTS UI & FRONTEND REACT
// ============================================================================

const formatAura = (num) => {
  if (num === null || num === undefined) return '???';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

const getAuraColor = (aura) => {
  if (aura === null) return 'text-gray-400';
  if (aura < 0) return 'text-red-500';
  if (aura <= 500) return 'text-blue-500';
  if (aura <= 5000) return 'text-fuchsia-500';
  if (aura <= 15000) return 'text-purple-600';
  return 'text-amber-500 font-bold drop-shadow-sm';
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('auth'); // auth, dashboard, profile, leaderboard
  const [selectedUserId, setSelectedUserId] = useState(null);

  // Navigation handlers
  const goHome = () => setCurrentView('dashboard');
  const goProfile = (id) => { setSelectedUserId(id); setCurrentView('profile'); };
  const goLeaderboard = () => setCurrentView('leaderboard');
  const logout = () => { setCurrentUser(null); setCurrentView('auth'); };

  if (!currentUser) {
    return <AuthScreen onLogin={(user) => { setCurrentUser(user); setCurrentView('dashboard'); }} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-fuchsia-50 via-pink-50 to-purple-100 font-sans text-slate-800">
      {/* Navbar */}
      <nav className="bg-white/70 backdrop-blur-md border-b border-fuchsia-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={goHome}>
            <div className="bg-gradient-to-br from-fuchsia-500 to-purple-600 p-2 rounded-xl shadow-inner">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-600 to-purple-700">
              Aura
            </span>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-4">
            <button onClick={goLeaderboard} className="p-2 text-fuchsia-600 hover:bg-fuchsia-100 rounded-full transition" title="Classement">
              <TrendingUp className="w-5 h-5" />
            </button>
            <button onClick={() => goProfile(currentUser.id)} className="flex items-center space-x-2 bg-white border border-fuchsia-200 px-3 py-1.5 rounded-full hover:shadow-md transition">
              <div className="w-6 h-6 bg-gradient-to-tr from-fuchsia-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                {currentUser.pseudo.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:inline font-medium text-sm">{currentUser.pseudo}</span>
            </button>
            <button onClick={logout} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition" title="Déconnexion">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {currentView === 'dashboard' && <Dashboard onSelectUser={goProfile} currentUser={currentUser} />}
        {currentView === 'profile' && <UserProfile userId={selectedUserId} currentUser={currentUser} onBack={goHome} />}
        {currentView === 'leaderboard' && <Leaderboard onSelectUser={goProfile} />}
      </main>
    </div>
  );
}

// ============================================================================
// SCREENS & VIEWS
// ============================================================================

function AuthScreen({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Form state
  const [form, setForm] = useState({ firstName: '', lastName: '', pseudo: '', password: '', selfAura: 1000, isPublic: true });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      if (isLogin) {
        const user = await api.login(form.pseudo, form.password);
        onLogin(user);
      } else {
        if (!form.firstName || !form.lastName || !form.pseudo || !form.password) {
          throw new Error("Tous les champs obligatoires doivent être remplis.");
        }
        const user = await api.register(form);
        onLogin(user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-purple-200 flex flex-col justify-center items-center p-4">
      <div className="mb-8 text-center">
        <div className="bg-white p-4 rounded-full shadow-xl inline-block mb-4">
          <Sparkles className="w-12 h-12 text-fuchsia-500" />
        </div>
        <h1 className="text-4xl font-extrabold text-purple-900 tracking-tight">Découvrez votre Aura</h1>
        <p className="text-purple-700 mt-2">Le réseau social basé sur la bienveillance et l'énergie.</p>
      </div>

      <div className="bg-white/90 backdrop-blur-xl w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-white/50">
        <div className="flex border-b border-fuchsia-100">
          <button 
            className={`flex-1 py-4 font-semibold text-sm transition ${isLogin ? 'text-fuchsia-600 border-b-2 border-fuchsia-500 bg-fuchsia-50/50' : 'text-slate-500 hover:bg-slate-50'}`}
            onClick={() => { setIsLogin(true); setError(''); }}
          >
            Se Connecter
          </button>
          <button 
            className={`flex-1 py-4 font-semibold text-sm transition ${!isLogin ? 'text-fuchsia-600 border-b-2 border-fuchsia-500 bg-fuchsia-50/50' : 'text-slate-500 hover:bg-slate-50'}`}
            onClick={() => { setIsLogin(false); setError(''); }}
          >
            Créer un compte
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" /> {error}
            </div>
          )}

          {!isLogin && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Prénom</label>
                <input type="text" required value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500 transition outline-none" placeholder="Alice" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nom</label>
                <input type="text" required value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500 transition outline-none" placeholder="Dubois" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Pseudo unique</label>
            <input type="text" required value={form.pseudo} onChange={e => setForm({...form, pseudo: e.target.value})} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500 transition outline-none" placeholder="Ex: RayonDeSoleil99" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Mot de passe / Code PIN</label>
            <input type="password" required value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500 transition outline-none" placeholder="••••••••" />
          </div>

          {!isLogin && (
            <>
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-500 mb-2">Comment évaluez-vous votre propre Aura ?</label>
                <div className="flex items-center space-x-4">
                  <input 
                    type="range" min="-500" max="25000" step="100" 
                    value={form.selfAura} 
                    onChange={e => setForm({...form, selfAura: parseInt(e.target.value)})}
                    className="flex-1 accent-fuchsia-500"
                  />
                  <span className={`font-bold w-16 text-right ${getAuraColor(form.selfAura)}`}>{formatAura(form.selfAura)}</span>
                </div>
              </div>

              <div className="bg-fuchsia-50 p-4 rounded-xl flex items-start space-x-3">
                <input 
                  type="checkbox" 
                  id="privacyToggle"
                  checked={form.isPublic} 
                  onChange={e => setForm({...form, isPublic: e.target.checked})}
                  className="mt-1 w-4 h-4 text-fuchsia-600 rounded focus:ring-fuchsia-500"
                />
                <label htmlFor="privacyToggle" className="text-sm text-slate-700 cursor-pointer">
                  <span className="font-semibold block">Rendre mon Aura publique</span>
                  Si décoché, votre Aura sera privée, mais vous pourrez toujours évaluer et être évalué(e).
                </label>
              </div>
            </>
          )}

          <button 
            disabled={loading}
            type="submit" 
            className="w-full mt-6 bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center"
          >
            {loading ? <Sparkles className="w-5 h-5 animate-spin" /> : (isLogin ? 'Se connecter' : 'Rejoindre l\'Aura')}
          </button>
        </form>
      </div>

      <div className="mt-8 text-center text-sm text-purple-700/70 max-w-sm">
        Application sécurisée • Aucun email requis • Empreinte locale unique (simulation)
      </div>
    </div>
  );
}

function Dashboard({ onSelectUser, currentUser }) {
  return (
    <div className="space-y-6">
      {/* Search Section */}
      <section className="bg-white/80 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-xl border border-white">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
          <Search className="w-6 h-6 mr-3 text-fuchsia-500" />
          Rechercher une personne
        </h2>
        <SearchBar onSelectUser={onSelectUser} />
      </section>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Quick Stats / My Profile Summary */}
        <section className="md:col-span-1 bg-gradient-to-br from-fuchsia-500 to-purple-600 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden group cursor-pointer" onClick={() => onSelectUser(currentUser.id)}>
          <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:scale-110 transition duration-500">
            <Heart className="w-24 h-24" />
          </div>
          <h3 className="text-lg font-medium opacity-90 mb-1">Mon Aura Actuelle</h3>
          <div className="text-5xl font-extrabold mb-4 drop-shadow-md">
             {formatAura(currentUser.finalAura)}
          </div>
          <div className="flex items-center space-x-2 bg-white/20 backdrop-blur-sm w-fit px-3 py-1.5 rounded-full text-sm font-medium">
             {currentUser.isPublic ? <><Shield className="w-4 h-4"/> <span>Publique</span></> : <><ShieldOff className="w-4 h-4"/> <span>Privée</span></>}
          </div>
          <div className="mt-6 text-fuchsia-100 text-sm flex justify-between items-center group-hover:text-white transition">
            Voir mon profil détaillé <TrendingUp className="w-4 h-4" />
          </div>
        </section>

        {/* Tutorial Card */}
        <section className="md:col-span-2 bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-pink-100 flex flex-col justify-center">
          <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
            <Info className="w-5 h-5 mr-2 text-blue-500" />
            Comment ça marche ?
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-3">
               <p className="text-sm text-slate-600 leading-relaxed">
                 L'Aura est l'énergie que vous dégagez. Elle est calculée en faisant la moyenne de votre <b>auto-évaluation</b> et des <b>évaluations reçues</b> par les autres.
               </p>
               <ul className="text-sm text-slate-700 space-y-2">
                 <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-green-500"/> Respect et bienveillance obligatoires.</li>
                 <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-green-500"/> Valeurs entre -500 et 25 000.</li>
               </ul>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl text-sm space-y-2">
               <div className="flex justify-between items-center"><span className="text-red-500 font-medium">-500 à 0</span> <span className="text-slate-500">Négatif / Tendu</span></div>
               <div className="flex justify-between items-center"><span className="text-blue-500 font-medium">0 à 1 000</span> <span className="text-slate-500">Neutre / Sympa</span></div>
               <div className="flex justify-between items-center"><span className="text-fuchsia-500 font-medium">1k à 5 000</span> <span className="text-slate-500">Très apprécié(e)</span></div>
               <div className="flex justify-between items-center"><span className="text-purple-600 font-medium">5k à 15 000</span> <span className="text-slate-500">Rayonnant(e)</span></div>
               <div className="flex justify-between items-center"><span className="text-amber-500 font-bold">15k à 25 000</span> <span className="text-slate-500">Légende absolue</span></div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SearchBar({ onSelectUser }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.trim()) {
        setIsSearching(true);
        const res = await api.searchUsers(query);
        setResults(res);
        setIsSearching(false);
      } else {
        setResults([]);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  return (
    <div className="relative">
      <div className="relative">
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Entrez un nom, prénom ou pseudo (ex: marco, alice...)"
          className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-fuchsia-300 focus:bg-white transition outline-none text-lg shadow-inner"
        />
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-6 h-6" />
      </div>

      {/* Auto-completion Dropdown */}
      {(results.length > 0 || isSearching) && query.trim() !== '' && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-20 max-h-80 overflow-y-auto">
          {isSearching ? (
             <div className="p-4 text-center text-slate-500 text-sm animate-pulse">Recherche en cours...</div>
          ) : results.length > 0 ? (
            <ul className="divide-y divide-slate-50">
              {results.map(u => (
                <li key={u.id}>
                  <button 
                    onClick={() => { setQuery(''); onSelectUser(u.id); }}
                    className="w-full text-left px-6 py-4 hover:bg-fuchsia-50 focus:bg-fuchsia-50 transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-bold text-slate-800">{u.firstName} {u.lastName}</div>
                      <div className="text-sm text-fuchsia-600 font-medium">@{u.pseudo}</div>
                    </div>
                    {u.isPublic ? (
                      <div className={`font-bold text-lg ${getAuraColor(u.finalAura)}`}>{formatAura(u.finalAura)}</div>
                    ) : (
                      <div className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-500 rounded-lg flex items-center">
                        <Lock className="w-3 h-3 mr-1"/> Privée
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center text-slate-500 text-sm">Aucun résultat trouvé pour "{query}"</div>
          )}
        </div>
      )}
    </div>
  );
}

function UserProfile({ userId, currentUser, onBack }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [evalValue, setEvalValue] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' }); // type: 'success' | 'error'

  const isMe = currentUser.id === userId;

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await api.getUserProfile(userId, currentUser.id);
      setProfile(data);
      if (data.myEvaluation !== null) {
        setEvalValue(data.myEvaluation);
      } else {
        setEvalValue(1000); // default suggest
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = async () => {
    setIsSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const newFinalAura = await api.evaluateUser(currentUser.id, userId, evalValue);
      // Update local UI
      setProfile(prev => ({ ...prev, finalAura: prev.isPublic || isMe ? newFinalAura : null, myEvaluation: evalValue }));
      setMessage({ type: 'success', text: "Évaluation enregistrée avec succès !" });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePrivacy = async () => {
    try {
      const newState = !profile.isPublic;
      await api.updatePrivacy(currentUser.id, newState);
      setProfile(prev => ({ ...prev, isPublic: newState }));
      // Update currentUser local context slightly (in a real app we'd use Context/Redux)
      currentUser.isPublic = newState; 
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="text-center py-20 animate-pulse text-fuchsia-500 font-medium">Chargement de l'aura...</div>;
  }
  if (!profile) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={onBack} className="text-slate-500 hover:text-fuchsia-600 font-medium text-sm flex items-center transition mb-4">
        ← Retour
      </button>

      {/* Header Profile Card */}
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        <div className="h-32 bg-gradient-to-r from-fuchsia-400 via-purple-500 to-pink-500"></div>
        <div className="px-8 pb-8 relative">
          <div className="w-24 h-24 bg-white rounded-full border-4 border-white shadow-lg absolute -top-12 flex items-center justify-center text-4xl font-bold bg-gradient-to-tr from-fuchsia-100 to-purple-100 text-fuchsia-600">
            {profile.pseudo.charAt(0).toUpperCase()}
          </div>
          
          <div className="mt-14 flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-800">{profile.firstName} {profile.lastName}</h1>
              <p className="text-fuchsia-600 font-semibold text-lg">@{profile.pseudo}</p>
            </div>
            
            {isMe && (
              <button 
                onClick={handleTogglePrivacy}
                className={`px-4 py-2 rounded-full text-sm font-bold flex items-center transition ${profile.isPublic ? 'bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {profile.isPublic ? <><Shield className="w-4 h-4 mr-2"/> Public</> : <><ShieldOff className="w-4 h-4 mr-2"/> Privé</>}
              </button>
            )}
          </div>

          <div className="mt-8 bg-slate-50 rounded-2xl p-6 flex flex-col items-center justify-center border border-slate-100">
             <span className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Aura Finale</span>
             {profile.isPublic || isMe ? (
               <div className={`text-6xl font-black tracking-tight ${getAuraColor(profile.finalAura)}`}>
                 {formatAura(profile.finalAura)}
               </div>
             ) : (
               <div className="flex flex-col items-center text-slate-400">
                 <Lock className="w-10 h-10 mb-2 opacity-50" />
                 <span className="text-xl font-medium">Aura Privée</span>
                 <span className="text-sm mt-2">Vous pouvez quand même l'évaluer ci-dessous.</span>
               </div>
             )}
          </div>
        </div>
      </div>

      {/* Evaluation Section */}
      {!isMe && (
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-fuchsia-100">
          <h3 className="text-xl font-bold text-slate-800 mb-2">Évaluer l'Aura de {profile.pseudo}</h3>
          <p className="text-sm text-slate-500 mb-8">
            {profile.myEvaluation !== null 
              ? "Vous avez déjà évalué cette personne. Vous pouvez modifier votre estimation (limité pour éviter les abus)." 
              : "Donnez votre estimation honnête et bienveillante."}
          </p>

          {message.text && (
            <div className={`mb-6 p-4 rounded-xl flex items-start text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {message.type === 'error' ? <AlertCircle className="w-5 h-5 mr-2 shrink-0"/> : <CheckCircle2 className="w-5 h-5 mr-2 shrink-0"/>}
              {message.text}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
            <div className="flex-1 w-full relative">
              <input 
                type="range" min="-500" max="25000" step="100" 
                value={evalValue} 
                onChange={e => setEvalValue(parseInt(e.target.value))}
                className="w-full accent-fuchsia-500 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-2 font-medium">
                <span>-500 (Négatif)</span>
                <span>0</span>
                <span>25 000 (Légende)</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4 w-full sm:w-auto">
              <div className={`text-2xl font-black min-w-[100px] text-right ${getAuraColor(evalValue)}`}>
                {formatAura(evalValue)}
              </div>
              <button 
                onClick={handleEvaluate}
                disabled={isSubmitting}
                className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white font-bold py-3 px-6 rounded-xl shadow-md transition disabled:opacity-50 whitespace-nowrap"
              >
                {isSubmitting ? '...' : (profile.myEvaluation !== null ? 'Modifier' : 'Valider')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Leaderboard({ onSelectUser }) {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaders();
  }, []);

  const loadLeaders = async () => {
    const data = await api.getLeaderboard();
    setLeaders(data);
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center mb-8">
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-3 rounded-2xl shadow-lg mr-4">
          <TrendingUp className="w-8 h-8 text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800">Classement Global</h2>
          <p className="text-slate-500 font-medium">Les profils publics rayonnant le plus.</p>
        </div>
      </div>

      {loading ? (
         <div className="space-y-4">
           {[1,2,3].map(i => <div key={i} className="h-20 bg-white/50 animate-pulse rounded-2xl"></div>)}
         </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
          <ul className="divide-y divide-slate-50">
            {leaders.map((user, index) => (
              <li key={user.id}>
                <button 
                  onClick={() => onSelectUser(user.id)}
                  className="w-full flex items-center p-4 sm:p-6 hover:bg-fuchsia-50/50 transition group text-left"
                >
                  {/* Rank Badge */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg mr-4 shrink-0 shadow-sm
                    ${index === 0 ? 'bg-gradient-to-br from-yellow-300 to-amber-500 text-white' : 
                      index === 1 ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-white' : 
                      index === 2 ? 'bg-gradient-to-br from-orange-300 to-red-400 text-white' : 
                      'bg-slate-100 text-slate-500 group-hover:bg-fuchsia-100 group-hover:text-fuchsia-600'}`}
                  >
                    {index + 1}
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1">
                    <div className="font-bold text-slate-800 text-lg group-hover:text-fuchsia-700 transition">
                      {user.firstName} {user.lastName}
                    </div>
                    <div className="text-sm text-slate-500">@{user.pseudo}</div>
                  </div>
                  
                  {/* Aura */}
                  <div className={`text-2xl font-black ${getAuraColor(user.finalAura)}`}>
                    {formatAura(user.finalAura)}
                  </div>
                </button>
              </li>
            ))}
            {leaders.length === 0 && (
              <div className="p-10 text-center text-slate-500">Aucun profil public pour le moment.</div>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}