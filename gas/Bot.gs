/**
 * Telegram Bot webhook handler
 */

/**
 * Handle incoming POST requests (Telegram webhook or API call)
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Check if this is an API request from frontend (has 'action' field)
    if (data.action) {
      logDebug('Bot', 'doPost_api', null, { action: data.action });
      return handleApiRequest(data);
    }

    // Otherwise it's a Telegram webhook (has 'update_id' field)
    logDebug('Bot', 'doPost_telegram', null, { update_id: data.update_id, has_message: !!data.message, has_callback: !!data.callback_query });
    handleUpdate(data);
    return ContentService.createTextOutput('OK');

  } catch (err) {
    logError('Bot', 'doPost', null, { postData: e.postData ? e.postData.contents.substring(0, 200) : 'none' }, err);

    // Return error as JSON for API requests
    const errorResponse = { ok: false, error: err.message };
    return ContentService.createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle API request from frontend
 */
function handleApiRequest(data) {
  const result = api(data.action, data.initData || '', JSON.stringify(data.payload || {}));
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
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

  logInfo('Bot', 'handleMessage', user.user_id, { chatId: chatId, text: text, username: user.username });

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
  } else {
    logDebug('Bot', 'unhandled_message', user.user_id, { text: text });
  }
}

/**
 * /start command
 */
function handleStart(chatId, user) {
  try {
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
  } catch (err) {
    logError('Bot', 'handleStart', user.user_id, { chatId: chatId }, err);
    sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
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
  try {
    const tasks = getUserTasks(user.user_id);
    const openTasks = tasks.filter(t => t.status !== CONFIG.STATUS.DONE);

    if (openTasks.length === 0) {
      sendMessage(chatId, 'У вас нет открытых задач.');
      return;
    }

    let text = `<b>Ваши задачи (${openTasks.length}):</b>\n\n`;

    openTasks.slice(0, 10).forEach((task) => {
      const team = findTeamById(task.team_id);
      if (!team) return; // Skip tasks from deleted teams
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
  } catch (err) {
    logError('Bot', 'handleMyTasks', user.user_id, { chatId: chatId }, err);
    sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
}

/**
 * /new - prompt to create task (redirect to mini app)
 */
function handleNewTask(chatId, user) {
  try {
    const teams = getUserTeams(user.user_id);

    if (teams.length === 0) {
      sendMessage(chatId, 'Сначала создайте или присоединитесь к команде.');
      return;
    }

    sendMessageWithButtons(chatId, 'Создайте задачу в приложении:', [[
      miniAppButton('Создать задачу', 'new_task')
    ]]);
  } catch (err) {
    logError('Bot', 'handleNewTask', user.user_id, { chatId: chatId }, err);
    sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
}

/**
 * /join CODE - join team by invite code
 */
function handleJoin(chatId, user, code) {
  try {
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
    logInfo('Bot', 'user_joined_team', user.user_id, { team_id: team.team_id, team_name: team.name });

    sendMessageWithButtons(chatId,
      `Вы присоединились к команде "<b>${escapeHtml(team.name)}</b>"!`, [[
      miniAppButton('Открыть TaskMini', '')
    ]]);
  } catch (err) {
    logError('Bot', 'handleJoin', user.user_id, { chatId: chatId, code: code }, err);
    sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
}

/**
 * Handle callback query (inline button press)
 */
function handleCallback(callback) {
  try {
    const chatId = callback.message.chat.id;
    const data = callback.data;
    const user = {
      user_id: String(callback.from.id),
      username: callback.from.username || '',
      display_name: callback.from.first_name + (callback.from.last_name ? ' ' + callback.from.last_name : '')
    };

    if (data === 'join_prompt') {
      sendMessage(chatId, 'Отправьте команду:\n/join КОД\n\nНапример: /join ABC123');
    }

    // Answer callback to remove loading state
    answerCallback(callback.id);
  } catch (err) {
    logError('Bot', 'handleCallback', user.user_id, { chatId: chatId, data: data }, err);
    answerCallback(callback.id);
  }
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
