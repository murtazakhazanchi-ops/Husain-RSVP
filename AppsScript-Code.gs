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
const INVITATIONS_SHEET_NAME = "Invitations";
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
  "Action",
  "Invitation Token"
];

const INVITATION_HEADERS = [
  "Invitation Token",
  "Created Timestamp",
  "Guest Name",
  "Mobile Number",
  "Adults Invited",
  "Children Invited",
  "Total People Invited",
  "Status",
  "Adults Attending",
  "Children Attending",
  "Total Attending",
  "RSVP ID",
  "Responded Timestamp",
  "Last Updated",
  "Share Status",
  "First Shared At",
  "Last Shared At",
  "Share Count"
];

function doGet(event) {
  try {
    const params = (event && event.parameter) || {};
    const action = String(params.action || "status");

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

    if (action === "invitation") {
      return jsonResponse(getPublicInvitation(params.invite || params.token));
    }

    if (action === "dashboard") {
      assertAdminKey(params.key);
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

    if (data.mode === "createInvitation") {
      assertAdminKey(data.adminKey);
      return jsonResponse(createInvitation(data.invitation || {}));
    }

    if (data.mode === "updateInvitation") {
      assertAdminKey(data.adminKey);
      return jsonResponse(updateInvitation(data.invitation || {}));
    }

    if (data.mode === "markInvitationShared") {
      assertAdminKey(data.adminKey);
      return jsonResponse(markInvitationShared(data.inviteToken || data.token));
    }

    if (data.mode === "markInvitationUnshared") {
      assertAdminKey(data.adminKey);
      return jsonResponse(markInvitationUnshared(data.inviteToken || data.token));
    }

    if (!isRsvpOpen()) {
      return jsonResponse({
        success: false,
        closed: true,
        message: "RSVPs are now closed. For assistance, please contact the host."
      });
    }

    const inviteToken = normalizeInvitationToken(data.inviteToken);
    const invitation = inviteToken ? findInvitationByToken(inviteToken) : null;

    if (inviteToken && !invitation) {
      throw new Error("This invitation link could not be verified.");
    }

    validateSubmission(data, invitation);

    return jsonResponse(invitation
      ? submitInvitationRsvp(data, invitation)
      : submitStandardRsvp(data));
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
    inviteToken: row[13] || "",
    announcementStatus: announcementMap[row[1]] || "Pending"
  }));

  const accepted = rows.filter((row) => row.attending === "Yes");
  const declined = rows.filter((row) => row.attending === "No");
  const adults = accepted.reduce((sum, row) => sum + row.adults, 0);
  const children = accepted.reduce((sum, row) => sum + row.children, 0);

  const announcementSent = accepted.filter((row) => row.announcementStatus === "Sent").length;
  const announcementPending = accepted.length - announcementSent;
  const invitations = listInvitations();
  const invitationStats = getInvitationStats(invitations);

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
      announcementPending,
      personalInvitesCreated: invitationStats.personalInvitesCreated,
      invitesShared: invitationStats.invitesShared,
      awaitingResponse: invitationStats.awaitingResponse,
      notYetShared: invitationStats.notYetShared
    },
    config: getPublicConfig(),
    rows,
    invitations
  };
}

function submitStandardRsvp(data) {
  const sheet = getResponseSheet();
  ensureHeaders(sheet);

  const normalizedMobile = normalizeMobileNumber(data.mobileNumber);
  const existingRow = findExistingMobileRow(sheet, normalizedMobile);
  const now = new Date();
  const childAges = normalizeChildAges(data.childAges);

  if (existingRow) {
    const existingRsvpId = String(sheet.getRange(existingRow, 2).getValue()).trim();
    const resolvedRsvpId = existingRsvpId || createRsvpId();
    const originalTimestamp = sheet.getRange(existingRow, 1).getValue() || now;
    const existingInviteToken = String(sheet.getRange(existingRow, 14).getValue() || "").trim();
    const existingInvitation = existingInviteToken ? findInvitationByToken(existingInviteToken) : null;

    if (existingInvitation) {
      validateSubmission(data, existingInvitation);
    }

    sheet.getRange(existingRow, 1, 1, HEADERS.length).setValues([buildRsvpRow(
      data,
      resolvedRsvpId,
      originalTimestamp,
      now,
      "Updated",
      childAges,
      existingInviteToken
    )]);

    if (existingInvitation) {
      updateInvitationResponse(existingInvitation, data, resolvedRsvpId, now);
    }

    return {
      success: true,
      action: "updated",
      rsvpId: resolvedRsvpId,
      message: "Your RSVP has been updated."
    };
  }

  const rsvpId = createRsvpId();

  sheet.appendRow(buildRsvpRow(
    data,
    rsvpId,
    now,
    now,
    "Created",
    childAges,
    ""
  ));

  return {
    success: true,
    action: "created",
    rsvpId,
    message: "Your RSVP has been received."
  };
}

function submitInvitationRsvp(data, invitation) {
  const sheet = getResponseSheet();
  ensureHeaders(sheet);

  const now = new Date();
  const childAges = normalizeChildAges(data.childAges);
  const normalizedMobile = normalizeMobileNumber(data.mobileNumber);
  let existingRow = invitation.rsvpId ? findRsvpIdRow(sheet, invitation.rsvpId) : null;

  if (!existingRow) {
    existingRow = findInvitationResponseRow(sheet, invitation.token);
  }
  if (!existingRow && normalizedMobile) {
    existingRow = findExistingMobileRow(sheet, normalizedMobile);
  }

  if (existingRow) {
    const existingRsvpId = String(sheet.getRange(existingRow, 2).getValue()).trim() || createRsvpId();
    const originalTimestamp = sheet.getRange(existingRow, 1).getValue() || now;

    sheet.getRange(existingRow, 1, 1, HEADERS.length).setValues([buildRsvpRow(
      data,
      existingRsvpId,
      originalTimestamp,
      now,
      "Updated",
      childAges,
      invitation.token
    )]);
    updateInvitationResponse(invitation, data, existingRsvpId, now);

    return {
      success: true,
      action: "updated",
      rsvpId: existingRsvpId,
      message: "Your RSVP has been updated."
    };
  }

  const rsvpId = createRsvpId();
  sheet.appendRow(buildRsvpRow(
    data,
    rsvpId,
    now,
    now,
    "Created",
    childAges,
    invitation.token
  ));
  updateInvitationResponse(invitation, data, rsvpId, now);

  return {
    success: true,
    action: "created",
    rsvpId,
    message: "Your RSVP has been received."
  };
}

function buildRsvpRow(data, rsvpId, originalTimestamp, updatedTimestamp, action, childAges, inviteToken) {
  return [
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
    updatedTimestamp,
    action,
    inviteToken || ""
  ];
}

function adminUpdateRsvp(data) {
  const rsvpId = String(data.rsvpId || "").trim();
  if (!rsvpId) throw new Error("RSVP ID is required.");

  const sheet = getResponseSheet();
  ensureHeaders(sheet);

  const rowNumber = findRsvpIdRow(sheet, rsvpId);
  if (!rowNumber) throw new Error("RSVP record was not found.");

  const existingInviteToken = String(sheet.getRange(rowNumber, 14).getValue() || "").trim();
  const invitation = existingInviteToken ? findInvitationByToken(existingInviteToken) : null;

  validateSubmission(data, invitation);
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
    "Admin Updated",
    existingInviteToken
  ]]);

  if (invitation) {
    updateInvitationResponse(invitation, data, rsvpId, now);
  }

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

function getPublicInvitation(token) {
  const normalizedToken = normalizeInvitationToken(token);
  if (!normalizedToken) {
    return {
      success: false,
      message: "This invitation link could not be verified."
    };
  }

  const invitation = findInvitationByToken(normalizedToken);
  if (!invitation) {
    return {
      success: false,
      message: "This invitation link could not be verified."
    };
  }

  return {
    success: true,
    invitation: buildPublicInvitationPayload(invitation)
  };
}

function buildPublicInvitationPayload(invitation) {
  const response = invitation.rsvpId ? getRsvpById(invitation.rsvpId) : null;
  const source = response || {};
  const attending = response
    ? response.attending
    : invitation.status === "Accepted"
      ? "Yes"
      : invitation.status === "Declined"
        ? "No"
        : "";

  return {
    inviteToken: invitation.token,
    guestName: source.guestName || invitation.guestName,
    mobileNumber: source.mobileNumber || invitation.mobileNumber,
    adultsInvited: invitation.adultsInvited,
    childrenInvited: invitation.childrenInvited,
    totalPeopleInvited: invitation.totalPeopleInvited,
    status: invitation.status,
    attending,
    adultsAttending: response ? response.adults : invitation.adultsAttending,
    childrenAttending: response ? response.children : invitation.childrenAttending,
    childAges: response ? response.childAges : []
  };
}

function createInvitation(invitationData) {
  const values = validateInvitationAllocation(invitationData);
  const sheet = getInvitationSheet();
  const now = new Date();
  let token = createInvitationToken();

  while (findInvitationByToken(token)) {
    token = createInvitationToken();
  }

  sheet.appendRow([
    token,
    now,
    sanitizeCell(values.guestName),
    sanitizeCell(values.mobileNumber),
    values.adultsInvited,
    values.childrenInvited,
    values.totalPeopleInvited,
    "Awaiting RSVP",
    0,
    0,
    0,
    "",
    "",
    now,
    "Not Shared",
    "",
    "",
    0
  ]);

  return {
    success: true,
    invitation: findInvitationByToken(token),
    message: "Invitation created."
  };
}

function updateInvitation(invitationData) {
  const token = normalizeInvitationToken(invitationData.inviteToken || invitationData.token);
  if (!token) throw new Error("Invitation token is required.");

  const invitation = findInvitationByToken(token);
  if (!invitation) throw new Error("Invitation was not found.");

  const values = validateInvitationAllocation(invitationData);
  if (values.adultsInvited < invitation.adultsAttending) {
    throw new Error("Adults invited cannot be less than adults already attending.");
  }
  if (values.childrenInvited < invitation.childrenAttending) {
    throw new Error("Children invited cannot be less than children already attending.");
  }

  const sheet = getInvitationSheet();
  const now = new Date();

  sheet.getRange(invitation.rowNumber, 3, 1, 5).setValues([[
    sanitizeCell(values.guestName),
    sanitizeCell(values.mobileNumber),
    values.adultsInvited,
    values.childrenInvited,
    values.totalPeopleInvited
  ]]);
  sheet.getRange(invitation.rowNumber, 14).setValue(now);

  return {
    success: true,
    invitation: findInvitationByToken(token),
    message: "Invitation updated."
  };
}

function markInvitationShared(tokenValue) {
  const token = normalizeInvitationToken(tokenValue);
  if (!token) throw new Error("Invitation token is required.");

  const invitation = findInvitationByToken(token);
  if (!invitation) throw new Error("Invitation was not found.");

  const sheet = getInvitationSheet();
  const now = new Date();
  const firstSharedAt = invitation.firstSharedAt || now;
  const shareCount = Number(invitation.shareCount || 0) + 1;

  sheet.getRange(invitation.rowNumber, 15, 1, 4).setValues([[
    "Shared",
    firstSharedAt,
    now,
    shareCount
  ]]);

  return {
    success: true,
    invitation: findInvitationByToken(token),
    message: "Invitation marked shared."
  };
}

function markInvitationUnshared(tokenValue) {
  const token = normalizeInvitationToken(tokenValue);
  if (!token) throw new Error("Invitation token is required.");

  const invitation = findInvitationByToken(token);
  if (!invitation) throw new Error("Invitation was not found.");

  const sheet = getInvitationSheet();
  sheet.getRange(invitation.rowNumber, 15).setValue("Not Shared");

  return {
    success: true,
    invitation: findInvitationByToken(token),
    message: "Invitation marked unshared."
  };
}

function validateInvitationAllocation(invitationData) {
  const guestName = String(invitationData.guestName || "").trim();
  const mobileNumber = String(invitationData.mobileNumber || "").trim();
  const adultsInvited = Number(invitationData.adultsInvited);
  const childrenInvited = Number(invitationData.childrenInvited || 0);

  if (guestName.length < 2 || guestName.length > 100) {
    throw new Error("Guest Name is required.");
  }
  if (mobileNumber && (normalizeMobileNumber(mobileNumber).length < 8 || normalizeMobileNumber(mobileNumber).length > 15)) {
    throw new Error("Please enter a valid mobile number.");
  }
  if (!Number.isInteger(adultsInvited) || adultsInvited < 0 || adultsInvited > 10) {
    throw new Error("Adults Invited must be between 0 and 10.");
  }
  if (!Number.isInteger(childrenInvited) || childrenInvited < 0 || childrenInvited > 4) {
    throw new Error("Children Invited must be between 0 and 4.");
  }
  if (adultsInvited + childrenInvited < 1) {
    throw new Error("At least one person must be invited.");
  }

  return {
    guestName,
    mobileNumber,
    adultsInvited,
    childrenInvited,
    totalPeopleInvited: adultsInvited + childrenInvited
  };
}

function listInvitations() {
  const sheet = getInvitationSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  return sheet
    .getRange(2, 1, lastRow - 1, INVITATION_HEADERS.length)
    .getDisplayValues()
    .map((row, index) => invitationFromRow(row, index + 2))
    .filter((invitation) => invitation.token);
}

function getInvitationStats(invitations) {
  const shared = invitations.filter((invitation) => invitation.shareStatus === "Shared");
  return {
    personalInvitesCreated: invitations.length,
    invitesShared: shared.length,
    awaitingResponse: shared.filter((invitation) => invitation.status === "Awaiting RSVP").length,
    notYetShared: invitations.filter((invitation) => invitation.shareStatus !== "Shared").length
  };
}

function getInvitationSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(INVITATIONS_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(INVITATIONS_SHEET_NAME);
  }

  ensureInvitationHeaders(sheet);
  return sheet;
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

function ensureInvitationHeaders(sheet) {
  const width = Math.max(sheet.getLastColumn(), INVITATION_HEADERS.length, 1);
  const existing = sheet.getRange(1, 1, 1, width).getDisplayValues()[0];
  const hasHeaders = existing.some((header) => String(header || "").trim());

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, INVITATION_HEADERS.length).setValues([INVITATION_HEADERS]);
    sheet.getRange(1, 1, 1, INVITATION_HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
    return;
  }

  INVITATION_HEADERS.forEach((header) => {
    if (existing.includes(header)) return;

    const nextColumn = sheet.getLastColumn() + 1;
    sheet.getRange(1, nextColumn).setValue(header);
    sheet.getRange(1, nextColumn).setFontWeight("bold");
    existing.push(header);
  });

  sheet.setFrozenRows(1);
}

function findExistingMobileRow(sheet, normalizedMobile) {
  if (!normalizedMobile) return null;

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

function findInvitationResponseRow(sheet, inviteToken) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const values = sheet.getRange(2, 14, lastRow - 1, 1).getDisplayValues();
  for (let index = 0; index < values.length; index += 1) {
    if (String(values[index][0]).trim() === inviteToken) {
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

function getRsvpById(rsvpId) {
  const sheet = getResponseSheet();
  ensureHeaders(sheet);
  const rowNumber = findRsvpIdRow(sheet, rsvpId);
  if (!rowNumber) return null;

  const row = sheet.getRange(rowNumber, 1, 1, HEADERS.length).getDisplayValues()[0];
  return {
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
    inviteToken: row[13] || ""
  };
}

function findInvitationByToken(token) {
  const normalizedToken = normalizeInvitationToken(token);
  if (!normalizedToken) return null;

  const sheet = getInvitationSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const values = sheet.getRange(2, 1, lastRow - 1, INVITATION_HEADERS.length).getDisplayValues();
  for (let index = 0; index < values.length; index += 1) {
    if (String(values[index][0]).trim() === normalizedToken) {
      return invitationFromRow(values[index], index + 2);
    }
  }
  return null;
}

function invitationFromRow(row, rowNumber) {
  return {
    token: String(row[0] || "").trim(),
    inviteToken: String(row[0] || "").trim(),
    createdTimestamp: row[1],
    guestName: row[2],
    mobileNumber: row[3],
    adultsInvited: Number(row[4] || 0),
    childrenInvited: Number(row[5] || 0),
    totalPeopleInvited: Number(row[6] || 0),
    status: row[7] || "Awaiting RSVP",
    adultsAttending: Number(row[8] || 0),
    childrenAttending: Number(row[9] || 0),
    totalAttending: Number(row[10] || 0),
    rsvpId: row[11],
    respondedTimestamp: row[12],
    lastUpdated: row[13],
    shareStatus: row[14] === "Shared" ? "Shared" : "Not Shared",
    firstSharedAt: row[15],
    lastSharedAt: row[16],
    shareCount: Number(row[17] || 0),
    rowNumber
  };
}

function updateInvitationResponse(invitation, data, rsvpId, now) {
  const sheet = getInvitationSheet();
  const status = data.attending === "Yes" ? "Accepted" : "Declined";
  const adultsAttending = data.attending === "Yes" ? Number(data.adultCount) : 0;
  const childrenAttending = data.attending === "Yes" ? Number(data.childCount) : 0;
  const respondedTimestamp = invitation.respondedTimestamp || now;

  sheet.getRange(invitation.rowNumber, 3, 1, 12).setValues([[
    sanitizeCell(data.guestName),
    sanitizeCell(data.mobileNumber),
    invitation.adultsInvited,
    invitation.childrenInvited,
    invitation.totalPeopleInvited,
    status,
    adultsAttending,
    childrenAttending,
    adultsAttending + childrenAttending,
    rsvpId,
    respondedTimestamp,
    now
  ]]);
}

function validateSubmission(data, invitation) {
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

    if (invitation) {
      if (!Number.isInteger(adults) || adults < 0 || adults > invitation.adultsInvited) {
        throw new Error("Adult count exceeds this invitation.");
      }
      if (!Number.isInteger(children) || children < 0 || children > invitation.childrenInvited) {
        throw new Error("Child count exceeds this invitation.");
      }
      if (adults + children < 1) {
        throw new Error("Please select at least one attendee.");
      }
    } else if (!Number.isInteger(adults) || adults < 1 || adults > 10) {
      throw new Error("Invalid adult count.");
    }
    if (!invitation && (!Number.isInteger(children) || children < 0 || children > 4)) {
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

function normalizeInvitationToken(value) {
  const token = String(value || "").trim();
  if (!token) return "";
  return /^[A-Z0-9]{24,40}$/.test(token) ? token : "";
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

function createInvitationToken() {
  return Utilities.getUuid().replace(/-/g, "").toUpperCase();
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
