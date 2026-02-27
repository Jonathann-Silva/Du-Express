// This is a simple, homemade event emitter to avoid pulling in the 'events'
// package, which is a Node.js built-in and not ideal for the browser.
// It allows different parts of the app to communicate without direct dependencies.

type Listener = (event: any) => void;
type Listeners = {
    [key: string]: Listener[];
}

class Emitter {
    private listeners: Listeners = {};

    on(event: string, listener: Listener) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(listener);
    }

    off(event: string, listener: Listener) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(l => l !== listener);
    }

    emit(event: string, data: any) {
        if (!this.listeners[event]) return;
        this.listeners[event].forEach(listener => listener(data));
    }
}

// We store the emitter on the global object in development to prevent
// it from being re-created on every hot reload.
// @ts-ignore
if (process.env.NODE_ENV === 'development' && !global.errorEmitter) {
    // @ts-ignore
    global.errorEmitter = new Emitter();
}

const errorEmitter = 
    // @ts-ignore
    process.env.NODE_ENV === 'development' ? global.errorEmitter : new Emitter();

export { errorEmitter };
