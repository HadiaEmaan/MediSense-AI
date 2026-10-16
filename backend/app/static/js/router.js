import { getUser, isLoggedIn, clearSession, requireRole } from "./auth.js?v=4";
import { renderSignup } from "./views/signup.js?v=2";
import { renderLogin } from "./views/login.js?v=2";
import { renderDoctorDashboard } from "./views/doctorDashboard.js?v=3";
import { renderDoctorCockpit } from "./views/doctorCockpit.js?v=12";
import { renderPatientPortal } from "./views/patientPortal.js?v=2";
import { renderPatientDashboard } from "./views/patientDashboard.js?v=2";
import { renderPatientBook } from "./views/patientBook.js?v=10";
import { renderPatientAppointments } from "./views/patientAppointments.js?v=2";
import { renderPatientRecords } from "./views/patientRecords.js?v=2";
import { renderPatientReports } from "./views/patientReports.js?v=2";
import { renderPatientVitals } from "./views/patientVitals.js?v=2";
import { renderPatientReminders } from "./views/patientReminders.js?v=2";
import { renderPatientQueue } from "./views/patientQueue.js?v=1";
import { renderQueueBoard } from "./views/queueBoard.js?v=8";
import { renderLabDashboard } from "./views/labDashboard.js?v=5";
import { renderLabOverview } from "./views/labOverview.js?v=2";
import { renderLabPending } from "./views/labPending.js?v=3";
import { renderLabLookup } from "./views/labLookup.js?v=2";
import { renderLabHistory } from "./views/labHistory.js?v=2";
import { renderLabVitals } from "./views/labVitals.js?v=1";
import { renderLabTech } from "./views/labTech.js?v=14";
import { renderAdminDashboard } from "./views/adminDashboard.js?v=1";
import { renderAdminDoctors } from "./views/adminDoctors.js?v=1";
import { renderAdminQueue } from "./views/adminQueue.js?v=1";
import { renderAdminAppointments } from "./views/adminAppointments.js?v=1";
import { renderAdminDepartments } from "./views/adminDepartments.js?v=1";
import { renderAdminAudit } from "./views/adminAudit.js?v=1";

const routes = {
  "#/signup": { render: renderSignup, public: true },
  "#/login": { render: renderLogin, public: true },
  "#/doctor-dashboard": { render: renderDoctorDashboard, roles: ["Doctor"] },
  "#/doctor": { render: renderDoctorCockpit, roles: ["Doctor"] },
  "#/patient": { render: renderPatientDashboard, roles: ["Patient"] },
  "#/patient-dashboard": { render: renderPatientDashboard, roles: ["Patient"] },
  "#/patient-book": { render: renderPatientBook, roles: ["Patient"] },
  "#/patient-appointments": { render: renderPatientAppointments, roles: ["Patient"] },
  "#/patient-records": { render: renderPatientRecords, roles: ["Patient"] },
  "#/patient-reports": { render: renderPatientReports, roles: ["Patient"] },
  "#/patient-vitals": { render: renderPatientVitals, roles: ["Patient"] },
  "#/patient-reminders": { render: renderPatientReminders, roles: ["Patient"] },
  "#/patient-queue": { render: renderPatientQueue, roles: ["Patient"] },
  "#/queue": { render: renderQueueBoard, roles: ["Patient", "Doctor", "LabTech", "Admin"] },
  "#/lab-dashboard": { render: renderLabDashboard, roles: ["LabTech", "Doctor", "Admin"] },
  "#/lab-overview": { render: renderLabOverview, roles: ["LabTech"] },
  "#/lab-pending": { render: renderLabPending, roles: ["LabTech", "Doctor", "Admin"] },
  "#/lab-lookup": { render: renderLabLookup, roles: ["LabTech", "Doctor", "Admin"] },
  "#/lab-history": { render: renderLabHistory, roles: ["LabTech", "Doctor", "Admin"] },
  "#/lab-vitals": { render: renderLabVitals, roles: ["LabTech", "Doctor", "Admin"] },
  "#/lab": { render: renderLabTech, roles: ["LabTech", "Doctor", "Admin"] },
  "#/admin-dashboard": { render: renderAdminDashboard, roles: ["Admin"] },
  "#/admin-doctors": { render: renderAdminDoctors, roles: ["Admin"] },
  "#/admin-queue": { render: renderAdminQueue, roles: ["Admin"] },
  "#/admin-appointments": { render: renderAdminAppointments, roles: ["Admin"] },
  "#/admin-departments": { render: renderAdminDepartments, roles: ["Admin"] },
  "#/admin-audit": { render: renderAdminAudit, roles: ["Admin"] },
};

export function initRouter() {
  window.addEventListener("hashchange", renderRoute);
  renderRoute();
}

function renderRoute() {
  const hash = window.location.hash || "#/login";
  const route = routes[hash];

  if (!route) {
    if (!isLoggedIn()) {
      window.location.replace("/login.html");
      return;
    }
    window.location.hash = defaultRouteForUser();
    return;
  }

  if (!route.public && !isLoggedIn()) {
    window.location.replace("/login.html");
    return;
  }

  if (route.roles && !route.roles.includes(getUser()?.role)) {
    window.location.hash = defaultRouteForUser();
    return;
  }

  const app = document.getElementById("app");
  app.innerHTML = "";
  route.render(app);
}

function defaultRouteForUser() {
  const user = getUser();
  if (!user) return "#/login";
  switch (user.role) {
    case "Doctor": return "#/doctor-dashboard";
    case "Patient": return "#/patient-dashboard";
    case "LabTech": return "#/lab-dashboard";
    case "Admin": return "#/admin-dashboard";
    default: return "#/login";
  }
}

export function logout() {
  clearSession();
  window.location.hash = "#/login";
}

// Auto-start the router when the module is loaded by index.html.
initRouter();
