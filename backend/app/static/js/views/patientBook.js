import { api } from "../api.js?v=1";
import { getUser } from "../auth.js?v=4";
import { patientSidebar, patientPortalId, bindPatientLogout } from "./patientShared.js?v=2";

const WA_NUMBER = "923165353583";

let step = 1;
let selectedDoctor = null;
let selectedDate = null;
let selectedSlotTime = null;
let phoneNumber = "";
let localBookedCache = {};

export function renderPatientBook(container) {
  container.innerHTML = `
    <div class="app-shell">
      ${patientSidebar("#/patient-book")}
      <main class="main">
        <header class="top-header">
          <div>
            <div class="page-title">Book Appointment</div>
            <div class="text-xs text-muted" style="margin-top:0.25rem;">Generate your OPD token in 3 steps.</div>
          </div>
          <div class="flex items-center gap-2">
            ${patientPortalId()}
          </div>
        </header>
        <div class="content">
          <div class="pt-stepper mb-4">
            <div class="pt-step" id="step-ind-1"><span>1</span> Select Doctor</div>
            <div class="pt-step-line"></div>
            <div class="pt-step" id="step-ind-2"><span>2</span> Pick Date & Time</div>
            <div class="pt-step-line"></div>
            <div class="pt-step" id="step-ind-3"><span>3</span> Confirm & Book</div>
          </div>
          <div id="bookContent" class="card">
            <div class="loading">Loading doctors...</div>
          </div>
        </div>
      </main>
    </div>`;

  bindPatientLogout(container);
  step = 1; selectedDoctor = null; selectedDate = null; selectedSlotTime = null; phoneNumber = "";
  updateStepIndicators();
  showStep1();
}

function updateStepIndicators() {
  [1, 2, 3].forEach(n => {
    const el = document.getElementById(`step-ind-${n}`);
    if (!el) return;
    el.className = `pt-step ${n < step ? "pt-step-done" : n === step ? "pt-step-active" : ""}`;
  });
}

async function showStep1() {
  const box = document.getElementById("bookContent");
  box.innerHTML = `<div class="loading">Loading available doctors...</div>`;
  const { data } = await api.get("/api/appointments/doctors");
  if (!data.ok) { box.innerHTML = `<div class="text-muted">Failed to load doctors.</div>`; return; }

  const departments = [...new Set(data.data.map(d => d.department))];

  box.innerHTML = `
    <div class="card-title mb-3">Select a Doctor</div>
    <div class="flex items-center gap-2 mb-3 flex-wrap" id="deptFilters">
      <button class="btn btn-slate btn-sm pt-dept-btn active" data-dept="">All Departments</button>
      ${departments.map(d => `<button class="btn btn-slate btn-sm pt-dept-btn" data-dept="${d}">${d}</button>`).join("")}
    </div>
    <div id="doctorGrid" class="pt-doctor-grid">
      ${renderDoctorCards(data.data)}
    </div>`;

  box.querySelectorAll(".pt-dept-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      box.querySelectorAll(".pt-dept-btn").forEach(b => {
        b.classList.remove("active", "btn-blue");
        b.classList.add("btn-slate");
      });
      btn.classList.remove("btn-slate");
      btn.classList.add("active", "btn-blue");
      const dept = btn.dataset.dept;
      document.getElementById("doctorGrid").innerHTML = renderDoctorCards(
        dept ? data.data.filter(d => d.department === dept) : data.data
      );
      bindDoctorCards(data.data);
    });
  });
  bindDoctorCards(data.data);
}

function renderDoctorCards(doctors) {
  if (!doctors.length) return `<div class="text-muted">No doctors in this department.</div>`;
  return doctors.map(d => `
    <div class="pt-doctor-card ${!d.is_active ? "pt-doctor-inactive" : ""}" data-id="${d.id}">
      <div class="pt-doctor-avatar">${d.full_name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase()}</div>
      <div class="pt-doctor-info">
        <div class="pt-doctor-name">${d.full_name}</div>
        <span class="badge ${d.is_active ? "badge-emerald" : "badge-rose"}">${d.is_active ? "Available" : "Unavailable"}</span>
      </div>
      <div class="pt-doctor-dept">${d.department}</div>
      <button class="btn btn-blue btn-sm pt-select-doc" data-id="${d.id}" ${!d.is_active ? "disabled" : ""}>Select</button>
    </div>`).join("");
}

function bindDoctorCards(doctors) {
  document.querySelectorAll(".pt-select-doc").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedDoctor = doctors.find(d => d.id === parseInt(btn.dataset.id));
      if (selectedDoctor) { step = 2; updateStepIndicators(); showStep2(); }
    });
  });
}

function showStep2() {
  const box = document.getElementById("bookContent");
  const today = new Date().toISOString().split("T")[0];
  box.innerHTML = `
    <style>
      .custom-back-btn {
        background-color: #475569;
        color: #ffffff;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 0.375rem;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s ease;
      }
      .custom-back-btn:hover {
        background-color: #d5ece6;
        color: #18594f;
      }
      .custom-date-picker {
        background-color: #ffffff !important;
        border: 1px solid #d5e0d8 !important;
        color: #20332b !important;
        padding: 0.65rem 0.85rem !important;
        border-radius: 0.5rem !important;
        font-family: inherit !important;
        font-size: 0.9rem !important;
        outline: none !important;
        width: 100% !important;
        color-scheme: light !important;
      }
      .custom-date-picker:focus {
        border-color: #19866d !important;
        box-shadow: 0 0 0 3px rgba(25, 134, 109, 0.12) !important;
      }
      .custom-date-picker::-webkit-calendar-picker-indicator {
        opacity: 0.7;
        cursor: pointer;
      }
      /* Clean column alignment: Time on top, Booked beneath */
      .pt-slot-booked {
        opacity: 0.55 !important;
        cursor: not-allowed !important;
        background: #1e293b !important;
        border: 1px dashed #475569 !important;
        color: #64748b !important;
        pointer-events: none;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 0.35rem 0.5rem !important;
        min-height: 46px !important;
        box-sizing: border-box !important;
      }
      .pt-slot-booked-time {
        font-size: 0.82rem !important;
        font-weight: 600 !important;
        color: #64748b !important;
        line-height: 1.2 !important;
        white-space: nowrap !important;
      }
      .pt-slot-booked-label {
        font-size: 0.68rem !important;
        color: #94a3b8 !important;
        font-weight: 500 !important;
        line-height: 1 !important;
        margin-top: 2px !important;
        white-space: nowrap !important;
      }
    </style>

    <div class="card-title mb-3">Select Date & Time for <strong>${selectedDoctor.full_name}</strong></div>

    <div class="pt-book-form-grid">
      <div class="pt-book-field">
        <label class="pt-book-label">Appointment Date</label>
        <input type="date" id="apptDate" class="custom-date-picker" min="${today}" value="${today}">
      </div>
      <div class="pt-book-field">
        <label class="pt-book-label">Phone Number (for WhatsApp confirmation)</label>
        <input type="tel" id="phoneInput" class="pt-book-phone-input" placeholder="03165353583" value="${phoneNumber}" maxlength="15">
      </div>
    </div>

    <div class="pt-book-slots-section">
      <div class="flex items-center justify-between mb-2">
        <label class="pt-book-label" style="margin:0;">Select a Time Slot</label>
        <span class="text-xs text-muted" id="slotsStatusInfo">Updating slots...</span>
      </div>
      <div class="pt-slot-grid" id="slotGrid">
        <div class="loading">Loading available slots...</div>
      </div>
    </div>

    <div class="flex items-center gap-2 mt-4">
      <button class="custom-back-btn" id="backBtn"> Change Doctor</button>
    </div>`;

  document.getElementById("backBtn").addEventListener("click", () => { step = 1; updateStepIndicators(); showStep1(); });

  loadSlots(today);

  document.getElementById("apptDate").addEventListener("change", (e) => {
    loadSlots(e.target.value);
  });
}

async function loadSlots(dateStr) {
  const grid = document.getElementById("slotGrid");
  const statusInfo = document.getElementById("slotsStatusInfo");
  grid.innerHTML = `<div class="loading">Checking doctor availability...</div>`;

  const { data } = await api.get(`/api/appointments/booked-slots?doctor_id=${selectedDoctor.id}&date=${dateStr}`);
  let bookedSlots = (data && data.ok && Array.isArray(data.data)) ? data.data : [];

  const cacheKey = `${selectedDoctor.id}_${dateStr}`;
  if (localBookedCache[cacheKey]) {
    bookedSlots = Array.from(new Set([...bookedSlots, ...localBookedCache[cacheKey]]));
  }

  const normalizedBooked = bookedSlots.map(s => {
    if (typeof s === "string" && s.includes(":")) {
      const parts = s.split(":");
      return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
    }
    return s;
  });

  const allSlots = generateSlots();
  const visibleBooked = [...new Set(normalizedBooked)].filter(slot => allSlots.includes(slot));

  if (statusInfo) {
    statusInfo.textContent = `${visibleBooked.length} slot${visibleBooked.length === 1 ? '' : 's'} booked`;
  }

  const slotHtml = allSlots.map(s => {
    const isBooked = visibleBooked.includes(s);
    if (isBooked) {
      return `<button type="button" class="pt-slot-btn pt-slot-booked" data-time="${s}" disabled tabindex="-1">
        <span class="pt-slot-booked-time">${formatSlot(s)}</span>
        <span class="pt-slot-booked-label">Booked</span>
      </button>`;
    }
    return `<button type="button" class="pt-slot-btn" data-time="${s}">${formatSlot(s)}</button>`;
  }).join("");

  grid.innerHTML = slotHtml;

  grid.querySelectorAll(".pt-slot-btn:not(.pt-slot-booked)").forEach(btn => {
    btn.addEventListener("click", async () => {
      phoneNumber = document.getElementById("phoneInput").value.trim();
      if (!phoneNumber) { 
        alert("Please enter your phone number for WhatsApp confirmation."); 
        document.getElementById("phoneInput").focus();
        return; 
      }

      const slotTime = btn.dataset.time;
      const d = document.getElementById("apptDate").value;

      btn.disabled = true;
      btn.textContent = "Checking...";
      const recheck = await api.get(`/api/appointments/booked-slots?doctor_id=${selectedDoctor.id}&date=${d}`);
      let latestBooked = (recheck && recheck.data && recheck.data.ok && Array.isArray(recheck.data.data)) ? recheck.data.data : [];
      
      const currentCacheKey = `${selectedDoctor.id}_${d}`;
      if (localBookedCache[currentCacheKey]) {
        latestBooked = Array.from(new Set([...latestBooked, ...localBookedCache[currentCacheKey]]));
      }

      const normalizedLatest = latestBooked.map(s => {
        if (typeof s === "string" && s.includes(":")) {
          const parts = s.split(":");
          return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
        }
        return s;
      });

      if (normalizedLatest.includes(slotTime)) {
        alert("This time slot is already booked. Please select an available slot.");
        loadSlots(d);
        return;
      }

      grid.querySelectorAll(".pt-slot-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      selectedSlotTime = slotTime;
      const localDT = new Date(`${d}T${slotTime}:00`);
      selectedDate = localDT.toISOString();
      step = 3; 
      updateStepIndicators(); 
      showStep3();
    });
  });
}

function formatSlot(time) {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function generateSlots() {
  const slots = [];
  for (let h = 8; h <= 17; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 17) slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
}

function showStep3() {
  const box = document.getElementById("bookContent");
  const dt = new Date(selectedDate);
  const dateStr = dt.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Karachi" });
  const timeStr = dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" });

  box.innerHTML = `
    <style>
      .custom-back-btn {
        background-color: #475569;
        color: #ffffff;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 0.375rem;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s ease;
      }
      .custom-back-btn:hover {
        background-color: #d5ece6;
        color: #18594f;
      }
    </style>

    <div class="card-title mb-3">Confirm Booking</div>
    <div class="pt-confirm-card">
      <div class="pt-confirm-row"><span>Doctor</span><strong>${selectedDoctor.full_name}</strong></div>
      <div class="pt-confirm-row"><span>Department</span><strong>${selectedDoctor.department}</strong></div>
      <div class="pt-confirm-row"><span>Date</span><strong>${dateStr}</strong></div>
      <div class="pt-confirm-row"><span>Time Slot</span><strong>${timeStr} (${selectedSlotTime})</strong></div>
      <div class="pt-confirm-row"><span>Phone</span><strong>${phoneNumber}</strong></div>
    </div>
    <div id="bookingResult"></div>
    <div class="flex items-center justify-center gap-3 mt-4">
      <button class="custom-back-btn" id="backBtn2"> Back</button>
      <button class="btn btn-emerald" id="confirmBtn"> Confirm & Generate Token</button>
    </div>`;

  document.getElementById("backBtn2").addEventListener("click", () => { step = 2; updateStepIndicators(); showStep2(); });
  document.getElementById("confirmBtn").addEventListener("click", confirmBooking);
}

async function confirmBooking() {
  const btn = document.getElementById("confirmBtn");
  btn.disabled = true; 
  btn.textContent = "Verifying availability...";

  const dt = new Date(selectedDate);
  const dateStrISO = dt.toISOString().split("T")[0];

  const doubleCheck = await api.get(`/api/appointments/booked-slots?doctor_id=${selectedDoctor.id}&date=${dateStrISO}`);
  let finalBooked = (doubleCheck && doubleCheck.data && doubleCheck.data.ok && Array.isArray(doubleCheck.data.data)) ? doubleCheck.data.data : [];

  const currentCacheKey = `${selectedDoctor.id}_${dateStrISO}`;
  if (localBookedCache[currentCacheKey]) {
    finalBooked = Array.from(new Set([...finalBooked, ...localBookedCache[currentCacheKey]]));
  }

  const normalizedFinal = finalBooked.map(s => {
    if (typeof s === "string" && s.includes(":")) {
      const parts = s.split(":");
      return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
    }
    return s;
  });

  if (normalizedFinal.includes(selectedSlotTime)) {
    alert("This slot is already booked. Please select an alternate slot.");
    step = 2;
    updateStepIndicators();
    showStep2();
    return;
  }

  btn.textContent = "Booking & Generating Token...";
  const { data } = await api.post("/api/appointments/book", {
    doctor_id: selectedDoctor.id,
    scheduled_time: selectedDate,
    department: selectedDoctor.department,
  });
  
  const resultEl = document.getElementById("bookingResult");
  if (data && data.ok) {
    if (!localBookedCache[currentCacheKey]) {
      localBookedCache[currentCacheKey] = [];
    }
    localBookedCache[currentCacheKey].push(selectedSlotTime);

    const t = data.data;
    const currentUser = getUser();
    const patientPortalId = currentUser?.portal_id || (currentUser?.id ? `MRI-${String(currentUser.id).padStart(3, "0")}` : "—");
    const dateFormatted = dt.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Karachi" });
    const timeFormatted = dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" });

    resultEl.innerHTML = `
      <div class="pt-token-badge">
        <img class="pt-token-image" src="/assets/token.png" alt="MediSense AI token branding">
        <div class="pt-token-label">YOUR TOKEN NUMBER</div>
        <div class="pt-token-number">#${String(t.token_number).padStart(2, "0")}</div>
        <div class="text-xs text-muted mt-2">Patient MRI ID: ${patientPortalId}</div>
        <div class="text-xs text-muted">Please arrive 15 minutes before your slot.</div>
      </div>
      <div class="pt-auto-actions" id="autoActions">
        <div class="pt-auto-status" id="pdfStatus">⏳ Generating appointment token...</div>
        <div class="pt-auto-status" id="waStatus">⏳ Sending WhatsApp confirmation...</div>
      </div>`;

    btn.style.display = "none";
    
    const bookAnotherBtn = document.getElementById("backBtn2");
    bookAnotherBtn.textContent = "Book Another";
    bookAnotherBtn.onclick = () => {
      step = 2;
      selectedDate = null;
      selectedSlotTime = null;
      updateStepIndicators();
      showStep2();
    };

    const slipInfo = {
      token: t.token_number,
      patientPortalId,
      doctor: selectedDoctor.full_name,
      department: selectedDoctor.department,
      date: dateFormatted,
      time: timeFormatted,
      phone: phoneNumber,
    };
    
    setTimeout(() => {
      generateSlipPDF(slipInfo);
      document.getElementById("pdfStatus").innerHTML = " Appointment token downloaded";
    }, 500);

    setTimeout(() => {
      const patientName = currentUser?.full_name || "Patient";
      const msg = `*Dear ${patientName},*\n\n` +
        `Your appointment has been successfully confirmed.\n\n` +
        `👨‍⚕️ *Doctor:* ${selectedDoctor.full_name} (${selectedDoctor.department})\n` +
        `📅 *Date:* ${dateFormatted}\n` +
        `🕐 *Time:* ${timeFormatted}\n` +
        `🎫 *Token Number:* #${String(t.token_number).padStart(2, "0")}\n\n` +
        `⚠️ *Instructions:* Please arrive at the hospital reception / OPD desk *15–20 minutes prior* to your scheduled slot. Track your live queue status directly from your patient dashboard.\n\n` +
        `_Thank you — MediSense AI Healthcare Team_`;
      const phoneClean = phoneNumber.replace(/[^0-9]/g, "");
      let waPhone = phoneClean;
      if (phoneClean.startsWith("0")) {
        waPhone = "92" + phoneClean.substring(1);
      } else if (phoneClean.length === 10 && phoneClean.startsWith("3")) {
        waPhone = "92" + phoneClean;
      }
      window.open(`https://api.whatsapp.com/send?phone=${waPhone}&text=${encodeURIComponent(msg)}`, "_blank");
      document.getElementById("waStatus").innerHTML = " WhatsApp confirmation sent";
    }, 1200);

  } else {
    resultEl.innerHTML = `<div class="text-rose mt-2">${data?.error?.message || "Booking failed or slot already taken. Please try another slot."}</div>`;
    btn.disabled = false; 
    btn.textContent = "Confirm & Generate Token";
  }
}

async function generateSlipPDF(info) {
  const user = getUser();
  const tokenNumStr = `#${String(info.token).padStart(2, "0")}`;

  try {
    const baseImg = new Image();
    baseImg.crossOrigin = "anonymous";
    baseImg.src = "/assets/token.png";

    await new Promise((resolve, reject) => {
      baseImg.onload = resolve;
      baseImg.onerror = reject;
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const w = baseImg.naturalWidth || 800;
    const h = baseImg.naturalHeight || 1100;
    canvas.width = w;
    canvas.height = h;

    ctx.drawImage(baseImg, 0, 0, w, h);

    ctx.textAlign = "center";
    ctx.fillStyle = "#64748b";
    ctx.font = "bold 22px 'Segoe UI', Arial, sans-serif";
    ctx.fillText("YOUR TOKEN NUMBER", w / 2, h * 0.38);

    ctx.fillStyle = "#10b981";
    ctx.font = "900 80px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(tokenNumStr, w / 2, h * 0.46);

    ctx.font = "20px 'Segoe UI', Arial, sans-serif";
    const startY = h * 0.53;
    const rowGap = 36;
    const paddingX = w * 0.12;
    const rightX = w - paddingX;

    const details = [
      ["Patient Name", user?.full_name || "—"],
      ["Patient MRI ID", info.patientPortalId || user?.portal_id || "—"],
      ["Doctor", info.doctor],
      ["Department", info.department],
      ["Date", info.date],
      ["Time", info.time],
      ["Phone", info.phone]
    ];

    details.forEach(([label, value], i) => {
      const y = startY + i * rowGap;

      ctx.textAlign = "left";
      ctx.fillStyle = "#64748b";
      ctx.font = "500 19px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(label, paddingX, y);

      ctx.textAlign = "right";
      ctx.fillStyle = "#1e293b";
      ctx.font = "bold 19px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(value, rightX, y);

      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(paddingX, y + 10);
      ctx.lineTo(rightX, y + 10);
      ctx.stroke();
    });

    ctx.textAlign = "center";
    ctx.fillStyle = "#92400e";
    ctx.font = "italic 16px 'Segoe UI', Arial, sans-serif";
    ctx.fillText("⚠️ Arrive 15 minutes before your slot with original CNIC.", w / 2, h * 0.86);

    const a = document.createElement("a");
    a.download = `MediSense_Token_${String(info.token).padStart(2, "0")}.png`;
    a.href = canvas.toDataURL("image/png");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

  } catch (err) {
    console.error("Token image generation failed:", err);
  }
}