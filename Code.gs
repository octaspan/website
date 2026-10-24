/**
 * OCTASPAN WEBSITE — GOOGLE APPS SCRIPT BACKEND
 * ============================================================
 * Receives POSTs from the website's four forms (newsletter,
 * contact, rfp, partner), writes rows to a Google Sheet, and — for RFP
 * submissions — saves any attached files to a Google Drive folder.
 *
 * Setup instructions: see SETUP.md in this same folder.
 * ============================================================
 */

/**
 * Drive folders. Leave the IDs as-is and the script creates (and reuses) folders
 * with these names in the owner's My Drive on the first file upload. To use an
 * existing folder instead, paste its ID (the last part of the folder's URL).
 */
const RFP_DRIVE_FOLDER_ID = 'PASTE_YOUR_DRIVE_FOLDER_ID_HERE';
const RFP_DRIVE_FOLDER_NAME = 'Octaspan RFP Attachments';
const PARTNER_DRIVE_FOLDER_ID = 'PASTE_YOUR_PARTNER_DRIVE_FOLDER_ID_HERE';
const PARTNER_DRIVE_FOLDER_NAME = 'Octaspan Partner Files';

/** Optional: an email address to notify about each new RFP / partner / contact submission. */
const NOTIFY_EMAIL = 'octaspan.cybersecurity@gmail.com';

/** Server-side file rules (the website enforces the same limits in the browser). */
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 10;
const ALLOWED_EXT = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'png', 'jpg', 'jpeg', 'webp', 'gif'];

/** Sheet tab names — created automatically on first submission if missing. */
const SHEETS = {
  newsletter: 'Newsletter Signups',
  contact: 'Contact Submissions',
  rfp: 'RFP Submissions',
  partner: 'Partner Applications',
  feedback: 'Website Feedback',
};

/** Column headers for each tab, in order. Keep in sync with the payloads in index.html. */
const HEADERS = {
  newsletter: ['Timestamp', 'Email', 'Interests', 'Page'],
  contact: [
    'Timestamp', 'Topic', 'First Name', 'Last Name', 'Email', 'Phone',
    'Company', 'Job Title', 'Country/Region', 'Service Interest',
    'Message', 'Referral Source', 'Preferred Contact', 'Source Page',
  ],
  rfp: [
    'Timestamp', 'Country/Region', 'Organization', 'Industry', 'Company Location',
    'Revenue Range', 'Employee Count', 'Website', 'Title', 'First Name', 'Last Name',
    'Job Title', 'Email', 'Phone', 'Services Required', 'Project Title',
    'Business Challenge', 'Start Date', 'Completion Date', 'Estimated Budget',
    'Proposal Deadline', 'Other Firms Invited', 'File Links', 'File Count',
  ],
  feedback: ['Timestamp', 'First Name', 'Last Name', 'Company', 'Role', 'Email', 'Phone', 'Topic', 'Feedback', 'Consent (Privacy & Terms)', 'Page'],
  partner: [
    'Timestamp', 'Partner Type', 'Company Name', 'Website', 'Company LinkedIn', 'Country', 'City',
    'Company Type', 'Company Size', 'Year Established', 'Contact Person', 'Designation',
    'Business Email', 'Phone', 'LinkedIn Profile', 'Partnership Areas', 'Product Name',
    'Product Description', 'Customer Segment', 'Deployment Model', 'Tech Support', 'Certifications',
    'Team Size', 'Delivery Capability', 'Partnership Model', 'Looking For', 'Current Markets',
    'Customer Count', 'Enterprise Customer Count', 'Existing Partnerships', 'Existing Partnerships Detail',
    'Partnership Proposal', 'Authorized', 'Preferred Engagement', 'Timeframe', 'Heard From',
    'File Links', 'File Count',
  ],
};

/**
 * Entry point — every fetch() from the website hits this function.
 * The site posts with mode:'no-cors', so whatever we return here is
 * never read by the browser; we just need to not throw.
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // serialize concurrent submissions so rows never interleave
    const payload = JSON.parse(e.postData.contents);
    const formType = payload.formType;

    if (formType === 'newsletter') {
      handleNewsletter(payload);
    } else if (formType === 'contact') {
      handleContact(payload);
    } else if (formType === 'rfp') {
      handleRfp(payload);
    } else if (formType === 'partner') {
      handlePartner(payload);
    } else if (formType === 'feedback') {
      handleFeedback(payload);
    } else {
      logUnknown(payload);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    logError(err, e);
    return jsonResponse({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/** Lets you open the Web App URL directly in a browser to confirm it's live. */
function doGet() {
  return ContentService.createTextOutput(
    'Octaspan form-intake endpoint is live (v2). POST only.'
  ).setMimeType(ContentService.MimeType.TEXT);
}

// ---------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------

function handleNewsletter(payload) {
  const sheet = getOrCreateSheet(SHEETS.newsletter, HEADERS.newsletter);
  safeAppend(sheet, [
    new Date(),
    payload.email || '',
    (payload.interests || []).join(', '),
    payload.page || '',
  ]);
}

function handleFeedback(payload) {
  if (payload.website) return; // honeypot: real visitors never fill this hidden field
  const sheet = getOrCreateSheet(SHEETS.feedback, HEADERS.feedback);
  const clip = (v, n) => String(v || '').slice(0, n);
  safeAppend(sheet, [
    new Date(),
    clip(payload.firstName, 80),
    clip(payload.lastName, 80),
    clip(payload.company, 160),
    clip(payload.role, 120),
    clip(payload.email, 160),
    clip(payload.phone, 40),
    clip(payload.topic, 60),
    clip(payload.feedback, 3000),
    payload.consent ? 'Yes' : 'No',
    clip(payload.page, 300),
  ]);
  notify('New website feedback (' + clip(payload.topic, 60) + ') from ' + clip(payload.company, 160), clip(payload.email, 160));
}

function handleContact(payload) {
  const sheet = getOrCreateSheet(SHEETS.contact, HEADERS.contact);
  safeAppend(sheet, [
    new Date(),
    payload.topic || '',
    payload.firstName || '',
    payload.lastName || '',
    payload.email || '',
    payload.phone || '',
    payload.company || '',
    payload.jobTitle || '',
    payload.country || '',
    payload.serviceInterest || '',
    payload.message || '',
    payload.referralSource || '',
    payload.preferredContact || '',
    payload.sourcePage || '',
  ]);
  notify('New contact message: ' + (payload.topic || ''), payload.email, []);
}

function handleRfp(payload) {
  const fileLinks = saveFilesToFolder(payload.files || [], RFP_DRIVE_FOLDER_ID, RFP_DRIVE_FOLDER_NAME, payload.orgName || 'Unknown', payload.email || '');
  const sheet = getOrCreateSheet(SHEETS.rfp, HEADERS.rfp);
  safeAppend(sheet, [
    new Date(),
    payload.country || '',
    payload.orgName || '',
    payload.industry || '',
    payload.companyLocation || '',
    payload.revenueRange || '',
    payload.employeeCount || '',
    payload.website || '',
    payload.title || '',
    payload.firstName || '',
    payload.lastName || '',
    payload.jobTitle || '',
    payload.email || '',
    payload.phone || '',
    payload.servicesRequired || '',
    payload.projectTitle || '',
    payload.businessChallenge || '',
    payload.startDate || '',
    payload.completionDate || '',
    payload.estimatedBudget || '',
    payload.proposalDeadline || '',
    payload.otherFirmsInvited ? 'Yes' : 'No',
    fileLinks.join('\n'),
    (payload.files || []).length,
  ]);
  notify('New RFP: ' + (payload.orgName || ''), payload.email, fileLinks);
}

function handlePartner(payload) {
  const j = (arr) => (arr || []).join('; ');
  const fileLinks = saveFilesToFolder(payload.files || [], PARTNER_DRIVE_FOLDER_ID, PARTNER_DRIVE_FOLDER_NAME, payload.companyName || 'Unknown', payload.email || '');
  const sheet = getOrCreateSheet(SHEETS.partner, HEADERS.partner);
  safeAppend(sheet, [
    new Date(), payload.partnerType || '', payload.companyName || '', payload.website || '',
    payload.companyLinkedIn || '', payload.country || '', payload.city || '', payload.companyType || '',
    payload.companySize || '', payload.yearEstablished || '', payload.contactPerson || '',
    payload.designation || '', payload.email || '', payload.phone || '', payload.linkedIn || '',
    j(payload.partnershipAreas), payload.productName || '', payload.productDescription || '',
    j(payload.customerSegment), j(payload.deploymentModel), j(payload.techSupport),
    payload.certifications || '', payload.teamSize || '', j(payload.deliveryCapability),
    j(payload.partnershipModel), j(payload.lookingFor), j(payload.currentMarkets),
    payload.customerCount || '', payload.enterpriseCustomerCount || '',
    payload.existingPartnerships || '', payload.existingPartnershipsDetail || '',
    payload.partnershipProposal || '', payload.authorized || '', j(payload.preferredEngagement),
    payload.timeframe || '', payload.heardFrom || '',
    fileLinks.join('\n'), (payload.files || []).length,
  ]);
  notify('New partner application: ' + (payload.companyName || ''), payload.email, fileLinks);
}

/**
 * Validates and decodes each base64 file in the payload (documents or images) and saves
 * it to a dated subfolder of the target Drive folder, named after the organisation and
 * submitter email. Returns one line per file: "<label>: <Drive link>".
 * Rejected files are listed in the sheet as "(skipped: reason)" instead of failing the row.
 */
function saveFilesToFolder(files, folderId, folderName, orgName, email) {
  if (!files.length) return [];
  const rootFolder = getRootFolder(folderId, folderName);
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HHmm');
  const safeOrg = String(orgName || 'Unknown').replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 60) || 'Unknown';
  const safeMail = String(email || '').replace(/[^a-zA-Z0-9@._+-]/g, '').slice(0, 80);
  let subfolder = null;

  const links = [];
  files.slice(0, MAX_FILES).forEach((f) => {
    const name = String(f.name || 'upload').replace(/[\\/:*?"<>|\r\n]/g, '_').slice(0, 120);
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (!f.base64) { links.push('(skipped ' + name + ': no file data)'); return; }
    if (ALLOWED_EXT.indexOf(ext) === -1) { links.push('(skipped ' + name + ': file type not allowed)'); return; }
    const bytes = Utilities.base64Decode(f.base64);
    if (bytes.length > MAX_FILE_BYTES) { links.push('(skipped ' + name + ': over 25MB)'); return; }
    if (!subfolder) subfolder = rootFolder.createFolder(stamp + ' - ' + safeOrg + ' (' + safeMail + ')');
    const blob = Utilities.newBlob(bytes, f.mimeType || mimeFromExt(ext), name);
    const driveFile = subfolder.createFile(blob);
    const label = f.kind ? String(f.kind).replace(/[^a-zA-Z ]/g, '') + ' - ' : '';
    links.push(label + name + ': ' + driveFile.getUrl());
  });
  if (files.length > MAX_FILES) links.push('(' + (files.length - MAX_FILES) + ' extra files skipped)');
  return links;
}

/** Uses the configured folder ID if set, otherwise finds-or-creates a folder by name. */
function getRootFolder(folderId, folderName) {
  if (folderId && String(folderId).indexOf('PASTE_YOUR_') !== 0) return DriveApp.getFolderById(folderId);
  const it = DriveApp.getFoldersByName(folderName);
  return it.hasNext() ? it.next() : DriveApp.createFolder(folderName);
}

function mimeFromExt(ext) {
  const map = {
    pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
  };
  return map[ext] || 'application/octet-stream';
}

// ---------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------

/**
 * Returns the spreadsheet to write to. Works whether the script was created from inside a
 * Sheet (Extensions > Apps Script) or as a standalone project: in the standalone case it
 * finds or creates a spreadsheet called "Octaspan Website Submissions" and remembers its ID.
 */
function getSpreadsheet() {
  let ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (_) {}
  if (ss) return ss;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SHEET_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (_) {} }
  ss = SpreadsheetApp.create('Octaspan Website Submissions');
  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}

function getOrCreateSheet(name, headers) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}

/**
 * Run this ONCE from the Apps Script editor (select "testSetup" > Run). It forces Google's
 * permission prompt (Sheets, Drive, Gmail), writes a test row to every tab, and logs the
 * spreadsheet URL so you can confirm exactly where submissions are going.
 */
function testSetup() {
  const ss = getSpreadsheet();
  Object.keys(SHEETS).forEach((k) => {
    safeAppend(getOrCreateSheet(SHEETS[k], HEADERS[k]), [new Date(), 'TEST ROW - safe to delete']);
  });
  getRootFolder(RFP_DRIVE_FOLDER_ID, RFP_DRIVE_FOLDER_NAME);
  getRootFolder(PARTNER_DRIVE_FOLDER_ID, PARTNER_DRIVE_FOLDER_NAME);
  if (NOTIFY_EMAIL) MailApp.sendEmail(NOTIFY_EMAIL, '[Octaspan website] setup test', 'Form intake is set up. Sheet: ' + ss.getUrl());
  Logger.log('OK - submissions go to: ' + ss.getUrl());
}

/**
 * Appends a row with every cell after the timestamp stored as plain text, so text typed
 * by a website visitor (e.g. starting with "=" or "+") is never evaluated as a formula.
 */
function safeAppend(sheet, row) {
  const r = sheet.getLastRow() + 1;
  const range = sheet.getRange(r, 1, 1, row.length);
  if (row.length > 1) sheet.getRange(r, 2, 1, row.length - 1).setNumberFormat('@');
  range.setValues([row.map((v, i) => (i === 0 ? v : String(v === null || v === undefined ? '' : v)))]);
}

function notify(subject, replyTo, links) {
  if (!NOTIFY_EMAIL) return;
  try {
    MailApp.sendEmail({
      to: NOTIFY_EMAIL, subject: '[Octaspan website] ' + subject,
      body: 'Details are in the Google Sheet.\n\nSubmitter: ' + (replyTo || 'n/a') +
            (links && links.length ? '\n\nFiles:\n' + links.join('\n') : ''),
    });
  } catch (_) {}
}

function logUnknown(payload) {
  const sheet = getOrCreateSheet('Unrecognized Submissions', ['Timestamp', 'Raw Payload']);
  safeAppend(sheet, [new Date(), JSON.stringify(payload)]);
}

function logError(err, e) {
  try {
    const sheet = getOrCreateSheet('Errors', ['Timestamp', 'Error', 'Raw Post Data']);
    safeAppend(sheet, [new Date(), String(err), e && e.postData ? e.postData.contents.slice(0, 2000) : '(none)']);
  } catch (_) {
    // If even error logging fails, there's nothing more we can do here.
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
