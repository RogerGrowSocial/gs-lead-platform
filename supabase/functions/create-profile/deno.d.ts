declare namespace Deno {
  export interface RequestEvent {
    request: Request;
    respondWith(r: Response | Promise<Response>): Promise<void>;
  }

  export interface ServeInit {
    port?: number;
    hostname?: string;
    handler?: (req: Request) => Response | Promise<Response>;
    onError?: (error: unknown) => Response | Promise<Response>;
    onListen?: (params: { hostname: string; port: number }) => void;
    signal?: AbortSignal;
  }

  export function serve(addr: string | ServeInit, handler?: (req: Request) => Response | Promise<Response>): void;
  
  export const env: {
    get(key: string): string | undefined;
    toObject(): { [key: string]: string };
  };
} 