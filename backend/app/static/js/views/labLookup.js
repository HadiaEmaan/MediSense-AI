import { api } from "../api.js?v=1";
import { getUser, getPortalId, logout } from "../auth.js?v=1";

export function renderLabLookup(container) {
  const user = getUser() || {};
  const portalId = getPortalId(user);

  container.innerHTML = `
    <style>
      .lab-dl-btn {
        background-color: #1d4ed8 !important;
        color: #ffffff !important;
        border: none !important;
        transition: background-color 0.2s ease;
      }
      .lab-dl-btn:hover {
        background-color: #d5ece6 !important;
        color: #18594f !important;
      }
      .lab-print-btn {
        background-color: #475569 !important;
        color: #ffffff !important;
        border: none !important;
        transition: background-color 0.2s ease;
      }
      .lab-print-btn:hover {
        background-color: #d5ece6 !important;
        color: #18594f !important;
      }
    </style>
    <div class="app-shell">
      <aside class="sidebar">
        <div>
          <div class="sidebar-brand">
            <img class="sidebar-brand-icon" src="/assets/medisense-mark.png" alt="MediSense AI">
            <div>
              <div class="sidebar-brand-title">MediSense AI</div>
              <div class="sidebar-brand-subtitle">${user.role === "Doctor" ? "Clinical Decision Support" : "Lab Technician"}</div>
            </div>
          </div>
          <nav class="sidebar-nav">
            ${user.role === "Doctor" ? `
              <a href="#/doctor-dashboard">Dashboard</a>
              <a href="#/doctor">Console Overview</a>
              <a href="#/queue">OPD Live Queue</a>
              <a href="#/lab">Scan Uploads</a>
            ` : `
              <a href="#/lab-dashboard">Dashboard</a>
              <a href="#/lab-pending">Pending Orders</a>
              <a href="#/lab">Upload Scan</a>
              <a href="#/lab-overview">Scan Overview</a>
              <a href="#/lab-vitals">Vitals</a>
              <a href="#/lab-lookup" class="active">Patient Lookup</a>
              <a href="#/lab-history">Scan History</a>
              <a href="#/queue">Live Queue</a>
            `}
          </nav>
        </div>
        <div class="sidebar-footer">
          <div class="flex items-center gap-3">
            <div class="user-avatar">${user.role === "Doctor" ? "DR" : "LT"}</div>
            <div>
              <div class="user-name">${user?.full_name || "User"}</div>
              <div class="user-role">${user.role === "Doctor" ? "● OPD Online" : "● Lab Online"}</div>
            </div>
          </div>
          <button id="logoutBtn" class="sidebar-logout-btn">Logout</button>
        </div>
      </aside>
      <main class="main">
        <header class="top-header">
          <div>
            <div class="page-title">Patient Lookup</div>
            <div class="text-xs text-muted" style="margin-top:0.25rem;">Browse patient scan archives, images and issued prescriptions.</div>
          </div>
          <div class="flex items-center gap-3">
            <span class="badge badge-blue">ID: ${portalId}</span>
          </div>
        </header>
        <div class="content">
          <div class="lab-lookup-layout">

            <!-- Patient List Panel -->
            <div class="lab-lookup-list">
              <div class="lab-lookup-search">
                <input type="text" id="searchInput" placeholder="Search patients..." class="lab-search-input">
              </div>
              <div id="patientList" class="lab-lookup-patients">
                <div class="loading">Loading patients...</div>
              </div>
            </div>

            <!-- Patient Folder Panel -->
            <div class="lab-lookup-folder">
              <div id="folderContent" class="lab-folder-empty">
                <div style="font-size:2.5rem;margin-bottom:0.5rem;">📁</div>
                <div class="text-secondary" style="font-weight:600;">Select a patient</div>
                <div class="text-muted text-sm">Click a patient to view their scan folder and signed prescription slips.</div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  `;

  container.querySelector("#logoutBtn")?.addEventListener("click", logout);

  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", () => filterPatients(searchInput.value));

  loadPatientList();
}

let allPatients = [];

// Exact MRI portal ID resolver
function resolvePatientPortalId(p) {
  if (!p) return "—";
  const knownId = [p.portal_id, p.portalId, p.patient_portal_id, p.mrn, p.mri_id, p.mri_number, p.public_id]
    .find((value) => value != null && String(value).trim());
  const knownIdMatch = String(knownId || "").trim().match(/^(?:MRI[-_ ]?)?(\d+)$/i);
  if (knownIdMatch) {
    return `MRI-${String(knownIdMatch[1]).padStart(3, "0")}`;
  }

  const rawId = p.patient_id != null ? p.patient_id : p.id;
  if (rawId != null) {
    return `MRI-${String(rawId).padStart(3, "0")}`;
  }
  return "—";
}

async function loadPatientList() {
  const { data } = await api.get("/api/imaging/patients");
  const list = document.getElementById("patientList");

  if (!data?.ok || !data.data?.length) {
    list.innerHTML = `<div class="text-muted text-sm" style="padding:1rem;">No patients with scans or prescriptions found.</div>`;
    return;
  }

  allPatients = data.data;
  renderPatientList(allPatients);
}

function renderPatientList(patients) {
  const list = document.getElementById("patientList");
  if (patients.length === 0) {
    list.innerHTML = `<div class="text-muted text-sm" style="padding:1rem;">No matching patients.</div>`;
    return;
  }

  list.innerHTML = patients.map(p => {
    const d = p.last_scan ? new Date(p.last_scan) : null;
    const dateStr = d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "Asia/Karachi" }) : "—";
    const realPortalId = resolvePatientPortalId(p);
    
    // Agar patient ke paas prescriptions hain to slip count accurate dikhana (encounter level)
    const rawRxCount = p.prescription_count || 0;
    const rxSlipCount = p.encounter_count || (rawRxCount > 0 ? 1 : 0);

    return `
      <div class="lab-patient-row" data-id="${p.id}" id="patientRow-${p.id}" onclick="window.__selectPatient(${p.id})">
        <div class="lab-patient-row-name">${p.name}</div>
        <div class="lab-patient-row-meta" id="patientMeta-${p.id}">ID: <code style="color:#38bdf8;">${realPortalId}</code> · ${p.scan_count || 0} scan${p.scan_count !== 1 ? "s" : ""} · <span class="rx-count-tag">${rxSlipCount} prescription${rxSlipCount !== 1 ? "s" : ""}</span> · ${dateStr}</div>
      </div>`;
  }).join("");
}

function filterPatients(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    renderPatientList(allPatients);
    return;
  }
  const filtered = allPatients.filter(p =>
    (p.name && p.name.toLowerCase().includes(q)) || 
    (p.email && p.email.toLowerCase().includes(q)) ||
    (resolvePatientPortalId(p).toLowerCase().includes(q))
  );
  renderPatientList(filtered);
}

window.__selectPatient = async function(patientId) {
  document.querySelectorAll(".lab-patient-row").forEach(el => el.classList.remove("active"));
  const selected = document.querySelector(`.lab-patient-row[data-id="${patientId}"]`);
  if (selected) selected.classList.add("active");

  const folder = document.getElementById("folderContent");
  folder.innerHTML = `<div class="loading" style="padding:2rem;">Loading patient folder & prescription slips...</div>`;

  const { data } = await api.get(`/api/imaging/patient/${patientId}/folder`);
  if (!data?.ok) {
    folder.innerHTML = `<div class="text-muted" style="padding:2rem;">${data?.error?.message || "Failed to load."}</div>`;
    return;
  }

  const f = data.data || {};
  const token = localStorage.getItem("access_token") || localStorage.getItem("token") || "";

  // 1. Diagnostic Scans Section
  let scansHtml = "";
  const scans = f.scans || [];
  if (scans.length > 0) {
    scansHtml = `
      <div class="lab-folder-section" style="margin-bottom:1.5rem;">
        <div class="lab-folder-section-title" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">
          <span style="font-weight:600;font-size:0.95rem;color:#f8fafc;">Diagnostic Scans</span>
          <span class="badge badge-blue">${scans.length} scan${scans.length !== 1 ? "s" : ""}</span>
        </div>
        <div class="lab-scan-grid">
          ${scans.map(s => {
            const d = s.uploaded_at ? new Date(s.uploaded_at) : null;
            const dateStr = d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" }) : "";
            const timeStr = d ? d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" }) : "";
            const aiLabel = s.ai_inference?.detections_count > 0 ? "AI Flagged" : s.ai_inference?.status === "SUCCESS" ? "AI Cleared" : "No AI";
            const aiBadge = s.ai_inference?.detections_count > 0
              ? `<span class="badge badge-rose">${aiLabel}</span>`
              : s.ai_inference?.status === "SUCCESS"
                ? `<span class="badge badge-emerald">${aiLabel}</span>`
                : `<span class="badge badge-amber">${aiLabel}</span>`;

            return `
              <div class="lab-scan-tile">
                <div class="lab-scan-image">
                  <img src="${s.file_url}?jwt=${token}" alt="${s.scan_type}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                  <div class="lab-scan-placeholder" style="display:none;">
                    <div>${s.scan_type}</div>
                  </div>
                </div>
                <div class="lab-scan-meta">
                  <div class="flex items-center justify-between">
                    <span class="text-sm" style="font-weight:600;">${s.scan_type}</span>
                    ${aiBadge}
                  </div>
                  <div class="text-xs text-muted">${dateStr}${timeStr ? " · " + timeStr : ""}</div>
                  ${s.confidence_score != null ? `<div class="text-xs text-muted">Confidence: ${s.confidence_score}%</div>` : ""}
                </div>
              </div>`;
          }).join("")}
        </div>
      </div>`;
  } else {
    scansHtml = `
      <div class="lab-folder-section" style="margin-bottom:1.5rem;">
        <div class="lab-folder-section-title" style="font-weight:600;font-size:0.95rem;color:#f8fafc;margin-bottom:0.5rem;">Diagnostic Scans</div>
        <div class="text-muted text-sm">No scans uploaded for this patient.</div>
      </div>`;
  }

  // 2. Exact Deduplicated Visual Prescription Slips (Encounter level grouping)
  const rawPrescriptions = f.prescriptions || [];
  const encounterMap = new Map();

  rawPrescriptions.forEach((rx, idx) => {
    const dateVal = rx.created_at || rx.prescribed_at || "";
    const minuteKey = dateVal ? new Date(dateVal).toISOString().slice(0, 16) : `idx_${idx}`;
    const groupKey = rx.encounter_id || rx.appointment_id || minuteKey;

    if (!encounterMap.has(groupKey)) {
      encounterMap.set(groupKey, {
        id: rx.id || idx + 1,
        dateStr: dateVal ? new Date(dateVal).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" }) : "Recent",
        timeStr: dateVal ? new Date(dateVal).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" }) : "",
        doctorName: rx.doctor_name || "Doctor",
        drugName: rx.drug_name || "Official Prescription",
        downloadUrl: rx.download_url || (rx.id ? `/api/emr/prescription/${rx.id}/download` : `/api/emr/prescription/${idx + 1}/download`)
      });
    }
  });

  const prescriptionSlips = Array.from(encounterMap.values());

  // Patient row metadata ko synchronize karein taake left list aur right folder dono 1 slip hi dikhayein
  const metaTag = document.querySelector(`#patientMeta-${patientId} .rx-count-tag`);
  if (metaTag) {
    metaTag.textContent = `${prescriptionSlips.length} prescription${prescriptionSlips.length !== 1 ? "s" : ""}`;
  }

  let rxHtml = "";
  if (prescriptionSlips.length > 0) {
    rxHtml = `
      <div class="lab-folder-section">
        <div class="lab-folder-section-title" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">
          <span style="font-weight:600;font-size:0.95rem;color:#f8fafc;">Prescription Slips</span>
          <span class="badge badge-emerald">${prescriptionSlips.length} Available</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:1.25rem;">
          ${prescriptionSlips.map((item, idx) => `
            <div class="pt-record-card" style="margin-bottom:1rem;padding:1.25rem;background:#1e293b;border:1px solid #334155;border-radius:0.75rem;">
              <div class="pt-record-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;margin-bottom:1rem;">
                <div>
                  <div class="pt-record-date" style="font-size:0.8rem;color:#94a3b8;">Consultation #${idx + 1} · ${item.dateStr} ${item.timeStr ? "· " + item.timeStr : ""}</div>
                  <div class="pt-record-doctor" style="font-weight:600;font-size:1.05rem;color:#f8fafc;">Dr. ${item.doctorName}</div>
                </div>
                <div class="flex items-center gap-2">
                  <button class="btn btn-sm lab-dl-btn" onclick="downloadPrescription('${item.downloadUrl}', '${item.drugName}')">Download Slip</button>
                  <button class="btn btn-sm lab-print-btn" onclick="printPrescription('${item.downloadUrl}')">Print Slip</button>
                </div>
              </div>

              <!-- Visual Slip Image Display -->
              <div class="lab-rx-preview" data-prescription-url="${item.downloadUrl}" data-doctor-name="Dr. ${item.doctorName}">
                <span class="text-xs text-muted">Loading prescription slip...</span>
                
                <div style="position:absolute;bottom:0;inset-x:0;background:linear-gradient(to top, rgba(15,23,42,0.92), transparent);padding:0.6rem;text-align:center;color:#38bdf8;font-size:0.75rem;font-weight:500;">
                  🔍 Click to zoom and inspect complete prescription copy
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>`;
  } else {
    rxHtml = `
      <div class="lab-folder-section">
        <div class="lab-folder-section-title" style="font-weight:600;font-size:0.95rem;color:#f8fafc;margin-bottom:0.5rem;">Prescription Slips</div>
        <div class="text-muted text-sm" style="padding:1rem;background:#0f172a;border-radius:0.5rem;text-align:center;">No prescriptions on record.</div>
      </div>`;
  }

  const patientName = f.patient?.name || `Patient #${patientId}`;
  const patientInitials = patientName.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
  const exactPatientPortalId = resolvePatientPortalId(f.patient || { id: patientId });

  folder.innerHTML = `
    <div class="lab-folder-header" style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:1px solid #334155;">
      <div class="lab-folder-avatar" style="width:2.5rem;height:2.5rem;background:#1d4ed8;color:#fff;display:flex;align-items:center;justify-content:center;border-radius:50%;font-weight:700;">${patientInitials}</div>
      <div>
        <div class="lab-folder-name" style="font-weight:700;font-size:1.1rem;color:#f8fafc;">${patientName}</div>
        <div class="text-xs text-muted">Patient ID: <code style="color:#38bdf8;font-weight:600;">${exactPatientPortalId}</code> · ${f.patient?.email || "Registered OPD Patient"}</div>
      </div>
    </div>
    ${scansHtml}
    ${rxHtml}
  `;
  folder.className = "lab-folder-content";
  loadPrescriptionImages(folder);
};

async function loadPrescriptionImages(folder) {
  const token = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  const previews = folder.querySelectorAll(".lab-rx-preview[data-prescription-url]");

  await Promise.all([...previews].map(async preview => {
    try {
      const response = await fetch(`${preview.dataset.prescriptionUrl}?_=${Date.now()}`, {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error(`Prescription image request failed (${response.status})`);
      const image = document.createElement("img");
      image.src = URL.createObjectURL(await response.blob());
      image.alt = "Visual prescription slip";
      image.loading = "lazy";
      image.style.cssText = "width:100%;max-height:380px;object-fit:contain;display:block;";
      preview.replaceChildren(image);
      preview.onclick = () => previewPrescriptionModal(image.src, preview.dataset.doctorName);
    } catch (error) {
      console.error("Failed to load prescription image:", error);
      preview.innerHTML = `<span class="text-xs text-muted">Prescription image unavailable</span>`;
    }
  }));
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
      if (token) headers["Authorization"] = `Bearer ${token}`;

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
      if (token) headers["Authorization"] = `Bearer ${token}`;

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
            <title>MediSense AI — Prescription Print</title>
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