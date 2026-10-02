import React, { useEffect, useState } from 'react';
import { Printer, X } from 'lucide-react';

export default function ThermalTicketModal({ ticket, hospital, hospitalName, onClose }) {
  const [countdown, setCountdown] = useState(6);

  const activeHospital = hospital || { name: hospitalName };
  const printSettings = activeHospital.printSettings || {
    paperWidth: '58mm',
    fontSize: 'medium',
    showLogo: true,
    logoHeight: 60,
    headerSubtitle: 'Sistem Antrean Poliklinik Terpadu',
    footerText: '* Harap simpan tiket ini hingga dipanggil *\n* Budayakan antre dengan tertib *',
    showBarcode: true,
    showDateTime: true,
    autoPrint: true
  };

  const shouldAutoPrint = printSettings.autoPrint !== false;

  const executePrint = async () => {
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

      const payload = {
        ticketNumber: ticket.ticketNumber,
        sequence: ticket.sequence || 1,
        clinicName: ticket.clinicName,
        hospitalName: activeHospital.name || 'Rumah Sakit',
        hospitalSubtitle: printSettings.headerSubtitle !== undefined ? printSettings.headerSubtitle : 'Sistem Antrean Poliklinik Terpadu',
        date: formattedDate,
        time: formattedTime,
        status: 'MENUNGGU',
        logoBase64: (printSettings.showLogo !== false && activeHospital.logo) ? activeHospital.logo : null,
        logoHeight: printSettings.logoHeight || 50,
        paperWidth: printSettings.paperWidth || '58mm',
        fontSize: printSettings.fontSize || 'medium',
        showBarcode: printSettings.showBarcode !== false,
        showDateTime: printSettings.showDateTime !== false,
        footerText: printSettings.footerText !== undefined ? printSettings.footerText : '* Harap simpan tiket ini hingga dipanggil *\n* Budayakan antre dengan tertib *'
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch('http://localhost:18080/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (data.success) {
        setTimeout(onClose, 800);
        return;
      }
    } catch {
      // Bridge not reachable, fallback to browser print
    }
    try {
      window.print();
    } catch (e) {
      console.warn('Browser print notice:', e);
    }
  };

  useEffect(() => {
    // Immediately trigger silent print or browser print dialog
    if (shouldAutoPrint) {
      const printTimer = setTimeout(() => {
        executePrint();
      }, 250);
      return () => clearTimeout(printTimer);
    }
  }, [shouldAutoPrint]);

  useEffect(() => {
    // When print dialog closes or printing finishes, auto-close modal
    const handleAfterPrint = () => {
      setTimeout(() => {
        onClose();
      }, 700);
    };

    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, [onClose]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onClose]);

  if (!ticket) return null;

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

  const paperClass = printSettings.paperWidth === '80mm' ? 'thermal-80mm' : 'thermal-58mm';
  const fontClass = `font-${printSettings.fontSize || 'medium'}`;

  return (
    <div className="modal-overlay">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        {/* Status Banner */}
        <div className="no-print" style={{
          background: 'linear-gradient(135deg, #0284c7, #0369a1)',
          color: 'white',
          padding: '10px 22px',
          borderRadius: '30px',
          fontSize: '0.9rem',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 4px 15px rgba(2, 132, 199, 0.35)'
        }}>
          <span style={{ fontSize: '1.2rem' }}>🖨️</span>
          <span>Mengirim tiket ke printer thermal...</span>
        </div>

        {/* Printable Area */}
        <div className={`thermal-ticket thermal-ticket-print-area ${paperClass} ${fontClass}`}>
          {/* Hospital Logo */}
          {printSettings.showLogo && activeHospital.logo && (
            <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
              <img
                src={activeHospital.logo}
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

          {/* Header Info */}
          <div className="thermal-header">
            <h4>{activeHospital.name || 'Rumah Sakit'}</h4>
            {printSettings.headerSubtitle && (
              <p style={{ fontSize: '0.75em', color: '#475569', margin: '4px 0 0 0' }}>
                {printSettings.headerSubtitle}
              </p>
            )}
            <div style={{ borderBottom: '1px dashed #000', margin: '0.5rem 0' }}></div>
          </div>

          {/* Ticket Body */}
          <div style={{ margin: '0.4rem 0' }}>
            <p style={{ fontSize: '0.9em', fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>
              {ticket.clinicName}
            </p>
            <div className="thermal-num">{ticket.ticketNumber}</div>
            <p style={{ fontSize: '0.8em', color: '#334155', margin: 0 }}>
              Urutan Ke-<strong>{ticket.sequence}</strong>
            </p>
          </div>

          <div style={{ borderBottom: '1px dashed #000', margin: '0.5rem 0' }}></div>

          {/* Details */}
          <div style={{ fontSize: '0.78em', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {printSettings.showDateTime && (
              <>
                <div>Tanggal : {formattedDate}</div>
                <div>Pukul   : {formattedTime} WIB</div>
              </>
            )}
            <div>Status  : <strong>MENUNGGU</strong></div>
          </div>

          {/* Footer & Barcode Mockup */}
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

        {/* Buttons (Hidden when printing via .no-print) */}
        <div className="no-print" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button className="btn-primary" onClick={executePrint} style={{ padding: '10px 20px', borderRadius: '10px' }}>
            <Printer size={18} /> Cetak Ulang Struk
          </button>
          <button className="btn-danger" onClick={onClose} style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '10px' }}>
            <X size={18} /> Tutup ({countdown}s)
          </button>
        </div>
      </div>
    </div>
  );
}
