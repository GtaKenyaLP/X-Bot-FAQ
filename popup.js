// SECURE VERSION - No hardcoded API Key
// URLs TO YOUR KNOWLEDGE
const TRAINING_JSON_URL = 'https://raw.githubusercontent.com/GtaKenyaLP/X-Bot-FAQ/refs/heads/main/training.json';
const FAQ_JSON_URL = 'https://raw.githubusercontent.com/GtaKenyaLP/X-Bot-FAQ/refs/heads/main/faq.json';

// Get elements
const apiKeyInput = document.getElementById('apiKeyInput');
const saveKeyBtn = document.getElementById('saveKeyBtn');
const generateBtn = document.getElementById('generateBtn');
const statusEl = document.getElementById('status');
const outputEl = document.getElementById('output');
const copyBtn = document.getElementById('copyBtn');
const setupDiv = document.getElementById('setup');
const mainAppDiv = document.getElementById('mainApp');
const resetLink = document.getElementById('resetLink');

// Check if API key is already saved (in local storage)
function checkForSavedKey() {
    const savedKey = localStorage.getItem('groqApiKey');
    if (savedKey) {
        // Hide setup, show main app
        setupDiv.style.display = 'none';
        mainAppDiv.style.display = 'block';
    }
}
// Run check on popup load
checkForSavedKey();

// Save API Key entered by the user
saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
        localStorage.setItem('groqApiKey', key);
        checkForSavedKey(); // Switch to the main app view
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

// Function to load knowledge from your JSON files
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
    const statusEl = document.getElementById('status');
    const outputEl = document.getElementById('output');
    const copyBtn = document.getElementById('copyBtn');

    // Get the API key from local storage
    const GROQ_API_KEY = localStorage.getItem('groqApiKey');
    if (!GROQ_API_KEY) {
        statusEl.textContent = "Error: No API key found. Please set it up again.";
        return;
    }

    statusEl.textContent = "Getting selected text...";
    outputEl.textContent = "";
    copyBtn.disabled = true;

    // Get the text the agent has selected on the webpage
    let customerText;
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const injectionResult = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => window.getSelection().toString()
        });
        customerText = injectionResult[0].result;
    } catch (error) {
        statusEl.textContent = 'Error: Could not get text from page.';
        return;
    }

    if (!customerText.trim()) {
        statusEl.textContent = 'Error: Please select the customer\'s message first.';
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

    const systemPrompt = `You are an expert support agent for X-Bot. Your PRIMARY SOURCE OF TRUTH is the following company knowledge. Use it to provide accurate, specific answers.

${knowledgeContext}

**ALWAYS FOLLOW THIS STRATEGY:**
1.  **EMPATHIZE & APOLOGIZE:** "I'm sorry to hear that...", "I understand your frustration..."
2.  **SHOW UNDERSTANDING:** Briefly summarize the problem.
3.  **PROVIDE A SOLUTION FROM KNOWLEDGE:** If the answer is in the Company Protocols or FAQ, use it exactly. If not, use your best judgment but be clear it's a general advice.
4.  **BE CONCISE & FRIENDLY:**

If the customer's problem is not fully clear, ask 1-2 SHORT, SPECIFIC questions to diagnose.`;

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
        statusEl.textContent = "Done! Click 'Copy Response'.";

    } catch (error) {
        console.error('Error:', error);
        statusEl.textContent = 'Error: Failed to generate response. Check your API key.';
    }
});

// Copy the generated response to the clipboard
copyBtn.addEventListener('click', async () => {
    const outputText = document.getElementById('output').textContent;
    try {
        await navigator.clipboard.writeText(outputText);
        document.getElementById('status').textContent = 'Copied to clipboard!';
    } catch (err) {
        console.error('Failed to copy: ', err);
    }
});
