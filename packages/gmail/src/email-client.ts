import type { RawEmail } from './parsers'

export interface EmailClient {
  fetchSince(since: Date): Promise<RawEmail[]>
}

export interface ImapCredentials {
  user: string
  appPassword: string
  host?: string
  port?: number
}

export function normalizeAppPassword(password: string): string {
  return password.replace(/\s/g, '')
}
