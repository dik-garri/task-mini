/**
 * Teams data operations
 */

/**
 * Find team by ID
 * @param {string} teamId
 * @returns {Object|null} team object or null
 */
function findTeamById(teamId) {
  const sheet = getSheet(CONFIG.SHEETS.TEAMS);
  const data = sheet.getDataRange().getValues();

  // Check for empty sheet (only header or empty)
  if (data.length <= 1) {
    return null;
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === teamId) {
      return {
        team_id: data[i][0],
        name: data[i][1],
        created_by: data[i][2],
        created_at: data[i][3],
        task_creation_mode: data[i][4],
        invite_code: data[i][5],
        _row: i + 1
      };
    }
  }
  return null;
}

/**
 * Find team by invite code
 * @param {string} inviteCode
 * @returns {Object|null}
 */
function findTeamByInviteCode(inviteCode) {
  const sheet = getSheet(CONFIG.SHEETS.TEAMS);
  const data = sheet.getDataRange().getValues();

  // Check for empty sheet (only header or empty)
  if (data.length <= 1) {
    return null;
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][5] === inviteCode) {
      return {
        team_id: data[i][0],
        name: data[i][1],
        created_by: data[i][2],
        created_at: data[i][3],
        task_creation_mode: data[i][4],
        invite_code: data[i][5],
        _row: i + 1
      };
    }
  }
  return null;
}

/**
 * Create new team
 * @param {string} name
 * @param {string} createdBy - Telegram user_id
 * @param {string} creationMode - 'all' or 'leader_only'
 * @returns {Object} created team
 */
function createTeam(name, createdBy, creationMode) {
  const sheet = getSheet(CONFIG.SHEETS.TEAMS);

  // Generate unique invite code with collision detection
  let inviteCode = generateInviteCode();
  while (findTeamByInviteCode(inviteCode) !== null) {
    inviteCode = generateInviteCode();
  }

  const team = {
    team_id: generateId(),
    name: name,
    created_by: createdBy,
    created_at: new Date(),
    task_creation_mode: creationMode || CONFIG.CREATION_MODE.ALL,
    invite_code: inviteCode
  };

  sheet.appendRow([
    team.team_id,
    team.name,
    team.created_by,
    team.created_at,
    team.task_creation_mode,
    team.invite_code
  ]);

  return team;
}

/**
 * Update team settings
 * @param {string} teamId
 * @param {Object} updates - fields to update
 * @returns {Object|null} updated team or null
 */
function updateTeam(teamId, updates) {
  const team = findTeamById(teamId);
  if (!team) return null;

  const sheet = getSheet(CONFIG.SHEETS.TEAMS);

  if (updates.name !== undefined) {
    sheet.getRange(team._row, 2).setValue(updates.name);
  }
  if (updates.task_creation_mode !== undefined) {
    sheet.getRange(team._row, 5).setValue(updates.task_creation_mode);
  }

  return findTeamById(teamId);
}

/**
 * Delete team and all associated data
 * @param {string} teamId
 * @returns {boolean} success
 */
function deleteTeam(teamId) {
  const team = findTeamById(teamId);
  if (!team) return false;

  // Delete team members
  const membersSheet = getSheet(CONFIG.SHEETS.MEMBERS);
  const membersData = membersSheet.getDataRange().getValues();
  for (let i = membersData.length - 1; i >= 1; i--) {
    if (membersData[i][0] === teamId) {
      membersSheet.deleteRow(i + 1);
    }
  }

  // Delete tasks
  const tasksSheet = getSheet(CONFIG.SHEETS.TASKS);
  const tasksData = tasksSheet.getDataRange().getValues();
  for (let i = tasksData.length - 1; i >= 1; i--) {
    if (tasksData[i][1] === teamId) {
      tasksSheet.deleteRow(i + 1);
    }
  }

  // Delete team
  const teamsSheet = getSheet(CONFIG.SHEETS.TEAMS);
  teamsSheet.deleteRow(team._row);

  return true;
}
