import type { Database as FullDatabase } from './database.types'

/** Supabase client schema — excludes graphql_public so SSR clients infer `public` tables. */
export type PublicDatabase = {
  public: FullDatabase['public']
}
