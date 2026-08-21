declare namespace Deno {
  const env: {
    get(name: string): string | undefined;
  };

  function serve(
    handler: (request: Request) => Response | Promise<Response>,
  ): void;
}

declare module "npm:@supabase/supabase-js@2" {
  export function createClient(...args: unknown[]): any;
}

declare module "npm:@supabase/supabase-js@2/cors" {
  export const corsHeaders: Record<string, string>;
}

declare module "node:crypto" {
  export function createHmac(...args: unknown[]): {
    update(value: string): {
      digest(encoding: "hex"): string;
    };
  };
}
