import { LocalCatalystProvider } from "./localCompiler";
import { RemoteCatalystProvider } from "./remoteClient";
import type { CatalystProvider } from "./types";

export function createCatalystProvider(): CatalystProvider {
  const mode = import.meta.env.VITE_CATALYST_MODE ?? "local";
  const apiUrl = import.meta.env.VITE_CATALYST_API_URL ?? "";

  if (mode === "remote" && apiUrl) {
    return new RemoteCatalystProvider(apiUrl);
  }

  return new LocalCatalystProvider();
}
