import {IContext} from "ctx-api";

export interface IEventLoop {
    new(...params: any[]): {
        setTimeout<Args extends any[]>(callback: (...args: Args) => void, ms?: number, ...args: Args): NodeJS.Timeout;
        clearTimeout(timeout: NodeJS.Timeout): void;
        setInterval<Args extends any[]>(callback: (...args: Args) => void, ms?: number, ...args: Args): NodeJS.Timer;
        clearInterval(interval: NodeJS.Timeout): void;
        setImmediate<Args extends any[]>(callback: (...args: Args) => void, ...args: Args): NodeJS.Immediate;
        clearImmediate(immediate: NodeJS.Immediate): void;
        getContextTimeouts(): Set<NodeJS.Timeout>;
        getContextIntervals(): Set<NodeJS.Timer>;
        getContextImmediats(): Set<NodeJS.Immediate>;
    };
}

export function EventLoopMixin<Context extends IContext>(contextClass: Context): IEventLoop & Context {
    function contextCallback(this: InstanceType<IContext>, callback: (...args: any[]) => void, ...args: any[]): void {
        if(this.isFrozenStrict())
            return;
        return callback(...args);
    }
    function contextTimeoutCallback(this: InstanceType<IContext> & InstanceType<IEventLoop>, getter: () => NodeJS.Timeout, callback: (...args: any[]) => void, ...args: any[]) {
        contextCallback.call(this, callback, ...args);
        this.getContextTimeouts().delete(getter());
    }
    function contextImmediateCallback(this: InstanceType<IContext> & InstanceType<IEventLoop>, getter: () => NodeJS.Immediate, callback: (...args: any[]) => void, ...args: any[]) {
        contextCallback.call(this, callback, ...args);
        this.getContextImmediats().delete(getter());
    }
    return class EventLoopContext extends contextClass {
        public contextTimeouts?: Set<NodeJS.Timeout>;
        public contextIntervals?: Set<NodeJS.Timer>;
        public contextImmediats?: Set<NodeJS.Immediate>;
        
        public setTimeout<Args extends any[]>(callback: (...args: Args) => void, ms?: number, ...args: Args): NodeJS.Timeout {
            const timeout: NodeJS.Timeout = setTimeout(contextTimeoutCallback.bind(this, () => timeout, callback as any), ms, ...args);
            this.getContextTimeouts().add(timeout);
            return timeout;
        }

        public clearTimeout(timeout: NodeJS.Timeout): void {
            if(this.getContextTimeouts().delete(timeout))
                clearTimeout(timeout);
        }

        public setInterval<Args extends any[]>(callback: (...args: Args) => void, ms?: number, ...args: Args): NodeJS.Timer {
            const interval: NodeJS.Timer = setInterval(contextCallback.bind(this, callback as any), ms, ...args);
            this.getContextIntervals().add(interval);
            return interval;
        }

        public clearInterval(interval: NodeJS.Timeout): void {
            if(this.getContextIntervals().delete(interval))
                clearInterval(interval);
        }

        public setImmediate<Args extends any[]>(callback: (...args: Args) => void, ...args: Args): NodeJS.Immediate {
            const immediate: NodeJS.Immediate = setImmediate(contextImmediateCallback.bind(this, () => immediate, callback as any), ...args);
            this.getContextImmediats().add(immediate);
            return immediate;
        }

        public clearImmediate(immediate: NodeJS.Immediate): void {
            if(this.getContextImmediats().delete(immediate))
                clearImmediate(immediate);
        }

        public getContextTimeouts(): Set<NodeJS.Timeout> {
            return this.contextTimeouts ?? new Set;
        }

        public getContextIntervals(): Set<NodeJS.Timer> {
            return this.contextIntervals ?? new Set;
        }

        public getContextImmediats(): Set<NodeJS.Immediate> {
            return this.contextImmediats ?? new Set;
        }

        public handleContextCreate(): void {
            super.handleContextCreate();
            this.contextTimeouts = new Set;
            this.contextIntervals = new Set;
            this.contextImmediats = new Set;
        }

        public handleContextDestroy(): void {
            super.handleContextDestroy();
            if(this.contextTimeouts) {
                for(const timeout of this.contextTimeouts)
                    clearTimeout(timeout);
                delete this.contextTimeouts;
            }
            if(this.contextIntervals) {
                for(const interval of this.contextIntervals)
                    clearInterval(interval);
                delete this.contextIntervals;
            }
            if(this.contextImmediats) {
                for(const immediate of this.contextImmediats)
                    clearImmediate(immediate);
                delete this.contextImmediats;
            }
        }
    }
}