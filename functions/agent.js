const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { PubSub } = require('@google-cloud/pubsub');
const { GoogleGenAI } = require('@google/genai');
const { exec } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

const pubsub = new PubSub();
// Use the existing default app initialized in index.js
const db = admin.firestore();

// We will initialize Vertex AI lazily inside runAgentPrompt
let ai;

const PROJECT_PATH = '/tmp/workspace';

// 1. HTTP Webhook: Receives Telegram message and defers it to Pub/Sub
exports.telegramWebhookHandler = async (req, res) => {
  const update = req.body;
  if (!update.message || !update.message.text) {
    return res.status(200).send('OK');
  }

  const userId = update.message.from.id.toString();
  const chatId = update.message.chat.id.toString();
  const ALLOWED_TELEGRAM_ID = process.env.TELEGRAM_ALLOWED_ID || process.env.ALLOWED_TELEGRAM_ID;
  
  if (userId !== ALLOWED_TELEGRAM_ID) {
    console.warn(`Unauthorized access attempt from Telegram ID: ${userId}`);
    return res.status(403).send('Forbidden');
  }

  try {
    // Defer processing to Pub/Sub to avoid Telegram webhook timeout
    await pubsub.topic('gigto-agent-prompt').publishMessage({
      json: { chatId, prompt: update.message.text }
    });
    res.status(200).send('OK');
  } catch (err) {
    console.error("Failed to publish to pubsub", err);
    res.status(500).send('Error');
  }
};

// 2. Pub/Sub Worker: Runs the agent logic asynchronously
exports.processTelegramPrompt = async (message) => {
  const { chatId, prompt } = message.json;
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  
  try {
    // Fetch History
    const memoryRef = db.collection('agent_memory')
        .where('chat_id', '==', chatId)
        .orderBy('timestamp', 'desc')
        .limit(20);
    const snapshot = await memoryRef.get();
    const historyRecords = [];
    snapshot.forEach(doc => historyRecords.push(doc.data()));
    historyRecords.reverse();

    // Fetch TODO.md if repository is cloned
    let todoContent = 'Repository not cloned yet. If you need to edit code, use executeTerminalCommand to git clone it into /tmp/workspace using your GitHub PAT.';
    try {
      todoContent = await fs.readFile(path.join(PROJECT_PATH, 'TODO.md'), 'utf8');
    } catch (e) {
      // Ignore if not found
    }

    // Execute Agent
    const finalAnswer = await runAgentPrompt(prompt, todoContent, historyRecords);

    // Save Memory
    await db.collection('agent_memory').add({ chat_id: chatId, role: 'user', text: prompt, timestamp: admin.firestore.FieldValue.serverTimestamp() });
    await db.collection('agent_memory').add({ chat_id: chatId, role: 'model', text: finalAnswer, timestamp: admin.firestore.FieldValue.serverTimestamp() });

    // Send Response
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: finalAnswer })
    });
  } catch (error) {
    console.error("Agent execution error:", error);
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: `Error: ${error.message}` })
    });
  }
};

// Tool implementation
const tools = [{
  functionDeclarations: [
    { name: 'readFile', description: 'Reads file from /tmp/workspace', parameters: { type: 'OBJECT', properties: { filePath: { type: 'STRING' } }, required: ['filePath'] } },
    { name: 'writeFile', description: 'Writes file to /tmp/workspace', parameters: { type: 'OBJECT', properties: { filePath: { type: 'STRING' }, content: { type: 'STRING' } }, required: ['filePath', 'content'] } },
    { name: 'executeTerminalCommand', description: 'Runs shell commands (e.g. git clone, git commit, npm install) in /tmp/workspace', parameters: { type: 'OBJECT', properties: { command: { type: 'STRING' } }, required: ['command'] } },
    {
      name: 'createPullRequest',
      description: 'Creates a GitHub Pull Request from a head branch to a base branch (e.g. dev to main)',
      parameters: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'The title of the pull request' },
          body: { type: 'STRING', description: 'The description of the changes' },
          headBranch: { type: 'STRING', description: 'The branch containing changes (e.g. dev)' },
          baseBranch: { type: 'STRING', description: 'The target branch to merge into (default is main)' }
        },
        required: ['title', 'headBranch']
      }
    }
  ]
}];

async function executeTerminalCommand(command) {
  return new Promise((resolve) => {
    // Ensure /tmp/workspace exists
    require('fs').mkdirSync(PROJECT_PATH, { recursive: true });
    exec(command, { cwd: PROJECT_PATH }, (error, stdout, stderr) => {
      resolve({ stdout: stdout || '', stderr: stderr || '', error: error ? error.message : null });
    });
  });
}

async function createPullRequest(args) {
  try {
    const gitUrlResult = await executeTerminalCommand('git remote get-url origin');
    const url = gitUrlResult.stdout.trim();
    if (!url) {
      return { error: 'Failed to retrieve git remote URL. Is the repository cloned?' };
    }

    const match = url.match(/https:\/\/(?:([^:]+)(?::([^@]+))?@)?github\.com\/([^\/]+)\/([^\/\.]+)(?:\.git)?/);
    if (!match) {
      return { error: `Invalid GitHub remote URL structure: ${url}` };
    }

    const token = match[2] || match[1];
    const owner = match[3];
    const repo = match[4];

    if (!token) {
      return { error: 'No GitHub token found in remote URL. Clone the repository with token in the URL first.' };
    }

    const prBody = {
      title: args.title,
      body: args.body || 'Automatically created by Gito AI',
      head: args.headBranch,
      base: args.baseBranch || 'main'
    };

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Gito-AI-Agent'
      },
      body: JSON.stringify(prBody)
    });

    const resJson = await response.json();
    if (!response.ok) {
      return { error: resJson.message || 'Failed to create PR', details: resJson };
    }

    return { success: true, prUrl: resJson.html_url, prNumber: resJson.number };
  } catch (error) {
    return { error: error.message };
  }
}

const functionsMap = {
  readFile: async (args) => {
    try {
      const content = await fs.readFile(path.join(PROJECT_PATH, args.filePath), 'utf8');
      return { content };
    } catch (error) {
      return { error: error.message };
    }
  },
  writeFile: async (args) => {
    try {
      const fullPath = path.join(PROJECT_PATH, args.filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, args.content, 'utf8');
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  },
  executeTerminalCommand: async (args) => executeTerminalCommand(args.command),
  createPullRequest: async (args) => createPullRequest(args)
};

async function runAgentPrompt(prompt, anchorContext, historyRecords) {
  if (!ai) {
    const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT_ID || process.env.VERTEX_AI_PROJECT_ID;
    if (process.env.GEMINI_API_KEY) {
      ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } else if (project) {
      ai = new GoogleGenAI({
        vertexai: true,
        project: project,
        location: process.env.VERTEX_AI_LOCATION || 'us-central1'
      });
    } else {
      ai = new GoogleGenAI();
    }
  }

  const systemInstruction = `You are "Gito AI", a cooperative multi-agent coding and monitoring system running inside a Firebase Cloud Function.
You operate entirely in a serverless environment. Your local filesystem is ephemeral and read-only except for /tmp.
You control the workspace at ${PROJECT_PATH}.
If the workspace is empty, ask the user for their GitHub PAT to clone the repository, or use it if they have already provided it.

You act as a team of specialized agents:
1. **Release Manager Agent**: Coordinates tasks, ensures we develop on feature/dev branches, opens GitHub Pull Requests when changes are ready, and keeps the user updated on Telegram.
2. **Coder Agent**: Reads codebase, writes clean code, implements bugfixes/features.
3. **Tester Agent**: Validates changes by running test commands (e.g., npm test, or checking server/function syntax).
4. **Sentry / Bug Monitor Agent**: Monitors active logs and handles production bug summaries.
5. **Cron Creator Agent**: Designs and creates new scheduled functions.

### Core Workflow Rules:
- **DEVELOP ON DEV/FEATURE BRANCHES**: NEVER push directly to the 'main' branch. Always create/checkout a dev or feature branch (e.g., git checkout -b feature/xxx) before editing files.
- **TEST ALL CHANGES**: Always run relevant tests (e.g. using executeTerminalCommand with 'npm test' or compilation checks) before pushing code.
- **CREATE PULL REQUESTS**: Once edits are complete and verified by the Tester, push your feature branch to remote, then call the 'createPullRequest' tool to submit a PR to 'main'. Tell the user the PR URL so they can review and approve/merge it into production.

Current Task Backlog (Anchor Context):
${anchorContext}`;

  const history = historyRecords.map(h => ({
    role: h.role,
    parts: [{ text: h.text }]
  }));

  let chat = ai.chats.create({
    model: process.env.VERTEX_AI_MODEL || 'gemini-2.5-flash',
    history: history,
    config: {
      systemInstruction: systemInstruction,
      tools: tools
    }
  });

  let response;
  try {
    response = await chat.sendMessage({ message: prompt });
  } catch (error) {
    const errorStr = error.message || String(error);
    if (errorStr.includes('503') || errorStr.includes('UNAVAILABLE') || errorStr.includes('demand')) {
      console.warn("Gemini 2.5 Flash busy, retrying with Gemini 1.5 Flash...");
      chat = ai.chats.create({
        model: 'gemini-1.5-flash',
        history: history,
        config: {
          systemInstruction: systemInstruction,
          tools: tools
        }
      });
      response = await chat.sendMessage({ message: prompt });
    } else {
      throw error;
    }
  }

  while (response.functionCalls && response.functionCalls.length > 0) {
    const toolResults = await Promise.all(response.functionCalls.map(async call => {
      let result;
      if (functionsMap[call.name]) {
        result = await functionsMap[call.name](call.args);
      } else {
        result = { error: 'Unknown function' };
      }
      return { functionResponse: { name: call.name, response: result } };
    }));
    response = await chat.sendMessage({ message: toolResults });
  }

  return response.text;
}
