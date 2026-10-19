# Nonogram для VK Play — 3.2.0

Существующая игра «Нонограммы: Маленькие миры», 507 головоломок и 10 миров, упакованная в Windows 10/11 x64 приложение Electron. Исходный каталог MAX/Яндекс не изменяется.

**Публикация пока заблокирована подключением проекта.** Без реальных GMRID, GCID, HTTPS-backend и каталога клиент работает через Preview.cmd без платежей. Наличие кода интеграции не означает успешную проверку VK Play.

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

Итог: `dist/Nonogram-VKPlay-win-x64/` и `deliverables/Nonogram-VKPlay-Windows-x64-3.2.0.zip`. Распространять нужно весь каталог. Клиент не содержит механизмов реальных платежей вне VK Play. Game Center/overlay, реальные sandbox-транзакции и допуск на Live фиксируются отдельно в [протоколе проверки](docs/SANDBOX-CHECKLIST.md).
