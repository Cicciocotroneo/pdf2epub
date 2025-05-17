// Configura PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js';

// Elementi DOM
const dropArea = document.getElementById('dropArea');
const fileInput = document.getElementById('fileInput');
const selectFileBtn = document.getElementById('selectFileBtn');
const convertBtn = document.getElementById('convertBtn');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progress');
const statusText = document.getElementById('status');
const resultDiv = document.getElementById('result');
const downloadLink = document.getElementById('downloadLink');

// Opzioni
const removePageNumbers = document.getElementById('removePageNumbers');
const removeHeaders = document.getElementById('removeHeaders');
const reconstructText = document.getElementById('reconstructText');
const detectChapters = document.getElementById('detectChapters');

let pdfFile = null;

// Gestione drag and drop
dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropArea.classList.add('highlight');
});

dropArea.addEventListener('dragleave', () => {
    dropArea.classList.remove('highlight');
});

dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropArea.classList.remove('highlight');
    
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

// Gestione selezione file
selectFileBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
        handleFile(fileInput.files[0]);
    }
});

function handleFile(file) {
    if (file.type !== 'application/pdf') {
        alert('Per favore seleziona un file PDF');
        return;
    }
    
    pdfFile = file;
    convertBtn.disabled = false;
    statusText.textContent = `File selezionato: ${file.name}`;
}

// Funzione principale di conversione
convertBtn.addEventListener('click', async () => {
    if (!pdfFile) return;
    
    // Mostra progresso
    progressContainer.style.display = 'block';
    resultDiv.style.display = 'none';
    convertBtn.disabled = true;
    
    try {
        statusText.textContent = 'Caricamento PDF...';
        progressBar.style.width = '10%';
        
        // Carica il PDF
        const pdfData = await readFileAsArrayBuffer(pdfFile);
        const pdf = await pdfjsLib.getDocument({data: pdfData}).promise;
        
        statusText.textContent = 'Estrazione testo...';
        progressBar.style.width = '20%';
        
        // Estrai testo da tutte le pagine
        let fullText = '';
        let pagesText = [];
        const pageCount = pdf.numPages;
        
        for (let i = 1; i <= pageCount; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const text = textContent.items.map(item => item.str).join(' ');
            pagesText.push(text);
            
            // Aggiorna progresso
            const progress = 20 + (i / pageCount * 60);
            progressBar.style.width = `${progress}%`;
            statusText.textContent = `Elaborazione pagina ${i} di ${pageCount}...`;
        }
        
        statusText.textContent = 'Elaborazione testo...';
        progressBar.style.width = '85%';
        
        // Elabora il testo
        const processedText = processText(pagesText);
        
        statusText.textContent = 'Creazione EPUB...';
        progressBar.style.width = '90%';
        
        // Crea EPUB
        const epubBlob = await createEPUB(processedText, pdfFile.name.replace('.pdf', ''));
        
        statusText.textContent = 'Completato!';
        progressBar.style.width = '100%';
        
        // Mostra risultato
        downloadLink.href = URL.createObjectURL(epubBlob);
        downloadLink.download = pdfFile.name.replace('.pdf', '.epub');
        resultDiv.style.display = 'block';
        
    } catch (error) {
        console.error('Errore durante la conversione:', error);
        statusText.textContent = `Errore: ${error.message}`;
        progressBar.style.backgroundColor = 'var(--error-color)';
    } finally {
        convertBtn.disabled = false;
    }
});

// Leggi file come ArrayBuffer
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// Elabora il testo estratto
function processText(pagesText) {
    let processedPages = [];
    let headerFooterPatterns = detectHeaderFooterPatterns(pagesText);
    
    for (let i = 0; i < pagesText.length; i++) {
        let text = pagesText[i];
        
        // Rimuovi intestazioni/piè di pagina
        if (removeHeaders.checked && headerFooterPatterns) {
            if (headerFooterPatterns.header) {
                text = text.replace(new RegExp(headerFooterPatterns.header, 'g'), '');
            }
            if (headerFooterPatterns.footer) {
                text = text.replace(new RegExp(headerFooterPatterns.footer, 'g'), '');
            }
        }
        
        // Rimuovi numeri di pagina
        if (removePageNumbers.checked) {
            // Pattern per numeri di pagina (es. "3", "- 3 -", "Pagina 3")
            text = text.replace(/^\s*\d+\s*$/gm, '');
            text = text.replace(/^\s*[-–]\s*\d+\s*[-–]\s*$/gm, '');
            text = text.replace(/^\s*Pagina?\s*\d+\s*$/gim, '');
        }
        
        // Ricostruisci flusso del testo
        if (reconstructText.checked) {
            text = reconstructTextFlow(text);
        }
        
        processedPages.push(text);
    }
    
    // Riconosci capitoli se richiesto
    if (detectChapters.checked) {
        return detectChaptersAndStructure(processedPages);
    }
    
    return {pages: processedPages, chapters: null};
}

// Riconosci pattern di intestazioni/piè di pagina ripetuti
function detectHeaderFooterPatterns(pagesText) {
    if (pagesText.length < 3) return null;
    
    const samplePages = [pagesText[0], pagesText[1], pagesText[Math.floor(pagesText.length/2)], pagesText[pagesText.length-1]];
    const linesByPage = samplePages.map(page => page.split('\n').filter(line => line.trim()));
    
    // Cerca linee comuni all'inizio/fine delle pagine
    let potentialHeaders = [];
    let potentialFooters = [];
    
    for (let i = 0; i < linesByPage[0].length; i++) {
        const line = linesByPage[0][i];
        if (samplePages.every(page => page.split('\n')[i] === line)) {
            potentialHeaders.push(line);
        }
    }
    
    for (let i = 0; i < linesByPage[0].length; i++) {
        const line = linesByPage[0][linesByPage[0].length - 1 - i];
        if (samplePages.every(page => {
            const pageLines = page.split('\n');
            return pageLines[pageLines.length - 1 - i] === line;
        })) {
            potentialFooters.unshift(line);
        }
    }
    
    return {
        header: potentialHeaders.length ? escapeRegExp(potentialHeaders.join(' ')) : null,
        footer: potentialFooters.length ? escapeRegExp(potentialFooters.join(' ')) : null
    };
}

// Ricostruisci il flusso del testo
function reconstructTextFlow(text) {
    // Unisci le parole sillabate
    text = text.replace(/(\w+)-\s+(\w+)/g, '$1$2');
    
    // Rimuovi interruzioni di riga non necessarie
    let lines = text.split('\n');
    let reconstructedText = '';
    let currentParagraph = '';
    
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        
        // Se la linea termina con un carattere di fine frase, mantieni l'interruzione
        if (/[.!?:”"]$/.test(line)) {
            currentParagraph += line + ' ';
            reconstructedText += currentParagraph + '\n\n';
            currentParagraph = '';
        } else {
            currentParagraph += line + ' ';
        }
    }
    
    // Aggiungi l'ultimo paragrafo se presente
    if (currentParagraph) {
        reconstructedText += currentParagraph.trim();
    }
    
    return reconstructedText.trim();
}

// Riconosci capitoli e struttura
function detectChaptersAndStructure(pages) {
    let chapters = [];
    let currentChapter = {title: 'Inizio', startPage: 0, content: []};
    let toc = [];
    
    // Pattern comuni per titoli di capitolo
    const chapterPatterns = [
        /^capitolo\s+\w+/i,
        /^chapter\s+\w+/i,
        /^(sezione|parte)\s+\w+/i,
        /^\d+\.\s+.+/,
        /^[IVXLCDM]+\.\s+.+/i
    ];
    
    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const lines = page.split('\n').filter(line => line.trim());
        
        // Cerca un titolo di capitolo nella prima riga
        let isChapter = false;
        if (lines.length > 0) {
            for (const pattern of chapterPatterns) {
                if (pattern.test(lines[0])) {
                    isChapter = true;
                    break;
                }
            }
            
            // Verifica anche se il testo è centrato o in maiuscolo (segno di titolo)
            if (!isChapter && lines[0] === lines[0].toUpperCase()) {
                isChapter = true;
            }
        }
        
        if (isChapter) {
            // Salva il capitolo corrente
            if (currentChapter.content.length > 0 || chapters.length === 0) {
                chapters.push({...currentChapter, endPage: i-1});
                toc.push(currentChapter.title);
            }
            
            // Inizia un nuovo capitolo
            currentChapter = {
                title: lines[0],
                startPage: i,
                content: []
            };
        }
        
        currentChapter.content.push(page);
    }
    
    // Aggiungi l'ultimo capitolo
    if (currentChapter.content.length > 0) {
        chapters.push({...currentChapter, endPage: pages.length-1});
        toc.push(currentChapter.title);
    }
    
    return {pages, chapters, toc};
}

// Crea file EPUB
async function createEPUB(content, title) {
    const zip = new JSZip();
    
    // Struttura base EPUB
    zip.file('mimetype', 'application/epub+zip');
    
    const META_INF = zip.folder('META-INF');
    META_INF.file('container.xml', `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>`);
    
    const OEBPS = zip.folder('OEBPS');
    
    // Crea file XHTML per ogni capitolo o pagina
    let spineItems = [];
    let manifestItems = [];
    let tocItems = [];
    
    if (content.chapters) {
        // Struttura con capitoli
        for (let i = 0; i < content.chapters.length; i++) {
            const chapter = content.chapters[i];
            const filename = `chapter_${i+1}.xhtml`;
            
            let htmlContent = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
    <title>${escapeXml(chapter.title)}</title>
    <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
    <section epub:type="chapter">
        <h1>${escapeXml(chapter.title)}</h1>
        ${chapter.content.map(page => `<p>${escapeXml(page)}</p>`).join('\n')}
    </section>
</body>
</html>`;
            
            OEBPS.file(filename, htmlContent);
            spineItems.push(`<itemref idref="chapter_${i+1}"/>`);
            manifestItems.push(`<item id="chapter_${i+1}" href="${filename}" media-type="application/xhtml+xml"/>`);
            tocItems.push(`<navPoint id="navPoint-${i+1}" playOrder="${i+1}">
    <navLabel><text>${escapeXml(chapter.title)}</text></navLabel>
    <content src="${filename}"/>
</navPoint>`);
        }
    } else {
        // Struttura semplice (senza capitoli riconosciuti)
        for (let i = 0; i < content.pages.length; i++) {
            const filename = `page_${i+1}.xhtml`;
            
            let htmlContent = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <title>Pagina ${i+1}</title>
    <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
    <p>${escapeXml(content.pages[i])}</p>
</body>
</html>`;
            
            OEBPS.file(filename, htmlContent);
            spineItems.push(`<itemref idref="page_${i+1}"/>`);
            manifestItems.push(`<item id="page_${i+1}" href="${filename}" media-type="application/xhtml+xml"/>`);
        }
    }
    
    // Aggiungi stile CSS
    OEBPS.file('style.css', `body {
    font-family: serif;
    line-height: 1.5;
    margin: 1em;
    text-align: justify;
}

h1 {
    font-size: 1.5em;
    text-align: center;
    margin-bottom: 1em;
    page-break-after: avoid;
}

p {
    margin: 0.5em 0;
    text-indent: 1.5em;
}

section {
    page-break-after: always;
}`);
    
    // Crea content.opf
    const opfContent = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:identifier id="pub-id">urn:uuid:${generateUUID()}</dc:identifier>
        <dc:title>${escapeXml(title)}</dc:title>
        <dc:language>it</dc:language>
        <meta property="dcterms:modified">${new Date().toISOString()}</meta>
    </metadata>
    <manifest>
        <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
        <item id="style" href="style.css" media-type="text/css"/>
        ${manifestItems.join('\n')}
    </manifest>
    <spine>
        ${spineItems.join('\n')}
    </spine>
</package>`;
    
    OEBPS.file('content.opf', opfContent);
    
    // Crea nav.xhtml (indice)
    const navContent = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
    <title>Indice</title>
    <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
    <nav epub:type="toc">
        <h1>Indice</h1>
        <ol>
            ${content.toc ? content.toc.map((title, i) => 
                `<li><a href="chapter_${i+1}.xhtml">${escapeXml(title)}</a></li>`
            ).join('\n') : '<li><a href="page_1.xhtml">Inizio</a></li>'}
        </ol>
    </nav>
</body>
</html>`;
    
    OEBPS.file('nav.xhtml', navContent);
    
    // Genera il file ZIP
    const zipContent = await zip.generateAsync({type: 'blob'});
    return zipContent;
}

// Funzioni di utilità
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Registra Service Worker per PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(registration => {
            console.log('ServiceWorker registrato con successo:', registration.scope);
        }).catch(error => {
            console.log('Registrazione ServiceWorker fallita:', error);
        });
    });
}
