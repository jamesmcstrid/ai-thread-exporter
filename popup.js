document.getElementById('exportBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({ target: { tabId: tab.id }, function: exportUniversalMarkdown });
});

function exportUniversalMarkdown() {
    const date = new Date().toLocaleString('sv-SE');
    const title = document.title.replace(" - Gemini", "").replace(" - Claude", "").replace(" - ChatGPT", "");
    const hostname = window.location.hostname;

    let markdown = `---\ntitel: "${title}"\ndatum: ${date}\nkälla: ${window.location.href}\n---\n\n# ${title}\n\n`;

    // Samla meddelanden som { el, role } beroende på plattform
    let messages = [];

    if (hostname.includes('claude.ai')) {
        // Claude: hämta AI- och användarsvar separat för att undvika
        // dubbletter (.prose är barn till .font-claude-message)
        const userEls = document.querySelectorAll('[data-testid="user-message"]');
        const aiEls   = document.querySelectorAll('.font-claude-message');

        userEls.forEach(el => messages.push({ el, role: 'user' }));
        aiEls.forEach(el   => messages.push({ el, role: 'ai' }));

        // Sortera i dokumentordning (= konversationsordning)
        messages.sort((a, b) =>
            a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
        );

    } else if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
        // ChatGPT
        document.querySelectorAll('[data-message-author-role]').forEach(el => {
            const role = el.getAttribute('data-message-author-role') === 'user' ? 'user' : 'ai';
            messages.push({ el, role });
        });

    } else if (hostname.includes('gemini.google.com')) {
        // Gemini
        document.querySelectorAll('.message-content, .model-response-text, .user-prompt').forEach(el => {
            const role = el.classList.contains('user-prompt') ? 'user' : 'ai';
            messages.push({ el, role });
        });

    } else {
        // Generisk fallback
        document.querySelectorAll('[data-message-author-role], .prose').forEach(el => {
            const role = el.getAttribute?.('data-message-author-role') === 'user' ? 'user' : 'ai';
            messages.push({ el, role });
        });
    }

    if (messages.length === 0) {
        alert("Hittade inga meddelanden. Testa att scrolla lite i chatten så att sidan 'vaknar', och tryck sen igen!");
        return;
    }

    messages.forEach(({ el, role }) => {
        const roleHeader = role === 'user' ? "## 👤 Du" : "## 🤖 AI";
        markdown += `${roleHeader}\n\n`;

        // Gräv fram text, kod och bilder
        const elements = el.querySelectorAll('p, pre, ul, ol, h1, h2, h3, img');

        if (elements.length > 0) {
            elements.forEach(child => {
                if (child.tagName === 'IMG') {
                    markdown += `![Bild](${child.src})\n\n`;
                } else if (child.tagName === 'PRE' || child.querySelector('code')) {
                    markdown += `\`\`\`\n${child.innerText.trim()}\n\`\`\`\n\n`;
                } else if (child.tagName === 'UL' || child.tagName === 'OL') {
                    markdown += `${child.innerText}\n\n`;
                } else {
                    markdown += `${child.innerText}\n\n`;
                }
            });
        } else {
            markdown += `${el.innerText}\n\n`;
        }

        markdown += `---\n\n`;
    });

    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, markdown], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `AI-Export-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
}
