import React, { useState } from "react";
import { 
  X, 
  Users, 
  Wifi, 
  WifiOff, 
  ZapOff, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Radio, 
  MapPin, 
  Info,
  Plus,
  Trash2,
  Edit2,
  Check,
  Loader2
} from "lucide-react";
import { ODP, OdpCustomer, CustomerStatus } from "../types";

interface OdpCustomerModalProps {
  odp: ODP;
  isOpen: boolean;
  onClose: () => void;
  onOdpUpdated?: (updatedOdp: ODP) => void;
}

export default function OdpCustomerModal({ odp, isOpen, onClose, onOdpUpdated }: OdpCustomerModalProps) {
  const [currentOdp, setCurrentOdp] = useState<ODP>(odp);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | CustomerStatus | "empty">("all");

  // Form tambah / edit pelanggan manual
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [formPort, setFormPort] = useState<number>(1);
  const [formName, setFormName] = useState("");
  const [formStatus, setFormStatus] = useState<CustomerStatus>("online");
  const [formOnuSn, setFormOnuSn] = useState("");
  const [formOnuModel, setFormOnuModel] = useState("ZTE F609");
  const [formAddress, setFormAddress] = useState("");
  const [formPackage, setFormPackage] = useState("30 Mbps Home");

  // Confirm delete customer
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null);

  // Sync state if prop changes
  React.useEffect(() => {
    setCurrentOdp(odp);
  }, [odp]);

  if (!isOpen) return null;

  // Always ensure customers are sorted strictly by port number ascending
  const customers = [...(currentOdp.customers || [])].sort((a, b) => a.port - b.port);

  // Status summaries
  const onlineCount = customers.filter(c => c.status === "online").length;
  const losCount = customers.filter(c => c.status === "los").length;
  const offlineCount = customers.filter(c => c.status === "offline").length;
  const dyinggaspCount = customers.filter(c => c.status === "dyinggasp").length;
  const availablePortsCount = Math.max(0, currentOdp.totalPorts - customers.length);

  // Generate complete port list 1..totalPorts strictly matching SmartOLT splitter port order
  const maxPort = Math.max(currentOdp.totalPorts, ...customers.map(c => c.port || 0));
  const allPorts: { port: number; customer?: OdpCustomer }[] = [];
  for (let portNum = 1; portNum <= maxPort; portNum++) {
    const matchingCustomers = customers.filter(c => c.port === portNum);
    if (matchingCustomers.length > 0) {
      matchingCustomers.forEach(cust => {
        allPorts.push({ port: portNum, customer: cust });
      });
    } else {
      allPorts.push({ port: portNum, customer: undefined });
    }
  }
  allPorts.sort((a, b) => a.port - b.port);

  // Find first available port for quick adding
  const firstEmptyPort = allPorts.find(p => !p.customer)?.port || 1;

  // Open add form for a specific port
  const handleOpenAddForm = (targetPort?: number) => {
    const p = targetPort || firstEmptyPort;
    setFormPort(p);
    setFormName("");
    setFormStatus("online");
    setFormOnuSn(`ZTEG${Math.floor(10000000 + Math.random() * 90000000)}`);
    setFormOnuModel("ZTE F609");
    setFormAddress("");
    setFormPackage("30 Mbps Home");
    setFormError("");
    setFormSuccess("");
    setShowAddForm(true);
  };

  // Submit add new customer to port
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError("Nama pelanggan wajib diisi.");
      return;
    }
    if (!formPort || formPort < 1 || formPort > currentOdp.totalPorts) {
      setFormError(`Nomor port harus antara 1 sampai ${currentOdp.totalPorts}.`);
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      const res = await fetch(`/api/odps/${encodeURIComponent(currentOdp.id)}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          port: formPort,
          name: formName.trim(),
          status: formStatus,
          onuSn: formOnuSn.trim() || undefined,
          onuModel: formOnuModel.trim() || undefined,
          address: formAddress.trim() || undefined,
          package: formPackage.trim() || undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        const updated = data.odp || {
          ...currentOdp,
          customers: [...customers.filter(c => c.port !== formPort), data.customer].sort((a, b) => a.port - b.port),
          availablePorts: Math.max(0, currentOdp.totalPorts - (customers.filter(c => c.port !== formPort).length + 1))
        };
        setCurrentOdp(updated);
        if (onOdpUpdated) onOdpUpdated(updated);
        setFormSuccess(`Pelanggan "${formName}" berhasil disambungkan ke Port ${formPort}!`);
        setTimeout(() => {
          setShowAddForm(false);
          setFormSuccess("");
        }, 1200);
      } else {
        const err = await res.json().catch(() => ({}));
        setFormError(err.error || "Gagal menambahkan pelanggan ke port.");
      }
    } catch (err: any) {
      setFormError(`Gagal menghubungi server: ${err.message || String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete / unplug customer from port
  const handleDeleteCustomer = async (customerId: string) => {
    try {
      const res = await fetch(`/api/odps/${encodeURIComponent(currentOdp.id)}/customers/${encodeURIComponent(customerId)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        const data = await res.json();
        const updated = data.odp || {
          ...currentOdp,
          customers: customers.filter(c => c.id !== customerId),
          availablePorts: Math.min(currentOdp.totalPorts, currentOdp.availablePorts + 1)
        };
        setCurrentOdp(updated);
        if (onOdpUpdated) onOdpUpdated(updated);
        setDeletingCustomerId(null);
      } else {
        alert("Gagal menghapus pelanggan dari port.");
      }
    } catch (err) {
      console.error("Gagal menghapus pelanggan:", err);
      alert("Terjadi kesalahan saat menghapus pelanggan.");
    }
  };

  // Filtered port list based on search and status
  const filteredPorts = allPorts.filter(({ port, customer }) => {
    // Filter by status
    if (filterStatus === "empty") {
      if (customer) return false;
    } else if (filterStatus !== "all") {
      if (!customer || customer.status !== filterStatus) return false;
    }

    // Filter by search query
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const portMatch = `port ${port}`.includes(q) || `p${port}` === q || `${port}` === q;
    if (!customer) return portMatch;

    return (
      portMatch ||
      customer.name.toLowerCase().includes(q) ||
      (customer.onuSn && customer.onuSn.toLowerCase().includes(q)) ||
      (customer.onuModel && customer.onuModel.toLowerCase().includes(q)) ||
      (customer.address && customer.address.toLowerCase().includes(q)) ||
      customer.status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="p-4 sm:px-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  Pemetaan Port: {currentOdp.name}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-bold">
                  {currentOdp.totalPorts} Port ODP
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Kelola Pelanggan, Status Koneksi ONU & Pemetaan Splitter Port
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenAddForm()}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Pelanggan Manual</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* METRICS & STATUS BANNER */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
            {/* Port Terpakai */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Port Terpakai</span>
                <span className="text-sm font-extrabold text-slate-800">
                  {customers.length} / {currentOdp.totalPorts}
                </span>
              </div>
              <Radio className="w-4 h-4 text-blue-600" />
            </div>

            {/* Port Kosong */}
            <div 
              onClick={() => setFilterStatus(filterStatus === "empty" ? "all" : "empty")}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                filterStatus === "empty" ? "bg-blue-100 border-blue-400 ring-2 ring-blue-300" : "bg-white border-slate-200 hover:bg-blue-50/50"
              }`}
            >
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Port Kosong</span>
                <span className={`text-sm font-extrabold ${availablePortsCount > 0 ? "text-blue-600" : "text-slate-400"}`}>
                  {availablePortsCount} Port
                </span>
              </div>
              <CheckCircle2 className="w-4 h-4 text-blue-500" />
            </div>

            {/* Online */}
            <div 
              onClick={() => setFilterStatus(filterStatus === "online" ? "all" : "online")}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                filterStatus === "online" ? "bg-emerald-100 border-emerald-400 ring-2 ring-emerald-300" : "bg-emerald-50/70 border-emerald-200 hover:bg-emerald-100/60"
              }`}
            >
              <div>
                <span className="text-[10px] text-emerald-700 block font-bold uppercase flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Online
                </span>
                <span className="text-sm font-extrabold text-emerald-900">{onlineCount} User</span>
              </div>
              <Wifi className="w-4 h-4 text-emerald-600" />
            </div>

            {/* LOS (Kabel Optik Putus) */}
            <div 
              onClick={() => setFilterStatus(filterStatus === "los" ? "all" : "los")}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                filterStatus === "los" ? "bg-red-100 border-red-400 ring-2 ring-red-300" : "bg-red-50/70 border-red-200 hover:bg-red-100/60"
              }`}
            >
              <div>
                <span className="text-[10px] text-red-700 block font-bold uppercase flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-600" />
                  LOS (Optik)
                </span>
                <span className="text-sm font-extrabold text-red-900">{losCount} User</span>
              </div>
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>

            {/* Offline (Cek Status ke Admin) */}
            <div 
              onClick={() => setFilterStatus(filterStatus === "offline" ? "all" : "offline")}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                filterStatus === "offline" ? "bg-slate-200 border-slate-400 ring-2 ring-slate-400" : "bg-slate-100 border-slate-300 hover:bg-slate-200/60"
              }`}
            >
              <div>
                <span className="text-[10px] text-slate-700 block font-bold uppercase flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                  Offline
                </span>
                <span className="text-sm font-extrabold text-slate-900">{offlineCount} User</span>
                <span className="text-[9px] text-amber-700 block font-semibold leading-tight mt-0.5">
                  (Cek ke admin)
                </span>
              </div>
              <WifiOff className="w-4 h-4 text-slate-600" />
            </div>

            {/* Dying Gasp */}
            <div 
              onClick={() => setFilterStatus(filterStatus === "dyinggasp" ? "all" : "dyinggasp")}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                filterStatus === "dyinggasp" ? "bg-amber-100 border-amber-400 ring-2 ring-amber-300" : "bg-amber-50/70 border-amber-200 hover:bg-amber-100/60"
              }`}
            >
              <div>
                <span className="text-[10px] text-amber-800 block font-bold uppercase flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  Dying Gasp
                </span>
                <span className="text-sm font-extrabold text-amber-900">{dyinggaspCount} User</span>
              </div>
              <ZapOff className="w-4 h-4 text-amber-600" />
            </div>
          </div>
        </div>

        {/* CONTROLS BAR: SEARCH, ADD BUTTON & FILTERS */}
        <div className="p-3 sm:px-5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Cari nama pelanggan, SN ONU, atau nomor port..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 font-medium"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="hidden sm:flex items-center gap-1 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setFilterStatus("all")}
                className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterStatus === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("online")}
                className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterStatus === "online" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                }`}
              >
                Online ({onlineCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("los")}
                className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterStatus === "los" ? "bg-red-600 text-white" : "bg-red-50 text-red-700 hover:bg-red-100"
                }`}
              >
                LOS ({losCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("offline")}
                className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterStatus === "offline" ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Offline ({offlineCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("dyinggasp")}
                className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterStatus === "dyinggasp" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-800 hover:bg-amber-100"
                }`}
              >
                Dying Gasp ({dyinggaspCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("empty")}
                className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterStatus === "empty" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                }`}
              >
                Kosong ({availablePortsCount})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenAddForm()}
              className="flex sm:hidden items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah User</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenAddForm()}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              <span>+ Pasang Pelanggan</span>
            </button>
          </div>
        </div>

        {/* MODAL BODY (PORT LIST OR ADD FORM) */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 bg-slate-100/60">
          
          {/* FORM TAMBAH PELANGGAN MANUAL */}
          {showAddForm && (
            <div className="mb-4 bg-white border-2 border-emerald-500/80 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Tambah Pelanggan Baru ke Port ODP
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Colokkan ONU pelanggan secara manual ke port yang tersedia di {currentOdp.name}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <form onSubmit={handleSaveCustomer} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Nomor Port */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Nomor Port ODP <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formPort}
                      onChange={(e) => setFormPort(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                    >
                      {Array.from({ length: currentOdp.totalPorts }, (_, i) => i + 1).map((p) => {
                        const isUsed = customers.some(c => c.port === p);
                        return (
                          <option key={p} value={p}>
                            Port {p} {isUsed ? "(Terisi - akan ditimpa)" : "(Kosong)"}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Nama Pelanggan */}
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Nama Pelanggan <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Bpk. Bambang Sutrisno / Warung Berkah"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 font-medium"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Status ONU */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Status Koneksi Port
                    </label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as CustomerStatus)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="online">🟢 Online</option>
                      <option value="los">🔴 LOS (Kabel Optik)</option>
                      <option value="offline">⚪ Offline (Cek Admin)</option>
                      <option value="dyinggasp">🟡 Dying Gasp (Power Loss)</option>
                    </select>
                  </div>

                  {/* Serial Number (SN) */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Serial Number (SN) ONU
                    </label>
                    <input
                      type="text"
                      placeholder="ZTEG12345678 / HWTC12345678"
                      value={formOnuSn}
                      onChange={(e) => setFormOnuSn(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Model ONU */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Model ONU / ONT
                    </label>
                    <input
                      type="text"
                      placeholder="ZTE F609 / ZTE F670L / Huawei HG8245"
                      value={formOnuModel}
                      onChange={(e) => setFormOnuModel(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Paket Langganan */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Paket Internet
                    </label>
                    <input
                      type="text"
                      placeholder="30 Mbps Home / 50 Mbps Pro"
                      value={formPackage}
                      onChange={(e) => setFormPackage(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Alamat Pelanggan */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Alamat / Catatan Lokasi
                    </label>
                    <input
                      type="text"
                      placeholder="Jl. Melati No. 12, RT 03/05"
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Simpan Pelanggan ke Port</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {filteredPorts.length === 0 ? (
            <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center space-y-2">
              <Info className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-700">Tidak ada port yang sesuai kriteria pencarian</p>
              <p className="text-[10px] text-slate-400">Coba reset filter atau gunakan kata kunci lain</p>
            </div>
          ) : (
            <div className="flex flex-col space-y-2">
              {filteredPorts.map(({ port, customer }, rowIdx) => {
                const isOccupied = !!customer;
                const status = customer?.status;

                let borderCol = "border-slate-200 hover:border-slate-300 bg-white";
                let portBadgeCol = "bg-slate-800 text-white";

                if (isOccupied) {
                  if (status === "online") {
                    borderCol = "border-emerald-200 hover:border-emerald-300 bg-white";
                    portBadgeCol = "bg-emerald-600 text-white";
                  } else if (status === "los") {
                    borderCol = "border-red-300 hover:border-red-400 bg-red-50/20";
                    portBadgeCol = "bg-red-600 text-white";
                  } else if (status === "offline") {
                    borderCol = "border-slate-300 hover:border-slate-400 bg-slate-50/70";
                    portBadgeCol = "bg-slate-600 text-white";
                  } else if (status === "dyinggasp") {
                    borderCol = "border-amber-200 hover:border-amber-300 bg-amber-50/20";
                    portBadgeCol = "bg-amber-600 text-white";
                  }
                }

                return (
                  <div
                    key={`port-${port}-${customer?.id || rowIdx}`}
                    className={`border rounded-xl p-3 sm:p-3.5 transition-all shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 ${borderCol}`}
                  >
                    {/* Left: Port Number & Customer Name */}
                    <div className="flex items-center gap-3 min-w-0 md:w-[45%] shrink-0">
                      <div className={`w-9 h-9 rounded-xl font-extrabold text-sm flex items-center justify-center shrink-0 shadow-2xs ${portBadgeCol}`}>
                        P{port}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Port {port}
                          </span>

                          {/* Status Badge */}
                          {isOccupied ? (
                            <>
                              {status === "online" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <Wifi className="w-2.5 h-2.5 text-emerald-600" />
                                  <span>Online</span>
                                </span>
                              )}

                              {status === "los" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800 border border-red-300">
                                  <AlertTriangle className="w-2.5 h-2.5 text-red-600" />
                                  <span>LOS (Kabel Optik)</span>
                                </span>
                              )}

                              {status === "offline" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-800 border border-slate-300">
                                  <WifiOff className="w-2.5 h-2.5 text-slate-500" />
                                  <span>Offline</span>
                                  <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-bold">
                                    (cek status ke admin)
                                  </span>
                                </span>
                              )}

                              {status === "dyinggasp" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                                  <ZapOff className="w-2.5 h-2.5 text-amber-600" />
                                  <span>Dying Gasp (PLN)</span>
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                              <CheckCircle2 className="w-2.5 h-2.5 text-blue-500" />
                              <span>Port Kosong (Tersedia)</span>
                            </span>
                          )}
                        </div>

                        <div className="text-xs sm:text-sm font-extrabold text-slate-800 truncate mt-0.5" title={isOccupied ? customer.name : "Port Kosong"}>
                          {isOccupied ? (
                            customer.name
                          ) : (
                            <span className="text-slate-400 font-normal italic">Belum ada pelanggan tercolok</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Technical Device Info & Actions */}
                    <div className="flex-1 flex flex-wrap items-center justify-start md:justify-end gap-2 text-xs">
                      {isOccupied ? (
                        <>
                          <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] flex items-center gap-1.5">
                            <span className="text-slate-400 font-semibold text-[9px]">SN:</span>
                            <span className="font-mono font-bold text-slate-800 truncate max-w-[130px]" title={customer.onuSn}>
                              {customer.onuSn || "-"}
                            </span>
                          </div>

                          <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] flex items-center gap-1.5">
                            <span className="text-slate-400 font-semibold text-[9px]">Model:</span>
                            <span className="font-bold text-slate-700 truncate max-w-[120px]">
                              {customer.onuModel || "ZTE F609"}
                            </span>
                          </div>

                          {customer.address && (
                            <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] flex items-center gap-1 text-slate-600 max-w-[180px] truncate">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate" title={customer.address}>{customer.address}</span>
                            </div>
                          )}

                          {/* Tombol Cabut / Ganti Pelanggan */}
                          {deletingCustomerId === customer.id ? (
                            <div className="flex items-center gap-1 bg-rose-50 border border-rose-300 p-1 rounded-lg">
                              <span className="text-[10px] text-rose-800 font-bold px-1">Cabut?</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomer(customer.id)}
                                className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold cursor-pointer"
                              >
                                Ya
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingCustomerId(null)}
                                className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] font-bold cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeletingCustomerId(customer.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Cabut / Lepas pelanggan dari port ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenAddForm(port)}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Pasang Pelanggan di Port {port}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-3 sm:px-5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2 font-medium">
            <span className="font-bold text-slate-700">{currentOdp.name}</span>
            <span>•</span>
            <span>Total {currentOdp.totalPorts} Port</span>
            <span>•</span>
            <span className="text-emerald-700 font-semibold">{customers.length} Port Terpasang</span>
            <span>•</span>
            <span className="text-blue-700 font-semibold">{availablePortsCount} Port Kosong</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenAddForm()}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Pelanggan Manual</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-2xs"
            >
              Tutup
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
