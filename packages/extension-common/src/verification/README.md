# verification

文書ごとに Service Worker が検証し、その結果を検証結果ストアに保持する

全フレームの content script がクレデンシャルの script 要素を検知して Service Worker
に知らせ、Service Worker が文書ごとに独立して取得・待ち合わせ・検証をおこなう。
結果は documentId をキーにして `chrome.storage.session` に置く。サイドパネル・
バッジ・リンク検証はストアを読むだけで、自分では検証しない。

## 流れ

1. content script が、文書の構文解析が終わった時点 (`interactive`) で
   `documentChanged` を送る。プリレンダリング中の文書は有効化を待ってから送る
2. Service Worker が文書を検証する ([background.ts](./background.ts) の
   `verifyFrameDocument`)
   1. フレームに読み込まれている文書を索引に記録し、保持しなくてよい文書の結果を破棄する
   2. トップレベル文書なら、そのオリジンの Site Profile の検証を並行して始める
   3. クレデンシャルを取得し、保持している結果を再利用できれば終える
   4. `unverified` を書き込み、入力依存対象が検証可能になるまで待つ
   5. `verifying` を書き込み、`verifyDocument` で検証して `settled` を書き込む
3. 購読する側が `storage.onChanged` を受けてストアを読み直す

```mermaid
sequenceDiagram
participant CS as content script (文書)
participant SW as Service Worker
participant Store as 検証結果ストア
participant Sub as 購読する側

CS->>SW: register
SW-->>CS: documentId
Note over CS: interactive まで待つ<br/>(プリレンダリング中は有効化も待つ)
CS->>SW: documentChanged
SW->>Store: 索引に文書とオリジンを記録する
par トップレベル文書なら
  opt オリジンの結果を再利用できない
    SW->>Store: Site Profile: verifying
    SW->>CS: fetchDocumentSiteProfile
    CS-->>SW: Site Profile
    SW->>Store: Site Profile: settled
  end
and 文書の検証
  SW->>CS: fetchDocumentCredentials
  CS-->>SW: OPS・CAS
  alt 保持している結果を再利用できる
    Note over SW: 終える
  else クレデンシャルのないサブフレームの文書
    SW->>Store: settled (空の結果)
  else
    SW->>Store: unverified
    SW->>CS: awaitInputDependency
    CS-->>SW: 検証可能になった
    SW->>Store: verifying
    Note over SW: レジストリと Site Profile の検証結果を待つ
    SW->>CS: fetchDocumentUrl
    CS-->>SW: document's URL
    loop target ごと
      SW->>CS: verifyDocumentIntegrity
      CS-->>SW: 完全性の検証結果 (target を監視に加える)
    end
    SW->>Store: settled
  end
end
Store-->>Sub: storage.onChanged
Sub->>Store: 読み直す
```

クレデンシャルのないサブフレームの文書は、検証せずに空の結果を `settled` として
書き込む。検証を完了できなかった文書は、文書が入れ替わっていなければ、その旨を
表す失敗 (`VerificationIncomplete`) を `settled` として書き込む。

同じ文書の検証が重なったら、後から始めた検証だけが書き込む (世代で判定する)。
文書がフレームから外れていれば書き込めず、そこで検証を打ち切る。

### 検証に用いる発信者

1 つの文書の検証には、次の発信者だけを用いる。他の文書の OPS は用いない。

| 発信者               | 用いる文書       | 検証の単位                                          |
| -------------------- | ---------------- | --------------------------------------------------- |
| レジストリ           | すべて           | 拡張機能で 1 度。用いた VC の有効期間内は再利用する |
| Site Profile         | トップレベル文書 | オリジンごとに 1 度。時刻の境界までは再利用する     |
| 文書に設置された OPS | その文書         | 文書ごと                                            |

Site Profile を取得できなければ (設置されていない場合を含む)、Site Profile の
発信者を用いずに検証する。Site Profile の検証に失敗していれば、トップレベル文書の
検証も失敗にする。

## 文書とのやり取り

[events.ts](./events.ts) の `verificationMessenger` で送る。

| メッセージ                 | 向き    | 内容                                                   |
| -------------------------- | ------- | ------------------------------------------------------ |
| `register`                 | 文書→SW | 文書が自身の documentId を問い合わせる                 |
| `documentChanged`          | 文書→SW | クレデンシャルが変わった、または検証できる状態になった |
| `inputChanged`             | 文書→SW | 検証済みの target の入力依存対象が変化した             |
| `verifyTab`                | 画面→SW | タブ内の文書の検証を求める                             |
| `resync`                   | SW→文書 | `documentChanged` を送り直すよう求める                 |
| `fetchDocumentCredentials` | SW→文書 | クレデンシャルを取得する                               |
| `fetchDocumentUrl`         | SW→文書 | その時点の document's URL を問い合わせる               |
| `fetchDocumentSiteProfile` | SW→文書 | Site Profile を取得する                                |
| `awaitInputDependency`     | SW→文書 | 入力依存対象が検証可能になるまで待つ                   |
| `verifyDocumentIntegrity`  | SW→文書 | target の完全性を検証し、その target を監視に加える    |

Service Worker から文書へのメッセージは、宛先の documentId を添える。送信先は
フレーム単位でしか指定できず、別の文書に届くことがあるため、文書は自身の
documentId と一致しないメッセージを拒否する。documentId は `register` の応答
(Service Worker が受けた `sender.documentId`) で知る。

## 状態

文書ごとのエントリ (`VerificationEntry`) は 4 つの状態をとる。

| 状態          | 意味                                                          |
| ------------- | ------------------------------------------------------------- |
| `unverified`  | 検証を開始していない (入力依存対象を待っている)               |
| `verifying`   | 検証を開始したが結果が確定していない                          |
| `settled`     | 検証済みまたは検証失敗。どちらかは `result.status` で判別する |
| `invalidated` | 確定した結果が、入力の変化または時刻の経過で有効でなくなった  |

オリジンごとの Site Profile のエントリ (`SiteProfileEntry`) は、`unverified` を
除く 3 つの状態をとる。取得し直すあいだは、無効を経ずに `verifying` とする。
取得か検証が例外で終わったら、エントリを消して次に必要になったときに検証し直す。

時刻の境界 (`result.validUntil`) を過ぎた結果は書き換えず、読み出すときに
`invalidated` として扱う ([identity.ts](./identity.ts) の `resolveEntry` と
`resolveSiteProfileEntry`)。提示する側は、無効を検証失敗と区別する
(`VerificationInvalidated`)。

## 入力依存対象の待ち合わせ

CAS の target の type から入力依存対象を求め、最も遅いものが検証可能になるまで待つ。
type と入力依存対象の対応は、仕様の定めるものを `@originator-profile/verify` の
`targetInputDependency` に置いている。

| 入力依存対象      | 待つ readiness | type                                         |
| ----------------- | -------------- | -------------------------------------------- |
| `response`        | `complete`     | `ExternalResourceTargetIntegrity`            |
| `parsed-dom`      | `interactive`  | `HtmlTargetIntegrity`, `TextTargetIntegrity` |
| `rendered-result` | `complete`     | `VisibleTextTargetIntegrity`                 |

`response` は本来、対象リソースの取得が終われば検証できる。リソースを個別に
追跡せず、文書の読み込み完了で近似している。

allowedUrl は、待ち合わせを終えて検証を始める時点の document's URL で評価する
(`fetchDocumentUrl`)。検証のあいだに URL が変わっていれば、確定した結果を現在の
URL で評価し直す。

## 再利用と検証し直し

保持している結果は、次をすべて満たすときに再利用する
([identity.ts](./identity.ts) の `isReusable`)。

- `settled` で、時刻の境界を過ぎておらず、検証を完了できなかった結果でない
- CAS・OPS の取得経路ごとのダイジェストと、target の入力依存対象が一致する
- allowedUrl の評価結果が、検証時の URL と現在の URL とで一致する

次の契機で検証し直す。

| 契機                                                       | 送るもの                       | 再利用           |
| ---------------------------------------------------------- | ------------------------------ | ---------------- |
| クレデンシャルの script 要素の挿入・削除、内容・属性の変化 | `documentChanged`              | する             |
| 検証した target の入力依存対象の変化                       | `inputChanged`                 | しない           |
| bfcache からの復元                                         | `documentChanged` (`restored`) | 条件付き (※)     |
| サイドパネルを開いた・再読み込みボタン                     | `verifyTab` → `resync`         | ボタンならしない |
| Service Worker の起動                                      | 確定していない文書に `resync`  | する             |

※ 結果が `rendered-result` に依存していれば再利用しない。

再読み込みボタンでは、トップレベル文書のオリジンの Site Profile も取得し直す。
Site Profile を取得し直したら、そのオリジンで Site Profile を用いて確定した
トップレベル文書の結果を `invalidated` にし、文書に `resync` を送って検証し直す。

検証した target の要素が変化したら、検証し直す前に `invalidated` を書き込む。
確定した結果が残っていると、同時に届いた `documentChanged` の検証がそれを
再利用してしまうため。

same-document navigation で allowedUrl の評価結果が変わったら、検証し直さずに
`invalidated` を書き込む。

### target の監視

`verifyDocumentIntegrity` で検証した target を、content script が監視する
([target-watcher.ts](./target-watcher.ts))。入力依存対象を求め直す代わりに、
次の変化の検知で近似する。

| 入力依存対象      | 検知する変化                                                       |
| ----------------- | ------------------------------------------------------------------ |
| `parsed-dom`      | セレクターに一致する要素の集合の変化と、一致した要素の部分木の変化 |
| `rendered-result` | 上に加えて、要素の大きさの変化とビューポートの大きさの変化         |

検証したときに一致する要素がなかった target も監視し、要素が現れたら検証し直す。

変化を 1 度検知したら監視を止め、次の検証で監視し直す。DOM の変化は、クレデンシャルの
script 要素の検知と同じ `MutationObserver` で受ける。

## 保持

| キー                                 | 値                                                           |
| ------------------------------------ | ------------------------------------------------------------ |
| `verification:document:<documentId>` | 文書の検証の状態                                             |
| `verification:site-profile:<origin>` | オリジンの Site Profile の検証の状態                         |
| `verification:registry`              | レジストリの検証結果                                         |
| `verification:tab:<tabId>`           | タブの索引。フレームごとの文書、bfcache にある文書、オリジン |

VC の原文は保持しない。結果には復号したペイロードを残し、クレデンシャルは取得経路
だけを残す。

文書の結果は、次のときに破棄する。

- フレームの文書が入れ替わった。ただし、bfcache に入ったトップレベル文書は
  復元されたときに再利用できるよう残す
- フレームが取り除かれた、または文書が bfcache から追い出された
- タブを閉じた

どのタブのトップレベル文書のオリジンでもなくなった Site Profile の結果も破棄する。

索引の読み書きとエントリの書き込みは直列化する。索引にない文書と fenced frame の
文書の結果は書き込まない。

### 容量が足りないとき

書き込みが容量を超えたら、次の順に組ごとに追い出して書き直す。追い出された文書は、
表示されるときに検証を求められて検証し直される。

1. 表示していないタブのサブフレームの文書
2. bfcache にある文書
3. 表示していないタブのトップレベル文書

表示中のタブの文書は、bfcache にあるものを除いて追い出さない。

## 購読する側

| 購読する側   | 使う関数                                                                           |
| ------------ | ---------------------------------------------------------------------------------- |
| サイドパネル | `tabVerificationStoreOf` (購読ストア)、`requestTabVerification` (再読み込みボタン) |
| バッジ       | `readTabVerification` (`storage.onChanged` を受けて)                               |
| リンク検証   | `waitForTabSiteProfile`                                                            |

`readTabVerification` は、`webNavigation.getAllFrames` が返すフレームの文書の結果
と、トップレベル文書のオリジンの Site Profile、レジストリの検証結果を返す。
`waitForTabSiteProfile` は、時刻の境界を過ぎていない `settled` の結果が書き込まれる
まで待つ。

サイドパネルは、タブごとの購読ストア ([subscription-store.ts](./subscription-store.ts))
を介して読む。購読ストアは検証結果ストアの変化を購読し、`useSyncExternalStore` に
渡せる形で提供する。検証を求めたときの到達確認の結果 (`reachable`・`loading`) を
加えるが、検証結果は保持せず、変化のたびに検証結果ストアから読み直す。

`verifyTab` はタブ内の全フレームに `resync` を送り、届いた文書を返す。読み込みを
終えても応えない文書には content script を注入して送り直す。

```mermaid
sequenceDiagram
participant Panel as サイドパネル
participant Sub as 購読ストア
participant SW as Service Worker
participant CS as content script (各フレームの文書)
participant Store as 検証結果ストア

Panel->>Sub: subscribe (useSyncExternalStore)
Sub->>SW: verifyTab
Sub->>Store: watchTabVerification (storage.onChanged を購読する)
SW->>CS: resync
CS-->>SW: 応答 (届いた文書)
opt 応えない文書 (読み込み後)
  SW->>CS: content script を注入して resync
  CS-->>SW: 応答
end
SW-->>Sub: 届いた文書 (reachable)・読み込み中か (loading)
CS->>SW: documentChanged
Note over SW,Store: 文書の検証 (「流れ」の図)
Store-->>Sub: storage.onChanged
Sub->>Store: readTabVerification
Sub-->>Panel: 新しいスナップショット
```

## 実装

| ファイル                                         | 役割                                                     |
| ------------------------------------------------ | -------------------------------------------------------- |
| [content-script.ts](./content-script.ts)         | 全フレームで検知・通知し、Service Worker の要求に応える  |
| [background.ts](./background.ts)                 | Service Worker の検証パイプライン                        |
| [store.ts](./store.ts)                           | 検証結果ストアとタブの索引、容量が足りないときの追い出し |
| [identity.ts](./identity.ts)                     | 入力の同一性、再利用の判定、無効化                       |
| [credentials.ts](./credentials.ts)               | 文書から受け取ったクレデンシャルを取得経路付きの形に戻す |
| [target-watcher.ts](./target-watcher.ts)         | 検証した target の変化の監視                             |
| [tab-verification.ts](./tab-verification.ts)     | 購読する側が使う読み出し・購読・検証の要求               |
| [subscription-store.ts](./subscription-store.ts) | サイドパネルが使う購読ストアと到達確認                   |
| [types.ts](./types.ts)                           | エントリと結果の型                                       |
| [events.ts](./events.ts)                         | 拡張機能内メッセージ                                     |
| [errors.ts](./errors.ts)                         | 無効を表すエラー                                         |

アプリ側は `setupBackground` と `setupFrameHandlers` を呼ぶだけで、このモジュールを
直接は登録しない。

## 既知の限界

- target の監視は近似である。target の部分木の外の変化 (祖先の属性やスタイル
  シートの変更など) は、一致する要素の集合か大きさが変わらない限り検知しない。
  `rendered-result` の入力は、こうした変化でも変わりうる
- `rendered-result` に依存する type は非推奨のため、文書の可視性の変化は監視しない
- Service Worker が停止すると、進行中の検証は失われる。起動したときに、確定して
  いない文書へ `resync` を送って検証をやり直す
- `response`・`rendered-result` に依存する target は、文書の読み込みの完了
  (`complete`) まで期限なしに待つ。読み込みの終わらない文書では、トップレベル
  文書の結果が確定せず、サイドパネルは読み込み中のままになる
- オーバーレイは iframe を `body` に追加する。`body`・`html` を target にした CA は、
  オーバーレイを開くと target の変化として検証し直される。
  `HtmlTargetIntegrity` ではオーバーレイを含む DOM でダイジェストを求めるため、
  検証に失敗する
