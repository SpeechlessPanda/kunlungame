const ROLE_LABEL_PATTERN = /^[\s*·•>\-]*(?:昆仑|kunlun|Kunlun|KUNLUN|角色|主持人|旁白)\s*[:：]\s*/u

const STRUCTURAL_NOISE_PATTERNS: RegExp[] = [
  /^\s*-{3,}\s*$/,
  /^\s*={3,}\s*$/,
  /^\s*#{1,6}\s+.*$/,
  /^\s*\*[^*]+\*\s*$/
]

const INLINE_NOISE_PATTERNS: RegExp[] = [
  /\b(?:System|Assistant|User)\s*:\s*/g
]

const ENGLISH_WORD_PATTERN = /\b[a-zA-Z]{2,}\b/g

const normalizePlayerAddress = (value: string): string => value.replace(/你们/gu, '你')

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /不是([^，。？；]{1,15})，而是/gu, replacement: '既是$1，也是' },
  { pattern: /不是([^，。？；]{1,15})而是/gu, replacement: '既是$1，也是' }
]

const MAX_REPLY_LENGTH = 340

const truncateToMaxChars = (text: string, maxChars: number): string => {
  const chars = Array.from(text)
  if (chars.length <= maxChars) return text
  const truncated = chars.slice(0, maxChars).join('')
  const lastPunctuation = Math.max(
    truncated.lastIndexOf('。'),
    truncated.lastIndexOf('？'),
    truncated.lastIndexOf('！'),
    truncated.lastIndexOf('…')
  )
  if (lastPunctuation > maxChars * 0.6) {
    return truncated.slice(0, lastPunctuation + 1)
  }
  return truncated
}

/**
 * 对单轮输出做保底清洗：剥离角色标注和结构性噪声。
 */
export const sanitizeMainlineReply = (raw: string, _options?: Record<string, unknown>): string => {
  let result = raw

  // Strip English words that shouldn't appear in Chinese dialogue
  result = result.replace(ENGLISH_WORD_PATTERN, '')

  const lines = result.split(/\r?\n/)
  const cleanedLines: string[] = []
  for (const line of lines) {
    if (STRUCTURAL_NOISE_PATTERNS.some((p) => p.test(line))) continue
    let next = line
    let guard = 0
    while (ROLE_LABEL_PATTERN.test(next) && guard < 4) {
      next = next.replace(ROLE_LABEL_PATTERN, '')
      guard += 1
    }
    for (const pattern of INLINE_NOISE_PATTERNS) {
      next = next.replace(pattern, '')
    }
    next = normalizePlayerAddress(next)
    for (const { pattern, replacement } of FORBIDDEN_PATTERNS) {
      next = next.replace(pattern, replacement)
    }
    cleanedLines.push(next)
  }

  const collapsed: string[] = []
  let prevBlank = false
  for (const line of cleanedLines) {
    const isBlank = line.trim().length === 0
    if (isBlank && prevBlank) continue
    collapsed.push(line)
    prevBlank = isBlank
  }
  result = collapsed.join('\n').trim()

  // Enforce maximum length
  result = truncateToMaxChars(result, MAX_REPLY_LENGTH)

  // Ensure the text ends with a question (required for galgame interaction)
  const trimmed = result.trimEnd()
  const lastChar = trimmed.charAt(trimmed.length - 1)
  if (lastChar !== '？' && lastChar !== '?') {
    const defaultQuestions = [
      '您觉得呢？',
      '您怎么看？',
      '您愿意继续听下去吗？',
      '您有什么想法？'
    ]
    const questionIndex = Math.abs(trimmed.length) % defaultQuestions.length
    result = trimmed + defaultQuestions[questionIndex]
  }

  return result
}
