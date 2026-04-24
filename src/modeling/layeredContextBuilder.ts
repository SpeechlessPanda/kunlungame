export interface LayeredContextInput {
  systemRules: string[]
  currentNode: {
    title: string
    summary: string
  }
  retrievedKnowledge: string[]
  memorySummary: string
  /**
   * 你（storyPromptBuilder）已经从每段历史输出里抽了"开场+收尾+特征句"的指纹。
   * 本层不直接展示玩家 / 模型上一轮的完整回复——3B 会把完整的上一轮输出当作模板
   * 几乎逐字重排。只把指纹作为"禁句"注入，配合 engine 层的 repeatPenalty 抑制复读。
   */
  recentTurnFingerprints?: string[]
  /**
   * 额外注入的"本轮必须避开的开头 / 口癖"清单。会与 recentTurnFingerprints 合并展示。
   */
  avoidOpeners?: string[]
  /**
   * 由 storyPromptBuilder 注入的、从后续节点展开出来的禁用专有名词 / 主题词。
   * 这里用自然语言点名，避免只说抽象的 topic id，让模型看得懂。
   */
  forbiddenProperNouns?: string[]
}

/**
 * 把本轮需要的上下文拼成一段结构化中文 prompt。
 *
 * 设计要点：
 *   1) 不把完整的上一轮输出回传给模型——3B 实测会把它当模板整段复诵；
 *      storyPromptBuilder 会先抽取开场+收尾指纹，作为禁句列表传进来。
 *   2) 最后一段 `# 现在开始说话` 明确告诉模型"不得出现分隔线/元标签/模板化开头"，
 *      配合 realLlamaSession 的 repeatPenalty 抑制复读。
 */
export const buildLayeredContext = (input: LayeredContextInput): string => {
  const bannedPhrases: string[] = [
    ...(input.avoidOpeners ?? []),
    ...(input.recentTurnFingerprints ?? [])
  ]
  const avoidBlock = bannedPhrases.length > 0
    ? bannedPhrases.map((phrase, i) => `- 禁句 ${i + 1}：${phrase}`).join('\n')
    : '（本轮没有额外禁句，但依然不得复读自己上一轮的任何句子。）'

  const forbiddenNounsBlock =
    input.forbiddenProperNouns != null && input.forbiddenProperNouns.length > 0
      ? `本轮严禁提到以下后续节点才会展开的专有名词 / 人物 / 事件：${input.forbiddenProperNouns.join('、')}。`
      : '（本节点没有额外需要避开的后续专有名词。）'

  const sections: Array<[string, string]> = [
    ['# 固定规则', input.systemRules.join('\n')],
    ['# 当前节点', `${input.currentNode.title}\n${input.currentNode.summary}`],
    [
      '# 可用的知识条目（必须把它们自然讲进来，不要念清单）',
      input.retrievedKnowledge.length === 0
        ? '（暂无专门检索到的条目，依靠节点 mustIncludeFacts 即可。）'
        : input.retrievedKnowledge.join('\n\n')
    ],
    ['# 历史摘要', input.memorySummary],
    [
      '# 本轮剧情边界（严格）',
      forbiddenNounsBlock
    ],
    [
      '# 本轮必须避免的开头 / 口癖 / 已用过的句式',
      [
        '下面是你上一轮用过的开头、收尾、特征性短句——本轮全部不得再次出现，',
        '也不得只做同义词替换后再抄一遍。必须换一个切入角度、换一组具体史实细节。',
        avoidBlock
      ].join('\n')
    ],
    [
      '# 现在开始说话',
      [
        '请你直接以"昆仑"这个小妹妹角色的口吻开始这一轮对话的正文。',
        '不要输出任何以下内容：',
        '- "[[PREV_REPLY"、"历史轮"、"内部参考"、"系统"、"System:"、"User:" 等元标签；',
        '- 三道横线 "---" / "===" 之类分隔符；',
        '- 编号列表、项目符号、Markdown 标题；',
        '- 对自己上一轮句子的任何直接复读或近义改写。',
        '违反上面任何一条都算本轮失败。'
      ].join('\n')
    ]
  ]

  return sections
    .map(([title, content]) => `${title}\n${content}`.trim())
    .join('\n\n')
}
