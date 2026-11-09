const toggle = document.getElementById("menuToggle");
const nav = document.getElementById("nav");

function setMenu(open) {
  nav.classList.toggle("is-open", open);
  toggle.setAttribute("aria-expanded", open);
  toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
}

// Open / close with the menu button
toggle.addEventListener("click", () => {
  setMenu(toggle.getAttribute("aria-expanded") !== "true");
});

// Close after tapping a link
nav.addEventListener("click", (e) => {
  if (e.target.closest("a")) setMenu(false);
});

// Close with the Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") setMenu(false);
});

// Reset when the screen gets wide again
window.matchMedia("(min-width: 901px)").addEventListener("change", (e) => {
  if (e.matches) setMenu(false);
});
// Slide + fade in when something is properly on screen
const revealItems = document.querySelectorAll("[data-reveal]");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2, rootMargin: "0px 0px -12% 0px" });

  revealItems.forEach((el) => {
    el.classList.add("reveal", "reveal--" + el.dataset.reveal);
    observer.observe(el);
  });
}
// Services: hover, click or tap a name to see its description
const serviceItems = document.querySelectorAll(".service");
const servicePanel = document.querySelector(".services__panel");

if (serviceItems.length && servicePanel) {
  const panelNum = servicePanel.querySelector(".services__panel-num");
  const panelName = servicePanel.querySelector(".services__panel-name");
  const panelDesc = servicePanel.querySelector(".services__panel-desc");
  const isDesktop = window.matchMedia("(min-width: 901px)");
  let swapTimer;

  // mark one item as open (or pass null to close all)
  function markActive(item) {
    serviceItems.forEach((li) => {
      const on = li === item;
      li.classList.toggle("is-active", on);
      li.querySelector(".service__btn").setAttribute("aria-expanded", on);
    });
  }

  // desktop: fade the side panel out, swap the text, fade back in
  function showInPanel(item) {
    servicePanel.classList.add("is-changing");
    clearTimeout(swapTimer);
    swapTimer = setTimeout(() => {
      panelNum.textContent = item.querySelector(".service__num").textContent;
      panelName.textContent = item.querySelector(".service__name").textContent;
      panelDesc.textContent = item.querySelector(".service__desc").textContent;
      servicePanel.classList.remove("is-changing");
    }, 180);
  }

  function setActive(item) {
    if (item.classList.contains("is-active")) return;
    markActive(item);
    showInPanel(item);
  }

  // phone: start with everything closed
  if (!isDesktop.matches) markActive(null);

  // back on a wide screen: always keep one open
  isDesktop.addEventListener("change", (e) => {
    if (e.matches && !document.querySelector(".service.is-active")) {
      setActive(serviceItems[0]);
    }
  });

  serviceItems.forEach((item) => {
    const btn = item.querySelector(".service__btn");

    btn.addEventListener("click", () => {
      if (isDesktop.matches) {
        setActive(item);
      } else if (item.classList.contains("is-active")) {
        markActive(null);      // tap the open one again to close it
      } else {
        markActive(item);      // open this one, close the others
      }
    });

    btn.addEventListener("focus", () => { if (isDesktop.matches) setActive(item); });
    item.addEventListener("mouseenter", () => { if (isDesktop.matches) setActive(item); });
  });

  // phone: tap anywhere outside the list to close everything
  document.addEventListener("click", (e) => {
    if (!isDesktop.matches && !e.target.closest(".services__list")) markActive(null);
  });
}
// ---------- Appointment booking ----------
const bookingForm = document.getElementById("bookingForm");

if (bookingForm) {
  const timesBox = document.getElementById("times");
  const timeButtons = [...timesBox.querySelectorAll(".time")];
  const hint = document.getElementById("timesHint");
  const dateInput = document.getElementById("bookingDate");
  const serviceSelect = document.getElementById("service");
  const note = document.getElementById("note");
  const noteCount = document.getElementById("noteCount");
  const statusEl = document.getElementById("bookingStatus");
  const submitBtn = document.getElementById("submitBtn");
  const sumGender = document.getElementById("sumGender");
  const sumDate = document.getElementById("sumDate");
  const sumTime = document.getElementById("sumTime");
  const sumService = document.getElementById("sumService");

  let selectedTime = "";
  let taken = new Set();
  let requestId = 0;

  const toISO = (d) =>
    d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

  // Dates: from today up to 60 days ahead
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 60);
  dateInput.min = toISO(new Date());
  dateInput.max = toISO(maxDate);

  const getGender = () => {
    const checked = bookingForm.querySelector('input[name="gender"]:checked');
    return checked ? checked.value : "";
  };

  const formatDate = (iso) =>
    new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
    });

  function setHint(text, alert = false) {
    hint.textContent = text;
    hint.classList.remove("is-alert");
    if (alert) {
      void hint.offsetWidth;   // lets the little shake play again
      hint.classList.add("is-alert");
    }
  }

  function showStatus(text) { statusEl.textContent = text; }

  function setSummary(el, text) {
    el.textContent = text || "—";
    el.classList.toggle("is-empty", !text);
  }

  function updateSummary() {
    const btn = timeButtons.find((b) => b.dataset.time === selectedTime);
    setSummary(sumGender, getGender());
    setSummary(sumDate, dateInput.value ? formatDate(dateInput.value) : "");
    setSummary(sumTime, btn ? btn.querySelector(".time__label").textContent : "");
    setSummary(sumService, serviceSelect.value);
  }

  // Show each time as available, Taken, or Passed (earlier today)
  function paintTimes() {
    const ready = Boolean(getGender() && dateInput.value);
    const now = new Date();
    const isToday = dateInput.value === toISO(now);

    timesBox.classList.toggle("is-locked", !ready);

    timeButtons.forEach((btn) => {
      const time = btn.dataset.time;
      let state = "";
      if (ready && taken.has(time)) state = "Taken";
      else if (ready && isToday && Number(time.slice(0, 2)) <= now.getHours()) state = "Passed";

      btn.classList.toggle("is-unavailable", Boolean(state));
      btn.classList.toggle("is-selected", time === selectedTime);
      btn.setAttribute("aria-pressed", String(time === selectedTime));
      btn.querySelector(".time__state").textContent = state;
    });
  }

  // Ask Supabase which times are already booked for this gender and date
  async function refreshTimes() {
    const myRequest = ++requestId;
    const gender = getGender();
    const date = dateInput.value;

    selectedTime = "";
    taken = new Set();
    updateSummary();

    if (!gender || !date) {
      paintTimes();
      setHint("Choose your gender and date to see available times.");
      return;
    }

    if (!db) {
      paintTimes();
      setHint("Booking is not connected yet.", true);
      return;
    }

    setHint("Checking available times…");
    const { data, error } = await db.rpc("get_taken_slots", { p_date: date, p_gender: gender });
    if (myRequest !== requestId) return;   // a newer choice was made while waiting

    if (error) {
      setHint("Could not check the times right now. Please try again.", true);
    } else {
      taken = new Set(data.map((row) => String(row.slot).slice(0, 5)));
      setHint(taken.size ? "Times marked Taken are already booked." : "All times are available on this day.");
    }
    paintTimes();
  }

  // Choosing a time
  timesBox.addEventListener("click", (e) => {
    const btn = e.target.closest(".time");
    if (!btn) return;

    if (!getGender()) return setHint("Please select gender first.", true);
    if (!dateInput.value) return setHint("Please select a date first.", true);
    if (btn.classList.contains("is-unavailable")) return;

    selectedTime = btn.dataset.time;
    paintTimes();
    updateSummary();
  });

  // Gender or date changed: check the times again. Anything else: just update the summary
  bookingForm.addEventListener("change", (e) => {
    if (e.target.name === "gender" || e.target === dateInput) refreshTimes();
    else updateSummary();
  });

  note.addEventListener("input", () => { noteCount.textContent = note.value.length; });

  // Sending the booking
  bookingForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(bookingForm);
    showStatus("");

    // spam trap: bots fill the hidden field, so we quietly pretend it worked
    if (data.get("website")) {
      showStatus("Thank you! Your appointment request has been received.");
      return;
    }

    if (!selectedTime) return showStatus("Please choose a time.");
    if (!db) return showStatus("Booking is not connected yet.");

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    const { error } = await db.from("appointments").insert({
      full_name: data.get("full_name").trim(),
      phone: data.get("phone").trim(),
      email: data.get("email").trim(),
      service: data.get("service"),
      appointment_date: data.get("appointment_date"),
      appointment_time: selectedTime,
      gender: data.get("gender"),
      note: data.get("note").trim() || null,
    });

    submitBtn.disabled = false;
    submitBtn.textContent = "Book Appointment";

    if (error) {
      if (error.code === "23505") {
        // someone grabbed this time a moment ago
        await refreshTimes();
        showStatus("Sorry, that time was just taken. Please choose another one.");
      } else {
        showStatus("Something went wrong. Please try again, or call us on +92 308 7711245.");
      }
      return;
    }

    bookingForm.reset();
    noteCount.textContent = "0";
    await refreshTimes();
    showStatus("Thank you! Your appointment request has been received.");
  });
}
// Footer: always show the current year
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();