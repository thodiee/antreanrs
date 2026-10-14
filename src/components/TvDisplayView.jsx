import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Volume2, VolumeX, Tv, Radio, Sparkles, Clock, Ticket, SkipForward, SkipBack, Building2, Lightbulb } from 'lucide-react';
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
  const [failedVideoIds, setFailedVideoIds] = useState(new Set());
  const [infoSlideIndex, setInfoSlideIndex] = useState(0);

  const videoRef = useRef(null);
  const iframeRef = useRef(null);

  const rawVideos = hospital?.videoList || [];
  const videoList = rawVideos.length > 0 ? rawVideos : [
    { id: 'v1', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', title: 'Profil RSUD', duration: 30, volume: 100 }
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

  // Helper refs to prevent stale closures in audio & tts callbacks
  const currentVidRef = useRef(currentVid);
  const audioUnlockedRef = useRef(audioUnlocked);
  const isVideoDuckedRef = useRef(isVideoDucked);

  useEffect(() => {
    currentVidRef.current = currentVid;
  }, [currentVid]);

  useEffect(() => {
    audioUnlockedRef.current = audioUnlocked;
  }, [audioUnlocked]);

  useEffect(() => {
    isVideoDuckedRef.current = isVideoDucked;
  }, [isVideoDucked]);

  // Hitung target volume video (0 s/d 1.0) berdasarkan konfigurasi per video
  const getVideoTargetVolume = (vid = currentVidRef.current) => {
    if (!vid) return 1.0;
    const vol = vid.volume !== undefined && vid.volume !== null ? Number(vid.volume) : 100;
    if (isNaN(vol)) return 1.0;
    return Math.max(0, Math.min(100, vol)) / 100;
  };

  // Handshake helper to command YouTube iframe
  const sendYouTubeCommand = (func, args = []) => {
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
      }
    } catch (e) {}
  };

  // Fungsi sentral untuk menerapkan volume & mute ke video lokal atau YouTube
  const applyVideoAudioState = (vid = currentVidRef.current, ducked = isVideoDuckedRef.current, unlocked = audioUnlockedRef.current) => {
    const rawTargetVol = getVideoTargetVolume(vid);
    if (videoRef.current) {
      if (ducked || rawTargetVol === 0 || !unlocked) {
        videoRef.current.volume = 0;
        videoRef.current.muted = true;
      } else {
        videoRef.current.volume = rawTargetVol;
        videoRef.current.muted = false;
      }
    }
    if (iframeRef.current && iframeRef.current.contentWindow) {
      if (ducked || rawTargetVol === 0 || !unlocked) {
        sendYouTubeCommand('mute');
        sendYouTubeCommand('setVolume', [0]);
      } else {
        sendYouTubeCommand('unMute');
        sendYouTubeCommand('setVolume', [Math.round(rawTargetVol * 100)]);
      }
    }
  };

  const initYouTubePlayer = () => {
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1 }), '*');
        const rawTargetVol = getVideoTargetVolume(currentVidRef.current);
        const unlocked = audioUnlockedRef.current;
        const ducked = isVideoDuckedRef.current;
        if (unlocked && !ducked && rawTargetVol > 0) {
          sendYouTubeCommand('unMute');
          sendYouTubeCommand('setVolume', [Math.round(rawTargetVol * 100)]);
        } else {
          sendYouTubeCommand('mute');
          sendYouTubeCommand('setVolume', [0]);
        }
        sendYouTubeCommand('playVideo');
      }
    } catch (e) {}
  };

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
        applyVideoAudioState(currentVid, isVideoDucked, audioUnlocked);
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
      audioUnlockedRef.current = true;
      applyVideoAudioState(currentVidRef.current, isVideoDuckedRef.current, true);
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

  // Setup TTS audio ducking callbacks: Hilangkan tabrakan suara dengan membisukan video saat nomor dipanggil
  useEffect(() => {
    ttsEngine.setDuckingCallbacks(
      () => {
        setIsVideoDucked(true);
        isVideoDuckedRef.current = true;
        // Bisukan video total (volume 0 & muted) selama nomor antrean dipanggil agar tidak bertabrakan!
        if (videoRef.current) {
          videoRef.current.volume = 0;
          videoRef.current.muted = true;
        }
        sendYouTubeCommand('mute');
        sendYouTubeCommand('setVolume', [0]);
      },
      () => {
        setIsVideoDucked(false);
        isVideoDuckedRef.current = false;
        // Kembalikan ke volume yang diatur per video setelah pemanggilan selesai
        const vid = currentVidRef.current;
        const unlocked = audioUnlockedRef.current;
        const rawTargetVol = getVideoTargetVolume(vid);
        if (videoRef.current) {
          if (rawTargetVol === 0 || !unlocked) {
            videoRef.current.volume = 0;
            videoRef.current.muted = true;
          } else {
            videoRef.current.volume = rawTargetVol;
            videoRef.current.muted = false;
          }
        }
        if (unlocked && rawTargetVol > 0) {
          sendYouTubeCommand('unMute');
          sendYouTubeCommand('setVolume', [Math.round(rawTargetVol * 100)]);
        }
      }
    );
  }, []);

  // Terapkan volume & mute setiap kali video berganti atau status audio berubah
  useEffect(() => {
    applyVideoAudioState(currentVid, isVideoDucked, audioUnlocked);
  }, [currentVid, isVideoDucked, audioUnlocked]);

  // Trigger TTS voice when new call arrives
  useEffect(() => {
    if (lastCall && lastCall.ticket) {
      setAudioUnlocked(true);
      audioUnlockedRef.current = true;
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
    audioUnlockedRef.current = true;
    try {
      localStorage.setItem('tv_audio_unlocked', '1');
    } catch {}
    ttsEngine.playChime();
    applyVideoAudioState(currentVidRef.current, isVideoDuckedRef.current, true);
    if (videoRef.current) {
      videoRef.current.play().catch(err => console.warn('Video play error:', err));
    }
    if (parsedVideo.type === 'youtube') {
      sendYouTubeCommand('playVideo');
    }
  };

  const handleToggleAudio = (e) => {
    e?.stopPropagation();
    if (!audioUnlocked) {
      handleUnlockAudio();
    } else {
      setAudioUnlocked(false);
      audioUnlockedRef.current = false;
      applyVideoAudioState(currentVidRef.current, isVideoDuckedRef.current, false);
    }
  };

  const handlePageClick = () => {
    if (!audioUnlocked) {
      handleUnlockAudio();
    }
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

        const info = data.info;
        const playerState = info?.playerState !== undefined ? info.playerState : (typeof info === 'number' ? info : undefined);
        const isEnded = playerState === 0 || (data.event === 'onStateChange' && (data.info === 0 || data.info?.playerState === 0));

        if (isEnded) {
          console.log('[TvDisplay] YouTube video selesai (state 0), berganti ke video berikutnya...');
          if (videoList.length > 1) {
            setCurrentVideoIndex((prev) => (prev + 1) % videoList.length);
          }
        }
      } catch (err) {}
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [videoList.length]);

  // Handshake and auto un-mute YouTube iframe when index changes (multi-stage timeouts to ensure iframe is ready)
  useEffect(() => {
    if (parsedVideo.type === 'youtube') {
      initYouTubePlayer();
      const t1 = setTimeout(initYouTubePlayer, 600);
      const t2 = setTimeout(initYouTubePlayer, 1500);
      const t3 = setTimeout(initYouTubePlayer, 3000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [currentVideoIndex, audioUnlocked, parsedVideo.type]);

  // Auto rotate playlist if multiple videos exist based on configured duration
  useEffect(() => {
    if (videoList.length <= 1) return;

    const rawDuration = (currentVid?.duration !== undefined && currentVid?.duration !== null)
      ? parseInt(currentVid.duration)
      : 0;

    // rawDuration === 0: "Putar Sampai Selesai (Otomatis)"
    if (!rawDuration || rawDuration <= 0) {
      if (parsedVideo.type === 'direct') {
        // File video langsung (.mp4/.webm) akan memanggil handleVideoEnded via event onEnded.
        // Failsafe watchdog 60 menit jika video macet
        const watchdog = setTimeout(() => {
          console.log('[TvDisplay] Watchdog tercapai untuk video langsung (60m), berganti...');
          setCurrentVideoIndex((prev) => (prev + 1) % videoList.length);
        }, 60 * 60 * 1000);
        return () => clearTimeout(watchdog);
      } else if (parsedVideo.type === 'youtube') {
        // YouTube akan memicu pergantian saat state 0 (ENDED).
        // Failsafe watchdog 60 menit agar video panjang (seminar/profil RS) tidak terpotong
        const watchdog = setTimeout(() => {
          console.log('[TvDisplay] Watchdog tercapai untuk YouTube (60m), berganti...');
          setCurrentVideoIndex((prev) => (prev + 1) % videoList.length);
        }, 60 * 60 * 1000);
        return () => clearTimeout(watchdog);
      } else if (parsedVideo.type === 'gdrive') {
        // Google Drive preview iframe tidak mengirim event tamat ke window induk.
        // Default 180 detik (3 menit) jika dipilih otomatis
        const timer = setTimeout(() => {
          console.log('[TvDisplay] Google Drive mencapai durasi bawaan 180s, berganti...');
          setCurrentVideoIndex((prev) => (prev + 1) % videoList.length);
        }, 180 * 1000);
        return () => clearTimeout(timer);
      } else {
        // TikTok / Instagram
        const timer = setTimeout(() => {
          console.log('[TvDisplay] Video sosial media mencapai durasi 60s, berganti...');
          setCurrentVideoIndex((prev) => (prev + 1) % videoList.length);
        }, 60 * 1000);
        return () => clearTimeout(timer);
      }
    } else {
      // Durasi kustom yang ditentukan secara spesifik (misal 30 dtk, 60 dtk, 180 dtk, 300 dtk, dst)
      const switchMs = Math.max(rawDuration, 5) * 1000;
      const timer = setTimeout(() => {
        console.log(`[TvDisplay] Timer durasi ${switchMs}ms (${rawDuration}s) tercapai, berganti ke video berikutnya...`);
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
        applyVideoAudioState(currentVid, isVideoDucked, audioUnlocked);
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

  // Clinics pagination calculation (4 per page paten)
  const CLINICS_PER_PAGE = 4;
  const safeClinics = clinics || [];
  const totalClinicPages = Math.max(1, Math.ceil(safeClinics.length / CLINICS_PER_PAGE));
  const currentClinicPage = clinicPageIndex % totalClinicPages;
  const visibleClinics = safeClinics.slice(
    currentClinicPage * CLINICS_PER_PAGE,
    (currentClinicPage + 1) * CLINICS_PER_PAGE
  );
  const paddedClinics = useMemo(() => {
    const list = [...visibleClinics];
    while (list.length < CLINICS_PER_PAGE) {
      list.push(null);
    }
    return list;
  }, [visibleClinics]);

  const defaultInfoSlides = [
    {
      tag: 'INFORMASI LAYANAN',
      icon: 'hospital',
      title: hospital?.name ? hospital.name.toUpperCase() : 'INFORMASI LAYANAN',
      subtitle: hospital?.tagline || 'Melayani Sepenuh Hati Dengan Sentuhan Kasih',
      description: 'Kami berkomitmen memberikan pelayanan kesehatan berkualitas tinggi dengan fasilitas modern dan tenaga medis profesional.'
    },
    {
      tag: 'ALUR ANTREAN',
      icon: 'ticket',
      title: 'AMBIL TIKET ANTREAN',
      subtitle: 'Gunakan Kiosk Mandiri di Pintu Masuk',
      description: 'Silakan ambil nomor antrean sesuai Poliklinik tujuan Anda dan perhatikan nomor panggil pada Layar Monitor ini.'
    },
    {
      tag: 'EDUKASI KESEHATAN',
      icon: 'bulb',
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
          className="tv-audio-banner"
          style={{
            position: 'fixed',
            top: '16px',
            right: '24px',
            zIndex: 99999,
            background: 'linear-gradient(135deg, #15803d 0%, #166534 100%)',
            color: 'white',
            padding: '10px 22px',
            borderRadius: '50px',
            boxShadow: '0 8px 30px rgba(234, 179, 8, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            fontSize: '0.88rem',
            fontWeight: '800',
            border: '2px solid #fde047',
            animation: 'pulse 2s infinite'
          }}
        >
          <Volume2 size={20} color="#fef08a" />
          <span>Klik untuk Aktifkan Suara TV (Video & Antrean)</span>
        </div>
      )}

      {/* TV Header (Light Theme) */}
      <div className="tv-header">
        <div className="tv-hospital-name">
          <div style={{ width: '52px', height: '52px', background: 'white', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '4px', border: '1px solid #e2e8f0', boxShadow: '0 4px 10px rgba(0,0,0,0.06)' }}>
            {hospital?.logo ? (
              <img src={hospital.logo} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            ) : (
              <Building2 size={28} color="#15803d" />
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
            <div className="current-call-card" style={{ background: '#ffffff', border: '2px solid #bbf7d0', boxShadow: '0 10px 30px rgba(21, 128, 61, 0.08)', animation: 'none' }}>
              <div className="current-call-label" style={{ color: '#15803d' }}>STATUS ANTREAN SEKARANG</div>
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
                <span style={{ fontSize: '0.8rem', fontWeight: '900', color: '#15803d', background: '#ecfdf5', border: '1px solid #bbf7d0', padding: '3px 10px', borderRadius: '10px' }}>
                  Halaman {currentClinicPage + 1} dari {totalClinicPages}
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>
                  (Poli #{currentClinicPage * CLINICS_PER_PAGE + 1} s/d #{Math.min((currentClinicPage + 1) * CLINICS_PER_PAGE, clinics.length)})
                </span>
              </div>
            </div>
          )}

          <div className="tv-queue-grid">
            {paddedClinics.map((clinic, index) => {
              if (!clinic) {
                return (
                  <div key={`empty-slot-${index}`} className="tv-clinic-box tv-clinic-empty-slot" style={{
                    background: '#ffffff',
                    border: '1.5px dashed #cbd5e1',
                    borderRadius: '16px',
                    padding: '1.1rem 1.25rem',
                    boxShadow: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    opacity: 0.55
                  }}>
                    {/* Top Title Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderBottom: '1px dashed #e2e8f0', paddingBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: '900', color: '#94a3b8', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '3px 9px', borderRadius: '10px' }}>
                          [-]
                        </span>
                        <span style={{ fontSize: '1.05rem', fontWeight: '800', color: '#94a3b8' }}>
                          Ruang Poliklinik
                        </span>
                      </div>

                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: '800',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        background: '#f1f5f9',
                        color: '#94a3b8'
                      }}>
                        Tidak Aktif
                      </span>
                    </div>

                    {/* Grid of Dipanggil vs Terakhir Ambil */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center' }}>
                      <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '12px', border: '1px dashed #e2e8f0' }}>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          DIPANGGIL:
                        </div>
                        <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#cbd5e1', lineHeight: 1.1, marginTop: '2px' }}>
                          -
                        </div>
                      </div>

                      <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '12px', border: '1px dashed #e2e8f0', textAlign: 'right' }}>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          TERAKHIR AMBIL:
                        </div>
                        <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#cbd5e1', lineHeight: 1.1, marginTop: '2px' }}>
                          -
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

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
                  border: isCallActive ? '2.5px solid #15803d' : '1px solid #cbd5e1',
                  borderRadius: '16px',
                  padding: '1.1rem 1.25rem',
                  boxShadow: isCallActive ? '0 4px 18px rgba(234, 179, 8, 0.35)' : '0 4px 12px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  {/* Top Title Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '900', color: '#15803d', background: '#ecfdf5', border: '1px solid #bbf7d0', padding: '3px 9px', borderRadius: '10px' }}>
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
                      background: waitingCount > 0 ? '#fef3c7' : isCallActive ? '#ecfdf5' : '#f1f5f9',
                      color: waitingCount > 0 ? '#b45309' : isCallActive ? '#15803d' : '#64748b',
                      border: isCallActive ? '1px solid #bbf7d0' : 'none'
                    }}>
                      {waitingCount > 0 ? `${waitingCount} Menunggu` : lastCalledTicket ? 'Antrean Selesai' : 'Belum Ada Antrean'}
                    </span>
                  </div>

                  {/* Grid of Dipanggil vs Terakhir Ambil */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center' }}>
                    {/* Left: Dipanggil */}
                    <div style={{ background: isCallActive ? '#f0fdf4' : '#f8fafc', padding: '8px 12px', borderRadius: '12px', border: isCallActive ? '1.5px solid #bbf7d0' : '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.7rem', color: isCallActive ? '#15803d' : '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        DIPANGGIL:
                      </div>
                      <div style={{ fontSize: '1.75rem', fontWeight: '900', color: isCallActive ? '#15803d' : lastCalledTicket ? '#334155' : '#cbd5e1', lineHeight: 1.1, marginTop: '2px' }}>
                        {lastCalledTicket ? lastCalledTicket.ticketNumber : '-'}
                      </div>
                      {lastCalledTicket && (
                        <div style={{ fontSize: '0.65rem', fontWeight: '700', color: isCallActive ? '#15803d' : '#64748b', marginTop: '2px' }}>
                          {isCallActive ? '● Dipanggil/Melayani' : '● Selesai'}
                        </div>
                      )}
                    </div>

                    {/* Right: Terakhir Ambil */}
                    <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        TERAKHIR AMBIL:
                      </div>
                      <div style={{ fontSize: '1.75rem', fontWeight: '900', color: lastTakenTicket ? '#d97706' : '#cbd5e1', lineHeight: 1.1, marginTop: '2px' }}>
                        {lastTakenTicket ? lastTakenTicket.ticketNumber : '-'}
                      </div>
                      {lastTakenTicket && (
                        <div style={{ fontSize: '0.65rem', fontWeight: '700', color: '#d97706', marginTop: '2px' }}>
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
                  onLoad={() => {
                    if (parsedVideo.type === 'youtube') {
                      initYouTubePlayer();
                    }
                  }}
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
                  <span style={{ fontSize: '0.85rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', background: 'rgba(255,255,255,0.2)', padding: '6px 16px', borderRadius: '20px', backdropFilter: 'blur(10px)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} /> {currentSlide.tag}
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', opacity: 0.8 }}>
                    Info #{infoSlideIndex + 1} / {infoSlides.length}
                  </span>
                </div>

                <div style={{ margin: '2rem 0' }}>
                  <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center' }}>
                    {(!currentSlide.icon || currentSlide.icon === '🏥' || currentSlide.icon === 'hospital') ? (
                      <Building2 size={50} color="#bae6fd" />
                    ) : (currentSlide.icon === '🎫' || currentSlide.icon === 'ticket') ? (
                      <Ticket size={50} color="#bae6fd" />
                    ) : (currentSlide.icon === '💡' || currentSlide.icon === 'bulb' || currentSlide.icon === 'info') ? (
                      <Lightbulb size={50} color="#bae6fd" />
                    ) : (currentSlide.icon === '📢' || currentSlide.icon === 'announcement') ? (
                      <Radio size={50} color="#bae6fd" />
                    ) : (
                      <Sparkles size={50} color="#bae6fd" />
                    )}
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
                  <Volume2 size={16} style={{ color: '#15803d', animation: 'bounce 1s infinite' }} />
                  <span style={{ fontWeight: '800', color: '#15803d' }}>Panggilan Suara Aktif (Video Dibisukan Otomatis)</span>
                </>
              ) : (
                <>
                  <Volume2 size={16} style={{ color: '#0d9488' }} />
                  <span>Media Promosi: <strong>{isVideoPlayable ? (currentVid?.title || 'Video RS') : currentSlide.title}</strong>
                    {isVideoPlayable && (
                      <span style={{
                        marginLeft: '8px',
                        fontSize: '0.72rem',
                        fontWeight: '800',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: (!audioUnlocked || currentVid?.volume === 0) ? '#fee2e2' : '#f0fdf4',
                        color: (!audioUnlocked || currentVid?.volume === 0) ? '#dc2626' : '#15803d',
                        border: (!audioUnlocked || currentVid?.volume === 0) ? '1px solid #fecaca' : '1px solid #bbf7d0'
                      }}>
                        {(!audioUnlocked || currentVid?.volume === 0) ? 'Bisu (Mute)' : `Vol: ${currentVid?.volume ?? 100}%`}
                      </span>
                    )}
                  </span>
                </>
              )}
            </div>

            {/* Playlist Quick Controls (Previous, Next, Status & Sound) */}
            {isVideoPlayable && videoList.length > 1 && (
              <div className="tv-video-controls" style={{
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
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: '800',
                    color: (!audioUnlocked || (currentVid?.volume ?? 100) === 0) ? '#fca5a5' : '#86efac',
                    background: 'rgba(0,0,0,0.35)',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}>
                    {(!audioUnlocked || (currentVid?.volume ?? 100) === 0) ? 'Bisu' : `Vol: ${currentVid?.volume ?? 100}%`}
                  </span>

                  <button
                    type="button"
                    onClick={handleToggleAudio}
                    title={audioUnlocked ? 'Bisu Suara' : 'Aktifkan Suara'}
                    style={{
                      background: audioUnlocked ? '#15803d' : '#475569',
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
                    style={{ background: '#15803d', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '8px', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: '800' }}
                  >
                    <span>Next</span> <SkipForward size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Marquee Running Text (Emerald Green with Gold Border) */}
      <div className="tv-marquee" style={{ background: 'linear-gradient(90deg, #14532d 0%, #15803d 50%, #166534 100%)', borderTop: '2.5px solid #eab308', color: '#fef9c3', fontWeight: '700', borderRadius: '5px' }}>
        <div className="marquee-text">
          {hospital?.runningText || `Selamat datang di ${hospital?.name || 'Rumah Sakit'}. Harap siapkan kartu identitas/BPJS Anda.`}
        </div>
      </div>
    </div>
  );
}
