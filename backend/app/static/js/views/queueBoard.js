import { api } from "../api.js?v=1";
import { getUser, logout } from "../auth.js?v=1";
import { doctorSidebar } from "./doctorShared.js?v=1";

export function renderQueueBoard(container) {
  // Clear any previously running queue timer
  if (window.__queueInterval) {
    clearInterval(window.__queueInterval);
    window.__queueInterval = null;
  }

  const user = getUser() || {};
  const isDoctor = user.role === "Doctor";
  const isLabTech = user.role === "LabTech";
  const doctorTitle = isDoctor
    ? `Doctor Queue — ${user.full_name || "Doctor"} (${user.department || "OPD"})`
    : isLabTech ? "Lab Orders Queue — All Statuses" : (user.role === "Admin" ? "Live Queues — All Doctors" : "Live Queue Status");

  container.innerHTML = `
    <div class="app-shell">
      ${isDoctor ? doctorSidebar("#/queue") : `
      <aside class="sidebar">
        <div>
          <div class="sidebar-brand">
            <img class="sidebar-brand-icon" src="/assets/medisense-mark.png" alt="MediSense AI">
            <div>
              <div class="sidebar-brand-title">MediSense AI</div>
              <div class="sidebar-brand-subtitle">${isDoctor ? "Clinical Decision Support" : "Live Queue"}</div>
            </div>
          </div>
          <nav class="sidebar-nav">
            ${isDoctor ? '<a href="#/doctor-dashboard">Dashboard</a>' : ""}
            ${isDoctor ? '<a href="#/doctor">Console Overview</a>' : ""}
            ${user?.role === "Patient" ? '<a href="#/patient-dashboard">My Dashboard</a>' : ""}
            ${user?.role === "Admin" ? '<a href="#/admin-dashboard">Admin Dashboard</a>' : ""}
            ${user?.role === "Admin" ? '<a href="#/admin-doctors">Manage Doctors</a>' : ""}
            ${user?.role === "Admin" ? '<a href="#/admin-appointments">All Appointments</a>' : ""}
            ${user?.role === "Admin" ? '<a href="#/admin-departments">Departments</a>' : ""}
            ${user?.role === "Admin" ? '<a href="#/admin-audit">Audit Logs</a>' : ""}
            ${user?.role === "LabTech" ? '<a href="#/lab-dashboard">Dashboard</a>' : ""}
            ${user?.role === "LabTech" ? '<a href="#/lab-pending">Pending Orders</a>' : ""}
            ${user?.role === "LabTech" ? '<a href="#/lab">Upload Scan</a>' : ""}
            ${user?.role === "LabTech" ? '<a href="#/lab-overview">Scan Overview</a>' : ""}
            ${user?.role === "LabTech" ? '<a href="#/lab-vitals">Vitals</a>' : ""}
            ${user?.role === "LabTech" ? '<a href="#/lab-lookup">Patient Lookup</a>' : ""}
            ${user?.role === "LabTech" ? '<a href="#/lab-history">Scan History</a>' : ""}
            ${isDoctor ? '<a href="#/lab">Scan Uploads</a>' : ""}
            <a href="#/queue" class="active">Live Queue</a>
          </nav>
        </div>
        <div class="sidebar-footer">
          <div class="flex items-center gap-3">
            <div class="user-avatar">${user?.role === "Patient" ? "PT" : isDoctor ? "DR" : "LT"}</div>
            <div>
              <div class="user-name">${user?.full_name || "User"}</div>
              <div class="user-role">${isDoctor ? "● OPD Online" : user?.role || "Online"}</div>
            </div>
          </div>
          <button id="logoutBtn" class="sidebar-logout-btn">Logout</button>
        </div>
      </aside>`}
      <main class="main">
        <header class="top-header">
          <div>
            <div class="page-title">${isLabTech ? "Lab Orders Queue" : "Live Queue"}</div>
            <div class="text-xs text-muted" style="margin-top:0.25rem;">${isLabTech ? "Track pending, in-consultation and completed patient orders." : "Real-time token queue tracking and patient status."}</div>
          </div>
          <span class="badge badge-blue">Auto-refresh: 5s</span>
        </header>
        <div class="content">
          <div class="grid-12">
            <div class="col-12">
              <div class="card">
                <div class="card-title" id="queueHeaderTitle">${doctorTitle}</div>
                <div id="queuePanel" class="loading">Loading queue...</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  `;

  container.querySelector("#logoutBtn")?.addEventListener("click", () => {
    if (window.__queueInterval) clearInterval(window.__queueInterval);
    logout();
  });

  const pollAction = isLabTech
    ? loadPendingLabOrders
    : user.role === "Admin" ? loadAllQueues
    : () => loadQueue(user);

  pollAction();
  window.__queueInterval = setInterval(() => {
    if (!document.getElementById("queuePanel")) {
      clearInterval(window.__queueInterval);
      window.__queueInterval = null;
      return;
    }
    pollAction();
  }, 5000);
}

async function loadPendingLabOrders() {
  const panel = document.getElementById("queuePanel");
  if (!panel) return;

  const { data } = await api.get("/api/appointments/my");
  const currentPanel = document.getElementById("queuePanel");
  if (!currentPanel) return;

  if (!data?.ok) {
    currentPanel.innerHTML = `<div class="text-muted">${data?.error?.message || "Unable to load pending lab orders."}</div>`;
    return;
  }

  const pendingOrders = data.data || [];
  if (!pendingOrders.length) {
    currentPanel.innerHTML = `<div class="text-muted" style="padding:1.5rem;text-align:center;">No lab orders or patient appointments found.</div>`;
    return;
  }

  currentPanel.innerHTML = `
    <div class="table-scroll">
      <table class="table">
        <thead><tr>
          <th>Patient MRI ID</th><th>Patient</th><th>Doctor</th><th>Test / Request</th><th>Status</th><th>Token</th><th>Created</th>
        </tr></thead>
        <tbody>${pendingOrders.map((order) => {
          const d = order.created_at ? new Date(order.created_at) : null;
          const dateStr = d ? d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" }) : "—";
          return `
            <tr>
              <td><code style="color:#38bdf8;font-weight:600;">${resolvePatientPortalId(order)}</code></td>
              <td>${order.patient_name || "Unknown"}</td>
              <td>${order.doctor_name || "Unknown"}</td>
              <td>${order.suggested_test || "Diagnostic test pending"}</td>
              <td><span class="badge ${getLabStatusClass(order.lab_status)}">${formatLabStatus(order.lab_status)}</span></td>
              <td><strong>#${String(order.token_number || "—").padStart(2, "0")}</strong></td>
              <td class="text-muted">${dateStr}</td>
            </tr>`;
        }).join("")}</tbody>
      </table>
    </div>`;
}

function getLabStatusClass(status) {
  const normalizedStatus = String(status || "Pending").toUpperCase();
  if (normalizedStatus === "COMPLETED") return "badge-emerald";
  if (normalizedStatus === "INCONSULTATION" || normalizedStatus === "IN_CONSULTATION") return "badge-blue";
  return "badge-amber";
}

function formatLabStatus(status) {
  const normalizedStatus = String(status || "Pending").toUpperCase();
  if (normalizedStatus === "INCONSULTATION" || normalizedStatus === "IN_CONSULTATION") return "In Consultation";
  if (normalizedStatus === "COMPLETED") return "Completed";
  return "Pending";
}

// Patient portal exact MRI ID resolver
function resolvePatientPortalId(a) {
  if (!a) return "—";

  const p = a.patient || a;

  // 1. Direct checks for exact portal ID / MRI ID keys
  if (p.portal_id && String(p.portal_id).trim()) return String(p.portal_id).trim();
  if (p.portalId && String(p.portalId).trim()) return String(p.portalId).trim();
  if (p.patient_portal_id && String(p.patient_portal_id).trim()) return String(p.patient_portal_id).trim();
  if (p.mrn && String(p.mrn).trim()) return String(p.mrn).trim();
  if (p.mri_id && String(p.mri_id).trim()) return String(p.mri_id).trim();
  if (p.mri_number && String(p.mri_number).trim()) return String(p.mri_number).trim();

  if (p.public_id && typeof p.public_id === "string" && p.public_id.toUpperCase().startsWith("MRI-")) {
    return p.public_id.toUpperCase();
  }

  // 2. Exact Patient numeric ID (Appointment ID ko ignore karein)
  let ptId = null;
  if (a.patient && a.patient.id != null) {
    ptId = a.patient.id;
  } else if (a.patient_id != null) {
    ptId = a.patient_id;
  } else if (p !== a && p.id != null) {
    ptId = p.id;
  } else if (a.role === "Patient" && a.id != null) {
    ptId = a.id;
  }

  // 3. Format as exact patient portal ID (MRI-013)
  if (ptId != null) {
    return `MRI-${String(ptId).padStart(3, "0")}`;
  }

  return "—";
}

async function loadAllQueues() {
  const panel = document.getElementById("queuePanel");
  if (!panel) return;

  const { data: doctorsData } = await api.get("/api/appointments/doctors");
  const currentPanel = document.getElementById("queuePanel");
  if (!currentPanel) return;

  if (!doctorsData?.ok || !doctorsData.data?.length) {
    currentPanel.innerHTML = `<div class="text-muted">No doctors or live queues available.</div>`;
    return;
  }

  const queues = await Promise.all(doctorsData.data.map(async (doctor) => {
    const { data } = await api.get(`/api/appointments/queue/${doctor.id}`);
    return { doctor, queue: data?.ok ? data.data : null };
  }));

  const activePanel = document.getElementById("queuePanel");
  if (!activePanel) return;

  activePanel.innerHTML = `
    <div class="admin-queue-board">
      ${queues.map(({ doctor, queue }) => {
        if (!queue) {
          return `
            <div class="admin-q-card">
              <div style="font-weight:700;">${doctor.full_name}</div>
              <div class="text-muted text-sm" style="margin-top:0.5rem;">Queue unavailable.</div>
            </div>`;
        }
        const waiting = queue.waiting || [];
        const nextTokens = waiting.length
          ? waiting.slice(0, 5).map(a => `<span class="badge badge-amber">#${String(a.token_number).padStart(2, "0")}</span>`).join(" ")
          : `<span class="text-muted text-xs">Empty</span>`;

        return `
          <div class="admin-q-card">
            <div class="flex items-center justify-between mb-2">
              <div style="font-weight:700;font-size:0.875rem;">${doctor.full_name}</div>
              <span class="badge ${doctor.is_active ? "badge-emerald" : "badge-rose"}">${doctor.is_active ? "Active" : "Break"}</span>
            </div>
            <div class="text-xs text-muted mb-3">${doctor.department}</div>
            <div class="text-xs text-muted mb-1">NOW SERVING</div>
            <div class="admin-q-current">${queue.current_serving_token ? `#${String(queue.current_serving_token).padStart(2, "0")}` : "No patient"}</div>
            <div class="text-xs text-muted" style="margin-top:0.75rem;margin-bottom:0.375rem;">NEXT IN QUEUE</div>
            <div class="flex items-center gap-2">${nextTokens}</div>
            <div class="text-xs text-muted" style="margin-top:0.75rem;">${waiting.length} patient${waiting.length !== 1 ? "s" : ""} waiting</div>
          </div>`;
      }).join("")}
    </div>`;
}

async function loadQueue(user) {
  const panel = document.getElementById("queuePanel");
  if (!panel) return;

  const doctorId = (user?.role === "Doctor" && user.id) ? user.id : 2;

  try {
    const { data } = await api.get(`/api/appointments/queue/${doctorId}`);
    const activePanel = document.getElementById("queuePanel");
    if (!activePanel) return;

    if (!data?.ok) {
      activePanel.innerHTML = `<div class="text-muted">${data?.error?.message || "Failed to load queue."}</div>`;
      return;
    }

    const q = data.data || {};
    const currentServing = q.current_serving_token ? `#${String(q.current_serving_token).padStart(2, "0")}` : "—";
    const lastAllocated = q.last_allocated_token ? `#${String(q.last_allocated_token).padStart(2, "0")}` : "—";
    const waitTime = q.estimated_wait_minutes ?? 0;
    const waitingList = q.waiting || [];

    activePanel.innerHTML = `
      <div class="queue-summary flex items-center gap-4 mb-4 flex-wrap">
        <div class="text-sm">Current Serving: <strong class="text-emerald" style="font-size:1.1rem;">${currentServing}</strong></div>
        <div class="text-sm">Last Allocated: <strong class="text-secondary">${lastAllocated}</strong></div>
        <div class="text-sm">Estimated Wait: <strong class="text-amber">${waitTime} min</strong></div>
        <div class="text-sm">Waiting Count: <strong>${waitingList.length}</strong></div>
      </div>
      ${waitingList.length > 0 ? `
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Patient MRI ID</th>
                <th>Status</th>
                <th>Scheduled Slot</th>
              </tr>
            </thead>
            <tbody>
              ${waitingList.map(a => {
                const d = a.scheduled_time ? new Date(a.scheduled_time) : null;
                const dateStr = d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" }) : "—";
                const timeStr = d ? d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" }) : "";
                
                // Exact MRI ID from patient portal
                const ptIdStr = resolvePatientPortalId(a);

                return `
                  <tr>
                    <td><strong class="text-blue">#${String(a.token_number).padStart(2, "0")}</strong></td>
                    <td><code class="patient-id">${ptIdStr}</code></td>
                    <td><span class="badge badge-amber">${a.status || "WAITING"}</span></td>
                    <td class="text-muted">${dateStr} · ${timeStr}</td>
                  </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>` : `
        <div class="queue-empty text-muted text-sm">
          No patients currently waiting in queue.
        </div>`}
    `;
  } catch (err) {
    console.error("Queue load error:", err);
    const activePanel = document.getElementById("queuePanel");
    if (activePanel) {
      activePanel.innerHTML = `<div class="text-rose text-sm">Failed to connect to live queue server.</div>`;
    }
  }
}