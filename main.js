import { GLSLCanvas } from './src/glslcanvas.js'

window.addEventListener("hashchange", function() {
    init()
}, false);

window.onload = function() {
    init();
};

function removeElementsByClass(className) {
    let elements = document.getElementsByClassName(className);
    while (elements.length > 0) {
        elements[0].parentNode.removeChild(elements[0]);
    }
}

function init() {
    removeElementsByClass("CodeMirror");

    initEditor();
    initToolbar();
    initPreview();
    
    window.compileOnChangeCode = true;
    onWindowResize();

    function initPreview() {
        let fragShader = `
precision mediump float;

uniform vec3 iResolution;
uniform float iTime;

void main() {
    vec2 uv = gl_FragCoord.xy / iResolution.xy;
    vec3 col = 0.5 + 0.5 * cos(iTime + uv.xyx + vec3(0, 2, 4));
    gl_FragColor = vec4(col, 1.0);
}`;

        let canvas = document.createElement("canvas");
        canvas.id = "canvas";
		canvas.style.display = "block";
        canvas.setAttribute("data-fragment", fragShader);
        document.body.appendChild(canvas);

        window.preview = new GLSLCanvas(canvas);

        //if (imgs.length > 0) {
        //    var textureList = "";
        //    for(i in imgs){
        //        textureList += imgs[i];
        //        textureList += (i < imgs.length-1)?",":"";
        //    }
        //    demoCanvas.setAttribute("data-textures",textureList);
        //    console.log("data-textures: " + textureList);
        //}
        //loadShaders();

        window.preview.on("loadProgram", (args) => {
            let compileButton = document.getElementById("compile");
            if (compileButton) {
                compileButton.style.color = "#00ff00";
                compileButton.textContent = "compiled successfully";
            }
        });
        window.preview.on("gl_error_compile", (arg) => {
            let compileButton = document.getElementById("compile");
            if (compileButton) {
                compileButton.style.color = "#ff0000";
                compileButton.textContent = "compiled failed";
            }
        });
        window.preview.on("gl_error_link", (arg) => {
            let compileButton = document.getElementById("compile");
            if (compileButton) {
                compileButton.style.color = "#ff0000";
                compileButton.textContent = "compiled failed";
            }
        });

        window.editor.setValue(fragShader);
        compilePreview();
    }

    function initEditor() {
        let editor = CodeMirror(document.body, {
            lineNumbers: true,
            matchBrackets: true,
            mode: "x-shader/x-fragment",
            keyMap: "sublime",
            autoCloseBrackets: true,
            extraKeys: {"Ctrl-Space": "autocomplete"},
            showCursorWhenSelecting: true,
            theme: "monokai",
            indentUnit: 4,
            scrollbarStyle: "overlay"
        });
        editor.getWrapperElement().style.display = "";
        editor.on("change", function() {
            if (window.compileOnChangeCode) {
                clearTimeout(window.compileTimer);
                window.compileTimer = setTimeout(compilePreview, 500);
            }
        });
        window.editor = editor;
    
        let temp = {};
        temp.offsetMouseX = 0;
        temp.offsetMouseY = 0;
        temp.isResizing = false;
        temp.currentWidth = 100;
        temp.currentHeight = 100;
        temp.minWidth = 100;
        temp.minHeight = 100;
        temp.maxWidth = 100;
        temp.maxHeight = 100;
        temp.element = document.createElement("div");
        temp.element.className = "resizer";
        editor.getWrapperElement().appendChild(temp.element);
        window.resizer = temp;
    
        resizer.element.addEventListener("mousedown", function(event) {
            dragStarted(event);
        }, false);
    
        document.addEventListener("mouseup", function(event) {
            dragEnded(event);
        }, false);
    
        document.addEventListener("mouseleave", function(event) {
            dragEnded(event)
        }, false);
    
        document.addEventListener("mousemove", function (event) {
            dragMoving(event);
        }, false);
    
        window.addEventListener("resize", onWindowResize, false);
    }

    function initToolbar() {
        let toolbar = document.createElement("div");
        toolbar.style.position = "absolute";
        toolbar.style.top = "25px";
        toolbar.style.left = "25px";
        document.body.appendChild(toolbar);

        let hideButton = document.createElement("button");
        hideButton.textContent = "hide code";
        hideButton.addEventListener("click", function (event) {
            let compileButton = document.getElementById("compile");
            let autoButton = document.getElementById("auto");
            if (isCodeVisible()) {
                hideButton.textContent = "show code";
                window.editor.getWrapperElement().style.display = "none";
                compileButton.style.visibility = "hidden";
                autoButton.style.visibility = "hidden";
            } else {
                hideButton.textContent = "hide code";
                window.editor.getWrapperElement().style.display = "";
                compileButton.style.visibility = "visible";
                autoButton.style.visibility = "visible";
            }
        }, false);
        toolbar.appendChild(hideButton);
        
        let autoButton = document.createElement("button");
        autoButton.id = "auto";
        autoButton.textContent = "auto on";
        autoButton.addEventListener("click", function (event) {
            window.compileOnChangeCode = !window.compileOnChangeCode;
            autoButton.textContent = "auto off";
            clearTimeout(window.compileTimer);
            if (window.compileOnChangeCode) {
                autoButton.textContent = "auto on";
                window.compileTimer = setTimeout(compilePreview, 500);
            }
        }, false);
        toolbar.appendChild(autoButton);

        let loadButton = document.createElement("button");
        loadButton.id = "load";
        loadButton.textContent = "load...";
        loadButton.addEventListener("click", function (event) {
            loadShaderFromFile();
        }, false);
        toolbar.appendChild(loadButton);

        let saveButton = document.createElement("button");
        saveButton.id = "save";
        saveButton.textContent = "save...";
        saveButton.addEventListener("click", function (event) {
            saveShaderToFile();
        }, false);
        toolbar.appendChild(saveButton);

        let compileButton = document.createElement("button");
        compileButton.id = "compile";
        compileButton.textContent = "compile";
        compileButton.addEventListener("click", function (event) {
            compilePreview();
        }, false);
        toolbar.appendChild(compileButton);
    }

    function compilePreview() {
        let shaderCode = window.editor.getValue();
        window.preview.loadProgram(shaderCode);
    }

    function uploadShaderCode(contents) {
        let editor = window.editor;
        if (editor) {
            editor.setValue(contents);
            compilePreview();
        }
    }
    
    function clickElem(elem) {
        // Thx user1601638 on Stack Overflow (6/6/2018 - https://stackoverflow.com/questions/13405129/javascript-create-and-save-file )
        var eventMouse = document.createEvent("MouseEvents");
        eventMouse.initMouseEvent("click", true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
        elem.dispatchEvent(eventMouse);
    }

    function loadShaderFromFile() {
        let readFile = function(e) {
            let file = e.target.files[0];
            if (!file) {
                return;
            }
            let reader = new FileReader();
            reader.onload = function(e) {
                var contents = e.target.result;
                fileInput.func(contents);
                document.body.removeChild(fileInput);
            }
            reader.readAsText(file);
        }
        let fileInput = document.createElement("input");
        fileInput.type = 'file';
        fileInput.style.display = 'none';
        fileInput.onchange = readFile;
        fileInput.func = uploadShaderCode;
        document.body.appendChild(fileInput);
        clickElem(fileInput);
    }

    function saveShaderToFile() {
        let editor = window.editor;
        if (editor) {
            let filename = "shader.txt";
            let content = editor.getValue();
            let pom = document.createElement('a');
            pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
            pom.setAttribute('download', filename);
            
            if (document.createEvent) {
                var event = document.createEvent('MouseEvents');
                event.initEvent('click', true, true);
                pom.dispatchEvent(event);
            } else {
                pom.click();
            }
        }
    }

    function isCodeVisible() {
        if (window.editor) {
            return window.editor.getWrapperElement().style.display !== "none";
        }
        return false;
    }

    function dragStarted(event) {
        if (event.button !== 2) {
            let resizer = window.resizer;
            if (resizer) {
                resizer.offsetMouseX = event.clientX - resizer.currentWidth;
                resizer.offsetMouseY = event.clientY - resizer.currentHeight;
                resizer.isResizing = true;
            }
            event.preventDefault();
        }
    }

    function dragMoving(event) {
        let clientLastX = window.clientLastX;
        let clientLastY = window.clientLastY;
        let clientX = event.clientX;
        let clientY = event.clientY;
        if (clientLastX == clientX && clientLastY == clientY) {
            return;
        }
        
        window.clientLastX = clientX;
        window.clientLastY = clientY;
        
        let resizer = window.resizer;
        if (resizer && resizer.isResizing) {
            resizer.currentWidth = Math.max(Math.min(clientX - resizer.offsetMouseX, resizer.maxWidth), resizer.minWidth);
            resizer.currentHeight = Math.max(Math.min(clientY - resizer.offsetMouseY, resizer.maxHeight), resizer.minWidth);
            let editor = window.editor;
            if (editor) {
                editor.getWrapperElement().style.width = resizer.currentWidth + "px";
                editor.getWrapperElement().style.height = resizer.currentHeight + "px";
                editor.refresh();
            }
            event.preventDefault();
        }
    }

    function dragEnded(event) {
        let resizer = window.resizer;
        if (resizer) {
            resizer.isResizing = false;
        }
        document.body.style.cursor = "default";
    }

    function onWindowResize(event) {
        let resizer = window.resizer;
        if (resizer) {
            let isMaxWidth = ((resizer.currentWidth === resizer.maxWidth) || (resizer.currentWidth === resizer.minWidth));
            let isMaxHeight = ((resizer.currentHeight === resizer.maxHeight) || (resizer.currentHeight === resizer.minHeight));
        
            resizer.isResizing = false;
            resizer.maxWidth = window.innerWidth - 75;
            resizer.maxHeight = window.innerHeight - 125;
            if (isMaxWidth || (resizer.currentWidth > resizer.maxWidth)) {
                resizer.currentWidth = resizer.maxWidth;
            }
            if (isMaxHeight || (resizer.currentHeight > resizer.maxHeight)) {
                resizer.currentHeight = resizer.maxHeight;
            }
            if (resizer.currentWidth < resizer.minWidth) { resizer.currentWidth = resizer.minWidth; }
            if (resizer.currentHeight < resizer.minHeight) { resizer.currentHeight = resizer.minHeight; }
        }

        let editor = window.editor;
        if (editor) {
            editor.getWrapperElement().style.top = "75px";
            editor.getWrapperElement().style.left = "25px";
            editor.getWrapperElement().style.width = resizer.currentWidth + "px";
            editor.getWrapperElement().style.height = resizer.currentHeight + "px";
        }

        let canvas = document.getElementById("canvas");
        if (canvas) {
            canvas.style.width = window.innerWidth + "px";
            canvas.style.height = window.innerHeight + "px";
        }
    }
}
