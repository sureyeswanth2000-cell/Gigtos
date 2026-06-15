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
    { name: 'executeTerminalCommand', description: 'Runs shell commands (e.g. git clone, git commit, npm install) in /tmp/workspace', parameters: { type: 'OBJECT', properties: { command: { type: 'STRING' } }, required: ['command'] } }
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
  executeTerminalCommand: async (args) => executeTerminalCommand(args.command)
};

async function runAgentPrompt(prompt, anchorContext, historyRecords) {
  if (!ai) {
    ai = new GoogleGenAI({ 
      vertexai: { 
        project: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT_ID || process.env.VERTEX_AI_PROJECT_ID || 'dummy-project', 
        location: process.env.VERTEX_AI_LOCATION || 'us-central1' 
      } 
    });
  }

  const systemInstruction = `You are "gigto-core-agent", a headless server-side AI coding agent running inside a Firebase Cloud Function.
You operate entirely in a serverless environment. Your local filesystem is ephemeral and read-only except for /tmp.
You control the workspace at ${PROJECT_PATH}.
If the workspace is empty, your first step should be to ask the user for their GitHub PAT to clone the repository, or use it if they provided it.
Use your tools to read files, edit code, and run terminal commands. To deploy code, commit and push to GitHub so a CI/CD action can deploy it to Firebase.

Current Task Backlog (Anchor Context):
${anchorContext}`;

  const history = historyRecords.map(h => ({
    role: h.role,
    parts: [{ text: h.text }]
  }));

  const chat = ai.chats.create({
    model: 'gemini-1.5-pro',
    config: {
      systemInstruction: systemInstruction,
      tools: tools,
      history: history
    }
  });

  let response = await chat.sendMessage({ parts: [{ text: prompt }] });

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
    response = await chat.sendMessage(toolResults);
  }

  return response.text;
}
