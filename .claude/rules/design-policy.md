# 設計・実装方針

## 関数設計

### 関数はテスト可能な単位でexportする

- 即時実行スクリプトとして書かない
- 副作用（console.log、ファイル書き込み等）は関数の内部に含めず、呼び出し側に委ねる
- 純粋関数（同じ入力に対して常に同じ出力を返す関数）を優先する

### 戻り値の型は統一する

- 1つの関数が文字列と数値など異なる型を混在して返さない
- 呼び出し側で型の判別が必要になる設計を避ける

## 拡張性

### ルールや条件が増える可能性がある処理はデータ駆動で設計する

- 条件分岐をif文の羅列で表現しない
- ルールを配列やオブジェクトとしてデータ定義し、高階関数で処理する
- ルールの追加が配列への要素追加だけで完結する構造にする

### 条件判定は関数型で表現する

- 条件判定は関数 `(input) => boolean` で表現し、type aliasとして定義する
- 判定ロジックの変更や拡張が、関数の差し替えだけで完結するようにする
- ルール定義のオブジェクトには、判定条件を値（数値や文字列等）ではなく判定関数として持たせる。特定の演算に依存しない汎用的な構造にする

```ts
// NG: 判定が特定の演算に固定されている
type Rule = {
    threshold: number;
    label: string;
};

// OK: 判定を関数として持たせ、任意のロジックに対応可能
type Checker = (value: number) => boolean;

type Rule = {
    checker: Checker;
    label: string;
};
```

### ルールの組み合わせは高階関数の合成で表現する

- 複数ルールの組み合わせ結果を、別のルールとして定義しない
- 個々のルールを独立して定義し、`filter`+`map`+`join`等の合成で結果を導出する
- `find` で最初の1つだけを取る設計は、組み合わせパターンが増えるほどルールが爆発するため避ける

## 副作用の分離

### 副作用は関数の外に切り出す

- ロジックを担う関数は純粋関数として実装する
- 入出力（console.log、API呼び出し、ファイル操作等）はエントリポイントやアダプタ層で行う
- mapを副作用の実行に使用しない（mapは変換用）

## テスト戦略

このプロジェクトのテスト戦略は、上記の設計（純粋関数・I/O 引数化・副作用分離）から自動的に導かれる。新しい方針ではなく、既存の設計の延長として捉える。

### 古典学派 (Detroit school) に従う

- 検証は state-based / value-based で行う（「何が呼ばれたか」ではなく「何が返ったか」）
- 呼び出し履歴を verify するロンドン学派 (mockist) は採らない
- そもそも class / メソッドが存在しないため、相互作用検証する対象が構造的に無い

### Mock ではなく Stub / Fake を使う

- 値を返すだけの **Stub**、軽量な本物実装の **Fake** を使う
- 呼び出しを検証する **Mock** は使用しない
- I/O は引数で受け取るルール（関数設計）の帰結として、テストでは普通の関数/オブジェクトを渡すだけでよい。Mock ライブラリは原則不要

```ts
// プロダクション: I/O を引数で受け取る
const greet = async (
    id: UserId,
    deps: { fetchUser: FetchUser },
): Promise<Result<string, FetchError>> => {
    // ...
};

// テスト: Stub を関数として渡すだけ。Mock ライブラリ不要
test("ユーザー名で挨拶を返す", async () => {
    const fetchUser: FetchUser = async (id) => {
        return { ok: true, value: { id, name: "Alice" } };
    };

    const result = await greet("u1" as UserId, { fetchUser });

    expect(result).toEqual({ ok: true, value: "Hello, Alice" });
});
```

### Test Double は外部境界のみで使う

- 自分のコードのモジュール間呼び出しを double しない（実装詳細との結合が強くなりリファクタ耐性が落ちる）
- 対象は HTTP / DB / ファイルシステム等、自分が制御しない外部依存 (unmanaged dependencies) のみ
- HTTP は MSW、DB は testcontainers 等、ネットワーク/プロセス層で差し替える

### テストの単位は「振る舞い」で切る

- 「1テスト = 1関数」に固執しない
- 隣接する純粋関数を組み合わせて、ドメインの振る舞い単位でテストする（古典学派の sociable test）
- 関数の export 単位とテストの粒度は一致しなくてよい

### Discriminated Union を持つドメインは property-based testing を検討する

- ADT の網羅性を fast-check 等のジェネレータで担保する
- `assertNever` による型レベルの網羅性チェックとペアで使うと、型と値の両面で抜けが防げる

### 型レベルテストで型契約を守る

- Branded Type / Discriminated Union / `Result<T, E>` 等の型契約自体を `expect-type` で検証する
- 「Parse, Don't Validate」の境界では、parser テストが型システムへの入り口の防衛線になる
