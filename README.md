# TaskMini

Простой Telegram Mini App для управления задачами в церковных и волонтёрских командах.

## Возможности

- Создание команд с приглашением по коду
- Назначение задач участникам команды
- Три статуса задач: Открыта → В работе → Выполнена
- Напоминания о задачах (за день и в день срока)
- Уведомления о новых задачах и выполнении
- Тёмная и светлая тема
- Работает полностью на Google Apps Script (бесплатно)

## Технологии

- Google Apps Script
- Google Sheets (база данных)
- Telegram Bot API
- Telegram Web App SDK

## Структура проекта

```
gas/
├── appsscript.json    - Manifest файл
├── Config.gs          - Конфигурация и константы
├── Teams.gs           - CRUD операции для команд
├── Members.gs         - Операции с участниками
├── Tasks.gs           - CRUD операции для задач
├── Api.gs             - API для Mini App
├── Telegram.gs        - Уведомления через Telegram
├── Bot.gs             - Webhook обработчик бота
├── Triggers.gs        - Система напоминаний
├── Web.gs             - Entry point для Web App
└── index.html         - Mini App интерфейс
```

## Деплой

### Шаг 1: Создай Google Sheet

1. Открой https://sheets.google.com
2. Создай новую таблицу **"TaskMini"**
3. Создай 4 листа с заголовками:

**Лист `teams`:**
| team_id | name | created_by | created_at | task_creation_mode | invite_code |
|---------|------|------------|------------|-------------------|-------------|

**Лист `team_members`:**
| team_id | user_id | username | display_name | role | joined_at |
|---------|---------|----------|--------------|------|-----------|

**Лист `tasks`:**
| task_id | team_id | title | assignee_id | created_by | status | due_date | reminder_settings | created_at | updated_at |
|---------|---------|-------|-------------|------------|--------|----------|-------------------|------------|------------|

**Лист `sent_reminders`:**
| task_id | reminder_type | sent_at |
|---------|---------------|---------|

4. Скопируй **SHEET_ID** из URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`

### Шаг 2: Создай Telegram Bot

1. Открой @BotFather в Telegram
2. Отправь `/newbot`
3. Введи имя бота: **TaskMini**
4. Введи username бота (должен заканчиваться на `_bot`)
5. Сохрани **BOT_TOKEN**

### Шаг 3: Создай Google Apps Script проект

1. Открой https://script.google.com
2. **New Project** → назови **"TaskMini"**
3. Нажми на шестерёнку (Project Settings)
4. Включи **"Show appsscript.json manifest file in editor"**
5. Скопируй содержимое всех файлов из папки `gas/`:
   - Замени содержимое `appsscript.json`
   - Создай файлы: `Config.gs`, `Teams.gs`, `Members.gs`, `Tasks.gs`, `Api.gs`, `Telegram.gs`, `Bot.gs`, `Triggers.gs`, `Web.gs`
   - Создай HTML файл: `index.html`

6. В файле `Config.gs` замени плейсхолдеры на реальные значения:
```javascript
SHEET_ID: 'ТВОЙ_SHEET_ID_ИЗ_ШАГА_1',
BOT_TOKEN: 'ТВОЙ_BOT_TOKEN_ИЗ_ШАГА_2',
```

### Шаг 4: Деплой Web App

1. В Apps Script нажми **Deploy → New deployment**
2. Нажми шестерёнку рядом с "Select type" → выбери **Web app**
3. Настройки:
   - Description: `TaskMini v1`
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Нажми **Deploy**
5. Скопируй **Web app URL**

### Шаг 5: Настрой Webhook бота

1. В Apps Script открой файл `Bot.gs`
2. Выбери функцию `setWebhook` в выпадающем списке
3. Нажми **Run**
4. Разреши доступ если попросит
5. Проверь логи (View → Logs) — должно быть `"ok": true`

### Шаг 6: Настрой Mini App в BotFather

1. Открой @BotFather в Telegram
2. Отправь `/mybots`
3. Выбери своего бота
4. **Bot Settings → Menu Button → Configure menu button**
5. Отправь URL из Шага 4
6. Отправь текст кнопки: `TaskMini`

### Шаг 7: Включи напоминания

1. В Apps Script выбери функцию `setupReminderTrigger`
2. Нажми **Run**
3. Это создаст триггер, который каждые 15 минут проверяет и отправляет напоминания

## Готово!

Открой своего бота в Telegram и отправь `/start`

## Команды бота

| Команда | Описание |
|---------|----------|
| `/start` | Приветствие и открытие Mini App |
| `/my` | Список моих задач |
| `/new` | Создать задачу |
| `/join CODE` | Присоединиться к команде по коду |

## Документация

- [Дизайн-документ](docs/plans/2024-12-17-taskmini-design.md)
- [План реализации](docs/plans/2024-12-17-taskmini-implementation.md)

## Лицензия

MIT
