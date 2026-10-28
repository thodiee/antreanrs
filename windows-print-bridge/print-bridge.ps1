# ==============================================================
# PRINT BRIDGE ANTREAN RS - DIRECT SILENT PRINTING FOR WINDOWS
# ==============================================================
# Service ringan ini berjalan di komputer Windows (Client)
# yang terhubung langsung ke Printer Thermal USB.
# Menerima data cetak dari Web Kiosk via HTTP localhost:18080
# dan mencetaknya LANGSUNG ke printer dengan layout thermal rapi
# (Ukuran font besar, nomor antrean tebal, garis putus-putus, barcode)
# tanpa dialog/preview sama sekali!
# ==============================================================

param(
    [string]$PrinterName = "",
    [int]$Copies = 0
)

# ==============================================================
# KONFIGURASI PRINT BRIDGE
# ==============================================================
# Cari lokasi folder script ini berada untuk menyimpan/membaca bridge-config.json
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Definition
if ([string]::IsNullOrWhiteSpace($SCRIPT_DIR)) { $SCRIPT_DIR = $PSScriptRoot }
if ([string]::IsNullOrWhiteSpace($SCRIPT_DIR)) { $SCRIPT_DIR = (Get-Location).Path }
$CONFIG_FILE = Join-Path $SCRIPT_DIR "bridge-config.json"

# Nilai default awal jika belum diset
$DEFAULT_COPIES = 2

# 1. Baca konfigurasi lokal bridge-config.json jika file ada
if (Test-Path $CONFIG_FILE) {
    try {
        $cfgJson = Get-Content -Raw $CONFIG_FILE -Encoding UTF8 | ConvertFrom-Json
        if ($cfgJson.copies -and [int]$cfgJson.copies -gt 0) {
            $DEFAULT_COPIES = [int]$cfgJson.copies
        }
    } catch {}
}

# 2. Parameter command-line -Copies menimpa konfigurasi jika diberikan secara eksplisit (> 0)
if ($Copies -gt 0) {
    $DEFAULT_COPIES = $Copies
    try {
        @{ copies = $DEFAULT_COPIES; updatedAt = (Get-Date -Format 's') } | ConvertTo-Json | Set-Content -Path $CONFIG_FILE -Encoding UTF8
    } catch {}
}

# Tampilkan label pembeda di atas struk jika mencetak lebih dari 1 copy:
# $false = Cetakan kedua struk identik/persis sama (Standar Rumah Sakit)
# $true  = Menambahkan tulisan kecil "*** LEMBAR 1 : PASIEN ***" & "*** LEMBAR 2 : PETUGAS ***"
$SHOW_COPY_LABEL = $false

# Jeda waktu (milidetik) antar lembar cetak agar spooler printer thermal & auto-cutter memotong rapi
$DELAY_BETWEEN_COPIES_MS = 400

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

# Jika nama printer tidak ditentukan, otomatis ambil printer default Windows
if ([string]::IsNullOrWhiteSpace($PrinterName)) {
    try {
        $defaultPrinterObj = Get-CimInstance Win32_Printer | Where-Object { $_.Default -eq $true }
        if ($defaultPrinterObj) {
            $PrinterName = $defaultPrinterObj.Name
        }
    } catch {
        Write-Host "Warning: Gagal mendeteksi default printer otomatis." -ForegroundColor Yellow
    }
}

Clear-Host
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       PRINT BRIDGE ANTREAN RS - SILENT PRINTING          " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Printer Tujuan : $PrinterName" -ForegroundColor Green
Write-Host "Port Server    : http://localhost:18080/" -ForegroundColor Green
Write-Host "Jumlah Copy    : $DEFAULT_COPIES Rangkap (Otomatis keluar $DEFAULT_COPIES lembar)" -ForegroundColor Magenta
Write-Host "Status         : AKTIF & SIAP MENERIMA CETAK TIKET..." -ForegroundColor White
Write-Host "Layout Format  : Full Thermal Graphics (Presisi Layout Asli)" -ForegroundColor Cyan
Write-Host "----------------------------------------------------------" -ForegroundColor Gray
Write-Host "(Jangan tutup jendela ini selama Kiosk sedang beroperasi)" -ForegroundColor DarkGray
Write-Host ""

function Print-ThermalTicket {
    param(
        [Parameter(Mandatory=$true)] $ticket,
        [string] $targetPrinter,
        [int] $copyIndex = 1,
        [int] $totalCopies = 1
    )

    try {
        $printDoc = New-Object System.Drawing.Printing.PrintDocument
        if (-not [string]::IsNullOrWhiteSpace($targetPrinter)) {
            $printDoc.PrinterSettings.PrinterName = $targetPrinter
        }

        # Matikan margin default agar pencetakan thermal mepet rapi tanpa margin kosong
        $printDoc.OriginAtMargins = $false
        $printDoc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)

        # Lebar kertas: 58mm = ~200 unit (printable 48mm), 80mm = ~280 unit (printable 72mm)
        $is80mm = ($ticket.paperWidth -eq "80mm")
        $pageWidth = if ($is80mm) { 280 } else { 200 }

        # Hitung perkiraan tinggi struk agar kertas tidak keluar berlebihan
        $estHeight = 150
        if ($SHOW_COPY_LABEL -and $totalCopies -gt 1) { $estHeight += 20 }
        if (-not [string]::IsNullOrWhiteSpace($ticket.logoBase64)) { $estHeight += 60 }
        if (-not [string]::IsNullOrWhiteSpace($ticket.hospitalSubtitle)) { $estHeight += 18 }
        if ($ticket.showAddress -ne $false) {
            if (-not [string]::IsNullOrWhiteSpace($ticket.hospitalAddress)) { $estHeight += 16 }
            if (-not [string]::IsNullOrWhiteSpace($ticket.hospitalPhone)) { $estHeight += 16 }
        }
        if ($ticket.sequence) { $estHeight += 18 }
        if ($ticket.showDateTime -ne $false) { $estHeight += 30 }
        if ($ticket.showQrCode -ne $false -and -not [string]::IsNullOrWhiteSpace($ticket.qrCodeImage)) {
            $qrH = if ($ticket.qrCodeSize) { [int]$ticket.qrCodeSize } else { 75 }
            $estHeight += $qrH + 16
        }
        if (-not [string]::IsNullOrWhiteSpace($ticket.footerText)) {
            $fLines = ($ticket.footerText -split "`r?`n").Count
            $estHeight += ($fLines * 14) + 8
        }
        $estHeight += 25 # tear/cutter feed

        try {
            $customSize = New-Object System.Drawing.Printing.PaperSize("CustomTicket", $pageWidth, $estHeight)
            $printDoc.DefaultPageSettings.PaperSize = $customSize
        } catch {}

        # Simpan ke script scope agar dapat diakses di dalam event handler PrintPage
        $script:activeTicket = $ticket
        $script:ticketWidth = $pageWidth
        $script:copyIndex = $copyIndex
        $script:totalCopies = $totalCopies

        $printDoc.add_PrintPage({
            param($sender, [System.Drawing.Printing.PrintPageEventArgs]$e)

            $t = $script:activeTicket
            $w = $script:ticketWidth
            $curCopy = $script:copyIndex
            $totCopies = $script:totalCopies
            $g = $e.Graphics

            # Jika driver printer melaporkan lebar kertas thermal yang valid, gunakan
            if ($e.PageBounds.Width -gt 150 -and $e.PageBounds.Width -lt 350) {
                $w = $e.PageBounds.Width
            }

            # Optimasi ketajaman render thermal
            $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::SingleBitPerPixelGridFit
            $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor

            $brushBlack = [System.Drawing.Brushes]::Black
            $penDash = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 1)
            $penDash.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash

            $sfCenter = New-Object System.Drawing.StringFormat
            $sfCenter.Alignment = [System.Drawing.StringAlignment]::Center
            $sfCenter.LineAlignment = [System.Drawing.StringAlignment]::Near

            $sfLeft = New-Object System.Drawing.StringFormat
            $sfLeft.Alignment = [System.Drawing.StringAlignment]::Near
            $sfLeft.LineAlignment = [System.Drawing.StringAlignment]::Near

            # Skala font sesuai opsi ukuran
            $fScale = 1.0
            if ($t.fontSize -eq "small") { $fScale = 0.88 }
            if ($t.fontSize -eq "large") { $fScale = 1.15 }
            if ($w -gt 240) { $fScale = $fScale * 1.25 } # 80mm kertas

            $fontFamily = "Arial"
            $fHosp = New-Object System.Drawing.Font($fontFamily, (9.5 * $fScale), [System.Drawing.FontStyle]::Bold)
            $fSub = New-Object System.Drawing.Font($fontFamily, (7.5 * $fScale), [System.Drawing.FontStyle]::Regular)
            $fClinic = New-Object System.Drawing.Font($fontFamily, (9.0 * $fScale), [System.Drawing.FontStyle]::Bold)
            
            # Nomor antrean besar & tebal (Arial Black / Arial Bold)
            $fNum = $null
            try {
                $fNum = New-Object System.Drawing.Font("Arial Black", (26.0 * $fScale), [System.Drawing.FontStyle]::Bold)
            } catch {
                $fNum = New-Object System.Drawing.Font($fontFamily, (26.0 * $fScale), [System.Drawing.FontStyle]::Bold)
            }

            $fUrutan = New-Object System.Drawing.Font($fontFamily, (8.0 * $fScale), [System.Drawing.FontStyle]::Regular)
            $fDetails = New-Object System.Drawing.Font($fontFamily, (7.5 * $fScale), [System.Drawing.FontStyle]::Regular)
            $fDetailsBold = New-Object System.Drawing.Font($fontFamily, (7.5 * $fScale), [System.Drawing.FontStyle]::Bold)
            $fFooter = New-Object System.Drawing.Font($fontFamily, (7.0 * $fScale), [System.Drawing.FontStyle]::Regular)

            $y = 6

            # Label Rangkap/Copy (jika diaktifkan)
            if ($SHOW_COPY_LABEL -and $totCopies -gt 1) {
                $copyBadgeText = if ($curCopy -eq 1) { "*** LEMBAR 1 : PASIEN ***" } else { "*** LEMBAR 2 : PETUGAS / POLI ***" }
                $fBadge = New-Object System.Drawing.Font($fontFamily, (7.0 * $fScale), [System.Drawing.FontStyle]::Bold)
                $badgeSize = $g.MeasureString($copyBadgeText, $fBadge, [int]$w, $sfCenter)
                $g.DrawString($copyBadgeText, $fBadge, $brushBlack, (New-Object System.Drawing.RectangleF(0, $y, $w, $badgeSize.Height)), $sfCenter)
                $y += $badgeSize.Height + 4
                $fBadge.Dispose()
            }

            # 1. Hospital Logo (jika ada Base64)
            if (-not [string]::IsNullOrWhiteSpace($t.logoBase64)) {
                try {
                    $b64 = $t.logoBase64
                    if ($b64 -match "base64,(.+)$") {
                        $b64 = $matches[1]
                    }
                    $bytes = [System.Convert]::FromBase64String($b64)
                    $ms = New-Object System.IO.MemoryStream($bytes, 0, $bytes.Length)
                    $img = [System.Drawing.Image]::FromStream($ms)

                    $maxW = [int]($w * 0.75)
                    $maxH = if ($t.logoHeight) { [int]$t.logoHeight } else { 50 }
                    $ratio = [Math]::Min($maxW / $img.Width, $maxH / $img.Height)
                    $destW = [int]($img.Width * $ratio)
                    $destH = [int]($img.Height * $ratio)
                    $destX = [int](($w - $destW) / 2)

                    $g.DrawImage($img, $destX, $y, $destW, $destH)
                    $y += $destH + 6

                    $img.Dispose()
                    $ms.Dispose()
                } catch {
                    # Skip jika decode logo gagal
                }
            }

            # 2. Nama Rumah Sakit (Kapital, Tebal, Rata Tengah)
            $hName = if ($t.hospitalName) { $t.hospitalName.ToUpper() } else { "RUMAH SAKIT" }
            $hSize = $g.MeasureString($hName, $fHosp, [int]$w, $sfCenter)
            $g.DrawString($hName, $fHosp, $brushBlack, (New-Object System.Drawing.RectangleF(0, $y, $w, $hSize.Height)), $sfCenter)
            $y += $hSize.Height + 2

            # 3. Subtitle Rumah Sakit (Rata Tengah)
            if (-not [string]::IsNullOrWhiteSpace($t.hospitalSubtitle)) {
                $subSize = $g.MeasureString($t.hospitalSubtitle, $fSub, [int]$w, $sfCenter)
                $g.DrawString($t.hospitalSubtitle, $fSub, $brushBlack, (New-Object System.Drawing.RectangleF(0, $y, $w, $subSize.Height)), $sfCenter)
                $y += $subSize.Height + 2
            }

            # 3b. Alamat & Kontak Rumah Sakit (Rata Tengah)
            if ($t.showAddress -ne $false) {
                if (-not [string]::IsNullOrWhiteSpace($t.hospitalAddress)) {
                    $addrSize = $g.MeasureString($t.hospitalAddress, $fSub, [int]$w, $sfCenter)
                    $g.DrawString($t.hospitalAddress, $fSub, $brushBlack, (New-Object System.Drawing.RectangleF(0, $y, $w, $addrSize.Height)), $sfCenter)
                    $y += $addrSize.Height + 2
                }
                if (-not [string]::IsNullOrWhiteSpace($t.hospitalPhone)) {
                    $phoneTxt = "Telp/WA: " + $t.hospitalPhone
                    $pSize = $g.MeasureString($phoneTxt, $fSub, [int]$w, $sfCenter)
                    $g.DrawString($phoneTxt, $fSub, $brushBlack, (New-Object System.Drawing.RectangleF(0, $y, $w, $pSize.Height)), $sfCenter)
                    $y += $pSize.Height + 2
                }
            }

            # 4. Garis Putus-putus Atas
            $g.DrawLine($penDash, 4, $y, $w - 4, $y)
            $y += 6

            # 5. Nama Poliklinik (Kapital, Tebal, Rata Tengah)
            $cName = if ($t.clinicName) { $t.clinicName.ToUpper() } else { "" }
            $cSize = $g.MeasureString($cName, $fClinic, [int]$w, $sfCenter)
            $g.DrawString($cName, $fClinic, $brushBlack, (New-Object System.Drawing.RectangleF(0, $y, $w, $cSize.Height)), $sfCenter)
            $y += $cSize.Height + 2

            # 6. Nomor Antrean (Sangat Besar & Tebal, Rata Tengah)
            $tNum = if ($t.ticketNumber) { $t.ticketNumber } else { "---" }
            $numSize = $g.MeasureString($tNum, $fNum, [int]$w, $sfCenter)
            $g.DrawString($tNum, $fNum, $brushBlack, (New-Object System.Drawing.RectangleF(0, $y, $w, $numSize.Height)), $sfCenter)
            $y += $numSize.Height + 1

            # 7. Urutan (Urutan Ke-X)
            $uText = if ($t.sequence) { "Urutan Ke-" + $t.sequence } else { "" }
            if ($uText) {
                $uSize = $g.MeasureString($uText, $fUrutan, [int]$w, $sfCenter)
                $g.DrawString($uText, $fUrutan, $brushBlack, (New-Object System.Drawing.RectangleF(0, $y, $w, $uSize.Height)), $sfCenter)
                $y += $uSize.Height + 4
            } else {
                $y += 2
            }

            # 8. Garis Putus-putus Tengah
            $g.DrawLine($penDash, 4, $y, $w - 4, $y)
            $y += 6

            # 9. Detail (Tanggal, Pukul, Status)
            $leftPad = 8
            $lineStep = 13 * $fScale
            if ($t.showDateTime -ne $false) {
                if ($t.date) {
                    $g.DrawString("Tanggal : $($t.date)", $fDetails, $brushBlack, $leftPad, $y)
                    $y += $lineStep
                }
                if ($t.time) {
                    $g.DrawString("Pukul   : $($t.time) WIB", $fDetails, $brushBlack, $leftPad, $y)
                    $y += $lineStep
                }
            }
            $y += 6

            # 10. QR Code Image & Label (Pengganti Barcode)
            if ($t.showQrCode -ne $false -and -not [string]::IsNullOrWhiteSpace($t.qrCodeImage)) {
                try {
                    $b64Qr = $t.qrCodeImage
                    if ($b64Qr -match "base64,(.+)$") {
                        $b64Qr = $matches[1]
                    }
                    $qrBytes = [System.Convert]::FromBase64String($b64Qr)
                    $qrMs = New-Object System.IO.MemoryStream($qrBytes, 0, $qrBytes.Length)
                    $qrImg = [System.Drawing.Image]::FromStream($qrMs)

                    $qrTargetW = if ($t.qrCodeSize) { [int]$t.qrCodeSize } else { if ($is80mm) { 85 } else { 70 } }
                    $qrTargetW = [Math]::Min($qrTargetW, [int]($w * 0.75))
                    $qrTargetH = $qrTargetW
                    $qrX = [int](($w - $qrTargetW) / 2)

                    $g.DrawImage($qrImg, $qrX, $y, $qrTargetW, $qrTargetH)
                    $y += $qrTargetH + 4

                    if (-not [string]::IsNullOrWhiteSpace($t.qrCodeLabel)) {
                        $lblSize = $g.MeasureString($t.qrCodeLabel, $fFooter, [int]$w, $sfCenter)
                        $g.DrawString($t.qrCodeLabel, $fFooter, $brushBlack, (New-Object System.Drawing.RectangleF(0, $y, $w, $lblSize.Height)), $sfCenter)
                        $y += $lblSize.Height + 4
                    }

                    $qrImg.Dispose()
                    $qrMs.Dispose()
                } catch {}
            }

            # 11. Footer Text (Multi-line, Rata Tengah)
            if (-not [string]::IsNullOrWhiteSpace($t.footerText)) {
                $footerLines = $t.footerText -split "`r?`n"
                foreach ($fl in $footerLines) {
                    $trimmed = $fl.Trim()
                    if ($trimmed) {
                        $fSize = $g.MeasureString($trimmed, $fFooter, [int]$w, $sfCenter)
                        $g.DrawString($trimmed, $fFooter, $brushBlack, (New-Object System.Drawing.RectangleF(0, $y, $w, $fSize.Height)), $sfCenter)
                        $y += $fSize.Height + 2
                    }
                }
            }

            $y += 18
            $e.HasMorePages = $false

            # Bersihkan objek GDI
            $penDash.Dispose()
            $fHosp.Dispose()
            $fSub.Dispose()
            $fClinic.Dispose()
            if ($fNum) { $fNum.Dispose() }
            $fUrutan.Dispose()
            $fDetails.Dispose()
            $fDetailsBold.Dispose()
            $fFooter.Dispose()
            $sfCenter.Dispose()
            $sfLeft.Dispose()
        })

        $printDoc.Print()
        $printDoc.Dispose()
        return $true
    } catch {
        Write-Host "Warning: GDI PrintDocument encountered exception: $_" -ForegroundColor Yellow
        Write-Host "Menggunakan fallback cetak teks..." -ForegroundColor Gray

        # Fallback teks rapi jika GDI gagal
        $div = "--------------------------------"
        $copyHeader = ""
        if ($SHOW_COPY_LABEL -and $totalCopies -gt 1) {
            $copyHeader = if ($copyIndex -eq 1) { "*** LEMBAR 1 : PASIEN ***`n" } else { "*** LEMBAR 2 : PETUGAS / POLI ***`n" }
        }
        $fallbackTxt = @"

$copyHeader$($ticket.hospitalName)
$($ticket.hospitalSubtitle)
$div
$($ticket.clinicName)

$($ticket.ticketNumber)
Urutan Ke-$($ticket.sequence)
$div
Tanggal : $($ticket.date)
Pukul   : $($ticket.time) WIB
$div
$($ticket.footerText)


"@
        if ([string]::IsNullOrWhiteSpace($targetPrinter)) {
            $fallbackTxt | Out-Printer
        } else {
            $fallbackTxt | Out-Printer -Name $targetPrinter
        }
        return $true
    }
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:18080/")

try {
    $listener.Start()
} catch {
    Write-Host "ERROR: Gagal membuka port 18080. Pastikan tidak ada aplikasi lain yang memakai port ini." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    pause
    exit
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # Header CORS agar Web Kiosk di browser diizinkan memanggil localhost
        $response.AddHeader("Access-Control-Allow-Origin", "*")
        $response.AddHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        $response.AddHeader("Access-Control-Allow-Headers", "Content-Type")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        # Endpoint Status
        if ($request.HttpMethod -eq "GET" -and $request.RawUrl -match "/status") {
            $statusObj = @{
                status = "ok"
                printer = $PrinterName
                defaultCopies = $DEFAULT_COPIES
                configFile = (Test-Path $CONFIG_FILE)
            }
            $jsonStr = $statusObj | ConvertTo-Json -Compress
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonStr)
            $response.ContentType = "application/json"
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # Endpoint Ubah Konfigurasi Copies Langsung dari Layar Kiosk / Web Komputer Ini
        if ($request.HttpMethod -eq "POST" -and $request.RawUrl -match "/set-copies") {
            try {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $cfgPayload = $body | ConvertFrom-Json
                $newCopies = if ($cfgPayload.copies) { [int]$cfgPayload.copies } else { 2 }
                if ($newCopies -lt 1) { $newCopies = 1 }
                if ($newCopies -gt 5) { $newCopies = 5 }
                $DEFAULT_COPIES = $newCopies

                # Simpan permanen ke bridge-config.json
                @{ copies = $newCopies; updatedAt = (Get-Date -Format 's') } | ConvertTo-Json | Set-Content -Path $CONFIG_FILE -Encoding UTF8
                Write-Host "[CONFIG] Jumlah copy komputer ini diatur ke: $DEFAULT_COPIES Lembar" -ForegroundColor Cyan

                $resObj = @{ success = $true; copies = $DEFAULT_COPIES }
                $resJson = $resObj | ConvertTo-Json -Compress
                $resBuffer = [System.Text.Encoding]::UTF8.GetBytes($resJson)
                $response.ContentType = "application/json"
                $response.OutputStream.Write($resBuffer, 0, $resBuffer.Length)
                $response.Close()
                continue
            } catch {
                $response.StatusCode = 500
                $response.Close()
                continue
            }
        }

        # Endpoint Print Tiket
        if ($request.HttpMethod -eq "POST" -and $request.RawUrl -match "/print") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $body = $reader.ReadToEnd()
            $ticket = $body | ConvertFrom-Json

            $tktNum = $ticket.ticketNumber
            $poliName = $ticket.clinicName
            
            # Prioritas penentuan jumlah rangkap copy:
            # 1. Jika useLocalBridgeCopies = true, selalu pakai $DEFAULT_COPIES milik Print Bridge komputer ini
            # 2. Jika payload mengirim ticket.copies valid (angka > 0, bukan string 'device' / 'auto'), gunakan nilai tersebut
            # 3. Default fallback: gunakan $DEFAULT_COPIES milik Print Bridge komputer ini
            $targetCopies = $DEFAULT_COPIES
            if (-not $ticket.useLocalBridgeCopies -and $ticket.copies -and "$($ticket.copies)" -ne "device" -and "$($ticket.copies)" -ne "auto") {
                try {
                    $cNum = [int]$ticket.copies
                    if ($cNum -gt 0) {
                        $targetCopies = $cNum
                    }
                } catch {}
            }

            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] MENCETAK TIKET: $tktNum -> $poliName (Target: $targetCopies Rangkap)" -ForegroundColor Yellow

            $allSuccess = $true
            for ($c = 1; $c -le $targetCopies; $c++) {
                if ($targetCopies -gt 1) {
                    Write-Host "   -> Mencetak Rangkap ke-$c dari $targetCopies..." -ForegroundColor Cyan
                }
                $printSuccess = Print-ThermalTicket -ticket $ticket -targetPrinter $PrinterName -copyIndex $c -totalCopies $targetCopies
                if (-not $printSuccess) { $allSuccess = $false }

                # Jeda sepersekian detik antar lembar agar antrean spooler printer thermal dan auto-cutter bekerja rapi
                if ($c -lt $targetCopies) {
                    Start-Sleep -Milliseconds $DELAY_BETWEEN_COPIES_MS
                }
            }

            Write-Host "   -> Sukses! Semua ($targetCopies rangkap) tiket berhasil dicetak." -ForegroundColor Green

            $resultObj = @{ success = $allSuccess; ticket = $tktNum; copies = $targetCopies }
            $resJson = $resultObj | ConvertTo-Json -Compress
            $resBuffer = [System.Text.Encoding]::UTF8.GetBytes($resJson)
            $response.ContentType = "application/json"
            $response.OutputStream.Write($resBuffer, 0, $resBuffer.Length)
            $response.Close()
        } else {
            $response.StatusCode = 404
            $response.Close()
        }
    } catch {
        Write-Host "Error pemrosesan cetak: $_" -ForegroundColor Red
    }
}
