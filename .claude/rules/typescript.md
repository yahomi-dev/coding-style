# TypeScript コーディングルール

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
