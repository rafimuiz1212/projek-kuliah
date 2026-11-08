import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

// Allow self-signed or internal HTTPS certificates when proxying to custom domains or OLT/GenieACS servers
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DB_FILE = path.join(process.cwd(), "odp_db.json");
const SETTINGS_FILE = path.join(process.cwd(), "settings_db.json");

// Enable CORS for all incoming domains and public IP access
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Token");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Serve static assets from public directory (favicons, logos, icons)
app.use(express.static(path.join(process.cwd(), "public")));

interface Settings {
  smartOltDomain: string;
  smartOltKey: string;
  genieAcsHost: string;
  genieAcsUser: string;
  genieAcsPass: string;
  nocPassword?: string;
}

function loadSettings(): Settings {
  const defaults: Settings = {
    smartOltDomain: "example.smartolt.com",
    smartOltKey: "",
    genieAcsHost: "http://localhost:7557",
    genieAcsUser: "",
    genieAcsPass: "",
    nocPassword: "noc123"
  };
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, "utf-8");
      return { ...defaults, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error("Error loading settings, using defaults:", error);
  }
  return defaults;
}

function saveSettings(settings: Partial<Settings>) {
  try {
    const current = loadSettings();
    const updated = { ...current, ...settings };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), "utf-8");
  } catch (error) {
    console.error("Error saving settings:", error);
  }
}

// Helper to normalize strings for robust fuzzy-like ODP/ONU matching
const normalizeString = (str: string): string => {
  return (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
};

// Hyper-precise contiguous subsequence matcher to avoid false positives (e.g., matching ODP-MNT-011 for ODP-MNT-01)
function isOdpMatched(onuStr: string, odpName: string): boolean {
  if (!onuStr || !odpName) return false;
  
  // Extract base name before any slashes (e.g. ODP-MNT-01/08 -> ODP-MNT-01)
  const baseName = odpName.split("/")[0].trim();
  
  const getWords = (s: string) => {
    return s.toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean);
  };

  const oWords = getWords(baseName);
  const uWords = getWords(onuStr);

  if (oWords.length === 0 || uWords.length === 0) return false;

  for (let i = 0; i <= uWords.length - oWords.length; i++) {
    let match = true;
    for (let j = 0; j < oWords.length; j++) {
      const wO = oWords[j];
      const wU = uWords[i + j];
      
      if (wO === wU) {
        continue;
      }
      
      const isONum = /^\d+$/.test(wO);
      const isUNum = /^\d+$/.test(wU);
      if (isONum && isUNum && parseInt(wO, 10) === parseInt(wU, 10)) {
        continue;
      }
      
      match = false;
      break;
    }
    if (match) return true;
  }
  
  return false;
}

// Helper to accurately extract the explicit ODB splitter port number from SmartOLT
function getExplicitSmartOltPort(onu: any, totalPorts: number = 16): number | null {
  if (!onu) return null;

  // 1. Direct port on ODB / splitter fields (SmartOLT standard fields)
  const directFields = [
    onu.odb_port,
    onu.odb_port_number,
    onu.port_in_odb,
    onu.splitter_port,
    onu.port_in_splitter,
    onu.splitter_port_number,
    onu.odb_slot,
    onu.port_number,
    onu.odb_port_id
  ];

  for (const f of directFields) {
    if (f !== undefined && f !== null && f !== "") {
      const cleanStr = String(f).trim();
      const num = parseInt(cleanStr.replace(/[^0-9]/g, ""), 10);
      if (!isNaN(num) && num >= 1 && num <= totalPorts * 2) {
        return num;
      }
    }
  }

  // 2. Direct onu.port (if not an OLT slot/pon string like "1/1/1" or "0/1" or "1/1")
  if (onu.port !== undefined && onu.port !== null && onu.port !== "") {
    const s = String(onu.port).trim();
    if (!s.includes("/") && !s.includes(":") && !s.includes("-") && !s.includes(".")) {
      const num = parseInt(s, 10);
      if (!isNaN(num) && num >= 1 && num <= totalPorts * 2) {
        return num;
      }
    }
  }

  // 3. Extract port pattern from ONU name, comments, description, or zone
  const text = `${onu.name || ""} ${onu.comment || ""} ${onu.comments || ""} ${onu.description || ""} ${onu.zone || ""} ${onu.zone_name || ""}`;

  // Check explicit P1, P02, Port 3, Port_4, Port-5, Port:5
  const portMatch = text.match(/(?:^|[\s_/:.([-])p(?:ort)?[\s_.:-]*0*(\d+)(?:[\s_/:.)\]-]|$)/i);
  if (portMatch && portMatch[1]) {
    const num = parseInt(portMatch[1], 10);
    if (!isNaN(num) && num >= 1 && num <= totalPorts * 2) return num;
  }

  // Check bracket pattern [1], (1), [P1], (P1)
  const bracketMatch = text.match(/[[{(](?:p|port)?\s*0*(\d+)[\]})]/i);
  if (bracketMatch && bracketMatch[1]) {
    const num = parseInt(bracketMatch[1], 10);
    if (!isNaN(num) && num >= 1 && num <= totalPorts * 2) return num;
  }

  // Check trailing /1 or :1 or -1 or _1 (e.g. ODP-MNT-01/3 or ODP-01:4 or ODP-MNT-01-05)
  const trailingSlash = text.match(/[/:_-]0*(\d+)(?:[\s_]|$)/i);
  if (trailingSlash && trailingSlash[1]) {
    const num = parseInt(trailingSlash[1], 10);
    if (!isNaN(num) && num >= 1 && num <= totalPorts) return num;
  }

  // Check User1, User 1, Pelanggan 3, Pelanggan3, Cust 1
  const userMatch = text.match(/(?:user|pelanggan|client|cust)[\s_.-]*0*(\d+)/i);
  if (userMatch && userMatch[1]) {
    const num = parseInt(userMatch[1], 10);
    if (!isNaN(num) && num >= 1 && num <= totalPorts * 2) return num;
  }

  // Check letter code Pelanggan_A, Pelanggan_B (A=1, B=2, etc.)
  const letterMatch = text.match(/(?:user|pelanggan|client|klien)[\s_.-]+([a-pA-P])(?:[\s_.-]|$)/i);
  if (letterMatch && letterMatch[1]) {
    const letterCode = letterMatch[1].toUpperCase().charCodeAt(0) - 64;
    if (letterCode >= 1 && letterCode <= totalPorts) return letterCode;
  }

  return null;
}

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

export type CustomerStatus = "online" | "offline" | "los" | "dyinggasp";

export interface OdpCustomer {
  id: string;
  port: number;
  name: string;
  status: CustomerStatus;
  onuSn?: string;
  onuModel?: string;
  signal?: string;
  ipAddress?: string;
  package?: string;
  address?: string;
  pluggedAt?: string;
}

interface ODP {
  id: string;
  name: string;
  lat: number;
  lng: number;
  totalPorts: number;
  availablePorts: number;
  smartOltId?: string;
  customers?: OdpCustomer[];
}

// Default ODP data in Jakarta, Indonesia with realistic customers plugged into ports
const DEFAULT_ODPS: ODP[] = [
  {
    id: "odp-1",
    name: "ODP-MNT-01/08",
    lat: -6.184200,
    lng: 106.822800,
    totalPorts: 8,
    availablePorts: 3,
    customers: [
      { id: "c1-1", port: 1, name: "Bpk. Hendra Wijaya", status: "online", onuSn: "ZTEG11223344", onuModel: "ZTE F609 V5", address: "Jl. Menteng No. 12" },
      { id: "c1-2", port: 2, name: "Ibu Ratna Kumala", status: "online", onuSn: "ZTEG11223345", onuModel: "ZTE F670L", address: "Jl. Menteng No. 14" },
      { id: "c1-3", port: 3, name: "Bpk. Bambang Sutrisno", status: "dyinggasp", onuSn: "ZTEG11223346", onuModel: "Huawei HG8245H", address: "Jl. Menteng No. 16B" },
      { id: "c1-4", port: 4, name: "Klinik Pratama Sehat", status: "los", onuSn: "ZTEG11223347", onuModel: "Fiberhome HG6243C", address: "Jl. Menteng No. 20" },
      { id: "c1-5", port: 6, name: "Bpk. Dedi Irawan", status: "offline", onuSn: "ZTEG11223349", onuModel: "ZTE F609", address: "Jl. Menteng No. 22" }
    ]
  },
  {
    id: "odp-2",
    name: "ODP-MNT-02/16",
    lat: -6.185500,
    lng: 106.824200,
    totalPorts: 16,
    availablePorts: 0,
    customers: [
      { id: "c2-1", port: 1, name: "Toko Berkah Menteng", status: "online", onuSn: "ZTEG22000001", onuModel: "ZTE F609", signal: "-21.4 dBm", package: "50 Mbps" },
      { id: "c2-2", port: 2, name: "Bpk. Agus Santoso", status: "online", onuSn: "ZTEG22000002", onuModel: "ZTE F609", signal: "-22.0 dBm", package: "30 Mbps" },
      { id: "c2-3", port: 3, name: "Ibu Dewi Lestari", status: "online", onuSn: "ZTEG22000003", onuModel: "Huawei HG8245", signal: "-19.5 dBm", package: "30 Mbps" },
      { id: "c2-4", port: 4, name: "Warkop Sedap Malam", status: "online", onuSn: "ZTEG22000004", onuModel: "ZTE F670L", signal: "-20.8 dBm", package: "100 Mbps" },
      { id: "c2-5", port: 5, name: "Bpk. Rahmat Hidayat", status: "dyinggasp", onuSn: "ZTEG22000005", onuModel: "ZTE F609", signal: "Dying Gasp (PLN Padam)", package: "30 Mbps" },
      { id: "c2-6", port: 6, name: "Kos Menteng Asri", status: "offline", onuSn: "ZTEG22000006", onuModel: "Huawei HG8245H", signal: "LOS (-32 dBm)", package: "50 Mbps" },
      { id: "c2-7", port: 7, name: "Apotek Sehat Keluarga", status: "online", onuSn: "ZTEG22000007", onuModel: "ZTE F609", signal: "-21.1 dBm", package: "50 Mbps" },
      { id: "c2-8", port: 8, name: "Bpk. Tono Sudirgo", status: "online", onuSn: "ZTEG22000008", onuModel: "ZTE F609", signal: "-22.5 dBm", package: "30 Mbps" },
      { id: "c2-9", port: 9, name: "Ibu Maya Angelina", status: "online", onuSn: "ZTEG22000009", onuModel: "Fiberhome", signal: "-23.0 dBm", package: "30 Mbps" },
      { id: "c2-10", port: 10, name: "Rumah Makan Padang", status: "online", onuSn: "ZTEG22000010", onuModel: "ZTE F670L", signal: "-20.4 dBm", package: "50 Mbps" },
      { id: "c2-11", port: 11, name: "Bpk. Eko Prasetyo", status: "dyinggasp", onuSn: "ZTEG22000011", onuModel: "Huawei HG8245", signal: "Dying Gasp (Power Down)", package: "30 Mbps" },
      { id: "c2-12", port: 12, name: "Ibu Rini Astuti", status: "online", onuSn: "ZTEG22000012", onuModel: "ZTE F609", signal: "-19.9 dBm", package: "50 Mbps" },
      { id: "c2-13", port: 13, name: "Bpk. Dedi Suryadi", status: "online", onuSn: "ZTEG22000013", onuModel: "ZTE F609", signal: "-20.7 dBm", package: "30 Mbps" },
      { id: "c2-14", port: 14, name: "Percetakan Prima Offset", status: "online", onuSn: "ZTEG22000014", onuModel: "Huawei HG8245H", signal: "-21.9 dBm", package: "100 Mbps" },
      { id: "c2-15", port: 15, name: "Laundry Kilat Express", status: "online", onuSn: "ZTEG22000015", onuModel: "ZTE F609", signal: "-22.3 dBm", package: "30 Mbps" },
      { id: "c2-16", port: 16, name: "Bpk. Farhan Hakim", status: "offline", onuSn: "ZTEG22000016", onuModel: "ZTE F609", signal: "LOS", package: "50 Mbps" }
    ]
  },
  {
    id: "odp-3",
    name: "ODP-MNT-03/08",
    lat: -6.186800,
    lng: 106.821500,
    totalPorts: 8,
    availablePorts: 2,
    customers: [
      { id: "c3-1", port: 1, name: "Pelanggan Alpha (A)", status: "online", onuSn: "ZTEG33000001", onuModel: "ZTE F609", signal: "-20.5 dBm", package: "50 Mbps" },
      { id: "c3-2", port: 2, name: "Pelanggan Beta (B)", status: "online", onuSn: "ZTEG33000002", onuModel: "ZTE F609", signal: "-21.2 dBm", package: "30 Mbps" },
      { id: "c3-3", port: 3, name: "Pelanggan Gamma (C)", status: "online", onuSn: "ZTEG33000003", onuModel: "Huawei HG8245", signal: "-19.8 dBm", package: "50 Mbps" },
      { id: "c3-4", port: 4, name: "Pelanggan Delta (D)", status: "offline", onuSn: "ZTEG33000004", onuModel: "ZTE F609", signal: "LOS (Modem Mati)", package: "30 Mbps" },
      { id: "c3-5", port: 5, name: "Pelanggan Epsilon (E)", status: "dyinggasp", onuSn: "ZTEG33000005", onuModel: "ZTE F670L", signal: "Dying Gasp", package: "100 Mbps" },
      { id: "c3-6", port: 6, name: "Pelanggan Zeta (F)", status: "online", onuSn: "ZTEG33000006", onuModel: "Huawei HG8245H", signal: "-23.4 dBm", package: "50 Mbps" }
    ]
  },
  {
    id: "odp-4",
    name: "ODP-MNT-04/08",
    lat: -6.182500,
    lng: 106.825000,
    totalPorts: 8,
    availablePorts: 1,
    customers: [
      { id: "c4-1", port: 1, name: "Bpk. Suryo Subroto", status: "online", onuSn: "HWTC44000001", onuModel: "Huawei HG8245H", signal: "-21.3 dBm", package: "30 Mbps" },
      { id: "c4-2", port: 2, name: "Ibu Kartika Sari", status: "online", onuSn: "HWTC44000002", onuModel: "Huawei HG8245H", signal: "-22.2 dBm", package: "50 Mbps" },
      { id: "c4-3", port: 3, name: "Studio Musik Nada", status: "online", onuSn: "HWTC44000003", onuModel: "ZTE F670L", signal: "-19.7 dBm", package: "100 Mbps" },
      { id: "c4-4", port: 4, name: "Bpk. Aris Munandar", status: "dyinggasp", onuSn: "HWTC44000004", onuModel: "Huawei HG8245H", signal: "Dying Gasp", package: "30 Mbps" },
      { id: "c4-5", port: 5, name: "Ibu Lilis Suryani", status: "online", onuSn: "HWTC44000005", onuModel: "ZTE F609", signal: "-20.1 dBm", package: "30 Mbps" },
      { id: "c4-6", port: 6, name: "Warung Kopi Menteng", status: "online", onuSn: "HWTC44000006", onuModel: "ZTE F609", signal: "-21.5 dBm", package: "50 Mbps" },
      { id: "c4-7", port: 7, name: "Bpk. Rudi Hermawan", status: "offline", onuSn: "HWTC44000007", onuModel: "Huawei HG8245", signal: "LOS", package: "30 Mbps" }
    ]
  },
  {
    id: "odp-5",
    name: "ODP-MNT-05/16",
    lat: -6.181200,
    lng: 106.820200,
    totalPorts: 16,
    availablePorts: 6,
    customers: [
      { id: "c5-1", port: 1, name: "Ibu Indah Permatasari", status: "online", onuSn: "HWTC55000001", onuModel: "Huawei HG8245H", signal: "-20.0 dBm", package: "50 Mbps" },
      { id: "c5-2", port: 2, name: "Ibu Sari Widuri", status: "online", onuSn: "HWTC55000002", onuModel: "Huawei HG8245H", signal: "-19.1 dBm", package: "30 Mbps" },
      { id: "c5-3", port: 3, name: "Bpk. Joko Anwar", status: "dyinggasp", onuSn: "HWTC55000003", onuModel: "ZTE F609", signal: "Dying Gasp (PLN Padam)", package: "50 Mbps" },
      { id: "c5-4", port: 4, name: "Bpk. Wahyu Utomo", status: "online", onuSn: "HWTC55000004", onuModel: "Huawei HG8245", signal: "-21.8 dBm", package: "30 Mbps" },
      { id: "c5-5", port: 5, name: "Kantor Notaris Menteng", status: "online", onuSn: "HWTC55000005", onuModel: "ZTE F670L", signal: "-18.9 dBm", package: "100 Mbps" },
      { id: "c5-6", port: 6, name: "Ibu Fitri Handayani", status: "online", onuSn: "HWTC55000006", onuModel: "ZTE F609", signal: "-22.4 dBm", package: "30 Mbps" },
      { id: "c5-7", port: 7, name: "Bpk. Hendro Kusumo", status: "offline", onuSn: "HWTC55000007", onuModel: "Fiberhome", signal: "LOS (Kabel Terjepit)", package: "30 Mbps" },
      { id: "c5-8", port: 8, name: "Ibu Ningsih", status: "online", onuSn: "HWTC55000008", onuModel: "Huawei HG8245H", signal: "-21.0 dBm", package: "50 Mbps" },
      { id: "c5-9", port: 9, name: "Bpk. Yudi Pratama", status: "online", onuSn: "HWTC55000009", onuModel: "ZTE F609", signal: "-20.3 dBm", package: "30 Mbps" },
      { id: "c5-10", port: 10, name: "Ibu Tari Agustina", status: "online", onuSn: "HWTC55000010", onuModel: "ZTE F670L", signal: "-19.6 dBm", package: "50 Mbps" }
    ]
  },
  {
    id: "odp-6",
    name: "ODP-MNT-06/08",
    lat: -6.185900,
    lng: 106.818800,
    totalPorts: 8,
    availablePorts: 0,
    customers: [
      { id: "c6-1", port: 1, name: "Bpk. Bagus Priyadi (P1)", status: "online", onuSn: "HWTC66000001", onuModel: "Huawei HG8245", signal: "-18.9 dBm", package: "50 Mbps" },
      { id: "c6-2", port: 2, name: "Ibu Clara Shinta (P2)", status: "online", onuSn: "HWTC66000002", onuModel: "ZTE F609", signal: "-19.4 dBm", package: "30 Mbps" },
      { id: "c6-3", port: 3, name: "Bpk. Danang Joyo (P3)", status: "dyinggasp", onuSn: "HWTC66000003", onuModel: "ZTE F609", signal: "Dying Gasp", package: "30 Mbps" },
      { id: "c6-4", port: 4, name: "Ibu Erika Permata (P4)", status: "online", onuSn: "HWTC66000004", onuModel: "Huawei HG8245H", signal: "-21.3 dBm", package: "50 Mbps" },
      { id: "c6-5", port: 5, name: "Bpk. Faisal Akbar (P5)", status: "online", onuSn: "HWTC66000005", onuModel: "ZTE F670L", signal: "-19.8 dBm", package: "100 Mbps" },
      { id: "c6-6", port: 6, name: "Ibu Gina Novita (P6)", status: "online", onuSn: "HWTC66000006", onuModel: "Huawei HG8245", signal: "-20.5 dBm", package: "50 Mbps" },
      { id: "c6-7", port: 7, name: "Bpk. Hari Suwandi (P7)", status: "offline", onuSn: "HWTC66000007", onuModel: "ZTE F609", signal: "LOS", package: "30 Mbps" },
      { id: "c6-8", port: 8, name: "Ibu Hani Rosalina (P8)", status: "online", onuSn: "HWTC66000008", onuModel: "ZTE F609", signal: "-21.7 dBm", package: "30 Mbps" }
    ]
  }
];

// Load ODPs from JSON file
function loadODPs(): ODP[] {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(data);
    } else {
      saveODPs(DEFAULT_ODPS);
      return DEFAULT_ODPS;
    }
  } catch (error) {
    console.error("Error loading ODP database, using defaults:", error);
    return DEFAULT_ODPS;
  }
}

// Save ODPs to JSON file
function saveODPs(odps: ODP[]) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(odps, null, 2), "utf-8");
  } catch (error) {
    console.error("Error saving ODP database:", error);
  }
}

// Calculate distance using Haversine formula (returns distance in meters)
function calculateHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// API Routes

// 0. Get and Update Integration Settings
app.get("/api/settings", (req, res) => {
  const settings = loadSettings();
  res.json(settings);
});

app.post("/api/settings", (req, res) => {
  saveSettings(req.body);
  res.json({ success: true, settings: loadSettings() });
});

// NOC Global Authentication Endpoints (Synchronized across all devices)
app.post("/api/noc/login", (req, res) => {
  try {
    const { password } = req.body || {};
    const settings = loadSettings();
    const serverPass = settings.nocPassword || "noc123";

    if (password && password === serverPass) {
      return res.json({ success: true, message: "Autentikasi NOC berhasil." });
    }

    return res.status(401).json({ 
      success: false, 
      error: "Password NOC salah! Silakan periksa kembali password yang dimasukkan." 
    });
  } catch (error: any) {
    console.error("NOC login error:", error);
    return res.status(500).json({ success: false, error: "Terjadi kesalahan pada server saat login NOC." });
  }
});

app.post("/api/noc/change-password", (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const trimmed = (newPassword || "").trim();

    if (!trimmed || trimmed.length < 4) {
      return res.status(400).json({ 
        success: false, 
        error: "Password baru minimal 4 karakter." 
      });
    }

    const settings = loadSettings();
    const serverPass = settings.nocPassword || "noc123";

    // If currentPassword is provided, verify it first
    if (currentPassword && currentPassword !== serverPass) {
      return res.status(401).json({ 
        success: false, 
        error: "Password lama tidak sesuai! Password baru gagal disimpan." 
      });
    }

    saveSettings({ nocPassword: trimmed });
    console.log(`[NOC Security] Password NOC diperbarui di server, berlaku serentak untuk seluruh perangkat.`);
    
    return res.json({ 
      success: true, 
      message: "Password NOC berhasil diperbarui di server dan langsung berlaku di semua perangkat!" 
    });
  } catch (error: any) {
    console.error("NOC change-password error:", error);
    return res.status(500).json({ success: false, error: "Gagal memperbarui password NOC di server." });
  }
});

app.get("/api/noc/status", (req, res) => {
  try {
    const settings = loadSettings();
    const isDefault = (settings.nocPassword || "noc123") === "noc123";
    res.json({ success: true, isDefault });
  } catch (error) {
    res.json({ success: true, isDefault: true });
  }
});

// 1. Get all ODPs
app.get("/api/odps", (req, res) => {
  const odps = loadODPs();
  res.json(odps);
});

// 2. Add a new ODP
app.post("/api/odps", (req, res) => {
  try {
    const { name, lat, lng, totalPorts, availablePorts, smartOltId } = req.body || {};
    
    if (!name || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: "Nama dan koordinat ODP wajib diisi." });
    }

    const latNum = Number(String(lat).trim().replace(",", "."));
    const lngNum = Number(String(lng).trim().replace(",", "."));
    const totalNum = Number(totalPorts) || 8;
    const availNum = (availablePorts !== undefined && availablePorts !== null && !isNaN(Number(availablePorts)))
      ? Number(availablePorts)
      : totalNum;

    if (isNaN(latNum) || isNaN(lngNum)) {
      return res.status(400).json({ error: "Koordinat latitude atau longitude tidak valid." });
    }

    const odps = loadODPs();
    const newOdp: ODP = {
      id: `odp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: String(name).trim(),
      lat: latNum,
      lng: lngNum,
      totalPorts: totalNum,
      availablePorts: availNum,
      ...(smartOltId ? { smartOltId: String(smartOltId) } : {})
    };

    odps.push(newOdp);
    saveODPs(odps);
    return res.status(201).json(newOdp);
  } catch (err: any) {
    console.error("Error adding ODP:", err);
    return res.status(500).json({ error: err.message || "Gagal menyimpan ODP ke database" });
  }
});

// 3. Delete all ODPs
app.delete("/api/odps", (req, res) => {
  try {
    saveODPs([]);
    return res.json({ message: "Semua ODP berhasil dihapus!" });
  } catch (err: any) {
    return res.status(500).json({ error: "Gagal menghapus semua ODP" });
  }
});

// 3.1. Batch delete ODPs
app.post("/api/odps/batch-delete", (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: "Invalid IDs array" });
    }
    let odps = loadODPs();
    odps = odps.filter(o => !ids.includes(o.id));
    saveODPs(odps);
    return res.json({ message: `${ids.length} ODP berhasil dihapus!` });
  } catch (err: any) {
    return res.status(500).json({ error: "Gagal menghapus batch ODP" });
  }
});

// 3. Delete an ODP
app.delete("/api/odps/:id", (req, res) => {
  try {
    const { id } = req.params;
    let odps = loadODPs();
    const initialLength = odps.length;
    odps = odps.filter(o => o.id !== id);
    
    if (odps.length === initialLength) {
      return res.status(404).json({ error: "ODP not found" });
    }

    saveODPs(odps);
    return res.json({ message: "ODP deleted successfully", id });
  } catch (err: any) {
    return res.status(500).json({ error: "Gagal menghapus ODP" });
  }
});

// 3.5. Update an ODP
app.put("/api/odps/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { name, lat, lng, totalPorts, availablePorts, smartOltId } = req.body || {};

    if (!name || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: "Nama dan koordinat ODP wajib diisi." });
    }

    const latNum = Number(String(lat).trim().replace(",", "."));
    const lngNum = Number(String(lng).trim().replace(",", "."));
    const totalNum = Number(totalPorts) || 8;
    const availNum = (availablePorts !== undefined && availablePorts !== null && !isNaN(Number(availablePorts)))
      ? Number(availablePorts)
      : totalNum;

    if (isNaN(latNum) || isNaN(lngNum)) {
      return res.status(400).json({ error: "Koordinat latitude atau longitude tidak valid." });
    }

    const odps = loadODPs();
    const index = odps.findIndex(o => o.id === id);

    if (index === -1) {
      return res.status(404).json({ error: "ODP not found" });
    }

    const existingOdp = odps[index];

    odps[index] = {
      id,
      name: String(name).trim(),
      lat: latNum,
      lng: lngNum,
      totalPorts: totalNum,
      availablePorts: availNum,
      smartOltId: smartOltId !== undefined ? (smartOltId ? String(smartOltId) : undefined) : existingOdp.smartOltId,
      customers: req.body?.customers !== undefined ? req.body.customers : existingOdp.customers
    };

    saveODPs(odps);
    return res.json(odps[index]);
  } catch (err: any) {
    console.error("Error updating ODP:", err);
    return res.status(500).json({ error: err.message || "Gagal memperbarui ODP" });
  }
});

// 3.6. Plug / Add a Customer to an ODP Port
app.post("/api/odps/:id/customers", (req, res) => {
  const { id } = req.params;
  const { port, name, status, onuSn, onuModel, signal, ipAddress, package: pkg, address } = req.body;

  if (!name || port === undefined) {
    return res.status(400).json({ error: "Nama pelanggan dan nomor port wajib diisi" });
  }

  const odps = loadODPs();
  const index = odps.findIndex(o => o.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "ODP tidak ditemukan" });
  }

  const odp = odps[index];
  const portNum = Number(port);
  if (isNaN(portNum) || portNum < 1 || portNum > odp.totalPorts) {
    return res.status(400).json({ error: `Nomor port harus antara 1 dan ${odp.totalPorts}` });
  }

  let customers: OdpCustomer[] = odp.customers ? [...odp.customers] : [];
  // Remove existing customer in this port if any (replace plug)
  customers = customers.filter(c => c.port !== portNum);

  const newCustomer: OdpCustomer = {
    id: `cust-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    port: portNum,
    name: String(name).trim(),
    status: (status === "offline" || status === "dyinggasp") ? status : "online",
    onuSn: onuSn ? String(onuSn).trim() : `ZTEG${Math.floor(10000000 + Math.random() * 90000000)}`,
    onuModel: onuModel ? String(onuModel).trim() : "ZTE F609",
    signal: signal ? String(signal).trim() : (status === "offline" ? "LOS" : status === "dyinggasp" ? "Dying Gasp" : "-20.1 dBm"),
    ipAddress: ipAddress ? String(ipAddress).trim() : undefined,
    package: pkg ? String(pkg).trim() : "30 Mbps Home",
    address: address ? String(address).trim() : undefined,
    pluggedAt: new Date().toISOString().split("T")[0]
  };

  customers.push(newCustomer);
  customers.sort((a, b) => a.port - b.port);

  odp.customers = customers;
  odp.availablePorts = Math.max(0, odp.totalPorts - customers.length);

  odps[index] = odp;
  saveODPs(odps);

  res.status(201).json({ customer: newCustomer, odp });
});

// 3.7. Update Customer Details / Status (online, offline, dyinggasp)
app.put("/api/odps/:id/customers/:customerId", (req, res) => {
  const { id, customerId } = req.params;
  const { port, name, status, onuSn, onuModel, signal, ipAddress, package: pkg, address } = req.body;

  const odps = loadODPs();
  const index = odps.findIndex(o => o.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "ODP tidak ditemukan" });
  }

  const odp = odps[index];
  const customers: OdpCustomer[] = odp.customers ? [...odp.customers] : [];
  const custIndex = customers.findIndex(c => c.id === customerId);
  if (custIndex === -1) {
    return res.status(404).json({ error: "Pelanggan tidak ditemukan" });
  }

  const existing = customers[custIndex];
  const targetPort = port !== undefined ? Number(port) : existing.port;

  if (isNaN(targetPort) || targetPort < 1 || targetPort > odp.totalPorts) {
    return res.status(400).json({ error: `Nomor port harus antara 1 dan ${odp.totalPorts}` });
  }

  // If port changed, check if target port is occupied by another customer
  if (targetPort !== existing.port) {
    const portOccupied = customers.some(c => c.id !== customerId && c.port === targetPort);
    if (portOccupied) {
      return res.status(400).json({ error: `Port ${targetPort} sudah terpakai oleh pelanggan lain` });
    }
  }

  customers[custIndex] = {
    ...existing,
    port: targetPort,
    name: name !== undefined ? String(name).trim() : existing.name,
    status: (status === "offline" || status === "dyinggasp" || status === "online") ? status : existing.status,
    onuSn: onuSn !== undefined ? String(onuSn).trim() : existing.onuSn,
    onuModel: onuModel !== undefined ? String(onuModel).trim() : existing.onuModel,
    signal: signal !== undefined ? String(signal).trim() : existing.signal,
    ipAddress: ipAddress !== undefined ? String(ipAddress).trim() : existing.ipAddress,
    package: pkg !== undefined ? String(pkg).trim() : existing.package,
    address: address !== undefined ? String(address).trim() : existing.address
  };

  customers.sort((a, b) => a.port - b.port);
  odp.customers = customers;
  odp.availablePorts = Math.max(0, odp.totalPorts - customers.length);

  odps[index] = odp;
  saveODPs(odps);

  res.json({ customer: customers[custIndex], odp });
});

// 3.8. Delete / Unplug Customer from ODP Port
app.delete("/api/odps/:id/customers/:customerId", (req, res) => {
  const { id, customerId } = req.params;

  const odps = loadODPs();
  const index = odps.findIndex(o => o.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "ODP tidak ditemukan" });
  }

  const odp = odps[index];
  let customers: OdpCustomer[] = odp.customers ? [...odp.customers] : [];
  const initialLen = customers.length;
  customers = customers.filter(c => c.id !== customerId);

  if (customers.length === initialLen) {
    return res.status(404).json({ error: "Pelanggan tidak ditemukan" });
  }

  odp.customers = customers;
  odp.availablePorts = Math.max(0, odp.totalPorts - customers.length);

  odps[index] = odp;
  saveODPs(odps);

  res.json({ message: "Pelanggan berhasil dicabut dari port ODP", odp });
});

// Helper function to safely parse JSON response and avoid throwing when HTML or non-JSON is returned
async function safeParseResponse(response: Response | null): Promise<any> {
  if (!response) return null;
  try {
    const text = await response.text();
    if (!text || text.trim().startsWith("<")) {
      return null;
    }
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// In-memory route cache to eliminate redundant public API requests and provide 0ms latency
const osrmRouteCache = new Map<string, { distance: number; routeCoords: { lat: number; lng: number }[] }>();

// Fetch real road routing between user and ODP with dual provider fallback and timeout protection
async function getOSRMRoute(userLat: number, userLng: number, odpLat: number, odpLng: number) {
  // If coordinates are virtually identical (same spot), return 0m route instantly
  const directDist = calculateHaversine(userLat, userLng, odpLat, odpLng);
  if (directDist < 3) {
    return {
      distance: Math.round(directDist),
      routeCoords: [
        { lat: userLat, lng: userLng },
        { lat: odpLat, lng: odpLng }
      ]
    };
  }

  // Check cache
  const cacheKey = `${userLat.toFixed(5)},${userLng.toFixed(5)}_${odpLat.toFixed(5)},${odpLng.toFixed(5)}`;
  if (osrmRouteCache.has(cacheKey)) {
    return osrmRouteCache.get(cacheKey)!;
  }

  const parseRouteData = (data: any) => {
    if (!data || data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      return null;
    }
    const route = data.routes[0];
    const distance = Math.round(route.distance);
    const geometry = route.geometry;
    if (!geometry || !geometry.coordinates) return null;

    const routeCoords = geometry.coordinates.map((coord: number[]) => ({
      lat: coord[1],
      lng: coord[0]
    }));
    return { distance, routeCoords };
  };

  // Provider 1: router.project-osrm.org (foot profile)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const url1 = `https://router.project-osrm.org/route/v1/foot/${userLng},${userLat};${odpLng},${odpLat}?overview=full&geometries=geojson`;
    const response = await fetch(url1, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ODP-Checker/2.0" },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await safeParseResponse(response);
      const parsed = parseRouteData(data);
      if (parsed) {
        if (osrmRouteCache.size > 200) osrmRouteCache.clear();
        osrmRouteCache.set(cacheKey, parsed);
        return parsed;
      }
    }
  } catch (err: any) {
    // Timeout or network glitch on provider 1, continue to fallback
  }

  // Provider 2 Fallback: routing.openstreetmap.de
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const url2 = `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${userLng},${userLat};${odpLng},${odpLat}?overview=full&geometries=geojson`;
    const response = await fetch(url2, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ODP-Checker/2.0" },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await safeParseResponse(response);
      const parsed = parseRouteData(data);
      if (parsed) {
        if (osrmRouteCache.size > 200) osrmRouteCache.clear();
        osrmRouteCache.set(cacheKey, parsed);
        return parsed;
      }
    }
  } catch (err: any) {
    console.warn("Secondary OSRM provider error:", err?.message || err);
  }

  return null;
}

// 4. Check coverage for given coordinates
app.post("/api/check-coverage", async (req, res) => {
  const { lat, lng, mode, targetOdpId } = req.body;

  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ error: "Latitude and Longitude are required" });
  }

  const userLat = Number(lat);
  const userLng = Number(lng);
  const odps = loadODPs();

  if (odps.length === 0) {
    return res.json({
      status: "BELUM TERCOVER",
      distance: null,
      nearestOdp: null,
      routeGeometry: null,
      isRoadRoute: false,
      message: "Database ODP kosong. Silakan tambahkan ODP terlebih dahulu."
    });
  }

  // 1. Calculate physical Haversine distance to all ODPs
  const candidates = odps.map(odp => ({
    odp,
    haversineDist: calculateHaversine(userLat, userLng, odp.lat, odp.lng)
  }));

  // Sort by true direct physical distance (Euclidean/Haversine)
  candidates.sort((a, b) => a.haversineDist - b.haversineDist);

  let targetCandidate: { odp: ODP; haversineDist: number };
  let isTargetLocked = false;

  if (targetOdpId) {
    const locked = candidates.find(c => c.odp.id === targetOdpId);
    if (locked) {
      targetCandidate = locked;
      isTargetLocked = true;
    } else {
      targetCandidate = candidates[0];
    }
  } else {
    // In FTTH drop cabling, the physically closest ODP is the primary distribution point.
    // If the closest ODP is completely full (availablePorts === 0), check if there is an alternative
    // with available ports that is physically very close (within 35 meters). Otherwise stick to closest.
    const closest = candidates[0];
    if (closest.odp.availablePorts === 0) {
      const availableNearby = candidates.find(
        c => c.odp.availablePorts > 0 && c.haversineDist <= closest.haversineDist + 35
      );
      targetCandidate = availableNearby || closest;
    } else {
      targetCandidate = closest;
    }
  }

  const nearestOdp = targetCandidate.odp;
  const directDistance = Math.round(targetCandidate.haversineDist);
  let finalDistance = directDistance;
  let isRoadRoute = false;
  let isDetourAvoided = false;
  let routeGeometry: { lat: number; lng: number }[] = [
    { lat: userLat, lng: userLng },
    { lat: nearestOdp.lat, lng: nearestOdp.lng }
  ];

  // Always calculate and strictly use OSRM road route along streets/gangs
  try {
    const osrmResult = await getOSRMRoute(userLat, userLng, nearestOdp.lat, nearestOdp.lng);
    if (osrmResult && osrmResult.routeCoords && osrmResult.routeCoords.length > 0) {
      finalDistance = osrmResult.distance;
      isRoadRoute = true;
      routeGeometry = osrmResult.routeCoords;
    }
  } catch (error) {
    console.warn("OSRM routing failed:", error);
  }

  let status = "BELUM TERCOVER";
  if (nearestOdp) {
    if (finalDistance <= 300) {
      if (nearestOdp.availablePorts > 0) {
        status = "TERCOVER";
      } else {
        status = "PORT PENUH / WAITING LIST";
      }
    }
  }

  res.json({
    status,
    userCoords: { lat: userLat, lng: userLng },
    nearestOdp,
    distance: finalDistance,
    directDistance,
    isRoadRoute,
    isDetourAvoided,
    isTargetLocked,
    routeGeometry
  });
});

// 4.5. Bulk insert ODPs (for KMZ/KML imports)
app.post("/api/odps/bulk", (req, res) => {
  try {
    const { odps: newOdps } = req.body || {};
    if (!Array.isArray(newOdps)) {
      return res.status(400).json({ error: "Format data tidak valid. Diharapkan array ODP." });
    }

    const odps = loadODPs();
    const validNewOdps: ODP[] = [];

    for (const item of newOdps) {
      if (!item || !item.name || item.lat === undefined || item.lng === undefined) {
        continue;
      }
      const latNum = Number(String(item.lat).trim().replace(",", "."));
      const lngNum = Number(String(item.lng).trim().replace(",", "."));
      if (isNaN(latNum) || isNaN(lngNum)) continue;

      const total = isNaN(Number(item.totalPorts)) ? 8 : Number(item.totalPorts);
      const available = (item.availablePorts !== undefined && item.availablePorts !== null && !isNaN(Number(item.availablePorts)))
        ? Number(item.availablePorts)
        : total;

      validNewOdps.push({
        id: item.id || `odp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: String(item.name).trim(),
        lat: latNum,
        lng: lngNum,
        totalPorts: total,
        availablePorts: available
      });
    }

    if (validNewOdps.length === 0) {
      return res.status(400).json({ error: "Tidak ada ODP valid yang dapat disimpan." });
    }

    const merged = [...odps, ...validNewOdps];
    saveODPs(merged);

    return res.status(201).json({
      message: `Berhasil mengimpor ${validNewOdps.length} ODP ke database!`,
      importedCount: validNewOdps.length,
      odps: merged
    });
  } catch (err: any) {
    console.error("Error bulk inserting ODPs:", err);
    return res.status(500).json({ error: err.message || "Gagal menyimpan ODP ke database" });
  }
});

// Proxy integration for SmartOLT
app.post("/api/integration/smartolt", async (req, res) => {
  const { domain, apiKey, action } = req.body;

  if (!action) {
    return res.status(400).json({ error: "Missing 'action' parameter." });
  }

  // Fallback / Demonstration simulation if credentials are empty or contain placeholder text
  const isMock = !domain || !apiKey || domain.includes("placeholder") || apiKey.includes("your-api-key");

  if (isMock) {
    // Generate realistic, educational sandbox response to allow testing without live production creds
    if (action === "get_olts") {
      return res.json({
        status: true,
        message: "SIMULATED SUCCESS (SANDBOX MODE)",
        isMock: true,
        data: [
          { id: 1, name: "OLT-Menteng-GPON01", ip: "10.10.20.1", status: "active", model: "ZTE C320" },
          { id: 2, name: "OLT-Sudirman-GPON02", ip: "10.10.30.1", status: "active", model: "Huawei MA5608T" }
        ]
      });
    } else if (action === "get_onus_statuses") {
      return res.json({
        status: true,
        message: "SIMULATED SUCCESS (SANDBOX MODE)",
        isMock: true,
        data: [
          // ODP-MNT-01/08 - has 5 users online/offline (should sync: total 8, used 5, available 3)
          { name: "John_ODP-MNT-01", sn: "ZTEG11223344", state: "online", signal: "-19.2 dBm", zone: "Menteng" },
          { name: "Alice_ODP-MNT-01", sn: "ZTEG11223345", state: "online", signal: "-20.1 dBm", zone: "Menteng" },
          { name: "Bob_ODP-MNT-01", sn: "ZTEG11223346", state: "online", signal: "-18.5 dBm", zone: "Menteng" },
          { name: "Charlie_ODP-MNT-01", sn: "ZTEG11223347", state: "offline", signal: "LOS", zone: "Menteng" },
          { name: "David_ODP-MNT-01", sn: "ZTEG11223348", state: "online", signal: "-21.0 dBm", zone: "Menteng" },

          // ODP-MNT-02/16 - has 12 users (should sync: total 16, used 12, available 4)
          { name: "User1_ODP-MNT-02", sn: "ZTEG22000001", state: "online", signal: "-22.4 dBm", zone: "Menteng" },
          { name: "User2_ODP-MNT-02", sn: "ZTEG22000002", state: "online", signal: "-23.1 dBm", zone: "Menteng" },
          { name: "User3_ODP-MNT-02", sn: "ZTEG22000003", state: "online", signal: "-19.5 dBm", zone: "Menteng" },
          { name: "User4_ODP-MNT-02", sn: "ZTEG22000004", state: "online", signal: "-20.8 dBm", zone: "Menteng" },
          { name: "User5_ODP-MNT-02", sn: "ZTEG22000005", state: "online", signal: "-24.2 dBm", zone: "Menteng" },
          { name: "User6_ODP-MNT-02", sn: "ZTEG22000006", state: "offline", signal: "LOS", zone: "Menteng" },
          { name: "User7_ODP-MNT-02", sn: "ZTEG22000007", state: "online", signal: "-21.1 dBm", zone: "Menteng" },
          { name: "User8_ODP-MNT-02", sn: "ZTEG22000008", state: "online", signal: "-22.5 dBm", zone: "Menteng" },
          { name: "User9_ODP-MNT-02", sn: "ZTEG22000009", state: "online", signal: "-23.0 dBm", zone: "Menteng" },
          { name: "User10_ODP-MNT-02", sn: "ZTEG22000010", state: "online", signal: "-20.4 dBm", zone: "Menteng" },
          { name: "User11_ODP-MNT-02", sn: "ZTEG22000011", state: "online", signal: "-21.8 dBm", zone: "Menteng" },
          { name: "User12_ODP-MNT-02", sn: "ZTEG22000012", state: "online", signal: "-19.9 dBm", zone: "Menteng" },

          // ODP-MNT-03/08 - has 6 users (should sync: total 8, used 6, available 2)
          { name: "Pelanggan_A_ODP-MNT-03", sn: "ZTEG33000001", state: "online", signal: "-20.5 dBm", zone: "Menteng" },
          { name: "Pelanggan_B_ODP-MNT-03", sn: "ZTEG33000002", state: "online", signal: "-21.2 dBm", zone: "Menteng" },
          { name: "Pelanggan_C_ODP-MNT-03", sn: "ZTEG33000003", state: "online", signal: "-19.8 dBm", zone: "Menteng" },
          { name: "Pelanggan_D_ODP-MNT-03", sn: "ZTEG33000004", state: "offline", signal: "LOS", zone: "Menteng" },
          { name: "Pelanggan_E_ODP-MNT-03", sn: "ZTEG33000005", state: "online", signal: "-22.1 dBm", zone: "Menteng" },
          { name: "Pelanggan_F_ODP-MNT-03", sn: "ZTEG33000006", state: "online", signal: "-23.4 dBm", zone: "Menteng" },

          // ODP-MNT-04/08 - has 2 users (should sync: total 8, used 2, available 6)
          { name: "A_ODP-MNT-04", sn: "HWTC44000001", state: "online", signal: "-21.3 dBm", zone: "Menteng" },
          { name: "B_ODP-MNT-04", sn: "HWTC44000002", state: "online", signal: "-22.2 dBm", zone: "Menteng" },

          // ODP-MNT-05/16 - has 3 users (should sync: total 16, used 3, available 13)
          { name: "Indah_ODP-MNT-05", sn: "HWTC55000001", state: "online", signal: "-20.0 dBm", zone: "Menteng" },
          { name: "Sari_ODP-MNT-05", sn: "HWTC55000002", state: "online", signal: "-19.1 dBm", zone: "Menteng" },
          { name: "Joko_ODP-MNT-05", sn: "HWTC55000003", state: "online", signal: "-21.5 dBm", zone: "Menteng" },

          // ODP-MNT-06/08 - has 8 users (should sync: total 8, used 8, available 0 - full)
          { name: "P1_ODP-MNT-06", sn: "HWTC66000001", state: "online", signal: "-18.9 dBm", zone: "Menteng" },
          { name: "P2_ODP-MNT-06", sn: "HWTC66000002", state: "online", signal: "-19.4 dBm", zone: "Menteng" },
          { name: "P3_ODP-MNT-06", sn: "HWTC66000003", state: "online", signal: "-20.2 dBm", zone: "Menteng" },
          { name: "P4_ODP-MNT-06", sn: "HWTC66000004", state: "online", signal: "-21.3 dBm", zone: "Menteng" },
          { name: "P5_ODP-MNT-06", sn: "HWTC66000005", state: "online", signal: "-19.8 dBm", zone: "Menteng" },
          { name: "P6_ODP-MNT-06", sn: "HWTC66000006", state: "online", signal: "-20.5 dBm", zone: "Menteng" },
          { name: "P7_ODP-MNT-06", sn: "HWTC66000007", state: "online", signal: "-22.1 dBm", zone: "Menteng" },
          { name: "P8_ODP-MNT-06", sn: "HWTC66000008", state: "online", signal: "-21.7 dBm", zone: "Menteng" }
        ]
      });
    } else if (action === "get_onus_statuses") {
      return res.json({
        status: true,
        message: "SIMULATED SUCCESS (SANDBOX MODE)",
        isMock: true,
        data: [
          // ODP-MNT-01/08 - has 5 users online/offline (should sync: total 8, used 5, available 3)
          { name: "John_ODP-MNT-01", sn: "ZTEG11223344", state: "online", signal: "-19.2 dBm", zone: "Menteng" },
          { name: "Alice_ODP-MNT-01", sn: "ZTEG11223345", state: "online", signal: "-20.1 dBm", zone: "Menteng" },
          { name: "Bob_ODP-MNT-01", sn: "ZTEG11223346", state: "online", signal: "-18.5 dBm", zone: "Menteng" },
          { name: "Charlie_ODP-MNT-01", sn: "ZTEG11223347", state: "offline", signal: "LOS", zone: "Menteng" },
          { name: "David_ODP-MNT-01", sn: "ZTEG11223348", state: "online", signal: "-21.0 dBm", zone: "Menteng" },

          // ODP-MNT-02/16 - has 12 users (should sync: total 16, used 12, available 4)
          { name: "User1_ODP-MNT-02", sn: "ZTEG22000001", state: "online", signal: "-22.4 dBm", zone: "Menteng" },
          { name: "User2_ODP-MNT-02", sn: "ZTEG22000002", state: "online", signal: "-23.1 dBm", zone: "Menteng" },
          { name: "User3_ODP-MNT-02", sn: "ZTEG22000003", state: "online", signal: "-19.5 dBm", zone: "Menteng" },
          { name: "User4_ODP-MNT-02", sn: "ZTEG22000004", state: "online", signal: "-20.8 dBm", zone: "Menteng" },
          { name: "User5_ODP-MNT-02", sn: "ZTEG22000005", state: "online", signal: "-24.2 dBm", zone: "Menteng" },
          { name: "User6_ODP-MNT-02", sn: "ZTEG22000006", state: "offline", signal: "LOS", zone: "Menteng" },
          { name: "User7_ODP-MNT-02", sn: "ZTEG22000007", state: "online", signal: "-21.1 dBm", zone: "Menteng" },
          { name: "User8_ODP-MNT-02", sn: "ZTEG22000008", state: "online", signal: "-22.5 dBm", zone: "Menteng" },
          { name: "User9_ODP-MNT-02", sn: "ZTEG22000009", state: "online", signal: "-23.0 dBm", zone: "Menteng" },
          { name: "User10_ODP-MNT-02", sn: "ZTEG22000010", state: "online", signal: "-20.4 dBm", zone: "Menteng" },
          { name: "User11_ODP-MNT-02", sn: "ZTEG22000011", state: "online", signal: "-21.8 dBm", zone: "Menteng" },
          { name: "User12_ODP-MNT-02", sn: "ZTEG22000012", state: "online", signal: "-19.9 dBm", zone: "Menteng" },

          // ODP-MNT-03/08 - has 6 users (should sync: total 8, used 6, available 2)
          { name: "Pelanggan_A_ODP-MNT-03", sn: "ZTEG33000001", state: "online", signal: "-20.5 dBm", zone: "Menteng" },
          { name: "Pelanggan_B_ODP-MNT-03", sn: "ZTEG33000002", state: "online", signal: "-21.2 dBm", zone: "Menteng" },
          { name: "Pelanggan_C_ODP-MNT-03", sn: "ZTEG33000003", state: "online", signal: "-19.8 dBm", zone: "Menteng" },
          { name: "Pelanggan_D_ODP-MNT-03", sn: "ZTEG33000004", state: "offline", signal: "LOS", zone: "Menteng" },
          { name: "Pelanggan_E_ODP-MNT-03", sn: "ZTEG33000005", state: "online", signal: "-22.1 dBm", zone: "Menteng" },
          { name: "Pelanggan_F_ODP-MNT-03", sn: "ZTEG33000006", state: "online", signal: "-23.4 dBm", zone: "Menteng" },

          // ODP-MNT-04/08 - has 2 users (should sync: total 8, used 2, available 6)
          { name: "A_ODP-MNT-04", sn: "HWTC44000001", state: "online", signal: "-21.3 dBm", zone: "Menteng" },
          { name: "B_ODP-MNT-04", sn: "HWTC44000002", state: "online", signal: "-22.2 dBm", zone: "Menteng" },

          // ODP-MNT-05/16 - has 3 users (should sync: total 16, used 3, available 13)
          { name: "Indah_ODP-MNT-05", sn: "HWTC55000001", state: "online", signal: "-20.0 dBm", zone: "Menteng" },
          { name: "Sari_ODP-MNT-05", sn: "HWTC55000002", state: "online", signal: "-19.1 dBm", zone: "Menteng" },
          { name: "Joko_ODP-MNT-05", sn: "HWTC55000003", state: "online", signal: "-21.5 dBm", zone: "Menteng" },

          // ODP-MNT-06/08 - has 8 users (should sync: total 8, used 8, available 0 - full)
          { name: "P1_ODP-MNT-06", sn: "HWTC66000001", state: "online", signal: "-18.9 dBm", zone: "Menteng" },
          { name: "P2_ODP-MNT-06", sn: "HWTC66000002", state: "online", signal: "-19.4 dBm", zone: "Menteng" },
          { name: "P3_ODP-MNT-06", sn: "HWTC66000003", state: "online", signal: "-20.2 dBm", zone: "Menteng" },
          { name: "P4_ODP-MNT-06", sn: "HWTC66000004", state: "online", signal: "-21.3 dBm", zone: "Menteng" },
          { name: "P5_ODP-MNT-06", sn: "HWTC66000005", state: "online", signal: "-19.8 dBm", zone: "Menteng" },
          { name: "P6_ODP-MNT-06", sn: "HWTC66000006", state: "online", signal: "-20.5 dBm", zone: "Menteng" },
          { name: "P7_ODP-MNT-06", sn: "HWTC66000007", state: "online", signal: "-22.1 dBm", zone: "Menteng" },
          { name: "P8_ODP-MNT-06", sn: "HWTC66000008", state: "online", signal: "-21.7 dBm", zone: "Menteng" }
        ]
      });
    } else if (action === "get_odbs") {
      // Return mock ODB list, with used_ports and available_ports calculated from the mock ONUs above
      const mockOnus = [
        { name: "John_ODP-MNT-01" }, { name: "Alice_ODP-MNT-01" }, { name: "Bob_ODP-MNT-01" }, { name: "Charlie_ODP-MNT-01" }, { name: "David_ODP-MNT-01" },
        { name: "User1_ODP-MNT-02" }, { name: "User2_ODP-MNT-02" }, { name: "User3_ODP-MNT-02" }, { name: "User4_ODP-MNT-02" }, { name: "User5_ODP-MNT-02" }, { name: "User6_ODP-MNT-02" }, { name: "User7_ODP-MNT-02" }, { name: "User8_ODP-MNT-02" }, { name: "User9_ODP-MNT-02" }, { name: "User10_ODP-MNT-02" }, { name: "User11_ODP-MNT-02" }, { name: "User12_ODP-MNT-02" },
        { name: "Pelanggan_A_ODP-MNT-03" }, { name: "Pelanggan_B_ODP-MNT-03" }, { name: "Pelanggan_C_ODP-MNT-03" }, { name: "Pelanggan_D_ODP-MNT-03" }, { name: "Pelanggan_E_ODP-MNT-03" }, { name: "Pelanggan_F_ODP-MNT-03" },
        { name: "A_ODP-MNT-04" }, { name: "B_ODP-MNT-04" },
        { name: "Indah_ODP-MNT-05" }, { name: "Sari_ODP-MNT-05" }, { name: "Joko_ODP-MNT-05" },
        { name: "P1_ODP-MNT-06" }, { name: "P2_ODP-MNT-06" }, { name: "P3_ODP-MNT-06" }, { name: "P4_ODP-MNT-06" }, { name: "P5_ODP-MNT-06" }, { name: "P6_ODP-MNT-06" }, { name: "P7_ODP-MNT-06" }, { name: "P8_ODP-MNT-06" }
      ];

      const rawOdbs = [
        { id: 101, name: "ODP-MNT-01", zone: "Menteng", nr_of_ports: 8, latitude: "-6.19250", longitude: "106.83300" },
        { id: 102, name: "ODP-MNT-02", zone: "Menteng", nr_of_ports: 16, latitude: "-6.19320", longitude: "106.83410" },
        { id: 103, name: "ODP-MNT-03", zone: "Menteng", nr_of_ports: 8, latitude: "-6.19480", longitude: "106.83220" },
        { id: 104, name: "ODP-MNT-04", zone: "Menteng", nr_of_ports: 8, latitude: "-6.19120", longitude: "106.83580" },
        { id: 105, name: "ODP-MNT-05", zone: "Menteng", nr_of_ports: 16, latitude: "-6.19550", longitude: "106.83650" },
        { id: 106, name: "ODP-MNT-06", zone: "Menteng", nr_of_ports: 8, latitude: "-6.19620", longitude: "106.83150" }
      ];

      const processed = rawOdbs.map(odb => {
        const base = odb.name.toLowerCase();
        const matchedOnus = mockOnus.filter(o => o.name.toLowerCase().includes(base));
        const usedCount = matchedOnus.length;
        const total = odb.nr_of_ports;
        return {
          ...odb,
          used_ports: usedCount,
          available_ports: Math.max(0, total - usedCount)
        };
      });

      return res.json({
        status: true,
        message: "SIMULATED SUCCESS (SANDBOX MODE)",
        isMock: true,
        response: processed
      });
    }
    return res.status(400).json({ error: `Unsupported mock action: ${action}` });
  }

  try {
    // Helper to clean domain and extract protocol
    const trimmed = domain.trim();
    let protocol = "https://";
    let host = trimmed;
    
    if (trimmed.startsWith("http://")) {
      protocol = "http://";
      host = trimmed.substring(7);
    } else if (trimmed.startsWith("https://")) {
      protocol = "https://";
      host = trimmed.substring(8);
    }
    
    // Clean host
    host = host.replace(/^\/+/, "").replace(/\/+$/, "");

    // Helper for detailed error formatting
    const formatSmartOltError = (err: any, endpointUrl: string) => {
      const errMessage = err.message || String(err);
      const isAbort = err.name === "AbortError" || errMessage.toLowerCase().includes("abort");
      
      if (isAbort) {
        return `Koneksi terputus (Timeout 30 detik) saat menghubungi ${endpointUrl}. Server SmartOLT Anda tidak merespons tepat waktu. Silakan periksa kembali apakah server SmartOLT online dan port/firewall mengizinkan koneksi masuk (inbound) dari server kami.`;
      }
      
      const isTimeout = errMessage.toLowerCase().includes("timeout") || 
                        (err.cause && String(err.cause).toLowerCase().includes("timeout")) ||
                        err.code === "ETIMEDOUT" ||
                        err.code === "UND_ERR_CONNECT_TIMEOUT";
                        
      if (isTimeout) {
        return `Koneksi Timeout saat menghubungi ${endpointUrl}. Gagal tersambung dalam batas waktu (10 detik). Silakan periksa apakah domain/IP benar, port (443/80) terbuka secara publik, dan firewall mengizinkan koneksi masuk (inbound) dari server kami, atau coba gunakan alternatif protokol (http vs https).`;
      }
      
      const isRefused = errMessage.toLowerCase().includes("refused") || 
                        (err.cause && String(err.cause).toLowerCase().includes("refused")) ||
                        err.code === "ECONNREFUSED";
                        
      if (isRefused) {
        return `Koneksi Ditolak (Connection Refused) saat menghubungi ${endpointUrl}. Server target aktif tetapi secara aktif menolak koneksi pada port tersebut. Silakan periksa apakah service SmartOLT sedang berjalan pada port yang tepat, atau tambahkan nomor port khusus jika diperlukan (contoh: domain.com:8080).`;
      }
      
      const isUnreachable = errMessage.toLowerCase().includes("enotfound") || 
                            errMessage.toLowerCase().includes("ehostunreach") ||
                            (err.cause && (String(err.cause).toLowerCase().includes("enotfound") || String(err.cause).toLowerCase().includes("ehostunreach")));
                            
      if (isUnreachable) {
        return `Host Tidak Ditemukan atau Tidak Dapat Dijangkau saat menghubungi ${endpointUrl}. Gagal menyelesaikan alamat DNS atau rute ke server tidak tersedia. Silakan periksa kembali ejaan domain Anda.`;
      }
      
      if (err.cause) {
        return `Gagal menghubungi ${endpointUrl}. Deskripsi Teknis: ${errMessage} (Sebab: ${String(err.cause)}).`;
      }
      
      return `Gagal menghubungi ${endpointUrl}. Deskripsi Teknis: ${errMessage}.`;
    };

    if (action === "get_odbs") {
      const odbsEndpoint = `${protocol}${host}/api/system/get_odbs`;
      const onusEndpoint = `${protocol}${host}/api/onu/get_onus_statuses`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      let odbs: any[] = [];
      let onus: any[] = [];

      try {
        const [odbsResponse, onusResponse] = await Promise.all([
          fetch(odbsEndpoint, {
            method: "GET",
            headers: { "X-Token": apiKey, "Accept": "application/json" },
            signal: controller.signal
          }),
          fetch(onusEndpoint, {
            method: "GET",
            headers: { "X-Token": apiKey, "Accept": "application/json" },
            signal: controller.signal
          }).catch(err => {
            console.warn("Failed to fetch ONUs status, proceeding without occupancy data:", err);
            return null;
          })
        ]);

        clearTimeout(timeout);

        if (odbsResponse && odbsResponse.ok) {
          const d = await safeParseResponse(odbsResponse);
          if (d) {
            odbs = d.odbs || d.response || d.data || d.response?.odbs || (Array.isArray(d) ? d : []);
          } else {
            return res.status(500).json({ error: `SmartOLT ODB API returned non-JSON response (possibly HTML or error page)` });
          }
        } else {
          const status = odbsResponse ? odbsResponse.status : "unknown";
          return res.status(500).json({ error: `SmartOLT ODB API returned non-ok status ${status}` });
        }

        if (onusResponse && onusResponse.ok) {
          const d = await safeParseResponse(onusResponse);
          if (d) {
            onus = d.onus || d.onus_statuses || d.data || d.response || d.response?.onus || (Array.isArray(d) ? d : []);
          }
        }
      } catch (err: any) {
        clearTimeout(timeout);
        return res.status(500).json({
          error: "Failed to connect to SmartOLT to retrieve ODBs and ONUs",
          details: formatSmartOltError(err, odbsEndpoint)
        });
      }

      // Cross-reference ONUs to calculate usage for each ODB using robust odb_id linking and fallback isOdpMatched helper
      const enrichedOdbs = odbs.map((odb: any) => {
        if (!odb || !odb.name) return odb;

        const odbIdStr = odb.id ? String(odb.id) : "";
        const matchesByOdbId = onus.filter(onu => {
          if (!onu || !onu.odb_id) return false;
          return String(onu.odb_id) === odbIdStr;
        });

        const matchesByName = onus.filter(onu => {
          const nameMatch = isOdpMatched(onu.name, odb.name);
          const snMatch = isOdpMatched(onu.sn, odb.name);
          const splitterMatch = isOdpMatched(onu.splitter || onu.splitter_name || onu.odb || onu.odb_name, odb.name);
          const commentMatch = isOdpMatched(onu.comment || onu.comments, odb.name);
          return nameMatch || snMatch || splitterMatch || commentMatch;
        });

        const matches = matchesByOdbId.length > 0 ? matchesByOdbId : matchesByName;
        const totalPorts = parseInt(odb.nr_of_ports, 10) || 8;
        // Prioritize attached_onus field from API directly if available
        const apiAttachedOnus = (odb.attached_onus !== undefined && odb.attached_onus !== null) ? parseInt(odb.attached_onus, 10) : null;
        const usedCount = (apiAttachedOnus !== null && !isNaN(apiAttachedOnus)) ? apiAttachedOnus : matches.length;
        const availablePorts = Math.max(0, totalPorts - usedCount);

        return {
          ...odb,
          used_ports: usedCount,
          available_ports: availablePorts
        };
      });

      return res.json({
        status: true,
        isMock: false,
        response: enrichedOdbs
      });
    }

    let endpoint = "";
    if (action === "get_olts") {
      endpoint = `${protocol}${host}/api/system/get_olts`;
    } else if (action === "get_onus_statuses") {
      endpoint = `${protocol}${host}/api/onu/get_onus_statuses`;
    } else {
      return res.status(400).json({ error: `Unsupported action: ${action}` });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const apiResponse = await fetch(endpoint, {
      method: "GET",
      headers: {
        "X-Token": apiKey,
        "Accept": "application/json"
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!apiResponse.ok) {
      const text = await apiResponse.text();
      return res.status(apiResponse.status).json({
        error: `SmartOLT API returned status ${apiResponse.status}`,
        details: text.substring(0, 300)
      });
    }

    const data = await safeParseResponse(apiResponse);
    if (!data) {
      return res.status(500).json({
        error: "SmartOLT API returned non-JSON response (e.g. HTML page)",
        details: "Respons dari server SmartOLT bukan berupa format JSON yang valid."
      });
    }
    return res.json({ ...data, isMock: false });
  } catch (err: any) {
    console.error("SmartOLT Proxy Error:", err);
    const cleanDomain = domain.trim();
    let protocol = "https://";
    let host = cleanDomain;
    if (cleanDomain.startsWith("http://")) { protocol = "http://"; host = cleanDomain.substring(7); }
    else if (cleanDomain.startsWith("https://")) { protocol = "https://"; host = cleanDomain.substring(8); }
    host = host.replace(/^\/+/, "").replace(/\/+$/, "");

    const attemptedEndpoint = `${protocol}${host}/api/system/...`;
    
    // Format error using the helper logic
    const formatSmartOltErrorInner = (e: any, ep: string) => {
      const eMsg = e.message || String(e);
      const isTimeout = eMsg.toLowerCase().includes("timeout") || 
                        (e.cause && String(e.cause).toLowerCase().includes("timeout")) ||
                        e.code === "ETIMEDOUT" ||
                        e.code === "UND_ERR_CONNECT_TIMEOUT";
      if (isTimeout) {
        return `Koneksi Timeout saat menghubungi ${ep}. Gagal tersambung dalam batas waktu (10 detik). Silakan periksa apakah domain/IP benar, port (443/80) terbuka secara publik, dan firewall mengizinkan koneksi masuk (inbound) dari server kami, atau coba gunakan alternatif protokol (http vs https).`;
      }
      if (e.cause) {
        return `Gagal menghubungi ${ep}. Deskripsi Teknis: ${eMsg} (Sebab: ${String(e.cause)}).`;
      }
      return `Gagal menghubungi ${ep}. Deskripsi Teknis: ${eMsg}.`;
    };

    return res.status(500).json({
      error: "Failed to connect to the external SmartOLT host",
      details: formatSmartOltErrorInner(err, attemptedEndpoint)
    });
  }
});

// Synchronize ODP port usage based on SmartOLT data
app.post("/api/integration/smartolt/sync", async (req, res) => {
  const { domain, apiKey } = req.body;
  let onus: any[] = [];
  let odbs: any[] = [];
  let isMock = false;

  const isBlank = !domain || !apiKey || domain.includes("placeholder") || apiKey.includes("your-api-key") || apiKey === "";

  if (isBlank) {
    isMock = true;
    onus = [
      // ODP-MNT-01/08 - has 4 users online/offline/dyinggasp
      { port: 1, name: "Bpk. Hendra Wijaya (John)", sn: "ZTEG11223344", state: "online", signal: "-19.2 dBm", zone: "Menteng", package: "50 Mbps Home", address: "Jl. Menteng No. 12" },
      { port: 2, name: "Ibu Ratna Kumala (Alice)", sn: "ZTEG11223345", state: "online", signal: "-20.1 dBm", zone: "Menteng", package: "30 Mbps Home", address: "Jl. Menteng No. 14" },
      { port: 3, name: "Bpk. Bambang Sutrisno (Bob)", sn: "ZTEG11223346", state: "dyinggasp", signal: "-18.5 dBm (Power Loss)", zone: "Menteng", package: "100 Mbps Pro", address: "Jl. Menteng No. 16B" },
      { port: 4, name: "Klinik Pratama Sehat (Charlie)", sn: "ZTEG11223347", state: "offline", signal: "LOS", zone: "Menteng", package: "50 Mbps Bisnis", address: "Jl. Menteng No. 20" },

      // ODP-MNT-02/16 - has 16 users (Port Penuh)
      { port: 1, name: "Toko Berkah Menteng", sn: "ZTEG22000001", state: "online", signal: "-21.4 dBm", zone: "Menteng" },
      { port: 2, name: "Bpk. Agus Santoso", sn: "ZTEG22000002", state: "online", signal: "-22.0 dBm", zone: "Menteng" },
      { port: 3, name: "Ibu Dewi Lestari", sn: "ZTEG22000003", state: "online", signal: "-19.5 dBm", zone: "Menteng" },
      { port: 4, name: "Warkop Sedap Malam", sn: "ZTEG22000004", state: "online", signal: "-20.8 dBm", zone: "Menteng" },
      { port: 5, name: "Bpk. Rahmat Hidayat", sn: "ZTEG22000005", state: "dyinggasp", signal: "Dying Gasp (PLN Padam)", zone: "Menteng" },
      { port: 6, name: "Kos Menteng Asri", sn: "ZTEG22000006", state: "offline", signal: "LOS", zone: "Menteng" },
      { port: 7, name: "Apotek Sehat Keluarga", sn: "ZTEG22000007", state: "online", signal: "-21.1 dBm", zone: "Menteng" },
      { port: 8, name: "Bpk. Tono Sudirgo", sn: "ZTEG22000008", state: "online", signal: "-22.5 dBm", zone: "Menteng" },
      { port: 9, name: "Ibu Maya Angelina", sn: "ZTEG22000009", state: "online", signal: "-23.0 dBm", zone: "Menteng" },
      { port: 10, name: "Rumah Makan Padang", sn: "ZTEG22000010", state: "online", signal: "-20.4 dBm", zone: "Menteng" },
      { port: 11, name: "Bpk. Eko Prasetyo", sn: "ZTEG22000011", state: "dyinggasp", signal: "Dying Gasp (Power Down)", zone: "Menteng" },
      { port: 12, name: "Ibu Rini Astuti", sn: "ZTEG22000012", state: "online", signal: "-19.9 dBm", zone: "Menteng" },
      { port: 13, name: "Bpk. Dedi Suryadi", sn: "ZTEG22000013", state: "online", signal: "-20.7 dBm", zone: "Menteng" },
      { port: 14, name: "Percetakan Prima Offset", sn: "ZTEG22000014", state: "online", signal: "-21.9 dBm", zone: "Menteng" },
      { port: 15, name: "Laundry Kilat Express", sn: "ZTEG22000015", state: "online", signal: "-22.3 dBm", zone: "Menteng" },
      { port: 16, name: "Bpk. Farhan Hakim", sn: "ZTEG22000016", state: "offline", signal: "LOS", zone: "Menteng" },

      // ODP-MNT-03/08 - has 6 users
      { port: 1, name: "Pelanggan Alpha (A)", sn: "ZTEG33000001", state: "online", signal: "-20.5 dBm", zone: "Menteng" },
      { port: 2, name: "Pelanggan Beta (B)", sn: "ZTEG33000002", state: "online", signal: "-21.2 dBm", zone: "Menteng" },
      { port: 3, name: "Pelanggan Gamma (C)", sn: "ZTEG33000003", state: "online", signal: "-19.8 dBm", zone: "Menteng" },
      { port: 4, name: "Pelanggan Delta (D)", sn: "ZTEG33000004", state: "offline", signal: "LOS (Modem Mati)", zone: "Menteng" },
      { port: 5, name: "Pelanggan Epsilon (E)", sn: "ZTEG33000005", state: "dyinggasp", signal: "Dying Gasp", zone: "Menteng" },
      { port: 6, name: "Pelanggan Zeta (F)", sn: "ZTEG33000006", state: "online", signal: "-23.4 dBm", zone: "Menteng" },

      // ODP-MNT-04/08 - has 7 users
      { port: 1, name: "Bpk. Suryo Subroto", sn: "HWTC44000001", state: "online", signal: "-21.3 dBm", zone: "Menteng" },
      { port: 2, name: "Ibu Kartika Sari", sn: "HWTC44000002", state: "online", signal: "-22.2 dBm", zone: "Menteng" },
      { port: 3, name: "Studio Musik Nada", sn: "HWTC44000003", state: "online", signal: "-19.7 dBm", zone: "Menteng" },
      { port: 4, name: "Bpk. Aris Munandar", sn: "HWTC44000004", state: "dyinggasp", signal: "Dying Gasp", zone: "Menteng" },
      { port: 5, name: "Ibu Lilis Suryani", sn: "HWTC44000005", state: "online", signal: "-20.1 dBm", zone: "Menteng" },
      { port: 6, name: "Warung Kopi Menteng", sn: "HWTC44000006", state: "online", signal: "-21.5 dBm", zone: "Menteng" },
      { port: 7, name: "Bpk. Rudi Hermawan", sn: "HWTC44000007", state: "offline", signal: "LOS", zone: "Menteng" },

      // ODP-MNT-05/16 - has 10 users
      { port: 1, name: "Ibu Indah Permatasari", sn: "HWTC55000001", state: "online", signal: "-20.0 dBm", zone: "Menteng" },
      { port: 2, name: "Ibu Sari Widuri", sn: "HWTC55000002", state: "online", signal: "-19.1 dBm", zone: "Menteng" },
      { port: 3, name: "Bpk. Joko Anwar", sn: "HWTC55000003", state: "dyinggasp", signal: "Dying Gasp (PLN Padam)", zone: "Menteng" },
      { port: 4, name: "Bpk. Wahyu Utomo", sn: "HWTC55000004", state: "online", signal: "-21.8 dBm", zone: "Menteng" },
      { port: 5, name: "Kantor Notaris Menteng", sn: "HWTC55000005", state: "online", signal: "-18.9 dBm", zone: "Menteng" },
      { port: 6, name: "Ibu Fitri Handayani", sn: "HWTC55000006", state: "online", signal: "-22.4 dBm", zone: "Menteng" },
      { port: 7, name: "Bpk. Hendro Kusumo", sn: "HWTC55000007", state: "offline", signal: "LOS (Kabel Putus)", zone: "Menteng" },
      { port: 8, name: "Ibu Ningsih", sn: "HWTC55000008", state: "online", signal: "-21.0 dBm", zone: "Menteng" },
      { port: 9, name: "Bpk. Yudi Pratama", sn: "HWTC55000009", state: "online", signal: "-20.3 dBm", zone: "Menteng" },
      { port: 10, name: "Ibu Tari Agustina", sn: "HWTC55000010", state: "online", signal: "-19.6 dBm", zone: "Menteng" },

      // ODP-MNT-06/08 - has 8 users (Penuh)
      { port: 1, name: "Bpk. Bagus Priyadi (P1)", sn: "HWTC66000001", state: "online", signal: "-18.9 dBm", zone: "Menteng" },
      { port: 2, name: "Ibu Clara Shinta (P2)", sn: "HWTC66000002", state: "online", signal: "-19.4 dBm", zone: "Menteng" },
      { port: 3, name: "Bpk. Danang Joyo (P3)", sn: "HWTC66000003", state: "dyinggasp", signal: "Dying Gasp", zone: "Menteng" },
      { port: 4, name: "Ibu Erika Permata (P4)", sn: "HWTC66000004", state: "online", signal: "-21.3 dBm", zone: "Menteng" },
      { port: 5, name: "Bpk. Faisal Akbar (P5)", sn: "HWTC66000005", state: "online", signal: "-19.8 dBm", zone: "Menteng" },
      { port: 6, name: "Ibu Gina Novita (P6)", sn: "HWTC66000006", state: "online", signal: "-20.5 dBm", zone: "Menteng" },
      { port: 7, name: "Bpk. Hari Suwandi (P7)", sn: "HWTC66000007", state: "offline", signal: "LOS", zone: "Menteng" },
      { port: 8, name: "Ibu Hani Rosalina (P8)", sn: "HWTC66000008", state: "online", signal: "-21.7 dBm", zone: "Menteng" },

      // ODP-MNT-07/08 - New mock ODP to demonstrate auto import!
      { port: 1, name: "Klien1_ODP-MNT-07", sn: "HWTC77000001", state: "online", signal: "-19.5 dBm", zone: "Menteng" },
      { port: 2, name: "Klien2_ODP-MNT-07", sn: "HWTC77000002", state: "online", signal: "-20.4 dBm", zone: "Menteng" },
      { name: "Klien3_ODP-MNT-07", sn: "HWTC77000003", state: "offline", signal: "LOS", zone: "Menteng" }
    ];

    odbs = [
      { id: 101, name: "ODP-MNT-01", zone: "Menteng", nr_of_ports: 8, latitude: "-6.184200", longitude: "106.822800" },
      { id: 102, name: "ODP-MNT-02", zone: "Menteng", nr_of_ports: 16, latitude: "-6.185500", longitude: "106.824200" },
      { id: 103, name: "ODP-MNT-03", zone: "Menteng", nr_of_ports: 8, latitude: "-6.186800", longitude: "106.821500" },
      { id: 104, name: "ODP-MNT-04", zone: "Menteng", nr_of_ports: 8, latitude: "-6.182500", longitude: "106.825000" },
      { id: 105, name: "ODP-MNT-05", zone: "Menteng", nr_of_ports: 16, latitude: "-6.181200", longitude: "106.820200" },
      { id: 106, name: "ODP-MNT-06", zone: "Menteng", nr_of_ports: 8, latitude: "-6.185900", longitude: "106.818800" },
      { id: 107, name: "ODP-MNT-07", zone: "Menteng", nr_of_ports: 8, latitude: "-6.183000", longitude: "106.821000" } // Automatically imported in mock mode!
    ];
  } else {
    let odbsEndpoint = "";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const trimmed = domain.trim();
      let protocol = "https://";
      let host = trimmed;
      
      if (trimmed.startsWith("http://")) {
        protocol = "http://";
        host = trimmed.substring(7);
      } else if (trimmed.startsWith("https://")) {
        protocol = "https://";
        host = trimmed.substring(8);
      }
      
      // Clean host
      host = host.replace(/^\/+/, "").replace(/\/+$/, "");

      const detailsEndpoint = `${protocol}${host}/api/onu/get_all_onus_details`;
      const onusEndpoint = `${protocol}${host}/api/onu/get_onus_statuses`;
      odbsEndpoint = `${protocol}${host}/api/system/get_odbs`;

      // Fetch ONUs details and live statuses concurrently
      try {
        const [detailsRes, statusRes] = await Promise.all([
          fetch(detailsEndpoint, {
            method: "GET",
            headers: { "X-Token": apiKey, "Accept": "application/json" },
            signal: controller.signal
          }).catch(err => {
            console.warn("Could not fetch ONU details during sync:", err?.message || err);
            return null;
          }),
          fetch(onusEndpoint, {
            method: "GET",
            headers: { "X-Token": apiKey, "Accept": "application/json" },
            signal: controller.signal
          }).catch(err => {
            console.warn("Could not fetch ONU statuses during sync:", err?.message || err);
            return null;
          })
        ]);

        let rawDetails: any[] = [];
        let rawStatuses: any[] = [];

        if (detailsRes && detailsRes.ok) {
          const d = await safeParseResponse(detailsRes);
          if (d) {
            rawDetails = d.onus || d.onus_details || d.data || d.response || d.response?.onus || (Array.isArray(d) ? d : []);
          }
        }

        if (statusRes && statusRes.ok) {
          const s = await safeParseResponse(statusRes);
          if (s) {
            rawStatuses = s.onus || s.onus_statuses || s.data || s.response || s.response?.onus || (Array.isArray(s) ? s : []);
          }
        }

        if (rawDetails.length > 0) {
          const statusMap = new Map<string, any>();
          for (const st of rawStatuses) {
            if (st.sn) statusMap.set(String(st.sn).toLowerCase().trim(), st);
            if (st.name) statusMap.set(String(st.name).toLowerCase().trim(), st);
          }

          onus = rawDetails.map((det) => {
            const snKey = (det.sn || "").toLowerCase().trim();
            const nameKey = (det.name || "").toLowerCase().trim();
            const matchingStatus = statusMap.get(snKey) || statusMap.get(nameKey) || {};
            return {
              ...det,
              ...matchingStatus,
              odb_port: det.odb_port ?? det.splitter_port ?? matchingStatus.odb_port,
              state: matchingStatus.state || matchingStatus.status || det.status || det.state || "online",
              signal: matchingStatus.signal || det.signal
            };
          });
        } else if (rawStatuses.length > 0) {
          onus = rawStatuses;
        }
      } catch (erronu) {
        console.warn("Could not parse ONUs during sync, proceeding with ODBs only:", erronu);
      }

      // Fetch ODBs (mandatory for sync)
      const odbsResponse = await fetch(odbsEndpoint, {
        method: "GET",
        headers: { "X-Token": apiKey, "Accept": "application/json" },
        signal: controller.signal
      });

      if (odbsResponse.ok) {
        const d = await safeParseResponse(odbsResponse);
        if (d) {
          odbs = d.odbs || d.response || d.data || d.response?.odbs || (Array.isArray(d) ? d : []);
        } else {
          throw new Error("SmartOLT ODB API returned non-JSON response (e.g. HTML login or error page)");
        }
      } else {
        throw new Error(`SmartOLT ODB API returned status ${odbsResponse.status}`);
      }

      clearTimeout(timeout);
    } catch (err: any) {
      clearTimeout(timeout);
      
      const formatSmartOltErrorInner = (e: any, ep: string) => {
        const eMsg = e.message || String(e);
        const isAbort = e.name === "AbortError" || eMsg.toLowerCase().includes("abort");
        if (isAbort) {
          return `Koneksi terputus (Timeout 30 detik) saat menghubungi ${ep}. Server SmartOLT Anda tidak merespons tepat waktu. Silakan periksa kembali apakah server SmartOLT online dan port/firewall mengizinkan koneksi masuk (inbound) dari server kami.`;
        }
        const isTimeout = eMsg.toLowerCase().includes("timeout") || 
                          (e.cause && String(e.cause).toLowerCase().includes("timeout")) ||
                          e.code === "ETIMEDOUT" ||
                          e.code === "UND_ERR_CONNECT_TIMEOUT";
        if (isTimeout) {
          return `Koneksi Timeout saat menghubungi ${ep}. Gagal tersambung dalam batas waktu (10 detik). Silakan periksa apakah domain/IP benar, port (443/80) terbuka secara publik, dan firewall mengizinkan koneksi masuk (inbound) dari server kami, atau coba gunakan alternatif protokol (http vs https).`;
        }
        const isRefused = eMsg.toLowerCase().includes("refused") || 
                          (e.cause && String(e.cause).toLowerCase().includes("refused")) ||
                          e.code === "ECONNREFUSED";
        if (isRefused) {
          return `Koneksi Ditolak (Connection Refused) saat menghubungi ${ep}. Server target aktif tetapi secara aktif menolak koneksi pada port tersebut. Silakan periksa apakah service SmartOLT sedang berjalan pada port yang tepat, atau tambahkan nomor port khusus jika diperlukan (contoh: domain.com:8080).`;
        }
        if (e.cause) {
          return `Gagal menghubungi ${ep}. Deskripsi Teknis: ${eMsg} (Sebab: ${String(e.cause)}).`;
        }
        return `Gagal menghubungi ${ep}. Deskripsi Teknis: ${eMsg}.`;
      };

      const finalEp = odbsEndpoint || `${domain}/api/system/get_odbs`;

      return res.status(500).json({
        error: "Failed to fetch synchronization data from SmartOLT",
        details: formatSmartOltErrorInner(err, finalEp)
      });
    }
  }

  // Get current state of local ODPs
  const currentOdps = loadODPs();
  const logs: string[] = [];
  let syncCount = 0;

  // Let's copy currentOdps into a mutable map/array for updates
  const finalOdps: ODP[] = [...currentOdps];

  // 1. Process all ODBs from SmartOLT to update existing or auto-import new ones!
  if (Array.isArray(odbs) && odbs.length > 0) {
    odbs.forEach(odb => {
      if (!odb || !odb.name) return;

      const odbBaseName = odb.name.split("/")[0].trim().toLowerCase();

      // Find if we already have this ODP in our database
      const existingIdx = finalOdps.findIndex(o => {
        if (o.smartOltId && odb.id && String(o.smartOltId) === String(odb.id)) {
          return true;
        }
        const localBaseName = o.name.split("/")[0].trim().toLowerCase();
        return localBaseName === odbBaseName || o.name.toLowerCase() === odb.name.toLowerCase();
      });

      const totalPorts = parseInt(odb.nr_of_ports, 10) || 8;
      
      // Clean leading/trailing commas and spaces in coordinates if present
      let lat: number | null = null;
      let lng: number | null = null;
      if (odb.latitude) {
        const latClean = String(odb.latitude).replace(/,/g, "").trim();
        const val = parseFloat(latClean);
        if (!isNaN(val)) lat = val;
      }
      if (odb.longitude) {
        const lngClean = String(odb.longitude).replace(/,/g, "").trim();
        const val = parseFloat(lngClean);
        if (!isNaN(val)) lng = val;
      }

      if (existingIdx !== -1) {
        // Update existing ODP details if values are provided and changed
        let updated = false;
        const target = finalOdps[existingIdx];

        if (target.smartOltId !== String(odb.id)) {
          target.smartOltId = String(odb.id);
          updated = true;
        }
        if (lat !== null && target.lat !== lat) {
          target.lat = lat;
          updated = true;
        }
        if (lng !== null && target.lng !== lng) {
          target.lng = lng;
          updated = true;
        }
        if (target.totalPorts !== totalPorts) {
          target.totalPorts = totalPorts;
          updated = true;
        }

        if (updated) {
          syncCount++;
          logs.push(`SINKRONISASI: ODP "${target.name}" diselaraskan koordinat & kapasitas dari SmartOLT.`);
        }
      } else {
        // Auto-Import new ODP!
        const defaultLat = lat !== null ? lat : -6.825885;
        const defaultLng = lng !== null ? lng : 107.133554;

        const importedOdp: ODP = {
          id: `odp-sync-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: odb.name,
          lat: defaultLat,
          lng: defaultLng,
          totalPorts: totalPorts,
          availablePorts: totalPorts, // will be calculated below
          smartOltId: String(odb.id)
        };

        finalOdps.push(importedOdp);
        syncCount++;
        logs.push(`AUTO-IMPORT: Menemukan ODP Baru "${odb.name}" di SmartOLT. Kapasitas ${totalPorts} Port.`);
      }
    });
  }

  // 2. Now calculate port availability (ONUs connected to each ODP)
  const fullySyncedOdps = finalOdps.map(odp => {
    // Try to find the original SmartOLT ODB object to use its direct attached_onus field
    let apiUsedCount: number | null = null;
    if (Array.isArray(odbs)) {
      const matchingOdb = odbs.find(o => {
        if (!o) return false;
        if (odp.smartOltId && o.id && String(o.id) === String(odp.smartOltId)) {
          return true;
        }
        if (!o.name) return false;
        const odbBaseName = o.name.split("/")[0].trim().toLowerCase();
        const localBaseName = odp.name.split("/")[0].trim().toLowerCase();
        return odbBaseName === localBaseName || o.name.toLowerCase() === odp.name.toLowerCase();
      });
      if (matchingOdb && matchingOdb.attached_onus !== undefined && matchingOdb.attached_onus !== null) {
        const val = parseInt(matchingOdb.attached_onus, 10);
        if (!isNaN(val)) {
          apiUsedCount = val;
        }
      }
    }

    // Filter ONUs whose odb_id matches the ODB id
    const matchesByOdbId = onus.filter(onu => {
      if (!onu || !onu.odb_id) return false;
      return odp.smartOltId && String(onu.odb_id) === String(odp.smartOltId);
    });

    // Fallback/Verify with name matching
    const matchesByName = onus.filter(onu => {
      const nameMatch = isOdpMatched(onu.name, odp.name);
      const snMatch = isOdpMatched(onu.sn, odp.name);
      const zoneMatch = isOdpMatched(onu.zone || onu.zone_name, odp.name);
      const splitterMatch = isOdpMatched(onu.splitter || onu.splitter_name || onu.odb || onu.odb_name, odp.name);
      const commentMatch = isOdpMatched(onu.comment || onu.comments, odp.name);

      return nameMatch || snMatch || zoneMatch || splitterMatch || commentMatch;
    });

    const matches = matchesByOdbId.length > 0 ? matchesByOdbId : matchesByName;
    const usedCount = apiUsedCount !== null ? apiUsedCount : matches.length;
    const newAvailable = Math.max(0, odp.totalPorts - usedCount);

    if (odp.availablePorts !== newAvailable) {
      syncCount++;
      logs.push(`KETERSEDIAAN PORT: ODP "${odp.name}" terpakai ${usedCount}/${odp.totalPorts} (Port Tersedia: ${newAvailable}).`);
    }

    // Map matched ONUs to customers with exact SmartOLT port and online/offline/los/dyinggasp status
    let syncedCustomers = odp.customers ? [...odp.customers] : [];
    if (matches.length > 0) {
      // 2-Pass allocation to strictly match SmartOLT ports
      const occupiedPorts = new Set<number>();
      const portAssignment = new Map<any, number>();

      // Pass 1: Assign exact explicit SmartOLT ports first (no shifting!)
      for (const m of matches) {
        const explicit = getExplicitSmartOltPort(m, odp.totalPorts);
        if (explicit !== null && !occupiedPorts.has(explicit)) {
          portAssignment.set(m, explicit);
          occupiedPorts.add(explicit);
        }
      }

      // Pass 2: Remaining ONUs without explicit port or with collision
      for (const m of matches) {
        if (!portAssignment.has(m)) {
          let vacant = 1;
          while (occupiedPorts.has(vacant)) {
            vacant++;
          }
          portAssignment.set(m, vacant);
          occupiedPorts.add(vacant);
        }
      }

      syncedCustomers = matches.map((m, idx) => {
        let custStatus: CustomerStatus = "online";
        const st = (m.state || m.status || "").toLowerCase().trim();
        const sig = (m.signal || "").toLowerCase().trim();

        if (st.includes("dying") || st.includes("gasp") || st.includes("power")) {
          custStatus = "dyinggasp";
        } else if (
          st === "los" ||
          st.includes("los") ||
          st.includes("loss") ||
          st.includes("fiber") ||
          st.includes("kabel") ||
          sig === "los" ||
          sig.includes("los")
        ) {
          custStatus = "los";
        } else if (
          st.includes("off") ||
          st.includes("mati") ||
          st.includes("down") ||
          st.includes("disable") ||
          st.includes("dereg") ||
          st.includes("inactive") ||
          st.includes("suspend") ||
          st.includes("isolir")
        ) {
          custStatus = "offline";
        } else {
          custStatus = "online";
        }

        const assignedPort = portAssignment.get(m) || (idx + 1);

        return {
          id: `cust-${m.sn || idx}-${m.id || Date.now()}`,
          port: assignedPort,
          name: m.name || `Pelanggan Port ${assignedPort}`,
          status: custStatus,
          onuSn: m.sn || undefined,
          onuModel: m.onu_model || m.model || "ZTE F609",
          address: m.address || m.zone || undefined,
          pluggedAt: m.registration_date || new Date().toISOString().split("T")[0]
        };
      });
      syncedCustomers.sort((a, b) => a.port - b.port);
    }

    return {
      ...odp,
      availablePorts: newAvailable,
      customers: syncedCustomers
    };
  });

  // Save the synchronized ODP list to db
  saveODPs(fullySyncedOdps);

  return res.json({
    success: true,
    syncCount,
    logs,
    isMock,
    totalOnusScanned: onus.length,
    odps: fullySyncedOdps
  });
});

// Proxy integration for GenieACS
app.post("/api/integration/genieacs", async (req, res) => {
  const { hostUrl, username, password, query } = req.body;

  const isMock = !hostUrl || hostUrl.includes("placeholder") || hostUrl.includes("example.com");

  if (isMock) {
    // Simulated sandbox mode
    return res.json({
      isMock: true,
      message: "SIMULATED SUCCESS (SANDBOX MODE)",
      devices: [
        {
          _id: "000000-ZTEG-ZTEG12345678",
          "InternetGatewayDevice.DeviceInfo.HardwareVersion": { _value: "F609 V5" },
          "InternetGatewayDevice.DeviceInfo.SoftwareVersion": { _value: "V5.2.1" },
          "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress": { _value: "103.82.14.95" },
          "VirtualParameters.SignalStrength": { _value: "-20.1" },
          "InternetGatewayDevice.DeviceInfo.UpTime": { _value: "84620" }
        },
        {
          _id: "000000-Huawei-HWTC87654321",
          "InternetGatewayDevice.DeviceInfo.HardwareVersion": { _value: "HG8245H" },
          "InternetGatewayDevice.DeviceInfo.SoftwareVersion": { _value: "V3R015C10S106" },
          "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress": { _value: "103.82.15.110" },
          "VirtualParameters.SignalStrength": { _value: "-23.5" },
          "InternetGatewayDevice.DeviceInfo.UpTime": { _value: "194021" }
        }
      ]
    });
  }

  try {
    const cleanHost = hostUrl.replace(/\/$/, "");
    const endpoint = `${cleanHost}/devices?projection=InternetGatewayDevice.DeviceInfo,InternetGatewayDevice.WANDevice,VirtualParameters`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const headers: Record<string, string> = {
      "Accept": "application/json"
    };

    if (username && password) {
      const encoded = Buffer.from(`${username}:${password}`).toString("base64");
      headers["Authorization"] = `Basic ${encoded}`;
    }

    const apiResponse = await fetch(endpoint, {
      method: "GET",
      headers,
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!apiResponse.ok) {
      const text = await apiResponse.text();
      return res.status(apiResponse.status).json({
        error: `GenieACS returned status ${apiResponse.status}`,
        details: text.substring(0, 300)
      });
    }

    const data = await safeParseResponse(apiResponse);
    if (!data) {
      return res.status(500).json({
        error: "GenieACS returned non-JSON response (e.g. HTML login or error page)",
        details: "Respons dari server GenieACS bukan berupa format JSON yang valid."
      });
    }
    return res.json({ devices: data, isMock: false });
  } catch (err: any) {
    console.error("GenieACS Proxy Error:", err);
    const isAbort = err.name === "AbortError" || err.message?.toLowerCase().includes("abort");
    const details = isAbort
      ? "Koneksi terputus (Timeout 30 detik). Server GenieACS Anda tidak merespons tepat waktu. Silakan periksa kembali apakah domain/IP server GenieACS Anda dapat diakses secara publik dan tidak diblokir oleh firewall, atau gunakan Mode Simulasi (kosongkan form)."
      : (err.message || String(err));
    return res.status(500).json({
      error: "Failed to connect to the external GenieACS host",
      details
    });
  }
});

// 5. Seed test ODPs around a user coordinate (makes testing easy in any region!)
app.post("/api/seed-odps", (req, res) => {
  const { lat, lng } = req.body;
  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ error: "Latitude and Longitude are required to seed ODPs." });
  }

  const centerLat = Number(lat);
  const centerLng = Number(lng);
  const odps = loadODPs();

  const prefixes = ["ODP-MNT", "ODP-JKT", "ODP-IND", "ODP-TEST"];
  const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];

  // Generate 6 random ODPs around the given center within ~500 meters
  const newSeededOdps: ODP[] = [];
  for (let i = 1; i <= 6; i++) {
    // 0.001 degree is approx 111 meters
    const offsetLat = (Math.random() - 0.5) * 0.008; // approx +/- 400 meters
    const offsetLng = (Math.random() - 0.5) * 0.008; // approx +/- 400 meters
    
    const totalPorts = Math.random() > 0.4 ? 8 : 16;
    const availablePorts = Math.random() > 0.35 ? Math.floor(Math.random() * (totalPorts - 1)) + 1 : 0; // some full

    newSeededOdps.push({
      id: `odp-seed-${Date.now()}-${i}`,
      name: `${randomPrefix}-SEEDED-${String(i).padStart(2, "0")}`,
      lat: Number((centerLat + offsetLat).toFixed(6)),
      lng: Number((centerLng + offsetLng).toFixed(6)),
      totalPorts,
      availablePorts
    });
  }

  const merged = [...odps, ...newSeededOdps];
  saveODPs(merged);
  res.status(201).json({
    message: "6 ODPs successfully seeded around your coordinates!",
    seeded: newSeededOdps
  });
});

// 6. Reset database to default ODPs
app.post("/api/reset-db", (req, res) => {
  saveODPs(DEFAULT_ODPS);
  res.json({ message: "Database reset to original ODPs", odps: DEFAULT_ODPS });
});

// Vite Middleware integration for Fullstack mode
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
