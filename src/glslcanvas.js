import { create3DContext, createProgram, createShader, parseUniforms } from './gl/gl.js';
import Texture from './gl/texture.js';
import { isCanvasVisible, isDiff } from './utils/common.js';
import { subscribeMixin } from './utils/mixin.js';

export class GLSLCanvas {
    constructor(canvas, contextOptions, options) {
        subscribeMixin(this);

        contextOptions = contextOptions || {};
        options = options || {};

        this.canvas = canvas;
        this.width = canvas.clientWidth;
        this.height = canvas.clientHeight;
        this.devicePixelRatio = window.devicePixelRatio || 1;

        this.gl = undefined;
        this.program = undefined;
        this.textures = {};
        this.buffers = {};
        this.uniforms = {};
        this.vbo = {};
        this.isValid = false;

        this.BUFFER_COUNT = 0;
        // this.TEXTURE_COUNT = 0;

        this.vertexString = contextOptions.vertexString || `
#ifdef GL_ES
precision mediump float;
#endif

attribute vec2 a_position;
attribute vec2 a_texcoord;

varying vec2 v_texcoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texcoord = a_texcoord;
}
`;
        this.fragmentString = contextOptions.fragmentString || `
#ifdef GL_ES
precision mediump float;
#endif

varying vec2 v_texcoord;

void main(){
    gl_FragColor = vec4(0.0);
}
`;

        let gl = create3DContext(canvas);
        if (!gl) {
            return;
        }
        this.gl = gl;
        this.timeLoad = this.timePrev = performance.now();
        this.timeDelta = 0.0;
        this.forceRender = true;
        this.paused = false;

        canvas.style.backgroundColor = contextOptions.backgroundColor || 'rgba(1, 1, 1, 0)';

        if (canvas.hasAttribute('data-fragment')) {
            this.fragmentString = canvas.getAttribute('data-fragment');
        }
        if (canvas.hasAttribute('data-vertex')) {
            this.vertexString = canvas.getAttribute('data-vertex');
        }

        this.load();

        if (!this.program) {
            return;
        }

        let texCoordsLoc = gl.getAttribLocation(this.program, 'a_texcoord');
        this.vbo.texCoords = gl.createBuffer();
        this.gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo.texCoords);
        this.gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0]), gl.STATIC_DRAW);
        this.gl.enableVertexAttribArray(texCoordsLoc);
        this.gl.vertexAttribPointer(texCoordsLoc, 2, gl.FLOAT, false, 0, 0);

        let verticesLoc = gl.getAttribLocation(this.program, 'a_position');
        this.vbo.vertices = gl.createBuffer();
        this.gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo.vertices);
        this.gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]), gl.STATIC_DRAW);
        this.gl.enableVertexAttribArray(verticesLoc);
        this.gl.vertexAttribPointer(verticesLoc, 2, gl.FLOAT, false, 0, 0);

        let mouse = { x: 0, y: 0 };
        document.addEventListener('mousemove', (e) => {
            mouse.x = e.clientX || e.pageX;
            mouse.y = e.clientY || e.pageY;
        }, false);

        let sandbox = this;
        function RenderLoop() {
            if (sandbox.nMouse > 1) {
                sandbox.setMouse(mouse);
            }

            if (sandbox.resize()) {
                sandbox.forceRender = true;
            }
            sandbox.render();
            window.requestAnimationFrame(RenderLoop);
        }

        this.setMouse({ x: 0, y: 0 });
        RenderLoop();
        return this;
    }

    destroy() {
        this.animated = false;
        this.isValid = false;
        for (let tex in this.textures) {
            if (tex.destroy){
                tex.destroy();
            }
        }
        this.textures = {};
        this.gl.useProgram(null);
        this.gl.deleteProgram(this.program);
        //for (let key in this.buffers) {
        //    const buffer = this.buffers[key];
        //    this.gl.deleteProgram(buffer.program);
        //}
        this.program = null;
        this.gl = null;
    }

    load(fragString, vertString) {
        if (vertString) {
            this.vertexString = vertString;
        }
        if (fragString) {
            this.fragmentString = fragString;
        }

        this.animated = false;
        this.nDelta = (this.fragmentString.match(/u_delta/g) || []).length;
        this.nTime = (this.fragmentString.match(/u_time/g) || []).length;
        this.nDate = (this.fragmentString.match(/u_date/g) || []).length;
        this.nMouse = (this.fragmentString.match(/u_mouse/g) || []).length;
        this.animated = this.nDate > 1 || this.nTime > 1 || this.nMouse > 1;

        let vertexShader = createShader(this, this.vertexString, this.gl.VERTEX_SHADER);
        let fragmentShader = createShader(this, this.fragmentString, this.gl.FRAGMENT_SHADER);

        if (!fragmentShader) {
            fragmentShader = createShader(this, 'void main(){\n\tgl_FragColor = vec4(1.0);\n}', this.gl.FRAGMENT_SHADER);
            this.isValid = false;
        } else {
            this.isValid = true;
        }

        let program = createProgram(this, [vertexShader, fragmentShader]);//, [0,1],['a_texcoord','a_position']);
        this.gl.useProgram(program);

        // this.gl.detachShader(program, vertexShader);
        // this.gl.detachShader(program, fragmentShader);
        this.gl.deleteShader(vertexShader);
        this.gl.deleteShader(fragmentShader);

        this.program = program;
        this.change = true;

        // Trigger event
        this.trigger('load', {});

        this.forceRender = true;
        this.render();
    }

    loadTexture (name, urlElementOrData, options) {
        if (!options) {
            options = {};
        }

        if (typeof urlElementOrData === 'string') {
            options.url = urlElementOrData;
        }
        else if (typeof urlElementOrData === 'object' && urlElementOrData.data && urlElementOrData.width && urlElementOrData.height) {
            options.data = urlElementOrData.data;
            options.width = urlElementOrData.width;
            options.height = urlElementOrData.height;
        }
        else if (typeof urlElementOrData === 'object') {
            options.element = urlElementOrData;
        }

        if (this.textures[name]) {
            if (this.textures[name]) {
                this.textures[name].load(options);
                this.textures[name].on('loaded', (args) => {
                    this.forceRender = true;
                });
            }
        }
        else {
            this.textures[name] = new Texture(this.gl, name, options);
            this.textures[name].on('loaded', (args) => {
                this.forceRender = true;
            });
        }

    }

    pause() {
        this.paused = true;
    }

    play() {
        this.paused = false;
    }

    setMouse(mouse) {
        let rect = this.canvas.getBoundingClientRect();
        if (mouse &&
            mouse.x && mouse.x >= rect.left && mouse.x <= rect.right &&
            mouse.y && mouse.y >= rect.top && mouse.y <= rect.bottom) {

            let mouse_x = (mouse.x - rect.left ) * this.realToCSSPixels;
            let mouse_y = (this.canvas.height - (mouse.y - rect.top) * this.realToCSSPixels);

            this.uniform('2f', 'vec2', 'u_mouse', mouse_x, mouse_y);
        }
    }

    resize() {
        if (this.width !== this.canvas.clientWidth || this.height !== this.canvas.clientHeight) {
            this.devicePixelRatio = window.devicePixelRatio || 1;

            let displayWidth = Math.floor(this.gl.canvas.clientWidth * this.devicePixelRatio);
            let displayHeight = Math.floor(this.gl.canvas.clientHeight * this.devicePixelRatio);
            if (this.gl.canvas.width !== displayWidth || this.gl.canvas.height !== displayHeight) {
                this.gl.canvas.width = displayWidth;
                this.gl.canvas.height = displayHeight;
                this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
            }

            this.width = this.canvas.clientWidth;
            this.height = this.canvas.clientHeight;
            this.resizeSwappableBuffers();
            return true;
        }
        return false;
    }

    render() {
        this.visible = isCanvasVisible(this.canvas);
        if (this.forceRender  || (this.visible && !this.paused)) {
            let date = new Date();
            let now = performance.now();
            this.timeDelta =  (now - this.timePrev) / 1000.0;
            this.timePrev = now;

            if (this.nDelta > 1) {
                this.uniform('1f', 'float', 'u_delta', this.timeDelta);
            }
            if (this.nTime > 1 ) {
                this.uniform('1f', 'float', 'u_time', (now - this.timeLoad) / 1000.0);
            }
            if (this.nDate) {
                this.uniform('4f', 'float', 'u_date', date.getFullYear(), date.getMonth(), date.getDate(), date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds() + date.getMilliseconds() * 0.001 );
            }
            this.uniform('2f', 'vec2', 'u_resolution', this.canvas.width, this.canvas.height);
            
            var factor = Math.sin(((now - this.timeLoad) * 0.2) * Math.PI/180);
            this.gl.clearColor(factor * 0.7 + 0.3, factor * 0.7 + 0.3, 0.0, 1.0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

            this.renderPrograms();

            // Trigger event
            this.trigger('render', {});

            this.change = false;
            this.forceRender = false;
        }
    }

    renderPrograms() {
        const gl = this.gl;
        const W = gl.canvas.width;
        const H = gl.canvas.height;

        gl.viewport(0, 0, W, H);

        //for (let key in this.buffers) {
        //    const buffer = this.buffers[key];
        //    buffer.bundle.render(W, H, buffer.program, buffer.name);
        //    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        //}

        gl.useProgram(this.program);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    refreshUniforms() {
        this.uniforms = {};
    }

    setUniform(name, ...value) {
        let u = {};
        u[name] = value;
        this.setUniforms(u);
    }

    setUniforms(uniforms) {
        let parsed = parseUniforms(uniforms);
        for (let u in parsed) {
            if (parsed[u].type === 'sampler2D') {
                // For textures, we need to track texture units, so we have a special setter
                // this.uniformTexture(parsed[u].name, parsed[u].value[0]);
                this.loadTexture(parsed[u].name, parsed[u].value[0]);
            } else {
                this.uniform(parsed[u].method, parsed[u].type, parsed[u].name, parsed[u].value);
            }
        }
        this.forceRender = true;
    }

    uniform(method, type, name, ...value) {
        this.uniforms[name] = this.uniforms[name] || {}; 
        let uniform = this.uniforms[name];
        let change = isDiff(uniform.value, value);

        if (change || this.change || !uniform.location || !uniform.value) {
            uniform.name = name;
            uniform.type = type;
            uniform.value = value;
            uniform.method = 'uniform' + method;
            this.gl.useProgram(this.program);
            uniform.location = this.gl.getUniformLocation(this.program, name);
            this.gl[uniform.method].apply(this.gl, [uniform.location].concat(uniform.value));

            //for (let key in this.buffers) {
            //    let buffer = this.buffers[key];
            //    this.gl.useProgram(buffer.program);
            //    let location = this.gl.getUniformLocation(buffer.program, name);
            //    this.gl[uniform.method].apply(this.gl, [location].concat(uniform.value));
            //}
        }
    }

    resizeSwappableBuffers() {
    }
}
