<!-- Written and coded by OpenAI Codex. -->
# Terminal Is Your Friend

Egy egyszerű, sötét webes terminál a JavaScript és TypeScript alapjainak kipróbálására,
Péter Vívó típusbiztos pipeline-operátoros TypeScript forkjával.
A felület Tailwind CSS-t használ. Ebben az első változatban nincs AI-integráció.
A későbbi cél egy AI-oktatóval támogatott JS/TS tanulókörnyezet.

## Indítás

Node.js **22.18 vagy újabb** szükséges. A Go fordítót nem kell telepíteni:
az npm-csomag tartalmazza az adott platform natív pipeline-fordítóját.

A GitHub-repóból:

```sh
: 'Commands by OpenAI Codex.'
git clone https://github.com/Pengeszikra/terminal-is-your-friend.git
cd terminal-is-your-friend
npm ci
npm start
```

Nyisd meg: **http://localhost:5173**. Leállítás: Ctrl+C.
Más port: `PORT=5174 npm start`.

A projekt rögzítetten a `@pengeszikra/typescript@7.1.0-pipeline.1` csomagot használja.
Az optional dependencies telepítését ne tiltsd le, mert ezekben vannak a platformonkénti fordítók.
A build is ezzel a forkkal készül: az alkalmazás saját TS-forrásában is van `|>`.
Az esbuild csak az elkészült JavaScriptet csomagolja össze.

Ha a saját helyi fordítóddal próbálnád:

```sh
: 'Commands by OpenAI Codex.'
TS_PIPE_COMPILER="$HOME/repo/Typescript/built/local/tsc" npm start
```

A bináris mellett legyenek meg a fork `lib.*.d.ts` fájljai.
Az `npm start` buildel, majd elindítja a szervert. Forrásmódosítás után indítsd újra.
Egy korábban elkészített buildet az `npm run preview` új fordítás nélkül indít el.
A generált `dist/` és `.compiled/` könyvtárak nem részei a repónak.

## Használat

- **Enter:** a teljes aktuális blokk ellenőrzése, fordítása és futtatása.
- **Shift+Enter:** új sor, futtatás nélkül.
- **↑ / ↓:** előző és következő beküldés, amikor a kurzor az első/utolsó sorban áll.
- **Alt+↑ / Alt+↓:** előzményléptetés a többsoros blokk bármely sorából.
- **Tab:** két szóköz.
- **Clear:** a látható kimenet törlése; a változók megmaradnak.
- **Reset session:** a sandbox és a típusállapot újraindítása; az előzmény megmarad.

A gépelés közben a kód folyamatosan színezett. Rövid szünet után a valódi TS-fordító
ellenőriz, hiba esetén a színek vörös árnyalatúak lesznek. A hiba szövege csak Enter után jelenik meg.
Az éppen futó kód befejezéséig a szerkesztő vár; az oldal nem fagy le.
A munkamenet csak a lap élettartamáig él, nincs helyi vagy szerveroldali mentés.
Az önálló `//` megjegyzés jelenleg normál kódmegjegyzés, mert AI még nincs bekötve.

Példa első beküldés:

```ts
// Coded by OpenAI Codex.
const double = (n: number) => n * 2;
```

Következő beküldés:

```ts
// Coded by OpenAI Codex.
21 |> double
```

Eredmény: `42`. A korábbi `double` típusa is megmarad, ezért a `"hello" |> double`
fordítási hibát ad. A már végrehajtott kódot a terminál **nem futtatja újra**.
A `const`/`let` azonos nevű újradeklarálása hibás; módosítható értékhez `let` és értékadás használható.

Lánc típusváltással:

```ts
// Coded by OpenAI Codex.
[1, 2, 3]
  |> ((values: number[]) => values.map(double))
  |> ((values: number[]) => values.reduce((sum, value) => sum + value, 0))
  |> ((total: number) => `Összesen: ${total}`)
```

## Futási környezet és határok

1. A böngésző a forrást a helyi Node-szervernek küldi.
2. A szerver a natív TS-forkkal típusellenőriz és fordít. **Felhasználói JS-t nem futtat.**
3. Csak az új beküldés JavaScriptje kerül egy Web Workerben működő QuickJS WebAssembly virtuális gépbe.
4. A vendég VM a saját JavaScript-beépített objektumait és egy szűk `console` hidat kapja.

A vendég számára nincs `window`, DOM, `document`, `fetch`, `WebSocket`, `Worker`,
`localStorage`, cookie, Node `process`, `require` vagy fájlrendszer. A vendég `globalThis`
és `Function` objektumai is a QuickJS környezethez tartoznak.
Nem használunk böngészős `eval`-t, `new Function`-t vagy Node `vm`-et sandboxként.
Nincs modulbetöltő, import/export, timer vagy top-level await támogatás.
Ez az első terminál szinkron TS/JS-kísérletekre készült; nincs DOM/JSX-renderelés.

A saját `console` a `log`, `info`, `warn`, `error`, `clear` műveleteket támogatja.
A kimenet szövegként jelenik meg; HTML-t nem illesztünk be belőle.
Az objektumkiírás korlátozott mélységű, kezeli a körhivatkozást, és nem hívja meg a gettereket.

Korlátok:

- Beküldésenként 100 sor / 8 KB; a túl nagy beillesztést egészben elutasítjuk.
- Munkamenetenként 50 sikeres beküldés és összesen 100 KB forrás.
- QuickJS futási idő 2 másodperc; a böngésző 3 másodperc után a teljes workert is leállíthatja.
- QuickJS heap limit 32 MiB; ez nem a teljes böngészőfolyamat memóriahatára.
- Beküldésenként korlátozott konzolkimenet és microtask-feldolgozás.
- A fordítás 10 másodperc után megszakad; egyszerre legfeljebb két fordítás futhat.

**Fordítási hiba nem törli a változókat. Futási hiba, időtúllépés vagy memóriahiba viszont
újraindítja a sandboxot**, mert egy részben lefutott program állapota már eltérhet a TS előzményeitől.
Erről üzenet jelenik meg. A parancselőzményből a kód visszahívható, automatikus újrafuttatás nincs.
A Promise-alapú aszinkron programozás nem célja ennek a verziónak; az összes el nem kapott
Promise-rejection jelentése még nem teljes.

A HTTP-szerver alapértelmezésben kizárólag `127.0.0.1` címen figyel, ellenőrzi a Host és Origin
fejléceket, és nem enged CORS-hozzáférést. Csak a kész build fájljait szolgálja ki.
A CSP további korlát, a vendég kód izolációját maga a külön QuickJS motor adja.
Ez tesztelt POC, nem formálisan auditált biztonsági környezet. Nyilvános szolgáltatáshoz a
fordítószerver további erőforrás-korlátozást, forgalmi limitet és üzemeltetési védelmet igényel.

## Tesztek

```sh
: 'Commands by OpenAI Codex.'
npm test
```

A valódi forkkal és QuickJS-sel ellenőrzi a pipeline-láncot, az előzmények típusait, az egyszeri
végrehajtást, a fordítási/futási hibákat, az idő- és memóriahatárt, a tiltott környezeti
hozzáféréseket és a helyi HTTP API-t.

Opcionális böngészős ellenőrzés:

```sh
: 'Commands by OpenAI Codex.'
npx playwright install chromium
npm run test:browser
```

Ez billentyűzetes és mobilnézetes ellenőrzést is futtat, a képeket a `test-results/` mappába menti.
Saját Chromium binárishoz a `CHROMIUM_PATH` változó használható.

## Források

- `src/main.ts`: terminál, bevitel, előzmények, fordítás és háttérellenőrzés.
- `src/highlight.ts`: egyszerű, biztonságos szintaxisszínezés.
- `src/sandbox.ts`: QuickJS és erőforráskorlátok.
- `src/worker.ts`: a böngésző és a sandbox közötti üzenetek.
- `server/compiler.mjs`: típusállapot és natív fordítás.
- `server/index.mjs`: helyi HTTP API és statikus kiszolgálás.
- `scripts/build.mjs`: fork → JavaScript → bundle + Tailwind.

Fork: https://github.com/Pengeszikra/TypeScript

QuickJS wrapper: https://github.com/justjake/quickjs-emscripten

A saját források megjegyzésben jelölik az OpenAI Codex közreműködését.
A külső függőségekre saját licenceik vonatkoznak.
