/**
 * Tasks data operations
 */

/**
 * Safely parse JSON string
 * @param {string} jsonString
 * @returns {Object|null}
 */
function safeJsonParse(jsonString) {
  if (!jsonString) return null;
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    Logger.log('JSON parse error: ' + e.message);
    return null;
  }
}

/**
 * Find task by ID
 * @param {string} taskId
 * @returns {Object|null}
 */
function findTaskById(taskId) {
  const sheet = getSheet(CONFIG.SHEETS.TASKS);
  const data = sheet.getDataRange().getValues();

  // Check for empty sheet (only header or empty)
  if (data.length <= 1) {
    return null;
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === taskId) {
      return {
        task_id: data[i][0],
        team_id: data[i][1],
        title: data[i][2],
        assignee_id: data[i][3],
        created_by: data[i][4],
        status: data[i][5],
        due_date: data[i][6],
        reminder_settings: safeJsonParse(data[i][7]),
        created_at: data[i][8],
        updated_at: data[i][9],
        _row: i + 1
      };
    }
  }
  return null;
}

/**
 * Get all tasks for a team
 * @param {string} teamId
 * @returns {Array}
 */
function getTeamTasks(teamId) {
  const sheet = getSheet(CONFIG.SHEETS.TASKS);
  const data = sheet.getDataRange().getValues();
  const tasks = [];

  // Check for empty sheet (only header or empty)
  if (data.length <= 1) {
    return tasks;
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === teamId) {
      tasks.push({
        task_id: data[i][0],
        team_id: data[i][1],
        title: data[i][2],
        assignee_id: data[i][3],
        created_by: data[i][4],
        status: data[i][5],
        due_date: data[i][6],
        reminder_settings: safeJsonParse(data[i][7]),
        created_at: data[i][8],
        updated_at: data[i][9],
        _row: i + 1
      });
    }
  }

  // Sort: by due_date (nulls last), then by created_at
  tasks.sort((a, b) => {
    if (a.due_date && b.due_date) {
      return new Date(a.due_date) - new Date(b.due_date);
    }
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return new Date(a.created_at) - new Date(b.created_at);
  });

  return tasks;
}

/**
 * Get tasks assigned to user
 * @param {string} userId
 * @param {string} teamId - optional, filter by team
 * @returns {Array}
 */
function getUserTasks(userId, teamId) {
  const sheet = getSheet(CONFIG.SHEETS.TASKS);
  const data = sheet.getDataRange().getValues();
  const tasks = [];

  // Check for empty sheet (only header or empty)
  if (data.length <= 1) {
    return tasks;
  }

  for (let i = 1; i < data.length; i++) {
    const matchesUser = String(data[i][3]) === String(userId);
    const matchesTeam = !teamId || data[i][1] === teamId;

    if (matchesUser && matchesTeam) {
      tasks.push({
        task_id: data[i][0],
        team_id: data[i][1],
        title: data[i][2],
        assignee_id: data[i][3],
        created_by: data[i][4],
        status: data[i][5],
        due_date: data[i][6],
        reminder_settings: safeJsonParse(data[i][7]),
        created_at: data[i][8],
        updated_at: data[i][9],
        _row: i + 1
      });
    }
  }

  // Sort: by due_date (nulls last), then by created_at
  tasks.sort((a, b) => {
    if (a.due_date && b.due_date) {
      return new Date(a.due_date) - new Date(b.due_date);
    }
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return new Date(a.created_at) - new Date(b.created_at);
  });

  return tasks;
}

/**
 * Create new task
 * @param {Object} taskData
 * @returns {Object} created task
 */
function createTask(taskData) {
  const sheet = getSheet(CONFIG.SHEETS.TASKS);
  const now = new Date();

  const task = {
    task_id: generateId(),
    team_id: taskData.team_id,
    title: taskData.title,
    assignee_id: String(taskData.assignee_id),
    created_by: String(taskData.created_by),
    status: CONFIG.STATUS.OPEN,
    due_date: taskData.due_date || null,
    reminder_settings: taskData.reminder_settings || null,
    created_at: now,
    updated_at: now
  };

  sheet.appendRow([
    task.task_id,
    task.team_id,
    task.title,
    task.assignee_id,
    task.created_by,
    task.status,
    task.due_date,
    task.reminder_settings ? JSON.stringify(task.reminder_settings) : '',
    task.created_at,
    task.updated_at
  ]);

  return task;
}

/**
 * Update task
 * @param {string} taskId
 * @param {Object} updates
 * @returns {Object|null}
 */
function updateTask(taskId, updates) {
  const task = findTaskById(taskId);
  if (!task) return null;

  const sheet = getSheet(CONFIG.SHEETS.TASKS);
  const row = task._row;

  if (updates.title !== undefined) {
    sheet.getRange(row, 3).setValue(updates.title);
  }
  if (updates.assignee_id !== undefined) {
    sheet.getRange(row, 4).setValue(String(updates.assignee_id));
  }
  if (updates.status !== undefined) {
    sheet.getRange(row, 6).setValue(updates.status);
  }
  if (updates.due_date !== undefined) {
    sheet.getRange(row, 7).setValue(updates.due_date);
  }
  if (updates.reminder_settings !== undefined) {
    sheet.getRange(row, 8).setValue(
      updates.reminder_settings ? JSON.stringify(updates.reminder_settings) : ''
    );
  }

  // Update timestamp
  sheet.getRange(row, 10).setValue(new Date());

  return findTaskById(taskId);
}

/**
 * Delete task
 * @param {string} taskId
 * @returns {boolean}
 */
function deleteTask(taskId) {
  const task = findTaskById(taskId);
  if (!task) return false;

  const sheet = getSheet(CONFIG.SHEETS.TASKS);
  sheet.deleteRow(task._row);
  return true;
}

/**
 * Change task status
 * @param {string} taskId
 * @param {string} newStatus
 * @returns {Object|null}
 */
function changeTaskStatus(taskId, newStatus) {
  return updateTask(taskId, { status: newStatus });
}
