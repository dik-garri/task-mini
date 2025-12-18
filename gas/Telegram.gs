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
    logError('Telegram', 'sendMessage', chatId, { text_preview: text.substring(0, 50) }, result.description || JSON.stringify(result));
  } else {
    logDebug('Telegram', 'sendMessage', chatId, { text_preview: text.substring(0, 50) });
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
  try {
    const team = findTeamById(task.team_id);
    if (!team) {
      logWarn('Telegram', 'notifyTaskAssigned', task.assignee_id, { task_id: task.task_id, error: 'Team not found' });
      return;
    }
    logInfo('Telegram', 'notifyTaskAssigned', task.assignee_id, { task_id: task.task_id, team_id: task.team_id });

    const text = `📋 <b>Новая задача</b>\n\n` +
      `"${escapeHtml(task.title)}"\n\n` +
      `Команда: ${escapeHtml(team.name)}\n` +
      (task.due_date ? `Срок: ${formatDate(task.due_date)}\n` : '') +
      `От: ${escapeHtml(creator.display_name)}`;

    sendMessageWithButtons(task.assignee_id, text, [[
      miniAppButton('Открыть задачу', 'task_' + task.task_id)
    ]]);
  } catch (e) {
    logError('Telegram', 'notifyTaskAssigned', task.assignee_id, { task_id: task.task_id }, e);
  }
}

/**
 * Notify creator that task is completed
 */
function notifyTaskCompleted(task, completedBy) {
  try {
    if (task.created_by === completedBy.user_id) return; // Don't notify self

    const team = findTeamById(task.team_id);
    if (!team) {
      logWarn('Telegram', 'notifyTaskCompleted', task.created_by, { task_id: task.task_id, error: 'Team not found' });
      return;
    }
    logInfo('Telegram', 'notifyTaskCompleted', task.created_by, { task_id: task.task_id, completed_by: completedBy.user_id });

    const text = `✅ <b>Задача выполнена</b>\n\n` +
      `"${escapeHtml(task.title)}"\n\n` +
      `Команда: ${escapeHtml(team.name)}\n` +
      `Выполнил: ${escapeHtml(completedBy.display_name)}`;

    sendMessage(task.created_by, text);
  } catch (e) {
    logError('Telegram', 'notifyTaskCompleted', task.created_by, { task_id: task.task_id }, e);
  }
}

/**
 * Send task reminder
 */
function sendReminder(task, reminderType) {
  try {
    const team = findTeamById(task.team_id);
    if (!team) {
      logWarn('Telegram', 'sendReminder', task.assignee_id, { task_id: task.task_id, error: 'Team not found' });
      return;
    }

    logInfo('Telegram', 'sendReminder', task.assignee_id, { task_id: task.task_id, reminder_type: reminderType });

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
  } catch (e) {
    logError('Telegram', 'sendReminder', task.assignee_id, { task_id: task.task_id }, e);
  }
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
