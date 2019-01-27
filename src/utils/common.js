export function isCanvasVisible(canvas) {
    return (
        (canvas.getBoundingClientRect().top + canvas.height) > 0) &&
        (canvas.getBoundingClientRect().top < (window.innerHeight || document.documentElement.clientHeight)
    );
}

export function isPowerOf2(value) {
    return (value & (value - 1)) === 0;
}

export function isSafari () {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
};

export function nextHighestPowerOfTwo(x) {
    --x;
    for (let i = 1; i < 32; i <<= 1) {
        x = x | x >> i;
    }
    return x + 1;
}

export function isDiff(a, b) {
    if (a && b) {
        return a.toString() !== b.toString();
    }
    return false;
}