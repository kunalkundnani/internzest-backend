const { spawn } = require("child_process");

console.log("Starting backend server for test execution...");
const server = spawn("node", ["server.js"], {
  cwd: __dirname,
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, PORT: "5000" },
});

let serverStarted = false;

server.stdout.on("data", (data) => {
  const text = data.toString();
  process.stdout.write("[SERVER]: " + text);

  if ((text.includes("Server running on port") || text.includes("Server running on")) && !serverStarted) {
    serverStarted = true;
    console.log("\nBackend server is listening. Running test suite...\n");

    const tests = spawn("node", ["test_backend.js"], {
      cwd: __dirname,
      stdio: "inherit",
    });

    tests.on("close", (code) => {
      console.log(`Test process exited with code ${code}`);
      server.kill();
      process.exit(code);
    });
  }
});

server.stderr.on("data", (data) => {
  process.stderr.write("[SERVER ERROR]: " + data.toString());
});

server.on("close", (code) => {
  console.log(`Server process exited with code ${code}`);
});

setTimeout(() => {
  if (!serverStarted) {
    console.error("Server did not start within 10 seconds. Terminating.");
    server.kill();
    process.exit(1);
  }
}, 10000);
