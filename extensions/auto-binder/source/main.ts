import { ExecuteSceneScriptMethodOptions } from '@cocos/creator-types/editor/packages/scene/@types/public';
import packageJSON from '../package.json';

/**
 * @en Registration method for the main process of Extension
 * @zh 为扩展的主进程的注册方法
 */
export const methods: { [key: string]: (...any: any) => any } = {
    /**
     * @en A method that can be triggered by message
     * @zh 通过 message 触发的方法
     */
    showLog() {
        console.log('Hello World');
    },

    async bindRoot() {

        const options: ExecuteSceneScriptMethodOptions = {
            name: packageJSON.name,
            method: 'bindRoot',
            args: [],
        };

        const result = await Editor.Message.request(
            'scene',
            'execute-scene-script',
            options
        );
        // console.log('返回值：', result); // { result: 3 }
    },

    async bindNode() {
        const options: ExecuteSceneScriptMethodOptions = {
            name: packageJSON.name,
            method: 'bindNode',
            args: [],
        };

        const result = await Editor.Message.request(
            'scene',
            'execute-scene-script',
            options
        );
        // console.log('返回值：', result); // { result: 3 }
    }

};

/**
 * @en Method Triggered on Extension Startup
 * @zh 扩展启动时触发的方法
 */
export function load() { }

/**
 * @en Method triggered when uninstalling the extension
 * @zh 卸载扩展时触发的方法
 */
export function unload() { }

