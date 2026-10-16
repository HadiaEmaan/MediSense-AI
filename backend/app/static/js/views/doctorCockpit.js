import { api } from "../api.js?v=1";
import { getUser, getPortalId, logout } from "../auth.js?v=1";
import { doctorSidebar, bindDoctorLogout } from "./doctorShared.js?v=1";

export function renderDoctorCockpit(container) {
  const user = getUser();
  const portalId = getPortalId(user);
  container.innerHTML = `
    <div class="app-shell">
      ${doctorSidebar("#/doctor")}
      <main class="main">
        <header class="top-header">
          <div class="flex items-center gap-4">
            <div class="page-title">Active Consultation</div>
            <span class="badge badge-amber" id="queueBadge">Loading queue...</span>
          </div>
          <div class="flex items-center gap-3">
            <button id="holdBtn" class="btn btn-slate" style="display:none;">Hold / Skip</button>
            <button id="nextBtn" class="btn btn-blue">Complete & Next Patient \u2192</button>
            <button id="stopBtn" class="btn btn-rose" style="display:none;">\u23f9 Stop Queue</button>
            <span class="badge badge-blue" title="Your unique MediSense portal ID">ID: ${portalId}</span>
          </div>
        </header>
        <div class="content">
          <div class="grid-12">
            <div class="col-7 flex flex-col gap-4">
              <div id="vitalsRow" class="vitals-row">
                <div class="text-muted text-sm">Queue is offline. Click "Start Queue" to begin consultations.</div>
              </div>
              <div class="card">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-2">
                    <div class="card-title" style="margin:0;">Medical Scan Analysis</div>
                    <span class="badge badge-blue" style="font-family:monospace;">PyTorch YOLOv8 Inference</span>
                  </div>
                  <div class="text-xs text-muted">Scan: Brain MRI (T2 Axial)</div>
                </div>
                <div class="viewer">
                  <canvas id="scanCanvas" class="viewer-canvas"></canvas>
                  <div id="scanFlag" class="anomaly-flag" style="display:none;"></div>
                </div>
              </div>
            </div>
            <div class="col-5 flex flex-col gap-4">
              <div class="ai-card">
                <div class="ai-card-header">
                  <div class="ai-card-title">
                    <span>✨</span>
                    <span>AI Clinical Overview</span>
                  </div>
                  <span class="ai-model-badge">Alibaba Qwen-2.5</span>
                </div>
                <div id="aiOverview" class="ai-content">
                  <div class="text-muted text-sm">No active consultation. AI overview will load when queue starts.</div>
                </div>
                <p id="aiDisclaimer" class="ai-disclaimer"></p>
              </div>

              <div class="card">
                <div class="flex items-center justify-between mb-2">
                  <div class="card-title" style="margin:0;">Order Lab Test (Lab Tech Connected)</div>
                  <span class="badge badge-indigo">Lab Orders</span>
                </div>
                <div class="flex gap-2 mb-2">
                  <input type="text" id="labTestInput" class="admin-filter" placeholder="e.g. Brain MRI suggested..." style="flex:1;">
                  <button id="orderLabTestBtn" class="btn btn-indigo">Order Test</button>
                </div>
                <div class="flex gap-1 flex-wrap">
                  <button class="btn btn-xs btn-slate quick-test-btn" data-test="Brain MRI">Brain MRI</button>
                  <button class="btn btn-xs btn-slate quick-test-btn" data-test="Chest X-Ray">Chest X-Ray</button>
                  <button class="btn btn-xs btn-slate quick-test-btn" data-test="CT Scan">CT Scan</button>
                  <button class="btn btn-xs btn-slate quick-test-btn" data-test="Blood CP">Blood CP</button>
                </div>
                <div id="labTestStatus" class="text-xs text-emerald mt-2" style="display:none;font-weight:600;"></div>
              </div>

              <div class="card">
                <div class="card-title" style="margin-bottom:0.75rem;">Clinical Evaluation & Treatment</div>
                <textarea id="clinicalNotes" class="form-textarea" placeholder="Record clinical impressions, order advanced labs, or specify prescription details (e.g. Panadol - 500mg - 1-0-1 - 3 Days)..."></textarea>
                <div class="text-right mt-3">
                  <button id="signRxBtn" class="btn btn-emerald">Sign & Issue Prescription</button>
                </div>
              </div>

              <!-- Patient Record & Prescription Slips Folder -->
              <div class="card" style="max-height:48rem;overflow-y:auto;">
                <div class="flex items-center justify-between mb-3">
                  <div class="card-title" style="margin:0;">Patient Record & Prescription Slips</div>
                  <span class="badge badge-indigo" id="folderBadge">Folder</span>
                </div>
                <div id="patientFolder" class="text-muted text-sm">No active patient. Queue not started.</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  `;

  bindDoctorLogout(container);
  container.querySelector("#signRxBtn")?.addEventListener("click", handleSignPrescription);
  container.querySelector("#orderLabTestBtn")?.addEventListener("click", handleOrderLabTest);
  container.querySelectorAll(".quick-test-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = document.getElementById("labTestInput");
      if (input) input.value = btn.dataset.test + " suggested";
    });
  });

  loadCurrentAppointment();
}

let currentAppointmentId = null;
let currentPatientId = null;
let currentPatientExactPortalId = null;

// Exact MRI portal ID resolver
function formatPatientMRN(patient) {
  if (!patient) return null;
  const p = patient.patient || patient;

  if (p.portal_id && String(p.portal_id).trim()) return String(p.portal_id).trim();
  if (p.portalId && String(p.portalId).trim()) return String(p.portalId).trim();
  if (p.patient_portal_id && String(p.patient_portal_id).trim()) return String(p.patient_portal_id).trim();
  if (p.mrn && String(p.mrn).trim()) return String(p.mrn).trim();
  if (p.mri_id && String(p.mri_id).trim()) return String(p.mri_id).trim();
  if (p.mri_number && String(p.mri_number).trim()) return String(p.mri_number).trim();

  let ptId = null;
  if (patient.patient && patient.patient.id != null) {
    ptId = patient.patient.id;
  } else if (patient.patient_id != null) {
    ptId = patient.patient_id;
  } else if (p.id != null && p.role === "Patient") {
    ptId = p.id;
  } else if (p.id != null && !patient.appointment_id) {
    ptId = p.id;
  }

  if (ptId != null) {
    return `MRI-${String(ptId).padStart(3, "0")}`;
  }

  return null;
}

function clearDashboardViews() {
  const vitalsRow = document.getElementById("vitalsRow");
  if (vitalsRow) {
    vitalsRow.innerHTML = `<div class="vitals-offline text-sm">Queue is offline. Click <strong>Start Queue</strong> to begin calling scheduled patients.</div>`;
  }

  const canvas = document.getElementById("scanCanvas");
  if (canvas) {
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#64748b";
    ctx.font = "14px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Waiting for active patient scan...", canvas.width / 2, canvas.height / 2);
  }

  const flag = document.getElementById("scanFlag");
  if (flag) flag.style.display = "none";

  const aiOverview = document.getElementById("aiOverview");
  if (aiOverview) {
    aiOverview.innerHTML = `<div class="text-muted text-sm">No active consultation. Call a patient to run AI clinical evaluation.</div>`;
  }

  const folder = document.getElementById("patientFolder");
  if (folder) {
    folder.innerHTML = `<div class="text-muted text-sm" style="padding:1rem;text-align:center;">No patient records loaded.</div>`;
  }

  const badge = document.getElementById("folderBadge");
  if (badge) badge.textContent = "Folder";
}

async function loadCurrentAppointment() {
  const badge = document.getElementById("queueBadge");
  const nextBtn = document.getElementById("nextBtn");
  const holdBtn = document.getElementById("holdBtn");
  const stopBtn = document.getElementById("stopBtn");

  try {
    const { data } = await api.get("/api/appointments/dashboard-stats");
    if (data?.ok && data.data) {
      const s = data.data;
      currentAppointmentId = s.current_patient?.appointment_id || null;
      currentPatientId = s.current_patient?.patient_id || null;

      if (currentAppointmentId && currentPatientId) {
        currentPatientExactPortalId = formatPatientMRN(s.current_patient);

        if (badge) {
          const tokenNum = String(s.current_patient.token_number).padStart(2, "0");
          const finalId = currentPatientExactPortalId || `MRI-${String(currentPatientId).padStart(3, "0")}`;
          badge.textContent = `Token #${tokenNum} • Live OPD • ${finalId}`;
          badge.className = "badge badge-emerald";
        }

        if (holdBtn) {
          holdBtn.style.display = "";
          holdBtn.onclick = () => handleQueueAction("skip");
        }
        if (nextBtn) {
          nextBtn.textContent = "Complete & Next Patient \u2192";
          nextBtn.classList.remove("btn-emerald");
          nextBtn.classList.add("btn-blue");
          nextBtn.onclick = () => handleQueueAction("next");
        }
        if (stopBtn) {
          stopBtn.style.display = "";
          stopBtn.onclick = async () => {
            if (!confirm("Stop the queue and go off-duty?")) return;
            const user = getUser();
            const { data: stopData } = await api.post(`/api/appointments/${user.id}/stop-queue`, {});
            if (stopData?.ok) {
              alert("Queue stopped. You are now off-duty.");
              currentAppointmentId = null;
              currentPatientId = null;
              currentPatientExactPortalId = null;
              loadCurrentAppointment();
            }
          };
        }

        loadVitals();
        loadScan();
        loadAiOverview();
        loadPatientFolder();
        return;
      }

      currentAppointmentId = null;
      currentPatientId = null;
      currentPatientExactPortalId = null;

      if (badge) {
        badge.textContent = "● Queue Offline";
        badge.className = "badge badge-slate";
      }

      if (holdBtn) holdBtn.style.display = "none";
      if (stopBtn) stopBtn.style.display = "none";

      if (nextBtn) {
        const pendingCount = s.pending || 0;
        nextBtn.textContent = `▶ Start Queue (${pendingCount} waiting)`;
        nextBtn.classList.remove("btn-blue");
        nextBtn.classList.add("btn-emerald");
        nextBtn.onclick = async () => {
          const user = getUser();
          nextBtn.disabled = true;
          nextBtn.textContent = "Starting Queue...";
          const { data: startData } = await api.post(`/api/appointments/${user.id}/start-queue`, {});
          nextBtn.disabled = false;
          if (startData?.ok && startData.data?.patient_id) {
            currentAppointmentId = startData.data.appointment_id || null;
            currentPatientId = startData.data.patient_id;
            currentPatientExactPortalId = formatPatientMRN(startData.data);
            alert(`Queue started! Now seeing Token #${String(startData.data.token_number).padStart(2, "0")}`);
            loadCurrentAppointment();
          } else {
            alert(startData?.error?.message || "No waiting patients found to start queue.");
            loadCurrentAppointment();
          }
        };
      }

      clearDashboardViews();
    }
  } catch (err) {
    console.error("Error loading appointment stats:", err);
    clearDashboardViews();
  }
}

async function handleQueueAction(action) {
  if (!currentAppointmentId) return;
  const endpoint = action === "next"
    ? `/api/appointments/${currentAppointmentId}/next`
    : `/api/appointments/${currentAppointmentId}/skip`;

  const { data } = await api.post(endpoint, {});
  if (data?.ok) {
    const msg = data.data?.message || (data.data?.patient_id
      ? `${action === "next" ? "Completed" : "Skipped"}. Next patient: Token #${String(data.data.token_number).padStart(2, "0")}`
      : "Queue finished.");
    alert(msg);
    if (data.data?.patient_id) {
      currentPatientId = data.data.patient_id;
      currentPatientExactPortalId = formatPatientMRN(data.data);
    } else {
      currentPatientId = null;
      currentAppointmentId = null;
      currentPatientExactPortalId = null;
    }
    loadCurrentAppointment();
  }
}

async function handleSignPrescription() {
  if (!currentPatientId) {
    alert("No active patient in consultation. Please start or call the queue first.");
    return;
  }
  const notes = document.getElementById("clinicalNotes")?.value.trim();
  if (!notes) {
    alert("Please enter clinical notes before signing the prescription.");
    return;
  }

  const signBtn = document.getElementById("signRxBtn");
  if (signBtn) {
    signBtn.disabled = true;
    signBtn.textContent = "Issuing & Syncing Slip...";
  }

  const lines = notes.split("\n").map(l => l.trim()).filter(Boolean);
  const rxList = lines.map(line => {
    const parts = line.split("-").map(p => p.trim());
    return {
      drug_name: parts[0] || line,
      dose: parts[1] || "",
      frequency: parts[2] || "",
      duration: parts[3] || ""
    };
  });

  try {
    const { data } = await api.post("/api/emr/encounter", {
      patient_id: currentPatientId,
      appointment_id: currentAppointmentId || null,
      assessment: notes,
      plan: "",
      prescriptions: rxList.length ? rxList : [{ drug_name: notes, dose: "", frequency: "", duration: "" }],
    });

    if (data?.ok) {
      alert("Prescription signed and issued successfully!");
      const input = document.getElementById("clinicalNotes");
      if (input) input.value = "";
      await loadPatientFolder();
    } else {
      alert(data?.error?.message || "Failed to issue prescription.");
    }
  } catch (err) {
    console.error("Error signing prescription:", err);
    alert("Error communicating with server.");
  } finally {
    if (signBtn) {
      signBtn.disabled = false;
      signBtn.textContent = "Sign & Issue Prescription";
    }
  }
}

function statusClass(level) {
  if (level === "CRITICAL") return "status-critical";
  if (level === "WARNING") return "status-warning";
  return "status-normal";
}

async function loadVitals() {
  const row = document.getElementById("vitalsRow");
  if (!row || !currentPatientId) return;

  try {
    const { data } = await api.get(`/api/vitals/patient/${currentPatientId}/latest`);
    const currentRow = document.getElementById("vitalsRow");
    if (!currentRow) return;

    if (!data?.ok || !data.data) {
      currentRow.innerHTML = `<div class="vitals-empty text-sm">No physical vitals logged for this patient yet.</div>`;
      return;
    }
    const v = data.data;

    const hrLevel = v.heart_rate > 110 || v.heart_rate < 50 ? "CRITICAL" : "NORMAL";
    const spo2Level = v.spo2 < 92 ? "CRITICAL" : "NORMAL";
    const tempLevel = v.temperature_f >= 100.4 ? "WARNING" : "NORMAL";
    const bpSys = v.bp_systolic || null;
    const bpDia = v.bp_diastolic || null;
    const bpStr = bpSys && bpDia ? `${bpSys}/${bpDia}` : "--/--";
    const bpLevel = bpSys && bpSys >= 140 ? "CRITICAL" : bpSys && bpSys >= 130 ? "WARNING" : "NORMAL";
    const bpStatusText = bpLevel === "CRITICAL" ? "High" : bpLevel === "WARNING" ? "Elevated" : "Optimal";

    const reasons = v.alert_reasons || [];
    const reasonsHtml = reasons.length
      ? `<div class="alert-reasons"><strong>Alert reasons:</strong> ${reasons.map((r) => `<span class="reason-tag">${r}</span>`).join("")}</div>`
      : "";

    const checkedByHtml = v.checked_by_name
      ? `<div class="vitals-checked-by">Physical checkup by <strong>${v.checked_by_name}</strong></div>`
      : "";

    currentRow.innerHTML = `
      <div class="vital-card ${hrLevel}">
        <div class="vital-label">Heart Rate</div>
        <div class="vital-value">${v.heart_rate ?? "--"}<span class="vital-unit">BPM</span></div>
        <div class="vital-status ${statusClass(hrLevel)}">● ${hrLevel === "CRITICAL" ? "Critical" : "Normal"}</div>
      </div>
      <div class="vital-card ${bpLevel}">
        <div class="vital-label">Blood Pressure</div>
        <div class="vital-value">${bpStr}<span class="vital-unit">mmHg</span></div>
        <div class="vital-status ${statusClass(bpLevel)}">● ${bpStatusText}</div>
      </div>
      <div class="vital-card ${spo2Level}">
        <div class="vital-label">SpO2 (Wearable)</div>
        <div class="vital-value">${v.spo2 ?? "--"}%<span class="vital-unit">Continuous</span></div>
        <div class="vital-status ${statusClass(spo2Level)}">● ${spo2Level === "CRITICAL" ? "Critical" : "Stable"}</div>
      </div>
      <div class="vital-card ${tempLevel}">
        <div class="vital-label">Temperature</div>
        <div class="vital-value">${v.temperature_f ?? "--"}<span class="vital-unit">°F</span></div>
        <div class="vital-status ${statusClass(tempLevel)}">● ${tempLevel === "WARNING" ? "Mild Elevation" : "Normal"}</div>
      </div>
      ${reasonsHtml}
      ${checkedByHtml}
    `;
  } catch (err) {
    console.error("Error loading vitals:", err);
  }
}

async function loadScan() {
  const canvas = document.getElementById("scanCanvas");
  const flag = document.getElementById("scanFlag");
  if (!canvas || !flag || !currentPatientId) return;
  const ctx = canvas.getContext("2d");

  canvas.width = 640;
  canvas.height = 360;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  try {
    const { data } = await api.get(`/api/imaging/patient/${currentPatientId}/scans`);
    if (data?.ok && data.data?.length > 0) {
      const scan = data.data[0];
      const inference = scan.ai_inference_results || {};
      if (inference.status === "SUCCESS" && inference.detections?.length > 0) {
        flag.style.display = "block";
        flag.textContent = `⚠️ Flagged Anomaly: ${inference.detections[0].label} (Conf: ${inference.detections[0].confidence}%)`;
        ctx.strokeStyle = "#f43f5e";
        ctx.lineWidth = 2;
        inference.detections.forEach((d) => {
          const [x1, y1, x2, y2] = d.box;
          ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        });
      } else {
        ctx.fillStyle = "#475569";
        ctx.font = "14px Inter";
        ctx.textAlign = "center";
        ctx.fillText("DICOM Viewer Active — Scan verified", canvas.width / 2, canvas.height / 2);
        flag.style.display = "none";
      }
    } else {
      ctx.fillStyle = "#475569";
      ctx.font = "14px Inter";
      ctx.textAlign = "center";
      ctx.fillText("No scan uploaded for this patient", canvas.width / 2, canvas.height / 2);
      flag.style.display = "none";
    }
  } catch (err) {
    console.error("Error loading scan:", err);
  }
}

async function loadAiOverview() {
  const container = document.getElementById("aiOverview");
  const disclaimer = document.getElementById("aiDisclaimer");
  if (!container || !disclaimer || !currentPatientId) return;

  try {
    const { data } = await api.post("/api/ai/clinical-overview", { patient_id: currentPatientId });
    if (!data?.ok) {
      container.innerHTML = `<div class="text-muted text-sm">${data?.error?.message || "No AI clinical records available."}</div>`;
      return;
    }
    const d = data.data;
    const sf = d.scan_findings;

    let scanHtml = "";
    if (sf) {
      const severityColor = sf.severity === "HIGH" ? "rose" : sf.severity === "NORMAL" ? "emerald" : "amber";
      const detections = sf.detections || [];

      if (detections.length > 0) {
        const flagItems = detections.map(f => `
          <div class="ai-flag-item">
            <span class="badge badge-${f.confidence > 70 ? 'rose' : 'amber'}">${f.confidence}%</span>
            <span class="ai-flag-label">${f.label}</span>
          </div>`).join("");

        scanHtml = `
          <div class="ai-scan-section ai-scan-flagged">
            <div class="flex items-center justify-between mb-2">
              <div class="ai-scan-title">🔍 ${sf.scan_type} Scan Analysis — ${sf.total_flags} Flag${sf.total_flags !== 1 ? "s" : ""}</div>
              <span class="badge badge-${severityColor}">${sf.severity}</span>
            </div>
            <div class="ai-flag-list">${flagItems}</div>
          </div>`;
      }
    }

    container.innerHTML = `
      ${scanHtml}
      <p><strong>Clinical Summary:</strong> ${d.clinical_snapshot}</p>
      <p><strong>Key Observations:</strong> ${(d.critical_observations || []).map(o => `<span class="ai-obs-tag">${o}</span>`).join("")}</p>
      <p><strong>Differential Notes:</strong> ${(d.differential_considerations || []).join("; ")}</p>
      <p><strong>Drug Interactions:</strong> ${d.drug_interaction_notes}</p>
    `;
    disclaimer.textContent = `*${d.disclaimer} Mode: ${d.mode}.`;
  } catch (err) {
    console.error("AI Overview Error:", err);
  }
}

// ── Patient Folder: Exact Records & Deduplicated Visual Slips ──

async function loadPatientFolder() {
  const folder = document.getElementById("patientFolder");
  const badge = document.getElementById("folderBadge");
  if (!folder || !badge || !currentPatientId) return;

  folder.innerHTML = `<div class="loading">Loading patient records & slips...</div>`;
  const token = localStorage.getItem("access_token") || localStorage.getItem("token") || "";

  try {
    const { data } = await api.get(`/api/imaging/patient/${currentPatientId}/folder`);
    if (!data?.ok) {
      folder.innerHTML = `<div class="text-muted text-sm">${data?.error?.message || "Failed to load records."}</div>`;
      return;
    }

    const f = data.data || {};
    const scans = f.scans || [];
    const rawPrescriptions = f.prescriptions || [];

    // Exact MRI portal ID
    const realPortalId = formatPatientMRN(f.patient) || currentPatientExactPortalId || `MRI-${String(currentPatientId).padStart(3, "0")}`;

    // Update live badge in header
    const qBadge = document.getElementById("queueBadge");
    if (qBadge && qBadge.textContent.includes("Live OPD")) {
      const tokenPart = qBadge.textContent.split("•")[0].trim();
      qBadge.textContent = `${tokenPart} • Live OPD • ${realPortalId}`;
    }

    // ─────────────────────────────────────────────────────────────
    // Deduplicate: Group prescriptions by encounter / visit
    // Taake agar ek consultation mein 3 medicines hon, to 3 slips na banen
    // ─────────────────────────────────────────────────────────────
    const encounterMap = new Map();

    rawPrescriptions.forEach((rx, idx) => {
      // Group key priority: encounter_id -> appointment_id -> timestamp (minute level) -> slip_id
      const dateVal = rx.created_at || rx.prescribed_at || "";
      const minuteKey = dateVal ? new Date(dateVal).toISOString().slice(0, 16) : `idx_${idx}`;
      const groupKey = rx.encounter_id || rx.appointment_id || minuteKey;

      if (!encounterMap.has(groupKey)) {
        encounterMap.set(groupKey, {
          id: rx.id || idx + 1,
          encounterId: rx.encounter_id || rx.appointment_id || (idx + 1),
          dateStr: dateVal ? new Date(dateVal).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" }) : "Recent",
          timeStr: dateVal ? new Date(dateVal).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" }) : "",
          doctorName: rx.doctor_name || "Doctor",
          drugs: [],
          downloadUrl: rx.download_url || (rx.id ? `/api/emr/prescription/${rx.id}/download` : `/api/emr/prescription/${idx + 1}/download`)
        });
      }

      const item = encounterMap.get(groupKey);
      item.drugs.push({
        name: rx.drug_name || "Prescription",
        dose: rx.dose || "",
        frequency: rx.frequency || "",
        duration: rx.duration || ""
      });
    });

    const prescriptionSlips = Array.from(encounterMap.values()).map(item => {
      const previewImgUrl = `${item.downloadUrl}${item.downloadUrl.includes('?') ? '&' : '?'}jwt=${token}`;
      const primaryDrugName = item.drugs[0]?.name || "Prescription";
      return {
        ...item,
        drugName: primaryDrugName,
        previewImgUrl
      };
    });

    badge.textContent = `${scans.length} scan${scans.length !== 1 ? "s" : ""} · ${prescriptionSlips.length} Slip${prescriptionSlips.length !== 1 ? "s" : ""}`;

    // 1. Diagnostic Scans Section
    let scansHtml = "";
    if (scans.length > 0) {
      scansHtml = `
        <div class="lab-folder-section" style="margin-bottom:1.5rem;">
          <div class="lab-folder-section-title" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">
            <span style="font-weight:600;font-size:0.9rem;color:#f8fafc;">Diagnostic Scans</span>
            <span class="badge badge-blue">${scans.length}</span>
          </div>
          <div class="lab-scan-grid">
            ${scans.map(s => {
              const d = s.uploaded_at ? new Date(s.uploaded_at) : null;
              const dateStr = d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" }) : "";
              const timeStr = d ? d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" }) : "";
              const aiBadge = s.ai_inference?.detections_count > 0
                ? `<span class="badge badge-rose">Flagged</span>`
                : `<span class="badge badge-emerald">Cleared</span>`;
              return `
                <div class="lab-scan-tile">
                  <div class="lab-scan-image">
                    <img src="${s.file_url}?jwt=${token}" alt="${s.scan_type}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                    <div class="lab-scan-placeholder" style="display:none;"><div>${s.scan_type}</div></div>
                  </div>
                  <div class="lab-scan-meta">
                    <div class="flex items-center justify-between">
                      <span class="text-sm" style="font-weight:600;">${s.scan_type}</span>
                      ${aiBadge}
                    </div>
                    <div class="text-xs text-muted">${dateStr}${timeStr ? " · " + timeStr : ""}</div>
                  </div>
                </div>`;
            }).join("")}
          </div>
        </div>`;
    }

    // 2. Single Unique Visual Prescription Slip Per Encounter
    let rxHtml = "";
    if (prescriptionSlips.length > 0) {
      rxHtml = `
        <div class="lab-folder-section">
          <div class="lab-folder-section-title" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">
            <span style="font-weight:600;font-size:0.9rem;color:#f8fafc;">Prescription Slips</span>
            <span class="badge badge-emerald">${prescriptionSlips.length} Slip</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:1.25rem;">
            ${prescriptionSlips.map((item, idx) => `
              <div class="pt-record-card" style="margin-bottom:1rem;padding:1.25rem;background:#1e293b;border:1px solid #334155;border-radius:0.75rem;">
                <div class="pt-record-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;margin-bottom:1rem;">
                  <div>
                    <div class="pt-record-date" style="font-size:0.8rem;color:#94a3b8;">Consultation #${idx + 1} · ${item.dateStr} · ${item.timeStr}</div>
                    <div class="pt-record-doctor" style="font-weight:600;font-size:1.05rem;color:#f8fafc;">Dr. ${item.doctorName}</div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button class="btn btn-emerald btn-sm" onclick="downloadPrescription('${item.downloadUrl}', '${item.drugName}')">Download Slip</button>
                    <button class="btn btn-slate btn-sm" onclick="printPrescription('${item.downloadUrl}')">Print</button>
                  </div>
                </div>

                <div style="position:relative;border-radius:0.5rem;overflow:hidden;background:#0f172a;border:1px solid #334155;cursor:pointer;display:flex;justify-content:center;align-items:center;min-height:220px;max-height:380px;" 
                     onclick="previewPrescriptionModal('${item.previewImgUrl}', 'Dr. ${item.doctorName}')">
                  <img src="${item.previewImgUrl}" 
                       alt="Prescription Slip" 
                       loading="lazy" 
                       style="width:100%;max-height:380px;object-fit:contain;display:block;" 
                       onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                  
                  <div style="display:none;width:100%;padding:1.5rem;background:#ffffff;color:#0f172a;border-radius:0.375rem;flex-direction:column;gap:0.5rem;font-family:sans-serif;">
                    ${item.drugs.map(d => `
                      <div style="font-weight:bold;color:#0284c7;font-size:1.05rem;">℞ ${d.name}</div>
                      <div style="font-size:0.85rem;color:#475569;">${[d.dose, d.frequency, d.duration].filter(Boolean).join(" · ")}</div>
                    `).join('<div style="border-top:1px dashed #e2e8f0;margin:0.25rem 0;"></div>')}
                    <div style="font-size:0.75rem;color:#64748b;margin-top:0.5rem;border-top:1px dashed #cbd5e1;padding-top:0.5rem;">Signed by Dr. ${item.doctorName}</div>
                  </div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>`;
    } else {
      rxHtml = `<div class="lab-folder-section" style="margin-top:1.25rem;"><div class="lab-folder-section-title">Prescriptions & Slips</div><div class="prescriptions-empty text-sm">No prescriptions on record.</div></div>`;
    }

    const patientName = f.patient?.name || `Patient #${currentPatientId}`;
    const patientInitials = patientName.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();

    folder.innerHTML = `
      <div class="flex items-center gap-2 mb-3" style="padding-bottom:0.75rem;border-bottom:1px solid #334155;">
        <div class="lab-folder-avatar" style="width:2.25rem;height:2.25rem;font-size:0.85rem;background:#0284c7;color:#fff;display:flex;align-items:center;justify-content:center;border-radius:50%;font-weight:700;">${patientInitials}</div>
        <div>
          <div style="font-weight:700;font-size:0.95rem;color:#f8fafc;">${patientName}</div>
          <div class="text-xs text-muted">Portal ID: <strong style="color:#38bdf8;">${realPortalId}</strong> · ${f.patient?.email || 'Registered OPD Patient'}</div>
        </div>
      </div>
      ${scansHtml}
      ${rxHtml}
    `;

  } catch (err) {
    console.error("Error loading patient folder:", err);
    folder.innerHTML = `<div class="text-muted text-sm">Failed to load patient records.</div>`;
  }
}

async function handleOrderLabTest() {
  if (!currentAppointmentId) {
    alert("No active patient consultation. Cannot order lab test.");
    return;
  }
  const testInput = document.getElementById("labTestInput");
  const testName = testInput?.value.trim();
  if (!testName) {
    alert("Please enter or select a lab test (e.g. Brain MRI).");
    return;
  }

  const { data } = await api.post(`/api/appointments/${currentAppointmentId}/suggest-test`, {
    suggested_test: testName
  });

  if (data?.ok) {
    const statusEl = document.getElementById("labTestStatus");
    if (statusEl) {
      statusEl.style.display = "block";
      statusEl.textContent = `\u2705 Lab test order '${data.data?.suggested_test || testName}' sent to Lab Tech`;
      testInput.value = "";
      setTimeout(() => { statusEl.style.display = "none"; }, 5000);
    }
  } else {
    alert(data?.error?.message || "Failed to order lab test.");
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