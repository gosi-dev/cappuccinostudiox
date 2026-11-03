/**
 * 3D Cabinet page: 3D box controls, config; init() handles menu and carousel.
 */
import { init } from '../core.js';
import { showLoadingScreenIfFirstVisit, markPageVisited, hideLoadingScreen } from '../loadingScreen.js';

window.addEventListener('DOMContentLoaded', () => {
    const showedLoader = showLoadingScreenIfFirstVisit('3d-cabinet.html', '3D Cabinet');
    init({
        onReady: () => {
            markPageVisited('3d-cabinet.html');
            if (showedLoader) hideLoadingScreen();
        }
    });
    // Box controls / Controls panel toggle
    const controlsPanel = document.getElementById('controlsPanel');
    const controlsToggleButton = document.getElementById('controlsToggleButton');
    const controlsShowButton = document.getElementById('controlsShowButton');

    controlsToggleButton.addEventListener('click', () => {
        controlsPanel.classList.add('hidden');
        controlsShowButton.style.display = 'block';
    });

    controlsShowButton.addEventListener('click', () => {
        controlsPanel.classList.remove('hidden');
        controlsShowButton.style.display = 'none';
    });

    // Configuration copy/load functionality
    const configTextarea = document.getElementById('configTextarea');
    const copyConfigButton = document.getElementById('copyConfigButton');
    const loadConfigButton = document.getElementById('loadConfigButton');

    function generateConfigString() {
        const showFrontFace = document.getElementById('showFrontFace');
        const showBackFace = document.getElementById('showBackFace');
        const showRightFace = document.getElementById('showRightFace');
        const showLeftFace = document.getElementById('showLeftFace');
        const showTopFace = document.getElementById('showTopFace');
        const showBottomFace = document.getElementById('showBottomFace');
        
        const isoCardCountMaxEl = document.getElementById('isoCardCountMax');
        const config = {
            width: boxWidth,
            height: boxHeight,
            isoCardCount: isoCardCount,
            isoCardCountMax: isoCardCountMaxEl ? parseInt(isoCardCountMaxEl.value, 10) : 100,
            isoCardSpacing: isoCardSpacing,
            rotateX: rotateX,
            rotateY: rotateY,
            positionX: positionX,
            positionY: positionY,
            positionZ: positionZ,
            showFrontFace: showFrontFace ? showFrontFace.checked : true,
            showBackFace: showBackFace ? showBackFace.checked : true,
            showRightFace: showRightFace ? showRightFace.checked : true,
            showLeftFace: showLeftFace ? showLeftFace.checked : true,
            showTopFace: showTopFace ? showTopFace.checked : true,
            showBottomFace: showBottomFace ? showBottomFace.checked : true
        };
        return JSON.stringify(config, null, 2);
    }

    function updateConfigDisplay() {
        configTextarea.value = generateConfigString();
    }

    copyConfigButton.addEventListener('click', async () => {
        const configString = generateConfigString();
        try {
            await navigator.clipboard.writeText(configString);
            copyConfigButton.textContent = 'Copied!';
            setTimeout(() => {
                copyConfigButton.textContent = 'Copy Config';
            }, 2000);
        } catch (err) {
            // Fallback for older browsers
            configTextarea.select();
            document.execCommand('copy');
            copyConfigButton.textContent = 'Copied!';
            setTimeout(() => {
                copyConfigButton.textContent = 'Copy Config';
            }, 2000);
        }
    });

    loadConfigButton.addEventListener('click', () => {
        try {
            const configString = configTextarea.value.trim();
            if (!configString) {
                alert('Please paste a configuration string first.');
                return;
            }
            const config = JSON.parse(configString);
            
            // Get control elements
            const widthControl = document.getElementById('widthControl');
            const widthValue = document.getElementById('widthValue');
            const heightControl = document.getElementById('heightControl');
            const heightValue = document.getElementById('heightValue');
            const isoCardCountControl = document.getElementById('isoCardCount');
            const isoCardCountValue = document.getElementById('isoCardCountValue');
            const isoCardSpacingControl = document.getElementById('isoCardSpacing');
            const isoCardSpacingValue = document.getElementById('isoCardSpacingValue');
            const rotateXControl = document.getElementById('rotateXControl');
            const rotateXValue = document.getElementById('rotateXValue');
            const rotateYControl = document.getElementById('rotateYControl');
            const rotateYValue = document.getElementById('rotateYValue');
            const positionXControl = document.getElementById('positionXControl');
            const positionXValue = document.getElementById('positionXValue');
            const positionYControl = document.getElementById('positionYControl');
            const positionYValue = document.getElementById('positionYValue');
            const positionZControl = document.getElementById('positionZControl');
            const positionZValue = document.getElementById('positionZValue');
            const showFrontFace = document.getElementById('showFrontFace');
            const showBackFace = document.getElementById('showBackFace');
            const showRightFace = document.getElementById('showRightFace');
            const showLeftFace = document.getElementById('showLeftFace');
            const showTopFace = document.getElementById('showTopFace');
            const showBottomFace = document.getElementById('showBottomFace');
            
            // Apply configuration
            if (config.width !== undefined && widthControl) {
                boxWidth = config.width;
                widthControl.value = boxWidth;
                if (widthValue) widthValue.value = boxWidth;
            }
            if (config.height !== undefined && heightControl) {
                boxHeight = config.height;
                heightControl.value = boxHeight;
                if (heightValue) heightValue.value = boxHeight;
            }
            const isoCardCountMaxEl = document.getElementById('isoCardCountMax');
            if (config.isoCardCountMax !== undefined && isoCardCountMaxEl) {
                isoCardCountMaxEl.value = config.isoCardCountMax;
                isoCardCountControl.max = config.isoCardCountMax;
                if (isoCardCountValue) isoCardCountValue.max = config.isoCardCountMax;
            }
            if (config.isoCardCount !== undefined && isoCardCountControl) {
                isoCardCount = config.isoCardCount;
                const max = parseInt(isoCardCountMaxEl?.value || 100, 10);
                isoCardCount = Math.max(0, Math.min(max, isoCardCount));
                isoCardCountControl.value = isoCardCount;
                if (isoCardCountValue) isoCardCountValue.value = isoCardCount;
            }
            if (config.isoCardSpacing !== undefined && isoCardSpacingControl) {
                isoCardSpacing = config.isoCardSpacing;
                isoCardSpacingControl.value = isoCardSpacing;
                if (isoCardSpacingValue) isoCardSpacingValue.value = isoCardSpacing;
            }
            if (config.rotateX !== undefined && rotateXControl) {
                rotateX = config.rotateX;
                rotateXControl.value = rotateX;
                if (rotateXValue) rotateXValue.value = rotateX;
            }
            if (config.rotateY !== undefined && rotateYControl) {
                rotateY = config.rotateY;
                rotateYControl.value = rotateY;
                if (rotateYValue) rotateYValue.value = rotateY;
            }
            if (config.positionX !== undefined && positionXControl) {
                positionX = config.positionX;
                positionXControl.value = positionX;
                if (positionXValue) positionXValue.value = positionX;
            }
            if (config.positionY !== undefined && positionYControl) {
                positionY = config.positionY;
                positionYControl.value = positionY;
                if (positionYValue) positionYValue.value = positionY;
            }
            if (config.positionZ !== undefined && positionZControl) {
                positionZ = config.positionZ;
                positionZControl.value = positionZ;
                if (positionZValue) positionZValue.value = positionZ;
            }
            if (config.showFrontFace !== undefined && showFrontFace) showFrontFace.checked = config.showFrontFace;
            if (config.showBackFace !== undefined && showBackFace) showBackFace.checked = config.showBackFace;
            if (config.showRightFace !== undefined && showRightFace) showRightFace.checked = config.showRightFace;
            if (config.showLeftFace !== undefined && showLeftFace) showLeftFace.checked = config.showLeftFace;
            if (config.showTopFace !== undefined && showTopFace) showTopFace.checked = config.showTopFace;
            if (config.showBottomFace !== undefined && showBottomFace) showBottomFace.checked = config.showBottomFace;
            
            // Update box length based on Iso cards
            boxLength = Math.max(200, (isoCardCount * isoCardSpacing) + 100);
            
            // Update everything
            if (typeof updateFaceVisibility === 'function') updateFaceVisibility();
            if (typeof updateBox === 'function') updateBox();
            updateConfigDisplay();
            
            loadConfigButton.textContent = 'Loaded!';
            setTimeout(() => {
                loadConfigButton.textContent = 'Load Config';
            }, 2000);
        } catch (err) {
            alert('Invalid configuration format. Please check your JSON string.');
            console.error(err);
        }
    });

    // Make textarea editable for pasting
    configTextarea.removeAttribute('readonly');

    const boxContainer = document.getElementById('boxContainer');
    const frontFace = boxContainer.querySelector('.front');
    const backFace = boxContainer.querySelector('.back');
    const rightFace = boxContainer.querySelector('.right');
    const leftFace = boxContainer.querySelector('.left');
    const topFace = boxContainer.querySelector('.top');
    const bottomFace = boxContainer.querySelector('.bottom');

    let boxWidth = 200;
    let boxLength = 200; // Will be calculated based on Iso cards
    let boxHeight = 200;
    let rotateX = -30;
    let rotateY = 45;
    let positionX = 0;
    let positionY = 0;
    let positionZ = 0;
    let isoCardCount = 3;
    let isoCardSpacing = 50;
    let scrollPosition = 0; // Track scroll position for infinite scrolling
    let popUpAmount = 20; // Pop up amount as percentage
    let showEdgeLines = true; // Show edge lines on Iso cards
    
    // Calculate initial box length based on Iso cards
    boxLength = Math.max(200, (isoCardCount * isoCardSpacing) + 100);

    // Function to update edge lines on Iso cards
    function updateEdgeLines() {
        const isoCards = boxContainer.querySelectorAll('.iso-card');
        isoCards.forEach(card => {
            if (showEdgeLines) {
                card.style.border = '2px solid #FFF212';
            } else {
                card.style.border = 'none';
            }
        });
    }

    function manageIsoCards() {
        const currentCards = boxContainer.querySelectorAll('.front-duplicate');
        const currentCount = currentCards.length;

        if (currentCount < isoCardCount) {
            // Add missing cards
            for (let i = currentCount; i < isoCardCount; i++) {
                const newCard = document.createElement('div');
                newCard.className = 'box-face front-duplicate iso-card';
                newCard.setAttribute('data-duplicate', (i + 1).toString());
                newCard.textContent = 'Iso Cards';
                boxContainer.insertBefore(newCard, backFace);
                
                // Add scroll and touch listeners to the new card
                newCard.addEventListener('wheel', handleWheelScroll, { passive: false });
                newCard.addEventListener('touchstart', handleTouchStart, { passive: true });
                newCard.addEventListener('touchmove', handleTouchMove, { passive: false });
                newCard.addEventListener('touchend', handleTouchEnd, { passive: true });
                newCard.addEventListener('touchcancel', handleTouchEnd, { passive: true });
            }
        } else if (currentCount > isoCardCount) {
            // Remove excess cards
            for (let i = currentCount - 1; i >= isoCardCount; i--) {
                currentCards[i].remove();
            }
        }

        // Re-attach hover handlers for all cards
        attachIsoCardHoverHandlers();
        
        // Ensure all existing cards have scroll/touch listeners
        const allCards = boxContainer.querySelectorAll('.front-duplicate');
        allCards.forEach(card => {
            // Add listeners (addEventListener handles duplicates if same function reference)
            card.addEventListener('wheel', handleWheelScroll, { passive: false });
            card.addEventListener('touchstart', handleTouchStart, { passive: true });
            card.addEventListener('touchmove', handleTouchMove, { passive: false });
            card.addEventListener('touchend', handleTouchEnd, { passive: true });
            card.addEventListener('touchcancel', handleTouchEnd, { passive: true });
        });
        
        // Apply edge lines setting to all cards
        updateEdgeLines();
    }

    function attachIsoCardHoverHandlers() {
        const frontDuplicates = boxContainer.querySelectorAll('.front-duplicate');
        frontDuplicates.forEach((isoCard) => {
            // Remove existing listeners by cloning
            const newCard = isoCard.cloneNode(true);
            isoCard.parentNode.replaceChild(newCard, isoCard);
            
            // Add new listeners
            newCard.addEventListener('mouseenter', () => {
                const baseOffset = parseFloat(newCard.dataset.baseOffset || '0');
                const popUpPixels = boxHeight * (popUpAmount / 100);
                const centerTransform = 'translate(-50%, -50%)';
                newCard.style.transform = `${centerTransform} rotateY(0deg) translateZ(${baseOffset}px) translateY(${-popUpPixels}px)`;
            });

            newCard.addEventListener('mouseleave', () => {
                const baseOffset = parseFloat(newCard.dataset.baseOffset || '0');
                const centerTransform = 'translate(-50%, -50%)';
                newCard.style.transform = `${centerTransform} rotateY(0deg) translateZ(${baseOffset}px) translateY(0px)`;
            });
        });
    }

    function updateBox() {
        // Update container rotation and position
        boxContainer.style.transform = `translate(-50%, -50%) translate3d(${positionX}px, ${positionY}px, ${positionZ}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

        const halfWidth = boxWidth / 2;
        const halfLength = boxLength / 2;
        const halfHeight = boxHeight / 2;

        // Position all faces at center of container
        const centerTransform = 'translate(-50%, -50%)';

        // Front face: width x height, positioned at +Z (length/2)
        frontFace.style.width = boxWidth + 'px';
        frontFace.style.height = boxHeight + 'px';
        frontFace.style.left = '50%';
        frontFace.style.top = '50%';
        frontFace.style.transform = `${centerTransform} rotateY(0deg) translateZ(${halfLength}px)`;

        // Manage Iso cards count
        manageIsoCards();
        
        // Get updated list of Iso cards
        const frontDuplicates = boxContainer.querySelectorAll('.front-duplicate');
        
        // Position Iso cards with infinite scroll wrapping
        frontDuplicates.forEach((duplicate, index) => {
            // Calculate virtual position based on scroll
            // Scroll up (scrollPosition increases) moves cards forward (to lower position numbers)
            // Scroll down (scrollPosition decreases) moves cards backward (to higher position numbers)
            // Lower position numbers = front (higher Z), higher position numbers = back (lower Z)
            const virtualPosition = (index - scrollPosition) % isoCardCount;
            // Ensure positive modulo result
            const wrappedPosition = virtualPosition < 0 ? virtualPosition + isoCardCount : virtualPosition;
            
            // Position cards starting from the front, spaced by isoCardSpacing
            // Card at position 0 is at the front, higher positions go deeper
            const offset = halfLength - ((wrappedPosition + 1) * isoCardSpacing);
            
            // Store the base offset for hover effect
            duplicate.dataset.baseOffset = offset;
            duplicate.style.width = boxWidth + 'px';
            duplicate.style.height = boxHeight + 'px';
            duplicate.style.left = '50%';
            duplicate.style.top = '50%';
            duplicate.style.transform = `${centerTransform} rotateY(0deg) translateZ(${offset}px)`;
        });

        // Back face: width x height, positioned at -Z (-length/2)
        backFace.style.width = boxWidth + 'px';
        backFace.style.height = boxHeight + 'px';
        backFace.style.left = '50%';
        backFace.style.top = '50%';
        backFace.style.transform = `${centerTransform} rotateY(180deg) translateZ(${halfLength}px)`;

        // Right face: length x height, positioned at +X (width/2)
        rightFace.style.width = boxLength + 'px';
        rightFace.style.height = boxHeight + 'px';
        rightFace.style.left = '50%';
        rightFace.style.top = '50%';
        rightFace.style.transform = `${centerTransform} rotateY(90deg) translateZ(${halfWidth}px)`;

        // Left face: length x height, positioned at -X (-width/2)
        leftFace.style.width = boxLength + 'px';
        leftFace.style.height = boxHeight + 'px';
        leftFace.style.left = '50%';
        leftFace.style.top = '50%';
        leftFace.style.transform = `${centerTransform} rotateY(-90deg) translateZ(${halfWidth}px)`;

        // Top face: width x length, positioned at +Y (height/2)
        topFace.style.width = boxWidth + 'px';
        topFace.style.height = boxLength + 'px';
        topFace.style.left = '50%';
        topFace.style.top = '50%';
        topFace.style.transform = `${centerTransform} rotateX(90deg) translateZ(${halfHeight}px)`;

        // Bottom face: width x length, positioned at -Y (-height/2)
        bottomFace.style.width = boxWidth + 'px';
        bottomFace.style.height = boxLength + 'px';
        bottomFace.style.left = '50%';
        bottomFace.style.top = '50%';
        bottomFace.style.transform = `${centerTransform} rotateX(-90deg) translateZ(${halfHeight}px)`;
        
        // Update config display
        if (typeof updateConfigDisplay === 'function') {
            updateConfigDisplay();
        }
    }


    // Helper: sync slider and value input (slider has fixed min/max; value input can type exact)
    function syncSliderFromInput(slider, valueInput, setVar, updateFn) {
        const min = parseInt(slider.min, 10), max = parseInt(slider.max, 10);
        let v = parseInt(valueInput.value, 10);
        if (isNaN(v)) v = parseInt(slider.value, 10);
        v = Math.min(max, Math.max(min, v));
        valueInput.value = v;
        slider.value = v;
        if (setVar) setVar(v);
        if (updateFn) updateFn();
    }
    function syncInputFromSlider(slider, valueInput, setVar, updateFn) {
        const v = parseInt(slider.value, 10);
        valueInput.value = v;
        if (setVar) setVar(v);
        if (updateFn) updateFn();
    }

    // Width control
    const widthControl = document.getElementById('widthControl');
    const widthValue = document.getElementById('widthValue');
    widthControl.addEventListener('input', () => syncInputFromSlider(widthControl, widthValue, (v) => { boxWidth = v; }, updateBox));
    widthValue.addEventListener('input', () => syncSliderFromInput(widthControl, widthValue, (v) => { boxWidth = v; }, updateBox));
    widthValue.addEventListener('change', () => syncSliderFromInput(widthControl, widthValue, (v) => { boxWidth = v; }, updateBox));

    // Iso Card Count: configurable max + slider + value input
    const isoCardCountControl = document.getElementById('isoCardCount');
    const isoCardCountValue = document.getElementById('isoCardCountValue');
    const isoCardCountMaxInput = document.getElementById('isoCardCountMax');
    function applyIsoCardCountMax() {
        const max = Math.max(1, parseInt(isoCardCountMaxInput.value, 10) || 100);
        isoCardCountMaxInput.value = max;
        isoCardCountControl.max = max;
        isoCardCountValue.max = max;
        let v = parseInt(isoCardCountControl.value, 10);
        if (isNaN(v) || v > max) v = Math.min(max, Math.max(0, v));
        isoCardCountControl.value = v;
        isoCardCountValue.value = v;
        isoCardCount = v;
        boxLength = Math.max(200, (isoCardCount * isoCardSpacing) + 100);
        updateBox();
    }
    isoCardCountMaxInput.addEventListener('change', applyIsoCardCountMax);
    isoCardCountControl.addEventListener('input', () => {
        isoCardCount = parseInt(isoCardCountControl.value, 10);
        isoCardCountValue.value = isoCardCount;
        boxLength = Math.max(200, (isoCardCount * isoCardSpacing) + 100);
        updateBox();
    });
    isoCardCountValue.addEventListener('input', () => {
        const max = parseInt(isoCardCountControl.max, 10);
        let v = parseInt(isoCardCountValue.value, 10);
        if (isNaN(v)) return;
        v = Math.min(max, Math.max(0, v));
        isoCardCountValue.value = v;
        isoCardCountControl.value = v;
        isoCardCount = v;
        boxLength = Math.max(200, (isoCardCount * isoCardSpacing) + 100);
        updateBox();
    });
    isoCardCountValue.addEventListener('change', () => {
        const max = parseInt(isoCardCountControl.max, 10);
        let v = parseInt(isoCardCountValue.value, 10);
        if (isNaN(v)) v = isoCardCount;
        v = Math.min(max, Math.max(0, v));
        isoCardCountValue.value = v;
        isoCardCountControl.value = v;
        isoCardCount = v;
        boxLength = Math.max(200, (isoCardCount * isoCardSpacing) + 100);
        updateBox();
    });

    // Iso Card Spacing control
    const isoCardSpacingControl = document.getElementById('isoCardSpacing');
    const isoCardSpacingValue = document.getElementById('isoCardSpacingValue');
    isoCardSpacingControl.addEventListener('input', () => syncInputFromSlider(isoCardSpacingControl, isoCardSpacingValue, (v) => { isoCardSpacing = v; boxLength = Math.max(200, (isoCardCount * isoCardSpacing) + 100); }, updateBox));
    isoCardSpacingValue.addEventListener('input', () => syncSliderFromInput(isoCardSpacingControl, isoCardSpacingValue, (v) => { isoCardSpacing = v; boxLength = Math.max(200, (isoCardCount * isoCardSpacing) + 100); }, updateBox));
    isoCardSpacingValue.addEventListener('change', () => syncSliderFromInput(isoCardSpacingControl, isoCardSpacingValue, (v) => { isoCardSpacing = v; boxLength = Math.max(200, (isoCardCount * isoCardSpacing) + 100); }, updateBox));

    // Height control
    const heightControl = document.getElementById('heightControl');
    const heightValue = document.getElementById('heightValue');
    heightControl.addEventListener('input', () => syncInputFromSlider(heightControl, heightValue, (v) => { boxHeight = v; }, updateBox));
    heightValue.addEventListener('input', () => syncSliderFromInput(heightControl, heightValue, (v) => { boxHeight = v; }, updateBox));
    heightValue.addEventListener('change', () => syncSliderFromInput(heightControl, heightValue, (v) => { boxHeight = v; }, updateBox));

    // Rotate X control
    const rotateXControl = document.getElementById('rotateXControl');
    const rotateXValue = document.getElementById('rotateXValue');
    rotateXControl.addEventListener('input', () => syncInputFromSlider(rotateXControl, rotateXValue, (v) => { rotateX = v; }, updateBox));
    rotateXValue.addEventListener('input', () => syncSliderFromInput(rotateXControl, rotateXValue, (v) => { rotateX = v; }, updateBox));
    rotateXValue.addEventListener('change', () => syncSliderFromInput(rotateXControl, rotateXValue, (v) => { rotateX = v; }, updateBox));

    // Rotate Y control
    const rotateYControl = document.getElementById('rotateYControl');
    const rotateYValue = document.getElementById('rotateYValue');
    rotateYControl.addEventListener('input', () => syncInputFromSlider(rotateYControl, rotateYValue, (v) => { rotateY = v; }, updateBox));
    rotateYValue.addEventListener('input', () => syncSliderFromInput(rotateYControl, rotateYValue, (v) => { rotateY = v; }, updateBox));
    rotateYValue.addEventListener('change', () => syncSliderFromInput(rotateYControl, rotateYValue, (v) => { rotateY = v; }, updateBox));

    // Position X control
    const positionXControl = document.getElementById('positionXControl');
    const positionXValue = document.getElementById('positionXValue');
    positionXControl.addEventListener('input', () => syncInputFromSlider(positionXControl, positionXValue, (v) => { positionX = v; }, updateBox));
    positionXValue.addEventListener('input', () => syncSliderFromInput(positionXControl, positionXValue, (v) => { positionX = v; }, updateBox));
    positionXValue.addEventListener('change', () => syncSliderFromInput(positionXControl, positionXValue, (v) => { positionX = v; }, updateBox));

    // Position Y control
    const positionYControl = document.getElementById('positionYControl');
    const positionYValue = document.getElementById('positionYValue');
    positionYControl.addEventListener('input', () => syncInputFromSlider(positionYControl, positionYValue, (v) => { positionY = v; }, updateBox));
    positionYValue.addEventListener('input', () => syncSliderFromInput(positionYControl, positionYValue, (v) => { positionY = v; }, updateBox));
    positionYValue.addEventListener('change', () => syncSliderFromInput(positionYControl, positionYValue, (v) => { positionY = v; }, updateBox));

    // Position Z control
    const positionZControl = document.getElementById('positionZControl');
    const positionZValue = document.getElementById('positionZValue');
    positionZControl.addEventListener('input', () => syncInputFromSlider(positionZControl, positionZValue, (v) => { positionZ = v; }, updateBox));
    positionZValue.addEventListener('input', () => syncSliderFromInput(positionZControl, positionZValue, (v) => { positionZ = v; }, updateBox));
    positionZValue.addEventListener('change', () => syncSliderFromInput(positionZControl, positionZValue, (v) => { positionZ = v; }, updateBox));

    // Face visibility controls
    const showFrontFace = document.getElementById('showFrontFace');
    const showBackFace = document.getElementById('showBackFace');
    const showRightFace = document.getElementById('showRightFace');
    const showLeftFace = document.getElementById('showLeftFace');
    const showTopFace = document.getElementById('showTopFace');
    const showBottomFace = document.getElementById('showBottomFace');

    function updateFaceVisibility() {
        frontFace.style.display = showFrontFace.checked ? 'flex' : 'none';
        backFace.style.display = showBackFace.checked ? 'flex' : 'none';
        rightFace.style.display = showRightFace.checked ? 'flex' : 'none';
        leftFace.style.display = showLeftFace.checked ? 'flex' : 'none';
        topFace.style.display = showTopFace.checked ? 'flex' : 'none';
        bottomFace.style.display = showBottomFace.checked ? 'flex' : 'none';
    }

    showFrontFace.addEventListener('change', updateFaceVisibility);
    showBackFace.addEventListener('change', updateFaceVisibility);
    showRightFace.addEventListener('change', updateFaceVisibility);
    showLeftFace.addEventListener('change', updateFaceVisibility);
    showTopFace.addEventListener('change', updateFaceVisibility);
    showBottomFace.addEventListener('change', updateFaceVisibility);

    // Initialize face visibility
    updateFaceVisibility();

    // Edge lines control
    const showEdgeLinesControl = document.getElementById('showEdgeLines');
    showEdgeLinesControl.addEventListener('change', () => {
        showEdgeLines = showEdgeLinesControl.checked;
        updateEdgeLines();
    });

    // Pop up amount control
    const popUpAmountControl = document.getElementById('popUpAmountControl');
    const popUpAmountValue = document.getElementById('popUpAmountValue');
    popUpAmountControl.addEventListener('input', () => {
        syncInputFromSlider(popUpAmountControl, popUpAmountValue, (v) => { popUpAmount = v; }, attachIsoCardHoverHandlers);
    });
    popUpAmountValue.addEventListener('input', () => syncSliderFromInput(popUpAmountControl, popUpAmountValue, (v) => { popUpAmount = v; }, attachIsoCardHoverHandlers));
    popUpAmountValue.addEventListener('change', () => syncSliderFromInput(popUpAmountControl, popUpAmountValue, (v) => { popUpAmount = v; }, attachIsoCardHoverHandlers));

    // Initialize edge lines
    updateEdgeLines();

    // Initialize box (this will also set up Iso cards and their hover handlers)
    updateBox();

    // Infinite scroll for Iso cards
    let targetScrollPosition = 0;
    const scrollSensitivity = 0.01; // How much scroll affects position
    
    // Function to handle wheel scroll
    function handleWheelScroll(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Scroll up (deltaY < 0) moves cards forward (targetScrollPosition increases)
        // Scroll down (deltaY > 0) moves cards backward (targetScrollPosition decreases)
        // Negate deltaY because we subtract it in the position calculation
        targetScrollPosition -= e.deltaY * scrollSensitivity;
        
        // Smoothly interpolate scroll position
        requestAnimationFrame(() => {
            scrollPosition += (targetScrollPosition - scrollPosition) * 0.1;
            updateBox();
        });
    }
    
    // Add wheel listeners to window, scene, and box container
    const scene3dEl = document.querySelector('.scene-3d');
    window.addEventListener('wheel', handleWheelScroll, { passive: false });
    if (scene3dEl) {
        scene3dEl.addEventListener('wheel', handleWheelScroll, { passive: false });
    }
    boxContainer.addEventListener('wheel', handleWheelScroll, { passive: false });

    // Touch event handlers for mobile
    let touchStartY = 0;
    let touchStartX = 0;
    let isTouching = false;
    const touchSensitivity = 0.02; // How much touch movement affects position

    // Function to handle touch start
    function handleTouchStart(e) {
        if (e.touches.length === 1) {
            touchStartY = e.touches[0].clientY;
            touchStartX = e.touches[0].clientX;
            isTouching = true;
        }
    }

    // Function to handle touch move
    function handleTouchMove(e) {
        if (isTouching && e.touches.length === 1) {
            e.preventDefault();
            e.stopPropagation();
            const touchY = e.touches[0].clientY;
            const touchX = e.touches[0].clientX;
            const deltaY = touchStartY - touchY; // Positive when swiping up
            const deltaX = touchStartX - touchX;
            
            // Only process vertical swipes (ignore horizontal if vertical movement is significant)
            if (Math.abs(deltaY) > Math.abs(deltaX) || Math.abs(deltaX) < 10) {
                // Swipe up (deltaY > 0) moves cards forward (targetScrollPosition increases)
                // Swipe down (deltaY < 0) moves cards backward (targetScrollPosition decreases)
                targetScrollPosition -= deltaY * touchSensitivity;
                
                // Update touch start position for smooth continuous scrolling
                touchStartY = touchY;
                touchStartX = touchX;
            }
        }
    }

    // Function to handle touch end
    function handleTouchEnd(e) {
        isTouching = false;
    }

    // Add touch listeners to window, scene, and box container
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    
    if (scene3dEl) {
        scene3dEl.addEventListener('touchstart', handleTouchStart, { passive: true });
        scene3dEl.addEventListener('touchmove', handleTouchMove, { passive: false });
        scene3dEl.addEventListener('touchend', handleTouchEnd, { passive: true });
        scene3dEl.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    }
    
    boxContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
    boxContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
    boxContainer.addEventListener('touchend', handleTouchEnd, { passive: true });
    boxContainer.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    
    // Add scroll/touch listeners to all box faces
    [frontFace, backFace, rightFace, leftFace, topFace, bottomFace].forEach(face => {
        if (face) {
            face.addEventListener('wheel', handleWheelScroll, { passive: false });
            face.addEventListener('touchstart', handleTouchStart, { passive: true });
            face.addEventListener('touchmove', handleTouchMove, { passive: false });
            face.addEventListener('touchend', handleTouchEnd, { passive: true });
            face.addEventListener('touchcancel', handleTouchEnd, { passive: true });
        }
    });
    
    // Continuous smooth scrolling animation
    function animateScroll() {
        if (Math.abs(targetScrollPosition - scrollPosition) > 0.01) {
            scrollPosition += (targetScrollPosition - scrollPosition) * 0.1;
            updateBox();
        }
        requestAnimationFrame(animateScroll);
    }
    animateScroll();
    
    // Initialize config display
    updateConfigDisplay();
});
