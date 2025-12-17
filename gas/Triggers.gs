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
