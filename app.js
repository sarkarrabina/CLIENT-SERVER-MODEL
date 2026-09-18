// app.js

document.addEventListener('DOMContentLoaded', () => {
    
    // --- UI Elements ---
    const tabs = document.querySelectorAll('.activity-tab');
    const forms = document.querySelectorAll('.activity-form');
    const activityLog = document.getElementById('activity-log');
    const sequenceContainer = document.getElementById('sequence-container');
    const idleMessage = document.getElementById('idle-message');
    const playbackProgress = document.getElementById('playback-progress');
    const inspector = document.getElementById('message-inspector');
    const inspectorTitle = document.getElementById('inspector-title');
    const inspectorContent = document.getElementById('inspector-content');
    const targetServerLabel = document.getElementById('target-server-label');
    const streamStatusText = document.getElementById('stream-status-text');

    // Controls
    const btnPlay = document.getElementById('ctrl-play');
    const btnNext = document.getElementById('ctrl-next');
    const btnPrev = document.getElementById('ctrl-prev');
    const btnReplay = document.getElementById('ctrl-replay');

    // Forms
    const btnBrowse = document.getElementById('btn-browse');
    const btnMail = document.getElementById('btn-mail');
    const btnStreamPlay = document.getElementById('btn-stream-play');
    const btnStreamPause = document.getElementById('btn-stream-pause');

    // --- State ---
    let currentMode = 'browsing'; // browsing | mail | streaming
    let currentSequence = [];
    let currentStepIndex = -1;
    let isPlaying = false;
    let playbackTimer = null;

    // --- Sequences Data ---
    const getDomain = (url) => {
        try { return new URL(url).hostname; } catch(e) { return url.replace(/^https?:\/\//, '').split('/')[0]; }
    };

    const generateBrowsingSequence = (url) => {
        const domain = getDomain(url) || 'client-server-model.com';
        const ip = '192.168.1.' + Math.floor(Math.random() * 255);
        
        return [
            { from: 'client', to: 'dns', protocol: 'dns', title: 'DNS Query (A)', msg: `Domain: ${domain}\nType: A\nClass: IN` },
            { from: 'dns', to: 'client', protocol: 'dns', title: 'DNS Response', msg: `Name: ${domain}\nType: A\nAddress: ${ip}\nTTL: 300` },
            { from: 'client', to: 'server', protocol: 'tcp', title: 'TCP SYN', msg: `Src Port: 54321\nDst Port: 443\nSeq: 0\nFlags: [S]` },
            { from: 'server', to: 'client', protocol: 'tcp', title: 'TCP SYN-ACK', msg: `Src Port: 443\nDst Port: 54321\nSeq: 0\nAck: 1\nFlags: [S.], [A]` },
            { from: 'client', to: 'server', protocol: 'tcp', title: 'TCP ACK', msg: `Src Port: 54321\nDst Port: 443\nSeq: 1\nAck: 1\nFlags: [.]` },
            { from: 'client', to: 'server', protocol: 'http', title: 'HTTP GET', msg: `GET / HTTP/1.1\nHost: ${domain}\nUser-Agent: ClientServerModel/1.0\nAccept: text/html` },
            { from: 'server', to: 'client', protocol: 'http', title: 'HTTP 200 OK', msg: `HTTP/1.1 200 OK\nContent-Type: text/html\nContent-Length: 1250\n\n<!DOCTYPE html><html>...` }
        ];
    };

    const generateMailSequence = (to, subject, body) => {
        const domain = to.split('@')[1] || 'server.com';
        const mxIp = '10.0.0.' + Math.floor(Math.random() * 255);
        
        return [
            { from: 'client', to: 'dns', protocol: 'dns', title: 'DNS Query (MX)', msg: `Domain: ${domain}\nType: MX\nClass: IN` },
            { from: 'dns', to: 'client', protocol: 'dns', title: 'DNS Response', msg: `Name: ${domain}\nType: MX\nPreference: 10\nMail Exchanger: mail.${domain}\nAddress: ${mxIp}` },
            { from: 'client', to: 'server', protocol: 'tcp', title: 'TCP Handshake', msg: `[SYN] -> [SYN, ACK] -> [ACK]\nPort 25 Established.` },
            { from: 'server', to: 'client', protocol: 'smtp', title: 'SMTP 220', msg: `220 mail.${domain} ESMTP Postfix` },
            { from: 'client', to: 'server', protocol: 'smtp', title: 'SMTP EHLO', msg: `EHLO client.local` },
            { from: 'server', to: 'client', protocol: 'smtp', title: 'SMTP 250', msg: `250-mail.${domain}\n250-PIPELINING\n250-SIZE 10240000\n250 8BITMIME` },
            { from: 'client', to: 'server', protocol: 'smtp', title: 'SMTP MAIL FROM', msg: `MAIL FROM:<sender@local.com>` },
            { from: 'server', to: 'client', protocol: 'smtp', title: 'SMTP 250', msg: `250 2.1.0 Ok` },
            { from: 'client', to: 'server', protocol: 'smtp', title: 'SMTP RCPT TO', msg: `RCPT TO:<${to}>` },
            { from: 'server', to: 'client', protocol: 'smtp', title: 'SMTP 250', msg: `250 2.1.5 Ok` },
            { from: 'client', to: 'server', protocol: 'smtp', title: 'SMTP DATA', msg: `DATA` },
            { from: 'server', to: 'client', protocol: 'smtp', title: 'SMTP 354', msg: `354 End data with <CR><LF>.<CR><LF>` },
            { from: 'client', to: 'server', protocol: 'smtp', title: 'SMTP Body', msg: `Subject: ${subject}\nTo: ${to}\n\n${body}\n.\n` },
            { from: 'server', to: 'client', protocol: 'smtp', title: 'SMTP 250', msg: `250 2.0.0 Ok: queued as A1B2C3D4` },
            { from: 'client', to: 'server', protocol: 'smtp', title: 'SMTP QUIT', msg: `QUIT` },
            { from: 'server', to: 'client', protocol: 'smtp', title: 'SMTP 221', msg: `221 2.0.0 Bye` }
        ];
    };

    const generateStreamingSequence = (quality) => {
        const domain = 'stream.client-server-model.com';
        const ip = '172.16.0.' + Math.floor(Math.random() * 255);
        
        return [
            { from: 'client', to: 'dns', protocol: 'dns', title: 'DNS Query (A)', msg: `Domain: ${domain}\nType: A` },
            { from: 'dns', to: 'client', protocol: 'dns', title: 'DNS Response', msg: `Name: ${domain}\nAddress: ${ip}` },
            { from: 'client', to: 'server', protocol: 'tcp', title: 'TCP Handshake', msg: `[SYN] -> [SYN, ACK] -> [ACK]` },
            { from: 'client', to: 'server', protocol: 'http', title: 'HTTP GET Manifest', msg: `GET /playlist_${quality}.m3u8 HTTP/1.1\nHost: ${domain}` },
            { from: 'server', to: 'client', protocol: 'http', title: 'HTTP 200 OK', msg: `HTTP/1.1 200 OK\nContent-Type: application/vnd.apple.mpegurl\n\n#EXTM3U\n#EXT-X-TARGETDURATION:4\n#EXTINF:4.0,\nseg1.ts\n#EXTINF:4.0,\nseg2.ts` },
            { from: 'client', to: 'server', protocol: 'http', title: 'HTTP GET Seg 1', msg: `GET /seg1_${quality}.ts HTTP/1.1\nHost: ${domain}` },
            { from: 'server', to: 'client', protocol: 'http', title: 'HTTP 200 OK', msg: `HTTP/1.1 200 OK\nContent-Type: video/mp2t\nContent-Length: 1450000\n\n[BINARY VIDEO DATA]` },
            { from: 'client', to: 'server', protocol: 'http', title: 'HTTP GET Seg 2', msg: `GET /seg2_${quality}.ts HTTP/1.1\nHost: ${domain}` },
            { from: 'server', to: 'client', protocol: 'http', title: 'HTTP 200 OK', msg: `HTTP/1.1 200 OK\nContent-Type: video/mp2t\nContent-Length: 1430000\n\n[BINARY VIDEO DATA]` }
        ];
    };

    // --- UI Logic ---
    const switchTab = (mode) => {
        currentMode = mode;
        
        // Update tabs
        tabs.forEach(tab => {
            if (tab.dataset.target === mode) {
                tab.classList.remove('hover:bg-brand-secondary/20', 'text-brand-secondary');
                
                // Color based on mode
                let colorClass = 'bg-brand-primary text-brand-dark shadow-neon-primary';
                if(mode === 'mail') colorClass = 'bg-brand-secondary text-brand-dark shadow-neon-secondary';
                if(mode === 'streaming') colorClass = 'bg-brand-accent text-brand-dark shadow-neon-accent';
                
                tab.className = `flex-1 py-2 text-sm font-bold rounded-md transition-all activity-tab ${colorClass}`;
            } else {
                tab.className = `flex-1 py-2 text-sm font-bold rounded-md transition-all activity-tab hover:bg-gray-800 text-gray-400`;
            }
        });

        // Update forms
        forms.forEach(form => {
            if (form.id === `form-${mode}`) {
                form.classList.remove('hidden');
                setTimeout(() => form.classList.add('opacity-100'), 10);
            } else {
                form.classList.add('hidden', 'opacity-0');
            }
        });

        // Update Server Label
        if (mode === 'browsing') targetServerLabel.innerText = 'WEB SERVER';
        if (mode === 'mail') targetServerLabel.innerText = 'SMTP SERVER';
        if (mode === 'streaming') targetServerLabel.innerText = 'CDN SERVER';
    };

    const logActivity = (msg, type = 'info') => {
        const time = new Date().toLocaleTimeString();
        const div = document.createElement('div');
        let color = 'text-gray-400';
        if (type === 'success') color = 'text-green-400';
        if (type === 'action') color = 'text-brand-primary';
        if (type === 'error') color = 'text-red-400';
        
        div.className = color;
        div.innerText = `[${time}] ${msg}`;
        activityLog.appendChild(div);
        activityLog.scrollTop = activityLog.scrollHeight;
    };

    const showInspector = (step) => {
        inspector.classList.remove('hidden');
        inspectorTitle.innerText = step.title;
        inspectorTitle.className = `font-bold border-b mb-2 pb-1 protocol-${step.protocol} border-${step.protocol}`;
        inspectorContent.innerText = step.msg;
    };

    const hideInspector = () => {
        inspector.classList.add('hidden');
    };

    // --- Visualization Engine ---
    const updatePlaybackControls = () => {
        btnPrev.disabled = currentStepIndex <= 0;
        btnNext.disabled = currentStepIndex >= currentSequence.length - 1;
        
        if (isPlaying) {
            btnPlay.innerHTML = `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z"></path></svg>`;
        } else {
            btnPlay.innerHTML = `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4l12 6-12 6z"></path></svg>`;
        }

        const progress = currentSequence.length > 0 ? ((currentStepIndex + 1) / currentSequence.length) * 100 : 0;
        playbackProgress.style.width = `${progress}%`;
    };

    const renderStep = (index) => {
        if (index < 0 || index >= currentSequence.length) return;
        
        const step = currentSequence[index];
        const stepElId = `seq-step-${index}`;
        
        // Remove active class from all labels
        document.querySelectorAll('.seq-label').forEach(el => el.classList.remove('active-message'));
        
        // Check if already rendered
        let el = document.getElementById(stepElId);
        if (!el) {
            el = document.createElement('div');
            el.id = stepElId;
            el.className = 'seq-msg h-12 flex items-center relative';
            
            // Calculate positions based on entities
            let leftPerc, widthPerc, isRightDir = true;
            if (step.from === 'client' && step.to === 'dns') { leftPerc = 12; widthPerc = 38; }
            else if (step.from === 'dns' && step.to === 'client') { leftPerc = 12; widthPerc = 38; isRightDir = false; }
            else if (step.from === 'client' && step.to === 'server') { leftPerc = 12; widthPerc = 76; }
            else if (step.from === 'server' && step.to === 'client') { leftPerc = 12; widthPerc = 76; isRightDir = false; }

            el.innerHTML = `
                <div class="seq-line ${isRightDir ? 'right' : 'left'} protocol-${step.protocol}" 
                     style="left: ${leftPerc}%; width: ${widthPerc}%;">
                     <div class="w-full h-0.5 bg-current ${isRightDir ? 'origin-left' : 'origin-right'}" 
                          style="animation: ${isRightDir ? 'drawLineRight' : 'drawLineLeft'} 0.3s ease-out forwards;"></div>
                     <div class="seq-line-arrow protocol-${step.protocol}"></div>
                     <div class="seq-label protocol-${step.protocol}" data-index="${index}">${step.title}</div>
                </div>
            `;
            sequenceContainer.appendChild(el);
            
            // Add click listener to label
            el.querySelector('.seq-label').addEventListener('mouseenter', () => showInspector(step));
            el.querySelector('.seq-label').addEventListener('mouseleave', hideInspector);
        }

        // Highlight current
        const label = el.querySelector('.seq-label');
        if (label) label.classList.add('active-message');
        
        // Auto scroll
        el.scrollIntoView({ behavior: 'smooth', block: 'end' });
        
        // Log to activity
        logActivity(`${step.from.toUpperCase()} -> ${step.to.toUpperCase()} : ${step.title}`, 'info');
        showInspector(step);
    };

    const clearSequence = () => {
        sequenceContainer.innerHTML = '';
        currentStepIndex = -1;
        hideInspector();
        updatePlaybackControls();
    };

    const playStep = () => {
        if (currentStepIndex < currentSequence.length - 1) {
            currentStepIndex++;
            renderStep(currentStepIndex);
            updatePlaybackControls();
            
            if (isPlaying) {
                playbackTimer = setTimeout(playStep, 1200); // 1.2s delay between steps
            }
        } else {
            isPlaying = false;
            updatePlaybackControls();
            logActivity('Sequence completed.', 'success');
        }
    };

    const startSequence = (sequence) => {
        clearSequence();
        if (idleMessage) idleMessage.style.display = 'none';
        
        currentSequence = sequence;
        isPlaying = true;
        playStep();
    };

    // --- Event Listeners ---
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            switchTab(e.target.dataset.target);
        });
    });

    btnBrowse.addEventListener('click', () => {
        const url = document.getElementById('browse-url').value;
        logActivity(`Initiating browse to ${url}...`, 'action');
        startSequence(generateBrowsingSequence(url));
    });

    btnMail.addEventListener('click', () => {
        const to = document.getElementById('mail-to').value;
        const sub = document.getElementById('mail-subject').value;
        const body = document.getElementById('mail-body').value;
        logActivity(`Sending mail to ${to}...`, 'action');
        startSequence(generateMailSequence(to, sub, body));
    });

    btnStreamPlay.addEventListener('click', () => {
        const quality = document.getElementById('stream-quality').value;
        logActivity(`Requesting stream at ${quality}...`, 'action');
        btnStreamPlay.disabled = true;
        btnStreamPlay.classList.add('opacity-50');
        btnStreamPause.disabled = false;
        btnStreamPause.classList.remove('opacity-50');
        streamStatusText.innerText = `BUFFERING ${quality}...`;
        streamStatusText.classList.add('text-brand-accent');
        
        startSequence(generateStreamingSequence(quality));
        
        // Simulate playing state after sequence ends
        setTimeout(() => {
            streamStatusText.innerText = `PLAYING ${quality}`;
            streamStatusText.classList.remove('animate-pulse');
        }, 9000); // roughly sequence duration
    });

    btnStreamPause.addEventListener('click', () => {
        logActivity(`Stream paused.`, 'info');
        btnStreamPlay.disabled = false;
        btnStreamPlay.classList.remove('opacity-50');
        btnStreamPause.disabled = true;
        btnStreamPause.classList.add('opacity-50');
        streamStatusText.innerText = `PAUSED`;
        streamStatusText.classList.add('animate-pulse');
    });

    // Playback Controls
    btnPlay.addEventListener('click', () => {
        if (currentSequence.length === 0) return;
        
        if (isPlaying) {
            isPlaying = false;
            clearTimeout(playbackTimer);
            logActivity('Visualization paused.');
        } else {
            if (currentStepIndex >= currentSequence.length - 1) {
                // Restart if at end
                clearSequence();
            }
            isPlaying = true;
            playStep();
            logActivity('Visualization playing.');
        }
        updatePlaybackControls();
    });

    btnNext.addEventListener('click', () => {
        if (currentSequence.length === 0) return;
        isPlaying = false;
        clearTimeout(playbackTimer);
        
        if (currentStepIndex < currentSequence.length - 1) {
            currentStepIndex++;
            renderStep(currentStepIndex);
        }
        updatePlaybackControls();
    });

    btnPrev.addEventListener('click', () => {
        if (currentSequence.length === 0) return;
        isPlaying = false;
        clearTimeout(playbackTimer);
        
        if (currentStepIndex > 0) {
            // Remove current step DOM element
            const el = document.getElementById(`seq-step-${currentStepIndex}`);
            if (el) el.remove();
            
            currentStepIndex--;
            
            // Highlight previous
            document.querySelectorAll('.seq-label').forEach(el => el.classList.remove('active-message'));
            const prevEl = document.getElementById(`seq-step-${currentStepIndex}`);
            if (prevEl) {
                const label = prevEl.querySelector('.seq-label');
                if (label) label.classList.add('active-message');
                showInspector(currentSequence[currentStepIndex]);
            }
        } else if (currentStepIndex === 0) {
            const el = document.getElementById(`seq-step-0`);
            if (el) el.remove();
            currentStepIndex = -1;
            hideInspector();
        }
        updatePlaybackControls();
    });

    btnReplay.addEventListener('click', () => {
        if (currentSequence.length === 0) return;
        clearTimeout(playbackTimer);
        const seq = [...currentSequence];
        startSequence(seq);
    });

});
