# 🏥 AntreanRS - Sistem Antrean Poliklinik Cerdas 4 Layar

**AntreanRS** adalah sistem manajemen antrean poliklinik dan rumah sakit terpadu berbasis web modern dan real-time. Dirancang untuk mengelola alur kedatangan dan pemanggilan pasien secara tertib, efisien, dan transparan melalui 4 antarmuka layar utama.

---

## 📌 Fitur Utama (4 Layar Terintegrasi)

### 1. 🎫 Layar Kiosk Mandiri (Ambil Tiket)
* Pengambilan nomor tiket antrean mandiri oleh pasien di pintu masuk pendaftaran.
* Pilihan poliklinik tujuan dengan kuota harian otomatis.
* Input data pasien (Pasien Umum, BPJS, NIK, No. Rekam Medis, No. HP).
* Integrasi **Silent Printing** ke Printer Thermal (58mm / 80mm) via Windows Print Bridge tanpa pop-up dialog cetak.
* Debounce proteksi untuk mencegah pengambilan tiket ganda secara tidak sengaja.

### 2. 📺 Layar TV Display (Monitor Ruang Tunggu)
* Tampilan nomor panggil antrean aktif berukuran besar dan status antrean per poliklinik.
* Suara notifikasi panggilan pasien otomatis.
* Pemutar media video edukasi kesehatan & profil RS (mendukung YouTube, TikTok, Instagram, dan file video lokal `.mp4`).
* *Running text* pengumuman dinamis dan *slide banner* informasi fasilitas layanan.
* Sensor privasi identitas pasien (**UU PDP**): NIK dan nomor HP disamarkan di layar publik.

### 3. 👨‍⚕️ Layar Konsol Petugas (Officer Console)
* Konsol pemanggilan antrean untuk petugas loket, poliklinik spesialis, dan farmasi.
* Fitur kontrol antrean: **Panggil Pasien**, **Panggil Ulang (Recall)**, **Lewati (Skip)**, dan **Selesaikan Antrean (Complete)**.
* Filter otomatis sesuai poliklinik yang ditugaskan ke masing-masing petugas.

### 4. ⚙️ Layar Dashboard Administrator (Super Admin)
* **Pengaturan Instansi & Branding**: Nama RS, logo, slogan, dan teks berjalan (*running text*).
* **Konfigurasi Cetak Tiket**: Pengaturan lebar kertas (58mm/80mm), logo tiket, barcode, dan *footer text*.
* **Manajemen Poliklinik & Loket**: Pengaturan kuota pasien, status aktif/nonaktif, jadwal buka, dan nomor loket.
* **Manajemen Pengguna (RBAC)**: Pembuatan dan pengelolaan akun petugas dengan hak akses bertingkat.
* **Manajemen Media & Video**: Unggah video lokal atau tautan video sosial dengan sinkronisasi otomatis.
* **Laporan & Rekapitulasi**: Ringkasan statistik harian serta fitur ekspor riwayat antrean ke format CSV.
* **Reset Shift Antrean**: Reset nomor antrean kembali ke `001` secara manual atau otomatis setiap tengah malam (*midnight auto-reset*).

---

## 🛡️ Fitur Keamanan (Security Hardening)

Aplikasi ini telah diaudit dan diperkuat terhadap berbagai potensi ancaman siber:
1. **Autentikasi JWT & Otorisasi RBAC**: Endpoint mutasi data (`/api/users`, `/api/settings`, `/api/reset-shift`, `/api/upload-video`) dan Socket.IO diamankan menggunakan token JSON Web Token.
2. **Kepatuhan Privasi Data (UU PDP No. 27/2022)**: Data sensitif NIK dan nomor telepon pasien otomatis disensor (*masked*) untuk akses publik.
3. **Pencegahan Brute-Force & DoS**: Dilengkapi dengan `express-rate-limit` pada endpoint login (maksimal 15 percobaan/15 menit) dan proteksi DoS API (300 req/menit).
4. **Keamanan Unggah Berkas**: Pembatasan ukuran file video maksimal 500 MB, validasi ketat ekstensi/MIME type, serta pencegahan serangan *Path Traversal*.
5. **Mitigasi SSRF & Argument Injection**: Validasi alamat IP lokal/privat pada pengambil video luar dan pemisah argumen CLI `--` pada modul `yt-dlp`.
6. **Proteksi CSV Formula Injection**: Sanitasi otomatis karakter pemicu formula (`=`, `+`, `-`, `@`) pada berkas ekspor laporan CSV.
7. **HTTP Security Headers**: Header proteksi web standar menggunakan `helmet` (proteksi Clickjacking, MIME sniffing, dll.).
8. **Hardening Database**: Pool database dikunci dengan `multipleStatements: false` untuk menutup risiko *stacked query SQL Injection*.

---

## 🛠️ Teknologi yang Digunakan

* **Backend**: Node.js, Express.js (v5), Socket.IO, MySQL2 (Promise), Bcrypt.js, Helmet, Express Rate Limit, JsonWebToken, Multer, yt-dlp.
* **Database**: MySQL / MariaDB (Collation `utf8mb4_unicode_ci`).
* **Frontend**: React 19, Vite, Socket.IO Client, Lucide React Icons, Modern Responsive Vanilla CSS.
* **Hardware Bridge**: PowerShell Print Service untuk Thermal Printer Windows (Port 18080).

---

## 🚀 Panduan Instalasi & Menjalankan

### 1. Prasyarat Sistem
* [Node.js](https://nodejs.org/) versi 18 atau lebih baru.
* Database **MariaDB** atau **MySQL** yang sedang berjalan.
* *Opsional (untuk TV Display)*: Akses internet jika menggunakan tautan video YouTube/TikTok.

### 2. Kloning Repositori & Pasang Dependensi
```bash
# Masuk ke direktori proyek
cd antreanrs

# Instal seluruh dependensi
npm install
```

### 3. Konfigurasi Lingkungan (`.env`)
Salin berkas template lingkungan:
```bash
cp .env.example .env
```
Sesuaikan konfigurasi koneksi database Anda di dalam berkas `.env`:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=admin123
DB_NAME=antrean_rs
JWT_SECRET=rahasia_jwt_acak_minimal_32_karakter_aman_2026
PORT=3001
```
*(Catatan: Jika database `antrean_rs` belum ada, sistem akan otomatis membuatnya saat pertama kali dijalankan).*

### 4. Menjalankan Aplikasi

#### Mode Pengembangan (Development)
Menjalankan server backend (Node.js/Nodemon) dan server frontend (Vite) secara bersamaan:
```bash
npm run dev
```
* **Frontend UI**: [http://localhost:3000](http://localhost:3000)
* **Backend API & Socket**: [http://localhost:3001](http://localhost:3001)

#### Mode Produksi (Production)
```bash
# 1. Build bundle frontend
npm run build

# 2. Jalankan server produksi
npm start
```

---

## 🔑 Akun Bawaan (Default Login)

Saat pertama kali diinisialisasi, sistem secara otomatis menyediakan akun contoh berikut:

| Peran (Role) | Username | Password | Deskripsi Hak Akses |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin` | `admin123` | Akses penuh dashboard admin, pengaturan, dan pengguna |
| **Pendaftaran** | `pendaftaran` | `pendaftaran123` | Hak akses membuka Layar Kiosk Mandiri & Reset Shift |
| **Poliklinik** | `poliklinik` | `poli123` | Hak akses Layar Petugas Poliklinik Umum |
| **Farmasi** | `farmasi` | `farmasi123` | Hak akses Layar Petugas Pengambilan Obat / Farmasi |

> [!IMPORTANT]
> Sangat disarankan untuk segera mengubah kata sandi akun default di atas melalui menu **Manajemen Pengguna** di Dashboard Admin saat digunakan di lingkungan rumah sakit/klinik nyata.

---

## 🖨️ Pengaturan Cetak Tiket Thermal (Windows Print Bridge)

Untuk mencetak tiket secara langsung (*silent printing*) ke printer kasir/thermal USB tanpa dialog konfirmasi browser:
1. Buka folder `windows-print-bridge/`.
2. Klik kanan pada berkas `pasang-autostart-background.bat` dan pilih **Run as Administrator** (atau jalankan `jalankan-printer-bridge.bat`).
3. Layanan akan berjalan di `http://localhost:18080` dan otomatis mendeteksi printer thermal default Windows.

---

## 📂 Struktur Direktori Proyek

```text
antreanrs/
├── db.js                     # Inisialisasi skema tabel & pool koneksi MySQL/MariaDB
├── server.js                 # Server Express, Socket.IO, middleware keamanan, REST API
├── package.json              # Daftar pustaka dan script proyek
├── .env.example              # Template variabel lingkungan
├── public/
│   └── videos/               # Direktori penyimpanan cache video promosi lokal
├── src/
│   ├── App.jsx               # Komponen root aplikasi & router tampilan 4 layar
│   ├── main.jsx              # Entry point aplikasi React
│   ├── components/
│   │   ├── AdminDashboardView.jsx   # Antarmuka Dashboard Super Admin
│   │   ├── KioskView.jsx            # Antarmuka Kiosk Mandiri Pasien
│   │   ├── LoginForm.jsx            # Antarmuka Formulir Login Petugas & Admin
│   │   ├── OfficerConsoleView.jsx   # Antarmuka Konsol Pemanggil Petugas
│   │   ├── ThermalTicketModal.jsx   # Modal pratinjau & format cetak tiket
│   │   └── TvDisplayView.jsx        # Antarmuka Monitor TV Ruang Tunggu
│   ├── services/
│   │   └── socket.js         # Inisialisasi koneksi real-time Socket.IO client
│   └── styles/
│       └── index.css         # Desain sistem & antarmuka aplikasi
└── windows-print-bridge/     # Skrip service silent printing untuk printer thermal
```

---

## 📄 Lisensi
Hak Cipta © 2026. Dikembangkan untuk efisiensi sistem antrean layanan kesehatan cerdas dan ramah pasien.
