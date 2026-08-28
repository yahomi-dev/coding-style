# TypeScript コーディングルール

## 設計思想

このルールセットは **関数型 × データ指向TypeScript (FP × DOP TypeScript)** スタイルに基づく。OOP（class / 継承 / メソッド）は使わず、型でデータを定義し関数で振る舞いを定義する。

### 核となる5つの原則

1. **データと振る舞いの分離**: `type` でデータを定義し、関数で振る舞いを定義する（class / this / new / 継承は使わない）
2. **型でドメインを表現する**: discriminated union と branded type で「不正な状態を表現不可能」にする（Make Impossible States Impossible）
3. **イミュータブル前提**: `const` と非破壊API（スプレッド / `toSorted` / `toReversed` 等）で状態変更を排除する
4. **失敗を値として扱う**: `throw` ではなく `Result<T, E>` で失敗を戻り値の型に現す
5. **副作用を境界に閉じ込める**: ロジックは純粋関数、I/O や非決定的な値（時刻・乱数・環境変数）は引数で受け取る

### 判断基準

ルールに明記されていない場面で迷ったら、上記5つの原則に立ち返る。「この書き方は関数型 × データ指向の思想に沿うか？」を判断基準にする。原則と個別ルールが矛盾するように見えた場合は、原則を優先しつつルールの更新を検討する。

### 強制レイヤ

機械検査可能なルールは Biome / ast-grep / tsconfig で強制する（対応表: docs/coding-standards.md）。本書が扱うのは原則と、静的検査できない判断ルール。lint エラーの message / note に根拠と代替が書いてあるので、違反時はそれに従う。正当な例外は違反行の前行に `// ast-grep-ignore: <rule-id>` と理由を書いて抑制する。

## 言語機能の選択（機械強制済み）

詳細な根拠は lint メッセージと docs/coding-standards.md を参照。

- 型定義は `type` に統一、`interface` 不使用（Biome）
- `class` 不使用。依存性の注入は関数を引数で受け取る（ast-grep）。フレームワークが class を強制する場合のみ suppression で除外
- `enum` 不使用。ユニオン型か `as const satisfies` で代替（tsconfig erasableSyntaxOnly + ast-grep）。禁止対象は TS の enum 宣言構文のみ。`z.enum` / `envField.enum` などライブラリの列挙 API は literal union を返すただの関数なので使用可 (「ユニオン型 + パース」の推奨手段であり、literal union の手組みに書き換えない)
- `let` / `var` 不使用、`const` のみ（ast-grep / Biome）
- `function` 宣言・式、ジェネレータ、メソッド定義は不使用。すべてアロー関数（ast-grep）。遅延列は Iterator helpers で代替
- `switch` / `else if` 不使用（ast-grep）
- 破壊的メソッド（push / sort / splice / プロパティ代入 / delete 等）不使用（ast-grep）

### null は使用しない（undefined に統一）

- 値の不在は `undefined`。型はオプショナル（`?`）で表す（ast-grep no-null）
- 外部 API / DOM / ライブラリから来る `null` は受け取った境界で `undefined` に変換する。`=== null` / `== null` の比較は境界検査として許可される
- 注意: JSON では `null` は値として残り `undefined` はフィールドごと消える。「フィールドはあるが値がない」を表す必要があればスキーマ設計で対応する
- `??` は `undefined` のフォールバックとしてのみ使う

## ドメインモデリング

### Discriminated Union でドメイン状態を表現する

排他的な状態は tag フィールドを持つ discriminated union で表現し、boolean フラグの並列で表現しない（Make Impossible States Impossible）。

```ts
// NG: フラグの組み合わせで不正な状態を作れてしまう
type FetchState = {
    isLoading: boolean;
    isError: boolean;
    data?: User;
};

// OK: tag で状態を排他にする
type FetchState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "success"; data: User }
    | { status: "error"; error: FetchError };
```

### Branded Type とスマートコンストラクタ

意味を持つ string / number は branded type で別名化し、パース関数（スマートコンストラクタ）とペアで使う。brand の付与は vendored brand.ts の `Brand<T, B>` で行う (`type Email = Brand<string, "Email">`)。brand キーは brand.ts に閉じた unique symbol なので、型を手書きで再現できず、すべての brand が `Brand<` で grep できる。brand 付与の `as` はスマートコンストラクタ内でのみ許可され、スマートコンストラクタは `*.parse.ts`（または `parse/`）に置く（型の入り口 = パーサ）。実例: coding-style リポの `src/email.parse.ts`。

### Parse, Don't Validate

外部入力（API レスポンス・フォーム・JSON 等）は `unknown` で受け、**Zod** でパースして型を獲得してから内部に流す。`safeParse` の戻り値は `fromZod`（vendored schema.ts）で `Result` に変換する。boolean を返す validate ではなく型を返す parse を書く。

### Total Function を志向する

入力の一部で例外を投げたり黙って undefined を返したりする部分関数を避け、失敗の可能性は戻り値の型で表すか、入力型を絞って失敗を排除する（例: `NonEmptyArray<T> = readonly [T, ...T[]]`）。`noUncheckedIndexedAccess` により添字アクセスは `T | undefined` になるので、undefined を型で処理する。

どちらで表すかの基準 (Type Safety Back and Forth): **外部入力の境界は前に押し出す** (戻り値を `Result` にして呼び出し側に失敗処理を担わせる)、**内部ドメイン関数は後ろに押し出す** (引数を絞った型にして呼び出し側に正しい入力の用意を担わせる)。値を作る場所は使う場所より少ないので、内部で前に押し出すと呼び出し側の数だけハンドリングが増える。境界でパースして得た型をそのまま内部に流せば、内側の関数に再検査を書く理由が消える。

### 型で表現する範囲の線引き

型で表現できるものは型に置く (レビューで確認する項目が減る) が、型で表現できないものを無理に型にしない。

- **起こりうる状態が数えられる** -> discriminated union で並べる
- **値の制約が形式として書ける** (メールアドレスの書式、正の整数等) -> 境界で parse して branded type で運ぶ
- **実行時にしか判らない性質** (配送可能なメールアドレス、存在するユーザ ID 等) -> 型にしない。実行時検査と運用で扱う
- **有効な状態の中の計算違い** (データは正しいが計算結果が間違っている) -> 型では止まらない。テストとドメインレビューで扱う (design-policy.md のテスト戦略)
- **状態遷移の順序の型強制** (typestate: `Door<Locked>` / `Door<Unlocked>` のように状態を型パラメータで持つ) -> 決済・権限のように順序を間違えると取り返しがつかない領域に限る。画面表示状態には使わない (型パラメータ増加のコストが利益を上回る)

### 文脈ごとに型を分ける

同じデータでも文脈によって必須性が変わるフィールドは、1 つの型にオプショナル (`?`) を増やして全文脈を賄わない。文脈ごとに型を分け、各文脈で必須なものを必須として宣言する (Rich Hickey "Maybe Not")。

```ts
// NG: 作成時と承認時を 1 つの型で賄い、承認処理の中で department の存在を再検査する
type Employee = {
    name: string;
    department?: string;
};

// OK: 文脈ごとに型を分ける。承認処理は department の存在を検査しない
type EmployeeDraft = {
    name: string;
    department?: string;
};

type EmployeeForApproval = {
    name: string;
    department: string;
};
```

## 型アサーション

**型注釈 = 契約の宣言 / satisfies = 検査（型を変えない）/ as = 上書きの最終手段** と使い分ける。

- `as` が許されるのは3つのみ: `as const`、スマートコンストラクタの brand 付与、境界パーサ内部（後者2つは `*.parse.ts` / `parse/` に置くことで ast-grep が強制）
- 非 null アサーション `!` は禁止（Biome noNonNullAssertion）。代替: 早期 return / `??` / `isDefined` 型ガード（vendored array.ts）
- 型の確認には `satisfies` を使い、`as` で型を上書きしない

## 関数定義

- すべてアロー関数。基本形はブロック本体 + 明示 `return`
- **例外**: 呼び出しの引数・オブジェクトプロパティ（React では JSX 属性も）に直接書くインラインコールバックは式本体を許可

```ts
// OK: インラインコールバックは式本体で書ける
const names = users.filter((u) => u.isActive).map((u) => u.name);

// 宣言に束縛する関数はブロック + 明示 return
const double = (n: number): number => {
    return n * 2;
};
```

- exported 関数は戻り値型を明示する（declaration を出すパッケージでは tsconfig isolatedDeclarations が強制する）
- 配列を受ける引数は `readonly T[]` で受ける。戻り値は新規生成なら素の `T[]` で可、共有データを返すなら readonly
- 共通のシグネチャを持つ関数群は type alias を定義して変数側に付ける
- I/O・非決定的な値（時刻・乱数・環境変数）は関数内部で取得せず引数で受け取る（詳細と例: design-policy.md）

## 制御構造

- if はブロック必須（Biome useBlockStatements）、ブロックの前後に空行を入れる。`else if` は使わず早期 return で平坦化する
- 三項演算子は**式の位置での boolean -> 値の選択**に限り使用可。ネスト禁止（Biome noNestedTernary）。文としての分岐は if で書く（ast-grep no-ternary-statement）
- `&&` / `||` を分岐として使わない（ast-grep no-short-circuit-statement）。値のフォールバック `a ?? b` / `a || b` は式の位置でのみ使う

### Discriminated Union の分岐は ts-pattern

DU の網羅的な分岐は ts-pattern の `match().exhaustive()` を正規手段とする。網羅性はコンパイル時に保証される（未マッチ時のランタイム throw は assertNever と同等で、消えるのはボイラープレート）。実例: coding-style リポの `src/fetchState.ts`。

```ts
import { match } from "ts-pattern";

const render = (state: FetchState): string => {
    return match(state)
        .with({ status: "idle" }, () => "待機中")
        .with({ status: "loading" }, () => "読み込み中")
        .with({ status: "success" }, ({ data }) => data.name)
        .with({ status: "error" }, ({ error }) => renderError(error))
        .exhaustive();
};
```

依存を追加できないファイル（vendored utils 等）では if + 早期 return + `assertNever` を代替として使う:

```ts
const assertNever = (value: never): never => {
    throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
};
```

## 反復処理

for / for-in / for-of / do-while / forEach は使用しない（ast-grep / Biome）。語彙の使い分け:

- **変換**: `map` / **絞り込み**: `filter`（型の絞り込みは `isDefined` 等の型ガードを参照で渡す）
- **変換して初めて成否が判る（parse 系）**: `filterMap`（vendored array.ts。実体は `map(f).filter(isDefined)` の合成）。単なる条件 + 変換は filter -> map に分ける
- **0..n 展開**: `flatMap`
- **グルーピング**: `Object.groupBy` / `Map.groupBy`（値は undefined を含みうる点に注意）
- **オブジェクト構築**: `Object.fromEntries` + `map`（reduce + spread で畳まない: O(n²)）
- **長いチェーン・大きい列・early-exit**: Iterator helpers（`items.values().filter(p).map(f).take(n).toArray()`）。遅延評価で中間配列を作らない（Node 22+ / ES2025）。イテレータは一回消費なので中間イテレータを変数に置かず終端操作まで一気に書く。ブラウザ対象では baseline（Safari 18.4+ 等）を確認する
- **上記で書けない fold（数値集約等）**: `reduce`（最終手段）

コールバックの規約:

- インラインコールバック内で分岐しない（ast-grep no-branching-in-callback）。分岐が要るなら名前付き関数に抽出して参照で渡す
- 1つのコールバックには1つの責務（判定は filter、変換は map）。map を副作用に使わない（design-policy.md）

反復の境界:

- **回数不定の反復**（リトライ / ページネーション / ポーリング）はライブラリ（p-retry, p-limit 等）へ委譲する。該当ライブラリが無い場合のみ、I/O アダプタ層（`adapters/` / `*.adapter.ts`）で `while` を許可（ast-grep no-while-outside-adapter）
- **逐次 await**（レートリミット等で並列にできない I/O）はアダプタ層でのみ `for...of` を許可する（ast-grep no-for-of-outside-adapter）。アダプタ層ではループ状態のための `let` も許可される（no-let の ignores）
- 再帰は**データ構造の再帰的形状に沿う場合**（木・入れ子構造）のみ許可。制御フローの代替としての再帰（リトライ等）は禁止。ジェネレータは使わない

## エラー処理

### 期待される失敗は Result、バグは throw

- **期待される失敗**（ドメインの正常な結果の一種: パース失敗・検証エラー・not found 等）は `Result<T, E>` で返す
- **プログラムのバグ**（到達不能パス・不変条件違反）は throw で即死させる。Result に包まない（スタックトレースを保つ）
- 実装は vendored result.ts（ok / err / map / andThen / match / all / partition / fromThrowable / fromPromise）を使う。plain object なのでシリアライズ可能

### エラー型の規約

- E は `kind` タグ付き discriminated union。メッセージ文字列ではなくデータを持たせ、文言化は境界（UI / ログ）で行う
- `Error` インスタンスは境界のみ。throw する外部ライブラリは `fromThrowable` / `fromPromise` で Result に変換する。原因の保持が必要なら `cause: unknown` フィールドに入れる

```ts
type FetchError =
    | { kind: "network"; cause: unknown }
    | { kind: "http"; statusCode: number };
```

### async の合成は await + 早期 return

`Promise<Result<T, E>>` のチェーンは await して失敗を早期 return する（Rust の `?` を手で展開した形）。async 用のコンビネータ（ResultAsync 等）は作らない。

```ts
const showUser = async (
    id: UserId,
    deps: Deps,
): Promise<Result<string, FetchError>> => {
    const user = await fetchUser(id, deps);

    if (!user.ok) {
        return user;
    }

    return ok(formatUser(user.value));
};
```

並列でよい I/O の fan-out は `Promise.all(items.map(async ...))` を正規手段とする（Promise の構築は「map を副作用に使わない」ルールの公認例外。design-policy.md 参照）。結果の集約は result.ts の `all` / `partition` で行い、並列度制御・逐次化は p-limit（逐次は `limit(1)` かアダプタ層の for-of）へ委譲する。

## イミュータビリティ

- 破壊的 API は使用しない（ast-grep）。スプレッド / `toSorted` / `toReversed` / `toSpliced` / `with` / `Object.assign({}, ...)` を使う
- **局所ミューテーションの例外（二層制）**。いずれも関数の外から観測されないことが前提で、suppression コメントに理由を書く:
  1. **アルゴリズム的必然**（visited Set / メモ化 Map / インデックス構築など標準語彙で直接表現できないもの）: 理由コメントのみで可
  2. **性能目的**（標準語彙で書けるが遅い場合）: 計測結果を添えることが条件
- Map / Set はドメインデータに使わない（Record を使う。Map / Set には非破壊 API が無い）。使ってよいのは関数内部に閉じたアルゴリズム用途のみ
- readonly は公開関数の引数と公開型に付ける。モジュール内の const で閉じた型には不要（`as const satisfies` で担保する）

## export / import

- named export のみ（Biome noDefaultExport）。宣言時 export を推奨、barrel file は例外時のみ
- type-only import は `import type`（tsconfig verbatimModuleSyntax + Biome useImportType）

## 型定義

- `any` 不使用。型が確定しない外部入力は `unknown` で受け、型ガードかスキーマパースで絞り込む（Biome noExplicitAny）
- 関数型は type alias で名前を付ける（インラインの関数型シグネチャを避ける）
- 型から推論できる注釈は書かない（`as const satisfies` で型が確定しているコールバック引数等）
- ドメインの型定義はテストファイルではなく実装側に置く

### 素直な型を選ぶ

型は「保証が強い」より「その場で読めて、エラーメッセージが直す場所を指す」ことを優先する。型パズルで得られる保証は、discriminated union + branded type + 境界パースで同じ保証が得られないかを先に考える。

効く型の条件 (すべて満たすものを書く):

- 名前が付いている (type alias で宣言され、名前で grep できる)
- 定義が 1 箇所にまとまっている (情報が 1〜2 ファイルに集約され、LSP なしでもファイルを読めば型が分かる)
- その場で数行で読める
- エラーメッセージが直す場所と直し方を指す

避ける型 (導出された型):

- 条件型 (`T extends X ? A : B`) / `infer` / 再帰的な型 / テンプレートリテラル型による導出 / 多段のジェネリクス。情報が定義から離れた場所で計算され、エラーメッセージも導出過程を指してしまう
- ユーティリティ型は `Pick` / `Omit` / `Partial` / `Readonly` 程度に留め、これらの合成で型を「計算」しない
- 型を導出したくなったら、導出元の型を素直に手で書けないかを先に検討する (重複は許容する)

```ts
// NG: 状態が定義から離れた場所で計算される。追加時にコンパイラが修正箇所を列挙しない
type GetEmployeeState<T> = T extends { employee: infer E }
    ? E extends undefined
        ? "loading"
        : "loaded"
    : "error";

// OK: 状態を直和で並べる。追加時に match().exhaustive() が修正箇所を列挙する
type EmployeeState =
    | { status: "loading" }
    | { status: "loaded"; employee: Employee }
    | { status: "error" };
```

「型から推論できる注釈は書かない」は変数・コールバック引数の話であり、上記とは対象が異なる。exported シンボルの型は明示し (isolatedDeclarations)、モジュール内部は推論に任せる、という切り分けは変えない。

## 定数定義

exported または複数箇所から参照される定数配列 / オブジェクトは `as const satisfies readonly T[]` を使う（readonly は必須セット）。

## コメント

- **JSDoc は exported シンボル（関数・型）に必須**。1行でも3行形式（`/**` / ` *` / ` */`）で書く。モジュール内部のコメントは code-style.md の方針（自明なら書かない）に従う — 競合時は本ルールが優先
- 既存コードの exported シンボルへの JSDoc 追加は契約の文書化として可（「既存コードにコメントを追加しない」の例外）
- コメント内の矢印は `->` `<-` を使う（Unicode 矢印は使わない）

## フォーマット

- 同一オブジェクト内のプロパティは詰め、配列内のオブジェクト間には空行を入れる
- if ブロックの前後に空行を入れる

## 標準依存

この規約で標準採用済みのライブラリ（導入時の個別確認は不要）:

- **ts-pattern**: DU 分岐
- **zod**: スキーマパース（フロントエンドはバンドルサイズに応じて zod/mini を検討）
- **p-retry / p-limit**: 回数不定の反復・並列度制御
- **vendored**: result.ts / array.ts / schema.ts / brand.ts を coding-style リポの src/ からコピーする（コントラクト層を厳密に、実装層は再生成可能に保つ）
