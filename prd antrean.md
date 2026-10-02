Berikut adalah draf Product Requirements Document (PRD) untuk sistem antrean poliklinik yang disusun mengikuti format, pedoman struktural, dan ketelitian klausul dari dokumen acuan yang Anda berikan.

**PRD Sistem Antrean Poliklinik Cerdas**

**Versi 1.0 • 1 Oktober 2026**

**Tujuan dokumen** Menjadi acuan pengembangan aplikasi web manajemen antrean poliklinik terpadu untuk rumah sakit. Dokumen menetapkan batas produk, kebutuhan yang dapat diuji, aturan operasional pemanggilan, serta urutan rilis.

Arah produk adalah membangun satu fondasi sistem dengan 4 (empat) tampilan utama yang saling sinkron secara seketika (_real-time_): Kiosk untuk pasien, Dasbor untuk petugas, Display TV untuk ruang tunggu, dan Back-office untuk admin. Dukungan untuk integrasi dengan SIMRS Khanza (keluaran YASKI) akan diwujudkan melalui perluasan kemampuan secara bertahap pada fase berikutnya.

**Keputusan produk utama**

- Bangun fondasi arsitektur terpusat sejak awal (menggunakan ekosistem Laravel dan Vite); setiap rumah sakit dapat memiliki beberapa poliklinik, loket, dan TV display.
- Rilis pertama memprioritaskan fungsi inti 4 layar: Kiosk ambil nomor, Layar TV (antrean & media promosi), Layar Petugas (panggil, ulang, lewati), dan Admin (pengaturan poli & laporan).
- Utamakan ketepatan nomor antrean, latensi pemanggilan suara, dan stabilitas operasional di jaringan lokal (LAN) sebelum menambah fitur pertumbuhan.

**Penggunaan dan pengendalian perubahan** Pembaca: pemilik produk di Cybichi, UI/UX, engineering, QA, operasional rumah sakit, dan mitra integrasi. Versi ini menjadi baseline usulan untuk discovery dan estimasi. Perubahan ruang lingkup harus menyebut ID kebutuhan, dampak data, biaya, dependensi, dan kriteria penerimaan baru.

**Daftar isi**

1 Visi dan ukuran keberhasilan

2 Cakupan dan tahapan produk

3 Peta dukungan jenis poliklinik

4 Pengguna dan hak akses

5 Struktur rumah sakit dan onboarding

6 Katalog poliklinik dan parameter antrean

7 Transaksi pengambilan tiket antrean

8 Proses pemanggilan dan penyelesaian

9 Media promosi TV dan penyesuaian

10 Recall, Skip, dan reset antrean (shift)

11 Manajemen kapasitas dan kuota poli

12 Pemetaan dokter dan jadwal poli

13 Data pasien dan riwayat layanan

14 Modul integrasi SIMRS lanjutan

15 Kanal mandiri Kiosk dan display TV

16 Laporan dan definisi operasional

17 Offline dan ketahanan sinkronisasi jaringan

18 Perangkat dan pengalaman pengguna

19 Lisensi dan operasi platform

20 Arsitektur dan integrasi

21 Model data dan invariant

22 Status proses dan pemulihan

23 Keamanan privasi dan kepatuhan

24 Kinerja keandalan dan operasional

25 Migrasi retensi dan penghentian

26 Skenario penerimaan lintas modul

27 Roadmap dependensi dan keputusan

28 Risiko dan definisi siap rilis

29 Sumber dan glosarium

**1 Visi dan ukuran keberhasilan** Rumah sakit dapat mengelola alur kunjungan pasien, mengurangi penumpukan di ruang tunggu, dan memberikan informasi publik (media promosi) dari satu sistem yang terpusat. Petugas tetap dapat memanggil antrean dengan mudah tanpa harus berteriak, dengan status urutan dan batas antrean yang jelas.

**Masalah yang diselesaikan** Sistem TV antrean generik sering kali statis dan terpisah dari manajemen pemanggilan di meja petugas. Produk harus menghubungkan 4 layar utama secara harmonis dan interaktif, memberikan jejak audit waktu tunggu dari saat tiket dicetak hingga pasien selesai diperiksa.

**Indikator**

| **Target awal dan cara ukur**                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------- |
| **Aktivasi**<br><br>\$\\ge\$ 90% petugas poli pilot mampu menggunakan fungsi Panggil, Ulang, dan Lewati tanpa bantuan di hari pertama. |
| **Kecepatan kiosk**<br><br>Median pengambilan tiket di layar mandiri \$\\le\$ 3 detik; ukur dari sentuhan layar hingga struk tercetak. |
| **Konsistensi transaksi**<br><br>0 kehilangan nomor dan 0 penggandaan nomor antrean pada poli yang sama di hari yang sama.             |
| **Latensi pemanggilan**<br><br>\$\\le\$ 300 ms jeda antara petugas klik "Panggil" hingga TV berbunyi di jaringan lokal.                |

**2 Cakupan dan tahapan produk** P0 wajib sebelum rilis produksi pertama. P1 adalah perluasan setelah fondasi stabil.

| **Tahap**                 | **Cakupan wajib**                                                                                                         | **Batas**                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **P0 Fondasi 4 Layar**    | Layar TV promosi & pemanggilan, Layar Petugas, Kiosk pasien, Dasbor admin, format antrean per poli, laporan dasar harian. | Pengambilan antrean langsung di tempat (on-site). |
| **P1 Operasional Lanjut** | Pengenalan profil pasien, jadwal dokter spesifik, reservasi online.                                                       | Aktifkan per poli setelah UAT.                    |
| **P2 Ekspansi SIMRS**     | Integrasi dengan pendaftaran SIMRS Khanza, pemanggilan apotek, dan bridging BPJS.                                         | Akses API RS dan perangkat harus divalidasi.      |

**Bukan lingkup produk inti** Rekam medis, keputusan klinis diagnostik, PACS, dan peresepan obat bukan bagian dari sistem antrean inti ini.

**3 Peta dukungan jenis poliklinik** Peta berikut mengelompokkan pola operasi poli.

| **Kelompok poliklinik** | **Kemampuan khusus**                                           | **Tahap** |
| ----------------------- | -------------------------------------------------------------- | --------- |
| Poli Umum, Gigi, KIA    | Prefix nomor (A, B, C), cetak tiket, panggilan standar         | P0        |
| Farmasi / Apotek        | Pengumpulan resep, status peracikan obat, panggilan nama/nomor | P1        |

**4 Pengguna dan hak akses** Akses berbasis peran untuk mengamankan 4 layar utama.

| **Peran**              | **Akses utama**                                | **Pembatasan bawaan**                                             |
| ---------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| **Super Admin**        | Konfigurasi poli, media TV, laporan, user      | Tidak melakukan pemanggilan pasien.                               |
| **Petugas Poli**       | Klik panggil, ulang, lewati, selesai           | Hanya untuk poliklinik yang ditugaskan.                           |
| **Display TV & Kiosk** | Lihat daftar antrean, putar video, cetak struk | Kiosk mode (tanpa form login terbuka) menggunakan token _device_. |

**IAM 01 Identitas dan otorisasi P0** Diterima jika: Petugas Poli Anak yang mencoba menekan tombol panggil untuk Poli Gigi menerima penolakan dari sistem. Layar TV tidak bisa digunakan untuk mengubah konfigurasi video.

**5 Struktur rumah sakit dan onboarding** **TEN 01 Setup terpandu P0** Alur: konfigurasi poli \$\\rightarrow\$ tentukan prefix antrean \$\\rightarrow\$ unggah video promosi \$\\rightarrow\$ atur _running text_ \$\\rightarrow\$ buka sesi Kiosk \$\\rightarrow\$ tes cetak printer thermal. Diterima jika: Pengaturan prefix poli (misal: "A" untuk Umum) langsung diterapkan di tampilan kiosk secara _real-time_.

**6 Katalog poliklinik dan parameter antrean** **CAT 01 Model poliklinik P0** Pisahkan nama poli, kuota antrean harian, prefix kode antrean, dan status buka/tutup. Diterima jika: Poli yang diset nonaktif atau kuotanya habis akan menampilkan tombol abu-abu (tidak bisa diklik) pada layar Kiosk.

**7 Transaksi pengambilan tiket antrean** **POS 01 Kiosk dan pencetakan P0** Pasien menekan tombol poli di layar. Sistem mereservasi urutan, menghasilkan tiket (misal: B-012), dan mengirim ke printer. Diterima jika: Pasien mengetuk layar dua kali dengan sangat cepat (_double-tap_), sistem hanya mencetak 1 tiket (terdapat _debounce protection_ 2 detik).

**8 Proses pemanggilan dan penyelesaian antrean** **PAY 01 Konsol petugas P0** Petugas memiliki tombol: Panggil (Next), Panggil Ulang (Recall), Selesai (Complete). Diterima jika: Menekan "Panggil" memicu event WebSocket yang otomatis merubah nomor di TV Display dan menambah urutan aktif di layar petugas.

**9 Media promosi TV dan penyesuaian** **PRC 01 Modul TV dan Media P0** Sistem membagi layar TV. Area kiri untuk daftar antrean poli, area kanan untuk _looping_ video promosi RS, area bawah untuk _running text_. Diterima jika: Transisi pergantian video promosi ke video berikutnya berjalan _seamless_ tanpa layar hitam. Pemanggilan suara TTS (Text-to-Speech) mengecilkan volume video secara otomatis selama suara diputar.

**10 Recall, Skip, dan reset antrean (shift)** **RET 01 Kontrol pasien tidak hadir P0** Tombol "Lewati" (Skip) memindahkan nomor ke daftar tunda jika pasien tidak muncul setelah dipanggil ulang (_recall_). Diterima jika: Pasien yang dilewati tidak memblokir antrean di belakangnya, dan petugas dapat memanggil kembali nomor yang dilewati tersebut nanti.

**CSH 01 Buka dan tutup antrean harian P0** Nomor antrean direset menjadi 001 secara otomatis setiap pukul 00:00, atau dapat direset manual oleh admin. Diterima jika: Reset harian memindahkan data hari sebelumnya ke tabel riwayat, bukan menghapus datanya.

**11 Manajemen kapasitas dan kuota poli** **INV 01 Pembatasan kuota P0** Poli dapat diatur dengan batas maksimal pasien per hari. Diterima jika: Kuota diatur 50, pasien ke-51 akan mendapat notifikasi bahwa pendaftaran poli telah penuh di layar Kiosk.

**12 Pemetaan dokter dan jadwal poli**

(Lingkup P1/P2) Menautkan dokter ke poli sehingga nama dokter tampil di tiket dan layar TV.

**13 Data pasien dan riwayat layanan** (Lingkup P1/P2) Menambahkan integrasi pembaca kartu berobat atau input NIK. Pada P0, transaksi bersifat anonim (hanya nomor antrean).

**14 Modul integrasi SIMRS lanjutan** **LOT 01 Integrasi P2** Melakukan _bridging_ API ke SIMRS Khanza (YASKI) untuk mengikat nomor antrean kiosk dengan rekam medis pasien. Hal ini memerlukan kajian kewajiban data kesehatan sebelum diaktifkan.

**15 Kanal mandiri Kiosk dan display TV** **CHN 01 Antarmuka khusus perangkat P0** Kiosk dan TV dijalankan sebagai PWA/SPA dalam _kiosk-mode browser_. TV wajib terhubung dengan sistem audio (_speaker_) rumah sakit.

**16 Laporan dan definisi operasional** **RPT 01 Dashboard admin P0** Tampilkan data harian per poli: Total antrean diambil, total selesai, total dilewati (skip). Ekspor CSV/Excel. Diterima jika: Admin dapat mengunduh laporan bulan lalu dan melihat jam layanan rata-rata per petugas.

**17 Offline dan ketahanan sinkronisasi jaringan** **OFF 01 Kinerja jaringan lokal P0** Sistem diusulkan berjalan di server lokal (on-premise) rumah sakit agar gangguan internet eksternal tidak menghentikan alur layanan.

**18 Perangkat dan pengalaman pengguna**

| **Permukaan**  | **Target produk**                  | **Validasi wajib**                       |
| -------------- | ---------------------------------- | ---------------------------------------- |
| **TV Display** | Resolusi 1080p, Chrome/Firefox     | Auto-play audio policy diizinkan.        |
| **Kiosk**      | Layar sentuh vertikal, min 10 inci | Tombol minimal 44x44 pixel.              |
| **Printer**    | Thermal 80mm ESC/POS               | Uji logo RS, pemotong otomatis (cutter). |

**19 Lisensi dan operasi platform** Modul lisensi rumah sakit. Admin platform memantau status _uptime_ dan pemeliharaan media.

**20 Arsitektur dan integrasi** **ARC 01 Konsistensi dan Event P0** Aplikasi web dibangun di atas lingkungan berbasis event (contoh: ekosistem Laravel) dengan WebSocket untuk mendorong _update_ ke TV dan Petugas secara instan tanpa perlu memuat ulang (_refresh_) halaman.

**21 Model data dan invariant** Setiap baris antrean terikat relasi unik pada format (Tanggal, ID_Poli, Nomor_Urut) untuk memastikan tidak ada duplikasi absolut pada hari yang sama. Data riwayat bersifat _append only_.

**22 Status proses dan pemulihan** **Objek Antrean:** Menunggu \$\\rightarrow\$ Dipanggil \$\\rightarrow\$ Sedang Dilayani \$\\rightarrow\$ Selesai / Dilewati. Jika TV padam listrik lalu dihidupkan ulang, sistem harus menarik status pemanggilan terakhir tanpa merusak urutan.

**23 Keamanan privasi dan kepatuhan** Penyembunyian nama pasien (masking) pada TV display di masa depan diatur sesuai UU Pelindungan Data Pribadi (jika nama ditampilkan). Saat ini identifikasi murni berbasis nomor urut alfanumerik.

**24 Kinerja keandalan dan operasional** **NFR 01 Latensi:** Latensi WebSocket p95 \$\\le\$ 300 ms. **NFR 02 Stabilitas Memory:** Display TV harus mampu diputar terus-menerus selama 12 jam tanpa mengalami _browser crash_ akibat penumpukan RAM pemutaran video.

**25 Migrasi retensi dan penghentian** Pembersihan tabel data antrean berkala (misal: dipindahkan ke arsip setiap 3 bulan) agar performa _query dashboard_ admin tetap cepat.

**26 Skenario penerimaan lintas modul** **U01 Double tap:** 10 sentuhan layar kiosk secara agresif hanya mencetak 1 tiket. **U02 Panggilan tumpang tindih:** Dua poli menekan tombol panggil di detik yang sama, TV akan memutar suara Poli 1, menyimpan suara Poli 2 di antrean memori, lalu memutarnya tepat setelah Poli 1 selesai.

**27 Roadmap dependensi dan keputusan**

| **Fase**               | **Durasi indikatif** | **Hasil**                   |
| ---------------------- | -------------------- | --------------------------- |
| A Discovery & Desain   | 2–3 minggu           | Finalisasi UI Kiosk, UI TV. |
| B Fondasi Core         | 4 minggu             | DB, API, Socket setup.      |
| C Implementasi 4 Layar | 4 minggu             | Kiosk, TV, Petugas, Admin.  |

**28 Risiko dan definisi siap rilis**

- **Risiko Printer:** Kertas termal habis \$\\rightarrow\$ Harus ada alert di sistem.
- **Definisi Selesai (DoD):** Aplikasi 4 layar sudah UAT di jaringan rumah sakit, sinkronisasi suara TV berjalan lancar, tidak ada data ganda.

**29 Sumber dan glosarium**

- **TTS (Text-to-Speech):** Mesin pengubah teks pemanggilan menjadi suara.
- **SIMRS:** Sistem Informasi Manajemen Rumah Sakit.