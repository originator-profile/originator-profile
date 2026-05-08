import child_process from "node:child_process";
import path from "node:path";
import util from "node:util";

const exec = util.promisify(child_process.exec);

async function globalTeardown() {
  await exec(path.resolve(import.meta.dirname, "docker-teardown.sh"));
}

export default globalTeardown;
