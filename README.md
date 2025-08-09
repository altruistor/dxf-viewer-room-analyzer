# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

# DXF Viewer

Веб-приложение для импорта, парсинга и отображения DXF файлов в браузере.

## 🚀 Возможности

- **Загрузка DXF файлов** - Поддержка drag & drop и выбора файлов
- **Парсинг DXF** - Использование библиотеки dxf-parser
- **Визуальное отображение** - Рендеринг чертежей на HTML5 Canvas
- **Навигация по чертежу**:
  - 🔍 Масштабирование (кнопки, колесо мыши, клавиши +/-)
  - 🖱️ Панорамирование (перетаскивание мышью, кнопки, стрелки/WASD)
  - 🏠 Сброс вида (кнопка "домик", клавиша 0)
- **Управление слоями** - Включение/выключение видимости отдельных слоев
- **Просмотр содержимого** - Отображение заголовков, объектов и блоков
- **Адаптивный дизайн** - Работает на мобильных устройствах и планшетах
- **Обработка ошибок** - Информативные сообщения об ошибках

## 🛠️ Технологии

- **React 18** - Пользовательский интерфейс
- **TypeScript** - Типизация и безопасность кода
- **Vite** - Быстрая сборка и разработка
- **dxf-parser** - Парсинг DXF файлов
- **CSS3** - Современные стили и анимации

## 📦 Установка и запуск

### Предварительные требования

- Node.js (версия 18 или выше)
- npm или yarn

### Установка зависимостей

```bash
npm install
```

### Запуск в режиме разработки

```bash
npm run dev
```

Приложение будет доступно по адресу [http://localhost:5173](http://localhost:5173)

### Сборка для продакшна

```bash
npm run build
```

### Предварительный просмотр сборки

```bash
npm run preview
```

## 📁 Структура проекта

```
src/
├── components/          # React компоненты
│   ├── FileUpload.tsx   # Компонент загрузки файлов
│   ├── FileUpload.css   # Стили для загрузки
│   ├── DXFViewer.tsx    # Компонент отображения DXF
│   └── DXFViewer.css    # Стили для просмотра
├── services/            # Бизнес логика
│   └── dxfService.ts    # Сервис для работы с DXF
├── types/               # TypeScript типы
│   └── dxf.ts          # Типы для DXF данных
├── App.tsx             # Главный компонент
├── App.css             # Стили приложения
├── main.tsx            # Точка входа
└── index.css           # Глобальные стили
```

## 🔧 Использование

1. **Загрузка файла**: Перетащите DXF файл в область загрузки или нажмите для выбора
2. **Парсинг**: Приложение автоматически парсит загруженный файл
3. **Просмотр чертежа**:
   - 🖼️ Вкладка "Просмотр чертежа" - визуальное отображение
   - 📋 Вкладка "Детали файла" - техническая информация
4. **Навигация**:
   - **Масштабирование**: Колесо мыши, кнопки 🔍+/🔍-, клавиши +/-
   - **Панорамирование**: Перетаскивание мышью, кнопки ⬆️⬇️⬅️➡️, стрелки или WASD
   - **Сброс вида**: Кнопка ⌂, клавиша 0 или Home
5. **Управление слоями**:
   - Кнопка "📋 Слои" открывает панель управления
   - Галочки рядом с названиями слоев включают/выключают их видимость
   - Кнопка "👁️ Показать/Скрыть все" управляет всеми слоями сразу
   - Цветные кружки показывают цвет каждого слоя
6. **Новый файл**: Используйте кнопку "Загрузить другой файл" для работы с новым DXF

### ⌨️ Горячие клавиши

- **W, A, S, D** или **стрелки** - панорамирование
- **+ / -** - масштабирование
- **0** или **Home** - сброс вида

## 📝 Поддерживаемые форматы

- `.dxf` - Drawing Exchange Format файлы
- Поддержка различных версий DXF формата

## 🤝 Развитие проекта

Планы на развитие:

- [x] Визуальное отображение DXF чертежей на Canvas
- [x] Масштабирование и навигация по чертежу
- [x] Управление видимостью слоев
- [ ] Измерительные инструменты (расстояния, углы)
- [ ] Экспорт в другие форматы (PNG, SVG, PDF)
- [ ] Поддержка больших файлов с виртуализацией
- [ ] Темная тема
- [ ] Информация о координатах курсора
- [ ] Поиск и выделение объектов
- [ ] Печать чертежей

## 📄 Лицензия

MIT License

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default tseslint.config([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs["recommended-typescript"],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```
