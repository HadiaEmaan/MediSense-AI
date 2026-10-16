import { api } from "../api.js?v=1";
import { patientSidebar, patientPortalId, bindPatientLogout } from "./patientShared.js?v=2";

export function renderPatientReports(container) {
  container.innerHTML = `
    <style>
      .custom-dl-btn {
        background-color: #1d4ed8 !important;
        color: #ffffff !important;
        border: none !important;
        transition: background-color 0.2s ease;
      }
      .custom-dl-btn:hover {
        background-color: #d5ece6 !important;
        color: #18594f !important;
      }
      .custom-print-btn {
        background-color: #475569 !important;
        color: #ffffff !important;
        border: none !important;
        transition: background-color 0.2s ease;
      }
      .custom-print-btn:hover {
        background-color: #d5ece6 !important;
        color: #18594f !important;
      }
    </style>
    <div class="app-shell">
      ${patientSidebar("#/patient-reports")}
      <main class="main">
        <header class="top-header">
          <div>
            <div class="page-title">My Medical Folder</div>
            <div class="text-xs text-muted" style="margin-top:0.25rem;">All your health records, prescriptions, lab reports and scans in one place.</div>
          </div>
          <div class="flex items-center gap-2">
            ${patientPortalId()}
          </div>
        </header>
        <div class="content">
          <div class="pt-folder-tabs mb-3">
            <button class="pt-folder-tab active" data-tab="records">Prescription Slips</button>
            <button class="pt-folder-tab" data-tab="scans">Lab Reports & Scans</button>
          </div>
          <div id="tabRecords" class="pt-folder-panel">
            <div id="recordsPanel" class="loading">Loading prescriptions...</div>
          </div>
          <div id="tabScans" class="pt-folder-panel" style="display:none;">
            <div class="card mb-3">
              <div class="flex items-center gap-3 flex-wrap">
                <select id="typeFilter" class="admin-filter">
                  <option value="">All Types</option>
                  <option value="MRI">MRI</option>
                  <option value="CT">CT Scan</option>
                  <option value="XRAY">X-Ray</option>
                  <option value="ULTRASOUND">Ultrasound</option>
                </select>
                <button id="filterBtn" class="btn btn-blue btn-sm">Filter</button>
                <span id="scanCount" class="text-xs text-muted"></span>
              </div>
            </div>
            <div id="reportsGrid" class="loading">Loading scans...</div>
          </div>
        </div>
      </main>
    </div>`;

  bindPatientLogout(container);

  // Tab switching
  container.querySelectorAll(".pt-folder-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      container.querySelectorAll(".pt-folder-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.tab;
      document.getElementById("tabRecords").style.display = target === "records" ? "" : "none";
      document.getElementById("tabScans").style.display = target === "scans" ? "" : "none";
    });
  });

  // Filter scans
  container.querySelector("#filterBtn").addEventListener("click", () => {
    loadScans(document.getElementById("typeFilter").value);
  });

  loadRecords();
  loadScans();
}

// ── Prescription Slips Tab (Visual Image Mode) ──────────────────

async function loadRecords() {
  const panel = document.getElementById("recordsPanel");
  if (!panel) return;

  try {
    const { data } = await api.get("/api/patient/records");
    const currentPanel = document.getElementById("recordsPanel");
    if (!currentPanel) return;

    if (!data?.ok) {
      currentPanel.innerHTML = `<div class="text-muted">${data?.error?.message || "Failed to load."}</div>`;
      return;
    }
    if (!data.data?.length) {
      currentPanel.innerHTML = `<div class="card"><div class="text-muted">No prescription slips found yet.</div></div>`;
      return;
    }

    const token = localStorage.getItem("access_token");

    currentPanel.innerHTML = data.data.map(enc => {
      const d = enc.created_at ? new Date(enc.created_at) : null;
      const dateStr = d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" }) : "–";
      const timeStr = d ? d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" }) : "";
      
      const prescriptions = enc.prescriptions || [];
      const primaryDownloadUrl = prescriptions.length ? prescriptions[0].download_url : null;
      const primaryDrugName = prescriptions.length ? prescriptions[0].drug_name : "Prescription";
      const previewImgUrl = primaryDownloadUrl ? `${primaryDownloadUrl}${primaryDownloadUrl.includes('?') ? '&' : '?'}jwt=${token}` : null;

      return `
        <div class="pt-record-card" style="margin-bottom:1.5rem;padding:1.25rem;background:#1e293b;border:1px solid #334155;border-radius:0.75rem;">
          <div class="pt-record-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;margin-bottom:1rem;">
            <div>
              <div class="pt-record-date" style="font-size:0.8rem;color:#94a3b8;">${dateStr}${timeStr ? " · " + timeStr : ""}</div>
              <div class="pt-record-doctor" style="font-weight:600;font-size:1.05rem;color:#f8fafc;">Dr. ${enc.doctor_name}</div>
            </div>
            <div class="flex items-center gap-2">
              ${primaryDownloadUrl ? `
                <button class="btn btn-sm custom-dl-btn" onclick="downloadPrescription('${primaryDownloadUrl}', '${primaryDrugName}')"> Download Slip</button>
                <button class="btn btn-sm custom-print-btn" onclick="printPrescription('${primaryDownloadUrl}')"> Print</button>
              ` : `<span class="badge badge-emerald">✓ Visit Logged</span>`}
            </div>
          </div>

          ${primaryDownloadUrl ? `
            <div style="position:relative;border-radius:0.5rem;overflow:hidden;background:#0f172a;border:1px solid #334155;cursor:pointer;display:flex;justify-content:center;align-items:center;min-height:220px;max-height:380px;" 
                 onclick="previewPrescriptionModal('${previewImgUrl}', 'Dr. ${enc.doctor_name}')">
              <img src="${previewImgUrl}" 
                   alt="Prescription Slip" 
                   loading="lazy"
                   style="width:100%;max-height:380px;object-fit:contain;display:block;"
                   onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
              <div style="display:none;padding:2.5rem;flex-direction:column;align-items:center;justify-content:center;color:#94a3b8;gap:0.5rem;">
                <div style="font-size:2.5rem;">📄</div>
                <div style="font-size:0.95rem;font-weight:600;color:#f8fafc;">Digital Prescription Slip</div>
                <div style="font-size:0.8rem;">Click here to view full prescription document</div>
              </div>
              
            </div>
          ` : `
            <div style="padding:1.5rem;background:#0f172a;border-radius:0.5rem;color:#94a3b8;font-size:0.85rem;text-align:center;">
              No digital prescription slip image attached to this consultation.
            </div>
          `}
        </div>`;
    }).join("");
  } catch (err) {
    console.error("Error loading prescription records:", err);
  }
}

// ── Scans Tab ───────────────────────────────────────────────────

async function loadScans(type = "") {
  const grid = document.getElementById("reportsGrid");
  const countEl = document.getElementById("scanCount");
  if (!grid) return;

  try {
    const url = type ? `/api/patient/scans?type=${type}` : "/api/patient/scans";
    const { data } = await api.get(url);
    
    const currentGrid = document.getElementById("reportsGrid");
    const currentCount = document.getElementById("scanCount");
    if (!currentGrid) return;

    if (!data?.ok) { 
      currentGrid.innerHTML = `<div class="text-muted">${data?.error?.message || "Failed to load scans."}</div>`; 
      return; 
    }
    if (!data.data?.length) { 
      currentGrid.innerHTML = `<div class="card"><div class="text-muted">No scans found.</div></div>`; 
      if (currentCount) currentCount.textContent = ""; 
      return; 
    }

    const token = localStorage.getItem("access_token");
    if (currentCount) currentCount.textContent = `${data.data.length} scan${data.data.length !== 1 ? "s" : ""} found`;

    currentGrid.innerHTML = `<div class="lab-scan-grid">` + data.data.map(s => {
      const d = s.uploaded_at ? new Date(s.uploaded_at) : null;
      const dateStr = d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" }) : "";
      const timeStr = d ? d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" }) : "";
      const inf = s.ai_inference || {};
      const flagged = inf.detections_count > 0;
      const cleared = inf.status === "SUCCESS" && !flagged;
      const aiBadge = flagged
        ? `<span class="badge badge-rose">AI Flagged</span>`
        : cleared
          ? `<span class="badge badge-emerald">AI Cleared</span>`
          : `<span class="badge badge-amber">Awaiting AI</span>`;

      return `
        <div class="lab-scan-tile">
          <div class="lab-scan-image">
            <img src="${s.file_url}?jwt=${token}" alt="${s.scan_type}" loading="lazy"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
            <div class="lab-scan-placeholder" style="display:none;"><div>${s.scan_type}</div></div>
          </div>
          <div class="lab-scan-meta">
            <div class="flex items-center justify-between">
              <span class="text-sm" style="font-weight:600;">${s.scan_type}</span>
              ${aiBadge}
            </div>
            <div class="text-xs text-muted">${dateStr}${timeStr ? " · " + timeStr : ""}</div>
            ${s.confidence_score != null ? `<div class="text-xs text-muted">Confidence: ${s.confidence_score}%</div>` : ""}
            ${flagged ? `<div class="text-xs text-rose">${inf.detections_count} anomal${inf.detections_count === 1 ? "y" : "ies"} detected</div>` : ""}
          </div>
        </div>`;
    }).join("") + `</div>`;
  } catch (err) {
    console.error("Error loading scans:", err);
  }
}

// ── Full-Screen Slip Preview Modal ─────────────────────────────

if (!window.previewPrescriptionModal) {
  window.previewPrescriptionModal = function(imgUrl, doctorTitle) {
    const oldModal = document.getElementById("rxPreviewModal");
    if (oldModal) oldModal.remove();

    const modal = document.createElement("div");
    modal.id = "rxPreviewModal";
    modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(5px);";
    modal.innerHTML = `
      <div style="max-width:850px;width:100%;background:#1e293b;border-radius:12px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.6);display:flex;flex-direction:column;max-height:92vh;">
        <div style="padding:0.75rem 1.25rem;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #334155;background:#0f172a;">
          <span style="font-weight:600;color:#f8fafc;font-size:0.95rem;">Prescription Slip · ${doctorTitle || 'Medical Prescriber'}</span>
          <button onclick="document.getElementById('rxPreviewModal').remove()" style="background:transparent;border:none;color:#94a3b8;font-size:1.5rem;cursor:pointer;line-height:1;">&times;</button>
        </div>
        <div style="padding:1.25rem;overflow:auto;display:flex;justify-content:center;background:#0b0f19;">
          <img src="${imgUrl}" alt="Prescription Full Slip" style="max-width:100%;max-height:75vh;object-fit:contain;border-radius:6px;" />
        </div>
      </div>
    `;
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
    document.body.appendChild(modal);
  };
}

// ── Prescription Download Handler ──────────────────────────────

if (!window.downloadPrescription) {
  window.downloadPrescription = async function(downloadUrl, drugName) {
    try {
      const token = localStorage.getItem("access_token");
      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch(downloadUrl, { headers });
      if (!response.ok) {
        alert("Failed to download prescription slip.");
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Prescription_${(drugName || "Slip").replace(/[^a-zA-Z0-9_-]/g, "_")}_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Download error:", err);
      alert("Error downloading prescription slip.");
    }
  };
}

// ── Prescription Print Handler ─────────────────────────────────

if (!window.printPrescription) {
  window.printPrescription = async function(downloadUrl) {
    try {
      const token = localStorage.getItem("access_token");
      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch(downloadUrl, { headers });
      if (!response.ok) {
        alert("Failed to load prescription image for printing.");
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const win = window.open("", "_blank");
      win.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Prescription Slip — Print</title>
            <style>
              body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background: #fff; }
              img { max-width: 100%; height: auto; display: block; margin: 0 auto; }
              @media print {
                body { margin: 0; background: #fff; }
                img { width: 100%; height: auto; page-break-inside: avoid; }
              }
            </style>
          </head>
          <body onload="setTimeout(() => { window.print(); }, 300);">
            <img src="${url}" alt="Prescription" />
          </body>
        </html>
      `);
      win.document.close();
    } catch (err) {
      console.error("Print error:", err);
      alert("Error loading prescription for printing.");
    }
  };
}