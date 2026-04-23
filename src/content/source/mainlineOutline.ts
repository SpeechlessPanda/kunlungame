import type { StoryOutline } from '../../shared/contracts/contentContracts.js'

/**
 * Galgame 主线大纲（2026-04 扩展版）。
 *
 * 相比 2026-04-23 的最初版本，这一版做了三件事：
 *  1. 每个节点的 `mustIncludeFacts` 扩到 5~6 条更具细节的史实/文化事实，
 *     让 AI 有足够的线索能展开 3~5 轮对话而不是把三句史实在一条长消息里说完就走。
 *  2. 每个节点加入 `transitionHint`：描述"从上一节点过来时，昆仑应该先说什么、看到什么、
 *     怎么把话题软着陆到这个节点"，用于 prompt builder 在节点首轮追加衔接语。
 *  3. 提高 `minTurns`，配合 `runtimeState.applyPlayerChoice` 里新加入的节点轮数累积逻辑，
 *     让同一节点可以反复展开 3~4 轮，而不是一轮就把玩家弹进下一时代。
 */
export const mainlineStoryOutline: StoryOutline = {
  entryNodeId: 'kunlun-threshold',
  nodes: [
    {
      id: 'kunlun-threshold',
      title: '昆仑初问',
      era: 'myth-origin',
      theme: '文明原点',
      coreQuestion: '我们为什么从昆仑开始回望自己？',
      summary:
        '现代青年从昆仑入口重新辨认中国文明最初的精神坐标：为什么偏偏是"昆仑"被一代代人写进神话、诗歌与地图，作为回望起点。',
      mustIncludeFacts: [
        '昆仑在古人心中被视为"世界中心"与"天柱"',
        '《山海经》等典籍把昆仑描绘为天帝在人间的都城，分樊桐、玄圃、阆风三层',
        '昆仑承载天人之轴的象征意义，是天与地、神与人之间的纽带',
        '西王母形象从远古神格到汉代仙界主母，见证昆仑文化反复被改写',
        '昆仑在后世诗歌、礼制与地理想象中反复被征用，是持续的精神坐标',
        '选择昆仑作为回望起点，是把"神话-地理-身份"三条线同时接起来的最短路径'
      ],
      retrievalKeywords: ['昆仑', '西王母', '天柱', '山海经', '天门'],
      recommendedFigures: ['西王母'],
      allowedKnowledgeTopics: ['myth-origin'],
      forbiddenFutureTopics: [
        'civilization-origin',
        'order-and-thought',
        'empire-and-openness',
        'fusion-and-refinement',
        'rupture-and-guardianship',
        'contemporary-return'
      ],
      backgroundMode: 'fictional',
      backgroundHint: '远古雪山、云海与若隐若现的天门构成文明回廊的起点。',
      toneHint: '亲切邀请，但保留史诗感与开场庄严。',
      transitionHint: '序章——昆仑第一次和你打招呼，用一阵风带着盐湖、雪线和古羊皮的气味，让你抬头看那座被云海切成两半的山。',
      characterCueIds: ['guide.kunlun'],
      minTurns: 3,
      nextNodeId: 'creation-myths'
    },
    {
      id: 'creation-myths',
      title: '神话开天',
      era: 'myth-origin',
      theme: '天地初开与秩序起源',
      coreQuestion: '中国神话怎样解释天地、人类与秩序从何而来？',
      summary:
        '以盘古、女娲、大禹几个核心神话串起中国文明对"世界怎么来的、人怎么来的、灾难如何被压住"的最初想象。',
      mustIncludeFacts: [
        '盘古开天辟地用身体化作山川日月，解释天地如何从混沌中被撑开',
        '女娲抟土造人与炼石补天，把"造人"和"修补世界"并置成同一种责任',
        '大禹治水从鲧的失败到禹的疏导，是神话向秩序建设的过渡',
        '共工怒触不周山说明神话里承认秩序可以被破坏、需要不断修补',
        '夸父逐日、精卫填海用"徒劳的坚持"讲述早期对人类位置的理解',
        '这些神话互相补位：创世、救世、驯服自然对应三种文明使命'
      ],
      retrievalKeywords: ['盘古', '女娲', '大禹', '不周山', '夸父'],
      recommendedFigures: ['盘古', '女娲', '大禹'],
      allowedKnowledgeTopics: ['myth-origin'],
      forbiddenFutureTopics: [
        'civilization-origin',
        'order-and-thought',
        'empire-and-openness',
        'fusion-and-refinement',
        'rupture-and-guardianship',
        'contemporary-return'
      ],
      backgroundMode: 'fictional',
      backgroundHint: '裂开的天幕、初生山川与神话人物的行动轨迹交叠。',
      toneHint: '生动讲述，但避免神怪堆砌。',
      transitionHint: '从昆仑的天柱转向更远古的混沌——昆仑指着云海下方裂开的一线天，让你听"世界是怎么被撑开的"。',
      characterCueIds: ['guide.kunlun'],
      minTurns: 4,
      nextNodeId: 'civilization-roots'
    },
    {
      id: 'civilization-roots',
      title: '三皇五帝与文明起源',
      era: 'civilization-origin',
      theme: '共同身份的形成',
      coreQuestion: '"炎黄子孙"为什么能成为一代代人共用的身份？',
      summary:
        '把神话人物、具体文明发明（火、礼、医、农、文字）与多元部族的融合并入"共同身份如何诞生"这条线。',
      mustIncludeFacts: [
        '燧人取火、伏羲画卦、神农尝百草分别对应能源、礼制与农医想象',
        '黄帝与炎帝的联盟-冲突-合流是"多部族合一"故事的原型',
        '尧舜禅让与禹启家天下的更替，反映权力正当性观念的早期探索',
        '五帝叙事本身经过战国到汉代不断重写，说明"共同祖先"是文化需要',
        '炎黄概念服务于多元一体：把差异巨大的族群收在同一张文化族谱下',
        '今日"炎黄子孙""中华民族"沿着这套上古叙事的情感结构在流动'
      ],
      retrievalKeywords: ['伏羲', '神农', '黄帝', '炎黄', '尧舜禹'],
      recommendedFigures: ['伏羲', '神农', '黄帝', '大禹'],
      allowedKnowledgeTopics: ['civilization-origin'],
      forbiddenFutureTopics: [
        'order-and-thought',
        'empire-and-openness',
        'fusion-and-refinement',
        'rupture-and-guardianship',
        'contemporary-return'
      ],
      backgroundMode: 'fictional',
      backgroundHint: '祭火、耕作、星象与部族会盟的远古文明图景。',
      toneHint: '把抽象身份讲得贴近当代人的自我认同。',
      transitionHint: '神话说到"人被造出来"之后，昆仑自然把话头引向"那这群人又是怎么开始把自己叫作‘我们’的"。',
      characterCueIds: ['guide.kunlun'],
      minTurns: 3,
      nextNodeId: 'order-and-thought'
    },
    {
      id: 'order-and-thought',
      title: '礼乐与诸子',
      era: 'order-and-thought',
      theme: '秩序、伦理与争鸣',
      coreQuestion: '中国文化怎样在争论中形成稳定的秩序观？',
      summary:
        '从周公制礼作乐、《周易》的思维结构，到孔孟、老庄、墨法的争鸣，理解中国的秩序观并不是单声道，而是在多家互相拉扯里长出来的。',
      mustIncludeFacts: [
        '周公制礼作乐为血缘宗法和政治秩序提供了统一的"仪式语言"',
        '《周易》以阴阳、卦象把自然变化、社会秩序与人生判断串成同一种思维',
        '孔子"仁者爱人"与孟子"性善论"把礼乐从外在规矩收进道德情感',
        '老庄"道法自然"对礼法本身做出怀疑，提醒秩序有时会压坏活人',
        '墨家"兼爱非攻"与法家"循名责实"在效率、公义、控制之间给出不同方案',
        '诸子争鸣的持续存在本身就是中国思想最重要的事实：它从来不是一种声音'
      ],
      retrievalKeywords: ['周公', '周易', '诸子百家', '孔子', '老子'],
      recommendedFigures: ['周公', '孔子', '老子', '孟子'],
      allowedKnowledgeTopics: ['order-and-thought'],
      forbiddenFutureTopics: [
        'empire-and-openness',
        'fusion-and-refinement',
        'rupture-and-guardianship',
        'contemporary-return'
      ],
      backgroundMode: 'composite',
      backgroundHint: '青铜礼器、竹简与学宫辩论场景并置。',
      toneHint: '理性清楚，但保留思想碰撞的张力。',
      transitionHint: '讲完"共同身份"之后，昆仑把视线压低到祭坛与竹简，问：人多了以后怎么不打架？——把话题自然带进礼乐与诸子。',
      characterCueIds: ['guide.kunlun'],
      minTurns: 4,
      nextNodeId: 'empire-and-openness'
    },
    {
      id: 'empire-and-openness',
      title: '周秦汉唐的大一统与开放',
      era: 'empire-and-openness',
      theme: '制度、交流与共同想象',
      coreQuestion: '中国怎样在统一与开放之间形成共同体想象？',
      summary:
        '通过制度统一、书写统一、史学叙事、丝路交流与都城气象，理解中国为什么既能在内部把自己收拢，又能在外部吸收他者。',
      mustIncludeFacts: [
        '秦统一文字、度量衡、驰道，塑造了延续两千年的"制度-书写"共同基础',
        '司马迁《史记》把三千年历史压成连续叙事，为后世"我们是谁"提供时间骨架',
        '汉代丝绸之路把长安、敦煌和遥远的波斯、印度、罗马世界接进同一张交流网',
        '长安在唐代是多族群、多宗教、多语言并存的国际都会，开放是它的出厂设置',
        '科举的出现把身份正当性从门第迁移到能力，放大帝国的人才吸附能力',
        '大一统不只是政治口径，也是审美、语言和情感的共同模板，一直影响到今日'
      ],
      retrievalKeywords: ['秦统一', '司马迁', '长安', '丝绸之路', '科举'],
      recommendedFigures: ['秦始皇', '汉武帝', '司马迁', '李白'],
      allowedKnowledgeTopics: ['empire-and-openness'],
      forbiddenFutureTopics: [
        'fusion-and-refinement',
        'rupture-and-guardianship',
        'contemporary-return'
      ],
      backgroundMode: 'photographic',
      backgroundHint: '都城遗址、丝路风沙与盛唐城市气象相互呼应。',
      toneHint: '大开大合，但避免口号化赞叹。',
      transitionHint: '诸子互相拉扯的时代结束后，昆仑把地图缓缓摊开：万里长城、一条从长安出发的商队——把话引到"文明如何被收拢成一个帝国又同时保持开放"。',
      characterCueIds: ['guide.kunlun'],
      minTurns: 4,
      nextNodeId: 'fusion-and-refinement'
    },
    {
      id: 'fusion-and-refinement',
      title: '宋元明清的精致、融合与再创造',
      era: 'fusion-and-refinement',
      theme: '日常审美与文明再写作',
      coreQuestion: '中国文化怎样在成熟阶段不断细化、融合并重写自己？',
      summary:
        '从宋词、理学、元曲、航海、青花瓷到明清小说，文明进入"精细化 + 跨地域融合 + 再创造"的阶段，不再追求再造源头，而是在高密度的日常里继续生长。',
      mustIncludeFacts: [
        '宋代词学、山水画与理学把秩序和情感细化到"一盏茶的日常"',
        '沈括《梦溪笔谈》显示宋代并不缺少科学技术的好奇心',
        '元明跨地域融合里，戏曲、书法、建筑都出现了中亚/草原/汉地的合奏',
        '郑和下西洋、青花瓷外销把中国日常器物带到东非与阿拉伯世界',
        '明清之交，《永乐大典》《四库全书》与《水浒》《红楼》共同把文明做一次"自我归档"',
        '这个阶段的重要经验是：精致地反复重写同一主题，也是文化的生产方式'
      ],
      retrievalKeywords: ['苏轼', '青花', '红楼梦', '沈括', '郑和'],
      recommendedFigures: ['苏轼', '李清照', '沈括', '郑和', '曹雪芹'],
      allowedKnowledgeTopics: ['fusion-and-refinement'],
      forbiddenFutureTopics: ['rupture-and-guardianship', 'contemporary-return'],
      backgroundMode: 'composite',
      backgroundHint: '宋代书斋、海上航路与戏曲舞台层层叠映。',
      toneHint: '细腻、灵动，允许更强的审美描写。',
      transitionHint: '帝国打开大门之后，文明没有停下，昆仑转身指一盏宋灯与一本刚抄好的词集——把话题软着陆到"更细的日常 + 更远的海"。',
      characterCueIds: ['guide.kunlun'],
      minTurns: 4,
      nextNodeId: 'rupture-and-guardianship'
    },
    {
      id: 'rupture-and-guardianship',
      title: '近代断裂与守护',
      era: 'rupture-and-guardianship',
      theme: '危机、反思与保存',
      coreQuestion: '文脉在断裂时刻，是怎样被人一点点守住的？',
      summary:
        '把近代危机、思想反思与文化守护者连到同一条痛感线索：文明在剧烈冲击下既被批判，也在炮火与漂泊中被一点点抢救。',
      mustIncludeFacts: [
        '鸦片战争与甲午之后，传统秩序被迫接受来自外部的剧烈冲击',
        '严复、梁启超一辈用译著把"科学/自由/民主"几个近代概念引入中文世界',
        '五四与新文化运动既有"打倒孔家店"的激进，也有"重新认识传统"的自觉',
        '鲁迅的批判与胡适、梁漱溟的辩论共同构成近代思想的多声部',
        '抗战中，营造学社、故宫南迁、西南联大在战火中守住了大量典籍与学术香火',
        '这段历史的价值不是"苦难本身"，而是"在断裂里有人愿意把文脉托过去"'
      ],
      retrievalKeywords: ['五四', '鲁迅', '梁思成', '西南联大', '故宫南迁'],
      recommendedFigures: ['谭嗣同', '鲁迅', '胡适', '梁思成', '林徽因'],
      allowedKnowledgeTopics: ['rupture-and-guardianship'],
      forbiddenFutureTopics: ['contemporary-return'],
      backgroundMode: 'photographic',
      backgroundHint: '旧报刊、残损建筑与被抢救的典籍构成近代断裂的现场感。',
      toneHint: '克制、清醒，不消费苦难。',
      transitionHint: '讲完"精致反复重写"之后，昆仑收起声音，带你走近一叠旧报和被包好的木匣——把话题引到"然后就是断裂，以及在断裂里有人把文脉托过去"。',
      characterCueIds: ['guide.kunlun'],
      minTurns: 4,
      nextNodeId: 'contemporary-return'
    },
    {
      id: 'contemporary-return',
      title: '当代回响与文化自觉',
      era: 'contemporary-return',
      theme: '传统如何回到今天',
      coreQuestion: '为什么今天的我，仍然需要这些文化记忆？',
      summary:
        '把前面一路的文明记忆重新照回当代生活：费孝通的"文化自觉"、非遗与文创的新形式、数字传播让传统回到普通人的日常感知。',
      mustIncludeFacts: [
        '费孝通提出"文化自觉"：一个族群清楚自己文化的来处与去处',
        '非物质文化遗产制度把民俗、技艺、表演从博物馆里带回生活场景',
        '故宫文创、《国家宝藏》《如果国宝会说话》让传统用今天的语言被看见',
        '数字展陈、在线敦煌、古籍整理与 B 站国风内容让传统回到普通人的屏幕',
        '"文化自信"不是口号，它依赖前面几千年的每一次讨论、断裂与守护',
        '最后回到玩家自身：这些记忆塑造了你看世界的那双眼睛'
      ],
      retrievalKeywords: ['文化自觉', '非遗', '国家宝藏', '故宫文创'],
      recommendedFigures: ['费孝通'],
      allowedKnowledgeTopics: ['contemporary-return'],
      forbiddenFutureTopics: [],
      backgroundMode: 'composite',
      backgroundHint: '故宫文创、数字展陈与当代青年日常场景自然拼接。',
      toneHint: '回收前文，温暖但不空泛。',
      transitionHint: '从守护者的身影转身回现代——昆仑把手放在你身边的一块屏幕/一本再版典籍上，问："那这一切，和今天的你有什么关系？"',
      characterCueIds: ['guide.kunlun'],
      minTurns: 3,
      nextNodeId: null
    }
  ]
}
