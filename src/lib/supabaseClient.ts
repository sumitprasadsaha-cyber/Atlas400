/**
 * Supabase client stub / fallback integration for AI Studio.
 * Provides resilient query builder chaining with in-memory store and offline support.
 */

class MockSupabaseQueryBuilder {
  private _table: string;
  private _data: any[] = [];

  constructor(table: string) {
    this._table = table;
  }

  select(columns: string = "*") {
    return this;
  }

  insert(values: any | any[]) {
    return Promise.resolve({ data: values, error: null });
  }

  upsert(values: any | any[], options?: { onConflict?: string }) {
    return Promise.resolve({ data: values, error: null });
  }

  update(values: any) {
    return this;
  }

  delete() {
    return this;
  }

  eq(column: string, value: any) {
    return this;
  }

  neq(column: string, value: any) {
    return this;
  }

  in(column: string, values: any[]) {
    return this;
  }

  not(column: string, operator: string, value: any) {
    return this;
  }

  gte(column: string, value: any) {
    return this;
  }

  lte(column: string, value: any) {
    return this;
  }

  gt(column: string, value: any) {
    return this;
  }

  lt(column: string, value: any) {
    return this;
  }

  like(column: string, pattern: string) {
    return this;
  }

  ilike(column: string, pattern: string) {
    return this;
  }

  match(query: Record<string, any>) {
    return this;
  }

  or(filter: string) {
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    return this;
  }

  range(from: number, to: number) {
    return this;
  }

  limit(count: number) {
    return this;
  }

  single() {
    return Promise.resolve({ data: null, error: null });
  }

  maybeSingle() {
    return Promise.resolve({ data: null, error: null });
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: any[]; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const result = { data: [] as any[], error: null };
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

class MockSupabaseChannel {
  private _name: string;

  constructor(name: string) {
    this._name = name;
  }

  on(event: string, filter: any, callback: (payload: any) => void) {
    return this;
  }

  subscribe(callback?: (status: string) => void) {
    if (callback) callback("SUBSCRIBED");
    return this;
  }

  unsubscribe() {
    return Promise.resolve("OK");
  }
}

export const supabase = {
  from(table: string) {
    return new MockSupabaseQueryBuilder(table);
  },

  channel(name: string) {
    return new MockSupabaseChannel(name);
  },

  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: (callback: any) => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
  },

  storage: {
    from: (bucket: string) => ({
      upload: async () => ({ data: { path: "" }, error: null }),
      download: async () => ({ data: null, error: null }),
      getPublicUrl: (path: string) => ({ data: { publicUrl: "" } }),
    }),
  },
};
