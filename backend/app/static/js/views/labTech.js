import { api } from "../api.js?v=1";
import { getUser, getPortalId, logout } from "../auth.js?v=1";
import { doctorSidebar, bindDoctorLogout } from "./doctorShared.js?v=1";

const DEMO_PATIENT_ID = 1;

export function renderLabTech(container) {
  const user = getUser();
  const portalId = getPortalId(user);
  const selectedLabOrder = JSON.parse(localStorage.getItem("medisense_lab_order") || "null");
  const selectedPatientId = selectedLabOrder?.patientId || DEMO_PATIENT_ID;
  container.innerHTML = `
    <div class="app-shell">
      ${user.role === "Doctor" ? doctorSidebar("#/lab") : `
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
              <a href="#/lab" class="active">Scan Uploads</a>
            ` : `
              <a href="#/lab-dashboard">Dashboard</a>
              <a href="#/lab-pending">Pending Orders</a>
              <a href="#/lab" class="active">Upload Scan</a>
              <a href="#/lab-overview">Scan Overview</a>
              <a href="#/lab-vitals">Vitals</a>
              <a href="#/lab-lookup">Patient Lookup</a>
              <a href="#/lab-history">Scan History</a>
              <a href="#/queue">Live Queue</a>
            `}
          </nav>
        </div>
        <div class="sidebar-footer">
          <div class="flex items-center gap-3">
            <div class="user-avatar">${user.role === "Doctor" ? "DR" : "LT"}</div>
            <div>
              <div class="user-name">${user?.full_name || "Lab Tech"}</div>
              <div class="user-role">${user.role === "Doctor" ? "\u25cf OPD Online" : "\u25cf Lab Online"}</div>
            </div>
          </div>
          <button id="logoutBtn" class="sidebar-logout-btn">Logout</button>
        </div>
      </aside>`}
      <main class="main">
        <header class="top-header">
          <div class="page-title">Diagnostic Imaging Upload</div>
          <div class="flex items-center gap-2">
            <span class="badge badge-blue" title="Your unique MediSense portal ID">ID: ${portalId}</span>
          </div>
        </header>
        <div class="content">
          <div class="grid-12">
            <div class="col-6">
              <div class="card">
                <div class="card-title">Upload New Scan</div>
                <form id="uploadForm" class="flex flex-col gap-3">
                  <div>
    <label class="text-xs text-secondary">Patient MRI ID</label>
    <input
        type="text"
        id="patientId"
        value="MRI-${String(selectedPatientId).padStart(3, "0")}"
        placeholder="MRI-001"
        pattern="(?:[Mm][Rr][Ii][\-_ ]?)?[0-9]+"
        required
    >
</div>

                  <div>
                    <label class="text-xs text-secondary">Scan Type</label>
                    <select id="scanType" required>
                      <option value="X-Ray">X-Ray</option>
                      <option value="MRI" selected>MRI</option>
                      <option value="CT">CT</option>
                    </select>
                  </div>
                  <div>
                    <label class="text-xs text-secondary">Scan File</label>
                    <div class="file-upload-wrapper">
                      <label for="scanFile" class="file-upload-btn">Choose File</label>
                      <span id="fileName" class="file-upload-name">No file selected</span>
                      <input type="file" id="scanFile" accept=".png,.jpg,.jpeg,.dcm,.webp" required>
                    </div>
                  </div>
                  <button type="submit" class="btn btn-blue">Run YOLO Analysis</button>
                </form>
                <div id="uploadResult" class="mt-3 text-sm"></div>
              </div>
            </div>
            <div class="col-6">
              <div class="card">
                <div class="card-title">Recent Uploads</div>
                <div id="scansList" class="loading">Loading...</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  `;

  if (user.role === "Doctor") {
    bindDoctorLogout(container);
  } else {
    container.querySelector("#logoutBtn").addEventListener("click", logout);
  }
  container.querySelector("#uploadForm").addEventListener("submit", handleUpload);
  container.querySelector("#scanFile").addEventListener("change", (e) => {
    const nameEl = document.getElementById("fileName");
    nameEl.textContent = e.target.files.length ? e.target.files[0].name : "No file selected";
  });
  loadScans();
}

async function handleUpload(e) {
  e.preventDefault();
  const result = document.getElementById("uploadResult");
  const fileInput = document.getElementById("scanFile");
  const patientIdInput = document.getElementById("patientId").value.trim();
  const patientIdMatch = patientIdInput.match(/^(?:MRI[-_ ]?)?(\d+)$/i);
  const scanType = document.getElementById("scanType").value;

  if (!patientIdMatch) {
    result.innerHTML = `<span class="status-critical">Enter a valid MRI ID, for example MRI-001.</span>`;
    return;
  }

  const patientId = patientIdMatch[1];

  if (!fileInput.files.length) {
    result.innerHTML = `<span class="status-critical">Please select a file.</span>`;
    return;
  }

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);
  formData.append("patient_id", patientId);
  formData.append("scan_type", scanType);

  const token = localStorage.getItem("access_token");
  result.innerHTML = `<span class="text-muted">Uploading and analyzing...</span>`;

  try {
    const response = await fetch("/api/imaging/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await response.json();
    if (data.ok) {
      localStorage.removeItem("medisense_lab_order");
      const inf = data.data.inference;
      const scan = data.data.scan;
      let html = "";

      if (inf.status === "SUCCESS" && inf.detections_count > 0) {
        html = `
          <div class="status-normal">Analysis complete — ${inf.detections_count} finding(s) detected.</div>
          <div class="text-muted" style="margin-top:0.25rem;">Model: ${inf.model_version} · Max confidence: ${inf.max_confidence ?? "—"}%</div>
          <div style="margin-top:0.5rem;">${inf.detections.map(d =>
            `<div class="text-muted" style="padding-left:0.5rem;">• ${d.label} — ${d.confidence}% confidence</div>`
          ).join("")}</div>`;
      } else if (inf.status === "SUCCESS") {
        html = `
          <div class="status-normal">Analysis complete — no anomalies detected.</div>
          <div class="text-muted" style="margin-top:0.25rem;">Model: ${inf.model_version}</div>`;
      } else if (inf.status === "MODEL_UNAVAILABLE") {
        html = `
          <div class="status-warning" style="color:#f59e0b;">Upload saved, but YOLO model is not available.</div>
          <div class="text-muted" style="margin-top:0.25rem;">${inf.message}</div>`;
      } else {
        html = `
          <div class="status-critical">Analysis failed.</div>
          <div class="text-muted" style="margin-top:0.25rem;">${inf.message || "Unknown error during inference."}</div>`;
      }

      result.innerHTML = html;
      loadScans();
    } else {
      result.innerHTML = `<span class="status-critical">${data.error?.message || "Upload failed"}</span>`;
    }
  } catch (err) {
    result.innerHTML = `<span class="status-critical">${err.message}</span>`;
  }
}

async function loadScans() {
  const { data } = await api.get(`/api/imaging/patient/${DEMO_PATIENT_ID}/scans`);
  const list = document.getElementById("scansList");
  if (!data.ok) {
    list.innerHTML = `<div class="text-muted">${data.error?.message}</div>`;
    return;
  }
  if (data.data.length === 0) {
    list.innerHTML = `<div class="text-muted">No scans uploaded.</div>`;
    return;
  }
  list.innerHTML = `<div class="table-scroll"><table class="table">
    <thead><tr><th>Type</th><th>Confidence</th><th>Uploaded</th></tr></thead>
    <tbody>${data.data.map(s => {
      const d = new Date(s.uploaded_at);
      const dateStr = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" });
      const timeStr = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" });
      return `
      <tr>
        <td>${s.scan_type}</td>
        <td>${s.confidence_score != null ? s.confidence_score + "%" : "—"}</td>
        <td class="text-muted">${dateStr} · ${timeStr}</td>
      </tr>`;
    }).join("")}</tbody>
  </table></div>`;
}
