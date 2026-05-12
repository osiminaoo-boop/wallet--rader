export async function register() {
  // Node.jsサーバーサイドのみで実行（Edge Runtimeでは実行しない）
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startPoller } = await import("./scripts/poller.mjs");
    startPoller();
  }
}
