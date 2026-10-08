# React ルール（overlay）

React / JSX プロジェクトにのみ適用する overlay。typescript.md（core）への**追加**と**明示的な緩和**のみを定め、暗黙の上書きはしない。

## コンポーネント

- 関数コンポーネントのみ（class コンポーネント禁止は core の no-class がそのまま適用される）
- コンポーネント名は PascalCase（code-style.md の「関数は camelCase」の例外）
- hooks の検査は Biome に委譲する (useExhaustiveDependencies / useHookAtTopLevel 等)。Biome 2 は package.json の react を検出して react domain を自動で有効にするが、意図を明示するため biome.json の overrides で対象ディレクトリに `"domains": { "react": "recommended" }` を書く

## null の例外（core の緩和）

- DOM ref は React の契約に従い null を使う: `useRef<HTMLDivElement | null>(null)`。ast-grep の no-null は前行の `// ast-grep-ignore: no-null-tsx` で理由付き抑制する
- ライブラリが null を要求する props / 戻り値も同様に境界として扱う
- 上記以外は core 通り undefined に統一する。**JSX で「何も描画しない」は undefined を使う**（React 18+ で問題ない）

## ref の書き込み（core の緩和）

- `xxxRef.current` への書き込み（`=` / `+=` / `++`）は mutable ref の標準パターンとして許可される。no-member-mutation は `/Ref$/` 命名の変数への `.current` 書き込みを除外する（命名規約が乱用の歯止め）
- ref 以外のオブジェクトへの `.current` 代入は通常どおり検出される

## JSX の条件描画

- 三項演算子で統一する: `{cond ? <Item /> : undefined}`
- `&&` による条件描画は禁止（ast-grep no-leaked-render が機械強制。`0 && <X />` が "0" を描画する leaked-render バグの温床）。props 内の boolean 計算（`disabled={a && b}`）は対象外
- ネスト三項は禁止（Biome noNestedTernary）。分岐が複雑になったら早期 return する子コンポーネントか描画関数に抽出する

## インラインコールバック

- JSX 属性のイベントハンドラは式本体を許可する: `onClick={() => setOpen(true)}`（ast-grep arrow-body-block-tsx）
- 分岐や複数文が必要なら named handler に抽出する（core と同じ）

## 状態モデリング

- 取得系・非同期系の状態は boolean フラグを並べず discriminated union で表現し（FetchState パターン）、分岐は ts-pattern で行う。実例: coding-style リポの `src/fetchState.ts`

## TSX の機械検査

- ast-grep の各ルールには Tsx 変種（`<rule-id>-tsx`）があり .tsx に適用される
- tsconfig は core の tsconfig.base.json を extends し、`jsx` 等の設定は各プロジェクトで行う
