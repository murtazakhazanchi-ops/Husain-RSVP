"use strict";

const SUBMISSION_URL = "https://script.google.com/macros/s/AKfycbwo6kNofaeRAnITieVxDRccMurllRKSFmO-cElHxIYI3ytJJn3MfjKCOvtqdtva93_q/exec";

const form = document.getElementById("rsvpForm");
const invitation = document.querySelector(".invitation");
const guestName = document.getElementById("guestName");
const mobileNumber = document.getElementById("mobileNumber");
const adultCount = document.getElementById("adultCount");
const childCount = document.getElementById("childCount");
const submitButton = document.getElementById("submitButton");
const statusMessage = document.getElementById("statusMessage");
const statusText = document.getElementById("statusText");
const venueCard = document.getElementById("venueCard");
const venueArtwork = document.getElementById("venueArtwork");
const venueName = document.getElementById("venueName");
const venueDate = document.getElementById("venueDate");
const venueDateDay = document.getElementById("venueDateDay");
const venueDateValue = document.getElementById("venueDateValue");
const venueTime = document.getElementById("venueTime");
const venueAddress = document.getElementById("venueAddress");
const venueCoordinatesText = document.getElementById("venueCoordinatesText");
const venueMapLink = document.getElementById("venueMapLink");
const closedCard = document.getElementById("closedCard");
let rsvpOpen = true;

const childAgeSelects = [
  document.getElementById("childAge1"),
  document.getElementById("childAge2"),
  document.getElementById("childAge3"),
  document.getElementById("childAge4")
];

const ageValues = [
  "Below 1 year",
  "1 year", "2 years", "3 years", "4 years", "5 years",
  "6 years", "7 years", "8 years", "9 years", "10 years",
  "11 years", "12 years", "13 years", "14 years", "15 years",
  "16 years", "17 years"
];

function populateAgeDropdown(select) {
  select.replaceChildren();

  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "";
  blank.selected = true;
  blank.disabled = true;
  select.appendChild(blank);

  ageValues.forEach((age) => {
    const option = document.createElement("option");
    option.value = age;
    option.textContent = age;
    select.appendChild(option);
  });
}

childAgeSelects.forEach(populateAgeDropdown);

function updateChildAgeFields() {
  const count = Number(childCount.value || 0);

  childAgeSelects.forEach((select, index) => {
    const active = index < count;
    select.disabled = !active;
    select.required = active;
    select.classList.toggle("is-hidden", !active);

    if (!active) {
      select.value = "";
    }
  });
}

function selectedAttendance() {
  return document.querySelector(
    'input[name="attending"]:checked'
  )?.value || "";
}

function updateAttendanceState() {
  const attending = selectedAttendance();
  const isDeclining = attending === "No";

  adultCount.disabled = isDeclining;
  childCount.disabled = isDeclining;
  adultCount.required = !isDeclining;

  if (isDeclining) {
    adultCount.value = "";
    childCount.value = "";
  }

  updateChildAgeFields();
}

document.querySelectorAll('input[name="attending"]').forEach((radio) => {
  radio.addEventListener("change", updateAttendanceState);
});

childCount.addEventListener("change", updateChildAgeFields);

function collectData() {
  const attending = selectedAttendance();
  const children = attending === "No"
    ? 0
    : Number(childCount.value || 0);

  return {
    guestName: guestName.value.trim(),
    mobileNumber: mobileNumber.value.trim(),
    attending,
    adultCount: attending === "No" ? 0 : Number(adultCount.value || 0),
    childCount: children,
    childAges: childAgeSelects
      .slice(0, children)
      .map((select) => select.value)
  };
}

function validate(data) {
  if (!data.guestName) {
    throw new Error("Please enter the guest name.");
  }

  const digits = data.mobileNumber.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) {
    throw new Error("Please enter a valid mobile number.");
  }

  if (!data.attending) {
    throw new Error("Please select whether you will be attending.");
  }

  if (data.attending === "Yes" && !data.adultCount) {
    throw new Error("Please select the number of adults.");
  }

  if (data.attending === "Yes" && data.childAges.some((age) => !age)) {
    throw new Error("Please select the age of every child.");
  }
}

function setStatus(message, type = "") {
  statusText.textContent = message;
  statusMessage.className = `status-message ${type}`.trim();
}

function setSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.classList.toggle("is-busy", isSubmitting);

  if (isSubmitting) {
    setStatus("Submitting your RSVP…", "loading");
  }
}

function lockSubmittedState() {
  invitation.classList.add("is-submitted");
  submitButton.disabled = true;
  submitButton.classList.remove("is-busy");

  [
    guestName,
    mobileNumber,
    adultCount,
    childCount,
    ...childAgeSelects,
    ...document.querySelectorAll('input[name="attending"]')
  ].forEach((control) => {
    control.disabled = true;
  });
}

async function sendRSVP(data) {
  if (!SUBMISSION_URL) {
    console.log("Test RSVP submission:", data);
    await new Promise((resolve) => setTimeout(resolve, 700));
    return { success: true, testMode: true };
  }

  const response = await fetch(SUBMISSION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error("The RSVP could not be submitted. Please try again.");
  }

  return response.json();
}


function setFormAvailability(enabled) {
  [
    guestName,
    mobileNumber,
    adultCount,
    childCount,
    submitButton,
    ...childAgeSelects,
    ...document.querySelectorAll('input[name="attending"]')
  ].forEach((control) => {
    control.disabled = !enabled;
  });
}

function applyRsvpAvailability(open) {
  rsvpOpen = open !== false;
  setFormAvailability(rsvpOpen);
  closedCard.hidden = rsvpOpen;

  if (!rsvpOpen) {
    submitButton.classList.remove("is-busy");
  }
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatDms(value, positive, negative) {
  const absolute = Math.abs(value);
  let degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  let minutes = Math.floor(minutesFloat);
  let seconds = Math.round((minutesFloat - minutes) * 60);
  const hemisphere = value >= 0 ? positive : negative;

  if (seconds === 60) {
    seconds = 0;
    minutes += 1;
  }

  if (minutes === 60) {
    minutes = 0;
    degrees += 1;
  }

  return `${degrees}°${String(minutes).padStart(2, "0")}'${String(seconds).padStart(2, "0")}"${hemisphere}`;
}

function setVenueDate(value) {
  const lines = String(value || "Saturday\n5 September 2026")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  venueDateDay.textContent = lines[0] || "Saturday";
  venueDateValue.textContent = lines.slice(1).join(" ") || "5 September 2026";
}

async function loadPublicConfig() {
  try {
    const response = await fetch(`${SUBMISSION_URL}?action=config&_=${Date.now()}`, {
      cache: "no-store"
    });
    if (!response.ok) {
      applyRsvpAvailability(true);
      return;
    }

    const result = await response.json();
    if (!result.success || !result.config) {
      applyRsvpAvailability(true);
      return;
    }

    const config = result.config;
    applyRsvpAvailability(config.rsvpOpen !== false);

    const venueAnnounced = config.venueAnnounced ?? config.publishVenue;
    if (!venueAnnounced) {
      venueCard.hidden = true;
      venueCard.classList.remove("is-visible");
      return;
    }

    const latitude = toNumber(config.latitude);
    const longitude = toNumber(config.longitude);

    venueName.textContent = config.venueName || "Venue announced";
    setVenueDate(config.venueDate || config.date);
    venueTime.textContent = config.venueTime || config.time || "12:00 PM";
    venueAddress.textContent = config.venueAddress || "";

    if (latitude !== null && longitude !== null) {
      venueCoordinatesText.textContent = `${formatDms(latitude, "N", "S")}\n${formatDms(longitude, "E", "W")}`;
      venueCoordinatesText.hidden = false;
    } else {
      venueCoordinatesText.textContent = "";
      venueCoordinatesText.hidden = true;
    }

    if (config.mapsUrl) {
      venueMapLink.dataset.mapsUrl = config.mapsUrl;
      venueMapLink.href = config.mapsUrl;
      venueMapLink.removeAttribute("aria-disabled");
      venueMapLink.classList.remove("is-disabled");
    } else {
      venueMapLink.dataset.mapsUrl = "";
      venueMapLink.removeAttribute("href");
      venueMapLink.setAttribute("aria-disabled", "true");
      venueMapLink.classList.add("is-disabled");
    }

    if (!venueArtwork.getAttribute("src")) {
      venueArtwork.src = venueArtwork.dataset.src;
    }

    venueCard.hidden = false;
    venueCard.classList.add("is-visible");
  } catch (error) {
    console.warn("Venue configuration could not be loaded.", error);
    applyRsvpAvailability(true);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("");

  try {
    if (!rsvpOpen) {
      applyRsvpAvailability(false);
      return;
    }

    const data = collectData();
    validate(data);

    setSubmitting(true);
    const result = await sendRSVP(data);

    if (result.closed) {
      applyRsvpAvailability(false);
      setStatus(result.message || "", "error");
      return;
    }

    if (!result.success) {
      throw new Error(result.message || "The RSVP could not be submitted.");
    }

    lockSubmittedState();
    setStatus(
      "Your place aboard Captain Husain's celebration has been reserved.",
      "success"
    );
  } catch (error) {
    console.error(error);
    if (rsvpOpen) {
      submitButton.disabled = false;
    } else {
      applyRsvpAvailability(false);
    }
    submitButton.classList.remove("is-busy");
    setStatus(
      error.message || "Something went wrong. Please try again.",
      "error"
    );
  }
});

updateChildAgeFields();
setFormAvailability(false);
loadPublicConfig();
