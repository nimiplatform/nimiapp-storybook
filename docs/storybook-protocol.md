# Storybook 0.1.0 创作与实现指南

这份文档描述当前实现，供内容作者和后续开发使用。产品权威在 [protocol.authority.yaml](../.nimi/spec/storybook/canonical/protocol.authority.yaml)；可导入的数据类型见 [types.ts](../src/storybook/engine/protocol/types.ts)，实际校验见 [validate.ts](../src/storybook/engine/protocol/validate.ts)。0.1.0 是本项目的首个可执行协议版本，不是对 Character Card V2 社区标准的修改。

## 从已有资源开始

在「发现故事 → 导入角色或作品」选择文件。当前接受：

| 文件 | 导入后可以做什么 |
| --- | --- |
| Character Card V2 JSON | 查看创作者介绍、切换原卡开场、选择游玩称呼、开始真实 AI 互动 |
| 含 `chara` tEXt 元数据的 V2 PNG | 同上，并使用 PNG 原图作为封面；暂不读取压缩元数据和其他卡格式 |
| Lorebook JSON | 收藏世界资料；开始体验时与角色卡组合、叠加或更换 |
| 独立 Storybook JSON | 查看体验、选择角色绑定与世界资料、游玩作者编排的内容 |
| 已有 Storybook prepared package | 游玩原有的编排式分支故事 |

角色、作品、草稿、项目和经历通过 Nimi Kit 标准壳与 SDK 的 storage.assets 接口，写入 App 专属数据目录中的 JSON 文件。PNG 图像单独作为媒体文件存储，读取时使用 Kit 签发的临时媒体访问句柄，提交完成后才进入收藏或显示保存完成。不会自动获取卡中的远程 lorebook。媒体链接在实际显示或播放时由浏览器读取；AI 推理只经已授权的 Nimi SDK 和 Runtime App AIConfig。

**普通角色卡无需 Storybook 扩展，也无需章节或结局。** 角色和世界资料在新经历开始时进入独立的项目快照。更换角色或世界会开始另一段经历，旧记录保持原有设定。

## 本机存储与可携带的作品

本机持久化使用 Nimi Kit 已提供的原生标准壳能力，经 public SDK 的 `storage.assets` 文件接口接入。应用只提交相对路径，数据目录、权限与文件提交由 Nimi 管理。没有另建 SQLite 引擎、浏览器数据库、内存持久化降级或产品化自动迁移。

- `storybook/records/` 下按 projects、packages、story-runs、documents、experience-runs、drafts 保存独立 JSON 文件。长记录使用分块文件 API，不挤入有容量上限的小 JSON 文档接口。
- `storybook/media/` 保存独立媒体文件。PNG 以内容摘要去重，多个角色绑定／经历可以引用同一张图片。
- `storybook-media:…` 是本机稳定引用；显示时换取 Kit 的临时 `nimi-app-asset://` 句柄，离开组件后释放。临时句柄不会写进作品或存档。
- 导出独立作品时，本机媒体引用展开为可携带的 data URI；原始 V2 卡的未知字段保持原样。

首轮迭代产生的浏览器数据仅通过本机一次性工具转存。该工具位于 `.nimi/local/`，不随产品发布，也不会成为运行时兼容分支。需要原生文件能力的验收入口是由 Nimi 启动的 Storybook App；普通浏览器窗口显示打开 App 的提示。

## 同一个作品对象，两种承载方式

最小独立作品：

```json
{
  "format": "nimi.storybook",
  "version": "0.1.0",
  "title": "一个还没发生的时刻"
}
```

同一个对象也可以放在 V2 卡的 `data.extensions["nimi.storybook"]` 中。卡的 `spec: "chara_card_v2"` 和 `spec_version: "2.0"` 保持原意。播放器允许明确选择使用附带体验，或独立使用原卡。

作品不隐式拥有携带它的那张卡。作品通过 `roles` 声明角色位置，由玩家选卡，或通过 `resources` 提供默认卡。随卡分发时，设置页面会为第一个未设默认卡的位置预选携带它的卡；这是可更改的游玩选择。取出作品对象后，作者已声明的资源与引用仍按同样规则解释。

| 作品字段 | 当前含义 |
| --- | --- |
| `format`, `version`, `title` | 必填的格式、独立版本和显示标题 |
| `summary` | 给玩家的简介；不会自动加入提示词 |
| `resources` | 作品内可引用资源的字典 |
| `cover` | `resources` 中某个媒体资源的 ID |
| `roles` | 可选角色位置；每个位置含 `label`、可选 `card` 资源 ID、可选 `required` |
| `modules` | 命名空间模块字典；每个模块含 `version`、`config` 和可选 `required` |
| `extensions` | 保留其他创作工具的数据 |

当前角色与 lorebook 资源以内嵌数据或游玩时的本地绑定提供，不解析远程角色文件或 ZIP 相对依赖。角色／资源／状态 ID 使用字母、数字、点、横线或下划线，最长 96 个字符，首字符是字母或数字。

## 角色卡如何参与推理

字段处理基于 [Character Card V2 原规范](https://github.com/malfoyslastname/character-card-spec-v2/blob/main/spec_v2.md)。卡中的描述、人格、场景可以混合不同语义，不要求作者重新分类。原始未知数据会随 JSON 导出保留。

当前推理组装顺序：卡的 system prompt（为空时使用内部默认）→ `before_char` lore → 角色描述／人格／场景 → `after_char` lore → 其他已绑定参与者的描述 → 对话示例 → 作品与当前节点明确声明的上下文 → 有说话者标记的经历记录 → 当前玩家输入 → 卡的 post-history instructions。多角色体验每轮有一个当前发言角色，其 system prompt 生效；其他卡的 system prompt 不会一起争夺全局设置。

`{{char}}` 和 `{{user}}` 在作者内容中替换为角色与玩家称呼。已发生的开场、场景与反馈使用该事件发生时的角色；切换当前交谈角色不会重写历史称呼。显示、推理历史与 lore 扫描使用同一份展开内容，玩家输入与实际生成正文保持字面值。system/post-history 字段中的 `{{original}}` 引用对应的内部默认值。没有新的宏求值语言。当前 App Access 通道仅接受 system/user 消息，因此历史以带说话者标记的 JSON 内容传入，不伪造不受支持的消息角色。

`creator_notes`、tags、creator、character_version 用于界面，不自动参与推理。附加平台字段（例如 vendor 的 depth prompt、CSS、远程关联资料）会保留，并在导入说明中标明未执行。

角色自带 lorebook 默认参与互动，额外选择的世界资料叠加在后。条目按 enabled、constant、keys、case_sensitive、selective/secondary_keys 激活；支持 recursive_scanning、insertion_order 和 priority。重复内容只加入一次，不因厂商的远程关联字段重复注入。

本播放器的上下文策略是显式的实现选择：scan_depth 缺省 4，0 表示不扫描历史；按经历记录计数，包含当前输入。每本 lorebook 缺省预算 1024，上限 8192 个估算 tokens；估算为 ASCII 字符数除以 4 向上取整，加其他 Unicode 字符数。先按高优先级分配预算，再按插入顺序排列；递归扫描只使用已经选中的条目。未识别的 position 以 after_char 消费并提示，原值仍保留。

推理通道上限为 8 条消息、单条 32 KiB、合计 64 KiB。过大的核心设定会明确拒绝发送，不裁掉卡片正文冒充完整使用；历史超预算时省略最早记录，本轮省略数量和 lore 激活数量可在游玩页查看，完整经历仍留在本机。未实现 tokenizer 精确预算和自动历史摘要。

## 三个可选模块

当前注册模块都使用字符串版本 `"1"`。作者可只使用其中一个，也可组合。未知模块或未知模块版本原样保留；若声明 `required: true`，播放器会阻止进入该体验，并解释原因。optional 只表示缺少执行支持时不阻止游玩，已注册模块的结构错误仍会被校验出来。

### `nimi.storybook.conversation`

```json
{
  "version": "1",
  "config": {
    "role": "companion",
    "context": "这次相遇发生在一场雨停之后。给对方留出回应的空间。",
    "worlds": ["town"],
    "opening": [{ "type": "text", "text": "你们同时在屋檐下停住了脚步。" }]
  }
}
```

字段都可选。`role` 引用角色位置；缺省取第一个已绑定角色，完全没有角色时使用叙述者。`context` 是作者明确提供给推理的补充内容；不会尝试自动剥离原卡已经包含的世界观。`worlds` 是默认 lorebook 资源列表，玩家可在开始前调整。`opening` 是有类型的内容集合；未声明时使用当前角色卡的选定开场。

### `nimi.storybook.flow`

```json
{
  "version": "1",
  "required": true,
  "config": {
    "entry": "arrival",
    "state": { "accepted": false },
    "nodes": [
      {
        "id": "arrival",
        "title": "刚好遇见",
        "content": [{ "type": "text", "text": "一个位置为你空着。" }],
        "dialogue": true,
        "choices": [{
          "id": "sit", "label": "坐下来", "target": "together",
          "set": { "accepted": true },
          "feedback": [{ "type": "text", "text": "对方把杯子往你这边推近了一点。" }]
        }]
      },
      { "id": "together", "title": "同一个下午", "dialogue": true }
    ]
  }
}
```

每个节点可选 `content`、`context`、`role`、`dialogue`、`choices`、`end`。dialogue 缺省开启；end 关闭继续对话，也不能同时声明前进选项。没有流程模块时，开放互动不受节点限制。节点可循环、开放停留，也可以明确结束；不要求每份作品有结局。

选项 `when` 是已声明状态的精确匹配对象，多个条件同时满足才可见。`set` 只能更新已声明状态，值类型必须保持一致；状态支持 string/number/boolean。条件、状态与跳转由引擎执行；角色生成不会偷偷更新它们。没有可用行动且明确关闭对话的目标节点会在进入前报错，保留原有进度。

当前没有独立的章节分组元数据模块、通用事件脚本、任意 CSS/JavaScript 注入或视频时间轴。它们不应被伪装成已经支持的 module config；未来行为需要新模块及其消费规则。

### `nimi.storybook.generation`

```json
{
  "version": "1",
  "config": {
    "tasks": [{
      "id": "postcard", "label": "写下这次相遇",
      "capability": "text.generate",
      "inputs": [{ "type": "text", "text": "根据我们实际发生的交谈，写一张寄给未来的明信片。" }],
      "outputs": [{ "id": "body", "kind": "text" }],
      "trigger": { "event": "manual" },
      "reuse": "run"
    }]
  }
}
```

输入和页面内容统一使用内容集合：`{type:"text",text}`、`{type:"media",uri,mimeType,alt?,purpose?}`、`{type:"resource",ref,alt?}`、`{type:"output",task,output,alt?}`。生成的媒体可直接作为 media 内容保存在尝试结果中，不需要向冻结的作品资源表补写资产。资源可以是 text、character、lorebook、media，或保留给扩展模块解释的 `x-...` 类型。media 包含 `uri`、`mimeType`，可带 `purpose` 和 `alt`；character 内嵌 `card`，可用 `portrait` 引用独立媒体资源；lorebook 内嵌 `book`。PNG 导入的图像在组合为作品时也会进入媒体资源，不会改写原始角色 JSON。

任务输出按 ID 命名，kind 可为 text、image、music、speech、sound、video 或 `x-...`。music、speech、sound 分别表达创作目标；文件播放仍依据 MIME 类型。每次尝试的输出是 `Record<outputId, ContentPart[]>`，不是无类型字符串。

| 任务字段 | 当前行为 |
| --- | --- |
| `trigger.event: manual` | 玩家明确点击后执行 |
| `trigger.event: enter` | 进入体验／节点后自动执行；若指定 node，仅在该节点执行 |
| `dependsOn` | 显式依赖其他任务；引用其他任务输出作为输入时也必须声明。拒绝依赖环 |
| `reuse: run` | 在本段经历复用成功结果 |
| `reuse: visit` | 每次进入节点各自执行并复用，历史页面保留各自进入时的结果 |
| `reuse: never` | 只用于 manual；玩家可以明确再次生成 |
| `required: true` | 当前阶段依赖任务完成；无结果也无作者替代内容时，不能继续推进 |
| `fallback` | 明确的作者替代内容集合，可含 text、media 或可呈现的 resource；显示时与生成成功区分 |

依赖只消费本段经历中已有的成功结果或可呈现的明确 fallback；不会擅自替玩家触发 manual 任务。限定在某个节点的 visit/never 任务只能被同节点任务依赖；跨节点复用时，作者需明确将上游设为 run。自动任务等待依赖后执行。恢复经历复用已完成输出，执行中被中断的尝试标为 unavailable，保留重试入口。终态写入失败时，当前 App 保留实际结果并提供重试保存，不重新调用模型冒充恢复。返回旧选择会分出一段经历，未来事件、状态和结果不会带回来。

当前真实生成实现是 text.generate，且每个任务生成一个 text 输出；媒体输入尚未接入。其他能力声明可以被导入和保存，不能执行时返回 capability-unavailable。required 能力及其依赖若无法执行且没有明确 fallback，会在开始前阻止进入。

当前文本执行器需要非空的有效文本输入。空数组、空白文字及空白文本资源不能被标为可执行；动态输出引用还会在实际消费前检查解析后的类型与内容。上游声明 text 输出、但实际采用图片 fallback 时，图片仍可展示，下游文本任务会明确提示不支持媒体输入，不会把图片的 alt 偷换成推理正文。对于有节点限制的必需任务，校验会拒绝可证明无法提前到达的前置任务；这个检查保留合法的早期节点复用和替代路径，不承诺求解任意条件图。

页面支持预置 PNG/JPEG/WebP/GIF 图片、MP3/OGG/WAV 音频、MP4/WebM 视频。接受 HTTPS、相应类型的 data URI，以及应用内的 `./stories/` 资源；不执行卡内脚本、SVG data URI 或任意样式。网络文件能否实际加载与媒体编码能否解码，仍取决于来源和宿主支持。

开场、对话与作品文本支持 CommonMark 和 GFM 的图片、链接、标题、列表、引用与表格。图片复用 App 的媒体呈现边界；原始 HTML 按文字显示，不执行。V2 原 prompt 字段同时支持大小写不敏感的 `{{char}}` / `<BOT>` 与 `{{user}}` / `<USER>`。缺省的 card/book/entry extensions 按规范补为空对象，未知字段继续保留。

HTTP(S) 文字链接由原生壳交给系统浏览器打开；包含账号密码的 URL 和其他 scheme 不提供外部跳转。零回溯点的结尾不显示重走选择的邀请，历史面板会说明没有可回溯的选择或回应。

PNG 中相同的 chara 数据会合并；多份不同的有效 V2 数据会显示候选开场和设定，由用户明确选择。无法解码的候选会列出原因，不会暗中按第一份或最后一份覆盖作者内容。

图片／音乐／语音／音效／视频生成、媒体理解、后台预生成、媒体同步与时间轴，都是后续执行能力。上述资源引用、任务依赖、类型化输入输出和结果生命周期已在根模型中存在，接入时无需将文本结果重构成另一套根协议。

## 可直接试用的文件

- [林：普通 V2 卡](../public/protocol/examples/lin.character.json) 与 [陆：普通 V2 卡](../public/protocol/examples/lu.character.json)，均没有 Storybook 扩展。
- [潮汐城](../public/protocol/examples/tide-city.lorebook.json) 与 [云上驿站](../public/protocol/examples/cloud-station.lorebook.json)：相同角色可以进入不同世界。
- [长椅的另一端](../public/protocol/examples/branching-encounter.storybook.json)：不含默认角色，展示可更换角色、开放对话、条件、分支反馈和结尾。
- [寄给还没到来的你](../public/protocol/examples/postcard.storybook.json)：真实文本生成任务、任务依赖与尚未接入的图片生成的作者替代内容。配图是已有的预制作品素材，不是运行时生成成功的假象。

在创作间可以新建空白作品，也可以从“继续草稿”或已有作品入口恢复各自的编辑。草稿按作品身份分别保存；“保存并预览”更新当前作品，“另存副本”创建有独立名称的新作品。已开始的经历保留其绑定快照，不随作品编辑变化。保存失败会保留输入并提供重试，离开编辑页前会完成提交。

“在创作间使用”会保留已有资源，给新增世界资料分配不冲突的引用，不覆盖同名封面或人物资源。待发对话也按经历独立保存到本机，进入设置再返回可以继续输入；只有消息已写入经历后才清理对应草稿。

导出 JSON 携带内嵌角色／世界资料。导出原卡是数据字段的 JSON 往返；PNG 图像本身仍保留在导入的本机资源中，也可以作为独立作品的 portrait 媒体资源导出；当前不会重新封装 PNG。

## 本轮验证范围

已通过真实 Nimi App 路径验证普通 V2 JSON/PNG 导入、原卡完整导出、多角色／世界组合、实际模型对话、文本任务生成、图片能力未接入时的作者替代内容、原生图片文件读取、约 4 MB 的自包含作品导出、存档与草稿的重新加载。Mia 的全部 JSON 字段及 20 条 lorebook 已在真实文件往返中核对。

已在原生 App 中验证本机 WAV 音频和 MP4 视频的实际解码与播放。相同页面保留旧媒体句柄超过十分钟后，首次播放触发真实失效，组件重新取句柄并自动播完。此验证不覆盖所有编码格式或长视频的 range 请求。图片、音乐、语音、音效和视频的实时生成尚未实现，不将其记为端到端成功。
