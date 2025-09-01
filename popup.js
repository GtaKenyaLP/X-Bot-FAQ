// Configuration
const FAQ_URL = "https://raw.githubusercontent.com/GtaKenyaLP/X-Bot-FAQ/refs/heads/main/faq.json";
const TRAINING_URL = "https://raw.githubusercontent.com/GtaKenyaLP/X-Bot-FAQ/refs/heads/main/training.json";
const CACHE_TIME = 5 * 60 * 1000; // 5 minutes cache

// DOM elements
const extensionToggle = document.getElementById('extensionToggle');
const customerQuestion = document.getElementById('customerQuestion');
const suggestionElement = document.getElementById('suggestion');
const copyButton = document.getElementById('copyButton');
const clearButton = document.getElementById('clearButton');
const languageToggle = document.getElementById('languageToggle');
const statusText = document.getElementById('statusText');
const platformName = document.getElementById('platformName');
const analyzeBtn = document.getElementById('analyzeBtn');
const manualInput = document.getElementById('manualInput');

// Variables
let faqData = null;
let lastFetchTime = 0;
let trainingData = null;
let lastTrainingFetch = 0;
let currentLanguage = 'en'; // Default to English
let isEnabled = true;
let detectedPlatform = '';

// Initialize the popup
document.addEventListener('DOMContentLoaded', function() {
    initializePopup();
});

async function initializePopup() {
    // Load saved settings
    const result = await new Promise(resolve => {
        chrome.storage.local.get(['extensionEnabled', 'languagePreference', 'lastCustomerMessage', 'detectedPlatform'], resolve);
    });
    
    isEnabled = result.extensionEnabled !== false;
    extensionToggle.checked = isEnabled;
    statusText.textContent = isEnabled ? 'Enabled' : 'Disabled';
    
    if (result.languagePreference) {
        currentLanguage = result.languagePreference;
        if (languageToggle) {
            languageToggle.checked = currentLanguage === 'sw';
        }
    }
    
    // Show detected message if available
    if (result.lastCustomerMessage) {
        customerQuestion.textContent = result.lastCustomerMessage;
        generateSuggestion(result.lastCustomerMessage);
    }
    
    if (result.detectedPlatform) {
        detectedPlatform = result.detectedPlatform;
        platformName.textContent = `Detected: ${detectedPlatform.charAt(0).toUpperCase() + detectedPlatform.slice(1)}`;
    }
    
    // Set up event listeners
    setupEventListeners();
    
    // Try to get the latest message from the current tab
    getCurrentTabCustomerMessage();
    
    // Prefetch data
    fetchFAQData().catch(console.error);
    fetchTrainingData().catch(console.error);
}

function setupEventListeners() {
    // Save toggle state
    extensionToggle.addEventListener('change', function() {
        isEnabled = this.checked;
        statusText.textContent = isEnabled ? 'Enabled' : 'Disabled';
        chrome.storage.local.set({extensionEnabled: isEnabled});
        
        // Send message to background script
        chrome.runtime.sendMessage({
            action: "toggleEnabled",
            value: isEnabled
        });
        
        if (!isEnabled) {
            suggestionElement.textContent = currentLanguage === 'en' 
                ? "Extension is disabled. Enable to get suggestions." 
                : "Programu imezimwa. Wezesha kupata mapendekezo.";
            copyButton.disabled = true;
        } else {
            // Refresh the suggestion if we have a question
            if (customerQuestion.textContent) {
                generateSuggestion(customerQuestion.textContent);
            }
        }
    });

    // Language toggle (if element exists)
    if (languageToggle) {
        languageToggle.addEventListener('change', function() {
            currentLanguage = this.checked ? 'sw' : 'en';
            chrome.storage.local.set({languagePreference: currentLanguage});
            
            // Regenerate suggestion with new language
            if (customerQuestion.textContent) {
                generateSuggestion(customerQuestion.textContent);
            }
        });
    }

    // Manual analysis
    analyzeBtn.addEventListener('click', function() {
        const question = manualInput.value.trim();
        if (question) {
            customerQuestion.textContent = question;
            platformName.textContent = 'Manual input';
            generateSuggestion(question);
        }
    });

    // Copy to clipboard functionality
    copyButton.addEventListener('click', function() {
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = suggestionElement.textContent;
        document.body.appendChild(tempTextArea);
        tempTextArea.select();
        document.execCommand('copy');
        document.body.removeChild(tempTextArea);
        
        // Also try to paste into the active chat
        pasteSuggestionIntoChat();
        
        const originalText = this.innerHTML;
        this.innerHTML = currentLanguage === 'en' 
            ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 6L9 17l-5-5"></path>
               </svg>
               Copied!` 
            : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 6L9 17l-5-5"></path>
               </svg>
               Imeigwa!`;
        
        if (this.classList) {
            this.classList.add('pulse');
        }
        
        setTimeout(() => {
            this.innerHTML = originalText;
            if (this.classList) {
                this.classList.remove('pulse');
            }
        }, 1500);
    });

    // Clear input functionality
    clearButton.addEventListener('click', function() {
        customerQuestion.textContent = '';
        manualInput.value = '';
        suggestionElement.textContent = currentLanguage === 'en' 
            ? "Enter a customer question to get a suggestion" 
            : "Weka swali la mteja ili upate pendekezo";
        copyButton.disabled = true;
    });

    // Focus on the manual input when the popup opens
    manualInput.focus();
}

// Get the latest customer message from current tab
function getCurrentTabCustomerMessage() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0] && isSupportedPlatform(tabs[0].url)) {
            chrome.tabs.sendMessage(
                tabs[0].id,
                { action: "getCustomerMessage" },
                function(response) {
                    if (response && response.message) {
                        customerQuestion.textContent = response.message;
                        detectedPlatform = response.platform;
                        platformName.textContent = `Detected: ${detectedPlatform.charAt(0).toUpperCase() + detectedPlatform.slice(1)}`;
                        generateSuggestion(response.message);
                        
                        // Save to storage
                        chrome.storage.local.set({
                            lastCustomerMessage: response.message,
                            detectedPlatform: response.platform
                        });
                    }
                }
            );
        }
    });
}

// Check if URL is a supported platform
function isSupportedPlatform(url) {
    if (!url) return false;
    return url.includes('zendesk') || 
           url.includes('freshdesk') || 
           url.includes('facebook') || 
           url.includes('hootsuite') ||
           url.includes('freshchat') ||
           url.includes('intercom');
}

// Generate suggestion based on question
async function generateSuggestion(question) {
    if (!isEnabled) {
        suggestionElement.textContent = currentLanguage === 'en' 
            ? "Extension is disabled. Enable to get suggestions." 
            : "Programu imezimwa. Wezesha kupata mapendekezo.";
        copyButton.disabled = true;
        return;
    }
    
    const questionText = question.toLowerCase();
    let suggestion = currentLanguage === 'en' 
        ? "I can't help with this, an agent will respond shortly 👍" 
        : "Siwezi kusaidia na hili, mwakilishi atajibu hivi karibuni 👍";
    let foundMatch = false;
    
    if (questionText) {
        try {
            const faqData = await fetchFAQData();
            for (const faq of faqData.faqs) {
                for (const keyword of faq.keywords) {
                    if (questionText.includes(keyword)) {
                        suggestion = currentLanguage === 'en' ? faq.response : (faq.response_sw || faq.response);
                        foundMatch = true;
                        break;
                    }
                }
                if (foundMatch) break;
            }

            // If no FAQ match, try Training intents
            if (!foundMatch) {
                const training = await fetchTrainingData();
                for (const intent of training.intents) {
                    for (const pattern of intent.patterns) {
                        if (questionText.includes(pattern.toLowerCase())) {
                            const responses = intent.responses;
                            suggestion = currentLanguage === 'en' 
                                ? responses[Math.floor(Math.random() * responses.length)]
                                : (intent.responses_sw 
                                    ? intent.responses_sw[Math.floor(Math.random() * intent.responses_sw.length)] 
                                    : responses[Math.floor(Math.random() * responses.length)]);
                            foundMatch = true;
                            break;
                        }
                    }
                    if (foundMatch) break;
                }
            }

            if (suggestionElement.classList) {
                suggestionElement.classList.remove('fade-in');
                setTimeout(() => {
                    suggestionElement.classList.add('fade-in');
                }, 10);
            }
        } catch (error) {
            console.error("Error processing question:", error);
            suggestion = currentLanguage === 'en' 
                ? "Error loading suggestions. Please try again." 
                : "Hitilafu ya kupakia mapendekezo. Tafadhali jaribu tena.";
        }
    } else {
        suggestion = currentLanguage === 'en' 
            ? "Enter a customer question to get a suggestion" 
            : "Weka swali la mteja ili upate pendekezo";
    }
    
    suggestionElement.textContent = suggestion;
    copyButton.disabled = !foundMatch && questionText !== "";
}

// Paste suggestion into the active chat
function pasteSuggestionIntoChat() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0] && isSupportedPlatform(tabs[0].url)) {
            chrome.tabs.sendMessage(
                tabs[0].id,
                {
                    action: "pasteSuggestion",
                    text: suggestionElement.textContent
                },
                function(response) {
                    if (response && response.success) {
                        console.log("Suggestion pasted successfully");
                    } else {
                        console.log("Could not paste suggestion automatically");
                    }
                }
            );
        }
    });
}

// Fetch FAQ data from GitHub
async function fetchFAQData() {
    const now = Date.now();
    if (faqData && (now - lastFetchTime) < CACHE_TIME) {
        return faqData;
    }
    
    try {
        const response = await fetch(`${FAQ_URL}?t=${now}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        faqData = data;
        lastFetchTime = now;
        chrome.storage.local.set({faqCache: {data: data, timestamp: now}});
        return data;
    } catch (error) {
        console.error("Failed to fetch FAQ data:", error);
        const result = await new Promise(resolve => {
            chrome.storage.local.get(['faqCache'], resolve);
        });
        if (result.faqCache && result.faqCache.data) {
            faqData = result.faqCache.data;
            return faqData;
        }
        return {
            faqs: [
                {
                    keywords: ["warranty", "guarantee", "cover"],
                    response: "Our products have a 2-year warranty 🎉",
                    response_sw: "Bidhaa zetu zina dhamana ya miaka 2 🎉",
                    category: "product_info"
                },
                {
                    keywords: ["payment", "pay", "mpesa", "buy"],
                    response: "You can pay via M-Pesa Paybill 123456.",
                    response_sw: "Unaweza kulipa kupitia M-Pesa Paybill 123456.",
                    category: "payment"
                },
                {
                    keywords: ["hello", "hi", "help"],
                    response: "Hello! Thank you for contacting Sun King. How can we assist you today?",
                    response_sw: "Hujambo! Tunashukuru kwa kuwasiliana na Sun King, je, ungependa kuhudumiwa vipi leo?",
                    category: "greeting"
                }
            ]
        };
    }
}

// Fetch Training data
async function fetchTrainingData() {
    const now = Date.now();
    if (trainingData && (now - lastTrainingFetch) < CACHE_TIME) {
        return trainingData;
    }

    try {
        const response = await fetch(`${TRAINING_URL}?t=${now}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        trainingData = data;
        lastTrainingFetch = now;
        return data;
    } catch (error) {
        console.error("Failed to fetch training data:", error);
        return { intents: [] };
    }
}
