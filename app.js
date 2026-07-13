// ===== CMC Property Set Extension =====
let API = null;
let accessToken = null;
let currentProject = null;

const PSET_BASE = "https://pset-api.connect.trimble.com/v1";

const LIB_ID = "cmc-default-library-v1";
const DEF_REQUESTED_DATE_ID = "cmc-def-requested-date-v1";
const DEF_REBAR_STATUS_ID = "cmc-def-rebar-status-v1";

const DEBUG = true;
function log(...args) { if (DEBUG) console.log("[CMC-Ext]", ...args); }

// ---------- Init ----------
async function initExtension() {
log("Initializing extension...");

API = await TrimbleConnectWorkspace.connect(
window.parent,
(event, args) => {
log("Event received:", event, args);
if (event === "extension.accessToken") {
accessToken = args.data;
log("Token via event, length:", accessToken?.length);
}
},
30000
);
log("Connected to Workspace API");

API.ui.setMenu({
title: "CMC Property Sets",
icon: "https://cdn-icons-png.flaticon.com/32/2921/2921222.png",
command: "cmc_main_menu"
});

currentProject = await API.project.getCurrentProject();
log("Project loaded:", currentProject);

const tokenResp = await API.extension.requestPermission("accesstoken");
log("Token permission response:", tokenResp);
if (tokenResp !== "pending" && tokenResp !== "denied") {
accessToken = tokenResp;
log("Token stored, length:", accessToken.length);
}
}

// ---------- Button Handler ----------
document.getElementById("createBtn").addEventListener("click", async () => {
const btn = document.getElementById("createBtn");
btn.disabled = true;
showStatus("info", "Working... (check DevTools Console for details)");

try {
if (!accessToken) throw new Error("No access token. Grant permission and refresh.");
log("Starting library creation with token length:", accessToken.length);

await ensureCmcDefaultLibrary();

log("Verifying by fetching library...");
const verify = await getLibrary(LIB_ID);
log("Verification result:", verify);

if (!verify) {
throw new Error("Library was NOT created — verification GET returned null.");
}

showStatus("success",
`✅ Verified!
Library ID: ${verify.id}
Library Name: ${verify.name || "(no name)"}
`);
} catch (err) {
console.error("Full error:", err);
showStatus("error", "❌ " + err.message);
} finally {
btn.disabled = false;
}
});

function showStatus(cls, msg) {
const el = document.getElementById("status");
el.className = cls;
el.style.whiteSpace = "pre-line";
el.textContent = msg;
}

// ---------- Core Logic ----------
async function ensureCmcDefaultLibrary() {
let library = await getLibrary(LIB_ID);
if (library) {
log("Library already exists");
} else {
log("Creating library...");
library = await createLibrary();
}

await ensureDefinition(DEF_REQUESTED_DATE_ID, buildRequestedDateDef());
await ensureDefinition(DEF_REBAR_STATUS_ID, buildRebarStatusDef());
return library;
}

// ---------- API Wrapper with Full Logging ----------
async function apiCall(method, path, body = null) {
const url = `${PSET_BASE}${path}`;
log(`→ ${method} ${url}`);
if (body) log(" Body:", JSON.stringify(body, null, 2));

const opts = {
method: method,
headers: {
"Authorization": `Bearer ${accessToken}`,
"Accept": "application/json"
}
};
if (body) {
opts.headers["Content-Type"] = "application/json";
opts.body = JSON.stringify(body);
}

const resp = await fetch(url, opts);
const text = await resp.text();
log(`← ${resp.status} ${resp.statusText}`);
log(" Response body:", text);

if (resp.status === 404) return null;
if (!resp.ok) {
throw new Error(`${method} ${path} failed: ${resp.status} — ${text}`);
}
return text ? JSON.parse(text) : {};
}

async function getLibrary(libId) {
return await apiCall("GET", `/libs/${libId}`);
}

async function getDefinition(libId, defId) {
return await apiCall("GET", `/libs/${libId}/defs/${defId}`);
}

async function createLibrary() {
const projectFrn = `frn:tc:project:${currentProject.id}`;
return await apiCall("POST", "/libs", {
id: LIB_ID,
name: "CMC-Default",
description: "CMC standard property sets",
links: [projectFrn]
});
}

async function ensureDefinition(defId, defBody) {
const existing = await getDefinition(LIB_ID, defId);
if (existing) {
log(`Definition ${defId} already exists`);
return existing;
}
return await apiCall("POST", `/libs/${LIB_ID}/defs`, { ...defBody, id: defId });
}

// ---------- Definition Schemas (CORRECTED FORMAT) ----------
function buildRequestedDateDef() {
return {
name: "Requested Date",
description: "Date this item was requested",
applicableTypes: ["FILE", "TODO", "BEAM", "COLUMN"],
schema: {
props: { // ← MUST be "props", not "properties"
requestedDate: {
type: "string",
format: "date"
}
}
},
i18n: {
en: {
name: "Requested Date",
props: {
requestedDate: "Requested Date"
}
}
}
};
}

function buildRebarStatusDef() {
return {
name: "Rebar Status",
description: "Current status of rebar element",
applicableTypes: ["FILE", "TODO", "BEAM", "COLUMN"],
schema: {
props: { // ← MUST be "props", not "properties"
rebarStatus: {
type: "string",
enum: ["Complete", "Pending"]
}
}
},
i18n: {
en: {
name: "Rebar Status",
props: {
rebarStatus: "Rebar Status",
"rebarStatus.enum.Complete": "Complete",
"rebarStatus.enum.Pending": "Pending"
}
}
}
};
}

// Kick off
initExtension();

