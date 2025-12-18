# TaskMini

Простой Telegram Mini App для управления задачами в церковных и волонтёрских командах.

## Возможности

- Создание команд с приглашением по коду
- Назначение задач участникам команды
- Три статуса задач: Открыта → В работе → Выполнена
- Напоминания о задачах (за день и в день срока)
- Уведомления о новых задачах и выполнении
- Тёмная и светлая тема
- Backend на Google Apps Script (бесплатно)
- Frontend на GitHub Pages (бесплатно)

## Архитектура

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  Telegram App   │ ──── │  GitHub Pages    │ ──── │  Google Apps    │
│  (Mini App SDK) │      │  (Frontend)      │      │  Script (API)   │
└─────────────────┘      └──────────────────┘      └─────────────────┘
                                                            │
                                                   ┌────────┴────────┐
                                                   │  Google Sheets  │
                                                   │  (Database)     │
                                                   └─────────────────┘
```

> **Почему GitHub Pages?** Google Apps Script размещает HTML в iframe на `googleusercontent.com`, что блокирует доступ к `Telegram.WebApp.initData`. GitHub Pages работает напрямую без iframe, поэтому Telegram SDK функционирует корректно.

## Технологии

- Google Apps Script (backend API)
- Google Sheets (база данных)
- GitHub Pages (frontend hosting)
- Telegram Bot API
- Telegram Web App SDK

## Структура проекта

```
gas/                        - Google Apps Script (backend)
├── appsscript.json         - Manifest файл
├── Config.gs               - Конфигурация и константы
├── Teams.gs                - CRUD операции для команд
├── Members.gs              - Операции с участниками
├── Tasks.gs                - CRUD операции для задач
├── Api.gs                  - API обработчик
├── Telegram.gs             - Уведомления через Telegram
├── Bot.gs                  - Webhook и API endpoint
├── Triggers.gs             - Система напоминаний
└── index.html              - Legacy версия (не используется)

docs/                       - GitHub Pages (frontend)
├── index.html              - Mini App интерфейс
└── config.js               - Конфигурация API URL
```

## Деплой

### Шаг 1: Создай Google Sheet

1. Открой https://sheets.google.com
2. Создай новую таблицу **"TaskMini"**
3. Скопируй **SHEET_ID** из URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`

> Листы и заголовки создадутся автоматически при запуске `setupSheets()` в Шаге 4

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
5. В разделе **Script Properties** добавь:
   - `SHEET_ID` → ID таблицы из Шага 1
   - `BOT_TOKEN` → токен бота из Шага 2
6. Скопируй содержимое всех файлов из папки `gas/`:
   - Замени содержимое `appsscript.json`
   - Создай файлы: `Config.gs`, `Teams.gs`, `Members.gs`, `Tasks.gs`, `Api.gs`, `Telegram.gs`, `Bot.gs`, `Triggers.gs`, `Web.gs`
   - Создай HTML файл: `index.html`

### Шаг 4: Настрой листы в таблице

1. В Apps Script выбери функцию `setupSheets` в выпадающем списке
2. Нажми **Run**
3. Разреши доступ если попросит
4. Проверь логи (View → Logs) — должно быть `Setup complete!`
5. Открой Google Sheet — должны появиться 4 листа с заголовками

> Можно также запустить `testConfig` чтобы проверить что SHEET_ID и BOT_TOKEN настроены правильно

### Шаг 5: Деплой Backend (Google Apps Script)

1. В Apps Script нажми **Deploy → New deployment**
2. Нажми шестерёнку рядом с "Select type" → выбери **Web app**
3. Настройки:
   - Description: `TaskMini v1`
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Нажми **Deploy**
5. Скопируй **Web app URL** (понадобится для Шага 6 и 7)

### Шаг 6: Настрой Webhook бота

1. В Apps Script открой файл `Bot.gs`
2. Выбери функцию `setWebhook` в выпадающем списке
3. Нажми **Run**
4. Разреши доступ если попросит
5. Проверь логи (View → Logs) — должно быть `"ok": true`

### Шаг 7: Деплой Frontend (GitHub Pages)

1. Создай репозиторий на GitHub (или используй существующий)
2. Загрузи папку `docs/` в репозиторий
3. Открой файл `docs/config.js` и замени `YOUR_DEPLOYMENT_ID`:
   - Если URL из Шага 5 выглядит как `https://script.google.com/macros/s/ABC123.../exec`
   - То `ABC123...` — это твой DEPLOYMENT_ID
4. Зайди в **Settings → Pages** в репозитории
5. Под **Source** выбери **Deploy from a branch**
6. Выбери branch `main` и folder `/docs`
7. Нажми **Save**
8. Подожди 1-2 минуты пока сайт задеплоится
9. URL будет: `https://USERNAME.github.io/REPO_NAME/`

### Шаг 8: Настрой Mini App в BotFather

1. Открой @BotFather в Telegram
2. Отправь `/mybots`
3. Выбери своего бота
4. **Bot Settings → Menu Button → Configure menu button**
5. Отправь URL из Шага 7 (GitHub Pages URL, НЕ Google Apps Script!)
6. Отправь текст кнопки: `TaskMini`

### Шаг 9: Включи напоминания

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
