// --- SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#c'), antialias: true });
scene.background = new THREE.Color(0x000000);
camera.position.z = 6;
renderer.setSize(window.innerWidth, window.innerHeight);

// --- LIGHTING ---
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);

// --- STARFIELD ---
let starfield;
function createStarfield() { const starVertices = []; for (let i = 0; i < 15000; i++) { const x = (Math.random() - 0.5) * 2000; const y = (Math.random() - 0.5) * 2000; const z = (Math.random() - 0.5) * 2000; const d = Math.sqrt(x*x + y*y + z*z); if (d < 500) continue; starVertices.push(x, y, z); } const starGeometry = new THREE.BufferGeometry(); starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3)); const starMaterial = new THREE.PointsMaterial({ color: 0xbbbbbb, size: 1.2, sizeAttenuation: true, transparent: true, depthWrite: false, }); starfield = new THREE.Points(starGeometry, starMaterial); scene.add(starfield); }

// --- CONTROLS ---
const controls = new THREE.TrackballControls(camera, renderer.domElement);
controls.rotateSpeed = 2.5; controls.zoomSpeed = 1.2; controls.panSpeed = 0.8;
controls.noZoom = false; controls.noPan = false; controls.staticMoving = true;
controls.dynamicDampingFactor = 0.2;

// --- AUDIO & VISUALIZER ---
const music = document.getElementById('bg-music');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingStatusText = document.getElementById('loading-status-text');
const enterButton = document.getElementById('enter-button');
const muteButton = document.getElementById('mute-button');
music.volume = 0.4;
let audioContext, analyser, source;
let dataArray, smoothedDataArray;
let isAudioSetup = false;
const visualizerCanvas = document.getElementById('visualizer-canvas');
const visualizerCtx = visualizerCanvas.getContext('2d');
let visualizerColor = '#C64600';

function setupAudio() { if (isAudioSetup) return; audioContext = new (window.AudioContext || window.webkitAudioContext)(); analyser = audioContext.createAnalyser(); analyser.fftSize = 256; source = audioContext.createMediaElementSource(music); source.connect(analyser); analyser.connect(audioContext.destination); const bufferLength = analyser.frequencyBinCount; dataArray = new Uint8Array(bufferLength); smoothedDataArray = new Float32Array(bufferLength); music.play(); isAudioSetup = true; }
function drawVisualizer() { if (!isAudioSetup) return; analyser.getByteFrequencyData(dataArray); visualizerCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height); const bufferLength = analyser.frequencyBinCount; const canvasWidth = visualizerCanvas.width; const canvasHeight = visualizerCanvas.height; const centerX = canvasWidth / 2; let bassSum = 0; for (let i = 0; i < bufferLength; i++) { smoothedDataArray[i] += (dataArray[i] - smoothedDataArray[i]) * 0.1; if (i < 10) bassSum += smoothedDataArray[i]; } const avgBass = bassSum / 10; const baselineY = canvasHeight - (avgBass * 0.1) - 5; const gradient = visualizerCtx.createLinearGradient(centerX, 0, centerX, canvasHeight); gradient.addColorStop(0.3, visualizerColor); gradient.addColorStop(1, 'rgba(0,0,0,0)'); visualizerCtx.strokeStyle = visualizerColor; visualizerCtx.fillStyle = gradient; visualizerCtx.shadowColor = visualizerColor; visualizerCtx.shadowBlur = 10; visualizerCtx.lineWidth = 2; const fillPath = new Path2D(); fillPath.moveTo(0, canvasHeight); fillPath.lineTo(0, baselineY); const strokePath = new Path2D(); strokePath.moveTo(0, baselineY); const halfBuffer = Math.floor(bufferLength * 0.7); for (let i = 0; i < halfBuffer; i++) { const barHeight = smoothedDataArray[i] * 0.4; const x = (i / halfBuffer) * canvasWidth; const y = baselineY - barHeight; fillPath.lineTo(x, y); strokePath.lineTo(x, y); } fillPath.lineTo(canvasWidth, baselineY); fillPath.lineTo(canvasWidth, canvasHeight); fillPath.closePath(); visualizerCtx.save(); visualizerCtx.scale(-1, 1); visualizerCtx.translate(-canvasWidth, 0); visualizerCtx.fill(fillPath); visualizerCtx.stroke(strokePath); visualizerCtx.restore(); visualizerCtx.fill(fillPath); visualizerCtx.stroke(strokePath); }

// --- STATE & UI ELEMENTS ---
let currentMesh = null; let currentShapeName = 'Cube'; let isTransitioning = false;
let currentRenderMode = 'wireframe';
const shapeList = document.getElementById('shape-list'); const renderModeList = document.getElementById('render-mode-list'); const colorPicker = document.getElementById('color-picker'); const polySlider = document.getElementById('poly-slider'); const detailSection = document.getElementById('detail-section');
const activeColor = new THREE.Color();

// --- SHAPE MANAGEMENT ---
const shapeManager = { createPrimitive: (shapeName, detail) => { const size = 1.8; const map = (min, max) => Math.round(THREE.MathUtils.lerp(min, max, detail)); let geometry; switch (shapeName) { case 'Sphere': geometry = new THREE.SphereGeometry(size / 1.5, map(8, 64), map(6, 32)); break; case 'Torus': geometry = new THREE.TorusGeometry(size / 2, size / 5, map(12, 100), map(6, 50)); break; case 'TorusKnot': geometry = new THREE.TorusKnotGeometry(size / 2, size / 6, map(32, 256), map(6, 20)); break; case 'Cone': geometry = new THREE.ConeGeometry(size / 2, size * 1.5, map(8, 128), map(1, 20)); break; case 'Cylinder': geometry = new THREE.CylinderGeometry(size / 2, size / 2, size * 1.5, map(8, 128), map(1, 10)); break; case 'Teapot': geometry = new THREE.TeapotGeometry(size / 2, map(2, 15)); break; default: geometry = new THREE.BoxGeometry(size, size, size, map(1, 20), map(1, 20), map(1, 20)); } return new THREE.Mesh(geometry, createActiveMaterial()); }, loadModel: (path, onLoaded) => { const gltfLoader = new THREE.GLTFLoader(); gltfLoader.load(path, (gltf) => { const model = gltf.scene; model.traverse((child) => { if (child.isMesh) child.material = createActiveMaterial(); }); const box = new THREE.Box3().setFromObject(model); const size = box.getSize(new THREE.Vector3()).length(); const center = box.getCenter(new THREE.Vector3()); model.position.sub(center); model.scale.setScalar(2.5 / size); onLoaded(model); }); } };
function createActiveMaterial() { if (currentRenderMode === 'filled') { return new THREE.MeshStandardMaterial({ color: activeColor, roughness: 0.5, metalness: 0.1 }); } else { return new THREE.MeshBasicMaterial({ color: activeColor, wireframe: true }); } }

// --- CORE FUNCTIONS ---
// GITHUB PAGES FIX: Use relative paths for sounds
function playSound(src, volume = 0.5) { const sound = new Audio(src); sound.volume = volume; sound.play(); }
async function populateModelList() {
    try {
        // GITHUB PAGES FIX: Use a relative path for the fetch request
        const response = await fetch('models.json');
        const models = await response.json();
        models.forEach(model => {
            const li = document.createElement('li');
            li.innerText = model.name;
            li.dataset.shape = model.name;
            li.dataset.type = 'model';
            li.dataset.path = model.path;
            shapeList.appendChild(li);
        });
    } catch (error) {
        console.error("Could not load or parse models.json:", error);
    }
}
function transitionToShape(targetElement) { if (isTransitioning) return; isTransitioning = true; const shapeName = targetElement.dataset.shape; const type = targetElement.dataset.type || 'primitive'; const path = targetElement.dataset.path; const detail = parseFloat(polySlider.value); detailSection.style.display = (type === 'primitive') ? 'flex' : 'none'; const onNewMeshReady = (newMesh) => { if (currentMesh) newMesh.rotation.copy(currentMesh.rotation); newMesh.scale.set(0, 0, 0); const timeline = gsap.timeline({ onComplete: () => { currentMesh = newMesh; isTransitioning = false; } }); if (currentMesh) { timeline.to(currentMesh.scale, { x: 0, y: 0, z: 0, duration: 0.6, ease: 'power3.in', onComplete: () => scene.remove(currentMesh) }); } scene.add(newMesh); timeline.to(newMesh.scale, { x: 1, y: 1, z: 1, duration: 1.0, ease: 'elastic.out(1, 0.75)' }, currentMesh ? ">-0.4" : ">"); }; if (type === 'model') shapeManager.loadModel(path, onNewMeshReady); else onNewMeshReady(shapeManager.createPrimitive(shapeName, detail)); }
function updateRenderMode() { if (!currentMesh) return; currentMesh.traverse(child => { if (child.isMesh) child.material = createActiveMaterial(); }); }
function updateAccentColor(colorStr, duration = 1.0) { const newColor = new THREE.Color(colorStr); gsap.to(activeColor, { r: newColor.r, g: newColor.g, b: newColor.b, duration: duration, ease: 'power2.out', onUpdate: () => { const currentCssColor = activeColor.getStyle(); const rgb = `${Math.round(activeColor.r*255)}, ${Math.round(activeColor.g*255)}, ${Math.round(activeColor.b*255)}`; visualizerColor = currentCssColor; const root = document.documentElement; root.style.setProperty('--accent-color', currentCssColor); root.style.setProperty('--accent-rgb', rgb); root.style.setProperty('--accent-color-gradient', `linear-gradient(90deg, rgba(${rgb}, 0.5) 0%, rgba(${rgb}, 0.15) 100%)`); if (currentMesh) { currentMesh.traverse(child => { if (child.isMesh) { child.material.color.copy(activeColor); } }); } } }); }
function debounce(func, wait) { let timeout; return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), wait); }; }

// --- EVENT LISTENERS ---
enterButton.addEventListener('mouseover', () => playSound('sounds/hover.mp3', 0.4));
muteButton.addEventListener('click', () => { music.muted = !music.muted; muteButton.classList.toggle('muted', music.muted); playSound('sounds/select.mp3', 0.5); });
shapeList.addEventListener('mouseover', (e) => { if (e.target.closest('li')) playSound('sounds/hover.mp3', 0.4); });
shapeList.addEventListener('click', (e) => { const target = e.target.closest('li'); if (target && !isTransitioning && !target.classList.contains('active')) { playSound('sounds/select.mp3', 0.5); shapeList.querySelector('.active')?.classList.remove('active'); target.classList.add('active'); currentShapeName = target.dataset.shape; transitionToShape(target); } });
renderModeList.addEventListener('click', (e) => { const target = e.target.closest('li'); if (target && !target.classList.contains('active')) { playSound('sounds/select.mp3', 0.5); renderModeList.querySelector('.active')?.classList.remove('active'); target.classList.add('active'); currentRenderMode = target.dataset.mode; updateRenderMode(); } });
colorPicker.addEventListener('click', () => playSound('sounds/select.mp3', 0.5));
colorPicker.addEventListener('input', (e) => updateAccentColor(e.target.value));
const handleSliderChange = debounce(() => transitionToShape(shapeList.querySelector('.active')), 250);
polySlider.addEventListener('input', handleSliderChange);

// --- ANIMATION LOOP & RESIZING ---
function animate() { requestAnimationFrame(animate); if(starfield) starfield.rotation.y += 0.0001; controls.update(); drawVisualizer(); renderer.render(scene, camera); }
function handleResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); controls.handleResize(); visualizerCanvas.width = visualizerCanvas.clientWidth; visualizerCanvas.height = visualizerCanvas.clientHeight; }
window.addEventListener('resize', handleResize);

// --- INITIALIZATION ---
async function init() {
    createStarfield();
    handleResize();
    updateAccentColor(colorPicker.value, 0);
    animate();
    
    const loadingPromises = [ populateModelList(), transitionToShape(shapeList.querySelector('.active')), new Promise(resolve => { if (music.readyState >= 4) resolve(); else music.addEventListener('canplaythrough', resolve, { once: true }); }), new Promise(resolve => setTimeout(resolve, 3000)) ];
    await Promise.all(loadingPromises);
    
    loadingStatusText.innerText = "SYSTEMS ONLINE";
    loadingOverlay.classList.add('ready');

    enterButton.addEventListener('click', () => {
        playSound('sounds/select.mp3', 0.5);
        loadingOverlay.classList.add('loaded');
        setupAudio();
        
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
        }, 500);
    }, { once: true });
}

init();
