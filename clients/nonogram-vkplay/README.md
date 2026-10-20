# Nonogram для VK Play — 3.2.1

Существующая игра «Нонограммы: Маленькие миры», 507 головоломок и 10 миров, упакованная в Windows 10/11 x64 приложение Electron. Исходный каталог MAX/Яндекс не изменяется.

**Состояние 20.10.2026:** клиент 3.2.0 установлен и запускается в VK Play Test, backend 3.2.2 работает в Amvera Miami. Кабинет настроен на тестовые платежи. Открытие checkout и фактическое начисление VK Play ещё не подтверждены: сервер отклоняет формат или домен полученной ссылки (`payment_url_not_allowed`). Диагностика backend 3.2.3 сохраняет только безопасные метаданные ссылки, не расширяя допуск хостов.

Клиент 3.2.1 добавляет явную новую попытку для зависшего повторяемого пакета монет. Сначала проверяется прежний заказ; если он уже оплачен, новый не создаётся. Старые заказы сохраняются для поздних callback. Для одноразового стартового набора второй неопределённый заказ не создаётся. Отмена, обновление баланса и перезапуск не начинают оплату автоматически.

GitHub Actions проверяет preview EXE на Windows, затем автоматически собирает отдельный настроенный клиент для GCID 0.2046788 и существующего Miami backend. Параметры можно переопределить через Variables. Исходный config.json остаётся пустым шаблоном: для ручной сборки сначала выполните configure. Секретов в клиенте нет.

- `game/` — сохранённая игра и графика.
- `desktop/` — изолированный native-мост, сохранения через Windows DPAPI и Game Center launch guard.
- `server/` — GAS, подписанные callback, атомарный кошелёк SQLite, защита от повторного tid; самостоятельная поставка Amvera, только Miami-0.
- `tests/` — локальные контракты, browser-сценарии с имитацией площадки, отдельный реальный Windows EXE smoke test.
- `ci/nonogram-vkplay.yml` — копия workflow, устанавливаемая в корень репозитория `.github/workflows/nonogram-vkplay.yml`.
- [Простая инструкция загрузки](docs/UPLOAD-RU.md).

## Сборка и проверки

Node.js 24 и Python 3.12:

```sh
npm ci
npm test
npx playwright install chromium --only-shell
npm run test:ui
npm run build:win
python3 tools/package.py
```

На Windows вместо python3 можно использовать python. Настоящий Windows-прогон: `npm run test:native` после сборки. На Linux этот тест не объявляется пройденным.

Публичные параметры задаются через `npm run configure -- --backend https://YOUR-BACKEND/ --gcid 0.YOURID`, после чего нужно заново выполнить сборку. Секрет API остаётся только на сервере. `npm run upload:test` по умолчанию выполняет dry-run; `python3 tools/upload-test.py --execute` загружает настроенную сборку на Test при наличии защищённого VKPLAY_BUILD_TOKEN.

Итог: `dist/Nonogram-VKPlay-win-x64/` и `deliverables/Nonogram-VKPlay-Windows-x64-3.2.1.zip`. Распространять нужно весь каталог. Клиент не содержит механизмов реальных платежей вне VK Play. Game Center/overlay, реальные sandbox-транзакции и допуск на Live фиксируются отдельно в [протоколе проверки](docs/SANDBOX-CHECKLIST.md).
