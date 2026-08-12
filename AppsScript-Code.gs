/**
 * Husain First Birthday RSVP — Production Backend
 *
 * SETUP:
 * 1. Replace ADMIN_KEY below with a long private passphrase.
 * 2. Paste this entire file into Apps Script.
 * 3. Save.
 * 4. Edit the existing web-app deployment and deploy a new version.
 *
 * The existing /exec URL can remain unchanged when the same deployment is edited.
 */

const SHEET_NAME = "RSVP Responses";
const CONFIG_SHEET_NAME = "RSVP Config";
const ANNOUNCEMENT_SHEET_NAME = "Venue Announcement Status";
const ADMIN_KEY = "212-34";

const HEADERS = [
  "Timestamp",
  "RSVP ID",
  "Guest Name",
  "Mobile Number",
  "Attending",
  "Adults",
  "Children",
  "Child 1 Age",
  "Child 2 Age",
  "Child 3 Age",
  "Child 4 Age",
  "Last Updated",
  "Action"
];

function doGet(event) {
  try {
    const action = String((event && event.parameter && event.parameter.action) || "status");

    if (action === "config") {
      return jsonResponse({
        success: true,
        config: getPublicConfig()
      });
    }

    if (action === "rsvpStatus") {
      return jsonResponse({
        success: true,
        rsvpOpen: isRsvpOpen()
      });
    }

    if (action === "dashboard") {
      assertAdminKey(event.parameter.key);
      return jsonResponse(getDashboardPayload());
    }

    return jsonResponse({
      success: true,
      message: "Husain RSVP service is active."
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      message: error.message || "Request failed."
    });
  }
}

function doPost(event) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(15000);

    const data = parseRequest(event);

    if (data.mode === "adminUpdate") {
      assertAdminKey(data.adminKey);
      return jsonResponse(adminUpdateRsvp(data));
    }

    if (data.mode === "saveConfig") {
      assertAdminKey(data.adminKey);
      return jsonResponse(saveConfig(data.config || {}));
    }

    if (data.mode === "setRsvpOpen") {
      assertAdminKey(data.adminKey);
      return jsonResponse(saveRsvpOpen(data.rsvpOpen));
    }

    if (data.mode === "markAnnouncement") {
      assertAdminKey(data.adminKey);
      return jsonResponse(markAnnouncementStatus(data.rsvpId, data.status));
    }

    if (data.mode === "resetAnnouncements") {
      assertAdminKey(data.adminKey);
      return jsonResponse(resetAnnouncementStatuses());
    }

    if (!isRsvpOpen()) {
      return jsonResponse({
        success: false,
        closed: true,
        message: "RSVPs are now closed. For assistance, please contact the host."
      });
    }

    validateSubmission(data);

    const sheet = getResponseSheet();
    ensureHeaders(sheet);

    const normalizedMobile = normalizeMobileNumber(data.mobileNumber);
    const existingRow = findExistingMobileRow(sheet, normalizedMobile);
    const now = new Date();
    const childAges = normalizeChildAges(data.childAges);

    if (existingRow) {
      const existingRsvpId = String(sheet.getRange(existingRow, 2).getValue()).trim();
      const originalTimestamp = sheet.getRange(existingRow, 1).getValue() || now;

      sheet.getRange(existingRow, 1, 1, HEADERS.length).setValues([[
        originalTimestamp,
        existingRsvpId || createRsvpId(),
        sanitizeCell(data.guestName),
        sanitizeCell(data.mobileNumber),
        data.attending,
        data.attending === "Yes" ? Number(data.adultCount) : 0,
        data.attending === "Yes" ? Number(data.childCount) : 0,
        data.attending === "Yes" ? childAges[0] : "",
        data.attending === "Yes" ? childAges[1] : "",
        data.attending === "Yes" ? childAges[2] : "",
        data.attending === "Yes" ? childAges[3] : "",
        now,
        "Updated"
      ]]);

      return jsonResponse({
        success: true,
        action: "updated",
        rsvpId: existingRsvpId,
        message: "Your RSVP has been updated."
      });
    }

    const rsvpId = createRsvpId();

    sheet.appendRow([
      now,
      rsvpId,
      sanitizeCell(data.guestName),
      sanitizeCell(data.mobileNumber),
      data.attending,
      data.attending === "Yes" ? Number(data.adultCount) : 0,
      data.attending === "Yes" ? Number(data.childCount) : 0,
      data.attending === "Yes" ? childAges[0] : "",
      data.attending === "Yes" ? childAges[1] : "",
      data.attending === "Yes" ? childAges[2] : "",
      data.attending === "Yes" ? childAges[3] : "",
      now,
      "Created"
    ]);

    return jsonResponse({
      success: true,
      action: "created",
      rsvpId,
      message: "Your RSVP has been received."
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({
      success: false,
      message: error.message || "Unable to process the request."
    });
  } finally {
    try {
      lock.releaseLock();
    } catch (_) {}
  }
}

function getDashboardPayload() {
  const sheet = getResponseSheet();
  ensureHeaders(sheet);

  const lastRow = sheet.getLastRow();
  const values = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getDisplayValues()
    : [];

  const announcementMap = getAnnouncementStatusMap();

  const rows = values.map((row) => ({
    timestamp: row[0],
    rsvpId: row[1],
    guestName: row[2],
    mobileNumber: row[3],
    attending: row[4],
    adults: Number(row[5] || 0),
    children: Number(row[6] || 0),
    childAges: [row[7], row[8], row[9], row[10]].filter(Boolean),
    lastUpdated: row[11],
    action: row[12] || "Created",
    announcementStatus: announcementMap[row[1]] || "Pending"
  }));

  const accepted = rows.filter((row) => row.attending === "Yes");
  const declined = rows.filter((row) => row.attending === "No");
  const adults = accepted.reduce((sum, row) => sum + row.adults, 0);
  const children = accepted.reduce((sum, row) => sum + row.children, 0);

  const announcementSent = accepted.filter((row) => row.announcementStatus === "Sent").length;
  const announcementPending = accepted.length - announcementSent;

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    summary: {
      totalResponses: rows.length,
      acceptedFamilies: accepted.length,
      declinedFamilies: declined.length,
      adults,
      children,
      totalGuests: adults + children,
      withChildren: accepted.filter((row) => row.children > 0).length,
      withoutChildren: accepted.filter((row) => row.children === 0).length,
      announcementSent,
      announcementPending
    },
    config: getPublicConfig(),
    rows
  };
}

function adminUpdateRsvp(data) {
  const rsvpId = String(data.rsvpId || "").trim();
  if (!rsvpId) throw new Error("RSVP ID is required.");

  const sheet = getResponseSheet();
  ensureHeaders(sheet);

  const rowNumber = findRsvpIdRow(sheet, rsvpId);
  if (!rowNumber) throw new Error("RSVP record was not found.");

  validateSubmission(data);
  const now = new Date();
  const childAges = normalizeChildAges(data.childAges);
  const originalTimestamp = sheet.getRange(rowNumber, 1).getValue() || now;

  sheet.getRange(rowNumber, 1, 1, HEADERS.length).setValues([[
    originalTimestamp,
    rsvpId,
    sanitizeCell(data.guestName),
    sanitizeCell(data.mobileNumber),
    data.attending,
    data.attending === "Yes" ? Number(data.adultCount) : 0,
    data.attending === "Yes" ? Number(data.childCount) : 0,
    data.attending === "Yes" ? childAges[0] : "",
    data.attending === "Yes" ? childAges[1] : "",
    data.attending === "Yes" ? childAges[2] : "",
    data.attending === "Yes" ? childAges[3] : "",
    now,
    "Admin Updated"
  ]]);

  return {
    success: true,
    message: "RSVP updated successfully."
  };
}

function saveConfig(config) {
  const sheet = getConfigSheet();
  const currentConfig = getPublicConfig();
  const publishVenue = Object.prototype.hasOwnProperty.call(config, "publishVenue")
    ? Boolean(config.publishVenue)
    : Boolean(config.venueAnnounced);
  const rsvpOpen = Object.prototype.hasOwnProperty.call(config, "rsvpOpen")
    ? Boolean(config.rsvpOpen)
    : currentConfig.rsvpOpen !== false;
  const rows = [
    ["rsvpOpen", rsvpOpen],
    ["publishVenue", publishVenue],
    ["venueAnnounced", publishVenue],
    ["venueName", sanitizeCell(config.venueName || "")],
    ["venueAddress", sanitizeCell(config.venueAddress || "")],
    ["venueNotes", sanitizeCell(config.venueNotes || "")],
    ["mapsUrl", sanitizeUrl(config.mapsUrl || "")],
    ["latitude", sanitizeCoordinate(config.latitude, "Latitude", -90, 90)],
    ["longitude", sanitizeCoordinate(config.longitude, "Longitude", -180, 180)],
    ["publicRsvpUrl", sanitizeUrl(config.publicRsvpUrl || "")]
  ];

  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  return {
    success: true,
    message: "Settings saved.",
    config: getPublicConfig()
  };
}

function saveRsvpOpen(value) {
  const config = getPublicConfig();
  config.rsvpOpen = value !== false;
  return saveConfig(config);
}

function isRsvpOpen() {
  return getPublicConfig().rsvpOpen !== false;
}

function getPublicConfig() {
  const sheet = getConfigSheet();
  const lastRow = sheet.getLastRow();
  const config = {
    rsvpOpen: true,
    publishVenue: false,
    venueAnnounced: false,
    venueName: "",
    venueAddress: "",
    venueNotes: "",
    mapsUrl: "",
    latitude: "",
    longitude: "",
    publicRsvpUrl: ""
  };

  if (lastRow < 1) return config;

  const values = sheet.getRange(1, 1, lastRow, 2).getDisplayValues();
  values.forEach(([key, value]) => {
    if (!Object.prototype.hasOwnProperty.call(config, key)) return;
    config[key] = key === "venueAnnounced"
      || key === "publishVenue"
      || key === "rsvpOpen"
      ? String(value).toLowerCase() === "true"
      : value;
  });

  config.publishVenue = Boolean(config.publishVenue || config.venueAnnounced);
  config.venueAnnounced = config.publishVenue;

  return config;
}

function getResponseSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
}

function getConfigSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(CONFIG_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG_SHEET_NAME);
    sheet.hideSheet();
  }
  return sheet;
}

function ensureHeaders(sheet) {
  const existing = sheet.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0];
  const match = HEADERS.every((header, index) => existing[index] === header);

  if (!match) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
}

function findExistingMobileRow(sheet, normalizedMobile) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const values = sheet.getRange(2, 4, lastRow - 1, 1).getDisplayValues();
  for (let index = 0; index < values.length; index += 1) {
    if (normalizeMobileNumber(values[index][0]) === normalizedMobile) {
      return index + 2;
    }
  }
  return null;
}

function findRsvpIdRow(sheet, rsvpId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const values = sheet.getRange(2, 2, lastRow - 1, 1).getDisplayValues();
  for (let index = 0; index < values.length; index += 1) {
    if (String(values[index][0]).trim() === rsvpId) {
      return index + 2;
    }
  }
  return null;
}

function validateSubmission(data) {
  const guestName = String(data.guestName || "").trim();
  const mobile = normalizeMobileNumber(data.mobileNumber);
  const attending = String(data.attending || "");

  if (guestName.length < 2 || guestName.length > 100) {
    throw new Error("Please enter a valid guest name.");
  }
  if (mobile.length < 8 || mobile.length > 15) {
    throw new Error("Please enter a valid mobile number.");
  }
  if (!["Yes", "No"].includes(attending)) {
    throw new Error("Please select attendance.");
  }

  if (attending === "Yes") {
    const adults = Number(data.adultCount);
    const children = Number(data.childCount || 0);

    if (!Number.isInteger(adults) || adults < 1 || adults > 10) {
      throw new Error("Invalid adult count.");
    }
    if (!Number.isInteger(children) || children < 0 || children > 4) {
      throw new Error("Invalid child count.");
    }

    const ages = normalizeChildAges(data.childAges);
    for (let index = 0; index < children; index += 1) {
      if (!ages[index]) throw new Error("Please select every child's age.");
    }
  }
}

function parseRequest(event) {
  if (!event || !event.postData || !event.postData.contents) {
    throw new Error("No request data received.");
  }
  try {
    return JSON.parse(event.postData.contents);
  } catch (_) {
    throw new Error("Request data could not be read.");
  }
}

function assertAdminKey(value) {
  if (!ADMIN_KEY || ADMIN_KEY.indexOf("CHANGE-THIS") === 0) {
    throw new Error("The backend ADMIN_KEY has not been configured.");
  }
  if (String(value || "") !== ADMIN_KEY) {
    throw new Error("Unauthorized.");
  }
}


function getAnnouncementSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(ANNOUNCEMENT_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(ANNOUNCEMENT_SHEET_NAME);
    sheet.getRange(1, 1, 1, 4).setValues([[
      "RSVP ID",
      "Status",
      "Last Changed",
      "Changed By"
    ]]);
    sheet.getRange(1, 1, 1, 4).setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.hideSheet();
  }

  return sheet;
}

function getAnnouncementStatusMap() {
  const sheet = getAnnouncementSheet();
  const lastRow = sheet.getLastRow();
  const map = {};

  if (lastRow < 2) return map;

  const values = sheet.getRange(2, 1, lastRow - 1, 2).getDisplayValues();
  values.forEach(([rsvpId, status]) => {
    if (rsvpId) map[rsvpId] = status || "Pending";
  });

  return map;
}

function markAnnouncementStatus(rsvpId, status) {
  const normalizedId = String(rsvpId || "").trim();
  const normalizedStatus = status === "Sent" ? "Sent" : "Pending";

  if (!normalizedId) {
    throw new Error("RSVP ID is required.");
  }

  const sheet = getAnnouncementSheet();
  const lastRow = sheet.getLastRow();
  let targetRow = null;

  if (lastRow >= 2) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();

    for (let index = 0; index < ids.length; index += 1) {
      if (String(ids[index][0]).trim() === normalizedId) {
        targetRow = index + 2;
        break;
      }
    }
  }

  const values = [[
    normalizedId,
    normalizedStatus,
    new Date(),
    "Dashboard"
  ]];

  if (targetRow) {
    sheet.getRange(targetRow, 1, 1, 4).setValues(values);
  } else {
    sheet.appendRow(values[0]);
  }

  return {
    success: true,
    rsvpId: normalizedId,
    status: normalizedStatus
  };
}

function resetAnnouncementStatuses() {
  const sheet = getAnnouncementSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, 4).clearContent();
  }

  return {
    success: true,
    message: "Announcement statuses reset."
  };
}

function normalizeMobileNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeChildAges(value) {
  const ages = Array.isArray(value) ? value : [];
  return [0, 1, 2, 3].map((index) => sanitizeCell(ages[index] || ""));
}

function sanitizeCell(value) {
  const text = String(value || "").trim();
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function sanitizeUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!/^https:\/\//i.test(text)) throw new Error("URLs must begin with https://");
  return text;
}

function sanitizeCoordinate(value, label, min, max) {
  const text = String(value || "").trim();
  if (!text) return "";

  const number = Number(text);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(label + " must be a valid number.");
  }

  return String(number);
}

function createRsvpId() {
  return "HUS-" + Utilities.getUuid().replace(/-/g, "").slice(0, 8).toUpperCase();
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
