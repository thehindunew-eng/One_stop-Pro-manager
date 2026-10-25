export type StageKey =
  | 'discover'
  | 'define'
  | 'ideate'
  | 'design'
  | 'architect'
  | 'build'
  | 'test'
  | 'launch'
  | 'grow';

export type Role = 'pm' | 'design' | 'eng' | 'qa' | 'growth' | 'member';

export interface Access {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  isAdmin: boolean;
  canEdit: boolean;
  canAdmin: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  is_admin: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  tagline: string | null;
  owner_id: string;
  stage_key: StageKey;
  status: string;
  problem: ProblemStatement | null;
  settings: ProjectSettings;
  created_at: string;
  updated_at: string;
}

export interface ProjectSettings {
  aiProvider?: string;
  aiModel?: string;
  accent?: string;
  showDemo?: boolean;
  allowMemberEdit?: boolean;
}

export interface ProblemStatement {
  title: string;
  statement: string;
  summary: string;
  confidence: number;
  status: 'draft' | 'approved';
  users: string[];
  pains: string[];
  evidence: string[];
  assumptions: string[];
  unknowns: string[];
  successMetrics: string[];
  solutionAngles: string[];
  productType: string;
  tags: string[];
  engine: string;
  updatedAt: string;
  history?: { statement: string; at: string; by: string }[];
}

export interface Member {
  user_id: string;
  project_id: string;
  name: string;
  email: string | null;
  role: Role;
  is_admin: boolean;
  joined_at: string;
  last_seen?: string | null;
}

export type MessageKind = 'chat' | 'note' | 'idea' | 'decision' | 'question' | 'transcript' | 'system';

export interface Message {
  id: string;
  project_id: string;
  user_id: string | null;
  author: string;
  role: Role | 'assistant';
  kind: MessageKind;
  content: string;
  meta: Record<string, unknown>;
  created_at: string;
}

export type SignalType =
  | 'pain'
  | 'user'
  | 'evidence'
  | 'idea'
  | 'decision'
  | 'blocker'
  | 'metric'
  | 'question';

export interface Signal {
  id: string;
  project_id: string;
  type: SignalType;
  label: string;
  detail: string;
  score: number;
  status: 'open' | 'accepted' | 'dismissed';
  evidence: { author: string; content: string; at: string }[];
  created_at: string;
}

export interface Artifact {
  id: string;
  project_id: string;
  stage_key: StageKey;
  kind: string;
  title: string;
  content: string;
  status: 'draft' | 'ready' | 'approved';
  updated_by: string | null;
  updated_at: string;
}

export type TaskStatus = 'todo' | 'doing' | 'review' | 'done';

export interface Task {
  id: string;
  project_id: string;
  title: string;
  detail: string;
  stage_key: StageKey;
  status: TaskStatus;
  owner: string | null;
  priority: 'P0' | 'P1' | 'P2';
  points: number;
  position: number;
  created_at: string;
}

export interface Tool {
  id: string;
  slug: string;
  name: string;
  category: string;
  stages: StageKey[];
  url: string;
  color: string;
  description: string;
  free_tier: string;
  sort: number;
  enabled: boolean;
}

export interface Stage {
  key: StageKey;
  name: string;
  tagline: string;
  icon: string;
  color: string;
  position: number;
  enabled: boolean;
  checklist: string[];
}

export interface WorkspaceState {
  project: Project;
  members: Member[];
  messages: Message[];
  signals: Signal[];
  artifacts: Artifact[];
  tasks: Task[];
  tools: Tool[];
  stages: Stage[];
  me: { id: string; name: string; role: Role; isAdmin: boolean; canEdit: boolean; canAdmin: boolean };
  ai: { engine: string; provider: string | null; model: string | null; live: boolean };
}

export interface AnalysisResult {
  problem: ProblemStatement;
  signals: Omit<Signal, 'id' | 'project_id' | 'created_at'>[];
  engine: string;
}
