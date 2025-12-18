/**
 * API handler for Mini App
 * Called via google.script.run from client
 */

/**
 * Main API entry point
 * @param {string} action - API action name
 * @param {string} initData - Telegram initData string
 * @param {string} payloadJson - JSON string of payload
 * @returns {Object} response
 */
function api(action, initData, payloadJson) {
  let user = null;
  let payload = null;

  try {
    user = parseInitData(initData);
    payload = payloadJson ? JSON.parse(payloadJson) : {};

    logInfo('Api', action, user.user_id, { payload: payload });

    let result;
    switch (action) {
      case 'ping':
        result = apiSuccess({ time: new Date().toISOString(), user: user });
        break;

      case 'getMyTeams':
        result = apiGetMyTeams(user);
        break;

      case 'getTeamTasks':
        result = apiGetTeamTasks(user, payload);
        break;

      case 'getTeamMembers':
        result = apiGetTeamMembers(user, payload);
        break;

      case 'createTeam':
        result = apiCreateTeam(user, payload);
        break;

      case 'joinTeam':
        result = apiJoinTeam(user, payload);
        break;

      case 'updateTeam':
        result = apiUpdateTeam(user, payload);
        break;

      case 'leaveTeam':
        result = apiLeaveTeam(user, payload);
        break;

      case 'createTask':
        result = apiCreateTask(user, payload);
        break;

      case 'updateTask':
        result = apiUpdateTask(user, payload);
        break;

      case 'deleteTask':
        result = apiDeleteTask(user, payload);
        break;

      default:
        result = apiError('Unknown action: ' + action);
    }

    // Log result
    if (!result.ok) {
      logWarn('Api', action + '_failed', user ? user.user_id : '', { error: result.error, payload: payload });
    }

    return result;
  } catch (e) {
    logError('Api', action, user ? user.user_id : '', { payload: payload, initData: initData ? initData.substring(0, 100) : '' }, e);
    return apiError(e.message);
  }
}

/**
 * Parse Telegram initData (simplified, no verification for MVP)
 */
function parseInitData(initData) {
  logDebug('Api', 'parseInitData', null, {
    initData_length: initData ? initData.length : 0,
    initData_preview: initData ? initData.substring(0, 100) : 'empty'
  });

  if (!initData) {
    logWarn('Api', 'parseInitData', null, { error: 'initData is empty' });
    return { user_id: '', username: '', display_name: 'Guest' };
  }

  try {
    const params = new URLSearchParams(initData);
    const userJson = params.get('user');

    logDebug('Api', 'parseInitData_params', null, {
      has_user: !!userJson,
      auth_date: params.get('auth_date'),
      hash: params.get('hash') ? 'present' : 'missing'
    });

    if (userJson) {
      const user = JSON.parse(decodeURIComponent(userJson));
      logInfo('Api', 'parseInitData_success', String(user.id), {
        username: user.username,
        first_name: user.first_name
      });
      return {
        user_id: String(user.id),
        username: user.username || '',
        display_name: user.first_name + (user.last_name ? ' ' + user.last_name : '')
      };
    }
  } catch (e) {
    logError('Api', 'parseInitData', null, { initData_preview: initData.substring(0, 50) }, e);
  }

  return { user_id: '', username: '', display_name: 'Guest' };
}

/**
 * Helper function to return success response
 */
function apiSuccess(data) {
  return { ok: true, ...data };
}

/**
 * Helper function to return error response
 */
function apiError(message) {
  return { ok: false, error: message };
}

// --- API Methods ---

/**
 * Get all teams for the authenticated user
 */
function apiGetMyTeams(user) {
  if (!user.user_id) return apiError('Not authenticated');
  const teams = getUserTeams(user.user_id);
  return apiSuccess({ teams: teams });
}

/**
 * Get all tasks for a specific team
 */
function apiGetTeamTasks(user, payload) {
  if (!user.user_id) return apiError('Not authenticated');
  if (!payload.team_id) return apiError('team_id required');

  // Check membership
  const member = findMember(payload.team_id, user.user_id);
  if (!member) return apiError('Not a team member');

  const tasks = getTeamTasks(payload.team_id);

  // Enrich with assignee info
  const members = getTeamMembers(payload.team_id);
  const membersMap = {};
  members.forEach(m => { membersMap[m.user_id] = m; });

  tasks.forEach(task => {
    task.assignee = membersMap[task.assignee_id] || null;
    task.creator = membersMap[task.created_by] || null;
  });

  return apiSuccess({ tasks: tasks });
}

/**
 * Get all members of a specific team
 */
function apiGetTeamMembers(user, payload) {
  if (!user.user_id) return apiError('Not authenticated');
  if (!payload.team_id) return apiError('team_id required');

  const member = findMember(payload.team_id, user.user_id);
  if (!member) return apiError('Not a team member');

  const members = getTeamMembers(payload.team_id);
  return apiSuccess({ members: members });
}

/**
 * Create a new team
 */
function apiCreateTeam(user, payload) {
  if (!user.user_id) return apiError('Not authenticated');
  if (!payload.name) return apiError('Team name required');

  const team = createTeam(
    payload.name,
    user.user_id,
    payload.task_creation_mode || CONFIG.CREATION_MODE.ALL
  );

  // Add creator as leader
  addMember(team.team_id, user, CONFIG.ROLE.LEADER);

  return apiSuccess({ team: team });
}

/**
 * Join a team using an invite code
 */
function apiJoinTeam(user, payload) {
  if (!user.user_id) return apiError('Not authenticated');
  if (!payload.invite_code) return apiError('Invite code required');

  const team = findTeamByInviteCode(payload.invite_code.toUpperCase());
  if (!team) return apiError('Team not found');

  const member = addMember(team.team_id, user, CONFIG.ROLE.MEMBER);

  return apiSuccess({ team: team, member: member });
}

/**
 * Update team settings (leader only)
 */
function apiUpdateTeam(user, payload) {
  if (!user.user_id) return apiError('Not authenticated');
  if (!payload.team_id) return apiError('team_id required');

  const member = findMember(payload.team_id, user.user_id);
  if (!member || member.role !== CONFIG.ROLE.LEADER) {
    return apiError('Only leader can update team');
  }

  const updates = {};
  if (payload.name) updates.name = payload.name;
  if (payload.task_creation_mode) updates.task_creation_mode = payload.task_creation_mode;

  const team = updateTeam(payload.team_id, updates);
  return apiSuccess({ team: team });
}

/**
 * Leave a team
 */
function apiLeaveTeam(user, payload) {
  if (!user.user_id) return apiError('Not authenticated');
  if (!payload.team_id) return apiError('team_id required');

  const success = removeMember(payload.team_id, user.user_id);
  return apiSuccess({ removed: success });
}

/**
 * Create a new task
 */
function apiCreateTask(user, payload) {
  if (!user.user_id) return apiError('Not authenticated');
  if (!payload.team_id) return apiError('team_id required');
  if (!payload.title) return apiError('Task title required');

  if (!canCreateTasks(payload.team_id, user.user_id)) {
    return apiError('No permission to create tasks');
  }

  const task = createTask({
    team_id: payload.team_id,
    title: payload.title,
    assignee_id: payload.assignee_id || user.user_id,
    created_by: user.user_id,
    due_date: payload.due_date ? new Date(payload.due_date) : null,
    reminder_settings: payload.reminder_settings || null
  });

  // Send notification to assignee if different from creator
  // Note: notifyTaskAssigned will be implemented in Task 8
  if (task.assignee_id !== user.user_id) {
    notifyTaskAssigned(task, user);
  }

  return apiSuccess({ task: task });
}

/**
 * Update an existing task
 */
function apiUpdateTask(user, payload) {
  if (!user.user_id) return apiError('Not authenticated');
  if (!payload.task_id) return apiError('task_id required');

  const task = findTaskById(payload.task_id);
  if (!task) return apiError('Task not found');

  // Check team membership
  const member = findMember(task.team_id, user.user_id);
  if (!member) return apiError('Not a team member');

  const oldStatus = task.status;
  const updates = {};

  if (payload.title !== undefined) updates.title = payload.title;
  if (payload.assignee_id !== undefined) updates.assignee_id = payload.assignee_id;
  if (payload.status !== undefined) updates.status = payload.status;
  if (payload.due_date !== undefined) {
    updates.due_date = payload.due_date ? new Date(payload.due_date) : null;
  }
  if (payload.reminder_settings !== undefined) {
    updates.reminder_settings = payload.reminder_settings;
  }

  const updated = updateTask(payload.task_id, updates);

  // Notify if task completed
  // Note: notifyTaskCompleted will be implemented in Task 8
  if (updates.status === CONFIG.STATUS.DONE && oldStatus !== CONFIG.STATUS.DONE) {
    notifyTaskCompleted(updated, user);
  }

  return apiSuccess({ task: updated });
}

/**
 * Delete a task
 */
function apiDeleteTask(user, payload) {
  if (!user.user_id) return apiError('Not authenticated');
  if (!payload.task_id) return apiError('task_id required');

  const task = findTaskById(payload.task_id);
  if (!task) return apiError('Task not found');

  // Check team membership
  const member = findMember(task.team_id, user.user_id);
  if (!member) return apiError('Not a team member');

  const success = deleteTask(payload.task_id);
  return apiSuccess({ deleted: success });
}
