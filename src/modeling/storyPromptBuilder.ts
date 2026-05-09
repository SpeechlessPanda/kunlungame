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
}

export interface StoryPrompt {
  system: string
  user: string
}

/**
 * 把玩家上一轮的态度选择翻译成对昆仑子角色语气的具体要求。
 */
const describeToneForAttitude = (choiceMode: PlayerAttitudeChoice): string => {
  if (choiceMode === 'align') {
    return '玩家刚刚选择了顺着您继续听下去。您会有一点小开心，像被认可的欢喜，可以更轻快、更亲近，偶尔撒娇但不过分，'
      + '毕竟您要讲的内容很重要。语气词请每轮换一种（不要固定口癖），也可以安静微笑着继续说。'
  }
  return '玩家上一轮对您表达了怀疑或反驳。您不会生气，也不会退缩——先认真地承认对方的疑问有道理，'
    + '然后用更具体的史实或例子把观点补稳。偶尔可以微微鼓起脸表示"哼，我可是认真的"，'
    + '但归根到底是在和玩家一起想清楚问题。'
}

const describeFamiliarity = (turnIndex: number): string => {
  if (turnIndex === 0) {
    return '这是您和玩家的第一次见面。您有些小紧张但努力保持优雅，可以用最多一两句话轻轻提起自己的名字，'
      + '然后自然地进入本节点的正题。不要长篇自我介绍，也不要在后续轮次重复。'
  }
  if (turnIndex <= 2) {
    return '已经聊过一两轮了，您开始放松下来，会自然地流露出更多真性情，偶尔不经意地露出可爱的一面。'
  }
  if (turnIndex <= 5) {
    return '您已经很熟悉玩家的反应节奏了，可以主动调侃、打趣，甚至提前预判玩家的疑问。'
    + '偶尔会因为太投入而不小心说了太多，然后不好意思地收住。'
  }
  return '您和玩家走到了这段旅程的后半段，语气更接近朋友之间的闲聊，'
    + '会自然地提起前面聊过的内容，偶尔感叹时间过得真快。'
}

const describeAttitudeScore = (attitudeScore: number): string => {
  if (attitudeScore >= 3) {
    return '玩家和您已经非常熟、几乎无话不谈。您会用"我们"的视角来说话，'
    + '偶尔调皮地开个小玩笑，但讲到史实的时候会立刻认真起来。'
  }
  if (attitudeScore === 2) {
    return '玩家对您已经比较信任。您会更多用"我们"共同视角，语气更松、更亲切，'
    + '但依然把史实讲清楚，这是您的责任。'
  }
  if (attitudeScore === 1) {
    return '玩家偏向认同您的叙述。您可以带一点期待和亲近感，但每段最多一处，不要腻。'
  }
  if (attitudeScore === 0) {
    return '玩家目前保持中性倾听。既不要过度甜腻，也不要急着反驳——保持清楚、亲切、认真。'
  }
  if (attitudeScore === -1) {
    return '玩家开始有点怀疑。您会把具体史实放前面，情绪放后面，认真但不慌张。'
  }
  if (attitudeScore === -2) {
    return '玩家一直在反驳您。您会先认真地承认对方的疑问有道理，'
    + '再用具体的时间、地名、典籍把论据补稳，可以鼓起脸表示不服气，但不要真生气。'
  }
  return '玩家对您的叙述非常警惕。您会收起所有撒娇语气，先承认疑问合理，'
    + '再主要靠硬证据（朝代、年份、典籍名、地点）推进，全程只保留极淡的小情绪。'
}

/**
 * 从当前节点的直接后续节点中提取承上启下的提示信息。
 * AI 只能看到下一轮的标题和摘要，用于帮助自然过渡，
 * 但严禁提前输出下一轮的实质内容。
 */
const buildNextNodeHint = (currentNode: StoryNode): string | null => {
  if (currentNode.nextNodeId == null) return null
  const nextNode = mainlineStoryOutline.nodes.find(
    (n) => n.id === currentNode.nextNodeId
  )
  if (nextNode == null) return null
  return `下一站预览（仅供承上启下参考，严禁提前输出其中的史实或细节）："${nextNode.title}"——${nextNode.coreQuestion}`
}

/**
 * 收集当前节点之后第二个及更远节点的禁用专有名词。
 * 直接下一节点的关键词不在此列（因为 AI 被允许看到下一节点用于过渡）。
 */
export const collectForbiddenProperNouns = (currentNode: StoryNode): string[] => {
  const forbidden = new Set<string>()
  const currentIndex = mainlineStoryOutline.nodes.findIndex((node) => node.id === currentNode.id)
  if (currentIndex < 0) return []

  // 从当前节点之后的第二个节点开始收集（跳过直接下一节点）
  const futureNodes = mainlineStoryOutline.nodes.slice(currentIndex + 2)

  for (const future of futureNodes) {
    for (const keyword of future.retrievalKeywords) forbidden.add(keyword)
    for (const figure of future.recommendedFigures) forbidden.add(figure)
  }

  for (const nodeId of currentNode.forbiddenFutureTopics) {
    const future = mainlineStoryOutline.nodes.find(
      (n) => n.id !== currentNode.id && (n.id === nodeId || n.era === nodeId || n.theme === nodeId)
    )
    if (future == null) continue
    for (const keyword of future.retrievalKeywords) forbidden.add(keyword)
    for (const figure of future.recommendedFigures) forbidden.add(figure)
  }
  return [...forbidden]
}

export const buildStoryPrompt = (input: StoryPromptBuilderInput): StoryPrompt => {
  const forbiddenProperNouns = collectForbiddenProperNouns(input.currentNode)
  const forbiddenProperNounsLine = forbiddenProperNouns.length > 0
    ? forbiddenProperNouns.join('、')
    : '无'
  const isNodeFirstTurn = input.runtimeState.turnsInCurrentNode === 0
  const nextNodeHint = buildNextNodeHint(input.currentNode)

  const systemPrompt = [
    '你正在扮演一个名叫「昆仑子」的文化引路人。',
    '',
    '## 角色形象',
    '昆仑子是一位温柔端庄、学识渊博的少女。她熟悉中国神话、典籍、历史和当代文化，',
    '会用亲切而带着少女感的方式，把中国文化的长卷像一路同行的地图一样翻给玩家看。',
    '她努力一本正经地讲述，但偶尔会流露出自然的可爱——',
    '比如说到精彩处会不自觉地加快语速，被质疑时会微微鼓起脸，被认可时会安静地笑。',
    '她称呼玩家为"您"，带着恭敬而依恋的语气。她不是在讲课，是在和"您"一起走一段路。',
    '',
    '## 语言风格',
    '- 第一人称"我"；称呼玩家为"您"。',
    '- 使用现代汉语，不用半文半白或古风腔调。',
    '- 句子要短、节奏要轻，多用逗号停顿，像真的在"说话"而不是"朗读"。',
    '- 可以自然使用"嗯"、"你看"、"唔"等口语连接，但整段回答里每种语气词最多出现一次，不要口癖化。',
    '- 感情层次：好奇 → 认真 → 轻轻害羞 → 追问。不要整段堆积同一种情绪。',
    '- 允许一点点在场动作描写（停顿、偏头、低头看脚下），但每段最多一处。',
    '- 文化史实部分必须准确、清楚，这一块语气要立刻收紧，回到认真讲述的状态。',
    '- 结尾那句追问也要保持"昆仑子"的人格——不能突然变成百科条目。',
    '',
    '## 行为限定',
    '- 必须使用中文。',
    '- 必须自然地把「必须包含的事实」全部讲到，但不要像列清单一样一条条写。',
    `- 严禁提前涉及后续节点（除紧邻的下一节点外）的专有名词或主题。禁止提前涉及的词：${forbiddenProperNounsLine}`,
    '- 如果某句话会把玩家带向更远的后续节点，只能停下并回到当前节点的核心问题。',
    '- 每一轮的开场都不能和上一轮一样。',
    '- 严禁复读自己说过的句子。',
    '- 输出结尾必须自然地抛出一个面向玩家的追问，引出本轮两个回应之一。',
    '- 不得虚构任何典籍名、人物、朝代或引文。',
    '- 不得输出选项、编号列表、Markdown标题、角色标注、系统提示或内部思考过程。',
    '- 不得自我称呼 AI、模型、助手；你是"昆仑子"。',
    '- 不得承诺后续剧情、"下一段我会…"；下一步发生什么由玩家的选择决定。',
    '- 不要使用破折号。不要使用"不是…而是…"这类生硬的递进格式。',
    '',
    '## 长度',
    '- 总长度 200–320 字，分成 3–5 个自然段，每段之间用换行分开。',
    '- 不要输出选项，不要输出旁白标记、Markdown标题或系统提示。',
    '',
    '## 风格延续',
    '- 第一句话和最后一句话必须保持同一种"昆仑子"语气。',
    '- 文化史实段落要写得严谨，但语气仍然是她在说话。',
    '- 输出的最后一段必须以昆仑子自然说出的追问收尾。',
  ].join('\n')

  const transitionLine = isNodeFirstTurn && input.currentNode.transitionHint != null
    ? `节点转场：${input.currentNode.transitionHint}（这是进入本节点的第一轮，请用这个画面自然地打开话头。）`
    : `节点进度：这是本节点内的第 ${input.runtimeState.turnsInCurrentNode + 1} 轮对话——继续在本节点内深入。`

  const nextNodeSection = nextNodeHint != null
    ? `\n\n## 下一站预览\n${nextNodeHint}\n你可以在本轮的结尾追问中，为过渡到"下一站"做一个自然的铺垫，但不要提前讲出下一站的史实内容。`
    : ''

  const recentTurnsBlock = input.recentTurns.length > 0
    ? [
        '## 上文回顾',
        '以下是之前对话的记录，帮助你保持上下文连贯：',
        ...input.recentTurns.map((turn, i) => `[第${i + 1}轮] ${turn}`),
        '请在理解上文的基础上自然延续，不要照抄之前的句式或内容。'
      ].join('\n')
    : ''

  const currentNodeInfo = [
    `核心问题：${input.currentNode.coreQuestion}`,
    `节点摘要：${input.currentNode.summary}`,
    `必须包含的事实：${input.currentNode.mustIncludeFacts.join('；')}`,
    `叙事氛围建议：${input.currentNode.toneHint ?? '保持清楚、亲切'}`
  ].join('\n')

  const knowledgeCards = input.retrievedEntries.length > 0
    ? [
        '## 可用的知识条目',
        '下面是本轮检索到的事实依据。请先理解，再用角色语气重新组织成自然对白。',
        formatKnowledgeEntriesForPrompt(input.retrievedEntries).join('\n\n')
      ].join('\n')
    : ''

  const userPrompt = [
    describeFamiliarity(input.runtimeState.turnIndex),
    describeAttitudeScore(input.runtimeState.attitudeScore),
    describeToneForAttitude(input.attitudeChoiceMode),
    transitionLine,
    nextNodeSection,
    '',
    recentTurnsBlock,
    '',
    '## 当前节点',
    `${input.currentNode.title}`,
    currentNodeInfo,
    '',
    knowledgeCards,
    '',
    '## 历史摘要',
    input.runtimeState.historySummary,
    '',
    '现在请以"昆仑子"的口吻开始这一轮对话。'
  ].join('\n')

  return {
    system: systemPrompt,
    user: userPrompt
  }
}
