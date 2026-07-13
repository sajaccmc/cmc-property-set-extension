let API = null;
let accessToken = null;
let currentProject = null;

// STEP 1: Connect to Trimble Connect Workspace API
async function initExtension() {
API = await TrimbleConnectWorkspace.connect(
window.parent,
(event, args) => {
switch (event) {
case "extension.accessToken":
accessToken = args.data;
console.log("Access token received");
break;
case "extension.command":
console.log("Command:", args.data);
break;
}
},
30000
);

// Set the left-nav menu
API.ui.setMenu({
title: "CMC Property Sets",
icon: "https://cdn-icons-png.flaticon.com/32/2921/2921222.png",
command: "cmc_main_menu"
});

// Get current project context
currentProject = await API.project.getCurrentProject();
console.log("Project:", currentProject);

// Request access token (needed for PSet API calls)
const tokenResp = await API.extension.requestPermission("accesstoken");
if (tokenResp !== "pending" && tokenResp !== "denied") {
accessToken = tokenResp;
}
}

// STEP 2: Handle the button click
document.getElementById("createBtn").addEventListener("click", async () => {
const statusEl = document.getElementById("status");
const btn = document.getElementById("createBtn");
btn.disabled = true;
statusEl.className = "info";
statusEl.textContent = "Creating property set library...";

try {
if (!accessToken) {
throw new Error("No access token. Please grant permission first.");
}
await createCmcDefaultLibrary();
statusEl.className = "success";
statusEl.textContent = "✅ CMC-Default library created successfully!";
} catch (err) {
console.error(err);
statusEl.className = "error";
statusEl.textContent = "❌ Error: " + err.message;
} finally {
btn.disabled = false;
}
});

// STEP 3: Create the library + definitions via PSet REST API
async function createCmcDefaultLibrary() {
const PSET_BASE = "https://pset-api.connect.trimble.com/v1";
const projectFrn = `frn:tc:project:${currentProject.id}`;

// 3a: Create the library "CMC-Default"
const libResp = await fetch(`${PSET_BASE}/libs`, {
method: "POST",
headers: {
"Authorization": `Bearer ${accessToken}`,
"Content-Type": "application/json"
},
body: JSON.stringify({
name: "CMC-Default",
description: "CMC standard property sets",
links: [projectFrn] // ties library to the current project
})
});
if (!libResp.ok) throw new Error(`Library creation failed: ${libResp.status}`);
const lib = await libResp.json();
const libId = lib.id;

// 3b: Create Definition #1 — "Requested Date"
await fetch(`${PSET_BASE}/libs/${libId}/defs`, {
method: "POST",
headers: {
"Authorization": `Bearer ${accessToken}`,
"Content-Type": "application/json"
},
body: JSON.stringify({
name: "Requested Date",
applicableTypes: ["BEAM", "COLUMN", "REBAR", "FILE"],
schema: {
properties: {
requestedDate: {
type: "string",
format: "date",
title: "Requested Date"
}
}
}
})
});

// 3c: Create Definition #2 — "Rebar Status" (dropdown)
await fetch(`${PSET_BASE}/libs/${libId}/defs`, {
method: "POST",
headers: {
"Authorization": `Bearer ${accessToken}`,
"Content-Type": "application/json"
},
body: JSON.stringify({
name: "Rebar Status",
applicableTypes: ["BEAM", "COLUMN", "REBAR"],
schema: {
properties: {
rebarStatus: {
type: "string",
title: "Rebar Status",
enum: ["Complete", "Pending"]
}
}
}
})
});
}

// Start the extension
initExtension();

