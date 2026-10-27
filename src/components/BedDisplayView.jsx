import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BedDouble, 
  Maximize2, 
  Minimize2, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Building2, 
  Activity, 
  Home, 
  RefreshCw,
  Phone,
  MapPin,
  Calendar,
  Info,
  HeartPulse,
  ShieldCheck,
  X,
  ChevronRight,
  Stethoscope,
  Users,
  Sparkles,
  ExternalLink,
  ArrowRight,
  Play,
  Pause
} from 'lucide-react';
import { socket } from '../services/socket';

export default function BedDisplayView({ hospital, beds: initialBeds = [], onBackToKiosk }) {
  const [beds, setBeds] = useState(initialBeds);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Measure visible width to calculate exactly 5 large cards
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(1872);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    const ro = new ResizeObserver(updateWidth);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => {
      window.removeEventListener('resize', updateWidth);
      ro.disconnect();
    };
  }, []);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync beds prop if changed
  useEffect(() => {
    if (initialBeds && initialBeds.length > 0) {
      setBeds(initialBeds);
    }
  }, [initialBeds]);

  // Real-time synchronization via Socket.IO & Periodic Polling Fallback
  useEffect(() => {
    const fetchBeds = async () => {
      try {
        const res = await fetch('/api/beds');
        const data = await res.json();
        if (data.success && data.beds) {
          setBeds(data.beds);
        }
      } catch (err) {
        console.warn('Auto-sync bed display warning:', err);
      }
    };

    fetchBeds();

    function onBedsUpdated(updatedBeds) {
      if (Array.isArray(updatedBeds)) {
        setBeds(updatedBeds);
      }
    }

    socket.on('beds_updated', onBedsUpdated);
    const pollInterval = setInterval(fetchBeds, 15000);

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      socket.off('beds_updated', onBedsUpdated);
      clearInterval(pollInterval);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/beds');
      const data = await res.json();
      if (data.success && data.beds) {
        setBeds(data.beds);
      }
    } catch (e) {
      console.warn('Manual refresh warning:', e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const totalBeds = beds.reduce((acc, b) => acc + (Number(b.total) || 0), 0);
    const totalOccupied = beds.reduce((acc, b) => acc + (Number(b.occupied) || 0), 0);
    const totalAvailable = beds.reduce((acc, b) => acc + (Number(b.available) || 0), 0);
    const bor = totalBeds > 0 ? ((totalOccupied / totalBeds) * 100).toFixed(1) : 0;

    return { totalBeds, totalOccupied, totalAvailable, bor };
  }, [beds]);

  // Dimension calculations for 5 large cards on 1920x1080 display
  const gap = 20;
  const visibleCardsCount = 5;
  const cardWidth = Math.max(300, Math.floor((containerWidth - ((visibleCardsCount - 1) * gap)) / visibleCardsCount));
  const shouldScroll = beds.length > 5;
  const scrollDuration = Math.max(25, beds.length * 5.5);

  // Helper for Class Color Theme (Light, Elegant, High Contrast)
  const getClassBadgeStyle = (cls) => {
    const c = (cls || '').toUpperCase();
    if (c.includes('VVIP')) {
      return { bg: '#faf5ff', border: '#e9d5ff', text: '#7e22ce', dot: '#9333ea', label: 'VVIP' };
    }
    if (c.includes('VIP')) {
      return { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', dot: '#2563eb', label: 'VIP' };
    }
    if (c.includes('1') || c.includes('SATU')) {
      return { bg: '#f0f9ff', border: '#bae6fd', text: '#0369a1', dot: '#0284c7', label: 'Kelas 1' };
    }
    if (c.includes('2') || c.includes('DUA')) {
      return { bg: '#f0fdfa', border: '#99f6e4', text: '#0f766e', dot: '#0d9488', label: 'Kelas 2' };
    }
    if (c.includes('3') || c.includes('TIGA')) {
      return { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', dot: '#16a34a', label: 'Kelas 3' };
    }
    if (c.includes('ICU') || c.includes('NICU') || c.includes('PICU')) {
      return { bg: '#fff1f2', border: '#fecdd3', text: '#be123c', dot: '#e11d48', label: 'Intensive' };
    }
    if (c.includes('ISOLASI')) {
      return { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c', dot: '#ea580c', label: 'Isolasi' };
    }
    return { bg: '#f8fafc', border: '#e2e8f0', text: '#475569', dot: '#64748b', label: cls || 'Kamar' };
  };

  const hospitalPhone = hospital?.printSettings?.hospitalPhone || hospital?.phone || '(0271) 644370';
  const hospitalAddress = hospital?.printSettings?.hospitalAddress || hospital?.address || 'Jl. Raya Sragen - Solo No.Km. 8, Masaran, Sragen, Jawa Tengah';
  const hospitalWebsite = hospital?.printSettings?.qrCodeLabel || 'rsupkumuhsragen.com';

  // Component to render each large bed card
  const renderBedCard = (bed, key) => {
    const total = Number(bed.total) || 0;
    const occ = Number(bed.occupied) || 0;
    const avail = Number(bed.available) || 0;
    const occPct = total > 0 ? Math.round((occ / total) * 100) : 0;
    const isFull = avail <= 0;
    const badgeStyle = getClassBadgeStyle(bed.bedClass);

    return (
      <div
        key={key}
        style={{
          width: `${cardWidth}px`,
          minWidth: `${cardWidth}px`,
          maxWidth: `${cardWidth}px`,
          height: '100%',
          background: '#ffffff',
          border: isFull ? '2px solid #fecaca' : '1.5px solid #e2e8f0',
          borderRadius: '24px',
          padding: '1.4rem 1.3rem',
          boxShadow: isFull 
            ? '0 6px 20px rgba(239, 68, 68, 0.08)' 
            : '0 10px 25px -4px rgba(15, 23, 42, 0.06), 0 2px 6px -1px rgba(15, 23, 42, 0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
          transition: 'transform 0.2s ease, box-shadow 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = isFull
            ? '0 12px 28px rgba(239, 68, 68, 0.16)'
            : '0 14px 30px -4px rgba(13, 148, 136, 0.14), 0 4px 10px -2px rgba(15, 23, 42, 0.06)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = isFull
            ? '0 6px 20px rgba(239, 68, 68, 0.08)'
            : '0 10px 25px -4px rgba(15, 23, 42, 0.06), 0 2px 6px -1px rgba(15, 23, 42, 0.02)';
        }}
      >
        {/* Card Content Top */}
        <div>
          {/* Header Badges */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{
              padding: '6px 14px',
              borderRadius: '10px',
              fontSize: '0.86rem',
              fontWeight: '800',
              letterSpacing: '0.04em',
              background: badgeStyle.bg,
              border: `1.5px solid ${badgeStyle.border}`,
              color: badgeStyle.text,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: badgeStyle.dot }}></span>
              {bed.bedClass}
            </span>

            {bed.gender && bed.gender !== 'Semua' && (
              <span style={{
                fontSize: '0.76rem',
                fontWeight: '800',
                padding: '4px 10px',
                borderRadius: '8px',
                background: bed.gender === 'Pria' ? '#eff6ff' : '#fdf2f8',
                color: bed.gender === 'Pria' ? '#2563eb' : '#db2777',
                border: `1px solid ${bed.gender === 'Pria' ? '#bfdbfe' : '#fbcfe8'}`
              }}>
                {bed.gender === 'Pria' ? 'Khusus Pria' : 'Khusus Wanita'}
              </span>
            )}
          </div>

          {/* Room Name */}
          <h3 
            title={bed.roomName}
            style={{
              fontSize: '1.85rem',
              fontWeight: '900',
              color: '#0f172a',
              marginBottom: '14px',
              lineHeight: '1.22',
              letterSpacing: '-0.025em',
              minHeight: '4.6rem',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word'
            }}
          >
            {(bed.roomName || '').replace(/\(([^)]+)\)/g, (m) => m.replace(/\s+/g, '\u00A0'))}
          </h3>

          {/* Visual Progress Bar */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.8rem',
              color: '#64748b',
              marginBottom: '4px',
              fontWeight: '700'
            }}>
              <span>Tingkat Keterisian (BOR)</span>
              <span><strong style={{ color: isFull ? '#dc2626' : occPct > 75 ? '#d97706' : '#059669', fontSize: '0.9rem' }}>{occPct}%</strong></span>
            </div>
            <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(100, Math.max(0, occPct))}%`,
                height: '100%',
                background: isFull 
                  ? '#ef4444' 
                  : occPct > 75 
                  ? 'linear-gradient(90deg, #f59e0b, #ef4444)' 
                  : 'linear-gradient(90deg, #10b981, #059669)',
                borderRadius: '999px',
                transition: 'width 0.4s ease'
              }}></div>
            </div>
          </div>

          {/* 3 Metric Boxes: KAPASITAS (Paling Atas), TERISI (Bawahnya), SISA (Paling Bawah) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            {/* 1. Box Kapasitas (Paling Atas) */}
            <div style={{
              background: '#f0f9ff',
              border: '1.5px solid #bae6fd',
              borderRadius: '14px',
              padding: '7px 12px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                KAPASITAS
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '5px', margin: '1px 0' }}>
                <span style={{ fontSize: '2.1rem', fontWeight: '950', color: '#0284c7', lineHeight: 1 }}>{total}</span>
                <span style={{ fontSize: '0.85rem', color: '#0369a1', fontWeight: '800' }}>Tempat Tidur</span>
              </div>
              <div style={{ fontSize: '0.67rem', color: '#0284c7', fontWeight: '600' }}>
                Total kapasitas ruangan
              </div>
            </div>

            {/* 2. Box Terisi / Terpakai (Bawahnya Kapasitas) */}
            <div style={{
              background: '#fffbeb',
              border: '1.5px solid #fde68a',
              borderRadius: '14px',
              padding: '7px 12px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                TERPAKAI
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '5px', margin: '1px 0' }}>
                <span style={{ fontSize: '2.1rem', fontWeight: '950', color: '#d97706', lineHeight: 1 }}>{occ}</span>
                <span style={{ fontSize: '0.85rem', color: '#92400e', fontWeight: '800' }}>Pasien</span>
              </div>
              <div style={{ fontSize: '0.67rem', color: '#b45309', fontWeight: '600' }}>
                Sedang dalam perawatan medis
              </div>
            </div>

            {/* 3. Box Sisa / Kosong (Paling Bawah) */}
            <div style={{
              background: isFull ? '#fef2f2' : '#ecfdf5',
              border: isFull ? '1.5px solid #fecaca' : '2px solid #6ee7b7',
              borderRadius: '14px',
              padding: '7px 12px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: isFull ? 'none' : '0 3px 10px rgba(16, 185, 129, 0.12)'
            }}>
              <div style={{
                fontSize: '0.72rem',
                fontWeight: '800',
                color: isFull ? '#b91c1c' : '#047857',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                SISA (KOSONG)
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '5px', margin: '1px 0' }}>
                <span style={{ fontSize: '2.25rem', fontWeight: '950', color: isFull ? '#dc2626' : '#059669', lineHeight: 1 }}>{avail}</span>
                <span style={{ fontSize: '0.85rem', color: isFull ? '#b91c1c' : '#047857', fontWeight: '800' }}>Tempat Tidur</span>
              </div>
              <div style={{
                fontSize: '0.69rem',
                color: isFull ? '#991b1b' : '#065f46',
                fontWeight: '700'
              }}>
                {isFull ? 'Kamar Rawat Inap Penuh' : 'Siap Ditempati Pasien Baru'}
              </div>
            </div>
          </div>
        </div>

        {/* Card Bottom Status Strip */}
        <div style={{
          padding: '12px 14px',
          borderRadius: '12px',
          background: isFull ? '#fef2f2' : '#f0fdf4',
          border: isFull ? '1.5px solid #fecaca' : '1.5px solid #bbf7d0',
          color: isFull ? '#b91c1c' : '#15803d',
          fontSize: '0.9rem',
          fontWeight: '900',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          letterSpacing: '0.02em',
          textTransform: 'uppercase'
        }}>
          {isFull ? (
            <>
              <AlertCircle size={18} />
              <span>KAMAR PENUH (0 TT)</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={18} />
              <span>TERSEDIA {avail} TEMPAT TIDUR</span>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      width: '100vw',
      maxWidth: '1920px',
      height: '100vh',
      maxHeight: '1080px',
      margin: '0 auto',
      background: 'linear-gradient(180deg, #f0fdf4 0%, #f8fafc 180px, #f1f5f9 100%)',
      color: '#0f172a',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      overflow: 'hidden',
      userSelect: 'none',
      position: 'relative'
    }}>
      {/* 1. TOP HEADER BAR (LIGHT & ELEGANT) */}
      <header style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #e2e8f0',
        padding: '0.75rem 1.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
      }}>
        {/* Hospital Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {hospital?.logo ? (
            <div style={{
              width: '52px',
              height: '52px',
              background: '#ffffff',
              borderRadius: '14px',
              padding: '4px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img
                src={hospital.logo}
                alt="Logo RS"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
          ) : (
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #0d9488 0%, #10b981 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(13, 148, 136, 0.25)',
              color: '#ffffff'
            }}>
              <BedDouble size={28} />
            </div>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{
                fontSize: '1.35rem',
                fontWeight: '900',
                color: '#0f172a',
                letterSpacing: '-0.02em',
                margin: 0
              }}>
                {hospital?.name || 'RSU PKU MUHAMMADIYAH SRAGEN'}
              </h1>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: '800',
                padding: '3px 9px',
                borderRadius: '999px',
                background: '#ecfdf5',
                color: '#047857',
                border: '1px solid #a7f3d0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 8px #10b981'
                }}></span>
                LIVE REAL-TIME
              </span>
            </div>
            <p style={{
              fontSize: '0.82rem',
              color: '#64748b',
              margin: '3px 0 0 0',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>{hospital?.tagline || 'Layanan Paripurna dan Islami Untuk Kesehatan Ummat'}</span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{ color: '#0d9488', fontWeight: '700' }}>Ketersediaan Kamar Rawat Inap</span>
            </p>
          </div>
        </div>

        {/* Quick Contact & Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Quick Contact Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            padding: '6px 12px',
            borderRadius: '10px',
            color: '#be123c',
            fontSize: '0.78rem',
            fontWeight: '700'
          }}>
            <HeartPulse size={15} style={{ animation: 'pulse 1.8s infinite' }} />
            <span>IGD 24 Jam: <strong>{hospitalPhone}</strong></span>
          </div>

          {/* Digital Clock Box */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            padding: '6px 14px',
            borderRadius: '10px',
            textAlign: 'right',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}>
            <div style={{
              fontSize: '1.15rem',
              fontWeight: '900',
              color: '#0d9488',
              letterSpacing: '0.03em',
              fontFamily: "'Courier New', Courier, monospace"
            }}>
              {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '600' }}>
              {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>

          {/* Hospital Profile & Info Button */}
          <button
            onClick={() => setShowInfoModal(true)}
            style={{
              background: '#f0fdfa',
              border: '1px solid #99f6e4',
              color: '#0f766e',
              padding: '8px 14px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
              fontWeight: '700',
              boxShadow: '0 2px 4px rgba(15, 118, 110, 0.08)',
              transition: 'all 0.2s ease'
            }}
            title="Lihat Profil & Layanan Rumah Sakit"
          >
            <Info size={16} /> Informasi RS
          </button>

          {/* Auto-Scroll Pause / Resume Toggle */}
          {shouldScroll && (
            <button
              onClick={() => setIsPaused(prev => !prev)}
              style={{
                background: isPaused ? '#fffbeb' : '#ffffff',
                border: isPaused ? '1.5px solid #f59e0b' : '1px solid #e2e8f0',
                color: isPaused ? '#b45309' : '#475569',
                padding: '8px 12px',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                fontWeight: '700',
                boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                transition: 'all 0.2s'
              }}
              title={isPaused ? "Lanjutkan Bergulir Otomatis" : "Jeda Bergulir Otomatis"}
            >
              {isPaused ? <Play size={16} color="#d97706" /> : <Pause size={16} />}
              <span>{isPaused ? 'Lanjutkan Gulir' : 'Jeda Gulir'}</span>
            </button>
          )}

          {/* Refresh Button */}
          <button
            onClick={handleManualRefresh}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              color: '#475569',
              padding: '8px 10px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
              transition: 'all 0.2s'
            }}
            title="Perbarui Data Tempat Tidur"
          >
            <RefreshCw size={17} className={isRefreshing ? 'animate-spin' : ''} />
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              color: '#475569',
              padding: '8px 10px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
              transition: 'all 0.2s'
            }}
            title={isFullscreen ? 'Keluar Layar Penuh' : 'Mode Layar Penuh (TV Monitor)'}
          >
            {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>

          {/* Back Button (if provided) */}
          {onBackToKiosk && (
            <button
              onClick={onBackToKiosk}
              style={{
                background: '#10b981',
                border: 'none',
                color: '#ffffff',
                padding: '8px 15px',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                fontWeight: '700',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                transition: 'all 0.2s'
              }}
            >
              <Home size={15} /> Beranda
            </button>
          )}
        </div>
      </header>



      {/* 3. STATS OVERVIEW CARDS (KPI - LIGHT & ELEGANT) */}
      <section style={{ padding: '0.75rem 1.75rem 0.5rem 1.75rem' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px'
        }}>
          {/* Total Kapasitas */}
          <div style={{
            background: 'linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%)',
            border: '1px solid #bae6fd',
            borderRadius: '16px',
            padding: '1.2rem',
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.05)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Kapasitas Total
              </span>
              <div style={{ background: '#e0f2fe', padding: '7px', borderRadius: '10px', color: '#0284c7' }}>
                <BedDouble size={20} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '2.3rem', fontWeight: '900', color: '#0369a1', lineHeight: 1 }}>
                {stats.totalBeds}
              </span>
              <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '700' }}>Tempat Tidur</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#0284c7', marginTop: '6px', fontWeight: '600' }}>
              Total seluruh ruang rawat inap RS
            </div>
          </div>

          {/* Terpakai / Terisi */}
          <div style={{
            background: 'linear-gradient(135deg, #fffbeb 0%, #ffffff 100%)',
            border: '1px solid #fde68a',
            borderRadius: '16px',
            padding: '1.2rem',
            boxShadow: '0 4px 14px rgba(217, 119, 6, 0.05)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Jumlah Terpakai
              </span>
              <div style={{ background: '#fef3c7', padding: '7px', borderRadius: '10px', color: '#d97706' }}>
                <Activity size={20} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '2.3rem', fontWeight: '900', color: '#d97706', lineHeight: 1 }}>
                {stats.totalOccupied}
              </span>
              <span style={{ fontSize: '0.85rem', color: '#92400e', fontWeight: '700' }}>Pasien Dirawat</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#b45309', marginTop: '6px', fontWeight: '600' }}>
              Sedang dalam perawatan medis
            </div>
          </div>

          {/* Sisa / Tersedia (Highlight Utama) */}
          <div style={{
            background: 'linear-gradient(135deg, #ecfdf5 0%, #ffffff 100%)',
            border: '1.5px solid #6ee7b7',
            borderRadius: '16px',
            padding: '1.2rem',
            boxShadow: '0 6px 18px rgba(16, 185, 129, 0.1)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Sisa / Siap Pakai
              </span>
              <div style={{ background: '#d1fae5', padding: '7px', borderRadius: '10px', color: '#059669' }}>
                <CheckCircle2 size={20} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '2.3rem', fontWeight: '900', color: '#059669', lineHeight: 1 }}>
                {stats.totalAvailable}
              </span>
              <span style={{ fontSize: '0.85rem', color: '#065f46', fontWeight: '700' }}>TT Kosong</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#047857', marginTop: '6px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={13} /> Siap ditempati pasien baru
            </div>
          </div>

          {/* Bed Occupancy Rate (BOR) */}
          <div style={{
            background: 'linear-gradient(135deg, #eef2ff 0%, #ffffff 100%)',
            border: '1px solid #c7d2fe',
            borderRadius: '16px',
            padding: '1.2rem',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.05)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Tingkat Keterisian (BOR)
              </span>
              <div style={{ background: '#e0e7ff', padding: '7px', borderRadius: '10px', color: '#4f46e5' }}>
                <Layers size={20} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '2.3rem', fontWeight: '900', color: '#4338ca', lineHeight: 1 }}>
                {stats.bor}%
              </span>
              <span style={{ fontSize: '0.85rem', color: '#6366f1', fontWeight: '700' }}>Okupansi</span>
            </div>

            {/* Visual Progress Bar */}
            <div style={{ width: '100%', height: '7px', background: '#e2e8f0', borderRadius: '999px', marginTop: '8px', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(100, Math.max(0, stats.bor))}%`,
                height: '100%',
                background: stats.bor > 85 ? '#ef4444' : stats.bor > 70 ? '#f59e0b' : '#10b981',
                borderRadius: '999px',
                transition: 'width 0.4s ease'
              }}></div>
            </div>
          </div>
        </div>
      </section>



      {/* 3. BED CARDS (EXACTLY 5 LARGE CARDS VISIBLE - CONTINUOUS SEAMLESS MARQUEE) */}
      <main 
        ref={containerRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ 
          flex: 1, 
          minHeight: 0,
          padding: '0.25rem 1.75rem 0.75rem 1.75rem',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          width: '100%'
        }}
      >
        {beds.length === 0 ? (
          <div style={{
            width: '100%',
            background: '#ffffff',
            border: '1px dashed #cbd5e1',
            borderRadius: '20px',
            padding: '3rem 2rem',
            textAlign: 'center',
            color: '#64748b',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <BedDouble size={48} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
            <h3 style={{ fontSize: '1.2rem', color: '#1e293b', fontWeight: '800', marginBottom: '6px' }}>
              Belum Ada Data Tempat Tidur
            </h3>
            <p style={{ fontSize: '0.88rem', maxWidth: '450px', margin: '0 auto' }}>
              Data ketersediaan kamar rawat inap belum diisi atau sedang dalam proses pembaruan oleh petugas admisi.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexWrap: 'nowrap',
              width: 'max-content',
              height: '100%',
              maxHeight: '620px',
              alignItems: 'stretch',
              animation: shouldScroll ? `bedMarqueeScroll ${scrollDuration}s linear infinite` : 'none',
              animationPlayState: isHovered || isPaused ? 'paused' : 'running',
              willChange: 'transform'
            }}
          >
            {/* Set 1 */}
            <div style={{
              display: 'flex',
              flexWrap: 'nowrap',
              height: '100%',
              gap: `${gap}px`,
              paddingRight: shouldScroll ? `${gap}px` : 0,
              flexShrink: 0
            }}>
              {beds.map((bed, idx) => renderBedCard(bed, `set1-${bed.id || idx}`))}
            </div>

            {/* Set 2 (for continuous seamless looping to the left) */}
            {shouldScroll && (
              <div style={{
                display: 'flex',
                flexWrap: 'nowrap',
                height: '100%',
                gap: `${gap}px`,
                paddingRight: `${gap}px`,
                flexShrink: 0
              }}>
                {beds.map((bed, idx) => renderBedCard(bed, `set2-${bed.id || idx}`))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 6. HOSPITAL PROFILE & INFORMATION MODAL */}
      {showInfoModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1.25rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            maxWidth: '680px',
            width: '100%',
            maxHeight: '88vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.75rem',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#ffffff',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: '#f0fdfa',
                  color: '#0d9488',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Building2 size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                    Informasi & Profil Rumah Sakit
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0 0' }}>
                    {hospital?.name || 'RSU PKU MUHAMMADIYAH SRAGEN'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInfoModal(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div style={{ padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', flex: 1 }}>
              {/* About Card */}
              <div style={{ background: '#f8fafc', padding: '1.1rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: '#0f172a', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} color="#0d9488" /> Tentang Rumah Sakit
                </h4>
                <p style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.6, margin: 0 }}>
                  <strong>{hospital?.name || 'RSU PKU MUHAMMADIYAH SRAGEN'}</strong> merupakan rumah sakit rujukan dengan komitmen pelayanan kesehatan paripurna, berlandaskan nilai-nilai Islami, profesionalisme medis, serta fasilitas teknologi terpadu untuk masyarakat Masaran, Sragen dan sekitarnya.
                </p>
              </div>

              {/* Service Hours Grid */}
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: '#0f172a', marginBottom: '10px' }}>
                  Jadwal Layanan Utama
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                  <div style={{ padding: '12px', borderRadius: '12px', border: '1px solid #fecdd3', background: '#fff1f2' }}>
                    <div style={{ fontWeight: '800', fontSize: '0.82rem', color: '#be123c', marginBottom: '2px' }}>
                      🚨 IGD & Ambulans Siaga
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                      Buka <strong>24 Jam Nonstop</strong> setiap hari termasuk hari libur.
                    </div>
                  </div>

                  <div style={{ padding: '12px', borderRadius: '12px', border: '1px solid #a7f3d0', background: '#ecfdf5' }}>
                    <div style={{ fontWeight: '800', fontSize: '0.82rem', color: '#065f46', marginBottom: '2px' }}>
                      🏥 Admisi & Rawat Inap
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                      Pendaftaran kamar rawat inap buka <strong>24 Jam</strong> di loket admisi.
                    </div>
                  </div>

                  <div style={{ padding: '12px', borderRadius: '12px', border: '1px solid #bae6fd', background: '#f0f9ff' }}>
                    <div style={{ fontWeight: '800', fontSize: '0.82rem', color: '#0369a1', marginBottom: '2px' }}>
                      🩺 Poliklinik Rawat Jalan
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                      Senin s.d. Sabtu: <strong>08.00 - 20.00 WIB</strong> (Jadwal dokter tertera di APM).
                    </div>
                  </div>

                  <div style={{ padding: '12px', borderRadius: '12px', border: '1px solid #c7d2fe', background: '#eef2ff' }}>
                    <div style={{ fontWeight: '800', fontSize: '0.82rem', color: '#3730a3', marginBottom: '2px' }}>
                      ⏰ Jam Besuk Pasien
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                      Siang: <strong>11.00 - 13.00 WIB</strong> | Sore: <strong>17.00 - 19.00 WIB</strong>.
                    </div>
                  </div>
                </div>
              </div>

              {/* Class Facilities Info */}
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: '#0f172a', marginBottom: '10px' }}>
                  Fasilitas Kamar Rawat Inap
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', color: '#475569' }}>
                  <div style={{ padding: '8px 12px', background: '#faf5ff', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
                    <strong style={{ color: '#7e22ce' }}>VVIP:</strong> 1 Pasien/Kamar, AC, TV LED Smart, Lemari Es, Sofa Bed Keluarga, Kamar Mandi Water Heater, Paket Makan Pendamping.
                  </div>
                  <div style={{ padding: '8px 12px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                    <strong style={{ color: '#1d4ed8' }}>VIP:</strong> 1 Pasien/Kamar, AC, TV LED, Sofa Tamu, Kamar Mandi Dalam, Meja Makan Pasien.
                  </div>
                  <div style={{ padding: '8px 12px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                    <strong style={{ color: '#0369a1' }}>Kelas 1:</strong> 2 Pasien/Kamar, AC, TV, Kamar Mandi Dalam, Tirai Privasi Standar Rumah Sakit.
                  </div>
                  <div style={{ padding: '8px 12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                    <strong style={{ color: '#15803d' }}>Kelas 2 & 3:</strong> Ruang bersih ber-AC, Nurse Call 24 Jam, Lemari Pasien, Tempat Tidur Crank Medis.
                  </div>
                  <div style={{ padding: '8px 12px', background: '#fff1f2', borderRadius: '8px', border: '1px solid #fecdd3' }}>
                    <strong style={{ color: '#be123c' }}>ICU / NICU / PICU:</strong> Bed Monitoring Sentral 24 Jam, Ventilator, Syringe Pump, Tim Intensivist Siaga.
                  </div>
                </div>
              </div>

              {/* Contact & Location */}
              <div style={{ background: '#f8fafc', padding: '1.1rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: '#0f172a', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={16} color="#0d9488" /> Alamat & Kontak Resmi
                </h4>
                <div style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.6 }}>
                  <div>📍 <strong>Alamat:</strong> {hospitalAddress}</div>
                  <div>📞 <strong>Telepon / Call Center:</strong> {hospitalPhone}</div>
                  <div>🌐 <strong>Portal & Pendaftaran Online:</strong> <span style={{ color: '#0d9488', fontWeight: '700' }}>{hospitalWebsite}</span></div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1rem 1.75rem',
              borderTop: '1px solid #f1f5f9',
              background: '#fafafa',
              display: 'flex',
              justifyContent: 'flex-end',
              flexShrink: 0
            }}>
              <button
                onClick={() => setShowInfoModal(false)}
                style={{
                  background: '#0d9488',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 24px',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(13, 148, 136, 0.25)'
                }}
              >
                Tutup Informasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. RUNNING TEXT TICKER (FOOTER - STICKY & ELEGANT) */}
      <footer style={{
        background: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        padding: '10px 1.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        overflow: 'hidden',
        position: 'sticky',
        bottom: 0,
        zIndex: 40,
        boxShadow: '0 -4px 16px rgba(0,0,0,0.03)'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #0d9488 0%, #10b981 100%)',
          color: '#ffffff',
          fontSize: '0.72rem',
          fontWeight: '900',
          padding: '4px 12px',
          borderRadius: '8px',
          letterSpacing: '0.04em',
          flexShrink: 0,
          boxShadow: '0 2px 6px rgba(13, 148, 136, 0.25)'
        }}>
          INFORMASI RS
        </div>

        <div style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <div style={{
            display: 'inline-block',
            animation: 'marquee 75s linear infinite',
            fontSize: '0.84rem',
            color: '#334155',
            fontWeight: '600'
          }}>
            {hospital?.runningText || 'Data ketersediaan tempat tidur diperbarui secara berkala oleh staf admisi rumah sakit.'}
            &nbsp;&bull;&nbsp;
            <strong>{hospital?.name || 'RSU PKU MUHAMMADIYAH SRAGEN'}</strong>
            &nbsp;&bull;&nbsp;
            IGD & Ambulans 24 Jam: <strong>{hospitalPhone}</strong>
            &nbsp;&bull;&nbsp;
            Alamat: {hospitalAddress}
            &nbsp;&bull;&nbsp;
            Pendaftaran & Informasi Online: <strong>{hospitalWebsite}</strong>
            &nbsp;&bull;&nbsp;
            Jam Besuk Pasien: Siang 11.00 - 13.00 WIB &bull; Sore 17.00 - 19.00 WIB
          </div>
        </div>
      </footer>

      {/* Inline styles for keyframe animations */}
      <style>{`
        @keyframes bedMarqueeScroll {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-50%, 0, 0);
          }
        }
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.75; transform: scale(1.1); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
