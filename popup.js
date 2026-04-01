document.getElementById('exportBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({ target: { tabId: tab.id }, function: exportUniversalMarkdown });
});

function exportUniversalMarkdown() {
    const date = new Date().toLocaleString('sv-SE');
    const title = document.title.replace(" - Gemini", "").replace(" - Claude", "").replace(" - ChatGPT", "");

    let markdown = `---\ntitel: "${title}"\ndatum: ${date}\nkälla: ${window.location.href}\n---\n\n# ${title}\n\n`;

    // Här lägger vi till Claudes specifika klasser (.font-claude-message och [data-testid])
    const selectors = [
        '.message-content',             // Gemini
        '.model-response-text',         // Gemini/Old
        '.user-prompt',                 // Gemini
        '[data-message-author-role]',   // ChatGPT
        '.font-claude-message',         // Claude (AI)
        '[data-testid="user-message"]', // Claude (User)
        '.prose'                        // Allmän fallback
    ];

    const containers = document.querySelectorAll(selectors.join(', '));

    if (containers.length === 0) {
        alert("Hittade inga meddelanden. Testa att scrolla lite i chatten så att sidan 'vaknar', och tryck sen igen!");
        return;
    }

    containers.forEach((container) => {
        // Identifiera roll för Claude, Gemini och ChatGPT
        const isUser = container.closest('[data-testid="user-message"]') ||
            container.closest('[data-message-author-role="user"]') ||
            container.classList.contains('user-prompt') ||
            container.innerText.toLowerCase().startsWith('du\n');

        const roleHeader = isUser ? "## 👤 Du" : "## 🤖 AI";

        // Förhindra dubbletter om flera selectors matchar samma block
        if (container.dataset.exported === "true") return;
        container.dataset.exported = "true";

        markdown += `${roleHeader}\n\n`;

        // Gräv fram text, kod och bilder
        const elements = container.querySelectorAll('p, pre, ul, ol, h1, h2, h3, img, .text-zinc-500');

        if (elements.length > 0) {
            elements.forEach(el => {
                if (el.tagName === 'IMG') {
                    markdown += `![Bild](${el.src})\n\n`;
                } else if (el.tagName === 'PRE' || el.querySelector('code')) {
                    markdown += `\`\`\`\n${el.innerText.trim()}\n\`\`\`\n\n`;
                } else if (el.tagName === 'UL' || el.tagName === 'OL') {
                    markdown += `${el.innerText}\n\n`;
                } else {
                    markdown += `${el.innerText}\n\n`;
                }
            });
        } else {
            markdown += `${container.innerText}\n\n`;
        }

        markdown += `---\n\n`;
    });

    // Städa bort markeringen så vi kan exportera igen utan att ladda om sidan
    document.querySelectorAll('[data-exported]').forEach(el => delete el.dataset.exported);

    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, markdown], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `AI-Export-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
}