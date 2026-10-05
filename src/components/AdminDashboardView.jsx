import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Settings, Film, RefreshCw, Download, Plus, Trash2, Check, AlertTriangle, Layers, Users, Clock, Upload, Image, Video, FileVideo, ArrowUp, ArrowDown, Sparkles, Printer, Sliders, Edit2, KeyRound, Shield, ShieldCheck, Ticket, UserCheck, Monitor, Maximize2, MoveHorizontal, X, ExternalLink, Volume2 } from 'lucide-react';
import ThermalTicketModal from './ThermalTicketModal';
import { parseVideoUrl } from '../utils/videoHelper';

const DAYS_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export default function AdminDashboardView({ hospital, clinics = [], counters = [], tickets = [], history = [], onUpdateSettings, onResetShift, currentUser }) {
  const [activeTab, setActiveTab] = useState('overview'); // overview, clinics, tv, print, users, reset
  const [hospitalForm, setHospitalForm] = useState(hospital || {});
  const [hospitalLogo, setHospitalLogo] = useState(hospital?.logo || '');
  const [displaySettings, setDisplaySettings] = useState({
    layoutRatio: hospital?.displaySettings?.layoutRatio || '50-50',
    aspectRatio: hospital?.displaySettings?.aspectRatio || '16-9',
    objectFit: hospital?.displaySettings?.objectFit || 'contain',
    position: hospital?.displaySettings?.position || 'right'
  });
  const [addVideoModalOpen, setAddVideoModalOpen] = useState(false);
  const [videoModalUrl, setVideoModalUrl] = useState('');
  const [videoModalDuration, setVideoModalDuration] = useState(0);
  const [customModalDuration, setCustomModalDuration] = useState('');
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [isResettingShift, setIsResettingShift] = useState(false);
  const [clinicList, setClinicList] = useState(clinics || []);
  const [counterList, setCounterList] = useState(counters || []);
  const [videoList, setVideoList] = useState(hospital?.videoList || []);
  const [infoSlideList, setInfoSlideList] = useState(hospital?.infoSlides || [
    {
      id: 's1',
      tag: 'INFORMASI LAYANAN',
      icon: '🏥',
      title: hospital?.name ? hospital.name.toUpperCase() : 'INFORMASI LAYANAN',
      subtitle: 'Melayani Sepenuh Hati Dengan Sentuhan Kasih',
      description: 'Kami berkomitmen memberikan pelayanan kesehatan berkualitas tinggi dengan fasilitas modern dan tenaga medis profesional.'
    },
    {
      id: 's2',
      tag: 'ALUR ANTREAN',
      icon: '🎫',
      title: 'AMBIL TIKET ANTREAN',
      subtitle: 'Gunakan Kiosk Mandiri di Pintu Masuk',
      description: 'Silakan ambil nomor antrean sesuai Poliklinik tujuan Anda dan perhatikan nomor panggil pada Layar Monitor ini.'
    },
    {
      id: 's3',
      tag: 'EDUKASI KESEHATAN',
      icon: '💡',
      title: 'JAGA POLA HIDUP SEHAT',
      subtitle: 'Cuci Tangan & Pakai Masker',
      description: 'Selalu terapkan protokol kesehatan, cuci tangan 6 langkah, serta jaga kebersihan di area rumah sakit.'
    }
  ]);

  const [printSettings, setPrintSettings] = useState({
    paperWidth: hospital?.printSettings?.paperWidth || '58mm',
    fontSize: hospital?.printSettings?.fontSize || 'medium',
    showLogo: hospital?.printSettings?.showLogo !== false,
    logoHeight: hospital?.printSettings?.logoHeight || 60,
    headerSubtitle: hospital?.printSettings?.headerSubtitle || 'Sistem Antrean Poliklinik Terpadu',
    footerText: hospital?.printSettings?.footerText || '* Harap simpan tiket ini hingga dipanggil *\n* Budayakan antre dengan tertib *',
    showBarcode: hospital?.printSettings?.showBarcode !== false,
    showDateTime: hospital?.printSettings?.showDateTime !== false,
    autoPrint: hospital?.printSettings?.autoPrint !== false,
    quickPrint: hospital?.printSettings?.quickPrint !== false
  });
  const [testPrintModal, setTestPrintModal] = useState(false);

  // User Management State
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    name: '',
    role: 'POLIKLINIK',
    assignedClinicIds: []
  });

  const fetchUsers = () => {
    setLoadingUsers(true);
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        setLoadingUsers(false);
        if (data.success) setUsersList(data.users);
      })
      .catch(err => {
        setLoadingUsers(false);
        console.warn('Fetch users error:', err);
      });
  };

  // Synchronize incoming props when loaded or updated asynchronously from backend
  useEffect(() => {
    if (hospital) {
      setHospitalForm(hospital);
      if (hospital.logo !== undefined) setHospitalLogo(hospital.logo);
      if (hospital.videoList) setVideoList(hospital.videoList);
      if (hospital.infoSlides) setInfoSlideList(hospital.infoSlides);
      if (hospital.runningText !== undefined) setRunningText(hospital.runningText);
      if (hospital.printSettings) {
        setPrintSettings(prev => ({
          ...prev,
          ...hospital.printSettings
        }));
      }
      if (hospital.displaySettings) {
        setDisplaySettings(prev => ({
          ...prev,
          ...hospital.displaySettings
        }));
      }
    }
  }, [hospital]);

  useEffect(() => {
    if (clinics && clinics.length > 0) {
      setClinicList(clinics);
    }
  }, [clinics]);

  useEffect(() => {
    if (counters && counters.length > 0) {
      setCounterList(counters);
    }
  }, [counters]);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  const handleOpenAddUser = () => {
    setEditingUser(null);
    setUserForm({
      username: '',
      password: '',
      name: '',
      role: 'POLIKLINIK',
      assignedClinicIds: []
    });
    setUserModalOpen(true);
  };

  const handleOpenEditUser = (user) => {
    setEditingUser(user);
    const clinicIds = Array.isArray(user.assignedClinicIds) && user.assignedClinicIds.length > 0
      ? user.assignedClinicIds
      : (user.assignedClinicId ? user.assignedClinicId.split(',').map(s => s.trim()).filter(Boolean) : []);
    setUserForm({
      username: user.username,
      password: '',
      name: user.name,
      role: user.role,
      assignedClinicIds: clinicIds
    });
    setUserModalOpen(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!userForm.name || !userForm.role) return;

    try {
      const clinicIdStr = userForm.assignedClinicIds.length > 0 ? userForm.assignedClinicIds.join(',') : null;
      if (editingUser) {
        // Edit existing
        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: userForm.name,
            role: userForm.role,
            assignedClinicId: clinicIdStr,
            assignedClinicIds: userForm.assignedClinicIds,
            password: userForm.password ? userForm.password : undefined
          })
        });
        const data = await res.json();
        if (data.success) {
          showToast('Data pengguna berhasil diperbarui!');
          setUserModalOpen(false);
          fetchUsers();
        } else {
          showToast(data.error || 'Gagal memperbarui pengguna.', 'danger');
        }
      } else {
        // Create new
        if (!userForm.username || !userForm.password) {
          showToast('Username dan password wajib diisi untuk pengguna baru.', 'danger');
          return;
        }
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: userForm.username,
            password: userForm.password,
            name: userForm.name,
            role: userForm.role,
            assignedClinicId: clinicIdStr,
            assignedClinicIds: userForm.assignedClinicIds
          })
        });
        const data = await res.json();
        if (data.success) {
          showToast('Pengguna baru berhasil ditambahkan!');
          setUserModalOpen(false);
          fetchUsers();
        } else {
          showToast(data.error || 'Gagal menambahkan pengguna.', 'danger');
        }
      }
    } catch (err) {
      showToast('Gagal menghubungi server.', 'danger');
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Yakin ingin menghapus pengguna "${user.name}" (${user.username})?`)) return;

    try {
      const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Pengguna berhasil dihapus.');
        fetchUsers();
      } else {
        showToast(data.error || 'Gagal menghapus pengguna.', 'danger');
      }
    } catch (err) {
      showToast('Gagal menghubungi server.', 'danger');
    }
  };

  const [runningText, setRunningText] = useState(hospital?.runningText || '');
  const [notice, setNotice] = useState(null);

  const today = new Date().toLocaleDateString('en-CA');
  const getNormalizedDate = (d) => {
    if (!d) return today;
    if (typeof d === 'string') return d.split('T')[0];
    try {
      return new Date(d).toLocaleDateString('en-CA');
    } catch {
      return today;
    }
  };
  const todayTickets = tickets.filter(t => getNormalizedDate(t.date) === today);

  const totalTaken = todayTickets.length;
  const totalCompleted = todayTickets.filter(t => t.status === 'COMPLETED').length;
  const totalSkipped = todayTickets.filter(t => t.status === 'SKIPPED').length;
  const totalWaiting = todayTickets.filter(t => t.status === 'WAITING').length;

  const showToast = (msg, type = 'success') => {
    setNotice({ msg, type });
    setTimeout(() => setNotice(null), 3500);
  };

  const handleSaveHospital = () => {
    onUpdateSettings({
      hospital: { ...hospitalForm, runningText, logo: hospitalLogo, printSettings, displaySettings },
      videos: videoList,
      infoSlides: infoSlideList
    }, (res) => {
      if (res.success) showToast('Pengaturan Layar TV & Media Promosi berhasil disimpan!');
      else showToast(res.error || 'Gagal menyimpan pengaturan.', 'danger');
    });
  };

  const handleSavePrintSettings = () => {
    onUpdateSettings({
      hospital: { ...hospitalForm, runningText, logo: hospitalLogo, printSettings },
      videos: videoList,
      infoSlides: infoSlideList
    }, (res) => {
      if (res.success) showToast('Pengaturan Format Cetak Tiket & Kiosk berhasil disimpan!');
      else showToast(res.error || 'Gagal menyimpan pengaturan cetak.', 'danger');
    });
  };

  const handleMoveClinic = (index, dir) => {
    const targetIdx = index + dir;
    if (targetIdx < 0 || targetIdx >= clinicList.length) return;
    const updated = [...clinicList];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    const reordered = updated.map((c, i) => ({ ...c, sortOrder: i + 1 }));
    setClinicList(reordered);
    showToast('Urutan poliklinik diperbarui. Tekan "Simpan Perubahan" untuk menyimpan.');
  };

  const handleToggleClinicDay = (clinicId, day) => {
    setClinicList(clinicList.map(c => {
      if (c.id !== clinicId) return c;
      const currentDaysStr = c.scheduleDays || 'Senin,Selasa,Rabu,Kamis,Jumat,Sabtu,Minggu';
      const currentDaysArr = currentDaysStr.split(',').map(s => s.trim());
      let newDays;
      if (currentDaysArr.includes(day)) {
        newDays = currentDaysArr.filter(d => d !== day);
      } else {
        newDays = [...currentDaysArr, day];
      }
      return { ...c, scheduleDays: newDays.join(',') };
    }));
  };

  const handleAddInfoSlide = () => {
    const newSlide = {
      id: `s_${Date.now()}`,
      tag: 'INFORMASI BARU',
      icon: '📢',
      title: 'JUDUL INFORMASI RS',
      subtitle: 'Subtitle / Slogan Informasi',
      description: 'Tuliskan deskripsi teks informasi edukasi atau pengumuman rumah sakit di sini.'
    };
    setInfoSlideList([...infoSlideList, newSlide]);
    showToast('Slide kartu informasi baru ditambahkan!');
  };

  const handleDeleteInfoSlide = (id) => {
    if (infoSlideList.length <= 1) {
      showToast('Minimal harus ada 1 slide informasi TV.', 'danger');
      return;
    }
    setInfoSlideList(infoSlideList.filter(s => s.id !== id));
    showToast('Slide informasi dihapus.');
  };

  const handleUpdateInfoSlideField = (id, field, val) => {
    setInfoSlideList(infoSlideList.map(s => s.id === id ? { ...s, [field]: val } : s));
  };

  const handleLogoFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast('Ukuran file logo terlalu besar (maksimal 10MB).', 'danger');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setHospitalLogo(reader.result);
      showToast('Logo berhasil diunggah! Tekan "Simpan Pengaturan TV" untuk menyimpan.');
    };
    reader.readAsDataURL(file);
  };

  const handleVideoFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    files.forEach(file => {
      if (file.size > 100 * 1024 * 1024) {
        showToast(`File video ${file.name} melebihi batas 100MB.`, 'danger');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const newVid = {
          id: `v_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          title: file.name.replace(/\.[^/.]+$/, ''),
          url: reader.result,
          duration: 0 // Otomatis putar penuh sampai selesai
        };
        setVideoList(prev => [...prev, newVid]);
        showToast(`Video "${file.name}" berhasil ditambahkan ke playlist!`);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleOpenAddVideoModal = () => {
    setVideoModalUrl('');
    setVideoModalTitle('');
    setVideoModalDuration(0); // 0 = Putar sampai selesai (Otomatis)
    setCustomModalDuration('');
    setAddVideoModalOpen(true);
  };

  const [isResolvingVideo, setIsResolvingVideo] = useState(false);

  const handleConfirmAddVideo = async (e) => {
    e?.preventDefault();
    if (!videoModalUrl.trim()) {
      showToast('Harap masukkan URL video.', 'danger');
      return;
    }
    
    setIsResolvingVideo(true);
    let finalUrl = videoModalUrl.trim();
    let finalTitle = videoModalTitle.trim();
    let finalThumbnail = null;

    try {
      const res = await fetch(`/api/resolve-video-url?url=${encodeURIComponent(finalUrl)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.resolvedUrl) finalUrl = data.resolvedUrl;
        if (data.title && !finalTitle) {
          finalTitle = data.title.length > 60 ? `${data.title.substr(0, 60)}...` : data.title;
        }
        if (data.thumbnailUrl) finalThumbnail = data.thumbnailUrl;
      }
    } catch (err) {
      console.warn('Resolve video URL warning:', err);
    } finally {
      setIsResolvingVideo(false);
    }

    const parsed = parseVideoUrl(finalUrl);
    let defaultTitle = 'Video Promosi';
    if (parsed.type === 'youtube') defaultTitle = 'Video YouTube Promosi';
    else if (parsed.type === 'tiktok') defaultTitle = 'Video TikTok Promosi';
    else if (parsed.type === 'instagram') defaultTitle = 'Video Instagram Reels';
    else if (parsed.type === 'gdrive') defaultTitle = 'Video Google Drive';

    const resolvedDuration = videoModalDuration === 'custom'
      ? (parseInt(customModalDuration) || 0)
      : (parseInt(videoModalDuration) || 0);

    const newVid = {
      id: `v_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title: finalTitle || defaultTitle,
      url: finalUrl,
      duration: resolvedDuration,
      thumbnailUrl: finalThumbnail
    };
    setVideoList(prev => [...prev, newVid]);
    setAddVideoModalOpen(false);
    showToast(`Video "${newVid.title}" berhasil ditambahkan ke playlist!`);
  };

  const handleSetAllVideosDuration = (d) => {
    if (videoList.length === 0) return;
    setVideoList(videoList.map(v => ({ ...v, duration: d })));
    const label = d === 0 ? 'Putar Sampai Selesai (Otomatis)' : `${d} detik`;
    showToast(`Semua video diatur ke: ${label}`);
  };

  const handleDeleteVideo = (id) => {
    setVideoList(prev => prev.filter(v => v.id !== id));
    showToast('Video dihapus dari playlist TV.');
  };

  const handleSaveClinics = () => {
    onUpdateSettings({ 
      clinics: clinicList,
      counters: counterList
    }, (res) => {
      if (res.success) showToast('Katalog Poliklinik berhasil disimpan!');
      else showToast(res.error || 'Gagal menyimpan pengaturan.', 'danger');
    });
  };

  const handleAddCounter = () => {
    const newCounter = {
      id: `l_${Date.now()}`,
      name: `Loket ${counterList.length + 1}`,
      clinicId: clinicList[0]?.id || null
    };
    setCounterList([...counterList, newCounter]);
    showToast('Loket tugas baru ditambahkan! Tekan "Simpan Perubahan" untuk menyimpan.');
  };

  const handleDeleteCounter = (id) => {
    setCounterList(counterList.filter(c => c.id !== id));
    showToast('Loket dihapus.');
  };

  const handleUpdateCounterField = (id, field, value) => {
    setCounterList(counterList.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleAddClinic = () => {
    const newId = `c_${Date.now()}`;
    const newClinic = {
      id: newId,
      name: 'Poliklinik Baru',
      prefix: 'X',
      quota: 30,
      active: true,
      description: 'Deskripsi poliklinik'
    };
    setClinicList([...clinicList, newClinic]);
  };

  const handleToggleClinicActive = (id) => {
    setClinicList(clinicList.map(c => c.id === id ? { ...c, active: !c.active } : c));
  };

  const handleUpdateClinicField = (id, field, value) => {
    setClinicList(clinicList.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleExportCSV = () => {
    window.open('/api/reports/export-csv', '_blank');
  };

  const handleTriggerShiftReset = () => {
    setShowResetConfirmModal(true);
  };

  const handleExecuteShiftReset = () => {
    setIsResettingShift(true);
    onResetShift((res) => {
      setIsResettingShift(false);
      setShowResetConfirmModal(false);
      if (res && res.success) {
        showToast('Shift antrean berhasil di-reset! Seluruh nomor antrean poliklinik kembali mulai dari nomor 001.');
      } else {
        showToast(res?.error || 'Gagal me-reset shift antrean.', 'danger');
      }
    });
  };

  return (
    <div className="admin-container">
      {notice && (
        <div style={{
          background: notice.type === 'danger' ? '#fef2f2' : '#ecfdf5',
          color: notice.type === 'danger' ? '#b91c1c' : '#047857',
          padding: '1rem', borderRadius: '12px', fontWeight: '700', border: '1px solid #a7f3d0'
        }}>
          {notice.msg}
        </div>
      )}

      {/* Admin Navigation Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'white', padding: '1.25rem 1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: '800', color: '#0f172a' }}>
              Dasbor Back-Office Administrator
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Kelola Pengguna & Hak Akses, Poliklinik, Pengaturan Cetak, Media TV, & Laporan Operasional
            </p>
          </div>

          {currentUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', padding: '6px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.8rem', fontWeight: '700', color: '#334155' }}>
              <ShieldCheck size={16} color="#15803d" />
              <span>Login: <strong>{currentUser.name}</strong> ({currentUser.role})</span>
            </div>
          )}
        </div>

        {/* Tab Buttons Navigation Bar (Fully Responsive & Wrap-Friendly) */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', background: '#f8fafc', padding: '6px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <button
            className={`view-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            style={{ fontWeight: '700', borderRadius: '8px' }}
          >
            <LayoutDashboard size={16} /> 1. Laporan & Ringkasan
          </button>
          <button
            className={`view-btn ${activeTab === 'clinics' ? 'active' : ''}`}
            onClick={() => setActiveTab('clinics')}
            style={{ fontWeight: '700', borderRadius: '8px' }}
          >
            <Layers size={16} /> 2. Katalog Poli & Kuota
          </button>
          <button
            className={`view-btn ${activeTab === 'tv' ? 'active' : ''}`}
            onClick={() => setActiveTab('tv')}
            style={{ fontWeight: '700', borderRadius: '8px' }}
          >
            <Film size={16} /> 3. Pengaturan Display TV
          </button>
          <button
            className={`view-btn ${activeTab === 'print' ? 'active' : ''}`}
            onClick={() => setActiveTab('print')}
            style={{ fontWeight: '700', borderRadius: '8px' }}
          >
            <Printer size={16} /> 4. Layout Cetak Tiket
          </button>
          <button
            className={`view-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
            style={{
              fontWeight: '800',
              borderRadius: '8px',
              background: activeTab === 'users' ? 'white' : '#ecfdf5',
              color: activeTab === 'users' ? '#166534' : '#15803d',
              border: '1px solid #a7f3d0'
            }}
          >
            <Users size={16} /> 5. Manajemen Pengguna
          </button>
          <button
            className={`view-btn ${activeTab === 'reset' ? 'active' : ''}`}
            onClick={() => setActiveTab('reset')}
            style={{ fontWeight: '700', borderRadius: '8px' }}
          >
            <RefreshCw size={16} /> 6. Reset Shift Antrean
          </button>
        </div>
      </div>

      {/* TAB 1: OVERVIEW & REPORTS */}
      {activeTab === 'overview' && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#15803d' }}>
                <Users size={26} />
              </div>
              <div>
                <div className="stat-val">{totalTaken}</div>
                <div className="stat-lbl">Total Tiket Hari Ini</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#10b981' }}>
                <Check size={26} />
              </div>
              <div>
                <div className="stat-val">{totalCompleted}</div>
                <div className="stat-lbl">Selesai diperiksa</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#f59e0b' }}>
                <Clock size={26} />
              </div>
              <div>
                <div className="stat-val">{totalWaiting}</div>
                <div className="stat-lbl">Sedang Menunggu</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#ef4444' }}>
                <AlertTriangle size={26} />
              </div>
              <div>
                <div className="stat-val">{totalSkipped}</div>
                <div className="stat-lbl">Dilewati (Skip)</div>
              </div>
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-header">
              <h2>Laporan Per Kategori Poliklinik Hari Ini ({today})</h2>
              <button className="btn-primary" onClick={handleExportCSV}>
                <Download size={16} /> Ekspor Laporan Pasien (CSV)
              </button>
            </div>

            <table className="table-custom">
              <thead>
                <tr>
                  <th>Poliklinik</th>
                  <th>Prefix</th>
                  <th>Total Diambil</th>
                  <th>Selesai</th>
                  <th>Dilewati</th>
                  <th>Menunggu</th>
                  <th>Batas Kuota</th>
                </tr>
              </thead>
              <tbody>
                {clinics.map((c) => {
                  const list = todayTickets.filter(t => t.clinicId === c.id);
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: '700' }}>{c.name}</td>
                      <td><span style={{ fontWeight: '800', color: '#15803d' }}>[{c.prefix}]</span></td>
                      <td>{list.length} Pasien</td>
                      <td><span style={{ color: '#047857', fontWeight: '700' }}>{list.filter(t => t.status === 'COMPLETED').length}</span></td>
                      <td><span style={{ color: '#b91c1c', fontWeight: '700' }}>{list.filter(t => t.status === 'SKIPPED').length}</span></td>
                      <td><span style={{ color: '#b45309', fontWeight: '700' }}>{list.filter(t => t.status === 'WAITING').length}</span></td>
                      <td>{c.quota} Pasien/hari</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table 2: Detailed Patient Registrations Stored in DB */}
          <div className="admin-card" style={{ marginTop: '1.5rem' }}>
            <div className="admin-card-header">
              <h2>Daftar Identitas Pasien Terdaftar di Database ({todayTickets.length} Pasien)</h2>
            </div>

            <table className="table-custom">
              <thead>
                <tr>
                  <th>No. Antrean</th>
                  <th>Nama Pasien</th>
                  <th>NIK / No. RM</th>
                  <th>No. Telepon / WA</th>
                  <th>Jenis Penjamin</th>
                  <th>Poliklinik</th>
                  <th>Jam Terdaftar</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {todayTickets.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                      Belum ada data pasien terdaftar hari ini.
                    </td>
                  </tr>
                ) : (
                  todayTickets.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: '800', color: '#15803d' }}>{t.ticketNumber}</td>
                      <td style={{ fontWeight: '700', color: '#0f172a' }}>{t.patientName || 'Pasien Umum'}</td>
                      <td>{t.nik !== '-' ? t.nik : (t.norm !== '-' ? t.norm : '-')}</td>
                      <td>{t.phone || '-'}</td>
                      <td>
                        <span style={{ fontSize: '0.75rem', fontWeight: '800', background: t.patientType === 'BPJS' ? '#ecfdf5' : '#fef3c7', color: t.patientType === 'BPJS' ? '#166534' : '#b45309', padding: '2px 8px', borderRadius: '8px' }}>
                          {t.patientType || 'BPJS'}
                        </span>
                      </td>
                      <td>{t.clinicName}</td>
                      <td>{new Date(t.createdAt).toLocaleTimeString('id-ID')}</td>
                      <td>
                        <span style={{
                          padding: '3px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '700',
                          background: t.status === 'WAITING' ? '#fef3c7' : t.status === 'CALLED' ? '#ecfdf5' : t.status === 'COMPLETED' ? '#d1fae5' : '#fee2e2',
                          color: t.status === 'WAITING' ? '#d97706' : t.status === 'CALLED' ? '#15803d' : t.status === 'COMPLETED' ? '#047857' : '#b91c1c'
                        }}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* TAB 2: POLIKLINIK & QUOTA CATALOG SETUP */}
      {activeTab === 'clinics' && (
        <>
          <div className="admin-card">
          <div className="admin-card-header">
            <h2>Katalog Poliklinik & Pengaturan Kuota Antrean (CAT 01 & INV 01)</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-primary" style={{ background: '#0d9488' }} onClick={handleAddClinic}>
                <Plus size={16} /> Tambah Poli
              </button>
              <button className="btn-primary" onClick={handleSaveClinics}>
                <Check size={16} /> Simpan Perubahan
              </button>
            </div>
          </div>

          <table className="table-custom">
            <thead>
              <tr>
                <th>Urutan TV</th>
                <th>Status</th>
                <th>Prefix</th>
                <th>Nama Poliklinik</th>
                <th>Jadwal Buka Operasional (Hari)</th>
                <th>Kuota Pasien</th>
                <th>Buka / Tutup</th>
              </tr>
            </thead>
            <tbody>
              {clinicList.map((c, idx) => {
                const currentDaysStr = c.scheduleDays || 'Senin,Selasa,Rabu,Kamis,Jumat,Sabtu,Minggu';
                const activeDaysArr = currentDaysStr.split(',').map(s => s.trim());

                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          onClick={() => handleMoveClinic(idx, -1)}
                          disabled={idx === 0}
                          style={{ padding: '4px', background: idx === 0 ? '#f1f5f9' : '#ecfdf5', color: idx === 0 ? '#cbd5e1' : '#15803d', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: idx === 0 ? 'not-allowed' : 'pointer' }}
                          title="Naikkan Urutan Tampilan Poli di TV"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <span style={{ fontWeight: '800', fontSize: '0.9rem', color: '#0f172a', minWidth: '22px', textAlign: 'center' }}>
                          #{idx + 1}
                        </span>
                        <button
                          onClick={() => handleMoveClinic(idx, 1)}
                          disabled={idx === clinicList.length - 1}
                          style={{ padding: '4px', background: idx === clinicList.length - 1 ? '#f1f5f9' : '#ecfdf5', color: idx === clinicList.length - 1 ? '#cbd5e1' : '#15803d', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: idx === clinicList.length - 1 ? 'not-allowed' : 'pointer' }}
                          title="Turunkan Urutan Tampilan Poli di TV"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    </td>

                    <td>
                      <span style={{ padding: '4px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '700', background: c.active ? '#d1fae5' : '#fee2e2', color: c.active ? '#047857' : '#b91c1c' }}>
                        {c.active ? 'AKTIF' : 'TUTUP'}
                      </span>
                    </td>

                    <td>
                      <input
                        type="text"
                        maxLength="2"
                        value={c.prefix}
                        onChange={(e) => handleUpdateClinicField(c.id, 'prefix', e.target.value.toUpperCase())}
                        style={{ width: '45px', padding: '4px 6px', textAlign: 'center', fontWeight: '800', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </td>

                    <td>
                      <input
                        type="text"
                        value={c.name}
                        onChange={(e) => handleUpdateClinicField(c.id, 'name', e.target.value)}
                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: '600' }}
                      />
                    </td>

                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {DAYS_LIST.map((day) => {
                          const isActiveDay = activeDaysArr.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => handleToggleClinicDay(c.id, day)}
                              style={{
                                padding: '2px 7px',
                                fontSize: '0.7rem',
                                borderRadius: '6px',
                                border: '1px solid',
                                cursor: 'pointer',
                                fontWeight: '800',
                                borderColor: isActiveDay ? '#15803d' : '#cbd5e1',
                                background: isActiveDay ? '#ecfdf5' : '#f8fafc',
                                color: isActiveDay ? '#166534' : '#94a3b8'
                              }}
                              title={`Klik untuk mengaktifkan/mematikan jadwal poli pada hari ${day}`}
                            >
                              {day.substr(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    </td>

                    <td>
                      <input
                        type="number"
                        value={c.quota}
                        onChange={(e) => handleUpdateClinicField(c.id, 'quota', parseInt(e.target.value) || 0)}
                        style={{ width: '75px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </td>

                    <td>
                      <button
                        onClick={() => handleToggleClinicActive(c.id)}
                        style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', background: c.active ? '#fef2f2' : '#ecfdf5', color: c.active ? '#b91c1c' : '#047857' }}
                      >
                        {c.active ? 'Tutup' : 'Buka'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* TAB 3: TV DISPLAY MEDIA & RUNNING TEXT */}
      {activeTab === 'tv' && (
        <div className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: '800' }}>Pengaturan Layar TV Display (PRC 01 & TEN 01)</h2>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '2px' }}>Kelola logo rumah sakit, daftar video promosi TV, dan pesan running text publik.</p>
            </div>
            <button className="btn-primary" style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }} onClick={handleSaveHospital}>
              <Check size={18} /> Simpan Pengaturan TV
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', marginTop: '1rem' }}>
            {/* 1. LOGO RUMAH SAKIT */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1.25rem', borderRadius: '14px' }}>
              <label style={{ fontWeight: '800', fontSize: '0.95rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
                <Image size={20} style={{ color: '#15803d' }} />
                <span>Logo Rumah Sakit / Instansi</span>
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                <div style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '16px',
                  border: '2px dashed #cbd5e1',
                  background: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}>
                  {hospitalLogo ? (
                    <img src={hospitalLogo} alt="Logo RS" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', fontWeight: '600' }}>
                      🏥<br />Tanpa Logo
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="file"
                      id="hospital-logo-file"
                      accept="image/*"
                      onChange={handleLogoFileUpload}
                      style={{ display: 'none' }}
                    />
                    <label
                      htmlFor="hospital-logo-file"
                      className="btn-primary"
                      style={{ cursor: 'pointer', background: '#15803d', padding: '8px 16px', fontSize: '0.85rem' }}
                    >
                      <Upload size={16} /> Upload Logo Gambar
                    </label>

                    {hospitalLogo && (
                      <button
                        className="btn-danger"
                        style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                        onClick={() => {
                          setHospitalLogo('');
                          showToast('Logo dihapus.');
                        }}
                      >
                        <Trash2 size={16} /> Hapus Logo
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Format file disarankan: PNG, JPG, atau WebP (Latar transparan disukai). Ukuran maks 10MB.
                  </div>
                </div>
              </div>
            </div>

            {/* 2. IDENTITAS NAMA & TAGLINE */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ fontWeight: '700', fontSize: '0.9rem', color: '#334155', display: 'block', marginBottom: '4px' }}>Nama Rumah Sakit</label>
                <input
                  type="text"
                  value={hospitalForm.name || ''}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, name: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', fontWeight: '600' }}
                  placeholder="Contoh: RSUD Harapan Sehat"
                />
              </div>

              <div>
                <label style={{ fontWeight: '700', fontSize: '0.9rem', color: '#334155', display: 'block', marginBottom: '4px' }}>Tagline / Slogan Subtitle</label>
                <input
                  type="text"
                  value={hospitalForm.tagline || ''}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, tagline: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                  placeholder="Contoh: Layanan Kesehatan Cerdas & Empati"
                />
              </div>
            </div>

            {/* 3. MEDIA VIDEO PROMOSI TV (UPLOAD & UNLIMITED PLAYLIST) */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1.25rem', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <label style={{ fontWeight: '800', fontSize: '0.95rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Film size={20} style={{ color: '#15803d' }} />
                    <span>Daftar Video Promosi TV Display (Playlist Auto-Loop)</span>
                  </label>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                    Video diputar berurutan (*looping*) di layar kanan TV. Anda dapat mengunggah file video lokal (.mp4, .webm) tanpa batas!
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="file"
                    id="video-files-input"
                    accept="video/mp4,video/webm,video/ogg"
                    multiple
                    onChange={handleVideoFileUpload}
                    style={{ display: 'none' }}
                  />
                  <label
                    htmlFor="video-files-input"
                    className="btn-primary"
                    style={{ cursor: 'pointer', background: '#15803d', padding: '8px 16px', fontSize: '0.85rem' }}
                  >
                    <FileVideo size={16} /> 📁 Upload File Video (.mp4 / .webm)
                  </label>

                  <button
                    className="btn-primary"
                    style={{ background: '#0d9488', padding: '8px 16px', fontSize: '0.85rem' }}
                    onClick={handleOpenAddVideoModal}
                  >
                    <Plus size={16} /> 🔗 Tambah Link URL Video (YouTube / TikTok / Instagram / GDrive / MP4)
                  </button>
                </div>
              </div>

              {/* Quick Duration Toolbar for Playlist */}
              {videoList.length > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  flexWrap: 'wrap',
                  background: '#f8fafc',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  marginBottom: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: '800', color: '#334155' }}>
                    <Clock size={15} color="#15803d" />
                    <span>Atur Cepat Durasi Playlist:</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handleSetAllVideosDuration(0)}
                      style={{
                        fontSize: '0.73rem',
                        fontWeight: '700',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: '#dcfce7',
                        color: '#15803d',
                        border: '1px solid #bbf7d0',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Putar semua video hingga selesai tanpa terpotong"
                    >
                      <RefreshCw size={12} /> Semua: Sampai Selesai
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetAllVideosDuration(60)}
                      style={{
                        fontSize: '0.73rem',
                        fontWeight: '700',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: 'white',
                        color: '#334155',
                        border: '1px solid #cbd5e1',
                        cursor: 'pointer'
                      }}
                    >
                      ⏱️ Semua: 1 Menit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetAllVideosDuration(120)}
                      style={{
                        fontSize: '0.73rem',
                        fontWeight: '700',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: 'white',
                        color: '#334155',
                        border: '1px solid #cbd5e1',
                        cursor: 'pointer'
                      }}
                    >
                      ⏱️ Semua: 2 Menit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetAllVideosDuration(300)}
                      style={{
                        fontSize: '0.73rem',
                        fontWeight: '700',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: 'white',
                        color: '#334155',
                        border: '1px solid #cbd5e1',
                        cursor: 'pointer'
                      }}
                    >
                      ⏱️ Semua: 5 Menit
                    </button>
                  </div>
                </div>
              )}

              {/* Video Playlist Cards Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {videoList.length === 0 ? (
                  <div style={{ background: 'white', padding: '2rem', textAlign: 'center', borderRadius: '10px', color: '#94a3b8', border: '1px dashed #cbd5e1' }}>
                    Belum ada video promosi. Klik <strong>Upload File Video</strong> atau <strong>Tambah Link URL</strong> di atas.
                  </div>
                ) : (
                  videoList.map((vid, idx) => {
                    const parsed = parseVideoUrl(vid.url);
                    return (
                      <div key={vid.id || idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        background: 'white',
                        padding: '0.85rem 1rem',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.03)'
                      }}>
                        <span style={{ fontWeight: '900', color: '#15803d', fontSize: '0.9rem', width: '28px' }}>
                          #{idx + 1}
                        </span>

                        <div style={{
                          width: '80px',
                          height: '50px',
                          background: parsed.type === 'instagram' ? 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)' : '#0f172a',
                          borderRadius: '6px',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          position: 'relative'
                        }}>
                          {vid.thumbnailUrl || parsed.thumbnailUrl ? (
                            <img src={vid.thumbnailUrl || parsed.thumbnailUrl} alt="Thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : parsed.type === 'tiktok' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: '800' }}>
                              <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>🎵</span>
                              <span style={{ fontSize: '0.6rem', letterSpacing: '0.5px', marginTop: '2px', color: '#25f4ee' }}>TIKTOK</span>
                            </div>
                          ) : parsed.type === 'instagram' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: '800' }}>
                              <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>📸</span>
                              <span style={{ fontSize: '0.6rem', letterSpacing: '0.5px', marginTop: '2px' }}>REELS</span>
                            </div>
                          ) : parsed.type === 'youtube' ? (
                            <img src={parsed.thumbnailUrl} alt="Thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <video src={vid.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                          )}
                          <div style={{
                            position: 'absolute',
                            bottom: '2px',
                            right: '2px',
                            background: parsed.type === 'youtube' ? '#dc2626' : parsed.type === 'tiktok' ? '#000000' : parsed.type === 'instagram' ? '#c13584' : parsed.type === 'gdrive' ? '#15803d' : '#0d9488',
                            color: 'white',
                            fontSize: '0.55rem',
                            fontWeight: '900',
                            padding: '1px 4px',
                            borderRadius: '3px',
                            border: parsed.type === 'tiktok' ? '1px solid #25f4ee' : 'none'
                          }}>
                            {parsed.type === 'youtube' ? 'YT' : parsed.type === 'tiktok' ? 'TIKTOK' : parsed.type === 'instagram' ? 'IG' : parsed.type === 'gdrive' ? 'DRIVE' : 'FILE'}
                          </div>
                        </div>

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="text"
                              value={vid.title}
                              onChange={(e) => {
                                const newTitle = e.target.value;
                                setVideoList(videoList.map(v => v.id === vid.id ? { ...v, title: newTitle } : v));
                              }}
                              placeholder="Judul Video"
                              style={{ fontWeight: '700', fontSize: '0.9rem', padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', flex: 1 }}
                            />
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: '800',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: parsed.type === 'youtube' ? '#fee2e2' : parsed.type === 'tiktok' ? '#000000' : parsed.type === 'instagram' ? '#fdf2f8' : parsed.type === 'gdrive' ? '#ecfdf5' : '#f1f5f9',
                              color: parsed.type === 'youtube' ? '#b91c1c' : parsed.type === 'tiktok' ? '#ffffff' : parsed.type === 'instagram' ? '#be185d' : parsed.type === 'gdrive' ? '#166534' : '#475569',
                              border: parsed.type === 'tiktok' ? '1px solid #334155' : parsed.type === 'instagram' ? '1px solid #fbcfe8' : 'none'
                            }}>
                              {parsed.type === 'youtube' ? 'YouTube' : parsed.type === 'tiktok' ? 'TikTok' : parsed.type === 'instagram' ? 'Instagram' : parsed.type === 'gdrive' ? 'Google Drive' : 'File MP4'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', wordBreak: 'break-all', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '320px' }}>
                              Source: {vid.url.length > 70 ? `${vid.url.substr(0, 70)}...` : vid.url}
                            </div>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: (!vid.duration || vid.duration === 0) ? '#f0fdf4' : '#f8fafc',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              border: (!vid.duration || vid.duration === 0) ? '1px solid #bbf7d0' : '1px solid #cbd5e1'
                            }}>
                              <Clock size={13} style={{ color: (!vid.duration || vid.duration === 0) ? '#16a34a' : '#15803d' }} />
                              <span style={{ fontSize: '0.72rem', fontWeight: '800', color: (!vid.duration || vid.duration === 0) ? '#15803d' : '#475569' }}>
                                Durasi:
                              </span>
                              <select
                                value={[0, 15, 20, 30, 45, 60, 90, 120, 180, 300, 600, 900, 1800].includes(vid.duration ?? 0) ? (vid.duration ?? 0) : 'custom'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === 'custom') {
                                    const inputVal = prompt('Masukkan durasi video dalam satuan detik (contoh: 240 untuk 4 menit, atau 0 untuk sampai selesai):', vid.duration || 60);
                                    if (inputVal !== null) {
                                      const parsedD = parseInt(inputVal);
                                      if (!isNaN(parsedD) && parsedD >= 0) {
                                        setVideoList(videoList.map(v => v.id === vid.id ? { ...v, duration: parsedD } : v));
                                      }
                                    }
                                  } else {
                                    const d = parseInt(val);
                                    setVideoList(videoList.map(v => v.id === vid.id ? { ...v, duration: d } : v));
                                  }
                                }}
                                style={{
                                  fontSize: '0.73rem',
                                  fontWeight: '800',
                                  border: 'none',
                                  background: 'transparent',
                                  color: (!vid.duration || vid.duration === 0) ? '#15803d' : '#0f172a',
                                  cursor: 'pointer'
                                }}
                              >
                                <option value={0}>🔄 Putar Sampai Selesai (Otomatis)</option>
                                <option value={15}>15 dtk</option>
                                <option value={20}>20 dtk</option>
                                <option value={30}>30 dtk</option>
                                <option value={45}>45 dtk</option>
                                <option value={60}>60 dtk (1 mnt)</option>
                                <option value={90}>90 dtk (1.5 mnt)</option>
                                <option value={120}>120 dtk (2 mnt)</option>
                                <option value={180}>180 dtk (3 mnt)</option>
                                <option value={300}>300 dtk (5 mnt)</option>
                                <option value={600}>600 dtk (10 mnt)</option>
                                <option value={900}>900 dtk (15 mnt)</option>
                                <option value={1800}>1800 dtk (30 mnt)</option>
                                <option value="custom">⏱️ Kustom (Ketik Detik)...</option>
                              </select>
                              {![0, 15, 20, 30, 45, 60, 90, 120, 180, 300, 600, 900, 1800].includes(vid.duration ?? 0) && (
                                <span style={{ fontSize: '0.68rem', fontWeight: '800', color: '#15803d', background: '#ecfdf5', padding: '1px 5px', borderRadius: '4px' }}>
                                  ({vid.duration}s)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          className="btn-danger"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          onClick={() => handleDeleteVideo(vid.id)}
                        >
                          <Trash2 size={16} /> Hapus
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Tips Suara & Rotasi TV Kiosk */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px 16px', borderRadius: '10px', marginTop: '1rem', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <Volume2 size={20} style={{ color: '#16a34a', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.8rem', color: '#166534', lineHeight: 1.5 }}>
                  <strong>Tips Pemutaran & Suara Layar TV Otomatis:</strong> Browser membatasi pemutaran suara otomatis tanpa interaksi. Cukup klik tombol <em>"Suara TV: Aktif"</em> di layar TV. Untuk unit PC TV yang menyala otomatis tanpa mouse/operator, jalankan browser Google Chrome dengan flag: <code style={{ background: 'white', padding: '2px 6px', borderRadius: '4px', border: '1px solid #86efac', fontWeight: 'bold' }}>--autoplay-policy=no-user-gesture-required</code> agar suara dari semua link video dan suara panggilan antrean berbunyi otomatis 100%.
                </div>
              </div>
            </div>

            {/* 3B. KONFIGURASI UKURAN & TATA LETAK MEDIA PROMOSI TV (PATEN) */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1.25rem', borderRadius: '14px' }}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontWeight: '800', fontSize: '0.95rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sliders size={20} style={{ color: '#15803d' }} />
                  <span>Ukuran & Tata Letak Media Promosi TV (Paten)</span>
                </label>
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Kunci ukuran, perbandingan proporsi layar, dan rasio tampilan video agar media promosi tampil paten tanpa terdistorsi/terpotong di layar monitor TV.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                {/* 1. Proporsi Lebar Layar */}
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '800', color: '#334155', display: 'block', marginBottom: '6px' }}>
                    📐 Proporsi Lebar Layar (Antrean : Media Promosi)
                  </label>
                  <select
                    value={displaySettings.layoutRatio || '50-50'}
                    onChange={(e) => setDisplaySettings({ ...displaySettings, layoutRatio: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: '600', background: 'white' }}
                  >
                    <option value="50-50">50% Antrean : 50% Media Promosi (Seimbang / Default)</option>
                    <option value="60-40">60% Antrean : 40% Media Promosi (Fokus Antrean Lebih Luas)</option>
                    <option value="40-60">40% Antrean : 60% Media Promosi (Fokus Video Promosi Lebih Besar)</option>
                    <option value="70-30">70% Antrean : 30% Media Promosi (Antrean Sangat Dominan)</option>
                    <option value="fixed-480">Paten Lebar 480px (Ukuran Tetap Standar)</option>
                    <option value="fixed-580">Paten Lebar 580px (Ukuran Tetap Sedang)</option>
                    <option value="fixed-680">Paten Lebar 680px (Ukuran Tetap Lebar)</option>
                    <option value="fixed-780">Paten Lebar 780px (Ukuran Tetap Sangat Lebar)</option>
                  </select>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                    Menentukan perbandingan luas area video promosi vs nomor antrean poliklinik.
                  </div>
                </div>

                {/* 2. Kunci Aspek Rasio Video */}
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '800', color: '#334155', display: 'block', marginBottom: '6px' }}>
                    📺 Kunci Aspek Rasio Pemutar Video
                  </label>
                  <select
                    value={displaySettings.aspectRatio || '16-9'}
                    onChange={(e) => setDisplaySettings({ ...displaySettings, aspectRatio: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: '600', background: 'white' }}
                  >
                    <option value="16-9">16:9 Widescreen (Paten Standar TV HD / Bioskop)</option>
                    <option value="4-3">4:3 TV Standar</option>
                    <option value="full">Full Height (Menyesuaikan Tinggi Layar TV Penuh)</option>
                  </select>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                    Mengunci perbandingan lebar dan tinggi kotak pemutar video agar proporsional.
                  </div>
                </div>

                {/* 3. Kesesuaian Tampilan (Object Fit) */}
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '800', color: '#334155', display: 'block', marginBottom: '6px' }}>
                    🖼️ Mode Pas Tampilan Video (Object Fit)
                  </label>
                  <select
                    value={displaySettings.objectFit || 'contain'}
                    onChange={(e) => setDisplaySettings({ ...displaySettings, objectFit: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: '600', background: 'white' }}
                  >
                    <option value="contain">Paten Utuh (Seluruh isi video terlihat utuh tanpa terpotong / frame hitam rapi)</option>
                    <option value="cover">Penuh Bingkai (Mengisi seluruh kotak player / terpotong jika rasio beda)</option>
                  </select>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                    Rekomendasi "Paten Utuh" agar teks di dalam video promosi/YouTube tetap terbaca jelas.
                  </div>
                </div>

                {/* 4. Posisi Kolom Media Promosi */}
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '800', color: '#334155', display: 'block', marginBottom: '6px' }}>
                    ↔️ Posisi Kolom Media Promosi
                  </label>
                  <select
                    value={displaySettings.position || 'right'}
                    onChange={(e) => setDisplaySettings({ ...displaySettings, position: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: '600', background: 'white' }}
                  >
                    <option value="right">Kanan Layar (Antrean di Kiri, Video di Kanan - Standar)</option>
                    <option value="left">Kiri Layar (Video di Kiri, Antrean di Kanan)</option>
                  </select>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                    Tentukan apakah video berada di sebelah kanan atau sebelah kiri layar TV.
                  </div>
                </div>
              </div>

              {/* Live Miniature Preview of the TV Screen */}
              <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#0f172a', borderRadius: '12px', color: 'white' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
                  🖥️ Simulasi Tampilan TV (Live Preview Rasio):
                </div>
                <div style={{
                  height: '110px',
                  background: '#1e293b',
                  borderRadius: '8px',
                  border: '2px solid #334155',
                  padding: '8px',
                  display: 'flex',
                  gap: '8px'
                }}>
                  {displaySettings.position === 'left' ? (
                    <>
                      {/* Video Left */}
                      <div style={{
                        flex: displaySettings.layoutRatio === '60-40' ? '4' : displaySettings.layoutRatio === '40-60' ? '6' : displaySettings.layoutRatio === '70-30' ? '3' : '5',
                        background: 'linear-gradient(135deg, #15803d, #166534)',
                        borderRadius: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px',
                        border: '1px solid #eab308'
                      }}>
                        <span style={{ fontSize: '1.2rem' }}>🎬</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: '900' }}>Media Promosi</span>
                        <span style={{ fontSize: '0.65rem', opacity: 0.85 }}>({displaySettings.aspectRatio || '16:9'} • {displaySettings.objectFit || 'contain'})</span>
                      </div>
                      {/* Antrean Right */}
                      <div style={{
                        flex: displaySettings.layoutRatio === '60-40' ? '6' : displaySettings.layoutRatio === '40-60' ? '4' : displaySettings.layoutRatio === '70-30' ? '7' : '5',
                        background: '#334155',
                        borderRadius: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px',
                        border: '1px dashed #64748b'
                      }}>
                        <span style={{ fontSize: '1.2rem' }}>🎫</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: '900' }}>Panggilan & Daftar Poli</span>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Antrean Left */}
                      <div style={{
                        flex: displaySettings.layoutRatio === '60-40' ? '6' : displaySettings.layoutRatio === '40-60' ? '4' : displaySettings.layoutRatio === '70-30' ? '7' : '5',
                        background: '#334155',
                        borderRadius: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px',
                        border: '1px dashed #64748b'
                      }}>
                        <span style={{ fontSize: '1.2rem' }}>🎫</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: '900' }}>Panggilan & Daftar Poli</span>
                      </div>
                      {/* Video Right */}
                      <div style={{
                        flex: displaySettings.layoutRatio === '60-40' ? '4' : displaySettings.layoutRatio === '40-60' ? '6' : displaySettings.layoutRatio === '70-30' ? '3' : '5',
                        background: 'linear-gradient(135deg, #15803d, #166534)',
                        borderRadius: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px',
                        border: '1px solid #eab308'
                      }}>
                        <span style={{ fontSize: '1.2rem' }}>🎬</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: '900' }}>Media Promosi</span>
                        <span style={{ fontSize: '0.65rem', opacity: 0.85 }}>({displaySettings.aspectRatio || '16:9'} • {displaySettings.objectFit || 'contain'})</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 4. KARTU INFORMASI TV FALLBACK (KARTU EDUKASI / PENGGANTI VIDEO CRASH) */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1.25rem', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <label style={{ fontWeight: '800', fontSize: '0.95rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={20} style={{ color: '#15803d' }} />
                    <span>Kartu Tampilan Informasi TV (Tampil Otomatis Jika Video Crash / Tanpa Video)</span>
                  </label>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                    Informasi ini berupa kartu slider edukasi & alur antrean yang akan ditampilkan di layar TV sebelah kanan saat video tidak tersedia / error.
                  </p>
                </div>

                <button
                  className="btn-primary"
                  style={{ background: '#0d9488', padding: '8px 16px', fontSize: '0.85rem' }}
                  onClick={handleAddInfoSlide}
                >
                  <Plus size={16} /> Tambah Slide Kartu Baru
                </button>
              </div>

              {/* Info Slides List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {infoSlideList.map((slide, idx) => (
                  <div key={slide.id || idx} style={{
                    background: 'white',
                    border: '1px solid #cbd5e1',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                      <span style={{ fontWeight: '800', fontSize: '0.85rem', color: '#15803d', background: '#ecfdf5', padding: '2px 10px', borderRadius: '8px' }}>
                        SLIDE KARTU #{idx + 1}
                      </span>
                      <button
                        className="btn-danger"
                        style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        onClick={() => handleDeleteInfoSlide(slide.id)}
                      >
                        <Trash2 size={14} /> Hapus Slide
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '80px 180px 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>Icon Emoji</label>
                        <input
                          type="text"
                          value={slide.icon || '🏥'}
                          onChange={(e) => handleUpdateInfoSlideField(slide.id, 'icon', e.target.value)}
                          style={{ width: '100%', padding: '6px', textAlign: 'center', fontSize: '1.2rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>Tag Kategori</label>
                        <input
                          type="text"
                          value={slide.tag || ''}
                          onChange={(e) => handleUpdateInfoSlideField(slide.id, 'tag', e.target.value)}
                          style={{ width: '100%', padding: '6px 10px', fontWeight: '700', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                          placeholder="e.g. INFORMASI LAYANAN"
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>Judul Utama Slide</label>
                        <input
                          type="text"
                          value={slide.title || ''}
                          onChange={(e) => handleUpdateInfoSlideField(slide.id, 'title', e.target.value)}
                          style={{ width: '100%', padding: '6px 10px', fontWeight: '800', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                          placeholder="e.g. RSUD HARAPAN SEHAT"
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>Subtitle / Slogan</label>
                        <input
                          type="text"
                          value={slide.subtitle || ''}
                          onChange={(e) => handleUpdateInfoSlideField(slide.id, 'subtitle', e.target.value)}
                          style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                          placeholder="e.g. Melayani Sepenuh Hati"
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>Deskripsi Penjelasan</label>
                        <input
                          type="text"
                          value={slide.description || slide.desc || ''}
                          onChange={(e) => handleUpdateInfoSlideField(slide.id, 'description', e.target.value)}
                          style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                          placeholder="Tulis penjelasan lengkap informasi..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. RUNNING TEXT LAYAR BAWAH */}
            <div>
              <label style={{ fontWeight: '700', fontSize: '0.9rem', color: '#334155', display: 'block', marginBottom: '4px' }}>Running Text Layar Bawah TV</label>
              <textarea
                rows="3"
                value={runningText}
                onChange={(e) => setRunningText(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', lineHeight: '1.5' }}
                placeholder="Masukkan teks pengumuman running text..."
              />
            </div>

            {/* Bottom Save Action */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button className="btn-primary" style={{ padding: '0.85rem 2rem', fontSize: '1rem' }} onClick={handleSaveHospital}>
                <Check size={18} /> Simpan Pengaturan TV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PRINT & TICKET LAYOUT SETTINGS */}
      {activeTab === 'print' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem', alignItems: 'start' }}>
          {/* Left Column: Form Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="admin-card">
              <div className="admin-card-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Printer size={20} color="#15803d" /> Pengaturan Format Struk Thermal
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Sesuaikan ukuran kertas, ukuran font, logo, dan konten struk yang dicetak di Kiosk antrean.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* 1. Paper Width */}
                <div>
                  <label style={{ fontSize: '0.9rem', fontWeight: '800', color: '#1e293b', display: 'block', marginBottom: '8px' }}>
                    1. Ukuran Kertas Thermal Printer
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setPrintSettings({ ...printSettings, paperWidth: '58mm' })}
                      style={{
                        padding: '1rem',
                        borderRadius: '12px',
                        border: printSettings.paperWidth === '58mm' ? '2px solid #15803d' : '1px solid #cbd5e1',
                        background: printSettings.paperWidth === '58mm' ? '#ecfdf5' : '#f8fafc',
                        color: printSettings.paperWidth === '58mm' ? '#166534' : '#475569',
                        fontWeight: '800',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ fontSize: '1.05rem', marginBottom: '2px' }}>📄 58 mm</div>
                      <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>Printer Kasir / Thermal Standar</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPrintSettings({ ...printSettings, paperWidth: '80mm' })}
                      style={{
                        padding: '1rem',
                        borderRadius: '12px',
                        border: printSettings.paperWidth === '80mm' ? '2px solid #15803d' : '1px solid #cbd5e1',
                        background: printSettings.paperWidth === '80mm' ? '#ecfdf5' : '#f8fafc',
                        color: printSettings.paperWidth === '80mm' ? '#166534' : '#475569',
                        fontWeight: '800',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ fontSize: '1.05rem', marginBottom: '2px' }}>📄 80 mm</div>
                      <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>Printer Thermal Lebar / POS Besar</div>
                    </button>
                  </div>
                </div>

                {/* 2. Font Size */}
                <div>
                  <label style={{ fontSize: '0.9rem', fontWeight: '800', color: '#1e293b', display: 'block', marginBottom: '8px' }}>
                    2. Skala Ukuran Teks (Font Size)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {[
                      { id: 'small', label: 'Kecil', desc: 'Hemat kertas' },
                      { id: 'medium', label: 'Sedang', desc: 'Standar' },
                      { id: 'large', label: 'Besar', desc: 'Sangat jelas' }
                    ].map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setPrintSettings({ ...printSettings, fontSize: f.id })}
                        style={{
                          padding: '0.75rem 0.5rem',
                          borderRadius: '10px',
                          border: printSettings.fontSize === f.id ? '2px solid #15803d' : '1px solid #cbd5e1',
                          background: printSettings.fontSize === f.id ? '#ecfdf5' : '#f8fafc',
                          color: printSettings.fontSize === f.id ? '#166534' : '#475569',
                          fontWeight: '800',
                          cursor: 'pointer',
                          textAlign: 'center'
                        }}
                      >
                        <div style={{ fontSize: '0.95rem' }}>{f.label}</div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{f.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Logo Settings */}
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontSize: '0.9rem', fontWeight: '800', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={printSettings.showLogo}
                        onChange={(e) => setPrintSettings({ ...printSettings, showLogo: e.target.checked })}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span>Tampilkan Logo Rumah Sakit pada Struk</span>
                    </label>

                    {hospitalLogo ? (
                      <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '700', background: '#ecfdf5', padding: '2px 8px', borderRadius: '8px' }}>
                        ✓ Logo Terpasang
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: '700', background: '#fffbeb', padding: '2px 8px', borderRadius: '8px' }}>
                        Logo Belum Diupload
                      </span>
                    )}
                  </div>

                  {printSettings.showLogo && (
                    <div style={{ marginTop: '0.75rem', paddingLeft: '26px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                        <span>Tinggi Logo Struk:</span>
                        <span style={{ color: '#15803d' }}>{printSettings.logoHeight || 60} px</span>
                      </div>
                      <input
                        type="range"
                        min="35"
                        max="110"
                        step="5"
                        value={printSettings.logoHeight || 60}
                        onChange={(e) => setPrintSettings({ ...printSettings, logoHeight: parseInt(e.target.value) })}
                        style={{ width: '100%', cursor: 'pointer' }}
                      />
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                        Tip: Jika ingin mengganti logo rumah sakit, upload pada tab <strong>Pengaturan Display TV</strong>.
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Subtitle / Header Text */}
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Sub-Judul Struk (Di bawah nama RS)
                  </label>
                  <input
                    type="text"
                    value={printSettings.headerSubtitle}
                    onChange={(e) => setPrintSettings({ ...printSettings, headerSubtitle: e.target.value })}
                    placeholder="Contoh: Sistem Antrean Poliklinik Terpadu"
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                  />
                </div>

                {/* 5. Toggles for items */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: '700', color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={printSettings.showDateTime}
                      onChange={(e) => setPrintSettings({ ...printSettings, showDateTime: e.target.checked })}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span>Tampilkan Tanggal & Jam</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: '700', color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={printSettings.showBarcode}
                      onChange={(e) => setPrintSettings({ ...printSettings, showBarcode: e.target.checked })}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span>Tampilkan Barcode Visual</span>
                  </label>
                </div>

                {/* 6. Footer Notes */}
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Pesan Catatan Kaki (Footer Struk)
                  </label>
                  <textarea
                    rows={3}
                    value={printSettings.footerText}
                    onChange={(e) => setPrintSettings({ ...printSettings, footerText: e.target.value })}
                    placeholder="Contoh: * Harap simpan tiket ini hingga dipanggil *"
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontFamily: 'monospace' }}
                  />
                </div>

                {/* 7. Kiosk Behavior & Silent Printing Guide */}
                <div style={{ background: '#f0fdf4', padding: '1.25rem', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#166534', marginBottom: '10px' }}>
                    ⚙️ Perilaku Mesin Kiosk & Silent Printing
                  </h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: '700', color: '#14532d', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={printSettings.quickPrint}
                        onChange={(e) => setPrintSettings({ ...printSettings, quickPrint: e.target.checked })}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <span>⚡ Mode Cetak Cepat 1-Klik (Langsung cetak tiket tanpa formulir nama pasien)</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: '700', color: '#14532d', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={printSettings.autoPrint}
                        onChange={(e) => setPrintSettings({ ...printSettings, autoPrint: e.target.checked })}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <span>🖨️ Cetak Otomatis (Langsung memicu cetak printer saat tombol ditekan)</span>
                    </label>

                    {/* Silent Printing Instruction Box */}
                    <div style={{ background: '#ffffff', border: '1px solid #86efac', borderRadius: '10px', padding: '12px', marginTop: '6px' }}>
                      <div style={{ fontWeight: '800', color: '#15803d', fontSize: '0.85rem', marginBottom: '4px' }}>
                        💡 Cara Mengaktifkan Silent Printing (Cetak Langsung Tanpa Dialog Pop-up):
                      </div>
                      <p style={{ fontSize: '0.8rem', color: '#334155', lineHeight: 1.5, margin: '0 0 6px 0' }}>
                        Agar browser <strong>langsung mengeluarkan kertas struk ke printer thermal</strong> tanpa menampilkan dialog pop-up konfirmasi:
                      </p>
                      <div style={{ fontSize: '0.78rem', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'monospace', color: '#0f172a', lineHeight: 1.5 }}>
                        <strong>Linux (Komputer ini):</strong> Jalankan <code>./start-kiosk.sh</code><br />
                        <strong>Windows (PC Kiosk lain):</strong> Jalankan <code>start-kiosk.bat</code>
                      </div>

                      <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: '800', color: '#0369a1', marginBottom: '4px' }}>
                          ⚡ Solusi Direct Print Agent (100% Bebas Dialog Browser):
                        </div>
                        <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                          Jalankan di PC Windows tempat printer terhubung. Cukup klik 2x <strong>pasang-autostart-background.bat</strong> agar otomatis aktif di latar belakang (background) setiap kali komputer menyala!
                        </p>
                        <a
                          href="/api/download-print-bridge"
                          download="windows-print-bridge.zip"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#15803d',
                            color: 'white',
                            padding: '6px 14px',
                            borderRadius: '8px',
                            fontSize: '0.78rem',
                            fontWeight: '700',
                            textDecoration: 'none',
                            boxShadow: '0 2px 6px rgba(21, 128, 61, 0.25)'
                          }}
                        >
                          <Download size={14} /> Unduh Windows Print Bridge (.zip)
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Buttons Actions */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '0.5rem' }}>
                  <button
                    className="btn-primary"
                    style={{ flex: 1, padding: '0.9rem', fontSize: '1rem', fontWeight: '800' }}
                    onClick={handleSavePrintSettings}
                  >
                    <Check size={18} /> Simpan Pengaturan Cetak
                  </button>

                  <button
                    type="button"
                    onClick={() => setTestPrintModal(true)}
                    style={{
                      padding: '0.9rem 1.5rem',
                      background: '#0f172a',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Printer size={18} /> Uji Cetak Sampel
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Interactive Thermal Receipt Preview */}
          <div style={{ position: 'sticky', top: '1rem' }}>
            <div style={{ background: '#f1f5f9', padding: '1.5rem', borderRadius: '20px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#e2e8f0', color: '#334155', padding: '4px 12px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: '800', marginBottom: '1rem' }}>
                <Sliders size={14} /> SIMULASI PRATINJAU STRUK ({printSettings.paperWidth})
              </div>

              {/* Thermal Paper Simulation */}
              <div
                className={`thermal-ticket ${printSettings.paperWidth === '80mm' ? 'thermal-80mm' : 'thermal-58mm'} font-${printSettings.fontSize || 'medium'}`}
                style={{ margin: '0 auto', boxShadow: '0 20px 30px rgba(0,0,0,0.15)' }}
              >
                {/* Logo */}
                {printSettings.showLogo && hospitalLogo && (
                  <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
                    <img
                      src={hospitalLogo}
                      alt="Logo RS"
                      style={{
                        maxHeight: `${printSettings.logoHeight || 60}px`,
                        maxWidth: '85%',
                        objectFit: 'contain',
                        filter: 'grayscale(100%) contrast(140%)'
                      }}
                    />
                  </div>
                )}

                {/* Header */}
                <div className="thermal-header">
                  <h4>{hospitalForm.name || 'RUMAH SAKIT'}</h4>
                  {printSettings.headerSubtitle && (
                    <p style={{ fontSize: '0.75em', color: '#475569', margin: '4px 0 0 0' }}>
                      {printSettings.headerSubtitle}
                    </p>
                  )}
                  <div style={{ borderBottom: '1px dashed #000', margin: '0.5rem 0' }}></div>
                </div>

                {/* Body */}
                <div style={{ margin: '0.4rem 0' }}>
                  <p style={{ fontSize: '0.9em', fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>
                    POLIKLINIK UMUM
                  </p>
                  <div className="thermal-num">A-007</div>
                  <p style={{ fontSize: '0.8em', color: '#334155', margin: 0 }}>
                    Urutan Ke-<strong>7</strong>
                  </p>
                </div>

                <div style={{ borderBottom: '1px dashed #000', margin: '0.5rem 0' }}></div>

                {/* Details */}
                <div style={{ fontSize: '0.78em', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {printSettings.showDateTime && (
                    <>
                      <div>Tanggal : {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      <div>Pukul   : {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</div>
                    </>
                  )}
                  <div>Status  : <strong>MENUNGGU</strong></div>
                </div>

                {/* Barcode & Footer */}
                <div style={{ margin: '0.75rem 0 0.25rem 0' }}>
                  {printSettings.showBarcode && (
                    <div style={{
                      height: printSettings.paperWidth === '80mm' ? '38px' : '28px',
                      background: 'repeating-linear-gradient(90deg, #000 0, #000 2px, #fff 2px, #fff 4px, #000 4px, #000 7px)',
                      width: '85%',
                      margin: '0 auto 6px auto'
                    }}></div>
                  )}
                  {printSettings.footerText && (
                    <div style={{ fontSize: '0.7em', color: '#475569', whiteSpace: 'pre-line', lineHeight: 1.4 }}>
                      {printSettings.footerText}
                    </div>
                  )}
                </div>
              </div>

              <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '1rem' }}>
                *Tampilan di atas adalah pratinjau real-time hasil cetak fisik pada thermal printer.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal Test Print */}
      {testPrintModal && (
        <ThermalTicketModal
          ticket={{
            id: 'test_sample_007',
            ticketNumber: 'A-007',
            sequence: 7,
            clinicName: 'Poliklinik Umum',
            patientName: 'Pasien Umum (Sampel Uji Coba)',
            nik: '-',
            patientType: 'BPJS',
            createdAt: new Date().toISOString()
          }}
          hospital={{
            ...hospitalForm,
            logo: hospitalLogo,
            printSettings
          }}
          onClose={() => setTestPrintModal(false)}
        />
      )}

      {/* TAB 5: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Header & Role Info */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
            <div style={{ background: '#ecfdf5', padding: '1rem', borderRadius: '14px', border: '1px solid #a7f3d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', color: '#15803d', marginBottom: '4px' }}>
                <Ticket size={18} /> PENDAFTARAN
              </div>
              <div style={{ fontSize: '0.8rem', color: '#166534', lineHeight: 1.4 }}>
                Berhak membuka & mengoperasikan <strong>Layar Kiosk Pasien</strong> (Ambil Nomor Antrean).
              </div>
            </div>

            <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '14px', border: '1px solid #bbf7d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', color: '#16a34a', marginBottom: '4px' }}>
                <UserCheck size={18} /> POLIKLINIK
              </div>
              <div style={{ fontSize: '0.8rem', color: '#14532d', lineHeight: 1.4 }}>
                Berhak membuka <strong>Layar Petugas</strong> untuk memanggil & melayani antrean pasien poli.
              </div>
            </div>

            <div style={{ background: '#fefce8', padding: '1rem', borderRadius: '14px', border: '1px solid #fef08a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', color: '#ca8a04', marginBottom: '4px' }}>
                <Shield size={18} /> FARMASI
              </div>
              <div style={{ fontSize: '0.8rem', color: '#854d0e', lineHeight: 1.4 }}>
                Berhak membuka <strong>Layar Petugas</strong> khusus bagian Farmasi & Depo Apotek.
              </div>
            </div>

            <div style={{ background: '#fef3c7', padding: '1rem', borderRadius: '14px', border: '1px solid #fde68a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', color: '#d97706', marginBottom: '4px' }}>
                <ShieldCheck size={18} /> ADMINISTRATOR
              </div>
              <div style={{ fontSize: '0.8rem', color: '#78350f', lineHeight: 1.4 }}>
                Akses penuh mengubah semua data, pengaturan sistem, media TV, tiket, & pengguna.
              </div>
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>Daftar Pengguna & Hak Akses</h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Kelola akun yang berwenang membuka Kiosk, Layar Petugas, dan Back-Office</p>
              </div>

              <button
                className="btn-primary"
                onClick={handleOpenAddUser}
                style={{ padding: '0.65rem 1.25rem', fontSize: '0.9rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={18} /> Tambah Pengguna Baru
              </button>
            </div>

            {loadingUsers ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', fontWeight: '700' }}>
                Memuat data pengguna...
              </div>
            ) : (
              <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: '800' }}>
                      <th style={{ padding: '0.85rem 1rem' }}>Nama Lengkap</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Username</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Peran (Role)</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Penugasan Poliklinik</th>
                      <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map((u) => {
                      const userClinicIds = Array.isArray(u.assignedClinicIds) && u.assignedClinicIds.length > 0
                        ? u.assignedClinicIds
                        : (u.assignedClinicId ? u.assignedClinicId.split(',').map(s => s.trim()).filter(Boolean) : []);
                      const assignedClinics = clinicList.filter(c => userClinicIds.includes(c.id));
                      const isCurrentUser = currentUser?.username === u.username;

                      let badgeBg = '#f1f5f9';
                      let badgeColor = '#475569';
                      let roleLabel = u.role;

                      if (u.role === 'ADMIN') {
                        badgeBg = '#fef3c7';
                        badgeColor = '#d97706';
                        roleLabel = 'ADMINISTRATOR';
                      } else if (u.role === 'PENDAFTARAN') {
                        badgeBg = '#ecfdf5';
                        badgeColor = '#15803d';
                        roleLabel = 'PETUGAS PENDAFTARAN';
                      } else if (u.role === 'POLIKLINIK') {
                        badgeBg = '#f0fdf4';
                        badgeColor = '#16a34a';
                        roleLabel = 'PETUGAS POLIKLINIK';
                      } else if (u.role === 'FARMASI') {
                        badgeBg = '#fefce8';
                        badgeColor = '#ca8a04';
                        roleLabel = 'PETUGAS FARMASI';
                      }

                      return (
                        <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.85rem 1rem', fontWeight: '700', color: '#1e293b' }}>
                            {u.name} {isCurrentUser && <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: '6px', marginLeft: '6px' }}>(Anda)</span>}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', color: '#334155', fontWeight: '600' }}>
                            {u.username}
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '4px 10px',
                              borderRadius: '20px',
                              fontSize: '0.78rem',
                              fontWeight: '800',
                              background: badgeBg,
                              color: badgeColor
                            }}>
                              {roleLabel}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', color: '#475569' }}>
                            {assignedClinics.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                {assignedClinics.map(c => (
                                  <span key={c.id} style={{ fontSize: '0.75rem', fontWeight: '800', background: '#ecfdf5', color: '#15803d', padding: '2px 8px', borderRadius: '6px' }}>
                                    [{c.prefix}] {c.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: '#0d9488', fontSize: '0.8rem', fontWeight: '700' }}>✓ Semua Poliklinik (Umum)</span>
                            )}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '8px' }}>
                              <button
                                onClick={() => handleOpenEditUser(u)}
                                style={{
                                  padding: '5px 10px',
                                  background: '#f1f5f9',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '8px',
                                  fontSize: '0.8rem',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  color: '#334155',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <Edit2 size={14} /> Edit
                              </button>

                              <button
                                onClick={() => handleDeleteUser(u)}
                                disabled={isCurrentUser}
                                style={{
                                  padding: '5px 10px',
                                  background: isCurrentUser ? '#f8fafc' : '#fef2f2',
                                  border: isCurrentUser ? '1px solid #e2e8f0' : '1px solid #fecaca',
                                  borderRadius: '8px',
                                  fontSize: '0.8rem',
                                  fontWeight: '700',
                                  cursor: isCurrentUser ? 'not-allowed' : 'pointer',
                                  color: isCurrentUser ? '#94a3b8' : '#b91c1c',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <Trash2 size={14} /> Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Add/Edit User */}
      {userModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            width: '90%',
            maxWidth: '500px',
            padding: '2rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}>
            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#0f172a' }}>
                {editingUser ? '✏️ Edit Data Pengguna' : '➕ Tambah Pengguna Baru'}
              </h3>
              <button
                onClick={() => setUserModalOpen(false)}
                style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontWeight: '800' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Username {!editingUser && <span style={{ color: '#ef4444' }}>*</span>}
                </label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingUser)}
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                  placeholder="Contoh: pendaftaran1"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    background: editingUser ? '#f1f5f9' : 'white'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Nama Lengkap Pengguna <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  placeholder="Contoh: Siti Rahmawati, A.Md"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Peran & Hak Akses (Role) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: '700' }}
                >
                  <option value="PENDAFTARAN">🎫 Petugas Pendaftaran (Akses Layar Kiosk Pasien)</option>
                  <option value="POLIKLINIK">🩺 Petugas Poliklinik (Akses Layar Pemanggilan Poli)</option>
                  <option value="FARMASI">💊 Petugas Farmasi (Akses Layar Pemanggilan Farmasi)</option>
                  <option value="ADMIN">👑 Administrator (Akses Penuh Seluruh Sistem)</option>
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155' }}>
                    Penugasan Poliklinik / Depo (Bisa Pilih Lebih dari 1)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (userForm.assignedClinicIds.length === clinicList.length) {
                        setUserForm({ ...userForm, assignedClinicIds: [] });
                      } else {
                        setUserForm({ ...userForm, assignedClinicIds: clinicList.map(c => c.id) });
                      }
                    }}
                    style={{ background: 'none', border: 'none', color: '#15803d', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {userForm.assignedClinicIds.length === clinicList.length ? 'Batal Pilih Semua' : 'Pilih Semua Poli'}
                  </button>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                  gap: '8px',
                  maxHeight: '190px',
                  overflowY: 'auto',
                  padding: '10px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '12px'
                }}>
                  {clinicList.map((cli) => {
                    const isChecked = userForm.assignedClinicIds.includes(cli.id);
                    return (
                      <label
                        key={cli.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          background: isChecked ? '#ecfdf5' : '#ffffff',
                          border: isChecked ? '1.5px solid #15803d' : '1px solid #e2e8f0',
                          cursor: 'pointer',
                          fontSize: '0.82rem',
                          fontWeight: isChecked ? '800' : '600',
                          color: isChecked ? '#166534' : '#334155',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setUserForm({
                                ...userForm,
                                assignedClinicIds: [...userForm.assignedClinicIds, cli.id]
                              });
                            } else {
                              setUserForm({
                                ...userForm,
                                assignedClinicIds: userForm.assignedClinicIds.filter(id => id !== cli.id)
                              });
                            }
                          }}
                          style={{ cursor: 'pointer', accentColor: '#15803d', width: '16px', height: '16px' }}
                        />
                        <span>[{cli.prefix}] {cli.name}</span>
                      </label>
                    );
                  })}
                </div>

                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '5px' }}>
                  {userForm.assignedClinicIds.length === 0 ? (
                    <span style={{ color: '#0d9488', fontWeight: '700' }}>✓ Akses Semua Poliklinik (Multilayanan / Tanpa Pembatasan)</span>
                  ) : (
                    <span><strong>{userForm.assignedClinicIds.length}</strong> poliklinik ditugaskan untuk akun ini (Petugas dapat melayani beberapa poli sekaligus).</span>
                  )}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                  {editingUser ? 'Password Baru (Kosongkan jika tidak ingin mengubah)' : 'Password Pengguna *'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder={editingUser ? '••••••••' : 'Minimal 6 karakter'}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 1, padding: '0.85rem', borderRadius: '12px', fontSize: '0.95rem', fontWeight: '800' }}
                >
                  <Check size={18} /> {editingUser ? 'Simpan Perubahan' : 'Tambah Pengguna'}
                </button>
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  style={{ padding: '0.85rem 1.25rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH LINK VIDEO PROMOSI */}
      {addVideoModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '540px', width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Film size={22} style={{ color: '#15803d' }} />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800' }}>Tambah Video Promosi dari Link</h3>
              </div>
              <button
                type="button"
                onClick={() => setAddVideoModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmAddVideo} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Judul Video Promosi
                </label>
                <input
                  type="text"
                  value={videoModalTitle}
                  onChange={(e) => setVideoModalTitle(e.target.value)}
                  placeholder="Contoh: Profil RSUD / Edukasi Pasien"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: '600' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                  URL Link Video (Mendukung YouTube / TikTok / Instagram / Google Drive / MP4)
                </label>
                <input
                  type="text"
                  value={videoModalUrl}
                  onChange={(e) => setVideoModalUrl(e.target.value)}
                  placeholder="https://www.youtube.com/... / https://vt.tiktok.com/... / https://www.instagram.com/reel/..."
                  required
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                />
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                  Mendukung link YouTube biasa & Shorts, TikTok (link panjang atau vt.tiktok.com), Instagram (Reels & Post), Google Drive, atau link langsung file .mp4.
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                  ⏱️ Pengaturan Durasi Putar Video
                </label>
                <select
                  value={videoModalDuration}
                  onChange={(e) => setVideoModalDuration(e.target.value === 'custom' ? 'custom' : parseInt(e.target.value))}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: '700' }}
                >
                  <option value={0}>🔄 Putar Sampai Selesai (Otomatis - Tidak Terpotong)</option>
                  <option value={15}>15 detik</option>
                  <option value={20}>20 detik</option>
                  <option value={30}>30 detik</option>
                  <option value={45}>45 detik</option>
                  <option value={60}>60 detik (1 menit)</option>
                  <option value={90}>90 detik (1.5 menit)</option>
                  <option value={120}>120 detik (2 menit)</option>
                  <option value={180}>180 detik (3 menit)</option>
                  <option value={300}>300 detik (5 menit)</option>
                  <option value={600}>600 detik (10 menit)</option>
                  <option value={900}>900 detik (15 menit)</option>
                  <option value={1800}>1800 detik (30 menit)</option>
                  <option value="custom">⏱️ Kustom (Ketik Detik Sendiri)...</option>
                </select>

                {videoModalDuration === 'custom' && (
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="5"
                      max="7200"
                      value={customModalDuration}
                      onChange={(e) => setCustomModalDuration(e.target.value)}
                      placeholder="Contoh: 240 (untuk 4 menit)"
                      style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569' }}>Detik</span>
                  </div>
                )}

                <div style={{ fontSize: '0.75rem', color: '#15803d', background: '#ecfdf5', padding: '6px 10px', borderRadius: '6px', border: '1px solid #a7f3d0', marginTop: '6px', lineHeight: 1.4 }}>
                  💡 <strong>Rekomendasi:</strong> Pilih <strong>"Putar Sampai Selesai (Otomatis)"</strong> agar video dari link YouTube / file video diputar penuh sampai video selesai tanpa terpotong di tengah jalan.
                </div>
              </div>

              {/* Real-time Parser Badge & Preview */}
              {videoModalUrl.trim() && (() => {
                const parsed = parseVideoUrl(videoModalUrl);
                if (parsed.type === 'youtube') {
                  return (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img src={parsed.thumbnailUrl} alt="YT" style={{ width: '60px', height: '36px', borderRadius: '4px', objectFit: 'cover' }} />
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: '800', color: '#b91c1c' }}>
                          ✅ Video YouTube Terdeteksi! (ID: {parsed.videoId})
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#7f1d1d' }}>
                          Akan diputar otomatis & looping di layar TV melalui pemutar resmi YouTube.
                        </div>
                      </div>
                    </div>
                  );
                } else if (parsed.type === 'tiktok') {
                  return (
                    <div style={{ background: '#090d16', border: '1px solid #25f4ee', padding: '10px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                        🎵
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: '800', color: '#25f4ee' }}>
                          ✅ Video TikTok Terdeteksi!
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>
                          {parsed.videoId ? `ID: ${parsed.videoId}. ` : ''}Siap diputar di layar TV melalui pemutar resmi TikTok.
                        </div>
                      </div>
                    </div>
                  );
                } else if (parsed.type === 'instagram') {
                  return (
                    <div style={{ background: '#fdf2f8', border: '1px solid #fbcfe8', padding: '10px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: 'white' }}>
                        📸
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: '800', color: '#be185d' }}>
                          ✅ Video Instagram (Reels/Post) Terdeteksi!
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#9d174d' }}>
                          Shortcode: {parsed.shortcode}. Akan diputar di layar TV melalui pemutar resmi Instagram.
                        </div>
                      </div>
                    </div>
                  );
                } else if (parsed.type === 'gdrive') {
                  return (
                    <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '10px 14px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: '800', color: '#0369a1' }}>
                        ✅ Video Google Drive Terdeteksi!
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#0c4a6e' }}>
                        Pastikan link Google Drive sudah diatur publik ("Siapa saja yang memiliki link dapat melihat").
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '8px', fontSize: '0.75rem', color: '#475569' }}>
                      🎥 Terdeteksi sebagai tautan langsung file video (.mp4 / .webm).
                    </div>
                  );
                }
              })()}

              <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={isResolvingVideo}
                  className="btn-primary"
                  style={{ flex: 1, padding: '0.85rem', borderRadius: '10px', fontSize: '0.95rem', fontWeight: '800' }}
                >
                  <Plus size={18} /> {isResolvingVideo ? 'Menghubungkan Link...' : 'Tambahkan ke Playlist'}
                </button>
                <button
                  type="button"
                  onClick={() => setAddVideoModalOpen(false)}
                  style={{ padding: '0.85rem 1.25rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 6: SHIFT RESET */}
      {activeTab === 'reset' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Card Status Auto-Reset Harian (Tengah Malam) */}
          <div className="admin-card" style={{ border: '2px solid #86efac', background: '#f0fdf4' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.75rem' }}>
              <div style={{ background: '#dcfce7', padding: '10px', borderRadius: '12px', color: '#16a34a', display: 'flex' }}>
                <ShieldCheck size={28} />
              </div>
              <div>
                <h3 style={{ margin: 0, color: '#15803d', fontSize: '1.15rem' }}>
                  Auto-Reset Pergantian Hari: <span style={{ background: '#22c55e', color: 'white', padding: '3px 10px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '800' }}>AKTIF OTOMATIS</span>
                </h3>
                <p style={{ margin: '3px 0 0 0', color: '#166534', fontSize: '0.9rem' }}>
                  Sistem otomatis me-reset antrean setiap pergantian hari pukul <strong>00:00:00 WIB</strong>
                </p>
              </div>
            </div>
            <p style={{ color: '#166534', fontSize: '0.92rem', lineHeight: '1.6', margin: 0 }}>
              Setiap kali tanggal berganti ke hari baru, sistem server secara otomatis mengarsipkan seluruh antrean hari kemarin ke tabel <strong>Riwayat Antrean (History)</strong> dan memulai nomor antrean hari baru kembali dari nomor <strong>001</strong> untuk seluruh poliklinik. Seluruh layar TV Display, Kiosk Mandiri, dan Konsol Petugas akan tersinkronisasi bersih tanpa memerlukan klik manual dari administrator.
            </p>
          </div>

          {/* Card Manual Reset Shift Operasional */}
          <div className="admin-card" style={{ border: '2px solid #fca5a5', background: '#fff5f5' }}>
            <div className="admin-card-header">
              <h2 style={{ color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <RefreshCw size={24} /> Reset Shift Antrean Manual (CSH 01)
              </h2>
            </div>
            <p style={{ color: '#7f1d1d', marginBottom: '1.25rem', lineHeight: '1.6' }}>
              Tombol reset shift di bawah ini digunakan apabila rumah sakit memberlakukan pergantian shift kerja di hari yang sama (contoh: <strong>Shift Pagi</strong> berganti ke <strong>Shift Siang/Sore</strong>) dan ingin mengarsipkan antrean yang masih aktif saat ini lalu mengulang nomor tiket kembali mulai dari nomor <strong>001</strong>.
            </p>

            {/* Statistik Antrean Hari Ini Yang Akan Terpengaruh */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '10px', border: '1px solid #fed7aa', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: '#9a3412', fontWeight: '600' }}>Antrean Menunggu</div>
                <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#c2410c' }}>{totalWaiting}</div>
                <div style={{ fontSize: '0.75rem', color: '#9a3412' }}>Pasien dalam antrean</div>
              </div>
              <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '10px', border: '1px solid #bfdbfe', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: '#1e40af', fontWeight: '600' }}>Sedang Dilayani/Dipanggil</div>
                <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#2563eb' }}>
                  {todayTickets.filter(t => t.status === 'CALLED' || t.status === 'SERVING').length}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#1e40af' }}>Pasien di poliklinik</div>
              </div>
              <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '10px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: '#166534', fontWeight: '600' }}>Telah Selesai Dilayani</div>
                <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#16a34a' }}>{totalCompleted}</div>
                <div style={{ fontSize: '0.75rem', color: '#166534' }}>Pasien hari ini</div>
              </div>
              <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: '600' }}>Total Tiket Hari Ini</div>
                <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#0f172a' }}>{totalTaken}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Akan diarsipkan ke riwayat</div>
              </div>
            </div>

            <button 
              className="btn-danger" 
              style={{ 
                padding: '0.9rem 1.8rem', 
                fontSize: '1.05rem', 
                fontWeight: '800',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: isResettingShift ? 'not-allowed' : 'pointer',
                opacity: isResettingShift ? 0.7 : 1
              }} 
              onClick={handleTriggerShiftReset}
              disabled={isResettingShift}
            >
              <RefreshCw size={20} className={isResettingShift ? 'animate-spin' : ''} /> 
              {isResettingShift ? 'Sedang Memproses Reset...' : 'Jalankan Reset Shift Antrean Sekarang'}
            </button>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Reset Shift Antrean */}
      {showResetConfirmModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px', border: '2px solid #ef4444' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem', color: '#b91c1c' }}>
              <div style={{ background: '#fee2e2', padding: '10px', borderRadius: '50%', display: 'flex' }}>
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Konfirmasi Reset Shift Antrean</h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>Tindakan ini akan mempengaruhi seluruh antrean aktif</p>
              </div>
            </div>

            <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: '10px', padding: '1rem', marginBottom: '1.5rem', fontSize: '0.95rem', color: '#7f1d1d', lineHeight: '1.6' }}>
              <p style={{ margin: '0 0 0.75rem 0' }}>
                Apakah Anda yakin ingin melakukan <strong>RESET SHIFT ANTREAN</strong> sekarang?
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
                <li>Seluruh antrean aktif hari ini (<strong>{totalTaken} tiket</strong>) akan dipindahkan ke tabel <strong>Riwayat Laporan</strong>.</li>
                <li>Panggilan pada layar TV Display dan konsol petugas akan di-bersihkan.</li>
                <li>Nomor tiket pendaftaran berikutnya akan kembali dimulai dari <strong>001</strong>.</li>
              </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowResetConfirmModal(false)}
                disabled={isResettingShift}
                style={{ padding: '0.75rem 1.4rem', fontWeight: '600' }}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleExecuteShiftReset}
                disabled={isResettingShift}
                style={{ padding: '0.75rem 1.4rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <RefreshCw size={18} className={isResettingShift ? 'animate-spin' : ''} />
                {isResettingShift ? 'Memproses Reset...' : 'Ya, Reset Shift Sekarang (001)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
