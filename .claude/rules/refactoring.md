# リファクタリングルール

Christian Clausen『実践で学ぶコード改善の極意』（原著 *Five Lines of Code*, Manning）の手法を FP × DOP TypeScript に翻案した判断ルール。原著は class ベースの OOP を前提とするため、「クラスへ寄せる」操作はすべて「discriminated union + 関数 + モジュールへ寄せる」操作に読み替えている。

原著の核心は「リファクタリングをセンスではなく、機械的に検知できるスメルと手順化されたレシピで行う」こと。これは本規約の強制レイヤ思想（docs/coding-standards.md）と同型なのでそのまま採用する。

typescript.md（core）/ design-policy.md への**追加**であり、矛盾するように見えた場合は core が優先する。TDD ワークフローの Refactor フェーズ（`/simplify`）と既存コードの改善時に適用する。

## 進め方の原則

- 常にコンパイルが通り、テストがグリーンのままの小さいステップで進める。1ステップ = 1レシピの適用
- 振る舞いの変更とリファクタリングを同じコミットに混ぜない
- 機能追加が窮屈なら、先に追加が楽になる形へリファクタしてから変更する（この準備リファクタも機能追加とはコミットを分ける）
- 変更は型（コントラクト層）から着手し、コンパイルエラーの一覧を作業リストとして潰す
- この進め方が機能するよう、DU の分岐に `.otherwise()` や default 相当を書かない。網羅性エラーが「対応漏れの全箇所リスト」として働く
- リファクタリング中に型が合わない箇所を `as` でねじ伏せない（typescript.md の as 三例外は維持）

## スメル検出ルール（いつ着手するか）

「気になったら」ではなく、機械的な条件でスメルを検知する。

### 5文ルール

- 関数本体は **5文以内**を目安とする。ガード節（if + 早期 return）は1文、メソッドチェーンのパイプラインは1文と数える
- 目的は圧縮ではなく**命名の強制**。超過した関数には名前を持たない責務が埋まっており、抽出して名前を付けること自体がドキュメントになる
- 詰めて5文に収めるのは本末転倒。抽出で収める

### 手順を語るコメントは関数名に昇格させる

実装の手順を説明するコメントを見つけたら、その塊を関数抽出し、コメントを関数名に変換して消す。残すコメントは不変条件と why のみ（code-style.md）。

```ts
// NG: 手順コメントが責務の境界を示している（= 抽出位置が既に見えている）
const importUsers = async (
    csv: string,
    deps: Deps,
): Promise<Result<User[], ImportError>> => {
    // CSV をパースして不正行を除外
    // ...10行...
    // メールアドレスの重複を除外
    // ...6行...
    // 保存して結果を集約
    // ...8行...
};

// OK: コメントを関数名に昇格。本体は手順の列挙になり、抽象度も揃う
const importUsers = async (
    csv: string,
    deps: Deps,
): Promise<Result<User[], ImportError>> => {
    const rows = parseCsvRows(csv);

    if (!rows.ok) {
        return rows;
    }

    const unique = dedupeByEmail(rows.value);

    return saveUsers(unique, deps);
};
```

### 抽象度を混在させない（call or pass）

- 1つの関数内で、同じデータに対する「フィールド・添字への直接操作」と「ドメイン関数の呼び出し」を混ぜない
- 関数は、受け取った値を**自分で変換する**か、**他の関数へ渡す**かのどちらかに寄せる。混在していたら低レベル側の塊を関数抽出する

### 共通接頭辞・接尾辞はモジュール欠落のサイン

- 同じ接頭辞/接尾辞を共有する関数群（`formatInvoiceHeader` / `formatInvoiceRows` / ...）は、専用モジュールの欠落を示す。型とセットでファイルへ切り出し、接頭辞の意味はモジュール名に移す
- 切り出した先で名前が汎用的になりすぎるなら、そのモジュールが公開する型を主語にして命名し直す

### 同じ DU への分岐を散在させない

- 同じ discriminated union に対する分岐が複数モジュールに散っていたら、変換関数として型のそばに集約する
- boolean フラグの組で状態を表しているコードは、リファクタの起点として DU 化から始める（typescript.md「Make Impossible States Impossible」）

### 使われない一般性を削る（specialize）

- 呼び出し側が1種類しかない型パラメータ・オプション引数・設定フラグは削除して具体化する
- 一般性は「いつか使うかも」で入れず、2つ目の呼び出し側が現れた時にその要求から導入する

### 条件式に副作用を置かない

- if / 三項の条件式には副作用のある呼び出しを置かない。条件は `(input) => boolean` の純粋関数として抽出できる形に保つ（design-policy.md の Checker）

## レシピ（どう直すか）

### 関数抽出と再インライン化

- 抽出: 塊を新しいアロー関数へ移し、読む値を引数、生み出す値を戻り値にする。過不足はコンパイラが列挙する
- 抽出した関数の引数が多くなりすぎるなら、塊の切り方が悪いか、引数群が1つの型としてまとまるべきサイン
- 名前が実装以上の情報を持たなくなった関数はインラインして戻す。抽出とインラインを往復して適切な粒度を探す

### 型コードを DU に置換し、分岐を match に集約する

原著の「型コードをクラスに置換 + ポリモーフィズム」に対応する操作。本規約では DU + 網羅 match が同じ保証（分岐の追加漏れの静的検知）を担う。

- 生の string / number タグは string literal union（payload が要るなら kind 付き DU）に置換する
- 分岐は ts-pattern `match().exhaustive()` の変換関数へ1箇所に集約する。variant 追加時はコンパイルエラーが全対応箇所を列挙する

```ts
// NG: 生の string タグ。分岐が呼び出し側に散在し、追加漏れを検知できない
const shippingLabel = (kind: string): string => {
    if (kind === "express") {
        return "速達";
    }

    if (kind === "standard") {
        return "通常";
    }

    throw new Error(`unknown kind: ${kind}`);
};

// OK: union 化して分岐を1箇所へ。variant 追加は exhaustive が検知する
import { match } from "ts-pattern";

type ShippingKind = "express" | "standard";

const shippingLabel = (kind: ShippingKind): string => {
    return match(kind)
        .with("express", () => "速達")
        .with("standard", () => "通常")
        .exhaustive();
};
```

### variant ごとの振る舞いはデータ駆動へ育てる

原著の「コードをクラスへ押し込む」に対応する操作。同じ DU に対する match 関数が増えてきたら、variant ごとの値・振る舞いをテーブルに寄せる（design-policy.md のデータ駆動設計）。

- `as const satisfies Record<Variant, T>` で網羅性を型検査に残す
- variant の追加が「テーブルへの1エントリ追加」で完結する構造にする

```ts
type Plan = "free" | "pro";

type PlanSpec = {
    maxSeats: number;
    canExport: boolean;
};

// Plan に variant を足すと、ここがコンパイルエラーになって追加を強制する
const planSpecs = {
    free: { maxSeats: 1, canExport: false },
    pro: { maxSeats: 50, canExport: true },
} as const satisfies Record<Plan, PlanSpec>;
```

### 振る舞いの差し替えは関数を渡す

原著の Strategy パターン導入に対応する操作。差し替えたい振る舞いは type alias を付けた関数型で引数から受け取る。class / interface の階層は作らない。design-policy.md の Checker / I/O 引数化と同じ形で、テストでは Stub 関数を渡すだけで済む。

### 定数だけ違う関数を1つに統一する

原著の「類似クラスの統一」に対応する操作。実装が同型で定数だけ違う関数群は、定数をルールデータへ外出しして「1関数 + データ定義」にする。統一してよいのは「仕様上、常に同時に変わる」ものだけ（下記「重複と抽象の判断」）。

### 不変条件はスマートコンストラクタに集約する

原著の「データのカプセル化」に対応する操作。「この値は必ず検証済み」という不変条件は、branded type + `*.parse.ts` のスマートコンストラクタで生成経路を1本にして守る（typescript.md）。隠すのは生成経路だけで、データ自体は透明なまま扱う。

### 手順の順序を型で強制する（enforce sequence）

- 「A の後でなければ B できない」は、A の戻り値型（branded / パース済み型）を B の引数型にして、順序違反をコンパイルエラーにする
- 実行時チェック（`if (!initialized) throw`）より型で表現する。Parse, Don't Validate の一般化

### 消してコンパイルする（try delete then compile）

- 未使用が疑われる export は、消してコンパイル・テストが通るか確認するのが最速の検証。復元は git がいつでもできる
- コメントアウトされたコードは無条件に削除する
- 一括で書き換えられない規模の構造は、新実装を並走させて呼び出し側を段階的に移行し、移行完了後に旧実装を消す
- 機械化には knip 等の未使用検出ツールが使える（標準依存には含めていないため、導入時は確認する）

## 重複と抽象の判断

- **間違った抽象は重複より高くつく**（Sandi Metz の格言。原著も同趣旨）。共通化は「仕様上、同時に変わるもの」だけに行う
- 独立に変わりうる2箇所が偶然同じ形をしていても統一しない。統一済みのコードを片側だけ変えたくなったら、複製して分離（specialize）してから変える
- 変更は既存コードの書き換えより「variant / ルールの追加」で表現できる構造（データ駆動）を優先する

## 原著から採用しないルール

翻案で消えたルールは意図的な不採用として記録する。

- **if は先頭のみ・else 禁止・switch 禁止**: switch と else if は ast-grep（no-switch / no-else-if）で機械強制済み。素の else と「if は関数の先頭のみ」は機械強制されていないが、早期 return 規約と5文ルール（ガードの後は1責務）が実質的に同じ形へ導くため、個別ルールにはしない
- **継承は interface からのみ**: class 全面禁止（no-class）でルールごと消滅。振る舞いの共有は関数合成で行う
- **getter / setter の排除**: OOP のカプセル化前提のルール。DOP ではデータは透明のまま扱う（隠すのは生成経路だけ。前述「不変条件はスマートコンストラクタに集約する」）

## 機械強制

原著のルールのうち機械検査可能なものは既存レイヤが担う（no-switch / no-else-if / no-let / mutation 系 / no-branching-in-callback）。本書のスメル検出は判断ルールだが、代理指標を置ける:

- 5文ルール: Biome `complexity/noExcessiveCognitiveComplexity` が近似になる（閾値は各プロジェクトで設定）
- 未使用 export: knip（導入は依存追加の確認ルールに従う）
