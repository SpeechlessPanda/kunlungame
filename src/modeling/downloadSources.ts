export const buildDownloadSources = (repository: string, fileName: string): string[] => [
  `https://huggingface.co/${repository}/resolve/main/${fileName}?download=true`,
  `https://hf-mirror.com/${repository}/resolve/main/${fileName}?download=true`
]
