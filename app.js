// Configura PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js';

// Elementi DOM
const dropArea = document.getElementById('dropArea');
const fileInput = document.getElementById('fileInput');
const selectFileBtn = document.getElementById('selectFileBtn');
const convertBtn = document.getElementById('convertBtn');
const previewBtn = document.getElementById('previewBtn');
const closePreviewBtn = document.getElementById('closePreviewBtn');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progress');
const statusText = document.getElementById('status');
const resultDiv = document.getElementById('result');
const downloadLink = document.getElementById('downloadLink');
const previewContainer = document.getElementById('previewContainer');
const previewContent = document.getElementById('previewContent');

// Opzioni
const removePageNumbers = document.getElementById('removePageNumbers');
const removeHeaders = document.getElementById('removeHeaders');
const reconstructText = document.getElementById('reconstructText');
const detectChapters = document.getElementById('detectChapters');

let pdfFile = null;
let processedContent = null;
let currentEdits = {};

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
    previewBtn.disabled = false;
    statusText.textContent = `File selezionato: ${file.name}`;
    processedContent = null; // Resetta il contenuto processato
    currentEdits = {}; // Resetta le modifiche
}

// Funzione principale di conversione
convertBtn.addEventListener('click', async () => {
    if (!pdfFile) return;
    
    // Mostra progresso
    progressContainer.style.display = 'block';
    resultDiv.style.display = 'none';
    previewContainer.style.display = 'none';
    convertBtn.disabled = true;
    previewBtn.disabled = true;
    
    try {
        statusText.textContent = 'Caricamento PDF...';
        progressBar.style.width = '10%';
        
        // Carica il PDF
        const pdfData = await readFileAsArrayBuffer(pdfFile);
        const pdf = await pdfjsLib.getDocument({data: pdfData}).promise;
        
        statusText.textContent = 'Estrazione testo...';
        progressBar.style.width = '20%';
        
        // Estrai testo da tutte le pagine
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
        processedContent = processText(pagesText);
        
        // Applica le modifiche dall'anteprima se presenti
        if (Object.keys(currentEdits).length > 0) {
            applyEditsToContent();
        }
        
        statusText.textContent = 'Creazione EPUB...';
        progressBar.style.width = '90%';
        
        // Crea EPUB
        const epubBlob = await createEPUB(processedContent, pdfFile.name.replace('.pdf', ''));
        
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
        previewBtn.disabled = false;
    }
});

// Anteprima del testo elaborato
previewBtn.addEventListener('click', async () => {
    if (!pdfFile) return;
    
    try {
        previewBtn.disabled = true;
        convertBtn.disabled = true;
        statusText.textContent = 'Preparazione anteprima...';
        progressContainer.style.display = 'block';
        progressBar.style.width = '10%';
        
        // Carica il PDF solo se non l'abbiamo già fatto
        if (!processedContent) {
            const pdfData = await readFileAsArrayBuffer(pdfFile);
            const pdf = await pdfjsLib.getDocument({data: pdfData}).promise;
            
            progressBar.style.width = '30%';
            statusText.textContent = 'Estrazione testo...';
            
            // Estrai testo da tutte le pagine
            let pagesText = [];
            const pageCount = pdf.numPages;
            
            for (let i = 1; i <= pageCount; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const text = textContent.items.map(item => item.str).join(' ');
                pagesText.push(text);
                
                // Aggiorna progresso
                const progress = 30 + (i / pageCount * 50);
                progressBar.style.width = `${progress}%`;
                statusText.textContent = `Estrazione pagina ${i} di ${pageCount}...`;
            }
            
            progressBar.style.width = '80%';
            statusText.textContent = 'Elaborazione testo...';
            
            // Elabora il testo
            processedContent = processText(pagesText);
        }
        
        progressBar.style.width = '90%';
        statusText.textContent = 'Preparazione anteprima...';
        
        // Mostra l'anteprima
        showPreview(processedContent);
        
        progressBar.style.width = '100%';
        statusText.textContent = 'Anteprima pronta!';
        
    } catch (error) {
        console.error('Errore durante la preparazione dell\'anteprima:', error);
        statusText.textContent = `Errore: ${error.message}`;
        progressBar.style.backgroundColor = 'var(--error-color)';
    } finally {
        previewBtn.disabled = false;
        convertBtn.disabled = false;
        setTimeout(() => {
            progressContainer.style.display = 'none';
        }, 1000);
    }
});

// Chiudi anteprima
closePreviewBtn.addEventListener('click', () => {
    previewContainer.style.display = 'none';
    saveEdits(); // Salva le modifiche prima di chiudere
});

// Mostra anteprima del contenuto elaborato
function showPreview(content) {
    previewContent.innerHTML = '';
    
    if (content.chapters) {
        // Mostra per capitoli
        content.chapters.forEach((chapter, chapterIndex) => {
            const chapterDiv = document.createElement('div');
            chapterDiv.className = 'preview-chapter';
            
            const chapterTitle = document.createElement('div');
            chapterTitle.className = 'chapter-title';
            chapterTitle.textContent = chapter.title;
            
            // Aggiungi campo di modifica per il titolo del capitolo
            const titleEditDiv = document.createElement('div');
            titleEditDiv.className = 'edit-controls';
            
            const titleEditInput = document.createElement('input');
            titleEditInput.type = 'text';
            titleEditInput.value = chapter.title;
            titleEditInput.className = 'edit-area';
            titleEditInput.dataset.chapterIndex = chapterIndex;
            titleEditInput.dataset.editType = 'title';
            
            titleEditDiv.appendChild(titleEditInput);
            
            chapterDiv.appendChild(chapterTitle);
            chapterDiv.appendChild(titleEditDiv);
            
            // Aggiungi pagine del capitolo
            chapter.content.forEach((page, pageIndex) => {
                const pageDiv = document.createElement('div');
                pageDiv.className = 'preview-page';
                
                const pageContent = document.createElement('div');
                pageContent.className = 'preview-text';
                pageContent.textContent = page;
                
                // Aggiungi campo di modifica per il contenuto della pagina
                const editDiv = document.createElement('div');
                editDiv.className = 'edit-controls';
                
                const editTextarea = document.createElement('textarea');
                editTextarea.className = 'edit-area';
                editTextarea.value = page;
                editTextarea.dataset.chapterIndex = chapterIndex;
                editTextarea.dataset.pageIndex = pageIndex;
                editTextarea.dataset.editType = 'content';
                
                const saveBtn = document.createElement('button');
                saveBtn.className = 'btn';
                saveBtn.textContent = 'Salva modifiche';
                saveBtn.onclick = () => saveEdit(
                    chapterIndex, 
                    pageIndex, 
                    editTextarea.value, 
                    'content'
                );
                
                editDiv.appendChild(editTextarea);
                editDiv.appendChild(saveBtn);
                
                pageDiv.appendChild(pageContent);
                pageDiv.appendChild(editDiv);
                
                chapterDiv.appendChild(pageDiv);
            });
            
            previewContent.appendChild(chapterDiv);
        });
    } else {
        // Mostra per pagine (se non ci sono capitoli riconosciuti)
        content.pages.forEach((page, pageIndex) => {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'preview-page';
            
            const pageNumber = document.createElement('div');
            pageNumber.className = 'page-number';
            pageNumber.textContent = `Pagina ${pageIndex + 1}`;
            
            const pageContent = document.createElement('div');
            pageContent.className = 'preview-text';
            pageContent.textContent = page;
            
            // Aggiungi campo di modifica
            const editDiv = document.createElement('div');
            editDiv.className = 'edit-controls';
            
            const editTextarea = document.createElement('textarea');
            editTextarea.className = 'edit-area';
            editTextarea.value = page;
            editTextarea.dataset.pageIndex = pageIndex;
            editTextarea.dataset.editType = 'content';
            
            const saveBtn = document.createElement('button');
            saveBtn.className = 'btn';
            saveBtn.textContent = 'Salva modifiche';
            saveBtn.onclick = () => saveEdit(
                null, 
                pageIndex, 
                editTextarea.value, 
                'content'
            );
            
            editDiv.appendChild(editTextarea);
            editDiv.appendChild(saveBtn);
            
            pageDiv.appendChild(pageNumber);
            pageDiv.appendChild(pageContent);
            pageDiv.appendChild(editDiv);
            
            previewContent.appendChild(pageDiv);
        });
    }
    
    previewContainer.style.display = 'block';
}

// Salva una singola modifica
function saveEdit(chapterIndex, pageIndex, newValue, editType) {
    const editKey = chapterIndex !== null ? 
        `chapter_${chapterIndex}_page_${pageIndex}` : 
        `page_${pageIndex}`;
    
    if (!currentEdits[editKey]) {
        currentEdits[editKey] = {};
    }
    
    currentEdits[editKey][editType] = newValue;
    
    // Mostra feedback all'utente
    const feedback = document.createElement('div');
    feedback.textContent = 'Modifica salvata!';
    feedback.style.color = 'var(--success-color)';
    feedback.style.marginTop = '5px';
    
    const editControls = event.target.parentElement;
    editControls.appendChild(feedback);
    
    setTimeout(() => {
        feedback.remove();
    }, 2000);
}

// Salva tutte le modifiche dall'anteprima
function saveEdits() {
    const editAreas = document.querySelectorAll('.edit-area');
    
    editAreas.forEach(area => {
        const chapterIndex = area.dataset.chapterIndex;
        const pageIndex = area.dataset.pageIndex;
        const editType = area.dataset.editType;
        const newValue = area.value;
        
        saveEdit(chapterIndex, pageIndex, newValue, editType);
    });
}

// Applica le modifiche al contenuto elaborato
function applyEditsToContent() {
    if (!processedContent) return;
    
    Object.keys(currentEdits).forEach(key => {
        const edit = currentEdits[key];
        
        if (key.startsWith('chapter_')) {
            // Modifica a un capitolo
            const parts = key.split('_');
            const chapterIndex = parseInt(parts[1]);
            const pageIndex = parseInt(parts[3]);
            
            if (edit.title && processedContent.chapters[chapterIndex]) {
                processedContent.chapters[chapterIndex].title = edit.title;
            }
            
            if (edit.content && processedContent.chapters[chapterIndex] && 
                processedContent.chapters[chapterIndex].content[pageIndex]) {
                processedContent.chapters[chapterIndex].content[pageIndex] = edit.content;
            }
        } else {
            // Modifica a una pagina senza capitoli
            const pageIndex = parseInt(key.split('_')[1]);
            
            if (edit.content && processedContent.pages[pageIndex]) {
                processedContent.pages[pageIndex] = edit.content;
            }
        }
    });
}

// Leggi file come ArrayBuffer
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// Funzione principale di elaborazione
function processText(pagesText) {
    // 1. Pre-elaborazione di ogni pagina
    const cleanedPages = pagesText.map((text, i) => {
        // Rimuovi numeri di pagina
        let cleaned = removePageNumbers(text, i);
        
        // Rimuovi intestazioni/piè di pagina (se richiesto)
        if (removeHeaders.checked) {
            cleaned = removeHeadersAndFooters(cleaned);
        }
        
        return cleaned;
    });
    
    // 2. Riconoscimento struttura capitoli
    const chapters = detectChapters.checked ? 
        detectChaptersAndStructure(cleanedPages) : 
        [{
            title: 'Documento completo',
            rawText: reconstructTextFlow(cleanedPages.join('\n'))
        }];
    
    // 3. Ricostruzione finale del testo
    return chapters.map(chapter => ({
        ...chapter,
        // Ricostruisci il flusso del testo per l'EPUB
        epubContent: chapter.rawText.split('\n\n')
            .map(para => `<p>${para}</p>`)
            .join('\n')
    }));
}


// Riconosci pattern di intestazioni/piè di pagina ripetuti
function detectHeaderFooterPatterns(pagesText) {
    if (pagesText.length < 3) return null;
    
    // Analizza più pagine per maggiore accuratezza
    const samplePages = [
        pagesText[0], 
        pagesText[1], 
        pagesText[Math.floor(pagesText.length/2)], 
        pagesText[pagesText.length-2],
        pagesText[pagesText.length-1]
    ];
    
    const linesByPage = samplePages.map(page => {
        const lines = page.split('\n').filter(line => line.trim());
        return {
            firstLines: lines.slice(0, 2), // Prime 2 righe per intestazione
            lastLines: lines.slice(-2) // Ultime 2 righe per piè di pagina
        };
    });
    function removePageNumbers(text, pageIndex) {
    // Pattern per numeri di pagina in varie forme:
    // 1. Solo numero (es. "123")
    // 2. Numero tra trattini (es. "- 123 -")
    // 3. Testo "Pagina X" in varie forme
    // 4. Numeri in fondo alla pagina (destra/sinistra)
    const pageNumPatterns = [
        /^\s*\d+\s*$/gm,                       // Solo numero
        /^\s*[-–]\s*\d+\s*[-–]\s*$/gm,         // Numero tra trattini
        /^\s*Pagina?\s*\d+\s*$/gim,            // "Pagina X"
        /\n\d+\s*$/g,                           // Fine pagina (destra)
        /^\d+\s*\n/g,                           // Inizio pagina (sinistra)
        /\b\d{1,3}\s+(?=\n|$)/g                 // Numeri solitari vicino a interruzioni
    ];

    // Rimuovi ogni occorrenza per ogni pattern
    pageNumPatterns.forEach(pattern => {
        text = text.replace(pattern, '');
    });

    return text;
}
    // Cerca intestazioni comuni
    let potentialHeaders = [];
    for (let i = 0; i < linesByPage[0].firstLines.length; i++) {
        const line = linesByPage[0].firstLines[i];
        if (samplePages.every((_, idx) => 
            linesByPage[idx].firstLines[i] === line)) {
            potentialHeaders.push(line);
        }
    }
    
    // Cerca piè di pagina comuni
    let potentialFooters = [];
    for (let i = 0; i < linesByPage[0].lastLines.length; i++) {
        const line = linesByPage[0].lastLines[i];
        if (samplePages.every((_, idx) => 
            linesByPage[idx].lastLines[i] === line)) {
            potentialFooters.unshift(line);
        }
    }
    
    // Filtra i pattern che sembrano numeri di pagina
    potentialHeaders = potentialHeaders.filter(line => !/^\d+$/.test(line.trim()));
    potentialFooters = potentialFooters.filter(line => !/^\d+$/.test(line.trim()));
    
    return {
        header: potentialHeaders.length ? escapeRegExp(potentialHeaders.join(' ')) : null,
        footer: potentialFooters.length ? escapeRegExp(potentialFooters.join(' ')) : null
    };
}

// Funzione migliorata per ricostruire il flusso del testo
function reconstructTextFlow(text) {
    // 1. Unisci parole sillabate (ma non dopo punteggiatura)
    text = text.replace(/([a-zàèéìòù])-\s+([a-zàèéìòù])/gi, '$1$2');
    
    // 2. Normalizza spazi e interruzioni
    text = text.replace(/\s+/g, ' ');
    
    // 3. Ricostruisci paragrafi basati sulla punteggiatura
    const sentences = text.split(/([.!?:…]+["']?\s+)/);
    let reconstructed = '';
    
    for (let i = 0; i < sentences.length; i += 2) {
        const sentence = sentences[i];
        const punctuation = sentences[i+1] || '';
        
        if (sentence) {
            // Aggiungi spazio solo se non inizia con un segno di punteggiatura
            if (reconstructed && !/[([{"']$/.test(reconstructed.slice(-1))) {
                reconstructed += ' ';
            }
            
            // Capitalizza la prima lettera dopo punteggiatura forte
            if (i > 0 && /[.!?]/.test(punctuation[0])) {
                reconstructed += sentence.charAt(0).toUpperCase() + sentence.slice(1);
            } else {
                reconstructed += sentence;
            }
            
            reconstructed += punctuation;
        }
    }

    // 4. Gestione speciale per dialoghi e virgolette
    reconstructed = reconstructed.replace(/"\s+/g, '"');
    reconstructed = reconstructed.replace(/\s+"/g, '"');
    
    return reconstructed.trim();
}





// Funzione migliorata per il riconoscimento dei capitoli
function detectChaptersAndStructure(pages) {
    let chapters = [];
    let currentChapter = { 
        title: 'Inizio', 
        startPage: 0, 
        content: [],
        rawText: '' 
    };
    
    // Pattern per titoli di capitolo
    const chapterPatterns = [
        /^\s*[IVXLCDM]+(?:\.\s*|\s+)/i,        // Numeri romani
        /^\s*Capitolo\s+\w+/i,                 // "Capitolo X"
        /^\s*[0-9]+(?:\.\s*|\s+)/,             // Numeri arabi
        /^\s*[A-Z][A-Za-z ,'-]+(?:\s+|$)/,     // Testo centrato
        /^\s*[A-Z][A-ZÀÈÉÌÒÙ][A-ZÀÈÉÌÒÙ\s]+$/  // Tutto maiuscolo
    ];

    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const lines = page.split('\n').filter(l => l.trim());
        
        // Cerca titoli di capitolo
        const isChapterStart = lines.length <= 3 && 
            chapterPatterns.some(p => p.test(lines[0] || ''));
        
        // Crea nuovo capitolo se trovato
        if (isChapterStart) {
            // Salva capitolo corrente
            if (currentChapter.content.length > 0) {
                currentChapter.rawText = reconstructTextFlow(
                    currentChapter.content.join('\n')
                );
                chapters.push({...currentChapter});
            }
            
            // Nuovo capitolo (salta pagina vuota successiva se presente)
            currentChapter = {
                title: lines[0].trim(),
                startPage: i,
                content: [],
                rawText: ''
            };
            
            if (i < pages.length - 1 && pages[i+1].trim() === '') {
                i++; // Salta pagina vuota
            }
            continue;
        }
        
        // Aggiungi contenuto al capitolo corrente
        currentChapter.content.push(page);
    }
    
    // Aggiungi l'ultimo capitolo
    if (currentChapter.content.length > 0) {
        currentChapter.rawText = reconstructTextFlow(
            currentChapter.content.join('\n')
        );
        chapters.push(currentChapter);
    }
    
    return chapters;
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
        const processed = processText(pagesText);
    
    // Crea EPUB con i capitoli processati
    const epubContent = processed.map(chapter => `
        <section epub:type="chapter">
            <h1>${escapeXml(chapter.title)}</h1>
            ${chapter.epubContent}
        </section>
    `).join('\n');
    // Crea file XHTML per ogni capitolo o pagina
    let spineItems = [];
    let manifestItems = [];
    let tocItems = [];
    
    if (content.chapters) {
        // Struttura con capitoli
        for (let i = 0; i < content.chapters.length; i++) {
            const chapter = content.chapters[i];
            const filename = `chapter_${i+1}.xhtml`;
            
            // Determina lo stile in base al tipo di capitolo
            let chapterStyle = '';
            if (i === 0) chapterStyle = ' class="frontmatter"';
            else if (i === content.chapters.length - 1) chapterStyle = ' class="backmatter"';
            
            let htmlContent = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
    <title>${escapeXml(chapter.title)}</title>
    <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body${chapterStyle}>
    <section epub:type="chapter">
        <h1>${escapeXml(chapter.title)}</h1>
        ${chapter.content.map(page => `<div class="original-page">
            ${escapeXml(page).split('\n').filter(p => p.trim()).map(p => `<p>${p}</p>`).join('')}
        </div>`).join('\n')}
    </section>
</body>
</html>`;
            
            OEBPS.file(filename, htmlContent);
            spineItems.push(`<itemref idref="chapter_${i+1}"/>`);
            
            // Aggiungi il tipo appropriato al manifest
            let properties = '';
            if (i === 0) properties = ' properties="frontmatter"';
            else if (i === content.chapters.length - 1) properties = ' properties="backmatter"';
            
            manifestItems.push(`<item id="chapter_${i+1}" href="${filename}" media-type="application/xhtml+xml"${properties}/>`);
            
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
    <div class="page">
        ${escapeXml(content.pages[i]).split('\n').filter(p => p.trim()).map(p => `<p>${p}</p>`).join('')}
    </div>
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
    hyphens: auto;
}

h1 {
    font-size: 1.5em;
    text-align: center;
    margin: 2em 0;
    page-break-after: avoid;
}

h2 {
    font-size: 1.2em;
    margin: 1.5em 0 0.5em 0;
    page-break-after: avoid;
}

p {
    margin: 0.5em 0;
    text-indent: 1.5em;
    text-align: justify;
}

.frontmatter h1 {
    margin-top: 3em;
    font-size: 1.8em;
}

.backmatter {
    font-size: 0.9em;
}

section {
    page-break-after: always;
}

.original-page {
    border-top: 1px dashed #eee;
    margin-top: 1em;
    padding-top: 1em;
}

/* Stile per i dialoghi */
q {
    quotes: "“" "”" "‘" "’";
}

q:before {
    content: open-quote;
}

q:after {
    content: close-quote;
}

/* Stile per le note a piè di pagina */
.footnote {
    font-size: 0.8em;
    vertical-align: super;
    line-height: 0;
}

/* Gestione delle pagine vuote tra capitoli */
.page-break {
    page-break-before: always;
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

// Gestione offline
window.addEventListener('online', () => {
    statusText.textContent = 'Connessione ripristinata';
    setTimeout(() => {
        if (!statusText.textContent.includes('Errore') && !statusText.textContent.includes('Completato')) {
            statusText.textContent = '';
        }
    }, 3000);
});

window.addEventListener('offline', () => {
    statusText.textContent = 'Sei offline - l\'app funziona in modalità locale';
});
