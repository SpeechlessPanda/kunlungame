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

const normalizePlayerAddress = (value: string): string => value.replace(/你们/gu, '你')

/**
 * 对单轮输出做保底清洗：剥离角色标注和结构性噪声。
 */
export const sanitizeMainlineReply = (raw: string, _options?: Record<string, unknown>): string => {
  const lines = raw.split(/\r?\n/)
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
  return collapsed.join('\n').trim()
}
