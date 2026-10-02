import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Volume2, VolumeX, Tv, Radio, Sparkles, Clock, Ticket, SkipForward, SkipBack } from 'lucide-react';
import { ttsEngine } from '../services/tts';
import { parseVideoUrl, getLayoutGridTemplate } from '../utils/videoHelper';

export default function TvDisplayView({ hospital, clinics = [], tickets = [], lastCall }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [audioUnlocked, setAudioUnlocked] = useState(() => {
    try {
      const saved = localStorage.getItem('tv_audio_unlocked');
      return saved !== '0';
    } catch {
      return true;
    }
  });
  const [isVideoDucked, setIsVideoDucked] = useState(false);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [clinicPageIndex, setClinicPageIndex] = useState(0);

  const videoRef = useRef(null);
  const iframeRef = useRef(null);

  // Digital clock update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto page rotation for clinics if more than 4 clinics exist
  useEffect(() => {
    if (!clinics || clinics.length <= 4) {
      setClinicPageIndex(0);
      return;
    }
    const pageCount = Math.ceil(clinics.length / 4);
    const timer = setInterval(() => {
      setClinicPageIndex((prev) => (prev + 1) % pageCount);
    }, 8000); // Switch page every 8 seconds

    return () => clearInterval(timer);
  }, [clinics?.length]);

  // Global automatic audio initialization on mount
  useEffect(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const dummyCtx = new AudioCtx();
        if (dummyCtx.state === 'suspended') {
          dummyCtx.resume().catch(() => {});
        }
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.getVoices();
      }
      if (videoRef.current) {
        videoRef.current.muted = false;
        videoRef.current.volume = 1.0;
        videoRef.current.play().catch(() => {
          // If browser policy requires gesture before first unmuted play, fallback to muted then unmute on first gesture
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch(() => {});
          }
        });
      }
    } catch (e) {
      console.warn('Auto sound init:', e);
    }
  }, []);

  // Global user gesture listener for automatic sound reinforcement
  useEffect(() => {
    const unlockAudio = () => {
      setAudioUnlocked(true);
      if (videoRef.current) {
        videoRef.current.muted = false;
        videoRef.current.volume = 1.0;
      }
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        }
      } catch {}
    };

    window.addEventListener('click', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('pointerdown', unlockAudio, { passive: true });

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('pointerdown', unlockAudio);
    };
  }, []);

  // Setup TTS audio ducking callbacks
  useEffect(() => {
    ttsEngine.setDuckingCallbacks(
      () => {
        setIsVideoDucked(true);
        if (videoRef.current) videoRef.current.volume = 0.15; // Duck volume to 15%
      },
      () => {
        setIsVideoDucked(false);
        if (videoRef.current) videoRef.current.volume = 1.0; // Restore volume to 100%
      }
    );
  }, []);

  // Trigger TTS voice when new call arrives
  useEffect(() => {
    if (lastCall && lastCall.ticket) {
      setAudioUnlocked(true);
      ttsEngine.speakCall(
        lastCall.ticket,
        lastCall.ticket.counterName,
        lastCall.ticket.clinicName
      );
    }
  }, [lastCall]);

  const handleUnlockAudio = (e) => {
    e?.stopPropagation();
    setAudioUnlocked(true);
    try {
      localStorage.setItem('tv_audio_unlocked', '1');
    } catch {}
    ttsEngine.playChime();
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = 1.0;
      videoRef.current.play().catch(err => console.warn('Video play error:', err));
    }
    // Unmute YouTube iframe via postMessage
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: [] }), '*');
        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }), '*');
        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
      }
    } catch (err) {}
  };

  const handleToggleAudio = (e) => {
    e?.stopPropagation();
    if (!audioUnlocked) {
      handleUnlockAudio();
    } else {
      setAudioUnlocked(false);
      if (videoRef.current) videoRef.current.muted = true;
      try {
        if (iframeRef.current && iframeRef.current.contentWindow) {
          iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: [] }), '*');
        }
      } catch (err) {}
    }
  };

  const handlePageClick = () => {
    if (!audioUnlocked) {
      handleUnlockAudio();
    }
  };

  const [failedVideoIds, setFailedVideoIds] = useState(new Set());
  const [infoSlideIndex, setInfoSlideIndex] = useState(0);

  const rawVideos = hospital?.videoList || [];
  const videoList = rawVideos.length > 0 ? rawVideos : [
    { id: 'v1', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', title: 'Profil RSUD', duration: 30 }
  ];

  const isSingleVideo = videoList.length <= 1;
  const currentVid = videoList[currentVideoIndex % videoList.length];

  const parsedVideo = useMemo(() => {
    if (!currentVid) return { type: 'unknown', url: '', embedUrl: '' };
    if (currentVid.localUrl) {
      return {
        type: 'direct',
        url: currentVid.localUrl,
        embedUrl: currentVid.localUrl
      };
    }
    return parseVideoUrl(currentVid.url, !audioUnlocked, isSingleVideo);
  }, [currentVid, audioUnlocked, isSingleVideo]);

  const displaySettings = hospital?.displaySettings || {
    layoutRatio: '50-50',
    aspectRatio: '16-9',
    objectFit: 'contain',
    position: 'right'
  };

  // Rotate info slides if video is not available or fails
  useEffect(() => {
    const timer = setInterval(() => {
      setInfoSlideIndex((prev) => (prev + 1) % 3);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  // Listen to YouTube Iframe postMessage events (onStateChange=0 ENDED triggers immediate video rotation)
  useEffect(() => {
    const handleWindowMessage = (event) => {
      try {
        let data = event.data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch (e) { return; }
        }
        if (!data) return;

        const state = data.info?.playerState !== undefined ? data.info.playerState : data.info;
        if (state === 0 || (data.event === 'onStateChange' && data.info === 0)) {
          console.log('[TvDisplay] YouTube video completed (state 0), advancing to next video!');
          if (videoList.length > 1) {
            setCurrentVideoIndex((prev) => (prev + 1) % videoList.length);
          }
        }
      } catch (err) {}
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [videoList.length]);

  // Handshake and auto un-mute YouTube iframe when index changes
  useEffect(() => {
    if (parsedVideo.type === 'youtube') {
      const t = setTimeout(() => {
        try {
          if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1 }), '*');
            if (audioUnlocked) {
              iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: [] }), '*');
              iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }), '*');
            }
            iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
          }
        } catch (e) {}
      }, 700);
      return () => clearTimeout(t);
    }
  }, [currentVideoIndex, audioUnlocked, parsedVideo.type]);

  // Auto rotate playlist if multiple videos exist
  useEffect(() => {
    if (videoList.length <= 1) return;

    let switchMs = 30000; // default 30s
    const customSec = currentVid?.duration ? parseInt(currentVid.duration) : null;

    if (customSec && !isNaN(customSec) && customSec > 5) {
      switchMs = customSec * 1000;
    } else if (parsedVideo.type === 'direct') {
      // Direct video advances on onEnded, but safety watchdog at 60s
      switchMs = 60000;
    } else if (parsedVideo.type === 'tiktok' || parsedVideo.type === 'instagram') {
      switchMs = 30000; // 30s for TikTok and Instagram Reels
    } else if (parsedVideo.type === 'youtube') {
      switchMs = 75000; // 75s safety fallback for YouTube (switches immediately upon end event)
    } else if (parsedVideo.type === 'gdrive') {
      switchMs = 60000; // 60s for Google Drive
    } else {
      switchMs = 60000;
    }

    if (switchMs > 0) {
      const timer = setTimeout(() => {
        console.log(`[TvDisplay] Timer reached ${switchMs}ms, advancing to next video...`);
        setCurrentVideoIndex((prev) => (prev + 1) % videoList.length);
      }, switchMs);
      return () => clearTimeout(timer);
    }
  }, [currentVideoIndex, videoList.length, parsedVideo.type, currentVid?.duration]);

  // Auto load & play direct video file when index changes with sound active
  useEffect(() => {
    if (parsedVideo.type === 'direct' && videoRef.current) {
      try {
        videoRef.current.load();
        videoRef.current.muted = false;
        videoRef.current.volume = 1.0;
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            console.warn('Auto-play video notice:', err);
            // Fallback to muted if browser blocks unmuted direct autoplay
            if (videoRef.current) {
              videoRef.current.muted = true;
              videoRef.current.play().catch(() => {});
            }
          });
        }
      } catch (e) {
        console.warn('Video load exception:', e);
      }
    }
  }, [currentVideoIndex, videoList, parsedVideo.type]);

  const handleVideoEnded = () => {
    setCurrentVideoIndex((prev) => (prev + 1) % videoList.length);
  };

  const handleVideoError = (e) => {
    console.warn('Video playback error, skipping:', currentVid?.url, e);
    if (currentVid?.id) {
      setFailedVideoIds(prev => new Set(prev).add(currentVid.id));
    }
    if (videoList.length > 1) {
      setCurrentVideoIndex((prev) => (prev + 1) % videoList.length);
    }
  };

  // Robust Date Normalization for real-time ticket syncing (automatically updates at midnight)
  const todayStr = currentTime.toLocaleDateString('en-CA');
  const getNormalizedDate = (d) => {
    if (!d) return todayStr;
    if (typeof d === 'string') return d.split('T')[0];
    try {
      return new Date(d).toLocaleDateString('en-CA');
    } catch {
      return todayStr;
    }
  };

  const todayTickets = (tickets || []).filter(t => getNormalizedDate(t.date) === todayStr);

  // Active tickets currently called or serving
  const activeTickets = todayTickets.filter(t => t.status === 'CALLED' || t.status === 'SERVING');
  
  // Latest call overall (strictly for today's active operational day)
  const isLatestCallToday = lastCall?.ticket && getNormalizedDate(lastCall.ticket.date) === todayStr;
  const latestCallTicket = isLatestCallToday ? lastCall.ticket : activeTickets[activeTickets.length - 1];

  const isVideoPlayable = Boolean(
    currentVid?.url && (
      (parsedVideo.type === 'youtube' && parsedVideo.videoId) ||
      (parsedVideo.type === 'gdrive' && parsedVideo.fileId) ||
      (parsedVideo.type === 'tiktok' && (parsedVideo.videoId || parsedVideo.shortcode || parsedVideo.embedUrl)) ||
      (parsedVideo.type === 'instagram' && parsedVideo.shortcode) ||
      (parsedVideo.type === 'direct' && !failedVideoIds.has(currentVid.id))
    )
  );

  // Clinics pagination calculation (4 per page)
  const CLINICS_PER_PAGE = 4;
  const safeClinics = clinics || [];
  const totalClinicPages = Math.max(1, Math.ceil(safeClinics.length / CLINICS_PER_PAGE));
  const currentClinicPage = clinicPageIndex % totalClinicPages;
  const visibleClinics = safeClinics.slice(
    currentClinicPage * CLINICS_PER_PAGE,
    (currentClinicPage + 1) * CLINICS_PER_PAGE
  );

  const defaultInfoSlides = [
    {
      tag: 'INFORMASI LAYANAN',
      icon: '🏥',
      title: hospital?.name ? hospital.name.toUpperCase() : 'INFORMASI LAYANAN',
      subtitle: hospital?.tagline || 'Melayani Sepenuh Hati Dengan Sentuhan Kasih',
      description: 'Kami berkomitmen memberikan pelayanan kesehatan berkualitas tinggi dengan fasilitas modern dan tenaga medis profesional.'
    },
    {
      tag: 'ALUR ANTREAN',
      icon: '🎫',
      title: 'AMBIL TIKET ANTREAN',
      subtitle: 'Gunakan Kiosk Mandiri di Pintu Masuk',
      description: 'Silakan ambil nomor antrean sesuai Poliklinik tujuan Anda dan perhatikan nomor panggil pada Layar Monitor ini.'
    },
    {
      tag: 'EDUKASI KESEHATAN',
      icon: '💡',
      title: 'JAGA POLA HIDUP SEHAT',
      subtitle: 'Cuci Tangan & Pakai Masker',
      description: 'Selalu terapkan protokol kesehatan, cuci tangan 6 langkah, serta jaga kebersihan di area rumah sakit.'
    }
  ];

  const infoSlides = (hospital?.infoSlides && hospital.infoSlides.length > 0) 
    ? hospital.infoSlides 
    : defaultInfoSlides;

  const currentSlide = infoSlides[infoSlideIndex % infoSlides.length];

  return (
    <div className="tv-layout" onClick={handlePageClick}>
      {/* Prominent floating prompt when audio is not unlocked yet */}
      {!audioUnlocked && (
        <div
          onClick={handleUnlockAudio}
          style={{
            position: 'fixed',
            top: '16px',
            right: '24px',
            zIndex: 99999,
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            color: 'white',
            padding: '10px 22px',
            borderRadius: '50px',
            boxShadow: '0 8px 30px rgba(2, 132, 199, 0.45)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            fontSize: '0.88rem',
            fontWeight: '800',
            border: '2px solid rgba(255,255,255,0.4)',
            animation: 'pulse 2s infinite'
          }}
        >
          <Volume2 size={20} />
          <span>🔊 Klik untuk Aktifkan Suara TV (Video & Antrean)</span>
        </div>
      )}

      {/* TV Header (Light Theme) */}
      <div className="tv-header">
        <div className="tv-hospital-name">
          <div style={{ width: '52px', height: '52px', background: 'white', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '4px', border: '1px solid #e2e8f0', boxShadow: '0 4px 10px rgba(0,0,0,0.06)' }}>
            {hospital?.logo ? (
              <img src={hospital.logo} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: '1.6rem' }}>🏥</span>
            )}
          </div>
          <div>
            <div style={{ color: '#0f172a', fontWeight: '800', fontSize: '1.6rem' }}>{hospital?.name || 'Rumah Sakit'}</div>
            <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: '600' }}>{hospital?.tagline || 'Layanan Kesehatan Cerdas'}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: '#ecfdf5',
            color: '#047857',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '0.85rem',
            fontWeight: '800',
            border: '1px solid #a7f3d0',
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.1)'
          }}>
            <Volume2 size={16} />
            <span>Suara TV Aktif</span>
          </div>

          <div className="tv-clock">
            {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB
          </div>
        </div>
      </div>

      {/* TV Body */}
      <div className="tv-body" style={{ gridTemplateColumns: getLayoutGridTemplate(displaySettings.layoutRatio, displaySettings.position) }}>
        {/* Left Side: Current Call Card & All Clinic Queue Cards */}
        <div className="tv-left" style={{ order: displaySettings.position === 'left' ? 2 : 1 }}>
          {latestCallTicket ? (
            <div className="current-call-card">
              <div className="current-call-label">PANGGILAN AKTIF SAAT INI</div>
              <div className="current-call-number">{latestCallTicket.ticketNumber}</div>
              <div className="current-call-destination">
                {latestCallTicket.counterName ? `${latestCallTicket.counterName} • ` : ''}{latestCallTicket.clinicName}
              </div>
            </div>
          ) : (
            <div className="current-call-card" style={{ background: '#ffffff', border: '2px solid #bae6fd', boxShadow: '0 10px 30px rgba(2, 132, 199, 0.08)', animation: 'none' }}>
              <div className="current-call-label" style={{ color: '#0284c7' }}>STATUS ANTREAN SEKARANG</div>
              <div className="current-call-number" style={{ color: '#0f172a', fontSize: '6.5rem' }}>---</div>
              <div className="current-call-destination" style={{ color: '#475569', fontSize: '1.5rem' }}>Silakan mengambil tiket antrean di Kiosk & tunggu dipanggil</div>
            </div>
          )}

          {/* Grid of 4 Clinics per Page with Auto Rotation */}
          {totalClinicPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', background: '#ffffff', padding: '6px 14px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: '800', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                KATALOG POLIKLINIK ({clinics.length} POLI)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '900', color: '#0284c7', background: '#e0f2fe', padding: '3px 10px', borderRadius: '10px' }}>
                  Halaman {currentClinicPage + 1} dari {totalClinicPages}
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>
                  (Poli #{currentClinicPage * CLINICS_PER_PAGE + 1} s/d #{Math.min((currentClinicPage + 1) * CLINICS_PER_PAGE, clinics.length)})
                </span>
              </div>
            </div>
          )}

          <div className="tv-queue-grid">
            {visibleClinics.map((clinic) => {
              const clinicTickets = todayTickets.filter(t => t.clinicId === clinic.id);
              const waitingCount = clinicTickets.filter(t => t.status === 'WAITING').length;
              
              // Active call right now (CALLED or SERVING)
              const activeCall = clinicTickets.filter(t => t.status === 'CALLED' || t.status === 'SERVING').pop();
              
              // Last called ticket (if active call exists, use it; otherwise use last called/completed/skipped ticket today)
              const lastCalledTicket = activeCall || clinicTickets.filter(t => t.calledAt || t.status === 'COMPLETED' || t.status === 'SKIPPED').pop();
              
              // Last ticket taken at kiosk
              const lastTakenTicket = clinicTickets[clinicTickets.length - 1];

              const isCallActive = Boolean(activeCall);

              return (
                <div key={clinic.id} className="tv-clinic-box" style={{
                  background: '#ffffff',
                  border: isCallActive ? '2px solid #0284c7' : '1px solid #cbd5e1',
                  borderRadius: '16px',
                  padding: '1.1rem 1.25rem',
                  boxShadow: isCallActive ? '0 4px 18px rgba(2, 132, 199, 0.15)' : '0 4px 12px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  {/* Top Title Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '900', color: '#0284c7', background: '#e0f2fe', padding: '3px 9px', borderRadius: '10px' }}>
                        [{clinic.prefix}]
                      </span>
                      <span style={{ fontSize: '1.05rem', fontWeight: '800', color: '#0f172a' }}>
                        {clinic.name}
                      </span>
                    </div>

                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: '800',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      background: waitingCount > 0 ? '#fef3c7' : isCallActive ? '#e0f2fe' : '#f1f5f9',
                      color: waitingCount > 0 ? '#b45309' : isCallActive ? '#0284c7' : '#64748b'
                    }}>
                      {waitingCount > 0 ? `${waitingCount} Menunggu` : lastCalledTicket ? 'Antrean Selesai' : 'Belum Ada Antrean'}
                    </span>
                  </div>

                  {/* Grid of Dipanggil vs Terakhir Ambil */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center' }}>
                    {/* Left: Dipanggil */}
                    <div style={{ background: isCallActive ? '#f0f9ff' : '#f8fafc', padding: '8px 12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        DIPANGGIL:
                      </div>
                      <div style={{ fontSize: '1.75rem', fontWeight: '900', color: isCallActive ? '#0284c7' : lastCalledTicket ? '#334155' : '#cbd5e1', lineHeight: 1.1, marginTop: '2px' }}>
                        {lastCalledTicket ? lastCalledTicket.ticketNumber : '-'}
                      </div>
                      {lastCalledTicket && (
                        <div style={{ fontSize: '0.65rem', fontWeight: '700', color: isCallActive ? '#0284c7' : '#64748b', marginTop: '2px' }}>
                          {isCallActive ? '● Dipanggil/Melayani' : '● Selesai'}
                        </div>
                      )}
                    </div>

                    {/* Right: Terakhir Ambil */}
                    <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        TERAKHIR AMBIL:
                      </div>
                      <div style={{ fontSize: '1.75rem', fontWeight: '900', color: lastTakenTicket ? '#0d9488' : '#cbd5e1', lineHeight: 1.1, marginTop: '2px' }}>
                        {lastTakenTicket ? lastTakenTicket.ticketNumber : '-'}
                      </div>
                      {lastTakenTicket && (
                        <div style={{ fontSize: '0.65rem', fontWeight: '700', color: '#0d9488', marginTop: '2px' }}>
                          Total: {clinicTickets.length} Tiket
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Video Promo or Animated Medical Info Banner */}
        <div className="tv-right" style={{ order: displaySettings.position === 'left' ? 1 : 2 }}>
          <div className="video-player-container" style={{
            background: '#090d16',
            width: '100%',
            height: displaySettings.aspectRatio === 'full' ? '100%' : 'auto',
            aspectRatio: displaySettings.aspectRatio === '16-9' ? '16 / 9' : displaySettings.aspectRatio === '4-3' ? '4 / 3' : 'auto',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '20px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
            border: '2px solid #1e293b',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            {isVideoPlayable ? (
              ['youtube', 'gdrive', 'tiktok', 'instagram'].includes(parsedVideo.type) ? (
                <iframe
                  ref={iframeRef}
                  key={currentVid.id || currentVid.url}
                  src={parsedVideo.embedUrl}
                  title={currentVid.title || 'Video Promosi'}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  scrolling="no"
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    pointerEvents: 'auto'
                  }}
                />
              ) : (
                <video
                  key={currentVid.id || currentVid.localUrl || currentVid.url}
                  ref={videoRef}
                  src={parsedVideo.url}
                  autoPlay
                  playsInline
                  loop={videoList.length === 1}
                  muted={!audioUnlocked}
                  onEnded={handleVideoEnded}
                  onError={handleVideoError}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: displaySettings.objectFit || 'contain'
                  }}
                />
              )
            ) : (
              /* Animated Health & Info Slide Fallback Card */
              <div style={{ flex: 1, padding: '2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: 'white', position: 'relative', background: 'radial-gradient(circle at top right, rgba(255,255,255,0.15), transparent)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', background: 'rgba(255,255,255,0.2)', padding: '6px 16px', borderRadius: '20px', backdropFilter: 'blur(10px)' }}>
                    ✨ {currentSlide.tag}
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', opacity: 0.8 }}>
                    Info #{infoSlideIndex + 1} / {infoSlides.length}
                  </span>
                </div>

                <div style={{ margin: '2rem 0' }}>
                  <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>
                    {currentSlide.icon}
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: '800', lineHeight: 1.2, marginBottom: '0.5rem' }}>
                    {currentSlide.title}
                  </h2>
                  <div style={{ fontSize: '1.1rem', fontWeight: '700', opacity: 0.9, color: '#bae6fd', marginBottom: '1rem' }}>
                    {currentSlide.subtitle}
                  </div>
                  <p style={{ fontSize: '1.05rem', lineHeight: 1.6, opacity: 0.95, maxWidth: '90%' }}>
                    {currentSlide.description || currentSlide.desc}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {infoSlides.map((_, i) => (
                    <div
                      key={i}
                      style={{
                        height: '6px',
                        borderRadius: '3px',
                        flex: 1,
                        background: i === infoSlideIndex ? 'white' : 'rgba(255,255,255,0.3)',
                        transition: 'all 0.5s ease'
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Audio Ducking & Volume Status Overlay */}
            <div className="audio-ducking-indicator" style={{ background: 'rgba(255, 255, 255, 0.95)', color: '#0f172a', boxShadow: '0 2px 10px rgba(0,0,0,0.15)', border: '1px solid #cbd5e1' }}>
              {isVideoDucked ? (
                <>
                  <Volume2 size={16} style={{ color: '#0284c7', animation: 'bounce 1s infinite' }} />
                  <span style={{ fontWeight: '800', color: '#0284c7' }}>Suara Panggilan Aktif</span>
                </>
              ) : (
                <>
                  <Volume2 size={16} style={{ color: '#0d9488' }} />
                  <span>Media Promosi: <strong>{isVideoPlayable ? (currentVid?.title || 'Video RS') : currentSlide.title}</strong></span>
                </>
              )}
            </div>

            {/* Playlist Quick Controls (Previous, Next, Status & Sound) */}
            {isVideoPlayable && videoList.length > 1 && (
              <div style={{
                position: 'absolute',
                bottom: '12px',
                left: '12px',
                right: '12px',
                background: 'rgba(15, 23, 42, 0.88)',
                backdropFilter: 'blur(10px)',
                padding: '6px 12px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                zIndex: 30,
                color: 'white',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
              }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentVideoIndex((prev) => (prev - 1 + videoList.length) % videoList.length);
                  }}
                  title="Video Sebelumnya"
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '8px', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: '700' }}
                >
                  <SkipBack size={15} /> <span>Prev</span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', maxWidth: '50%' }}>
                  <span style={{ fontWeight: '800', color: '#38bdf8', fontSize: '0.75rem', flexShrink: 0 }}>
                    #{((currentVideoIndex % videoList.length) + 1)}/{videoList.length}
                  </span>
                  <span style={{ fontWeight: '700', fontSize: '0.78rem', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                    {currentVid?.title || 'Video Promosi'}
                  </span>
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: '800',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    flexShrink: 0,
                    background: parsedVideo.type === 'youtube' ? '#dc2626' : parsedVideo.type === 'tiktok' ? '#000000' : parsedVideo.type === 'instagram' ? '#c13584' : '#0284c7',
                    border: parsedVideo.type === 'tiktok' ? '1px solid #25f4ee' : 'none'
                  }}>
                    {parsedVideo.type.toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleToggleAudio}
                    title={audioUnlocked ? 'Bisu Suara' : 'Aktifkan Suara'}
                    style={{
                      background: audioUnlocked ? '#0284c7' : '#475569',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      padding: '5px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.75rem',
                      fontWeight: '800'
                    }}
                  >
                    {audioUnlocked ? <Volume2 size={15} /> : <VolumeX size={15} />}
                    <span>{audioUnlocked ? 'Suara ON' : 'Mute'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentVideoIndex((prev) => (prev + 1) % videoList.length);
                    }}
                    title="Video Selanjutnya"
                    style={{ background: '#0284c7', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '8px', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: '800' }}
                  >
                    <span>Next</span> <SkipForward size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Marquee Running Text (Light Bright Gradient) */}
      <div className="tv-marquee" style={{ background: 'linear-gradient(90deg, #0284c7, #0d9488)', color: 'white', fontWeight: '700' }}>
        <div className="marquee-text">
          {hospital?.runningText || `Selamat datang di ${hospital?.name || 'Rumah Sakit'}. Harap siapkan kartu identitas/BPJS Anda.`}
        </div>
      </div>
    </div>
  );
}
