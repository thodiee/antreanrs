import React, { useEffect, useState } from 'react';
import { socket } from './services/socket';

import KioskView from './components/KioskView';
import TvDisplayView from './components/TvDisplayView';
import OfficerConsoleView from './components/OfficerConsoleView';
import AdminDashboardView from './components/AdminDashboardView';
import LoginForm from './components/LoginForm';

import { Ticket, Tv, UserCheck, LayoutDashboard, ExternalLink, LogOut, ShieldCheck, User } from 'lucide-react';
import './styles/index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ maxWidth: '600px', margin: '4rem auto', padding: '2rem', background: '#fff', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid #fee2e2' }}>
          <h2 style={{ color: '#dc2626', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Terjadi Kesalahan Tampilan
          </h2>
          <p style={{ color: '#475569', marginBottom: '1rem', lineHeight: '1.6' }}>
            Sistem mendeteksi kendala pada antarmuka. Silakan muat ulang halaman atau bersihkan sesi login.
          </p>
          <pre style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#b91c1c', fontSize: '0.8rem', overflowX: 'auto', marginBottom: '1.5rem' }}>
            {this.state.error?.toString()}
          </pre>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => window.location.reload()}
              style={{ background: '#15803d', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
            >
              Muat Ulang Halaman
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('antrean_user');
                window.location.href = '/';
              }}
              style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '10px 18px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
            >
              Reset Sesi & Ke Halaman Utama
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [currentView, setCurrentView] = useState('kiosk'); // kiosk, tv, officer, admin
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('antrean_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [data, setData] = useState({
    hospital: null,
    clinics: [],
    counters: [],
    tickets: [],
    history: []
  });
  const [connected, setConnected] = useState(false);
  const [lastCall, setLastCall] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    if (viewParam && ['kiosk', 'tv', 'officer', 'admin'].includes(viewParam)) {
      setCurrentView(viewParam);
    }

    function onConnect() {
      setConnected(true);
    }

    function onDisconnect() {
      setConnected(false);
    }

    function onStateSync(syncData) {
      setData(syncData);
    }

    function onTicketCreated({ ticket }) {
      setData(prev => ({
        ...prev,
        tickets: [...prev.tickets.filter(t => t.id !== ticket.id), ticket]
      }));
    }

    function onTicketCalled({ ticket, timestamp }) {
      setLastCall({ ticket, timestamp });
      setData(prev => ({
        ...prev,
        tickets: prev.tickets.map(t => t.id === ticket.id ? { ...t, ...ticket } : t)
      }));
    }

    function onTicketRecalled({ ticket, timestamp }) {
      setLastCall({ ticket, timestamp });
    }

    function onTicketSkipped({ ticket }) {
      setData(prev => ({
        ...prev,
        tickets: prev.tickets.map(t => t.id === ticket.id ? { ...t, ...ticket } : t)
      }));
    }

    function onTicketCompleted({ ticket }) {
      setData(prev => ({
        ...prev,
        tickets: prev.tickets.map(t => t.id === ticket.id ? { ...t, ...ticket } : t)
      }));
    }

    function onSettingsUpdated({ hospital, clinics, counters }) {
      setData(prev => ({
        ...prev,
        hospital: hospital || prev.hospital,
        clinics: clinics || prev.clinics,
        counters: counters || prev.counters
      }));
    }

    function onShiftReset(newDb) {
      if (newDb) setData(newDb);
      setLastCall(null);
    }

    function onDayChanged({ date }) {
      console.log('[AntreanRS] Day changed detected:', date);
      setLastCall(null);
      fetch('/api/initial-state')
        .then(res => res.json())
        .then(resData => setData(resData))
        .catch(err => console.warn('Fetch state on day change warning:', err));
    }

    function onVideoReady({ id, localUrl }) {
      console.log('[AntreanRS] Video lokal siap diputar di TV:', id, localUrl);
      setData(prev => {
        if (!prev.hospital?.videoList) return prev;
        const updatedList = prev.hospital.videoList.map(v =>
          v.id === id ? { ...v, localUrl } : v
        );
        return {
          ...prev,
          hospital: {
            ...prev.hospital,
            videoList: updatedList
          }
        };
      });
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('state_sync', onStateSync);
    socket.on('ticket_created', onTicketCreated);
    socket.on('ticket_called', onTicketCalled);
    socket.on('ticket_recalled', onTicketRecalled);
    socket.on('ticket_skipped', onTicketSkipped);
    socket.on('ticket_completed', onTicketCompleted);
    socket.on('settings_updated', onSettingsUpdated);
    socket.on('shift_reset', onShiftReset);
    socket.on('day_changed', onDayChanged);
    socket.on('video_ready', onVideoReady);

    fetch('/api/initial-state')
      .then(res => res.json())
      .then(resData => setData(resData))
      .catch(err => console.warn('Fetch initial state warning:', err));

    // Client-side date rollover detection (e.g. at 00:00 midnight)
    let lastDate = new Date().toLocaleDateString('en-CA');
    const midnightTimer = setInterval(() => {
      const currentDate = new Date().toLocaleDateString('en-CA');
      if (currentDate !== lastDate) {
        lastDate = currentDate;
        console.log('[AntreanRS] Client detected midnight day change, refreshing queue state...');
        setLastCall(null);
        fetch('/api/initial-state')
          .then(res => res.json())
          .then(resData => setData(resData))
          .catch(() => {});
      }
    }, 15000);

    return () => {
      clearInterval(midnightTimer);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('state_sync', onStateSync);
      socket.off('ticket_created', onTicketCreated);
      socket.off('ticket_called', onTicketCalled);
      socket.off('ticket_recalled', onTicketRecalled);
      socket.off('ticket_skipped', onTicketSkipped);
      socket.off('ticket_completed', onTicketCompleted);
      socket.off('settings_updated', onSettingsUpdated);
      socket.off('shift_reset', onShiftReset);
      socket.off('day_changed', onDayChanged);
      socket.off('video_ready', onVideoReady);
    };
  }, []);

  // Update browser document.title and favicon dynamically to match the hospital created by admin
  useEffect(() => {
    const hospitalName = data.hospital?.name?.trim();
    if (hospitalName) {
      document.title = `Sistem Antrean Poliklinik Cerdas - ${hospitalName}`;
      try {
        localStorage.setItem('antrean_hospital_name', hospitalName);
      } catch (e) {}
    } else {
      document.title = 'Sistem Antrean Poliklinik Cerdas';
    }

    if (data.hospital?.logo) {
      const favicon = document.querySelector("link[rel*='icon']");
      if (favicon) {
        favicon.href = data.hospital.logo;
      }
    }
  }, [data.hospital?.name, data.hospital?.logo]);

  const handleLoginSuccess = (userObj) => {
    setCurrentUser(userObj);
    localStorage.setItem('antrean_user', JSON.stringify(userObj));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('antrean_user');
  };

  const handleTakeTicket = (payload, callback) => {
    const reqData = typeof payload === 'string' ? { clinicId: payload } : payload;
    socket.emit('create_ticket', reqData, callback);
  };

  const handleCallTicket = (payload, callback) => {
    socket.emit('call_ticket', payload, callback);
  };

  const handleRecallTicket = (payload, callback) => {
    socket.emit('recall_ticket', payload, callback);
  };

  const handleSkipTicket = (payload, callback) => {
    socket.emit('skip_ticket', payload, callback);
  };

  const handleCompleteTicket = (payload, callback) => {
    socket.emit('complete_ticket', payload, callback);
  };

  const handleUpdateSettings = (payload, callback) => {
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(resData => {
        if (callback) callback(resData);
      })
      .catch(err => {
        console.warn('REST settings update warning, fallback to socket:', err);
        socket.emit('update_settings', payload, callback);
      });
  };

  const handleResetShift = (callback) => {
    fetch('/api/reset-shift', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
      .then(res => res.json())
      .then(resData => {
        if (resData.state) {
          setData(resData.state);
          setLastCall(null);
        }
        if (callback) callback(resData);
      })
      .catch(err => {
        console.warn('REST reset shift warning, fallback to socket:', err);
        socket.emit('reset_shift', {}, (socketRes) => {
          if (callback) callback(socketRes);
        });
      });
  };

  const openInNewTab = (viewName) => {
    window.open(`/?view=${viewName}`, '_blank');
  };

  // Auth Guard Verification
  const isKioskAuthorized = currentUser && (currentUser.role === 'PENDAFTARAN' || currentUser.role === 'ADMIN');
  const isOfficerAuthorized = currentUser && (
    currentUser.role === 'POLIKLINIK' || 
    currentUser.role === 'FARMASI' || 
    currentUser.role === 'OFFICER' || 
    currentUser.role === 'ADMIN'
  );
  const isAdminAuthorized = currentUser && currentUser.role === 'ADMIN';

  return (
    <div>
      {/* Top Bar for View Switching & User Profile */}
      <header className="top-nav">
        <div className="top-nav-row">
          <div className="brand">
            <div className="brand-logo" style={{ overflow: 'hidden', padding: data.hospital?.logo ? '2px' : '0' }}>
              {data.hospital?.logo ? (
                <img src={data.hospital.logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                'RS'
              )}
            </div>
            <div className="brand-text">
              <h1>{data.hospital?.name || 'Sistem Antrean Poliklinik'}</h1>
              <p>Sistem Antrean Cerdas 4 Layar (P0)</p>
            </div>
          </div>

          <div className="nav-actions">
            <button
              className="btn-open-tab"
              onClick={() => openInNewTab(currentView)}
              title="Buka tampilan ini di jendela/tab terpisah"
            >
              <ExternalLink size={13} /> <span className="tab-btn-text">Tab Baru</span>
            </button>

            {currentUser ? (
              <div className="user-nav-badge">
                {currentUser.role === 'ADMIN' ? (
                  <ShieldCheck size={15} style={{ color: '#15803d' }} />
                ) : currentUser.role === 'PENDAFTARAN' ? (
                  <Ticket size={15} style={{ color: '#15803d' }} />
                ) : (
                  <User size={15} style={{ color: '#0d9488' }} />
                )}
                <span className="user-nav-name">
                  {currentUser.name}
                </span>
                <button
                  onClick={handleLogout}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', marginLeft: '2px', padding: '2px' }}
                  title="Keluar (Logout)"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <div className="status-badge">
                <span className="status-dot" style={{ background: connected ? '#10b981' : '#ef4444' }}></span>
                <span>{connected ? 'WebSocket' : 'Offline'}</span>
              </div>
            )}
          </div>
        </div>

        <div className="view-switcher">
          <button
            className={`view-btn ${currentView === 'kiosk' ? 'active' : ''}`}
            onClick={() => setCurrentView('kiosk')}
            title="Tampilan Kiosk Mandiri Pasien"
          >
            <Ticket size={15} />
            <span className="nav-label-pc">Kiosk Pasien</span>
            <span className="nav-label-mobile">Kiosk</span>
          </button>
          <button
            className={`view-btn ${currentView === 'tv' ? 'active' : ''}`}
            onClick={() => setCurrentView('tv')}
            title="Tampilan Display Monitor TV"
          >
            <Tv size={15} />
            <span className="nav-label-pc">Display TV</span>
            <span className="nav-label-mobile">TV</span>
          </button>
          <button
            className={`view-btn ${currentView === 'officer' ? 'active' : ''}`}
            onClick={() => setCurrentView('officer')}
            title="Tampilan Layar Pemanggilan Petugas"
          >
            <UserCheck size={15} />
            <span className="nav-label-pc">Layar Petugas</span>
            <span className="nav-label-mobile">Petugas</span>
          </button>
          <button
            className={`view-btn ${currentView === 'admin' ? 'active' : ''}`}
            onClick={() => setCurrentView('admin')}
            title="Tampilan Pengaturan & Administrasi"
          >
            <LayoutDashboard size={15} />
            <span className="nav-label-pc">Admin</span>
            <span className="nav-label-mobile">Admin</span>
          </button>
        </div>
      </header>

      {/* Main Views Container with Role Guards & Error Boundary */}
      <ErrorBoundary>
        <main className="main-content">
          {currentView === 'kiosk' && (
            isKioskAuthorized ? (
              <KioskView
                hospital={data.hospital}
                clinics={data.clinics}
                tickets={data.tickets}
                onTakeTicket={handleTakeTicket}
              />
            ) : (
              <LoginForm targetRole="KIOSK" hospital={data.hospital} onLoginSuccess={handleLoginSuccess} />
            )
          )}

          {currentView === 'tv' && (
            <TvDisplayView
              hospital={data.hospital}
              clinics={data.clinics}
              tickets={data.tickets}
              lastCall={lastCall}
            />
          )}

          {currentView === 'officer' && (
            isOfficerAuthorized ? (
              <OfficerConsoleView
                clinics={data.clinics}
                counters={data.counters}
                tickets={data.tickets}
                onCallTicket={handleCallTicket}
                onRecallTicket={handleRecallTicket}
                onSkipTicket={handleSkipTicket}
                onCompleteTicket={handleCompleteTicket}
                currentUser={currentUser}
              />
            ) : (
              <LoginForm targetRole="OFFICER" hospital={data.hospital} onLoginSuccess={handleLoginSuccess} />
            )
          )}

          {currentView === 'admin' && (
            isAdminAuthorized ? (
              <AdminDashboardView
                hospital={data.hospital}
                clinics={data.clinics}
                counters={data.counters}
                tickets={data.tickets}
                history={data.history}
                onUpdateSettings={handleUpdateSettings}
                onResetShift={handleResetShift}
                currentUser={currentUser}
              />
            ) : (
              <LoginForm targetRole="ADMIN" hospital={data.hospital} onLoginSuccess={handleLoginSuccess} />
            )
          )}
        </main>
      </ErrorBoundary>
    </div>
  );
}
