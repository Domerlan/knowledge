# Portal (Three.js + GLSL) — package

## Что внутри
- GLSL-портал (ShaderMaterial)
- GPU-частицы наружу (THREE.Points + ShaderMaterial)
- Текст NoHack на troika-three-text с двумя слоями молний (Inner/Outer), молния бежит по контуру

## Установка зависимостей
```bash
npm i three troika-three-text
```

## Подключение (пример)
Смотри `src/index.example.js`.

## Важно
Для “бегущей по контуру” молнии у материала текста включены производные:
`material.extensions = { derivatives: true }`

Если у вас постпроцессинг — рекомендуется добавить Bloom (например UnrealBloomPass), это сильно усиливает вау-эффект.
