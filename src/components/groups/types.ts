/** What the group endpoints return. */

export type Visibility = 'public' | 'unlisted' | 'private'

export interface Group {
  id: number
  name: string
  /** Only members get the join code. */
  code: string | null
  visibility: Visibility
  members: number
  owner: boolean
  ownerId: number
  ownerName: string
  member: boolean
}

export interface GroupMember {
  id: number
  name: string
  self: boolean
  admin: boolean
  hasProfile: boolean
  fish: number
  bites: number
  weight: number
  time: number
  score: number
  level: number
  species: number
  fisheriesComplete: number
  bigW: number
  bigWSpecies: string | null
  bigL: number
  bigLSpecies: string | null
  topSpeciesWeight: number
  topSpeciesKey: string | null
  updatedAt: string | null
}

export interface BoardRow {
  id: number
  name: string
  self: boolean
  value: number
  label: string | null
}

export interface GroupDetail {
  group: Group
  members: GroupMember[]
  boards: Record<string, BoardRow[]>
  meta: {
    totalSpecies: number
    totalFisheries: number
    speciesNames: Record<string, string>
  }
}
