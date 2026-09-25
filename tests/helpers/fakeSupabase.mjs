// A scripted stand-in for the supabase client, for tests that run under plain node.
// `respond(call)` decides each query's result: { data, error }.
// call = { table, op, columns, payload, filters, single, returning }

export function fakeClient(respond, { upload } = {}) {
  const calls = []
  const uploads = []

  function builder(table) {
    const call = { table, op: null, columns: null, payload: null, filters: {}, single: false, returning: null }
    const chain = {
      select(columns) {
        if (call.op === null) { call.op = 'select'; call.columns = columns } else call.returning = columns
        return chain
      },
      insert(payload) { call.op = 'insert'; call.payload = payload; return chain },
      update(payload) { call.op = 'update'; call.payload = payload; return chain },
      delete() { call.op = 'delete'; return chain },
      eq(column, value) { call.filters[column] = value; return chain },
      maybeSingle() { call.single = true; return chain },
      then(resolve, reject) {
        calls.push(call)
        return Promise.resolve()
          .then(() => respond(call))
          .then((result) => ({ data: null, error: null, ...result }))
          .then(resolve, reject)
      },
    }
    return chain
  }

  return {
    calls,
    uploads,
    from: builder,
    storage: {
      from: (bucket) => ({
        async upload(path, file) {
          uploads.push({ bucket, path, file })
          return { error: upload ? upload({ bucket, path, file }) : null }
        },
      }),
    },
  }
}
