/**
 * Team members data operations
 */

/**
 * Get all members of a team
 * @param {string} teamId
 * @returns {Array} array of member objects
 */
function getTeamMembers(teamId) {
  const sheet = getSheet(CONFIG.SHEETS.MEMBERS);
  const data = sheet.getDataRange().getValues();
  const members = [];

  // Check for empty sheet (only header or empty)
  if (data.length <= 1) {
    return members;
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === teamId) {
      members.push({
        team_id: data[i][0],
        user_id: data[i][1],
        username: data[i][2],
        display_name: data[i][3],
        role: data[i][4],
        joined_at: data[i][5],
        _row: i + 1
      });
    }
  }
  return members;
}

/**
 * Find member in team
 * @param {string} teamId
 * @param {string} userId
 * @returns {Object|null}
 */
function findMember(teamId, userId) {
  const sheet = getSheet(CONFIG.SHEETS.MEMBERS);
  const data = sheet.getDataRange().getValues();

  // Check for empty sheet (only header or empty)
  if (data.length <= 1) {
    return null;
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === teamId && data[i][1] === String(userId)) {
      return {
        team_id: data[i][0],
        user_id: data[i][1],
        username: data[i][2],
        display_name: data[i][3],
        role: data[i][4],
        joined_at: data[i][5],
        _row: i + 1
      };
    }
  }
  return null;
}

/**
 * Get all teams for a user
 * @param {string} userId
 * @returns {Array} array of team objects with membership info
 */
function getUserTeams(userId) {
  const sheet = getSheet(CONFIG.SHEETS.MEMBERS);
  const data = sheet.getDataRange().getValues();
  const teams = [];

  // Check for empty sheet (only header or empty)
  if (data.length <= 1) {
    return teams;
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === String(userId)) {
      const team = findTeamById(data[i][0]);
      if (team) {
        teams.push({
          ...team,
          my_role: data[i][4]
        });
      }
    }
  }
  return teams;
}

/**
 * Add member to team
 * @param {string} teamId
 * @param {Object} user - { user_id, username, display_name }
 * @param {string} role - 'leader' or 'member'
 * @returns {Object} created membership
 */
function addMember(teamId, user, role) {
  // Check if already member
  const existing = findMember(teamId, user.user_id);
  if (existing) {
    return existing;
  }

  const sheet = getSheet(CONFIG.SHEETS.MEMBERS);
  const member = {
    team_id: teamId,
    user_id: String(user.user_id),
    username: user.username || '',
    display_name: user.display_name || user.username || 'User',
    role: role,
    joined_at: new Date()
  };

  sheet.appendRow([
    member.team_id,
    member.user_id,
    member.username,
    member.display_name,
    member.role,
    member.joined_at
  ]);

  return member;
}

/**
 * Remove member from team
 * @param {string} teamId
 * @param {string} userId
 * @returns {boolean}
 */
function removeMember(teamId, userId) {
  const member = findMember(teamId, userId);
  if (!member) return false;

  const sheet = getSheet(CONFIG.SHEETS.MEMBERS);
  sheet.deleteRow(member._row);

  // If leader left, promote first member
  if (member.role === CONFIG.ROLE.LEADER) {
    const remaining = getTeamMembers(teamId);
    if (remaining.length > 0) {
      // Promote first member
      const newLeader = remaining[0];
      sheet.getRange(newLeader._row, 5).setValue(CONFIG.ROLE.LEADER);
    } else {
      // Last member left - delete team
      deleteTeam(teamId);
    }
  }

  return true;
}

/**
 * Check if user can create tasks in team
 * @param {string} teamId
 * @param {string} userId
 * @returns {boolean}
 */
function canCreateTasks(teamId, userId) {
  const team = findTeamById(teamId);
  if (!team) return false;

  const member = findMember(teamId, userId);
  if (!member) return false;

  if (team.task_creation_mode === CONFIG.CREATION_MODE.ALL) {
    return true;
  }

  return member.role === CONFIG.ROLE.LEADER;
}
