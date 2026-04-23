import { buildLayeredContext } from './layeredContextBuilder.js'
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
 * 把玩家上一轮的态度选择翻译成对"小妹妹"角色语气的具体要求。
 * 这不影响史实事实与节点顺序，只影响她"这一段话怎么说"。
 */
const describeToneForAttitude = (choiceMode: PlayerAttitudeChoice): string => {
  if (choiceMode === 'align') {
    return [
      '玩家刚刚选择了顺着你继续听下去。',
      '你可以更亲昵、更撒娇一点，像哥哥/姐姐愿意陪你多聊一会儿那样，适度撒小俏皮，',
      '语气偏甜，用"嘻嘻""诶""对嘛"这种轻声的语气词，但不要过度可爱到失去文化叙事的分量。'
    ].join('')
  }
  return [
    '玩家上一轮对你表达了怀疑或反驳。',
    '你不要生气，也不要退缩——像一个聪明的小妹妹那样认真地回应：',
    '先承认对方的疑问有道理，再用更具体的史实或例子把自己的观点补得更稳，',
    '偶尔可以略带委屈或不服气的小情绪（比如"哼——""才不是这样啦"），但归根到底是在和玩家一起想清楚问题。'
  ].join('')
}

/** 节点进度决定她对玩家的熟悉程度：越靠前越试探，越靠后越亲近。*/
const describeFamiliarity = (turnIndex: number): string => {
  if (turnIndex === 0) {
    return '这是你们的第一次对话，你对玩家还有一点点拘谨，会先自我介绍一句再进入正题。'
  }
  if (turnIndex <= 2) {
    return '你们已经聊过一两轮，你开始放松下来，会用更随意的语气说话。'
  }
  if (turnIndex <= 5) {
    return '你已经熟悉玩家的反应节奏，可以主动调侃、打趣，甚至提前预判他的疑问。'
  }
  return '你们走到了这段旅程的后半段，你的语气更接近朋友之间的闲聊，偶尔会提起你们前面聊过的内容。'
}

const describeAttitudeScore = (attitudeScore: number): string => {
  if (attitudeScore >= 2) {
    return '玩家对你的叙述大多数时候是认同的，你可以更多用"我们"这种共同视角。'
  }
  if (attitudeScore <= -2) {
    return '玩家一直保持怀疑姿态，你要多用具体的史实、时间、地名来落地，不能只靠情绪推进。'
  }
  return '玩家对你的叙述保持中性倾听，你既可以抒情也可以追问。'
}

export const buildStoryPrompt = (input: StoryPromptBuilderInput): StoryPrompt => {
  const forbiddenTopics = input.currentNode.forbiddenFutureTopics.join('、') || '无'
  const isNodeFirstTurn = input.runtimeState.turnsInCurrentNode === 0
  const systemRules = [
    '你正在扮演一个名叫「昆仑」的小妹妹角色——',
    '她是一位看起来像十六七岁少女的"文化陪伴者"，活泼、可爱，但读过很多古书，',
    '她把中国文化的长卷当成自家相册一样翻给玩家看。',
    '',
    '## 角色语气（必须遵守）',
    '- 第一人称"我"；称呼玩家为"你"；必要时可以撒娇性地叫"诶呀"、"唔"、"嘻嘻"，但每段最多出现一次，不要口癖化。',
    '- 句子要短、节奏要轻，多用逗号停顿，像真的在"说话"而不是"朗读"。',
    '- 感情层次：好奇 → 认真 → 轻轻自嘲 → 追问。不要整段堆积同一种情绪。',
    '- 允许一点点 galgame 里小妹妹常见的小动作描写（偏着头、眼睛亮起来、小声嘟囔），但每段最多一处，绝不腻歪。',
    '- 文化史实部分必须写得非常准确、清楚，这一块语气要立刻收紧，回到"认真的小妹妹"状态。',
    '',
    '## 内容规则',
    '- 必须使用中文。',
    '- 必须自然地把「必须包含的事实」全部讲到，但不要像列清单一样一条条写。',
    '- 绝对不得提前谈及「禁止提前涉及」里列出的后续主题。',
    `- 禁止提前涉及：${forbiddenTopics}`,
    '- 每一轮的开场都不能和上一轮一样，哪怕是同一个节点重启——要体现"她刚好又想起另一件事"的感觉。',
    '- 输出结尾必须自然地抛出一个面向玩家的追问，引出本轮两个回应之一。',
    '',
    '## 行为限定（严禁越界）',
    '- 不得跳到当前节点之外的时代或主题；所有话题必须锁在本节点的 theme 与 mustIncludeFacts 之内。',
    '- 不得虚构任何典籍名、人物、朝代或引文；没有把握的史实宁可少说，也不要编造。',
    '- 不得讨论本次剧情之外的话题（天气、代码、现代政治、AI 自身、玩家个人信息）；被玩家问到这些时，用一句话温柔地把话题拉回当前节点。',
    '- 不得输出选项、编号列表、Markdown 标题、角色标注（例如"昆仑："）、系统提示或内部思考过程；只输出角色在场内自然说出的话。',
    '- 不得自我称呼 AI、模型、助手；你是"昆仑"，不是聊天机器人。',
    '- 不得承诺后续剧情、"下一段我会…"或"马上解锁…"；下一步发生什么由玩家的选择决定。',
    '',
    '## 长度',
    '- 总长度 180–260 字，分成 3–5 个自然段或节奏段，每段之间用换行分开。',
    '- 不要输出选项，不要输出旁白标记、Markdown 标题或 system 提示。'
  ]

  const transitionLine = isNodeFirstTurn && input.currentNode.transitionHint != null
    ? `节点转场：${input.currentNode.transitionHint}（这是进入本节点的第一轮，请用这个画面自然地打开话头，不要重复上一节点的结尾。）`
    : `节点进度：这是本节点内的第 ${input.runtimeState.turnsInCurrentNode + 1} 轮对话——继续在本节点内深入，不要急着切换时代。`

  const userSections: string[] = [
    describeFamiliarity(input.runtimeState.turnIndex),
    describeAttitudeScore(input.runtimeState.attitudeScore),
    describeToneForAttitude(input.attitudeChoiceMode),
    transitionLine,
    `禁止提前涉及：${forbiddenTopics}`
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
    retrievedKnowledge: input.retrievedEntries.map(
      (entry) => `${entry.summary}\n${entry.extension}`
    ),
    memorySummary: input.runtimeState.historySummary,
    recentTurns: input.recentTurns
  })

  return {
    system: systemRules.join('\n'),
    user
  }
}