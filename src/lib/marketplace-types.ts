export type ContentType = 'Video' | 'Image' | 'Animation' | 'Campaign'
export type TrustStatus = 'Self-reported' | 'Evidence submitted' | 'Evidence reviewed'

export interface PortfolioItem {
  id: string
  title: string
  category: string
  image: string
  description: string
  contentType: ContentType
  aspectRatio: string
  duration?: string
  tools: string[]
  workflow: string[]
  role: string
  licensing: string
  verification: TrustStatus
}

export interface Creator {
  id: string
  name: string
  initials: string
  specialty: string
  location: string
  bio: string
  accent: string
  skills: string[]
  tools: string[]
  formats: string[]
  rate: number
  availability: string
  commercialUse: string
  trust: TrustStatus
  work: PortfolioItem[]
}

export interface Brief {
  id: string
  title: string
  idea: string
  objective: string
  audience: string
  contentType: ContentType
  style: string
  platform: string
  aspectRatio: string
  duration: string
  budgetMin?: number
  budgetMax?: number
  deadline?: string
  commercialUse: string
  requiredTools: string[]
  requiredSkills: string[]
  status: 'Draft' | 'Published' | 'In progress' | 'Review requested' | 'Completed'
}

export interface MatchResult {
  creator: Creator
  total: number
  eligible: boolean
  breakdown: { label: string; score: number; weight: number }[]
  reasons: string[]
  mismatch?: string
}
