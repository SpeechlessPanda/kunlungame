import type { DialogueOption } from './dialogueOrchestrator.js'

/**
 * 自然对话风格的 option label 生成器。
 *
 * 设计原则：
 * - 选项像是在和一位可爱的引路人对话时的自然回应，不是选择题考试。
 * - align = 顺着她继续听，带着好奇和信任。
 * - challenge = 带着疑问追问，但不是敌意的，更像朋友之间的讨论。
 * - 每轮变体避免重复。
 * - 每个节点有专属语境的选项池，未登记的节点回退通用池。
 */

const ALIGN_POOL: readonly string[] = [
  '嗯嗯，继续说，我听着呢。',
  '原来是这样，那然后呢？',
  '这个有意思，再多讲一点？',
  '我被你说动了，接着讲吧。',
  '我好像有点懂了，继续继续。',
  '好神奇，还有更多吗？',
  '嗯，我想听你把这段讲完。'
] as const

const CHALLENGE_POOL: readonly string[] = [
  '等等，这里我怎么觉得有点奇怪……',
  '这个说法真的站得住吗？',
  '我有个疑问，你先听我说完。',
  '嗯……但是有没有另一种可能？',
  '我不是特别信，你能再解释一下吗？',
  '等一下，这个逻辑好像不太对？',
  '我先想想……你确定是这样吗？'
] as const

interface NodeOptionPool {
  readonly align: readonly string[]
  readonly challenge: readonly string[]
}

const NODE_OPTION_POOLS: Record<string, NodeOptionPool> = {
  'kunlun-threshold': {
    align: [
      '昆仑啊……你一说，我好像就有点被吸引了。',
      '嗯，这个世界中心的说法挺有意思的，继续说。',
      '西王母的故事我还不太了解，你给我讲讲？',
      '原来昆仑这么重要啊，那我们从这里开始吧。'
    ],
    challenge: [
      '世界中心？这个说法是谁定的呀？',
      '等等，昆仑真的有这么特殊吗？证据呢？',
      '神话归神话，有没有更实在一点的证据？',
      '我不太信这种"世界中心"的说法，你怎么看？'
    ]
  },
  'creation-myths': {
    align: [
      '盘古和女娲……小时候听过这些故事，但没想过这么深。',
      '原来创世神话还可以这样理解，你继续。',
      '补天、治水……这些故事连起来真的挺有意思的。',
      '夸父追日那种坚持，我以前没从这个角度想过。'
    ],
    challenge: [
      '盘古开天……这种故事也能算"历史"吗？',
      '女娲补天这个，到底是神话还是有什么历史影子？',
      '从神话到秩序，这个跳转会不会太快了？',
      '这些故事之间真的有你说的那种"互相补位"吗？'
    ]
  },
  'civilization-roots': {
    align: [
      '"炎黄子孙"原来是被造出来的身份？这个角度很新鲜。',
      '燧人、伏羲、神农……他们到底是传说还是真有其人？',
      '多元部族合一的故事我以前没仔细想过，继续说。',
      '所以"我们"这个概念，其实是一点点造出来的？'
    ],
    challenge: [
      '把这么多部族说成同一个祖先，不太牵强吗？',
      '五帝的故事被反复改写，那它还能信吗？',
      '这种"共同身份"会不会只是统治者编的？',
      '你说"共同身份是文化需要"，那真实性呢？'
    ]
  },
  'order-and-thought': {
    align: [
      '诸子百家……听起来好复杂，但你说起来还挺清楚的。',
      '礼乐和争鸣，原来它们不是对立的？有意思。',
      '我挺喜欢老子那种怀疑的精神，多讲讲？',
      '原来中国的秩序观是吵架吵出来的，哈哈。'
    ],
    challenge: [
      '诸子争鸣那么乱，怎么就能形成"秩序观"了？',
      '礼乐真的能让人不打架吗？我有点怀疑。',
      '这些思想之间的矛盾，真的能调和吗？',
      '你说"从来不是一种声音"，那最后听谁的？'
    ]
  },
  'empire-and-openness': {
    align: [
      '书同文、车同轨……原来统一书写这么重要。',
      '长安的夜市听起来好热闹啊，继续讲？',
      '丝绸之路的故事总是让我觉得很浪漫。',
      '大一统的格局，从秦到现在居然一直有影响？'
    ],
    challenge: [
      '大一统听起来好，但代价呢？没人提吗？',
      '科举制真的公平吗？还是有别的限制？',
      '长安的开放有没有被浪漫化的成分？',
      '丝绸之路不只是文化交流吧，也有冲突？'
    ]
  },
  'fusion-and-refinement': {
    align: [
      '宋代把日子过细……这个形容真好，多讲讲？',
      '青花瓷居然能飘到那么远的地方，有点意外。',
      '红楼梦是文明的自我审视？这个说法好有意思。',
      '原来"精致地重写"也是一种文化生产方式。'
    ],
    challenge: [
      '宋代的精致，背后是不是有回避现实的成分？',
      '明清小说写了那么多，到底改变了什么？',
      '把"精致"也算生产力，不会太勉强吗？',
      '郑和下西洋花那么多钱，值得吗？'
    ]
  },
  'rupture-and-guardianship': {
    align: [
      '近代那段……好沉重，但你说得让我想继续听。',
      '梁思成他们做的事，真的很了不起。',
      '在战火里守文脉，这得有多大的决心啊。',
      '鲁迅批判的同时也有人守护，这两种都很重要。'
    ],
    challenge: [
      '五四"打倒孔家店"会不会太激进了？',
      '苦难叙事里，有没有被忽略的声音？',
      '说"在断裂里有人守住了"，会不会太浪漫化了？',
      '这些守护者的事迹，有没有被后来人改编过？'
    ]
  },
  'contemporary-return': {
    align: [
      '文化自觉……费孝通这四个字真的说到点上了。',
      '故宫文创做得真好，原来这也是文化传承？',
      '从昆仑到现在，这条线居然还活着。',
      '我今天听完这些，好像对自己的文化多了一点理解。'
    ],
    challenge: [
      '文化自信和盲目自信的界限在哪里？',
      '非遗变成展品，还是活着的传统？',
      'B站国风和流量，到底是在传承还是在消费？',
      '"文化自觉"说起来容易，真的做到了吗？'
    ]
  }
}

const ENDING_ALIGN: readonly string[] = [
  '我还想再听你讲一遍，从头开始好不好？',
  '我们再走一次吧，这次我想仔细听。',
  '好想从头来过，这次我会更认真。'
] as const

const ENDING_CHALLENGE: readonly string[] = [
  '谢谢你陪我走了这么远，下次见。',
  '我先回去想想，下次再找你聊。',
  '这一程我很开心，有缘再见。'
] as const

const pickBy = (pool: readonly string[], seed: number): string => {
  if (pool.length === 0) return ''
  const index = ((seed % pool.length) + pool.length) % pool.length
  return pool[index] ?? pool[0]!
}

export interface BuildOptionLabelsInput {
  turnIndex: number
  isEnding?: boolean
  nodeId?: string
}

export const buildGalgameOptionLabels = (
  input: BuildOptionLabelsInput
): DialogueOption[] => {
  const { turnIndex, isEnding = false, nodeId } = input
  if (isEnding) {
    return [
      { semantic: 'align', label: pickBy(ENDING_ALIGN, turnIndex) },
      { semantic: 'challenge', label: pickBy(ENDING_CHALLENGE, turnIndex) }
    ]
  }
  const pool = nodeId != null ? NODE_OPTION_POOLS[nodeId] : undefined
  const alignPool = pool?.align ?? ALIGN_POOL
  const challengePool = pool?.challenge ?? CHALLENGE_POOL
  return [
    { semantic: 'align', label: pickBy(alignPool, turnIndex) },
    { semantic: 'challenge', label: pickBy(challengePool, turnIndex) }
  ]
}
