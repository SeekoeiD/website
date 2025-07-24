// Code block enhancements
document.addEventListener('DOMContentLoaded', function() {
  // Find all code blocks (pre elements and .highlight containers)
  const codeBlocks = document.querySelectorAll('pre:not(.chroma pre), .highlight, div[class*="language-"]');
  
  codeBlocks.forEach(function(codeBlock) {
    // Skip if already processed
    if (codeBlock.parentElement.classList.contains('code-container')) {
      return;
    }
    
    // For .highlight containers, target the actual pre element inside
    let targetElement = codeBlock;
    if (codeBlock.classList.contains('highlight')) {
      const innerPre = codeBlock.querySelector('pre');
      if (innerPre) {
        targetElement = codeBlock; // Keep the highlight container as the target
      }
    }
    
    // Create container wrapper
    const container = document.createElement('div');
    container.className = 'code-container';
    
    // Wrap the code block
    targetElement.parentNode.insertBefore(container, targetElement);
    container.appendChild(targetElement);
    
    // Detect language from class or data attribute
    let language = '';
    const elementToCheck = codeBlock.classList.contains('highlight') ? codeBlock.querySelector('code') || codeBlock : codeBlock;
    const classList = targetElement.className + ' ' + (elementToCheck.className || '');
    
    // Common language detection patterns
    const languagePatterns = [
      { pattern: /language-(\w+)/i, name: '$1' },
      { pattern: /lang-(\w+)/i, name: '$1' },
      { pattern: /highlight-(\w+)/i, name: '$1' },
      { pattern: /\b(javascript|js)\b/i, name: 'JavaScript' },
      { pattern: /\b(typescript|ts)\b/i, name: 'TypeScript' },
      { pattern: /\b(python|py)\b/i, name: 'Python' },
      { pattern: /\b(bash|shell|sh)\b/i, name: 'Bash' },
      { pattern: /\b(json)\b/i, name: 'JSON' },
      { pattern: /\b(yaml|yml)\b/i, name: 'YAML' },
      { pattern: /\b(html)\b/i, name: 'HTML' },
      { pattern: /\b(css)\b/i, name: 'CSS' },
      { pattern: /\b(go)\b/i, name: 'Go' },
      { pattern: /\b(rust|rs)\b/i, name: 'Rust' },
      { pattern: /\b(java)\b/i, name: 'Java' },
      { pattern: /\b(cpp|c\+\+)\b/i, name: 'C++' },
      { pattern: /\b(c)\b/i, name: 'C' },
      { pattern: /\b(toml)\b/i, name: 'TOML' },
      { pattern: /\b(xml)\b/i, name: 'XML' },
      { pattern: /\b(markdown|md)\b/i, name: 'Markdown' },
      { pattern: /\b(sql)\b/i, name: 'SQL' },
      { pattern: /\b(text|txt|plaintext)\b/i, name: 'Text' }
    ];
    
    for (const pattern of languagePatterns) {
      const match = classList.match(pattern.pattern);
      if (match) {
        language = pattern.name.replace('$1', match[1].charAt(0).toUpperCase() + match[1].slice(1));
        break;
      }
    }
    
    // If no language detected, check for data attributes or guess from content
    if (!language) {
      const codeElement = targetElement.querySelector('code') || targetElement;
      const content = (codeElement.textContent || '').trim();
      
      // Simple content-based detection
      if (content.startsWith('#!/bin/bash') || content.includes('sudo ') || content.includes('apt ') || content.includes('yum ')) {
        language = 'Bash';
      } else if (content.includes('{') && content.includes('}') && (content.includes('"') || content.includes("'"))) {
        if (content.includes('+++') || content.includes('title =')) {
          language = 'TOML';
        } else {
          language = 'JSON';
        }
      } else if (content.includes('def ') || content.includes('import ') || content.includes('print(')) {
        language = 'Python';
      } else if (content.includes('function ') || content.includes('const ') || content.includes('let ')) {
        language = 'JavaScript';
      }
    }
    
    // Add language label if detected
    if (language) {
      const languageLabel = document.createElement('span');
      languageLabel.className = 'code-language';
      languageLabel.textContent = language;
      container.appendChild(languageLabel);
    }
    
    // Create copy button
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.innerHTML = '📋 Copy';
    copyButton.setAttribute('aria-label', 'Copy code to clipboard');
    
    // Add copy functionality
    copyButton.addEventListener('click', function() {
      const codeElement = targetElement.querySelector('code') || targetElement;
      let textToCopy = codeElement.textContent || codeElement.innerText;
      
      // Clean up the text (remove line numbers if present)
      textToCopy = textToCopy.replace(/^\s*\d+\s+/gm, '').replace(/^\s*\d+\s*\|\s*/gm, '');
      
      // Use the Clipboard API if available, otherwise fallback
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).then(function() {
          showCopySuccess(copyButton);
        }).catch(function() {
          fallbackCopyTextToClipboard(textToCopy, copyButton);
        });
      } else {
        fallbackCopyTextToClipboard(textToCopy, copyButton);
      }
    });
    
    container.appendChild(copyButton);
  });
  
  // Copy success feedback
  function showCopySuccess(button) {
    const originalText = button.innerHTML;
    button.innerHTML = '✅ Copied!';
    button.classList.add('copied');
    
    setTimeout(function() {
      button.innerHTML = originalText;
      button.classList.remove('copied');
    }, 2000);
  }
  
  // Fallback copy method for older browsers
  function fallbackCopyTextToClipboard(text, button) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Avoid scrolling to bottom
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        showCopySuccess(button);
      } else {
        console.error('Fallback: Unable to copy text');
        button.innerHTML = '❌ Failed';
        setTimeout(function() {
          button.innerHTML = '📋 Copy';
        }, 2000);
      }
    } catch (err) {
      console.error('Fallback: Unable to copy', err);
      button.innerHTML = '❌ Failed';
      setTimeout(function() {
        button.innerHTML = '📋 Copy';
      }, 2000);
    }
    
    document.body.removeChild(textArea);
  }
});
