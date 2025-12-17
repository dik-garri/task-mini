# TaskMini Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Telegram Mini App for church/volunteer teams to manage tasks without losing agreements in chat.

**Architecture:** Google Apps Script serves both the Mini App (HtmlService) and Telegram Bot webhook. Google Sheets stores data in 3 sheets: teams, team_members, tasks. Telegram Bot API sends notifications and reminders.

**Tech Stack:** Google Apps Script, Google Sheets API, Telegram Bot API, Telegram Web App SDK, vanilla JavaScript/HTML/CSS

---

## Phase 1: Project Foundation

### Task 1: Create Google Sheet with Data Structure

**Files:**
- Create: Google Sheet "TaskMini" (manual via Google Drive)

**Step 1: Create Google Sheet**

1. Go to https://sheets.google.com
2. Create new spreadsheet named "TaskMini"
3. Copy the Sheet ID from URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`
4. Save this ID for later configuration

**Step 2: Create sheet "teams" with headers**

Rename "Sheet1" to "teams". Add headers in row 1:

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| team_id | name | created_by | created_at | task_creation_mode | invite_code |

**Step 3: Create sheet "team_members" with headers**

Create new sheet "team_members". Add headers in row 1:

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| team_id | user_id | username | display_name | role | joined_at |

**Step 4: Create sheet "tasks" with headers**

Create new sheet "tasks". Add headers in row 1:

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| task_id | team_id | title | assignee_id | created_by | status | due_date | reminder_settings | created_at | updated_at |

**Step 5: Create sheet "sent_reminders" with headers**

Create new sheet "sent_reminders". Add headers in row 1:

| A | B | C |
|---|---|---|
| task_id | reminder_type | sent_at |

---

### Task 2: Create Telegram Bot

**Files:**
- None (Telegram BotFather)

**Step 1: Create bot via BotFather**

1. Open Telegram, find @BotFather
2. Send `/newbot`
3. Name: `TaskMini`
4. Username: `TaskMini_bot` (or available variant)
5. Save the BOT_TOKEN

**Step 2: Enable Mini App**

1. Send `/mybots` to BotFather
2. Select your bot
3. Bot Settings → Menu Button → Configure menu button
4. Set URL (will add after GAS deployment)

---

### Task 3: Create Google Apps Script Project

**Files:**
- Create: `gas/appsscript.json`
- Create: `gas/Config.gs`

**Step 1: Create Apps Script project**

1. Go to https://script.google.com
2. New Project → Name: "TaskMini"

**Step 2: Create appsscript.json**

Click Project Settings (gear icon) → Show "appsscript.json" manifest file

```json
{
  "timeZone": "Europe/Moscow",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  }
}
```

**Step 3: Create Config.gs**

Create new file `Config.gs`:

```javascript
/**
 * Configuration constants
 */
const CONFIG = {
  SHEET_ID: 'YOUR_SHEET_ID_HERE', // Replace with actual Sheet ID
  BOT_TOKEN: 'YOUR_BOT_TOKEN_HERE', // Replace with actual token

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
```

**Step 4: Test configuration**

Add temporary test function and run it:

```javascript
function testConfig() {
  const ss = getSpreadsheet();
  Logger.log('Spreadsheet name: ' + ss.getName());
  Logger.log('Teams sheet: ' + getSheet(CONFIG.SHEETS.TEAMS).getName());
  Logger.log('Generated ID: ' + generateId());
  Logger.log('Invite code: ' + generateInviteCode());
}
```

Run `testConfig` → View → Logs. Verify all outputs are correct.

**Step 5: Commit locally**

```bash
cd /Users/garrydik/projects/task-mini
mkdir -p gas
```

Create `gas/Config.gs` with the code above (replacing placeholders with actual values).

```bash
git add gas/
git commit -m "feat: add GAS project configuration"
```

---

## Phase 2: Data Layer

### Task 4: Teams CRUD Operations

**Files:**
- Create: `gas/Teams.gs`

**Step 1: Create Teams.gs with findTeamById**

```javascript
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
 * @param {string} name - team name
 * @param {string} createdBy - telegram user ID
 * @param {string} creationMode - 'all' or 'leader_only'
 * @returns {Object} created team
 */
function createTeam(name, createdBy, creationMode) {
  const sheet = getSheet(CONFIG.SHEETS.TEAMS);
  const team = {
    team_id: generateId(),
    name: name,
    created_by: createdBy,
    created_at: new Date(),
    task_creation_mode: creationMode || CONFIG.CREATION_MODE.ALL,
    invite_code: generateInviteCode()
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
 * Delete team and all related data
 * @param {string} teamId
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
```

**Step 2: Test teams operations**

```javascript
function testTeams() {
  // Create team
  const team = createTeam('Test Team', '123456', 'all');
  Logger.log('Created: ' + JSON.stringify(team));

  // Find by ID
  const found = findTeamById(team.team_id);
  Logger.log('Found by ID: ' + JSON.stringify(found));

  // Find by invite code
  const foundByCode = findTeamByInviteCode(team.invite_code);
  Logger.log('Found by code: ' + JSON.stringify(foundByCode));

  // Update
  const updated = updateTeam(team.team_id, { name: 'Updated Name' });
  Logger.log('Updated: ' + JSON.stringify(updated));

  // Delete
  deleteTeam(team.team_id);
  Logger.log('Deleted');
}
```

Run and verify in logs.

**Step 3: Commit**

```bash
git add gas/Teams.gs
git commit -m "feat: add teams CRUD operations"
```

---

### Task 5: Team Members Operations

**Files:**
- Create: `gas/Members.gs`

**Step 1: Create Members.gs**

```javascript
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
      // No members left, delete team
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
```

**Step 2: Test members operations**

```javascript
function testMembers() {
  // Create team first
  const team = createTeam('Members Test', '111', 'all');

  // Add leader
  const leader = addMember(team.team_id, {
    user_id: '111',
    username: 'leader',
    display_name: 'Leader Name'
  }, CONFIG.ROLE.LEADER);
  Logger.log('Leader: ' + JSON.stringify(leader));

  // Add member
  const member = addMember(team.team_id, {
    user_id: '222',
    username: 'member1',
    display_name: 'Member One'
  }, CONFIG.ROLE.MEMBER);
  Logger.log('Member: ' + JSON.stringify(member));

  // Get team members
  const members = getTeamMembers(team.team_id);
  Logger.log('All members: ' + JSON.stringify(members));

  // Get user teams
  const teams = getUserTeams('222');
  Logger.log('User teams: ' + JSON.stringify(teams));

  // Can create tasks
  Logger.log('Leader can create: ' + canCreateTasks(team.team_id, '111'));
  Logger.log('Member can create: ' + canCreateTasks(team.team_id, '222'));

  // Cleanup
  deleteTeam(team.team_id);
}
```

**Step 3: Commit**

```bash
git add gas/Members.gs
git commit -m "feat: add team members operations"
```

---

### Task 6: Tasks CRUD Operations

**Files:**
- Create: `gas/Tasks.gs`

**Step 1: Create Tasks.gs**

```javascript
/**
 * Tasks data operations
 */

/**
 * Find task by ID
 * @param {string} taskId
 * @returns {Object|null}
 */
function findTaskById(taskId) {
  const sheet = getSheet(CONFIG.SHEETS.TASKS);
  const data = sheet.getDataRange().getValues();

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
        reminder_settings: data[i][7] ? JSON.parse(data[i][7]) : null,
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
        reminder_settings: data[i][7] ? JSON.parse(data[i][7]) : null,
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

  for (let i = 1; i < data.length; i++) {
    const matchesUser = data[i][3] === String(userId);
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
        reminder_settings: data[i][7] ? JSON.parse(data[i][7]) : null,
        created_at: data[i][8],
        updated_at: data[i][9],
        _row: i + 1
      });
    }
  }

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
```

**Step 2: Test tasks operations**

```javascript
function testTasks() {
  // Create team and member first
  const team = createTeam('Tasks Test', '111', 'all');
  addMember(team.team_id, { user_id: '111', username: 'user1' }, CONFIG.ROLE.LEADER);
  addMember(team.team_id, { user_id: '222', username: 'user2' }, CONFIG.ROLE.MEMBER);

  // Create task
  const task = createTask({
    team_id: team.team_id,
    title: 'Test task',
    assignee_id: '222',
    created_by: '111',
    due_date: new Date(Date.now() + 86400000), // tomorrow
    reminder_settings: { before_day: true, on_day: true }
  });
  Logger.log('Created: ' + JSON.stringify(task));

  // Get team tasks
  const teamTasks = getTeamTasks(team.team_id);
  Logger.log('Team tasks: ' + JSON.stringify(teamTasks));

  // Get user tasks
  const userTasks = getUserTasks('222');
  Logger.log('User tasks: ' + JSON.stringify(userTasks));

  // Update status
  const updated = changeTaskStatus(task.task_id, CONFIG.STATUS.IN_PROGRESS);
  Logger.log('Updated status: ' + updated.status);

  // Cleanup
  deleteTeam(team.team_id);
}
```

**Step 3: Commit**

```bash
git add gas/Tasks.gs
git commit -m "feat: add tasks CRUD operations"
```

---

## Phase 3: API Layer

### Task 7: Mini App API Handler

**Files:**
- Create: `gas/Api.gs`

**Step 1: Create Api.gs**

```javascript
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
  try {
    const user = parseInitData(initData);
    const payload = payloadJson ? JSON.parse(payloadJson) : {};

    switch (action) {
      case 'ping':
        return apiSuccess({ time: new Date().toISOString(), user: user });

      case 'getMyTeams':
        return apiGetMyTeams(user);

      case 'getTeamTasks':
        return apiGetTeamTasks(user, payload);

      case 'getTeamMembers':
        return apiGetTeamMembers(user, payload);

      case 'createTeam':
        return apiCreateTeam(user, payload);

      case 'joinTeam':
        return apiJoinTeam(user, payload);

      case 'updateTeam':
        return apiUpdateTeam(user, payload);

      case 'leaveTeam':
        return apiLeaveTeam(user, payload);

      case 'createTask':
        return apiCreateTask(user, payload);

      case 'updateTask':
        return apiUpdateTask(user, payload);

      case 'deleteTask':
        return apiDeleteTask(user, payload);

      default:
        return apiError('Unknown action: ' + action);
    }
  } catch (e) {
    Logger.log('API Error: ' + e.message + '\n' + e.stack);
    return apiError(e.message);
  }
}

/**
 * Parse Telegram initData (simplified, no verification for MVP)
 */
function parseInitData(initData) {
  if (!initData) {
    return { user_id: '', username: '', display_name: 'Guest' };
  }

  try {
    const params = new URLSearchParams(initData);
    const userJson = params.get('user');
    if (userJson) {
      const user = JSON.parse(decodeURIComponent(userJson));
      return {
        user_id: String(user.id),
        username: user.username || '',
        display_name: user.first_name + (user.last_name ? ' ' + user.last_name : '')
      };
    }
  } catch (e) {
    Logger.log('Parse initData error: ' + e.message);
  }

  return { user_id: '', username: '', display_name: 'Guest' };
}

function apiSuccess(data) {
  return { ok: true, ...data };
}

function apiError(message) {
  return { ok: false, error: message };
}

// --- API Methods ---

function apiGetMyTeams(user) {
  if (!user.user_id) return apiError('Not authenticated');
  const teams = getUserTeams(user.user_id);
  return apiSuccess({ teams: teams });
}

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

function apiGetTeamMembers(user, payload) {
  if (!user.user_id) return apiError('Not authenticated');
  if (!payload.team_id) return apiError('team_id required');

  const member = findMember(payload.team_id, user.user_id);
  if (!member) return apiError('Not a team member');

  const members = getTeamMembers(payload.team_id);
  return apiSuccess({ members: members });
}

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

function apiJoinTeam(user, payload) {
  if (!user.user_id) return apiError('Not authenticated');
  if (!payload.invite_code) return apiError('Invite code required');

  const team = findTeamByInviteCode(payload.invite_code.toUpperCase());
  if (!team) return apiError('Team not found');

  const member = addMember(team.team_id, user, CONFIG.ROLE.MEMBER);

  return apiSuccess({ team: team, member: member });
}

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

function apiLeaveTeam(user, payload) {
  if (!user.user_id) return apiError('Not authenticated');
  if (!payload.team_id) return apiError('team_id required');

  const success = removeMember(payload.team_id, user.user_id);
  return apiSuccess({ removed: success });
}

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
  if (task.assignee_id !== user.user_id) {
    notifyTaskAssigned(task, user);
  }

  return apiSuccess({ task: task });
}

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
  if (updates.status === CONFIG.STATUS.DONE && oldStatus !== CONFIG.STATUS.DONE) {
    notifyTaskCompleted(updated, user);
  }

  return apiSuccess({ task: updated });
}

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
```

**Step 2: Test API**

```javascript
function testApi() {
  // Simulate initData
  const fakeInitData = 'user=' + encodeURIComponent(JSON.stringify({
    id: 123456,
    username: 'testuser',
    first_name: 'Test',
    last_name: 'User'
  }));

  // Test ping
  let result = api('ping', fakeInitData, '{}');
  Logger.log('Ping: ' + JSON.stringify(result));

  // Create team
  result = api('createTeam', fakeInitData, JSON.stringify({
    name: 'API Test Team',
    task_creation_mode: 'all'
  }));
  Logger.log('Create team: ' + JSON.stringify(result));
  const teamId = result.team.team_id;

  // Get my teams
  result = api('getMyTeams', fakeInitData, '{}');
  Logger.log('My teams: ' + JSON.stringify(result));

  // Create task
  result = api('createTask', fakeInitData, JSON.stringify({
    team_id: teamId,
    title: 'Test task from API'
  }));
  Logger.log('Create task: ' + JSON.stringify(result));

  // Get team tasks
  result = api('getTeamTasks', fakeInitData, JSON.stringify({ team_id: teamId }));
  Logger.log('Team tasks: ' + JSON.stringify(result));

  // Cleanup
  deleteTeam(teamId);
}
```

**Step 3: Commit**

```bash
git add gas/Api.gs
git commit -m "feat: add Mini App API handler"
```

---

### Task 8: Telegram Bot Notifications

**Files:**
- Create: `gas/Telegram.gs`

**Step 1: Create Telegram.gs**

```javascript
/**
 * Telegram Bot API helpers
 */

const TELEGRAM_API = 'https://api.telegram.org/bot' + CONFIG.BOT_TOKEN;

/**
 * Send message to user
 * @param {string} chatId - Telegram chat/user ID
 * @param {string} text - Message text
 * @param {Object} options - Additional options (parse_mode, reply_markup)
 */
function sendMessage(chatId, text, options) {
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    ...options
  };

  const response = UrlFetchApp.fetch(TELEGRAM_API + '/sendMessage', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const result = JSON.parse(response.getContentText());
  if (!result.ok) {
    Logger.log('Telegram error: ' + JSON.stringify(result));
  }
  return result;
}

/**
 * Send message with inline keyboard
 */
function sendMessageWithButtons(chatId, text, buttons) {
  return sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: buttons
    }
  });
}

/**
 * Create Mini App button
 */
function miniAppButton(text, startParam) {
  const webAppUrl = getWebAppUrl();
  return {
    text: text,
    web_app: { url: webAppUrl + (startParam ? '?start=' + startParam : '') }
  };
}

/**
 * Get deployed web app URL
 */
function getWebAppUrl() {
  return ScriptApp.getService().getUrl();
}

// --- Notification functions ---

/**
 * Notify user about assigned task
 */
function notifyTaskAssigned(task, creator) {
  const team = findTeamById(task.team_id);
  const text = `📋 <b>Новая задача</b>\n\n` +
    `"${escapeHtml(task.title)}"\n\n` +
    `Команда: ${escapeHtml(team.name)}\n` +
    (task.due_date ? `Срок: ${formatDate(task.due_date)}\n` : '') +
    `От: ${escapeHtml(creator.display_name)}`;

  sendMessageWithButtons(task.assignee_id, text, [[
    miniAppButton('Открыть задачу', 'task_' + task.task_id)
  ]]);
}

/**
 * Notify creator that task is completed
 */
function notifyTaskCompleted(task, completedBy) {
  if (task.created_by === completedBy.user_id) return; // Don't notify self

  const team = findTeamById(task.team_id);
  const text = `✅ <b>Задача выполнена</b>\n\n` +
    `"${escapeHtml(task.title)}"\n\n` +
    `Команда: ${escapeHtml(team.name)}\n` +
    `Выполнил: ${escapeHtml(completedBy.display_name)}`;

  sendMessage(task.created_by, text);
}

/**
 * Send task reminder
 */
function sendReminder(task, reminderType) {
  const team = findTeamById(task.team_id);

  let timeText = '';
  if (reminderType === 'before_day') {
    timeText = 'Срок: завтра';
  } else if (reminderType === 'on_day') {
    timeText = 'Срок: сегодня';
  } else {
    timeText = 'Срок: ' + formatDate(task.due_date);
  }

  const text = `🔔 <b>Напоминание</b>\n\n` +
    `"${escapeHtml(task.title)}"\n\n` +
    `Команда: ${escapeHtml(team.name)}\n` +
    timeText;

  sendMessageWithButtons(task.assignee_id, text, [[
    miniAppButton('Открыть задачу', 'task_' + task.task_id)
  ]]);
}

// --- Helpers ---

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const day = d.getDate();
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн',
                  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return day + ' ' + months[d.getMonth()];
}
```

**Step 2: Test notifications (manual)**

```javascript
function testTelegram() {
  // Replace with your actual Telegram user ID
  const myUserId = 'YOUR_TELEGRAM_ID';

  sendMessage(myUserId, '<b>Test</b> message from TaskMini');

  sendMessageWithButtons(myUserId, 'Test with button', [[
    { text: 'Open Google', url: 'https://google.com' }
  ]]);
}
```

**Step 3: Commit**

```bash
git add gas/Telegram.gs
git commit -m "feat: add Telegram notifications"
```

---

## Phase 4: Bot Webhook

### Task 9: Bot Command Handler

**Files:**
- Create: `gas/Bot.gs`

**Step 1: Create Bot.gs**

```javascript
/**
 * Telegram Bot webhook handler
 */

/**
 * Handle incoming webhook from Telegram
 */
function doPost(e) {
  try {
    const update = JSON.parse(e.postData.contents);
    handleUpdate(update);
  } catch (err) {
    Logger.log('doPost error: ' + err.message);
  }

  return ContentService.createTextOutput('OK');
}

/**
 * Process Telegram update
 */
function handleUpdate(update) {
  if (update.message) {
    handleMessage(update.message);
  } else if (update.callback_query) {
    handleCallback(update.callback_query);
  }
}

/**
 * Handle text message
 */
function handleMessage(message) {
  const chatId = message.chat.id;
  const text = message.text || '';
  const user = {
    user_id: String(message.from.id),
    username: message.from.username || '',
    display_name: message.from.first_name + (message.from.last_name ? ' ' + message.from.last_name : '')
  };

  // Check for deep link start parameter
  if (text.startsWith('/start ')) {
    const param = text.substring(7).trim();
    handleStartWithParam(chatId, user, param);
    return;
  }

  // Handle commands
  if (text === '/start') {
    handleStart(chatId, user);
  } else if (text === '/my') {
    handleMyTasks(chatId, user);
  } else if (text === '/new') {
    handleNewTask(chatId, user);
  } else if (text.startsWith('/join ')) {
    const code = text.substring(6).trim();
    handleJoin(chatId, user, code);
  }
}

/**
 * /start command
 */
function handleStart(chatId, user) {
  const teams = getUserTeams(user.user_id);

  let text;
  if (teams.length === 0) {
    text = `Добро пожаловать в <b>TaskMini</b>!\n\n` +
      `Простой помощник для командных задач.\n\n` +
      `Создайте команду или присоединитесь по приглашению.`;
  } else {
    text = `С возвращением!\n\n` +
      `У вас ${teams.length} команд(ы).\n` +
      `Откройте TaskMini для управления задачами.`;
  }

  sendMessageWithButtons(chatId, text, [
    [miniAppButton('Открыть TaskMini', '')],
    [{ text: 'Присоединиться по коду', callback_data: 'join_prompt' }]
  ]);
}

/**
 * /start with invite code (deep link)
 */
function handleStartWithParam(chatId, user, param) {
  // Check if it's an invite code
  if (param.length === 6) {
    handleJoin(chatId, user, param);
    return;
  }

  // Otherwise just show start
  handleStart(chatId, user);
}

/**
 * /my - list my tasks
 */
function handleMyTasks(chatId, user) {
  const tasks = getUserTasks(user.user_id);
  const openTasks = tasks.filter(t => t.status !== CONFIG.STATUS.DONE);

  if (openTasks.length === 0) {
    sendMessage(chatId, 'У вас нет открытых задач.');
    return;
  }

  let text = `<b>Ваши задачи (${openTasks.length}):</b>\n\n`;

  openTasks.slice(0, 10).forEach((task, i) => {
    const team = findTeamById(task.team_id);
    const statusIcon = task.status === CONFIG.STATUS.IN_PROGRESS ? '🔄' : '⏳';
    const dueText = task.due_date ? ` (${formatDate(task.due_date)})` : '';
    text += `${statusIcon} ${escapeHtml(task.title)}${dueText}\n`;
    text += `   <i>${escapeHtml(team.name)}</i>\n\n`;
  });

  if (openTasks.length > 10) {
    text += `... и ещё ${openTasks.length - 10}`;
  }

  sendMessageWithButtons(chatId, text, [[
    miniAppButton('Все задачи', '')
  ]]);
}

/**
 * /new - prompt to create task (redirect to mini app)
 */
function handleNewTask(chatId, user) {
  const teams = getUserTeams(user.user_id);

  if (teams.length === 0) {
    sendMessage(chatId, 'Сначала создайте или присоединитесь к команде.');
    return;
  }

  sendMessageWithButtons(chatId, 'Создайте задачу в приложении:', [[
    miniAppButton('Создать задачу', 'new_task')
  ]]);
}

/**
 * /join CODE - join team by invite code
 */
function handleJoin(chatId, user, code) {
  const team = findTeamByInviteCode(code.toUpperCase());

  if (!team) {
    sendMessage(chatId, 'Команда не найдена. Проверьте код приглашения.');
    return;
  }

  // Check if already member
  const existing = findMember(team.team_id, user.user_id);
  if (existing) {
    sendMessageWithButtons(chatId,
      `Вы уже в команде "${escapeHtml(team.name)}"`, [[
      miniAppButton('Открыть', '')
    ]]);
    return;
  }

  // Add member
  addMember(team.team_id, user, CONFIG.ROLE.MEMBER);

  sendMessageWithButtons(chatId,
    `Вы присоединились к команде "<b>${escapeHtml(team.name)}</b>"!`, [[
    miniAppButton('Открыть TaskMini', '')
  ]]);
}

/**
 * Handle callback query (inline button press)
 */
function handleCallback(callback) {
  const chatId = callback.message.chat.id;
  const data = callback.data;
  const user = {
    user_id: String(callback.from.id),
    username: callback.from.username || '',
    display_name: callback.from.first_name
  };

  if (data === 'join_prompt') {
    sendMessage(chatId, 'Отправьте команду:\n/join КОД\n\nНапример: /join ABC123');
  }

  // Answer callback to remove loading state
  answerCallback(callback.id);
}

/**
 * Answer callback query
 */
function answerCallback(callbackId, text) {
  UrlFetchApp.fetch(TELEGRAM_API + '/answerCallbackQuery', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      callback_query_id: callbackId,
      text: text || ''
    }),
    muteHttpExceptions: true
  });
}

/**
 * Set webhook URL (run once after deployment)
 */
function setWebhook() {
  const webhookUrl = ScriptApp.getService().getUrl();

  const response = UrlFetchApp.fetch(TELEGRAM_API + '/setWebhook', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ url: webhookUrl })
  });

  Logger.log('setWebhook response: ' + response.getContentText());
}

/**
 * Remove webhook (for debugging)
 */
function deleteWebhook() {
  const response = UrlFetchApp.fetch(TELEGRAM_API + '/deleteWebhook');
  Logger.log('deleteWebhook response: ' + response.getContentText());
}
```

**Step 2: Commit**

```bash
git add gas/Bot.gs
git commit -m "feat: add Telegram bot webhook handler"
```

---

## Phase 5: Mini App UI

### Task 10: Mini App HTML Structure

**Files:**
- Create: `gas/index.html`

**Step 1: Create index.html with base structure**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>TaskMini</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    :root {
      --bg-color: #ffffff;
      --text-color: #000000;
      --secondary-text: #666666;
      --border-color: #e0e0e0;
      --primary-color: #2481cc;
      --success-color: #31b545;
      --warning-color: #f5a623;
      --danger-color: #e53935;
      --card-bg: #f5f5f5;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg-color: #1c1c1d;
        --text-color: #ffffff;
        --secondary-text: #8e8e93;
        --border-color: #3a3a3c;
        --card-bg: #2c2c2e;
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-color);
      color: var(--text-color);
      min-height: 100vh;
      padding-bottom: 70px;
    }

    /* Header */
    .header {
      position: sticky;
      top: 0;
      background: var(--bg-color);
      border-bottom: 1px solid var(--border-color);
      padding: 12px 16px;
      z-index: 100;
    }

    .header-title {
      font-size: 17px;
      font-weight: 600;
      text-align: center;
    }

    .team-selector {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 8px 0;
      cursor: pointer;
    }

    .team-selector-name {
      font-size: 15px;
      font-weight: 500;
    }

    .team-selector-arrow {
      font-size: 12px;
      color: var(--secondary-text);
    }

    /* Tabs */
    .tabs {
      display: flex;
      border-bottom: 1px solid var(--border-color);
    }

    .tab {
      flex: 1;
      padding: 12px;
      text-align: center;
      font-size: 14px;
      color: var(--secondary-text);
      border: none;
      background: none;
      cursor: pointer;
    }

    .tab.active {
      color: var(--primary-color);
      border-bottom: 2px solid var(--primary-color);
      margin-bottom: -1px;
    }

    /* Task list */
    .task-list {
      padding: 8px 16px;
    }

    .task-group-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--secondary-text);
      text-transform: uppercase;
      padding: 16px 0 8px;
    }

    .task-card {
      background: var(--card-bg);
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 8px;
      cursor: pointer;
    }

    .task-title {
      font-size: 15px;
      font-weight: 500;
      margin-bottom: 6px;
    }

    .task-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 13px;
      color: var(--secondary-text);
    }

    .task-assignee {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .task-due {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .task-due.overdue {
      color: var(--danger-color);
    }

    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 500;
    }

    .status-open { background: var(--warning-color); color: #000; }
    .status-in_progress { background: var(--primary-color); color: #fff; }
    .status-done { background: var(--success-color); color: #fff; }

    /* Bottom nav */
    .bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: var(--bg-color);
      border-top: 1px solid var(--border-color);
      display: flex;
      padding: 8px 16px;
      padding-bottom: max(8px, env(safe-area-inset-bottom));
    }

    .nav-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 8px;
      border: none;
      background: none;
      color: var(--secondary-text);
      cursor: pointer;
      font-size: 11px;
    }

    .nav-btn.active {
      color: var(--primary-color);
    }

    .nav-btn-icon {
      font-size: 20px;
    }

    .add-btn {
      background: var(--primary-color);
      color: #fff;
      border-radius: 50%;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      margin-top: -16px;
    }

    /* Empty state */
    .empty-state {
      text-align: center;
      padding: 48px 24px;
      color: var(--secondary-text);
    }

    .empty-state-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .empty-state-title {
      font-size: 17px;
      font-weight: 500;
      color: var(--text-color);
      margin-bottom: 8px;
    }

    /* Modal */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 200;
    }

    .modal-overlay.active {
      display: flex;
      align-items: flex-end;
    }

    .modal {
      background: var(--bg-color);
      border-radius: 16px 16px 0 0;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      padding: 16px;
      padding-bottom: max(16px, env(safe-area-inset-bottom));
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .modal-title {
      font-size: 17px;
      font-weight: 600;
    }

    .modal-close {
      font-size: 24px;
      background: none;
      border: none;
      color: var(--secondary-text);
      cursor: pointer;
    }

    /* Form */
    .form-group {
      margin-bottom: 16px;
    }

    .form-label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: var(--secondary-text);
      margin-bottom: 6px;
    }

    .form-input {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      font-size: 15px;
      background: var(--bg-color);
      color: var(--text-color);
    }

    .form-select {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      font-size: 15px;
      background: var(--bg-color);
      color: var(--text-color);
    }

    .btn {
      width: 100%;
      padding: 14px;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-primary {
      background: var(--primary-color);
      color: #fff;
    }

    .btn-danger {
      background: var(--danger-color);
      color: #fff;
    }

    /* Loading */
    .loading {
      text-align: center;
      padding: 48px;
      color: var(--secondary-text);
    }

    /* Screen management */
    .screen {
      display: none;
    }

    .screen.active {
      display: block;
    }

    /* Team list (for selector) */
    .team-list-item {
      padding: 12px;
      border-bottom: 1px solid var(--border-color);
      cursor: pointer;
    }

    .team-list-item:hover {
      background: var(--card-bg);
    }

    .team-list-item-name {
      font-size: 15px;
      font-weight: 500;
    }

    .team-list-item-role {
      font-size: 13px;
      color: var(--secondary-text);
    }
  </style>
</head>
<body>
  <!-- Main Screen -->
  <div id="screen-main" class="screen active">
    <div class="header">
      <div class="team-selector" onclick="showTeamSelector()">
        <span class="team-selector-name" id="current-team-name">Загрузка...</span>
        <span class="team-selector-arrow">▼</span>
      </div>
      <div class="tabs">
        <button class="tab active" data-filter="my" onclick="setFilter('my')">Мои</button>
        <button class="tab" data-filter="all" onclick="setFilter('all')">Все</button>
      </div>
    </div>

    <div id="task-list" class="task-list">
      <div class="loading">Загрузка...</div>
    </div>

    <div class="bottom-nav">
      <button class="nav-btn active">
        <span class="nav-btn-icon">📋</span>
        Задачи
      </button>
      <button class="add-btn" onclick="showCreateTask()">+</button>
      <button class="nav-btn" onclick="showTeamSettings()">
        <span class="nav-btn-icon">⚙️</span>
        Команда
      </button>
    </div>
  </div>

  <!-- No Teams Screen -->
  <div id="screen-no-teams" class="screen">
    <div class="empty-state">
      <div class="empty-state-icon">👥</div>
      <div class="empty-state-title">Нет команд</div>
      <p>Создайте команду или присоединитесь по приглашению</p>
      <br>
      <button class="btn btn-primary" onclick="showCreateTeam()">Создать команду</button>
      <br><br>
      <button class="btn" style="background: var(--card-bg)" onclick="showJoinTeam()">Присоединиться</button>
    </div>
  </div>

  <!-- Team Selector Modal -->
  <div id="modal-team-selector" class="modal-overlay" onclick="closeModal(event)">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <span class="modal-title">Выберите команду</span>
        <button class="modal-close" onclick="hideTeamSelector()">×</button>
      </div>
      <div id="team-list"></div>
      <br>
      <button class="btn btn-primary" onclick="showCreateTeam()">+ Создать команду</button>
    </div>
  </div>

  <!-- Create Task Modal -->
  <div id="modal-create-task" class="modal-overlay" onclick="closeModal(event)">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <span class="modal-title">Новая задача</span>
        <button class="modal-close" onclick="hideCreateTask()">×</button>
      </div>
      <form onsubmit="submitCreateTask(event)">
        <div class="form-group">
          <label class="form-label">Задача</label>
          <input type="text" class="form-input" id="task-title" placeholder="Что нужно сделать?" required>
        </div>
        <div class="form-group">
          <label class="form-label">Исполнитель</label>
          <select class="form-select" id="task-assignee"></select>
        </div>
        <div class="form-group">
          <label class="form-label">Срок (опционально)</label>
          <input type="date" class="form-input" id="task-due-date">
        </div>
        <div class="form-group" id="reminder-group" style="display:none">
          <label class="form-label">Напоминание</label>
          <select class="form-select" id="task-reminder">
            <option value="">Без напоминания</option>
            <option value="before_day">За день до срока</option>
            <option value="on_day">В день срока</option>
            <option value="both">За день и в день срока</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary">Создать</button>
      </form>
    </div>
  </div>

  <!-- Create Team Modal -->
  <div id="modal-create-team" class="modal-overlay" onclick="closeModal(event)">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <span class="modal-title">Новая команда</span>
        <button class="modal-close" onclick="hideCreateTeam()">×</button>
      </div>
      <form onsubmit="submitCreateTeam(event)">
        <div class="form-group">
          <label class="form-label">Название команды</label>
          <input type="text" class="form-input" id="team-name" placeholder="Например: Прославление" required>
        </div>
        <div class="form-group">
          <label class="form-label">Кто может создавать задачи?</label>
          <select class="form-select" id="team-creation-mode">
            <option value="all">Все участники</option>
            <option value="leader_only">Только я (лидер)</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary">Создать</button>
      </form>
    </div>
  </div>

  <!-- Join Team Modal -->
  <div id="modal-join-team" class="modal-overlay" onclick="closeModal(event)">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <span class="modal-title">Присоединиться</span>
        <button class="modal-close" onclick="hideJoinTeam()">×</button>
      </div>
      <form onsubmit="submitJoinTeam(event)">
        <div class="form-group">
          <label class="form-label">Код приглашения</label>
          <input type="text" class="form-input" id="invite-code" placeholder="ABC123" maxlength="6" required style="text-transform: uppercase">
        </div>
        <button type="submit" class="btn btn-primary">Присоединиться</button>
      </form>
    </div>
  </div>

  <!-- Task Detail Modal -->
  <div id="modal-task-detail" class="modal-overlay" onclick="closeModal(event)">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <span class="modal-title">Задача</span>
        <button class="modal-close" onclick="hideTaskDetail()">×</button>
      </div>
      <div id="task-detail-content"></div>
    </div>
  </div>

  <!-- Team Settings Modal -->
  <div id="modal-team-settings" class="modal-overlay" onclick="closeModal(event)">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <span class="modal-title">Настройки команды</span>
        <button class="modal-close" onclick="hideTeamSettings()">×</button>
      </div>
      <div id="team-settings-content"></div>
    </div>
  </div>

  <script>
    // Will be continued in next task
  </script>
</body>
</html>
```

**Step 2: Commit**

```bash
git add gas/index.html
git commit -m "feat: add Mini App HTML structure and styles"
```

---

### Task 11: Mini App JavaScript Logic

**Files:**
- Modify: `gas/index.html` (add script section)

**Step 1: Add JavaScript to index.html**

Add inside the `<script>` tag:

```javascript
// Initialize Telegram Web App
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Get initData for API calls
const initData = tg.initData || '';

// State
let currentTeam = null;
let teams = [];
let tasks = [];
let members = [];
let currentFilter = 'my';
let currentUserId = tg.initDataUnsafe?.user?.id || '';

// API wrapper
function api(action, payload) {
  return new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler(resolve)
      .withFailureHandler(reject)
      .api(action, initData, JSON.stringify(payload || {}));
  });
}

// Initialize app
async function init() {
  try {
    const result = await api('getMyTeams');
    if (!result.ok) {
      showError(result.error);
      return;
    }

    teams = result.teams;

    if (teams.length === 0) {
      showScreen('no-teams');
    } else {
      currentTeam = teams[0];
      showScreen('main');
      await loadTeamData();
    }
  } catch (e) {
    showError('Ошибка загрузки: ' + e.message);
  }
}

// Load team tasks and members
async function loadTeamData() {
  if (!currentTeam) return;

  document.getElementById('current-team-name').textContent = currentTeam.name;
  document.getElementById('task-list').innerHTML = '<div class="loading">Загрузка...</div>';

  try {
    const [tasksResult, membersResult] = await Promise.all([
      api('getTeamTasks', { team_id: currentTeam.team_id }),
      api('getTeamMembers', { team_id: currentTeam.team_id })
    ]);

    if (tasksResult.ok) tasks = tasksResult.tasks;
    if (membersResult.ok) members = membersResult.members;

    renderTasks();
    updateAssigneeSelect();
  } catch (e) {
    showError('Ошибка загрузки задач');
  }
}

// Render task list
function renderTasks() {
  const container = document.getElementById('task-list');

  let filtered = tasks;
  if (currentFilter === 'my') {
    filtered = tasks.filter(t => t.assignee_id === String(currentUserId));
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <div class="empty-state-title">Нет задач</div>
        <p>${currentFilter === 'my' ? 'У вас нет назначенных задач' : 'В команде пока нет задач'}</p>
      </div>
    `;
    return;
  }

  // Group by status
  const open = filtered.filter(t => t.status === 'open');
  const inProgress = filtered.filter(t => t.status === 'in_progress');
  const done = filtered.filter(t => t.status === 'done');

  let html = '';

  if (open.length > 0) {
    html += '<div class="task-group-title">Открытые</div>';
    html += open.map(renderTaskCard).join('');
  }

  if (inProgress.length > 0) {
    html += '<div class="task-group-title">В работе</div>';
    html += inProgress.map(renderTaskCard).join('');
  }

  if (done.length > 0) {
    html += '<div class="task-group-title">Выполненные</div>';
    html += done.map(renderTaskCard).join('');
  }

  container.innerHTML = html;
}

// Render single task card
function renderTaskCard(task) {
  const assignee = task.assignee || { display_name: 'Не назначено' };
  const dueClass = task.due_date && new Date(task.due_date) < new Date() ? 'overdue' : '';
  const dueText = task.due_date ? formatDate(task.due_date) : '';

  return `
    <div class="task-card" onclick="showTaskDetail('${task.task_id}')">
      <div class="task-title">${escapeHtml(task.title)}</div>
      <div class="task-meta">
        <span class="status-badge status-${task.status}">${getStatusText(task.status)}</span>
        <span class="task-assignee">👤 ${escapeHtml(assignee.display_name)}</span>
        ${dueText ? `<span class="task-due ${dueClass}">📅 ${dueText}</span>` : ''}
      </div>
    </div>
  `;
}

// Filter tasks
function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.filter === filter);
  });
  renderTasks();
}

// Show/hide screens
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
}

// Modal helpers
function closeModal(event) {
  if (event.target.classList.contains('modal-overlay')) {
    event.target.classList.remove('active');
  }
}

function showModal(id) {
  document.getElementById(id).classList.add('active');
}

function hideModal(id) {
  document.getElementById(id).classList.remove('active');
}

// Team selector
function showTeamSelector() {
  const container = document.getElementById('team-list');
  container.innerHTML = teams.map(team => `
    <div class="team-list-item" onclick="selectTeam('${team.team_id}')">
      <div class="team-list-item-name">${escapeHtml(team.name)}</div>
      <div class="team-list-item-role">${team.my_role === 'leader' ? 'Лидер' : 'Участник'}</div>
    </div>
  `).join('');
  showModal('modal-team-selector');
}

function hideTeamSelector() {
  hideModal('modal-team-selector');
}

async function selectTeam(teamId) {
  currentTeam = teams.find(t => t.team_id === teamId);
  hideTeamSelector();
  await loadTeamData();
}

// Create task
function showCreateTask() {
  document.getElementById('task-title').value = '';
  document.getElementById('task-due-date').value = '';
  document.getElementById('task-reminder').value = '';
  document.getElementById('reminder-group').style.display = 'none';
  showModal('modal-create-task');
}

function hideCreateTask() {
  hideModal('modal-create-task');
}

function updateAssigneeSelect() {
  const select = document.getElementById('task-assignee');
  select.innerHTML = members.map(m =>
    `<option value="${m.user_id}" ${m.user_id === String(currentUserId) ? 'selected' : ''}>
      ${escapeHtml(m.display_name)}${m.user_id === String(currentUserId) ? ' (я)' : ''}
    </option>`
  ).join('');
}

// Show/hide reminder based on due date
document.getElementById('task-due-date')?.addEventListener('change', function() {
  document.getElementById('reminder-group').style.display = this.value ? 'block' : 'none';
});

async function submitCreateTask(event) {
  event.preventDefault();

  const title = document.getElementById('task-title').value.trim();
  const assigneeId = document.getElementById('task-assignee').value;
  const dueDate = document.getElementById('task-due-date').value;
  const reminder = document.getElementById('task-reminder').value;

  let reminderSettings = null;
  if (dueDate && reminder) {
    reminderSettings = {
      before_day: reminder === 'before_day' || reminder === 'both',
      on_day: reminder === 'on_day' || reminder === 'both'
    };
  }

  try {
    const result = await api('createTask', {
      team_id: currentTeam.team_id,
      title: title,
      assignee_id: assigneeId,
      due_date: dueDate || null,
      reminder_settings: reminderSettings
    });

    if (result.ok) {
      hideCreateTask();
      await loadTeamData();
      tg.showAlert('Задача создана');
    } else {
      tg.showAlert(result.error);
    }
  } catch (e) {
    tg.showAlert('Ошибка: ' + e.message);
  }
}

// Create team
function showCreateTeam() {
  hideTeamSelector();
  document.getElementById('team-name').value = '';
  showModal('modal-create-team');
}

function hideCreateTeam() {
  hideModal('modal-create-team');
}

async function submitCreateTeam(event) {
  event.preventDefault();

  const name = document.getElementById('team-name').value.trim();
  const mode = document.getElementById('team-creation-mode').value;

  try {
    const result = await api('createTeam', {
      name: name,
      task_creation_mode: mode
    });

    if (result.ok) {
      hideCreateTeam();
      teams.push({ ...result.team, my_role: 'leader' });
      currentTeam = result.team;
      showScreen('main');
      await loadTeamData();

      // Show invite code
      tg.showAlert('Команда создана!\n\nКод приглашения: ' + result.team.invite_code);
    } else {
      tg.showAlert(result.error);
    }
  } catch (e) {
    tg.showAlert('Ошибка: ' + e.message);
  }
}

// Join team
function showJoinTeam() {
  document.getElementById('invite-code').value = '';
  showModal('modal-join-team');
}

function hideJoinTeam() {
  hideModal('modal-join-team');
}

async function submitJoinTeam(event) {
  event.preventDefault();

  const code = document.getElementById('invite-code').value.trim().toUpperCase();

  try {
    const result = await api('joinTeam', { invite_code: code });

    if (result.ok) {
      hideJoinTeam();
      teams.push({ ...result.team, my_role: 'member' });
      currentTeam = result.team;
      showScreen('main');
      await loadTeamData();
      tg.showAlert('Вы присоединились к команде "' + result.team.name + '"');
    } else {
      tg.showAlert(result.error);
    }
  } catch (e) {
    tg.showAlert('Ошибка: ' + e.message);
  }
}

// Task detail
function showTaskDetail(taskId) {
  const task = tasks.find(t => t.task_id === taskId);
  if (!task) return;

  const assignee = task.assignee || { display_name: 'Не назначено' };
  const creator = task.creator || { display_name: 'Неизвестно' };
  const dueText = task.due_date ? formatDate(task.due_date) : 'Не указан';

  const isMyTask = task.assignee_id === String(currentUserId);

  let statusButtons = '';
  if (task.status === 'open') {
    statusButtons = `<button class="btn btn-primary" onclick="changeStatus('${task.task_id}', 'in_progress')">Взять в работу</button>`;
  } else if (task.status === 'in_progress') {
    statusButtons = `<button class="btn btn-primary" onclick="changeStatus('${task.task_id}', 'done')">Выполнено</button>`;
  }

  document.getElementById('task-detail-content').innerHTML = `
    <h3 style="margin-bottom: 16px">${escapeHtml(task.title)}</h3>
    <p><b>Статус:</b> <span class="status-badge status-${task.status}">${getStatusText(task.status)}</span></p>
    <p><b>Исполнитель:</b> ${escapeHtml(assignee.display_name)}</p>
    <p><b>Срок:</b> ${dueText}</p>
    <p><b>Создал:</b> ${escapeHtml(creator.display_name)}</p>
    <br>
    ${statusButtons}
    <br><br>
    <button class="btn btn-danger" onclick="confirmDeleteTask('${task.task_id}')">Удалить</button>
  `;

  showModal('modal-task-detail');
}

function hideTaskDetail() {
  hideModal('modal-task-detail');
}

async function changeStatus(taskId, newStatus) {
  try {
    const result = await api('updateTask', {
      task_id: taskId,
      status: newStatus
    });

    if (result.ok) {
      hideTaskDetail();
      await loadTeamData();
    } else {
      tg.showAlert(result.error);
    }
  } catch (e) {
    tg.showAlert('Ошибка: ' + e.message);
  }
}

function confirmDeleteTask(taskId) {
  tg.showConfirm('Удалить задачу?', async (confirmed) => {
    if (confirmed) {
      try {
        const result = await api('deleteTask', { task_id: taskId });
        if (result.ok) {
          hideTaskDetail();
          await loadTeamData();
        } else {
          tg.showAlert(result.error);
        }
      } catch (e) {
        tg.showAlert('Ошибка: ' + e.message);
      }
    }
  });
}

// Team settings
function showTeamSettings() {
  if (!currentTeam) return;

  const isLeader = currentTeam.my_role === 'leader';
  const membersHtml = members.map(m => `
    <div style="padding: 8px 0; border-bottom: 1px solid var(--border-color)">
      ${escapeHtml(m.display_name)} ${m.username ? '(@' + m.username + ')' : ''}
      <span style="color: var(--secondary-text)">${m.role === 'leader' ? '👑' : ''}</span>
    </div>
  `).join('');

  document.getElementById('team-settings-content').innerHTML = `
    <p><b>Код приглашения:</b> ${currentTeam.invite_code}</p>
    <p><b>Ссылка:</b></p>
    <input class="form-input" readonly value="t.me/${tg.initDataUnsafe?.bot?.username || 'TaskMiniBot'}?start=${currentTeam.invite_code}" onclick="this.select()">
    <br><br>
    <p><b>Участники (${members.length}):</b></p>
    ${membersHtml}
    <br>
    <button class="btn btn-danger" onclick="confirmLeaveTeam()">Покинуть команду</button>
  `;

  showModal('modal-team-settings');
}

function hideTeamSettings() {
  hideModal('modal-team-settings');
}

function confirmLeaveTeam() {
  tg.showConfirm('Покинуть команду "' + currentTeam.name + '"?', async (confirmed) => {
    if (confirmed) {
      try {
        const result = await api('leaveTeam', { team_id: currentTeam.team_id });
        if (result.ok) {
          teams = teams.filter(t => t.team_id !== currentTeam.team_id);
          hideTeamSettings();
          if (teams.length === 0) {
            currentTeam = null;
            showScreen('no-teams');
          } else {
            currentTeam = teams[0];
            await loadTeamData();
          }
        } else {
          tg.showAlert(result.error);
        }
      } catch (e) {
        tg.showAlert('Ошибка: ' + e.message);
      }
    }
  });
}

// Helpers
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(date) {
  const d = new Date(date);
  const day = d.getDate();
  const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return day + ' ' + months[d.getMonth()];
}

function getStatusText(status) {
  const texts = {
    'open': 'Открыта',
    'in_progress': 'В работе',
    'done': 'Выполнена'
  };
  return texts[status] || status;
}

function showError(message) {
  tg.showAlert(message || 'Произошла ошибка');
}

// Start app
init();
```

**Step 2: Commit**

```bash
git add gas/index.html
git commit -m "feat: add Mini App JavaScript logic"
```

---

## Phase 6: Reminders

### Task 12: Reminder Trigger System

**Files:**
- Create: `gas/Triggers.gs`

**Step 1: Create Triggers.gs**

```javascript
/**
 * Reminder trigger system
 */

/**
 * Process reminders - called by time trigger every 15 minutes
 */
function processReminders() {
  const sheet = getSheet(CONFIG.SHEETS.TASKS);
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);

  for (let i = 1; i < data.length; i++) {
    const task = {
      task_id: data[i][0],
      team_id: data[i][1],
      title: data[i][2],
      assignee_id: data[i][3],
      status: data[i][5],
      due_date: data[i][6],
      reminder_settings: data[i][7] ? JSON.parse(data[i][7]) : null
    };

    // Skip completed tasks or tasks without due date/reminders
    if (task.status === CONFIG.STATUS.DONE) continue;
    if (!task.due_date || !task.reminder_settings) continue;

    const dueDate = new Date(task.due_date);
    const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

    // Check "before_day" reminder (day before due date)
    if (task.reminder_settings.before_day) {
      const reminderDate = new Date(dueDateOnly.getTime() - 86400000);
      if (isSameDay(today, reminderDate)) {
        if (!wasReminderSent(task.task_id, 'before_day')) {
          sendReminder(task, 'before_day');
          markReminderSent(task.task_id, 'before_day');
        }
      }
    }

    // Check "on_day" reminder (on due date)
    if (task.reminder_settings.on_day) {
      if (isSameDay(today, dueDateOnly)) {
        if (!wasReminderSent(task.task_id, 'on_day')) {
          sendReminder(task, 'on_day');
          markReminderSent(task.task_id, 'on_day');
        }
      }
    }
  }
}

/**
 * Check if two dates are the same day
 */
function isSameDay(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

/**
 * Check if reminder was already sent
 */
function wasReminderSent(taskId, reminderType) {
  const sheet = getSheet(CONFIG.SHEETS.REMINDERS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === taskId && data[i][1] === reminderType) {
      return true;
    }
  }
  return false;
}

/**
 * Mark reminder as sent
 */
function markReminderSent(taskId, reminderType) {
  const sheet = getSheet(CONFIG.SHEETS.REMINDERS);
  sheet.appendRow([taskId, reminderType, new Date()]);
}

/**
 * Set up time trigger (run once)
 */
function setupReminderTrigger() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'processReminders') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create new trigger - every 15 minutes
  ScriptApp.newTrigger('processReminders')
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log('Reminder trigger created');
}

/**
 * Clean old reminder records (run weekly)
 */
function cleanOldReminders() {
  const sheet = getSheet(CONFIG.SHEETS.REMINDERS);
  const data = sheet.getDataRange().getValues();
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  for (let i = data.length - 1; i >= 1; i--) {
    if (new Date(data[i][2]) < weekAgo) {
      sheet.deleteRow(i + 1);
    }
  }
}
```

**Step 2: Commit**

```bash
git add gas/Triggers.gs
git commit -m "feat: add reminder trigger system"
```

---

## Phase 7: Web App Entry Point

### Task 13: doGet Handler for Mini App

**Files:**
- Create: `gas/Web.gs`

**Step 1: Create Web.gs**

```javascript
/**
 * Web app entry point
 */

/**
 * Serve Mini App HTML
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('TaskMini')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

**Step 2: Commit**

```bash
git add gas/Web.gs
git commit -m "feat: add web app entry point"
```

---

## Phase 8: Deployment

### Task 14: Deploy and Configure

**Files:**
- None (Google Apps Script UI)

**Step 1: Copy all .gs files to Apps Script**

Copy contents of each file from `gas/` folder to Apps Script editor:
- Config.gs
- Teams.gs
- Members.gs
- Tasks.gs
- Api.gs
- Telegram.gs
- Bot.gs
- Triggers.gs
- Web.gs
- index.html

**Step 2: Set Script Properties**

1. Project Settings → Script Properties
2. Add `SHEET_ID` = your Google Sheet ID
3. Add `BOT_TOKEN` = your Telegram bot token (from BotFather)

Update `Config.gs` to use Script Properties:

```javascript
const CONFIG = {
  SHEET_ID: PropertiesService.getScriptProperties().getProperty('SHEET_ID'),
  BOT_TOKEN: PropertiesService.getScriptProperties().getProperty('BOT_TOKEN'),
  // ... rest stays the same
};
```

**Step 3: Deploy as Web App**

1. Deploy → New deployment
2. Type: Web app
3. Execute as: Me
4. Who has access: Anyone
5. Deploy → Copy URL

**Step 4: Set Telegram Webhook**

Run `setWebhook()` function in Apps Script.

**Step 5: Configure Mini App in BotFather**

1. @BotFather → /mybots → Your bot
2. Bot Settings → Menu Button → Configure menu button
3. URL: paste deployment URL
4. Button text: "TaskMini"

**Step 6: Set up Reminder Trigger**

Run `setupReminderTrigger()` function in Apps Script.

**Step 7: Test**

1. Open bot in Telegram
2. Send /start
3. Create team
4. Create task
5. Verify notifications work

**Step 8: Final commit**

```bash
git add -A
git commit -m "docs: add deployment instructions"
```

---

## Summary

Total tasks: 14
Estimated implementation time: 4-6 hours

### File Structure

```
task-mini/
├── docs/plans/
│   ├── 2024-12-17-taskmini-design.md
│   └── 2024-12-17-taskmini-implementation.md
└── gas/
    ├── appsscript.json
    ├── Config.gs
    ├── Teams.gs
    ├── Members.gs
    ├── Tasks.gs
    ├── Api.gs
    ├── Telegram.gs
    ├── Bot.gs
    ├── Triggers.gs
    ├── Web.gs
    └── index.html
```

### Key Dependencies

- Google Apps Script
- Google Sheets API
- Telegram Bot API
- Telegram Web App SDK
