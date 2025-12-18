/**
 * Configuration constants
 */

// Get credentials from Script Properties
const props = PropertiesService.getScriptProperties();

const CONFIG = {
  // Credentials from Script Properties (set via Project Settings -> Script Properties)
  SHEET_ID: props.getProperty('SHEET_ID'),
  BOT_TOKEN: props.getProperty('BOT_TOKEN'),

  // Sheet names
  SHEETS: {
    TEAMS: 'teams',
    MEMBERS: 'team_members',
    TASKS: 'tasks',
    REMINDERS: 'sent_reminders'
  },

  // Task statuses
  STATUS: {
    OPEN: 'open',
    IN_PROGRESS: 'in_progress',
    DONE: 'done'
  },

  // Team roles
  ROLE: {
    LEADER: 'leader',
    MEMBER: 'member'
  },

  // Task creation modes
  CREATION_MODE: {
    ALL: 'all',
    LEADER_ONLY: 'leader_only'
  }
};

/**
 * Get spreadsheet instance
 */
function getSpreadsheet() {
  if (!CONFIG.SHEET_ID) {
    throw new Error('SHEET_ID not configured. Set it in Project Settings -> Script Properties');
  }
  return SpreadsheetApp.openById(CONFIG.SHEET_ID);
}

/**
 * Get sheet by name, creates if doesn't exist
 */
function getSheet(name) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

/**
 * Generate UUID
 */
function generateId() {
  return Utilities.getUuid();
}

/**
 * Generate short invite code (6 chars)
 */
function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ============================================
// SETUP FUNCTIONS (run once after deployment)
// ============================================

/**
 * Setup all sheets with headers
 * Run this function once after creating the Google Sheet
 */
function setupSheets() {
  Logger.log('Setting up TaskMini sheets...');

  // Teams sheet
  const teamsSheet = getSheet(CONFIG.SHEETS.TEAMS);
  ensureHeader_(teamsSheet, [
    'team_id',
    'name',
    'created_by',
    'created_at',
    'task_creation_mode',
    'invite_code'
  ]);
  teamsSheet.setFrozenRows(1);
  Logger.log('Created sheet: ' + CONFIG.SHEETS.TEAMS);

  // Team members sheet
  const membersSheet = getSheet(CONFIG.SHEETS.MEMBERS);
  ensureHeader_(membersSheet, [
    'team_id',
    'user_id',
    'username',
    'display_name',
    'role',
    'joined_at'
  ]);
  membersSheet.setFrozenRows(1);
  Logger.log('Created sheet: ' + CONFIG.SHEETS.MEMBERS);

  // Tasks sheet
  const tasksSheet = getSheet(CONFIG.SHEETS.TASKS);
  ensureHeader_(tasksSheet, [
    'task_id',
    'team_id',
    'title',
    'assignee_id',
    'created_by',
    'status',
    'due_date',
    'reminder_settings',
    'created_at',
    'updated_at'
  ]);
  tasksSheet.setFrozenRows(1);
  Logger.log('Created sheet: ' + CONFIG.SHEETS.TASKS);

  // Sent reminders sheet
  const remindersSheet = getSheet(CONFIG.SHEETS.REMINDERS);
  ensureHeader_(remindersSheet, [
    'task_id',
    'reminder_type',
    'sent_at'
  ]);
  remindersSheet.setFrozenRows(1);
  Logger.log('Created sheet: ' + CONFIG.SHEETS.REMINDERS);

  // Delete default Sheet1 if exists
  const ss = getSpreadsheet();
  const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Лист1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
    Logger.log('Deleted default sheet');
  }

  Logger.log('Setup complete!');
}

/**
 * Ensure sheet has correct headers
 * @param {Sheet} sheet
 * @param {string[]} headers
 */
function ensureHeader_(sheet, headers) {
  const range = sheet.getRange(1, 1, 1, headers.length);
  const currentHeaders = range.getValues()[0];

  // Check if headers already set correctly
  const headersMatch = headers.every((h, i) => currentHeaders[i] === h);

  if (!headersMatch) {
    range.setValues([headers]);
    range.setFontWeight('bold');
    range.setBackground('#f3f3f3');
  }
}

/**
 * Test configuration
 * Run this to verify SHEET_ID and BOT_TOKEN are set correctly
 */
function testConfig() {
  Logger.log('Testing configuration...');

  // Check Script Properties
  const sheetId = props.getProperty('SHEET_ID');
  const botToken = props.getProperty('BOT_TOKEN');

  if (!sheetId) {
    Logger.log('ERROR: SHEET_ID not set in Script Properties');
    return;
  }
  Logger.log('SHEET_ID: ' + sheetId.substring(0, 10) + '...');

  if (!botToken) {
    Logger.log('ERROR: BOT_TOKEN not set in Script Properties');
    return;
  }
  Logger.log('BOT_TOKEN: ' + botToken.substring(0, 10) + '...');

  // Test spreadsheet access
  try {
    const ss = getSpreadsheet();
    Logger.log('Spreadsheet name: ' + ss.getName());
    Logger.log('Sheets: ' + ss.getSheets().map(s => s.getName()).join(', '));
  } catch (e) {
    Logger.log('ERROR accessing spreadsheet: ' + e.message);
    return;
  }

  Logger.log('Configuration OK!');
}
