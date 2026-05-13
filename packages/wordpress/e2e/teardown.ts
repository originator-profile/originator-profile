import child_process from "node:child_process";
import path from "node:path";
import util from "node:util";

const execFile = util.promisify(child_process.execFile);

async function globalTeardown() {
  const scriptPath = path.resolve(import.meta.dirname, "docker-teardown.sh");
  await execFile(scriptPath);
}

export default globalTeardown;
