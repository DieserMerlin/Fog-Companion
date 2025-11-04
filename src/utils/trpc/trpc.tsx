import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, httpSubscriptionLink, splitLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useMemo, type PropsWithChildren } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import { AppRouter } from "@diesermerlin/fog-companion-web";
import { APP_CONFIG } from "../../AppConfig";

export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<AppRouter>();

export type RouterOuputs = inferRouterOutputs<AppRouter>;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 60 * 1000,
      },
    },
  });
}

let cached;
function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    if (!cached) cached = makeQueryClient();
    return cached;
  }
}

export const trpcClient = () => createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: opts => opts.type === 'subscription',
      true: httpSubscriptionLink({
        url: APP_CONFIG.BACKEND_URL,
        eventSourceOptions() {
          return {
            withCredentials: true,
          };
        },
      }),
      false: httpBatchLink({
        url: APP_CONFIG.BACKEND_URL,
        fetch(url, opts) {
          return fetch(url, { ...opts, credentials: 'include' });
        },
      }),
    })
  ],
})

export const WrapTRPC = (props: PropsWithChildren) => {
  const queryClient = getQueryClient();
  const backendUrl = APP_CONFIG.BACKEND_URL;
  const client = useMemo(() => trpcClient(), [backendUrl]);

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={client} queryClient={queryClient}>
        {props.children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
