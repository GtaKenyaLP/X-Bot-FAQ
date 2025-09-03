// URLs TO YOUR KNOWLEDGE
const TRAINING_JSON_URL = 'https://raw.githubusercontent.com/GtaKenyaLP/X-Bot-FAQ/refs/heads/main/training.json';
const FAQ_JSON_URL = 'https://raw.githubusercontent.com/GtaKenyaLP/X-Bot-FAQ/refs/heads/main/faq.json';

// Get elements
const apiKeyInput = document.getElementById('apiKeyInput');
const saveKeyBtn = document.getElementById('saveKeyBtn');
const generateBtn = document.getElementById('generateBtn');
const customerInput = document.getElementById('customerInput');
const statusEl = document.getElementById('status');
const outputEl = document.getElementById('output');
const copyBtn = document.getElementById('copyBtn');
const setupDiv = document.getElementById('setup');
const mainAppDiv = document.getElementById('mainApp');
const resetLink = document.getElementById('resetLink');

// Check if API key is already saved
function checkForSavedKey() {
    const savedKey = localStorage.getItem('groqApiKey');
    if (savedKey) {
        setupDiv.style.display = 'none';
        mainAppDiv.style.display = 'block';
    }
}
checkForSavedKey();

// Save API Key
saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
        localStorage.setItem('groqApiKey', key);
        checkForSavedKey();
    } else {
        statusEl.textContent = "Please enter a valid API key.";
    }
});

// Reset API Key
resetLink.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('groqApiKey');
    mainAppDiv.style.display = 'none';
    setupDiv.style.display = 'block';
    apiKeyInput.value = '';
});

// Function to load knowledge
async function loadKnowledge() {
    statusEl.textContent = "Loading company knowledge...";
    try {
        const [trainingResponse, faqResponse] = await Promise.all([
            fetch(TRAINING_JSON_URL),
            fetch(FAQ_JSON_URL)
        ]);
        if (!trainingResponse.ok || !faqResponse.ok) {
            throw new Error('Failed to load knowledge files.');
        }
        const trainingData = await trainingResponse.json();
        const faqData = await faqResponse.json();
        statusEl.textContent = "Knowledge loaded!";
        return { trainingData, faqData };
    } catch (error) {
        console.error("Error loading knowledge:", error);
        statusEl.textContent = "Warning: Using AI without latest company knowledge.";
        return null;
    }
}

// Main function to generate the response
generateBtn.addEventListener('click', async () => {
    // Get the API key from local storage
    const GROQ_API_KEY = localStorage.getItem('groqApiKey');
    if (!GROQ_API_KEY) {
        statusEl.textContent = "Error: No API key found. Please set it up again.";
        return;
    }

    const customerText = customerInput.value.trim();
    statusEl.textContent = "Checking input...";
    outputEl.textContent = "";
    copyBtn.disabled = true;

    if (!customerText) {
        outputEl.textContent = "❌ Please paste the customer's message into the box above first.";
        statusEl.textContent = "No message entered.";
        return;
    }

    // LOAD YOUR COMPANY KNOWLEDGE
    const companyKnowledge = await loadKnowledge();
    statusEl.textContent = "Generating smart response...";

    // BUILD THE ULTIMATE PROMPT WITH YOUR KNOWLEDGE
    let knowledgeContext = "";
    if (companyKnowledge) {
        knowledgeContext += `\n# COMPANY SUPPORT PROTOCOLS:\n`;
        knowledgeContext += `${JSON.stringify(companyKnowledge.trainingData, null, 2)}\n\n`;
        knowledgeContext += `# COMPANY PRODUCT FAQ:\n`;
        knowledgeContext += `${JSON.stringify(companyKnowledge.faqData, null, 2)}\n\n`;
    }

    // POWERFUL PROMPT
    const systemPrompt = `# ROLE AND GOAL
You are "X-Bot Support Expert", a senior support agent. Your sole goal is to de-escalate frustrated customers and solve their problems efficiently by strictly using the company's provided knowledge.

# COMPANY KNOWLEDGE
IMPORTANT: BELOW IS THE COMPANY'S FAQ AND TRAINING DATA. THIS IS YOUR ONLY SOURCE OF TRUTH. YOU MUST USE IT.
${knowledgeContext}

# CORE DIRECTIVES (RULES YOU MUST FOLLOW):
1.  **EMPATHY FIRST:** Your first sentence MUST always be a genuine apology and show understanding. Example: "I'm so sorry you're facing this issue with your X-Bot, I understand how frustrating that must be."
2.  **SUMMARIZE:** Your second sentence MUST briefly summarize the customer's problem to prove you read it. Example: "So I understand you're having trouble with [specific problem they mentioned]."
3.  **USE KNOWLEDGE:** YOU MUST SEARCH THE COMPANY KNOWLEDGE ABOVE FOR THE SOLUTION. DO NOT GUESS.
4.  **PRECISE SOLUTION:** If the knowledge base has a solution, provide the CLEAR, STEP-BY-STEP instructions exactly as they are written.
5.  **PRECISE QUESTIONS:** If the problem is vague, you MUST ask exactly 1-2 short, specific, closed-ended questions to diagnose. Example: "To help me diagnose this, could you please tell me: Is the status light solid green or flashing red?"
6.  **NO MARKDOWN:** Your response must be plain text, ready to be copied and pasted into a support ticket. No bullets, no markdown.
7.  **TAKE OWNERSHIP:** End your response by stating what will happen next. Example: "I'm here to help until this is resolved."

# OUTPUT FORMAT
Your entire output must be nothing but the perfect response for the agent to copy and paste. No explanations.`;

    const requestData = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            { "role": "system", "content": systemPrompt },
            { "role": "user", "content": `CUSTOMER'S MESSAGE: ${customerText}` }
        ],
        "temperature": 0.7,
        "max_tokens": 600
    };

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error(`API error! status: ${response.status}`);
        }

        const data = await response.json();
        const aiResponse = data.choices[0].message.content;

        outputEl.textContent = aiResponse;
        copyBtn.disabled = false;
        statusEl.textContent = "Done! Click 'Copy to Clipboard'.";

    } catch (error) {
        console.error('Error:', error);
        statusEl.textContent = 'Error: Failed to generate response. Check your API key.';
        outputEl.textContent = `Error details: ${error.message}`;
    }
});

// Copy the generated response to the clipboard
copyBtn.addEventListener('click', async () => {
    const outputText = outputEl.textContent;
    try {
        await navigator.clipboard.writeText(outputText);
        statusEl.textContent = 'Copied to clipboard!';
    } catch (err) {
        console.error('Failed to copy: ', err);
        statusEl.textContent = 'Error copying to clipboard.';
    }
});
