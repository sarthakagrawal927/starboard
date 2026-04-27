import { type Client,createClient } from "@libsql/client/web";

let _client: Client | undefined;
function getClient(): Client {
  if (!_client) {
    _client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _client;
}

export const db = new Proxy({} as Client, {
  get(_, prop) {
    return Reflect.get(getClient(), prop);
  },
});
