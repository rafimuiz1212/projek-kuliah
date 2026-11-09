import React, { useState } from "react";
import { 
  X, 
  BookOpen, 
  Compass, 
  Shield, 
  Database, 
  RefreshCw, 
  Ruler, 
  MapPin, 
  Lock, 
  Cpu, 
  CheckCircle, 
  AlertTriangle,
  HelpCircle,
  FileSpreadsheet,
  Globe,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ManualBookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ManualBookModal({ isOpen, onClose }: ManualBookModalProps) {
  const [activeCategory, setActiveCategory] = useState<"umum" | "teknisi" | "noc" | "integrasi" | "faq">("umum");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 rounded-xl border border-blue-400/30 text-blue-300">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold flex items-center gap-2">
                <span>Manual Book & Buku Panduan Penggunaan</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-medium">
                  v2.0 FTTH
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Dokumentasi & Panduan Lengkap Aplikasi ODP Coverage Checker
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Tutup Manual Book"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Category Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-1 overflow-x-auto shrink-0 text-xs font-bold">
          <button
            onClick={() => setActiveCategory("umum")}
            className={`px-3.5 py-2.5 rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeCategory === "umum"
                ? "bg-white text-blue-600 border-t-2 border-x border-slate-200 border-t-blue-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
            }`}
          >
            <Info className="w-4 h-4 text-blue-500" />
            <span>1. Ikhtisar & Sistem</span>
          </button>
          <button
            onClick={() => setActiveCategory("teknisi")}
            className={`px-3.5 py-2.5 rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeCategory === "teknisi"
                ? "bg-white text-emerald-600 border-t-2 border-x border-slate-200 border-t-emerald-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
            }`}
          >
            <Compass className="w-4 h-4 text-emerald-500" />
            <span>2. Panduan Teknisi Field</span>
          </button>
          <button
            onClick={() => setActiveCategory("noc")}
            className={`px-3.5 py-2.5 rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeCategory === "noc"
                ? "bg-white text-indigo-600 border-t-2 border-x border-slate-200 border-t-indigo-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
            }`}
          >
            <Shield className="w-4 h-4 text-amber-500" />
            <span>3. Panduan Tim NOC</span>
          </button>
          <button
            onClick={() => setActiveCategory("integrasi")}
            className={`px-3.5 py-2.5 rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeCategory === "integrasi"
                ? "bg-white text-purple-600 border-t-2 border-x border-slate-200 border-t-purple-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
            }`}
          >
            <Cpu className="w-4 h-4 text-purple-500" />
            <span>4. SmartOLT & GenieACS</span>
          </button>
          <button
            onClick={() => setActiveCategory("faq")}
            className={`px-3.5 py-2.5 rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeCategory === "faq"
                ? "bg-white text-rose-600 border-t-2 border-x border-slate-200 border-t-rose-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
            }`}
          >
            <HelpCircle className="w-4 h-4 text-rose-500" />
            <span>5. FAQ & Troubleshooting</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-6 text-slate-700 text-xs sm:text-sm leading-relaxed">
          
          {/* TAB 1: IKHTISAR & SISTEM */}
          {activeCategory === "umum" && (
            <div className="space-y-4">
              <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 space-y-2">
                <h3 className="font-extrabold text-blue-900 text-sm flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-600" />
                  <span>Tentang Aplikasi ODP Coverage Checker</span>
                </h3>
                <p className="text-slate-600 text-xs">
                  Aplikasi ini dirancang khusus untuk mempermudah survei jangkauan jaringan Fiber To The Home (FTTH), analisis kelayakan pemasangan PSB (Pasang Baru), serta manajemen aset ODP (Optical Distribution Point) secara akurat dan terpusat.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50 space-y-1.5">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-emerald-600" />
                    Penyimpanan Server & Database JSON
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Seluruh data ODP tersimpan secara aman pada file <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">odp_db.json</code> di server backend Cloud Node.js.
                  </p>
                </div>

                <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50 space-y-1.5">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4 text-blue-600" />
                    Sinkronisasi Real-Time
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Tombol <strong>Sinkronisasi ODP</strong> menjamin teknisi lapangan selalu mendapatkan data kapasitas port ODP paling ter-update tanpa perlu melakukan reload halaman.
                  </p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Peran & Akses Pengguna</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
                    <Compass className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-emerald-900 block">Teknisi Lapangan / Sales / Direct Agent:</strong>
                      <span className="text-slate-600">Dapat langsung mengecek jangkauan ODP, jarak dropcore, status port, dan menggambar rute penarikan kabel manual tanpa perlu login.</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100">
                    <Lock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-indigo-900 block">Tim NOC / Administrator Jaringan:</strong>
                      <span className="text-slate-600">Memiliki wewenang penuh (dengan otentikasi PIN NOC) untuk mengelola data ODP, import/export KMZ Google Earth, mengatur API SmartOLT, dan GeniusACS.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TEKNISI FIELD */}
          {activeCategory === "teknisi" && (
            <div className="space-y-4">
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 space-y-2">
                <h3 className="font-extrabold text-emerald-900 text-sm flex items-center gap-2">
                  <Compass className="w-4 h-4 text-emerald-600" />
                  <span>Panduan Langkah demi Langkah Cek Jangkauan</span>
                </h3>
                <p className="text-slate-600 text-xs">
                  Gunakan menu ini saat melakukan survei lokasi calon pelanggan di lapangan untuk memastikan apakah panjang kabel dropcore dan sisa port ODP memenuhi standar teknis ISP.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3 border border-slate-200 rounded-xl space-y-1 bg-white">
                  <div className="font-bold text-slate-800 flex items-center gap-2">
                    <span className="bg-blue-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-extrabold">1</span>
                    <span>Fitur Cari ODP Lapangan (Pencarian Instan)</span>
                  </div>
                  <ul className="list-disc list-inside text-xs text-slate-600 pl-6 space-y-1">
                    <li>Ketik nama/kode ODP (misal: <code>ODP-JAT-01</code>) pada kolom <strong>Cari ODP Lapangan</strong> di menu utama.</li>
                    <li>Gunakan filter <strong>Port Tersedia</strong> atau <strong>Port Penuh</strong> untuk menyaring kondisi ODP.</li>
                    <li>Klik <strong>Lihat Peta</strong> untuk langsung memicu zoom & highlight titik ODP di peta secara instan.</li>
                    <li>Klik <strong>Acuan</strong> untuk menjadikan lokasi ODP sebagai titik pusat analisis jarak.</li>
                  </ul>
                </div>

                <div className="p-3 border border-slate-200 rounded-xl space-y-1 bg-white">
                  <div className="font-bold text-slate-800 flex items-center gap-2">
                    <span className="bg-blue-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-extrabold">2</span>
                    <span>Tentukan Lokasi Rumah Calon Pelanggan</span>
                  </div>
                  <ul className="list-disc list-inside text-xs text-slate-600 pl-6 space-y-1">
                    <li>Klik <strong>Gunakan Lokasi Saya (GPS)</strong> untuk deteksi otomatis via smartphone/device.</li>
                    <li>Atau masukkan koordinat Latitude, Longitude secara manual.</li>
                    <li>Atau <strong>geser / drag marker biru</strong> langsung pada peta ke titik lokasi rumah.</li>
                  </ul>
                </div>

                <div className="p-3 border border-slate-200 rounded-xl space-y-1 bg-white">
                  <div className="font-bold text-slate-800 flex items-center gap-2">
                    <span className="bg-blue-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-extrabold">2</span>
                    <span>Pilih Mode Pengukuran Jalur Kabel</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 pl-6">
                    <div className="p-2 bg-slate-50 border rounded-lg text-xs">
                      <strong className="text-blue-700 block">Jalur Jalan (OSRM)</strong>
                      <span className="text-[11px] text-slate-500">Menghitung jarak otomatis mengikut rute kontur jalan terdekat.</span>
                    </div>
                    <div className="p-2 bg-slate-50 border rounded-lg text-xs">
                      <strong className="text-indigo-700 block">Garis Lurus</strong>
                      <span className="text-[11px] text-slate-500">Menghitung jarak lurus udara (Haversine formula).</span>
                    </div>
                    <div className="p-2 bg-slate-50 border rounded-lg text-xs">
                      <strong className="text-emerald-700 block">Jalur Manual</strong>
                      <span className="text-[11px] text-slate-500">Klik beberapa titik di peta untuk menggambar rute penarikan tiang yang sebenarnya.</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 border border-slate-200 rounded-xl space-y-1 bg-white">
                  <div className="font-bold text-slate-800 flex items-center gap-2">
                    <span className="bg-blue-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-extrabold">3</span>
                    <span>Pilih Standar Toleransi Kabel Dropcore</span>
                  </div>
                  <p className="text-xs text-slate-600 pl-6">
                    Pilih batas toleransi penarikan kabel (misal: <strong>200 Meter</strong>, <strong>250 Meter</strong>, atau <strong>300 Meter</strong>).
                  </p>
                </div>

                <div className="p-3 border border-slate-200 rounded-xl space-y-1 bg-white">
                  <div className="font-bold text-slate-800 flex items-center gap-2">
                    <span className="bg-blue-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-extrabold">4</span>
                    <span>Analisis Hasil & Status Kelayakan</span>
                  </div>
                  <div className="pl-6 space-y-1 text-xs text-slate-600">
                    <div className="flex items-center gap-2 text-emerald-700 font-bold">
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      <span>SANGAT LAYAK: ODP &lt; 200m & sisa port &gt; 1</span>
                    </div>
                    <div className="flex items-center gap-2 text-amber-600 font-bold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>PERINGATAN: Jarak mendekati batas toleransi (200-300m) atau tersisa 1 port</span>
                    </div>
                    <div className="flex items-center gap-2 text-rose-600 font-bold">
                      <X className="w-4 h-4 shrink-0" />
                      <span>TIDAK LAYAK: Jarak &gt; 300m atau seluruh port ODP PENUH</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 border border-slate-200 rounded-xl space-y-1 bg-white">
                  <div className="font-bold text-slate-800 flex items-center gap-2">
                    <span className="bg-emerald-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-extrabold">5</span>
                    <span>Cek Pelanggan & Status Port ODP (Online, Offline, Dying Gasp)</span>
                  </div>
                  <div className="pl-6 space-y-1.5 text-xs text-slate-600">
                    <p>Tekan tombol <strong>Port / Pelanggan</strong> pada kartu ODP atau popup peta untuk melihat rincian setiap port yang tertancap kabel dropcore:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-1">
                      <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold text-[11px] flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Online: ONT menyala & internet normal
                      </span>
                      <span className="p-1.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 font-semibold text-[11px] flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        Offline: Kabel putus / redaman drop / LOS
                      </span>
                      <span className="p-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-semibold text-[11px] flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        Dying Gasp: Listrik padam di rumah pelanggan
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: NOC ADMIN */}
          {activeCategory === "noc" && (
            <div className="space-y-4">
              <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-4 space-y-2">
                <h3 className="font-extrabold text-indigo-900 text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-500" />
                  <span>Panduan Administrasi NOC & Pengelolaan ODP</span>
                </h3>
                <p className="text-slate-600 text-xs">
                  Modul khusus Tim NOC untuk menambah, memperbarui, mengimpor file KMZ, dan mengamankan sistem.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 border border-slate-200 rounded-xl bg-white space-y-2">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <Lock className="w-4 h-4 text-emerald-600" />
                    1. Otentikasi & Login Panel NOC
                  </h4>
                  <p className="text-xs text-slate-600">
                    Klik tombol <strong>Menu NOC</strong> atau <strong>Buka Panel NOC</strong> di bagian kanan atas layar. Masukkan password PIN NOC (Default awal: <code className="bg-slate-100 border px-1.5 py-0.5 rounded text-indigo-700 font-mono font-bold">noc123</code>).
                  </p>
                </div>

                <div className="p-3.5 border border-slate-200 rounded-xl bg-white space-y-2">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <Database className="w-4 h-4 text-blue-600" />
                    2. Tambah, Edit, & Hapus Data ODP Manual
                  </h4>
                  <p className="text-xs text-slate-600">
                    Di dalam Panel NOC, pilih tab <strong>Database ODP</strong>. Anda dapat menginput ODP baru (Nama, Kode ODP, Koordinat, Jumlah Port total 8/16/24/32, dan Port Terisi).
                  </p>
                </div>

                <div className="p-3.5 border border-slate-200 rounded-xl bg-white space-y-2">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <FileSpreadsheet className="w-4 h-4 text-purple-600" />
                    3. Import Massal File Google Earth (KMZ / KML)
                  </h4>
                  <p className="text-xs text-slate-600">
                    Upload file <code>.kmz</code> atau <code>.kml</code> dari Google Earth untuk mengekstrak seluruh titik ODP beserta titik koordinatnya secara otomatis ke database sistem.
                  </p>
                </div>

                <div className="p-3.5 border border-slate-200 rounded-xl bg-white space-y-2">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <Lock className="w-4 h-4 text-rose-600" />
                    4. Mengganti Password PIN NOC
                  </h4>
                  <p className="text-xs text-slate-600">
                    Buka Panel NOC -&gt; Tab <strong>Pengaturan PIN</strong>. Masukkan password baru (minimal 4 karakter) lalu klik <strong>Simpan Password Baru</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: INTEGRASI */}
          {activeCategory === "integrasi" && (
            <div className="space-y-4">
              <div className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-4 space-y-2">
                <h3 className="font-extrabold text-purple-900 text-sm flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-purple-600" />
                  <span>Integrasi SmartOLT API & GenieACS (TR-069)</span>
                </h3>
                <p className="text-slate-600 text-xs">
                  Aplikasi ini terhubung langsung dengan sistem OLT SmartOLT dan pelayan TR-069 GenieACS untuk monitoring perangkat ONU pelanggan.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 border border-slate-200 rounded-2xl bg-white space-y-2">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-2 text-indigo-700">
                    <Globe className="w-4 h-4" />
                    1. Integrasi SmartOLT
                  </span>
                  <p className="text-xs text-slate-600">
                    Masukkan Domain SmartOLT (misal: <code>domain.smartolt.com</code>) dan API Token di Tab Integrasi Panel NOC.
                  </p>
                  <ul className="list-disc list-inside text-[11px] text-slate-500 space-y-1 pt-1">
                    <li>Dapat melakukan auto-mapping ODB/Splitter SmartOLT ke ODP internal.</li>
                    <li>Melakukan pengecekan status ONU (Online/Offline, Sinyal RX/TX Redaman Optical) secara langsung.</li>
                  </ul>
                </div>

                <div className="p-4 border border-slate-200 rounded-2xl bg-white space-y-2">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-2 text-purple-700">
                    <Cpu className="w-4 h-4" />
                    2. Integrasi GenieACS (TR-069)
                  </span>
                  <p className="text-xs text-slate-600">
                    Sistem dapat terhubung ke server GenieACS REST API (Port 7557) untuk melihat paramater NBI modem router pelanggan.
                  </p>
                  <ul className="list-disc list-inside text-[11px] text-slate-500 space-y-1 pt-1">
                    <li>Mendukung HTTP Basic Authentication.</li>
                    <li>Cek Serial Number (SN), SSID Wi-Fi, dan uptime modem.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: FAQ & TROUBLESHOOTING */}
          {activeCategory === "faq" && (
            <div className="space-y-4">
              <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-4 space-y-2">
                <h3 className="font-extrabold text-rose-900 text-sm flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-rose-600" />
                  <span>Pertanyaan Umum & Pemecahan Masalah (Troubleshooting)</span>
                </h3>
                <p className="text-slate-600 text-xs">
                  Solusi cepat untuk kendala umum yang sering ditemui di lapangan.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 border border-slate-200 rounded-xl bg-white space-y-1">
                  <strong className="text-slate-900 text-xs block">Q: Kenapa ODP yang baru ditambahkan oleh NOC tidak muncul di HP Teknisi?</strong>
                  <p className="text-xs text-slate-600">
                    <strong>Solusi:</strong> Tekan tombol <span className="text-emerald-700 font-bold">Refresh / Sinkronisasi ODP</span> di bagian atas layar untuk memuat database ODP terbaru dari server.
                  </p>
                </div>

                <div className="p-3.5 border border-slate-200 rounded-xl bg-white space-y-1">
                  <strong className="text-slate-900 text-xs block">Q: Kenapa jarak rute jalan OSRM kadang berubah menjadi garis lurus?</strong>
                  <p className="text-xs text-slate-600">
                    <strong>Solusi:</strong> Jika server OSRM publik mengalami keterbatasan rate-limit atau lokasi tidak memiliki jaringan jalan terdaftar, sistem secara otomatis beralih ke jarak lurus Haversine agar kalkulasi tidak macet.
                  </p>
                </div>

                <div className="p-3.5 border border-slate-200 rounded-xl bg-white space-y-1">
                  <strong className="text-slate-900 text-xs block">Q: Di mana data ODP tersimpan? Apakah hilang jika browser di-clear?</strong>
                  <p className="text-xs text-slate-600">
                    <strong>Solusi:</strong> Data tersimpan secara terpusat di server backend dalam file <code>odp_db.json</code>. Data tidak akan hilang saat menghapus cache browser.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 font-medium">
            Buku Panduan Operasional ODP Coverage Checker
          </div>
          <button
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-xs"
          >
            Tutup Buku Panduan
          </button>
        </div>

      </motion.div>
    </div>
  );
}
