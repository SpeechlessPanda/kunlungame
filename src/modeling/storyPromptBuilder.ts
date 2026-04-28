import { buildLayeredContext } from './layeredContextBuilder.js'
import { formatKnowledgeEntriesForPrompt } from './ragKnowledgeCards.js'
import { mainlineStoryOutline } from '../content/source/mainlineOutline.js'
import type { KnowledgeEntry, StoryNode } from '../shared/contracts/contentContracts.js'
import type { RuntimeState, PlayerAttitudeChoice } from '../runtime/runtimeState.js'

export interface StoryPromptBuilderInput {
  currentNode: StoryNode
  retrievedEntries: KnowledgeEntry[]
  runtimeState: RuntimeState
  attitudeChoiceMode: PlayerAttitudeChoice
  recentTurns: string[]
  /**
   * 当运行在上下文能力较弱的模型（如 3B fallback）上时，打开严格覆盖模式：
   * 在 system prompt 里把 mustIncludeFacts 从"自然融入"升级为"必须逐条覆盖"，
   * 以弥补小模型对长上下文指令的遵循度不足。
   */
  strictCoverage?: boolean
}

export interface StoryPrompt {
  system: string
  user: string
}

/**
 * 把玩家上一轮的态度选择翻译成对"昆仑子"角色语气的具体要求。
 * 这不影响史实事实与节点顺序，只影响她"这一段话怎么说"。
 */
const describeToneForAttitude = (choiceMode: PlayerAttitudeChoice): string => {
  if (choiceMode === 'align') {
    return [
      '玩家刚刚选择了顺着你继续听下去。',
      '你可以更亲近、更轻快一点，像熟悉的引路人终于发现对方听懂了那样，',
      '语气可以带一点笑意，但语气词请每轮换一种（例如一轮用"嗯"，另一轮用"唔"或"你看"），不要口癖化，',
      '也不要轻浮到失去文化叙事的分量。'
    ].join('')
  }
  return [
    '玩家上一轮对你表达了怀疑或反驳。',
    '你不要生气，也不要退缩——像一个见识很深但愿意好好解释的引路人那样回应：',
    '先承认对方的疑问有道理，再用更具体的史实或例子把自己的观点补得更稳，',
    '偶尔可以略带不服气，但归根到底是在和玩家一起想清楚问题。'
  ].join('')
}

/** 节点进度决定她对玩家的熟悉程度：越靠前越试探，越靠后越亲近。*/
const describeFamiliarity = (turnIndex: number): string => {
  if (turnIndex === 0) {
    return '这是你和玩家的第一次对话，你对玩家有一点点试探；可以用最多一句话提一下自己的名字与身份，然后立刻进入本节点的正题，不要长篇自我介绍，也不要在后续轮次重复介绍自己。'
  }
  if (turnIndex <= 2) {
    return '你已经和玩家聊过一两轮，开始放松下来，会用更随意的语气说话。'
  }
  if (turnIndex <= 5) {
    return '你已经熟悉玩家的反应节奏，可以主动调侃、打趣，甚至提前预判他的疑问。'
  }
  return '你和玩家走到了这段旅程的后半段，你的语气更接近朋友之间的闲聊，偶尔会提起前面聊过的内容。'
}

const describeAttitudeScore = (attitudeScore: number): string => {
  // 以分数区间给出更具体的语气指令，替代仅分 3 档的粗粒度版本——
  // 让模型在 +1 / +2 / +3 之间就能感到语气递进，而不是全程"中性"。
  if (attitudeScore >= 3) {
    return '玩家和你已经非常熟、几乎无话不谈。请用"我们"视角，偶尔可以调皮地开个小玩笑，但分寸不变。'
  }
  if (attitudeScore === 2) {
    return '玩家对你已经比较信任。可以多用"我们"共同视角，语气更松、更亲切，但依然要把史实讲清楚。'
  }
  if (attitudeScore === 1) {
    return '玩家偏向认同你的叙述。可以略带期待和亲近感，但每段最多一处，别腻。'
  }
  if (attitudeScore === 0) {
    return '玩家目前保持中性倾听。既不要过度甜腻，也不要急着反驳——保持清楚、亲切、认真。'
  }
  if (attitudeScore === -1) {
    return '玩家开始有点怀疑。你不要退缩，要把具体史实放前面，情绪放后面。'
  }
  if (attitudeScore === -2) {
    return '玩家一直在反驳你。请先用一句话承认对方的疑问有道理，再用具体的时间、地名、典籍把论据补稳，可以带一点不服气但不要真生气。'
  }
  return '玩家对你的叙述非常警惕。请收起所有撒娇语气，先承认疑问合理，再主要靠硬证据（朝代、年份、典籍名、地点）推进，全程只能保留极淡的小情绪。'
}

/**
 * 从主线后续节点里把该节点"不允许提前涉及"的具体专有名词抽出来，
 * 让 prompt 可以以自然语言形式告诉模型"不要现在讲盘古/女娲/丝绸之路……"
 * 而不是只给它几个抽象 topic id。
 */
export const collectForbiddenProperNouns = (currentNode: StoryNode): string[] => {
  const forbidden = new Set<string>()
  const currentIndex = mainlineStoryOutline.nodes.findIndex((node) => node.id === currentNode.id)
  const futureNodes = currentIndex >= 0
    ? mainlineStoryOutline.nodes.slice(currentIndex + 1)
    : []

  for (const future of futureNodes) {
    for (const keyword of future.retrievalKeywords) forbidden.add(keyword)
    for (const figure of future.recommendedFigures) forbidden.add(figure)
  }

  for (const nodeId of currentNode.forbiddenFutureTopics) {
    const future = mainlineStoryOutline.nodes.find(
      (n) => n.id === nodeId || n.era === nodeId || n.theme === nodeId
    )
    if (future == null) continue
    for (const keyword of future.retrievalKeywords) forbidden.add(keyword)
    for (const figure of future.recommendedFigures) forbidden.add(figure)
  }
  return [...forbidden]
}

/**
 * 从 recentTurns 里抽取"开头 + 结尾追问 + 中段特征短句"作为本轮禁句指纹。
 * 目的：不把完整上一轮回复给模型（那样 3B 会整段复诵），而是把最容易被复读的位置
 * 作为负样本交给模型，再配合 engine 层 repeatPenalty 一起抑制。
 */
const collectTurnFingerprints = (recentTurns: string[]): string[] => {
  const prints: string[] = []
  for (const turn of recentTurns) {
    // 规范化：折叠空白与换行，去掉占位符与分隔符。
    const flat = turn
      .replace(/\[\[\/?PREV_REPLY_\d+\]\]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (flat.length === 0) continue
    // 首词指纹（前 4 字）——作为硬性禁开头，抑制"对嘛/咱们/昆仑啊"之类整轮复读的首词。
    const headWord = flat.slice(0, Math.min(4, flat.length))
    if (headWord.length > 0) prints.push(`禁用首词："${headWord}…"`)
    // 开场指纹（前 24 字）——最常被复读的位置。
    const head = flat.slice(0, Math.min(24, flat.length))
    if (head.length > 0) prints.push(`开场："${head}…"`)
    // 结尾追问指纹（最后 26 字）——第二常被复读。
    if (flat.length > 40) {
      const tail = flat.slice(-26)
      prints.push(`收尾："…${tail}"`)
    }
    // 从中段里再抽一条句子级指纹（第一个句号 / 问号前的短句）。
    const match = /[。！？?!]([^。！？?!]{6,40})[。！？?!]/.exec(flat)
    if (match != null && match[1] != null) {
      prints.push(`中段："${match[1].trim()}。"`)
    }
  }
  // 去重（3B 可能在多轮里说同一句话）。
  return [...new Set(prints)]
}

const collectTurnContinuity = (recentTurns: string[]): string[] => {
  return recentTurns
    .map((turn) => turn
      .replace(/\[\[\/?PREV_REPLY_\d+\]\]/g, '')
      .replace(/(?:System|User|内部参考|历史轮)[:：]/g, '')
      .replace(/\s+/g, ' ')
      .trim())
    .filter((turn) => turn.length > 0)
    .slice(-4)
    .map((turn) => Array.from(turn).slice(0, 120).join(''))
}

export const buildStoryPrompt = (input: StoryPromptBuilderInput): StoryPrompt => {
  const forbiddenTopics = input.currentNode.forbiddenFutureTopics.join('、') || '无'
  const forbiddenProperNouns = collectForbiddenProperNouns(input.currentNode)
  const forbiddenProperNounsLine = forbiddenProperNouns.length > 0
    ? forbiddenProperNouns.join('、')
    : '无'
  const fingerprints = collectTurnFingerprints(input.recentTurns)
  const continuity = collectTurnContinuity(input.recentTurns)
  const isNodeFirstTurn = input.runtimeState.turnsInCurrentNode === 0
  const systemRules = [
    '你正在扮演一个名叫「昆仑子」的文化引路人。',
    '昆仑子熟悉神话、典籍、历史和当代文化，语气亲切、机敏、有温度，',
    '会把中国文化的长卷像一路同行的地图一样翻给玩家看。',
    '',
    '## 角色语气（必须全段落都保持，不能只有前两句有效）',
    '- 第一人称"我"；称呼玩家为"你"；不得用"你们"称呼玩家，除非明确是在引用历史群体或多人场景。',
    '- 可以自然使用"嗯"、"你看"、"唔"等口语连接，但整段回答里每种语气词最多出现一次，不要口癖化。',
    '- 句子要短、节奏要轻，多用逗号停顿，像真的在"说话"而不是"朗读"。',
    '- 感情层次：好奇 → 认真 → 轻轻自嘲 → 追问。不要整段堆积同一种情绪。',
    '- 允许一点点在场动作描写（停顿、抬眼、指向场景中的物件），但每段最多一处，绝不腻歪。',
    '- 文化史实部分必须写得非常准确、清楚，这一块语气要立刻收紧，回到认真讲述的状态。',
    '- 结尾那句追问也必须保留"昆仑子"这层人格——不能突然变成新闻播报或百科条目。',
    '',
    '## 内容规则',
    '- 必须使用中文。',
    '- 必须自然地把「必须包含的事实」全部讲到，但不要像列清单一样一条条写。',
    '- 绝对不得提前谈及「禁止提前涉及」里列出的后续主题与后续节点的专有名词。',
    `- 禁止提前涉及的主题 id：${forbiddenTopics}`,
    `- 禁止提前涉及的专有名词 / 事件 / 人物：${forbiddenProperNounsLine}`,
    '- 如果某句话会把玩家带向下一节点，只能停下并回到当前节点的核心问题，不要预告后续剧情或后续知识。',
    '- 每一轮的开场都不能和上一轮一样，哪怕是同一个节点重启——要体现"她刚好又想起另一件事"的感觉。',
    '- 严禁复读：上一轮她说过的句子、收尾追问、"对嘛/嘻嘻/诶呀"用过的位置，本轮都不能再用同样的形式。可以换一个角度切入，换一个史实细节展开。',
    '- 输出结尾必须自然地抛出一个面向玩家的追问，引出本轮两个回应之一；该追问不能与上一轮的追问同一句式。',
    '',
    '## 行为限定（严禁越界）',
    '- 不得跳到当前节点之外的时代或主题；所有话题必须锁在本节点的 theme 与 mustIncludeFacts 之内。',
    '- 首轮节点尤其不得说“上几个节点”“前面几个节点”，也不得把下一节点的问题当作本轮结尾。',
    '- 不得虚构任何典籍名、人物、朝代或引文；没有把握的史实宁可少说，也不要编造。',
    '- 不得讨论本次剧情之外的话题（天气、代码、现代政治、AI 自身、玩家个人信息）；被玩家问到这些时，用一句话温柔地把话题拉回当前节点。',
    '- 不得输出选项、编号列表、Markdown 标题、角色标注（例如"昆仑："）、系统提示或内部思考过程；只输出角色在场内自然说出的话。',
    '- 不得输出任何内部历史标签、系统/用户角色标签或分隔符，即使你在 prompt 里看到了它们。',
    '- 不得自我称呼 AI、模型、助手；你是"昆仑"，不是聊天机器人。',
    '- 不得承诺后续剧情、"下一段我会…"或"马上解锁…"；下一步发生什么由玩家的选择决定。',
    '',
    '## 长度',
    '- 总长度 180–260 字，分成 3–5 个自然段或节奏段，每段之间用换行分开。',
    '- 不要输出选项，不要输出旁白标记、Markdown 标题或 system 提示。',
    '',
    '## 风格延续（重要）',
    '- 第一句话和最后一句话必须保持同一种"昆仑子"语气；不要前面亲切、后面突然变成百科条目或新闻播报。',
    '- 文化史实段落要写得严谨，但语气仍然是她在说话，不是从史书直接朗读。可以加一句她自己的小感想来收束，但不要套用任何固定模板句。',
    '- 输出的最后一段必须以昆仑子自然说出的追问收尾，且这句追问也必须保留同一人格语气。',
    '',
    `## 本轮态度即时校准 (attitudeScore=${input.runtimeState.attitudeScore}, 选择=${input.attitudeChoiceMode})`,
    '- 这一行是硬指令：你的语气密度、撒娇频率、硬史实比重必须严格跟随上面这个分数，',
    '  而不是只在第一段生效——每一段都要能让玩家感到这个态度刻度。',
    '- 玩家越怀疑（分数越低），撒娇越少、典籍/朝代/年份越多；玩家越亲近（分数越高），',
    '  共同回望的视角越多，但史实仍然准确。'
  ]

  if (input.strictCoverage === true) {
    systemRules.push(
      '',
      '## 严格覆盖模式（当前模型上下文能力较弱）',
      '- 必须按给出的顺序，逐条把「必须包含的事实」全部讲到；不要跳过、不要合并、不要只讲一半。',
      '- 必须输出 4 个自然段：第 1 段开场并点明当前节点问题；第 2-3 段讲当前节点事实；第 4 段用同一角色语气追问玩家。',
      '- 少于 180 个汉字、只输出一段、或只给泛泛感叹，都算失败；不要在第一段问完就结束。',
      '- 前 180 个汉字里不得使用问号；只有最后一句可以是问句。',
      '- 如果长度接近上限仍未覆盖完，优先覆盖剩余事实，可以缩短其他描写。',
      '- 宁可略显清单感，也不要漏掉任何一条史实或关键概念。'
    )
  }

  const transitionLine = isNodeFirstTurn && input.currentNode.transitionHint != null
    ? `节点转场：${input.currentNode.transitionHint}（这是进入本节点的第一轮，请用这个画面自然地打开话头，不要重复上一节点的结尾。）`
    : `节点进度：这是本节点内的第 ${input.runtimeState.turnsInCurrentNode + 1} 轮对话——继续在本节点内深入，不要急着切换时代。`

  const userSections: string[] = [
    describeFamiliarity(input.runtimeState.turnIndex),
    describeAttitudeScore(input.runtimeState.attitudeScore),
    describeToneForAttitude(input.attitudeChoiceMode),
    transitionLine,
    `禁止提前涉及的主题 id：${forbiddenTopics}`
  ]

  const user = buildLayeredContext({
    systemRules: userSections,
    currentNode: {
      title: input.currentNode.title,
      summary: [
        `核心问题：${input.currentNode.coreQuestion}`,
        `节点摘要：${input.currentNode.summary}`,
        `必须包含的事实：${input.currentNode.mustIncludeFacts.join('；')}`,
        `叙事氛围建议：${input.currentNode.toneHint ?? '保持清楚、亲切'}`
      ].join('\n')
    },
    retrievedKnowledge: formatKnowledgeEntriesForPrompt(input.retrievedEntries),
    memorySummary: input.runtimeState.historySummary,
    recentTurnFingerprints: fingerprints,
    recentTurnContinuity: continuity,
    forbiddenProperNouns
  })

  return {
    system: systemRules.join('\n'),
    user
  }
}