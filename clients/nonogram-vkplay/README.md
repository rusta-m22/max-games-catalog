# Nonogram для VK Play — 3.2.3

Существующая игра «Нонограммы: Маленькие миры», 507 головоломок и 10 миров, упакованная в Windows 10/11 x64 приложение Electron. Исходный каталог MAX/Яндекс не изменяется.

**Клиент 3.2.3, 20.10.2026, готов для Test:** открытие оплаты переведено с shell-протокола на документированный GCLay `DemandBrowserForm`. Клиент проверяет наличие SDK, связь с Game Center и результат вызова. Принятый запрос больше не обозначается как уже открытая форма. [Windows CI 39461965930](https://github.com/rusta-m22/max-games-catalog/actions/runs/39461965930) прошёл: 83 Python, 28 Node, 14 UI, реальный EXE и новый addon с локальной DLL. Проверка реального Game Center и тестового начисления остаётся отдельной. [Скачать готовую сборку](https://github.com/rusta-m22/max-games-catalog/actions/runs/39461965930/artifacts/12282324110).

Точный разрешённый домен `co.vkpay.ru` из 3.2.2 сохранён вместе с `vkplay.ru`. Backend для этого изменения обновлять не нужно. Его параметр `VKPLAY_PAYMENT_HOSTS=vkplay.ru,co.vkpay.ru` должен оставаться заданным. Секреты, кошелёк, подписи callback и защита от повторного начисления не меняются.

Сохранён диалог 3.2.1 для явной новой попытки повторяемого пакета с проверкой прежнего заказа. Поздние callback сохраняются, одноразовый стартовый набор не создаёт второй неопределённый платёж. Локальные тесты используют имитацию платформы. Windows CI проверяет настоящий preview EXE и guard настроенного EXE; он не выдаётся за проверку Game Center или платежей.

GitHub Actions автоматически применяет публичные параметры существующего Miami backend и GCID 0.2046788. Исходный config.json остаётся пустым шаблоном; для ручной сборки сначала configure. Секретов в клиенте нет.

- `game/` — сохранённая игра и графика.
- `desktop/` — изолированный native-мост, сохранения через Windows DPAPI и Game Center launch guard.
- `native/` — небольшой Node-API модуль для документированных функций GCLay. DLL Game Center не включается в поставку; используется только путь из `GC_GCLAY64_PATHNAME`.
- `server/` — GAS, подписанные callback, атомарный кошелёк SQLite, защита от повторного tid; самостоятельная поставка Amvera, только Miami-0.
- `tests/` — локальные контракты, browser-сценарии с имитацией площадки, отдельный реальный Windows EXE smoke test.
- `ci/nonogram-vkplay.yml` — копия workflow, устанавливаемая в корень репозитория `.github/workflows/nonogram-vkplay.yml`.
- [Простая инструкция загрузки](docs/UPLOAD-RU.md).

## Сборка и проверки

Node.js 24 и Python 3.12. Для сборки клиента нужен Windows x64, Visual Studio 2022 Build Tools (C++ и Windows SDK). Скрипт через npm exec использует node-gyp 13.1.0 и заголовки установленной версии Electron; параметры системного HOME не меняются:

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

Итог: `dist/Nonogram-VKPlay-win-x64/` и `deliverables/Nonogram-VKPlay-Windows-x64-3.2.3.zip`. Распространять нужно весь каталог. Клиент не содержит механизмов реальных платежей вне VK Play. Game Center/overlay, реальные sandbox-транзакции и допуск на Live фиксируются отдельно в [протоколе проверки](docs/SANDBOX-CHECKLIST.md).
