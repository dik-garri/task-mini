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
    REMINDERS: 'sent_reminders',
    LOGS: 'logs'
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

  // Logs sheet
  const logsSheet = getSheet(CONFIG.SHEETS.LOGS);
  ensureHeader_(logsSheet, [
    'timestamp',
    'level',
    'source',
    'action',
    'user_id',
    'details',
    'error'
  ]);
  logsSheet.setFrozenRows(1);
  Logger.log('Created sheet: ' + CONFIG.SHEETS.LOGS);

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

// ============================================
// LOGGING FUNCTIONS
// ============================================

/**
 * Log levels
 */
const LOG_LEVEL = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
};

/**
 * Write log entry to logs sheet
 * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR)
 * @param {string} source - Source file/function (e.g., 'Api.gs', 'Bot.gs')
 * @param {string} action - Action being performed (e.g., 'createTask', 'handleMessage')
 * @param {string|number} userId - Telegram user ID (optional)
 * @param {object|string} details - Additional details (will be JSON stringified)
 * @param {string} error - Error message if any
 */
function writeLog(level, source, action, userId, details, error) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.LOGS);
    const timestamp = new Date().toISOString();

    // Convert details to string
    let detailsStr = '';
    if (details) {
      if (typeof details === 'object') {
        try {
          detailsStr = JSON.stringify(details);
        } catch (e) {
          detailsStr = String(details);
        }
      } else {
        detailsStr = String(details);
      }
    }

    sheet.appendRow([
      timestamp,
      level,
      source || '',
      action || '',
      userId || '',
      detailsStr,
      error || ''
    ]);
  } catch (e) {
    // Fallback to Logger if sheet logging fails
    Logger.log('LOG ERROR: ' + e.message);
    Logger.log(level + ' | ' + source + ' | ' + action + ' | ' + details);
  }
}

/**
 * Log debug message
 */
function logDebug(source, action, userId, details) {
  writeLog(LOG_LEVEL.DEBUG, source, action, userId, details, null);
}

/**
 * Log info message
 */
function logInfo(source, action, userId, details) {
  writeLog(LOG_LEVEL.INFO, source, action, userId, details, null);
}

/**
 * Log warning message
 */
function logWarn(source, action, userId, details) {
  writeLog(LOG_LEVEL.WARN, source, action, userId, details, null);
}

/**
 * Log error message
 */
function logError(source, action, userId, details, error) {
  const errorMsg = error instanceof Error ? error.message + '\n' + error.stack : String(error);
  writeLog(LOG_LEVEL.ERROR, source, action, userId, details, errorMsg);
}

/**
 * Clear old logs (keep last N days)
 * Run periodically to prevent sheet from growing too large
 */
function clearOldLogs(daysToKeep) {
  const days = daysToKeep || 7;
  const sheet = getSheet(CONFIG.SHEETS.LOGS);
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) return; // Only header

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const rowsToDelete = [];

  // Find rows older than cutoff (skip header)
  for (let i = 1; i < data.length; i++) {
    const timestamp = new Date(data[i][0]);
    if (timestamp < cutoffDate) {
      rowsToDelete.push(i + 1); // +1 because sheet rows are 1-indexed
    }
  }

  // Delete from bottom to top to preserve row indices
  for (let i = rowsToDelete.length - 1; i >= 0; i--) {
    sheet.deleteRow(rowsToDelete[i]);
  }

  Logger.log('Deleted ' + rowsToDelete.length + ' old log entries');
}
