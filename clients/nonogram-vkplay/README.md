# Nonogram для VK Play — 3.2.2

Существующая игра «Нонограммы: Маленькие миры», 507 головоломок и 10 миров, упакованная в Windows 10/11 x64 приложение Electron. Исходный каталог MAX/Яндекс не изменяется.

**Состояние 20.10.2026:** действующий backend 3.2.3 работает в Amvera Miami. Журнал установил точный отказ: площадка возвращает HTTPS-адрес оплаты `co.vkpay.ru`, а прежняя проверка разрешала только vkplay.ru. Клиент 3.2.2 и defaults backend 3.2.4 добавляют только этот точный домен; HTTPS, порт и запрет встроенных учётных данных сохранены.

На работающем backend 3.2.3 достаточно задать `VKPLAY_PAYMENT_HOSTS=vkplay.ru,co.vkpay.ru` и перезапустить приложение; обновлять код для этого необязательно. Клиент 3.2.2 нужно заново загрузить в Test и обновить через Game Center. Фактическое открытие overlay и тестовое начисление VK Play ещё не подтверждены.

Сохранён диалог 3.2.1 для явной новой попытки повторяемого пакета с проверкой прежнего заказа. Поздние callback сохраняются, одноразовый стартовый набор не создаёт второй неопределённый платёж. Локальные тесты используют имитацию платформы. Windows CI проверяет настоящий preview EXE и guard настроенного EXE; он не выдаётся за проверку Game Center или платежей.

GitHub Actions автоматически применяет публичные параметры существующего Miami backend и GCID 0.2046788. Исходный config.json остаётся пустым шаблоном; для ручной сборки сначала configure. Секретов в клиенте нет.

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

Итог: `dist/Nonogram-VKPlay-win-x64/` и `deliverables/Nonogram-VKPlay-Windows-x64-3.2.2.zip`. Распространять нужно весь каталог. Клиент не содержит механизмов реальных платежей вне VK Play. Game Center/overlay, реальные sandbox-транзакции и допуск на Live фиксируются отдельно в [протоколе проверки](docs/SANDBOX-CHECKLIST.md).
