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

/** Paste the Google Drive folder ID here (see SETUP.md Step 3). */
const RFP_DRIVE_FOLDER_ID = 'PASTE_YOUR_DRIVE_FOLDER_ID_HERE';

/** Separate Drive folder for partner attachments (see SETUP.md Step 3b). */
const PARTNER_DRIVE_FOLDER_ID = 'PASTE_YOUR_PARTNER_DRIVE_FOLDER_ID_HERE';

/** Sheet tab names — created automatically on first submission if missing. */
const SHEETS = {
  newsletter: 'Newsletter Signups',
  contact: 'Contact Submissions',
  rfp: 'RFP Submissions',
  partner: 'Partner Applications',
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
  try {
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
    } else {
      logUnknown(payload);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    logError(err, e);
    return jsonResponse({ ok: false, error: String(err) });
  }
}

/** Lets you open the Web App URL directly in a browser to confirm it's live. */
function doGet() {
  return ContentService.createTextOutput(
    'Octaspan form-intake endpoint is live. POST only.'
  ).setMimeType(ContentService.MimeType.TEXT);
}

// ---------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------

function handleNewsletter(payload) {
  const sheet = getOrCreateSheet(SHEETS.newsletter, HEADERS.newsletter);
  sheet.appendRow([
    new Date(),
    payload.email || '',
    (payload.interests || []).join(', '),
    payload.page || '',
  ]);
}

function handleContact(payload) {
  const sheet = getOrCreateSheet(SHEETS.contact, HEADERS.contact);
  sheet.appendRow([
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
}

function handleRfp(payload) {
  const fileLinks = saveFilesToFolder(payload.files || [], RFP_DRIVE_FOLDER_ID, payload.orgName || 'Unknown', payload.email || '');
  const sheet = getOrCreateSheet(SHEETS.rfp, HEADERS.rfp);
  sheet.appendRow([
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
}

function handlePartner(payload) {
  const j = (arr) => (arr || []).join('; ');
  const fileLinks = saveFilesToFolder(payload.files || [], PARTNER_DRIVE_FOLDER_ID, payload.companyName || 'Unknown', payload.email || '');
  const sheet = getOrCreateSheet(SHEETS.partner, HEADERS.partner);
  sheet.appendRow([
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
}

/**
 * Decodes each base64 file in the RFP payload and saves it to a
 * dated subfolder inside RFP_DRIVE_FOLDER_ID, named after the
 * organization and submitter email for easy identification.
 * Returns an array of shareable Drive links.
 */
function saveFilesToFolder(files, folderId, orgName, email) {
  if (!files.length) return [];
  if (String(folderId).indexOf('PASTE_YOUR_') === 0) {
    return ['(Drive folder not configured — see SETUP.md Step 3)'];
  }

  const rootFolder = DriveApp.getFolderById(folderId);
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HHmm');
  const safeOrg = (orgName || 'Unknown').replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 60);
  const subfolder = rootFolder.createFolder(`${stamp} — ${safeOrg} (${email})`);

  const links = [];
  files.forEach((f) => {
    if (!f.base64) return; // no base64 present (e.g. DEMO_MODE payload) — skip
    const bytes = Utilities.base64Decode(f.base64);
    const blob = Utilities.newBlob(bytes, f.mimeType || 'application/octet-stream', f.name || 'upload');
    const driveFile = subfolder.createFile(blob);
    links.push(driveFile.getUrl());
  });
  return links;
}

// ---------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}

function logUnknown(payload) {
  const sheet = getOrCreateSheet('Unrecognized Submissions', ['Timestamp', 'Raw Payload']);
  sheet.appendRow([new Date(), JSON.stringify(payload)]);
}

function logError(err, e) {
  try {
    const sheet = getOrCreateSheet('Errors', ['Timestamp', 'Error', 'Raw Post Data']);
    sheet.appendRow([new Date(), String(err), e && e.postData ? e.postData.contents : '(none)']);
  } catch (_) {
    // If even error logging fails, there's nothing more we can do here.
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
