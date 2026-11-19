const DAYS_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DAY_NAMES = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday"
};

const START_HOUR = 7;
const END_HOUR = 21;
const HOUR_HEIGHT = 58;

const BLOCK_COLORS = [
  { bg: "rgba(255, 250, 232, 0.96)", border: "#b45309", text: "#291506" },
  { bg: "rgba(224, 242, 254, 0.96)", border: "#0284c7", text: "#0c2d48" },
  { bg: "rgba(220, 252, 231, 0.96)", border: "#059669", text: "#063524" },
  { bg: "rgba(254, 243, 199, 0.96)", border: "#d97706", text: "#3d2204" },
  { bg: "rgba(252, 231, 243, 0.96)", border: "#db2777", text: "#4a0b28" },
  { bg: "rgba(237, 233, 254, 0.96)", border: "#7c3aed", text: "#281154" },
  { bg: "rgba(204, 251, 241, 0.96)", border: "#0d9488", text: "#063632" },
  { bg: "rgba(255, 237, 213, 0.96)", border: "#ea580c", text: "#431804" }
];

const STORAGE_KEY = "sms_cor_separated_v1";
const ALERT_LEAD_MINUTES = 10;
let alertsEnabled = false;
const firedAlertKeys = new Set();

let appState = {
  template: "scrapbook-daisy",
  student: {
    name: "—",
    idNumber: "—",
    courseYear: "—",
    section: "—",
    school: "—",
    term: "—"
  },
  subjects: [],
  uploadedDataUrl: null,
  filterDay: "ALL",
  filterType: "ALL",
  mobileDay: "MON"
};

const el = (id) => document.getElementById(id);

function getPhtParts() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  const parts = {};
  formatter.formatToParts(now).forEach((p) => {
    parts[p.type] = p.value;
  });

  const hour24Fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(now);
  const [h24, m24] = hour24Fmt.split(":").map(Number);

  return {
    weekdayShort: parts.weekday.toUpperCase().slice(0, 3),
    timeString: `${parts.hour}:${parts.minute}:${parts.second} ${parts.dayPeriod}`,
    dateString: `${parts.weekday}, ${parts.month} ${parts.day}, ${parts.year}`,
    minutesFromMidnight: h24 * 60 + m24
  };
}

function toMinutes(hhmm) {
  const [h, m] = String(hhmm || "00:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function format12Hour(hhmm) {
  const [h, m] = String(hhmm || "00:00").split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, "0")}:${String(m || 0).padStart(2, "0")} ${suffix}`;
}

function parse12HourTo24(timeStr, defaultPeriod = null) {
  const match = String(timeStr).trim().match(/^(\d{1,2})[:.](\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const period = (match[3] || defaultPeriod || "").toUpperCase();

  if (minute < 0 || minute > 59 || hour < 1 || hour > 23) return null;

  if (period === "PM" && hour < 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function expandDayToken(token) {
  const clean = String(token || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (!clean) return [];
  const exactMap = {
    MON: ["MON"],
    MONDAY: ["MON"],
    TUE: ["TUE"],
    TUES: ["TUE"],
    TUESDAY: ["TUE"],
    WED: ["WED"],
    WEDS: ["WED"],
    WEDNESDAY: ["WED"],
    THU: ["THU"],
    THUR: ["THU"],
    THURS: ["THU"],
    THURSDAY: ["THU"],
    FRI: ["FRI"],
    FRIDAY: ["FRI"],
    SAT: ["SAT"],
    SATURDAY: ["SAT"],
    MWF: ["MON", "WED", "FRI"],
    TTHS: ["TUE", "THU", "SAT"],
    TTH: ["TUE", "THU"],
    MW: ["MON", "WED"],
    WF: ["WED", "FRI"],
    MF: ["MON", "FRI"],
    THS: ["THU", "SAT"],
    TS: ["TUE", "SAT"],
    MTWTHF: ["MON", "TUE", "WED", "THU", "FRI"],
    MTWTHFS: ["MON", "TUE", "WED", "THU", "FRI", "SAT"]
  };
  if (exactMap[clean]) return exactMap[clean];

  const days = [];
  if (clean.includes("MON")) days.push("MON");
  if (clean.includes("TUE")) days.push("TUE");
  if (clean.includes("WED")) days.push("WED");
  if (clean.includes("THU")) days.push("THU");
  if (clean.includes("FRI")) days.push("FRI");
  if (clean.includes("SAT")) days.push("SAT");
  if (days.length) return [...new Set(days)];

  if (/^[MTWFS]+$/.test(clean)) {
    for (let i = 0; i < clean.length; i++) {
      const ch = clean[i];
      if (ch === "M") days.push("MON");
      else if (ch === "W") days.push("WED");
      else if (ch === "F") days.push("FRI");
      else if (ch === "S") days.push("SAT");
      else if (ch === "T") {
        if (clean[i + 1] === "H") {
          days.push("THU");
          i++;
        } else {
          days.push("TUE");
        }
      } else if (ch === "H") {
        days.push("THU");
      }
    }
  }
  return [...new Set(days)];
}

function getColorForSubject(code) {
  const baseCode = String(code || "SUBJ").replace(/\s*LAB$/i, "").trim();
  let hash = 0;
  for (let i = 0; i < baseCode.length; i++) {
    hash = baseCode.charCodeAt(i) + ((hash << 5) - hash);
  }
  return BLOCK_COLORS[Math.abs(hash) % BLOCK_COLORS.length];
}

function applyTemplate(templateName) {
  appState.template = templateName;
  document.body.setAttribute("data-template", templateName);
  document.querySelectorAll(".template-option").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.template === templateName);
  });
  saveToLocalStorage();
}

function playOfflineChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [659.25, 880];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.16 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.16);
      osc.stop(ctx.currentTime + i * 0.16 + 0.26);
    });
  } catch (_) {}
}

function showInAppClassAlert(title, body) {
  const banner = el("class-alert-banner");
  if (!banner) return;
  banner.innerHTML = `<strong>${title}</strong><br><span>${body}</span>`;
  banner.className = "scan-status success";
  banner.classList.remove("hidden");
}

function triggerClassAlert(alertId, title, body) {
  if (firedAlertKeys.has(alertId)) return;
  firedAlertKeys.add(alertId);

  showInAppClassAlert(title, body);
  playOfflineChime();

  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate([220, 120, 220]);
    } catch (_) {}
  }

  if (alertsEnabled && typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(title, {
        body,
        tag: alertId,
        renotify: true
      });
    } catch (_) {}
  }
}

function checkClassAlerts(pht) {
  if (!appState.subjects.length || !DAYS_ORDER.includes(pht.weekdayShort)) return;

  const todaysClasses = appState.subjects.filter((s) => s.days.includes(pht.weekdayShort));
  todaysClasses.forEach((item) => {
    const startMins = toMinutes(item.start);
    const diff = startMins - pht.minutesFromMidnight;
    const roomText = item.room || "TBA";
    const timeText = `${format12Hour(item.start)} – ${format12Hour(item.end)}`;

    if (diff === ALERT_LEAD_MINUTES) {
      triggerClassAlert(
        `${pht.dateString}-${item.code}-${item.start}-soon`,
        `Upcoming Class in ${ALERT_LEAD_MINUTES}m: ${item.code} (${item.type})`,
        `${timeText} • Room ${roomText} • PHT +8`
      );
    } else if (diff === 0) {
      triggerClassAlert(
        `${pht.dateString}-${item.code}-${item.start}-now`,
        `Class Starting Now: ${item.code} (${item.type})`,
        `${timeText} • Room ${roomText} • PHT +8`
      );
    }
  });
}

async function togglePhoneAlerts() {
  if (!alertsEnabled) {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      try {
        const perm = await Notification.requestPermission();
        alertsEnabled = perm === "granted";
      } catch (_) {
        alertsEnabled = false;
      }
    } else if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      alertsEnabled = true;
    } else {
      alertsEnabled = true;
    }
    el("btn-toggle-alerts").textContent = "Alerts: ON (Offline)";
    setStatus("Class alerts enabled (in-app banner, chime, vibration & browser notification when permitted).", "success");
  } else {
    alertsEnabled = false;
    el("btn-toggle-alerts").textContent = "Enable Phone Alerts";
    setStatus("Class alerts turned off.", "info");
  }
}

function updateClockAndTracker() {
  const pht = getPhtParts();
  el("pht-time").textContent = pht.timeString;
  el("pht-date").textContent = pht.dateString;
  el("current-day-pill").textContent = `${pht.weekdayShort} • PHT`;

  checkClassAlerts(pht);

  const box = el("live-status-box");
  if (!appState.subjects.length) {
    box.innerHTML = `<p class="helper-text" style="margin:0;">No classes loaded yet. Upload a COR photo or click + Add Class.</p>`;
    return;
  }

  if (!DAYS_ORDER.includes(pht.weekdayShort)) {
    box.innerHTML = `
      <span class="live-status-tag tag-done">Sunday Rest Day</span>
      <div class="live-class-title">No Scheduled Classes Today</div>
      <div class="live-class-meta">Monday–Saturday classes resume next (PHT +8).</div>
    `;
    return;
  }

  const todaysClasses = appState.subjects
    .filter((s) => s.days.includes(pht.weekdayShort))
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

  const currentClass = todaysClasses.find(
    (s) => pht.minutesFromMidnight >= toMinutes(s.start) && pht.minutesFromMidnight < toMinutes(s.end)
  );

  if (currentClass) {
    const minsLeft = toMinutes(currentClass.end) - pht.minutesFromMidnight;
    box.innerHTML = `
      <span class="live-status-tag tag-now">Happening Now • ${minsLeft}m left</span>
      <div class="live-class-title">${currentClass.code} (${currentClass.type})</div>
      <div class="live-class-meta">${format12Hour(currentClass.start)} – ${format12Hour(currentClass.end)} • Room ${currentClass.room || "TBA"} • EDP ${currentClass.edp || "—"}</div>
    `;
    return;
  }

  const nextClass = todaysClasses.find((s) => toMinutes(s.start) > pht.minutesFromMidnight);
  if (nextClass) {
    const minsUntil = toMinutes(nextClass.start) - pht.minutesFromMidnight;
    const hrs = Math.floor(minsUntil / 60);
    const mins = minsUntil % 60;
    const waitLabel = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    box.innerHTML = `
      <span class="live-status-tag tag-next">Up Next in ${waitLabel}</span>
      <div class="live-class-title">${nextClass.code} (${nextClass.type})</div>
      <div class="live-class-meta">${format12Hour(nextClass.start)} – ${format12Hour(nextClass.end)} • Room ${nextClass.room || "TBA"} • EDP ${nextClass.edp || "—"}</div>
    `;
    return;
  }

  box.innerHTML = `
    <span class="live-status-tag tag-done">Done for Today</span>
    <div class="live-class-title">All ${DAY_NAMES[pht.weekdayShort]} Classes Completed</div>
    <div class="live-class-meta">${todaysClasses.length} session(s) scheduled on ${DAY_NAMES[pht.weekdayShort]}.</div>
  `;
}

function detectConflicts(subjects) {
  const warnings = [];
  DAYS_ORDER.forEach((day) => {
    const dayItems = subjects
      .filter((s) => s.days.includes(day))
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    for (let i = 0; i < dayItems.length - 1; i++) {
      if (toMinutes(dayItems[i].end) > toMinutes(dayItems[i + 1].start)) {
        warnings.push(`${DAY_NAMES[day]}: ${dayItems[i].code} overlaps with ${dayItems[i + 1].code}`);
      }
    }
  });
  return warnings;
}

function getFilteredSubjects() {
  return appState.subjects.filter((item) => {
    const dayMatch = appState.filterDay === "ALL" || item.days.includes(appState.filterDay);
    const typeMatch = appState.filterType === "ALL" || item.type.toLowerCase() === appState.filterType.toLowerCase();
    return dayMatch && typeMatch;
  });
}

function renderAll() {
  const s = appState.student;
  el("info-name").textContent = s.name || "—";
  el("info-id").textContent = s.idNumber || "—";
  el("info-course").textContent = s.courseYear || "—";
  el("info-section").textContent = s.section || "—";
  el("info-school").textContent = s.school || "—";
  el("info-term").textContent = s.term || "—";

  const studentSummary = `Student: <strong>${s.name || "—"}</strong> • ID: <strong class="mono-text">${s.idNumber || "—"}</strong> • Section: <strong>${s.section || "—"}</strong>`;
  el("sheet-student-line").innerHTML = studentSummary;
  el("agenda-student-line").innerHTML = `Student: <strong>${s.name || "—"}</strong> • Section: <strong>${s.section || "—"}</strong>`;

  const totalUnits = appState.subjects.reduce((sum, item) => sum + (Number(item.units) || 0), 0);
  const totalMinutes = appState.subjects.reduce((sum, item) => {
    const dur = Math.max(0, toMinutes(item.end) - toMinutes(item.start));
    return sum + dur * item.days.length;
  }, 0);

  el("stat-subjects").textContent = appState.subjects.length;
  el("stat-units").textContent = totalUnits;
  el("stat-hours").textContent = `${(totalMinutes / 60).toFixed(1)}h`;

  const metaParts = [];
  if (s.school && s.school !== "—") metaParts.push(s.school);
  if (s.courseYear && s.courseYear !== "—") metaParts.push(s.courseYear);
  if (s.term && s.term !== "—") metaParts.push(s.term);
  if (appState.subjects.length) metaParts.push(`${appState.subjects.length} Classes • ${totalUnits} Units • PHT (UTC+8)`);
  el("sheet-notes-text").textContent = metaParts.length
    ? metaParts.join(" | ")
    : "Upload a COR image or click + Add Class to populate your Monday–Saturday schedule in PHT +8.";

  const conflicts = detectConflicts(appState.subjects);
  const banner = el("conflict-banner");
  if (conflicts.length) {
    banner.textContent = `Schedule Overlap Detected: ${conflicts.join(" | ")}`;
    banner.classList.remove("hidden");
  } else {
    banner.classList.add("hidden");
  }

  const filtered = getFilteredSubjects();
  renderTimetable(filtered);
  renderAgenda(filtered);
  renderTable(filtered);
  updateClockAndTracker();
  saveToLocalStorage();
}

function renderTimetable(subjects) {
  const grid = el("timetable-grid");
  const pht = getPhtParts();
  const totalHours = END_HOUR - START_HOUR;
  const colHeight = totalHours * HOUR_HEIGHT;
  const isMobile = window.innerWidth <= 768;

  if (isMobile && !DAYS_ORDER.includes(appState.mobileDay)) {
    appState.mobileDay = DAYS_ORDER.includes(pht.weekdayShort) ? pht.weekdayShort : "MON";
  }

  const activeMobileDay = appState.filterDay !== "ALL" ? appState.filterDay : appState.mobileDay;
  const visibleDays = isMobile ? [activeMobileDay] : DAYS_ORDER;

  grid.style.gridTemplateColumns = isMobile
    ? "62px minmax(0, 1fr)"
    : "78px repeat(6, minmax(155px, 1fr))";

  let html = "";
  if (isMobile) {
    const switcherHtml = DAYS_ORDER.map((d) => {
      const activeClass = d === activeMobileDay ? "active" : "";
      return `<button type="button" class="mobile-day-btn ${activeClass}" data-mobile-day="${d}">${d}</button>`;
    }).join("");
    html += `<div class="mobile-day-bar" style="grid-column: 1 / -1;">${switcherHtml}</div>`;
  }

  html += `<div class="tt-corner">PHT +8</div>`;
  visibleDays.forEach((day) => {
    const isToday = pht.weekdayShort === day;
    html += `<div class="tt-day-header ${isToday ? "today-col" : ""}">${DAY_NAMES[day]}</div>`;
  });

  html += `<div class="tt-time-col" style="height:${colHeight}px;">`;
  for (let h = START_HOUR; h < END_HOUR; h++) {
    const label = format12Hour(`${String(h).padStart(2, "0")}:00`).replace(":00 ", " ");
    html += `<div class="tt-hour-label">${label}</div>`;
  }
  html += `</div>`;

  visibleDays.forEach((day) => {
    const isToday = pht.weekdayShort === day;
    const dayClasses = subjects.filter((s) => s.days.includes(day));
    html += `<div class="tt-day-col ${isToday ? "today-col" : ""}" style="height:${colHeight}px;">`;

    if (isToday) {
      const nowMins = pht.minutesFromMidnight;
      if (nowMins >= START_HOUR * 60 && nowMins <= END_HOUR * 60) {
        const topPx = ((nowMins - START_HOUR * 60) / 60) * HOUR_HEIGHT;
        html += `<div class="now-line" style="top:${topPx}px;" title="Current PHT +8 Time"></div>`;
      }
    }

    dayClasses.forEach((item) => {
      const realIndex = appState.subjects.indexOf(item);
      const startMins = Math.max(START_HOUR * 60, toMinutes(item.start));
      const endMins = Math.min(END_HOUR * 60, toMinutes(item.end));
      const top = ((startMins - START_HOUR * 60) / 60) * HOUR_HEIGHT;
      const height = Math.max(28, ((endMins - startMins) / 60) * HOUR_HEIGHT - 2);
      const color = getColorForSubject(item.code);
      const edpLabel = item.edp && item.edp !== item.code ? ` · ${item.edp}` : "";

      html += `
        <div class="class-block" data-index="${realIndex}"
             style="top:${top}px; height:${height}px; background:${color.bg}; border-left-color:${color.border}; color:${color.text};">
          <div class="cb-top">
            <span>${item.code}${edpLabel}</span>
            <span class="cb-type-tag">${item.type}</span>
          </div>
          ${height >= 46 ? `<div class="cb-title">${item.title}</div>` : ""}
          <div class="cb-bottom">
            <span>${format12Hour(item.start)}–${format12Hour(item.end)}</span>
            <span>${item.room || "TBA"}</span>
          </div>
        </div>
      `;
    });

    html += `</div>`;
  });

  grid.innerHTML = html;

  grid.querySelectorAll(".mobile-day-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      appState.mobileDay = btn.dataset.mobileDay;
      if (appState.filterDay !== "ALL") {
        appState.filterDay = appState.mobileDay;
        el("filter-day").value = appState.mobileDay;
      }
      renderAll();
    });
  });

  grid.querySelectorAll(".class-block").forEach((node) => {
    node.addEventListener("click", () => openModal(Number(node.dataset.index)));
  });
}

function renderAgenda(subjects) {
  const container = el("agenda-grid");
  const pht = getPhtParts();
  const visibleDays = appState.filterDay === "ALL" ? DAYS_ORDER : [appState.filterDay];

  container.innerHTML = visibleDays
    .map((day) => {
      const dayItems = subjects
        .filter((s) => s.days.includes(day))
        .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
      const isToday = pht.weekdayShort === day;

      const itemsHtml = dayItems.length
        ? dayItems
            .map((item) => {
              const realIndex = appState.subjects.indexOf(item);
              const color = getColorForSubject(item.code);
              return `
                <div class="agenda-item" data-index="${realIndex}" style="border-left-color:${color.border};">
                  <div style="display:flex; justify-content:space-between; font-weight:700; font-size:0.84rem; gap:0.4rem;">
                    <span>${item.code} (${item.type})</span>
                    <span class="mono-text" style="font-size:0.74rem;">
                      ${format12Hour(item.start)} – ${format12Hour(item.end)}
                    </span>
                  </div>
                  <div style="font-size:0.76rem; margin:2px 0;">${item.title}</div>
                  <div style="font-size:0.72rem; opacity:0.82;">EDP: <strong>${item.edp || "—"}</strong> • Room: <strong>${item.room || "TBA"}</strong> • Units: ${item.units}</div>
                </div>
              `;
            })
            .join("")
        : `<p style="font-size:0.8rem; opacity:0.7;">No scheduled classes.</p>`;

      return `
        <div class="agenda-day-card ${isToday ? "today-card" : ""}">
          <div class="agenda-day-header">
            <strong>${DAY_NAMES[day]}</strong>
            <span class="badge ${isToday ? "badge-accent" : "badge-neutral"}">${dayItems.length} Class(es)</span>
          </div>
          ${itemsHtml}
        </div>
      `;
    })
    .join("");

  container.querySelectorAll(".agenda-item").forEach((node) => {
    node.addEventListener("click", () => openModal(Number(node.dataset.index)));
  });
}

function renderTable(subjects) {
  const tbody = el("cor-table-body");
  if (!subjects.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-muted); padding:1.5rem;">No classes in schedule yet. Upload a COR image or add a class manually.</td></tr>`;
    return;
  }

  tbody.innerHTML = subjects
    .map((item) => {
      const realIndex = appState.subjects.indexOf(item);
      return `
        <tr>
          <td class="mono-text"><strong>${item.edp || "—"}</strong></td>
          <td><strong>${item.code}</strong></td>
          <td>${item.title}</td>
          <td>${item.days.join(", ")}</td>
          <td class="mono-text">${format12Hour(item.start)} – ${format12Hour(item.end)}</td>
          <td>${item.room || "TBA"}</td>
          <td>${item.type}</td>
          <td>${item.units}</td>
          <td>
            <button type="button" class="btn btn-xs btn-secondary btn-edit-row" data-index="${realIndex}">Edit</button>
            <button type="button" class="btn btn-xs btn-ghost btn-del-row" data-index="${realIndex}">Delete</button>
          </td>
        </tr>
      `;
    })
    .join("");

  tbody.querySelectorAll(".btn-edit-row").forEach((btn) => {
    btn.addEventListener("click", () => openModal(Number(btn.dataset.index)));
  });

  tbody.querySelectorAll(".btn-del-row").forEach((btn) => {
    btn.addEventListener("click", () => {
      appState.subjects.splice(Number(btn.dataset.index), 1);
      renderAll();
    });
  });
}

function parseCorText(rawText) {
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const student = {
    name: "—",
    idNumber: "—",
    courseYear: "—",
    section: "—",
    school: "—",
    term: "—"
  };

  const subjects = [];

  for (const line of lines) {
    const idMatch = line.match(/(?:ID\s*(?:NUMBER|NO\.?|#)?\s*[:\-]?\s*)(\d{5,12})/i);
    if (idMatch && student.idNumber === "—") {
      student.idNumber = idMatch[1];
    }

    const nameMatch = line.match(/(?:STUDENT\s*NAME|NAME)\s*[:\-]\s*([A-Z][A-Z\s,.'-]{2,60})/i);
    if (nameMatch && student.name === "—") {
      student.name = nameMatch[1].trim();
    }

    const courseMatch = line.match(/(?:COURSE(?:\s*\/\s*YEAR)?|PROGRAM)\s*[:\-]\s*([A-Z0-9\s\/-]{2,45})/i);
    if (courseMatch && student.courseYear === "—") {
      student.courseYear = courseMatch[1].trim();
    }

    const secMatch = line.match(/(?:SECTION|SEC)\s*[:\-]\s*([A-Z0-9\s-]{2,25})/i);
    if (secMatch && student.section === "—") {
      student.section = secMatch[1].trim();
    }

    const termMatch = line.match(/((?:20\d{2}\s*[-–]\s*20\d{2})|(?:1ST|2ND|MIDYEAR|SUMMER)\s*SEMESTER)/i);
    if (termMatch) {
      student.term = student.term === "—" ? termMatch[1].trim() : `${student.term} • ${termMatch[1].trim()}`;
    }

    if (student.school === "—" && /(COLLEGE|UNIVERSITY|INSTITUTE|SCHOOL|ACADEMY)/i.test(line) && !/CERTIFICATE OF REGISTRATION/i.test(line)) {
      student.school = line.slice(0, 60);
    }

    const timeRangeRegex = /(\d{1,2}[:.]\d{2})\s*(AM|PM)?\s*(?:[-–—~]|TO)\s*(\d{1,2}[:.]\d{2})\s*(AM|PM)?/i;
    const tMatch = line.match(timeRangeRegex);
    if (!tMatch) continue;

    const endPeriod = tMatch[4] ? tMatch[4].toUpperCase() : null;
    const startPeriod = tMatch[2] ? tMatch[2].toUpperCase() : endPeriod;
    const start24 = parse12HourTo24(tMatch[1], startPeriod);
    const end24 = parse12HourTo24(tMatch[3], endPeriod);
    if (!start24 || !end24) continue;

    const beforeTime = line.slice(0, tMatch.index).trim();
    const afterTime = line.slice(tMatch.index + tMatch[0].length).trim();

    const dayMatch = beforeTime.match(/\b(MWF|TTHS|TTH|MW|WF|MF|THS|MTWTHF|MTWTHFS|MON|TUE|WED|THU|FRI|SAT|MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY)\b/i);
    const days = dayMatch ? expandDayToken(dayMatch[1]) : [];
    if (!days.length) continue;

    const edpMatch = beforeTime.match(/\b(\d{5,9})\b/);
    const edp = edpMatch ? edpMatch[1] : "";

    const codeMatch = beforeTime.match(/\b([A-Z]{2,8}\s*\d{1,4}[A-Z0-9]*(?:\s+LAB)?|GE\s*\d+|PATHFIT\s*\d+|NSTP\s*\d+|SSPD)\b/i);
    const code = codeMatch ? codeMatch[1].toUpperCase().replace(/\s+/g, " ").trim() : "CLASS";

    let title = beforeTime;
    if (edp) title = title.replace(edp, " ");
    if (codeMatch) title = title.replace(codeMatch[0], " ");
    if (dayMatch) title = title.replace(dayMatch[0], " ");
    title = title
      .replace(/[^A-Z0-9\s&()\-/.,]/gi, " ")
      .replace(/\b[A-Z]{1,2}\b(?=\s+[A-Z]{1,2}\b)/g, " ")
      .replace(/^[\s\-:|./,]+|[\s\-:|./,]+$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (!title) title = code;

    const afterTokens = afterTime.split(/\s+/).filter(Boolean);
    let units = 0;
    if (afterTokens.length && /^\d+(\.\d+)?$/.test(afterTokens[afterTokens.length - 1])) {
      units = Number(afterTokens.pop());
    }

    let type = "Lec";
    if (/\bLAB(?:ORATORY)?\b/i.test(code) || /\bLAB(?:ORATORY)?\b/i.test(title) || /\bLAB\b/i.test(afterTime)) {
      type = "Lab";
    }

    const roomTokens = afterTokens.filter((tok) => !/^(LEC|LAB|LECTURE|LABORATORY)$/i.test(tok));
    const room = roomTokens.join(" ").trim() || "TBA";

    subjects.push({
      edp,
      code,
      title: title.toUpperCase(),
      days,
      start: start24,
      end: end24,
      room: room.toUpperCase(),
      type,
      units
    });
  }

  return { student, subjects };
}

function setStatus(message, type = "info") {
  const box = el("scan-status");
  box.textContent = message;
  box.className = `scan-status ${type === "error" ? "error" : type === "success" ? "success" : ""}`;
  box.classList.remove("hidden");
}

function handleFileSelect(file) {
  if (!file || !file.type.startsWith("image/")) {
    setStatus("Please choose a valid image file (JPG, PNG, or WEBP).", "error");
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    appState.uploadedDataUrl = e.target.result;
    el("cor-preview-img").src = appState.uploadedDataUrl;
    el("drop-zone-empty").classList.add("hidden");
    el("preview-wrapper").classList.remove("hidden");
    el("btn-scan-cor").disabled = false;
    setStatus("COR photo loaded. Click 'Scan & Build Schedule' to run OCR.", "info");
  };
  reader.readAsDataURL(file);
}

async function runCorOcr() {
  if (!appState.uploadedDataUrl) return;
  const scanBtn = el("btn-scan-cor");
  const progWrap = el("ocr-progress-wrap");
  const progFill = el("ocr-progress-fill");
  const progPct = el("ocr-percent-label");
  const progStage = el("ocr-stage-label");

  scanBtn.disabled = true;
  progWrap.classList.remove("hidden");
  progFill.style.width = "5%";
  progPct.textContent = "5%";
  progStage.textContent = "Starting Tesseract OCR...";
  setStatus("Scanning COR image locally in your browser (PHT +8)...", "info");

  try {
    const worker = await Tesseract.createWorker("eng", 1, {
      logger: (m) => {
        if (m.status) progStage.textContent = m.status;
        if (typeof m.progress === "number") {
          const pct = Math.round(m.progress * 100);
          progFill.style.width = `${pct}%`;
          progPct.textContent = `${pct}%`;
        }
      }
    });

    const { data } = await worker.recognize(appState.uploadedDataUrl);
    await worker.terminate();

    const rawText = data?.text || "";
    const parsed = parseCorText(rawText);

    appState.student = {
      name: parsed.student.name !== "—" ? parsed.student.name : appState.student.name,
      idNumber: parsed.student.idNumber !== "—" ? parsed.student.idNumber : appState.student.idNumber,
      courseYear: parsed.student.courseYear !== "—" ? parsed.student.courseYear : appState.student.courseYear,
      section: parsed.student.section !== "—" ? parsed.student.section : appState.student.section,
      school: parsed.student.school !== "—" ? parsed.student.school : appState.student.school,
      term: parsed.student.term !== "—" ? parsed.student.term : appState.student.term
    };

    if (parsed.subjects.length) {
      appState.subjects = parsed.subjects;
      renderAll();
      setStatus(`OCR complete: extracted ${parsed.subjects.length} class(es) with EDP codes in PHT +8.`, "success");
    } else {
      renderAll();
      setStatus("OCR read the text, but no schedule rows matched automatically. Click + Add Class to add them manually.", "error");
    }
  } catch (err) {
    setStatus(`OCR failed: ${err.message || "Unable to process image."}`, "error");
  } finally {
    scanBtn.disabled = false;
    progWrap.classList.add("hidden");
  }
}

function openModal(index = -1) {
  const modal = el("subject-modal");
  const isEdit = index >= 0 && appState.subjects[index];
  el("modal-title").textContent = isEdit ? "Edit Class Schedule" : "Add Class Schedule";
  el("field-index").value = isEdit ? index : -1;

  const item = isEdit
    ? appState.subjects[index]
    : { edp: "", code: "", title: "", days: ["MON"], start: "08:00", end: "09:00", room: "", type: "Lec", units: 3 };

  el("field-edp").value = item.edp || "";
  el("field-code").value = item.code || "";
  el("field-title").value = item.title || "";
  el("field-start").value = item.start || "08:00";
  el("field-end").value = item.end || "09:00";
  el("field-room").value = item.room || "";
  el("field-type").value = item.type || "Lec";
  el("field-units").value = item.units ?? 3;

  document.querySelectorAll(".day-checkboxes input").forEach((cb) => {
    cb.checked = item.days.includes(cb.value);
  });

  modal.classList.remove("hidden");
}

function closeModal() {
  el("subject-modal").classList.add("hidden");
}

function openStudentModal() {
  const s = appState.student;
  el("stu-name").value = s.name === "—" ? "" : s.name;
  el("stu-id").value = s.idNumber === "—" ? "" : s.idNumber;
  el("stu-section").value = s.section === "—" ? "" : s.section;
  el("stu-course").value = s.courseYear === "—" ? "" : s.courseYear;
  el("stu-term").value = s.term === "—" ? "" : s.term;
  el("stu-school").value = s.school === "—" ? "" : s.school;
  el("student-modal").classList.remove("hidden");
}

function closeStudentModal() {
  el("student-modal").classList.add("hidden");
}

function exportIcsFile() {
  if (!appState.subjects.length) {
    setStatus("Add or scan at least one class before exporting an .ICS file.", "error");
    return;
  }

  const rruleDayMap = { MON: "MO", TUE: "TU", WED: "WE", THU: "TH", FRI: "FR", SAT: "SA" };
  const dateSeedMap = {
    MON: "20261123",
    TUE: "20261124",
    WED: "20261125",
    THU: "20261126",
    FRI: "20261127",
    SAT: "20261128"
  };

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Schedule Management System//COR Smart Scanner PHT+8//EN",
    "CALSCALE:GREGORIAN"
  ];

  appState.subjects.forEach((item, idx) => {
    if (!item.days.length) return;
    const firstDay = item.days[0];
    const startCompact = item.start.replace(":", "") + "00";
    const endCompact = item.end.replace(":", "") + "00";
    const byDay = item.days.map((d) => rruleDayMap[d]).join(",");

    lines.push(
      "BEGIN:VEVENT",
      `UID:cor-${idx}-${Date.now()}@pht-schedule`,
      `SUMMARY:${item.code}${item.edp ? ` [${item.edp}]` : ""} (${item.type}) - ${item.title}`,
      `LOCATION:${item.room || "TBA"}`,
      `DTSTART;TZID=Asia/Manila:${dateSeedMap[firstDay]}T${startCompact}`,
      `DTEND;TZID=Asia/Manila:${dateSeedMap[firstDay]}T${endCompact}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${byDay}`,
      "END:VEVENT"
    );
  });

  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "COR_Schedule_PHT8.ics";
  link.click();
}

async function downloadSchedulePdf() {
  if (!appState.subjects.length) {
    setStatus("Add or scan at least one class before downloading a PDF.", "error");
    return;
  }

  const isAgenda = !el("view-agenda").classList.contains("hidden");
  const sourceSheet = isAgenda
    ? document.querySelector("#view-agenda .template-sheet")
    : document.querySelector("#view-timetable .template-sheet");

  const { jsPDF } = window.jspdf || {};
  if (!sourceSheet || typeof html2canvas !== "function" || !jsPDF) {
    setStatus("PDF library not loaded; opening print dialog instead.", "error");
    window.print();
    return;
  }

  const prevMobileDay = appState.mobileDay;
  const prevFilterDay = appState.filterDay;
  let exportHost = null;

  try {
    setStatus("Rendering full Monday–Saturday schedule to PDF...", "info");

    exportHost = document.createElement("div");
    exportHost.style.position = "fixed";
    exportHost.style.left = "-99999px";
    exportHost.style.top = "0";
    exportHost.style.width = "1120px";
    exportHost.style.zIndex = "-1";
    exportHost.style.pointerEvents = "none";

    const clone = sourceSheet.cloneNode(true);
    clone.style.width = "1080px";
    clone.style.maxWidth = "none";

    const cloneWrapper = clone.querySelector(".timetable-wrapper");
    if (cloneWrapper) {
      cloneWrapper.style.overflow = "visible";
      cloneWrapper.style.width = "auto";
    }

    const cloneGrid = clone.querySelector(".timetable-grid");
    if (cloneGrid) {
      // Temporarily render all 6 days into cloneGrid for full PDF export
      const tempGridId = "pdf-export-timetable-grid";
      cloneGrid.id = tempGridId;

      const origGrid = el("timetable-grid");
      origGrid.id = "timetable-grid-temp-orig";
      cloneGrid.id = "timetable-grid";

      const origFilterDay = appState.filterDay;
      appState.filterDay = "ALL";
      const filteredAll = appState.subjects.filter((item) => {
        return appState.filterType === "ALL" || item.type.toLowerCase() === appState.filterType.toLowerCase();
      });

      const pht = getPhtParts();
      const totalHours = END_HOUR - START_HOUR;
      const colHeight = totalHours * HOUR_HEIGHT;
      cloneGrid.style.minWidth = "1010px";
      cloneGrid.style.width = "1010px";
      cloneGrid.style.gridTemplateColumns = "78px repeat(6, minmax(155px, 1fr))";

      let gridHtml = `<div class="tt-corner">PHT +8</div>`;
      DAYS_ORDER.forEach((day) => {
        const isToday = pht.weekdayShort === day;
        gridHtml += `<div class="tt-day-header ${isToday ? "today-col" : ""}">${DAY_NAMES[day]}</div>`;
      });

      gridHtml += `<div class="tt-time-col" style="height:${colHeight}px;">`;
      for (let h = START_HOUR; h < END_HOUR; h++) {
        const label = format12Hour(`${String(h).padStart(2, "0")}:00`).replace(":00 ", " ");
        gridHtml += `<div class="tt-hour-label">${label}</div>`;
      }
      gridHtml += `</div>`;

      DAYS_ORDER.forEach((day) => {
        const isToday = pht.weekdayShort === day;
        const dayClasses = filteredAll.filter((s) => s.days.includes(day));
        gridHtml += `<div class="tt-day-col ${isToday ? "today-col" : ""}" style="height:${colHeight}px;">`;

        dayClasses.forEach((item) => {
          const startMins = Math.max(START_HOUR * 60, toMinutes(item.start));
          const endMins = Math.min(END_HOUR * 60, toMinutes(item.end));
          const top = ((startMins - START_HOUR * 60) / 60) * HOUR_HEIGHT;
          const height = Math.max(28, ((endMins - startMins) / 60) * HOUR_HEIGHT - 2);
          const color = getColorForSubject(item.code);
          const edpLabel = item.edp && item.edp !== item.code ? ` · ${item.edp}` : "";

          gridHtml += `
            <div class="class-block"
                 style="top:${top}px; height:${height}px; background:${color.bg}; border-left-color:${color.border}; color:${color.text};">
              <div class="cb-top">
                <span>${item.code}${edpLabel}</span>
                <span class="cb-type-tag">${item.type}</span>
              </div>
              ${height >= 46 ? `<div class="cb-title">${item.title}</div>` : ""}
              <div class="cb-bottom">
                <span>${format12Hour(item.start)}–${format12Hour(item.end)}</span>
                <span>${item.room || "TBA"}</span>
              </div>
            </div>
          `;
        });

        gridHtml += `</div>`;
      });

      cloneGrid.innerHTML = gridHtml;
      const mobileBar = clone.querySelector(".mobile-day-bar");
      if (mobileBar) mobileBar.remove();

      cloneGrid.id = "pdf-timetable-grid-done";
      origGrid.id = "timetable-grid";
      appState.filterDay = origFilterDay;
    }

    exportHost.appendChild(clone);
    document.body.appendChild(exportHost);

    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      width: clone.scrollWidth,
      height: clone.scrollHeight
    });

    const imgData = canvas.toDataURL("image/png");
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 18;
    const maxW = pageWidth - margin * 2;
    const maxH = pageHeight - margin * 2;
    const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
    const drawW = canvas.width * ratio;
    const drawH = canvas.height * ratio;
    const x = (pageWidth - drawW) / 2;
    const y = (pageHeight - drawH) / 2;

    doc.addImage(imgData, "PNG", x, y, drawW, drawH);
    doc.save("COR_Schedule_PHT8.pdf");
    setStatus("Downloaded full Monday–Saturday COR_Schedule_PHT8.pdf.", "success");
  } catch (err) {
    setStatus(`PDF export failed: ${err.message || "Unable to render PDF."}`, "error");
  } finally {
    appState.mobileDay = prevMobileDay;
    appState.filterDay = prevFilterDay;
    if (exportHost && exportHost.parentNode) {
      exportHost.parentNode.removeChild(exportHost);
    }
  }
}

function saveToLocalStorage() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        template: appState.template,
        student: appState.student,
        subjects: appState.subjects
      })
    );
  } catch (_) {}
}

function loadFromLocalStorage() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved) {
      if (saved.template) appState.template = saved.template;
      if (saved.student) appState.student = { ...appState.student, ...saved.student };
      if (Array.isArray(saved.subjects)) appState.subjects = saved.subjects;
    }
  } catch (_) {}
}

function clearAllData() {
  appState.student = {
    name: "—",
    idNumber: "—",
    courseYear: "—",
    section: "—",
    school: "—",
    term: "—"
  };
  appState.subjects = [];
  localStorage.removeItem(STORAGE_KEY);
  renderAll();
  setStatus("Schedule data cleared. Ready for a new COR upload.", "info");
}

document.addEventListener("DOMContentLoaded", () => {
  loadFromLocalStorage();
  applyTemplate(appState.template);

  const dropZone = el("drop-zone");
  const fileInput = el("cor-file-input");

  dropZone.addEventListener("click", (e) => {
    if (e.target.id !== "btn-clear-img") fileInput.click();
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
  });

  el("btn-clear-img").addEventListener("click", (e) => {
    e.stopPropagation();
    appState.uploadedDataUrl = null;
    fileInput.value = "";
    el("preview-wrapper").classList.add("hidden");
    el("drop-zone-empty").classList.remove("hidden");
    el("btn-scan-cor").disabled = true;
  });

  el("btn-scan-cor").addEventListener("click", runCorOcr);
  el("btn-clear-all").addEventListener("click", clearAllData);

  document.querySelectorAll(".template-option").forEach((btn) => {
    btn.addEventListener("click", () => applyTemplate(btn.dataset.template));
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.dataset.view;
      el("view-timetable").classList.toggle("hidden", target !== "timetable");
      el("view-agenda").classList.toggle("hidden", target !== "agenda");
      el("view-table").classList.toggle("hidden", target !== "table");
    });
  });

  el("filter-day").addEventListener("change", (e) => {
    appState.filterDay = e.target.value;
    if (appState.filterDay !== "ALL") {
      appState.mobileDay = appState.filterDay;
    }
    renderAll();
  });

  el("filter-type").addEventListener("change", (e) => {
    appState.filterType = e.target.value;
    renderAll();
  });

  el("btn-add-subject").addEventListener("click", () => openModal(-1));
  el("btn-close-modal").addEventListener("click", closeModal);
  el("btn-cancel-modal").addEventListener("click", closeModal);

  el("btn-edit-student").addEventListener("click", openStudentModal);
  el("btn-close-student-modal").addEventListener("click", closeStudentModal);
  el("btn-cancel-student-modal").addEventListener("click", closeStudentModal);

  el("student-form").addEventListener("submit", (e) => {
    e.preventDefault();
    appState.student = {
      name: el("stu-name").value.trim() || "—",
      idNumber: el("stu-id").value.trim() || "—",
      section: el("stu-section").value.trim() || "—",
      courseYear: el("stu-course").value.trim() || "—",
      term: el("stu-term").value.trim() || "—",
      school: el("stu-school").value.trim() || "—"
    };
    closeStudentModal();
    renderAll();
  });

  el("subject-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const selectedDays = Array.from(document.querySelectorAll(".day-checkboxes input:checked")).map((cb) => cb.value);
    if (!selectedDays.length) return;

    const entry = {
      edp: el("field-edp").value.trim(),
      code: el("field-code").value.trim().toUpperCase(),
      title: el("field-title").value.trim().toUpperCase(),
      days: selectedDays,
      start: el("field-start").value,
      end: el("field-end").value,
      room: el("field-room").value.trim().toUpperCase(),
      type: el("field-type").value,
      units: Number(el("field-units").value) || 0
    };

    const idx = Number(el("field-index").value);
    if (idx >= 0) {
      appState.subjects[idx] = entry;
    } else {
      appState.subjects.push(entry);
    }

    closeModal();
    renderAll();
  });

  el("btn-toggle-alerts").addEventListener("click", togglePhoneAlerts);
  el("btn-test-alert").addEventListener("click", () => {
    firedAlertKeys.delete("TEST-ALERT");
    triggerClassAlert(
      "TEST-ALERT",
      "Test Alert: IT ADET22 (Lec)",
      "01:30 PM – 02:30 PM • Room OL 121 • PHT +8"
    );
  });

  el("btn-download-pdf").addEventListener("click", downloadSchedulePdf);
  el("btn-print").addEventListener("click", () => window.print());

  renderAll();
  setInterval(updateClockAndTracker, 1000);
});

window.addEventListener("resize", () => {
  renderTimetable(getFilteredSubjects());
});
