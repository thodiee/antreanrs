import React, { useState, useEffect } from 'react';
import { Ticket, AlertCircle, CheckCircle2, Clock, Printer, CreditCard, Coins, Zap, X, Filter, Check, SlidersHorizontal } from 'lucide-react';
import ThermalTicketModal from './ThermalTicketModal';

export default function KioskView({ hospital, clinics, tickets, onTakeTicket, currentUser }) {
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loadingClinicId, setLoadingClinicId] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [activeClinicModal, setActiveClinicModal] = useState(null);

  // Local Clinic Filter state for this specific PC / Kiosk screen
  const [localClinicFilter, setLocalClinicFilter] = useState(() => {
    try {
      const saved = localStorage.getItem('kiosk_local_clinic_filter');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [clinicFilterModalOpen, setClinicFilterModalOpen] = useState(false);
  const [filterTempSelection, setFilterTempSelection] = useState([]);

  // Patient details form state
  const [patientForm, setPatientForm] = useState({
    patientName: '',
    nik: '',
    norm: '',
    phone: '',
    patientType: 'BPJS'
  });

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

  const [bridgeStatus, setBridgeStatus] = useState(null); // { connected: bool, printer: string, defaultCopies: number }
  const [directPrintToast, setDirectPrintToast] = useState(null);
  const [localCopies, setLocalCopies] = useState(() => {
    const saved = localStorage.getItem('kiosk_local_print_copies');
    return saved ? Number(saved) : null;
  });
  const [copiesNotice, setCopiesNotice] = useState(null);

  // Auto detect if local Windows print bridge is running on client machine
  useEffect(() => {
    let isMounted = true;
    const checkBridge = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1200);
        const res = await fetch('http://localhost:18080/status', { signal: controller.signal });
        clearTimeout(timeout);
        const data = await res.json();
        if (isMounted) {
          if (data && data.status === 'ok') {
            setBridgeStatus({
              connected: true,
              printer: data.printer,
              defaultCopies: data.defaultCopies ? Number(data.defaultCopies) : 2
            });
          } else {
            setBridgeStatus({ connected: false });
          }
        }
      } catch {
        if (isMounted) setBridgeStatus({ connected: false });
      }
    };
    checkBridge();
    const interval = setInterval(checkBridge, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Hitung jumlah lembar cetak (copies) efektif untuk komputer ini
  const getEffectiveCopies = () => {
    // 1. Setting spesifik yang pernah diatur di browser komputer ini
    if (localCopies === 1 || localCopies === 2) {
      return localCopies;
    }
    // 2. Jika pusat menyetel 'device' (Bebas per Komputer), utamakan Print Bridge lokal PC ini
    if (hospital?.printSettings?.copies === 'device') {
      if (bridgeStatus?.connected && bridgeStatus?.defaultCopies) {
        return Number(bridgeStatus.defaultCopies);
      }
      return 1;
    }
    // 3. Jika Print Bridge lokal di PC ini diset 1 copy (misal via 1copy.bat), hormati PC tersebut
    if (bridgeStatus?.connected && Number(bridgeStatus?.defaultCopies) === 1 && localCopies === null) {
      return 1;
    }
    // 4. Jika pusat menyetel angka 1 atau 2
    if (hospital?.printSettings?.copies && Number(hospital.printSettings.copies) > 0) {
      return Number(hospital.printSettings.copies);
    }
    // 5. Fallback ke Print Bridge lokal atau default 2
    return bridgeStatus?.defaultCopies ? Number(bridgeStatus.defaultCopies) : 2;
  };

  const effectiveCopies = getEffectiveCopies();

  const handleToggleCopies = async () => {
    const nextCopies = effectiveCopies === 1 ? 2 : 1;
    localStorage.setItem('kiosk_local_print_copies', String(nextCopies));
    setLocalCopies(nextCopies);

    // Sinkronisasi otomatis ke Print Bridge lokal PC ini jika aktif
    if (bridgeStatus?.connected) {
      try {
        await fetch('http://localhost:18080/set-copies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ copies: nextCopies })
        });
        setBridgeStatus(prev => prev ? ({ ...prev, defaultCopies: nextCopies }) : prev);
      } catch (e) {
        console.warn('Sinkronisasi ke local print bridge tidak merespons:', e);
      }
    }

    setCopiesNotice(`Pengaturan Komputer Ini Diubah: ${nextCopies === 1 ? '1 Lembar (Standar)' : '2 Rangkap (Pasien & Poli)'}`);
    setTimeout(() => setCopiesNotice(null), 3500);
  };

  // Hitung poliklinik yang ditampilkan di Kiosk:
  // 1. Dari penugasan akun currentUser (assignedKioskClinicIds)
  // 2. Dari pengaturan filter lokal komputer ini (kiosk_local_clinic_filter)
  const getEffectiveKioskClinics = () => {
    if (Array.isArray(currentUser?.assignedKioskClinicIds) && currentUser.assignedKioskClinicIds.length > 0) {
      return clinics.filter(c => currentUser.assignedKioskClinicIds.includes(c.id));
    }
    if (Array.isArray(localClinicFilter) && localClinicFilter.length > 0) {
      return clinics.filter(c => localClinicFilter.includes(c.id));
    }
    return clinics;
  };

  const displayedClinics = getEffectiveKioskClinics();

  const handleOpenClinicFilter = () => {
    const currentActiveIds = Array.isArray(localClinicFilter) && localClinicFilter.length > 0
      ? localClinicFilter
      : (Array.isArray(currentUser?.assignedKioskClinicIds) && currentUser.assignedKioskClinicIds.length > 0
        ? currentUser.assignedKioskClinicIds
        : clinics.map(c => c.id));
    setFilterTempSelection(currentActiveIds);
    setClinicFilterModalOpen(true);
  };

  const handleApplyClinicFilter = () => {
    if (filterTempSelection.length === clinics.length || filterTempSelection.length === 0) {
      localStorage.removeItem('kiosk_local_clinic_filter');
      setLocalClinicFilter(null);
      setCopiesNotice('Kiosk Ini: Menampilkan Semua Poliklinik');
    } else {
      localStorage.setItem('kiosk_local_clinic_filter', JSON.stringify(filterTempSelection));
      setLocalClinicFilter(filterTempSelection);
      setCopiesNotice(`Kiosk Ini: Menampilkan ${filterTempSelection.length} Poliklinik`);
    }
    setClinicFilterModalOpen(false);
    setTimeout(() => setCopiesNotice(null), 3500);
  };

  const handleResetClinicFilter = () => {
    localStorage.removeItem('kiosk_local_clinic_filter');
    setLocalClinicFilter(null);
    setCopiesNotice('Kiosk Ini: Kembali Menampilkan Semua Poliklinik');
    setClinicFilterModalOpen(false);
    setTimeout(() => setCopiesNotice(null), 3500);
  };

  const printViaLocalBridge = async (ticket) => {
    try {
      const formattedDate = new Date(ticket.createdAt || Date.now()).toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      const formattedTime = new Date(ticket.createdAt || Date.now()).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      const printSettings = hospital?.printSettings || {};

      const payload = {
        ticketNumber: ticket.ticketNumber,
        sequence: ticket.sequence || 1,
        clinicName: ticket.clinicName,
        hospitalName: hospital?.name || 'Rumah Sakit',
        hospitalSubtitle: printSettings.headerSubtitle !== undefined ? printSettings.headerSubtitle : 'Sistem Antrean Poliklinik Terpadu',
        hospitalAddress: printSettings.hospitalAddress || hospital?.address || '',
        hospitalPhone: printSettings.hospitalPhone || hospital?.phone || '',
        showAddress: printSettings.showAddress !== false,
        date: formattedDate,
        time: formattedTime,
        logoBase64: (printSettings.showLogo !== false && hospital?.logo) ? hospital.logo : null,
        logoHeight: printSettings.logoHeight || 50,
        paperWidth: printSettings.paperWidth || '58mm',
        fontSize: printSettings.fontSize || 'medium',
        copies: effectiveCopies,
        useLocalBridgeCopies: (hospital?.printSettings?.copies === 'device' && localCopies === null),
        showDateTime: printSettings.showDateTime !== false,
        showQrCode: printSettings.showQrCode !== false,
        qrCodeImage: printSettings.qrCodeImage || null,
        qrCodeSize: printSettings.qrCodeSize || 75,
        qrCodeLabel: printSettings.qrCodeLabel || '',
        footerText: printSettings.footerText !== undefined ? printSettings.footerText : '* Harap simpan tiket ini hingga dipanggil *\n* Budayakan antre dengan tertib *'
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch('http://localhost:18080/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      return Boolean(data.success);
    } catch {
      return false;
    }
  };

  const handleOpenModal = (clinic) => {
    setActiveClinicModal(clinic);
    setPatientForm({
      patientName: '',
      nik: '',
      norm: '',
      phone: '',
      patientType: 'BPJS'
    });
  };

  const handleQuickTakeTicket = (clinic) => {
    if (loadingClinicId || !clinic) return;

    setLoadingClinicId(clinic.id);
    setErrorMsg(null);

    const payload = {
      clinicId: clinic.id,
      patientName: 'Pasien Umum',
      nik: '-',
      norm: '-',
      phone: '-',
      patientType: 'BPJS'
    };

    onTakeTicket(payload, (result) => {
      setLoadingClinicId(null);
      if (result.success) {
        // Attempt Direct Silent Print via Windows Bridge first (0-dialog, instant paper output)
        printViaLocalBridge(result.ticket).then((printedDirectly) => {
          if (printedDirectly) {
            setDirectPrintToast(result.ticket);
            setTimeout(() => setDirectPrintToast(null), 3500);
          } else {
            // Fallback to browser modal
            setSelectedTicket(result.ticket);
          }
        });
      } else {
        setErrorMsg(result.error);
        setTimeout(() => setErrorMsg(null), 4000);
      }
    });
  };

  const handleConfirmTakeTicket = (isExpress = false) => {
    if (!activeClinicModal || loadingClinicId) return;

    setLoadingClinicId(activeClinicModal.id);
    setErrorMsg(null);

    const payload = isExpress ? {
      clinicId: activeClinicModal.id,
      patientName: 'Pasien Umum',
      nik: '-',
      norm: '-',
      phone: '-',
      patientType: 'BPJS'
    } : {
      clinicId: activeClinicModal.id,
      patientName: patientForm.patientName || 'Pasien Umum',
      nik: patientForm.nik || '-',
      norm: patientForm.norm || '-',
      phone: patientForm.phone || '-',
      patientType: patientForm.patientType || 'BPJS'
    };

    onTakeTicket(payload, (result) => {
      setLoadingClinicId(null);
      setActiveClinicModal(null);
      if (result.success) {
        printViaLocalBridge(result.ticket).then((printedDirectly) => {
          if (printedDirectly) {
            setDirectPrintToast(result.ticket);
            setTimeout(() => setDirectPrintToast(null), 3500);
          } else {
            setSelectedTicket(result.ticket);
          }
        });
      } else {
        setErrorMsg(result.error);
        setTimeout(() => setErrorMsg(null), 4000);
      }
    });
  };

  return (
    <div className="kiosk-container">
      {/* Direct Silent Print Success Toast (Zero Dialog, Instant Paper) */}
      {directPrintToast && (
        <div style={{
          position: 'fixed',
          top: '25px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
          color: 'white',
          padding: '1.25rem 2.25rem',
          borderRadius: '24px',
          boxShadow: '0 20px 45px rgba(5, 150, 105, 0.4)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          border: '2px solid #34d399'
        }}>
          <Printer size={36} style={{ color: '#10b981' }} />
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', letterSpacing: '1px' }}>
              NOMOR ANTREAN: {directPrintToast.ticketNumber}
            </div>
            <div style={{ fontSize: '0.95rem', opacity: 0.95, fontWeight: '600', marginTop: '2px' }}>
              Struk ({effectiveCopies === 1 ? '1 Lembar' : '2 Rangkap'}) berhasil dicetak! Silakan ambil kertas tiket Anda di printer.
            </div>
          </div>
        </div>
      )}

      {copiesNotice && (
        <div style={{
          position: 'fixed',
          top: '25px',
          right: '25px',
          background: '#0f172a',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '16px',
          fontSize: '0.9rem',
          fontWeight: '700',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          border: '1px solid #334155',
          animation: 'fadeIn 0.2s ease'
        }}>
          <Printer size={18} style={{ color: '#34d399' }} />
          <span>{copiesNotice}</span>
        </div>
      )}

      <div className="kiosk-header">
        {hospital?.logo && (
          <div style={{ width: '80px', height: '80px', margin: '0 auto 1rem auto', borderRadius: '16px', overflow: 'hidden', padding: '6px', background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={hospital.logo} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: '#ecfdf5', color: '#15803d', border: '1px solid #a7f3d0', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '700' }}>
            <Ticket size={16} /> ANTREAN MANDIRI (KIOSK)
          </div>
          {bridgeStatus?.connected && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '700' }}>
              <Zap size={14} /> <span>Direct Silent Print Aktif ({bridgeStatus.printer || 'Printer Thermal'})</span>
            </div>
          )}

          {/* Badge Pengatur Lembar Cetak Khusus Komputer Ini */}
          <button
            type="button"
            onClick={handleToggleCopies}
            title="Klik untuk mengubah jumlah lembar cetak khusus komputer ini (1 Lembar atau 2 Rangkap)"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              background: effectiveCopies === 1 ? '#eff6ff' : '#f0fdf4',
              color: effectiveCopies === 1 ? '#1d4ed8' : '#15803d',
              border: effectiveCopies === 1 ? '1px solid #bfdbfe' : '1px solid #bbf7d0',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: '800',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
            }}
          >
            <Printer size={14} />
            <span>PC Ini: {effectiveCopies === 1 ? '1 Lembar (Standar)' : '2 Rangkap (Pasien & Poli)'}</span>
            <span style={{ fontSize: '0.68rem', opacity: 0.8, background: 'rgba(0,0,0,0.07)', padding: '1px 6px', borderRadius: '8px' }}>
              Klik ganti
            </span>
          </button>

          {/* Badge Pengatur Poliklinik Khusus Kiosk Ini */}
          <button
            type="button"
            onClick={handleOpenClinicFilter}
            title="Klik untuk memilih poliklinik apa saja yang muncul di layar Kiosk ini"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              background: displayedClinics.length < clinics.length ? '#fef3c7' : '#eff6ff',
              color: displayedClinics.length < clinics.length ? '#b45309' : '#1d4ed8',
              border: displayedClinics.length < clinics.length ? '1.5px solid #fde68a' : '1px solid #bfdbfe',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: '800',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
            }}
          >
            <SlidersHorizontal size={14} />
            <span>Poli Kiosk: {displayedClinics.length === clinics.length ? 'Semua Poli' : `${displayedClinics.length} Terpilih`}</span>
            <span style={{ fontSize: '0.68rem', opacity: 0.85, background: 'rgba(0,0,0,0.08)', padding: '1px 6px', borderRadius: '8px' }}>
              Atur
            </span>
          </button>
        </div>
        <h2 className="kiosk-title">{hospital?.name || 'Rumah Sakit'}</h2>
        <p className="kiosk-subtitle">Silakan sentuh poliklinik yang ingin Anda tuju untuk mengambil nomor antrean</p>
      </div>

      {errorMsg && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1rem', fontWeight: '600' }}>
          <AlertCircle size={22} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="kiosk-grid">
        {displayedClinics.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: '3.5rem 1.5rem', textAlign: 'center', background: 'white', borderRadius: '24px', border: '2px dashed #cbd5e1' }}>
            <AlertCircle size={44} style={{ color: '#f59e0b', margin: '0 auto 1rem auto' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1e293b', marginBottom: '0.5rem' }}>Tidak Ada Poliklinik Ditampilkan</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.25rem', maxWidth: '420px', margin: '0 auto 1.25rem auto' }}>
              Kiosk ini sedang diatur untuk menyaring layanan tertentu. Tidak ada poliklinik aktif yang dipilih.
            </p>
            <button
              onClick={handleResetClinicFilter}
              className="btn-primary"
              style={{ padding: '0.75rem 1.75rem', borderRadius: '12px', fontWeight: '800' }}
            >
              Tampilkan Semua Poliklinik
            </button>
          </div>
        ) : (
          displayedClinics.map((clinic) => {
          const clinicTicketsToday = tickets.filter(
            (t) => t.clinicId === clinic.id && getNormalizedDate(t.date) === today
          );
          const currentCount = clinicTicketsToday.length;
          const isFull = currentCount >= clinic.quota;

          const DAYS_INDO = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
          const todayDayName = DAYS_INDO[new Date().getDay()];
          const scheduleDaysStr = clinic.scheduleDays || 'Senin,Selasa,Rabu,Kamis,Jumat,Sabtu,Minggu';
          const isScheduledToday = scheduleDaysStr.split(',').map(s => s.trim()).includes(todayDayName);

          const isDisabled = !clinic.active || isFull || !isScheduledToday;

          return (
            <div key={clinic.id} className={`clinic-card ${isDisabled ? 'disabled' : ''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="clinic-badge">{clinic.prefix}</div>
                <div className={`quota-pill ${isFull || !isScheduledToday ? 'full' : ''}`}>
                  {!isScheduledToday ? 'Buka Sesuai Jadwal' : isFull ? 'Kuota Penuh' : `${currentCount} / ${clinic.quota} Pasien`}
                </div>
              </div>

              <div className="clinic-info">
                <h3>{clinic.name}</h3>
                <p>{clinic.description || 'Layanan pemeriksaan poliklinik terpadu'}</p>
              </div>

              <div className="clinic-meta">
                <span><Clock size={14} style={{ display: 'inline', marginRight: '4px' }} /> Jadwal: {scheduleDaysStr.length > 25 ? 'Senin - Minggu' : scheduleDaysStr}</span>
                <span style={{ color: (clinic.active && isScheduledToday) ? '#10b981' : '#ef4444' }}>
                  ● {(clinic.active && isScheduledToday) ? 'Buka Hari Ini' : 'Tutup Hari Ini'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button
                  className="take-ticket-btn"
                  disabled={isDisabled || loadingClinicId === clinic.id}
                  onClick={() => {
                    const isQuick = hospital?.printSettings?.quickPrint !== false;
                    if (isQuick) {
                      handleQuickTakeTicket(clinic);
                    } else {
                      handleOpenModal(clinic);
                    }
                  }}
                  style={{
                    background: isDisabled ? undefined : 'linear-gradient(135deg, #15803d 0%, #166534 100%)',
                    boxShadow: isDisabled ? undefined : '0 6px 18px rgba(21, 128, 61, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {loadingClinicId === clinic.id ? (
                    'Mencetak Tiket...'
                  ) : !isScheduledToday ? (
                    'Libur (Tidak Ada Jadwal)'
                  ) : isFull ? (
                    'Kuota Habis'
                  ) : !clinic.active ? (
                    'Poli Tutup'
                  ) : (
                    <>
                      <Ticket size={22} /> Cetak Cepat Nomor Antrean
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        }))}
      </div>

      {/* Patient Identification Registration Modal */}
      {activeClinicModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div style={{
            background: 'white',
            borderRadius: '24px',
            width: '90%',
            maxWidth: '520px',
            padding: '2rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}>
            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: '900', color: '#15803d', background: '#ecfdf5', padding: '3px 10px', borderRadius: '10px' }}>
                  POLIKLINIK [{activeClinicModal.prefix}]
                </span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
                  {activeClinicModal.name}
                </h3>
              </div>
              <button
                onClick={() => setActiveClinicModal(null)}
                style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', fontWeight: '800', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '-4px' }}>
              Isi data diri pasien di bawah ini agar tersimpan resmi di database rumah sakit:
            </p>

            {/* Input Form Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Nama Lengkap Pasien <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Budi Santoso"
                  value={patientForm.patientName}
                  onChange={(e) => setPatientForm({ ...patientForm, patientName: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem', fontWeight: '600' }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                    NIK / No. RM
                  </label>
                  <input
                    type="text"
                    placeholder="3174... / RM-001"
                    value={patientForm.nik}
                    onChange={(e) => setPatientForm({ ...patientForm, nik: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                    No. HP / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="08123456789"
                    value={patientForm.phone}
                    onChange={(e) => setPatientForm({ ...patientForm, phone: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Jenis Penjamin / Pasien
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setPatientForm({ ...patientForm, patientType: 'BPJS' })}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '10px',
                      border: patientForm.patientType === 'BPJS' ? '2px solid #15803d' : '1px solid #cbd5e1',
                      background: patientForm.patientType === 'BPJS' ? '#ecfdf5' : '#f8fafc',
                      color: patientForm.patientType === 'BPJS' ? '#15803d' : '#475569',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    <CreditCard size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} /> BPJS Kesehatan
                  </button>

                  <button
                    type="button"
                    onClick={() => setPatientForm({ ...patientForm, patientType: 'UMUM' })}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '10px',
                      border: patientForm.patientType === 'UMUM' ? '2px solid #0d9488' : '1px solid #cbd5e1',
                      background: patientForm.patientType === 'UMUM' ? '#ccfbf1' : '#f8fafc',
                      color: patientForm.patientType === 'UMUM' ? '#0d9488' : '#475569',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    <Coins size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} /> Pasien Umum / Mandiri
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '0.5rem' }}>
              <button
                className="btn-primary"
                style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', fontWeight: '800', borderRadius: '12px' }}
                onClick={() => handleConfirmTakeTicket(false)}
                disabled={loadingClinicId === activeClinicModal.id}
              >
                {loadingClinicId === activeClinicModal.id ? 'Mencetak Ticket...' : 'Cetak & Simpan Tiket Antrean'}
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleConfirmTakeTicket(true)}
                  style={{ flex: 1, padding: '0.65rem', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '10px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Cetak Cepat (Tanpa Nama)
                </button>

                <button
                  onClick={() => setActiveClinicModal(null)}
                  style={{ padding: '0.65rem 1.25rem', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: '10px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pengaturan Poliklinik Khusus Kiosk Ini */}
      {clinicFilterModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div style={{
            background: 'white',
            borderRadius: '24px',
            width: '92%',
            maxWidth: '560px',
            padding: '2rem',
            boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <SlidersHorizontal size={20} style={{ color: '#15803d' }} /> Filter Poliklinik Kiosk Ini
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 0 0' }}>
                  Pilih poliklinik apa saja yang ingin dimunculkan tombolnya di layar Kiosk komputer ini.
                </p>
              </div>
              <button
                onClick={() => setClinicFilterModalOpen(false)}
                style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.82rem', color: '#334155', fontWeight: '700' }}>
                {filterTempSelection.length} dari {clinics.length} poliklinik dipilih
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setFilterTempSelection(clinics.map(c => c.id))}
                  style={{ background: 'none', border: 'none', color: '#15803d', fontSize: '0.78rem', fontWeight: '800', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Pilih Semua
                </button>
                <span style={{ color: '#cbd5e1' }}>|</span>
                <button
                  type="button"
                  onClick={() => setFilterTempSelection([])}
                  style={{ background: 'none', border: 'none', color: '#b91c1c', fontSize: '0.78rem', fontWeight: '800', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Kosongkan
                </button>
              </div>
            </div>

            <div style={{
              flex: 1,
              overflowY: 'auto',
              maxHeight: '340px',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '10px',
              background: '#f8fafc',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
              gap: '8px',
              marginBottom: '1.25rem'
            }}>
              {clinics.map((c) => {
                const isChecked = filterTempSelection.includes(c.id);
                return (
                  <label
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      background: isChecked ? '#ecfdf5' : '#ffffff',
                      border: isChecked ? '1.5px solid #15803d' : '1px solid #e2e8f0',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
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
                          setFilterTempSelection([...filterTempSelection, c.id]);
                        } else {
                          setFilterTempSelection(filterTempSelection.filter(id => id !== c.id));
                        }
                      }}
                      style={{ width: '17px', height: '17px', accentColor: '#15803d', cursor: 'pointer' }}
                    />
                    <span>[{c.prefix}] {c.name}</span>
                  </label>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleResetClinicFilter}
                style={{ padding: '0.75rem 1.25rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '12px', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer' }}
              >
                Reset (Tampilkan Semua)
              </button>
              <button
                type="button"
                onClick={handleApplyClinicFilter}
                className="btn-primary"
                style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: '800', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Check size={16} /> Terapkan di Kiosk Ini
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTicket && (
        <ThermalTicketModal
          ticket={selectedTicket}
          hospital={hospital}
          forcedCopies={effectiveCopies}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </div>
  );
}
