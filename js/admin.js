// ---------- Settings ----------
const PAGE_SIZE = 25;
const CLINIC = "Al-Rehmat Clinic & Physiotherapy Center";

// Which buttons each status gets
const ACTIONS = {
  pending:   [["confirmed", "Confirm", "primary"], ["cancel", "Cancel", "ghost"]],
  confirmed: [["completed", "Mark complete", "primary"], ["cancel", "Cancel", "ghost"]],
  completed: [],
  cancelled: [],
};

const STATUS_LABEL = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

const TRASH_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

// ---------- Page elements ----------
const userEmail = document.getElementById("userEmail");
const signOutBtn = document.getElementById("signOutBtn");
const refreshBtn = document.getElementById("refreshBtn");
const searchInput = document.getElementById("searchInput");
const tabButtons = document.querySelectorAll(".tabs button");
const listEl = document.getElementById("list");
const resultCount = document.getElementById("resultCount");
const moreBtn = document.getElementById("moreBtn");
const toastEl = document.getElementById("toast");

const dialog = document.getElementById("dialog");
const dialogTitle = document.getElementById("dialogTitle");
const dialogSummary = document.getElementById("dialogSummary");
const dialogText = document.getElementById("dialogText");
const dialogMessage = document.getElementById("dialogMessage");
const dialogMessageLabel = document.getElementById("dialogMessageLabel");
const dialogCancel = document.getElementById("dialogCancel");
const dialogConfirm = document.getElementById("dialogConfirm");

// ---------- What is selected right now ----------
const state = { tab: "all", search: "", limit: PAGE_SIZE };
let appointments = [];
let pendingAction = null;

// ---------- Small helpers ----------
// Makes patient-typed text safe to show on the page
const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

const toISO = (d) =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

const formatDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });

function dateParts(iso) {
  const d = new Date(iso + "T00:00:00");
  return {
    day: d.getDate(),
    month: d.toLocaleDateString("en-GB", { month: "short" }),
    weekday: d.toLocaleDateString("en-GB", { weekday: "short" }),
  };
}

function formatTime(t) {
  const [h, m] = t.split(":");
  const hour = Number(h);
  return (hour % 12 || 12) + ":" + m + " " + (hour >= 12 ? "PM" : "AM");
}

const cleanPhone = (p) => String(p).replace(/[^\d+]/g, "");

// 0300 1234567 -> 923001234567 (the format WhatsApp links need)
function toWhatsApp(p) {
  let d = String(p).replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "92" + d.slice(1);
  else if (d.length === 10 && d.startsWith("3")) d = "92" + d;
  return d;
}

// The ready-written WhatsApp messages
function whatsappLink(appt, kind) {
  const when = `${formatDate(appt.appointment_date)} at ${formatTime(appt.appointment_time)}`;

  const text =
    kind === "confirm"
      ? `Assalamualaikum ${appt.full_name}, your appointment at ${CLINIC} is confirmed for ${when}. Please arrive a few minutes early. If you need to change it, please message or call us. Thank you!`
      : `Assalamualaikum ${appt.full_name}, we are sorry to let you know that your appointment at ${CLINIC} on ${when} has been cancelled. If you would like another time, please message us or book again on our website. Thank you for understanding.`;

  return "https://wa.me/" + toWhatsApp(appt.phone) + "?text=" + encodeURIComponent(text);
}

let toastTimer;
function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), 3200);
}

// ---------- Login check ----------
const goToLogin = () => { window.location.replace("login.html"); return false; };

async function requireLogin() {
  if (!db) return goToLogin();
  const { data } = await db.auth.getSession();
  if (!data.session) return goToLogin();
  userEmail.textContent = data.session.user.email;
  document.body.classList.remove("is-checking");
  return true;
}

signOutBtn.addEventListener("click", async () => {
  await db.auth.signOut();
  goToLogin();
});

// ---------- Getting the appointments ----------
async function loadAppointments() {
  const { data, error } = await db
    .from("appointments")
    .select("*")
    .order("appointment_date", { ascending: false })
    .order("appointment_time", { ascending: false })
    .limit(1000);

  if (error) {
    const { data: s } = await db.auth.getSession();
    if (!s.session) return goToLogin();
    listEl.innerHTML = '<li class="empty">Could not load appointments. Please press Refresh.</li>';
    toast("Could not load appointments.");
    return;
  }

  appointments = data;
  render();
}

// ---------- Filtering and sorting ----------
function matchesTab(a, tab, today, weekEnd) {
  switch (tab) {
    case "today":     return a.appointment_date === today;
    case "week":      return a.appointment_date >= today && a.appointment_date <= weekEnd;
    case "pending":
    case "confirmed":
    case "completed": return a.status === tab;
    default:          return true;
  }
}

function getVisible(today, weekEnd) {
  const q = state.search.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, "");

  const list = appointments.filter((a) => {
    if (!matchesTab(a, state.tab, today, weekEnd)) return false;

    if (q) {
      const text = [a.full_name, a.email, a.service].join(" ").toLowerCase();
      const phone = String(a.phone).replace(/\D/g, "");
      if (!text.includes(q) && !(qDigits && phone.includes(qDigits))) return false;
    }
    return true;
  });

  // today and future first (soonest on top), then older ones (newest on top)
  list.sort((a, b) => {
    const aFuture = a.appointment_date >= today ? 0 : 1;
    const bFuture = b.appointment_date >= today ? 0 : 1;
    if (aFuture !== bFuture) return aFuture - bFuture;
    const order = (a.appointment_date + a.appointment_time).localeCompare(b.appointment_date + b.appointment_time);
    return aFuture === 0 ? order : -order;
  });

  return list;
}

// ---------- Drawing the page ----------
function rowHTML(a, today) {
  const actions = (ACTIONS[a.status] || [])
    .map(([next, label, kind]) =>
      `<button type="button" class="btn btn--small ${kind === "primary" ? "btn--solid" : "btn--outline"}" data-action="status" data-next="${next}" data-id="${esc(a.id)}">${label}</button>`
    )
    .join("");

  // the trash button only appears for finished appointments
  const canDelete = a.status === "completed" || a.status === "cancelled";
  const trash = canDelete
    ? `<button type="button" class="icon-btn" data-action="delete" data-id="${esc(a.id)}" aria-label="Delete appointment" title="Delete">${TRASH_ICON}</button>`
    : "";

  const note = a.note
    ? `<p class="booking__note"><strong>Note:</strong> ${esc(a.note)}</p>`
    : "";

  const p = dateParts(a.appointment_date);
  const monthLine = a.appointment_date === today ? "Today" : p.weekday + " · " + p.month;

  return `
    <li class="booking">
      <div class="booking__when" title="${esc(formatDate(a.appointment_date))}">
        <span class="when__day">${p.day}</span>
        <span class="when__month">${esc(monthLine)}</span>
        <span class="when__time">${esc(formatTime(a.appointment_time))}</span>
      </div>
      <div class="booking__who">
        <span class="booking__name">${esc(a.full_name)}</span>
        <span class="booking__links">
          <a href="tel:${esc(cleanPhone(a.phone))}">${esc(a.phone)}</a>
          <a href="https://wa.me/${esc(toWhatsApp(a.phone))}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
        </span>
        <a class="booking__email" href="mailto:${esc(a.email)}">${esc(a.email)}</a>
      </div>
      <div class="booking__what">
        <span>${esc(a.service)}</span>
        <span class="tag">${esc(a.gender)}</span>
      </div>
      <div class="booking__status">
        <span class="badge badge--${esc(a.status)}">${esc(STATUS_LABEL[a.status] || a.status)}</span>
      </div>
      <div class="booking__actions">${actions}${trash}</div>
      ${note}
    </li>`;
}

function render() {
  const today = toISO(new Date());
  const weekEnd = toISO(addDays(new Date(), 6));

  // numbers on the tabs
  tabButtons.forEach((btn) => {
    const count = appointments.filter((a) => matchesTab(a, btn.dataset.tab, today, weekEnd)).length;
    btn.querySelector(".tabs__count").textContent = count;
  });

  const list = getVisible(today, weekEnd);
  const shown = list.slice(0, state.limit);
  resultCount.textContent = list.length === 1 ? "1 appointment" : list.length + " appointments";

  if (!list.length) {
    listEl.innerHTML = appointments.length
      ? '<li class="empty">No appointments found here.</li>'
      : '<li class="empty">No appointments yet. New bookings will show up here.</li>';
    moreBtn.hidden = true;
    return;
  }

  listEl.innerHTML = shown.map((a) => rowHTML(a, today)).join("");
  moreBtn.hidden = list.length <= shown.length;
}

// ---------- Tabs, search, refresh ----------
tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    state.tab = btn.dataset.tab;
    state.limit = PAGE_SIZE;
    tabButtons.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    render();
  });
});

searchInput.addEventListener("input", () => {
  state.search = searchInput.value;
  state.limit = PAGE_SIZE;
  render();
});

moreBtn.addEventListener("click", () => {
  state.limit += PAGE_SIZE;
  render();
});

refreshBtn.addEventListener("click", async () => {
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Refreshing…";
  await loadAppointments();
  refreshBtn.disabled = false;
  refreshBtn.textContent = "Refresh";
});

// ---------- The popup ----------
function openDialog({ title, summary, text, messageUrl, messageLabel, confirmLabel, cancelLabel = "Back", danger, action }) {
  dialogTitle.textContent = title;
  dialogSummary.textContent = summary;
  dialogText.textContent = text;

  if (messageUrl) {
    dialogMessage.href = messageUrl;
    dialogMessageLabel.textContent = messageLabel;
    dialogMessage.hidden = false;
  } else {
    dialogMessage.hidden = true;
  }

  dialogCancel.textContent = cancelLabel;
  dialogConfirm.textContent = confirmLabel;
  dialogConfirm.disabled = false;
  dialogConfirm.classList.toggle("btn--danger", Boolean(danger));
  dialogConfirm.classList.toggle("btn--solid", !danger);
  pendingAction = action;
  dialog.showModal();
}

dialogConfirm.addEventListener("click", async () => {
  if (!pendingAction) return;
  dialogConfirm.disabled = true;
  dialogConfirm.textContent = "Please wait…";
  await pendingAction();
  dialog.close();
});

dialogCancel.addEventListener("click", () => dialog.close());

// clicking the dark area outside the popup closes it
dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
dialog.addEventListener("close", () => { pendingAction = null; });

const summaryOf = (a) => `${a.full_name} · ${formatDate(a.appointment_date)} · ${formatTime(a.appointment_time)}`;

// ---------- Changing and deleting ----------
async function changeStatus(appt, next) {
  const { data, error } = await db
    .from("appointments")
    .update({ status: next })
    .eq("id", appt.id)
    .select();

  if (error || !data || !data.length) {
    toast("Could not update the appointment. Please try again.");
    return;
  }

  appt.status = data[0].status;
  render();
  toast("Appointment " + next + ".");
}

async function deleteAppointment(appt, doneMessage) {
  const { data, error } = await db
    .from("appointments")
    .delete()
    .eq("id", appt.id)
    .select();

  if (error || !data || !data.length) {
    toast("Could not delete the appointment. Please try again.");
    return;
  }

  appointments = appointments.filter((a) => a.id !== appt.id);
  render();
  toast(doneMessage);
}

listEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const appt = appointments.find((a) => a.id === btn.dataset.id);
  if (!appt) return;

  // trash button: delete a completed appointment
  if (btn.dataset.action === "delete") {
    openDialog({
      title: "Delete this appointment?",
      summary: summaryOf(appt),
      text: "This appointment will be permanently deleted. This cannot be undone.",
      confirmLabel: "Delete",
      cancelLabel: "Keep it",
      danger: true,
      action: () => deleteAppointment(appt, "Appointment deleted."),
    });
    return;
  }

  const next = btn.dataset.next;

  // Cancel = send a message, then delete the appointment
  if (next === "cancel") {
    openDialog({
      title: "Cancel this appointment?",
      summary: summaryOf(appt),
      text: "First send the patient a cancellation message so they know. Then cancel. The appointment will be permanently deleted, and the time opens up again on the website.",
      messageUrl: whatsappLink(appt, "cancel"),
      messageLabel: "Send cancellation message to " + appt.phone,
      confirmLabel: "Cancel appointment",
      cancelLabel: "Back",
      danger: true,
      action: () => deleteAppointment(appt, "Appointment cancelled and deleted."),
    });
    return;
  }

  // Confirm = send a message, then mark as confirmed
  if (next === "confirmed") {
    openDialog({
      title: "Confirm this appointment?",
      summary: summaryOf(appt),
      text: "First send the patient a confirmation message so they know their time is booked. Then confirm.",
      messageUrl: whatsappLink(appt, "confirm"),
      messageLabel: "Send confirmation message to " + appt.phone,
      confirmLabel: "Confirm appointment",
      cancelLabel: "Back",
      danger: false,
      action: () => changeStatus(appt, "confirmed"),
    });
    return;
  }

  changeStatus(appt, next);
});

// ---------- Start ----------
(async function init() {
  if (!(await requireLogin())) return;

  // logged out in another tab, or the login expired: back to the login page
  db.auth.onAuthStateChange((event, session) => { if (!session) goToLogin(); });

  // pressing the browser's Back button after signing out
  window.addEventListener("pageshow", (e) => { if (e.persisted) requireLogin(); });

  await loadAppointments();

  // new bookings appear by themselves every minute
  setInterval(() => { if (!document.hidden) loadAppointments(); }, 60000);
})();