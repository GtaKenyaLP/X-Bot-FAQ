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

// Variables
let faqData = null;
let lastFetchTime = 0;
let trainingData = null;
let lastTrainingFetch = 0;
let currentLanguage = 'en'; // Default to English

// Load saved settings
chrome.storage.local.get(['extensionEnabled', 'languagePreference'], function(result) {
    extensionToggle.checked = result.extensionEnabled !== false;
    if (result.languagePreference) {
        currentLanguage = result.languagePreference;
        if (languageToggle) {
            languageToggle.checked = currentLanguage === 'sw';
        }
    }
});

// Save toggle state
extensionToggle.addEventListener('change', function() {
    chrome.storage.local.set({extensionEnabled: this.checked});
    if (!this.checked) {
        suggestionElement.textContent = currentLanguage === 'en' 
            ? "Extension is disabled. Enable to get suggestions." 
            : "Programu imezimwa. Wezesha kupata mapendekezo.";
        copyButton.disabled = true;
    } else {
        customerQuestion.dispatchEvent(new Event('input'));
    }
});

// Language toggle (if element exists)
if (languageToggle) {
    languageToggle.addEventListener('change', function() {
        currentLanguage = this.checked ? 'sw' : 'en';
        chrome.storage.local.set({languagePreference: currentLanguage});
        customerQuestion.dispatchEvent(new Event('input'));
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

// Generate suggestion based on input
customerQuestion.addEventListener('input', async function() {
    if (!extensionToggle.checked) {
        suggestionElement.textContent = currentLanguage === 'en' 
            ? "Extension is disabled. Enable to get suggestions." 
            : "Programu imezimwa. Wezesha kupata mapendekezo.";
        copyButton.disabled = true;
        return;
    }
    
    const question = this.value.toLowerCase();
    let suggestion = currentLanguage === 'en' 
        ? "I can't help with this, an agent will respond shortly 👍" 
        : "Siwezi kusaidia na hili, mwakilishi atajibu hivi karibuni 👍";
    let foundMatch = false;
    
    if (question) {
        try {
            const faqData = await fetchFAQData();
            for (const faq of faqData.faqs) {
                for (const keyword of faq.keywords) {
                    if (question.includes(keyword)) {
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
                        if (question.includes(pattern.toLowerCase())) {
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
    copyButton.disabled = !foundMatch && question !== "";
});

// Copy to clipboard functionality
copyButton.addEventListener('click', function() {
    const tempTextArea = document.createElement('textarea');
    tempTextArea.value = suggestionElement.textContent;
    document.body.appendChild(tempTextArea);
    tempTextArea.select();
    document.execCommand('copy');
    document.body.removeChild(tempTextArea);
    
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
    customerQuestion.value = '';
    let event;
    if (typeof Event === 'function') {
        event = new Event('input');
    } else {
        event = document.createEvent('Event');
        event.initEvent('input', true, true);
    }
    customerQuestion.dispatchEvent(event);
    customerQuestion.focus();
});

// Focus on the textarea when the popup opens
window.addEventListener('load', function() {
    customerQuestion.focus();
});

// Prefetch FAQ data when the popup loads
fetchFAQData().catch(error => {
    console.error("Initial FAQ fetch failed:", error);
});

// Prefetch Training data when the popup loads
fetchTrainingData().catch(error => {
    console.error("Initial Training fetch failed:", error);
});
