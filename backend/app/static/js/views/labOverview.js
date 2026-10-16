import { api } from "../api.js?v=1";
import { getUser, getPortalId, logout } from "../auth.js?v=1";

let overviewTimer = null;

function formatPatientMriId(scan) {
  const match = String(scan.patient_id || "").match(/^(?:MRI[-_ ]?)?(\d+)$/i);
  return match ? `MRI-${String(match[1]).padStart(3, "0")}` : "—";
}

function getAiStatus(scan) {
  if (scan.ai_status === "AI Flagged") return { label: "AI Flagged", className: "badge-rose" };
  if (scan.ai_status === "AI Cleared") return { label: "Normal", className: "badge-emerald" };
  return { label: "Awaiting Analysis", className: "badge-amber" };
}

export function renderLabOverview(container) {
  if (overviewTimer) clearInterval(overviewTimer);

  const user = getUser() || {};
  const portalId = getPortalId(user);
  container.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div>
          <div class="sidebar-brand">
            <img class="sidebar-brand-icon" src="/assets/medisense-mark.png" alt="MediSense AI">
            <div>
              <div class="sidebar-brand-title">MediSense AI</div>
              <div class="sidebar-brand-subtitle">Lab Technician</div>
            </div>
          </div>
          <nav class="sidebar-nav">
            <a href="#/lab-dashboard">Dashboard</a>
            <a href="#/lab-pending">Pending Orders</a>
            <a href="#/lab">Upload Scan</a>
            <a href="#/lab-overview" class="active">Scan Overview</a>
            <a href="#/lab-vitals">Vitals</a>
            <a href="#/lab-lookup">Patient Lookup</a>
            <a href="#/lab-history">Scan History</a>
            <a href="#/queue">Live Queue</a>
          </nav>
        </div>
        <div class="sidebar-footer">
          <div class="flex items-center gap-3">
            <div class="user-avatar">LT</div>
            <div>
              <div class="user-name">${user.full_name || "Lab Tech"}</div>
              <div class="user-role">● Lab Online</div>
            </div>
          </div>
          <button id="logoutBtn" class="sidebar-logout-btn">Logout</button>
        </div>
      </aside>
      <main class="main">
        <header class="top-header">
          <div>
            <div class="page-title">Scan Overview</div>
            <div class="text-xs text-muted" style="margin-top:0.25rem;">Normal scans, AI flagged findings and analysis status.</div>
          </div>
        </header>
        <div class="content">
          <div class="card">
            <div class="flex items-center justify-between mb-3">
              <div class="card-title" style="margin:0;">Recent Scan Results</div>
              <span class="badge badge-blue" title="Your unique MediSense portal ID">ID: ${portalId}</span>
            </div>
            <div id="overviewTable" class="loading">Loading...</div>
          </div>
        </div>
      </main>
    </div>`;

  container.querySelector("#logoutBtn")?.addEventListener("click", logout);
  loadOverview();
  overviewTimer = setInterval(loadOverview, 15000);
}

async function loadOverview() {
  const panel = document.getElementById("overviewTable");
  if (!panel) {
    if (overviewTimer) clearInterval(overviewTimer);
    return;
  }

  const { data } = await api.get("/api/imaging/recent-scans?limit=50");
  if (!document.getElementById("overviewTable")) return;
  if (!data?.ok || !data.data?.length) {
    panel.innerHTML = `<div class="text-muted">No scan results available.</div>`;
    return;
  }

  panel.innerHTML = `
    <div class="table-scroll">
      <table class="table">
        <thead><tr><th>Patient MRI ID</th><th>Patient</th><th>Scan Type</th><th>Result</th><th>Confidence</th><th>Uploaded</th></tr></thead>
        <tbody>${data.data.map((scan) => {
          const status = getAiStatus(scan);
          const date = scan.uploaded_at ? new Date(scan.uploaded_at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" }) : "—";
          return `<tr><td><code class="patient-id">${formatPatientMriId(scan)}</code></td><td>${scan.patient_name || "Unknown"}</td><td>${scan.scan_type || "—"}</td><td><span class="badge ${status.className}">${status.label}</span></td><td>${scan.confidence_score != null ? `${scan.confidence_score}%` : "—"}</td><td class="text-muted">${date}</td></tr>`;
        }).join("")}</tbody>
      </table>
    </div>`;
}
