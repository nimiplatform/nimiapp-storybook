import { createEmptyTruthPackage, type StorybookTruthPackage } from '../engine/truth.js';
import { makeTruthRef } from '../engine/ids.js';
import { buildPreparedPackage } from '../engine/prepared-package.js';
import { createAssetSpec, attachPrebuiltArtifact } from '../engine/assets.js';
import { type StoryNode, type Choice } from '../engine/run.js';

type AuthoredStory = {
  id: string;
  title: string;
  subtitle: string;
  themes: string[];
  role: string;
  cover: string;
  cast: {
    name: string;
    voice: string;
    publicFacts: string[];
    privateFacts: string[];
    goals: string[];
  }[];
  nodes: StoryNode[];
  endings: { id: string; label: string }[];
};
const pick = (id: string, label: string, targetNodeId: string, trust = 0): Choice => ({
  id,
  label,
  targetNodeId,
  source: 'authored',
  effects: trust ? [{ op: 'add-var', target: 'connection', value: trust }] : [],
});
const scene = (
  id: string,
  title: string,
  text: string,
  choices: Choice[],
  speaker?: string,
): StoryNode => ({ id, chapterId: 'ch1', title, text, choices, speaker });
const ending = (id: string, title: string, text: string): StoryNode => ({
  ...scene(id, title, text, []),
  isEnding: true,
  endingId: id,
});

// These are deliberately authored short stories, never presented as live AI
// output. They use the same truth -> validation -> Play path as creator books.
// @nimi-authority: rule.storybook.product.r001
export const CURATED_STORIES: AuthoredStory[] = [
  {
    id: 'harbor-letters',
    title: '雾港来信',
    subtitle: '灯塔熄灭前，你收到了一封来自失踪者的信。',
    themes: ['悬疑', '人性的两面'],
    role: '受托而来的调查者',
    cover: './stories/harbor.jpg',
    cast: [
      {
        name: '阿岚',
        voice: '话很轻，却总在关键处停顿',
        publicFacts: ['码头小馆的老板娘', '和失踪的守灯人相识多年'],
        privateFacts: ['帮守灯人的女儿准备了离港的小船'],
        goals: ['保护一个不愿再被找到的人'],
      },
      {
        name: '陆沉',
        voice: '简短直接，偶尔显露疲惫',
        publicFacts: ['雾港的老探长', '请你寻找失踪的守灯人'],
        privateFacts: ['曾替航运公司压下一份事故报告'],
        goals: ['在大雾过去前结束调查'],
      },
    ],
    nodes: [
      scene(
        'n1',
        '一封没有邮票的信',
        '渡船靠岸时，钟楼刚敲过十一点。\n\n一个赤脚的孩子把信塞进你手里，转身跑进雾中。信纸潮湿，上面只有一句话：\n\n「如果他们说我失踪了，请不要相信灯。」\n\n落款是三天前失踪的守灯人。远处，灯塔每隔七秒亮一次。有人在继续他的工作。',
        [
          pick('a', '走向灯塔，看看是谁在点灯', 'tower'),
          pick('b', '进码头小馆，问问这封信', 'inn'),
        ],
      ),
      scene(
        'tower',
        '第七秒的黑暗',
        '螺旋楼梯上有两串鞋印，一大一小。塔顶的灯在机械地转动，旁边却没有人。\n\n你在齿轮下找到一本值班记录。最后一页夹着一张旧照片：一艘倾斜的客轮，和站在岸边的陆沉。照片背面写着「那晚的灯灭了十分钟」。\n\n楼梯下突然传来脚步声。',
        [
          pick('c', '藏好照片，等来人开口', 'keeper'),
          pick('d', '把照片摊在桌上，直接问陆沉', 'inspector'),
        ],
      ),
      scene(
        'inn',
        '她多倒了一杯茶',
        '阿岚看完信，没有问你从哪里来，只多倒了一杯茶。\n\n「他女儿说，这杯总给留着。」她把茶推到空座位前，「你是来找人，还是替谁结案？」\n\n她的袖口湿透，鞋底沾着灯塔下才有的白沙。柜台旁挂着一把小船的钥匙。',
        [
          pick('e', '告诉她：我要先听见失踪者自己的话', 'keeper', 1),
          pick('f', '请她解释鞋上的白沙', 'inspector', -1),
        ],
        '阿岚',
      ),
      scene(
        'keeper',
        '不想被救的人',
        '阿岚带你走到灯塔背后的船坞。守灯人坐在一艘小船里，膝上放着那本事故原始记录。\n\n「那晚熄灯，是为了让走私船进港。客轮撞上了暗礁。」他说，「我签了假的值班记录。现在他们要拆灯塔，连证据一起拆掉。」\n\n他把本子交给你：「我愿意作证。但我女儿明早必须上船，她什么也不知道。」',
        [
          pick('g', '先送他的女儿离开，再公开证据', 'departure', 1),
          pick('h', '带着完整证据，去找陆沉当面对质', 'confront'),
        ],
        '守灯人',
      ),
      scene(
        'inspector',
        '熟人的代价',
        '陆沉在码头拦住你。他看见你手里的线索，慢慢收起了警徽。\n\n「那场海难之后，是航运公司养活了这个港口。」他说，「你把旧账翻开，失去工作的不只是他们。」\n\n他递来一张结案书。签字处空着。背后的小馆里，阿岚一直没有熄灯。',
        [
          pick('i', '把结案书还给他，去听守灯人的证词', 'keeper', 1),
          pick('j', '要求他亲口交代那一晚发生了什么', 'confront'),
        ],
        '陆沉',
      ),
      scene(
        'departure',
        '黎明前的船票',
        '女孩没有回头。她站在渡船尾端，一直摸着外套口袋里的船票。\n\n阿岚说：「她以为父亲病了，过几天就会去找她。」\n\n守灯人在灯塔门口等你。他已经换了干净衣服，准备去自首。那本原始记录，就在你怀里。晨报的记者和陆沉都在码头另一头。',
        [
          pick('k', '陪他走向记者，把自己的证词也留下', 'truth', 1),
          pick('l', '把副本交给记者，让父女在远方重逢', 'mercy'),
        ],
      ),
      scene(
        'confront',
        '灯光照不到的地方',
        '你读出了报告上被改过的时间。陆沉起初沉默，后来只说：「我的弟弟在那艘船上。」\n\n他没有拿钱。他相信封存报告能让港口活下去，直到封存变成了又一次勒索。\n\n雾中传来第一班渡船的汽笛。他把自己的那份原始笔录放在你面前。两份证据，终于对上了。',
        [
          pick('m', '两份笔录一起公开，任何人都不例外', 'truth'),
          pick('n', '接受他的辞职与赔偿方案，封存姓名', 'silence', -1),
        ],
        '陆沉',
      ),
      ending(
        'truth',
        '让灯照见每一个人',
        '晨报第一版印出来时，雾还没散。守灯人和陆沉坐在同一间候问室里，隔着一把空椅子。\n\n有人骂你毁了港口，也有人第一次知道亲人为什么没有回家。阿岚的小馆从清晨就排起了队。\n\n离港前，你收到一张明信片。守灯人的女儿写道：「谢谢你没有替我们决定，什么真相值得知道。」\n\n那晚，灯塔被正式接管。光依旧每隔七秒亮一次。',
      ),
      ending(
        'mercy',
        '给远方留一盏灯',
        '原始报告登上了报纸，证人的姓名被隐去。公司开始接受调查，一班凌晨的货船悄悄离港。\n\n阿岚再也没有在空座位前倒茶。陆沉知道你做了什么，却没有追来。\n\n一个月后，一封没有署名的信落在你的门口。里面是父女俩在海边的照片，和一行字：「灯亮着。我们都好。」\n\n你替真相打开了一扇门，也为一个人留了一条路。',
      ),
      ending(
        'silence',
        '安静的海面',
        '陆沉辞去职位。赔偿金以匿名援助的名义送到遇难者家里，航运公司承诺翻修灯塔。\n\n港口维持了原来的生活。人们照常出海，照常把晚归归咎于风。\n\n阿岚没有送你。渡船离岸时，你看见她独自站在小馆门口。那杯给守灯人留的茶还在。\n\n你的结案书写着「失踪者平安」。没有一处是假的，也没有一句是完整的。',
      ),
    ],
    endings: [
      { id: 'truth', label: '让灯照见每一个人' },
      { id: 'mercy', label: '给远方留一盏灯' },
      { id: 'silence', label: '安静的海面' },
    ],
  },
  {
    id: 'last-train',
    title: '末班车没有终点',
    subtitle: '车票上的目的地，是你从未经历过的昨天。',
    themes: ['奇幻', '关于告别'],
    role: '错过归途的旅人',
    cover: './stories/train.jpg',
    cast: [
      {
        name: '列车长',
        voice: '温和，像把所有问题都听过一次',
        publicFacts: ['照看这班末班车', '每一站只能停三分钟'],
        privateFacts: ['最后一站是自己离开家的那天'],
        goals: ['让每个旅人自己决定下车的地方'],
      },
      {
        name: '小满',
        voice: '直率，假装不在乎',
        publicFacts: ['带着一个没有地址的信封', '一直坐在靠窗的位置'],
        privateFacts: ['信里只有一张空白纸'],
        goals: ['找到一句来得及说出口的话'],
      },
    ],
    nodes: [
      scene(
        'n1',
        '开往昨天',
        '站台上的电子钟停在23:59。最后一班列车开进来，车身上没有线路名。\n\n你把湿透的车票递给列车长。他看了一眼说：「这张票还没用过。」\n\n你低头，原来的目的地消失了。票面浮出一行小字：你没能说再见的那一天。\n\n车门就要关了。',
        [
          pick('a', '上车，坐到那个拿信封的女孩身旁', 'companion', 1),
          pick('b', '问列车长：过去真的能改变吗', 'conductor'),
        ],
      ),
      scene(
        'companion',
        '没有收件人的信',
        '女孩把行李往里挪了挪。「小满。」她报了名字，像在替一段沉默收尾。\n\n窗外忽然是你小时候住过的街。那个已经拆掉的便利店，灯还亮着。\n\n「我试了很多站，」小满说，「总觉得下一站就能说出口。」\n\n她的信封边缘已被反复折得发白。',
        [
          pick('c', '告诉她，你也有一句一直没说的话', 'firststop', 1),
          pick('d', '问她为什么不打开信封', 'letter'),
        ],
        '小满',
      ),
      scene(
        'conductor',
        '单程票',
        '「这列车不能改写过去。」列车长把票夹合上，「但你可以决定，带什么回去。」\n\n他指向车厢里的女孩：「有人带着遗憾上车，又把同一份遗憾带了很多次。」\n\n车轮声变轻，窗外出现你熟悉的路口。那一天，你就是在那里转身离开的。',
        [
          pick('e', '叫上女孩，一起去站台看看', 'firststop', 1),
          pick('f', '先听听她的故事', 'letter'),
        ],
        '列车长',
      ),
      scene(
        'firststop',
        '三分钟',
        '门外站着你想见的人。对方年轻得让你心口一紧，正低头检查手里的购物清单。\n\n列车长开始计时。你知道再过三分钟，这一站就会消失。\n\n小满在你背后轻轻说：「不用找到完美的一句话。人不是因为你说得好，才愿意听你说。」',
        [
          pick('g', '走过去，说一句迟到很久的谢谢', 'goodbye', 1),
          pick('h', '坐在旁边，陪对方过这平常的三分钟', 'company'),
        ],
      ),
      scene(
        'letter',
        '一张白纸',
        '小满终于打开信封。里面什么字也没有。\n\n「我一直以为，写好了再去见他。」她笑了一下，「后来就没有后来。」\n\n车停了。站台上有个抱着热面包的男孩，在等谁下车。小满握紧了你的袖子。你自己的那一站，已经出现在下一站的灯牌上。',
        [
          pick('i', '陪她下车，把自己的那站留到下一次', 'company', 1),
          pick('j', '把笔递给她：现在写第一句也来得及', 'goodbye', 1),
        ],
        '小满',
      ),
      scene(
        'goodbye',
        '终于说出口',
        '你没有准备一段很好的告别。只有几个磕磕绊绊的词，和突然漫上来的眼泪。\n\n对方没有问你为什么迟到。那只熟悉的手，在你肩上轻轻拍了两下。\n\n铃声响起。小满站在车门旁，手里的信已经不在了。她问：「现在回去吗？」',
        [
          pick('k', '带着这句告别回到今天', 'home'),
          pick('l', '留下车票，陪下一位旅人走一段', 'light'),
        ],
      ),
      scene(
        'company',
        '什么也不必补上',
        '你们坐在站台长椅上，分了一只热面包。没有追问，也没有谁必须原谅谁。\n\n列车停得比说好的久了一点。列车长背过身，假装在看表。\n\n原来你想补偿的，不是某个改变一切的决定。只是当年没能好好坐在一起的这一会儿。',
        [
          pick('m', '记住这一刻，回到仍在继续的生活', 'home'),
          pick('n', '请列车长坐下，一起吃完这只面包', 'light', 1),
        ],
      ),
      ending(
        'home',
        '下一站，今天',
        '天亮时，你站在一座普通的车站。手机有信号了，未接来电是还在等你回家的人。\n\n你按下回拨。开口前，喉咙忽然哽了一下。\n\n「没什么事。」你说，「就是想听听你的声音。」\n\n车票变成了一张空白纸。你在背面写下今天的日期，然后走出车站。',
      ),
      ending(
        'light',
        '为后来的人留座',
        '列车长坐下后，很久没有说话。他的票夹里夹着一张旧照片，照片里的人和他一样，帽子总戴得歪一点。\n\n你们没有问那是谁。下一次铃声响起时，是他先站起来，说了声谢谢。\n\n你的车票失去了目的地，却多了一行字：「靠窗的位置，为你保留。」\n\n原来归途也可以是，陪别人回家的一段路。',
      ),
    ],
    endings: [
      { id: 'home', label: '下一站，今天' },
      { id: 'light', label: '为后来的人留座' },
    ],
  },
  {
    id: 'rain-post',
    title: '雨天营业的信件店',
    subtitle: '如果未来的你寄来一封信，你敢不敢拆开？',
    themes: ['治愈', '另一种人生'],
    role: '偶然避雨的普通人',
    cover: './stories/garden.jpg',
    cast: [
      {
        name: '青禾',
        voice: '轻快而耐心，从不替别人下决定',
        publicFacts: ['雨天才开店的店主', '只收信，不卖信'],
        privateFacts: ['从未拆过自己收到的信'],
        goals: ['把信交给愿意打开它的人'],
      },
    ],
    nodes: [
      scene(
        'n1',
        '只在下雨时开门',
        '这条街你走过一百次，却从没见过这家店。门口的木牌写着：「今天有你的信。」\n\n雨水顺着伞尖滴在地板上。店主从一个抽屉里拿出信封，上面是你自己的笔迹。\n\n寄信日期是十年后。\n\n「可以拆开，也可以不拆。」她说，「这里只收取你愿意付出的东西。」',
        [
          pick('a', '先问她，一封信的代价是什么', 'price'),
          pick('b', '拆开信，看看未来的自己写了什么', 'open'),
        ],
        '青禾',
      ),
      scene(
        'price',
        '一段没有用的回忆',
        '「一段你觉得没有用的回忆。」青禾递来一只玻璃瓶。\n\n你想起很多事：一场等了很久的雨，一次没敢报名的旅行，一个已经想不起名字的同桌。\n\n柜台后方摆满了同样的瓶子。有一只在微微发亮，里面传出很轻的笑声。',
        [
          pick('c', '用一次尴尬的失败交换这封信', 'open'),
          pick('d', '先听听那只发光瓶子里的声音', 'bottle', 1),
        ],
        '青禾',
      ),
      scene(
        'open',
        '未来没有标准答案',
        '信里没有彩票号码，也没有任何预言。\n\n「你现在应该正犹豫，要不要离开那份工作。后来我们选择了其中一条路。但我常常想，另一条路上的我们，也许一样会过得很好。」\n\n最后一句被雨水晕开了。只有「别因为害怕」四个字，还能看清。\n\n青禾推来纸和笔：「可以回信。只能一句。」',
        [
          pick('e', '回信：你后来有没有成为喜欢的大人', 'reply'),
          pick('f', '问青禾：她打开过自己的信吗', 'bottle', 1),
        ],
      ),
      scene(
        'bottle',
        '店主的信',
        '瓶子里的笑声来自一场毕业聚会。没有人记得当晚的谈话，却有人愿意用整个周末换回那三秒钟的笑。\n\n青禾摸了摸围裙口袋。里面也有一封信。\n\n「我怕知道未来以后，就再也不会认真过今天了。」她说。雨声渐渐小了。你们同时看向门口。',
        [
          pick('g', '把自己的笔递给她，一起给今天写信', 'reply', 1),
          pick('h', '告诉她：不打开，也是自己的选择', 'leave', 1),
        ],
        '青禾',
      ),
      scene(
        'reply',
        '落笔之前',
        '纸上还空着。你忽然发现，想问未来的每一个问题，其实都在问现在的自己。\n\n你喜欢什么，舍不得什么，愿意为了什么重新开始。\n\n青禾给自己的信写上了今天的日期。她不再往那个旧信封里看。你也终于知道自己想写什么。',
        [
          pick('i', '写下：我会自己走过去，我们到时候见', 'tomorrow'),
          pick('j', '写下：请记住今天这场没有用的雨', 'ordinary'),
        ],
      ),
      scene(
        'leave',
        '把未知留给明天',
        '你把信重新折好，没有带走。青禾没有劝你。\n\n「那就带一样别的吧。」她把那只发光的瓶子放在窗边，笑声混进了渐停的雨声。\n\n你们在店门口站了一会儿。街道和你来时一样，又好像哪里都不一样。',
        [
          pick('k', '给很久没联系的老朋友打个电话', 'ordinary'),
          pick('l', '回家，做那个一直没敢做的决定', 'tomorrow'),
        ],
      ),
      ending(
        'tomorrow',
        '明天还没有写好',
        '第二天，那家店又不见了。你在原来的位置找到一株刚长出来的小草。\n\n你没有突然变得勇敢。做决定时，手还是会抖。但你开始允许自己犯一个属于自己的错误。\n\n十年后的某一天，也许你会写那封信。也许不会。\n\n不管怎样，今天是你自己选的。',
      ),
      ending(
        'ordinary',
        '无用之事的光',
        '电话接通时，对方还记得你的声音。你们聊了很久，全是没什么用的小事。\n\n挂断以后，你发现外套口袋里有一片干燥的花瓣。上面没有任何字，闻起来却像那家店里的雨。\n\n未来并没有给你答案。但从那以后，每到雨天，你都会把脚步放慢一点。\n\n也许路过某扇门时，里面正有人等你。',
      ),
    ],
    endings: [
      { id: 'tomorrow', label: '明天还没有写好' },
      { id: 'ordinary', label: '无用之事的光' },
    ],
  },
];

export function buildCuratedTruth(story: AuthoredStory, now: string): StorybookTruthPackage {
  const pkg = createEmptyTruthPackage({ projectId: story.id, owner: 'storybook-editorial', now });
  const ref = (family: Parameters<typeof makeTruthRef>[1], id: string) =>
    makeTruthRef(story.id, family, id);
  const bibleRef = ref('storybook-bible', 'bible');
  return {
    ...pkg,
    id: `truth-${story.id}`,
    governance: { ...pkg.governance, lifecycle: 'play-ready', reviewState: 'reviewed' },
    scenarioFrame: {
      ref: ref('scenario-frame', 'frame'),
      background: story.subtitle,
      roles: story.cast.map((c, i) => ({
        id: `role-${i}`,
        name: c.name,
        summary: c.publicFacts.join('；'),
      })),
      playerPosition: story.role,
      rules: ['选择会改变经历与结局'],
      contentBoundaries: ['适合一般读者'],
    },
    sourceCast: {
      ref: ref('source-cast', 'cast'),
      sources: story.cast.map((c, i) => ({
        ...c,
        id: `source-${i}`,
        ref: ref('source-profile', `source-${i}`),
        allowedActions: ['对话', '行动'],
        provenance: 'creator',
      })),
    },
    bible: {
      ref: bibleRef,
      premise: story.subtitle,
      worldSummary: story.nodes[0]!.text,
      styleFingerprint: '克制、细腻、有画面感的第二人称短篇',
      rhythmProfile: '短场景与有代价的抉择',
      themes: story.themes,
      approved: true,
    },
    adaptationBrief: {
      ref: ref('adaptation-brief', 'brief'),
      title: story.title,
      premiseSummary: story.subtitle,
      playerPerspective: story.role,
      coreTension: story.themes[1]!,
      targetMilestone: '走完属于自己的故事',
      stylePlan: '有留白的文学叙事',
      pacingPlan: '短场景推进',
      endingDirection: '不同选择留下不同的余韵',
      approval: 'approved',
    },
    branchTopology: {
      ref: ref('branch-topology', 'topo'),
      startChapterId: 'ch1',
      chapterIds: ['ch1'],
      routes: [],
      switchPoints: story.nodes.filter((n) => n.choices.length > 1).map((n) => n.id),
    },
    stateEndingMatrix: {
      ref: ref('state-ending-matrix', 'matrix'),
      variables: [{ id: 'connection', label: '与他人的联结', initial: 0 }],
      flags: [],
      achievements: [],
      endings: story.endings.map((e) => ({ ...e, reachableFromChapterId: 'ch1' })),
    },
    chapters: [
      {
        ref: ref('chapter', 'ch1'),
        id: 'ch1',
        title: story.title,
        startNodeId: 'n1',
        nodes: story.nodes,
      },
    ],
    assets: [
      attachPrebuiltArtifact(
        createAssetSpec({
          ref: ref('asset-spec', 'cover'),
          kind: 'background',
          description: `${story.title} · 封面`,
          requiredness: 'optional',
          now,
        }),
        story.cover,
        'image/jpeg',
        now,
      ),
    ],
    evidence: [
      {
        id: `evidence-${story.id}`,
        truthRef: bibleRef,
        kind: 'edit',
        sourceRef: 'storybook-editorial',
        note: 'Storybook 编辑创作的完整短篇。',
      },
    ],
    projectionInputs: [
      {
        id: `projection-${story.id}`,
        projectionType: 'play',
        governingTruthRefs: [bibleRef, ref('chapter', 'ch1'), ref('asset-spec', 'cover')],
        validationStatus: 'valid',
      },
    ],
  };
}

export function buildCuratedPackage(story: AuthoredStory, now: string) {
  const result = buildPreparedPackage({
    pkg: buildCuratedTruth(story, now),
    producer: 'Storybook 原创',
    now,
  });
  if (result.ok) result.value.manifest.packageId = `storybook-${story.id}`;
  return result;
}
