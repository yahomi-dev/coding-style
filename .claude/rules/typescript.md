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

## 前提方針

### interfaceを使用しない（typeに統一する）

- 型定義にはすべて `type` を使用する。`interface` は使用しない
- ユニオン型やリテラル型を活用してデータモデルを定義するため、`type` でなければ表現できない場面が多い
- `interface` と `type` を両立させると「この型はどちらで定義すべきか」という判断コストが発生するため、`type` に統一して判断コストをなくす
- Biomeの `useConsistentTypeDefinitions` ルール（style: "type"）で強制する

### class構文を使用しない

- class, this, new, prototype, super は使用しない
- 型（type）でデータを定義し、関数で振る舞いを定義する
- 依存性の逆転は関数を引数で受け取ることで実現する
- フレームワークがclass前提のAPIを提供している場合は例外として許容する

### enum（列挙型）を使用しない

- enumはランタイムにオブジェクトを生成し、Tree Shakingとの相性が悪い
- ユニオン型やas constで代替する

### nullは使用しない（undefinedに統一する）

- 値の不在を表すには `undefined` を使用する。`null` は使用しない
- TypeScript/JSの言語仕様（省略可能な引数、オプショナルプロパティ、`?.` 演算子等）が自然に `undefined` を返すため、統一することで比較時の判断コストがなくなる
- 型で不在を表すにはオプショナル（`?`）を使う

```ts
// NG
type User = {
    name: string;
    nickname: string | null;
};

// OK
type User = {
    name: string;
    nickname?: string;
};
```

#### 例外

- 外部APIやライブラリが `null` を返す場合は受け取らざるを得ない。その境界で `undefined` に変換する

#### 注意事項

- JSONシリアライズでは `null` は値として残るが `undefined` はフィールドごと消える。APIレスポンスで「フィールドは存在するが値がない」ことを明示する必要がある場合は、APIのスキーマ設計で別途対応する（例: フィールド自体をオプショナルにする）
- `??`（nullish coalescing）は `null` と `undefined` の両方を拾う。`null` を使わない方針であれば `??` は `undefined` のフォールバックとしてのみ機能する

## ドメインモデリング

### Discriminated Union（タグ付きユニオン）でドメイン状態を表現する

- 排他的な状態を持つドメインモデルは、tag フィールドを持つ discriminated union で表現する
- データ指向プログラミングの「データのスキーマと表現を分離する」原則に従う
- 単一のオブジェクトに boolean フラグを並べて状態を表現することを避ける

```ts
// NG: boolean フラグの並列で不正な状態を作れてしまう
type FetchState = {
    isLoading: boolean;
    isError: boolean;
    data?: User;
    error?: Error;
};

// OK: tag フィールドで状態を排他にする
type FetchState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "success"; data: User }
    | { status: "error"; error: Error };
```

### Make Impossible States Impossible（不正な状態を型で表現不可能にする）

- boolean フラグを2つ以上並べて状態を表現する場合は、discriminated union への置き換えを検討する
- 「あり得ない組み合わせ」を型レベルで除去し、ランタイムの防御的コードを減らす

### Branded Type でプリミティブの誤用を防ぐ

- ID やメールアドレスのような「意味を持つ string / number」は branded type で別名化する
- 構造的に同じ型でも、誤って混ぜることを型レベルで防ぐ
- スマートコンストラクタ（パース関数）とペアで使う

```ts
type UserId = string & { readonly __brand: "UserId" };
type Email = string & { readonly __brand: "Email" };

const createEmail = (input: string): Result<Email, ParseError> => {
    if (!input.includes("@")) {
        return { ok: false, error: { kind: "invalid_email", input } };
    }

    return { ok: true, value: input as Email };
};

// UserId を渡すとコンパイルエラーになる
const sendMail = (to: Email): void => {
    // ...
};
```

### Parse, Don't Validate（境界で型を確定させる）

- 外部入力（APIレスポンス・フォーム・JSON・ファイル等）は `unknown` で受け取る
- Zod / Valibot 等のスキーマライブラリでパースし、型を獲得してから内部に流す
- `boolean` を返す validate ではなく、型を返す parse を使う

```ts
// NG: validate して boolean を返す
const isUser = (input: unknown): boolean => {
    // ...
};

// OK: parse して型を獲得する
const parseUser = (input: unknown): Result<User, ParseError> => {
    // ...
};
```

### Total Function（全域関数）を志向する

- 入力ドメインの一部で例外を投げたり `undefined` を返したりする部分関数を避ける
- 失敗の可能性は戻り値の型で表現するか、入力型を絞り込んで失敗を排除する

```ts
// NG: 空配列で undefined になるのに型に現れない
const head = <T>(arr: T[]): T => {
    return arr[0];
};

// OK: 型で表現する
const head = <T>(arr: T[]): T | undefined => {
    return arr[0];
};

// または入力を絞る
type NonEmptyArray<T> = readonly [T, ...T[]];

const headOfNonEmpty = <T>(arr: NonEmptyArray<T>): T => {
    return arr[0];
};
```

## 変数宣言

- `const` のみ使用する。`let` / `var` は禁止

## 関数定義

### アロー関数で統一する

- function宣言・function式は使用しない。すべてアロー関数で定義する
- classを使わない方針のためthisの罠が存在せず、function宣言を選ぶ理由がない
- アロー関数は変数側に型を付けられるため、型エイリアスとの組み合わせで型契約を表現できる

### アロー関数のブロック省略を禁止する

- 暗黙のreturn（ブロック省略）は使用しない。必ず `{}` と明示的な `return` を書く
- 「この場合は省略OK、この場合はダメ」という判断コストをなくすための統一ルール

```ts
// NG
const double = (n: number) => n * 2;

// OK
const double = (n: number) => {
    return n * 2;
};
```

### 共通の型契約がある関数は変数側に型を付けることを検討する

- 同じシグネチャを複数の関数が共有する場合、型エイリアスを定義し変数側に型を付ける
- すべての関数に強制するのではなく、共通の契約がある関数に限定する

```ts
type Formatter = (value: number) => string;

export const toPercent: Formatter = (value) => {
    return `${value}%`;
};

export const toCurrency: Formatter = (value) => {
    return `¥${value}`;
};
```

### I/O や非決定的な値は引数で受け取る

- ロジック関数は同じ入力に対して同じ出力を返す純粋関数として書く
- I/O（fetch / DB / console / ファイル）や非決定的な値（`Date.now()`, `Math.random()`, 環境変数）は関数内部で取得せず、引数として受け取る
- 「依存性の逆転は関数を引数で受け取ることで実現する」ルールの拡張で、I/O も同じ枠組みで扱う

```ts
// NG: 関数内部で時刻を取得するためテストしにくい
const isExpired = (token: Token): boolean => {
    return token.expiresAt < Date.now();
};

// OK: 時刻を引数で受け取る
const isExpired = (token: Token, now: number): boolean => {
    return token.expiresAt < now;
};
```

## 制御構造

### if文

- else if を含むネストした if は禁止
- if文のブロック `{}` は省略しない
- if文ブロックの前後には空行を入れる

```ts
// NG
if (x) return y;
const a = 1;
if (y) {
    return z;
}
const b = 2;

// OK
if (x) {
    return y;
}

const a = 1;

if (y) {
    return z;
}

const b = 2;
```

### switch文は禁止

### 三項演算子は使用しない

- 値の選択を含め、条件による分岐はすべてif文ブロックで行う
- returnする値の出し分けにも三項演算子を使わない

```ts
// NG
return result === "" ? String(n) : result;

// OK
if (result === "") {
    return String(n);
}

return result;
```

### 短絡評価

- `||` や `&&` を条件分岐として使うことは禁止

### 再帰

- ループの代わりに再帰を使うことは禁止

### Discriminated Union の網羅性は `assertNever` で担保する

- if文の連鎖で discriminated union を分岐する場合、すべてのタグを処理したことを型レベルで保証する
- ユニオンに新しいタグが追加されたとき、コンパイルエラーで処理漏れに気付ける

```ts
const assertNever = (value: never): never => {
    throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
};

type FetchState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "success"; data: User }
    | { status: "error"; error: Error };

const render = (state: FetchState): string => {
    if (state.status === "idle") {
        return "待機中";
    }

    if (state.status === "loading") {
        return "読み込み中";
    }

    if (state.status === "success") {
        return state.data.name;
    }

    if (state.status === "error") {
        return state.error.message;
    }

    return assertNever(state);
};
```

## エラー処理

### `throw` ではなく `Result<T, E>` を返す

- 関数の失敗は戻り値の型で表現する
- `throw` はシグネチャに現れず、呼び出し側が失敗の可能性を見落としやすい
- 失敗の可能性がある関数は `Result` 型を返す

```ts
type Result<T, E> =
    | { ok: true; value: T }
    | { ok: false; error: E };

// NG: 関数シグネチャから失敗が見えない
const parseUser = (input: string): User => {
    if (!isValid(input)) {
        throw new Error("invalid");
    }

    return toUser(input);
};

// OK: 失敗が型に現れる
const parseUser = (input: string): Result<User, ParseError> => {
    if (!isValid(input)) {
        return { ok: false, error: { kind: "invalid", input } };
    }

    return { ok: true, value: toUser(input) };
};
```

#### `throw` を許容する例外

- I/O境界でフレームワークが例外を要求する場合
- プログラムのバグを示す即死パス（`assertNever` 等の到達不能パス）
- 外部ライブラリが `throw` する場合は境界で `Result` に変換する

## ループ処理

### 逐次処理は禁止し、高階関数を使う

以下の逐次処理は使用しない:

- for / while / do-while / for-in / for-of / Array#forEach

代わりに `map`, `filter`, `reduce` 等の高階関数を使用する。

### 高階関数は1つのコールバックにつき1つの責務

- **map**: 変換（AをBに変える）
- **filter**: 絞り込み（条件に合うものだけ残す）

コールバック内に条件分岐が出てきたら、それはfilterに分離すべきサイン。

```ts
// NG: mapの中で判定と変換を同時にやっている
items.map((item) => {
    return item.isActive ? item.name : "";
})

// OK: filterで絞る、mapで取り出す
items.filter((item) => {
    return item.isActive;
}).map((item) => {
    return item.name;
})
```

### 高階関数に渡すコールバック内でif文は禁止

## イミュータビリティ

### 破壊的なメソッド・APIを使用しない

`const` だけではオブジェクトや配列の中身の変更を防げない。以下の破壊的APIは使用しない:

- `Array#push` / `pop` / `shift` / `unshift`
- `Array#splice` / `sort` / `reverse` / `fill` / `copyWithin`
- `Object.assign(target, ...)` の第一引数を変更する用法
- プロパティへの直接代入による変更（`obj.x = y`）

代わりに非破壊APIを使う:

- スプレッド構文（`[...arr, x]`, `{ ...obj, key: value }`）
- ES2023 非破壊メソッド（`toSorted`, `toReversed`, `toSpliced`, `with`）
- `Object.assign({}, ...)` のように新規オブジェクトを生成する形

```ts
// NG
arr.push(x);
arr.sort();
Object.assign(obj, { key: "value" });
obj.x = y;

// OK
const next = [...arr, x];
const sorted = arr.toSorted();
const merged = { ...obj, key: "value" };
const updated = { ...obj, x: y };
```

## export / import

### named exportを使用する（default export禁止）

- BiomeのnoDefaultExportルールで強制する
- 設定ファイル等、default exportが必須の場合は `biome-ignore` で理由を付けて除外する

### exportは宣言時に行う（推奨）

- リンターでは強制できないため推奨扱い
- barrel file（index.tsでのre-export）や循環参照回避の場合は末尾exportを許容する

```ts
// 推奨: 宣言時にexport
export const greet = (name: string): string => {
    return `Hello, ${name}`;
};

// 末尾exportはbarrel file等の例外時のみ
export { greet } from "./greet.js";
```

## 型定義

### `any` を使用せず、境界では `unknown` を使う

- `any` は型チェックを無効化するため使用しない
- 外部入力など型が確定していない値は `unknown` で受け取り、型ガード（`is` predicate）またはスキーマパースで絞り込む

```ts
// NG
const handle = (input: any) => {
    return input.name;
};

// OK
const isUser = (input: unknown): input is User => {
    return typeof input === "object"
        && input !== null
        && "name" in input
        && typeof (input as Record<string, unknown>).name === "string";
};

const handle = (input: unknown): string | undefined => {
    if (isUser(input)) {
        return input.name;
    }

    return undefined;
};
```

### 関数型にはtype aliasを使う

- 型の意図を名前で表現し、インラインの関数型シグネチャを避ける

```ts
// NG
type Config = {
    validate: (input: string) => boolean;
    format: (input: string) => string;
};

// OK
type Validator = (input: string) => boolean;
type Formatter = (input: string) => string;

type Config = {
    validate: Validator;
    format: Formatter;
};
```

### 型から推論できる場合は型注釈を省略する

- 型定義やsatisfiesで型が確定している場合、コールバックの引数に型注釈を重複して書かない

```ts
type Handler = (input: string) => boolean;

type Config = {
    handler: Handler;
    name: string;
};

// NG: Config型からhandlerの引数型は推論できるのに重複して書いている
const configs = [
    {
        handler: (input: string) => {
            return input.length > 0;
        },
        name: "notEmpty",
    },
] as const satisfies readonly Config[];

// OK: 型推論に任せる
const configs = [
    {
        handler: (input) => {
            return input.length > 0;
        },
        name: "notEmpty",
    },
] as const satisfies readonly Config[];
```

### 型定義はテストファイルではなく実装側で管理する

- ドメインの型定義をテストファイルに置かない

## 定数定義

### イミュータブルな定数には `as const satisfies readonly T[]` を使用する

- モジュール外にexportする定数、または複数箇所から参照される定数配列/オブジェクトが対象
- `as const satisfies` を使う場合、`readonly` は必ずセットで付ける（付けないとコンパイルエラーになる）

```ts
type StatusLabel = {
    code: string;
    label: string;
};

const statuses = [
    {
        code: "active",
        label: "有効",
    },

    {
        code: "inactive",
        label: "無効",
    },
] as const satisfies readonly StatusLabel[];
```

## コメント

### JSDocスタイルのコメントを使用する

- 関数、型定義（type/interface）にはJSDocスタイルのコメントを付ける
- 1行の説明でも3行形式（`/**` / ` *` / ` */`）で書く
- コメント内の矢印は `->` `<-` を使用する（`→` `←` 等のUnicode矢印は使わない）

```ts
/**
 * ユーザー名を整形して返す
 */
export const formatUserName = (firstName: string, lastName: string): string => {
    return `${lastName} ${firstName}`;
};

/**
 * ユーザー情報
 */
type User = {
    name: string;
    age: number;
};
```

## フォーマット

### 空行ルール

- 同一オブジェクト内のプロパティは詰める
- 配列内のオブジェクト間には必ず空行を入れる

```ts
// NG
const items = [
    {
        name: "Alice",
        age: 30,
    },
    {
        name: "Bob",
        age: 25,
    },
];

// OK
const items = [
    {
        name: "Alice",
        age: 30,
    },

    {
        name: "Bob",
        age: 25,
    },
];
```

### readonly修飾子

- モジュール内のconstで閉じた型にreadonlyは付けない（ノイズになるだけ）
- `as const satisfies` で十分にイミュータブル性は担保される
