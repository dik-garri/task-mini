/**
 * Configuration constants
 */
const CONFIG = {
  SHEET_ID: 'PLACEHOLDER_SHEET_ID', // Replace with actual Sheet ID
  BOT_TOKEN: 'PLACEHOLDER_BOT_TOKEN', // Replace with actual token

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
  return SpreadsheetApp.openById(CONFIG.SHEET_ID);
}

/**
 * Get sheet by name
 */
function getSheet(name) {
  return getSpreadsheet().getSheetByName(name);
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
