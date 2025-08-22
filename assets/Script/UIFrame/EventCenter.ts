import { error, js, log, warn } from "cc";
import { DEBUG } from "cc/env";
import { IPool, Pool } from "../Common/Utils/Pool";

export class EventInfo implements IPool {
    callback: Function | null = null;
    target: any;
    once: boolean = false;

    free() {
        this.callback = null;
        this.target = null;
        this.once = false;
    }

    init(callback: Function, target: Object, once: boolean) {
        this.callback = callback;
        this.target = target;
        this.once = once;
    }
}

class RemoveCommand {
    public eventName: string;
    public targetId: string;
    public callback: Function | null;

    constructor(eventName: string, callback: Function | null, targetId: string) {
        this.eventName = eventName;
        this.callback = callback;
        this.targetId = targetId;
    }
}

let idSeed = 1;         // 这里有一个小缺陷就是idSeed有最大值,Number.MAX_VALUE
export class EventCenter {

    private static _listeners: { [eventName: string]: { [id: string]: Array<EventInfo> } } = js.createMap();
    private static _dispatching: number = 0;
    private static _removeCommands: RemoveCommand[] = [];

    private static _eventPool: Pool<EventInfo> = new Pool<EventInfo>(() => {
        return new EventInfo();
    }, 10);

    public static has(eventName: string, target: any = undefined) {
        target = target || this;
        let targetId = target['uuid'] || target['id'];
        if (!targetId) return false;

        let collection = this._listeners[eventName];
        if (!collection) return false;
        let events = collection[targetId];
        if (events) {
            return true;
        }

        return false;

    }

    public static on(eventName: string, callback: Function, target: any = undefined, once = false) {
        target = target || this;
        let targetId: string = target['uuid'] || target['id'];
        if (targetId === undefined) {
            target['uuid'] = targetId = '' + idSeed++;
        }
        this.onById(eventName, targetId, target, callback, once);
    }
    public static once(eventName: string, callback: Function, target: any = undefined) {
        this.on(eventName, callback, target, true);
    }
    private static onById(eventName: string, targetId: string, target: any, cb: Function, once: boolean) {
        let collection = this._listeners[eventName];
        if (!collection) {
            collection = this._listeners[eventName] = {};
        }
        let events = collection[targetId];
        if (!events) {
            events = collection[targetId] = [];
        }
        let eventInfo = this._eventPool.alloc();
        eventInfo.init(cb, target, once);
        events.push(eventInfo);
    }

    public static off(eventName: string, callback: Function, target: any = undefined) {
        target = target || this;
        let targetId = target['uuid'] || target['id'];
        if (!targetId) return false;
        this.offById(eventName, callback, targetId);
    }
    public static targetOff(target: any) {
        target = target || this;
        let targetId = target['uuid'] || target['id'];
        if (!targetId) return;
        for (let event in this._listeners) {
            let collection = this._listeners[event];
            if (collection[targetId] !== undefined) {
                delete collection[targetId];
            }
        }
    }
    private static offById(eventName: string, callback: Function, targetId: string) {
        if (this._dispatching > 0) {
            let cmd = new RemoveCommand(eventName, callback, targetId);
            this._removeCommands.push(cmd);
        } else {
            this.doOff(eventName, callback, targetId);
        }
    }
    private static doOff(eventName: string, callback: Function | null, targetId: string) {
        let collection = this._listeners[eventName];
        if (!collection) return;
        let events = collection[targetId];
        if (!events) return;
        for (let i = events.length - 1; i >= 0; i--) {
            if (events[i].callback === callback) {
                events.splice(i, 1);
            }
        }
        if (events.length === 0) {
            delete collection[targetId];
        }
    }

    private static doRemoveCommands() {
        if (this._dispatching !== 0) {
            return;
        }
        for (let cmd of this._removeCommands) {
            this.doOff(cmd.eventName, cmd.callback, cmd.targetId);
        }
        this._removeCommands.length = 0;
    }

    public static emit(eventName: string, ...param: any[]) {
        let collection = this._listeners[eventName];
        if (!collection) return false;
        this._dispatching++;
        for (let targetId in collection) {
            for (let eventInfo of collection[targetId]) {
                eventInfo.callback && eventInfo.callback.call(eventInfo.target, ...param);
                if (eventInfo.once) {
                    let cmd = new RemoveCommand(eventName, eventInfo.callback, targetId);
                    this._removeCommands.push(cmd);
                }
            }
        }
        this._dispatching--;
        this.doRemoveCommands();
    }
}

/**
 * 类装饰器 附加事件中心
 * 注意：通过本方式附加的事件,函数的接收参数为(data,succ,fail),分发事件的数据仅支持第一个参数
 * @param onLoadAdd true 在onLoad中添加事件 false 自己在合适时机添加事件
 * @returns 
 */
export function attachEventCenter(onLoadAdd = true) {
    return function (target) {

        target.prototype.eventQueue = {
            queue: [], handleMutex: false,
            enqueue(data) { this.queue.push(data); },
            dequeue() { return this.queue.shift(); },
            empty() { return this.queue.length == 0; },
            clear() { this.queue = []; },
            reset() { this.clear(); this.handleMutex = false; },
        }


        var __load = target.prototype.onLoad;
        target.prototype.onLoad = function () {
            if (onLoadAdd) {
                addInstantHandler(this);
                addQueueHandler(this);
            }
            __load && __load.bind(this)();
        }

        var __update = target.prototype.update;
        target.prototype.update = function (dt) {

            // 处理API 消息队列消息
            if (!this.eventQueue.handleMutex && //上条消息未处理完成.
                !this.eventQueue.empty()) {
                let { eventName, funcName, data, target } = this.eventQueue.dequeue();//取出一条消息。

                let beforeRet = true;
                if (this["_onBeforeQueueEvent"]) {
                    beforeRet = this["_onBeforeQueueEvent"](eventName, data) ?? true;
                }

                if (beforeRet) {
                    // this.eventQueue.handleMutex = true;
                    // console.log("BaseService update func", target[funcName] instanceof Function, target[funcName])
                    if (target[funcName] instanceof Function) {
                        let handleTime = target[funcName].bind(target)(data) || 0;
                        if (typeof handleTime != "number") {
                            error(`type error: ${js.getClassName(target)}.${funcName} return type error,not number type!`);
                        }

                        //设置为正在处理
                        this.eventQueue.handleMutex = true;
                        setTimeout(() => {
                            this.eventQueue.handleMutex = false;
                        }, 1000 * handleTime);
                    } else {
                        error(`type error: ${js.getClassName(target)}.${funcName} not a function`);
                        this.eventQueue.handleMutex = false;
                    }
                }
            }

            __update && __update.bind(this)(dt);
        }

        var __destroy = target.prototype.onDestroy;
        target.prototype.onDestroy = function () {
            removeTargetHandler(this);
            __destroy && __destroy.bind(this)();
        }
    }
}


/**
 * 方法装饰器，为方法绑定一个事件名， 将方法声明为一个事件处理函数， 用于处理即时派发处理的消息
 * 注意：通过本方式附加的事件,函数的接收参数为(data,succ,fail),分发事件的数据仅支持第一个参数
 * @param eventName :string 事件名 
 * 
 * 自动附加(推荐) 在类声明前添加如下行
 * @attachEventCenter()
 * 
 * 手动初始化在函数内部添加如下行
 * addInstantHandler(this);
 * 
 * 手动销毁在函数内部添加如下行
 * removeTargetHandler(this);
 * 
 */
export function bindInstantEvent(eventName: string | number) {
    return function (target, funcName) {
        if (!target['__instantHandlerBinder']) {
            target['__instantHandlerBinder'] = {};
        }
        if (target['__instantHandlerBinder'][eventName]) {
            return warn('eventName has already been declared:' + eventName);
        } else {
            target['__instantHandlerBinder'][eventName] = funcName;
        }
    }
}

/**
 * 方法装饰器，为方法绑定一个事件名， 将方法声明为一个事件处理函数， 用于处理先入队，后派发处理的消息
 * 注意：通过本方式附加的事件,函数的接收参数为(data,succ,fail),分发事件的数据仅支持第一个参数
 * @param eventName :string 事件名 
 */
export function bindQueueEvent(eventName: string | number) {
    return function (target, funcName) {
        if (!target['__queueHandlerBinder']) {
            target['__queueHandlerBinder'] = {};
        }
        if (target['__queueHandlerBinder'][eventName]) {
            return warn('eventName has already been declared:' + eventName);
        } else {
            target['__queueHandlerBinder'][eventName] = funcName;
        }
    }
}


/**
* 添加即时回调消息处理handler信息
* 注意：通过本方式附加的事件,函数的接收参数为(data,succ,fail),分发事件的数据仅支持第一个参数
*/
export function addInstantHandler(target) {
    let __proto = Object.getPrototypeOf(target);
    const instantHandlerMap = __proto['__instantHandlerBinder']
    instantHandlerMap && Reflect.ownKeys(instantHandlerMap).forEach((eventName: string) => {

        if (!EventCenter.has(eventName, target)) {
            let callbackFuncName: symbol = instantHandlerMap[eventName];
            EventCenter.on(eventName, function (evnet) {
                let detail = evnet && evnet.detail;
                if (detail == null) {
                    detail = {
                        data: evnet
                    };
                }

                let beforeRet = true;
                if (this["_onBeforeInstantEvent"]) {
                    beforeRet = this["_onBeforeInstantEvent"](eventName, detail.data) ?? true;
                }

                if (beforeRet) {
                    if (this[callbackFuncName] && this[callbackFuncName].bind) {
                        this[callbackFuncName].bind(this)(detail.data, detail.succ, detail.fail);
                    } else {
                        error(`${String(eventName)} is no function`);
                    }
                } else {
                    log(`${String(eventName)} is ignore handle!`);
                }

            }, target);
        }

    });
}

export function removeTargetHandler(target) {
    EventCenter.targetOff(target);
}


/**
* 添加入队回调消息处理handler信息
* 注意：通过本方式附加的事件,函数的接收参数为(data,succ,fail),分发事件的数据仅支持第一个参数
*/
export function addQueueHandler(target) {
    let __proto = Object.getPrototypeOf(target);
    const queueHandlerMap = __proto['__queueHandlerBinder']
    queueHandlerMap && Reflect.ownKeys(queueHandlerMap).forEach((eventName: string) => {
        if (!EventCenter.has(eventName, target)) {
            let callbackFuncName: symbol = queueHandlerMap[eventName];
            EventCenter.on(eventName, function (evnet) {
                let detail = evnet && evnet.detail;
                if (detail == null) {
                    detail = {
                        data: evnet
                    };
                }

                this.eventQueue.enqueue({
                    eventName,
                    funcName: callbackFuncName,
                    data: detail.data,
                    target: this
                });

            }, target);
        }
    });
}

/**
 * 获取消息队列
 */
export function getTargetEventQueue(target) {
    let clear = target.eventQueue.clear.bind(target.eventQueue);
    let reset = target.eventQueue.reset.bind(target.eventQueue);
    return { clear, reset };
}

if (DEBUG) {
    window["EventCenter"] = EventCenter;
}