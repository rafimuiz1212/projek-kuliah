import React, { useState, useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import JSZip from "jszip";
import { 
  Network, 
  MapPin, 
  Plus, 
  Trash2, 
  RotateCcw, 
  AlertTriangle, 
  CheckCircle, 
  HelpCircle, 
  BookOpen, 
  Layers, 
  Compass, 
  Loader2,
  Server,
  Sparkles,
  Search,
  ExternalLink,
  Edit2,
  X,
  UploadCloud,
  Globe,
  Cpu,
  Wifi,
  Send,
  Ruler,
  Lock,
  Unlock,
  Shield,
  Key,
  Eye,
  EyeOff,
  Settings,
  Check,
  RefreshCw,
  Copy,
  FileText,
  Users,
  WifiOff,
  ZapOff
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ODP, CoverageResult } from "./types";
import ManualBookModal from "./components/ManualBookModal";
import OdpCustomerModal from "./components/OdpCustomerModal";

const DEFAULT_CENTER = { lat: -6.825884945058438, lng: 107.13355371256111 }; // Jakarta Center (Menteng)

export default function App() {
  const [activeTab, setActiveTab] = useState<"check" | "database" | "integrasi">("check");
  const [odps, setOdps] = useState<ODP[]>([]);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>(DEFAULT_CENTER);
  const [coverage, setCoverage] = useState<CoverageResult | null>(null);
  const [lockedTargetOdp, setLockedTargetOdp] = useState<ODP | null>(null);
  const [customerModalOdp, setCustomerModalOdp] = useState<ODP | null>(null);
  const [measurementMode, setMeasurementMode] = useState<"road" | "manual">("road");
  const [manualPoints, setManualPoints] = useState<{ lat: number; lng: number }[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(false);
  
  // Mobile responsive view tab (for small phone screens)
  const [mobileTab, setMobileTab] = useState<"sidebar" | "map">("sidebar");

  // Map control state
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState<number>(15);
  const [basemap, setBasemap] = useState<"street" | "satellite" | "terrain">("street");
  const [mapInteractionEnabled, setMapInteractionEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const isTouch = "ontouchstart" in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
    return !isTouch || window.innerWidth >= 768;
  });
  
  // Leaflet refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const odpMarkersRef = useRef<L.Marker[]>([]);
  const coverageCircleRef = useRef<L.Circle | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const manualPolylineRef = useRef<L.Polyline | null>(null);
  const manualMarkersRef = useRef<L.Marker[]>([]);

  // Refs to avoid stale closure issues in Leaflet events
  const measurementModeRef = useRef<"road" | "manual">("road");
  const manualPointsRef = useRef<{ lat: number; lng: number }[]>([]);

  useEffect(() => {
    measurementModeRef.current = measurementMode;
  }, [measurementMode]);

  useEffect(() => {
    manualPointsRef.current = manualPoints;
  }, [manualPoints]);

  const lockedTargetOdpRef = useRef<ODP | null>(null);
  useEffect(() => {
    lockedTargetOdpRef.current = lockedTargetOdp;
  }, [lockedTargetOdp]);

  // KMZ / KML Import state
  const [kmzImporting, setKmzImporting] = useState<boolean>(false);
  const [parsedOdps, setParsedOdps] = useState<ODP[]>([]);
  const [importMessage, setImportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // SmartOLT integration state
  const [smartOltDomain, setSmartOltDomain] = useState<string>(() => localStorage.getItem("smartOltDomain") || "example.smartolt.com");
  const [smartOltKey, setSmartOltKey] = useState<string>(() => localStorage.getItem("smartOltKey") || "");
  const [smartOltLoading, setSmartOltLoading] = useState<boolean>(false);
  const [smartOltResult, setSmartOltResult] = useState<any>(null);
  const [smartOltError, setSmartOltError] = useState<string>("");
  const [smartOltSyncLoading, setSmartOltSyncLoading] = useState<boolean>(false);
  const [smartOltSyncResult, setSmartOltSyncResult] = useState<any>(null);
  const [smartOltSyncError, setSmartOltSyncError] = useState<string>("");
  const [smartOltOdbLoading, setSmartOltOdbLoading] = useState<boolean>(false);
  const [smartOltOdbResult, setSmartOltOdbResult] = useState<any>(null);
  const [smartOltOdbError, setSmartOltOdbError] = useState<string>("");
  const [smartOltOdbSearch, setSmartOltOdbSearch] = useState<string>("");
  const [odbMappingStatus, setOdbMappingStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // GenieACS integration state
  const [genieAcsHost, setGenieAcsHost] = useState<string>(() => localStorage.getItem("genieAcsHost") || "http://localhost:7557");
  const [genieAcsUser, setGenieAcsUser] = useState<string>(() => localStorage.getItem("genieAcsUser") || "");
  const [genieAcsPass, setGenieAcsPass] = useState<string>(() => localStorage.getItem("genieAcsPass") || "");
  const [genieAcsLoading, setGenieAcsLoading] = useState<boolean>(false);
  const [genieAcsResult, setGenieAcsResult] = useState<any>(null);
  const [genieAcsError, setGenieAcsError] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // NOC Password & Authentication State
  const [isNocAuthenticated, setIsNocAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem("noc_authenticated") === "true";
  });
  const [showNocAuthModal, setShowNocAuthModal] = useState<boolean>(false);
  const [showNocPanelModal, setShowNocPanelModal] = useState<boolean>(false);
  const [nocActiveTab, setNocActiveTab] = useState<"database" | "integrasi" | "settings">("database");
  
  // NOC Auth Form inputs
  const [nocInputPassword, setNocInputPassword] = useState<string>("");
  const [showNocPasswordText, setShowNocPasswordText] = useState<boolean>(false);
  const [nocAuthError, setNocAuthError] = useState<string>("");
  const [nocLoginLoading, setNocLoginLoading] = useState<boolean>(false);
  
  // Change NOC Password inputs
  const [newNocPasswordInput, setNewNocPasswordInput] = useState<string>("");
  const [nocPassSuccessMsg, setNocPassSuccessMsg] = useState<string>("");
  const [nocChangingPassword, setNocChangingPassword] = useState<boolean>(false);

  // Manual Book modal state
  const [showManualBookModal, setShowManualBookModal] = useState<boolean>(false);

  // Handle NOC Authentication Login (Synchronized centrally across all devices)
  const handleNocLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedInput = nocInputPassword.trim();
    if (!trimmedInput) {
      setNocAuthError("Silakan masukkan password NOC.");
      return;
    }

    setNocLoginLoading(true);
    setNocAuthError("");

    try {
      const response = await fetch("/api/noc/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: trimmedInput })
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setIsNocAuthenticated(true);
        sessionStorage.setItem("noc_authenticated", "true");
        setShowNocAuthModal(false);
        setShowNocPanelModal(true);
        setNocInputPassword("");
        setNocAuthError("");
      } else {
        setNocAuthError(data.error || "Password NOC tidak valid! Silakan coba lagi.");
      }
    } catch (err) {
      console.warn("NOC login network check failed, attempting local fallback:", err);
      // Fallback only if offline/network error occurs
      const localPass = localStorage.getItem("noc_password") || "noc123";
      if (trimmedInput === localPass) {
        setIsNocAuthenticated(true);
        sessionStorage.setItem("noc_authenticated", "true");
        setShowNocAuthModal(false);
        setShowNocPanelModal(true);
        setNocInputPassword("");
        setNocAuthError("");
      } else {
        setNocAuthError("Password NOC salah! Silakan coba lagi.");
      }
    } finally {
      setNocLoginLoading(false);
    }
  };

  // Handle NOC Logout / Re-lock
  const handleNocLogout = () => {
    setIsNocAuthenticated(false);
    sessionStorage.removeItem("noc_authenticated");
    setShowNocPanelModal(false);
    setActiveTab("check");
  };

  // Handle Change NOC Password (Saved to server so all devices immediately use the new password)
  const handleChangeNocPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newNocPasswordInput.trim();
    if (!trimmed || trimmed.length < 4) {
      setNocPassSuccessMsg("Password baru minimal 4 karakter.");
      return;
    }

    setNocChangingPassword(true);
    setNocPassSuccessMsg("");

    try {
      const response = await fetch("/api/noc/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: trimmed })
      });
      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.setItem("noc_password", trimmed);
        setNewNocPasswordInput("");
        setNocPassSuccessMsg("Password NOC berhasil diubah di server dan langsung aktif untuk SEMUA perangkat!");
        setTimeout(() => setNocPassSuccessMsg(""), 6000);
      } else {
        setNocPassSuccessMsg(data.error || "Gagal mengubah password NOC di server.");
      }
    } catch (err) {
      console.error("Change NOC password error:", err);
      setNocPassSuccessMsg("Koneksi gagal saat menghubungi server.");
    } finally {
      setNocChangingPassword(false);
    }
  };

  // Form states for adding new ODP
  const [newOdpName, setNewOdpName] = useState<string>("");
  const [newOdpLat, setNewOdpLat] = useState<string>("");
  const [newOdpLng, setNewOdpLng] = useState<string>("");
  const [newOdpTotalPorts, setNewOdpTotalPorts] = useState<number>(8);
  const [newOdpAvailablePorts, setNewOdpAvailablePorts] = useState<number>(4);
  const [formError, setFormError] = useState<string>("");
  const [formSuccess, setFormSuccess] = useState<string>("");

  // Search Address state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchLoading, setSearchLoading] = useState<boolean>(false);

  // Selected ODP for InfoWindow
  const [selectedOdp, setSelectedOdp] = useState<ODP | null>(null);

  // Edit and Delete Confirmation states (avoids iframe confirm blocks)
  const [editingOdp, setEditingOdp] = useState<ODP | null>(null);
  const [deletingOdpId, setDeletingOdpId] = useState<string | null>(null);

  // Multiple selection for batch delete
  const [selectedOdpIds, setSelectedOdpIds] = useState<string[]>([]);

  // Filter query for ODP search in NOC Modal / Database view
  const [filterQuery, setFilterQuery] = useState<string>("");

  // Main ODP Search state (untuk Teknisi Lapangan di Menu Utama)
  const [mainOdpSearchQuery, setMainOdpSearchQuery] = useState<string>("");
  const [mainOdpPortFilter, setMainOdpPortFilter] = useState<"all" | "available" | "full">("all");
  const [copiedMainOdpId, setCopiedMainOdpId] = useState<string | null>(null);

  const searchedMainOdps = useMemo(() => {
    if (!mainOdpSearchQuery.trim() && mainOdpPortFilter === "all") return [];
    
    const query = mainOdpSearchQuery.trim().toLowerCase();
    return odps.filter((odp) => {
      const matchText = !query || 
        odp.name.toLowerCase().includes(query) || 
        odp.id.toLowerCase().includes(query) || 
        ((odp as any).code && (odp as any).code.toLowerCase().includes(query)) ||
        (odp.smartOltId && odp.smartOltId.toLowerCase().includes(query));

      if (!matchText) return false;

      if (mainOdpPortFilter === "available") return odp.availablePorts > 0;
      if (mainOdpPortFilter === "full") return odp.availablePorts === 0;
      return true;
    });
  }, [odps, mainOdpSearchQuery, mainOdpPortFilter]);

  const handleFocusMainOdp = (targetOdp: ODP) => {
    setMapCenter({ lat: targetOdp.lat, lng: targetOdp.lng });
    setMapZoom(18);
    setSelectedOdp(targetOdp);

    if (mapInstanceRef.current && odpMarkersRef.current.length > 0) {
      const matchedMarker = odpMarkersRef.current.find((m) => {
        const pos = m.getLatLng();
        return Math.abs(pos.lat - targetOdp.lat) < 0.0001 && Math.abs(pos.lng - targetOdp.lng) < 0.0001;
      });
      if (matchedMarker) {
        matchedMarker.openPopup();
      }
    }
  };

  const handleSetUserToOdp = (targetOdp: ODP) => {
    setUserCoords({ lat: targetOdp.lat, lng: targetOdp.lng });
    setMapCenter({ lat: targetOdp.lat, lng: targetOdp.lng });
    setMapZoom(17);
  };

  const handleCopyMainOdpInfo = (targetOdp: ODP) => {
    const infoText = `${targetOdp.name} | Lat: ${targetOdp.lat.toFixed(6)}, Lng: ${targetOdp.lng.toFixed(6)} | Sisa Port: ${targetOdp.availablePorts}/${targetOdp.totalPorts}`;
    navigator.clipboard.writeText(infoText);
    setCopiedMainOdpId(targetOdp.id);
    setTimeout(() => {
      setCopiedMainOdpId(null);
    }, 2000);
  };

  const filteredOdps = useMemo(() => {
    if (!filterQuery.trim()) return odps;
    const q = filterQuery.toLowerCase();
    return odps.filter(
      (odp) =>
        odp.name.toLowerCase().includes(q) ||
        (odp.code && odp.code.toLowerCase().includes(q))
    );
  }, [odps, filterQuery]);

  // State-based custom confirmation modal to avoid iframe dialog blocking
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
  } | null>(null);

  // Global ODP Synchronization state
  const [isSyncingOdps, setIsSyncingOdps] = useState<boolean>(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string>("");

  // Fetch all ODPs from the backend
  const fetchODPs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/odps");
      if (res.ok) {
        const data = await res.json();
        setOdps(data);
        try {
          localStorage.setItem("odp_local_db", JSON.stringify(data));
        } catch (e) {}
      } else {
        const local = localStorage.getItem("odp_local_db");
        if (local) {
          try {
            setOdps(JSON.parse(local));
          } catch (e) {}
        }
      }
    } catch (err) {
      console.warn("Gagal memuat ODP database dari server, mencoba offline cache:", err);
      const local = localStorage.getItem("odp_local_db");
      if (local) {
        try {
          setOdps(JSON.parse(local));
        } catch (e) {}
      }
    } finally {
      setLoading(false);
    }
  };

  // Explicit user handler to synchronize ODP database before checking coverage
  const handleSyncOdps = async () => {
    setIsSyncingOdps(true);
    setSyncSuccessMsg("");
    try {
      // 1. If SmartOLT is configured, perform auto sync ports first
      if (smartOltDomain && smartOltKey) {
        try {
          await fetch("/api/integration/smartolt/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              domain: smartOltDomain,
              apiKey: smartOltKey
            })
          });
        } catch (e) {
          console.warn("Auto-sync SmartOLT skipped/failed during refresh:", e);
        }
      }

      // 2. Fetch fresh list of ODPs from backend
      const res = await fetch("/api/odps");
      if (res.ok) {
        const data = await res.json();
        setOdps(data);

        // 3. Re-check coverage for current user coordinate if set
        if (userCoords && measurementMode !== "manual") {
          await checkCoverage(userCoords.lat, userCoords.lng, measurementMode);
        }

        setSyncSuccessMsg(`Sinkronisasi berhasil! Total ${data.length} ODP terdaftar.`);
      } else {
        setSyncSuccessMsg("Gagal sinkronisasi, respons server tidak valid.");
      }
    } catch (err) {
      console.error("Gagal melakukan sinkronisasi ODP:", err);
      setSyncSuccessMsg("Terjadi kesalahan koneksi saat sinkronisasi ODP.");
    } finally {
      setIsSyncingOdps(false);
      setTimeout(() => setSyncSuccessMsg(""), 5000);
    }
  };

  const handleOdpCustomerUpdated = (updatedOdp: ODP) => {
    setOdps(prev => prev.map(o => o.id === updatedOdp.id ? updatedOdp : o));
    if (coverage && coverage.nearestOdp && coverage.nearestOdp.id === updatedOdp.id) {
      setCoverage(prev => {
        if (!prev) return null;
        const hasPorts = updatedOdp.availablePorts > 0;
        const inDistance = prev.distance !== null && prev.distance <= 300;
        let newStatus: CoverageResult["status"] = "BELUM TERCOVER";
        if (inDistance) {
          newStatus = hasPorts ? "TERCOVER" : "PORT PENUH / WAITING LIST";
        }
        return {
          ...prev,
          nearestOdp: updatedOdp,
          status: newStatus
        };
      });
    }
    setCustomerModalOdp(updatedOdp);
  };

  // Check coverage backend API call
  const checkCoverage = async (
    lat: number, 
    lng: number, 
    modeOverride?: "road" | "manual",
    targetOdpOverride?: ODP | null
  ) => {
    if (modeOverride === "manual") return; // manual measurements are handled pure client-side
    setChecking(true);
    try {
      const activeMode = modeOverride || measurementMode;
      if (activeMode === "manual") return;
      const targetId = targetOdpOverride !== undefined ? targetOdpOverride?.id : lockedTargetOdpRef.current?.id;
      const res = await fetch("/api/check-coverage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          lat, 
          lng, 
          mode: activeMode,
          targetOdpId: targetId
        })
      });
      if (res.ok) {
        const result = await res.json();
        setCoverage(result);
      }
    } catch (err) {
      console.error("Gagal mengecek jangkauan ODP:", err);
    } finally {
      setChecking(false);
    }
  };

  const getManualDistance = () => {
    let total = 0;
    for (let i = 0; i < manualPoints.length - 1; i++) {
      const p1 = L.latLng(manualPoints[i].lat, manualPoints[i].lng);
      const p2 = L.latLng(manualPoints[i + 1].lat, manualPoints[i + 1].lng);
      total += p1.distanceTo(p2);
    }
    return Math.round(total);
  };

  const getNearestOdpToManualEnd = () => {
    if (manualPoints.length === 0 || odps.length === 0) return null;
    const lastPoint = manualPoints[manualPoints.length - 1];
    let nearest: ODP | null = null;
    let minDist = Infinity;
    odps.forEach((odp) => {
      const dist = L.latLng(lastPoint.lat, lastPoint.lng).distanceTo(L.latLng(odp.lat, odp.lng));
      if (dist < minDist) {
        minDist = dist;
        nearest = odp;
      }
    });
    if (!nearest) return null;
    return { odp: nearest as ODP, distance: Math.round(minDist) };
  };

  const getManualSegments = () => {
    const segments: { index: number; dist: number; lat: number; lng: number }[] = [];
    for (let i = 0; i < manualPoints.length; i++) {
      let dist = 0;
      if (i > 0) {
        const p1 = L.latLng(manualPoints[i - 1].lat, manualPoints[i - 1].lng);
        const p2 = L.latLng(manualPoints[i].lat, manualPoints[i].lng);
        dist = Math.round(p1.distanceTo(p2));
      }
      segments.push({
        index: i,
        dist,
        lat: manualPoints[i].lat,
        lng: manualPoints[i].lng
      });
    }
    return segments;
  };

  // Seed default random ODPs around current map center to easily test in any country
  const handleSeedOdps = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/seed-odps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: mapCenter.lat, lng: mapCenter.lng })
      });
      if (res.ok) {
        await fetchODPs();
        // recheck with current coordinate
        if (userCoords) {
          checkCoverage(userCoords.lat, userCoords.lng);
        }
        alert("Berhasil meng-seed 6 ODP acak di sekitar koordinat tengah peta saat ini!");
      }
    } catch (err) {
      console.error("Gagal meng-seed ODP:", err);
    } finally {
      setLoading(false);
    }
  };

  // Reset database to original Jakarta ODPs
  const handleResetDb = () => {
    setConfirmModal({
      isOpen: true,
      title: "Reset Database ODP",
      message: "Apakah Anda yakin ingin mereset database ODP ke data awal Menteng, Jakarta? Semua data ODP baru yang Anda tambahkan atau modifikasi akan dikembalikan ke setelan awal.",
      confirmText: "Reset Sekarang",
      cancelText: "Batal",
      isDestructive: true,
      onConfirm: async () => {
        setLoading(true);
        try {
          const res = await fetch("/api/reset-db", { method: "POST" });
          if (res.ok) {
            const result = await res.json();
            setOdps(result.odps);
            setUserCoords(DEFAULT_CENTER);
            setMapCenter(DEFAULT_CENTER);
            setMapZoom(15);
            checkCoverage(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
          }
        } catch (err) {
          console.error("Gagal mereset database:", err);
        } finally {
          setLoading(false);
          setConfirmModal(null);
        }
      }
    });
  };

  // Start editing an ODP - populates form and scrolls it into view
  const handleStartEdit = (odp: ODP) => {
    setEditingOdp(odp);
    setNewOdpName(odp.name);
    setNewOdpLat(odp.lat.toString());
    setNewOdpLng(odp.lng.toString());
    setNewOdpTotalPorts(odp.totalPorts);
    setNewOdpAvailablePorts(odp.availablePorts);
    setFormError("");
    setFormSuccess("");
    
    // Switch to database tab to make the form visible
    setActiveTab("database");
    
    // Smooth scroll to form container
    setTimeout(() => {
      const formElement = document.getElementById("odp-form-header");
      if (formElement) {
        formElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
  };

  // Cancel edit mode and reset the form
  const handleCancelEdit = () => {
    setEditingOdp(null);
    setNewOdpName("");
    setNewOdpLat("");
    setNewOdpLng("");
    setNewOdpTotalPorts(8);
    setNewOdpAvailablePorts(4);
    setFormError("");
    setFormSuccess("");
  };

  // Add a new ODP or update existing ODP (Instant Optimistic update + background sync)
  const handleAddOdp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    let rawLat = String(newOdpLat || "").trim();
    let rawLng = String(newOdpLng || "").trim();

    // Support smart paste: e.g. user pasted "-6.82588, 107.13355" into Latitude field
    if (rawLat.includes(",") && !rawLng) {
      const parts = rawLat.split(",");
      if (parts.length >= 2) {
        rawLat = parts[0].trim();
        rawLng = parts[1].trim();
        setNewOdpLat(rawLat);
        setNewOdpLng(rawLng);
      }
    }

    if (!newOdpName.trim() || !rawLat || !rawLng) {
      setFormError("Semua field nama dan koordinat ODP wajib diisi.");
      return;
    }

    const cleanLatStr = rawLat.replace(",", ".");
    const cleanLngStr = rawLng.replace(",", ".");
    const latNum = parseFloat(cleanLatStr);
    const lngNum = parseFloat(cleanLngStr);

    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      setFormError("Latitude harus berupa angka valid antara -90 dan 90 (Contoh: -6.82588).");
      return;
    }
    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      setFormError("Longitude harus berupa angka valid antara -180 dan 180 (Contoh: 107.13355).");
      return;
    }
    if (newOdpAvailablePorts > newOdpTotalPorts) {
      setFormError("Port Tersedia tidak boleh melebihi Total Port.");
      return;
    }

    setLoading(true);

    try {
      if (editingOdp) {
        // Edit mode: optimistic update locally and sync to server
        const updatedOdp: ODP = {
          ...editingOdp,
          name: newOdpName.trim(),
          lat: latNum,
          lng: lngNum,
          totalPorts: newOdpTotalPorts,
          availablePorts: newOdpAvailablePorts
        };

        const updatedList = odps.map(o => o.id === editingOdp.id ? updatedOdp : o);
        setOdps(updatedList);
        try {
          localStorage.setItem("odp_local_db", JSON.stringify(updatedList));
        } catch (e) {}

        setFormSuccess(`ODP "${newOdpName}" berhasil diperbarui!`);
        handleCancelEdit();

        // Pan to updated ODP
        setMapCenter({ lat: latNum, lng: lngNum });
        setMapZoom(17);

        // Background server sync
        fetch(`/api/odps/${encodeURIComponent(editingOdp.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedOdp)
        }).catch(err => console.warn("Background update sync warning:", err));

        if (userCoords && measurementMode !== "manual") {
          checkCoverage(userCoords.lat, userCoords.lng);
        }
      } else {
        // Add mode: INSTANT optimistic add!
        const newOdpItem: ODP = {
          id: `odp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: newOdpName.trim(),
          lat: latNum,
          lng: lngNum,
          totalPorts: newOdpTotalPorts,
          availablePorts: newOdpAvailablePorts
        };

        // 1. Immediately update state so marker appears on map right away!
        const updatedList = [...odps, newOdpItem];
        setOdps(updatedList);
        try {
          localStorage.setItem("odp_local_db", JSON.stringify(updatedList));
        } catch (e) {}

        // 2. Immediately pan and zoom the map to the new ODP
        setMapCenter({ lat: latNum, lng: lngNum });
        setMapZoom(17);
        setUserCoords({ lat: latNum, lng: lngNum });

        // 3. Set success message and clear form
        setFormSuccess(`ODP "${newOdpName}" berhasil ditambahkan dan langsung aktif di peta!`);
        setNewOdpName("");
        setNewOdpLat("");
        setNewOdpLng("");

        // 4. Background server sync to persist in backend database
        fetch("/api/odps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newOdpItem)
        }).then(async res => {
          if (res.ok) {
            const serverItem = await res.json();
            setOdps(prev => prev.map(o => o.id === newOdpItem.id ? serverItem : o));
          }
        }).catch(err => {
          console.warn("Background server add sync warning (saved locally):", err);
        });

        // 5. Trigger coverage check for user
        if (measurementMode !== "manual") {
          checkCoverage(latNum, lngNum);
        }
      }
    } catch (err: any) {
      console.error("Gagal memproses ODP:", err);
      setFormError(err.message || "Terjadi kesalahan saat memproses ODP.");
    } finally {
      setLoading(false);
    }
  };

  // Delete an ODP from the database
  const handleDeleteOdp = async (id: string, odpName?: string, skipConfirm: boolean = false) => {
    const executeDelete = async () => {
      try {
        const res = await fetch(`/api/odps/${encodeURIComponent(id)}`, { method: "DELETE" });
        if (res.ok) {
          setOdps(prev => prev.filter(o => o.id !== id));
          setSelectedOdpIds(prev => prev.filter(i => i !== id));
          if (selectedOdp?.id === id) setSelectedOdp(null);
          if (editingOdp?.id === id) handleCancelEdit();
          if (userCoords && measurementMode !== "manual") {
            checkCoverage(userCoords.lat, userCoords.lng, measurementMode);
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          console.error("Gagal menghapus ODP:", errData);
        }
      } catch (err) {
        console.error("Gagal menghapus ODP:", err);
      }
    };

    if (skipConfirm) {
      await executeDelete();
    } else {
      setConfirmModal({
        isOpen: true,
        title: "Hapus ODP",
        message: `Apakah Anda yakin ingin menghapus ODP ${odpName ? `"${odpName}"` : "ini"} dari database? Tindakan ini tidak dapat dibatalkan.`,
        confirmText: "Hapus",
        cancelText: "Batal",
        isDestructive: true,
        onConfirm: async () => {
          await executeDelete();
          setConfirmModal(null);
        }
      });
    }
  };

  // Delete all ODPs from the database
  const handleDeleteAllOdps = () => {
    setConfirmModal({
      isOpen: true,
      title: "Hapus Seluruh Data ODP",
      message: "Apakah Anda yakin ingin menghapus SELURUH data ODP dari database? Tindakan ini akan mengosongkan seluruh ODP di peta dan tidak dapat dibatalkan.",
      confirmText: "Hapus Semua",
      cancelText: "Batal",
      isDestructive: true,
      onConfirm: async () => {
        setLoading(true);
        try {
          const res = await fetch("/api/odps", { method: "DELETE" });
          if (res.ok) {
            setOdps([]);
            setSelectedOdpIds([]);
            setSelectedOdp(null);
            handleCancelEdit();
            if (userCoords && measurementMode !== "manual") {
              checkCoverage(userCoords.lat, userCoords.lng, measurementMode);
            }
          } else {
            console.error("Gagal menghapus seluruh ODP dari database.");
          }
        } catch (err) {
          console.error("Gagal menghapus seluruh ODP:", err);
        } finally {
          setLoading(false);
          setConfirmModal(null);
        }
      }
    });
  };

  // Delete selected ODPs from the database
  const handleDeleteSelectedOdps = () => {
    if (selectedOdpIds.length === 0) return;
    
    setConfirmModal({
      isOpen: true,
      title: "Hapus ODP Terpilih",
      message: `Apakah Anda yakin ingin menghapus ${selectedOdpIds.length} ODP yang terpilih dari database? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: `Hapus ${selectedOdpIds.length} ODP`,
      cancelText: "Batal",
      isDestructive: true,
      onConfirm: async () => {
        setLoading(true);
        try {
          const res = await fetch("/api/odps/batch-delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: selectedOdpIds })
          });
          if (res.ok) {
            setOdps(prev => prev.filter(o => !selectedOdpIds.includes(o.id)));
            setSelectedOdpIds([]);
            if (selectedOdp && selectedOdpIds.includes(selectedOdp.id)) {
              setSelectedOdp(null);
            }
            if (editingOdp && selectedOdpIds.includes(editingOdp.id)) {
              handleCancelEdit();
            }
            if (userCoords && measurementMode !== "manual") {
              checkCoverage(userCoords.lat, userCoords.lng, measurementMode);
            }
          } else {
            console.error("Gagal menghapus ODP terpilih.");
          }
        } catch (err) {
          console.error("Gagal menghapus ODP terpilih:", err);
        } finally {
          setLoading(false);
          setConfirmModal(null);
        }
      }
    });
  };

  // Export ODP database as JSON file
  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(odps, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `database_odp_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Comprehensive KML Coordinate & Placemark extractor
  const extractOdpsFromKml = (kmlText: string): ODP[] => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, "text/xml");

    // Try multiple selector strategies to bypass any XML namespace differences
    let placemarks: Element[] = [];
    try {
      const byTag = xmlDoc.getElementsByTagName("Placemark");
      if (byTag && byTag.length > 0) {
        placemarks = Array.from(byTag);
      }
    } catch (e) {}

    if (placemarks.length === 0) {
      try {
        const byNS = xmlDoc.getElementsByTagNameNS("*", "Placemark");
        if (byNS && byNS.length > 0) {
          placemarks = Array.from(byNS);
        }
      } catch (e) {}
    }

    if (placemarks.length === 0) {
      try {
        const query = xmlDoc.querySelectorAll("Placemark");
        if (query && query.length > 0) {
          placemarks = Array.from(query);
        }
      } catch (e) {}
    }

    // Helper to parse coordinate string
    const parseCoords = (text: string): { lat: number; lng: number } | null => {
      if (!text) return null;
      // Matches all decimal numbers (with optional minus/plus sign)
      const numbers = text.match(/[-+]?\d+(?:\.\d+)?/g);
      if (!numbers || numbers.length < 2) return null;

      const num1 = parseFloat(numbers[0]);
      const num2 = parseFloat(numbers[1]);
      if (isNaN(num1) || isNaN(num2)) return null;

      // Standard KML specification is [longitude, latitude, altitude]
      // In Indonesia, Latitude is ~ -11 to +6, Longitude is ~ 95 to 142
      let lng = num1;
      let lat = num2;
      // Auto-detect if coordinates were inverted (lat, lng instead of lng, lat)
      if (num1 >= -15 && num1 <= 15 && num2 >= 90 && num2 <= 150) {
        lat = num1;
        lng = num2;
      }

      return { lat, lng };
    };

    // Helper to extract port count from name or description
    const extractPorts = (text: string): { total: number; available: number } => {
      const slashMatch = text.match(/\/(0*[1-9]\d*)/);
      if (slashMatch && slashMatch[1]) {
        const p = parseInt(slashMatch[1], 10);
        if ([4, 8, 16, 24, 32, 48, 64].includes(p)) {
          return { total: p, available: p };
        }
      }
      const portMatch = text.match(/(\d+)\s*(?:port|p\b)/i);
      if (portMatch && portMatch[1]) {
        const p = parseInt(portMatch[1], 10);
        if ([4, 8, 16, 24, 32, 48, 64].includes(p)) {
          return { total: p, available: p };
        }
      }
      return { total: 8, available: 8 };
    };

    const results: ODP[] = [];

    for (let i = 0; i < placemarks.length; i++) {
      const pm = placemarks[i];

      // Extract Name
      let name = "";
      const nameNode = pm.getElementsByTagName("name")[0] || pm.getElementsByTagNameNS("*", "name")[0];
      if (nameNode && nameNode.textContent) {
        name = nameNode.textContent.trim();
      }

      // Extract Description
      let desc = "";
      const descNode = pm.getElementsByTagName("description")[0] || pm.getElementsByTagNameNS("*", "description")[0];
      if (descNode && descNode.textContent) {
        desc = descNode.textContent.trim();
      }

      // Extract Coordinates (look in <Point><coordinates> or direct <coordinates>)
      let coordText = "";
      const coordNode = pm.getElementsByTagName("coordinates")[0] || pm.getElementsByTagNameNS("*", "coordinates")[0];
      if (coordNode && coordNode.textContent) {
        coordText = coordNode.textContent;
      }

      if (!coordText) continue;

      const coords = parseCoords(coordText);
      if (!coords) continue;

      const { total, available } = extractPorts(name + " " + desc);

      results.push({
        id: `odp-kmz-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        name: name || `ODP-TITIK-${i + 1}`,
        lat: coords.lat,
        lng: coords.lng,
        totalPorts: total,
        availablePorts: available
      });
    }

    // Regex fallback if XML DOM parser encountered errors on malformed field files
    if (results.length === 0) {
      const placemarkRegex = /<Placemark[\s\S]*?<\/Placemark>/gi;
      const matches = kmlText.match(placemarkRegex);
      if (matches) {
        matches.forEach((pmText, idx) => {
          const nameMatch = pmText.match(/<name>(.*?)<\/name>/i);
          const coordMatch = pmText.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
          if (coordMatch && coordMatch[1]) {
            const coords = parseCoords(coordMatch[1]);
            if (coords) {
              const name = nameMatch ? nameMatch[1].trim() : `ODP-KML-${idx + 1}`;
              const { total, available } = extractPorts(name + " " + pmText);
              results.push({
                id: `odp-kmz-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
                name,
                lat: coords.lat,
                lng: coords.lng,
                totalPorts: total,
                availablePorts: available
              });
            }
          }
        });
      }
    }

    return results;
  };

  // Comprehensive function to save imported ODPs, pan the map, and persist to server
  const importAndSaveOdps = async (extracted: ODP[], fileName?: string) => {
    if (!extracted || extracted.length === 0) return;
    setLoading(true);

    try {
      // 1. Immediately update state so markers appear on map INSTANTLY!
      const merged = [...odps, ...extracted];
      setOdps(merged);
      try {
        localStorage.setItem("odp_local_db", JSON.stringify(merged));
      } catch (e) {}

      // 2. Automatically calculate bounds and move map directly to the imported ODPs
      const lats = extracted.map(o => o.lat);
      const lngs = extracted.map(o => o.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;

      setMapCenter({ lat: centerLat, lng: centerLng });
      setMapZoom(extracted.length === 1 ? 17 : 15);
      setUserCoords({ lat: extracted[0].lat, lng: extracted[0].lng });

      if (mapInstanceRef.current) {
        if (extracted.length > 1) {
          mapInstanceRef.current.fitBounds([[minLat, minLng], [maxLat, maxLng]], { padding: [40, 40] });
        } else {
          mapInstanceRef.current.setView([centerLat, centerLng], 17);
        }
      }

      setImportMessage({
        type: "success",
        text: `Berhasil mengimpor ${extracted.length} ODP${fileName ? ` dari "${fileName}"` : ""}! Seluruh titik ODP langsung aktif dan ditampilkan di peta.`
      });
      setParsedOdps([]);

      // 3. Background server persistence
      fetch("/api/odps/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ odps: extracted })
      }).then(async res => {
        if (res.ok) {
          const data = await res.json();
          if (data && data.odps) {
            setOdps(data.odps);
            try {
              localStorage.setItem("odp_local_db", JSON.stringify(data.odps));
            } catch (e) {}
          }
        }
      }).catch(err => {
        console.warn("Server bulk persistence sync warning (saved locally):", err);
      });

      // 4. Re-check coverage
      if (measurementMode !== "manual") {
        checkCoverage(extracted[0].lat, extracted[0].lng);
      }
    } catch (err: any) {
      console.error("Gagal mengimpor ODP:", err);
      setImportMessage({
        type: "error",
        text: "Gagal menyimpan ODP: " + (err.message || "Kesalahan tidak terduga.")
      });
    } finally {
      setLoading(false);
    }
  };

  // KMZ / KML Upload Handler with resilient extraction and instant map rendering
  const handleKmzUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setKmzImporting(true);
    setImportMessage(null);
    setParsedOdps([]);

    try {
      const fileName = file.name.toLowerCase();
      let kmlText = "";

      if (fileName.endsWith(".kmz") || fileName.endsWith(".zip")) {
        let zip: JSZip;
        try {
          zip = await JSZip.loadAsync(file);
        } catch (zipErr: any) {
          throw new Error("Gagal membaca arsip KMZ: " + (zipErr.message || "Format ZIP tidak valid"));
        }

        // Find any file ending with .kml (case-insensitive, in any subfolder)
        const kmlEntry = Object.values(zip.files).find(
          f => !f.dir && f.name.toLowerCase().endsWith(".kml")
        );

        if (kmlEntry) {
          kmlText = await kmlEntry.async("string");
        } else {
          // If no .kml found, try first non-empty text entry
          const anyTextEntry = Object.values(zip.files).find(
            f => !f.dir && !f.name.startsWith("__MACOSX") && !f.name.startsWith(".")
          );
          if (anyTextEntry) {
            kmlText = await anyTextEntry.async("string");
          } else {
            throw new Error("File .kmz tidak memiliki file .kml di dalamnya.");
          }
        }
      } else if (fileName.endsWith(".kml") || fileName.endsWith(".xml") || fileName.endsWith(".txt")) {
        kmlText = await file.text();
      } else {
        throw new Error("Format file harus berupa .kmz atau .kml (Nama file: " + file.name + ")");
      }

      if (!kmlText || !kmlText.trim()) {
        throw new Error("Isi file KML kosong.");
      }

      const extracted = extractOdpsFromKml(kmlText);

      if (extracted.length === 0) {
        throw new Error("Tidak ditemukan koordinat ODP (<Placemark>) yang valid di file. Pastikan file KMZ/KML berisi titik koordinat Point.");
      }

      // Automatically apply directly to map & state!
      await importAndSaveOdps(extracted, file.name);
    } catch (err: any) {
      console.error("Gagal mengurai file KMZ/KML:", err);
      setImportMessage({
        type: "error",
        text: err.message || "Gagal mengurai file .kmz/.kml."
      });
    } finally {
      setKmzImporting(false);
      e.target.value = "";
    }
  };

  const handleSaveImportedOdps = async () => {
    if (parsedOdps.length === 0) return;
    await importAndSaveOdps(parsedOdps);
  };

  // Synchronize credentials with localStorage on state changes
  useEffect(() => {
    localStorage.setItem("smartOltDomain", smartOltDomain);
  }, [smartOltDomain]);

  useEffect(() => {
    localStorage.setItem("smartOltKey", smartOltKey);
  }, [smartOltKey]);

  useEffect(() => {
    localStorage.setItem("genieAcsHost", genieAcsHost);
  }, [genieAcsHost]);

  useEffect(() => {
    localStorage.setItem("genieAcsUser", genieAcsUser);
  }, [genieAcsUser]);

  useEffect(() => {
    localStorage.setItem("genieAcsPass", genieAcsPass);
  }, [genieAcsPass]);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const settings = await res.json();
        if (settings.smartOltDomain) setSmartOltDomain(settings.smartOltDomain);
        if (settings.smartOltKey) setSmartOltKey(settings.smartOltKey);
        if (settings.genieAcsHost) setGenieAcsHost(settings.genieAcsHost);
        if (settings.genieAcsUser) setGenieAcsUser(settings.genieAcsUser);
        if (settings.genieAcsPass) setGenieAcsPass(settings.genieAcsPass);
      }
    } catch (err) {
      console.error("Gagal memuat pengaturan integrasi dari server:", err);
    }
  };

  const handleSaveSettings = async () => {
    setSaveStatus(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smartOltDomain,
          smartOltKey,
          genieAcsHost,
          genieAcsUser,
          genieAcsPass
        })
      });
      if (res.ok) {
        setSaveStatus({ type: "success", text: "Berhasil menyimpan konfigurasi kredensial ke server!" });
        setTimeout(() => setSaveStatus(null), 4000);
        return true;
      } else {
        setSaveStatus({ type: "error", text: "Gagal menyimpan konfigurasi ke server." });
      }
    } catch (err: any) {
      setSaveStatus({ type: "error", text: `Gangguan jaringan: ${err.message || String(err)}` });
    }
    return false;
  };

  // Integration queries
  const handleTestSmartOlt = async (action: string) => {
    setSmartOltLoading(true);
    setSmartOltError("");
    setSmartOltResult(null);

    // Auto-save settings first
    await handleSaveSettings();

    try {
      const res = await fetch("/api/integration/smartolt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: smartOltDomain,
          apiKey: smartOltKey,
          action
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSmartOltResult(data);
      } else {
        setSmartOltError(data.error || "Gagal berkomunikasi dengan SmartOLT API.");
        if (data.details) {
          setSmartOltError(prev => `${prev} Detail: ${data.details}`);
        }
      }
    } catch (err: any) {
      setSmartOltError(`Kesalahan jaringan: ${err.message || String(err)}`);
    } finally {
      setSmartOltLoading(false);
    }
  };

  const handleSyncSmartOltPorts = async () => {
    setSmartOltSyncLoading(true);
    setSmartOltSyncError("");
    setSmartOltSyncResult(null);

    // Auto-save settings first
    await handleSaveSettings();

    try {
      const res = await fetch("/api/integration/smartolt/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: smartOltDomain,
          apiKey: smartOltKey
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSmartOltSyncResult(data);
        if (data.success) {
          // Update the ODP list with newly synced data
          setOdps(data.odps);
          // Re-trigger coverage check if userCoords is active
          if (userCoords) {
            checkCoverage(userCoords.lat, userCoords.lng);
          }
        }
      } else {
        setSmartOltSyncError(data.error || "Gagal sinkronisasi data ODP dengan SmartOLT.");
        if (data.details) {
          setSmartOltSyncError(prev => `${prev} Detail: ${data.details}`);
        }
      }
    } catch (err: any) {
      setSmartOltSyncError(`Kesalahan jaringan: ${err.message || String(err)}`);
    } finally {
      setSmartOltSyncLoading(false);
    }
  };

  const handleFetchSmartOltOdbs = async () => {
    setSmartOltOdbLoading(true);
    setSmartOltOdbError("");
    setSmartOltOdbResult(null);

    // Auto-save settings first
    await handleSaveSettings();

    try {
      const res = await fetch("/api/integration/smartolt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: smartOltDomain,
          apiKey: smartOltKey,
          action: "get_odbs"
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSmartOltOdbResult(data);
      } else {
        setSmartOltOdbError(data.error || "Gagal mengambil daftar ODB dari SmartOLT.");
        if (data.details) {
          setSmartOltOdbError(prev => `${prev} Detail: ${data.details}`);
        }
      }
    } catch (err: any) {
      setSmartOltOdbError(`Kesalahan jaringan: ${err.message || String(err)}`);
    } finally {
      setSmartOltOdbLoading(false);
    }
  };

  const handleImportSmartOltOdb = async (odb: any) => {
    setOdbMappingStatus(null);
    try {
      const latNum = parseFloat(odb.latitude);
      const lngNum = parseFloat(odb.longitude);
      const totalPorts = parseInt(odb.nr_of_ports, 10) || 8;
      const usedPorts = odb.used_ports !== undefined ? odb.used_ports : 0;
      const availablePorts = Math.max(0, totalPorts - usedPorts);
      
      const res = await fetch("/api/odps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: odb.name,
          lat: isNaN(latNum) ? DEFAULT_CENTER.lat : latNum,
          lng: isNaN(lngNum) ? DEFAULT_CENTER.lng : lngNum,
          totalPorts: totalPorts,
          availablePorts: availablePorts
        })
      });

      if (res.ok) {
        const added = await res.json();
        setOdps(prev => [...prev, added]);
        setOdbMappingStatus({
          type: "success",
          text: `Berhasil memetakan ODB "${odb.name}" dengan kapasitas ${availablePorts}/${totalPorts} port ke daftar ODP Peta!`
        });
        // Re-check coverage
        checkCoverage(userCoords.lat, userCoords.lng);
      } else {
        const errData = await res.json();
        setOdbMappingStatus({
          type: "error",
          text: `Gagal memetakan ODB: ${errData.error || "Kesalahan tidak dikenal"}`
        });
      }
    } catch (err: any) {
      setOdbMappingStatus({
        type: "error",
        text: `Gagal memetakan ODB: ${err.message || String(err)}`
      });
    }
  };

  const handleTestGenieAcs = async () => {
    setGenieAcsLoading(true);
    setGenieAcsError("");
    setGenieAcsResult(null);

    // Auto-save settings first
    await handleSaveSettings();

    try {
      const res = await fetch("/api/integration/genieacs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostUrl: genieAcsHost,
          username: genieAcsUser,
          password: genieAcsPass
        })
      });

      const data = await res.json();
      if (res.ok) {
        setGenieAcsResult(data);
      } else {
        setGenieAcsError(data.error || "Gagal berkomunikasi dengan GenieACS API.");
        if (data.details) {
          setGenieAcsError(prev => `${prev} Detail: ${data.details}`);
        }
      }
    } catch (err: any) {
      setGenieAcsError(`Kesalahan jaringan: ${err.message || String(err)}`);
    } finally {
      setGenieAcsLoading(false);
    }
  };

  // Trigger HTML5 geolocation to move User Pin to their actual location
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Browser Anda tidak mendukung Geolocation.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const newCoords = { lat, lng };
        setUserCoords(newCoords);
        setMapCenter(newCoords);
        setMapZoom(16);
      },
      (error) => {
        console.error("Geolocation error:", error);
        alert("Gagal mengambil lokasi. Pastikan Anda memberikan izin akses lokasi.");
      },
      { enableHighAccuracy: true }
    );
  };

  // Use client-side Geocoding or OpenStreetMap Nominatim for search address since we don't assume Places is enabled on the key
  const handleSearchAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    setSearchLoading(true);

    try {
      // Use Nominatim OpenStreetMap for open CORS-safe address resolution
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const firstResult = data[0];
          const lat = parseFloat(firstResult.lat);
          const lng = parseFloat(firstResult.lon);
          const newCoords = { lat, lng };
          setUserCoords(newCoords);
          setMapCenter(newCoords);
          setMapZoom(16);
        } else {
          alert("Alamat tidak ditemukan. Coba masukkan nama jalan atau area yang lebih spesifik.");
        }
      }
    } catch (err) {
      console.error("Gagal mencari alamat:", err);
      alert("Gagal mencari alamat karena gangguan jaringan.");
    } finally {
      setSearchLoading(false);
    }
  };

  // Pre-load data on mount
  useEffect(() => {
    fetchSettings();
    fetchODPs();
    checkCoverage(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
  }, []);

  // Sync userCoords with coverage check whenever coordinates, measurementMode, ODP database, or target lock changes
  useEffect(() => {
    if (userCoords && measurementMode !== "manual") {
      checkCoverage(userCoords.lat, userCoords.lng, measurementMode, lockedTargetOdp);
    }
  }, [userCoords.lat, userCoords.lng, measurementMode, odps.length, lockedTargetOdp?.id]);

  // Initialize and synchronize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));
    const isStartEnabled = typeof window !== "undefined" ? (!isTouch || window.innerWidth >= 768) : true;

    // Initialize Leaflet Map
    const map = L.map(mapContainerRef.current, {
      center: [mapCenter.lat, mapCenter.lng],
      zoom: mapZoom,
      zoomControl: false,
      dragging: isStartEnabled,
      touchZoom: isStartEnabled,
      scrollWheelZoom: isStartEnabled,
      doubleClickZoom: isStartEnabled,
    });

    // Add clean Zoom control to bottom-right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Add Google Maps Roadmap tile layer by default
    const tile = L.tileLayer("https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
      subdomains: ["0", "1", "2", "3"],
      maxZoom: 21,
      attribution: '&copy; <a href="https://maps.google.com" target="_blank" rel="noreferrer">Google Maps</a>'
    }).addTo(map);
    tileLayerRef.current = tile;

    // Register map click listener
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (measurementModeRef.current === "manual") {
        setManualPoints(prev => [...prev, { lat: e.latlng.lat, lng: e.latlng.lng }]);
      } else {
        setUserCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    });

    // Register map moveend listener to sync React state
    map.on("moveend", () => {
      const center = map.getCenter();
      setMapCenter({ lat: center.lat, lng: center.lng });
      setMapZoom(map.getZoom());
    });

    mapInstanceRef.current = map;

    // Handle container resizing cleanly so map never gets clipped or distorted
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Dynamically toggle Map interaction to prevent mobile freeze during scroll
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (mapInteractionEnabled) {
      if (map.dragging) map.dragging.enable();
      if (map.touchZoom) map.touchZoom.enable();
      if (map.doubleClickZoom) map.doubleClickZoom.enable();
      if (map.scrollWheelZoom) map.scrollWheelZoom.enable();
    } else {
      if (map.dragging) map.dragging.disable();
      if (map.touchZoom) map.touchZoom.disable();
      if (map.doubleClickZoom) map.doubleClickZoom.disable();
      if (map.scrollWheelZoom) map.scrollWheelZoom.disable();
    }
  }, [mapInteractionEnabled]);

  // Watch and switch basemap (Google Maps variants: Roadmap, Hybrid Satellite, Terrain)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    let url = "https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";
    let maxZoom = 21;

    if (basemap === "satellite") {
      // Google Hybrid: High-resolution satellite imagery + road labels & boundaries
      url = "https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}";
      maxZoom = 21;
    } else if (basemap === "terrain") {
      // Google Terrain: Topography & relief + roads
      url = "https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}";
      maxZoom = 20;
    }

    tileLayerRef.current = L.tileLayer(url, {
      subdomains: ["0", "1", "2", "3"],
      maxZoom,
      attribution: '&copy; <a href="https://maps.google.com" target="_blank" rel="noreferrer">Google Maps</a>'
    }).addTo(map);
  }, [basemap]);

  // Sync external map views (Presets, search) back into the Leaflet instance
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();

    const latDiff = Math.abs(currentCenter.lat - mapCenter.lat);
    const lngDiff = Math.abs(currentCenter.lng - mapCenter.lng);

    if (latDiff > 0.0001 || lngDiff > 0.0001 || currentZoom !== mapZoom) {
      map.setView([mapCenter.lat, mapCenter.lng], mapZoom, { animate: true });
    }
  }, [mapCenter, mapZoom]);

  // Sync markers, circle, polyline connection, and popups
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Synchronize/Update User Position Marker
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
    }
    const userIcon = L.divIcon({
      className: "",
      html: `
        <div class="relative flex flex-col items-center justify-center animate-fade-in" style="width: 36px; height: 36px;">
          <svg viewBox="0 0 24 24" class="w-9 h-9 drop-shadow-lg relative z-10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 21C16.5 16.5 19 12.8 19 9C19 4.9 15.64 2 12 2C8.36 2 5 4.9 5 9C5 12.8 7.5 16.5 12 21Z" fill="#ef4444" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
            <circle cx="12" cy="9" r="3.5" fill="#ffffff"/>
          </svg>
          <div class="absolute w-8 h-8 bg-rose-500/30 rounded-full animate-ping" style="top: 14px; z-index: 0;"></div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 31.5]
    });
    userMarkerRef.current = L.marker([userCoords.lat, userCoords.lng], { icon: userIcon }).addTo(map);

    // 2. Clear old ODP markers
    odpMarkersRef.current.forEach(m => m.remove());
    odpMarkersRef.current = [];

    // 3. Render all ODPs from Database
    odps.forEach((odp) => {
      const isNearest = coverage?.nearestOdp?.id === odp.id;
      const hasPorts = odp.availablePorts > 0;
      
      let bgCol = "bg-emerald-500";
      let ringCol = "ring-emerald-200";
      
      if (!hasPorts) {
        bgCol = "bg-rose-500";
        ringCol = "ring-rose-200";
      }

      if (isNearest) {
        ringCol = hasPorts ? "ring-4 ring-emerald-400 animate-pulse" : "ring-4 ring-amber-400 animate-pulse";
        if (!hasPorts) bgCol = "bg-amber-500";
      }

      const odpIcon = L.divIcon({
        className: "",
        html: `
          <div class="w-7 h-7 ${bgCol} ring-2 ${ringCol} border border-white rounded-full shadow-md flex items-center justify-center text-white font-extrabold text-[9px] cursor-pointer transition-transform hover:scale-110">
            ODP
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([odp.lat, odp.lng], { icon: odpIcon }).addTo(map);

      // Interactive responsive popup custom content
      const popupDiv = document.createElement("div");
      popupDiv.className = "p-1.5 text-slate-900 font-sans leading-relaxed text-xs max-w-[220px]";
      popupDiv.innerHTML = `
        <div class="flex items-center gap-1 border-b pb-1 mb-1 border-slate-200">
          <span class="w-2.5 h-2.5 rounded-full ${hasPorts ? 'bg-emerald-500' : 'bg-rose-500'}"></span>
          <strong class="text-xs font-bold text-slate-800">${odp.name}</strong>
        </div>
        <p class="text-[9px] text-slate-500 font-mono">
          Lat: ${odp.lat.toFixed(6)}<br/>
          Lng: ${odp.lng.toFixed(6)}
        </p>
        <div class="mt-1 space-y-1 bg-slate-50 p-2 rounded border border-slate-200 text-[10px]">
          <div class="flex justify-between">
            <span class="text-slate-500">Port Terpakai:</span>
            <strong class="text-slate-800 font-bold">${odp.totalPorts - odp.availablePorts} Port</strong>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Port Tersedia (Sisa):</span>
            <strong class="${hasPorts ? 'text-emerald-600' : 'text-rose-600'} font-bold">
              ${odp.availablePorts} / ${odp.totalPorts} Port
            </strong>
          </div>
        </div>
        ${odp.customers && odp.customers.length > 0 ? `
          <div class="mt-1 flex items-center justify-between text-[9px] font-bold px-1.5 py-1 rounded bg-slate-100 border border-slate-200 gap-1">
            <span class="text-emerald-700">🟢 ${odp.customers.filter(c => c.status === 'online').length} On</span>
            <span class="text-red-700">🔴 ${odp.customers.filter(c => c.status === 'los').length} LOS</span>
            <span class="text-slate-700">⚪ ${odp.customers.filter(c => c.status === 'offline').length} Off</span>
            <span class="text-amber-700">🟡 ${odp.customers.filter(c => c.status === 'dyinggasp').length} Gasp</span>
          </div>
        ` : ''}
      `;

      // Cek Pelanggan & Port button
      const custBtn = document.createElement("button");
      custBtn.className = "w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-2 rounded-lg text-[10px] transition-colors cursor-pointer text-center block shadow-xs";
      const custTotal = odp.customers?.length || (odp.totalPorts - odp.availablePorts);
      custBtn.innerText = `👥 Cek Pelanggan & Port (${custTotal}/${odp.totalPorts})`;
      custBtn.onclick = (event) => {
        event.stopPropagation();
        setCustomerModalOdp(odp);
        marker.closePopup();
      };
      popupDiv.appendChild(custBtn);

      // Kunci ODP Target / Tarik dari ODP Ini button
      const isCurrentlyLocked = lockedTargetOdpRef.current?.id === odp.id;
      const targetLockBtn = document.createElement("button");
      targetLockBtn.className = `w-full mt-1.5 ${isCurrentlyLocked ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white font-bold py-1.5 px-2 rounded-lg text-[10px] transition-colors cursor-pointer text-center block shadow-xs`;
      targetLockBtn.innerText = isCurrentlyLocked ? "🔓 Lepas Target (Auto Terdekat)" : "🎯 Tarik Kabel dari ODP Ini";
      targetLockBtn.onclick = (event) => {
        event.stopPropagation();
        if (isCurrentlyLocked) {
          setLockedTargetOdp(null);
          checkCoverage(userCoords.lat, userCoords.lng, measurementMode, null);
        } else {
          setLockedTargetOdp(odp);
          checkCoverage(userCoords.lat, userCoords.lng, measurementMode, odp);
        }
        marker.closePopup();
      };
      popupDiv.appendChild(targetLockBtn);

      // Copy coordinates button
      const button = document.createElement("button");
      button.className = "w-full mt-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-2 rounded-lg text-[10px] transition-colors cursor-pointer text-center block";
      button.innerText = "Salin Koordinat";
      button.onclick = (event) => {
        event.stopPropagation();
        setNewOdpLat(odp.lat.toFixed(6));
        setNewOdpLng(odp.lng.toFixed(6));
        setFormSuccess(`Koordinat disalin ke form ODP Baru: ${odp.lat.toFixed(6)}, ${odp.lng.toFixed(6)}`);
        setFormError("");
        setActiveTab("database");
        marker.closePopup();
      };
      popupDiv.appendChild(button);

      // Mulai Rute Manual button
      const manualStartBtn = document.createElement("button");
      manualStartBtn.className = "w-full mt-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-1.5 px-2 rounded-lg text-[10px] transition-colors cursor-pointer text-center block";
      manualStartBtn.innerText = "🚀 Mulai Klik Manual (Titik A)";
      manualStartBtn.onclick = (event) => {
        event.stopPropagation();
        setMeasurementMode("manual");
        setManualPoints([{ lat: odp.lat, lng: odp.lng }]);
        setActiveTab("check");
        marker.closePopup();
      };
      popupDiv.appendChild(manualStartBtn);

      marker.bindPopup(popupDiv, {
        closeButton: false,
        offset: L.point(0, -10)
      });

      marker.on("click", () => {
        setSelectedOdp(odp);
      });

      odpMarkersRef.current.push(marker);
    });

    // 4. Update/Recreate connection line
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (measurementMode !== "manual" && coverage?.nearestOdp) {
      const isCovered = coverage.status === "TERCOVER";
      const lineColor = isCovered ? "#10B981" : coverage.status === "PORT PENUH / WAITING LIST" ? "#F59E0B" : "#EF4444";
      
      // Use actual road routing coordinates if returned by backend, otherwise fallback to straight line
      let routePoints: [number, number][] = [];
      if (coverage.routeGeometry && coverage.routeGeometry.length > 0) {
        const roadPoints: [number, number][] = coverage.routeGeometry.map((pt: { lat: number; lng: number }) => [pt.lat, pt.lng]);
        routePoints = [
          [userCoords.lat, userCoords.lng],
          ...roadPoints,
          [coverage.nearestOdp.lat, coverage.nearestOdp.lng]
        ];
      } else {
        routePoints = [
          [userCoords.lat, userCoords.lng],
          [coverage.nearestOdp.lat, coverage.nearestOdp.lng]
        ];
      }

      polylineRef.current = L.polyline(
        routePoints,
        { 
          color: lineColor, 
          weight: 4, 
          dashArray: coverage.isRoadRoute ? "none" : "5, 8", 
          opacity: 0.9 
        }
      ).addTo(map);
    }

    // 4b. Clear and Draw manual routing layers if applicable
    if (manualPolylineRef.current) {
      manualPolylineRef.current.remove();
      manualPolylineRef.current = null;
    }
    manualMarkersRef.current.forEach(m => m.remove());
    manualMarkersRef.current = [];

    if (measurementMode === "manual" && manualPoints.length > 0) {
      const latlngs = manualPoints.map(p => [p.lat, p.lng]);
      
      // Draw manual polyline
      manualPolylineRef.current = L.polyline(latlngs, {
        color: "#9333EA", // Bright purple for manual route
        weight: 4,
        dashArray: "2, 5",
        opacity: 0.95
      }).addTo(map);

      // Draw markers for each manual point
      manualPoints.forEach((pt, index) => {
        const isFirst = index === 0;
        const isLast = index === manualPoints.length - 1;
        
        let markerHtml = "";
        if (isFirst) {
          markerHtml = `
            <div class="relative flex items-center justify-center">
              <div class="absolute w-6 h-6 bg-purple-500/30 rounded-full animate-ping"></div>
              <div class="w-5 h-5 bg-purple-600 border border-white rounded-full flex items-center justify-center shadow-md text-white font-bold text-[9px] relative z-10">
                A
              </div>
            </div>
          `;
        } else if (isLast) {
          markerHtml = `
            <div class="relative flex items-center justify-center">
              <div class="absolute w-6 h-6 bg-indigo-500/30 rounded-full animate-ping"></div>
              <div class="w-5 h-5 bg-indigo-600 border border-white rounded-full flex items-center justify-center shadow-md text-white font-bold text-[9px] relative z-10">
                B
              </div>
            </div>
          `;
        } else {
          markerHtml = `
            <div class="w-4 h-4 bg-slate-700 border border-white rounded-full flex items-center justify-center shadow-sm text-white font-extrabold text-[8px]">
              ${index + 1}
            </div>
          `;
        }

        const customIcon = L.divIcon({
          className: "",
          html: markerHtml,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        const marker = L.marker([pt.lat, pt.lng], { icon: customIcon }).addTo(map);
        
        // Add segment tooltip
        if (index > 0) {
          const prevPt = L.latLng(manualPoints[index - 1].lat, manualPoints[index - 1].lng);
          const currPt = L.latLng(pt.lat, pt.lng);
          const segmentDist = Math.round(prevPt.distanceTo(currPt));
          marker.bindTooltip(`+${segmentDist}m`, {
            permanent: true,
            direction: "top",
            className: "bg-slate-800 text-white text-[8px] font-bold py-0.5 px-1 border-0 rounded shadow-md opacity-90 font-mono",
            offset: L.point(0, -6)
          });
        }

        manualMarkersRef.current.push(marker);
      });
    }

    // 5. Update/Recreate 300m coverage limit circle
    if (coverageCircleRef.current) {
      coverageCircleRef.current.remove();
      coverageCircleRef.current = null;
    }

    const circleCenter = (measurementMode === "manual" && manualPoints.length > 0)
      ? manualPoints[0]
      : userCoords;

    coverageCircleRef.current = L.circle([circleCenter.lat, circleCenter.lng], {
      radius: 300,
      color: measurementMode === "manual" ? "#9333EA" : "#3B82F6",
      fillColor: measurementMode === "manual" ? "#9333EA" : "#3B82F6",
      fillOpacity: 0.08,
      weight: 1.5,
      dashArray: "4, 6"
    }).addTo(map);
  }, [userCoords, odps, coverage, manualPoints, measurementMode]);

  return (
    <div className="h-screen w-full bg-slate-50 text-slate-800 flex flex-col font-sans overflow-hidden">
      {/* Dynamic Header */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 rounded-xl shadow-xs flex items-center justify-center shrink-0 w-11 h-11 text-white">
            <Network className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              ODP Coverage Locator
              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2 py-0.5 rounded-full font-medium">
                FTTH Fiber Checker
              </span>
            </h1>
            <p className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
              <span>Cek jangkauan Optical Distribution Point (Maksimal 300 Meter)</span>
              <span className="hidden md:inline text-slate-300">•</span>
              <span className="text-emerald-600 font-semibold bg-emerald-50/70 border border-emerald-100 px-1.5 py-0.5 rounded text-[10px]">
                Developed by Rafi Muiz NOC
              </span>
            </p>
          </div>
        </div>

        {/* Global Toolbar & Mobile Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mobile View Switcher (Only visible on mobile screens < 768px) */}
          <div className="flex md:hidden items-center bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
            <button
              type="button"
              onClick={() => setMobileTab("sidebar")}
              className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                mobileTab === "sidebar"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-blue-600" />
              <span>Form & ODP</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileTab("map");
                setTimeout(() => {
                  mapInstanceRef.current?.invalidateSize();
                }, 100);
              }}
              className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                mobileTab === "map"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>Peta FTTH</span>
            </button>
          </div>

          {/* Tombol Buku Panduan */}
          <button
            type="button"
            onClick={() => setShowManualBookModal(true)}
            className="flex items-center gap-1.5 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-2 rounded-lg transition-all cursor-pointer shadow-xs border border-indigo-200"
            title="Buka Manual Book & Petunjuk Penggunaan"
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
            <span>Buku Panduan</span>
          </button>

          {!isNocAuthenticated ? (
            <button
              onClick={() => {
                setNocInputPassword("");
                setNocAuthError("");
                setShowNocAuthModal(true);
              }}
              className="flex items-center gap-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white font-bold px-3 py-2 rounded-lg transition-all cursor-pointer shadow-sm border border-slate-700"
              title="Akses Terbatas khusus Tim NOC"
            >
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Menu NOC</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowNocPanelModal(true)}
                className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold px-3 py-2 rounded-lg transition-all cursor-pointer shadow-sm"
                title="Buka Panel Administrasi NOC"
              >
                <Shield className="w-3.5 h-3.5 text-amber-300" />
                <span>Panel NOC (Aktif)</span>
              </button>
              <button
                onClick={handleNocLogout}
                className="flex items-center gap-1 text-xs bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 font-medium px-2.5 py-2 rounded-lg border border-slate-200 transition-all cursor-pointer"
                title="Kunci / Keluar Session NOC"
              >
                <Lock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </div>
          )}
          
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Maps API Connected</span>
          </div>
        </div>
      </header>

      {/* Main Grid Panel */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 w-full overflow-hidden relative">
        
        {/* Left Column (Content, Management, Tech Stack) */}
        <div className={`w-full md:w-[440px] lg:w-[480px] xl:w-[500px] h-full bg-white border-r border-slate-200 flex-col shrink-0 overflow-y-auto min-h-0 relative z-10 shadow-xs ${mobileTab === "map" ? "hidden md:flex" : "flex"}`}>
          
          {/* Sidebar Header */}
          <div className="p-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-extrabold text-slate-800">Cek Jangkauan ODP FTTH</span>
            </div>
            {isNocAuthenticated && (
              <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Shield className="w-3 h-3 text-amber-600" />
                NOC Session Aktif
              </span>
            )}
          </div>

          <div className="p-5 flex-1 flex flex-col space-y-6">
            
            {/* TAB 1: COVERAGE CHECK */}
            {activeTab === "check" && (
              <div className="space-y-6 flex-1 flex flex-col">

                {/* Banner / Card Sinkronisasi ODP sebelum Cek */}
                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl shrink-0">
                        <RefreshCw className={`w-4 h-4 ${isSyncingOdps ? "animate-spin text-emerald-800" : ""}`} />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          Status Database ODP
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-extrabold">
                            {odps.length} ODP
                          </span>
                        </h3>
                        <p className="text-[10px] text-slate-500">
                          Sinkronkan data ODP terbaru sebelum melakukan pengecekan.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSyncOdps}
                      disabled={isSyncingOdps}
                      className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs px-3 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-60"
                      title="Klik untuk memperbarui dan menyinkronkan data ODP"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncingOdps ? "animate-spin" : ""}`} />
                      <span>{isSyncingOdps ? "Proses..." : "Sinkronkan ODP"}</span>
                    </button>
                  </div>

                  {syncSuccessMsg && (
                    <div className="bg-emerald-100/90 border border-emerald-300 text-emerald-900 text-xs px-3 py-2 rounded-xl font-semibold flex items-center gap-2 animate-fadeIn">
                      <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>{syncSuccessMsg}</span>
                    </div>
                  )}
                </div>

                {/* CARI ODP LAPANGAN UNTUK TEKNISI */}
                <div className="bg-white border border-blue-200 rounded-2xl p-4 space-y-3 shadow-sm shadow-blue-50/50">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-100 text-blue-700 rounded-xl shrink-0">
                        <Search className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          Cari ODP Lapangan
                          <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-full font-extrabold">
                            Teknisi
                          </span>
                        </h3>
                        <p className="text-[10px] text-slate-500">
                          Pencarian cepat kode ODP, status port, dan fokus titik peta
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Input Search Field & Quick Filters */}
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Ketik Kode/Nama ODP (cth: ODP-JAT-01, ODP-02)..."
                        value={mainOdpSearchQuery}
                        onChange={(e) => setMainOdpSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 font-medium"
                      />
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      {mainOdpSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setMainOdpSearchQuery("")}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                          title="Hapus pencarian"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Filter Status Port Buttons */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 text-[10px] font-bold">
                      <span className="text-slate-400 text-[10px] shrink-0">Filter:</span>
                      <button
                        type="button"
                        onClick={() => setMainOdpPortFilter("all")}
                        className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                          mainOdpPortFilter === "all"
                            ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        Semua ({odps.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setMainOdpPortFilter("available")}
                        className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                          mainOdpPortFilter === "available"
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        Port Tersedia ({odps.filter(o => o.availablePorts > 0).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setMainOdpPortFilter("full")}
                        className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                          mainOdpPortFilter === "full"
                            ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        Port Penuh ({odps.filter(o => o.availablePorts === 0).length})
                      </button>
                    </div>
                  </div>

                  {/* Hasil Pencarian ODP */}
                  {mainOdpSearchQuery.trim() || mainOdpPortFilter !== "all" ? (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 px-1">
                        <span>Hasil Pencarian:</span>
                        <span className="text-blue-600">{searchedMainOdps.length} ODP Ditemukan</span>
                      </div>

                      {searchedMainOdps.length === 0 ? (
                        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-center text-xs text-slate-500 space-y-1">
                          <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto" />
                          <p className="font-semibold">ODP Tidak Ditemukan</p>
                          <p className="text-[10px] text-slate-400">Coba kata kunci lain atau pilih filter "Semua".</p>
                        </div>
                      ) : (
                        <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                          {searchedMainOdps.map((odp) => {
                            const hasPorts = odp.availablePorts > 0;
                            const userPt = L.latLng(userCoords.lat, userCoords.lng);
                            const odpPt = L.latLng(odp.lat, odp.lng);
                            const distMeters = Math.round(userPt.distanceTo(odpPt));

                            return (
                              <div
                                key={odp.id}
                                className="p-2.5 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 rounded-xl transition-all space-y-2 text-xs"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="space-y-0.5">
                                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                      <span className={`w-2 h-2 rounded-full shrink-0 ${hasPorts ? "bg-emerald-500" : "bg-rose-500"}`} />
                                      {odp.name}
                                    </span>
                                    <div className="text-[10px] text-slate-500 font-mono">
                                      Lat: {odp.lat.toFixed(6)}, Lng: {odp.lng.toFixed(6)}
                                    </div>
                                  </div>

                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 border ${
                                    hasPorts 
                                      ? "bg-emerald-100 text-emerald-800 border-emerald-300" 
                                      : "bg-rose-100 text-rose-800 border-rose-300"
                                  }`}>
                                    {hasPorts ? `Sisa ${odp.availablePorts}/${odp.totalPorts} Port` : "Port PENUH"}
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 text-[10px] text-slate-600">
                                  <span className="flex items-center gap-1 font-semibold text-slate-600">
                                    <MapPin className="w-3 h-3 text-blue-500 shrink-0" />
                                    Jarak dari user: <strong className="text-slate-800">{distMeters} m</strong>
                                  </span>

                                  <div className="flex items-center gap-1 ml-auto">
                                    <button
                                      type="button"
                                      onClick={() => handleCopyMainOdpInfo(odp)}
                                      className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-bold transition-all cursor-pointer flex items-center gap-1"
                                      title="Salin Info ODP"
                                    >
                                      {copiedMainOdpId === odp.id ? (
                                        <>
                                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                                          <span className="text-emerald-600">Tersalin</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3 h-3 text-slate-500" />
                                          <span>Salin</span>
                                        </>
                                      )}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setCustomerModalOdp(odp)}
                                      className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1"
                                      title="Lihat daftar pelanggan & status port ODP ini"
                                    >
                                      <Users className="w-3 h-3 text-emerald-600" />
                                      <span>Port ({odp.customers?.length || (odp.totalPorts - odp.availablePorts)}/{odp.totalPorts})</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleSetUserToOdp(odp)}
                                      className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1"
                                      title="Set koordinat user ke lokasi ODP ini"
                                    >
                                      <Compass className="w-3 h-3 text-purple-600" />
                                      <span>Acuan</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (lockedTargetOdp?.id === odp.id) {
                                          setLockedTargetOdp(null);
                                          checkCoverage(userCoords.lat, userCoords.lng, measurementMode, null);
                                        } else {
                                          setLockedTargetOdp(odp);
                                          checkCoverage(userCoords.lat, userCoords.lng, measurementMode, odp);
                                        }
                                      }}
                                      className={`px-2 py-1 border rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                        lockedTargetOdp?.id === odp.id
                                          ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600"
                                          : "bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200"
                                      }`}
                                      title={lockedTargetOdp?.id === odp.id ? "Lepas kunci ODP ini" : "Kunci tarikan dropcore dari ODP ini"}
                                    >
                                      <span>{lockedTargetOdp?.id === odp.id ? "🔓 Batal" : "🎯 Tarik"}</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleFocusMainOdp(odp)}
                                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                                      title="Fokus dan perbesar lokasi ODP ini di peta"
                                    >
                                      <Globe className="w-3 h-3" />
                                      <span>Lihat Peta</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-2.5 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-[11px] text-slate-500 flex items-center justify-between">
                      <span>Ketik nama/kode ODP di atas untuk pencarian instan ODP</span>
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold border border-blue-200">{odps.length} ODP Ready</span>
                    </div>
                  )}
                </div>

                {/* Search Address Bar */}
                <form onSubmit={handleSearchAddress} className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">Cari Alamat / Area</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Masukkan nama jalan, kota, atau daerah..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-20 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                    <button
                      type="submit"
                      disabled={searchLoading}
                      className="absolute right-1.5 top-1.5 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-bold px-3 py-1.5 rounded transition-colors cursor-pointer"
                    >
                      {searchLoading ? "Mencari..." : "Cari"}
                    </button>
                  </div>
                </form>

                {/* Input Koordinat User */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <MapPin className="text-blue-500 w-4 h-4" /> Koordinat User
                    </span>
                    <button
                      onClick={handleUseCurrentLocation}
                      className="text-[10px] text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1"
                    >
                      <Compass className="w-3.5 h-3.5" /> Gunakan Lokasi Saya
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 text-[10px] block mb-1">Latitude</span>
                      <input
                        type="number"
                        step="any"
                        value={userCoords.lat}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) {
                            setUserCoords({ ...userCoords, lat: val });
                            setMapCenter({ ...mapCenter, lat: val });
                          }
                        }}
                        className="w-full bg-white border border-slate-200 rounded p-2 text-xs focus:outline-none focus:border-blue-500 font-mono text-slate-850"
                      />
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block mb-1">Longitude</span>
                      <input
                        type="number"
                        step="any"
                        value={userCoords.lng}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) {
                            setUserCoords({ ...userCoords, lng: val });
                            setMapCenter({ ...mapCenter, lng: val });
                          }
                        }}
                        className="w-full bg-white border border-slate-200 rounded p-2 text-xs focus:outline-none focus:border-blue-500 font-mono text-slate-850"
                      />
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 italic text-center">
                    *Tip: Anda juga dapat mengecek jangkauan dengan langsung mengklik di area peta manapun!
                  </p>
                </div>

                {/* METODE PENGUKURAN */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm shadow-slate-100/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                      <Compass className="text-blue-600 w-4 h-4" /> Metode Pengukuran Dropcore
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Rute Jalan Aktif
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMeasurementMode("road")}
                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer h-full ${
                        measurementMode === "road"
                          ? "bg-blue-50/70 border-blue-500 text-blue-950 shadow-sm ring-1 ring-blue-400"
                          : "bg-slate-50 border-slate-200 text-slate-650 hover:bg-slate-100/70"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-900">🚶 Rute Jalan OSRM</span>
                        {measurementMode === "road" && <Check className="w-3.5 h-3.5 text-blue-600" />}
                      </div>
                      <span className="text-[9px] text-slate-500 font-medium leading-tight mt-1">
                        Mengikuti kontur jalan & gang riil (Akurat)
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMeasurementMode("manual");
                        setManualPoints([]);
                      }}
                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer h-full ${
                        measurementMode === "manual"
                          ? "bg-purple-50/70 border-purple-500 text-purple-950 shadow-sm ring-1 ring-purple-400"
                          : "bg-slate-50 border-slate-200 text-slate-650 hover:bg-slate-100/70"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-purple-900">✏️ Klik Manual</span>
                        {measurementMode === "manual" && <Check className="w-3.5 h-3.5 text-purple-600" />}
                      </div>
                      <span className="text-[9px] text-slate-500 font-medium leading-tight mt-1">
                        Tentukan rute kustom tiang ke tiang
                      </span>
                    </button>
                  </div>
                </div>

                {/* HASIL CEK COVERAGE */}
                <div className="space-y-4 flex-1">
                  <h3 className="text-xs font-bold text-slate-500 tracking-wider uppercase">Hasil Analisis Jangkauan</h3>

                  {measurementMode === "manual" ? (
                    <div className="space-y-4">
                      {manualPoints.length === 0 ? (
                        <div className="bg-purple-50/40 border border-purple-150 rounded-2xl p-5 space-y-4 shadow-sm text-center text-xs">
                          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mx-auto text-purple-600">
                            <Compass className="w-5 h-5 animate-pulse" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-slate-900">📍 Penentuan Titik Lokasi Awal (Titik A)</h4>
                            <p className="text-[10px] text-slate-500 leading-normal">
                              Pilih lokasi awal untuk rute pengukuran manual Anda secara presisi dengan salah satu opsi di bawah:
                            </p>
                          </div>

                          <div className="space-y-2.5 text-left border-t border-purple-100 pt-3">
                            {/* Opsi 1: Dari Koordinat User */}
                            <button
                              type="button"
                              onClick={() => setManualPoints([userCoords])}
                              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-1.5 px-3 rounded-lg text-[10px] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <MapPin className="w-3 h-3" />
                              Gunakan Koordinat User ({userCoords.lat.toFixed(5)}, {userCoords.lng.toFixed(5)})
                            </button>

                            {/* Opsi 2: Dari Dropdown ODP */}
                            {odps.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-[9px] font-bold text-purple-800 uppercase block">Atau Mulai dari ODP Database:</span>
                                <select
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val) {
                                      const selected = odps.find(o => o.id === val);
                                      if (selected) {
                                        setManualPoints([{ lat: selected.lat, lng: selected.lng }]);
                                        setMapCenter({ lat: selected.lat, lng: selected.lng });
                                        setMapZoom(17);
                                      }
                                    }
                                  }}
                                  className="w-full bg-white border border-purple-200 text-slate-850 rounded p-1.5 text-xs focus:outline-none"
                                  defaultValue=""
                                >
                                  <option value="" disabled>-- Pilih ODP Awal --</option>
                                  {odps.map(o => (
                                    <option key={o.id} value={o.id}>
                                      {o.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {/* Opsi 3: Input Koordinat Manual */}
                            <div className="space-y-1 border-t border-purple-100 pt-2.5">
                              <span className="text-[9px] font-bold text-purple-800 uppercase block">Atau Tentukan Koordinat Manual Titik A:</span>
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="number"
                                  id="manual-start-lat"
                                  placeholder="Latitude"
                                  defaultValue={userCoords.lat}
                                  step="any"
                                  className="bg-white border border-purple-200 rounded p-1 text-[11px] font-mono focus:outline-none text-slate-850"
                                />
                                <input
                                  type="number"
                                  id="manual-start-lng"
                                  placeholder="Longitude"
                                  defaultValue={userCoords.lng}
                                  step="any"
                                  className="bg-white border border-purple-200 rounded p-1 text-[11px] font-mono focus:outline-none text-slate-850"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const latEl = document.getElementById("manual-start-lat") as HTMLInputElement;
                                  const lngEl = document.getElementById("manual-start-lng") as HTMLInputElement;
                                  if (latEl && lngEl) {
                                    const latVal = parseFloat(latEl.value);
                                    const lngVal = parseFloat(lngEl.value);
                                    if (!isNaN(latVal) && !isNaN(lngVal)) {
                                      setManualPoints([{ lat: latVal, lng: lngVal }]);
                                      setMapCenter({ lat: latVal, lng: lngVal });
                                      setMapZoom(17);
                                    } else {
                                      alert("Format koordinat tidak valid!");
                                    }
                                  }
                                }}
                                className="w-full mt-1 bg-slate-800 hover:bg-slate-900 text-white font-bold py-1 px-2 rounded text-[10px] transition-colors cursor-pointer"
                              >
                                Mulai dari Koordinat Manual di Atas
                              </button>
                            </div>
                          </div>

                          <p className="text-[9px] text-purple-600/70 italic leading-normal pt-1.5 border-t border-purple-100">
                            *Tip: Selain menggunakan opsi di atas, Anda juga dapat menentukan Titik Awal (Titik A) dengan mengklik langsung area manapun pada peta!
                          </p>
                        </div>
                      ) : (
                        <div className={`border rounded-2xl p-5 shadow-sm space-y-4 ${
                          manualPoints.length < 2 
                            ? "bg-slate-50 border-slate-200 text-slate-700"
                            : getManualDistance() <= 300
                            ? "bg-purple-50/50 border-purple-200 text-purple-950"
                            : "bg-rose-50 border-rose-200 text-rose-955"
                        }`}>
                          <div className="flex items-start justify-between border-b border-slate-200/60 pb-3">
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold block tracking-wide text-purple-600 uppercase">
                                PENGUKURAN RUTE MANUAL
                              </span>
                              <h4 className="text-base font-extrabold tracking-tight">
                                {manualPoints.length < 2 
                                  ? "Titik Awal Ditetapkan"
                                  : getManualDistance() <= 300 
                                  ? "TERCOVER (Klik Manual)" 
                                  : "BELUM TERCOVER (>300m)"}
                              </h4>
                            </div>
                            <div className="p-2 rounded-xl bg-white border border-slate-200/50 shadow-sm text-purple-600">
                              <Ruler className="w-6 h-6 animate-pulse" />
                            </div>
                          </div>

                        {/* DETAILS */}
                        <div className="space-y-3 text-xs leading-relaxed">
                          <div className="grid grid-cols-2 gap-y-2 text-slate-700">
                            <div>
                              <span className="text-[10px] text-slate-400 block uppercase font-bold">TOTAL TITIK RUTE</span>
                              <span className="font-extrabold text-slate-900">{manualPoints.length} Titik</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block uppercase font-bold">PANJANG KABEL RUTE</span>
                              <span className={`font-extrabold ${getManualDistance() <= 300 ? "text-purple-600" : "text-rose-600"}`}>
                                {getManualDistance()} meter
                              </span>
                            </div>
                          </div>

                          {/* Snapping to nearest ODP */}
                          {(() => {
                            const endOdp = getNearestOdpToManualEnd();
                            if (endOdp && endOdp.odp) {
                              const totalCable = getManualDistance() + endOdp.distance;
                              const isTotalCovered = totalCable <= 300;
                              return (
                                <div className="border-t border-slate-200/60 pt-3 mt-1 space-y-2">
                                  <div className="grid grid-cols-2 gap-y-1">
                                    <div>
                                      <span className="text-[10px] text-slate-400 block uppercase font-bold">ODP TERDEKAT DARI UJUNG RUTE</span>
                                      <span className="font-extrabold text-slate-900">{endOdp.odp.name}</span>
                                    </div>
                                    <div>
                                      <span className="text-[10px] text-slate-400 block uppercase font-bold">ESTIMASI KABEL TOTAL</span>
                                      <span className={`font-extrabold ${isTotalCovered ? "text-purple-650 font-black" : "text-rose-600"}`}>
                                        {totalCable} meter
                                      </span>
                                      <span className="text-[8px] text-slate-400 block font-semibold mt-0.5">
                                        (Rute + Sambungan {endOdp.distance}m ke ODP)
                                      </span>
                                    </div>
                                  </div>

                                  <div className="bg-white p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1 shadow-sm">
                                    <div className="flex justify-between font-bold text-slate-700 pb-1 border-b border-slate-100">
                                      <span>Rincian Estimasi:</span>
                                      <span className={isTotalCovered ? "text-emerald-600" : "text-rose-600"}>
                                        {isTotalCovered ? "🟢 Memenuhi Syarat" : "🔴 Redaman Terlalu Tinggi"}
                                      </span>
                                    </div>
                                    <p>
                                      Ujung rute manual berjarak <strong className="text-slate-800">{endOdp.distance}m</strong> dari <strong>{endOdp.odp.name}</strong>. 
                                      Total panjang tarikan dropcore dari awal titik A ke ODP adalah <strong className={isTotalCovered ? "text-emerald-600" : "text-rose-600"}>{totalCable}m</strong>.
                                    </p>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}

                          {/* Snapping to nearest ODP for Start (Point A) */}
                          {(() => {
                            if (manualPoints.length > 0 && odps.length > 0) {
                              const startPoint = manualPoints[0];
                              // Find closest 3 ODPs to startPoint
                              const sortedByStart = [...odps].map(odp => {
                                const dist = L.latLng(startPoint.lat, startPoint.lng).distanceTo(L.latLng(odp.lat, odp.lng));
                                return { odp, dist: Math.round(dist) };
                              }).sort((a, b) => a.dist - b.dist).slice(0, 3);

                              return (
                                <div className="bg-purple-50/40 p-3 rounded-xl border border-purple-100 space-y-2 mt-1">
                                  <span className="font-extrabold text-purple-900 text-[10px] uppercase block">
                                    📍 Set Titik Awal (Titik A) dari ODP Terdekat:
                                  </span>
                                  <div className="flex flex-col gap-1.5">
                                    {sortedByStart.map(({ odp, dist }) => {
                                      const isOdpAtStart = Math.abs(startPoint.lat - odp.lat) < 0.0001 && Math.abs(startPoint.lng - odp.lng) < 0.0001;
                                      return (
                                        <button
                                          key={odp.id}
                                          type="button"
                                          onClick={() => {
                                            setManualPoints(prev => {
                                              if (prev.length === 0) return [{ lat: odp.lat, lng: odp.lng }];
                                              const updated = [...prev];
                                              updated[0] = { lat: odp.lat, lng: odp.lng };
                                              return updated;
                                            });
                                          }}
                                          className={`flex justify-between items-center px-2 py-1.5 rounded text-[10px] border transition-all text-left cursor-pointer ${
                                            isOdpAtStart
                                              ? "bg-purple-600 border-purple-700 text-white font-extrabold"
                                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-purple-300"
                                          }`}
                                        >
                                          <span className="truncate max-w-[170px]">{odp.name} {isOdpAtStart ? " (Aktif)" : ""}</span>
                                          <span className={isOdpAtStart ? "text-purple-200" : "text-slate-400 font-mono shrink-0"}>
                                            {isOdpAtStart ? "Titik Awal" : `${dist} meter`}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}

                          {/* Manual Points List & Actions */}
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 mt-2">
                            <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                              <span className="font-bold text-slate-700 text-[10px] uppercase">Rincian Titik Klik</span>
                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (manualPoints.length > 0) {
                                      setManualPoints(prev => prev.slice(0, -1));
                                    }
                                  }}
                                  disabled={manualPoints.length <= 1}
                                  className="text-[9px] bg-white hover:bg-slate-100 disabled:opacity-55 text-slate-700 border border-slate-200 px-2 py-1 rounded font-bold cursor-pointer transition-colors"
                                  title="Hapus titik terakhir"
                                >
                                  Undo
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setManualPoints([]);
                                  }}
                                  className="text-[9px] bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-200 px-2 py-1 rounded font-bold cursor-pointer transition-colors"
                                  title="Reset rute manual (pilih titik awal baru)"
                                >
                                  Reset
                                </button>
                              </div>
                            </div>

                            <div className="max-h-[140px] overflow-y-auto space-y-1 text-[10px] font-mono text-slate-600 divide-y divide-slate-150">
                              {getManualSegments().map((seg) => (
                                <div key={seg.index} className="flex justify-between py-1 items-center">
                                  <span className="font-bold text-slate-750 flex items-center gap-1">
                                    <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[8px]">
                                      {seg.index === 0 ? "A" : seg.index === manualPoints.length - 1 ? "B" : seg.index + 1}
                                    </span>
                                    Lat: {seg.lat.toFixed(6)}, Lng: {seg.lng.toFixed(6)}
                                  </span>
                                  <span className="text-slate-500">
                                    {seg.index === 0 ? "Titik Awal" : `+${seg.dist}m`}
                                  </span>
                                </div>
                              ))}
                            </div>

                            <p className="text-[9px] text-slate-400 italic text-center leading-normal pt-1.5 border-t border-slate-200/50">
                              *Tip: Klik titik mana saja pada peta untuk menggambar rute kustom penarikan dropcore.
                            </p>
                          </div>

                        </div>
                      </div>
                    )}
                  </div>
                  ) : checking ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-2 border border-slate-250 border-dashed rounded-xl bg-slate-50">
                      <Loader2 className="w-6 h-6 text-blue-550 animate-spin" />
                      <span className="text-xs text-slate-500">Menganalisis ODP Terdekat...</span>
                    </div>
                  ) : coverage ? (
                    <div className="space-y-4">
                      
                      {/* STATUS CARD */}
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={coverage.status}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className={`border rounded-2xl p-5 shadow-sm space-y-4 ${
                            coverage.status === "TERCOVER"
                              ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                              : coverage.status === "PORT PENUH / WAITING LIST"
                              ? "bg-amber-50 border-amber-200 text-amber-955"
                              : "bg-rose-50 border-rose-200 text-rose-955"
                          }`}
                        >
                          <div className="flex items-start justify-between border-b border-slate-200/60 pb-3">
                            <div className="space-y-1">
                              <span className={`text-[10px] font-bold block tracking-wide uppercase ${
                                coverage.status === "TERCOVER" 
                                  ? "text-emerald-600" 
                                  : coverage.status === "PORT PENUH / WAITING LIST" 
                                  ? "text-amber-600" 
                                  : "text-rose-600"
                              }`}>
                                STATUS JARINGAN
                              </span>
                              <h4 className="text-lg font-extrabold tracking-tight">
                                {coverage.status}
                              </h4>
                            </div>
                            <div className="p-2 rounded-xl bg-white/80 border border-slate-200/50 shadow-sm">
                              {coverage.status === "TERCOVER" && <CheckCircle className="w-7 h-7 text-emerald-600" />}
                              {coverage.status === "PORT PENUH / WAITING LIST" && <AlertTriangle className="w-7 h-7 text-amber-500" />}
                              {coverage.status === "BELUM TERCOVER" && <AlertTriangle className="w-7 h-7 text-rose-600" />}
                            </div>
                          </div>

                          {/* LOCKED TARGET ODP BANNER */}
                          {lockedTargetOdp && (
                            <div className="bg-amber-100/90 border border-amber-300 text-amber-950 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs shadow-xs">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">🎯</span>
                                <div>
                                  <span className="font-bold block text-amber-900">ODP Target Terkunci Manual</span>
                                  <span className="text-[10px] text-amber-800 font-mono">{lockedTargetOdp.name}</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setLockedTargetOdp(null);
                                  checkCoverage(userCoords.lat, userCoords.lng, measurementMode, null);
                                }}
                                className="px-2 py-1 bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 rounded-lg text-[10px] font-bold cursor-pointer transition-colors shadow-xs"
                              >
                                Auto Terdekat
                              </button>
                            </div>
                          )}

                          {/* ANTI-DETOUR BADGE */}
                          {coverage.isDetourAvoided && (
                            <div className="bg-blue-100/90 border border-blue-300 text-blue-950 rounded-xl p-2.5 text-xs space-y-1 shadow-xs">
                              <div className="flex items-center justify-between font-bold text-blue-900">
                                <span className="flex items-center gap-1.5">
                                  <span>⚡ Jalur Tiang / Udara Aktif</span>
                                </span>
                                <span className="text-[9px] bg-blue-200/80 text-blue-900 px-1.5 py-0.5 rounded font-mono font-bold">
                                  Anti-Detur Gang
                                </span>
                              </div>
                              <p className="text-[10px] text-blue-800 leading-relaxed">
                                Rute jalan OSRM sempat memutar ke kanan karena gang/lorong rumah belum terpetakan di OpenStreetMap. Sistem otomatis mengaktifkan tarikan kabel tiang/udara langsung (<strong className="text-blue-950">{coverage.distance}m</strong>) menuju <strong>{coverage.nearestOdp?.name}</strong>.
                              </p>
                            </div>
                          )}

                          {/* DETAILS */}
                          {coverage.nearestOdp ? (
                            <div className="space-y-3 text-xs leading-relaxed">
                              <div className="grid grid-cols-2 gap-y-2 text-slate-700">
                                <div>
                                  <span className="text-[10px] text-slate-400 block uppercase font-bold">
                                    {lockedTargetOdp ? "ODP TARGET TERKUNCI" : "ODP TERDEKAT"}
                                  </span>
                                  <span className="font-extrabold text-slate-900">{coverage.nearestOdp.name}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 block uppercase font-bold">JARAK KE LOKASI</span>
                                  <span className={`font-extrabold ${coverage.distance !== null && coverage.distance <= 300 ? "text-emerald-600" : "text-rose-600"}`}>
                                    {coverage.distance} meter
                                  </span>
                                  <span className="text-[9px] text-slate-500 block font-semibold mt-0.5">
                                    🚶 Rute Jalan OSRM (Jalan/Gang)
                                  </span>
                                </div>
                                <div className="col-span-2 border-t border-slate-200/60 pt-2 mt-1"></div>
                                <div>
                                  <span className="text-[10px] text-slate-400 block uppercase font-bold">PORT TERPAKAI</span>
                                  <span className="font-extrabold text-slate-800">
                                    {coverage.nearestOdp.totalPorts - coverage.nearestOdp.availablePorts} Port
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 block uppercase font-bold">PORT TERSEDIA (SISA)</span>
                                  <span className={`font-extrabold ${coverage.nearestOdp.availablePorts > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                    {coverage.nearestOdp.availablePorts} Port
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 block uppercase font-bold">TOTAL KAPASITAS</span>
                                  <span className="font-semibold text-slate-600">{coverage.nearestOdp.totalPorts} Port</span>
                                </div>
                              </div>

                              {/* Action Callout */}
                              <div className="bg-white/90 p-3 rounded-lg border border-slate-200/60 text-[11px] text-slate-600 mt-2">
                                {coverage.status === "TERCOVER" && (
                                  <p>
                                    🟢 Lokasi user berada dalam jangkauan optik (<span className="font-bold text-emerald-600">{coverage.distance}m</span>) dan terdapat port yang kosong. 
                                    <strong> Pelanggan siap dipasang layanan internet!</strong>
                                  </p>
                                )}
                                {coverage.status === "PORT PENUH / WAITING LIST" && (
                                  <p>
                                    🟡 Jarak lokasi memenuhi syarat (<span className="font-bold text-amber-600">{coverage.distance}m</span>), namun port ODP telah penuh. 
                                    <strong> Direkomendasikan untuk masuk daftar antrean (waiting list) atau ekspansi ODP baru.</strong>
                                  </p>
                                )}
                                {coverage.status === "BELUM TERCOVER" && (
                                  <p>
                                    🔴 Lokasi user berada diluar batas radius maksimal (<span className="font-bold text-rose-600">{coverage.distance}m</span>). Batas maksimal penarikan dropcore adalah 300 meter untuk menjaga redaman sinyal optik.
                                  </p>
                                )}
                              </div>

                              {/* DAFTAR PELANGGAN & STATUS PORT ODP (ONLINE, OFFLINE, DYING GASP) */}
                              <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <Users className="w-4 h-4 text-blue-600" />
                                    <span className="text-[11px] font-bold text-slate-900 uppercase tracking-tight">
                                      Pelanggan Terhubung ke Port
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setCustomerModalOdp(coverage.nearestOdp)}
                                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <span>Lihat Port ({coverage.nearestOdp.customers?.length || (coverage.nearestOdp.totalPorts - coverage.nearestOdp.availablePorts)}/{coverage.nearestOdp.totalPorts})</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                </div>

                                {coverage.nearestOdp.customers && coverage.nearestOdp.customers.length > 0 ? (
                                  <div className="space-y-2">
                                    {/* Status summary counts */}
                                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        {coverage.nearestOdp.customers.filter(c => c.status === "online").length} Online
                                      </span>
                                      <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-800 border border-red-300 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                                        {coverage.nearestOdp.customers.filter(c => c.status === "los").length} LOS
                                      </span>
                                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-300 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                        {coverage.nearestOdp.customers.filter(c => c.status === "offline").length} Offline (Cek Admin)
                                      </span>
                                      <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                        {coverage.nearestOdp.customers.filter(c => c.status === "dyinggasp").length} Dying Gasp
                                      </span>
                                    </div>

                                    {/* Interactive customer list per port */}
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                      {coverage.nearestOdp.customers.map((cust) => {
                                        const isOnline = cust.status === "online";
                                        const isLos = cust.status === "los";
                                        const isOffline = cust.status === "offline";
                                        const isDying = cust.status === "dyinggasp";

                                        return (
                                          <div
                                            key={cust.id}
                                            className={`p-2 rounded-xl border flex items-center justify-between gap-2 text-xs transition-all ${
                                              isOnline
                                                ? "bg-white border-emerald-200 hover:border-emerald-300"
                                                : isLos
                                                ? "bg-red-50/70 border-red-300 hover:border-red-400"
                                                : isOffline
                                                ? "bg-slate-50/70 border-slate-300 hover:border-slate-400"
                                                : "bg-amber-50/70 border-amber-300 hover:border-amber-400"
                                            }`}
                                          >
                                            <div className="flex items-center gap-2 min-w-0">
                                              <span className="px-1.5 py-0.5 rounded-md bg-slate-900 text-white font-extrabold text-[10px] font-mono shrink-0 shadow-2xs">
                                                P{cust.port}
                                              </span>
                                              <div className="min-w-0">
                                                <div className="font-bold text-slate-900 truncate text-[11px] leading-tight">
                                                  {cust.name}
                                                </div>
                                                <div className="text-[9px] text-slate-500 font-mono flex items-center gap-1">
                                                  <span>SN: {cust.onuSn || "-"}</span>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Status Badge */}
                                            {isOnline && (
                                              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold border shrink-0 flex items-center gap-1 bg-emerald-100 text-emerald-800 border-emerald-300">
                                                <Wifi className="w-2.5 h-2.5 text-emerald-600" />
                                                <span>Online</span>
                                              </span>
                                            )}
                                            {isLos && (
                                              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold border shrink-0 flex items-center gap-1 bg-red-100 text-red-800 border-red-300">
                                                <AlertTriangle className="w-2.5 h-2.5 text-red-600" />
                                                <span>LOS</span>
                                              </span>
                                            )}
                                            {isOffline && (
                                              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold border shrink-0 flex items-center gap-1 bg-slate-100 text-slate-800 border border-slate-300">
                                                <WifiOff className="w-2.5 h-2.5 text-slate-500" />
                                                <span>Offline (cek status ke admin)</span>
                                              </span>
                                            )}
                                            {isDying && (
                                              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold border shrink-0 flex items-center gap-1 bg-amber-100 text-amber-900 border-amber-300">
                                                <ZapOff className="w-2.5 h-2.5 text-amber-600" />
                                                <span>Dying Gasp</span>
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => setCustomerModalOdp(coverage.nearestOdp)}
                                      className="w-full py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                                    >
                                      <Users className="w-3.5 h-3.5" />
                                      <span>Buka Pemetaan Lengkap Port ({coverage.nearestOdp.totalPorts} Port)</span>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center space-y-1.5">
                                    <p className="text-[11px] text-slate-500">Belum ada pelanggan yang terhubung di ODP ini.</p>
                                    <button
                                      type="button"
                                      onClick={() => setCustomerModalOdp(coverage.nearestOdp)}
                                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                    >
                                      <Users className="w-3 h-3 text-blue-600" />
                                      <span>Buka Pemetaan Port ODP</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500">{coverage.message || "Tidak ada ODP terdekat."}</p>
                          )}
                        </motion.div>
                      </AnimatePresence>

                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 space-y-2 border border-slate-200 border-dashed rounded-xl bg-slate-50 text-slate-400 text-xs">
                      <Compass className="w-6 h-6" />
                      <span>Klik peta untuk mengaktifkan kueri coverage</span>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB 2: DATABASE ODP */}
            {activeTab === "database" && (
              <div className="space-y-6 flex-1 flex flex-col">
                
                {/* KMZ / KML Import Section */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3 shrink-0 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                    <UploadCloud className="w-4 h-4 text-blue-600" />
                    Impor ODP dari Google Earth (.KMZ / .KML)
                  </h3>

                  <p className="text-[10px] text-slate-500 leading-normal">
                    Unggah file KMZ hasil export peta ODP Anda dari Google Earth. Sistem akan otomatis mengekstrak koordinat dan nama titik secara offline di browser.
                  </p>

                  <div className="relative border-2 border-dashed border-slate-200 hover:border-blue-400 bg-white rounded-xl p-4 transition-colors flex flex-col items-center justify-center text-center cursor-pointer">
                    <input
                      type="file"
                      accept=".kmz,.kml"
                      onChange={handleKmzUpload}
                      disabled={kmzImporting}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <UploadCloud className={`w-8 h-8 ${kmzImporting ? "text-blue-500 animate-bounce" : "text-slate-400"}`} />
                    <span className="text-[11px] font-bold text-slate-700 mt-2 block">
                      {kmzImporting ? "Memproses File..." : "Pilih File KMZ atau KML"}
                    </span>
                    <span className="text-[9px] text-slate-400 mt-0.5 block">
                      Drag & drop atau klik untuk jelajah file
                    </span>
                  </div>

                  {importMessage && (
                    <div className={`text-[11px] p-2.5 rounded-lg border leading-relaxed ${
                      importMessage.type === "success" 
                        ? "bg-emerald-50 border-emerald-150 text-emerald-800" 
                        : "bg-rose-50 border-rose-150 text-rose-800"
                    }`}>
                      {importMessage.text}
                    </div>
                  )}

                  {parsedOdps.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 border-b pb-1">
                        <span>Preview Data ({parsedOdps.length} ODP):</span>
                        <button
                          onClick={() => setParsedOdps([])}
                          className="text-rose-600 hover:text-rose-700 font-semibold"
                        >
                          Batalkan
                        </button>
                      </div>
                      <div className="max-h-[120px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg bg-white text-[10px] font-mono">
                        {parsedOdps.slice(0, 10).map((p, idx) => (
                          <div key={idx} className="p-1.5 flex justify-between text-slate-700">
                            <span className="truncate max-w-[150px] font-bold">{p.name}</span>
                            <span>({p.lat.toFixed(5)}, {p.lng.toFixed(5)})</span>
                          </div>
                        ))}
                        {parsedOdps.length > 10 && (
                          <div className="p-1.5 text-center text-slate-400 italic bg-slate-50 border-t">
                            + {parsedOdps.length - 10} ODP lainnya...
                          </div>
                        )}
                      </div>
                      <button
                        onClick={handleSaveImportedOdps}
                        disabled={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-100"
                      >
                        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        Simpan Semua ke Database
                      </button>
                    </div>
                  )}
                </div>

                {/* Form Add / Edit ODP */}
                <form onSubmit={handleAddOdp} className={`border rounded-xl p-4 space-y-3 shrink-0 shadow-sm transition-all duration-300 ${editingOdp ? "bg-blue-50/50 border-blue-200" : "bg-slate-50 border-slate-200"}`}>
                  <h3 id="odp-form-header" className={`text-xs font-bold flex items-center gap-1.5 border-b pb-2 ${editingOdp ? "text-blue-700 border-blue-200" : "text-blue-600 border-slate-200/60"}`}>
                    {editingOdp ? (
                      <>
                        <Edit2 className="w-4 h-4 text-blue-700 animate-pulse" /> Edit ODP: <span className="underline">{editingOdp.name}</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 text-blue-600" /> Tambah ODP Baru ke Database
                      </>
                    )}
                  </h3>

                  {formError && <div className="text-[11px] bg-rose-50 border border-rose-150 text-rose-600 p-2 rounded">{formError}</div>}
                  {formSuccess && <div className="text-[11px] bg-emerald-50 border border-emerald-150 text-emerald-600 p-2 rounded">{formSuccess}</div>}

                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="text-slate-500 text-[10px] font-bold uppercase block mb-1">Nama ODP</label>
                      <input
                        type="text"
                        placeholder="Contoh: ODP-MNT-12/08"
                        value={newOdpName}
                        onChange={(e) => setNewOdpName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none focus:border-blue-500 text-slate-800"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-500 text-[10px] font-bold uppercase block mb-1">Latitude</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="-6.18420"
                          value={newOdpLat}
                          onChange={(e) => setNewOdpLat(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none focus:border-blue-500 text-slate-800 font-mono"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 text-[10px] font-bold uppercase block mb-1">Longitude</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="106.8228"
                          value={newOdpLng}
                          onChange={(e) => setNewOdpLng(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none focus:border-blue-500 text-slate-800 font-mono"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setNewOdpLat(userCoords.lat.toFixed(6));
                        setNewOdpLng(userCoords.lng.toFixed(6));
                      }}
                      className="text-[9px] text-blue-600 hover:text-blue-700 font-bold block underline cursor-pointer"
                    >
                      Salin koordinat pin biru user saat ini ({userCoords.lat.toFixed(4)}, {userCoords.lng.toFixed(4)})
                    </button>

                    <div className="grid grid-cols-2 gap-2 border-t border-slate-200/60 pt-2">
                      <div>
                        <label className="text-slate-500 text-[10px] font-bold uppercase block mb-1">Total Port</label>
                        <select
                          value={newOdpTotalPorts}
                          onChange={(e) => setNewOdpTotalPorts(Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none focus:border-blue-500 text-xs text-slate-800"
                        >
                          <option value={8}>8 Port</option>
                          <option value={16}>16 Port</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-500 text-[10px] font-bold uppercase block mb-1">Port Tersedia</label>
                        <input
                          type="number"
                          min="0"
                          max={newOdpTotalPorts}
                          value={newOdpAvailablePorts}
                          onChange={(e) => setNewOdpAvailablePorts(Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none focus:border-blue-500 text-slate-800"
                        />
                      </div>
                    </div>
                  </div>

                  {editingOdp ? (
                    <div className="flex gap-2 mt-2">
                      <button
                        type="submit"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-sm shadow-emerald-100"
                      >
                        <CheckCircle className="w-4 h-4" /> Simpan Perubahan
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-3 rounded-lg text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <X className="w-4 h-4" /> Batal
                      </button>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-xs mt-2 transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-sm shadow-blue-100"
                    >
                      <Plus className="w-4 h-4" /> Tambah Koordinat ODP
                    </button>
                  )}
                </form>

                {/* List of ODPs */}
                <div className="space-y-3 flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">Daftar Koordinat ODP ({odps.length})</span>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={fetchODPs}
                        className="text-[10px] text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                      >
                        Refresh
                      </button>
                      {odps.length > 0 && (
                        <button 
                          onClick={handleDeleteAllOdps}
                          className="text-[10px] text-rose-500 hover:text-rose-700 font-bold cursor-pointer flex items-center gap-1"
                          title="Hapus seluruh data ODP dari database"
                        >
                          <Trash2 className="w-3 h-3" />
                          Hapus Semua
                        </button>
                      )}
                    </div>
                  </div>

                  {/* SmartOLT Quick Sync Bar */}
                  <div className="bg-emerald-50/70 border border-emerald-150 rounded-xl p-3 flex items-center justify-between gap-3 text-xs shadow-sm">
                    <div className="space-y-0.5">
                      <span className="font-bold text-emerald-900 flex items-center gap-1">
                        <Cpu className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                        Sinkronisasi SmartOLT
                      </span>
                      <p className="text-[10px] text-emerald-800 leading-normal">
                        Perbarui otomatis kapasitas port ODP berdasarkan data ONU yang terhubung di SmartOLT.
                      </p>
                    </div>
                    <button
                      onClick={handleSyncSmartOltPorts}
                      disabled={smartOltSyncLoading}
                      className="shrink-0 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold py-1.5 px-3 rounded-lg text-[10px] transition-all flex items-center gap-1 cursor-pointer shadow-sm shadow-emerald-200"
                    >
                      {smartOltSyncLoading ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-3 h-3" />
                          Sync Port
                        </>
                      )}
                    </button>
                  </div>

                  {smartOltSyncResult && (
                    <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-[10px] text-slate-700 flex items-center justify-between">
                      <span className="font-semibold flex items-center gap-1 text-slate-800">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        Berhasil sinkron! {smartOltSyncResult.syncCount} ODP terupdate.
                      </span>
                      <button 
                        onClick={() => setActiveTab("integrasi")}
                        className="text-blue-600 hover:underline font-bold text-[9px]"
                      >
                        Lihat Log Detail →
                      </button>
                    </div>
                  )}

                  {smartOltSyncError && (
                    <div className="bg-rose-50 border border-rose-100 p-2.5 rounded-lg text-[10px] text-rose-600 font-medium">
                      ⚠️ Sinkronisasi gagal: {smartOltSyncError}
                    </div>
                  )}

                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-2 text-slate-400">
                      <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                      <span className="text-xs">Memuat data ODP...</span>
                    </div>
                  ) : odps.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400 border border-slate-200 border-dashed rounded-xl bg-slate-50">
                      Database ODP Kosong
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Selection control bar */}
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 flex items-center justify-between gap-2 text-[11px] font-medium text-slate-600 shadow-sm animate-fade-in">
                        <label className="flex items-center gap-2 cursor-pointer select-none pl-1">
                          <input
                            type="checkbox"
                            checked={odps.length > 0 && selectedOdpIds.length === odps.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedOdpIds(odps.map(o => o.id));
                              } else {
                                setSelectedOdpIds([]);
                              }
                            }}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-3.5 h-3.5"
                          />
                          <span className="font-semibold text-slate-700">Pilih Semua ({odps.length})</span>
                        </label>
                        {selectedOdpIds.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-rose-600 font-extrabold bg-rose-50 px-2 py-0.5 rounded-full text-[10px]">
                              {selectedOdpIds.length} Terpilih
                            </span>
                            <button
                              onClick={handleDeleteSelectedOdps}
                              className="bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-sm shadow-rose-100"
                            >
                              <Trash2 className="w-3 h-3" />
                              Hapus Terpilih
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="overflow-y-auto max-h-[350px] divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white shadow-sm shadow-slate-100/40">
                        {odps.map((odp) => {
                          const isChecked = selectedOdpIds.includes(odp.id);
                          return (
                            <div 
                              key={odp.id} 
                              className={`p-3 text-xs flex items-center justify-between hover:bg-slate-50/80 transition-colors group ${editingOdp?.id === odp.id ? "bg-blue-50/30 border-l-2 border-blue-500" : ""} ${isChecked ? "bg-blue-50/10" : ""}`}
                            >
                              <div className="flex items-start gap-3 flex-1 min-w-0 pr-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedOdpIds(prev => [...prev, odp.id]);
                                    } else {
                                      setSelectedOdpIds(prev => prev.filter(id => id !== odp.id));
                                    }
                                  }}
                                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0 w-3.5 h-3.5"
                                />
                                <div className="space-y-1 flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-extrabold text-slate-800 truncate">{odp.name}</span>
                                    <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                                      odp.availablePorts > 0 ? "bg-emerald-500" : "bg-rose-500"
                                    }`} title={odp.availablePorts > 0 ? "Port Tersedia" : "Port Penuh"}></span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    ({odp.lat.toFixed(5)}, {odp.lng.toFixed(5)})
                                  </div>
                                  <div className="space-y-1 mt-1 bg-slate-50 p-1.5 rounded-lg border border-slate-100 max-w-[180px]">
                                    <div className="flex items-center justify-between text-[9px] font-extrabold text-slate-500 font-mono">
                                      <span>Port: {odp.totalPorts - odp.availablePorts} / {odp.totalPorts}</span>
                                      <span className={
                                        (odp.totalPorts - odp.availablePorts) / odp.totalPorts >= 0.9 
                                          ? "text-rose-600" 
                                          : (odp.totalPorts - odp.availablePorts) / odp.totalPorts >= 0.7 
                                          ? "text-amber-600" 
                                          : odp.availablePorts < odp.totalPorts 
                                          ? "text-emerald-600" 
                                          : "text-slate-400"
                                      }>
                                        {Math.round(((odp.totalPorts - odp.availablePorts) / odp.totalPorts) * 100)}%
                                      </span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full transition-all duration-500 ${
                                          ((odp.totalPorts - odp.availablePorts) / odp.totalPorts) >= 0.9
                                            ? "bg-rose-500"
                                            : ((odp.totalPorts - odp.availablePorts) / odp.totalPorts) >= 0.7
                                            ? "bg-amber-500"
                                            : (odp.totalPorts - odp.availablePorts) > 0
                                            ? "bg-emerald-500"
                                            : "bg-slate-300"
                                        }`} 
                                        style={{ width: `${Math.round(((odp.totalPorts - odp.availablePorts) / odp.totalPorts) * 100)}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {deletingOdpId === odp.id ? (
                                  <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 p-1 rounded animate-fade-in shrink-0">
                                    <span className="text-[9px] font-bold text-rose-700 px-1 shrink-0">Yakin?</span>
                                    <button
                                      onClick={() => {
                                        handleDeleteOdp(odp.id, odp.name, true);
                                        setDeletingOdpId(null);
                                      }}
                                      className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-[9px] px-1.5 py-0.5 rounded cursor-pointer shrink-0"
                                    >
                                      Ya
                                    </button>
                                    <button
                                      onClick={() => setDeletingOdpId(null)}
                                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[9px] px-1.5 py-0.5 rounded cursor-pointer shrink-0"
                                    >
                                      Batal
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => {
                                        setMapCenter({ lat: odp.lat, lng: odp.lng });
                                        setMapZoom(17);
                                        setSelectedOdp(odp);
                                      }}
                                      className="text-[10px] text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2 py-1 rounded transition-colors cursor-pointer font-bold"
                                    >
                                      Lihat
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setCustomerModalOdp(odp)}
                                      className="text-[10px] text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2 py-1 rounded transition-colors cursor-pointer font-bold flex items-center gap-1"
                                      title="Kelola daftar pelanggan & status port ODP ini"
                                    >
                                      <Users className="w-3 h-3 text-emerald-600" />
                                      <span>Port ({odp.customers?.length || (odp.totalPorts - odp.availablePorts)})</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setMapCenter({ lat: odp.lat, lng: odp.lng });
                                        setMapZoom(17);
                                        setMeasurementMode("manual");
                                        setManualPoints([{ lat: odp.lat, lng: odp.lng }]);
                                        setActiveTab("check");
                                      }}
                                      className="text-[10px] text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-250 px-2 py-1 rounded transition-colors cursor-pointer font-bold"
                                      title="Mulai rute manual dari ODP ini"
                                    >
                                      Rute Manual
                                    </button>
                                    <button
                                      onClick={() => handleStartEdit(odp)}
                                      className={`p-1 rounded transition-colors cursor-pointer ${
                                        editingOdp?.id === odp.id 
                                          ? "text-blue-600 bg-blue-100" 
                                          : "text-slate-500 hover:text-blue-600 hover:bg-slate-100"
                                      }`}
                                      title="Edit ODP ini"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setDeletingOdpId(odp.id)}
                                      className="p-1 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                      title="Hapus dari Database"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB 3: ISP API INTEGRATION */}
            {activeTab === "integrasi" && (
              <div className="space-y-6 flex-1 flex flex-col">
                
                {/* Introduction banner */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-150 p-4 rounded-xl space-y-1.5 shrink-0">
                  <h3 className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <Server className="w-4 h-4 text-blue-600" />
                    Pusat Integrasi OLT & GenieACS
                  </h3>
                  <p className="text-[11px] text-blue-800 leading-normal">
                    Hubungkan data jangkauan ODP FTTH ini dengan software provisioning ISP Anda secara realtime untuk memantau status ONU/ONT secara langsung dari peta.
                  </p>
                </div>

                {/* SMARTOLT PANEL */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-4 shadow-sm shadow-slate-100/40">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Cpu className="w-4 h-4 text-emerald-600" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">SmartOLT Integration</h4>
                      <p className="text-[9px] text-slate-400">Sync status ONU/ONT & Redaman Sinyal</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="text-slate-500 text-[10px] font-bold uppercase block mb-1">SmartOLT Domain URL</label>
                      <input
                        type="text"
                        placeholder="yourdomain.smartolt.com"
                        value={smartOltDomain}
                        onChange={(e) => setSmartOltDomain(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 text-[10px] font-bold uppercase block mb-1">X-Token API Key</label>
                      <input
                        type="password"
                        placeholder="Masukkan SmartOLT API Key..."
                        value={smartOltKey}
                        onChange={(e) => setSmartOltKey(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 mt-1">
                      <span className="text-[9px] text-slate-400">
                        * Kredensial tersimpan aman di server & lokal browser.
                      </span>
                      <button
                        onClick={handleSaveSettings}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] transition-colors flex items-center gap-1 cursor-pointer shrink-0 shadow-sm"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Simpan Kredensial
                      </button>
                    </div>

                    {saveStatus && (
                      <div className={`text-[10px] p-2 rounded border leading-normal ${
                        saveStatus.type === "success" 
                          ? "bg-emerald-50 border-emerald-100 text-emerald-700" 
                          : "bg-rose-50 border-rose-100 text-rose-700"
                      }`}>
                        {saveStatus.type === "success" ? "✅" : "⚠️"} {saveStatus.text}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button
                        onClick={() => handleTestSmartOlt("get_olts")}
                        disabled={smartOltLoading}
                        className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded-lg text-[10px] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        {smartOltLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Server className="w-3 h-3" />}
                        Cek Koneksi OLT
                      </button>
                      <button
                        onClick={() => handleTestSmartOlt("get_onus_statuses")}
                        disabled={smartOltLoading}
                        className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 rounded-lg text-[10px] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        {smartOltLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />}
                        Tarik Status ONU
                      </button>
                    </div>

                    {smartOltError && (
                      <div className="text-[10px] bg-rose-50 border border-rose-100 text-rose-600 p-2 rounded break-all leading-normal">
                        ⚠️ {smartOltError}
                      </div>
                    )}

                    {smartOltResult && (
                      <div className="space-y-2 border border-slate-100 p-2 rounded-lg bg-slate-50/50">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-slate-500">Hasil Respons ONU:</span>
                          <span className={`px-1.5 py-0.5 text-[8px] font-extrabold rounded uppercase ${
                            smartOltResult.isMock ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                          }`}>
                            {smartOltResult.isMock ? "Simulasi" : "Live API"}
                          </span>
                        </div>
                        
                        {smartOltResult.data && Array.isArray(smartOltResult.data) ? (
                          <div className="max-h-[140px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg bg-white p-2 text-[10px]">
                            {smartOltResult.data.map((item: any, idx: number) => (
                              <div key={idx} className="py-1 flex justify-between items-center">
                                <div className="font-semibold text-slate-700">
                                  {item.name || item.ip || `ONU-${idx}`}
                                  {item.sn && <span className="text-[8px] text-slate-400 font-mono block">{item.sn}</span>}
                                </div>
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                  item.status === "active" || item.state === "online" 
                                    ? "bg-emerald-100 text-emerald-800" 
                                    : item.signal === "LOS" || item.state === "offline"
                                    ? "bg-rose-100 text-rose-800" 
                                    : "bg-slate-100 text-slate-600"
                                }`}>
                                  {item.status || item.state || item.signal || "OK"}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <pre className="p-2 bg-slate-50 text-slate-600 rounded border text-[9px] font-mono overflow-x-auto max-h-[120px]">
                            {JSON.stringify(smartOltResult, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}

                    {/* DAFTAR ODB SMARTOLT SECTION */}
                    <div className="border-t border-slate-100 pt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Daftar ODB SmartOLT</span>
                        <span className="text-[8px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-extrabold uppercase font-mono">system/get_odbs</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-normal">
                        Ambil semua data kotak ODB yang sudah dikonfigurasi di SmartOLT beserta koordinat dan zonanya.
                      </p>
                      
                      <button
                        onClick={handleFetchSmartOltOdbs}
                        disabled={smartOltOdbLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-[10px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-blue-100"
                      >
                        {smartOltOdbLoading ? (
                          <>
                            <Loader2 className="w-3 animate-spin" />
                            Memuat Daftar ODB...
                          </>
                        ) : (
                          <>
                            <MapPin className="w-3.5 h-3.5" />
                            Tarik Daftar ODB (SmartOLT)
                          </>
                        )}
                      </button>

                      {smartOltOdbError && (
                        <div className="text-[10px] bg-rose-50 border border-rose-100 text-rose-600 p-2.5 rounded break-all leading-normal">
                          ⚠️ {smartOltOdbError}
                        </div>
                      )}

                      {odbMappingStatus && (
                        <div className={`text-[10px] border p-2.5 rounded-lg font-medium leading-normal flex items-start gap-1.5 ${
                          odbMappingStatus.type === "success" 
                            ? "bg-emerald-50 border-emerald-150 text-emerald-800" 
                            : "bg-rose-50 border-rose-100 text-rose-800"
                        }`}>
                          <span className="font-bold">{odbMappingStatus.type === "success" ? "✓" : "⚠️"}</span>
                          <span>{odbMappingStatus.text}</span>
                        </div>
                      )}

                      {smartOltOdbResult && (() => {
                        const odbList = smartOltOdbResult.response || smartOltOdbResult.data || [];
                        const filteredOdbs = odbList.filter((odb: any) => {
                          const query = smartOltOdbSearch.toLowerCase();
                          return (
                            (odb.name && odb.name.toLowerCase().includes(query)) ||
                            (odb.zone && odb.zone.toLowerCase().includes(query))
                          );
                        });

                        return (
                          <div className="space-y-2 border border-slate-100 p-2.5 rounded-lg bg-slate-50/50">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-bold text-slate-500">Hasil Respons ODB ({filteredOdbs.length}):</span>
                              <span className={`px-1.5 py-0.5 text-[8px] font-extrabold rounded uppercase ${
                                smartOltOdbResult.isMock ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                              }`}>
                                {smartOltOdbResult.isMock ? "Simulasi" : "Live API"}
                              </span>
                            </div>

                            <div className="relative">
                              <Search className="w-3 h-3 absolute left-2 top-2.5 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Cari ODB berdasarkan nama / zona..."
                                value={smartOltOdbSearch}
                                onChange={(e) => setSmartOltOdbSearch(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded pl-7 pr-2 py-1.5 text-[10px] text-slate-850 focus:outline-none focus:border-blue-500"
                              />
                            </div>

                            {filteredOdbs.length > 0 ? (
                              <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg bg-white p-2 space-y-1.5 animate-in fade-in duration-300">
                                {filteredOdbs.map((odb: any, idx: number) => {
                                  // Check if this ODB is already mapped in our list
                                  const isMapped = odps.some(odp => odp.name.toLowerCase() === odb.name.toLowerCase());
                                  
                                  const total = parseInt(odb.nr_of_ports, 10) || 8;
                                  const used = odb.used_ports !== undefined ? odb.used_ports : 0;
                                  const pct = Math.round((used / total) * 100);

                                  // Bar color matching user's reference image
                                  let barColor = "bg-slate-200";
                                  if (pct >= 90) barColor = "bg-rose-500";
                                  else if (pct >= 70) barColor = "bg-amber-500";
                                  else if (pct > 0) barColor = "bg-emerald-500";

                                  return (
                                    <div key={odb.id || idx} className="py-2.5 flex flex-col gap-1.5 border-b border-slate-50 last:border-0">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <span className="font-extrabold text-slate-850 text-[11px] block">{odb.name}</span>
                                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                            <span className="bg-slate-100 text-slate-650 px-1 py-0.5 rounded text-[8px] font-bold">
                                              Zona: {odb.zone || "-"}
                                            </span>
                                            <span className="bg-blue-50 text-blue-750 px-1 py-0.5 rounded text-[8px] font-extrabold">
                                              Kapasitas: {total} Port
                                            </span>
                                          </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-1">
                                          {odb.latitude && odb.longitude && (
                                            <button
                                              onClick={() => {
                                                const lat = parseFloat(odb.latitude);
                                                const lng = parseFloat(odb.longitude);
                                                if (!isNaN(lat) && !isNaN(lng)) {
                                                  setMapCenter({ lat, lng });
                                                  setMapZoom(17);
                                                  setActiveTab("check");
                                                }
                                              }}
                                              className="text-[9px] text-slate-650 bg-slate-100 hover:bg-slate-200 border border-slate-250 px-1.5 py-1 rounded transition-colors cursor-pointer font-bold"
                                              title="Fokus di peta"
                                            >
                                              Peta
                                            </button>
                                          )}
                                          
                                          <button
                                            onClick={() => handleImportSmartOltOdb(odb)}
                                            disabled={isMapped}
                                            className={`text-[9px] font-bold px-2 py-1 rounded transition-colors cursor-pointer ${
                                              isMapped 
                                                ? "bg-slate-100 text-slate-400 border border-slate-200" 
                                                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shadow-emerald-200"
                                            }`}
                                          >
                                            {isMapped ? "Terpetakan" : "Petakan"}
                                          </button>
                                        </div>
                                      </div>

                                      {/* Capacity / usage indicator with color-coded bar */}
                                      <div className="space-y-1 bg-slate-50/50 p-1.5 rounded-md border border-slate-100">
                                        <div className="flex items-center justify-between text-[9px] font-bold text-slate-600 font-mono">
                                          <span>Port Terpakai: {used} / {total}</span>
                                          <span className={pct >= 90 ? "text-rose-600" : pct >= 70 ? "text-amber-600" : pct > 0 ? "text-emerald-600" : "text-slate-400"}>
                                            {pct}%
                                          </span>
                                        </div>
                                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                          <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }}></div>
                                        </div>
                                      </div>
                                      
                                      {odb.latitude && odb.longitude && (
                                        <span className="text-[8px] text-slate-400 font-mono">
                                          Koordinat: {odb.latitude}, {odb.longitude}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-500 italic text-center py-4">
                                Tidak ada ODB yang cocok dengan pencarian.
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* SYNCHRONIZER ELEMENT */}
                    <div className="border-t border-slate-100 pt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Fitur Sinkronisasi</span>
                        <span className="text-[8px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-extrabold uppercase">Otomatis</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-normal">
                        Menganalisis daftar ONU di SmartOLT dan memperbarui ketersediaan port setiap ODP secara instan di database.
                      </p>
                      
                      <button
                        onClick={handleSyncSmartOltPorts}
                        disabled={smartOltSyncLoading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-100"
                      >
                        {smartOltSyncLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Mensinkronkan Port...
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-3.5 h-3.5 animate-pulse" />
                            Sinkronkan Port ODP Sekarang
                          </>
                        )}
                      </button>

                      {smartOltSyncError && (
                        <div className="text-[10px] bg-rose-50 border border-rose-100 text-rose-600 p-2.5 rounded-lg break-all leading-normal">
                          ⚠️ <strong>Sinkronisasi Gagal:</strong> {smartOltSyncError}
                        </div>
                      )}

                      {smartOltSyncResult && (
                        <div className="space-y-2.5 bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
                          <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-xs font-bold text-slate-800">Sinkronisasi Selesai!</span>
                            </div>
                            <span className={`px-1.5 py-0.5 text-[8px] font-extrabold rounded uppercase ${
                              smartOltSyncResult.isMock ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                            }`}>
                              {smartOltSyncResult.isMock ? "Simulasi" : "Live API"}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div className="bg-white border border-slate-150 rounded-lg p-1.5 text-center shadow-sm">
                              <span className="text-slate-400 block text-[8px] font-bold uppercase">ONU Terpindai</span>
                              <span className="text-xs font-extrabold text-slate-800">{smartOltSyncResult.totalOnusScanned}</span>
                            </div>
                            <div className="bg-white border border-slate-150 rounded-lg p-1.5 text-center shadow-sm">
                              <span className="text-slate-400 block text-[8px] font-bold uppercase">ODP Diperbarui</span>
                              <span className="text-xs font-extrabold text-emerald-600">{smartOltSyncResult.syncCount}</span>
                            </div>
                          </div>

                          {smartOltSyncResult.logs && smartOltSyncResult.logs.length > 0 ? (
                            <div className="space-y-1">
                              <span className="text-[8px] font-extrabold text-slate-500 uppercase block">Log Sinkronisasi:</span>
                              <div className="max-h-[100px] overflow-y-auto divide-y divide-slate-100 border border-slate-150 rounded-lg bg-white p-2 text-[9px] font-mono leading-relaxed text-slate-700">
                                {smartOltSyncResult.logs.map((log: string, idx: number) => (
                                  <div key={idx} className="py-1 flex items-start gap-1">
                                    <span className="text-emerald-500 shrink-0 font-bold">✓</span>
                                    <span>{log}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-[9px] text-slate-500 italic text-center bg-white border border-slate-150 p-2 rounded-lg">
                              Semua port ODP sudah sinkron dengan data SmartOLT saat ini.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* GENIEACS PANEL */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-4 shadow-sm shadow-slate-100/40">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Network className="w-4 h-4 text-blue-600" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">GenieACS TR-069</h4>
                      <p className="text-[9px] text-slate-400">Monitoring Modem & CPE Parameter</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="text-slate-500 text-[10px] font-bold uppercase block mb-1">GenieACS Host URL</label>
                      <input
                        type="text"
                        placeholder="http://your-genieacs-ip:7557"
                        value={genieAcsHost}
                        onChange={(e) => setGenieAcsHost(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-500 text-[10px] font-bold uppercase block mb-1">Basic Username</label>
                        <input
                          type="text"
                          placeholder="Optional"
                          value={genieAcsUser}
                          onChange={(e) => setGenieAcsUser(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs text-slate-800 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 text-[10px] font-bold uppercase block mb-1">Basic Password</label>
                        <input
                          type="password"
                          placeholder="Optional"
                          value={genieAcsPass}
                          onChange={(e) => setGenieAcsPass(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs text-slate-800 focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleTestGenieAcs}
                      disabled={genieAcsLoading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-[10px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-blue-100"
                    >
                      {genieAcsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Cek & Ambil Data Perangkat
                    </button>

                    {genieAcsError && (
                      <div className="text-[10px] bg-rose-50 border border-rose-100 text-rose-600 p-2 rounded break-all leading-normal">
                        ⚠️ {genieAcsError}
                      </div>
                    )}

                    {genieAcsResult && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-slate-500">Hasil Respons GenieACS:</span>
                          <span className={`px-1.5 py-0.5 text-[8px] font-extrabold rounded uppercase ${
                            genieAcsResult.isMock ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                          }`}>
                            {genieAcsResult.isMock ? "Simulasi" : "Live API"}
                          </span>
                        </div>

                        {genieAcsResult.devices && Array.isArray(genieAcsResult.devices) ? (
                          <div className="max-h-[140px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg bg-slate-50 p-2 text-[10px]">
                            {genieAcsResult.devices.map((device: any, idx: number) => {
                              const hw = device["InternetGatewayDevice.DeviceInfo.HardwareVersion"]?._value || "Gen-CPE";
                              const sw = device["InternetGatewayDevice.DeviceInfo.SoftwareVersion"]?._value || "V1";
                              const uptime = device["InternetGatewayDevice.DeviceInfo.UpTime"]?._value 
                                ? `${Math.round(Number(device["InternetGatewayDevice.DeviceInfo.UpTime"]._value) / 3600)} jam` 
                                : "N/A";
                              const signal = device["VirtualParameters.SignalStrength"]?._value || "-21.5 dBm";

                              return (
                                <div key={idx} className="py-1.5 text-slate-700">
                                  <div className="flex justify-between items-start">
                                    <span className="font-extrabold text-blue-900 truncate max-w-[170px]">{device._id}</span>
                                    <span className="text-[8px] font-mono text-emerald-600 bg-emerald-50 px-1 rounded font-bold">{signal}</span>
                                  </div>
                                  <div className="flex justify-between text-[8px] text-slate-400 mt-0.5">
                                    <span>HW: {hw} | SW: {sw}</span>
                                    <span>Uptime: {uptime}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <pre className="p-2 bg-slate-50 text-slate-600 rounded border text-[9px] font-mono overflow-x-auto max-h-[120px]">
                            {JSON.stringify(genieAcsResult, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Developer Documentation reference block */}
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-[10px] text-slate-500 leading-normal">
                  💡 <strong>Integrasi Tip:</strong> Endpoint proxy server kami di-desain agar aman tanpa membocorkan API key di sisi client. Anda dapat memicu API endpoint ini dari script eksternal atau webhooks menggunakan router backend di <code>/api/integration/*</code>.
                </div>

              </div>
            )}

            {/* Developer Credit Footer */}
            <div className="pt-4 mt-auto border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium shrink-0">
              <span className="flex items-center gap-1.5 font-semibold text-slate-600">
                <Network className="w-3.5 h-3.5 text-blue-600" />
                <span>ODP Coverage Checker v2.0</span>
              </span>
              <span className="flex items-center gap-1">
                <span>Developed by</span>
                <span className="font-extrabold text-slate-600 bg-slate-100/80 px-1.5 py-0.5 rounded">Rafi Muiz NOC</span>
              </span>
            </div>

           </div>
        </div>

        {/* Right Column (Leaflet Map Viewer) */}
        <div className={`w-full md:flex-1 h-full relative z-0 bg-slate-100 flex-col min-h-0 overflow-hidden ${mobileTab === "sidebar" ? "hidden md:flex" : "flex"}`}>
          
          {/* Actual Leaflet Map container */}
          <div ref={mapContainerRef} className="w-full h-full flex-1" />

          {/* Mobile Scroll Lock Cover Overlay */}
          {!mapInteractionEnabled && (
            <div 
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] z-[1001] flex flex-col items-center justify-center p-4 text-center cursor-pointer select-none animate-fade-in md:hidden"
              onClick={() => setMapInteractionEnabled(true)}
            >
              <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-2xl p-5 shadow-xl max-w-xs space-y-3">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                  <Compass className="w-6 h-6 animate-bounce" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold text-slate-900">📍 Navigasi Peta Dinonaktifkan</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Silakan ketuk untuk mengaktifkan geser, zoom, dan penandaan titik di peta.
                  </p>
                </div>
                <button
                  type="button"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition-colors w-full cursor-pointer shadow-sm shadow-blue-100"
                >
                  Aktifkan Navigasi Peta
                </button>
              </div>
            </div>
          )}

          {/* Mobile Lock State Floating Switch */}
          {mapInteractionEnabled && (
            <button
              onClick={() => setMapInteractionEnabled(false)}
              className="absolute top-4 left-4 z-[1000] bg-rose-600 hover:bg-rose-700 text-white border border-rose-700 px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1 text-xs font-bold transition-all cursor-pointer md:hidden"
            >
              <X className="w-3.5 h-3.5" />
              Kunci Geser Peta (Mudah Scroll Halaman)
            </button>
          )}

          {/* Floating Basemap Selector Controls */}
          <div className="absolute top-4 right-4 z-[1000] bg-white/95 backdrop-blur border border-slate-200 p-1.5 rounded-xl shadow-md flex flex-col gap-1">
            <button
              onClick={() => setBasemap("street")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                basemap === "street" 
                  ? "bg-blue-600 text-white shadow-sm font-extrabold" 
                  : "text-slate-700 hover:bg-slate-100 bg-transparent"
              }`}
              title="Google Maps Standard"
            >
              <Globe className="w-3.5 h-3.5" />
              Google Maps
            </button>
            <button
              onClick={() => setBasemap("satellite")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                basemap === "satellite" 
                  ? "bg-blue-600 text-white shadow-sm font-extrabold" 
                  : "text-slate-700 hover:bg-slate-100 bg-transparent"
              }`}
              title="Google Maps Satelit (Hybrid)"
            >
              <Layers className="w-3.5 h-3.5" />
              Google Satelit
            </button>
            <button
              onClick={() => setBasemap("terrain")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                basemap === "terrain" 
                  ? "bg-blue-600 text-white shadow-sm font-extrabold" 
                  : "text-slate-700 hover:bg-slate-100 bg-transparent"
              }`}
              title="Google Maps Medan (Topografi)"
            >
              <MapPin className="w-3.5 h-3.5" />
              Google Medan
            </button>
          </div>

          {/* Bottom Floating Stats Panel */}
          {measurementMode === "manual" ? (
            <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-white/95 backdrop-blur border border-purple-200 p-4 rounded-xl shadow-md flex items-center justify-between gap-4 text-xs animate-fade-in">
              <div className="flex items-center gap-2.5">
                <div className={`w-3 h-3 rounded-full ${
                  manualPoints.length < 2
                    ? "bg-slate-400"
                    : getManualDistance() <= 300
                    ? "bg-purple-500 animate-pulse"
                    : "bg-rose-500 animate-pulse"
                }`}></div>
                <div>
                  <span className="text-purple-600 text-[10px] block font-bold uppercase">📊 PENGUKURAN RUTE MANUAL ({manualPoints.length} Titik)</span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {getManualDistance()} meter <span className="text-[10px] font-semibold text-slate-500">({manualPoints.length < 2 ? "Menunggu titik tambahan" : "Total dropcore"})</span>
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-slate-500 text-[10px] block font-bold uppercase">STATUS LAYANAN</span>
                <span className={`font-extrabold text-sm ${
                  manualPoints.length < 2
                    ? "text-slate-500"
                    : getManualDistance() <= 300 
                    ? "text-purple-600" 
                    : "text-rose-600 font-extrabold"
                }`}>
                  {manualPoints.length < 2
                    ? "Silakan Klik Peta"
                    : getManualDistance() <= 300 
                    ? "TERCOVER" 
                    : "BELUM TERCOVER (>300m)"}
                </span>
              </div>
            </div>
          ) : (
            coverage && coverage.nearestOdp && !checking && (
              <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-white/95 backdrop-blur border border-slate-200 p-4 rounded-xl shadow-md flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className={`w-3 h-3 rounded-full ${
                    coverage.status === "TERCOVER" ? "bg-emerald-500" : "bg-rose-500"
                  }`}></div>
                  <div>
                    <span className="text-slate-500 text-[10px] block font-bold uppercase">JARAK KE ODP TERDEKAT ({coverage.nearestOdp.name})</span>
                    <span className="font-extrabold text-slate-900 text-sm block">
                      {coverage.distance} meter <span className="text-[10px] font-semibold text-slate-500">({coverage.isRoadRoute ? "🚶 Rute Aktual" : "📏 Garis Lurus"})</span>
                    </span>
                    <span className="text-[10px] font-bold text-slate-600 block mt-0.5">
                      Usage Port: {coverage.nearestOdp.totalPorts - coverage.nearestOdp.availablePorts} Terpakai / {coverage.nearestOdp.availablePorts} Sisa ({coverage.nearestOdp.totalPorts} Port)
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 text-[10px] block font-bold uppercase">STATUS</span>
                  <span className={`font-extrabold text-sm ${
                    coverage.status === "TERCOVER" 
                      ? "text-emerald-600" 
                      : coverage.status === "PORT PENUH / WAITING LIST" 
                      ? "text-amber-600" 
                      : "text-rose-600"
                  }`}>
                    {coverage.status}
                  </span>
                </div>
              </div>
            )
          )}

        </div>

      </div>

      {/* NOC Password Authentication Modal */}
      <AnimatePresence>
        {showNocAuthModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white relative">
                <button
                  type="button"
                  onClick={() => setShowNocAuthModal(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
                
                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center mb-3 text-emerald-400">
                  <Lock className="w-6 h-6" />
                </div>
                
                <h2 className="text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
                  Akses Terbatas NOC
                </h2>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Silakan masukkan Password NOC untuk mengelola Database ODP, Integrasi SmartOLT/GenieACS, dan Reset DB.
                </p>
              </div>

              {/* Form Body */}
              <form onSubmit={handleNocLogin} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    Password NOC
                  </label>
                  <div className="relative">
                    <input
                      type={showNocPasswordText ? "text" : "password"}
                      value={nocInputPassword}
                      onChange={(e) => setNocInputPassword(e.target.value)}
                      placeholder="Masukkan password NOC..."
                      autoFocus
                      className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 pr-10 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNocPasswordText(!showNocPasswordText)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                      {showNocPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {nocAuthError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{nocAuthError}</span>
                  </div>
                )}

                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-[11px] text-slate-500 space-y-1">
                  <div className="font-semibold text-slate-700 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Sinkronisasi Keamanan Multi-Perangkat</span>
                  </div>
                  <p className="text-[10px] leading-relaxed">
                    Password NOC divalidasi terpusat di server. Jika password diubah melalui HP 1, HP 2 dan perangkat lain otomatis mengikuti password baru.
                  </p>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNocAuthModal(false)}
                    className="flex-1 py-2.5 px-4 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={nocLoginLoading}
                    className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-xl transition-colors shadow-md shadow-indigo-200 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {nocLoginLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Memeriksa...</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-4 h-4" />
                        <span>Masuk NOC</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* NOC Panel Modal */}
      <AnimatePresence>
        {showNocPanelModal && isNocAuthenticated && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-md animate-fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] max-h-[850px] flex flex-col overflow-hidden border border-slate-200"
            >
              {/* Modal Header */}
              <div className="bg-slate-900 text-white p-4 sm:px-6 sm:py-4 flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-inner">
                    <Shield className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-extrabold tracking-tight text-white">
                        Panel Administrasi NOC
                      </h2>
                      <span className="text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        NOC Verified
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Kelola Database ODP • Integrasi SmartOLT/GenieACS • Developed by Rafi Muiz NOC
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleNocLogout}
                    className="text-xs bg-slate-800 hover:bg-rose-900/60 hover:text-rose-200 text-slate-300 px-3 py-1.5 rounded-lg transition-colors border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5 text-rose-400" />
                    <span>Keluar / Kunci</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNocPanelModal(false)}
                    className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Navigation Tabs inside NOC Panel */}
              <div className="bg-slate-100/80 border-b border-slate-200 px-4 pt-2 flex gap-1 shrink-0 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setNocActiveTab("database")}
                  className={`flex items-center gap-2 text-xs font-bold py-2.5 px-4 rounded-t-xl transition-all cursor-pointer ${
                    nocActiveTab === "database"
                      ? "bg-white text-blue-700 border-t-2 border-blue-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                  }`}
                >
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>Database ODP ({odps.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNocActiveTab("integrasi")}
                  className={`flex items-center gap-2 text-xs font-bold py-2.5 px-4 rounded-t-xl transition-all cursor-pointer ${
                    nocActiveTab === "integrasi"
                      ? "bg-white text-indigo-700 border-t-2 border-indigo-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                  }`}
                >
                  <Server className="w-4 h-4 text-indigo-600" />
                  <span>Integrasi ISP (SmartOLT & GenieACS)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNocActiveTab("settings")}
                  className={`flex items-center gap-2 text-xs font-bold py-2.5 px-4 rounded-t-xl transition-all cursor-pointer ${
                    nocActiveTab === "settings"
                      ? "bg-white text-slate-800 border-t-2 border-slate-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                  }`}
                >
                  <Settings className="w-4 h-4 text-slate-600" />
                  <span>Pengaturan & Reset DB</span>
                </button>
              </div>

              {/* NOC Panel Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 space-y-6">
                
                {nocActiveTab === "database" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between bg-blue-50/60 border border-blue-100 p-3 rounded-xl text-xs text-blue-800">
                      <span>Kelola data ODP, tambah titik baru, impor KMZ/KML, atau ekspor data ODP.</span>
                      <button
                        type="button"
                        onClick={() => setShowNocPanelModal(false)}
                        className="text-blue-700 hover:underline font-bold text-[11px] shrink-0"
                      >
                        Lihat di Peta Utama →
                      </button>
                    </div>

                    {/* KMZ / KML Import Section */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3 shrink-0 shadow-sm">
                      <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                        <UploadCloud className="w-4 h-4 text-blue-600" />
                        Impor ODP dari Google Earth (.KMZ / .KML)
                      </h3>

                      <p className="text-[10px] text-slate-500 leading-normal">
                        Unggah file KMZ hasil export peta ODP Anda dari Google Earth. Sistem akan otomatis mengekstrak koordinat dan nama titik secara offline di browser.
                      </p>

                      <div className="relative border-2 border-dashed border-slate-200 hover:border-blue-400 bg-white rounded-xl p-4 transition-colors flex flex-col items-center justify-center text-center cursor-pointer">
                        <input
                          type="file"
                          accept=".kmz,.kml"
                          onChange={handleKmzUpload}
                          disabled={kmzImporting}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <UploadCloud className={`w-8 h-8 ${kmzImporting ? "text-blue-500 animate-bounce" : "text-slate-400"}`} />
                        <span className="text-[11px] font-bold text-slate-700 mt-2 block">
                          {kmzImporting ? "Memproses File..." : "Pilih File KMZ atau KML"}
                        </span>
                        <span className="text-[9px] text-slate-400 mt-0.5 block">
                          Drag & drop atau klik untuk jelajah file
                        </span>
                      </div>

                      {importMessage && (
                        <div className={`text-[11px] p-2.5 rounded-lg border leading-relaxed flex flex-wrap items-center justify-between gap-2 ${
                          importMessage.type === "success" 
                            ? "bg-emerald-50 border-emerald-150 text-emerald-800" 
                            : "bg-rose-50 border-rose-150 text-rose-800"
                        }`}>
                          <span className="flex-1">{importMessage.text}</span>
                          {importMessage.type === "success" && (
                            <button
                              type="button"
                              onClick={() => setShowNocPanelModal(false)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded text-[10px] shrink-0 cursor-pointer shadow-xs"
                            >
                              Lihat di Peta Utama →
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Form Tambah / Edit ODP Baru */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3 shrink-0">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          {editingOdp ? <Edit2 className="w-4 h-4 text-amber-600" /> : <Plus className="w-4 h-4 text-emerald-600" />}
                          {editingOdp ? `Edit ODP (${editingOdp.name})` : "Tambah ODP Baru"}
                        </h3>
                        {editingOdp && (
                          <button
                            onClick={handleCancelEdit}
                            className="text-[10px] text-slate-500 hover:text-slate-800 underline flex items-center gap-1 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                            Batal Edit
                          </button>
                        )}
                      </div>

                      {formError && (
                        <div className="text-[11px] bg-rose-50 border border-rose-150 text-rose-800 p-2.5 rounded-lg flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                          <span>{formError}</span>
                        </div>
                      )}

                      {formSuccess && (
                        <div className="text-[11px] bg-emerald-50 border border-emerald-150 text-emerald-800 p-2.5 rounded-lg flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                            <span>{formSuccess}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowNocPanelModal(false)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded text-[10px] shrink-0 cursor-pointer shadow-xs"
                          >
                            Lihat di Peta Utama →
                          </button>
                        </div>
                      )}

                      <form onSubmit={handleAddOdp} className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 uppercase">Nama / ID ODP</label>
                          <input
                            type="text"
                            value={newOdpName}
                            onChange={(e) => setNewOdpName(e.target.value)}
                            placeholder="Contoh: ODP-JKT-MNT-007"
                            className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-600 uppercase">Latitude</label>
                            <input
                              type="text"
                              value={newOdpLat}
                              onChange={(e) => setNewOdpLat(e.target.value)}
                              placeholder="-6.1823"
                              className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 outline-none bg-white font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-600 uppercase">Longitude</label>
                            <input
                              type="text"
                              value={newOdpLng}
                              onChange={(e) => setNewOdpLng(e.target.value)}
                              placeholder="106.8321"
                              className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 outline-none bg-white font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-600 uppercase">Total Kapasitas Port</label>
                            <select
                              value={newOdpTotalPorts}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setNewOdpTotalPorts(val);
                                if (newOdpAvailablePorts > val) {
                                  setNewOdpAvailablePorts(val);
                                }
                              }}
                              className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 outline-none bg-white cursor-pointer"
                            >
                              <option value={4}>4 Port</option>
                              <option value={8}>8 Port</option>
                              <option value={16}>16 Port</option>
                              <option value={24}>24 Port</option>
                              <option value={32}>32 Port</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-600 uppercase">Port Tersedia (Sisa)</label>
                            <input
                              type="number"
                              min={0}
                              max={newOdpTotalPorts}
                              value={newOdpAvailablePorts}
                              onChange={(e) => setNewOdpAvailablePorts(parseInt(e.target.value) || 0)}
                              className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 outline-none bg-white font-mono"
                            />
                          </div>
                        </div>

                        <div className="pt-1 flex gap-2">
                          {editingOdp ? (
                            <>
                              <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                Simpan Perubahan
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-3 rounded-lg text-xs transition-colors cursor-pointer"
                              >
                                Batal
                              </button>
                            </>
                          ) : (
                            <button
                              type="submit"
                              disabled={loading}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Simpan ODP Baru
                            </button>
                          )}
                        </div>
                      </form>
                    </div>

                    {/* Database ODP List Table */}
                    <div className="space-y-3 flex-1 flex flex-col min-h-0">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 shrink-0">
                        <div>
                          <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-blue-600" />
                            Daftar ODP Terdaftar ({filteredOdps.length})
                          </h3>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleExportJson}
                            className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Export JSON
                          </button>

                          {selectedOdpIds.length > 0 && (
                            <button
                              onClick={handleDeleteSelectedOdps}
                              disabled={loading}
                              className="text-[10px] font-bold bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-sm"
                            >
                              <Trash2 className="w-3 h-3" />
                              Hapus ({selectedOdpIds.length})
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Filter Search */}
                      <div className="relative shrink-0">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={filterQuery}
                          onChange={(e) => setFilterQuery(e.target.value)}
                          placeholder="Cari ODP..."
                          className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg bg-white outline-none"
                        />
                      </div>

                      {/* Items */}
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {filteredOdps.map((odp) => (
                          <div key={odp.id} className="p-3 bg-white border border-slate-200 rounded-xl text-xs flex items-center justify-between gap-3">
                            <div>
                              <div className="font-extrabold text-slate-800">{odp.name}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{odp.lat.toFixed(6)}, {odp.lng.toFixed(6)}</div>
                              <div className="text-[10px] text-emerald-600 font-bold">Sisa: {odp.availablePorts} / {odp.totalPorts} Port</div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setMapCenter({ lat: odp.lat, lng: odp.lng });
                                  setMapZoom(17);
                                  setShowNocPanelModal(false);
                                  setActiveTab("check");
                                }}
                                className="text-[10px] bg-blue-50 text-blue-600 font-bold px-2 py-1 rounded cursor-pointer hover:bg-blue-100"
                              >
                                Peta
                              </button>
                              <button onClick={() => handleStartEdit(odp)} className="p-1 hover:bg-amber-50 text-amber-600 rounded cursor-pointer">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDeleteOdp(odp.id, odp.name)} className="p-1 hover:bg-rose-50 text-rose-600 rounded cursor-pointer" title="Hapus ODP">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {nocActiveTab === "integrasi" && (
                  <div className="space-y-6">
                    {/* SMARTOLT PANEL */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-4 shadow-sm">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                        <Cpu className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-bold text-slate-800">SmartOLT Integration</h4>
                      </div>
                      <div className="space-y-3 text-xs">
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 uppercase block">Domain SmartOLT</label>
                          <input
                            type="text"
                            value={smartOltDomain}
                            onChange={(e) => setSmartOltDomain(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg p-2 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 uppercase block">API Token SmartOLT</label>
                          <input
                            type="password"
                            value={smartOltKey}
                            onChange={(e) => setSmartOltKey(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg p-2 font-mono"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={handleSaveSettings} className="bg-slate-800 text-white font-bold py-1.5 px-3 rounded-lg text-xs cursor-pointer">
                            Simpan
                          </button>
                          <button onClick={() => handleTestSmartOlt("get_olts")} disabled={smartOltLoading} className="bg-blue-600 text-white font-bold py-1.5 px-3 rounded-lg text-xs cursor-pointer flex items-center gap-1">
                            {smartOltLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                            Tes Koneksi
                          </button>
                          <button onClick={handleSyncSmartOltPorts} disabled={smartOltSyncLoading} className="bg-emerald-600 text-white font-bold py-1.5 px-3 rounded-lg text-xs cursor-pointer flex items-center gap-1">
                            {smartOltSyncLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
                            Sync ODB
                          </button>
                        </div>
                        {smartOltSyncResult && (
                          <div className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 p-2 rounded-lg font-bold">
                            ✅ Sync ODB Selesai! {smartOltSyncResult.syncCount || 0} ODP terupdate.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* GENIEACS PANEL */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-4 shadow-sm">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                        <Globe className="w-4 h-4 text-purple-600" />
                        <h4 className="text-xs font-bold text-slate-800">GenieACS TR-069 Server</h4>
                      </div>
                      <div className="space-y-3 text-xs">
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 uppercase block">Host / URL NBI GenieACS</label>
                          <input
                            type="text"
                            value={genieAcsHost}
                            onChange={(e) => setGenieAcsHost(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg p-2 font-mono"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={handleSaveSettings} className="bg-slate-800 text-white font-bold py-1.5 px-3 rounded-lg text-xs cursor-pointer">
                            Simpan
                          </button>
                          <button onClick={handleTestGenieAcs} disabled={genieAcsLoading} className="bg-purple-600 text-white font-bold py-1.5 px-3 rounded-lg text-xs cursor-pointer flex items-center gap-1">
                            {genieAcsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                            Cek Perangkat
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {nocActiveTab === "settings" && (
                  <div className="space-y-6 max-w-2xl mx-auto py-2">
                    
                    {/* Reset Database Card */}
                    <div className="bg-white border border-rose-200 rounded-2xl p-5 shadow-sm space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                          <RotateCcw className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-800">Reset Database ODP ke Default</h3>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                            Mengembalikan seluruh data ODP ke data setelan awal (Mental/Jakarta). Semua penambahan ODP baru, modifikasi, dan impor KMZ akan dikembalikan.
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">Total ODP saat ini: <strong>{odps.length} ODP</strong></span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowNocPanelModal(false);
                            handleResetDb();
                          }}
                          disabled={loading}
                          className="flex items-center gap-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Reset Database Sekarang</span>
                        </button>
                      </div>
                    </div>

                    {/* Change NOC Password Card */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                      <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                          <Key className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-800">Ubah Password Menu NOC (Semua Perangkat)</h3>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                            Perbarui password akses NOC. Password akan langsung disimpan di database server dan disinkronkan ke semua perangkat (HP 1, HP 2, Laptop, dll).
                          </p>
                        </div>
                      </div>

                      <form onSubmit={handleChangeNocPassword} className="space-y-4 pt-1">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 block">Password NOC Baru</label>
                          <input
                            type="password"
                            value={newNocPasswordInput}
                            onChange={(e) => setNewNocPasswordInput(e.target.value)}
                            placeholder="Masukkan password baru (minimal 4 karakter)..."
                            className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          />
                          <span className="text-[10px] text-slate-400 block">
                            Setelah disimpan, login dari perangkat mana pun wajib menggunakan password baru ini. Password default "noc123" akan otomatis tidak berlaku.
                          </span>
                        </div>

                        {nocPassSuccessMsg && (
                          <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                            nocPassSuccessMsg.includes("berhasil")
                              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                              : "bg-rose-50 border border-rose-200 text-rose-800"
                          }`}>
                            <CheckCircle className="w-4 h-4 shrink-0" />
                            <span>{nocPassSuccessMsg}</span>
                          </div>
                        )}

                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={nocChangingPassword}
                            className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                          >
                            {nocChangingPassword ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Menyimpan ke Server...</span>
                              </>
                            ) : (
                              <span>Simpan Password Baru</span>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Developer Credit Info */}
                    <div className="p-4 bg-slate-100/70 border border-slate-200 rounded-2xl text-[11px] text-slate-500 flex items-center justify-between">
                      <span>ODP Coverage Checker Admin Engine</span>
                      <span className="font-bold text-slate-700">Developed by Rafi Muiz NOC</span>
                    </div>

                  </div>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Book Modal */}
      <ManualBookModal 
        isOpen={showManualBookModal} 
        onClose={() => setShowManualBookModal(false)} 
      />

      {/* ODP Customer & Port Management Modal */}
      {customerModalOdp && (
        <OdpCustomerModal
          odp={customerModalOdp}
          isOpen={!!customerModalOdp}
          onClose={() => setCustomerModalOdp(null)}
          onOdpUpdated={handleOdpCustomerUpdated}
        />
      )}

      {/* Custom Confirmation Modal (bypasses iframe native confirm block) */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-150 space-y-4 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-full shrink-0 ${confirmModal.isDestructive ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"}`}>
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">{confirmModal.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{confirmModal.message}</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg text-xs transition-all cursor-pointer border border-slate-200/40"
              >
                {confirmModal.cancelText || "Batal"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmModal.onConfirm) {
                    confirmModal.onConfirm();
                  }
                }}
                className={`font-bold py-2 px-4 rounded-lg text-xs transition-all cursor-pointer text-white ${
                  confirmModal.isDestructive 
                    ? "bg-rose-600 hover:bg-rose-700 shadow-sm shadow-rose-100" 
                    : "bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-100"
                }`}
              >
                {confirmModal.confirmText || "Konfirmasi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
