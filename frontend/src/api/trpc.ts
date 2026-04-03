/**
 * DevPulse tRPC Mock Client
 * ==========================
 * Provides a mock tRPC client that returns undefined data with enabled: false queries.
 * This allows pages to import `trpc.xxx.useQuery()` without needing a backend.
 * When a real backend is connected, replace this file with the real tRPC client.
 */

const noopQuery = () => ({
  data: undefined,
  isLoading: false,
  isError: false,
  error: null,
  refetch: () => Promise.resolve({ data: undefined }),
});

const noopMutation = () => ({
  mutate: () => {},
  mutateAsync: () => Promise.resolve(undefined),
  isPending: false,
  isLoading: false,
  isError: false,
  error: null,
  data: undefined,
});

// Creates a proxy that returns noopQuery for .useQuery() and noopMutation for .useMutation()
function createMockRouter(): any {
  return new Proxy({}, {
    get() {
      return new Proxy({}, {
        get(_target, methodName) {
          if (methodName === 'useQuery' || methodName === 'useInfiniteQuery') return noopQuery;
          if (methodName === 'useMutation') return noopMutation;
          if (methodName === 'query') return () => Promise.resolve(undefined);
          if (methodName === 'mutate') return () => Promise.resolve(undefined);
          // Nested routers (e.g., trpc.scan.count.useQuery)
          return new Proxy({}, {
            get(_t, m) {
              if (m === 'useQuery' || m === 'useInfiniteQuery') return noopQuery;
              if (m === 'useMutation') return noopMutation;
              if (m === 'query') return () => Promise.resolve(undefined);
              return noopQuery;
            }
          });
        }
      });
    }
  });
}

export const trpc = createMockRouter();
